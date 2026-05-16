"""Resize lifecycle HTTP surface — LIFE-08, LIFE-09.

A separate router from ``lifecycle/routes.py`` keeps the modular layout clean.

- ``GET .../resize-info`` is a pure read — current cores/memory, disk sizes,
  and the hotplug-derived ``cpu_hotplug``/``memory_hotplug`` flags the resize
  dialog uses for its inline reboot-required warnings.
- ``POST .../resize`` returns ``202 Accepted`` — the resize is enqueued as a
  ``vm.resize`` job (even though the CPU/RAM write is synchronous, it flows
  through a job for Tasks-drawer consistency — RESEARCH §Resize).

The root-only Proxmox lock-override parameter is not a field on any schema in
this module — ``ResizeRequest`` is ``extra="forbid"`` so it cannot be smuggled
through (T-03-03-04). Resource access goes through ``require_resource_access``
— a cross-tenant VM is rejected 403 before any enqueue (T-03-03-01). A disk
shrink is rejected 422 server-side inside ``enqueue_resize`` (LIFE-09 /
T-03-03-03).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory.access import ResolvedResource, require_resource_access
from app.lifecycle import resize
from app.lifecycle.routes import _require_arq_pool
from app.lifecycle.schemas import JobAcceptedResponse, ResizeInfoResponse, ResizeRequest

router = APIRouter()


def _job_accepted(job) -> JobAcceptedResponse:  # noqa: ANN001
    return JobAcceptedResponse(job_id=job.id, state=job.state, kind=job.kind)


# ---- Resize info (VM) -----------------------------------------------------
@router.get(
    "/clusters/{cluster_id}/vms/{vmid}/resize-info",
    response_model=ResizeInfoResponse,
    summary="Current CPU/RAM/disks + hotplug-derived reboot-required flags",
    operation_id="lifecycle_resize_info",
)
async def vm_resize_info(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> ResizeInfoResponse:
    return await resize.get_resize_info(db, resolved=resolved)


# ---- Resize info (LXC mirror) ---------------------------------------------
@router.get(
    "/clusters/{cluster_id}/lxcs/{vmid}/resize-info",
    response_model=ResizeInfoResponse,
    summary="Current CPU/RAM/disks + hotplug-derived reboot-required flags (LXC)",
    operation_id="lifecycle_lxc_resize_info",
)
async def lxc_resize_info(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> ResizeInfoResponse:
    return await resize.get_resize_info(db, resolved=resolved)


# ---- Resize (VM) ----------------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/vms/{vmid}/resize",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Resize a VM's CPU / RAM / disks (enqueues a job)",
    operation_id="lifecycle_resize",
    dependencies=[Depends(csrf_protect)],
)
async def vm_resize(
    request: Request,
    payload: ResizeRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await resize.enqueue_resize(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        request=payload,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Resize (LXC mirror) --------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/lxcs/{vmid}/resize",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Resize an LXC's CPU / RAM / disks (enqueues a job)",
    operation_id="lifecycle_lxc_resize",
    dependencies=[Depends(csrf_protect)],
)
async def lxc_resize(
    request: Request,
    payload: ResizeRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await resize.enqueue_resize(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        request=payload,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)
