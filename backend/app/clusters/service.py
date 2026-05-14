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
) -> Cluster:
    """Validate then persist a new cluster. Pitfall A4 enforcement point.

    Raises:
        HTTPException(422): token failed validation (PVEAuthError),
            or schema constraint failed, or name uniqueness violated.
        HTTPException(502): PVE unreachable / unexpected API error.
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
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A cluster with that name already exists.",
        ) from exc
    await db.refresh(cluster)
    return cluster


# ---------------------------------------------------------------------------
# Re-validate (manual probe)
# ---------------------------------------------------------------------------


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

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A cluster with that name already exists.",
        ) from exc

    registry.invalidate(cluster_id)
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
