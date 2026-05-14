# Phase 2: Multi-Cluster Inventory, Quotas & Audit — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 38 new + 4 modified
**Analogs found:** 38 / 42

This pattern map is the per-file copy-from index for Phase 2 plans. Every new
file's role + data-flow has been classified, and a Phase-1 analog selected
where one exists. Each entry includes concrete excerpts with file paths and
line numbers — planners reference these directly in plan actions instead of
re-describing the conventions.

---

## File Classification

### Backend — new files

| New file | Role | Data flow | Closest analog | Match quality |
|----------|------|-----------|----------------|---------------|
| `backend/app/inventory/routes.py` | route handler | request-response (read) + PVE-proxy write | `backend/app/clusters/routes.py` | exact (route + dep + service split) |
| `backend/app/inventory/service.py` | service | PVE proxy + cache + PVE-write | `backend/app/clusters/service.py` | role-match (PVE call orchestration) |
| `backend/app/inventory/schemas.py` | schema | request-response | `backend/app/clusters/schemas.py` | exact |
| `backend/app/inventory/rrd.py` | utility | transform | (none — no Phase-1 PVE-data-shape util) | none — defer to RESEARCH §RRD |
| `backend/app/audit/writer.py` | service primitive | event sink | `backend/app/auth/service.py:revoke_user_sessions` (lines 232–257) | role-match (sync-before-commit pattern) |
| `backend/app/audit/reader.py` | service | CRUD (read) | `backend/app/teams/service.py:list_teams` (lines 226–242) | role-match (SQL build + RBAC predicate) |
| `backend/app/audit/csv.py` | utility | streaming | (none — no streaming util in Phase 1) | none — see RESEARCH Pattern 7 |
| `backend/app/audit/routes.py` | route handler | request-response + streaming | `backend/app/clusters/routes.py` (GET routes) | exact for /audit; StreamingResponse novel |
| `backend/app/audit/schemas.py` | schema | request-response | `backend/app/clusters/schemas.py` | exact |
| `backend/app/quotas/admission.py` | service primitive | transactional check | `backend/app/teams/service.py:create_team` (lines 40–128, BEGIN-tx pattern) | role-match (DB write in tx + rollback) |
| `backend/app/quotas/service.py` | service | CRUD | `backend/app/teams/service.py` | exact (CRUD shape) |
| `backend/app/quotas/routes.py` | route handler | request-response | `backend/app/teams/routes.py` | exact |
| `backend/app/quotas/schemas.py` | schema | request-response | `backend/app/teams/schemas.py` | exact |
| `backend/app/clusters/health.py` | background task | event-driven | (none — no Phase-1 background task) | none — RESEARCH Pattern 2 |
| `backend/app/core/csv.py` | utility | transform | `backend/app/core/csrf.py` (stateless helper module) | partial (module shape only) |

### Backend — extended files

| Modified file | Phase-2 additions | Analog for the addition |
|---------------|-------------------|-------------------------|
| `backend/app/clusters/connector.py` | `list_resources`, `get_vm_status`, `get_vm_config`, `set_vm_config`, `rrddata`, `pool_members`, breaker, 30s cache | self-extend; follow existing `version()` method shape (lines 88–100) |
| `backend/app/clusters/registry.py` | per-team-token connector resolution | self-extend; current `get()` method (lines 55–99) becomes one path of two |
| `backend/app/main.py` | router includes for `inventory`, `audit`, `quotas`; health-probe lifespan hook | self-extend; existing `include_router` block (lines 145–166) and lifespan (lines 41–74) |
| `backend/alembic/versions/0003_phase2.py` | per-cluster quota columns, audit indices | `backend/alembic/versions/0002_add_uq_one_admin.py` (full file) for migration shape; `0001_initial.py` lines 47–110 for `op.create_table` style |

### Frontend — new files

| New file | Role | Data flow | Closest analog | Match quality |
|----------|------|-----------|----------------|---------------|
| `frontend/src/routes/inventory/+page.svelte` | page | request-response (SSR-seeded) | `frontend/src/routes/admin/clusters/+page.svelte` | exact (list page + actions) |
| `frontend/src/routes/inventory/+page.server.ts` | SSR loader | request-response | `frontend/src/routes/admin/clusters/+page.server.ts` | exact |
| `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` | page (tabs container) | request-response | `frontend/src/routes/admin/clusters/[id]/+page.svelte` (lines 1–80) | partial (detail page; no tabs yet) |
| `frontend/src/routes/inventory/[cluster]/[vmid]/+page.server.ts` | SSR loader | request-response | `frontend/src/routes/admin/clusters/+page.server.ts` | exact |
| `frontend/src/routes/inventory/[cluster]/[vmid]/activity/+page.svelte` | sub-page (tab content) | request-response | `frontend/src/routes/admin/clusters/+page.svelte` (Table use) | partial |
| `frontend/src/routes/audit/+page.svelte` | page (filter + table) | request-response | `frontend/src/routes/admin/clusters/+page.svelte` | exact (list with toolbar) |
| `frontend/src/routes/audit/+page.server.ts` | SSR loader | request-response | `frontend/src/routes/admin/clusters/+page.server.ts` | exact |
| `frontend/src/lib/api/inventory.ts` | API client | request-response | `frontend/src/lib/api/clusters.ts` | exact |
| `frontend/src/lib/api/audit.ts` | API client | request-response | `frontend/src/lib/api/clusters.ts` | exact |
| `frontend/src/lib/api/quotas.ts` | API client | request-response | `frontend/src/lib/api/teams.ts` | exact |
| `frontend/src/lib/components/inventory/ClusterSection.svelte` | component | render-only | `frontend/src/lib/components/clusters/ClusterStatusPill.svelte` (typed props + class derivation) | role-match |
| `frontend/src/lib/components/inventory/FilterChip.svelte` | component | render-only | `frontend/src/lib/components/clusters/ClusterStatusPill.svelte` | role-match |
| `frontend/src/lib/components/inventory/TagPill.svelte` | component | render-only | `frontend/src/lib/components/clusters/ClusterStatusPill.svelte` | exact (pill shape + token-only colors) |
| `frontend/src/lib/components/inventory/TagInput.svelte` | component | request-response (optimistic) | `frontend/src/routes/admin/clusters/+page.svelte` (handleDelete optimistic, lines 92–111) | partial |
| `frontend/src/lib/components/inventory/MarkdownNotes.svelte` | component | request-response | `frontend/src/routes/profile/+page.svelte` (form pattern, lines 21–80) | role-match |
| `frontend/src/lib/components/inventory/Sparkline.svelte` | component | render-only | (no SVG-chart analog in Phase 1) | none — hand-rolled per RESEARCH §INV-05 |
| `frontend/src/lib/components/inventory/ClusterContextPicker.svelte` | component | localStorage-state | `frontend/src/lib/components/layout/Topbar.svelte` (lines 67–88 — the disabled `<Select>` it replaces) | exact slot (drop-in) |
| `frontend/src/lib/components/audit/AuditTable.svelte` | component | render-only | `frontend/src/routes/admin/clusters/+page.svelte` Table block (lines 175–262) | exact (Table.Root + Table.Header + each row) |
| `frontend/src/lib/components/audit/CsvExportButton.svelte` | component | streaming-download trigger | (no analog) | none — see RESEARCH §CSV |
| `frontend/src/lib/components/quotas/QuotaIndicator.svelte` | component | localStorage + render | `frontend/src/lib/components/layout/ThemeToggle.svelte` (Topbar-mounted compact control) + ClusterStatusPill (token-only colors) | role-match |
| `frontend/src/lib/components/quotas/QuotaTab.svelte` | component (form) | CRUD | `frontend/src/routes/admin/clusters/[id]/+page.svelte` (PATCH form, lines 1–120) | exact (form + PATCH + FormSummaryAlert) |
| `frontend/src/lib/utils/markdown.ts` | utility | transform | `frontend/src/lib/utils/api.ts` (stateless module shape) | partial (shape only) |

### Frontend — extended files

| Modified file | Phase-2 additions | Analog within the file |
|---------------|-------------------|------------------------|
| `frontend/src/lib/components/layout/Topbar.svelte` | replace disabled `<Select>` with `ClusterContextPicker`; mount `QuotaIndicator` left of `ThemeToggle` | lines 67–88 (current disabled `<Select>` slot is the drop-in target); line 91 (`<ThemeToggle />`) — insert `<QuotaIndicator />` before it |
| `frontend/src/lib/components/layout/Sidebar.svelte` | new "Resources" section above "Account" | lines 31–35 (`accountItems`) — mirror the constant + the loop block (lines 68–92) for `resourcesItems` |
| `frontend/src/lib/api/client.ts` | export `inventory`, `audit`, `quotas` modules | lines 27–44 (existing exports) — append three imports and three keys |
| `frontend/src/routes/admin/teams/[id]/+page.svelte` (NEW in Phase 1 plan but not built; Phase 2 lands the tabbed page) | Members tab (existing intent) + Quotas tab | Phase 1's `admin/clusters/[id]/+page.svelte` for the form shape; `ui/tabs` block (already in deps, see `frontend/src/lib/components/ui/tabs/index.ts`) for the tab strip |

### Frontend — tests (new)

| New test file | Role | Analog |
|---------------|------|--------|
| `frontend/tests/components/markdown.test.ts` | unit | `frontend/tests/components/ConfirmByNameDialog.test.ts` |
| `frontend/tests/api-client-inventory.test.ts` (or append to existing) | unit | `frontend/tests/api-client.test.ts` |

### Backend — tests (new)

| New test file | Role | Analog |
|---------------|------|--------|
| `backend/tests/test_inventory.py` | E2E route | `backend/tests/test_clusters.py` |
| `backend/tests/test_audit.py` | E2E route | `backend/tests/test_clusters.py` + `backend/tests/test_disable_user_revokes.py` (audit writer side-effect) |
| `backend/tests/test_quotas.py` | E2E + unit | `backend/tests/test_clusters.py` + `backend/tests/test_connector.py` (for admission unit test) |
| `backend/tests/test_connector_cache.py` (extend `test_connector.py`) | unit | `backend/tests/test_connector.py` |

---

## Pattern Assignments

### `backend/app/inventory/routes.py` (route handler, request-response)

**Analog:** `backend/app/clusters/routes.py`

**Imports pattern** (clusters/routes.py lines 16–31):
```python
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import csrf_protect, require_admin
from app.clusters import service
from app.clusters.registry import PVEConnectorRegistry
from app.clusters.schemas import (
    ClusterCreate,
    ClusterResponse,
    ...
)
from app.core.db import get_db

router = APIRouter()
```

Phase 2 swaps `require_admin` → `get_current_principal` for non-admin
inventory access, and replaces the `clusters.service` import with
`inventory.service`. The registry import + the `get_registry` dependency
helper carry forward unchanged.

**`get_registry` dependency** (clusters/routes.py lines 36–51) — REUSE: import
`from app.clusters.routes import get_registry` exactly as `teams/routes.py`
does (teams/routes.py line 17).

**Read route pattern** (clusters/routes.py lines 101–112 — `list_clusters`):
```python
@router.get(
    "/",
    response_model=list[ClusterResponse],
    summary="List all registered clusters",
    operation_id="clusters_list",
    dependencies=[Depends(require_admin)],
)
async def list_clusters(
    db: AsyncSession = Depends(get_db),
) -> list[ClusterResponse]:
    rows = await service.list_clusters(db)
    return [ClusterResponse.model_validate(r) for r in rows]
```

For Phase 2 inventory, replace `require_admin` with a new dependency
`require_resource_access(cluster_id, vmid)` (planner specifies; analog
shape is `require_admin` lines 126–139 of `auth/dependencies.py`).

**Mutating-route pattern with CSRF** (clusters/routes.py lines 84–98 —
`create_cluster`):
```python
@router.post(
    "/",
    response_model=ClusterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Proxmox cluster",
    operation_id="clusters_create",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def create_cluster(
    payload: ClusterCreate,
    db: AsyncSession = Depends(get_db),
) -> ClusterResponse:
    cluster = await service.register_cluster(db, payload=payload)
    return ClusterResponse.model_validate(cluster)
```

Phase 2 mutating routes (`PUT /vms/{vmid}/tags`, `PUT /vms/{vmid}/notes`,
`PUT /teams/{id}/quotas`) follow this shape exactly — `csrf_protect` and the
appropriate auth dep on `dependencies=[…]`, payload-by-Pydantic, service
function does the work.

**Route order rule** (clusters/routes.py lines 1–14 — module docstring):
> Route order matters: `POST /test` (dry-run) MUST be declared BEFORE
> `POST /{cluster_id}/test` (re-validate stored), otherwise FastAPI's path
> matcher would route `/test` to the integer-coerced `{cluster_id}`
> variant and yield 422.

Apply to Phase 2: declare any fixed-segment route (e.g. `/quotas/preview`)
BEFORE the parameterized `/{id}/quotas` route.

---

### `backend/app/inventory/service.py` (service, PVE proxy + cache + write)

**Analog:** `backend/app/clusters/service.py`

**Imports pattern** (clusters/service.py lines 23–39):
```python
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.clusters.connector import PVEConnector
from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
from app.clusters.registry import PVEConnectorRegistry
from app.clusters.schemas import ...
from app.models import Cluster, TeamClusterToken
```

**PVE-call exception handling** (clusters/service.py lines 93–108 — `test_cluster`):
```python
try:
    version_payload = await connector.version()
except PVEAuthError:
    return ClusterTestResponse(ok=False, error="Proxmox rejected that token.")
except PVEUnreachable:
    return ClusterTestResponse(ok=False, error="Couldn't reach that URL.")
except PVEAPIError:
    return ClusterTestResponse(
        ok=False, error="Proxmox returned an unexpected error.",
    )
```

For Phase 2 inventory reads: a list-VMs handler that catches `PVEUnreachable`
and returns `(stale_snapshot, is_stale=True)` per RESEARCH Pattern 1.

**Validate-before-persist (Pitfall A4) for mutating writes** (clusters/service.py
lines 135–174):
```python
# Pitfall A4: validate BEFORE persist.
try:
    await connector.validate()
except PVEAuthError as exc:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Proxmox rejected that token.",
    ) from exc
except PVEUnreachable as exc:
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Couldn't reach that Proxmox URL.",
    ) from exc
...
cluster = Cluster(...)
db.add(cluster)
try:
    await db.commit()
except IntegrityError as exc:
    await db.rollback()
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        ...
    ) from exc
```

For Phase 2 `set_tags` / `set_notes`: do the PVE write FIRST (via
`connector._call_with_breaker(...)`), then invalidate cache (per
RESEARCH Pattern 5 + 6).

**Service-layer commit-before-raise** (referenced in CLAUDE.md/CONTEXT
"Service-Layer commits BEFORE raising HTTPException"). Concrete excerpt:
`backend/app/auth/service.py:revoke_user_sessions` lines 246–257:
```python
await revoke_all_for_user(db, user_id=user_id)
await db.execute(
    update(PersonalAccessToken)
    .where(...)
    .values(revoked_at=datetime.now(UTC))
)
await db.commit()
```

The commit happens BEFORE returning. Phase 2 mutating services follow this:
PVE-write → DB-write audit-row → commit → return. If audit-write fails,
the request fails (D-20 sync-before-return audit).

---

### `backend/app/inventory/schemas.py` (Pydantic schemas)

**Analog:** `backend/app/clusters/schemas.py` + `backend/app/teams/schemas.py`

**`extra="forbid"` invariant** (teams/schemas.py lines 19–27):
```python
class TeamCreate(BaseModel):
    """Body for ``POST /api/v1/teams/``.

    ``extra="forbid"`` means any additional field (notably ``personal=True``)
    fails validation with 422. D-05 immutability gate.
    """

    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=128)
```

Every Phase 2 write schema (`TagsUpdate`, `NotesUpdate`, `QuotaLimitUpdate`,
`AuditFilter`) uses `model_config = ConfigDict(extra="forbid")`.

**Response schema with `from_attributes`** (teams/schemas.py lines 49–60):
```python
class TeamResponse(BaseModel):
    """List/POST projection — includes ``member_count`` (computed)."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    personal: bool
    is_active: bool
    member_count: int = 0
    created_at: datetime
    updated_at: datetime
```

Phase 2 `VMInventoryItem`, `VMDetail`, `AuditEntry`, `QuotaUsage` follow
this exact shape.

**Custom field validator** (clusters/schemas.py lines 51–63):
```python
@field_validator("host")
@classmethod
def _validate_host(cls, v: str) -> str:
    return _reject_url_in_host(v)

@field_validator("token_user")
@classmethod
def _validate_token_user(cls, v: str) -> str:
    if not _TOKEN_USER_RE.match(v):
        raise ValueError(...)
    return v
```

Apply for Phase 2 tag-format validation (`TagsUpdate.tags` must each match
`^[a-z0-9_-]+$` — see RESEARCH Pattern 6 — though canonical pattern in
PVE is wider; clientside D-14 narrows, server is defense-in-depth wider).

---

### `backend/app/audit/writer.py` (audit primitive, event sink)

**Analog:** `backend/app/auth/service.py:revoke_user_sessions` (lines 232–257)

**Sync-before-commit pattern**:
```python
async def revoke_user_sessions(
    db: AsyncSession,
    *,
    user_id: int,
) -> None:
    await revoke_all_for_user(db, user_id=user_id)
    await db.execute(
        update(PersonalAccessToken)
        .where(
            PersonalAccessToken.user_id == user_id,
            PersonalAccessToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()
```

For `audit_write`: same shape, but instead of `commit()` the function calls
`await db.flush()` and lets the caller commit (see RESEARCH Pattern 4 —
the writer is INSIDE the caller's transaction).

**Direct ORM-row insertion pattern** (factories.py lines 41–58):
```python
async with session_factory() as session:
    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        is_admin=is_admin,
        is_active=is_active,
    )
    session.add(user)
    await session.flush()
```

Phase 2 audit writer constructs `AuditLog(...)` (model at
`backend/app/models/audit_log.py` lines 28–67) and `db.add(entry)` +
`await db.flush()` — no commit (caller owns tx).

---

### `backend/app/audit/reader.py` (service, SQL build + RBAC)

**Analog:** `backend/app/teams/service.py:list_teams` (lines 226–242)

**Query-with-aggregation pattern**:
```python
count_sq = (
    select(
        TeamMembership.team_id,
        func.count(TeamMembership.user_id).label("member_count"),
    )
    .group_by(TeamMembership.team_id)
    .subquery()
)
result = await db.execute(
    select(Team, func.coalesce(count_sq.c.member_count, 0))
    .outerjoin(count_sq, Team.id == count_sq.c.team_id)
    .order_by(Team.id)
)
return [(team, int(count)) for team, count in result.all()]
```

Phase 2 audit reader builds the SELECT with `where(...)` clauses for filter
params + an RBAC OR-expression `(actor_user_id == me OR (team_id IN my_teams
AND show_team_actions))`. Pagination via `.limit().offset()`. For CSV
streaming, switch to `await db.stream_scalars(query)` per RESEARCH Pattern 7.

---

### `backend/app/audit/routes.py` (mixed: GET + StreamingResponse)

**Analog:** `backend/app/clusters/routes.py` for the GET list; the
`StreamingResponse` for `/export.csv` has no Phase-1 analog — see RESEARCH
Pattern 7 verbatim.

**Read route (no admin gate; RBAC is in the service)**:
```python
@router.get(
    "/",
    response_model=AuditPage,
    summary="List audit entries (RBAC-scoped)",
    operation_id="audit_list",
    dependencies=[Depends(get_current_principal)],
)
async def list_audit(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    # ... query params ...
) -> AuditPage:
    return await reader.list_audit(db, principal=principal, filters=filters)
```

(Shape mirrors `me/routes.py` lines 28–45 — the `get_current_principal`
dependency, not `require_admin`.)

---

### `backend/app/quotas/admission.py` (service primitive, transactional)

**Analog:** `backend/app/teams/service.py:create_team` (lines 40–128)

**Atomic-transaction-with-rollback pattern**:
```python
team = Team(name=name, personal=personal, is_active=True)
db.add(team)
try:
    await db.flush()
except IntegrityError as exc:
    await db.rollback()
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="A team with that name already exists.",
    ) from exc

# D-02: auto-bootstrap on every active cluster (shared teams only).
if auto_bootstrap and not personal:
    if registry is None:
        ...
    else:
        try:
            await bootstrap_tenant_on_clusters(
                db, registry, team=team, comment=name,
            )
        except Exception:
            # Roll back team row + any inserted token rows.
            await db.rollback()
            raise

try:
    await db.commit()
except IntegrityError as exc:
    ...
```

For admission: open `BEGIN IMMEDIATE` (per RESEARCH Pattern 3), SELECT
current usage + limit row, compute proposed, raise `HTTPException(409)` with
admission-failure shape if exceeded, else commit. Rollback on every failure
path.

**SQLite PRAGMA + `BEGIN IMMEDIATE` rationale** — `backend/app/core/db.py`
lines 60–71 already set `busy_timeout = 5000`:
```python
@event.listens_for(engine.sync_engine, "connect")
def _apply_sqlite_pragmas(dbapi_conn, _connection_record) -> None:
    cur = dbapi_conn.cursor()
    try:
        cur.execute("PRAGMA journal_mode = WAL")
        cur.execute("PRAGMA synchronous = NORMAL")
        cur.execute("PRAGMA foreign_keys = ON")
        cur.execute("PRAGMA busy_timeout = 5000")
    finally:
        cur.close()
```

No additions needed to `db.py`; the admission service issues the
`BEGIN IMMEDIATE` explicitly via `await db.execute(text("BEGIN IMMEDIATE"))`
per RESEARCH Pattern 3.

---

### `backend/app/clusters/connector.py` (EXTENDED — cache + breaker)

**Self-extend, follow existing method shape:**

**Existing `version()` (lines 88–100):**
```python
async def version(self) -> dict:
    """``GET /version`` — returns ``{"version": ..., "release": ..., "repoid": ...}``."""
    try:
        return await self._call(self._client.version.get)
    except AuthenticationError as exc:
        raise PVEAuthError(str(exc)) from exc
    except (ConnectionError, requests.ConnectionError) as exc:
        raise PVEUnreachable(str(exc)) from exc
    except ResourceException as exc:
        raise PVEAPIError(
            getattr(exc, "status_code", 0),
            getattr(exc, "content", "") or str(exc),
        ) from exc
```

**Pattern for new methods (`list_resources`, `get_vm_status`, etc.):**
Same exception ladder. Wrap the call in
`self._call_with_breaker(...)` instead of `self._call(...)`. See RESEARCH
Pattern 1 for `_call_with_breaker` impl. Cache reads use `ResourceCache`
(dataclass + asyncio.Lock).

**`asyncio.to_thread` requirement (Pitfall A3)** — connector.py lines 75–82:
```python
async def _call(self, fn: Any, *args: Any, **kwargs: Any) -> Any:
    """proxmoxer 2.3 has no async backend; bridge through the executor.

    Pitfall A3: every PVE call MUST go through this helper. The CI grep
    ``grep -q 'asyncio.to_thread' backend/app/clusters/connector.py``
    documents this in the acceptance criteria.
    """
    return await asyncio.to_thread(fn, *args, **kwargs)
```

The new `_call_with_breaker` MUST also dispatch via `asyncio.to_thread`
(breaker wraps the sync call; thread bridge wraps the breaker call).

---

### `backend/app/clusters/registry.py` (EXTENDED — per-team-token resolution)

**Existing `get()` (lines 55–99)** builds a connector from the bootstrap
token. Phase 2 adds a new method `get_for_team(team_id, cluster_id, *, db)`
that loads `team_cluster_tokens` row (model at
`backend/app/models/team_cluster_token.py` lines 22–47) instead of the
bootstrap row, and caches by `(team_id, cluster_id)` key.

**Cache invariants from current `get()`** (lines 76–99):
- Lazy build on first call
- Stored in `self._connectors[key]`
- Uses caller-supplied session if provided, else `self._session_factory()`
- Raises `LookupError` on missing row

Apply same shape; differ only on the key type (`tuple[int, int]` vs `int`)
and the loaded row type (`TeamClusterToken` vs `Cluster`).

---

### `backend/alembic/versions/0003_phase2.py` (migration)

**Analog:** `backend/alembic/versions/0002_add_uq_one_admin.py` (full file)

**Header docstring + revision constants** (0002 lines 1–46):
```python
"""<one-line>

Revision ID: 0002_add_uq_one_admin
Revises: 0001_initial
Create Date: 2026-05-14

<rationale: links to BL-N, T-N-N-N threats, PITFALLS refs, exact behavioural
change>

Notes:
- <SQLite-portability notes>
- <test names that reference the index/constraint>
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_phase2"
down_revision: str | None = "0002_add_uq_one_admin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
```

**Partial-index pattern** (0002 lines 49–61, for the audit indices Phase 2
adds — e.g. `(occurred_at DESC) WHERE deleted_at IS NULL` if soft-delete
ever lands):
```python
def upgrade() -> None:
    op.create_index(
        "uq_one_admin",
        "users",
        ["is_admin"],
        unique=True,
        sqlite_where=sa.text("is_admin = 1"),
        postgresql_where=sa.text("is_admin = true"),
    )


def downgrade() -> None:
    op.drop_index("uq_one_admin", table_name="users")
```

**Column-add pattern for quotas per-cluster** (0001_initial.py lines 47–73
for `create_table`; for ALTER, use `op.add_column` — note the docstring at
0002 lines 26–28 mentions `render_as_batch=True` in `alembic/env.py` is the
SQLite-ALTER bridge). The Phase 1 migration also documents named
constraints: see `name="uq_users_username"` (line 71), `name="ix_users_username"`
(line 74) — Phase 2 follows: every added index/constraint gets an
explicit `name=`.

**Audit-log table reference for new indices** — 0001_initial.py lines
331–392 show the existing `audit_log` table and indices. Phase 2 adds
indices for filter speed; the analog index syntax is line 378–392.

---

### `frontend/src/routes/inventory/+page.svelte` (page)

**Analog:** `frontend/src/routes/admin/clusters/+page.svelte`

**Page-level state + optimistic override** (clusters/+page.svelte lines 34–47):
```svelte
let { data }: { data: PageData } = $props();

let localOverride = $state<Cluster[] | null>(null);
const clusters = $derived<Cluster[]>(localOverride ?? data.clusters);

let rowStatus = $state<Record<number, 'ok' | 'failed' | 'untested'>>({});
let rowLabel = $state<Record<number, string | undefined>>({});
let testingId = $state<number | null>(null);

onMount(() => {
  if (data.loadError) toast.error("Couldn't load clusters. Try again.");
});
```

Phase 2 inventory: `localOverride` lives for tag-add/remove + notes-save
optimistic updates. `rowStatus` becomes `stalePerCluster: Record<string,
boolean>`. The `data.loadError` onMount toast is the standard error-state
entrypoint.

**Page header + primary CTA contract** (clusters/+page.svelte lines 140–152):
```svelte
<header class="flex flex-row items-start justify-between gap-4">
  <div class="flex flex-col gap-2">
    <h1 class="text-[28px] font-semibold tracking-tight">Clusters</h1>
    <p class="text-muted-foreground text-sm">
      Proxmox VE clusters this installation can manage.
    </p>
  </div>
  <Button onclick={() => goto('/admin/clusters/new')}>
    <Plus class="size-4" aria-hidden="true" />
    Register cluster
  </Button>
</header>
```

Phase 2 `/inventory` has NO primary CTA (Phase 4 adds Create VM); the
right-side of the header is empty. Title `"Inventory"`, description
`"Your VMs and LXCs across all clusters."` (UI-SPEC §Copywriting verbatim).

**Empty/loading/error state pattern** (clusters/+page.svelte lines 154–173):
```svelte
{#if data.loadError}
  <div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center">
    <p class="text-sm font-medium">Couldn't load clusters.</p>
    <Button variant="outline" onclick={refreshList}>Try again</Button>
  </div>
{:else if clusters.length === 0}
  <div class="...">
    <p class="text-sm font-medium">No clusters registered</p>
    ...
  </div>
{:else}
  <!-- table -->
{/if}
```

Phase 2 inventory wraps this in collapsible Accordion sections per cluster
(D-01); inside each section, the same empty/loading shape applies to "no
matches in this cluster".

**Table + row contract** (clusters/+page.svelte lines 175–262):
```svelte
<div class="rounded-md border border-border">
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head class="text-[13px] font-medium">Name</Table.Head>
        <Table.Head class="text-[13px] font-medium">Host</Table.Head>
        <Table.Head class="text-[13px] font-medium"
          style="font-variant-numeric: tabular-nums;">Port</Table.Head>
        ...
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each clusters as c (c.id)}
        <Table.Row class="hover:bg-muted/50">
          <Table.Cell>
            <a href="/admin/clusters/{c.id}" class="text-foreground hover:text-primary text-sm font-medium underline-offset-4 hover:underline">{c.name}</a>
          </Table.Cell>
          <Table.Cell class="text-muted-foreground font-mono text-[13px]">{c.host}</Table.Cell>
          ...
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
```

Phase 2 inventory rows: status icon + name (Body 14/400) + vmid
(Mono 13/400 muted) + tags (TagPill) + node + ChevronRight. Click goes
to `/inventory/{cluster_id}/{vmid}`. The `font-variant-numeric: tabular-nums`
inline style on Mono columns is the Phase 1 typography contract — keep it.

**Toast for errors + optimistic-on-success** (clusters/+page.svelte lines 92–111):
```svelte
async function handleDelete() {
  if (!deleteTarget) return;
  const target = deleteTarget;
  try {
    await api.clusters.del({ id: target.id });
    localOverride = clusters.filter((c) => c.id !== target.id);
    toast.success(`${target.name} was deleted.`);
    await invalidateAll();
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const detail = String((err.body as { detail?: unknown } | null)?.detail ?? '');
      toast.error(detail || "Couldn't delete: cluster has active team bindings.");
    } else {
      toast.error("Couldn't delete that cluster.");
    }
  } finally {
    deleteTarget = null;
  }
}
```

Apply for Phase 2 tag-add (`api.inventory.addTag` → optimistic
`localOverride[vmid].tags = [...]` → on error revert + toast).

---

### `frontend/src/routes/inventory/+page.server.ts` (SSR loader)

**Analog:** `frontend/src/routes/admin/clusters/+page.server.ts` (full file, 23 lines):
```typescript
import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, '/');
  }
  try {
    const clusters = await api.clusters.list({ fetch });
    return { user: locals.user, clusters, loadError: false };
  } catch {
    return { user: locals.user, clusters: [], loadError: true };
  }
};
```

Phase 2 inventory: drop the `is_admin` guard (every authenticated user sees
their RBAC-scoped inventory). Read URL params (`url.searchParams.get('q')`
etc.) and forward to `api.inventory.list({ filters, fetch })`. Always pass
`{ fetch }` (Pitfall A7 from utils/api.ts lines 9–11).

---

### `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` (detail w/ tabs)

**Analog:** `frontend/src/routes/admin/clusters/[id]/+page.svelte` (lines 1–80)
for the form-shape side; the `ui/tabs` block is already in
`frontend/src/lib/components/ui/tabs/index.ts` (Root/List/Trigger/Content).

**Detail-page header pattern** (admin/clusters/[id]/+page.svelte lines 37–67):
```svelte
let { data }: { data: PageData } = $props();

// Untrack the seed to keep typed form values stable across invalidateAll().
let name = $state(untrack(() => data.cluster.name));
let host = $state(untrack(() => data.cluster.host));
...
```

Phase 2 VM-detail does NOT use a form here (read-only header + tabs). But
the `untrack()` pattern is critical for the Notes edit-mode state and the
Tags optimistic state.

**Tab strip** — use shadcn-svelte tabs (already in
`frontend/src/lib/components/ui/tabs/`). Recommended import:
```svelte
import * as Tabs from '$lib/components/ui/tabs';
```
URL-hash binding for tab state (UI-SPEC §"Tab strip contract" — survives
refresh + sharable links). Implementation: read `$page.url.hash`,
update via `goto(\`#\${value}\`)` on tab change.

---

### `frontend/src/routes/audit/+page.svelte` (page)

**Analog:** `frontend/src/routes/admin/clusters/+page.svelte`

Same list-page skeleton (header + Table + row → expand inline diff). The
expand pattern has no Phase-1 analog — implement as `bind:open` on a
per-row `$state<Record<number, boolean>>({})` map and conditionally render
a second `Table.Row` (variant `bg-muted/40 border-l-2 border-l-primary`)
containing two `<Card>` blocks ("Before" / "After").

**Filter chips + URL-param sync** — no Phase-1 analog; planner specifies.
Recommended: a `$derived` over `$page.url.searchParams` that builds the
chip list. Click "x" → `goto(?...)` with the param removed.

**Audit-action Badge color rules** — UI-SPEC §Color §Semantic color usage
"Audit action: create/update/delete/power/auth-event". Reuse the
ClusterStatusPill-style derivation:
```svelte
const badgeClasses = $derived(
  action.startsWith('vm.create') || action.startsWith('team.create') || action.startsWith('user.create')
    ? 'bg-success/10 border-success/30 text-success'
    : action.startsWith('vm.delete') || action.startsWith('team.delete') || action.startsWith('user.delete')
      ? 'bg-destructive/10 border-destructive/30 text-destructive'
      : action.startsWith('vm.power.')
        ? 'bg-warning/10 border-warning/30 text-warning'
        : action.startsWith('auth.')
          ? 'bg-primary/10 border-primary/30 text-primary'
          : 'bg-muted border-border text-foreground'
);
```

(Mirrors ClusterStatusPill.svelte lines 37–44.)

---

### `frontend/src/lib/api/inventory.ts` (typed API client)

**Analog:** `frontend/src/lib/api/clusters.ts` (lines 1–80 — the surface pattern)

**Module header + helpers** (clusters.ts lines 17–36):
```typescript
import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';
import type {
  Cluster,
  ClusterCreateRequest,
  ...
} from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}
```

REUSE the `withFetch` helper shape verbatim. (It might warrant extraction
into a shared util later; for now Phase 1 has it duplicated in
`clusters.ts`, `me.ts`, `teams.ts` — Phase 2 follows.)

**Read method pattern** (clusters.ts lines 85–92):
```typescript
export async function list(opts?: MaybeFetch): Promise<Cluster[]> {
  return apiJson<Cluster[]>('/clusters/', withFetch(opts, { method: 'GET' }));
}

export async function get(args: { id: number }, opts?: MaybeFetch): Promise<Cluster> {
  return apiJson<Cluster>(`/clusters/${args.id}`, withFetch(opts, { method: 'GET' }));
}
```

Phase 2:
```typescript
export async function list(
  args: { clusterId: number; filters?: InventoryFilters },
  opts?: MaybeFetch
): Promise<VMInventoryItem[]> { ... }

export async function get(
  args: { clusterId: number; vmid: number },
  opts?: MaybeFetch
): Promise<VMDetail> { ... }
```

**Write method pattern** (clusters.ts lines 96–112 — `update`):
```typescript
export async function update(
  args: { id: number } & ClusterUpdateRequest,
  opts?: MaybeFetch
): Promise<Cluster> {
  const { id, ...payload } = args;
  return apiJson<Cluster>(
    `/clusters/${id}`,
    withFetch(opts, { method: 'PATCH', body: { ...payload } })
  );
}
```

Phase 2 `setTags` / `setNotes`: same shape with `method: 'PUT'`. The CSRF
header is auto-injected by `apiFetch` (utils/api.ts lines 81–86).

**DELETE-or-no-body method** (clusters.ts lines 120–135) — relevant for any
Phase 2 endpoint returning 204 (none directly, but the pattern is the
correct handler for `try { /* no-body response */ } catch { ... }`):
```typescript
export async function del(args: { id: number }, opts?: MaybeFetch): Promise<void> {
  const res = await apiFetch(`/clusters/${args.id}`, withFetch(opts, { method: 'DELETE' }));
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '');
    ...
    const { ApiError } = await import('$lib/utils/api');
    throw new ApiError(res.status, `DELETE /clusters/${args.id} failed`, parsed);
  }
}
```

---

### `frontend/src/lib/components/inventory/TagPill.svelte` (token-only colored pill)

**Analog:** `frontend/src/lib/components/clusters/ClusterStatusPill.svelte`
(full file, 60 lines)

**Component shape**:
```svelte
<script lang="ts">
  import CheckCircle2 from '@lucide/svelte/icons/circle-check-big';
  ...

  type Props = {
    status: 'ok' | 'failed' | 'untested';
    label?: string;
    class?: string;
  };

  let { status, label, class: className = '' }: Props = $props();

  const defaultLabel = $derived(
    status === 'ok' ? 'Connection OK' : status === 'failed' ? 'Connection failed' : 'Not yet tested'
  );

  const colorClasses = $derived(
    status === 'ok'
      ? 'bg-success/10 border-success/30 text-success'
      : status === 'failed'
        ? 'bg-destructive/10 border-destructive/30 text-destructive'
        : 'bg-muted border-border text-muted-foreground'
  );
</script>

<span class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[13px] font-medium {colorClasses} {className}" role="status">
  ...
</span>
```

For TagPill, the bucket palette comes from `hash(tag) % 12` per UI-SPEC
§TagPill (12 buckets, all using existing tokens). Implementation:
```typescript
const PALETTE = [
  'bg-primary/10 border-primary/30 text-primary',
  'bg-success/10 border-success/30 text-success',
  // ... 10 more, exact list in UI-SPEC §TagPill
];
function hueFor(tag: string): string {
  let h = 2166136261;
  for (let i = 0; i < tag.length; i++) { h ^= tag.charCodeAt(i); h = Math.imul(h, 16777619); }
  return PALETTE[Math.abs(h) % PALETTE.length];
}
```

---

### `frontend/src/lib/components/inventory/MarkdownNotes.svelte` (form-like card)

**Analog:** `frontend/src/routes/profile/+page.svelte` (lines 21–80 — form
shape with `$state` fields + validate + submit + toast)

**Form-state + validate + submit** (profile/+page.svelte lines 22–82):
```svelte
let currentPassword = $state('');
let newPassword = $state('');
let submitting = $state(false);
let formError = $state<string | null>(null);
let fieldErrors = $state<Record<string, string>>({});

function validate(): boolean {
  const errs: Record<string, string> = {};
  if (!currentPassword) errs['profile-current-password'] = 'Current password is required.';
  if (!newPassword) errs['profile-new-password'] = 'New password is required.';
  else if (newPassword.length < 12) errs['profile-new-password'] = 'Password must be at least 12 characters.';
  ...
  fieldErrors = errs;
  return Object.keys(errs).length === 0;
}

function mapError(err: unknown): { field?: string; summary?: string } {
  if (err instanceof ApiError) {
    if (err.status === 403) return { field: 'profile-current-password' };
    if (err.status === 422) ...
  }
  return { summary: 'Something went wrong on our side. Please try again.' };
}
```

Apply for Notes editing: a single `notes` `$state`, validate length ≤ 8000,
on submit call `api.inventory.setNotes(...)`, map error to inline alert.

**Markdown render path** — use `marked.parse(...)` + `DOMPurify.sanitize(...)`
per RESEARCH Pattern 5 in `frontend/src/lib/utils/markdown.ts`. Render via
`{@html sanitized}` inside `<div class="prose prose-sm dark:prose-invert max-w-none">`.

---

### `frontend/src/lib/components/quotas/QuotaIndicator.svelte` (Topbar control)

**Analog:** `frontend/src/lib/components/layout/ThemeToggle.svelte` (Topbar-mounted
compact control) — though we don't have its source pasted here, the mount
slot lives at `frontend/src/lib/components/layout/Topbar.svelte` line 91.

**Mount slot — Topbar.svelte line 91:**
```svelte
<div class="flex items-center gap-2">
  <ThemeToggle />
  <DropdownMenu.Root>
    ...
  </DropdownMenu.Root>
</div>
```

Phase 2 inserts `<QuotaIndicator />` BEFORE `<ThemeToggle />` per
UI-SPEC §Layout Contracts § QuotaIndicator "left of the ThemeToggle".

**Color-state derivation** — mirror ClusterStatusPill.svelte lines 37–44:
```svelte
const colorClasses = $derived(
  utilization >= 0.95
    ? 'bg-destructive/10 border-destructive/30 text-destructive'
    : utilization >= 0.80
      ? 'bg-warning/10 border-warning/30 text-warning'
      : 'bg-muted border-border text-foreground'
);
```

**Toast trigger pattern** — sessionStorage to fire-once-per-session per UI-SPEC
§QuotaIndicator §Toast trigger. Use the `toast` from `svelte-sonner` (already
imported throughout — see admin/clusters/+page.svelte line 21):
```svelte
import { toast } from 'svelte-sonner';
...
toast.warning(`Approaching quota: 80% of ${resource} on team ${team_name}.`);
```

---

### `frontend/src/lib/components/quotas/QuotaTab.svelte` (admin form, per-cluster grid)

**Analog:** `frontend/src/routes/admin/clusters/[id]/+page.svelte` (lines 16–112 — the
full form shape including untracked seed, validate, mapEditError, handleSave)

**State seeding pattern** (clusters/[id]/+page.svelte lines 41–67):
```svelte
let name = $state(untrack(() => data.cluster.name));
let host = $state(untrack(() => data.cluster.host));
let port = $state(untrack(() => data.cluster.port));
...

let saving = $state(false);
let formError = $state<string | null>(null);
let fieldErrors = $state<Record<string, string>>({});
```

For QuotaTab: one `$state` per cluster row's 4 numeric fields. The
`untrack()` wrapper is mandatory (Plan 01-09 SUMMARY contract — keeps form
state stable across `invalidateAll()` after save).

**Error mapping** (clusters/[id]/+page.svelte lines 84–111):
```svelte
function mapEditError(err: unknown): { field?: string; message?: string; summary?: string } {
  if (err instanceof ApiError) {
    const detail = String((err.body as { detail?: unknown } | null)?.detail ?? '').toLowerCase();
    if (err.status === 422) {
      if (detail.includes('fingerprint')) return { summary: "..." };
      ...
    }
    if (err.status === 409) return { field: 'cluster-edit-name', message: '...' };
    if (err.status === 502) return { summary: '...' };
  }
  return { summary: 'Something went wrong on our side. Please try again.' };
}
```

Apply for QuotaTab: 409 ↔ "Current usage exceeds new limit" dialog (D-12),
422 ↔ per-field inline (negative number, etc.).

---

### `frontend/src/lib/api/client.ts` (EXTENDED — register new modules)

**Lines 27–44 (existing exports):**
```typescript
import * as authModule from './auth';
import * as meModule from './me';
import * as setupModule from './setup';
import * as clustersModule from './clusters';
import * as usersModule from './users';
import * as teamsModule from './teams';

export const api = {
  auth: authModule,
  me: meModule,
  setup: setupModule,
  clusters: clustersModule,
  users: usersModule,
  teams: teamsModule
} as const;
```

Phase 2 append:
```typescript
import * as inventoryModule from './inventory';
import * as auditModule from './audit';
import * as quotasModule from './quotas';
// ...
export const api = {
  ...existing,
  inventory: inventoryModule,
  audit: auditModule,
  quotas: quotasModule,
} as const;
```

---

### `backend/tests/test_inventory.py` (E2E)

**Analog:** `backend/tests/test_clusters.py`

**Login + admin-helper pattern** (test_clusters.py lines 32–55):
```python
async def _login_admin(client, session_factory, username="admin1"):
    user = await make_user(
        session_factory, username=username, password="adminpass12345",
        is_admin=True,
    )
    cookies = await login_as(client, username=username, password="adminpass12345")
    return user, cookies


def _valid_cluster_payload(**overrides):
    payload = {
        "name": "pve-prod",
        ...
    }
    payload.update(overrides)
    return payload
```

**Test pattern** (test_clusters.py lines 62–94):
```python
@pytest.mark.asyncio
async def test_post_clusters_as_non_admin_returns_403(client, session_factory):
    await make_user(session_factory, username="bob", password="testpass12345")
    cookies = await login_as(client, username="bob", password="testpass12345")
    csrf = cookies["csrf_token"]

    response = await client.post(
        "/api/v1/clusters/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json=_valid_cluster_payload(),
    )
    assert response.status_code == 403
```

Phase 2 inventory tests:
- non-team-member → 403 on `/api/v1/clusters/{id}/vms/{vmid}` (RBAC)
- stale-cache-fallback when PVE unreachable (mock connector via
  `patch("app.clusters.connector.ProxmoxAPI", return_value=fake)` — see
  `test_connector.py` lines 39–55 for the FakeProxmox pattern)
- tag/notes write triggers audit-log row insertion

**FakeProxmox fixture** (test_connector.py lines 34–55):
```python
def _make_fake(responses):
    return FakeProxmox(responses=responses)


@pytest.mark.asyncio
async def test_version_returns_mocked_payload():
    from app.clusters.connector import PVEConnector

    fake = _make_fake({"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(...)
        result = await conn.version()
    assert result == VERSION_OK["data"]
    assert fake.calls[0] == ("version.get", (), {})
```

Phase 2 reuses this FakeProxmox infrastructure (already in
`backend/tests/fixtures/pve_responses.py`). Add new fixture responses for
`cluster.resources.get`, `nodes(...).qemu(...).status.current.get`, etc.

---

## Shared Patterns

### Authentication / Authorization

**Source:** `backend/app/auth/dependencies.py`
**Apply to:** Every Phase 2 backend route

The `get_current_principal` (lines 53–123) returns a `Principal` with both
cookie-session and Bearer-PAT support. Phase 2 routes use:

| Surface | Dep |
|---------|-----|
| `/inventory` reads (RBAC-scoped to team's pool) | `get_current_principal` + new `require_resource_access` |
| `/audit` reads (RBAC inside the service) | `get_current_principal` |
| `/admin/teams/{id}/quotas` | `require_admin` (lines 126–139) |
| `/me/quotas` | `get_current_principal` |
| Every write (tags, notes, quota edit) | `csrf_protect` (lines 142–171) — adds CSRF for cookie auth, bypasses for PAT |

**Excerpt — `require_admin`** (lines 126–139):
```python
async def require_admin(
    principal: Principal = Depends(get_current_principal),
) -> Principal:
    if not principal.user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin required",
        )
    return principal
```

Phase 2's `require_resource_access(cluster_id: int, vmid: int)` follows
this exact shape but accepts the path params via `Depends()` parameter
injection. The check resolves `team_cluster_tokens` row for any of the
principal's teams matching `cluster_id`, then uses that token to verify
vmid is in the team's pool.

**Excerpt — `csrf_protect`** (lines 142–171):
```python
async def csrf_protect(
    request: Request,
    principal: Principal = Depends(get_current_principal),
) -> None:
    if principal.via_pat:
        return
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    ...
    cookie_value = request.cookies.get(settings.csrf_cookie_name)
    header_value = request.headers.get("X-CSRF-Token")
    if not verify_csrf(cookie_value, header_value):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF check failed")
```

Apply to every Phase 2 mutating route as `Depends(csrf_protect)`.

---

### Error Handling

**Source:** `backend/app/clusters/service.py` lines 93–108 + `backend/app/main.py`
lines 99–132 (global handlers)
**Apply to:** Every service function that calls PVE

**Service-local catch + structured response** (clusters/service.py lines 93–108):
```python
try:
    version_payload = await connector.version()
except PVEAuthError:
    return ClusterTestResponse(ok=False, error="Proxmox rejected that token.")
except PVEUnreachable:
    return ClusterTestResponse(ok=False, error="Couldn't reach that URL.")
except PVEAPIError:
    return ClusterTestResponse(ok=False, error="Proxmox returned an unexpected error.")
```

**Global handlers (main.py lines 99–132)** — fallback for uncaught:
```python
@app.exception_handler(PVEUnreachable)
async def _pve_unreachable_handler(_: Request, exc: PVEUnreachable) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={"detail": "Couldn't reach that Proxmox URL."},
    )

@app.exception_handler(PVEAuthError)
async def _pve_auth_handler(_: Request, exc: PVEAuthError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Proxmox rejected that token."},
    )
```

Phase 2 adds a third source of PVE errors (`pybreaker.CircuitBreakerError`
when the breaker is open). RESEARCH Pattern 1 wraps it: the
`_call_with_breaker` helper re-raises as `PVEUnreachable("breaker open")`,
so it falls through the existing global handler.

---

### Validation

**Source:** `backend/app/clusters/schemas.py` + `backend/app/teams/schemas.py`
**Apply to:** All Phase 2 request schemas

**`extra="forbid"` on every write schema** (teams/schemas.py lines 19–35):
```python
class TeamCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=128)


class TeamUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=128)
    is_active: bool | None = None
```

**Custom regex/format validators** (clusters/schemas.py lines 51–63):
```python
@field_validator("token_user")
@classmethod
def _validate_token_user(cls, v: str) -> str:
    if not _TOKEN_USER_RE.match(v):
        raise ValueError(...)
    return v
```

Phase 2 tag validation in `TagsUpdate`:
```python
PVE_TAG_RE = re.compile(r"^[a-z0-9_][a-z0-9_\-+.]*$")  # PVE's actual regex

class TagsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tags: list[str] = Field(default_factory=list, max_length=64)

    @field_validator("tags")
    @classmethod
    def _validate_each_tag(cls, v: list[str]) -> list[str]:
        for tag in v:
            if not PVE_TAG_RE.match(tag):
                raise ValueError(f"invalid tag format: {tag!r}")
        return v
```

---

### Audit-log write (sync-before-return)

**Source:** RESEARCH Pattern 4 + `backend/app/auth/service.py:revoke_user_sessions`
(lines 232–257) as the precedent
**Apply to:** Every Phase 2 mutating service function

Pattern: PVE-write succeeds → call `audit.writer.audit_write(db, ...)` with
`payload_before` and `payload_after` JSON → `await db.commit()` → return.
Audit-write failure = whole-request failure (HTTPException 500 bubbles).

Model fields the writer fills (`backend/app/models/audit_log.py` lines 31–62):
- `actor_user_id` / `actor_pat_id` — from `Principal.user.id` (mode='pat' →
  also populate `actor_pat_id` from the resolved PAT row)
- `team_id` — from the resource's pool ownership
- `cluster_id` — from the URL path
- `action` — one of UI-SPEC §"Audit action labels" backend `action` values
- `target_type` / `target_id` — e.g. `"vm"` / `"100"`
- `result` — `"success"` or `"failure"`
- `source_ip` — from `request.client.host` with X-Forwarded-For trust list
  (Phase 1 review-fix item)
- `correlation_id` — request-scoped (structlog provides; planner decides
  the propagation path)
- `payload_before` / `payload_after` — `json.dumps(model.model_dump())`

---

### Frontend SSR loader (defence-in-depth auth)

**Source:** `frontend/src/routes/admin/clusters/+page.server.ts` (full file)
**Apply to:** Every new Phase 2 page server-load

```typescript
import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {  // OMIT for non-admin Phase 2 routes (/inventory, /audit, /me/*)
    throw redirect(303, '/');
  }
  try {
    const data = await api.X.list({ fetch });
    return { user: locals.user, data, loadError: false };
  } catch {
    return { user: locals.user, data: [], loadError: true };
  }
};
```

Per-page checks:
- `/inventory` and `/inventory/[cluster]/[vmid]` — drop the `is_admin`
  guard; backend RBAC handles
- `/audit` — same; non-admin gets RBAC-scoped view from backend
- `/admin/teams/[id]/+page.svelte` Quotas tab — keep the `is_admin` guard

---

### Toast / sonner usage

**Source:** `frontend/src/lib/components/layout/AppShell.svelte` line 41 mounts
the global `<Toaster position="bottom-right" richColors closeButton />`.
Every page imports and uses:
```svelte
import { toast } from 'svelte-sonner';
...
toast.success(`${target.name} was deleted.`);
toast.error("Couldn't refresh clusters.");
```

Phase 2 quota-warning toasts use `toast.warning(...)` and `toast.error(...)`
per UI-SPEC §QuotaIndicator. Once-per-session via sessionStorage key
`proxmox-gui:quota-toast-fired:{level}`.

---

### Optimistic UI with `$derived(localOverride ?? data.list)`

**Source:** `frontend/src/routes/admin/clusters/+page.svelte` lines 36–37
**Apply to:** Inventory list (tag mutations), VM detail Tags card

```svelte
let localOverride = $state<Cluster[] | null>(null);
const clusters = $derived<Cluster[]>(localOverride ?? data.clusters);
```

On mutation success: assign to `localOverride`. On error: revert
(`localOverride = null` or revert to previous snapshot) + `toast.error(...)`.

---

## No Analog Found

| File | Role | Data flow | Reason |
|------|------|-----------|--------|
| `backend/app/inventory/rrd.py` | utility (transform) | none-to-PVE | Phase 1 has no PVE-data-shape util |
| `backend/app/audit/csv.py` | streaming | StreamingResponse | Phase 1 has no streaming endpoint |
| `backend/app/clusters/health.py` | background task | async loop | Phase 1 has no background asyncio.Task |
| `backend/app/core/csv.py` | utility (stdlib wrapper) | sync | Phase 1 has no CSV util |
| `frontend/src/lib/components/inventory/Sparkline.svelte` | SVG render | none-to-SVG | Phase 1 has no chart component |
| `frontend/src/lib/components/audit/CsvExportButton.svelte` | download trigger | streaming-download | Phase 1 has no file-download UI |
| `frontend/src/lib/utils/markdown.ts` | transform | sync | Phase 1 has no markdown rendering |

For these, planner references RESEARCH.md directly:
- `rrd.py` → RESEARCH §"Standard Stack §PVE RRD Endpoints" + §Pattern 1
- `audit/csv.py` → RESEARCH §Pattern 7 (verbatim code excerpt)
- `clusters/health.py` → RESEARCH §Pattern 2 (verbatim code excerpt)
- `core/csv.py` → Python stdlib `csv.writer` wrapping `io.StringIO`
- `Sparkline.svelte` → UI-SPEC §"Overview tab" + §"Implementation Notes for Executor" §10 ("hand-rolled SVG")
- `CsvExportButton.svelte` → UI-SPEC §CsvExportButton (full contract)
- `utils/markdown.ts` → RESEARCH §Pattern 5 (verbatim)

---

## Metadata

**Analog search scope:**
- `backend/app/**` (auth, clusters, teams, users, me, pats, ssh_keys, setup, models, core)
- `backend/alembic/versions/**`
- `backend/tests/**`
- `frontend/src/routes/**` (admin/users, admin/clusters, profile, setup, login)
- `frontend/src/lib/api/**`
- `frontend/src/lib/components/**` (clusters, forms, layout, ui)
- `frontend/src/lib/utils/**`
- `frontend/tests/**`

**Files scanned (Phase 1 codebase, excluding `.venv`/`node_modules`/`build`):**
- Backend: 63 Python files
- Frontend: ~70 .svelte/.ts files

**Pattern extraction date:** 2026-05-14
