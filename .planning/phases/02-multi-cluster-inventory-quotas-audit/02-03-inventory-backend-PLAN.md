---
phase: 02-multi-cluster-inventory-quotas-audit
plan: 03
type: execute
wave: 2
depends_on: [01, 02]
files_modified:
  - backend/app/inventory/__init__.py
  - backend/app/inventory/schemas.py
  - backend/app/inventory/service.py
  - backend/app/inventory/routes.py
  - backend/app/inventory/rrd.py
  - backend/app/inventory/access.py
  - backend/app/main.py
  - backend/tests/test_inventory_list.py
  - backend/tests/test_inventory_detail.py
  - backend/tests/test_inventory_tags.py
  - backend/tests/test_inventory_notes.py
  - backend/tests/test_inventory_rrd.py
  - backend/tests/test_inventory_access.py
  - backend/tests/fixtures/pve_responses.py
autonomous: true
requirements:
  - INV-01
  - INV-04
  - INV-05
  - INV-06
  - INV-07
  - INV-08
  - TENT-06
  - API-05
user_setup: []

must_haves:
  truths:
    - "GET /api/v1/clusters/{cluster_id}/inventory returns per-cluster VM+LXC list scoped to the principal's team pool; is_stale flag surfaces when breaker open."
    - "GET /api/v1/me/inventory aggregates across all clusters the principal has access to (via the principal's team memberships) and returns one ClusterInventory block per cluster."
    - "GET /api/v1/clusters/{cluster_id}/vms/{vmid} (and /lxcs/{vmid}) returns full status+config; rejects access with 403 when principal has no team binding owning the resource pool."
    - "GET /api/v1/clusters/{cluster_id}/vms/{vmid}/rrd?timeframe=hour&cf=AVERAGE returns RRD samples; timeframe validated against {hour,day,week,month,year}."
    - "PUT /api/v1/clusters/{cluster_id}/vms/{vmid}/tags writes PVE tags (joined ';'), validates each tag against PVE_TAG_RE server-side, audits the change with payload_before/payload_after, invalidates connector cache."
    - "PUT /api/v1/clusters/{cluster_id}/vms/{vmid}/notes writes PVE description, max 8000 chars, audits with before/after diff."
    - "Cross-tenant access attempt returns 403 (not 404 — admin must distinguish 'not found' vs 'forbidden'); audit row written for the rejection with result='failure'."
    - "Cookie session AND Bearer PAT both reach the same RBAC predicate; integration tests cover both paths."
    - "Audit row is written for every successful tag/notes write AND for every failure path; commit-before-raise honored on failure."
  artifacts:
    - path: "backend/app/inventory/routes.py"
      provides: "GET list/detail/rrd; PUT tags/notes endpoints"
      contains: "router = APIRouter()"
    - path: "backend/app/inventory/service.py"
      provides: "list_inventory_for_principal, list_inventory_for_cluster, get_vm_detail, update_vm_tags, update_vm_notes, get_vm_rrd"
      contains: "async def list_inventory_for_principal"
    - path: "backend/app/inventory/schemas.py"
      provides: "VMInventoryItem, VMDetail, ClusterInventory, TagsUpdate, NotesUpdate, RRDQuery, RRDSample"
      contains: "class TagsUpdate"
    - path: "backend/app/inventory/access.py"
      provides: "resolve_principal_team_for_pool(principal, vm_pool_id) → team_id; require_resource_access dep"
      contains: "async def require_resource_access"
    - path: "backend/app/inventory/rrd.py"
      provides: "normalize_rrd_samples utility"
      contains: "def normalize_rrd_samples"
  key_links:
    - from: "backend/app/inventory/service.py"
      to: "backend/app/clusters/registry.py:get_for_team"
      via: "registry.get_for_team(cluster_id=..., team_id=..., db=db)"
      pattern: "registry\\.get_for_team"
    - from: "backend/app/inventory/service.py"
      to: "backend/app/audit/writer.py:audit_write"
      via: "await audit_write(db, ..., action='vm.tag.add'|'vm.notes.update', ...)"
      pattern: "from app\\.audit\\.writer import audit_write"
    - from: "backend/app/inventory/routes.py"
      to: "backend/app/inventory/access.py:require_resource_access"
      via: "Depends(require_resource_access)"
      pattern: "require_resource_access"
---

<objective>
Ship the inventory backend surface: cross-cluster list aggregation, per-cluster list, VM/LXC detail with RRD, tags + notes write paths — all behind the per-team-token connector from Plan 02-01 and the audit writer from Plan 02-02.

Purpose: this is the read-layer half of Phase 2 (TENT-06 cross-tenant isolation; INV-01..08 inventory features; API-05 PAT-and-cookie parity). The frontend in Plan 02-05 consumes these endpoints; without this layer, every Phase-2 UI surface is offline.

Output: complete `/api/v1/me/inventory`, `/api/v1/clusters/{id}/inventory`, `/api/v1/clusters/{id}/vms/{vmid}`, `/api/v1/clusters/{id}/lxcs/{vmid}`, `/api/v1/clusters/{id}/vms/{vmid}/rrd`, `/api/v1/clusters/{id}/vms/{vmid}/tags`, `/api/v1/clusters/{id}/vms/{vmid}/notes` endpoints — each with cookie+PAT auth tests, RBAC tests, audit-write verification, and stale-cache fallback verification.
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
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-01-connector-extension-PLAN.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-02-audit-schema-writer-PLAN.md
@backend/app/clusters/connector.py
@backend/app/clusters/registry.py
@backend/app/clusters/routes.py
@backend/app/clusters/schemas.py
@backend/app/teams/service.py
@backend/app/models/team_membership.py
@backend/app/models/team_cluster_token.py
@backend/app/auth/dependencies.py

<interfaces>
<!-- Key types and contracts the executor needs. -->

From backend/app/clusters/registry.py (Plan 02-01 surface):
```python
class PVEConnectorRegistry:
    async def get_for_team(self, *, cluster_id: int, team_id: int,
                           db: AsyncSession | None = None) -> PVEConnector: ...
```

From backend/app/clusters/connector.py (Plan 02-01 surface):
```python
class PVEConnector:
    last_seen_healthy: float | None
    last_error: str | None
    status: str  # 'ok' | 'failed' | 'untested'
    async def list_resources(self, *, force_refresh: bool = False) -> tuple[list[dict], bool]: ...
    async def get_vm_status(self, *, node: str, vmid: int, is_lxc: bool) -> dict: ...
    async def get_vm_config(self, *, node: str, vmid: int, is_lxc: bool) -> dict: ...
    async def set_vm_config(self, *, node: str, vmid: int, is_lxc: bool, **fields) -> None: ...
    async def rrddata(self, *, node: str, vmid: int, is_lxc: bool,
                      timeframe: str = "hour", cf: str = "AVERAGE") -> list[dict]: ...
```

From backend/app/audit/writer.py (Plan 02-02 surface):
```python
async def audit_write(
    db: AsyncSession, *,
    actor_user_id: int | None, actor_pat_id: int | None = None,
    team_id: int | None, cluster_id: int | None,
    action: str, target_type: str | None, target_id: str | None,
    result: str, source_ip: str | None, correlation_id: str | None = None,
    payload_before: dict | None = None, payload_after: dict | None = None,
    error: str | None = None,
) -> AuditLog: ...   # FLUSHES, never commits — caller owns commit
```

Reserved `action` constants for this plan (per UI-SPEC §"Audit action labels"):
- `vm.tag.add`, `vm.tag.remove`, `vm.tag.update`  (tags write)
- `vm.notes.update`  (description write)

Reserved `target_type` values:
- `vm` (qemu) or `lxc` (container)

From backend/app/auth/dependencies.py:
```python
@dataclass
class Principal:
    user: User
    mode: Literal["session", "pat"]
    @property
    def via_pat(self) -> bool: ...

async def get_current_principal(...) -> Principal: ...
```
Note: Principal does NOT yet expose `team_ids` — service-layer code must SELECT TeamMembership.team_id WHERE user_id=principal.user.id (Pitfall 9 mitigation).

From backend/app/models/team_membership.py (assume the canonical shape):
```python
class TeamMembership(Base):
    user_id: int  (FK users.id, PK part)
    team_id: int  (FK teams.id, PK part)
```

From backend/app/models/team_cluster_token.py:
- Holds `poolid` per (team_id, cluster_id). The PVE `pool` field on `/cluster/resources` items will be exactly this poolid for resources the team owns.

PVE_TAG_RE (server-side defense-in-depth, per Pitfall 3 in 02-RESEARCH — must accept PVE's full range, not just D-14's UI subset):
```python
import re
PVE_TAG_RE = re.compile(r"^[a-z0-9_][a-z0-9_\-\+\.]*$")
```

From backend/app/clusters/routes.py — `get_registry` dependency helper to import:
```python
async def get_registry(request: Request) -> PVEConnectorRegistry:
    return request.app.state.registry
```

From backend/app/core/source_ip.py (Plan 02-02) or backend/app/security/source_ip.py:
```python
def extract_source_ip(request: Request) -> str | None: ...
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Inventory schemas + RBAC access dep + service (list/detail/rrd reads)</name>
  <files>backend/app/inventory/__init__.py, backend/app/inventory/schemas.py, backend/app/inventory/access.py, backend/app/inventory/rrd.py, backend/app/inventory/service.py, backend/tests/test_inventory_list.py, backend/tests/test_inventory_detail.py, backend/tests/test_inventory_rrd.py, backend/tests/test_inventory_access.py, backend/tests/fixtures/pve_responses.py</files>
  <read_first>
    - backend/app/clusters/schemas.py (Pydantic model shapes; ConfigDict(extra="forbid") pattern; field validators)
    - backend/app/clusters/service.py (service layer shape; how PVE exceptions are caught + translated; service-layer-commits-before-raise pattern)
    - backend/app/teams/service.py (list_teams + membership join patterns lines ~226-242)
    - backend/app/auth/dependencies.py (Principal dataclass; get_current_principal; require_admin shape — use as template for require_resource_access)
    - backend/app/models/team_membership.py + backend/app/models/team_cluster_token.py
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md §"Common Operation 1" (list_inventory_for_principal verbatim) + §"Common Operation 2" (get_rrd_metrics verbatim) + §"Pitfall 1" (vmid → node lookup from resource cache)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-PATTERNS.md §backend/app/inventory/service.py + §"Authentication / Authorization"
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md §"Pitfall 4" (stopped-VM zero-value fields)
  </read_first>
  <behavior>
    - VMInventoryItem.from_pve(item: dict) populates: cluster_id (injected), vmid, name, type ('qemu'|'lxc'), node, status ('running'|'stopped'|'paused'|'error'|'unknown'), maxcpu, maxmem (bytes), maxdisk (bytes), tags (list[str] — split ";"), pool, is_stale (injected).
    - When PVE returns missing/zero RRD-derived fields for stopped guests, schema validation does NOT fail; status='stopped' simply yields zeros.
    - list_inventory_for_principal: admin sees every cluster the user has access to (all teams admin is in — including auto-personal); non-admin sees only the user's team scopes. For EACH cluster, picks the principal's primary team membership (lowest team_id matching a row in team_cluster_tokens for that cluster) and uses that team's privsep token.
    - Cross-tenant attempt: if non-admin requests `/clusters/{X}/vms/{Y}` for a VM whose pool != any of principal's team poolids → 403 + audit row `result='failure', action='vm.access.denied'`.
    - require_resource_access(cluster_id, vmid) dep: resolves Cluster row, then iterates principal's TeamMembership rows; for each team with a row in team_cluster_tokens for cluster_id, fetches a snapshot from connector.list_resources(); finds the item with matching vmid; verifies item.pool == team_cluster_tokens.poolid; returns (cluster_row, vm_item, team_id, connector). If no match → HTTPException(403).
    - get_vm_rrd: validates timeframe + cf at the route level via Query; service calls connector.rrddata(...) and normalize_rrd_samples coerces PVE's mixed-key/missing-value rows into a list[RRDSample].
  </behavior>
  <action>
Step 1 — `backend/app/inventory/__init__.py` (NEW): `"""Phase 2 inventory module — reads + tag/notes writes."""`

Step 2 — `backend/app/inventory/schemas.py` (NEW):
```python
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
    status: str           # "running" | "stopped" | "paused" | "unknown"
    maxcpu: int = 0
    maxmem: int = 0       # bytes
    maxdisk: int = 0      # bytes
    tags: list[str] = Field(default_factory=list)
    pool: str | None = None
    is_stale: bool = False

    @classmethod
    def from_pve(cls, item: dict, *, cluster_id: int, is_stale: bool = False) -> "VMInventoryItem":
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
    cluster_status: str        # 'ok' | 'failed' | 'untested' — connector.status
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
    raw_config: dict = Field(default_factory=dict)   # PVE config blob for advanced fields


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
```

Step 3 — `backend/app/inventory/rrd.py` (NEW):
```python
"""RRD response normalization (02-RESEARCH §Common Operation 2)."""

from __future__ import annotations

from app.inventory.schemas import RRDSample


def normalize_rrd_samples(rows: list[dict]) -> list[RRDSample]:
    """Coerce PVE RRD response rows into typed samples.

    PVE returns rows with possibly-missing keys for stopped guests (Pitfall 4
    in 02-RESEARCH.md). Missing fields default to 0; we never fail validation
    on a stopped-VM RRD row.
    """
    out: list[RRDSample] = []
    for r in rows or []:
        out.append(RRDSample(
            time=int(r.get("time") or 0),
            cpu=float(r.get("cpu") or 0.0),
            mem=int(r.get("mem") or 0),
            maxmem=int(r.get("maxmem") or 0),
            disk=int(r.get("disk") or 0),
            maxdisk=int(r.get("maxdisk") or 0),
            netin=int(r.get("netin") or 0),
            netout=int(r.get("netout") or 0),
            diskread=int(r.get("diskread") or 0),
            diskwrite=int(r.get("diskwrite") or 0),
        ))
    return out
```

Step 4 — `backend/app/inventory/access.py` (NEW). The RBAC primitive:
```python
"""Resource-access RBAC (TENT-06).

Resolves a (cluster_id, vmid) pair to the principal's *owning* team — that is,
the team whose privsep token's poolid matches the resource's `pool` field as
reported by `/cluster/resources`.

Pitfall 11 (RESEARCH PITFALLS.md): NEVER filter in Python. The PVE token's ACL
already filters /cluster/resources — but we ALSO assert pool match here as
defense-in-depth, because the cluster registry may not have minted the token
with strict-enough ACL (T-02-03-04 mitigation).
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Path, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, get_current_principal
from app.clusters.connector import PVEConnector
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.models import Cluster, TeamClusterToken, TeamMembership


@dataclass
class ResolvedResource:
    cluster: Cluster
    team_id: int
    poolid: str
    connector: PVEConnector
    vm_item: dict       # raw PVE /cluster/resources row
    is_stale: bool


async def _team_ids_for_user(db: AsyncSession, *, user_id: int) -> list[int]:
    rows = await db.execute(
        select(TeamMembership.team_id).where(TeamMembership.user_id == user_id)
    )
    return [r[0] for r in rows.all()]


async def _team_tokens_for_cluster(
    db: AsyncSession, *, team_ids: list[int], cluster_id: int,
) -> list[TeamClusterToken]:
    if not team_ids:
        return []
    rows = await db.execute(
        select(TeamClusterToken).where(
            TeamClusterToken.cluster_id == cluster_id,
            TeamClusterToken.team_id.in_(team_ids),
        )
    )
    return list(rows.scalars().all())


def _get_registry(request: Request) -> PVEConnectorRegistry:
    return request.app.state.registry


async def resolve_resource(
    *,
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    principal: Principal,
    cluster_id: int,
    vmid: int,
) -> ResolvedResource:
    cluster = await db.get(Cluster, cluster_id)
    if cluster is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Cluster not found")
    user_team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    tokens = await _team_tokens_for_cluster(
        db, team_ids=user_team_ids, cluster_id=cluster_id,
    )
    # Admin still has to operate THROUGH a team-token (one of the admin's own
    # teams — usually the personal team). If admin has no team membership on
    # this cluster, fall through to 403.
    for tok in tokens:
        connector = await registry.get_for_team(
            cluster_id=cluster_id, team_id=tok.team_id, db=db,
        )
        snapshot, is_stale = await connector.list_resources()
        for item in snapshot:
            if int(item.get("vmid", 0)) != vmid:
                continue
            if item.get("pool") != tok.poolid:
                continue
            return ResolvedResource(
                cluster=cluster,
                team_id=tok.team_id,
                poolid=tok.poolid,
                connector=connector,
                vm_item=item,
                is_stale=is_stale,
            )
    # Don't leak existence: same 403 whether the VM doesn't exist OR is in a
    # tenant the principal can't see (T-02-03-01).
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                        detail="No access to that resource")


async def require_resource_access(
    cluster_id: int = Path(..., ge=1),
    vmid: int = Path(..., ge=1),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> ResolvedResource:
    return await resolve_resource(
        db=db, registry=registry, principal=principal,
        cluster_id=cluster_id, vmid=vmid,
    )
```

Step 5 — `backend/app/inventory/service.py` (NEW). Core service functions for the read path:
```python
"""Inventory service — PVE reads, RBAC-scoped, with stale-cache awareness."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal
from app.clusters.connector import PVEConnector
from app.clusters.registry import PVEConnectorRegistry
from app.inventory.access import ResolvedResource, _team_ids_for_user, _team_tokens_for_cluster
from app.inventory.rrd import normalize_rrd_samples
from app.inventory.schemas import (
    ClusterInventory, RRDQuery, RRDSample, VMDetail, VMInventoryItem,
)
from app.models import Cluster


async def list_inventory_for_cluster(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    principal: Principal,
    cluster_id: int,
) -> ClusterInventory:
    cluster = await db.get(Cluster, cluster_id)
    if cluster is None:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Cluster not found")
    user_team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    tokens = await _team_tokens_for_cluster(
        db, team_ids=user_team_ids, cluster_id=cluster_id,
    )
    items: list[VMInventoryItem] = []
    is_stale = False
    last_error: str | None = None
    connector: PVEConnector | None = None
    for tok in tokens:
        try:
            connector = await registry.get_for_team(
                cluster_id=cluster_id, team_id=tok.team_id, db=db,
            )
            snapshot, stale = await connector.list_resources()
            is_stale = is_stale or stale
            for it in snapshot:
                if it.get("pool") != tok.poolid:
                    continue
                items.append(VMInventoryItem.from_pve(
                    it, cluster_id=cluster_id, is_stale=stale,
                ))
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            is_stale = True
    return ClusterInventory(
        cluster_id=cluster.id,
        cluster_name=cluster.name,
        cluster_status=(connector.status if connector else "untested"),
        is_stale=is_stale,
        last_error=last_error,
        items=items,
    )


async def list_inventory_for_principal(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    principal: Principal,
) -> list[ClusterInventory]:
    user_team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    if not user_team_ids:
        return []
    # Which clusters does the principal touch?
    from app.models import TeamClusterToken
    rows = await db.execute(
        select(TeamClusterToken.cluster_id)
        .where(TeamClusterToken.team_id.in_(user_team_ids))
        .distinct()
    )
    cluster_ids = [r[0] for r in rows.all()]
    out: list[ClusterInventory] = []
    for cid in cluster_ids:
        out.append(await list_inventory_for_cluster(
            db, registry, principal=principal, cluster_id=cid,
        ))
    return out


def _vm_detail_from_payloads(
    resolved: ResolvedResource, *, status_payload: dict, config_payload: dict,
) -> VMDetail:
    item = resolved.vm_item
    raw_tags = config_payload.get("tags") or item.get("tags") or ""
    import re
    tag_list = [t for t in re.split(r"[;,\s]+", str(raw_tags)) if t]
    return VMDetail(
        cluster_id=resolved.cluster.id,
        vmid=int(item["vmid"]),
        name=item.get("name") or config_payload.get("name"),
        type=("lxc" if item.get("type") == "lxc" else "qemu"),
        node=str(item.get("node") or ""),
        status=str(status_payload.get("status") or item.get("status") or "unknown"),
        uptime=int(status_payload.get("uptime") or 0),
        cpu=float(status_payload.get("cpu") or 0.0),
        mem=int(status_payload.get("mem") or 0),
        maxcpu=int(status_payload.get("maxcpu") or item.get("maxcpu") or 0),
        maxmem=int(status_payload.get("maxmem") or item.get("maxmem") or 0),
        disk=int(status_payload.get("disk") or 0),
        maxdisk=int(status_payload.get("maxdisk") or item.get("maxdisk") or 0),
        netin=int(status_payload.get("netin") or 0),
        netout=int(status_payload.get("netout") or 0),
        diskread=int(status_payload.get("diskread") or 0),
        diskwrite=int(status_payload.get("diskwrite") or 0),
        tags=tag_list,
        description=config_payload.get("description"),
        raw_config=config_payload or {},
    )


async def get_vm_detail(
    db: AsyncSession,
    *,
    resolved: ResolvedResource,
) -> VMDetail:
    is_lxc = resolved.vm_item.get("type") == "lxc"
    node = str(resolved.vm_item.get("node") or "")
    vmid = int(resolved.vm_item["vmid"])
    status_payload = await resolved.connector.get_vm_status(
        node=node, vmid=vmid, is_lxc=is_lxc,
    )
    config_payload = await resolved.connector.get_vm_config(
        node=node, vmid=vmid, is_lxc=is_lxc,
    )
    # proxmoxer normalizes ``{"data": ...}`` — but a defensive `.get("data", x)`
    # keeps us safe if a fixture returns wrapped form.
    status_payload = status_payload.get("data", status_payload) if isinstance(status_payload, dict) else {}
    config_payload = config_payload.get("data", config_payload) if isinstance(config_payload, dict) else {}
    return _vm_detail_from_payloads(
        resolved,
        status_payload=status_payload if isinstance(status_payload, dict) else {},
        config_payload=config_payload if isinstance(config_payload, dict) else {},
    )


async def get_vm_rrd(
    *, resolved: ResolvedResource, query: RRDQuery,
) -> list[RRDSample]:
    is_lxc = resolved.vm_item.get("type") == "lxc"
    raw = await resolved.connector.rrddata(
        node=str(resolved.vm_item.get("node") or ""),
        vmid=int(resolved.vm_item["vmid"]),
        is_lxc=is_lxc,
        timeframe=query.timeframe,
        cf=query.cf,
    )
    rows = raw.get("data", raw) if isinstance(raw, dict) else raw
    return normalize_rrd_samples(rows or [])
```

Step 6 — Tests.

`backend/tests/test_inventory_access.py`:
1. `test_resolve_resource_returns_owning_team_for_member` — seed cluster + team + team_cluster_tokens with poolid='gui-team-1'; FakeProxmox `cluster.resources.get` returns a VM with `pool='gui-team-1'`; call resolve_resource; assert ResolvedResource.team_id == 1.
2. `test_resolve_resource_403_when_pool_mismatch` — VM has `pool='gui-team-99'`; principal is in team 1; expect HTTPException(403).
3. `test_resolve_resource_403_when_user_has_no_membership_on_cluster` — principal in team 1 but no team_cluster_tokens row for cluster X; expect 403.
4. `test_resolve_resource_404_when_cluster_missing` — call with cluster_id=9999; expect 404.
5. `test_resolve_resource_returns_stale_when_breaker_open` — seed cache + queue connection errors so breaker opens; resolve_resource for known VM returns is_stale=True.
6. `test_resolve_resource_admin_still_requires_team_token` — admin user with NO team_cluster_tokens for cluster expects 403 (not 200 with bootstrap fallback — Pitfall 7 + D-01 = no super-token).

`backend/tests/test_inventory_list.py`:
1. `test_list_inventory_for_cluster_filters_by_pool` — seed 2 VMs (one with team's pool, one without); assert only the team-owned VM appears.
2. `test_list_inventory_for_principal_aggregates_clusters` — 2 clusters, both with team_cluster_tokens for the user's team; assert response length == 2 with correct cluster names.
3. `test_list_inventory_stale_propagates` — induce breaker-open; assert ClusterInventory.is_stale == True AND items are still served from cache.
4. `test_list_inventory_empty_when_no_team_memberships` — user with no teams; expect empty list.
5. `test_list_inventory_tag_string_parsed_into_list` — VM with tags="prod;web,db ops" → assert item.tags == ['prod','web','db','ops'].

`backend/tests/test_inventory_detail.py`:
1. `test_get_vm_detail_merges_status_and_config` — admin path; FakeProxmox returns VM_STATUS_RUNNING + VM_CONFIG; assert VMDetail.cpu = 0.12, .description = "test VM", .tags includes "prod".
2. `test_get_vm_detail_for_lxc_calls_lxc_paths` — type='lxc'; assert FakeProxmox.calls includes a `*.lxc(<vmid>).status.current.get` chain.
3. `test_get_vm_detail_stopped_vm_zero_values_no_error` — VM_STATUS_STOPPED fixture with all-zero numerics; assert no validation error, status='stopped'.

`backend/tests/test_inventory_rrd.py`:
1. `test_get_vm_rrd_default_hour_average` — seed RRD_HOUR; assert samples len == 2, sample[0].cpu == 0.12.
2. `test_get_vm_rrd_invalid_timeframe_422` — call route /rrd?timeframe=decade; expect 422 (Pydantic Literal rejects).
3. `test_get_vm_rrd_invalid_cf_422` — cf=MIN; expect 422.
4. `test_get_vm_rrd_normalizes_missing_fields_to_zero` — RRD row with only `{"time": 123}`; assert all numeric fields default to 0.

Each test uses the FakeProxmox patch pattern from Plan 02-01.
  </action>
  <verify>
    <automated>cd backend && uv run pytest tests/test_inventory_list.py tests/test_inventory_detail.py tests/test_inventory_rrd.py tests/test_inventory_access.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "class VMInventoryItem" backend/app/inventory/schemas.py` returns 1 match.
    - `grep -n "class TagsUpdate" backend/app/inventory/schemas.py` returns 1 match.
    - `grep -nE "PVE_TAG_RE = re\.compile" backend/app/inventory/schemas.py` returns 1 match.
    - `grep -nE 'max_length=8000' backend/app/inventory/schemas.py` returns 1 match (NotesUpdate cap per D-15).
    - `grep -n "async def resolve_resource|async def require_resource_access" backend/app/inventory/access.py` returns 2 matches.
    - `grep -n 'detail="No access to that resource"' backend/app/inventory/access.py` returns 1 match (T-02-03-01 no-leak-existence).
    - `grep -nE "async def list_inventory_for_principal|async def list_inventory_for_cluster|async def get_vm_detail|async def get_vm_rrd" backend/app/inventory/service.py` returns 4 matches.
    - `grep -n "def normalize_rrd_samples" backend/app/inventory/rrd.py` returns 1 match.
    - `cd backend && uv run pytest tests/test_inventory_list.py tests/test_inventory_detail.py tests/test_inventory_rrd.py tests/test_inventory_access.py -x` exits 0.
  </acceptance_criteria>
  <done>
    - Schemas, RBAC dep, RRD util, and read service ready for consumption by Task 2 (routes + writes).
    - Per-team-token resolution + pool-match defense-in-depth verified by tests.
    - Cross-tenant attempts return 403 (not 404) consistently.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Inventory routes (GET list/detail/rrd; PUT tags/notes); audit-write integration; wire into main</name>
  <files>backend/app/inventory/routes.py, backend/app/inventory/service.py, backend/app/main.py, backend/tests/test_inventory_tags.py, backend/tests/test_inventory_notes.py, backend/tests/fixtures/pve_responses.py</files>
  <read_first>
    - backend/app/clusters/routes.py (full file — APIRouter shape, dependency injection of get_registry, csrf_protect on mutating routes, route order rule)
    - backend/app/inventory/service.py (just-written read service; ADD update_vm_tags + update_vm_notes here)
    - backend/app/inventory/access.py (require_resource_access dep — consumed by every per-VM route)
    - backend/app/audit/writer.py (Plan 02-02 — audit_write signature; commit-before-raise discipline)
    - backend/app/clusters/service.py:test_cluster (lines ~93-108 — PVE exception ladder pattern)
    - backend/app/main.py (where to wire the router)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md §"Common Operation 3" (update_vm_tags verbatim with audit-on-failure-and-success)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md §Pattern 5 (set_notes) + §Pattern 6 (set_tags joined with ";")
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-UI-SPEC.md §"Audit action labels" (exact action strings)
  </read_first>
  <behavior>
    - PUT /clusters/{cluster_id}/vms/{vmid}/tags: body `{"tags":[...]}`; validates tags via PVE_TAG_RE; dedups + sort-stable joins with ';'; calls connector.set_vm_config(tags=joined); audits action='vm.tag.update' with payload_before={'tags': old} payload_after={'tags': new}; invalidates cache via connector.set_vm_config (cache invalidate is inside Plan 02-01 connector method); returns updated VMDetail.
    - PUT /clusters/{cluster_id}/vms/{vmid}/notes: body `{"notes":"..."}`; max 8000 chars (Pydantic); writes connector.set_vm_config(description=notes); audits 'vm.notes.update' with payload before/after; returns VMDetail.
    - Failure path: PVE write throws → audit_write with result='failure' + error=str(exc) (scrubbed of token) → db.commit() → re-raise as 502/503 HTTPException.
    - LXC path: same routes also accept /lxcs/{vmid} — register parallel routes pointing to the same handler with `is_lxc=True` resolved from resource.vm_item.
    - Route order: register /me/inventory BEFORE /{cluster_id}/inventory (no path conflict here actually since prefixes differ; document for safety).
    - GET /clusters/{cluster_id}/vms/{vmid}/rrd validates timeframe/cf at the Query level (Pydantic Literal).
    - All mutating routes have `Depends(csrf_protect)`; all routes have `Depends(get_current_principal)` or the resource-access dep.
    - Token-scrubbing helper: `_scrub(message: str) -> str` strips any substring matching `PVEAPIToken=[^,]*` or hex token-like tails before placing into audit `error` field (T-02-02-08 / T-02-03-06 mitigation).
  </behavior>
  <action>
Step 1 — Add to `backend/app/inventory/service.py` (APPEND below the read functions):
```python
import re
from app.audit.writer import audit_write


_TOKEN_SCRUB_RE = re.compile(r"PVEAPIToken=[^\s,]+|token[_-]value=[^\s,]+", re.IGNORECASE)


def _scrub_pve_error(msg: str | None) -> str | None:
    """Strip PVE token substrings from an error message before persisting to
    AuditLog.error. T-02-03-06 mitigation."""
    if msg is None:
        return None
    return _TOKEN_SCRUB_RE.sub("[REDACTED]", str(msg))


async def update_vm_tags(
    db: AsyncSession,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    new_tags: list[str],
    source_ip: str | None,
    correlation_id: str | None = None,
) -> VMDetail:
    """Replace PVE tag set; audit before+after; commit-before-raise on failure."""
    from app.inventory.schemas import PVE_TAG_RE
    from fastapi import HTTPException, status

    # Defense-in-depth: schema already validated; assert again to keep service
    # honest if someone bypasses the route (admin script, future caller).
    for t in new_tags:
        if not PVE_TAG_RE.match(t):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=f"invalid tag format: {t!r}")

    # Old state from the resource snapshot (we already paid the cache lookup
    # in require_resource_access).
    old_raw = resolved.vm_item.get("tags") or ""
    old_tags = sorted({t for t in re.split(r"[;,\s]+", str(old_raw)) if t})
    joined = ";".join(sorted(set(new_tags)))

    is_lxc = resolved.vm_item.get("type") == "lxc"
    node = str(resolved.vm_item.get("node") or "")
    vmid = int(resolved.vm_item["vmid"])
    target_type = "lxc" if is_lxc else "vm"

    try:
        await resolved.connector.set_vm_config(
            node=node, vmid=vmid, is_lxc=is_lxc, tags=joined,
        )
    except Exception as exc:  # noqa: BLE001
        await audit_write(
            db, actor_user_id=principal.user.id,
            team_id=resolved.team_id, cluster_id=resolved.cluster.id,
            action="vm.tag.update", target_type=target_type, target_id=str(vmid),
            result="failure", source_ip=source_ip, correlation_id=correlation_id,
            payload_before={"tags": old_tags}, payload_after={"tags": sorted(set(new_tags))},
            error=_scrub_pve_error(str(exc)),
        )
        await db.commit()
        from app.clusters.errors import PVEUnreachable, PVEAuthError
        if isinstance(exc, PVEUnreachable):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                                detail="Couldn't reach the cluster.") from exc
        if isinstance(exc, PVEAuthError):
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail="Cluster auth failed; admin must re-validate the token.") from exc
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail="Couldn't update tags.") from exc

    await audit_write(
        db, actor_user_id=principal.user.id,
        team_id=resolved.team_id, cluster_id=resolved.cluster.id,
        action="vm.tag.update", target_type=target_type, target_id=str(vmid),
        result="success", source_ip=source_ip, correlation_id=correlation_id,
        payload_before={"tags": old_tags}, payload_after={"tags": sorted(set(new_tags))},
    )
    await db.commit()

    # Re-fetch detail (will use freshly invalidated cache).
    return await get_vm_detail(db, resolved=resolved)


async def update_vm_notes(
    db: AsyncSession,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    new_notes: str,
    source_ip: str | None,
    correlation_id: str | None = None,
) -> VMDetail:
    from fastapi import HTTPException, status

    if len(new_notes) > 8000:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Notes are limited to 8000 characters.")

    # Old state: fetch the current config to read description (the resource
    # cache item doesn't expose description).
    is_lxc = resolved.vm_item.get("type") == "lxc"
    node = str(resolved.vm_item.get("node") or "")
    vmid = int(resolved.vm_item["vmid"])
    target_type = "lxc" if is_lxc else "vm"

    try:
        current_cfg = await resolved.connector.get_vm_config(
            node=node, vmid=vmid, is_lxc=is_lxc,
        )
    except Exception as exc:  # noqa: BLE001
        await audit_write(
            db, actor_user_id=principal.user.id,
            team_id=resolved.team_id, cluster_id=resolved.cluster.id,
            action="vm.notes.update", target_type=target_type, target_id=str(vmid),
            result="failure", source_ip=source_ip, correlation_id=correlation_id,
            error=_scrub_pve_error(str(exc)),
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail="Couldn't read current notes.") from exc

    current_cfg = current_cfg.get("data", current_cfg) if isinstance(current_cfg, dict) else {}
    old_notes = (current_cfg or {}).get("description") or ""

    try:
        await resolved.connector.set_vm_config(
            node=node, vmid=vmid, is_lxc=is_lxc, description=new_notes,
        )
    except Exception as exc:  # noqa: BLE001
        await audit_write(
            db, actor_user_id=principal.user.id,
            team_id=resolved.team_id, cluster_id=resolved.cluster.id,
            action="vm.notes.update", target_type=target_type, target_id=str(vmid),
            result="failure", source_ip=source_ip, correlation_id=correlation_id,
            payload_before={"description": old_notes},
            payload_after={"description": new_notes},
            error=_scrub_pve_error(str(exc)),
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail="Couldn't update notes.") from exc

    await audit_write(
        db, actor_user_id=principal.user.id,
        team_id=resolved.team_id, cluster_id=resolved.cluster.id,
        action="vm.notes.update", target_type=target_type, target_id=str(vmid),
        result="success", source_ip=source_ip, correlation_id=correlation_id,
        payload_before={"description": old_notes},
        payload_after={"description": new_notes},
    )
    await db.commit()

    return await get_vm_detail(db, resolved=resolved)
```

Step 2 — `backend/app/inventory/routes.py` (NEW):
```python
"""Inventory HTTP surface — INV-01..08 + TENT-06 + API-05."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory import service
from app.inventory.access import ResolvedResource, require_resource_access
from app.inventory.schemas import (
    ClusterInventory, NotesUpdate, RRDQuery, RRDSample, TagsUpdate, VMDetail,
)

router = APIRouter()


def _get_registry(request: Request) -> PVEConnectorRegistry:
    return request.app.state.registry


# ---- /me/inventory aggregated across clusters ----
@router.get(
    "/me/inventory",
    response_model=list[ClusterInventory],
    summary="Aggregated inventory across all clusters the user can see",
    operation_id="inventory_me",
    dependencies=[Depends(get_current_principal)],
)
async def list_my_inventory(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> list[ClusterInventory]:
    return await service.list_inventory_for_principal(
        db, registry, principal=principal,
    )


# ---- /clusters/{cluster_id}/inventory per-cluster list ----
@router.get(
    "/clusters/{cluster_id}/inventory",
    response_model=ClusterInventory,
    summary="Per-cluster inventory (RBAC-scoped to principal's teams)",
    operation_id="inventory_for_cluster",
    dependencies=[Depends(get_current_principal)],
)
async def list_cluster_inventory(
    cluster_id: Annotated[int, Path(..., ge=1)],
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> ClusterInventory:
    return await service.list_inventory_for_cluster(
        db, registry, principal=principal, cluster_id=cluster_id,
    )


# ---- VM detail ----
@router.get(
    "/clusters/{cluster_id}/vms/{vmid}",
    response_model=VMDetail,
    summary="VM detail (status + config) with RBAC + stale-cache fallback",
    operation_id="inventory_vm_detail",
)
async def get_vm_detail_route(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.get_vm_detail(db, resolved=resolved)


# ---- LXC detail (mirror) ----
@router.get(
    "/clusters/{cluster_id}/lxcs/{vmid}",
    response_model=VMDetail,
    summary="LXC detail",
    operation_id="inventory_lxc_detail",
)
async def get_lxc_detail_route(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.get_vm_detail(db, resolved=resolved)


# ---- RRD metrics ----
@router.get(
    "/clusters/{cluster_id}/vms/{vmid}/rrd",
    response_model=list[RRDSample],
    summary="RRD metric samples for sparklines",
    operation_id="inventory_vm_rrd",
)
async def get_vm_rrd_route(
    timeframe: Annotated[Literal["hour","day","week","month","year"], Query()] = "hour",
    cf: Annotated[Literal["AVERAGE","MAX"], Query()] = "AVERAGE",
    resolved: ResolvedResource = Depends(require_resource_access),
) -> list[RRDSample]:
    return await service.get_vm_rrd(
        resolved=resolved, query=RRDQuery(timeframe=timeframe, cf=cf),
    )


@router.get(
    "/clusters/{cluster_id}/lxcs/{vmid}/rrd",
    response_model=list[RRDSample],
    summary="LXC RRD samples",
    operation_id="inventory_lxc_rrd",
)
async def get_lxc_rrd_route(
    timeframe: Annotated[Literal["hour","day","week","month","year"], Query()] = "hour",
    cf: Annotated[Literal["AVERAGE","MAX"], Query()] = "AVERAGE",
    resolved: ResolvedResource = Depends(require_resource_access),
) -> list[RRDSample]:
    return await service.get_vm_rrd(
        resolved=resolved, query=RRDQuery(timeframe=timeframe, cf=cf),
    )


# ---- PUT tags ----
@router.put(
    "/clusters/{cluster_id}/vms/{vmid}/tags",
    response_model=VMDetail,
    summary="Replace tags on a VM (PVE last-write-wins)",
    operation_id="inventory_vm_tags_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_vm_tags(
    request: Request,
    payload: TagsUpdate,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.update_vm_tags(
        db, principal=principal, resolved=resolved,
        new_tags=payload.tags,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )


@router.put(
    "/clusters/{cluster_id}/lxcs/{vmid}/tags",
    response_model=VMDetail,
    summary="Replace tags on an LXC",
    operation_id="inventory_lxc_tags_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_lxc_tags(
    request: Request,
    payload: TagsUpdate,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.update_vm_tags(
        db, principal=principal, resolved=resolved,
        new_tags=payload.tags,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )


# ---- PUT notes ----
@router.put(
    "/clusters/{cluster_id}/vms/{vmid}/notes",
    response_model=VMDetail,
    summary="Update PVE description (Markdown notes)",
    operation_id="inventory_vm_notes_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_vm_notes(
    request: Request,
    payload: NotesUpdate,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.update_vm_notes(
        db, principal=principal, resolved=resolved,
        new_notes=payload.notes,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )


@router.put(
    "/clusters/{cluster_id}/lxcs/{vmid}/notes",
    response_model=VMDetail,
    summary="Update LXC description",
    operation_id="inventory_lxc_notes_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_lxc_notes(
    request: Request,
    payload: NotesUpdate,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.update_vm_notes(
        db, principal=principal, resolved=resolved,
        new_notes=payload.notes,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )
```

Step 3 — `backend/app/main.py`. ADD inside create_app() router registration block:
```python
from app.inventory.routes import router as inventory_router
...
app.include_router(inventory_router, prefix="/api/v1", tags=["inventory"])
```
(Note: prefix `/api/v1` — the inventory router declares its own /me/inventory and /clusters/... subpaths so the final URLs are `/api/v1/me/inventory`, `/api/v1/clusters/{id}/inventory`, etc.)

Step 4 — Tests.

`backend/tests/test_inventory_tags.py`:
1. `test_put_tags_writes_to_pve_and_audits` — admin login; FakeProxmox accepting cluster.resources.get + nodes(...).qemu(...).config.put; PUT /clusters/1/vms/100/tags {"tags":["prod","web"]}; assert 200; assert FakeProxmox.calls includes `("nodes.pve-01.qemu.100.config.put", (), {"tags": "prod;web"})` (sorted+joined); assert AuditLog row exists with action="vm.tag.update" result="success" payload_before={"tags":[]} payload_after={"tags":["prod","web"]}.
2. `test_put_tags_invalid_regex_returns_422_no_audit` — PUT with tags=["Prod!", "@@@"]; assert 422; assert no AuditLog row was inserted (validation happens at the schema layer before service runs).
3. `test_put_tags_pve_unreachable_returns_502_and_audits_failure` — connector throws PVEUnreachable; PUT; assert 502; assert AuditLog row with result="failure" + error not None + error does NOT contain "PVEAPIToken=" or "token_value=" (token scrubbed).
4. `test_put_tags_csrf_required` — session-auth POST without X-CSRF-Token; expect 403.
5. `test_put_tags_pat_auth_bypasses_csrf` — Bearer pat_… header; PUT works without CSRF token; assert AuditLog row has actor_pat_id populated (NOTE: actor_pat_id population is OUT OF SCOPE if PAT plumbing doesn't yet expose pat_id on Principal — if so, document as TODO and assert actor_user_id is correct via resolve_pat lookup; document the gap in the SUMMARY).
6. `test_put_tags_cross_tenant_returns_403_audits_nothing` — non-admin user not in the target VM's team; PUT; expect 403; the require_resource_access dep raises BEFORE service runs so no audit row is written by the service. (Phase 5 polish item: explicit access-denied audit; tracked as backlog.)
7. `test_put_tags_invalidates_cache` — call list_inventory_for_cluster (populates cache); PUT tags; call list_inventory_for_cluster again; assert FakeProxmox.calls shows a NEW cluster.resources.get after the PUT (cache invalidate worked).

`backend/tests/test_inventory_notes.py`:
1. `test_put_notes_writes_description_and_audits` — PUT /clusters/1/vms/100/notes {"notes":"# Hello\\nWorld"}; assert FakeProxmox.calls includes `(..., "nodes.pve-01.qemu.100.config.put", (), {"description":"# Hello\\nWorld"})`; assert AuditLog action="vm.notes.update" payload_after.description == "# Hello\\nWorld".
2. `test_put_notes_8001_chars_returns_422` — notes = "x" * 8001; expect 422.
3. `test_put_notes_pve_failure_audits_then_502` — PVE put raises; expect 502 + audit row failure + scrubbed error.
4. `test_put_notes_csrf_required` — same as tags CSRF test.

Step 5 — Append PVE response fixtures to `backend/tests/fixtures/pve_responses.py`:
```python
VM_STATUS_STOPPED = {"data": {"status": "stopped", "uptime": 0, "cpu": 0,
                              "mem": 0, "maxmem": 4294967296, "netin": 0, "netout": 0,
                              "diskread": 0, "diskwrite": 0}}
CONFIG_PUT_OK = {"data": None}  # PVE config.put returns null on success
```
  </action>
  <verify>
    <automated>cd backend && uv run pytest tests/test_inventory_tags.py tests/test_inventory_notes.py tests/test_inventory_list.py tests/test_inventory_detail.py tests/test_inventory_rrd.py tests/test_inventory_access.py -x -v && uv run ruff check app/inventory/ tests/test_inventory_*.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "@router\.put\("/clusters/\{cluster_id\}/vms/\{vmid\}/(tags|notes)"" backend/app/inventory/routes.py` returns 2 matches.
    - `grep -nE "@router\.put\("/clusters/\{cluster_id\}/lxcs/\{vmid\}/(tags|notes)"" backend/app/inventory/routes.py` returns 2 matches.
    - `grep -nE "@router\.get\("/me/inventory"|@router\.get\("/clusters/\{cluster_id\}/inventory"|@router\.get\("/clusters/\{cluster_id\}/vms/\{vmid\}"|@router\.get\("/clusters/\{cluster_id\}/vms/\{vmid\}/rrd"" backend/app/inventory/routes.py` returns 4 matches.
    - `grep -n "Depends(csrf_protect)" backend/app/inventory/routes.py` returns at least 4 matches (every PUT route).
    - `grep -nE "async def update_vm_tags|async def update_vm_notes|def _scrub_pve_error" backend/app/inventory/service.py` returns 3 matches.
    - `grep -n "_TOKEN_SCRUB_RE" backend/app/inventory/service.py` returns at least 1 match.
    - `grep -n "await audit_write" backend/app/inventory/service.py` returns at least 4 matches (success + failure path for each of tags/notes).
    - `grep -nE "await db\.commit\(\)" backend/app/inventory/service.py` returns at least 4 matches (commit-before-raise on failure + commit-after-success).
    - `grep -n 'app.include_router(inventory_router' backend/app/main.py` returns 1 match.
    - `cd backend && uv run pytest tests/test_inventory_tags.py tests/test_inventory_notes.py -x` exits 0.
    - `cd backend && uv run pytest -x` (full suite) exits 0.
    - `cd backend && uv run ruff check app/inventory/ tests/test_inventory_*.py` exits 0.
  </acceptance_criteria>
  <done>
    - All seven endpoints (GET me/inventory, GET clusters/{}/inventory, GET vms/{}, GET lxcs/{}, GET vms/{}/rrd, GET lxcs/{}/rrd, PUT vms/{}/tags, PUT vms/{}/notes — plus LXC mirrors) implemented.
    - csrf_protect on every PUT; PAT auth path covered by tests.
    - Audit writes on both success AND failure paths; token-scrubbing applied to error column.
    - Cross-tenant 403 leaks no existence (T-02-03-01).
    - Pre-existing test suite green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → FastAPI | Inventory + tag + notes requests; cookie or Bearer PAT. |
| FastAPI → Proxmox VE | Per-team privsep token (Plan 02-01 get_for_team) — NEVER the bootstrap token. |
| Service → AuditLog | Audit row inserted before commit; commit-before-raise on failure paths. |
| Backend → log/exception payloads | PVE error strings may contain `PVEAPIToken=USER@REALM!ID=UUID` — must be scrubbed before audit. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-03-01 | Information Disclosure | Cross-tenant existence leak via 404-vs-403 timing | mitigate | `require_resource_access` returns 403 with body `"No access to that resource"` whether VM doesn't exist OR belongs to a tenant the principal can't see (Pitfall 5 invariant carryover from Phase 1). Test `test_resolve_resource_403_when_pool_mismatch` covers both branches with same status+body. |
| T-02-03-02 | Information Disclosure | Cross-tenant inventory leak via filter-in-Python | mitigate | List uses per-team privsep token; the PVE token's ACL filters /cluster/resources server-side. Defense-in-depth pool match in `list_inventory_for_cluster` (Pitfall 11 carryover). |
| T-02-03-03 | Tampering | XSS via tag string into UI | mitigate | Server-side TagsUpdate validator (PVE_TAG_RE) rejects anything outside `[a-z0-9_\-\+\.]*` — no `<` `>` `'` `"` characters can survive. Frontend renders tags as text via `{tag}` (not `{@html}`); no XSS surface. |
| T-02-03-04 | Elevation of Privilege | Pool-mismatch token accepted (team A holds token but PVE never enforced ACL) | mitigate | Defense-in-depth: `resolve_resource` ALSO asserts `vm_item.pool == team_cluster_tokens.poolid`. Even if Phase 1 minted a token with a bug, our code rejects pool mismatches. |
| T-02-03-05 | DoS | Tag/notes write storm exhausts PVE rate limits | accept | Phase 2 single-LXC v1 has no documented PVE rate-limit ceiling that would trip on solo-developer usage. Phase 5 (carryover IN-01) tracks per-Principal rate limiting on /inventory/*. Documented as known gap. |
| T-02-03-06 | Information Disclosure | PVE token string in AuditLog.error | mitigate | `_scrub_pve_error` regex strips `PVEAPIToken=...` and `token_value=...` substrings before write. Test `test_put_tags_pve_unreachable_returns_502_and_audits_failure` asserts the substring is absent. |
| T-02-03-07 | Tampering | Notes (PVE description) markdown XSS | accept-in-this-plan | Mitigation lives in the frontend (Plan 02-05) via marked + DOMPurify allow-list (T-02-05-XX). Backend stores raw markdown; the Pitfall 4 of 02-RESEARCH documents the boundary. |
| T-02-03-08 | Repudiation | Successful tag/notes write not audited | mitigate | Service always calls audit_write on the success path BEFORE await db.commit(). Test `test_put_tags_writes_to_pve_and_audits` + `test_put_notes_writes_description_and_audits` assert presence. |
| T-02-03-09 | Tampering | Stale cache served after a team-membership change in the same session | accept | RBAC re-queries TeamMembership on every request via `_team_ids_for_user`. The connector cache is per-cluster (not per-team)`, so cached snapshots stay correct — the access dep just sees a different team set. |
| T-02-03-10 | Spoofing | Forged X-Forwarded-For populates AuditLog.source_ip | mitigate | `extract_source_ip` from Plan 02-02 honors XFF only from {127.0.0.1, ::1} (Caddy upstream). |

ASVS L1 satisfied for this plan's surface; no HIGH-and-Open threats.
</threat_model>

<verification>
- Task 1 + Task 2 automated checks pass.
- Cross-tenant attempt test (`test_resolve_resource_403_when_pool_mismatch`) green.
- Stale-cache test green (snapshot served with is_stale=True after breaker open).
- Cookie AND PAT auth paths both tested on PUT endpoints (`test_put_tags_pat_auth_bypasses_csrf`).
- Token-scrubbing test green (`error` column never contains `PVEAPIToken=`).
- Phase 1 + Plan 02-01 + Plan 02-02 test suites still green.
</verification>

<success_criteria>
- Seven core endpoints shipped: GET /me/inventory, GET /clusters/{id}/inventory, GET /clusters/{id}/vms/{vmid}, GET /clusters/{id}/lxcs/{vmid}, GET /clusters/{id}/vms/{vmid}/rrd, PUT /clusters/{id}/vms/{vmid}/tags, PUT /clusters/{id}/vms/{vmid}/notes (plus LXC mirrors for the per-resource ones).
- TENT-06 enforced via per-team privsep token + pool-match defense-in-depth.
- INV-01..08 + API-05 satisfied.
- Audit row written for every tag/notes mutation (success AND failure).
- Token-scrub regex strips PVE secrets before audit persistence.
- CSRF enforced on every mutating route; PAT bypasses CSRF.
</success_criteria>

<output>
After completion, create `.planning/phases/02-multi-cluster-inventory-quotas-audit/02-03-inventory-backend-SUMMARY.md`:
- Files added/modified + test count
- Whether PAT actor_pat_id propagation was implementable in this plan or deferred (depends on what Principal exposes today)
- The exact ResolvedResource shape returned by require_resource_access (so Plan 02-04 + 02-05 know the interface)
- Confirmation that PVE config.put for tags + description does NOT return a UPID (per Assumption A2 in 02-RESEARCH — smoke-test result on a real cluster if available; otherwise note as a Plan 02-07 operator-smoke checkpoint item)
- Any cross-tenant tests that revealed edge cases needing Phase 3 follow-up
</output>
