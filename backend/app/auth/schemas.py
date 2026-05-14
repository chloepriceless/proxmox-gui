"""Pydantic request/response schemas for the auth + me routers.

Mapped to plan-doc §interfaces. Field names are deliberately stable because
the SvelteKit frontend (Plan 08+) generates types from the OpenAPI spec — a
rename here ripples into the UI.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Login + me
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    """POST /api/v1/auth/login body."""

    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=512)


class LoginResponse(BaseModel):
    """POST /api/v1/auth/login response body.

    Cookies do the heavy lifting; this body is mostly for the UI to render
    the welcome screen without an extra ``GET /me`` round-trip.
    """

    user_id: int
    username: str
    email: str
    is_admin: bool
    must_change_password: bool = False  # reserved for Phase 5


class TeamSummary(BaseModel):
    """Minimal team representation embedded in ``MeResponse``."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    personal: bool


class MeResponse(BaseModel):
    """GET /api/v1/me/ response body."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    is_admin: bool
    teams: list[TeamSummary]


class RefreshResponse(BaseModel):
    """POST /api/v1/auth/refresh response body — cookies carry the new tokens."""

    refreshed_at: datetime


class LogoutResponse(BaseModel):
    """POST /api/v1/auth/logout response body."""

    message: str = "Logged out"


class PasswordChangeRequest(BaseModel):
    """POST /api/v1/me/password body.

    Min-length 12 matches ASVS V2.1 / CONTEXT D-? (Claude's discretion);
    PasswordChangeResponse is a plain ``{message}`` JSON dict.
    """

    current_password: str = Field(min_length=1, max_length=512)
    new_password: str = Field(min_length=12, max_length=512)
