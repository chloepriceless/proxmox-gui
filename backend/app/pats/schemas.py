"""Pydantic schemas for /api/v1/me/tokens (PAT CRUD).

The mint response carries the plaintext token exactly once. List responses
return a non-secret ``prefix_preview`` (``pat_<first-8-chars-of-prefix>...``)
so the UI can disambiguate tokens without leaking the full secret.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PATCreate(BaseModel):
    """POST body: friendly name + optional expiry."""

    name: str = Field(min_length=1, max_length=128)
    expires_at: datetime | None = None


class PATMintResponse(BaseModel):
    """POST response — INCLUDES plaintext (show-once)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    expires_at: datetime | None
    plaintext: str  # "pat_..." — the only place this ever appears
    created_at: datetime


class PATListItem(BaseModel):
    """GET list/detail response — NEVER includes plaintext."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    prefix_preview: str  # "pat_<first-8-chars-of-prefix>..."
    expires_at: datetime | None
    last_used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
