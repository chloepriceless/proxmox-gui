"""arq job functions — the per-kind coroutines the worker dispatches.

Plan 03-01 shipped only ``noop_job``. Plan 03-02 adds ``run_power_action`` —
the first real ``run_*`` job function, covering both ``vm.power`` (start /
stop / reboot / shutdown) and ``vm.delete``.

Every job function is structurally a service function: claim the row, acquire
the per-team connector, dispatch the mutating PVE call through the UPID poller,
audit the outcome — and it catches its OWN PVE exceptions so arq never sees one
(``max_tries=1`` — RESEARCH §Pattern 1; arq must NOT auto-retry a power op).
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

from app.audit.writer import audit_write
from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
from app.jobs.events import publish_event
from app.jobs.poller import dispatch_and_poll
from app.jobs.service import finish_job, get_job, update_job
from app.lifecycle.errors import map_pve_error

logger = logging.getLogger(__name__)


async def noop_job(ctx: dict) -> None:
    """Internal no-op — keeps the worker's ``functions`` list non-empty.

    Retained as a harmless placeholder; the worker registers real ``run_*``
    job functions alongside it.
    """
    return None


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def run_power_action(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.power`` or ``vm.delete`` job.

    Flow:
      1. Load the jobs row; transition ``pending`` → ``claimed``.
      2. Acquire the per-team privsep connector (``registry.get_for_team``).
      3. ``dispatch_and_poll`` — issue the mutating PVE call, persist the UPID
         BEFORE polling (Pitfall 12), poll the task to a terminal state.
      4. Audit the outcome on BOTH success and failure (Phase 2 D-20).

    The worker catches ``PVEUnreachable`` / ``PVEAPIError`` / ``PVEAuthError``
    itself and marks the job ``failed`` with a friendly message — arq never
    sees the exception (``max_tries=1``: a power op must not silently re-run).
    """
    sessionmaker = ctx["sessionmaker"]
    registry = ctx["registry"]
    redis = ctx["redis"]

    # 1. Claim the job.
    async with sessionmaker() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("run_power_action: job %s not found", job_id)
            return
        if job.state in {"succeeded", "failed", "needs_review"}:
            # Terminal already (e.g. resolved by the reaper) — nothing to do.
            return
        await update_job(db, job_id, state="claimed")
        await db.commit()
        job = await get_job(db, job_id)

    payload = json.loads(job.payload)
    node = payload["node"]
    vmid = int(payload["vmid"])
    is_lxc = bool(payload.get("is_lxc"))
    kind = job.kind
    action = payload.get("action")
    target_type = "lxc" if is_lxc else "vm"
    audit_action = f"vm.power.{action}" if kind == "vm.power" else "vm.delete"

    # 2. Acquire the per-team privsep connector.
    try:
        connector = await registry.get_for_team(
            cluster_id=job.cluster_id, team_id=job.team_id
        )
    except Exception as exc:  # noqa: BLE001 — connector unavailable.
        await _fail_job(
            sessionmaker, redis, job_id,
            raw=str(exc),
            friendly="Couldn't reach the cluster to run this operation.",
            audit_action=audit_action, target_type=target_type, vmid=vmid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # 3. Build the dispatch closure for this kind.
    if kind == "vm.delete":
        async def _dispatch() -> str:
            return await connector.vm_delete(node=node, vmid=vmid, is_lxc=is_lxc)
    else:  # vm.power
        async def _dispatch() -> str:
            return await connector.vm_power(
                node=node, vmid=vmid, is_lxc=is_lxc, action=action
            )

    # 4. Dispatch + poll. Catch PVE exceptions so arq never retries.
    try:
        await dispatch_and_poll(ctx, job, connector, _dispatch)
    except (PVEUnreachable, PVEAPIError, PVEAuthError) as exc:
        await _fail_job(
            sessionmaker, redis, job_id,
            raw=str(exc),
            friendly=map_pve_error(str(exc), ""),
            audit_action=audit_action, target_type=target_type, vmid=vmid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # 5. Audit the outcome — dispatch_and_poll set the terminal state.
    async with sessionmaker() as db:
        final = await get_job(db, job_id)
        result = "success" if (final and final.state == "succeeded") else "failure"
        await audit_write(
            db,
            actor_user_id=job.actor_user_id,
            team_id=job.team_id,
            cluster_id=job.cluster_id,
            action=audit_action,
            target_type=target_type,
            target_id=str(vmid),
            result=result,
            source_ip=None,
            error=(final.friendly_error or final.error) if final else None,
            payload_after={"job_id": job_id, "state": final.state if final else None},
        )
        await db.commit()


async def _fail_job(
    sessionmaker,  # noqa: ANN001
    redis,  # noqa: ANN001
    job_id: int,
    *,
    raw: str,
    friendly: str,
    audit_action: str,
    target_type: str,
    vmid: int,
    actor_user_id: int | None,
    team_id: int | None,
    cluster_id: int | None,
) -> None:
    """Mark a job failed, publish the event, and write a failure audit row."""
    async with sessionmaker() as db:
        await finish_job(
            db, job_id, state="failed", error=raw, friendly=friendly,
        )
        await audit_write(
            db,
            actor_user_id=actor_user_id,
            team_id=team_id,
            cluster_id=cluster_id,
            action=audit_action,
            target_type=target_type,
            target_id=str(vmid),
            result="failure",
            source_ip=None,
            error=friendly,
            payload_after={"job_id": job_id, "state": "failed"},
        )
        await db.commit()
        done = await get_job(db, job_id)
        if done is not None:
            await publish_event(redis, "job.completed", done)
