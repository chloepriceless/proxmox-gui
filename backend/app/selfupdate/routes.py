"""``POST /api/v1/admin/self-update`` — 202-enqueue self-update (DEPLOY-04).

Admin-gated, CSRF-protected, returns 202 with a ``job_id`` so the caller can
subscribe via the existing Tasks-drawer infrastructure (the worker's
``run_self_update`` job updates the same ``jobs`` row state machine the
Tasks drawer already polls).

Pattern: mirrors :mod:`app.jobs.routes` ``jobs_retry`` — the 202-Accepted
enqueue contract with ``arq_pool = getattr(request.app.state, "arq_pool", None)``
and a 503 fallback when Redis is unreachable.

Why a ``jobs`` row instead of a bare arq enqueue: RESEARCH §Pattern 5 favours
job-row visibility — the Tasks drawer renders one consistent row across
``pending`` → ``running`` → terminal, and the rollback path writes
``failed`` / ``needs_review`` against the same id.
"""

from __future__ import annotations

import json
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    Principal,
    csrf_protect,
    get_current_principal,
    require_admin,
)
from app.core.db import get_db
from app.models import Job
from app.selfupdate.schemas import SelfUpdateRequest, SelfUpdateResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/",
    response_model=SelfUpdateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger a self-update — admin-only, 202-enqueue (DEPLOY-04)",
    operation_id="self_update_start",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def self_update_start(
    request: Request,
    payload: SelfUpdateRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SelfUpdateResponse:
    """Enqueue a ``admin.self-update`` job and return its id.

    The job runs in the WORKER process (a separate systemd unit) — the API
    restart in step 5 of the update sequence (RESEARCH §Pattern 5) kills the
    API but leaves the worker, so the auto-rollback path can still run on a
    failed health check (Pitfall 2 / Threat T-05-04-08).
    """
    arq_pool = getattr(request.app.state, "arq_pool", None)
    if arq_pool is None:
        # Mirror jobs_retry's 503 fallback — the job queue is down.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The job queue is unavailable; try again shortly.",
        )

    # Build the job row directly (no enqueue_job — self-update is a system
    # operation, not a tenant op, so it carries no cluster_id / team_id and
    # the idempotency-key contract of enqueue_job does not apply). Two
    # consecutive admin clicks DO produce two rows — that is intentional:
    # the second job sees the first's symlink already swapped and either
    # no-ops or runs onto the same release (the worker has max_tries=1, so
    # arq never re-runs the SAME row).
    job_payload = {
        "target_version": payload.target_version,
        # Stamp the actor on the payload too so audit-tooling can reconstruct
        # who clicked the button without joining to the users table.
        "triggered_by_user_id": principal.user.id,
    }
    job = Job(
        kind="admin.self-update",
        cluster_id=None,
        team_id=None,
        actor_user_id=principal.user.id,
        payload=json.dumps(job_payload),
        state="pending",
        idempotency_key=None,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Enqueue AFTER commit (the worker must be able to SELECT the row).
    await arq_pool.enqueue_job(
        "admin.self-update", job.id, _job_id=f"job-{job.id}-{uuid4().hex[:8]}"
    )

    logger.info(
        "self-update enqueued by user_id=%s job_id=%s target_version=%s",
        principal.user.id, job.id, payload.target_version,
    )
    return SelfUpdateResponse(job_id=job.id)
