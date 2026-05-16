"""arq job function for the resize lifecycle — LIFE-08, LIFE-09.

``run_resize`` is structurally different from ``run_power_action`` /
``run_snapshot_*``: a CPU/RAM resize is a SYNCHRONOUS Proxmox ``config.put``
that returns no UPID, and a disk grow is a (mostly) synchronous ``resize.put``.
There is therefore NO poll loop — after the sync write(s) succeed the job is
marked ``succeeded`` directly via ``finish_job`` and a ``job.completed`` event
is published, exactly like the poller's terminal path but without the polling.

The job still flows through the ``jobs`` row so it appears in the Tasks drawer
for consistency (RESEARCH §Resize — "still flows through a vm.resize job for
drawer consistency").

The worker catches its own PVE exceptions (``max_tries=1``) — arq never sees
one, and on failure the job is marked ``failed`` with ``map_pve_error``.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

from app.audit.writer import audit_write
from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
from app.jobs.events import publish_event
from app.jobs.service import finish_job, get_job, update_job
from app.lifecycle.errors import map_pve_error

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def run_resize(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.resize`` job — synchronous config write, no poll loop.

    Flow:
      1. Load the jobs row; transition ``pending`` → ``claimed`` → ``running``.
      2. Acquire the per-team privsep connector.
      3. If ``cores``/``memory`` are set, issue ONE synchronous
         ``set_vm_config``. For each disk grow, issue ``resize_disk`` with the
         ``+NG`` delta syntax (delta = ``new_size_gb - current_size_gb``).
      4. ``finish_job(state="succeeded")`` directly — there is no UPID to poll.
      5. Audit the outcome and publish ``job.completed``.
    """
    sessionmaker = ctx["sessionmaker"]
    registry = ctx["registry"]
    redis = ctx["redis"]

    # 1. Claim the job.
    async with sessionmaker() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("run_resize: job %s not found", job_id)
            return
        if job.state in {"succeeded", "failed", "needs_review"}:
            return
        await update_job(db, job_id, state="claimed")
        await db.commit()
        job = await get_job(db, job_id)

    payload = json.loads(job.payload)
    node = payload["node"]
    vmid = int(payload["vmid"])
    is_lxc = bool(payload.get("is_lxc"))
    cores = payload.get("cores")
    memory = payload.get("memory")
    disks = payload.get("disks") or []
    target_type = "lxc" if is_lxc else "vm"

    # 2. Acquire the per-team privsep connector.
    try:
        connector = await registry.get_for_team(
            cluster_id=job.cluster_id, team_id=job.team_id
        )
    except Exception as exc:  # noqa: BLE001 — connector unavailable.
        await _finish_resize(
            sessionmaker, redis, job_id, state="failed",
            raw=str(exc),
            friendly="Couldn't reach the cluster to run this operation.",
            target_type=target_type, vmid=vmid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # Mark running so the drawer shows progress (no UPID — straight sync work).
    async with sessionmaker() as db:
        await update_job(db, job_id, state="running", started_at=_utcnow())
        await db.commit()
        running = await get_job(db, job_id)
        if running is not None:
            await publish_event(redis, "job.running", running)

    # 3. Synchronous write(s). Catch PVE exceptions so arq never retries.
    try:
        if cores is not None or memory is not None:
            fields: dict[str, int] = {}
            if cores is not None:
                fields["cores"] = int(cores)
            if memory is not None:
                fields["memory"] = int(memory)
            await connector.set_vm_config(
                node=node, vmid=vmid, is_lxc=is_lxc, **fields
            )
        for grow in disks:
            delta = int(grow["new_size_gb"]) - int(grow["current_size_gb"])
            if delta <= 0:
                # Defensive: enqueue_resize already blocked shrinks 422; never
                # send a non-positive delta to PVE.
                continue
            await connector.resize_disk(
                node=node, vmid=vmid, is_lxc=is_lxc,
                disk=str(grow["disk"]), size=f"+{delta}G",
            )
    except (PVEUnreachable, PVEAPIError, PVEAuthError) as exc:
        await _finish_resize(
            sessionmaker, redis, job_id, state="failed",
            raw=str(exc),
            friendly=map_pve_error(str(exc), ""),
            target_type=target_type, vmid=vmid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # 4 + 5. No UPID, no poll — mark succeeded directly, audit, publish.
    await _finish_resize(
        sessionmaker, redis, job_id, state="succeeded",
        raw=None, friendly=None,
        target_type=target_type, vmid=vmid,
        actor_user_id=job.actor_user_id, team_id=job.team_id,
        cluster_id=job.cluster_id,
    )


async def _finish_resize(
    sessionmaker,  # noqa: ANN001
    redis,  # noqa: ANN001
    job_id: int,
    *,
    state: str,
    raw: str | None,
    friendly: str | None,
    target_type: str,
    vmid: int,
    actor_user_id: int | None,
    team_id: int | None,
    cluster_id: int | None,
) -> None:
    """Mark a resize job terminal, write the outcome audit row, publish.

    Used for BOTH the success and failure paths — a resize has no poll loop,
    so the job function owns the terminal transition (the poller does this for
    UPID-backed kinds).
    """
    async with sessionmaker() as db:
        await finish_job(db, job_id, state=state, error=raw, friendly=friendly)
        result = "success" if state == "succeeded" else "failure"
        await audit_write(
            db,
            actor_user_id=actor_user_id,
            team_id=team_id,
            cluster_id=cluster_id,
            action="vm.resize",
            target_type=target_type,
            target_id=str(vmid),
            result=result,
            source_ip=None,
            error=friendly,
            payload_after={"job_id": job_id, "state": state},
        )
        await db.commit()
        done = await get_job(db, job_id)
        if done is not None:
            await publish_event(redis, "job.completed", done)
