"""Pydantic schemas for the jobs API + the pub/sub serialization helper.

Field conventions copied from ``app/inventory/schemas.py`` (ConfigDict +
``from_attributes``).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import Job


class JobResponse(BaseModel):
    """One job row as returned by the jobs API + the WebSocket stream."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    state: str
    cluster_id: int | None = None
    team_id: int | None = None
    upid: str | None = None
    upid_node: str | None = None
    error: str | None = None
    friendly_error: str | None = None
    batch_id: str | None = None
    created_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class JobListResponse(BaseModel):
    """The jobs collection plus running/failed counts for the Topbar badge."""

    model_config = ConfigDict(from_attributes=True)

    jobs: list[JobResponse]
    running: int = 0
    failed: int = 0


def serialize_job(job: Job) -> dict:
    """Return a JSON-safe dict snapshot of a Job row.

    Used by ``events.py`` for pub/sub payloads — datetimes are ISO strings
    so ``json.dumps`` never needs a custom encoder.
    """

    def _iso(value: datetime | None) -> str | None:
        return value.isoformat() if value is not None else None

    return {
        "id": job.id,
        "kind": job.kind,
        "state": job.state,
        "cluster_id": job.cluster_id,
        "team_id": job.team_id,
        "upid": job.upid,
        "upid_node": job.upid_node,
        "error": job.error,
        "friendly_error": job.friendly_error,
        "batch_id": job.batch_id,
        "created_at": _iso(job.created_at),
        "started_at": _iso(job.started_at),
        "finished_at": _iso(job.finished_at),
    }
