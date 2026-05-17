"""The 202-Accepted enqueue contract (API-04, RESEARCH §Pattern 2).

Every mutating lifecycle route calls :func:`enqueue_job`. It:

1. Computes an idempotency key = ``sha256({kind, actor, payload})``.
   The actor is part of the hash (T-03-01-02) — a different actor produces a
   different key, so a forged key cannot replay another user's job.
2. Inserts the ``jobs`` row in state ``pending``.
3. ``flush()`` to surface the ``UNIQUE`` collision. A collision returns the
   existing job ONLY while it is still in-flight (pending/claimed/running) —
   the genuine double-submit case. If the colliding job has already finished,
   the action is being deliberately re-issued (e.g. stopping a VM a second
   time) — the probe walks to the next free ``key#N`` slot so a fresh row is
   created. The DB UNIQUE constraint keeps that walk race-safe.
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

#: A job in one of these states is still progressing — a second submit of the
#: same logical operation collapses onto it (genuine double-submit dedup). A
#: job in ANY other state (succeeded/failed/orphaned/needs_review) has finished,
#: so re-issuing the action is a new operation and gets its own row.
_IN_FLIGHT_STATES = ("pending", "claimed", "running")

#: Hard cap on the re-issue probe so a pathological key space cannot spin
#: forever. 64 distinct runs of the exact same action far exceeds any real use.
_MAX_REISSUE_ATTEMPTS = 64


def _idempotency_key(
    *, kind: str, actor_user_id: int | None, payload: dict[str, Any]
) -> str:
    """sha256 hexdigest over the sorted (kind, actor, payload) — 64 hex chars."""
    raw = json.dumps(
        {"kind": kind, "actor": actor_user_id, "payload": payload},
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode()).hexdigest()


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

    Idempotency: a collision on the ``(kind, actor, payload)`` key returns the
    existing job ONLY while that job is still in-flight — the genuine
    double-submit case. Once the prior job has finished, re-issuing the same
    action (e.g. stopping a VM again) is a NEW operation: the probe walks to
    the next free ``key#N`` slot and a fresh row is created. The DB UNIQUE
    constraint keeps the walk race-safe — two concurrent re-issues land on the
    same ``key#N``, one inserts and the other sees it in-flight and dedups.
    """
    base = _idempotency_key(
        kind=kind, actor_user_id=actor_user_id, payload=payload
    )

    attempt = 0
    while True:
        # attempt 0 is the canonical key; later attempts probe key#1, key#2, …
        # walking past already-finished runs of the same action.
        key = base if attempt == 0 else f"{base}#{attempt}"
        job = Job(
            kind=kind,
            cluster_id=cluster_id,
            team_id=team_id,
            actor_user_id=actor_user_id,
            payload=json.dumps(payload),
            idempotency_key=key,
            state="pending",
            batch_id=batch_id,
        )
        db.add(job)
        try:
            # Surface the UNIQUE(idempotency_key) collision now.
            await db.flush()
            break
        except IntegrityError:
            await db.rollback()
            existing = await find_job_by_idempotency_key(db, key)
            if existing is not None and existing.state in _IN_FLIGHT_STATES:
                # A genuine double-submit of a still-running operation —
                # collapse onto it (the route still answers 202 with its id).
                return existing
            # The colliding job has already finished (or the row vanished):
            # this is a deliberate re-issue — probe the next slot.
            attempt += 1
            if attempt > _MAX_REISSUE_ATTEMPTS:
                raise

    # COMMIT before enqueue — the worker must be able to SELECT the row.
    await db.commit()

    # arq job id == our DB job id so the worker reads the row immediately.
    await arq_pool.enqueue_job(kind, job.id, _job_id=f"job-{job.id}")
    return job
