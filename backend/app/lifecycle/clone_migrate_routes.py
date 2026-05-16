"""Clone / template-convert / migrate HTTP surface — LIFE-10, LIFE-11.

A separate router from ``lifecycle/routes.py`` keeps the modular layout clean.
Every mutating route here:

- returns ``202 Accepted`` — the operation is enqueued, never blocking on
  Proxmox (CLAUDE.md constraint #1),
- carries ``Depends(csrf_protect)`` (T-03-04-02 — double-submit CSRF),
- declares an explicit ``operation_id`` + ``summary`` for the OpenAPI schema.

Resource access goes through ``require_resource_access`` (Phase 2 RBAC) — a
cross-tenant VM is rejected 403 before any enqueue (T-03-04-01).

Clone + restore-as-new run the Phase 2 quota admission path (clone creates a
resource — Pitfall 8). Migrate runs the quorum + node-local-snippet pre-flights
(T-03-04-05). LXC template-convert is rejected 422 inside the service.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory.access import ResolvedResource, require_resource_access
from app.lifecycle import clone, migrate
from app.lifecycle.routes import _get_registry, _require_arq_pool
from app.lifecycle.schemas import CloneRequest, JobAcceptedResponse, MigrateRequest

router = APIRouter()


def _job_accepted(job) -> JobAcceptedResponse:  # noqa: ANN001
    return JobAcceptedResponse(job_id=job.id, state=job.state, kind=job.kind)


# ---- Clone (VM) -----------------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/vms/{vmid}/clone",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Clone a VM — linked or full, with an app-reserved VMID",
    operation_id="lifecycle_clone",
    dependencies=[Depends(csrf_protect)],
)
async def clone_vm(
    request: Request,
    payload: CloneRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> JobAcceptedResponse:
    job = await clone.enqueue_clone(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        request=payload,
        registry=registry,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Clone (LXC mirror) ---------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/lxcs/{vmid}/clone",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Clone an LXC — linked or full, with an app-reserved VMID",
    operation_id="lifecycle_lxc_clone",
    dependencies=[Depends(csrf_protect)],
)
async def clone_lxc(
    request: Request,
    payload: CloneRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> JobAcceptedResponse:
    job = await clone.enqueue_clone(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        request=payload,
        registry=registry,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Convert to template (VM — qemu only) ---------------------------------
@router.post(
    "/clusters/{cluster_id}/vms/{vmid}/convert-template",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Convert a VM to a template (qemu only — LXC is rejected)",
    operation_id="lifecycle_template_convert",
    dependencies=[Depends(csrf_protect)],
)
async def convert_vm_template(
    request: Request,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await clone.enqueue_template_convert(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Convert to template (LXC mirror — rejected 422) ----------------------
@router.post(
    "/clusters/{cluster_id}/lxcs/{vmid}/convert-template",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Convert an LXC to a template (not supported — returns 422)",
    operation_id="lifecycle_lxc_template_convert",
    dependencies=[Depends(csrf_protect)],
)
async def convert_lxc_template(
    request: Request,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    # enqueue_template_convert raises 422 for an LXC (RESEARCH A7).
    job = await clone.enqueue_template_convert(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Migrate (VM) ---------------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/vms/{vmid}/migrate",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Migrate a VM to another node (live/offline, with bwlimit)",
    operation_id="lifecycle_migrate",
    dependencies=[Depends(csrf_protect)],
)
async def migrate_vm(
    request: Request,
    payload: MigrateRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await migrate.enqueue_migrate(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        request=payload,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Migrate (LXC mirror) -------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/lxcs/{vmid}/migrate",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Migrate an LXC to another node (offline, with bwlimit)",
    operation_id="lifecycle_lxc_migrate",
    dependencies=[Depends(csrf_protect)],
)
async def migrate_lxc(
    request: Request,
    payload: MigrateRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await migrate.enqueue_migrate(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        request=payload,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)
