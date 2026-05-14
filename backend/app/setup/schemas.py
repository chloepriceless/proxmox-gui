"""Pydantic schemas for ``/api/v1/setup``.

The schema layer enforces the input invariants up-front so the service
layer can assume a well-shaped payload:

- ``SetupAdminRequest.username`` matches the project-wide convention
  ``^[a-zA-Z0-9_.-]{3,64}$`` (same regex used by Plan 07's user-admin
  ``UserCreate``). Defense-in-depth — the DB UNIQUE constraint also
  catches duplicates.
- ``SetupAdminRequest.password`` has a 12-char floor matching ASVS V2.1 +
  the project's ``PasswordChangeRequest`` floor from Plan 05.
- ``SetupAdminRequest.email`` uses ``EmailStr`` for RFC-5322 surface
  validation.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SetupStatusResponse(BaseModel):
    """``GET /api/v1/setup/status`` response body."""

    no_admin_yet: bool
    cluster_count: int


class SetupAdminRequest(BaseModel):
    """``POST /api/v1/setup/admin`` request body.

    Mirrors :class:`app.users.schemas.UserCreate` (admin variant) with the
    exception that ``is_admin`` is implicitly True and ``team_ids`` is
    forbidden (the wizard creates only the personal team).
    """

    model_config = ConfigDict(extra="forbid")
    username: str = Field(
        min_length=3,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_.-]+$",
    )
    email: EmailStr
    password: str = Field(min_length=12, max_length=512)


class SetupAdminResponse(BaseModel):
    """``POST /api/v1/setup/admin`` 201 response body.

    The frontend (Plan 08 wizard step 2) auto-logs-in after this response,
    so we return only the IDs needed to render the success screen — the
    auth round-trip carries the session cookies.
    """

    user_id: int
    personal_team_id: int
    username: str
