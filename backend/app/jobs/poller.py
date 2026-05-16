"""UPID polling loop — first response authoritative (RESEARCH §Pattern 3).

The worker dispatches a mutating PVE call, gets a UPID back, **persists it to
the jobs row before polling** (Pitfall 12 — UPID → DB → poll, never the
reverse), then polls ``/nodes/{node}/tasks/{upid}/status`` on an adaptive
cadence until the task is terminal.

The FIRST ``status == "stopped"`` response is authoritative (Pitfall 2): fast
ops (start/stop/snapshot-delete) are already stopped on poll #1.

``exitstatus`` semantics:
- ``"OK"``                → succeeded.
- starts with ``WARNINGS:`` → succeeded, with the warning surfaced (A3 — a
  backup that finished with warnings still has a valid backup file).
- anything else            → failed, ``map_pve_error`` produces the friendly
  message; the raw exitstatus is kept in ``error``.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from proxmoxer.tools import Tasks

from app.jobs.events import publish_event
from app.jobs.service import finish_job, get_job, update_job
from app.lifecycle.errors import map_pve_error

# Adaptive cadence — start tight, back off geometrically, cap at 30s.
_INITIAL_DELAY = 0.5
_BACKOFF = 1.6
_MAX_DELAY = 30.0


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def dispatch_and_poll(
    ctx: dict,
    job: Any,
    connector: Any,
    dispatch_fn: Callable[[], Awaitable[str]],
) -> None:
    """Dispatch the mutating PVE call, persist the UPID, then poll to terminal.

    Args:
        ctx: arq job context — carries ``sessionmaker`` and ``redis``.
        job: the ``Job`` row being executed.
        connector: the per-team ``PVEConnector``.
        dispatch_fn: a zero-arg coroutine that issues the mutating call and
            returns the UPID string (e.g. ``lambda: connector.vm_power(...)``).
    """
    sessionmaker = ctx["sessionmaker"]
    redis = ctx["redis"]

    # 1. Dispatch — proxmoxer returns the UPID string.
    upid = await dispatch_fn()
    # Tasks.decode_upid handles the trailing user@realm correctly — never
    # split a UPID on ':' naively (Pitfall 2 point 5).
    node = Tasks.decode_upid(upid)["node"]

    # 2. PERSIST BEFORE POLLING (Pitfall 12). If the worker dies here, the
    #    reaper finds `upid` populated and re-attaches.
    async with sessionmaker() as db:
        await update_job(
            db,
            job.id,
            upid=upid,
            upid_node=node,
            state="running",
            started_at=_utcnow(),
        )
        await db.commit()
        running = await get_job(db, job.id)
        if running is not None:
            await publish_event(redis, "job.running", running)

    # 3. Poll. The FIRST stopped response is authoritative (Pitfall 2).
    delay = _INITIAL_DELAY
    while True:
        status = await connector.task_status(node=node, upid=upid)
        if status.get("status") == "stopped":
            exitstatus = status.get("exitstatus") or ""
            log_tail = await connector.task_log(node=node, upid=upid, limit=200)
            async with sessionmaker() as db:
                if exitstatus == "OK" or exitstatus.startswith("WARNINGS:"):
                    # A3: WARNINGS: → succeeded, the warning still surfaced.
                    friendly = (
                        None
                        if exitstatus == "OK"
                        else f"Completed with warnings: {exitstatus}"
                    )
                    await finish_job(
                        db,
                        job.id,
                        state="succeeded",
                        friendly=friendly,
                        log=log_tail,
                    )
                else:
                    await finish_job(
                        db,
                        job.id,
                        state="failed",
                        error=exitstatus,
                        friendly=map_pve_error(exitstatus, log_tail),
                        log=log_tail,
                    )
                await db.commit()
                done = await get_job(db, job.id)
                if done is not None:
                    await publish_event(redis, "job.completed", done)
            return

        # Still running — emit a progress event and back off.
        async with sessionmaker() as db:
            current = await get_job(db, job.id)
            if current is not None:
                await publish_event(redis, "job.progress", current)
        await asyncio.sleep(delay)
        delay = min(delay * _BACKOFF, _MAX_DELAY)
