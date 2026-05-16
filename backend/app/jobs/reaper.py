"""Orphan reaper — boot-time non-terminal job reconciliation (LIFE-14).

Runs in the worker's ``on_startup`` hook on EVERY boot, no exceptions. It scans
the ``jobs`` table for rows in non-terminal states (``pending``, ``claimed``,
``running``) and reconciles each against Proxmox.

Five edge cases (RESEARCH §Pattern 4 — each must be handled):

1. ``upid`` set, task still running   → re-enqueue a ``job.reattach`` poll job,
   mark ``orphaned`` transiently.
2. ``upid`` set, task already stopped → resolve directly to succeeded/failed.
3. ``upid`` set, PVE returns 404      → UPID aged out of PVE's task-log
   retention window → ``needs_review`` (outcome genuinely unknown).
4. no ``upid``, state ``pending``     → the PVE call never fired → safe to
   re-enqueue normally.
5. no ``upid``, state ``claimed``/``running`` → the worker died between claim
   and UPID-receipt → ``needs_review`` ("outcome unknown"). This is exactly
   why clone/migrate/delete/restore are NOT auto-retried (D-16).
"""

from __future__ import annotations

import logging

from app.clusters.errors import PVEAPIError
from app.jobs.events import publish_raw
from app.jobs.service import finish_job, select_jobs, update_job

logger = logging.getLogger(__name__)

_NON_TERMINAL = ["pending", "claimed", "running"]


async def reap_orphans(ctx: dict) -> None:
    """Reconcile every non-terminal job against Proxmox on worker boot.

    Args:
        ctx: arq job context — must carry ``sessionmaker``, ``registry``,
            ``redis`` and ``arq_pool``.
    """
    sessionmaker = ctx["sessionmaker"]
    registry = ctx["registry"]
    redis = ctx["redis"]
    arq_pool = ctx["arq_pool"]

    async with sessionmaker() as db:
        rows = await select_jobs(db, _NON_TERMINAL)

    reattached: list[int] = []
    for job in rows:
        if job.upid:
            await _reconcile_with_upid(
                job, sessionmaker=sessionmaker, registry=registry,
                arq_pool=arq_pool, reattached=reattached,
            )
        else:
            await _reconcile_without_upid(
                job, sessionmaker=sessionmaker, arq_pool=arq_pool,
            )

    if reattached:
        await publish_raw(redis, "reaper.reattached", {"job_ids": reattached})


async def _reconcile_with_upid(
    job,  # noqa: ANN001
    *,
    sessionmaker,  # noqa: ANN001
    registry,  # noqa: ANN001
    arq_pool,  # noqa: ANN001
    reattached: list[int],
) -> None:
    """Edge cases 1-3 — the job carries a UPID, so the PVE call WAS issued."""
    try:
        connector = await registry.get_for_team(
            cluster_id=job.cluster_id, team_id=job.team_id
        )
    except Exception as exc:  # noqa: BLE001 — connector unavailable on boot.
        logger.warning(
            "reaper: cannot load connector for job %s: %s", job.id, exc
        )
        async with sessionmaker() as db:
            await update_job(
                db, job.id, state="needs_review",
                error=f"Reaper could not reach the cluster on boot: {exc}",
            )
            await db.commit()
        return

    try:
        status = await connector.task_status(node=job.upid_node, upid=job.upid)
    except PVEAPIError as exc:
        if getattr(exc, "status_code", None) == 404:
            # Edge case 3: UPID aged out of PVE's task-log retention window.
            async with sessionmaker() as db:
                await update_job(
                    db, job.id, state="needs_review",
                    error="UPID no longer known to Proxmox after restart",
                )
                await db.commit()
            return
        raise

    if status.get("status") == "stopped":
        # Edge case 2: resolve directly — do NOT re-dispatch.
        exitstatus = status.get("exitstatus") or ""
        ok = exitstatus == "OK" or exitstatus.startswith("WARNINGS:")
        try:
            log_tail = await connector.task_log(
                node=job.upid_node, upid=job.upid, limit=200
            )
        except Exception:  # noqa: BLE001
            log_tail = ""
        async with sessionmaker() as db:
            if ok:
                await finish_job(db, job.id, state="succeeded", log=log_tail)
            else:
                from app.lifecycle.errors import map_pve_error

                await finish_job(
                    db, job.id, state="failed", error=exitstatus,
                    friendly=map_pve_error(exitstatus, log_tail), log=log_tail,
                )
            await db.commit()
        return

    # Edge case 1: still running — re-enqueue a re-attach poll job.
    async with sessionmaker() as db:
        await update_job(db, job.id, state="orphaned")
        await db.commit()
    await arq_pool.enqueue_job("job.reattach", job.id)
    reattached.append(job.id)


async def _reconcile_without_upid(
    job,  # noqa: ANN001
    *,
    sessionmaker,  # noqa: ANN001
    arq_pool,  # noqa: ANN001
) -> None:
    """Edge cases 4-5 — no UPID, so the PVE call may or may not have fired."""
    if job.state == "pending":
        # Edge case 4: the PVE call never started — safe to re-enqueue.
        # The idempotency_key already blocks a double if the API also retried.
        await arq_pool.enqueue_job(job.kind, job.id, _job_id=f"job-{job.id}")
        return
    # Edge case 5: claimed/running with no UPID — the worker died before
    # Proxmox returned a UPID. We cannot know if the side effect happened.
    async with sessionmaker() as db:
        await update_job(
            db, job.id, state="needs_review",
            error=(
                "Worker died before Proxmox returned a UPID; "
                "outcome unknown"
            ),
        )
        await db.commit()
