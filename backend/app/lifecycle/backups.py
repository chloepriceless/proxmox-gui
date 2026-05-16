"""Backup lifecycle service — LIFE-05, LIFE-06, LIFE-07.

The mutating operations (manual backup, restore, backup-file delete) follow the
project's 202-Accepted contract — build a payload, ``enqueue_job``, write an
enqueue-time audit row, ``db.commit()``. The worker
(``run_backup`` / ``run_restore`` / ``run_backup_delete`` in
``app/jobs/backup_functions.py``) issues the actual Proxmox call and writes the
*outcome* audit row (D-20).

:func:`list_backups` is a pure read (no job, no audit) — it enumerates the VM's
backup files via the storage content API.

The backup schedule (LIFE-06) is a plain DB write — :func:`upsert_schedule`
upserts a ``BackupSchedule`` row keyed on ``(cluster_id, vmid)``;
:func:`list_schedules` is the team-scoped reader for the global ``/backups``
page (D-06).

D-08: every backup needs a designated cluster ``backup_storage``.
:func:`_require_backup_storage` raises a 409 when none is set — the user picks
retention, not storage; storage is an admin decision.

Commit discipline mirrors ``power.py`` / ``snapshots.py``: scalar ids are
captured BEFORE ``enqueue_job`` (an idempotency-key collision rolls the session
back and would expire ``resolved.cluster``), and the audit row is committed
explicitly.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.inventory.access import ResolvedResource
from app.jobs.enqueue import enqueue_job
from app.lifecycle.schemas import (
    BackupFileItem,
    BackupScheduleRequest,
    RestoreRequest,
)
from app.models import BackupSchedule, Job

__all__ = [
    "enqueue_backup",
    "list_backups",
    "enqueue_restore",
    "enqueue_backup_delete",
    "upsert_schedule",
    "get_schedule",
    "list_schedules",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_lxc(vm_item: dict) -> bool:
    return vm_item.get("type") == "lxc"


def _vmid(vm_item: dict) -> int:
    return int(vm_item["vmid"])


def _node(vm_item: dict) -> str:
    return str(vm_item.get("node") or "")


def _require_backup_storage(cluster: Any) -> str:
    """Return the cluster's admin-preset backup storage, or raise 409 (D-08).

    No designated storage → the backup endpoints are unavailable. The user
    picks retention, never storage — storage is an admin decision.
    """
    storage = getattr(cluster, "backup_storage", None)
    if not storage:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No backup storage is configured for this cluster. "
                "Ask an administrator to set one."
            ),
        )
    return str(storage)


def _backup_file_item(raw: dict) -> BackupFileItem:
    """Coerce one PVE storage-content row into a :class:`BackupFileItem`."""
    return BackupFileItem(
        volid=str(raw.get("volid") or ""),
        filename=(str(raw["filename"]) if raw.get("filename") else None),
        size=(int(raw["size"]) if raw.get("size") is not None else None),
        ctime=(int(raw["ctime"]) if raw.get("ctime") is not None else None),
        format=(str(raw["format"]) if raw.get("format") else None),
    )


# ---------------------------------------------------------------------------
# Manual backup (LIFE-05)
# ---------------------------------------------------------------------------


async def enqueue_backup(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    source_ip: str | None,
) -> Job:
    """Enqueue a ``vm.backup`` job (manual vzdump) and audit the request.

    Raises ``HTTPException(409)`` when the cluster has no designated
    ``backup_storage`` (D-08).
    """
    storage = _require_backup_storage(resolved.cluster)
    item = resolved.vm_item
    is_lxc = _is_lxc(item)
    vmid = _vmid(item)
    target_type = "lxc" if is_lxc else "vm"
    payload = {
        "node": _node(item),
        "vmid": vmid,
        "is_lxc": is_lxc,
        "storage": storage,
        "mode": "snapshot",
        "compress": "zstd",
    }
    # Capture scalar ids BEFORE enqueue_job — its idempotency-collision rollback
    # expires resolved.cluster (see power.enqueue_power for the rationale).
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.backup",
        cluster_id=cluster_id,
        team_id=team_id,
        actor_user_id=actor_user_id,
        payload=payload,
    )
    job_id = job.id

    await audit_write(
        db,
        actor_user_id=actor_user_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action="vm.backup",
        target_type=target_type,
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={"job_id": job_id, "storage": storage},
    )
    await db.commit()
    return job


async def list_backups(
    db: AsyncSession,  # noqa: ARG001 — kept for caller symmetry; this is a pure read
    *,
    resolved: ResolvedResource,
) -> list[BackupFileItem]:
    """List the VM's backup files via the storage content API.

    This is a READ — it issues no job and writes no audit row. Returns an
    empty list when the cluster has no designated backup storage.
    """
    storage = getattr(resolved.cluster, "backup_storage", None)
    if not storage:
        return []
    item = resolved.vm_item
    raw = await resolved.connector.storage_content(
        node=_node(item),
        storage=str(storage),
        content="backup",
        vmid=_vmid(item),
    )
    return [_backup_file_item(r) for r in (raw or [])]


# ---------------------------------------------------------------------------
# Restore (LIFE-07)
# ---------------------------------------------------------------------------


async def enqueue_restore(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    request: RestoreRequest,
    registry: Any,
    source_ip: str | None,
) -> Job:
    """Enqueue a ``vm.restore`` job — in-place overwrite or restore-as-new.

    ``mode='new'`` creates a resource, so it runs the Phase 2 quota admission
    path (row-locked check + pending-consumption write) BEFORE the job is
    enqueued (Pitfall 8 / T-03-04-03). ``mode='in_place'`` overwrites the same
    VMID with ``force=1`` (data-loss op — the UI enforces the typed-name
    confirm, D-10; the API still authorizes via ``require_resource_access``).
    """
    item = resolved.vm_item
    is_lxc = _is_lxc(item)
    vmid = _vmid(item)
    node = _node(item)
    target_type = "lxc" if is_lxc else "vm"
    storage = getattr(resolved.cluster, "backup_storage", None)
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    if request.mode == "new":
        # Restore-as-new creates a resource → counts against quota (Pitfall 8).
        from app.lifecycle.clone import reserve_vmid, run_quota_admission

        if request.new_vmid is not None:
            newid = int(request.new_vmid)
        else:
            newid = await reserve_vmid(
                cluster_id=cluster_id, connector=resolved.connector,
            )
        await run_quota_admission(
            db, registry, team_id=team_id, cluster_id=cluster_id,
            source_vm_item=item,
        )
        force = False
    else:  # in_place
        newid = vmid
        force = True

    payload = {
        "node": node,
        "vmid": vmid,
        "newid": newid,
        "is_lxc": is_lxc,
        "archive": request.archive,
        "force": force,
        "storage": storage,
        "mode": request.mode,
    }
    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.restore",
        cluster_id=cluster_id,
        team_id=team_id,
        actor_user_id=actor_user_id,
        payload=payload,
    )
    job_id = job.id

    await audit_write(
        db,
        actor_user_id=actor_user_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action="vm.restore",
        target_type=target_type,
        target_id=str(newid),
        result="pending",
        source_ip=source_ip,
        payload_after={
            "job_id": job_id, "mode": request.mode, "newid": newid,
            "archive": request.archive,
        },
    )
    await db.commit()
    return job


# ---------------------------------------------------------------------------
# Backup-file delete (LIFE-05 — explicit delete action)
# ---------------------------------------------------------------------------


async def enqueue_backup_delete(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    volid: str,
    source_ip: str | None,
) -> Job:
    """Enqueue a ``vm.backup.delete`` job — delete one backup file.

    Jobbed (rather than a direct synchronous delete) for Tasks-drawer
    consistency with the rest of the phase. The UI enforces a typed-name
    confirm before issuing this.
    """
    storage = _require_backup_storage(resolved.cluster)
    item = resolved.vm_item
    is_lxc = _is_lxc(item)
    vmid = _vmid(item)
    target_type = "lxc" if is_lxc else "vm"
    payload = {
        "node": _node(item),
        "vmid": vmid,
        "is_lxc": is_lxc,
        "storage": storage,
        "volid": volid,
    }
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.backup.delete",
        cluster_id=cluster_id,
        team_id=team_id,
        actor_user_id=actor_user_id,
        payload=payload,
    )
    job_id = job.id

    await audit_write(
        db,
        actor_user_id=actor_user_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action="vm.backup.delete",
        target_type=target_type,
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={"job_id": job_id, "volid": volid},
    )
    await db.commit()
    return job


# ---------------------------------------------------------------------------
# Backup schedule CRUD (LIFE-06)
# ---------------------------------------------------------------------------


async def upsert_schedule(
    db: AsyncSession,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    request: BackupScheduleRequest,
    source_ip: str | None,
) -> BackupSchedule:
    """Upsert a ``BackupSchedule`` row keyed on ``(cluster_id, vmid)``.

    A plain DB write (not a PVE op) — returns the persisted row. The arq cron
    (``fire_due_scheduled_backups``) later fires due, enabled schedules.
    """
    item = resolved.vm_item
    is_lxc = _is_lxc(item)
    vmid = _vmid(item)
    node = _node(item)
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    existing = (await db.execute(
        select(BackupSchedule).where(
            BackupSchedule.cluster_id == cluster_id,
            BackupSchedule.vmid == vmid,
        )
    )).scalar_one_or_none()

    if existing is None:
        existing = BackupSchedule(
            cluster_id=cluster_id,
            team_id=team_id,
            vmid=vmid,
            is_lxc=is_lxc,
            node=node,
            enabled=request.enabled,
            frequency=request.frequency,
            keep_last=request.keep_last,
        )
        db.add(existing)
    else:
        existing.team_id = team_id
        existing.is_lxc = is_lxc
        existing.node = node
        existing.enabled = request.enabled
        existing.frequency = request.frequency
        existing.keep_last = request.keep_last
    await db.flush()

    await audit_write(
        db,
        actor_user_id=actor_user_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action="vm.backup.schedule",
        target_type="lxc" if is_lxc else "vm",
        target_id=str(vmid),
        result="success",
        source_ip=source_ip,
        payload_after={
            "enabled": request.enabled,
            "frequency": request.frequency,
            "keep_last": request.keep_last,
        },
    )
    await db.commit()
    await db.refresh(existing)
    return existing


async def get_schedule(
    db: AsyncSession,
    *,
    resolved: ResolvedResource,
) -> BackupSchedule | None:
    """Read the ``BackupSchedule`` row for this VM (or ``None`` if unset)."""
    return (await db.execute(
        select(BackupSchedule).where(
            BackupSchedule.cluster_id == resolved.cluster.id,
            BackupSchedule.vmid == _vmid(resolved.vm_item),
        )
    )).scalar_one_or_none()


async def list_schedules(
    db: AsyncSession,
    *,
    team_ids: list[int],
) -> list[BackupSchedule]:
    """Team-scoped schedule list for the global ``/backups`` page (D-06)."""
    if not team_ids:
        return []
    rows = await db.execute(
        select(BackupSchedule)
        .where(BackupSchedule.team_id.in_(team_ids))
        .order_by(BackupSchedule.id)
    )
    return list(rows.scalars().all())
