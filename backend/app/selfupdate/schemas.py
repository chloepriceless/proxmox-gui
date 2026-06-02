"""Pydantic schemas for the self-update API (DEPLOY-04, plan 05-04).

Two payloads:

- :class:`SelfUpdateRequest` — POST body. ``target_version`` is optional; when
  omitted the worker fetches the manifest for ``latest``.
- :class:`SelfUpdateResponse` — the 202 body; carries the ``job_id`` so the
  caller can subscribe to the Tasks-drawer feed and watch the update progress.

V5 input validation (Threat T-05-04-X carryover): the ``target_version``
string is interpolated into a URL the worker fetches, so anything that is not
a clean semver tag is rejected here at the schema layer — never at the URL
layer.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

#: A semver-ish tag string: optional ``v`` prefix, then ``MAJOR.MINOR.PATCH``
#: with optional ``-pre.N`` / ``+build.N`` (PEP 440 / SemVer 2.0 hybrid). The
#: regex deliberately rejects spaces, ``..``, shell metacharacters and any
#: byte outside ``[A-Za-z0-9.+-]`` — the string is going into an HTTPS URL.
_TAG_RE = re.compile(r"^v?\d+(?:\.\d+){0,2}(?:[-+][A-Za-z0-9.]+)?$")


class SelfUpdateRequest(BaseModel):
    """POST body for ``POST /api/v1/admin/self-update``."""

    model_config = ConfigDict(extra="forbid")

    target_version: str | None = Field(
        default=None,
        min_length=1,
        max_length=64,
        description=(
            "Optional semver tag (e.g. 'v0.5.0'). When omitted, the worker "
            "fetches the manifest for the latest tagged release."
        ),
    )

    @field_validator("target_version")
    @classmethod
    def _validate_tag(cls, value: str | None) -> str | None:
        """Reject anything that is not a clean tag string (V5)."""
        if value is None:
            return value
        if not _TAG_RE.match(value):
            raise ValueError(
                "target_version must be a semver tag (e.g. 'v0.5.0'); "
                "got an unexpected character."
            )
        return value


class SelfUpdateResponse(BaseModel):
    """202 body — the caller subscribes to ``job_id`` on the Tasks drawer."""

    model_config = ConfigDict(extra="forbid")

    job_id: int = Field(
        description="The arq job row id; subscribe to it on the Tasks drawer."
    )
