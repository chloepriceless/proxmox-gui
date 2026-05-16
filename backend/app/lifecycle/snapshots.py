"""Snapshot lifecycle service — the enqueue layer + the flat-list reader.

LIFE-04. Three mutating operations (create / rollback / delete) follow the
project's 202-Accepted contract: build a payload, call
:func:`app.jobs.enqueue.enqueue_job` (inserts a ``pending`` jobs row, commits
it, enqueues it on arq), write an enqueue-time audit row recording *who
requested it*, then ``db.commit()``. The worker
(``run_snapshot_*`` in ``app/jobs/snapshot_functions.py``) issues the actual
Proxmox call and writes the *outcome* audit row — D-20.

:func:`list_snapshots` is a pure read (no job, no audit). It normalizes the
flat PVE ``snapshot`` GET payload — including the synthetic ``current``
pseudo-entry — into :class:`SnapshotItem` objects so the client can build the
indented tree from each item's ``parent`` pointer (D-05).

Commit discipline mirrors ``power.py``: scalar ids are captured BEFORE
``enqueue_job`` (an idempotency-key collision rolls the session back and would
expire ``resolved.cluster``), and the audit row is committed explicitly so it
survives even though the happy path does not raise.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.inventory.access import ResolvedResource
from app.jobs.enqueue import enqueue_job
from app.lifecycle.schemas import SnapshotItem
from app.models import Job

__all__ = [
    "list_snapshots",
    "enqueue_snapshot_create",
    "enqueue_snapshot_rollback",
    "enqueue_snapshot_delete",
]


def _is_lxc(vm_item: dict) -> bool:
    """A PVE ``/cluster/resources`` row is an LXC when ``type == 'lxc'``."""
    return vm_item.get("type") == "lxc"


def _vmid(vm_item: dict) -> int:
    return int(vm_item["vmid"])


def _node(vm_item: dict) -> str:
    return str(vm_item.get("node") or "")


def _normalize_snapshot(raw: dict) -> SnapshotItem:
    """Coerce one PVE snapshot dict into a :class:`SnapshotItem`.

    Tolerates missing ``parent``/``snaptime``/``description``/``vmstate`` —
    PVE omits ``parent`` on root snapshots and on the synthetic ``current``
    entry, and omits ``snaptime`` on ``current``. RESEARCH A4: the field names
    are standard PVE behaviour; if a live cluster reports a different field
    name, adapt this normalizer rather than crashing.
    """
    vmstate_raw = raw.get("vmstate")
    return SnapshotItem(
        name=str(raw.get("name") or raw.get("snapname") or ""),
        parent=(str(raw["parent"]) if raw.get("parent") else None),
        snaptime=(int(raw["snaptime"]) if raw.get("snaptime") is not None else None),
        description=(
            str(raw["description"]) if raw.get("description") is not None else None
        ),
        vmstate=(bool(vmstate_raw) if vmstate_raw is not None else None),
    )


async def list_snapshots(
    db: AsyncSession,  # noqa: ARG001 — kept for caller symmetry; this is a pure read
    *,
    resolved: ResolvedResource,
) -> list[SnapshotItem]:
    """Return the flat snapshot list (each item carries a ``parent`` pointer).

    This is a READ — it issues no job and writes no audit row. The client
    builds the indented tree view (D-05) from the ``parent`` field.
    """
    item = resolved.vm_item
    raw = await resolved.connector.snapshot_list(
        node=_node(item), vmid=_vmid(item), is_lxc=_is_lxc(item)
    )
    return [_normalize_snapshot(r) for r in (raw or [])]


async def enqueue_snapshot_create(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    name: str,
    description: str | None,
    vmstate: bool,
    source_ip: str | None,
) -> Job:
    """Enqueue a ``vm.snapshot.create`` job and audit the request.

    ``vmstate`` (include-RAM-state) is QEMU-only — requesting it on an LXC is
    rejected with a 422 before any job is enqueued.
    """
    item = resolved.vm_item
    is_lxc = _is_lxc(item)
    if vmstate and is_lxc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="RAM state can only be captured for VMs, not containers.",
        )
    vmid = _vmid(item)
    target_type = "lxc" if is_lxc else "vm"
    payload = {
        "node": _node(item),
        "vmid": vmid,
        "is_lxc": is_lxc,
        "snapname": name,
        "description": description,
        "vmstate": vmstate,
    }
    # Capture scalar ids BEFORE enqueue_job — its idempotency-collision rollback
    # expires resolved.cluster (see power.enqueue_power for the rationale).
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.snapshot.create",
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
        action="vm.snapshot.create",
        target_type=target_type,
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={"job_id": job_id, "snapname": name},
    )
    await db.commit()
    return job


async def enqueue_snapshot_rollback(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    name: str,
    source_ip: str | None,
) -> Job:
    """Enqueue a ``vm.snapshot.rollback`` job (non-idempotent) and audit it."""
    item = resolved.vm_item
    is_lxc = _is_lxc(item)
    vmid = _vmid(item)
    target_type = "lxc" if is_lxc else "vm"
    payload = {
        "node": _node(item),
        "vmid": vmid,
        "is_lxc": is_lxc,
        "name": name,
    }
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.snapshot.rollback",
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
        action="vm.snapshot.rollback",
        target_type=target_type,
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={"job_id": job_id, "snapname": name},
    )
    await db.commit()
    return job


async def enqueue_snapshot_delete(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    name: str,
    source_ip: str | None,
) -> Job:
    """Enqueue a ``vm.snapshot.delete`` job (retry-eligible) and audit it."""
    item = resolved.vm_item
    is_lxc = _is_lxc(item)
    vmid = _vmid(item)
    target_type = "lxc" if is_lxc else "vm"
    payload = {
        "node": _node(item),
        "vmid": vmid,
        "is_lxc": is_lxc,
        "name": name,
    }
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.snapshot.delete",
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
        action="vm.snapshot.delete",
        target_type=target_type,
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={"job_id": job_id, "snapname": name},
    )
    await db.commit()
    return job
