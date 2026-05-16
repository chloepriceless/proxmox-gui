"""Pydantic request/response schemas for ``/api/v1/clusters``.

The token field (``api_token_secret``) is write-only — it appears in
``ClusterCreate`` / ``ClusterUpdate`` / ``ClusterTestRequest`` but NEVER on
:class:`ClusterResponse`. T-01-06-01 mitigation; verified by
``test_get_clusters_never_returns_decrypted_token``.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Sentinel for the nullable-clearable PATCH field pattern (Phase 1 IN-03
# carryover). ``backup_storage`` must be distinguishable between "absent from
# the request body" (leave unchanged) and "explicitly set to null" (clear the
# admin designation — UI-SPEC "None — backups disabled"). A plain
# ``str | None = None`` field cannot tell those apart; ``Unset`` does.
_UNSET = "__unset__"

# Realm-qualified user format: ``name@pam`` or ``name@pve`` (PVE basic shape).
# Permissive on the name part — PVE accepts letters, digits, ``.-_``.
_TOKEN_USER_RE = re.compile(r"^[A-Za-z0-9._@-]+@(pam|pve)$")


def _reject_url_in_host(value: str) -> str:
    """Validator: ``host`` must be a bare hostname / IP, not a URL.

    Operators frequently paste ``https://pve.example.com`` from the browser
    address bar. proxmoxer is happy with that on success but the result is
    confusing — and a hidden ``/path`` would silently break. Reject early.
    """
    if value.startswith(("http://", "https://", "ws://", "wss://")):
        raise ValueError("Use bare hostname or IP, not a URL (no http:// prefix)")
    return value


# ----------------------------------------------------------------------------
# Create / Update / Response
# ----------------------------------------------------------------------------


class ClusterCreate(BaseModel):
    """Request body for ``POST /api/v1/clusters/``."""

    name: str = Field(min_length=1, max_length=128)
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=8006, ge=1, le=65535)
    verify_ssl: bool = True
    token_user: str = Field(min_length=1, max_length=128)
    token_name: str = Field(min_length=1, max_length=64)
    api_token_secret: str = Field(min_length=1)
    tls_fingerprint: str | None = Field(default=None, max_length=255)
    notes: str | None = None

    @field_validator("host")
    @classmethod
    def _validate_host(cls, v: str) -> str:
        return _reject_url_in_host(v)

    @field_validator("token_user")
    @classmethod
    def _validate_token_user(cls, v: str) -> str:
        if not _TOKEN_USER_RE.match(v):
            raise ValueError(
                "token_user must be of the form name@pam or name@pve"
            )
        return v


class ClusterTestRequest(BaseModel):
    """Request body for ``POST /api/v1/clusters/test`` (dry-run, no DB write).

    Same shape as :class:`ClusterCreate` minus the persisted-only fields
    (``name``, ``notes``).
    """

    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=8006, ge=1, le=65535)
    verify_ssl: bool = True
    token_user: str = Field(min_length=1, max_length=128)
    token_name: str = Field(min_length=1, max_length=64)
    api_token_secret: str = Field(min_length=1)
    tls_fingerprint: str | None = Field(default=None, max_length=255)

    @field_validator("host")
    @classmethod
    def _validate_host(cls, v: str) -> str:
        return _reject_url_in_host(v)

    @field_validator("token_user")
    @classmethod
    def _validate_token_user(cls, v: str) -> str:
        if not _TOKEN_USER_RE.match(v):
            raise ValueError(
                "token_user must be of the form name@pam or name@pve"
            )
        return v


class ClusterTestResponse(BaseModel):
    """Response body for ``POST /api/v1/clusters/test``."""

    ok: bool
    version: str | None = None
    release: str | None = None
    error: str | None = None


class ClusterUpdate(BaseModel):
    """Request body for ``PATCH /api/v1/clusters/{cluster_id}``.

    Every field is optional. ``api_token_secret`` when present triggers
    re-validation; absent means preserve the existing token.
    """

    name: str | None = Field(default=None, min_length=1, max_length=128)
    host: str | None = Field(default=None, min_length=1, max_length=255)
    port: int | None = Field(default=None, ge=1, le=65535)
    verify_ssl: bool | None = None
    token_user: str | None = Field(default=None, min_length=1, max_length=128)
    token_name: str | None = Field(default=None, min_length=1, max_length=64)
    api_token_secret: str | None = Field(default=None, min_length=1)
    tls_fingerprint: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    is_active: bool | None = None
    # Nullable-clearable: absent → leave unchanged; null → clear; "local-zfs" →
    # set. The default is the ``_UNSET`` sentinel so the service can tell the
    # three cases apart (D-08 — the admin must be able to disable backups).
    backup_storage: str | None = Field(default=_UNSET, max_length=128)

    @field_validator("host")
    @classmethod
    def _validate_host(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _reject_url_in_host(v)

    def backup_storage_set(self) -> bool:
        """True when the request body carried ``backup_storage`` (any value)."""
        return self.backup_storage != _UNSET

    @field_validator("token_user")
    @classmethod
    def _validate_token_user(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _TOKEN_USER_RE.match(v):
            raise ValueError(
                "token_user must be of the form name@pam or name@pve"
            )
        return v


class ClusterResponse(BaseModel):
    """Read-only projection — explicitly omits ``api_token_secret``.

    T-01-06-01: this is the type-system contract that the token never escapes
    to the API surface. The grep
    ``grep 'api_token_secret' app/clusters/schemas.py`` will only ever match
    in write request schemas above.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    host: str
    port: int
    verify_ssl: bool
    token_user: str
    token_name: str
    tls_fingerprint: str | None
    is_active: bool
    notes: str | None
    # D-08: the admin-designated backup-capable storage (None = backups
    # disabled for this cluster).
    backup_storage: str | None = None
    created_at: datetime
    updated_at: datetime


class BackupStorageItem(BaseModel):
    """One backup-capable storage on a cluster — for the admin Select (D-08).

    Enumerated server-side via the connector's ``node_storages(content=
    'backup')``; the admin picks one to set as the cluster's ``backup_storage``.
    """

    model_config = ConfigDict(extra="forbid")

    storage: str
    type: str | None = None

    @classmethod
    def from_pve(cls, raw: dict[str, Any]) -> BackupStorageItem:
        """Coerce one PVE ``/nodes/{n}/storage`` row into a presentable item."""
        return cls(
            storage=str(raw.get("storage") or ""),
            type=(str(raw["type"]) if raw.get("type") is not None else None),
        )


class NodeResourceItem(BaseModel):
    """One cluster node's live free CPU/RAM — for the create-wizard node-fit
    hint (VM-10).

    Derived from a PVE ``/cluster/resources?type=node`` row. The create
    wizard's ``computeNodeFit`` compares a requested VM/LXC size against these
    figures to surface a "won't fit on node-X" hint; a node whose ``status`` is
    ``offline`` is still returned (the frontend decides how to present it).

    Unit conversions performed in :meth:`from_pve`:

    - PVE reports ``cpu`` as a 0-1 *load fraction* — free cores =
      ``maxcpu * (1 - cpu)``.
    - PVE reports ``maxmem`` / ``mem`` in *bytes* — free RAM MB =
      ``(maxmem - mem) // (1024 * 1024)``.
    """

    model_config = ConfigDict(extra="forbid")

    node: str
    free_cpu: float  # free CPU cores
    free_ram_mb: int  # free RAM in MB
    status: str  # PVE node status — ``online`` / ``offline``

    @classmethod
    def from_pve(cls, row: dict[str, Any]) -> NodeResourceItem:
        """Coerce one PVE ``/cluster/resources?type=node`` row into an item."""
        maxcpu = float(row.get("maxcpu") or 0)
        cpu_frac = float(row.get("cpu") or 0.0)  # 0-1 load fraction
        free_cpu = max(0.0, maxcpu * (1.0 - cpu_frac))
        maxmem = int(row.get("maxmem") or 0)  # bytes
        mem = int(row.get("mem") or 0)  # bytes
        free_ram_mb = max(0, (maxmem - mem) // (1024 * 1024))
        return cls(
            node=str(row.get("node") or ""),
            free_cpu=free_cpu,
            free_ram_mb=free_ram_mb,
            status=str(row.get("status") or "unknown"),
        )
