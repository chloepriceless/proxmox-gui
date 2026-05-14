---
phase: 02-multi-cluster-inventory-quotas-audit
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/alembic/versions/0003_phase2.py
  - backend/app/models/quota.py
  - backend/app/audit/__init__.py
  - backend/app/audit/writer.py
  - backend/app/audit/reader.py
  - backend/app/audit/csv.py
  - backend/app/audit/routes.py
  - backend/app/audit/schemas.py
  - backend/app/audit/csv_safe.py
  - backend/app/core/source_ip.py
  - backend/app/main.py
  - backend/tests/test_audit_writer.py
  - backend/tests/test_audit_reader.py
  - backend/tests/test_audit_csv.py
  - backend/tests/test_audit_routes.py
  - backend/tests/test_migrations.py
autonomous: true
requirements:
  - AUDIT-01
  - AUDIT-02
  - AUDIT-03
  - AUDIT-04
  - AUDIT-05
user_setup: []

must_haves:
  truths:
    - "Alembic migration 0003_phase2 adds per-cluster quota linkage columns and audit-log indices; alembic upgrade head + alembic downgrade -1 round-trips cleanly."
    - "audit_write(db, ...) inserts an AuditLog row with action/actor/team/cluster/target/result/source_ip/correlation_id/payload_before/payload_after and FLUSHES (does NOT commit — caller owns the tx)."
    - "audit reader exposes list_audit(db, *, principal, filters, page, page_size) returning (rows, total); applies RBAC predicate (admin sees all; non-admin sees actor_user_id=me OR (team_id IN my_teams AND show_team_actions))."
    - "GET /api/v1/audit returns paginated AuditPage; non-admin sees only RBAC-scoped rows; cookie + Bearer PAT auth both work."
    - "GET /api/v1/audit/export.csv streams a UTF-8-with-BOM CSV; hard limit 50000 rows; CSV-injection cells starting with =/+/-/@ are prefixed with single-quote."
    - "csv_safe.escape_cell prefixes any value whose first non-whitespace char is = + - @ with a single quote."
  artifacts:
    - path: "backend/alembic/versions/0003_phase2.py"
      provides: "Per-cluster quota columns; audit_log indices for filter speed; named constraints"
      contains: "revision: str = \"0003_phase2\""
    - path: "backend/app/audit/writer.py"
      provides: "audit_write(db, *, ...) → None; FLUSHES, never commits"
      contains: "async def audit_write"
    - path: "backend/app/audit/reader.py"
      provides: "list_audit(db, *, principal, filters, page, page_size) → tuple[list[AuditEntryDTO], int]"
      contains: "async def list_audit"
    - path: "backend/app/audit/csv.py"
      provides: "audit_csv_stream(db, filters, *, principal) async iterator yielding bytes"
      contains: "async def audit_csv_stream"
    - path: "backend/app/audit/routes.py"
      provides: "GET /api/v1/audit, GET /api/v1/audit/export.csv"
      contains: "router = APIRouter()"
  key_links:
    - from: "backend/app/audit/writer.py"
      to: "AuditLog model"
      via: "db.add(AuditLog(...)) + await db.flush()"
      pattern: "db\\.add\\(entry\\)"
    - from: "backend/app/audit/routes.py"
      to: "audit reader + csv stream"
      via: "Depends(get_current_principal); StreamingResponse for export"
      pattern: "StreamingResponse"
    - from: "backend/app/main.py"
      to: "audit_router"
      via: "app.include_router(audit_router, prefix='/api/v1/audit')"
      pattern: "audit_router"
---

<objective>
Land the audit-log writer + reader + CSV exporter + routes, plus the 0003_phase2 Alembic migration that adds per-cluster quota columns and audit-log filter indices.

Purpose: every Phase 2 mutating service function (Plans 02-03 quotas/tags/notes, 02-04 quota edits, and every future Phase 3+ create/update/delete/power action) calls `audit_write(db, ...)` synchronously before the request returns. The reader + CSV export + routes ship in this plan so the writer has a consumer for testing AND so Plan 02-06's `/audit` page has its backend ready.

Output: synchronous-before-return audit writer + RBAC-scoped reader + StreamingResponse CSV exporter + GET /api/v1/audit + GET /api/v1/audit/export.csv; the per-cluster quota column delta on `quotas` table (so Plan 02-04 can write per-cluster rows without further migration).
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/research/PITFALLS.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-CONTEXT.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-PATTERNS.md
@backend/app/models/audit_log.py
@backend/app/models/quota.py
@backend/alembic/versions/0001_initial.py
@backend/alembic/versions/0002_add_uq_one_admin.py
@backend/app/auth/dependencies.py
@backend/app/auth/service.py
@backend/app/main.py

<interfaces>
<!-- Key types and contracts the executor needs. -->

From backend/app/models/audit_log.py (existing — UNCHANGED in this plan):
```python
class AuditLog(Base):
    __tablename__ = "audit_log"
    id: int (PK)
    occurred_at: datetime (server_default=CURRENT_TIMESTAMP, indexed)
    actor_user_id: int | None  (FK users.id ON DELETE SET NULL)
    actor_pat_id: int | None   (FK personal_access_tokens.id ON DELETE SET NULL)
    team_id: int | None        (FK teams.id ON DELETE SET NULL)
    cluster_id: int | None     (FK clusters.id ON DELETE SET NULL)
    action: str (String(128), NOT NULL)         # e.g. "vm.tag.add"
    target_type: str | None (String(64))         # "vm" | "lxc" | "team" | ...
    target_id: str | None (String(128))          # "100"
    result: str (String(32), NOT NULL)           # "success" | "failure" | "pending"
    source_ip: str | None (String(64))
    correlation_id: str | None (String(64))
    payload_before: str | None (Text — JSON)
    payload_after: str | None (Text — JSON)
    error: str | None (Text)
    # __table_args__ already includes:
    #   Index("ix_audit_team_time", "team_id", "occurred_at")
    #   Index("ix_audit_actor_time", "actor_user_id", "occurred_at")
```

From backend/app/models/quota.py (existing — Phase 2 MODIFIES to add cluster_id):
```python
class Quota(Base):
    __tablename__ = "quotas"
    id: int (PK)
    team_id: int | None  (UNIQUE in Phase 1 — Phase 2 RELAXES via migration: UNIQUE(team_id, cluster_id) and UNIQUE(user_id, cluster_id))
    user_id: int | None  (UNIQUE in Phase 1 — same relaxation)
    cluster_id: int | None  # NEW — added by 0003_phase2
    cpu_cores: int | None
    ram_bytes: int | None
    disk_bytes: int | None
    vm_count: int | None
    lxc_count: int | None
    updated_at: datetime
    # CHECK constraint: (team_id IS NOT NULL) <> (user_id IS NOT NULL)  -- unchanged
```

From backend/app/auth/dependencies.py:
```python
@dataclass
class Principal:
    user: User
    mode: Literal["session", "pat"]
    @property
    def via_pat(self) -> bool: ...

async def get_current_principal(...) -> Principal: ...
async def require_admin(principal=Depends(get_current_principal)) -> Principal: ...
```

From Phase 1 migration patterns (0002_add_uq_one_admin.py):
```python
revision: str = "0002_add_uq_one_admin"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None: ...
def downgrade() -> None: ...
```
SQLite ALTER goes through `op.batch_alter_table` (render_as_batch=True in env.py per 0002 commentary).

From Phase 1 review-fix backlog (referenced in ROADMAP §Phase 5 carryover):
- X-Forwarded-For trust list lives in `backend/app/security/source_ip.py` (Plan 01-REVIEW-FIX). If absent, this plan creates `backend/app/core/source_ip.py` with a single helper: `extract_source_ip(request, *, trusted_proxies: list[str]) -> str | None`. For Phase 2 the trust list is hard-coded as `["127.0.0.1", "::1"]` and the function reads X-Forwarded-For ONLY when request.client.host is in the trust list — otherwise returns request.client.host. Document the limitation.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write 0003_phase2 Alembic migration (per-cluster quota columns + audit-log indices) + extend Quota ORM</name>
  <files>backend/alembic/versions/0003_phase2.py, backend/app/models/quota.py, backend/tests/test_migrations.py</files>
  <read_first>
    - backend/alembic/versions/0001_initial.py (op.create_table shapes; how audit_log indices are declared lines 331-392)
    - backend/alembic/versions/0002_add_uq_one_admin.py (full file — partial-index pattern, revision-constants block, named constraints, render_as_batch convention)
    - backend/app/models/quota.py (current ORM — CHECK constraint stays; UNIQUE on team_id/user_id must move to composite (team_id, cluster_id) and (user_id, cluster_id))
    - backend/app/models/audit_log.py (verify existing indices ix_audit_team_time + ix_audit_actor_time — Phase 2 adds new indices on (action), (cluster_id, occurred_at))
    - backend/tests/test_migrations.py (Phase 1 round-trip test pattern; ADD a new test for 0003 upgrade+downgrade)
  </read_first>
  <behavior>
    - `alembic upgrade head` from a fresh DB applies 0001 → 0002 → 0003 cleanly.
    - `alembic downgrade -1` from head reverses 0003 cleanly (no orphaned indices/columns).
    - After upgrade head: `pragma table_info('quotas')` includes a `cluster_id` column (INTEGER, NULL).
    - After upgrade head: `pragma index_list('quotas')` no longer contains a single-column UNIQUE on team_id alone; instead contains UNIQUE(team_id, cluster_id) and UNIQUE(user_id, cluster_id) (both partial: WHERE team_id IS NOT NULL / user_id IS NOT NULL).
    - After upgrade head: `pragma index_list('audit_log')` includes `ix_audit_action_time` (action, occurred_at DESC) and `ix_audit_cluster_time` (cluster_id, occurred_at DESC).
    - Quota ORM updated to expose `cluster_id: Mapped[int | None]` with FK clusters.id ON DELETE CASCADE.
  </behavior>
  <action>
Step 1 — Quota ORM. Modify `backend/app/models/quota.py`:

- Remove `unique=True` from `team_id` mapped_column and from `user_id` mapped_column (UNIQUE moves to composite in __table_args__).
- Add new mapped column AFTER `user_id`:
  ```python
  cluster_id: Mapped[int | None] = mapped_column(
      ForeignKey("clusters.id", ondelete="CASCADE"),
      nullable=True,
  )
  ```
- Extend `__table_args__` to include named partial UNIQUE indices (SQLite via `sqlite_where`):
  ```python
  __table_args__ = (
      CheckConstraint(
          "(team_id IS NOT NULL) <> (user_id IS NOT NULL)",
          name="ck_quota_team_xor_user",
      ),
      Index(
          "uq_quotas_team_cluster",
          "team_id", "cluster_id",
          unique=True,
          sqlite_where=text("team_id IS NOT NULL"),
          postgresql_where=text("team_id IS NOT NULL"),
      ),
      Index(
          "uq_quotas_user_cluster",
          "user_id", "cluster_id",
          unique=True,
          sqlite_where=text("user_id IS NOT NULL"),
          postgresql_where=text("user_id IS NOT NULL"),
      ),
  )
  ```
- Update the module docstring to note Phase 2 adds the per-cluster scoping (D-09 + D-11: admin sets per-cluster limits; aggregate is computed at read time).
- Imports: ensure `Index, text` are imported from sqlalchemy.

Step 2 — Migration `backend/alembic/versions/0003_phase2.py`. Header per `0002` template:
```python
"""phase 2: per-cluster quota scoping + audit log filter indices.

Revision ID: 0003_phase2
Revises: 0002_add_uq_one_admin
Create Date: 2026-05-14

Changes:
1. quotas table: ADD cluster_id (INTEGER, NULL, FK clusters.id ON DELETE CASCADE).
   DROP single-column UNIQUE on team_id and user_id (from 0001).
   ADD composite partial UNIQUE on (team_id, cluster_id) where team_id IS NOT NULL
     — name uq_quotas_team_cluster.
   ADD composite partial UNIQUE on (user_id, cluster_id) where user_id IS NOT NULL
     — name uq_quotas_user_cluster.
   D-09 + D-11 rationale: per-cluster scoping is the enforcement boundary.
   The aggregate (CONTEXT D-09) is computed at READ time from the rows.

2. audit_log table: ADD two indices for filter speed (AUDIT-03):
   - ix_audit_action_time: (action, occurred_at DESC) — for action=… filter.
   - ix_audit_cluster_time: (cluster_id, occurred_at DESC) — for per-cluster filter
     and for per-VM Activity tab (which filters by cluster_id + target_id).

Notes:
- SQLite ALTER goes through op.batch_alter_table (render_as_batch=True in env.py).
- Every constraint/index has an explicit name= (Plan 01-02 SUMMARY locked decision).
- Downgrade re-creates the Phase-1 single-column UNIQUE indices on team_id / user_id.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_phase2"
down_revision: str | None = "0002_add_uq_one_admin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ---- quotas: add cluster_id column ----
    with op.batch_alter_table("quotas") as batch:
        batch.add_column(
            sa.Column(
                "cluster_id",
                sa.Integer(),
                sa.ForeignKey("clusters.id", ondelete="CASCADE",
                              name="fk_quotas_cluster_id"),
                nullable=True,
            )
        )

    # ---- quotas: drop Phase 1 single-column UNIQUE indices on team_id / user_id ----
    # 0001_initial declared these as unique=True on the mapped_column, which
    # SQLAlchemy emits as auto-named UNIQUE indices ix_quotas_team_id / ix_quotas_user_id.
    # We drop by the auto-name; verify against migration history.
    op.drop_index("ix_quotas_team_id", table_name="quotas")
    op.drop_index("ix_quotas_user_id", table_name="quotas")

    # ---- quotas: add per-cluster composite partial UNIQUE indices ----
    op.create_index(
        "uq_quotas_team_cluster",
        "quotas",
        ["team_id", "cluster_id"],
        unique=True,
        sqlite_where=sa.text("team_id IS NOT NULL"),
        postgresql_where=sa.text("team_id IS NOT NULL"),
    )
    op.create_index(
        "uq_quotas_user_cluster",
        "quotas",
        ["user_id", "cluster_id"],
        unique=True,
        sqlite_where=sa.text("user_id IS NOT NULL"),
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )

    # ---- audit_log: filter indices ----
    op.create_index(
        "ix_audit_action_time",
        "audit_log",
        ["action", sa.text("occurred_at DESC")],
    )
    op.create_index(
        "ix_audit_cluster_time",
        "audit_log",
        ["cluster_id", sa.text("occurred_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_cluster_time", table_name="audit_log")
    op.drop_index("ix_audit_action_time", table_name="audit_log")
    op.drop_index("uq_quotas_user_cluster", table_name="quotas")
    op.drop_index("uq_quotas_team_cluster", table_name="quotas")
    # Re-create Phase 1 single-column UNIQUE indices.
    op.create_index("ix_quotas_team_id", "quotas", ["team_id"], unique=True)
    op.create_index("ix_quotas_user_id", "quotas", ["user_id"], unique=True)
    with op.batch_alter_table("quotas") as batch:
        batch.drop_column("cluster_id")
```

IMPORTANT — verify the actual Phase-1 auto-index names for the single-column UNIQUEs by reading `backend/alembic/versions/0001_initial.py` BEFORE writing the drop_index calls. If they're named differently (e.g. `ix_quotas_team_id` vs `uq_quotas_team_id`), use the exact names. If 0001 declares them as named UniqueConstraint inside __table_args__, swap to `op.drop_constraint(...)`.

Step 3 — `backend/tests/test_migrations.py`. APPEND a new test:
```python
@pytest.mark.asyncio
async def test_0003_phase2_round_trip(tmp_path):
    """0001 → 0002 → 0003 upgrade then 0003 downgrade restores Phase-1 schema."""
    # ... use the existing helper that runs alembic upgrade head + downgrade -1 ...
    # Assert that after upgrade head:
    #   - 'quotas' table has a 'cluster_id' column (PRAGMA table_info)
    #   - 'uq_quotas_team_cluster' index exists
    #   - 'ix_audit_action_time' index exists
    # After downgrade -1:
    #   - 'cluster_id' column gone
    #   - 'uq_quotas_team_cluster' index gone
    #   - 'ix_quotas_team_id' single-column index restored
```
Mirror the Phase 1 round-trip helper if one exists; otherwise write a small one that opens a tmp sqlite, runs `alembic.command.upgrade(cfg, "head")` then `alembic.command.downgrade(cfg, "-1")`, and inspects `PRAGMA table_info` / `PRAGMA index_list`.

Step 4 — Update Phase 1 schema-invariant test ALLOWLIST in `backend/tests/test_schema_invariants.py` IF the `cluster_id` addition to `quotas` triggers the per-table tenancy-presence assertion (read the test file first; the allowlist already documents quotas as XOR — keep that intact). If no change is needed, skip this step but add a one-line comment in the new migration noting "schema-invariant allowlist already covers quotas via the team_id-XOR-user_id rationale".
  </action>
  <verify>
    <automated>cd backend && uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head && uv run pytest tests/test_migrations.py tests/test_schema_invariants.py tests/test_models_metadata.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n 'revision: str = "0003_phase2"' backend/alembic/versions/0003_phase2.py` returns 1 match.
    - `grep -n 'down_revision: str | None = "0002_add_uq_one_admin"' backend/alembic/versions/0003_phase2.py` returns 1 match.
    - `grep -nE "op\.create_index\(\"uq_quotas_team_cluster\"|op\.create_index\(\"uq_quotas_user_cluster\"|op\.create_index\(\"ix_audit_action_time\"|op\.create_index\(\"ix_audit_cluster_time\"" backend/alembic/versions/0003_phase2.py` returns 4 matches.
    - `grep -nE "def upgrade|def downgrade" backend/alembic/versions/0003_phase2.py` returns 2 matches.
    - `grep -n "cluster_id:" backend/app/models/quota.py` returns 1 match.
    - `grep -n "uq_quotas_team_cluster" backend/app/models/quota.py` returns 1 match.
    - `cd backend && uv run alembic upgrade head` exits 0; output ends with "Running upgrade 0002_add_uq_one_admin -> 0003_phase2".
    - `cd backend && uv run alembic downgrade -1` exits 0.
    - `cd backend && uv run alembic upgrade head` (re-apply) exits 0.
    - `cd backend && uv run pytest tests/test_migrations.py -x` exits 0.
  </acceptance_criteria>
  <done>
    - 0003_phase2 migration round-trips cleanly.
    - Quota ORM has cluster_id column + composite partial UNIQUE indices.
    - audit_log has two new filter indices.
    - Phase 1 round-trip tests + schema-invariant tests still green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Audit writer + reader + CSV streamer + routes; csv_safe helper; source_ip helper; wire router into main</name>
  <files>backend/app/audit/__init__.py, backend/app/audit/writer.py, backend/app/audit/reader.py, backend/app/audit/csv.py, backend/app/audit/csv_safe.py, backend/app/audit/routes.py, backend/app/audit/schemas.py, backend/app/core/source_ip.py, backend/app/main.py, backend/tests/test_audit_writer.py, backend/tests/test_audit_reader.py, backend/tests/test_audit_csv.py, backend/tests/test_audit_routes.py</files>
  <read_first>
    - backend/app/audit/__init__.py (probably empty/missing — create as `"""Audit log writer + reader + CSV export."""`)
    - backend/app/models/audit_log.py (target model — column names exactly)
    - backend/app/auth/dependencies.py (Principal dataclass + get_current_principal + require_admin)
    - backend/app/auth/service.py:revoke_user_sessions (lines ~232-257 — exemplar of sync-flush primitive)
    - backend/app/clusters/routes.py (route module shape; APIRouter + dependency injection pattern)
    - backend/app/teams/service.py:list_teams (lines ~226-242 — query-with-aggregation pattern for the reader)
    - backend/app/main.py (where to register the new router — alongside clusters_router/teams_router)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md §Pattern 4 (audit writer) + §Pattern 7 (CSV stream verbatim) + §Security Domain §CSV-injection mitigation
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-UI-SPEC.md §"Audit action labels" (the canonical backend `action` values executor must accept)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-PATTERNS.md §`backend/app/audit/*` analogs
  </read_first>
  <behavior>
    - audit_write FLUSHES, never COMMITS — the caller's outer transaction owns commit semantics.
    - When audit_write raises (e.g. constraint violation), the caller's tx is in an aborted state; service-layer pattern (Plan 01-05 SUMMARY locked decision: commit-before-raise) means failure-path audit rows MUST commit BEFORE the action raises (this plan documents the pattern; consumers in Plan 02-03/02-04 implement it).
    - GET /api/v1/audit?from=2026-05-01&to=…&action=vm.create,vm.delete&user=7&type=vm,team&page=1&page_size=50 — admin sees all; non-admin sees ONLY rows where actor_user_id=me OR (team_id IN my_teams AND show_team_actions=1). Default show_team_actions=0 (D-17).
    - GET /api/v1/audit/export.csv with same filters returns text/csv; charset=utf-8 with the BOM bytes 0xEF 0xBB 0xBF as the first 3 bytes of the body. Hard limit LIMIT 50001 internally; if 50001 rows present, return 409 Conflict with body `{"detail":"Too many rows; refine filter","limit":50000}`.
    - CSV cells whose first non-whitespace char is in `{"=","+","-","@"}` get prefixed with a single quote `'` before being written (Excel injection mitigation per 02-RESEARCH §Security).
    - source_ip helper extracts request.client.host normally; only honors X-Forwarded-For (rightmost trusted hop) when request.client.host ∈ {"127.0.0.1","::1"}.
    - PAT-authenticated callers reach the SAME RBAC predicate (no separate auth code path).
  </behavior>
  <action>
Step 1 — `backend/app/core/source_ip.py` (NEW). Check first if `backend/app/security/source_ip.py` already exists (Phase 1 review fix). If it does, EXTEND/IMPORT FROM that location and skip step 1's file creation; otherwise create at `backend/app/core/source_ip.py`:
```python
"""Source-IP extraction with X-Forwarded-For trust list.

Phase 1 review-fix carryover (ROADMAP Phase 5 carryover ME-04 + IN-01). Phase 2
needs this for AuditLog.source_ip; ship a minimal version here, Phase 5 polishes
the trusted-proxy configurability.
"""

from __future__ import annotations

from fastapi import Request

# Phase 2 hard-coded trust list — Caddy reverse-proxy on localhost.
# Phase 5 (DEPLOY-04 polish) makes this configurable.
TRUSTED_PROXIES: frozenset[str] = frozenset({"127.0.0.1", "::1"})


def extract_source_ip(request: Request) -> str | None:
    """Return the client IP for AuditLog.source_ip.

    Honors X-Forwarded-For ONLY when request.client.host is in TRUSTED_PROXIES.
    Otherwise returns request.client.host as-is (or None when client is absent
    — e.g. test client without a real socket).
    """
    direct = request.client.host if request.client else None
    if direct in TRUSTED_PROXIES:
        xff = request.headers.get("X-Forwarded-For")
        if xff:
            # Rightmost-trusted: take the first IP (canonical convention).
            first = xff.split(",")[0].strip()
            if first:
                return first
    return direct
```

Step 2 — `backend/app/audit/__init__.py` (NEW): `"""Audit log writer, reader, CSV export, and HTTP routes."""`.

Step 3 — `backend/app/audit/schemas.py` (NEW):
```python
"""Pydantic schemas for the audit log API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AuditEntry(BaseModel):
    """One row in the audit log, projected for API consumption."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    occurred_at: datetime
    actor_username: str | None     # joined from users.username; None for system events
    actor_pat_prefix: str | None   # joined from PAT prefix_preview if actor_pat_id set
    team_name: str | None          # joined from teams.name
    cluster_name: str | None       # joined from clusters.name
    action: str
    target_type: str | None
    target_id: str | None
    result: str
    source_ip: str | None
    correlation_id: str | None
    payload_before: str | None     # JSON string; client decodes
    payload_after: str | None
    error: str | None


class AuditFilter(BaseModel):
    """Query parameters for GET /audit and /audit/export.csv. extra=forbid."""
    model_config = ConfigDict(extra="forbid")

    from_: datetime | None = Field(default=None, alias="from")
    to: datetime | None = None
    action: list[str] | None = None     # comma-split by route
    user_id: int | None = None
    target_type: list[str] | None = None    # comma-split by route
    vmid: int | None = None
    cluster_id: int | None = None
    show_team_actions: bool = False


class AuditPage(BaseModel):
    """Paginated list payload."""
    model_config = ConfigDict(from_attributes=True)
    rows: list[AuditEntry]
    total: int
    page: int
    page_size: int
```

Step 4 — `backend/app/audit/writer.py` (NEW):
```python
"""Audit writer — synchronous-before-return (D-20, AUDIT-01).

CONTRACT (do not deviate): this function FLUSHES the new AuditLog row but does
NOT COMMIT. The CALLER owns the transaction commit. The Phase 1 service-layer
locked decision ("commit-before-raise" — 01-05 SUMMARY) applies: when the
caller plans to RAISE after this call (failure-path audit), the caller MUST
``await db.commit()`` BEFORE raising, otherwise ``get_db`` rolls back and the
audit row is lost.

Pitfall 6 (this RESEARCH.md): if caller forgets to commit AFTER calling
audit_write on the success path, the row is rolled back. Service tests for
every consumer assert audit_log row presence after BOTH success and failure
paths.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def audit_write(
    db: AsyncSession,
    *,
    actor_user_id: int | None,
    actor_pat_id: int | None = None,
    team_id: int | None,
    cluster_id: int | None,
    action: str,
    target_type: str | None,
    target_id: str | None,
    result: str,                     # "success" | "failure" | "pending"
    source_ip: str | None,
    correlation_id: str | None = None,
    payload_before: dict[str, Any] | None = None,
    payload_after: dict[str, Any] | None = None,
    error: str | None = None,
) -> AuditLog:
    """Flush a new AuditLog row into the caller's transaction.

    Returns the populated AuditLog (with .id assigned post-flush) so tests
    can assert on it; production callers usually ignore the return value.
    """
    entry = AuditLog(
        actor_user_id=actor_user_id,
        actor_pat_id=actor_pat_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result,
        source_ip=source_ip,
        correlation_id=correlation_id,
        payload_before=json.dumps(payload_before, default=str) if payload_before is not None else None,
        payload_after=json.dumps(payload_after, default=str) if payload_after is not None else None,
        error=error,
    )
    db.add(entry)
    await db.flush()
    return entry
```

Step 5 — `backend/app/audit/csv_safe.py` (NEW):
```python
"""CSV-injection mitigation (02-RESEARCH §Security §CSV injection).

Excel auto-executes a cell starting with =, +, -, or @ as a formula. Prefix any
such value with a single quote to neutralize.
"""

from __future__ import annotations

_DANGEROUS_PREFIXES = ("=", "+", "-", "@")


def escape_cell(value: object) -> str:
    """Stringify + prefix-with-quote if the value's first non-whitespace char
    is one of =, +, -, @. Empty / None values pass through as empty string."""
    if value is None:
        return ""
    s = str(value)
    if s and s.lstrip().startswith(_DANGEROUS_PREFIXES):
        return "'" + s
    return s
```

Step 6 — `backend/app/audit/reader.py` (NEW). Build a SELECT that LEFT-JOINs `users`, `teams`, `clusters`, `personal_access_tokens` (for prefix_preview). Apply RBAC predicate:
```python
"""Audit reader — paginated list + RBAC predicate."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.schemas import AuditEntry, AuditFilter
from app.auth.dependencies import Principal
from app.models import AuditLog, Cluster, Team, TeamMembership, User
from app.models.pat import PersonalAccessToken  # adjust import path to match


HARD_EXPORT_LIMIT = 50000


def _build_rbac_predicate(principal: Principal, my_team_ids: list[int],
                          show_team_actions: bool):
    """Return a SQLAlchemy where-clause matching D-17 + Pitfall 11.

    - Admin: no filter.
    - Non-admin default: actor_user_id == me.
    - Non-admin with show_team_actions=1: actor_user_id == me
        OR team_id IN (my_team_ids) (regardless of actor; the team-scope is
        what matters per Pitfall 11).
    """
    if principal.user.is_admin:
        return text("1=1")
    me_clause = AuditLog.actor_user_id == principal.user.id
    if not show_team_actions or not my_team_ids:
        return me_clause
    team_clause = AuditLog.team_id.in_(my_team_ids)
    return or_(me_clause, team_clause)


async def _my_team_ids(db: AsyncSession, *, user_id: int) -> list[int]:
    stmt = select(TeamMembership.team_id).where(TeamMembership.user_id == user_id)
    return [row[0] for row in (await db.execute(stmt)).all()]


def _apply_filters(stmt, filters: AuditFilter):
    if filters.from_ is not None:
        stmt = stmt.where(AuditLog.occurred_at >= filters.from_)
    if filters.to is not None:
        stmt = stmt.where(AuditLog.occurred_at <= filters.to)
    if filters.action:
        stmt = stmt.where(AuditLog.action.in_(filters.action))
    if filters.user_id is not None:
        stmt = stmt.where(AuditLog.actor_user_id == filters.user_id)
    if filters.target_type:
        stmt = stmt.where(AuditLog.target_type.in_(filters.target_type))
    if filters.vmid is not None:
        stmt = stmt.where(AuditLog.target_id == str(filters.vmid))
    if filters.cluster_id is not None:
        stmt = stmt.where(AuditLog.cluster_id == filters.cluster_id)
    return stmt


async def list_audit(
    db: AsyncSession,
    *,
    principal: Principal,
    filters: AuditFilter,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[AuditEntry], int]:
    my_teams = await _my_team_ids(db, user_id=principal.user.id)
    rbac = _build_rbac_predicate(principal, my_teams, filters.show_team_actions)

    base = (
        select(
            AuditLog,
            User.username.label("actor_username"),
            Team.name.label("team_name"),
            Cluster.name.label("cluster_name"),
            PersonalAccessToken.prefix_preview.label("actor_pat_prefix"),
        )
        .outerjoin(User, AuditLog.actor_user_id == User.id)
        .outerjoin(Team, AuditLog.team_id == Team.id)
        .outerjoin(Cluster, AuditLog.cluster_id == Cluster.id)
        .outerjoin(PersonalAccessToken, AuditLog.actor_pat_id == PersonalAccessToken.id)
        .where(rbac)
        .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
    )
    base = _apply_filters(base, filters)

    # Count (efficient via subquery).
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    paged = base.limit(page_size).offset((page - 1) * page_size)
    rows = (await db.execute(paged)).all()

    entries: list[AuditEntry] = []
    for log, actor_username, team_name, cluster_name, actor_pat_prefix in rows:
        entries.append(AuditEntry(
            id=log.id,
            occurred_at=log.occurred_at,
            actor_username=actor_username,
            actor_pat_prefix=actor_pat_prefix,
            team_name=team_name,
            cluster_name=cluster_name,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            result=log.result,
            source_ip=log.source_ip,
            correlation_id=log.correlation_id,
            payload_before=log.payload_before,
            payload_after=log.payload_after,
            error=log.error,
        ))
    return entries, int(total)


async def count_export(
    db: AsyncSession, *, principal: Principal, filters: AuditFilter,
) -> int:
    """Lightweight count for the disable-when-too-large UX (UI-SPEC §CsvExportButton)."""
    my_teams = await _my_team_ids(db, user_id=principal.user.id)
    rbac = _build_rbac_predicate(principal, my_teams, filters.show_team_actions)
    stmt = _apply_filters(select(func.count(AuditLog.id)).where(rbac), filters)
    return int((await db.execute(stmt)).scalar_one())
```

If `PersonalAccessToken.prefix_preview` column doesn't exist (verify via `grep -n prefix_preview backend/app/models/pat.py`), drop that join + the `actor_pat_prefix` projection and leave the field as `None` on AuditEntry.

Step 7 — `backend/app/audit/csv.py` (NEW). Verbatim from 02-RESEARCH §Pattern 7 with the csv_safe.escape_cell wrapper applied to each cell:
```python
"""CSV export stream (02-RESEARCH §Pattern 7)."""

from __future__ import annotations

import csv
import io
from collections.abc import AsyncIterator

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.csv_safe import escape_cell
from app.audit.reader import HARD_EXPORT_LIMIT, _apply_filters, _build_rbac_predicate, _my_team_ids
from app.audit.schemas import AuditFilter
from app.auth.dependencies import Principal
from app.models import AuditLog, Cluster, Team, User

_BOM = "\ufeff"  # U+FEFF; written as 0xEF 0xBB 0xBF in UTF-8


async def audit_csv_stream(
    db: AsyncSession,
    *,
    principal: Principal,
    filters: AuditFilter,
) -> AsyncIterator[bytes]:
    """Yield bytes for a StreamingResponse. UTF-8 with BOM as first 3 bytes."""
    my_teams = await _my_team_ids(db, user_id=principal.user.id)
    rbac = _build_rbac_predicate(principal, my_teams, filters.show_team_actions)

    base = (
        select(
            AuditLog.occurred_at, AuditLog.action, AuditLog.target_type,
            AuditLog.target_id, AuditLog.result, AuditLog.source_ip,
            AuditLog.correlation_id, AuditLog.error,
            User.username, Team.name, Cluster.name,
        )
        .outerjoin(User, AuditLog.actor_user_id == User.id)
        .outerjoin(Team, AuditLog.team_id == Team.id)
        .outerjoin(Cluster, AuditLog.cluster_id == Cluster.id)
        .where(rbac)
        .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
        .limit(HARD_EXPORT_LIMIT)
    )
    base = _apply_filters(base, filters)

    yield _BOM.encode("utf-8")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "timestamp", "action", "target_type", "target_id", "result",
        "source_ip", "correlation_id", "error",
        "actor_username", "team_name", "cluster_name",
    ])
    yield buf.getvalue().encode("utf-8")
    buf.seek(0); buf.truncate()

    result = await db.stream(base)
    async for row in result:
        occurred_at, action, ttype, tid, res, ip, corr, err, actor, team, cluster = row
        writer.writerow([
            escape_cell(occurred_at.isoformat() if occurred_at else ""),
            escape_cell(action),
            escape_cell(ttype),
            escape_cell(tid),
            escape_cell(res),
            escape_cell(ip),
            escape_cell(corr),
            escape_cell(err),
            escape_cell(actor),
            escape_cell(team),
            escape_cell(cluster),
        ])
        yield buf.getvalue().encode("utf-8")
        buf.seek(0); buf.truncate()
```

Step 8 — `backend/app/audit/routes.py` (NEW):
```python
"""Audit log HTTP surface (AUDIT-03, AUDIT-04, AUDIT-05)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.csv import audit_csv_stream
from app.audit.reader import HARD_EXPORT_LIMIT, count_export, list_audit
from app.audit.schemas import AuditFilter, AuditPage
from app.auth.dependencies import Principal, get_current_principal
from app.core.db import get_db

router = APIRouter()


def _parse_csv(value: str | None) -> list[str] | None:
    if not value:
        return None
    return [v for v in (s.strip() for s in value.split(",")) if v]


def _build_filter(
    from_: datetime | None,
    to: datetime | None,
    action: str | None,
    user_id: int | None,
    target_type: str | None,
    vmid: int | None,
    cluster_id: int | None,
    show_team_actions: bool,
) -> AuditFilter:
    return AuditFilter.model_validate({
        "from": from_,
        "to": to,
        "action": _parse_csv(action),
        "user_id": user_id,
        "target_type": _parse_csv(target_type),
        "vmid": vmid,
        "cluster_id": cluster_id,
        "show_team_actions": show_team_actions,
    })


@router.get(
    "/",
    response_model=AuditPage,
    summary="List audit entries (RBAC-scoped)",
    operation_id="audit_list",
)
async def list_audit_route(
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
    action: str | None = None,
    user_id: int | None = None,
    target_type: str | None = None,
    vmid: int | None = None,
    cluster_id: int | None = None,
    show_team_actions: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> AuditPage:
    filters = _build_filter(from_, to, action, user_id, target_type, vmid,
                            cluster_id, show_team_actions)
    rows, total = await list_audit(db, principal=principal, filters=filters,
                                   page=page, page_size=page_size)
    return AuditPage(rows=rows, total=total, page=page, page_size=page_size)


@router.get(
    "/export.csv",
    summary="Stream filtered audit entries as UTF-8-BOM CSV",
    operation_id="audit_export_csv",
)
async def export_audit_csv(
    request: Request,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
    action: str | None = None,
    user_id: int | None = None,
    target_type: str | None = None,
    vmid: int | None = None,
    cluster_id: int | None = None,
    show_team_actions: bool = False,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    filters = _build_filter(from_, to, action, user_id, target_type, vmid,
                            cluster_id, show_team_actions)
    # Hard limit guard: count first; if > 50000, refuse with 409 (UI-SPEC §CsvExportButton disabled state).
    total = await count_export(db, principal=principal, filters=filters)
    if total > HARD_EXPORT_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Too many rows; refine filter", "limit": HARD_EXPORT_LIMIT},
        )
    filename = f"audit-{date.today().isoformat()}.csv"
    return StreamingResponse(
        audit_csv_stream(db, principal=principal, filters=filters),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

Step 9 — `backend/app/main.py`. ADD to imports inside `create_app()`:
```python
from app.audit.routes import router as audit_router
```
ADD include after the existing `app.include_router(users_router, ...)`:
```python
app.include_router(audit_router, prefix="/api/v1/audit", tags=["audit"])
```

Step 10 — Tests.

`backend/tests/test_audit_writer.py`:
1. `test_audit_write_flushes_not_commits` — call audit_write, assert AuditLog.id is set (flush populates PK) BUT a separate connection sees no row (commit hasn't happened). Then await db.commit() and assert separate connection sees it.
2. `test_audit_write_json_serializes_payload_before_after` — call with payload_before={"foo":"bar","n":1}, commit, query back, assert json.loads(row.payload_before) == {"foo":"bar","n":1}.
3. `test_audit_write_accepts_none_payload` — call without payload_before/after, assert column stored as None.
4. `test_audit_write_failure_path_persists_after_commit` — call with result="failure", commit, query back, assert row exists with result="failure". Documents the Plan 01-05 commit-before-raise contract.

`backend/tests/test_audit_reader.py`:
1. `test_admin_sees_every_row` — seed 5 rows across 3 teams; admin call; assert total==5.
2. `test_non_admin_default_sees_only_own_rows` — seed mixed actor_user_id values; non-admin call with show_team_actions=False; assert only rows with actor_user_id=me.
3. `test_non_admin_with_show_team_actions_sees_team_scoped` — seed rows where team_id is in user's teams (but actor is someone else); non-admin with show_team_actions=True; assert visibility per Pitfall 11.
4. `test_filter_action_in_list` — seed mixed actions; filter action=['vm.create','vm.delete']; assert only those rows.
5. `test_filter_date_range` — seed rows with different occurred_at; filter from=…; assert correct subset.
6. `test_pagination_returns_total_independent_of_page` — seed 25 rows; page=1 page_size=10; assert len(rows)==10 AND total==25.
7. `test_filter_vmid_and_cluster_together` — seed rows; filter vmid=100 + cluster_id=5; assert only matching rows (Activity tab use case).

`backend/tests/test_audit_csv.py`:
1. `test_csv_first_bytes_are_bom` — seed 2 rows; collect bytes from audit_csv_stream; assert first 3 bytes are 0xEF 0xBB 0xBF.
2. `test_csv_header_row_present` — assert second chunk decoded contains `timestamp,action,target_type,target_id,result,...`.
3. `test_csv_injection_escaped` — seed a row with error="=cmd|/c calc" and target_id="=HYPERLINK..."; collect output; assert each appears as `'=cmd|/c calc"` / `'=HYPERLINK...` (single-quote prefix).
4. `test_csv_respects_rbac` — non-admin user; seed 3 rows belonging to other teams; collect stream; decode CSV; assert none of those rows are present.

`backend/tests/test_audit_routes.py`:
1. `test_get_audit_requires_auth` — no cookie; expect 401.
2. `test_get_audit_admin_returns_all` — admin cookie; seed rows; assert AuditPage shape + total.
3. `test_get_audit_non_admin_filters_to_own` — non-admin cookie; assert exclusion.
4. `test_get_audit_pat_auth_works` — Bearer pat_… header; assert 200 with RBAC same as cookie.
5. `test_export_csv_returns_text_csv_with_bom` — admin; small seed; response.content[:3] == b'\xef\xbb\xbf'; Content-Disposition contains "attachment".
6. `test_export_csv_too_many_rows_returns_409` — monkeypatch HARD_EXPORT_LIMIT to 2; seed 3 rows; expect 409 with detail.limit == 2.
7. `test_csv_filter_chained_with_action` — admin; seed mixed actions; filter action=vm.create; CSV body decoded contains only matching rows.
  </action>
  <verify>
    <automated>cd backend && uv run alembic upgrade head && uv run pytest tests/test_audit_writer.py tests/test_audit_reader.py tests/test_audit_csv.py tests/test_audit_routes.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "async def audit_write" backend/app/audit/writer.py` returns 1 match.
    - `grep -n "await db.flush()" backend/app/audit/writer.py` returns at least 1 match.
    - `grep -n "await db.commit()" backend/app/audit/writer.py` returns 0 matches (writer never commits).
    - `grep -n "async def list_audit" backend/app/audit/reader.py` returns 1 match.
    - `grep -n "_build_rbac_predicate" backend/app/audit/reader.py` returns at least 2 matches (definition + reuse in csv.py via import).
    - `grep -n "def escape_cell" backend/app/audit/csv_safe.py` returns 1 match.
    - `grep -nE 'startswith\(_DANGEROUS_PREFIXES\)|startswith\(\("="' backend/app/audit/csv_safe.py` returns at least 1 match.
    - `grep -n "StreamingResponse" backend/app/audit/routes.py` returns at least 1 match.
    - `grep -n "BOM" backend/app/audit/csv.py` returns at least 1 match (BOM constant present).
    - `grep -n 'media_type="text/csv; charset=utf-8"' backend/app/audit/routes.py` returns 1 match.
    - `grep -n 'app.include_router(audit_router' backend/app/main.py` returns 1 match.
    - `grep -n "def extract_source_ip" backend/app/core/source_ip.py` returns 1 match (OR backend/app/security/source_ip.py if pre-existing).
    - `cd backend && uv run pytest tests/test_audit_writer.py tests/test_audit_reader.py tests/test_audit_csv.py tests/test_audit_routes.py -x` exits 0.
    - `cd backend && uv run pytest -x` (whole suite) exits 0.
    - `cd backend && uv run ruff check app/audit/ app/core/source_ip.py tests/test_audit_*.py` exits 0.
  </acceptance_criteria>
  <done>
    - Audit writer + reader + CSV streamer + routes shipped.
    - Sync-before-return semantics enforced (writer FLUSHES, not commits).
    - CSV BOM verified at byte level by a test.
    - CSV-injection mitigation verified by a test (cells starting with `=` get `'` prefixed).
    - RBAC predicate test matrix (admin / non-admin own-only / non-admin team-scope) all green.
    - PAT-auth path covered by a test (Pitfall 9 mitigation).
    - Router wired into main.py.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → FastAPI | All audit GET/export queries cross here; auth via cookie OR Bearer PAT. |
| FastAPI → SQLite | Audit reads + writes; SQLite WAL with PRAGMA busy_timeout=5000 (Phase 1). |
| Reverse-proxy → FastAPI | source_ip extraction trusts X-Forwarded-For ONLY from {127.0.0.1, ::1}. |
| Audit consumer → Excel | CSV export — Excel formula auto-exec is a cross-trust-boundary risk. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-02-01 | Information Disclosure | Cross-tenant audit leak | mitigate | `_build_rbac_predicate` returns `actor_user_id=me` for non-admin by default; `team_id IN my_teams` only when `show_team_actions=1`. Server enforces — client cannot flip the flag (per UI-SPEC §"Show team actions is a server-side filter"). Test matrix `test_admin_sees_every_row`, `test_non_admin_default_sees_only_own_rows`, `test_non_admin_with_show_team_actions_sees_team_scoped`. |
| T-02-02-02 | Information Disclosure | Audit-log enumeration via CSV bypasses RBAC | mitigate | `audit_csv_stream` imports `_build_rbac_predicate` from reader and applies it. Same code path — no separate "dump" endpoint. Test `test_csv_respects_rbac`. |
| T-02-02-03 | Tampering | CSV injection (Excel formula auto-exec) | mitigate | `csv_safe.escape_cell` prefixes any cell starting with `=`, `+`, `-`, `@` with single-quote. Test `test_csv_injection_escaped`. |
| T-02-02-04 | Tampering | Audit-writer failure swallowed → action succeeds without record | mitigate | Writer FLUSHES inside the caller's tx; if flush raises, caller's tx aborts. Plan 01-05 SUMMARY locked decision "commit-before-raise" instructs all consumers (Plans 02-03, 02-04) to commit the audit row BEFORE raising HTTPException on failure paths. Documented in writer.py docstring + Pitfall 6 in 02-RESEARCH. |
| T-02-02-05 | Repudiation | Audit row lacks actor identity | mitigate | Writer requires actor_user_id (nullable for system events) AND actor_pat_id (for PAT-auth requests — consumers populate both for traceability). Pat-auth test `test_get_audit_pat_auth_works` covers the source path. |
| T-02-02-06 | DoS | Memory blowup on a 50k-row CSV export | mitigate | `audit_csv_stream` uses `db.stream(query).limit(50000)` — yields one CSV row per DB row, never holds the full result. Hard 50000 LIMIT in `audit/reader.py:HARD_EXPORT_LIMIT`. Route returns 409 with `{limit:50000}` body if count exceeds. |
| T-02-02-07 | Spoofing | Forged X-Forwarded-For populates AuditLog.source_ip with attacker-chosen IP | mitigate | `extract_source_ip` honors XFF ONLY when request.client.host ∈ {127.0.0.1, ::1} (Caddy upstream). Direct connection IPs win otherwise. Phase 5 (DEPLOY-04 carryover) makes the trust list configurable. |
| T-02-02-08 | Information Disclosure | PVE bootstrap token leaked into AuditLog.error column | mitigate | Audit writer accepts `error: str | None`. CONSUMER responsibility: callers must not pass raw `str(exc)` from cluster errors that include the token. 02-RESEARCH §Security checklist documents the "scrub before audit" rule; consumer plans (02-03, 02-04) implement scrubbing in their service layers. THIS plan documents the threat; mitigation lands in the service layer in subsequent plans. |
| T-02-02-09 | Information Disclosure | Stale RBAC after team-membership revocation in same session | accept | `_my_team_ids` re-queries on every request — no in-process cache. Cookie session has 15-min access JWT; a revocation propagates by next refresh. Acceptable for v1. |

ASVS L1 satisfied for this plan's surface; no HIGH-and-Open threats.
</threat_model>

<verification>
- Task 1 + Task 2 automated checks pass.
- Migration round-trip verified by `alembic upgrade head` + `alembic downgrade -1` + re-upgrade.
- CSV BOM verified at byte level (`response.content[:3] == b'\xef\xbb\xbf'`).
- CSV injection mitigation verified (`'=cmd...` in output).
- RBAC matrix verified (3 admin/non-admin/team-scope tests).
- PAT-auth audit endpoint covered (Pitfall 9).
- Phase 1 test suite remains green.
</verification>

<success_criteria>
- 0003_phase2 migration shipped; round-trip clean; per-cluster columns + composite UNIQUE on quotas; audit_log filter indices added.
- audit_write / list_audit / count_export / audit_csv_stream exist with documented sync-before-commit semantics.
- escape_cell prefixes dangerous cells with single-quote.
- extract_source_ip implements trusted-proxy XFF (or imports from pre-existing Phase 1 review-fix module).
- GET /api/v1/audit + GET /api/v1/audit/export.csv exist; both RBAC-scoped; CSV starts with BOM.
- Router wired into FastAPI app.
- Pre-existing tests still green.
</success_criteria>

<output>
After completion, create `.planning/phases/02-multi-cluster-inventory-quotas-audit/02-02-audit-schema-writer-SUMMARY.md` covering:
- Files added/modified + test count
- Whether Phase 1 source_ip helper existed at backend/app/security/source_ip.py (and if so where this plan imported from)
- Confirmation that Phase 1's auto-named UNIQUE indices on quotas were called `ix_quotas_team_id` / `ix_quotas_user_id` (or document the actual names used)
- The exact list of `action` constants reserved for Phase 2 (per UI-SPEC §"Audit action labels") that downstream consumers MUST use verbatim (e.g. `vm.tag.add`, `vm.tag.remove`, `vm.notes.update`, `quota.update`)
- The commit-before-raise contract: link to Plan 01-05 SUMMARY + Pitfall 6 + Plan 02-03/02-04 consumption sites
</output>
