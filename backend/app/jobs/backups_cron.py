"""Scheduled-backup arq cron + keep-last-N retention prune — LIFE-06, D-08.

RESEARCH §"Scheduled Backups" recommends the app-side arq cron (path 2): a
``backup_schedules`` table, an arq ``cron`` job every 5 minutes that fires due
``vm.backup`` jobs, and keep-last-N retention enforced app-side. This module
holds both halves:

- :func:`fire_due_scheduled_backups` — the cron entry point. It queries enabled
  ``BackupSchedule`` rows, computes due-ness from ``frequency`` + ``last_run_at``
  (daily ≥ 24h, weekly ≥ 7d), enqueues a ``vm.backup`` job per due schedule
  (stamping ``scheduled: true`` + ``keep_last`` into the payload), and updates
  ``last_run_at``.
- :func:`prune_backups` — the retention helper. After a scheduled backup job
  succeeds, ``run_backup`` calls this to list the VM's backup files sorted by
  ``ctime`` and delete the oldest beyond ``keep_last`` (D-08 — simple
  keep-last-N; PVE's full prune model is the deferred enhancement).

The scheduled-backup cron jobs carry the schedule's ``team_id`` so the audit
trail attributes them (T-03-04-08).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select

from app.jobs.enqueue import enqueue_job
from app.models import BackupSchedule, Cluster

logger = logging.getLogger(__name__)

# Due-ness windows per frequency.
_FREQUENCY_INTERVALS = {
    "daily": timedelta(days=1),
    "weekly": timedelta(weeks=1),
}


def _is_due(schedule: BackupSchedule, *, now: datetime) -> bool:
    """True when ``schedule`` is due to run as of ``now``.

    A schedule that has never run (``last_run_at is None``) is always due.
    Otherwise it is due when ``now - last_run_at`` has reached the
    frequency's interval.
    """
    interval = _FREQUENCY_INTERVALS.get(schedule.frequency)
    if interval is None:
        # Unknown frequency — never auto-fire (defensive).
        return False
    last = schedule.last_run_at
    if last is None:
        return True
    # last_run_at may be naive (SQLite) — treat as UTC.
    if last.tzinfo is None:
        last = last.replace(tzinfo=UTC)
    return (now - last) >= interval


async def fire_due_scheduled_backups(ctx: dict) -> None:
    """arq cron — enqueue a ``vm.backup`` job for every enabled, due schedule.

    Runs every 5 minutes (see ``WorkerSettings.cron_jobs``). For each due
    schedule it enqueues a ``vm.backup`` job (carrying ``scheduled: true`` +
    ``keep_last`` so ``run_backup`` prunes after success) and stamps
    ``last_run_at`` so the schedule is not re-fired until the next window.
    """
    sessionmaker = ctx["sessionmaker"]
    arq_pool = ctx.get("arq_pool") or ctx.get("redis")
    now = datetime.now(UTC)

    async with sessionmaker() as db:
        schedules = (await db.execute(
            select(BackupSchedule).where(BackupSchedule.enabled.is_(True))
        )).scalars().all()

        for schedule in schedules:
            if not _is_due(schedule, now=now):
                continue
            cluster = await db.get(Cluster, schedule.cluster_id)
            storage = getattr(cluster, "backup_storage", None) if cluster else None
            if not storage:
                # D-08 — no designated storage; skip and leave last_run_at so
                # the schedule retries next window once an admin sets one.
                logger.warning(
                    "scheduled backup for vmid %s skipped — cluster %s has no "
                    "backup_storage", schedule.vmid, schedule.cluster_id,
                )
                continue

            payload = {
                "node": schedule.node,
                "vmid": schedule.vmid,
                "is_lxc": schedule.is_lxc,
                "storage": str(storage),
                "mode": "snapshot",
                "compress": "zstd",
                "scheduled": True,
                "keep_last": schedule.keep_last,
            }
            try:
                await enqueue_job(
                    db,
                    arq_pool,
                    kind="vm.backup",
                    cluster_id=schedule.cluster_id,
                    team_id=schedule.team_id,
                    actor_user_id=None,
                    payload=payload,
                )
            except Exception as exc:  # noqa: BLE001 — one bad schedule must
                # not stop the rest of the sweep.
                logger.error(
                    "failed to enqueue scheduled backup for vmid %s: %s",
                    schedule.vmid, exc,
                )
                continue

            # Stamp last_run_at so the schedule is not re-fired this window.
            schedule.last_run_at = now
            schedule.last_run_state = "enqueued"
            await db.flush()

        await db.commit()


async def prune_backups(
    connector: Any,
    *,
    node: str,
    storage: str,
    vmid: int,
    keep_last: int,
) -> int:
    """Delete the VM's backup files beyond ``keep_last`` (oldest-first).

    D-08 keep-last-N retention. Lists the VM's backup files via the storage
    content API, sorts by ``ctime`` ascending, and deletes everything before
    the most-recent ``keep_last`` entries. Returns the count deleted.

    RESEARCH A6 — the volid format / per-VM enumerability is standard PVE; the
    storage content API returns one row per backup file with a ``volid`` and a
    ``ctime``.
    """
    if keep_last < 1:
        return 0
    files = await connector.storage_content(
        node=node, storage=storage, content="backup", vmid=vmid,
    )
    # Sort oldest-first by ctime (treat a missing ctime as 0 → oldest).
    ordered = sorted(files or [], key=lambda f: int(f.get("ctime") or 0))
    if len(ordered) <= keep_last:
        return 0
    stale = ordered[: len(ordered) - keep_last]
    deleted = 0
    for f in stale:
        volid = f.get("volid")
        if not volid:
            continue
        try:
            await connector.delete_storage_content(
                node=node, storage=storage, volid=str(volid),
            )
            deleted += 1
        except Exception as exc:  # noqa: BLE001 — best-effort per file.
            logger.warning(
                "keep-last-N prune failed to delete %s: %s", volid, exc,
            )
    return deleted
