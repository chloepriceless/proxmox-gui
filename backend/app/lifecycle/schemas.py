"""Pydantic schemas for the power lifecycle routes (LIFE-01..03, LIFE-12).

Every model uses ``ConfigDict(extra="forbid")`` — the Phase-1 convention. It
rejects unknown request-body fields with a 422 and, specifically, guarantees
the root-only Proxmox lock-override parameter (Pitfall 17 / T-03-02-03) can
NEVER be smuggled through any lifecycle endpoint — that parameter is not a
field anywhere in this module by design.

``PowerAction`` is a closed ``StrEnum`` — start / stop / reboot / shutdown.
Delete is NOT a power action (it is its own ``DELETE`` route) and bulk power
is restricted to start / stop / reboot (ROADMAP — bulk Delete excluded).
"""

from __future__ import annotations

import enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PowerAction(enum.StrEnum):
    """The four power verbs. ``stop`` is force-stop; ``shutdown`` is graceful ACPI."""

    start = "start"
    stop = "stop"
    reboot = "reboot"
    shutdown = "shutdown"


class PowerRequest(BaseModel):
    """Body of ``POST /clusters/{id}/vms/{vmid}/power``."""

    model_config = ConfigDict(extra="forbid")
    action: PowerAction


class BulkPowerTarget(BaseModel):
    """One (cluster, vm) target in a bulk-power request.

    Bulk power crosses clusters (UI-SPEC) — each target carries its own
    ``cluster_id`` so the fan-out can re-resolve access per target.
    """

    model_config = ConfigDict(extra="forbid")
    cluster_id: int = Field(..., ge=1)
    vmid: int = Field(..., ge=1)


class BulkPowerRequest(BaseModel):
    """Body of ``POST /clusters/{id}/vms/bulk-power``.

    Bulk excludes ``shutdown`` and ``delete`` (ROADMAP — bulk Start/Stop/Reboot
    only; bulk Delete is intentionally excluded for blast-radius reasons).
    """

    model_config = ConfigDict(extra="forbid")
    action: Literal["start", "stop", "reboot"]
    targets: list[BulkPowerTarget] = Field(..., min_length=1, max_length=100)


class JobAcceptedResponse(BaseModel):
    """The ``202 Accepted`` body for a single-job lifecycle mutation."""

    model_config = ConfigDict(extra="forbid")
    job_id: int
    state: str
    kind: str


class BulkJobAcceptedResponse(BaseModel):
    """The ``202 Accepted`` body for a bulk fan-out — the shared batch + ids."""

    model_config = ConfigDict(extra="forbid")
    batch_id: str
    job_ids: list[int]


# ---------------------------------------------------------------------------
# Snapshot schemas (LIFE-04 — Plan 03-03 Task 1)
# ---------------------------------------------------------------------------


class SnapshotCreateRequest(BaseModel):
    """Body of ``POST /clusters/{id}/vms/{vmid}/snapshots``.

    ``vmstate`` is the include-RAM-state toggle (UI-SPEC snapshot-create
    dialog, default off). RAM state can only be captured for QEMU VMs — the
    snapshot service rejects ``vmstate=True`` on an LXC with a 422.
    """

    model_config = ConfigDict(extra="forbid")
    name: str = Field(..., min_length=1, max_length=40)
    description: str | None = None
    vmstate: bool = False


class SnapshotItem(BaseModel):
    """One snapshot in the flat list — the client builds the tree from ``parent``.

    Mirrors the PVE ``snapshot`` GET shape; ``parent``/``snaptime``/
    ``description``/``vmstate`` are all optional because PVE omits them on
    root snapshots and the synthetic ``current`` pseudo-entry.
    """

    model_config = ConfigDict(extra="forbid")
    name: str
    parent: str | None = None
    snaptime: int | None = None
    description: str | None = None
    vmstate: bool | None = None


class SnapshotListResponse(BaseModel):
    """``200`` body for ``GET .../snapshots`` — the flat parent-pointer list."""

    model_config = ConfigDict(extra="forbid")
    snapshots: list[SnapshotItem]


# ---------------------------------------------------------------------------
# Resize schemas (LIFE-08, LIFE-09 — Plan 03-03 Task 2)
# ---------------------------------------------------------------------------


class DiskGrow(BaseModel):
    """One disk-grow request — a target disk id and the new absolute size in GB.

    There is intentionally no ``skiplock`` field (T-03-03-04): ``extra="forbid"``
    rejects any attempt to smuggle the root-only lock-override parameter.
    """

    model_config = ConfigDict(extra="forbid")
    disk: str = Field(..., min_length=1, max_length=32)
    new_size_gb: int = Field(..., ge=1)


class ResizeRequest(BaseModel):
    """Body of ``POST /clusters/{id}/vms/{vmid}/resize``.

    At least one of ``cores`` / ``memory`` / ``disks`` must be set — a resize
    with no changes is a 422. NO ``skiplock`` field by design (T-03-03-04).
    """

    model_config = ConfigDict(extra="forbid")
    cores: int | None = Field(default=None, ge=1, le=512)
    memory: int | None = Field(default=None, ge=16)
    disks: list[DiskGrow] | None = None

    @model_validator(mode="after")
    def _at_least_one_change(self) -> ResizeRequest:
        if self.cores is None and self.memory is None and not self.disks:
            raise ValueError(
                "A resize must change at least one of cores, memory or disks."
            )
        return self


class DiskInfo(BaseModel):
    """One disk's current size, for the resize dialog's disk-grow controls."""

    model_config = ConfigDict(extra="forbid")
    disk: str
    size_gb: int


class ResizeInfoResponse(BaseModel):
    """``200`` body for ``GET .../resize-info``.

    ``cpu_hotplug`` / ``memory_hotplug`` are derived from the VM's ``hotplug``
    config field — when ``false`` the corresponding change needs a reboot
    (UI-SPEC resize dialog inline reboot-required warning).
    """

    model_config = ConfigDict(extra="forbid")
    cores: int
    memory: int
    cpu_hotplug: bool
    memory_hotplug: bool
    disks: list[DiskInfo]
