"""Cluster registration service layer.

Routes call into this module; the module owns all DB writes + connector
construction. Pitfall A4: ``validate()`` is called BEFORE every persisting
write (INSERT or UPDATE-with-new-token), so a bad token can never land on
disk.

Functions:

- :func:`test_cluster` — pure dry-run; builds a transient connector, validates,
  returns a structured ``{ok, version, error}`` payload. NO DB writes.
- :func:`register_cluster` — validate-then-persist. Returns the new ``Cluster``
  row.
- :func:`validate_token` — re-validate an EXISTING cluster's stored token.
  Returns the version payload on success.
- :func:`update_cluster` — patch; re-validates if the token is being replaced.
  Always invalidates the registry cache.
- :func:`delete_cluster` — refuses with 409 if any ``team_cluster_tokens``
  row references the cluster; otherwise deletes + invalidates the registry.
- :func:`list_clusters` — read-only.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.clusters.connector import PVEConnector
from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
from app.clusters.registry import PVEConnectorRegistry
from app.clusters.schemas import (
    ClusterCreate,
    ClusterTestRequest,
    ClusterTestResponse,
    ClusterUpdate,
)
from app.models import Cluster, TeamClusterToken

logger = logging.getLogger(__name__)

# Health-probe interval (seconds) for the per-cluster /version probe.
_PROBE_INTERVAL = 15.0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_transient_connector(
    *,
    host: str,
    port: int,
    token_user: str,
    token_name: str,
    api_token_secret: str,
    verify_ssl: bool,
    tls_fingerprint: str | None,
) -> PVEConnector:
    """Build a one-shot connector for validation flows (test / register / update).

    Separate from registry-cached connectors because (a) we don't yet have a
    cluster_id at register time and (b) test/update with new token must
    bypass the cache.
    """
    return PVEConnector(
        host=host,
        port=port,
        token_user=token_user,
        token_name=token_name,
        token_value=api_token_secret,
        verify_ssl=verify_ssl,
        tls_fingerprint=tls_fingerprint,
    )


async def _start_cluster_probe(
    registry: PVEConnectorRegistry, cluster_id: int, *, db: AsyncSession,
) -> None:
    """Best-effort start of a cluster's background health probe.

    The lifespan in :mod:`app.main` only wires probes for clusters that
    exist at boot. A cluster registered *afterwards* would otherwise have no
    probe, so its ClusterStatusPill stays stuck on ``'untested'`` until the
    next restart — this closes that gap. A probe that fails to spawn must
    never fail the (already-committed) cluster mutation that triggered it.
    """
    try:
        await registry.start_probe(cluster_id, db=db, interval=_PROBE_INTERVAL)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "health probe failed to start for cluster %s: %s", cluster_id, exc,
        )


async def _restart_cluster_probe(
    registry: PVEConnectorRegistry, cluster_id: int, *, db: AsyncSession,
) -> None:
    """Best-effort cancel + respawn of a cluster's probe so it rebinds to a
    fresh connector after the cluster's host/token changed."""
    try:
        await registry.stop_probe(cluster_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "health probe stop failed for cluster %s: %s", cluster_id, exc,
        )
    await _start_cluster_probe(registry, cluster_id, db=db)


# ---------------------------------------------------------------------------
# Dry-run / validation
# ---------------------------------------------------------------------------


async def test_cluster(payload: ClusterTestRequest) -> ClusterTestResponse:
    """Dry-run a cluster registration — NO DB write.

    Plan 10's Admin Clusters page surfaces this as a "Test" button users can
    click before committing.

    Failure modes are normalised to human-friendly strings (the UI displays
    them verbatim). The actual exception type is not exposed.
    """
    connector = _build_transient_connector(
        host=payload.host, port=payload.port,
        token_user=payload.token_user, token_name=payload.token_name,
        api_token_secret=payload.api_token_secret,
        verify_ssl=payload.verify_ssl, tls_fingerprint=payload.tls_fingerprint,
    )
    try:
        version_payload = await connector.version()
    except PVEAuthError:
        return ClusterTestResponse(ok=False, error="Proxmox rejected that token.")
    except PVEUnreachable:
        return ClusterTestResponse(ok=False, error="Couldn't reach that URL.")
    except PVEAPIError:
        return ClusterTestResponse(
            ok=False, error="Proxmox returned an unexpected error.",
        )

    return ClusterTestResponse(
        ok=True,
        version=version_payload.get("version"),
        release=version_payload.get("release"),
    )


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


async def register_cluster(
    db: AsyncSession,
    *,
    payload: ClusterCreate,
    registry: PVEConnectorRegistry | None = None,
) -> Cluster:
    """Validate, persist, then bootstrap existing teams. Pitfall A4 + Pitfall 8.

    If ``registry`` is supplied, every active team gets a PVE pool/user/token
    on the new cluster atomically — without this, the first-run wizard ends
    with team_cluster_tokens empty and /inventory shows 0 VMs.

    Raises:
        HTTPException(422): token failed validation (PVEAuthError),
            or schema constraint failed, or name uniqueness violated.
        HTTPException(502): PVE unreachable / unexpected API error.
        HTTPException(500): tenant bootstrap failed on the new cluster
            (DB row + any partial PVE state are rolled back / cleaned up).
    """
    connector = _build_transient_connector(
        host=payload.host, port=payload.port,
        token_user=payload.token_user, token_name=payload.token_name,
        api_token_secret=payload.api_token_secret,
        verify_ssl=payload.verify_ssl,
        tls_fingerprint=payload.tls_fingerprint,
    )
    # Pitfall A4: validate BEFORE persist.
    try:
        await connector.validate()
    except PVEAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Proxmox rejected that token.",
        ) from exc
    except PVEUnreachable as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't reach that Proxmox URL.",
        ) from exc
    except PVEAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Proxmox returned an unexpected error.",
        ) from exc

    cluster = Cluster(
        name=payload.name,
        host=payload.host,
        port=payload.port,
        verify_ssl=payload.verify_ssl,
        token_user=payload.token_user,
        token_name=payload.token_name,
        api_token_secret=payload.api_token_secret,  # EncryptedSecret column
        tls_fingerprint=payload.tls_fingerprint,
        notes=payload.notes,
    )
    db.add(cluster)
    # flush, don't commit yet — bootstrap_all_teams_on_cluster shares this
    # transaction; if it fails the cluster INSERT rolls back with it.
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A cluster with that name already exists.",
        ) from exc

    if registry is not None:
        # Lazy import — bootstrap pulls PVEConnectorRegistry which imports
        # this module for delete_cluster, leading to a circular import at
        # top level. Local import sidesteps it.
        from app.teams.bootstrap import (
            BootstrapFailed,
            bootstrap_all_teams_on_cluster,
        )
        try:
            await bootstrap_all_teams_on_cluster(
                db, registry, cluster=cluster,
                comment=f"cluster {cluster.name}",
            )
        except BootstrapFailed as exc:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    f"Cluster validated but tenant bootstrap failed on "
                    f"{exc.cluster_name}: {exc.original}"
                ),
            ) from exc

    await db.commit()
    await db.refresh(cluster)
    # The cluster is now persisted. If it was registered after app boot the
    # lifespan probe-wiring already ran without it — start its probe now so
    # the ClusterStatusPill reflects live reachability (CLUST-03).
    if registry is not None:
        await _start_cluster_probe(registry, cluster.id, db=db)
    return cluster


# ---------------------------------------------------------------------------
# Re-validate (manual probe)
# ---------------------------------------------------------------------------


async def backfill_bootstrap(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    cluster_id: int,
) -> dict:
    """Run bootstrap_all_teams_on_cluster on an existing cluster (Plan 02-08).

    Idempotent — teams that already have a ``team_cluster_tokens`` row for
    this cluster are skipped. Intended for retroactive remediation of
    clusters that were registered before the auto-bootstrap fix shipped.

    Returns: ``{"cluster_id": int, "bootstrapped_teams": int, "team_ids": [int]}``.

    Raises:
        HTTPException(404): cluster not found.
        HTTPException(500): bootstrap failed on at least one team.
    """
    cluster = await db.get(Cluster, cluster_id)
    if cluster is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found",
        )
    from app.teams.bootstrap import (
        BootstrapFailed,
        bootstrap_all_teams_on_cluster,
    )
    try:
        results = await bootstrap_all_teams_on_cluster(
            db, registry, cluster=cluster, comment=f"backfill cluster {cluster.name}",
        )
    except BootstrapFailed as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tenant bootstrap failed on {exc.cluster_name}: {exc.original}",
        ) from exc
    await db.commit()
    return {
        "cluster_id": cluster.id,
        "bootstrapped_teams": len(results),
        "team_ids": [r.cluster_id and _team_id_from_userid(r.userid) for r in results],
    }


def _team_id_from_userid(userid: str) -> int:
    """Extract team_id from PVE userid format ``gui-team-<id>@pve``."""
    return int(userid.removeprefix("gui-team-").split("@", 1)[0])


async def validate_token(
    db: AsyncSession, *, cluster_id: int,
) -> ClusterTestResponse:
    """Re-validate the stored token for an existing cluster.

    Used by ``POST /api/v1/clusters/{cluster_id}/test`` (CLUST-06 manual probe).
    The result is shaped exactly like :func:`test_cluster` for UI consistency.
    """
    row = await db.get(Cluster, cluster_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found")

    connector = _build_transient_connector(
        host=row.host, port=row.port,
        token_user=row.token_user, token_name=row.token_name,
        api_token_secret=row.api_token_secret,
        verify_ssl=row.verify_ssl, tls_fingerprint=row.tls_fingerprint,
    )
    try:
        version_payload = await connector.version()
    except PVEAuthError:
        return ClusterTestResponse(ok=False, error="Proxmox rejected that token.")
    except PVEUnreachable:
        return ClusterTestResponse(ok=False, error="Couldn't reach that URL.")
    except PVEAPIError:
        return ClusterTestResponse(
            ok=False, error="Proxmox returned an unexpected error.",
        )
    return ClusterTestResponse(
        ok=True,
        version=version_payload.get("version"),
        release=version_payload.get("release"),
    )


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


async def update_cluster(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    cluster_id: int,
    payload: ClusterUpdate,
) -> Cluster:
    """Patch an existing cluster row.

    Validation rules:

    - If ``api_token_secret`` is present in the payload, the new token is
      validated BEFORE persistence (using the (possibly updated) host /
      port / token_user / token_name from the payload, falling back to the
      stored values for anything not provided).
    - If ``api_token_secret`` is absent, the existing encrypted token is
      preserved untouched.
    - Connector cache is invalidated on EVERY successful update — even
      benign name-only patches — so we never serve a stale cached client
      after operator changes.
    """
    row = await db.get(Cluster, cluster_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found")

    # Effective values for re-validation (only if token is changing).
    effective_host = payload.host if payload.host is not None else row.host
    effective_port = payload.port if payload.port is not None else row.port
    effective_verify_ssl = (
        payload.verify_ssl if payload.verify_ssl is not None else row.verify_ssl
    )
    effective_token_user = (
        payload.token_user if payload.token_user is not None else row.token_user
    )
    effective_token_name = (
        payload.token_name if payload.token_name is not None else row.token_name
    )
    effective_tls_fp = (
        payload.tls_fingerprint
        if payload.tls_fingerprint is not None
        else row.tls_fingerprint
    )

    if payload.api_token_secret is not None:
        # Re-validate before persist (Pitfall A4).
        connector = _build_transient_connector(
            host=effective_host, port=effective_port,
            token_user=effective_token_user, token_name=effective_token_name,
            api_token_secret=payload.api_token_secret,
            verify_ssl=effective_verify_ssl, tls_fingerprint=effective_tls_fp,
        )
        try:
            await connector.validate()
        except PVEAuthError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Proxmox rejected that token.",
            ) from exc
        except PVEUnreachable as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Couldn't reach that Proxmox URL.",
            ) from exc
        except PVEAPIError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Proxmox returned an unexpected error.",
            ) from exc

    # Apply fields.
    if payload.name is not None:
        row.name = payload.name
    if payload.host is not None:
        row.host = payload.host
    if payload.port is not None:
        row.port = payload.port
    if payload.verify_ssl is not None:
        row.verify_ssl = payload.verify_ssl
    if payload.token_user is not None:
        row.token_user = payload.token_user
    if payload.token_name is not None:
        row.token_name = payload.token_name
    if payload.api_token_secret is not None:
        row.api_token_secret = payload.api_token_secret  # EncryptedSecret
    if payload.tls_fingerprint is not None:
        row.tls_fingerprint = payload.tls_fingerprint
    if payload.notes is not None:
        row.notes = payload.notes
    if payload.is_active is not None:
        row.is_active = payload.is_active
    # D-08 nullable-clearable: only touch backup_storage when the request body
    # actually carried it — a null value clears the designation.
    if payload.backup_storage_set():
        row.backup_storage = payload.backup_storage

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A cluster with that name already exists.",
        ) from exc

    registry.invalidate(cluster_id)
    # Respawn the probe so it rebinds to a fresh connector — a host/token
    # change otherwise leaves the running probe polling a stale client.
    await _restart_cluster_probe(registry, cluster_id, db=db)
    await db.refresh(row)
    return row


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


async def delete_cluster(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    cluster_id: int,
) -> None:
    """Delete a cluster row.

    Refuses with 409 if any ``team_cluster_tokens`` row references the
    cluster (D-04 letter: admin must explicitly unbind via a Phase-2 endpoint
    before we let them delete a bootstrapped cluster).
    """
    row = await db.get(Cluster, cluster_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found")

    bound_count = await db.scalar(
        select(func.count())
        .select_from(TeamClusterToken)
        .where(TeamClusterToken.cluster_id == cluster_id)
    )
    if bound_count and bound_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cluster has bootstrapped tenants. Delete or migrate teams "
                "first."
            ),
        )

    await db.delete(row)
    await db.commit()
    registry.invalidate(cluster_id)
    # Cancel the background health probe — the cluster no longer exists.
    try:
        await registry.stop_probe(cluster_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "health probe stop failed for cluster %s: %s", cluster_id, exc,
        )


# ---------------------------------------------------------------------------
# List / get
# ---------------------------------------------------------------------------


async def list_clusters(db: AsyncSession) -> list[Cluster]:
    """All cluster rows in registration order."""
    result = await db.execute(select(Cluster).order_by(Cluster.id))
    return list(result.scalars().all())


async def get_cluster(db: AsyncSession, *, cluster_id: int) -> Cluster:
    """Single cluster row or HTTPException(404)."""
    row = await db.get(Cluster, cluster_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found")
    return row


# ---------------------------------------------------------------------------
# Backup storage enumeration (D-08 — admin backup-storage designation)
# ---------------------------------------------------------------------------


async def list_backup_storages(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    cluster_id: int,
) -> list[dict]:
    """Enumerate the cluster's ``content=backup`` storages for the admin Select.

    Uses the bootstrap connector (admin-level) — this is an admin-only route
    and a per-team privsep token may not see every backup storage. The query
    targets one cluster node (PVE storage definitions are cluster-wide so any
    node's storage list is representative).

    Raises:
        HTTPException(404): cluster not found.
        HTTPException(502): the cluster is unreachable or returned an error.
    """
    row = await db.get(Cluster, cluster_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found",
        )
    connector = _build_transient_connector(
        host=row.host, port=row.port,
        token_user=row.token_user, token_name=row.token_name,
        api_token_secret=row.api_token_secret,
        verify_ssl=row.verify_ssl, tls_fingerprint=row.tls_fingerprint,
    )
    try:
        nodes = await connector.list_nodes()
    except (PVEUnreachable, PVEAPIError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't reach the cluster to list its storages.",
        ) from exc
    if not nodes:
        return []
    node_name = str(nodes[0].get("node") or "")
    try:
        storages = await connector.node_storages(
            node=node_name, content="backup",
        )
    except (PVEUnreachable, PVEAPIError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't reach the cluster to list its storages.",
        ) from exc
    return list(storages or [])


# ---------------------------------------------------------------------------
# Per-node resource enumeration (VM-10 — create-wizard node-fit hint)
# ---------------------------------------------------------------------------


async def list_node_resources(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    cluster_id: int,
) -> list[dict]:
    """Enumerate per-node CPU/RAM capacity for the create-wizard node-fit hint.

    Reads PVE's ``/cluster/resources?type=node`` via the CLUSTER-ADMIN
    connector (``registry.get``) — that connector can always enumerate
    cluster-wide node capacity, whereas a per-team privsep token may not.
    Returns the raw ``type=node`` rows; the route maps them to
    :class:`~app.clusters.schemas.NodeResourceItem`.

    Raises:
        HTTPException(404): cluster not found.
        HTTPException(502): the cluster is unreachable or returned an error.
    """
    try:
        connector = await registry.get(cluster_id, db=db)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found",
        ) from exc
    try:
        rows = await connector.node_resources()
    except (PVEUnreachable, PVEAPIError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't reach the cluster to read its node resources.",
        ) from exc
    return list(rows or [])
