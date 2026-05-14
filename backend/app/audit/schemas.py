"""Pydantic schemas for the audit log API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuditEntry(BaseModel):
    """One row in the audit log, projected for API consumption."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    occurred_at: datetime
    actor_username: str | None  # joined from users.username; None for system events
    actor_pat_prefix: str | None  # PAT lookup_prefix if actor_pat_id is set
    team_name: str | None  # joined from teams.name
    cluster_name: str | None  # joined from clusters.name
    action: str
    target_type: str | None
    target_id: str | None
    result: str
    source_ip: str | None
    correlation_id: str | None
    payload_before: str | None  # JSON string; client decodes
    payload_after: str | None
    error: str | None


class AuditFilter(BaseModel):
    """Query parameters for GET /audit and /audit/export.csv."""

    model_config = ConfigDict(extra="forbid")

    from_: datetime | None = Field(default=None, alias="from")
    to: datetime | None = None
    action: list[str] | None = None  # comma-split by route
    user_id: int | None = None
    target_type: list[str] | None = None  # comma-split by route
    vmid: int | None = None
    cluster_id: int | None = None
    show_team_actions: bool = False


class AuditPage(BaseModel):
    """Paginated list payload."""

    model_config = ConfigDict(from_attributes=True)

    rows: list[AuditEntry]
    total: int
    page: int
    page_size: int
