"""Backup lifecycle HTTP surface — LIFE-05, LIFE-06, LIFE-07.

A separate router from ``lifecycle/routes.py`` keeps the modular layout clean
(backups own their own file). Every mutating route here:

- returns ``202 Accepted`` for the PVE-backed operations (backup / restore /
  backup-file delete) — never blocking on Proxmox (CLAUDE.md constraint #1),
- ``PUT .../backup-schedule`` returns ``200`` — it is a plain DB write, not a
  PVE op,
- carries ``Depends(csrf_protect)`` on every mutation (T-03-04-02),
- declares an explicit ``operation_id`` + ``summary`` for the OpenAPI schema.

Route order: the static ``/backups/schedules`` collection route is declared
BEFORE the ``/clusters/{cluster_id}/...`` routes so FastAPI's order-sensitive
matcher resolves it correctly.

Resource access goes through ``require_resource_access`` (Phase 2 RBAC) — a
cross-tenant VM is rejected 403 before any enqueue (T-03-04-01). The global
``/backups/schedules`` route is principal + team-scoped instead.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory.access import (
    ResolvedResource,
    _team_ids_for_user,
    require_resource_access,
)
from app.lifecycle import backups
from app.lifecycle.routes import _get_registry, _require_arq_pool
from app.lifecycle.schemas import (
    BackupListResponse,
    BackupRequest,
    BackupScheduleRequest,
    BackupScheduleResponse,
    JobAcceptedResponse,
    RestoreRequest,
)

router = APIRouter()


def _job_accepted(job) -> JobAcceptedResponse:  # noqa: ANN001
    return JobAcceptedResponse(job_id=job.id, state=job.state, kind=job.kind)


def _schedule_response(row) -> BackupScheduleResponse:  # noqa: ANN001
    return BackupScheduleResponse.model_validate(row)


# ---- Global backup schedules (STATIC path — declared FIRST) ---------------
@router.get(
    "/backups/schedules",
    response_model=list[BackupScheduleResponse],
    summary="List backup schedules across the principal's teams (/backups page)",
    operation_id="lifecycle_backup_schedules",
)
async def list_backup_schedules(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[BackupScheduleResponse]:
    team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    rows = await backups.list_schedules(db, team_ids=team_ids)
    return [_schedule_response(r) for r in rows]


# ---- Manual backup (VM) ---------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/vms/{vmid}/backup",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Run a manual backup of a VM (enqueues a vzdump job)",
    operation_id="lifecycle_backup",
    dependencies=[Depends(csrf_protect)],
)
async def backup_vm(
    request: Request,
    payload: BackupRequest,  # noqa: ARG001 — empty body; D-08 storage is preset
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await backups.enqueue_backup(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Manual backup (LXC mirror) -------------------------------------------
@router.post(
    "/clusters/{cluster_id}/lxcs/{vmid}/backup",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Run a manual backup of an LXC (enqueues a vzdump job)",
    operation_id="lifecycle_lxc_backup",
    dependencies=[Depends(csrf_protect)],
)
async def backup_lxc(
    request: Request,
    payload: BackupRequest,  # noqa: ARG001 — empty body; D-08 storage is preset
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await backups.enqueue_backup(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- List backup files (VM) -----------------------------------------------
@router.get(
    "/clusters/{cluster_id}/vms/{vmid}/backups",
    response_model=BackupListResponse,
    summary="List a VM's backup files",
    operation_id="lifecycle_backups_list",
)
async def list_vm_backups(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> BackupListResponse:
    items = await backups.list_backups(db, resolved=resolved)
    return BackupListResponse(backups=items)


# ---- List backup files (LXC mirror) ---------------------------------------
@router.get(
    "/clusters/{cluster_id}/lxcs/{vmid}/backups",
    response_model=BackupListResponse,
    summary="List an LXC's backup files",
    operation_id="lifecycle_lxc_backups_list",
)
async def list_lxc_backups(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> BackupListResponse:
    items = await backups.list_backups(db, resolved=resolved)
    return BackupListResponse(backups=items)


# ---- Restore (VM) ---------------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/vms/{vmid}/restore",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Restore a VM from a backup — in-place overwrite or as a new VMID",
    operation_id="lifecycle_restore",
    dependencies=[Depends(csrf_protect)],
)
async def restore_vm(
    request: Request,
    payload: RestoreRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> JobAcceptedResponse:
    job = await backups.enqueue_restore(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        request=payload,
        registry=registry,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Restore (LXC mirror) -------------------------------------------------
@router.post(
    "/clusters/{cluster_id}/lxcs/{vmid}/restore",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Restore an LXC from a backup — in-place overwrite or as a new VMID",
    operation_id="lifecycle_lxc_restore",
    dependencies=[Depends(csrf_protect)],
)
async def restore_lxc(
    request: Request,
    payload: RestoreRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> JobAcceptedResponse:
    job = await backups.enqueue_restore(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        request=payload,
        registry=registry,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Backup schedule — read (VM) ------------------------------------------
@router.get(
    "/clusters/{cluster_id}/vms/{vmid}/backup-schedule",
    response_model=BackupScheduleResponse | None,
    summary="Read a VM's backup schedule",
    operation_id="lifecycle_backup_schedule_get",
)
async def get_vm_backup_schedule(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> BackupScheduleResponse | None:
    row = await backups.get_schedule(db, resolved=resolved)
    return _schedule_response(row) if row is not None else None


# ---- Backup schedule — read (LXC mirror) ----------------------------------
@router.get(
    "/clusters/{cluster_id}/lxcs/{vmid}/backup-schedule",
    response_model=BackupScheduleResponse | None,
    summary="Read an LXC's backup schedule",
    operation_id="lifecycle_lxc_backup_schedule_get",
)
async def get_lxc_backup_schedule(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> BackupScheduleResponse | None:
    row = await backups.get_schedule(db, resolved=resolved)
    return _schedule_response(row) if row is not None else None


# ---- Backup schedule — upsert (VM) ----------------------------------------
@router.put(
    "/clusters/{cluster_id}/vms/{vmid}/backup-schedule",
    response_model=BackupScheduleResponse,
    summary="Set a VM's backup schedule (frequency + keep-last-N)",
    operation_id="lifecycle_backup_schedule_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_vm_backup_schedule(
    request: Request,
    payload: BackupScheduleRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> BackupScheduleResponse:
    row = await backups.upsert_schedule(
        db,
        principal=principal,
        resolved=resolved,
        request=payload,
        source_ip=extract_source_ip(request),
    )
    return _schedule_response(row)


# ---- Backup schedule — upsert (LXC mirror) --------------------------------
@router.put(
    "/clusters/{cluster_id}/lxcs/{vmid}/backup-schedule",
    response_model=BackupScheduleResponse,
    summary="Set an LXC's backup schedule (frequency + keep-last-N)",
    operation_id="lifecycle_lxc_backup_schedule_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_lxc_backup_schedule(
    request: Request,
    payload: BackupScheduleRequest,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> BackupScheduleResponse:
    row = await backups.upsert_schedule(
        db,
        principal=principal,
        resolved=resolved,
        request=payload,
        source_ip=extract_source_ip(request),
    )
    return _schedule_response(row)


# ---- Delete a backup file (VM) --------------------------------------------
@router.delete(
    "/clusters/{cluster_id}/vms/{vmid}/backups/{volid:path}",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete a VM backup file (enqueues a job)",
    operation_id="lifecycle_backup_delete",
    dependencies=[Depends(csrf_protect)],
)
async def delete_vm_backup(
    request: Request,
    volid: str = Path(..., min_length=1, max_length=512),
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await backups.enqueue_backup_delete(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        volid=volid,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)


# ---- Delete a backup file (LXC mirror) ------------------------------------
@router.delete(
    "/clusters/{cluster_id}/lxcs/{vmid}/backups/{volid:path}",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete an LXC backup file (enqueues a job)",
    operation_id="lifecycle_lxc_backup_delete",
    dependencies=[Depends(csrf_protect)],
)
async def delete_lxc_backup(
    request: Request,
    volid: str = Path(..., min_length=1, max_length=512),
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobAcceptedResponse:
    job = await backups.enqueue_backup_delete(
        db,
        _require_arq_pool(request),
        principal=principal,
        resolved=resolved,
        volid=volid,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)
