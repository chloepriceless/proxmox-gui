"""arq job functions for the snapshot lifecycle — LIFE-04.

``run_snapshot_create`` / ``run_snapshot_rollback`` / ``run_snapshot_delete``
each mirror ``run_power_action`` from Plan 03-02:

  1. load the jobs row, transition ``pending`` → ``claimed``,
  2. acquire the per-team privsep connector (``registry.get_for_team``),
  3. ``dispatch_and_poll`` — issue the mutating PVE call, persist the UPID
     BEFORE polling (Pitfall 12), poll the task to a terminal state,
  4. audit the outcome on BOTH success and failure (Phase 2 D-20).

Each function catches its OWN PVE exceptions so arq never sees one
(``max_tries=1`` — RESEARCH §Pattern 1; a snapshot op must not silently
re-run, and snapshot-delete retry is USER-driven via D-16).
"""

from __future__ import annotations

import json
import logging

from app.audit.writer import audit_write
from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
from app.jobs.functions import _fail_job
from app.jobs.poller import dispatch_and_poll
from app.jobs.service import get_job, update_job

logger = logging.getLogger(__name__)


async def _run_snapshot_job(ctx: dict, job_id: int) -> None:
    """Shared body for the three ``run_snapshot_*`` job functions.

    The PVE call dispatched is selected from the job ``kind`` — all three
    snapshot kinds share the claim → connector → dispatch_and_poll → audit
    shape, exactly like ``run_power_action`` covers ``vm.power`` + ``vm.delete``.
    """
    sessionmaker = ctx["sessionmaker"]
    registry = ctx["registry"]
    redis = ctx["redis"]

    # 1. Claim the job.
    async with sessionmaker() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("_run_snapshot_job: job %s not found", job_id)
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
    target_type = "lxc" if is_lxc else "vm"
    audit_action = kind  # vm.snapshot.create / rollback / delete

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

    # 3. Build the dispatch closure for this snapshot kind.
    if kind == "vm.snapshot.create":
        snapname = payload["snapname"]
        description = payload.get("description") or ""
        vmstate = bool(payload.get("vmstate"))

        async def _dispatch() -> str:
            return await connector.snapshot_create(
                node=node, vmid=vmid, is_lxc=is_lxc, snapname=snapname,
                description=description, vmstate=vmstate,
            )
    elif kind == "vm.snapshot.rollback":
        name = payload["name"]

        async def _dispatch() -> str:
            return await connector.snapshot_rollback(
                node=node, vmid=vmid, is_lxc=is_lxc, name=name,
            )
    else:  # vm.snapshot.delete
        name = payload["name"]

        async def _dispatch() -> str:
            return await connector.snapshot_delete(
                node=node, vmid=vmid, is_lxc=is_lxc, name=name,
            )

    # 4. Dispatch + poll. Catch PVE exceptions so arq never retries.
    try:
        await dispatch_and_poll(ctx, job, connector, _dispatch)
    except (PVEUnreachable, PVEAPIError, PVEAuthError) as exc:
        from app.lifecycle.errors import map_pve_error

        await _fail_job(
            sessionmaker, redis, job_id,
            raw=str(exc),
            friendly=map_pve_error(str(exc), ""),
            audit_action=audit_action, target_type=target_type, vmid=vmid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # 5. Audit the outcome — dispatch_and_poll set the terminal state AND
    #    already published the ``job.completed`` event; we only add the
    #    outcome audit row here (D-20), exactly like ``run_power_action``.
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


async def run_snapshot_create(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.snapshot.create`` job — dispatch + poll + audit."""
    await _run_snapshot_job(ctx, job_id)


async def run_snapshot_rollback(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.snapshot.rollback`` job — dispatch + poll + audit."""
    await _run_snapshot_job(ctx, job_id)


async def run_snapshot_delete(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.snapshot.delete`` job — dispatch + poll + audit."""
    await _run_snapshot_job(ctx, job_id)
