"""arq job functions for the backup lifecycle — LIFE-05, LIFE-06, LIFE-07.

``run_backup`` / ``run_restore`` mirror ``run_power_action`` from Plan 03-02:

  1. load the jobs row, transition ``pending`` → ``claimed``,
  2. acquire the per-team privsep connector (``registry.get_for_team``),
  3. ``dispatch_and_poll`` — issue the mutating PVE call, persist the UPID
     BEFORE polling (Pitfall 12), poll the task to a terminal state,
  4. audit the outcome on BOTH success and failure (Phase 2 D-20).

``run_backup`` additionally enforces keep-last-N retention on its success path
when the job originated from a schedule (the cron stamps ``scheduled: true`` +
``keep_last`` into the payload — D-08).

``run_backup_delete`` is a direct synchronous delete (no UPID — a storage
content delete is a fast op); it still flows through a job row for Tasks-drawer
consistency.

Each function catches its OWN PVE exceptions so arq never sees one
(``max_tries=1`` — clone/migrate/restore/delete are non-idempotent and must not
silently re-run, D-16).
"""

from __future__ import annotations

import json
import logging

from app.audit.writer import audit_write
from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
from app.jobs.events import publish_event
from app.jobs.functions import _fail_job
from app.jobs.poller import dispatch_and_poll
from app.jobs.service import finish_job, get_job, update_job

logger = logging.getLogger(__name__)


async def run_backup(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.backup`` job — vzdump dispatch + poll + (scheduled) prune.

    On the success path, if the job carries ``scheduled: true`` the keep-last-N
    prune (``prune_backups``) trims the VM's backup files to ``keep_last``
    (D-08). The prune is best-effort — a prune failure does not flip the
    already-succeeded backup job to failed.
    """
    sessionmaker = ctx["sessionmaker"]
    registry = ctx["registry"]
    redis = ctx["redis"]

    # 1. Claim the job.
    async with sessionmaker() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("run_backup: job %s not found", job_id)
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
    storage = payload["storage"]
    mode = payload.get("mode") or "snapshot"
    compress = payload.get("compress") or "zstd"
    scheduled = bool(payload.get("scheduled"))
    keep_last = payload.get("keep_last")
    target_type = "lxc" if is_lxc else "vm"

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
            audit_action="vm.backup", target_type=target_type, vmid=vmid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # 3. Dispatch the vzdump + poll. Catch PVE exceptions so arq never retries.
    async def _dispatch() -> str:
        return await connector.vzdump(
            node=node, vmid=vmid, storage=storage, mode=mode, compress=compress,
        )

    try:
        await dispatch_and_poll(ctx, job, connector, _dispatch)
    except (PVEUnreachable, PVEAPIError, PVEAuthError) as exc:
        from app.lifecycle.errors import map_pve_error

        await _fail_job(
            sessionmaker, redis, job_id,
            raw=str(exc),
            friendly=map_pve_error(str(exc), ""),
            audit_action="vm.backup", target_type=target_type, vmid=vmid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # 4. Audit the outcome (D-20).
    async with sessionmaker() as db:
        final = await get_job(db, job_id)
        result = "success" if (final and final.state == "succeeded") else "failure"
        await audit_write(
            db,
            actor_user_id=job.actor_user_id,
            team_id=job.team_id,
            cluster_id=job.cluster_id,
            action="vm.backup",
            target_type=target_type,
            target_id=str(vmid),
            result=result,
            source_ip=None,
            error=(final.friendly_error or final.error) if final else None,
            payload_after={"job_id": job_id, "state": final.state if final else None},
        )
        await db.commit()
        succeeded = bool(final and final.state == "succeeded")

    # 5. Keep-last-N prune — only on a successful SCHEDULED backup (D-08). The
    #    prune is best-effort; a prune failure must not flip the backup job.
    if succeeded and scheduled and keep_last:
        from app.jobs.backups_cron import prune_backups

        try:
            await prune_backups(
                connector, node=node, storage=storage, vmid=vmid,
                keep_last=int(keep_last),
            )
        except Exception as exc:  # noqa: BLE001 — prune is best-effort.
            logger.warning(
                "keep-last-N prune failed for vmid %s on job %s: %s",
                vmid, job_id, exc,
            )


async def run_restore(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.restore`` job — restore dispatch + poll + audit.

    In-place restores carry ``force: true`` and reuse the source VMID;
    restore-as-new carries a fresh ``newid``. The restore archive is the
    backup file's ``volid``.
    """
    sessionmaker = ctx["sessionmaker"]
    registry = ctx["registry"]
    redis = ctx["redis"]

    # 1. Claim the job.
    async with sessionmaker() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("run_restore: job %s not found", job_id)
            return
        if job.state in {"succeeded", "failed", "needs_review"}:
            return
        await update_job(db, job_id, state="claimed")
        await db.commit()
        job = await get_job(db, job_id)

    payload = json.loads(job.payload)
    node = payload["node"]
    newid = int(payload["newid"])
    is_lxc = bool(payload.get("is_lxc"))
    archive = payload["archive"]
    force = bool(payload.get("force"))
    storage = payload.get("storage")
    target_type = "lxc" if is_lxc else "vm"

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
            audit_action="vm.restore", target_type=target_type, vmid=newid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # 3. Dispatch the restore + poll.
    async def _dispatch() -> str:
        return await connector.restore(
            node=node, vmid=newid, archive=archive, is_lxc=is_lxc,
            force=force, storage=storage,
        )

    try:
        await dispatch_and_poll(ctx, job, connector, _dispatch)
    except (PVEUnreachable, PVEAPIError, PVEAuthError) as exc:
        from app.lifecycle.errors import map_pve_error

        await _fail_job(
            sessionmaker, redis, job_id,
            raw=str(exc),
            friendly=map_pve_error(str(exc), ""),
            audit_action="vm.restore", target_type=target_type, vmid=newid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # 4. Audit the outcome (D-20).
    async with sessionmaker() as db:
        final = await get_job(db, job_id)
        result = "success" if (final and final.state == "succeeded") else "failure"
        await audit_write(
            db,
            actor_user_id=job.actor_user_id,
            team_id=job.team_id,
            cluster_id=job.cluster_id,
            action="vm.restore",
            target_type=target_type,
            target_id=str(newid),
            result=result,
            source_ip=None,
            error=(final.friendly_error or final.error) if final else None,
            payload_after={"job_id": job_id, "state": final.state if final else None},
        )
        await db.commit()


async def run_backup_delete(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.backup.delete`` job — delete one backup file.

    A storage content delete is a fast synchronous op (no UPID), so there is
    no poll loop — the job is marked terminal directly, mirroring
    ``run_resize``'s sync-write pattern.
    """
    sessionmaker = ctx["sessionmaker"]
    registry = ctx["registry"]
    redis = ctx["redis"]

    # 1. Claim the job.
    async with sessionmaker() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("run_backup_delete: job %s not found", job_id)
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
    storage = payload["storage"]
    volid = payload["volid"]
    target_type = "lxc" if is_lxc else "vm"

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
            audit_action="vm.backup.delete", target_type=target_type, vmid=vmid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # 3. Synchronous delete — no UPID, no poll loop.
    from datetime import UTC, datetime

    async with sessionmaker() as db:
        await update_job(
            db, job_id, state="running", started_at=datetime.now(UTC),
        )
        await db.commit()
        running = await get_job(db, job_id)
        if running is not None:
            await publish_event(redis, "job.running", running)

    try:
        await connector.delete_storage_content(
            node=node, storage=storage, volid=volid,
        )
    except (PVEUnreachable, PVEAPIError, PVEAuthError) as exc:
        from app.lifecycle.errors import map_pve_error

        await _fail_job(
            sessionmaker, redis, job_id,
            raw=str(exc),
            friendly=map_pve_error(str(exc), ""),
            audit_action="vm.backup.delete", target_type=target_type, vmid=vmid,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    # 4. Mark succeeded directly, audit, publish.
    async with sessionmaker() as db:
        await finish_job(db, job_id, state="succeeded")
        await audit_write(
            db,
            actor_user_id=job.actor_user_id,
            team_id=job.team_id,
            cluster_id=job.cluster_id,
            action="vm.backup.delete",
            target_type=target_type,
            target_id=str(vmid),
            result="success",
            source_ip=None,
            payload_after={"job_id": job_id, "volid": volid, "state": "succeeded"},
        )
        await db.commit()
        done = await get_job(db, job_id)
        if done is not None:
            await publish_event(redis, "job.completed", done)
