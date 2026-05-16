"""Power-action service — the enqueue layer for the lifecycle routes.

Every mutating power operation here follows the project's 202-Accepted
contract (API-04): build a payload, call :func:`app.jobs.enqueue.enqueue_job`
(which inserts a ``pending`` jobs row, commits it, and enqueues it on arq),
write an enqueue-time audit row recording *who requested it*, then commit.

The worker (``run_power_action`` in ``app/jobs/functions.py``) issues the
actual Proxmox call and writes the *outcome* audit row — so a power action is
audited on both the request side (here) and the result side (the worker),
per Phase 2 D-20.

Commit discipline: ``enqueue_job`` already commits the jobs row before the
arq enqueue. The ``audit_write`` row is flushed into the *same* session; we
``db.commit()`` it explicitly so the audit survives even though the route does
not raise on the happy path (commit-before-raise — Plan 01-05 / Plan 02-02).
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.clusters.registry import PVEConnectorRegistry
from app.inventory.access import ResolvedResource, resolve_resource
from app.inventory.service import _scrub_pve_error
from app.jobs.enqueue import enqueue_job
from app.lifecycle.schemas import PowerAction
from app.models import Job

__all__ = ["enqueue_power", "enqueue_delete", "enqueue_bulk_power"]


def _is_lxc(vm_item: dict) -> bool:
    """A PVE ``/cluster/resources`` row is an LXC when ``type == 'lxc'``."""
    return vm_item.get("type") == "lxc"


def _power_payload(resolved: ResolvedResource, action: str) -> dict[str, Any]:
    """The ``vm.power`` job payload — node, vmid, is_lxc, action."""
    item = resolved.vm_item
    return {
        "node": str(item.get("node") or ""),
        "vmid": int(item["vmid"]),
        "is_lxc": _is_lxc(item),
        "action": action,
    }


async def enqueue_power(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    action: PowerAction,
    source_ip: str | None,
    batch_id: str | None = None,
) -> Job:
    """Enqueue a single ``vm.power`` job and audit the request.

    Returns the (possibly pre-existing, on idempotency dedup) ``Job`` row.
    """
    action_str = str(action)
    payload = _power_payload(resolved, action_str)
    vmid = payload["vmid"]
    target_type = "lxc" if payload["is_lxc"] else "vm"
    # Capture scalar ids BEFORE enqueue_job — on an idempotency-key collision
    # it issues a rollback, which expires ``resolved.cluster`` and would make
    # a later ``resolved.cluster.id`` access trigger lazy IO outside a session.
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.power",
        cluster_id=cluster_id,
        team_id=team_id,
        actor_user_id=actor_user_id,
        payload=payload,
        batch_id=batch_id,
    )
    job_id = job.id

    # D-20: record who requested the power action at enqueue time. The worker
    # writes the success/failure outcome audit row separately.
    await audit_write(
        db,
        actor_user_id=actor_user_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action=f"vm.power.{action_str}",
        target_type=target_type,
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={"job_id": job_id, "action": action_str, "batch_id": batch_id},
    )
    await db.commit()
    return job


async def enqueue_delete(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    source_ip: str | None,
) -> Job:
    """Enqueue a ``vm.delete`` job (purge) and audit the request."""
    item = resolved.vm_item
    vmid = int(item["vmid"])
    is_lxc = _is_lxc(item)
    target_type = "lxc" if is_lxc else "vm"
    payload = {
        "node": str(item.get("node") or ""),
        "vmid": vmid,
        "is_lxc": is_lxc,
    }
    # Capture scalar ids before enqueue_job (idempotency-collision rollback —
    # see enqueue_power for the rationale).
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.delete",
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
        action="vm.delete",
        target_type=target_type,
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={"job_id": job_id},
    )
    await db.commit()
    return job


async def enqueue_bulk_power(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    registry: PVEConnectorRegistry,
    action: str,
    targets: list,
    source_ip: str | None,
) -> tuple[str, list[Job]]:
    """Fan a bulk power request out into one ``vm.power`` job per VM.

    D-11: every job in the batch shares one ``batch_id`` so the Tasks drawer
    can group them under a single batch header.

    Each target is access-checked individually via :func:`resolve_resource`
    — a target in a tenant the principal cannot reach raises 403 (the partial
    work already enqueued is fine; ``enqueue_job`` commits per job, and a
    re-submit dedups on the idempotency key).
    """
    batch_id = uuid4().hex
    jobs: list[Job] = []
    for target in targets:
        resolved = await resolve_resource(
            db=db,
            registry=registry,
            principal=principal,
            cluster_id=target.cluster_id,
            vmid=target.vmid,
        )
        job = await enqueue_power(
            db,
            arq_pool,
            principal=principal,
            resolved=resolved,
            action=PowerAction(action),
            source_ip=source_ip,
            batch_id=batch_id,
        )
        jobs.append(job)
    return batch_id, jobs


# ``_scrub_pve_error`` is imported so callers that persist a PVE error string
# can scrub tokens first (T-02-03-06). Re-exported for symmetry with the
# inventory service module.
__all__.append("_scrub_pve_error")
_ = _scrub_pve_error
