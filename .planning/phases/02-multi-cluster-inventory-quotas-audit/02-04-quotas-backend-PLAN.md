---
phase: 02-multi-cluster-inventory-quotas-audit
plan: 04
type: execute
wave: 2
depends_on: [01, 02]
files_modified:
  - backend/app/quotas/__init__.py
  - backend/app/quotas/schemas.py
  - backend/app/quotas/usage.py
  - backend/app/quotas/admission.py
  - backend/app/quotas/service.py
  - backend/app/quotas/routes.py
  - backend/app/main.py
  - backend/tests/test_quotas_service.py
  - backend/tests/test_quotas_admission.py
  - backend/tests/test_quotas_routes.py
  - backend/tests/test_quotas_usage.py
autonomous: true
requirements:
  - TENT-01
  - TENT-02
  - TENT-03
  - TENT-04
  - TENT-05
  - API-05
user_setup: []

must_haves:
  truths:
    - "GET /api/v1/teams/{team_id}/quotas (admin) returns the per-cluster quota grid + per-cluster current usage."
    - "PUT /api/v1/teams/{team_id}/quotas (admin) accepts a list of per-cluster QuotaLimitInput rows and upserts the Quota table; emits one audit row per cluster mutation (action='quota.update', payload_before/payload_after diff)."
    - "GET /api/v1/me/quotas returns aggregate (sum across all clusters) AND per-cluster breakdown for every team the principal belongs to."
    - "POST /api/v1/quotas/preview accepts {team_id, cluster_id, requested:{cpu,ram_bytes,disk_bytes,count}} and returns {would_exceed:bool, dimensions:[{name,current,requested,limit,headroom}]}."
    - "Admission primitive uses BEGIN IMMEDIATE + busy_timeout; defends against TOCTOU."
    - "Lower-limit-below-usage attempt returns 409 with detail explaining current usage > new limit (D-12 — no override, admin must lower anyway via second call with `allow_over=true`)."
    - "Usage calculation is derived from connector.list_resources() filtered by the team's poolid; counts running+stopped VMs+LXCs."
  artifacts:
    - path: "backend/app/quotas/admission.py"
      provides: "check_and_preview(db, *, team_id, cluster_id, requested) → QuotaPreview"
      contains: "BEGIN IMMEDIATE"
    - path: "backend/app/quotas/usage.py"
      provides: "compute_team_usage(registry, *, team_id, cluster_id, db) → QuotaUsage"
      contains: "async def compute_team_usage"
    - path: "backend/app/quotas/service.py"
      provides: "list_team_quotas, set_team_quotas, get_my_quotas"
      contains: "async def set_team_quotas"
    - path: "backend/app/quotas/routes.py"
      provides: "GET /teams/{id}/quotas, PUT /teams/{id}/quotas, GET /me/quotas, POST /quotas/preview"
      contains: "router = APIRouter()"
  key_links:
    - from: "backend/app/quotas/admission.py"
      to: "SQLite"
      via: "await db.execute(text('BEGIN IMMEDIATE'))"
      pattern: "BEGIN IMMEDIATE"
    - from: "backend/app/quotas/service.py"
      to: "backend/app/audit/writer.py"
      via: "audit_write per-cluster row with action='quota.update'"
      pattern: "action=\"quota.update\""
    - from: "backend/app/quotas/usage.py"
      to: "backend/app/clusters/registry.py"
      via: "registry.get_for_team + connector.list_resources()"
      pattern: "registry\\.get_for_team"
---

<objective>
Land the per-team quota CRUD, /me/quotas aggregator, and admission preview endpoint. All edits are audited; admission uses SQLite BEGIN IMMEDIATE; usage is derived from the resource cache (no in-memory counter to drift, per Anti-Pattern in 02-RESEARCH).

Purpose: TENT-01..05 + API-05. The frontend in Plan 02-06 consumes /me/quotas for the QuotaIndicator + drawer, and /teams/{id}/quotas for the admin Quotas tab. Phase 3 lifecycle plans consume admission.check_and_preview from the create flows (this plan ships the primitive ready for that future use).

Output: complete /api/v1/me/quotas, /api/v1/teams/{id}/quotas (GET admin / PUT admin), /api/v1/quotas/preview endpoints; admission primitive ready for Phase 3 reuse; audit-on-every-quota-change.
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/research/PITFALLS.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-CONTEXT.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-PATTERNS.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-02-audit-schema-writer-PLAN.md
@backend/app/models/quota.py
@backend/app/teams/routes.py
@backend/app/teams/service.py
@backend/app/clusters/registry.py
@backend/app/auth/dependencies.py
@backend/app/core/db.py

<interfaces>
<!-- Key types and contracts the executor needs. -->

From backend/app/models/quota.py (Plan 02-02 — post-migration):
```python
class Quota(Base):
    __tablename__ = "quotas"
    id: int (PK)
    team_id: int | None  (FK teams.id ON DELETE CASCADE)
    user_id: int | None  (FK users.id ON DELETE CASCADE)
    cluster_id: int | None  (FK clusters.id ON DELETE CASCADE) — NEW in 0003_phase2
    cpu_cores: int | None
    ram_bytes: int | None
    disk_bytes: int | None
    vm_count: int | None
    lxc_count: int | None
    updated_at: datetime
    # CHECK: (team_id IS NOT NULL) <> (user_id IS NOT NULL)
    # UNIQUE: uq_quotas_team_cluster (partial WHERE team_id IS NOT NULL)
    # UNIQUE: uq_quotas_user_cluster (partial WHERE user_id IS NOT NULL)
```
Phase 2 only ships TEAM quotas (CONTEXT D-11 — "/admin/teams/{id}" Quotas tab). User-scoped Quotas exist in schema for Phase 1's XOR rule but no UI surface here; the route layer rejects user-scoped writes with 422.

From backend/app/audit/writer.py (Plan 02-02):
```python
async def audit_write(db, *, actor_user_id, actor_pat_id=None, team_id, cluster_id,
                     action, target_type, target_id, result, source_ip,
                     correlation_id=None, payload_before=None, payload_after=None,
                     error=None) -> AuditLog: ...
```

Reserved action constant for this plan: `quota.update` (per UI-SPEC §"Audit action labels").

From backend/app/clusters/registry.py (Plan 02-01):
```python
async def get_for_team(self, *, cluster_id, team_id, db=None) -> PVEConnector: ...
```

From backend/app/clusters/connector.py (Plan 02-01):
```python
async def list_resources(self, *, force_refresh=False) -> tuple[list[dict], bool]: ...
```

From backend/app/auth/dependencies.py:
```python
async def require_admin(principal=Depends(get_current_principal)) -> Principal: ...
async def csrf_protect(...) -> None: ...
```

From backend/app/core/db.py — PRAGMAs (verify present from Phase 1):
- journal_mode=WAL
- busy_timeout=5000
- foreign_keys=ON
If `busy_timeout` is NOT set, this plan must add it (RESEARCH Pattern 3 dependency).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Quota schemas + usage computation + admission primitive (BEGIN IMMEDIATE) + service layer</name>
  <files>backend/app/quotas/__init__.py, backend/app/quotas/schemas.py, backend/app/quotas/usage.py, backend/app/quotas/admission.py, backend/app/quotas/service.py, backend/tests/test_quotas_admission.py, backend/tests/test_quotas_usage.py, backend/tests/test_quotas_service.py</files>
  <read_first>
    - backend/app/models/quota.py (post-migration ORM — cluster_id is added)
    - backend/app/clusters/registry.py (Plan 02-01 get_for_team surface)
    - backend/app/teams/service.py (CRUD patterns + commit-before-raise)
    - backend/app/core/db.py (verify busy_timeout PRAGMA is set; if not, ADD here — admission service depends on it)
    - backend/app/audit/writer.py (audit_write signature)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md §Pattern 3 (admission with BEGIN IMMEDIATE — verbatim) + §"Common Operation 4" (get_team_usage)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-PATTERNS.md §backend/app/quotas/admission.py + §backend/app/quotas/service.py
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md §"Anti-Patterns to Avoid" (no in-memory quota counters; recompute from cache)
  </read_first>
  <behavior>
    - QuotaLimit schema fields: cpu_cores | ram_gb | disk_gb | vm_count (None = unlimited). Frontend stores in GB; backend Quota ORM stores ram_bytes/disk_bytes; service converts ram_gb*1024**3 ↔ ram_bytes on read/write.
    - compute_team_usage(team_id, cluster_id) reads connector.list_resources(), filters by `pool == team_cluster_tokens.poolid`, sums: cpu = Σ item.maxcpu; ram_bytes = Σ item.maxmem; disk_bytes = Σ item.maxdisk; vm_count = count(type=='qemu'); lxc_count = count(type=='lxc'). Always recomputes — never cached at the app layer (Anti-Pattern §"In-memory quota counters").
    - admission.check_and_preview(team_id, cluster_id, requested) opens BEGIN IMMEDIATE; SELECTs the Quota row; computes current usage; computes proposed = current + requested; returns QuotaPreview with would_exceed=True iff any dimension proposed > limit (where limit is non-None). COMMITS at end (no actual DB write in this phase — Phase 3 will INSERT a reservation row inside the same tx).
    - set_team_quotas(team_id, [per-cluster limit rows]) iterates each row; for each: SELECT existing Quota for (team_id, cluster_id); compute payload_before; if `allow_over=False` (default) and proposed limit < current usage on any dimension → return 409 with detail. Otherwise UPSERT (INSERT if missing, UPDATE if present); emit `audit_write` per-cluster with payload before/after. Commit at the end (one tx for all rows + audit rows).
    - get_my_quotas(principal) iterates principal's TeamMembership rows; for each team, iterates team's clusters (team_cluster_tokens rows); builds {team_id, team_name, clusters: [{cluster_id, cluster_name, limit, usage}], aggregate}.
    - When team has no Quota row for a (team, cluster): treat as ALL dimensions = None (unlimited). Surfaced in API as `limit: null` per dimension.
  </behavior>
  <action>
Step 0 — Pre-flight: verify `backend/app/core/db.py` sets `PRAGMA busy_timeout = 5000`. If absent, ADD it inside the existing `set_sqlite_pragmas` event listener; if Phase 1 did not register such a listener, add the listener following §"Pattern 3" in 02-RESEARCH.

Step 1 — `backend/app/quotas/__init__.py`: `"""Phase 2 quotas — per-cluster limits, admission, audit-on-edit."""`

Step 2 — `backend/app/quotas/schemas.py` (NEW):
```python
"""Pydantic schemas for quotas API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator


class QuotaLimit(BaseModel):
    """Per-cluster quota limit for a team. None = unlimited on that dimension."""
    model_config = ConfigDict(extra="forbid")
    cluster_id: int = Field(..., ge=1)
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
    def from_bytes(cls, u: QuotaUsage) -> "QuotaUsagePresentable":
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
    name: str             # "cpu" | "ram_bytes" | "disk_bytes" | "count"
    current: int
    requested: int
    limit: int | None     # None = unlimited
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
    aggregate_limit: QuotaLimit         # sum-of-clusters (None where any cluster is unlimited)
    aggregate_usage: QuotaUsagePresentable


class MyQuotasResponse(BaseModel):
    """GET /me/quotas full payload."""
    model_config = ConfigDict(from_attributes=True)
    teams: list[MyTeamQuota]
```

Step 3 — `backend/app/quotas/usage.py` (NEW):
```python
"""Quota usage derivation (02-RESEARCH §Common Operation 4)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clusters.registry import PVEConnectorRegistry
from app.models import TeamClusterToken
from app.quotas.schemas import QuotaUsage


async def compute_team_usage(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    team_id: int,
    cluster_id: int,
) -> QuotaUsage:
    """Recompute current usage from the connector's resource cache.

    Anti-pattern guard (02-RESEARCH §Anti-Patterns): NEVER maintain an
    in-memory counter. Always recompute.
    """
    tok = (await db.execute(
        select(TeamClusterToken).where(
            TeamClusterToken.team_id == team_id,
            TeamClusterToken.cluster_id == cluster_id,
        )
    )).scalar_one_or_none()
    if tok is None:
        return QuotaUsage()
    connector = await registry.get_for_team(
        cluster_id=cluster_id, team_id=team_id, db=db,
    )
    snapshot, _is_stale = await connector.list_resources()
    usage = QuotaUsage()
    for item in snapshot:
        if item.get("pool") != tok.poolid:
            continue
        usage.cpu_cores += int(item.get("maxcpu") or 0)
        usage.ram_bytes += int(item.get("maxmem") or 0)
        usage.disk_bytes += int(item.get("maxdisk") or 0)
        if item.get("type") == "qemu":
            usage.vm_count += 1
        elif item.get("type") == "lxc":
            usage.lxc_count += 1
    return usage
```

Step 4 — `backend/app/quotas/admission.py` (NEW):
```python
"""TOCTOU-safe quota admission via SQLite BEGIN IMMEDIATE (Pattern 3 + Pitfall 5).

Phase 2 ships this primitive ready for Phase 3 to consume from the create
flows. The /quotas/preview endpoint exercises the read path (no reservation
row is inserted in Phase 2 because there is no create flow yet).
"""

from __future__ import annotations

import sqlite3

from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException, status

from app.clusters.registry import PVEConnectorRegistry
from app.models import Quota
from app.quotas.schemas import (
    QuotaDimension, QuotaPreview, QuotaPreviewRequest, QuotaUsage,
)
from app.quotas.usage import compute_team_usage


def _dim(name: str, current: int, requested: int, limit: int | None) -> QuotaDimension:
    if limit is None:
        return QuotaDimension(
            name=name, current=current, requested=requested,
            limit=None, headroom=None, would_exceed=False,
        )
    proposed = current + requested
    return QuotaDimension(
        name=name, current=current, requested=requested,
        limit=limit, headroom=max(0, limit - proposed),
        would_exceed=proposed > limit,
    )


async def check_and_preview(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    request: QuotaPreviewRequest,
) -> QuotaPreview:
    """Return a QuotaPreview without reserving anything (Phase 2 carveout).

    Phase 3 will land a sibling `check_and_reserve` that INSERTs a
    reservations row inside the same BEGIN IMMEDIATE transaction.
    """
    try:
        await db.execute(text("BEGIN IMMEDIATE"))
    except OperationalError as exc:
        # Pitfall 5 (02-RESEARCH): even with busy_timeout=5000, BEGIN IMMEDIATE
        # can return SQLITE_BUSY. Surface as 503 + retry advice.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="quota check is contended; retry the request.",
        ) from exc
    try:
        # Resolve the Quota row (team-scoped only in Phase 2 — D-11).
        row = (await db.execute(
            select(Quota).where(
                Quota.team_id == request.team_id,
                Quota.cluster_id == request.cluster_id,
            )
        )).scalar_one_or_none()
        # Compute current usage from PVE.
        usage = await compute_team_usage(
            db, registry, team_id=request.team_id, cluster_id=request.cluster_id,
        )
        dims = [
            _dim("cpu",         usage.cpu_cores,  request.requested_cpu,
                 row.cpu_cores if row else None),
            _dim("ram_bytes",   usage.ram_bytes,  request.requested_ram_bytes,
                 row.ram_bytes if row else None),
            _dim("disk_bytes",  usage.disk_bytes, request.requested_disk_bytes,
                 row.disk_bytes if row else None),
            _dim("count",       usage.vm_count + usage.lxc_count,
                 request.requested_count, row.vm_count if row else None),
        ]
        would_exceed = any(d.would_exceed for d in dims)
        # Commit (no rows changed, but BEGIN IMMEDIATE held the write lock).
        await db.commit()
        return QuotaPreview(would_exceed=would_exceed, dimensions=dims)
    except Exception:
        await db.rollback()
        raise
```

Step 5 — `backend/app/quotas/service.py` (NEW):
```python
"""Team-quota CRUD service. /me/quotas aggregator."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable

from fastapi import HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.clusters.registry import PVEConnectorRegistry
from app.models import Cluster, Quota, Team, TeamClusterToken, TeamMembership
from app.quotas.schemas import (
    ClusterQuotaRow, MyQuotasResponse, MyTeamQuota, QuotaLimit, QuotaLimitsUpdate,
    QuotaUsagePresentable, TeamQuotaPage,
)
from app.quotas.usage import compute_team_usage


_GB = 1024 ** 3


def _limit_from_row(row: Quota | None, cluster_id: int) -> QuotaLimit:
    if row is None:
        return QuotaLimit(cluster_id=cluster_id)
    return QuotaLimit(
        cluster_id=cluster_id,
        cpu_cores=row.cpu_cores,
        ram_gb=(row.ram_bytes // _GB) if row.ram_bytes is not None else None,
        disk_gb=(row.disk_bytes // _GB) if row.disk_bytes is not None else None,
        vm_count=row.vm_count,
    )


def _row_payload(row: Quota | None) -> dict:
    if row is None:
        return {"cpu_cores": None, "ram_bytes": None, "disk_bytes": None,
                "vm_count": None}
    return {"cpu_cores": row.cpu_cores, "ram_bytes": row.ram_bytes,
            "disk_bytes": row.disk_bytes, "vm_count": row.vm_count}


async def list_team_quotas(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    team_id: int,
) -> TeamQuotaPage:
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Team not found")
    # Bound clusters for this team:
    tokens = (await db.execute(
        select(TeamClusterToken).where(TeamClusterToken.team_id == team_id)
    )).scalars().all()
    cluster_ids = [t.cluster_id for t in tokens]
    clusters = (await db.execute(
        select(Cluster).where(Cluster.id.in_(cluster_ids)) if cluster_ids else select(Cluster).where(False)
    )).scalars().all()
    quota_rows = (await db.execute(
        select(Quota).where(Quota.team_id == team_id)
    )).scalars().all()
    quotas_by_cid = {q.cluster_id: q for q in quota_rows if q.cluster_id is not None}

    out_rows: list[ClusterQuotaRow] = []
    for c in clusters:
        usage = await compute_team_usage(db, registry, team_id=team_id, cluster_id=c.id)
        out_rows.append(ClusterQuotaRow(
            cluster_id=c.id,
            cluster_name=c.name,
            limit=_limit_from_row(quotas_by_cid.get(c.id), c.id),
            usage=QuotaUsagePresentable.from_bytes(usage),
        ))
    return TeamQuotaPage(team_id=team.id, team_name=team.name, rows=out_rows)


async def set_team_quotas(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    principal: Principal,
    team_id: int,
    payload: QuotaLimitsUpdate,
    source_ip: str | None,
    correlation_id: str | None = None,
) -> TeamQuotaPage:
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Team not found")

    # Defense-in-depth: every row's cluster must actually belong to this team
    # (i.e. there is a team_cluster_tokens row for the (team, cluster) pair).
    bound_clusters = {t.cluster_id for t in (await db.execute(
        select(TeamClusterToken.cluster_id).where(TeamClusterToken.team_id == team_id)
    )).all()}
    for row in payload.rows:
        if row.cluster_id not in bound_clusters:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=f"Team {team_id} is not bound to cluster {row.cluster_id}.")

    # Pre-check: D-12 lower-below-current-usage protection (unless allow_over=True).
    if not payload.allow_over:
        for row in payload.rows:
            usage = await compute_team_usage(
                db, registry, team_id=team_id, cluster_id=row.cluster_id,
            )
            if (row.cpu_cores is not None and usage.cpu_cores > row.cpu_cores) \
              or (row.ram_gb is not None and usage.ram_bytes > row.ram_gb * _GB) \
              or (row.disk_gb is not None and usage.disk_bytes > row.disk_gb * _GB) \
              or (row.vm_count is not None and (usage.vm_count + usage.lxc_count) > row.vm_count):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "message": "Current usage exceeds the new limit.",
                        "cluster_id": row.cluster_id,
                        "usage": QuotaUsagePresentable.from_bytes(usage).model_dump(),
                        "requested_limit": row.model_dump(),
                    },
                )

    # Upsert + audit per cluster. ONE transaction; commit at end. If any audit
    # write or upsert raises, rollback the whole batch.
    existing = (await db.execute(
        select(Quota).where(Quota.team_id == team_id)
    )).scalars().all()
    by_cluster = {q.cluster_id: q for q in existing if q.cluster_id is not None}

    for row in payload.rows:
        before = _row_payload(by_cluster.get(row.cluster_id))
        new_values = dict(
            cpu_cores=row.cpu_cores,
            ram_bytes=(row.ram_gb * _GB) if row.ram_gb is not None else None,
            disk_bytes=(row.disk_gb * _GB) if row.disk_gb is not None else None,
            vm_count=row.vm_count,
        )
        q = by_cluster.get(row.cluster_id)
        if q is None:
            q = Quota(team_id=team_id, cluster_id=row.cluster_id, **new_values,
                      updated_at=datetime.utcnow())
            db.add(q)
        else:
            for k, v in new_values.items():
                setattr(q, k, v)
            q.updated_at = datetime.utcnow()
        await db.flush()  # ensure ID populated before audit row references it

        await audit_write(
            db, actor_user_id=principal.user.id,
            team_id=team_id, cluster_id=row.cluster_id,
            action="quota.update", target_type="quota", target_id=str(q.id),
            result="success", source_ip=source_ip, correlation_id=correlation_id,
            payload_before=before, payload_after=new_values,
        )

    await db.commit()
    return await list_team_quotas(db, registry, team_id=team_id)


def _sum_or_none(values: Iterable[int | None]) -> int | None:
    """Return Σ values if every value is non-None; else None (unlimited if any unbounded)."""
    total = 0
    for v in values:
        if v is None:
            return None
        total += v
    return total


async def get_my_quotas(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    principal: Principal,
) -> MyQuotasResponse:
    team_ids = [r[0] for r in (await db.execute(
        select(TeamMembership.team_id).where(TeamMembership.user_id == principal.user.id)
    )).all()]
    teams = (await db.execute(
        select(Team).where(Team.id.in_(team_ids)) if team_ids else select(Team).where(False)
    )).scalars().all()
    out: list[MyTeamQuota] = []
    for team in teams:
        page = await list_team_quotas(db, registry, team_id=team.id)
        # Aggregate across clusters: sum, but None on any unbounded cluster.
        cpu = _sum_or_none(r.limit.cpu_cores for r in page.rows)
        ram = _sum_or_none(r.limit.ram_gb for r in page.rows)
        disk = _sum_or_none(r.limit.disk_gb for r in page.rows)
        count = _sum_or_none(r.limit.vm_count for r in page.rows)
        agg_usage = QuotaUsagePresentable(
            cpu_cores=sum(r.usage.cpu_cores for r in page.rows),
            ram_gb=sum(r.usage.ram_gb for r in page.rows),
            disk_gb=sum(r.usage.disk_gb for r in page.rows),
            vm_count=sum(r.usage.vm_count for r in page.rows),
            lxc_count=sum(r.usage.lxc_count for r in page.rows),
        )
        out.append(MyTeamQuota(
            team_id=team.id,
            team_name=team.name,
            clusters=page.rows,
            aggregate_limit=QuotaLimit(
                cluster_id=0,    # sentinel — UI uses team_id; cluster_id=0 means "aggregate"
                cpu_cores=cpu, ram_gb=ram, disk_gb=disk, vm_count=count,
            ),
            aggregate_usage=agg_usage,
        ))
    return MyQuotasResponse(teams=out)
```

Step 6 — Tests.

`backend/tests/test_quotas_usage.py`:
1. `test_compute_team_usage_filters_by_pool` — FakeProxmox snapshot has 2 VMs (one in team pool, one not); compute_team_usage; assert only the team's VM contributes to counts.
2. `test_compute_team_usage_no_token_returns_zero` — call for a (team, cluster) with no team_cluster_tokens row; assert QuotaUsage() defaults to all zeros.
3. `test_compute_team_usage_sums_mixed_qemu_lxc` — fixture with 2 qemu + 1 lxc all in team pool; assert vm_count=2 lxc_count=1; sums correct.

`backend/tests/test_quotas_admission.py`:
1. `test_check_and_preview_no_quota_row_unlimited` — no Quota row; preview returns would_exceed=False; dimensions[0].limit is None; headroom is None.
2. `test_check_and_preview_exceeds_cpu` — Quota row cpu_cores=10; usage=8; requested_cpu=5; assert dimensions[0].would_exceed=True AND would_exceed=True top-level.
3. `test_check_and_preview_within_limit_returns_headroom` — limit=16, usage=8, requested=4; assert headroom=4.
4. `test_check_and_preview_uses_begin_immediate` — patch sqlalchemy's text() OR sniff statements via SQLAlchemy events to assert "BEGIN IMMEDIATE" appears in the executed statement log within the call.
5. `test_check_and_preview_releases_lock_after_commit` — call twice in sequence; assert no SQLITE_BUSY raised; both succeed.
6. `test_check_and_preview_user_scoped_quota_ignored_in_phase2` — seed a Quota row with user_id (not team_id) for the same user; ensure preview for that user's team STILL returns unlimited (Phase 2 ignores user-scoped rows since admin UI is team-only — Pitfall 9 in 02-RESEARCH alignment).

`backend/tests/test_quotas_service.py`:
1. `test_list_team_quotas_returns_one_row_per_bound_cluster` — team bound to 2 clusters; one cluster has Quota row, other doesn't; assert page.rows length == 2; missing-row uses unlimited shape.
2. `test_set_team_quotas_upserts_and_audits` — admin call set_team_quotas(rows=[{cluster_id:1, cpu_cores:16, ram_gb:64, ...}]); assert Quota table has the row; assert AuditLog has one row per cluster with action="quota.update", payload_before / payload_after correct.
3. `test_set_team_quotas_lowering_below_usage_returns_409` — usage on cluster=1 is cpu=20; PUT cpu_cores=10 without allow_over; expect HTTPException(409) with detail.cluster_id == 1.
4. `test_set_team_quotas_allow_over_bypasses_409` — same setup; PUT cpu_cores=10 with allow_over=True; succeeds; verify Quota row updated AND audit row written.
5. `test_set_team_quotas_rejects_unbound_cluster_422` — team bound to clusters {1}; PUT rows includes cluster_id=2; expect 422.
6. `test_set_team_quotas_team_not_found_404` — team_id=9999; expect 404.
7. `test_get_my_quotas_aggregates_across_clusters` — user in team 1; team 1 bound to clusters 1,2 with limits cpu=8 each; assert aggregate_limit.cpu_cores=16.
8. `test_get_my_quotas_aggregate_none_when_any_unlimited` — one cluster has cpu_cores=8, the other unlimited; assert aggregate_limit.cpu_cores is None (unlimited wins).
  </action>
  <verify>
    <automated>cd backend && uv run pytest tests/test_quotas_usage.py tests/test_quotas_admission.py tests/test_quotas_service.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "class QuotaLimit|class QuotaUsage|class QuotaPreview|class TeamQuotaPage|class MyQuotasResponse|class QuotaLimitsUpdate" backend/app/quotas/schemas.py` returns 6 matches.
    - `grep -n "async def compute_team_usage" backend/app/quotas/usage.py` returns 1 match.
    - `grep -n "BEGIN IMMEDIATE" backend/app/quotas/admission.py` returns at least 1 match.
    - `grep -n "async def check_and_preview" backend/app/quotas/admission.py` returns 1 match.
    - `grep -nE "async def list_team_quotas|async def set_team_quotas|async def get_my_quotas" backend/app/quotas/service.py` returns 3 matches.
    - `grep -n 'action="quota.update"' backend/app/quotas/service.py` returns at least 1 match.
    - `grep -nE 'allow_over' backend/app/quotas/service.py backend/app/quotas/schemas.py` returns at least 2 matches.
    - `grep -nE 'status_code=status\\.HTTP_409_CONFLICT' backend/app/quotas/service.py` returns at least 1 match.
    - `cd backend && uv run pytest tests/test_quotas_usage.py tests/test_quotas_admission.py tests/test_quotas_service.py -x` exits 0.
    - busy_timeout PRAGMA present in db.py: `grep -n "busy_timeout" backend/app/core/db.py` returns at least 1 match.
  </acceptance_criteria>
  <done>
    - Schemas, usage computation, admission primitive, and team-quota CRUD service shipped.
    - BEGIN IMMEDIATE primitive verified in tests; busy_timeout PRAGMA confirmed.
    - D-12 (no admin override; lower-anyway via allow_over=True) honored at service layer.
    - Audit-on-every-quota-change verified.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Quota routes + /me/quotas + /quotas/preview; wire into main</name>
  <files>backend/app/quotas/routes.py, backend/app/main.py, backend/tests/test_quotas_routes.py</files>
  <read_first>
    - backend/app/quotas/service.py (just-written)
    - backend/app/quotas/admission.py
    - backend/app/clusters/routes.py (route-shape exemplar; CSRF + admin dependency injection)
    - backend/app/auth/dependencies.py (require_admin + csrf_protect + get_current_principal)
    - backend/app/main.py (where to register the router)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-UI-SPEC.md §URL Schema (additions) for the exact paths
  </read_first>
  <behavior>
    - GET /api/v1/teams/{team_id}/quotas: admin-only; returns TeamQuotaPage.
    - PUT /api/v1/teams/{team_id}/quotas: admin-only + csrf_protect; body QuotaLimitsUpdate; returns updated TeamQuotaPage.
    - GET /api/v1/me/quotas: any authenticated user (cookie or PAT); returns MyQuotasResponse for the principal's teams.
    - POST /api/v1/quotas/preview: any authenticated user (cookie or PAT) + csrf_protect; user can only preview for teams they're a member of (non-admin); admin can preview for any team. Returns QuotaPreview.
  </behavior>
  <action>
Step 1 — `backend/app/quotas/routes.py` (NEW):
```python
"""Quota HTTP surface — TENT-01..05 + API-05."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    Principal, csrf_protect, get_current_principal, require_admin,
)
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.models import TeamMembership
from app.quotas import admission, service
from app.quotas.schemas import (
    MyQuotasResponse, QuotaLimitsUpdate, QuotaPreview, QuotaPreviewRequest,
    TeamQuotaPage,
)

router = APIRouter()


def _get_registry(request: Request) -> PVEConnectorRegistry:
    return request.app.state.registry


@router.get(
    "/teams/{team_id}/quotas",
    response_model=TeamQuotaPage,
    summary="Per-cluster quota grid + current usage for a team (admin)",
    operation_id="quotas_team_get",
    dependencies=[Depends(require_admin)],
)
async def get_team_quotas(
    team_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> TeamQuotaPage:
    return await service.list_team_quotas(db, registry, team_id=team_id)


@router.put(
    "/teams/{team_id}/quotas",
    response_model=TeamQuotaPage,
    summary="Upsert per-cluster quota limits for a team (admin)",
    operation_id="quotas_team_put",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def put_team_quotas(
    request: Request,
    payload: QuotaLimitsUpdate,
    team_id: int = Path(..., ge=1),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> TeamQuotaPage:
    return await service.set_team_quotas(
        db, registry, principal=principal, team_id=team_id, payload=payload,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )


@router.get(
    "/me/quotas",
    response_model=MyQuotasResponse,
    summary="Aggregate + per-cluster quotas for the principal's teams",
    operation_id="quotas_me_get",
    dependencies=[Depends(get_current_principal)],
)
async def get_my_quotas_route(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> MyQuotasResponse:
    return await service.get_my_quotas(db, registry, principal=principal)


@router.post(
    "/quotas/preview",
    response_model=QuotaPreview,
    summary="Quota admission preview (no reservation in Phase 2)",
    operation_id="quotas_preview",
    dependencies=[Depends(csrf_protect)],
)
async def post_quota_preview(
    payload: QuotaPreviewRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> QuotaPreview:
    # Non-admin: must be a member of the team they're previewing for.
    if not principal.user.is_admin:
        my_teams = {r[0] for r in (await db.execute(
            select(TeamMembership.team_id).where(TeamMembership.user_id == principal.user.id)
        )).all()}
        if payload.team_id not in my_teams:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to that team's quota.",
            )
    return await admission.check_and_preview(db, registry, request=payload)
```

Step 2 — `backend/app/main.py`. Register router AFTER inventory_router:
```python
from app.quotas.routes import router as quotas_router
...
app.include_router(quotas_router, prefix="/api/v1", tags=["quotas"])
```

Step 3 — `backend/tests/test_quotas_routes.py`. Tests:
1. `test_get_team_quotas_requires_admin` — non-admin login; GET /teams/1/quotas; expect 403.
2. `test_get_team_quotas_admin_returns_page` — admin; seed team + 2 cluster bindings + 1 Quota row; assert response shape + counts.
3. `test_put_team_quotas_admin_writes_and_audits` — admin; PUT /teams/1/quotas with rows; assert 200 + Quota row created + AuditLog row written.
4. `test_put_team_quotas_csrf_required` — admin cookie without X-CSRF-Token; expect 403.
5. `test_put_team_quotas_lower_below_usage_409` — set up usage > limit scenario; PUT without allow_over; expect 409 with detail.cluster_id.
6. `test_put_team_quotas_allow_over_succeeds` — same scenario + allow_over=True; succeeds.
7. `test_get_my_quotas_unauth_401` — no auth; expect 401.
8. `test_get_my_quotas_returns_aggregate` — user in team with 2 cluster bindings; assert teams[0].aggregate_limit + aggregate_usage shape.
9. `test_get_my_quotas_pat_auth_path` — Bearer pat_…; assert 200 with same shape.
10. `test_post_quotas_preview_non_admin_denied_for_other_team` — non-admin user in team 1; POST preview {team_id:2,...}; expect 403.
11. `test_post_quotas_preview_admin_any_team` — admin; POST preview {team_id:2,...}; succeeds.
12. `test_post_quotas_preview_returns_would_exceed_true` — seed Quota cpu_cores=10, usage cpu=8; POST preview requested_cpu=5; assert would_exceed=True.
  </action>
  <verify>
    <automated>cd backend && uv run pytest tests/test_quotas_routes.py tests/test_quotas_usage.py tests/test_quotas_admission.py tests/test_quotas_service.py -x -v && uv run ruff check app/quotas/ tests/test_quotas_*.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE '@router\\.get\\("/teams/\\{team_id\\}/quotas"|@router\\.put\\("/teams/\\{team_id\\}/quotas"|@router\\.get\\("/me/quotas"|@router\\.post\\("/quotas/preview"' backend/app/quotas/routes.py` returns 4 matches.
    - `grep -n "Depends(require_admin)" backend/app/quotas/routes.py` returns at least 2 matches (GET + PUT team quotas).
    - `grep -n "Depends(csrf_protect)" backend/app/quotas/routes.py` returns at least 2 matches (PUT + POST preview).
    - `grep -n 'app.include_router(quotas_router' backend/app/main.py` returns 1 match.
    - `cd backend && uv run pytest tests/test_quotas_routes.py -x` exits 0.
    - `cd backend && uv run pytest -x` (full suite) exits 0.
    - `cd backend && uv run ruff check app/quotas/` exits 0.
  </acceptance_criteria>
  <done>
    - Four endpoints shipped: GET /teams/{id}/quotas, PUT /teams/{id}/quotas, GET /me/quotas, POST /quotas/preview.
    - Admin-vs-non-admin gating verified by tests.
    - CSRF + PAT-bypass paths covered.
    - Pre-existing suite still green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Admin browser → /teams/{id}/quotas | Admin-only mutating surface — RBAC enforced via require_admin. |
| FastAPI → SQLite (BEGIN IMMEDIATE) | Quota admission transaction holds write lock; busy_timeout=5000 backs off concurrent contention. |
| FastAPI → connector cache | Usage derived from cache; cache may be stale during PVE outage — usage may UNDERSTATE → admin sees "you can save lower" but the next create attempt may still 409 in Phase 3. Acceptable. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-04-01 | Tampering / DoS | Quota TOCTOU race | mitigate | `check_and_preview` opens BEGIN IMMEDIATE; busy_timeout=5000 from Phase 1; service rolls back on any exception. Pitfall 5 documented (rare SQLITE_BUSY beyond busy_timeout → 503 with retry advice). |
| T-02-04-02 | Information Disclosure | Non-admin previews other team's quota | mitigate | Route checks `principal.user.is_admin` and re-queries TeamMembership; non-member returns 403. Test `test_post_quotas_preview_non_admin_denied_for_other_team`. |
| T-02-04-03 | Tampering | Quota write succeeds without audit | mitigate | Service writes audit row inside the same tx as the UPSERT; `await db.commit()` happens AFTER every audit row is flushed. Test `test_set_team_quotas_upserts_and_audits` asserts audit row presence. |
| T-02-04-04 | Tampering | Admin sets quota for a cluster the team isn't bound to | mitigate | Service validates `row.cluster_id in bound_clusters`; otherwise 422. Test `test_set_team_quotas_rejects_unbound_cluster_422`. |
| T-02-04-05 | DoS | Compute usage on every preview call → N PVE round-trips | accept | The 30s ResourceCache from Plan 02-01 caches PVE responses; subsequent preview calls hit the cache. Acceptable for Phase 2 single-LXC scale. |
| T-02-04-06 | Repudiation | Lower-anyway (allow_over=True) bypass not audited | mitigate | Audit row written regardless of allow_over flag; `payload_before` captures the original limits, `payload_after` the new — diff makes the override visible in audit log. |
| T-02-04-07 | Elevation of Privilege | User-scoped Quota row honored by admission for a team-member | mitigate | `check_and_preview` SELECTs `Quota.team_id == team_id` only; user-scoped rows ignored in Phase 2 (Pitfall 9 alignment). Test `test_check_and_preview_user_scoped_quota_ignored_in_phase2`. |

ASVS L1 satisfied for this plan's surface; no HIGH-and-Open threats.
</threat_model>

<verification>
- Task 1 + Task 2 automated checks pass.
- BEGIN IMMEDIATE used and verified in test.
- 409 on lower-below-usage; allow_over=True bypass verified.
- Audit row written per cluster mutation.
- Cookie + PAT auth coexistence verified on /me/quotas + /quotas/preview.
- Phase 1, 02-01, 02-02 suites still green.
</verification>

<success_criteria>
- Four quota endpoints shipped: GET /teams/{id}/quotas, PUT /teams/{id}/quotas, GET /me/quotas, POST /quotas/preview.
- BEGIN IMMEDIATE + busy_timeout primitive in place for admission.
- D-12 invariant honored (no override; allow_over=True is the explicit lower-anyway path).
- Audit-on-every-quota-change.
- Pre-existing tests still green.
</success_criteria>

<output>
After completion, create `.planning/phases/02-multi-cluster-inventory-quotas-audit/02-04-quotas-backend-SUMMARY.md`:
- Files added/modified + test count
- Whether `busy_timeout` PRAGMA existed in Phase 1's db.py or had to be added in this plan
- The exact `MyQuotasResponse` shape with a sample JSON payload so Plan 02-06 frontend can wire the QuotaIndicator + drawer without reading code
- The 409 detail body shape returned on lower-below-usage so Plan 02-06 can map it to UI-SPEC §"Lower quota limit" copy
- Confirmation that user-scoped Quota rows are ignored in Phase 2 (Pitfall 9 acceptance)
</output>
