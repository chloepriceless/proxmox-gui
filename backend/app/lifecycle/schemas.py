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

from pydantic import BaseModel, ConfigDict, Field


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
