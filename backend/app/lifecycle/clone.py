"""Clone + template-convert service — LIFE-10, plus shared create-flow helpers.

This module owns two things:

1. **Shared create-flow helpers** consumed by BOTH clone and restore-as-new:
   - :func:`reserve_vmid` — app-level VMID allocation (Pitfall 1 / RESEARCH
     Open Question Q2). ``/cluster/nextid`` is not atomic on older PVE; this
     guards two concurrent allocations with a per-cluster ``asyncio.Lock`` plus
     a short-lived in-process reserved set. The API runs as a single process,
     so an in-process lock is the simplest correct mechanism (RESEARCH Q2).
   - :func:`run_quota_admission` — the Phase 2 quota admission check. Clone and
     restore-as-new both create a resource, so they count against quota
     (Pitfall 8 / T-03-04-03). This runs the row-locked admission check BEFORE
     the job is enqueued.

2. **The clone + template-convert enqueue layer** — :func:`enqueue_clone` and
   :func:`enqueue_template_convert`, both following the 202-Accepted contract.

Template conversion is qemu-only (RESEARCH A7) — an LXC convert is rejected
with an explanatory 422.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.inventory.access import ResolvedResource
from app.jobs.enqueue import enqueue_job
from app.lifecycle.schemas import CloneRequest
from app.models import Job

__all__ = [
    "reserve_vmid",
    "run_quota_admission",
    "enqueue_clone",
    "enqueue_template_convert",
]

# ---------------------------------------------------------------------------
# VMID reservation (Pitfall 1, RESEARCH Open Question Q2)
# ---------------------------------------------------------------------------

# Per-cluster lock — serialises VMID allocation within the single API process.
_cluster_locks: dict[int, asyncio.Lock] = {}
# Per-cluster reserved set: {cluster_id: {vmid: reserved_at_epoch}}. A reserved
# id is held for _RESERVATION_TTL so a second concurrent allocate skips it even
# before the first clone job actually creates the VM on PVE.
_reserved: dict[int, dict[int, float]] = {}
_RESERVATION_TTL = 60.0  # seconds


def _lock_for(cluster_id: int) -> asyncio.Lock:
    lock = _cluster_locks.get(cluster_id)
    if lock is None:
        lock = asyncio.Lock()
        _cluster_locks[cluster_id] = lock
    return lock


def _prune_reservations(cluster_id: int, *, now: float) -> dict[int, float]:
    """Drop expired reservations for a cluster and return the live set."""
    live = {
        vmid: ts
        for vmid, ts in _reserved.get(cluster_id, {}).items()
        if (now - ts) < _RESERVATION_TTL
    }
    _reserved[cluster_id] = live
    return live


async def reserve_vmid(*, cluster_id: int, connector: Any) -> int:
    """Allocate a VMID for a new resource under an app-level reservation.

    ``connector.cluster_nextid()`` is not atomic on older PVE (Pitfall 1) — two
    concurrent allocations could return the same id. This holds a per-cluster
    ``asyncio.Lock`` while it (a) asks PVE for the next id and (b) skips any id
    currently in the in-process reserved set, then records the chosen id with a
    short TTL. The worker bounded-retries on a PVE "already exists" as a final
    backstop (see ``clone_migrate_functions.run_clone``).
    """
    async with _lock_for(cluster_id):
        now = time.monotonic()
        live = _prune_reservations(cluster_id, now=now)
        candidate = int(await connector.cluster_nextid())
        # Skip ids still held by another in-flight allocation.
        while candidate in live:
            candidate += 1
        live[candidate] = now
        _reserved[cluster_id] = live
        return candidate


async def run_quota_admission(
    db: AsyncSession,
    registry: Any,
    *,
    team_id: int,
    cluster_id: int,
    source_vm_item: dict,
) -> None:
    """Run the Phase 2 quota admission check for a clone / restore-as-new.

    Both clone and restore-as-new create a resource → they count against the
    team's quota (Pitfall 8 / T-03-04-03). This routes through the Phase 2
    ``check_and_preview`` admission primitive (row-locked check inside a
    ``BEGIN IMMEDIATE`` transaction) sizing the request from the SOURCE VM's
    reported cpu/mem/disk. A ``would_exceed`` verdict is rejected 409 BEFORE
    the job is enqueued.
    """
    from app.quotas.admission import check_and_preview
    from app.quotas.schemas import QuotaPreviewRequest

    preview = await check_and_preview(
        db,
        registry,
        request=QuotaPreviewRequest(
            team_id=team_id,
            cluster_id=cluster_id,
            requested_cpu=int(source_vm_item.get("maxcpu") or 0),
            requested_ram_bytes=int(source_vm_item.get("maxmem") or 0),
            requested_disk_bytes=int(source_vm_item.get("maxdisk") or 0),
            requested_count=1,
        ),
    )
    if preview.would_exceed:
        exceeded = [d.name for d in preview.dimensions if d.would_exceed]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "This would exceed your team's quota. Free up resources "
                    "or ask an administrator to raise the limit."
                ),
                "exceeded": exceeded,
            },
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_lxc(vm_item: dict) -> bool:
    return vm_item.get("type") == "lxc"


def _vmid(vm_item: dict) -> int:
    return int(vm_item["vmid"])


def _node(vm_item: dict) -> str:
    return str(vm_item.get("node") or "")


# ---------------------------------------------------------------------------
# Clone (LIFE-10)
# ---------------------------------------------------------------------------


async def enqueue_clone(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    request: CloneRequest,
    registry: Any,
    source_ip: str | None,
) -> Job:
    """Enqueue a ``vm.clone`` job — linked/full clone with a reserved VMID.

    Allocates the target VMID via :func:`reserve_vmid` when the request does
    not supply one (Pitfall 1), runs :func:`run_quota_admission` (clone creates
    a resource — Pitfall 8), then enqueues the job with the pre-allocated id in
    the payload so the worker uses it directly.
    """
    item = resolved.vm_item
    is_lxc = _is_lxc(item)
    vmid = _vmid(item)
    node = _node(item)
    target_type = "lxc" if is_lxc else "vm"
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    if request.new_vmid is not None:
        newid = int(request.new_vmid)
    else:
        newid = await reserve_vmid(cluster_id=cluster_id, connector=resolved.connector)

    # Clone creates a resource → quota admission BEFORE the job is enqueued.
    await run_quota_admission(
        db, registry, team_id=team_id, cluster_id=cluster_id,
        source_vm_item=item,
    )

    payload = {
        "node": node,
        "vmid": vmid,
        "newid": newid,
        "name": request.name,
        "full": request.full,
        "target": request.target_node,
        "storage": request.target_storage,
        "is_lxc": is_lxc,
    }
    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.clone",
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
        action="vm.clone",
        target_type=target_type,
        target_id=str(newid),
        result="pending",
        source_ip=source_ip,
        payload_after={
            "job_id": job_id, "source_vmid": vmid, "newid": newid,
            "name": request.name, "full": request.full,
        },
    )
    await db.commit()
    return job


# ---------------------------------------------------------------------------
# Template conversion (LIFE-10 — qemu-only, RESEARCH A7)
# ---------------------------------------------------------------------------


async def enqueue_template_convert(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    source_ip: str | None,
) -> Job:
    """Enqueue a ``vm.template`` job — convert a qemu VM to a template.

    Template conversion is qemu-only (RESEARCH A7) — an LXC convert is rejected
    with an explanatory 422 BEFORE any job is enqueued.
    """
    item = resolved.vm_item
    if _is_lxc(item):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Converting a container to a template isn't supported here — "
                "LXC templates are created differently."
            ),
        )
    vmid = _vmid(item)
    node = _node(item)
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    payload = {"node": node, "vmid": vmid, "is_lxc": False}
    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.template",
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
        action="vm.template",
        target_type="vm",
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={"job_id": job_id},
    )
    await db.commit()
    return job
