"""Pydantic schemas for /api/v1/me/ssh-keys."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SshKeyCreate(BaseModel):
    """POST body: a friendly name + the OpenSSH public-key text."""

    name: str = Field(min_length=1, max_length=128)
    public_key: str = Field(min_length=1, max_length=8192)


class SshKeyResponse(BaseModel):
    """List/post response — never includes the full ``public_key``."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    fingerprint: str
    created_at: datetime


class SshKeyDetailResponse(SshKeyResponse):
    """GET-by-id response — includes the full normalised key text."""

    public_key: str
