"""Pydantic schemas for ``/api/v1/users`` (admin user CRUD).

Schema-layer invariants:

- ``UserCreate.username`` matches ``^[a-zA-Z0-9_.-]{3,64}$`` (mirrors
  :class:`app.setup.schemas.SetupAdminRequest`).
- ``UserCreate.password`` and ``AdminPasswordRequest.new_password`` floor
  at 12 chars (ASVS V2.1).
- ``UserUpdate`` uses ``model_dump(exclude_unset=True)`` semantics — only
  fields explicitly present are applied. ``team_ids`` has REPLACE
  semantics on the non-personal subset.

The list response (:class:`UserResponse`) embeds a thin ``TeamSummary``
projection; the detail response (:class:`UserDetailResponse`) reuses the
same — there is no extra information to surface in v1 (``last_login`` is
deferred to Phase 2's audit-driven last-login).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------------------------------------------------------------------------
# Embedded projections
# ---------------------------------------------------------------------------


class TeamSummary(BaseModel):
    """Minimal team representation for membership lists."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    personal: bool


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    """``POST /api/v1/users/`` body."""

    model_config = ConfigDict(extra="forbid")
    username: str = Field(
        min_length=3,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_.-]+$",
    )
    email: EmailStr
    password: str = Field(min_length=12, max_length=512)
    is_admin: bool = False
    team_ids: list[int] | None = Field(
        default=None,
        description=(
            "Optional list of shared-team IDs to add the new user to. "
            "Personal teams are rejected — D-05."
        ),
    )


class UserUpdate(BaseModel):
    """``PATCH /api/v1/users/{user_id}`` body.

    All fields optional — pydantic's ``model_dump(exclude_unset=True)``
    drives field-by-field application in the service layer.
    """

    model_config = ConfigDict(extra="forbid")
    email: EmailStr | None = None
    is_admin: bool | None = None
    is_active: bool | None = None
    team_ids: list[int] | None = Field(
        default=None,
        description=(
            "If present, REPLACES the user's non-personal team memberships "
            "with this list. Personal-team membership is preserved."
        ),
    )


class AdminPasswordRequest(BaseModel):
    """``POST /api/v1/users/{user_id}/password`` body — admin password reset."""

    model_config = ConfigDict(extra="forbid")
    new_password: str = Field(min_length=12, max_length=512)


class MembershipAdd(BaseModel):
    """``POST /api/v1/users/{user_id}/teams`` body."""

    model_config = ConfigDict(extra="forbid")
    team_id: int = Field(ge=1)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


class UserResponse(BaseModel):
    """``GET /api/v1/users/`` list element + ``GET /{id}`` detail."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    is_admin: bool
    is_active: bool
    created_at: datetime
    teams: list[TeamSummary] = Field(default_factory=list)


class UserCreateResponse(UserResponse):
    """``POST /api/v1/users/`` 201 response — adds the personal team id.

    Plan 08's admin Users page renders the new row immediately after a
    create; surfacing the personal-team id removes a follow-up GET.
    """

    personal_team_id: int


class UserDetailResponse(UserResponse):
    """``GET /api/v1/users/{user_id}`` — currently identical to UserResponse.

    ``last_login`` field is deferred to Phase 2 (audit-driven).
    """

    last_login: datetime | None = None
