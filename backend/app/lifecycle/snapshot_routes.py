"""Snapshot lifecycle HTTP surface — LIFE-04.

A separate router from ``lifecycle/routes.py`` keeps the modular layout clean
(snapshots own their own file). Every mutating route here:

- returns ``202 Accepted`` — the operation is enqueued, never blocking on
  Proxmox (CLAUDE.md constraint #1),
- carries ``Depends(csrf_protect)`` (T-03-03-02 — double-submit CSRF),
- declares an explicit ``operation_id`` + ``summary`` for the OpenAPI schema.

``GET .../snapshots`` is a pure read returning the flat parent-pointer list;
the client builds the indented tree (D-05).

Route order: the static ``snapshots`` collection routes are declared before
the ``snapshots/{snapname}`` item routes so FastAPI's order-sensitive matcher
resolves them correctly.

Resource access goes through ``require_resource_access`` (Phase 2 RBAC) — a
cross-tenant VM is rejected 403 before any enqueue (T-03-03-01).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory.access import ResolvedResource, require_resource_access
from app.lifecycle import snapshots
from app.lifecycle.routes import _require_arq_pool
from app.lifecycle.schemas import (
    JobAcceptedResponse,
    SnapshotCreateRequest,
    SnapshotListResponse,
)

router = APIRouter()


def _job_accepted(job) -> JobAcceptedResponse:  # noqa: ANN001
    return JobAcceptedResponse(job_id=job.id, state=job.state, kind=job.kind)


# ---- List snapshots (VM) --------------------------------------------------
@router.get(
    "/clusters/{cluster_id}/vms/{vmid}/snapshots",
    response_model=SnapshotListResponse,
    summary="List a VM's snapshots — flat list with parent pointers",
    operation_id="lifecycle_snapshots_list",
)
async def list_vm_snapshots(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> SnapshotListResponse:
    items = await snapshots.list_snapshots(db, resolved=resolved)
    return SnapshotListResponse(snapshots=items)


# ---- List snapshots (LXC mirror) ------------------------------------------
@router.get(
    "/clusters/{cluster_id}/lxcs/{vmid}/snapshots",
    response_model=SnapshotListResponse,
    summary="List an LXC's snapshots — flat list with parent pointers",
    operation_id="lifecycle_lxc_snapshots_list",
)
async def list_lxc_snapshots(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> SnapshotListResponse:
    items = await snapshots.list_snapshots(db, resolved=resolved)
    return SnapshotListResponse(snapshots=items)


# ---- Create snapshot (VM) -------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/vms/{vmid}/snapshots",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a VM snapshot (enqueues a job)",
    operation_id="lifecycle_snapshot_create",
    dependencies=[Depends(csrf_protect)],
)
async def create_vm_snapshot(
    request: Request,
    payload: SnapshotCreateRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await snapshots.enqueue_snapshot_create(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        name=payload.name,
        description=payload.description,
        vmstate=payload.vmstate,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Create snapshot (LXC mirror) -----------------------------------------
@router.post(
    "/clusters/{cluster_id}/lxcs/{vmid}/snapshots",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create an LXC snapshot (enqueues a job)",
    operation_id="lifecycle_lxc_snapshot_create",
    dependencies=[Depends(csrf_protect)],
)
async def create_lxc_snapshot(
    request: Request,
    payload: SnapshotCreateRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await snapshots.enqueue_snapshot_create(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        name=payload.name,
        description=payload.description,
        vmstate=payload.vmstate,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Rollback snapshot (VM) -----------------------------------------------
@router.post(
    "/clusters/{cluster_id}/vms/{vmid}/snapshots/{snapname}/rollback",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Roll a VM back to a snapshot (enqueues a job — destructive)",
    operation_id="lifecycle_snapshot_rollback",
    dependencies=[Depends(csrf_protect)],
)
async def rollback_vm_snapshot(
    request: Request,
    snapname: str = Path(..., min_length=1, max_length=40),
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await snapshots.enqueue_snapshot_rollback(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        name=snapname,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Rollback snapshot (LXC mirror) ---------------------------------------
@router.post(
    "/clusters/{cluster_id}/lxcs/{vmid}/snapshots/{snapname}/rollback",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Roll an LXC back to a snapshot (enqueues a job — destructive)",
    operation_id="lifecycle_lxc_snapshot_rollback",
    dependencies=[Depends(csrf_protect)],
)
async def rollback_lxc_snapshot(
    request: Request,
    snapname: str = Path(..., min_length=1, max_length=40),
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await snapshots.enqueue_snapshot_rollback(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        name=snapname,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Delete snapshot (VM) -------------------------------------------------
@router.delete(
    "/clusters/{cluster_id}/vms/{vmid}/snapshots/{snapname}",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete a VM snapshot (enqueues a job)",
    operation_id="lifecycle_snapshot_delete",
    dependencies=[Depends(csrf_protect)],
)
async def delete_vm_snapshot(
    request: Request,
    snapname: str = Path(..., min_length=1, max_length=40),
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await snapshots.enqueue_snapshot_delete(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        name=snapname,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Delete snapshot (LXC mirror) -----------------------------------------
@router.delete(
    "/clusters/{cluster_id}/lxcs/{vmid}/snapshots/{snapname}",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete an LXC snapshot (enqueues a job)",
    operation_id="lifecycle_lxc_snapshot_delete",
    dependencies=[Depends(csrf_protect)],
)
async def delete_lxc_snapshot(
    request: Request,
    snapname: str = Path(..., min_length=1, max_length=40),
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await snapshots.enqueue_snapshot_delete(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        name=snapname,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)
