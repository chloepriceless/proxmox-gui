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
from datetime import datetime
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


# ---------------------------------------------------------------------------
# Backup schemas (LIFE-05, LIFE-06, LIFE-07 — Plan 03-04 Task 2)
# ---------------------------------------------------------------------------


class BackupRequest(BaseModel):
    """Body of ``POST /clusters/{id}/vms/{vmid}/backup``.

    D-08: the user chooses *retention*, not storage — the storage is the
    cluster's admin-preset ``backup_storage``, and ``mode``/``compress`` are
    service defaults. The body is therefore empty (``{}`` is accepted); the
    schema exists so ``extra="forbid"`` rejects any smuggled field.
    """

    model_config = ConfigDict(extra="forbid")


class BackupFileItem(BaseModel):
    """One backup file in a VM's archive listing."""

    model_config = ConfigDict(extra="forbid")
    volid: str
    filename: str | None = None
    size: int | None = None
    ctime: int | None = None
    format: str | None = None


class BackupListResponse(BaseModel):
    """``200`` body for ``GET .../backups`` — the VM's backup-file list."""

    model_config = ConfigDict(extra="forbid")
    backups: list[BackupFileItem]


class RestoreRequest(BaseModel):
    """Body of ``POST /clusters/{id}/vms/{vmid}/restore``.

    ``mode='in_place'`` overwrites the existing VMID (data-loss op — the UI
    enforces a typed-name confirm, D-10; the API still authorizes via
    ``require_resource_access``). ``mode='new'`` restores under a fresh VMID
    and therefore counts against quota (Pitfall 8) — ``new_vmid`` is required
    in that case (model validator).
    """

    model_config = ConfigDict(extra="forbid")
    archive: str = Field(..., min_length=1, max_length=512)
    mode: Literal["in_place", "new"]
    new_vmid: int | None = Field(default=None, ge=1)
    new_name: str | None = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def _new_requires_vmid(self) -> RestoreRequest:
        if self.mode == "new" and self.new_vmid is None:
            raise ValueError(
                "Restoring as a new VM requires a target VMID (new_vmid)."
            )
        return self


class BackupScheduleRequest(BaseModel):
    """Body of ``PUT /clusters/{id}/vms/{vmid}/backup-schedule``.

    D-08 simple keep-last-N retention — the user picks a frequency and a
    keep-last count. ``keep_last`` is bounded 1..365.
    """

    model_config = ConfigDict(extra="forbid")
    enabled: bool
    frequency: Literal["daily", "weekly"]
    keep_last: int = Field(..., ge=1, le=365)


class BackupScheduleResponse(BaseModel):
    """``200`` body mirroring a ``BackupSchedule`` row."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: int | None = None
    cluster_id: int
    vmid: int
    is_lxc: bool
    node: str
    enabled: bool
    frequency: str
    keep_last: int
    last_run_at: datetime | None = None
    last_run_state: str | None = None


# ---------------------------------------------------------------------------
# Clone + migrate schemas (LIFE-10, LIFE-11 — Plan 03-04 Task 3)
# ---------------------------------------------------------------------------


class CloneRequest(BaseModel):
    """Body of ``POST /clusters/{id}/vms/{vmid}/clone``.

    ``full`` selects a full (``True``) vs linked (``False``) clone.
    ``new_vmid`` is optional — when absent the clone service allocates one via
    the app-level VMID reservation (Pitfall 1). NO ``skiplock`` field by design
    (``extra="forbid"`` — T-03-04-06).
    """

    model_config = ConfigDict(extra="forbid")
    name: str = Field(..., min_length=1, max_length=128)
    full: bool
    target_node: str = Field(..., min_length=1, max_length=64)
    target_storage: str | None = Field(default=None, max_length=128)
    new_vmid: int | None = Field(default=None, ge=1)


class MigrateRequest(BaseModel):
    """Body of ``POST /clusters/{id}/vms/{vmid}/migrate``.

    ``bwlimit_mbps`` is in MB/s (the UI label); the migrate service converts
    it to KiB/s for PVE (RESEARCH A8). ``0`` means unlimited. NO ``skiplock``
    field by design (``extra="forbid"`` — T-03-04-06).
    """

    model_config = ConfigDict(extra="forbid")
    target_node: str = Field(..., min_length=1, max_length=64)
    online: bool = True
    bwlimit_mbps: int = Field(default=0, ge=0)
