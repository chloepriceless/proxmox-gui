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

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    csrf_protect,
    get_current_principal,
    require_admin,
)
from app.clusters import service
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

router = APIRouter()


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
