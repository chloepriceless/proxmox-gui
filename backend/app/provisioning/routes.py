"""Provisioning create HTTP surface — LXC-05..07, VM-01..04.

Modelled on ``app.lifecycle.clone_migrate_routes`` — every mutating route:

- returns ``202 Accepted`` — the create is enqueued, never blocking on Proxmox
  (CLAUDE.md constraint #1),
- carries ``Depends(csrf_protect)`` (T-04-04 — double-submit CSRF),
- declares an explicit ``operation_id`` + ``summary`` for the OpenAPI schema,
- delegates to ``service.enqueue_create_*``.

**Difference vs the clone routes:** provisioning creates a NEW resource, so
there is no existing resource to resolve via ``require_resource_access``. The
route names the owning team in the request body; the service runs the
cross-tenant membership guard (T-04-04-01). For the ``template-clone`` /
``vm-clone`` source kinds the source IS an existing resource — the route
resolves it via ``inventory.access.resolve_resource`` and the service
delegates to the Phase-3 ``clone.enqueue_clone``.

The 202 body is a ``ProvisioningJobAcceptedResponse`` — it carries the reserved
``vmid`` so the wizard can route to ``/inventory/{cluster}/{vmid}`` immediately
(D-04).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory.access import _get_registry, resolve_resource
from app.lifecycle.routes import _require_arq_pool
from app.provisioning import service
from app.provisioning.schemas import (
    CreateLxcRequest,
    CreateQemuRequest,
    ProvisioningJobAcceptedResponse,
)

router = APIRouter()


def _job_accepted(job, vmid: int) -> ProvisioningJobAcceptedResponse:  # noqa: ANN001
    return ProvisioningJobAcceptedResponse(
        job_id=job.id, state=job.state, kind=job.kind, vmid=vmid
    )


# ---- Create LXC (LXC-05/06/07) --------------------------------------------
@router.post(
    "/clusters/{cluster_id}/provisioning/lxc",
    response_model=ProvisioningJobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Provision a plain LXC container (enqueues a job)",
    operation_id="provisioning_create_lxc",
    dependencies=[Depends(csrf_protect)],
)
async def create_lxc(
    cluster_id: int,
    request: Request,
    payload: CreateLxcRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> ProvisioningJobAcceptedResponse:
    job, vmid = await service.enqueue_create_lxc(
        db,
        _require_arq_pool(request),
        principal=principal,
        cluster_id=cluster_id,
        request=payload,
        registry=registry,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job, vmid)


# ---- Create VM (VM-01 cloud-image / VM-02 / VM-03 / VM-04) ----------------
@router.post(
    "/clusters/{cluster_id}/provisioning/qemu",
    response_model=ProvisioningJobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Provision a VM — cloud-init image / blank+ISO / template-clone / VM-clone",
    operation_id="provisioning_create_qemu",
    dependencies=[Depends(csrf_protect)],
)
async def create_qemu(
    cluster_id: int,
    request: Request,
    payload: CreateQemuRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> ProvisioningJobAcceptedResponse:
    # For the clone source kinds the source IS an existing resource — resolve
    # it so the service can delegate to the Phase-3 clone path. resolve_resource
    # raises 403 for a cross-tenant / unknown source (T-04-04-01).
    resolved = None
    if payload.is_clone:
        resolved = await resolve_resource(
            db=db,
            registry=registry,
            principal=principal,
            cluster_id=cluster_id,
            vmid=int(payload.source_vmid),
        )
    job, vmid = await service.enqueue_create_qemu(
        db,
        _require_arq_pool(request),
        principal=principal,
        cluster_id=cluster_id,
        request=payload,
        registry=registry,
        source_ip=extract_source_ip(request),
        resolved=resolved,
    )
    return _job_accepted(job, vmid)
