"""Pydantic schemas for quotas API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class QuotaLimit(BaseModel):
    """Per-cluster quota limit for a team. None = unlimited on that dimension.

    cluster_id=0 is a sentinel used exclusively by the /me/quotas aggregator to
    represent an across-clusters sum. All per-cluster rows have cluster_id >= 1.
    """

    model_config = ConfigDict(extra="forbid")
    cluster_id: int = Field(..., ge=0)
    cpu_cores: int | None = Field(default=None, ge=0)
    ram_gb: int | None = Field(default=None, ge=0)
    disk_gb: int | None = Field(default=None, ge=0)
    vm_count: int | None = Field(default=None, ge=0)


class QuotaUsage(BaseModel):
    """Current usage for a team in one cluster (derived from PVE resource cache)."""

    model_config = ConfigDict(from_attributes=True)
    cpu_cores: int = 0
    ram_bytes: int = 0
    disk_bytes: int = 0
    vm_count: int = 0
    lxc_count: int = 0


class QuotaUsagePresentable(BaseModel):
    """Same as QuotaUsage but rounded to GB for the UI; backend always uses bytes internally."""

    model_config = ConfigDict(extra="forbid")
    cpu_cores: int = 0
    ram_gb: int = 0
    disk_gb: int = 0
    vm_count: int = 0
    lxc_count: int = 0

    @classmethod
    def from_bytes(cls, u: QuotaUsage) -> QuotaUsagePresentable:
        return cls(
            cpu_cores=u.cpu_cores,
            ram_gb=u.ram_bytes // (1024**3),
            disk_gb=u.disk_bytes // (1024**3),
            vm_count=u.vm_count,
            lxc_count=u.lxc_count,
        )


class ClusterQuotaRow(BaseModel):
    """One row in the GET /teams/{id}/quotas response: limit + current usage."""

    model_config = ConfigDict(from_attributes=True)
    cluster_id: int
    cluster_name: str
    limit: QuotaLimit
    usage: QuotaUsagePresentable


class TeamQuotaPage(BaseModel):
    """Full GET /teams/{id}/quotas response."""

    model_config = ConfigDict(from_attributes=True)
    team_id: int
    team_name: str
    rows: list[ClusterQuotaRow]


class QuotaLimitsUpdate(BaseModel):
    """PUT /teams/{id}/quotas body. extra=forbid."""

    model_config = ConfigDict(extra="forbid")
    rows: list[QuotaLimit] = Field(default_factory=list)
    allow_over: bool = Field(default=False)


class QuotaPreviewRequest(BaseModel):
    """POST /quotas/preview body — Phase 3 hook."""

    model_config = ConfigDict(extra="forbid")
    team_id: int = Field(..., ge=1)
    cluster_id: int = Field(..., ge=1)
    requested_cpu: int = Field(default=0, ge=0)
    requested_ram_bytes: int = Field(default=0, ge=0)
    requested_disk_bytes: int = Field(default=0, ge=0)
    requested_count: int = Field(default=0, ge=0)


class QuotaDimension(BaseModel):
    """One dimension in the preview response."""

    name: str  # "cpu" | "ram_bytes" | "disk_bytes" | "count"
    current: int
    requested: int
    limit: int | None  # None = unlimited
    headroom: int | None  # None = unlimited; else limit - (current + requested)
    would_exceed: bool


class QuotaPreview(BaseModel):
    """POST /quotas/preview response."""

    model_config = ConfigDict(from_attributes=True)
    would_exceed: bool
    dimensions: list[QuotaDimension]


class MyTeamQuota(BaseModel):
    """One team's view in GET /me/quotas."""

    model_config = ConfigDict(from_attributes=True)
    team_id: int
    team_name: str
    clusters: list[ClusterQuotaRow]
    aggregate_limit: QuotaLimit  # sum-of-clusters (None where any cluster is unlimited)
    aggregate_usage: QuotaUsagePresentable


class MyQuotasResponse(BaseModel):
    """GET /me/quotas full payload."""

    model_config = ConfigDict(from_attributes=True)
    teams: list[MyTeamQuota]
