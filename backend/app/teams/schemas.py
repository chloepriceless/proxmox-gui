"""Pydantic schemas for ``/api/v1/teams``.

D-05 enforcement points:

- :class:`TeamCreate` does NOT accept a ``personal`` field. Combined with
  ``model_config = ConfigDict(extra="forbid")``, posting ``personal=True``
  yields 422.
- :class:`TeamUpdate` accepts ``name`` + ``is_active`` only — no ``personal``,
  no ``created_at``, no ``id``.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TeamCreate(BaseModel):
    """Body for ``POST /api/v1/teams/``.

    ``extra="forbid"`` means any additional field (notably ``personal=True``)
    fails validation with 422. D-05 immutability gate.
    """

    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=128)


class TeamUpdate(BaseModel):
    """Body for ``PATCH /api/v1/teams/{team_id}``."""

    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=128)
    is_active: bool | None = None


class UserSummary(BaseModel):
    """Light-weight user projection for membership listings."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    is_admin: bool
    is_active: bool


class TeamResponse(BaseModel):
    """List/POST projection — includes ``member_count`` (computed)."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    personal: bool
    is_active: bool
    member_count: int = 0
    created_at: datetime
    updated_at: datetime


class TeamDetailResponse(TeamResponse):
    """``GET /api/v1/teams/{id}`` — adds materialised ``members`` list."""

    members: list[UserSummary] = Field(default_factory=list)


class MembershipCreate(BaseModel):
    """Body for ``POST /api/v1/teams/{team_id}/members``."""

    model_config = ConfigDict(extra="forbid")
    user_id: int = Field(ge=1)
