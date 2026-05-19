"""Audit-log retention/rotation arq cron (AUDIT-06, plan 05-03 — D-06/D-07).

Nightly cron entry point. On each run:

1. Read ``audit_retention_days`` from the ``app_setting`` table (fresh — the
   worker process never touches the API's settings cache; RESEARCH §Pattern 3).
2. Compute ``cutoff = now - timedelta(days=retention_days)`` and select every
   ``audit_log`` row where ``occurred_at < cutoff``, joined to user / team /
   cluster names the same way ``audit_csv_stream`` does (unscoped — no RBAC
   predicate; the archive is the unscoped compliance dump).
3. Write a ``.csv.gz`` archive of those rows via
   :func:`app.audit.archive.write_audit_archive` — header + format come from
   the shared ``audit_header_row`` / ``audit_row`` helpers so the archive
   layout matches the user-facing export exactly.
4. ONLY AFTER the archive file is closed and durable, ``DELETE FROM audit_log
   WHERE occurred_at < cutoff`` and commit. The write-then-delete ordering
   (Threat T-05-03-03) means a crash between archive and delete leaves rows
   un-archived but never silently lost; a subsequent run will pick them up.

System action — the cron carries NO ``team_id``. The body is wrapped in a
defensive try/except so a single bad run logs an error rather than crashing
the worker (a downed worker stops every job, not just this cron).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from app.audit.archive import write_audit_archive
from app.models import AuditLog, Cluster, Team, User
from app.settings.service import get_setting

logger = logging.getLogger(__name__)


async def roll_audit_log(ctx: dict) -> None:
    """Nightly audit-retention cron (AUDIT-06).

    Registered in ``WorkerSettings.cron_jobs`` by plan 05-01 (``cron(roll_audit_log,
    hour={3}, minute={0})``). Idempotent across crashes: if the archive
    write succeeds and the delete fails, the next run rolls the same rows
    again (a small amount of duplicate archive output, never data loss).
    """
    sessionmaker = ctx["sessionmaker"]
    try:
        async with sessionmaker() as db:
            retention_days = await get_setting(db, "audit_retention_days")
            cutoff = datetime.now(UTC) - timedelta(days=retention_days)
            # SQLite strips tzinfo on store — compare against a naive UTC value.
            naive_cutoff = cutoff.replace(tzinfo=None)

            # Unscoped select — same shape as audit_csv_stream so audit_row
            # formats every row consistently. NO RBAC predicate (T-05-03-02 —
            # the archive is the unscoped compliance dump; the route layer
            # gates access via require_admin).
            stmt = (
                select(
                    AuditLog.occurred_at,
                    AuditLog.action,
                    AuditLog.target_type,
                    AuditLog.target_id,
                    AuditLog.result,
                    AuditLog.source_ip,
                    AuditLog.correlation_id,
                    AuditLog.error,
                    User.username,
                    Team.name,
                    Cluster.name,
                )
                .outerjoin(User, AuditLog.actor_user_id == User.id)
                .outerjoin(Team, AuditLog.team_id == Team.id)
                .outerjoin(Cluster, AuditLog.cluster_id == Cluster.id)
                .where(AuditLog.occurred_at < naive_cutoff)
                .order_by(AuditLog.occurred_at.asc(), AuditLog.id.asc())
            )
            rows = (await db.execute(stmt)).all()
            if not rows:
                return

            # Compute the file's date range from the actual data.
            from_dt = rows[0][0]
            to_dt = rows[-1][0]
            if from_dt.tzinfo is None:
                from_dt = from_dt.replace(tzinfo=UTC)
            if to_dt.tzinfo is None:
                to_dt = to_dt.replace(tzinfo=UTC)

            # Step 1 — write the archive. This BLOCKS until gzip.open's context
            # manager closes the file (every byte is durable in the page cache).
            archive_path = write_audit_archive(rows, from_dt=from_dt, to_dt=to_dt)
            logger.info(
                "audit retention: archived %d rows to %s (cutoff=%s)",
                len(rows), archive_path, naive_cutoff,
            )

            # Step 2 — ONLY AFTER the archive is durable, delete the rolled rows
            # (write-then-delete ordering, T-05-03-03).
            await db.execute(
                delete(AuditLog).where(AuditLog.occurred_at < naive_cutoff)
            )
            await db.commit()
    except Exception as exc:  # noqa: BLE001 — a bad run must not crash the worker.
        logger.error("roll_audit_log failed: %s", exc, exc_info=True)
