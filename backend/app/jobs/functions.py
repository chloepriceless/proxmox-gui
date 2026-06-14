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

from proxmoxer.tools import Tasks

from app.audit.writer import audit_write
from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
from app.jobs.events import publish_event
from app.jobs.poller import dispatch_and_poll, poll_to_terminal
from app.jobs.service import finish_job, get_job, update_job
from app.lifecycle.errors import map_pve_error

logger = logging.getLogger(__name__)

_TERMINAL_STATES = {"succeeded", "failed", "needs_review"}


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


async def run_reattach(ctx: dict, job_id: int) -> None:
    """Resume polling an orphaned job's in-flight PVE task (LIFE-14 edge case 1).

    The orphan reaper enqueues ``job.reattach`` for a job whose UPID was still
    running when the worker restarted (``reaper._reconcile_with_upid``). The
    UPID already exists, so we do NOT re-dispatch the mutating call — we
    re-attach to the existing task and poll it to a terminal state via
    ``poll_to_terminal``.

    A transient/unknown outcome resolves to ``needs_review`` — never a false
    ``failed`` on an op that may still be running (D-16); the connector being
    unavailable or the UPID having aged out of Proxmox's task-log are both
    "outcome unknown", not "failed".
    """
    sessionmaker = ctx["sessionmaker"]
    registry = ctx["registry"]

    # 1. Load the orphaned job; bail if already resolved or has no UPID.
    async with sessionmaker() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("run_reattach: job %s not found", job_id)
            return
        if job.state in _TERMINAL_STATES:
            # Already resolved (e.g. by a later reaper pass) — nothing to do.
            return
        if not job.upid:
            # Defensive: the reaper only enqueues reattach for jobs WITH a UPID.
            await update_job(
                db, job_id, state="needs_review",
                error="Re-attach requested but the job carries no UPID",
            )
            await db.commit()
            return
        upid = job.upid
        # Fall back to decoding the node from the UPID if upid_node was never
        # persisted (older write path / partial row) — the UPID encodes it.
        node = job.upid_node or Tasks.decode_upid(upid)["node"]
        cluster_id = job.cluster_id
        team_id = job.team_id

    # 2. Acquire the per-team connector.
    try:
        connector = await registry.get_for_team(
            cluster_id=cluster_id, team_id=team_id
        )
    except Exception as exc:  # noqa: BLE001 — connector unavailable on boot.
        async with sessionmaker() as db:
            await update_job(
                db, job_id, state="needs_review",
                error=f"Re-attach could not reach the cluster: {exc}",
            )
            await db.commit()
        return

    # 3. Re-attach to the existing UPID and poll to terminal. Catch PVE errors
    #    so arq never sees one (max_tries=1) and resolve to needs_review.
    try:
        await poll_to_terminal(ctx, job_id, connector, node=node, upid=upid)
    except (PVEAPIError, PVEUnreachable, PVEAuthError) as exc:
        # Transient/unknown poll error → needs_review (outcome unknown; never a
        # false 'failed' on a possibly-running op, D-16). Re-check the row so a
        # duplicate poller that already finished the job to a terminal state is
        # NOT clobbered back to needs_review.
        if isinstance(exc, PVEAPIError) and getattr(exc, "status_code", None) == 404:
            msg = "UPID no longer known to Proxmox during re-attach"
        else:
            msg = f"Re-attach poll failed: {exc}"
        async with sessionmaker() as db:
            current = await get_job(db, job_id)
            if current is not None and current.state not in _TERMINAL_STATES:
                await update_job(db, job_id, state="needs_review", error=msg)
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
