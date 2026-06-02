"""``/api/v1/clusters`` HTTP routes — admin-only.

Route order matters: ``POST /test`` (dry-run) MUST be declared BEFORE
``POST /{cluster_id}/test`` (re-validate stored), otherwise FastAPI's path
matcher would route ``/test`` to the integer-coerced ``{cluster_id}``
variant and yield 422 (``int_parsing``).

Every mutating route composes ``Depends(require_admin)`` and
``Depends(csrf_protect)``. Read routes only require admin.

The connector registry is stored on ``app.state.registry`` by the lifespan
in :mod:`app.main`. The :func:`get_registry` dependency reads it from the
request scope.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    csrf_protect,
    get_current_principal,
    require_admin,
)
from app.clusters import service
from app.clusters.errors import PVEAPIError, PVEUnreachable
from app.clusters.registry import PVEConnectorRegistry
from app.clusters.schemas import (
    BackupStorageItem,
    ClusterCreate,
    ClusterResponse,
    ClusterTestRequest,
    ClusterTestResponse,
    ClusterUpdate,
    NodeResourceItem,
)
from app.core.db import get_db
from app.networks.preflight import ssh_pct_exec_preflight

router = APIRouter()

#: Where install.sh (Plan 05-04) lays down the GUI's Ed25519 public key. The
#: admin pastes this into each PVE node's authorized_keys to establish the SSH
#: trust the community-script `pct exec` path needs (D-22).
GUI_SSH_PUBKEY_PATH = "/etc/proxmox-gui/gui_ed25519.pub"


def _read_gui_pubkey() -> dict:
    """Read the GUI public key off disk (sync — a tiny local file read).

    Kept synchronous so the async route does not call blocking pathlib methods
    directly (ASYNC240). Returns ``{present, public_key}``; never raises.
    """
    p = Path(GUI_SSH_PUBKEY_PATH)
    try:
        if p.exists():
            return {"present": True, "public_key": p.read_text().strip()}
    except OSError:
        pass
    return {"present": False, "public_key": ""}


def get_registry(request: Request) -> PVEConnectorRegistry:
    """Extract the registry from app.state — created by the lifespan."""
    registry = getattr(request.app.state, "registry", None)
    if registry is None:
        # Build on-demand for tests / harnesses that don't run the lifespan.
        # The session_factory is what get_db is bound to in test fixtures, so
        # we can derive it via the app's overrides — but the simpler path is
        # to import the global from app.core.db.
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from app.core.db import engine
        registry = PVEConnectorRegistry(
            None, async_sessionmaker(engine, expire_on_commit=False),
        )
        request.app.state.registry = registry
    return registry


# ----------------------------------------------------------------------------
# Dry-run / test routes
# ----------------------------------------------------------------------------


@router.post(
    "/test",
    response_model=ClusterTestResponse,
    summary="Dry-run validate a Proxmox cluster URL + token (NO DB write)",
    operation_id="clusters_test_dryrun",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def test_cluster_dryrun(
    payload: ClusterTestRequest,
) -> ClusterTestResponse:
    """Test a cluster's reachability and token before persisting.

    Plan 10's Admin Clusters page calls this from the "Test" button. The
    response is shaped so the UI can render either ``ok=true, version=...``
    (green) or ``ok=false, error=...`` (red toast) without inspecting status
    codes.
    """
    return await service.test_cluster(payload)


# ----------------------------------------------------------------------------
# CRUD
# ----------------------------------------------------------------------------


@router.post(
    "/",
    response_model=ClusterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Proxmox cluster",
    operation_id="clusters_create",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def create_cluster(
    payload: ClusterCreate,
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(get_registry),
) -> ClusterResponse:
    """Validate the token, persist the cluster, and bootstrap teams (Pitfall 8)."""
    cluster = await service.register_cluster(
        db, payload=payload, registry=registry,
    )
    return ClusterResponse.model_validate(cluster)


@router.get(
    "/",
    response_model=list[ClusterResponse],
    summary="List all registered clusters",
    operation_id="clusters_list",
    dependencies=[Depends(require_admin)],
)
async def list_clusters(
    db: AsyncSession = Depends(get_db),
) -> list[ClusterResponse]:
    rows = await service.list_clusters(db)
    return [ClusterResponse.model_validate(r) for r in rows]


# NOTE: this literal-path route MUST precede ``GET /{cluster_id}`` — otherwise
# FastAPI's matcher coerces "ssh-pubkey" to the int ``{cluster_id}`` (422).
@router.get(
    "/ssh-pubkey",
    summary="The GUI's SSH public key for community-script node trust (D-22)",
    operation_id="clusters_ssh_pubkey",
    dependencies=[Depends(require_admin)],
)
async def get_ssh_pubkey() -> dict:
    """Return the GUI's Ed25519 public key so the registration UI can show the
    copy-paste one-liner the admin runs on each node. Only the PUBLIC key is
    ever exposed (T-05-06-04); the private key never leaves /etc/proxmox-gui.

    Returns ``{present: False, public_key: ""}`` if the key file is absent
    (e.g. a dev box that never ran install.sh) so the UI can guide accordingly.
    """
    return _read_gui_pubkey()


@router.get(
    "/{cluster_id}",
    response_model=ClusterResponse,
    summary="Read a single cluster",
    operation_id="clusters_get",
    dependencies=[Depends(require_admin)],
)
async def get_cluster(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
) -> ClusterResponse:
    row = await service.get_cluster(db, cluster_id=cluster_id)
    return ClusterResponse.model_validate(row)


@router.patch(
    "/{cluster_id}",
    response_model=ClusterResponse,
    summary="Patch a cluster",
    operation_id="clusters_patch",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def patch_cluster(
    cluster_id: int,
    payload: ClusterUpdate,
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(get_registry),
) -> ClusterResponse:
    row = await service.update_cluster(
        db, registry, cluster_id=cluster_id, payload=payload,
    )
    return ClusterResponse.model_validate(row)


@router.get(
    "/{cluster_id}/backup-storages",
    response_model=list[BackupStorageItem],
    summary="List the cluster's backup-capable storages (D-08 admin picker)",
    operation_id="clusters_backup_storages",
    dependencies=[Depends(require_admin)],
)
async def list_backup_storages(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(get_registry),
) -> list[BackupStorageItem]:
    """Enumerate ``content=backup`` storages for the admin Select.

    The admin picks one of these to set as the cluster's ``backup_storage``
    via ``PATCH /clusters/{id}`` (D-08). Without a designated storage the
    per-cluster backup endpoints are unavailable.
    """
    rows = await service.list_backup_storages(
        db, registry, cluster_id=cluster_id,
    )
    return [BackupStorageItem.from_pve(r) for r in rows]


@router.get(
    "/{cluster_id}/nodes/resources",
    response_model=list[NodeResourceItem],
    summary="Per-node free CPU/RAM for the create-wizard node-fit hint (VM-10)",
    operation_id="clusters_node_resources",
    dependencies=[Depends(get_current_principal)],
)
async def list_node_resources(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(get_registry),
) -> list[NodeResourceItem]:
    """Expose per-node free CPU cores + free RAM MB for the node-fit hint.

    AUTH: a pure READ behind the standard authenticated principal — a regular
    (non-admin) user runs the create wizard, so this is NOT ``require_admin``,
    and it is a GET so there is no ``csrf_protect``. Per-node capacity is
    cluster-wide infrastructure data (node names + free CPU/RAM), not
    tenant-scoped — same posture as ``list_backup_storages`` (T-04-16-01).
    Synchronous read: no job enqueue, no 202.
    """
    rows = await service.list_node_resources(db, registry, cluster_id=cluster_id)
    return [NodeResourceItem.from_pve(r) for r in rows]


@router.post(
    "/{cluster_id}/test",
    response_model=ClusterTestResponse,
    summary="Re-validate the stored token of an existing cluster",
    operation_id="clusters_test_existing",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def test_existing_cluster(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
) -> ClusterTestResponse:
    return await service.validate_token(db, cluster_id=cluster_id)


@router.post(
    "/{cluster_id}/verify-ssh",
    summary="Verify the GUI can pct-exec on the cluster's node over SSH (D-22)",
    operation_id="clusters_verify_ssh",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def verify_ssh(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(get_registry),
) -> dict:
    """Probe SSH ``pct exec`` reachability for the cluster's first node (D-23).

    Mirrors the existing Test-connection button: admin-gated, no mutation,
    returns ``{node, ok, detail}``. The community-script wizard path is gated on
    this; plain-LXC/VM provisioning need no SSH and are unaffected.
    """
    try:
        connector = await registry.get(cluster_id, db=db)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found",
        ) from exc
    try:
        nodes = await connector.list_nodes()
    except (PVEUnreachable, PVEAPIError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't reach the cluster to list its nodes.",
        ) from exc
    if not nodes:
        return {"node": None, "ok": False, "detail": "Cluster reports no nodes."}
    node = str(nodes[0].get("node") or "")
    result = await ssh_pct_exec_preflight(connector, node)
    return {"node": node, **result}


@router.post(
    "/{cluster_id}/backfill-bootstrap",
    summary=(
        "Retroactively run tenant bootstrap on an existing cluster — "
        "remediates clusters added before the auto-bootstrap fix (Plan 02-08)"
    ),
    operation_id="clusters_backfill_bootstrap",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def backfill_bootstrap(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(get_registry),
) -> dict:
    """Idempotent: skips teams that already have a token for this cluster."""
    return await service.backfill_bootstrap(
        db, registry, cluster_id=cluster_id,
    )


@router.delete(
    "/{cluster_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a cluster (refuses if any tenant is bootstrapped on it)",
    operation_id="clusters_delete",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def delete_cluster(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(get_registry),
) -> Response:
    await service.delete_cluster(db, registry, cluster_id=cluster_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
