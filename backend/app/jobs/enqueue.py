"""The 202-Accepted enqueue contract (API-04, RESEARCH §Pattern 2).

Every mutating lifecycle route calls :func:`enqueue_job`. It:

1. Computes an idempotency key = ``sha256({kind, actor, payload})[:128]``.
   The actor is part of the hash (T-03-01-02) — a different actor produces a
   different key, so a forged key cannot replay another user's job.
2. Inserts the ``jobs`` row in state ``pending``.
3. ``flush()`` to surface the ``UNIQUE`` collision; on ``IntegrityError`` the
   transaction is rolled back and the in-flight job is returned (a
   double-submit collapses onto the existing job, never a duplicate).
4. ``commit()`` the row — **before** the arq enqueue. This ordering is
   non-negotiable: if the worker picked the job up before the API committed,
   its ``SELECT`` would find nothing. Mirrors the project's
   "commit-before-raise" service-layer discipline (Plan 01-05).
5. Enqueues the arq job (arq job id == DB job id) and returns the ``Job``.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.jobs.service import find_job_by_idempotency_key
from app.models import Job


def _idempotency_key(
    *, kind: str, actor_user_id: int | None, payload: dict[str, Any]
) -> str:
    """sha256 over the sorted (kind, actor, payload) — first 128 hex chars."""
    raw = json.dumps(
        {"kind": kind, "actor": actor_user_id, "payload": payload},
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode()).hexdigest()[:128]


async def enqueue_job(
    db: AsyncSession,
    arq_pool: Any,
    *,
    kind: str,
    cluster_id: int | None,
    team_id: int | None,
    actor_user_id: int | None,
    payload: dict[str, Any],
    batch_id: str | None = None,
) -> Job:
    """Insert a pending job, commit it, enqueue it on arq, and return it.

    On an idempotency-key collision the in-flight job is returned instead of
    a duplicate (the route still answers ``202`` with that job's id).
    """
    idem = _idempotency_key(
        kind=kind, actor_user_id=actor_user_id, payload=payload
    )

    job = Job(
        kind=kind,
        cluster_id=cluster_id,
        team_id=team_id,
        actor_user_id=actor_user_id,
        payload=json.dumps(payload),
        idempotency_key=idem,
        state="pending",
        batch_id=batch_id,
    )
    db.add(job)
    try:
        # Surface the UNIQUE(idempotency_key) collision now.
        await db.flush()
    except IntegrityError:
        await db.rollback()
        existing = await find_job_by_idempotency_key(db, idem)
        if existing is not None:
            return existing
        # Extremely unlikely: collision flagged but the row vanished. Re-raise
        # so the caller surfaces a real error rather than fabricating a job.
        raise

    # COMMIT before enqueue — the worker must be able to SELECT the row.
    await db.commit()

    # arq job id == our DB job id so the worker reads the row immediately.
    await arq_pool.enqueue_job(kind, job.id, _job_id=f"job-{job.id}")
    return job
