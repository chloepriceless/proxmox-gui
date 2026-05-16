"""Jobs API — ``GET /jobs``, ``GET /jobs/{id}``, ``POST /jobs/{id}/retry``.

All three routes are team-scoped (D-01 — the Tasks drawer is team-wide):
the caller's team set comes from ``_team_ids_for_user``.

- ``GET /jobs`` filters by the caller's teams; out-of-team jobs are simply
  absent.
- ``GET /jobs/{id}`` raises 404 for an out-of-team job — the same response
  shape as not-found (don't-leak-existence, matching the project's
  cross-user-404 convention from Plan 01-05).
- ``POST /jobs/{id}/retry`` re-enqueues only *idempotent* job kinds (D-16);
  ``clone`` / ``migrate`` / ``delete`` / ``restore`` are destructive /
  non-idempotent and are rejected 409. The job must also be in state
  ``failed``.

Route order: the static ``/jobs`` collection path is declared before the
``/jobs/{job_id}`` parameterised path so FastAPI's order-sensitive matcher
resolves them unambiguously.
"""

from __future__ import annotations

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.core.db import get_db
from app.inventory.access import _team_ids_for_user
from app.jobs import service
from app.jobs.schemas import JobListResponse, JobResponse

router = APIRouter()

#: Job kinds whose retry is safe to auto-re-enqueue (D-16).
#:
#: ``vm.power`` covers start/stop/reboot/shutdown — all idempotent. The other
#: members map to the resize / snapshot-delete / backup operations later plans
#: add. ``vm.delete`` (destructive), ``vm.clone`` / ``vm.migrate`` /
#: ``vm.restore`` (non-idempotent) are deliberately EXCLUDED — retrying them
#: could duplicate a VM or corrupt state, so the UI must re-issue them from a
#: form instead.
IDEMPOTENT_KINDS = frozenset(
    {"vm.power", "vm.snapshot.delete", "vm.resize", "vm.backup"}
)


def _serialize(job) -> JobResponse:  # noqa: ANN001
    return JobResponse.model_validate(job)


@router.get(
    "/jobs",
    response_model=JobListResponse,
    summary="List jobs scoped to the caller's teams",
    operation_id="jobs_list",
)
async def jobs_list(
    state: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobListResponse:
    team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    jobs = await service.list_jobs(db, team_ids, limit=limit, state=state)
    running = sum(1 for j in jobs if j.state in {"pending", "claimed", "running"})
    failed = sum(1 for j in jobs if j.state in {"failed", "needs_review"})
    return JobListResponse(
        jobs=[_serialize(j) for j in jobs], running=running, failed=failed
    )


@router.get(
    "/jobs/{job_id}",
    response_model=JobResponse,
    summary="Get one job (team-scoped — 404 if out of the caller's teams)",
    operation_id="jobs_get",
)
async def jobs_get(
    job_id: int,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobResponse:
    job = await service.get_job(db, job_id)
    team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    # Don't-leak-existence: an out-of-team job answers with the same 404 as a
    # genuinely missing job (Plan 01-05 cross-user-404 convention).
    if job is None or (job.team_id is not None and job.team_id not in team_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found"
        )
    return _serialize(job)


@router.post(
    "/jobs/{job_id}/retry",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Retry a failed job — idempotent kinds only",
    operation_id="jobs_retry",
    dependencies=[Depends(csrf_protect)],
)
async def jobs_retry(
    job_id: int,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JobResponse:
    job = await service.get_job(db, job_id)
    team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    if job is None or (job.team_id is not None and job.team_id not in team_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found"
        )

    # D-16: only idempotent kinds may be auto-retried.
    if job.kind not in IDEMPOTENT_KINDS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This operation type cannot be retried automatically — "
                "re-issue it from the form."
            ),
        )
    if job.state != "failed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a failed job can be retried.",
        )

    # Re-arm the SAME row (UI-SPEC: "re-uses its identity, does not spawn a
    # second visible row"): reset to pending and clear the last attempt's
    # UPID / error / finish fields.
    job.state = "pending"
    job.upid = None
    job.upid_node = None
    job.error = None
    job.friendly_error = None
    job.finished_at = None
    job.started_at = None
    await db.commit()

    arq_pool = getattr(request.app.state, "arq_pool", None)
    if arq_pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The job queue is unavailable; try again shortly.",
        )
    # A fresh arq job id — the original ``job-{id}`` arq key may still linger;
    # the DB row identity is reused, only the arq dispatch key is new.
    await arq_pool.enqueue_job(
        job.kind, job.id, _job_id=f"job-{job.id}-retry-{uuid4().hex[:8]}"
    )

    refreshed = await service.get_job(db, job_id)
    return _serialize(refreshed)
