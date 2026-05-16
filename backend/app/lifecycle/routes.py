"""Power lifecycle HTTP surface — LIFE-01..03, API-04.

Every mutating route here:

- returns ``202 Accepted`` (the operation is enqueued, never blocking on
  Proxmox — CLAUDE.md constraint #1),
- carries ``Depends(csrf_protect)`` (T-03-02-02 — double-submit CSRF),
- declares an explicit ``operation_id`` + ``summary`` for the OpenAPI schema.

Resource access goes through the shipped ``require_resource_access`` dependency
(Phase 2 RBAC). The connector it resolves IS the per-team privilege-separated
token connector — lifecycle calls execute as the team token, never the
bootstrap admin token (CLAUDE.md constraint #3, T-03-02-01).

Route order: ``vms/bulk-power`` is declared before the ``vms/{vmid}/power``
routes so FastAPI's order-sensitive matcher never coerces ``bulk-power`` into
a ``{vmid}`` path parameter.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory.access import ResolvedResource, require_resource_access
from app.lifecycle import power
from app.lifecycle.schemas import (
    BulkJobAcceptedResponse,
    BulkPowerRequest,
    JobAcceptedResponse,
    PowerRequest,
)

router = APIRouter()


def _get_registry(request: Request) -> PVEConnectorRegistry:
    """Resolve the per-cluster connector registry from ``app.state``.

    Mirrors ``inventory/routes.py`` — falls back to a fresh registry for tests
    that don't run the full lifespan.
    """
    registry = getattr(request.app.state, "registry", None)
    if registry is None:
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from app.core.db import engine

        registry = PVEConnectorRegistry(
            None, async_sessionmaker(engine, expire_on_commit=False)
        )
        request.app.state.registry = registry
    return registry


def _require_arq_pool(request: Request):
    """Resolve the arq Redis pool from ``app.state``.

    The API process holds a best-effort arq pool (``app/main.py`` lifespan) —
    if Redis was unreachable at boot it is ``None``. A lifecycle mutation
    cannot be enqueued without it, so surface a clear ``503`` rather than
    crash with an ``AttributeError`` deep in ``enqueue_job``.
    """
    pool = getattr(request.app.state, "arq_pool", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The job queue is unavailable; try again shortly.",
        )
    return pool


def _job_accepted(job) -> JobAcceptedResponse:  # noqa: ANN001
    return JobAcceptedResponse(job_id=job.id, state=job.state, kind=job.kind)


# ---- Bulk power (declared FIRST — route-order rule) -----------------------
@router.post(
    "/clusters/{cluster_id}/vms/bulk-power",
    response_model=BulkJobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Bulk Start/Stop/Reboot — one job per VM under a shared batch",
    operation_id="lifecycle_bulk_power",
    dependencies=[Depends(csrf_protect)],
)
async def bulk_power(
    cluster_id: int,  # noqa: ARG001 — path prefix; targets carry their own ids
    request: Request,
    payload: BulkPowerRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> BulkJobAcceptedResponse:
    batch_id, jobs = await power.enqueue_bulk_power(
        db,
        _require_arq_pool(request),
        principal=principal,
        registry=registry,
        action=payload.action,
        targets=payload.targets,
        source_ip=extract_source_ip(request),
    )
    return BulkJobAcceptedResponse(batch_id=batch_id, job_ids=[j.id for j in jobs])


# ---- Power (VM) -----------------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/vms/{vmid}/power",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start / Stop / Reboot / Shutdown a VM (enqueues a job)",
    operation_id="lifecycle_vm_power",
    dependencies=[Depends(csrf_protect)],
)
async def vm_power(
    request: Request,
    payload: PowerRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await power.enqueue_power(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        action=payload.action,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Power (LXC mirror) ---------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/lxcs/{vmid}/power",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start / Stop / Reboot / Shutdown an LXC (enqueues a job)",
    operation_id="lifecycle_lxc_power",
    dependencies=[Depends(csrf_protect)],
)
async def lxc_power(
    request: Request,
    payload: PowerRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await power.enqueue_power(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        action=payload.action,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Delete (VM) ----------------------------------------------------------
@router.delete(
    "/clusters/{cluster_id}/vms/{vmid}",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete a VM — enqueues a purge job",
    operation_id="lifecycle_vm_delete",
    dependencies=[Depends(csrf_protect)],
)
async def vm_delete(
    request: Request,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await power.enqueue_delete(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Delete (LXC mirror) --------------------------------------------------
@router.delete(
    "/clusters/{cluster_id}/lxcs/{vmid}",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete an LXC — enqueues a purge job",
    operation_id="lifecycle_lxc_delete",
    dependencies=[Depends(csrf_protect)],
)
async def lxc_delete(
    request: Request,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await power.enqueue_delete(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)
