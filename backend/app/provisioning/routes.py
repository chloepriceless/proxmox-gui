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
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory.access import _get_registry, resolve_resource
from app.lifecycle.routes import _require_arq_pool
from app.provisioning import service
from app.provisioning.cloudinit import (
    CloudInitForm,
    render_cloudinit_preview,
    validate_cloudinit_form,
)
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


# ---------------------------------------------------------------------------
# Cloud-Init preview (VM-05/06/07 — Plan 04-05 Task 2)
#
# A pure transform endpoint — no PVE call, no DB write. It wraps the
# ``provisioning/cloudinit`` module so the two-pane Cloud-Init editor (Plan
# 04-13's frontend) gets the rendered YAML AND the block-hard/warn-soft verdict
# in a single round-trip.
# ---------------------------------------------------------------------------


class CloudInitPreviewRequest(BaseModel):
    """Body of ``POST .../provisioning/cloudinit/preview`` — the editor form."""

    model_config = ConfigDict(extra="forbid")
    ciuser: str | None = Field(default=None, max_length=64)
    cipassword: str | None = Field(default=None, max_length=128)
    sshkeys: list[str] = Field(default_factory=list)
    ip_mode: str = Field(default="dhcp", max_length=16)
    ip_address: str | None = Field(default=None, max_length=64)
    gateway: str | None = Field(default=None, max_length=64)
    nameservers: list[str] = Field(default_factory=list)
    packages: list[str] = Field(default_factory=list)
    runcmd: list[str] = Field(default_factory=list)
    source_kind: str = Field(default="cloud-image", max_length=32)


class YamlLineOut(BaseModel):
    """One rendered ``#cloud-config`` line — ``injected`` marks a PVE default."""

    model_config = ConfigDict(extra="forbid")
    text: str
    injected: bool


class FieldErrorOut(BaseModel):
    """One hard validation error — names the offending form field."""

    model_config = ConfigDict(extra="forbid")
    field: str
    message: str


class CloudInitVerdictOut(BaseModel):
    """The block-hard / warn-soft validation verdict (D-12)."""

    model_config = ConfigDict(extra="forbid")
    hard_errors: list[FieldErrorOut]
    soft_warnings: list[str]
    ok: bool


class CloudInitPreviewResponse(BaseModel):
    """``200`` body — the rendered lines + the verdict in one payload."""

    model_config = ConfigDict(extra="forbid")
    lines: list[YamlLineOut]
    verdict: CloudInitVerdictOut


@router.post(
    "/clusters/{cluster_id}/provisioning/cloudinit/preview",
    response_model=CloudInitPreviewResponse,
    summary="Render the effective #cloud-config + validate the form (VM-05/06/07)",
    operation_id="provisioning_cloudinit_preview",
    dependencies=[Depends(csrf_protect)],
)
async def cloudinit_preview(
    cluster_id: int,
    payload: CloudInitPreviewRequest,
    principal: Principal = Depends(get_current_principal),
) -> CloudInitPreviewResponse:
    """Render + validate the Cloud-Init form — a pure transform.

    No PVE call, no DB write. ``cluster_id`` is in the path purely for URL
    consistency with the rest of the provisioning surface. The frontend
    Cloud-Init editor calls this on every form change for the live YAML pane
    (``render_cloudinit_preview``) and the block-hard/warn-soft verdict
    (``validate_cloudinit_form``).
    """
    form = CloudInitForm(
        ciuser=payload.ciuser,
        cipassword=payload.cipassword,
        sshkeys=payload.sshkeys,
        ip_mode=payload.ip_mode,
        ip_address=payload.ip_address,
        gateway=payload.gateway,
        nameservers=payload.nameservers,
        packages=payload.packages,
        runcmd=payload.runcmd,
        source_kind=payload.source_kind,
    )
    lines = render_cloudinit_preview(form)
    verdict = validate_cloudinit_form(form)
    return CloudInitPreviewResponse(
        lines=[YamlLineOut(text=ln.text, injected=ln.injected) for ln in lines],
        verdict=CloudInitVerdictOut(
            hard_errors=[
                FieldErrorOut(field=e.field, message=e.message)
                for e in verdict.hard_errors
            ],
            soft_warnings=verdict.soft_warnings,
            ok=verdict.ok,
        ),
    )
