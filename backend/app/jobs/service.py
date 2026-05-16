"""Job-row CRUD + state transitions.

Transaction discipline (audit/writer.py): every function FLUSHES; the caller
owns the commit. The worker's job functions / the enqueue helper commit at the
right point — see ``enqueue.py`` for the commit-before-enqueue rule.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Job


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def get_job(db: AsyncSession, job_id: int) -> Job | None:
    """Return the job row by id (or None)."""
    return await db.get(Job, job_id)


async def list_jobs(
    db: AsyncSession,
    team_ids: list[int],
    *,
    limit: int = 50,
    state: str | None = None,
) -> list[Job]:
    """Team-scoped job list, newest-first (D-01 — team-wide drawer scope)."""
    stmt = select(Job).order_by(Job.created_at.desc(), Job.id.desc())
    if team_ids:
        stmt = stmt.where(Job.team_id.in_(team_ids))
    if state is not None:
        stmt = stmt.where(Job.state == state)
    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_recent_jobs(
    db: AsyncSession, team_ids: list[int], *, limit: int = 50
) -> list[Job]:
    """Recent team-scoped jobs for the WebSocket reconnect backfill."""
    return await list_jobs(db, team_ids, limit=limit)


async def find_job_by_idempotency_key(
    db: AsyncSession, key: str
) -> Job | None:
    """Look up the in-flight job that owns ``key`` (idempotency dedup)."""
    result = await db.execute(
        select(Job).where(Job.idempotency_key == key)
    )
    return result.scalar_one_or_none()


async def select_jobs(db: AsyncSession, states: list[str]) -> list[Job]:
    """Reaper helper — every job whose state is in ``states``."""
    result = await db.execute(select(Job).where(Job.state.in_(states)))
    return list(result.scalars().all())


async def update_job(db: AsyncSession, job_id: int, **fields: object) -> Job | None:
    """Apply ``fields`` to the job row and flush. Caller owns the commit."""
    job = await db.get(Job, job_id)
    if job is None:
        return None
    for key, value in fields.items():
        setattr(job, key, value)
    await db.flush()
    return job


async def finish_job(
    db: AsyncSession,
    job_id: int,
    *,
    state: str,
    error: str | None = None,
    friendly: str | None = None,
    log: str | None = None,  # noqa: ARG001 — accepted for caller symmetry
) -> Job | None:
    """Mark a job terminal — sets ``finished_at`` + error/friendly fields.

    ``log`` is accepted (the poller passes the task-log tail) but not stored
    on the row directly in Plan 01 — downstream plans may persist it.
    """
    job = await db.get(Job, job_id)
    if job is None:
        return None
    job.state = state
    job.finished_at = _utcnow()
    if error is not None:
        job.error = error
    if friendly is not None:
        job.friendly_error = friendly
    await db.flush()
    return job
