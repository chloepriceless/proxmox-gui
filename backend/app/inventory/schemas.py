"""Pydantic schemas for inventory routes (read + write)."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Pitfall 3: PVE's actual tag regex is BROADER than UI-SPEC D-14's lowercase set.
# Server-side defense-in-depth uses PVE's regex; client narrows for UX (D-14).
PVE_TAG_RE = re.compile(r"^[a-z0-9_][a-z0-9_\-\+\.]*$")


class VMInventoryItem(BaseModel):
    """One row in the per-cluster inventory list."""

    model_config = ConfigDict(from_attributes=True)
    cluster_id: int
    vmid: int
    name: str | None = None
    type: Literal["qemu", "lxc"]
    node: str
    status: str  # "running" | "stopped" | "paused" | "unknown"
    maxcpu: int = 0
    maxmem: int = 0  # bytes
    maxdisk: int = 0  # bytes
    tags: list[str] = Field(default_factory=list)
    pool: str | None = None
    is_stale: bool = False

    @classmethod
    def from_pve(
        cls, item: dict, *, cluster_id: int, is_stale: bool = False
    ) -> "VMInventoryItem":
        raw_tags = item.get("tags") or ""
        # PVE writes ";"-joined but tolerates "," and " " on read (Pitfall 6 in
        # 02-RESEARCH.md). Accept all three separators.
        tag_list = [t for t in re.split(r"[;,\s]+", str(raw_tags)) if t]
        return cls(
            cluster_id=cluster_id,
            vmid=int(item["vmid"]),
            name=item.get("name"),
            type=("lxc" if item.get("type") == "lxc" else "qemu"),
            node=str(item.get("node") or ""),
            status=str(item.get("status") or "unknown"),
            maxcpu=int(item.get("maxcpu") or 0),
            maxmem=int(item.get("maxmem") or 0),
            maxdisk=int(item.get("maxdisk") or 0),
            tags=tag_list,
            pool=item.get("pool"),
            is_stale=is_stale,
        )


class ClusterInventory(BaseModel):
    """Per-cluster block in /me/inventory aggregate response."""

    model_config = ConfigDict(from_attributes=True)
    cluster_id: int
    cluster_name: str
    cluster_status: str  # 'ok' | 'failed' | 'untested' — connector.status
    is_stale: bool
    last_error: str | None = None
    items: list[VMInventoryItem]


class VMDetail(BaseModel):
    """Detail page payload — status + config merged."""

    model_config = ConfigDict(from_attributes=True)
    cluster_id: int
    vmid: int
    name: str | None = None
    type: Literal["qemu", "lxc"]
    node: str
    status: str
    uptime: int = 0
    cpu: float = 0.0
    mem: int = 0
    maxcpu: int = 0
    maxmem: int = 0
    disk: int = 0
    maxdisk: int = 0
    netin: int = 0
    netout: int = 0
    diskread: int = 0
    diskwrite: int = 0
    tags: list[str] = Field(default_factory=list)
    description: str | None = None
    raw_config: dict = Field(default_factory=dict)  # PVE config blob for advanced fields


class RRDSample(BaseModel):
    """One PVE RRD row."""

    model_config = ConfigDict(from_attributes=True)
    time: int
    cpu: float = 0.0
    mem: int = 0
    maxmem: int = 0
    disk: int = 0
    maxdisk: int = 0
    netin: int = 0
    netout: int = 0
    diskread: int = 0
    diskwrite: int = 0


class RRDQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timeframe: Literal["hour", "day", "week", "month", "year"] = "hour"
    cf: Literal["AVERAGE", "MAX"] = "AVERAGE"


class TagsUpdate(BaseModel):
    """PUT /vms/{vmid}/tags body. Replaces the full tag set (D-13 last-write-wins)."""

    model_config = ConfigDict(extra="forbid")
    tags: list[str] = Field(default_factory=list, max_length=64)

    @field_validator("tags")
    @classmethod
    def _validate_each_tag(cls, v: list[str]) -> list[str]:
        for t in v:
            if not PVE_TAG_RE.match(t):
                raise ValueError(f"invalid tag format: {t!r}")
        # Dedup + stable sort happens at write time in the service.
        return v


class NotesUpdate(BaseModel):
    """PUT /vms/{vmid}/notes body. Writes PVE `description`."""

    model_config = ConfigDict(extra="forbid")
    notes: str = Field(default="", max_length=8000)
