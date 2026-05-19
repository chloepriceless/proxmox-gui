"""Pydantic request/response schemas for ``/api/v1/admin/settings``.

``SettingsUpdate`` is the PATCH body — every field is Optional so a partial
update only touches the keys the admin actually sent (distinguished via
``model_dump(exclude_unset=True)``). ``SettingsResponse`` is the read shape,
populated straight off the :class:`app.models.AppSetting` ORM row.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SettingsUpdate(BaseModel):
    """PATCH body — all fields Optional, bounded to sane ranges.

    ``idle_timeout_minutes`` is bounded ``ge=1`` (0 would mean instant logout)
    and ``le=1440`` (24h). ``audit_retention_days`` is bounded ``ge=1`` and
    ``le=3650`` (10 years). Threat T-05-01-06: the bounds keep an admin from
    setting an absurd value.
    """

    idle_timeout_minutes: int | None = Field(default=None, ge=1, le=1440)
    audit_retention_days: int | None = Field(default=None, ge=1, le=3650)


class SettingsResponse(BaseModel):
    """Read shape for GET / PATCH responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    idle_timeout_minutes: int
    audit_retention_days: int
    updated_at: datetime
