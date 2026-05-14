---
phase: 02-multi-cluster-inventory-quotas-audit
plan: "02"
subsystem: database, api, audit
tags: [sqlalchemy, alembic, sqlite, fastapi, csv, rbac, pydantic]

# Dependency graph
requires:
  - phase: 02-01-connector-extension
    provides: Cluster model, lifespan probe, session factory
  - phase: 01-foundation
    provides: User, Team, AuditLog, Quota models; auth dependencies; Principal type

provides:
  - "Alembic migration 0003_phase2: per-cluster quota columns (cluster_id FK) + named composite partial UNIQUE indices + audit_log filter indices"
  - "audit_write(db, ...) writer: FLUSH-not-COMMIT contract, JSON payload serialization"
  - "list_audit(db, *, principal, filters, page, page_size) reader with RBAC predicate (admin=all; non-admin=own; +show_team_actions=own+team)"
  - "count_export(db, *, principal, filters): lightweight count for CSV disable-when-too-large UX"
  - "audit_csv_stream(db, *, principal, filters) async generator: UTF-8-BOM first, CSV-injection escaped, HARD_EXPORT_LIMIT=50000"
  - "csv_safe.escape_cell: prefix =/+/-/@ leading cells with single quote (OWASP)"
  - "GET /api/v1/audit: paginated AuditPage JSON with RBAC+filters; cookie+Bearer PAT auth"
  - "GET /api/v1/audit/export.csv: StreamingResponse, 409 Conflict at limit, Content-Disposition attachment"
  - "source_ip.extract_source_ip: X-Forwarded-For honored only from 127.0.0.1/::1 trusted proxies"
  - "Canonical Phase 2 action strings per UI-SPEC: vm.tag.add, vm.tag.remove, vm.notes.update, quota.update (+ full table)"

affects:
  - 02-03-inventory-backend
  - 02-04-quotas-backend
  - 02-06-frontend-audit-quotas
  - 03-job-queue-lifecycle

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FLUSH-not-COMMIT audit writer: audit_write always flushes (populates PK), never commits; caller commits before raising HTTPException (commit-before-raise contract)"
    - "RBAC predicate function: _build_rbac_predicate returns SQLAlchemy clause; admin=text('1=1'); non-admin=actor_user_id==me; +team=OR team_id IN my_teams"
    - "Composite partial UNIQUE index on SQLite: op.create_index(..., sqlite_where=sa.text('team_id IS NOT NULL')) for per-cluster quota uniqueness"
    - "batch_alter_table for SQLite: all ALTER TABLE operations go through op.batch_alter_table context manager"
    - "AuditFilter alias pattern: Field(alias='from') to avoid Python keyword; use AuditFilter.model_validate({'from': dt}) not AuditFilter(from_=dt)"
    - "StreamingResponse CSV: yield BOM bytes first, then header, then rows via db.stream(); never buffer full result"
    - "CSV injection mitigation: escape_cell strips leading whitespace before detecting =/+/-/@ prefix"

key-files:
  created:
    - backend/alembic/versions/0003_phase2.py
    - backend/app/audit/__init__.py
    - backend/app/audit/writer.py
    - backend/app/audit/reader.py
    - backend/app/audit/csv.py
    - backend/app/audit/csv_safe.py
    - backend/app/audit/schemas.py
    - backend/app/audit/routes.py
    - backend/app/core/source_ip.py
    - backend/tests/test_audit_writer.py
    - backend/tests/test_audit_reader.py
    - backend/tests/test_audit_csv.py
    - backend/tests/test_audit_routes.py
  modified:
    - backend/app/models/quota.py
    - backend/app/main.py
    - backend/tests/test_migrations.py

key-decisions:
  - "audit_write FLUSHES not COMMITS: the writer never calls db.commit(); caller (route handler or service) owns the transaction and MUST commit before raising HTTPException so the audit row survives the rollback"
  - "Composite partial UNIQUE indices replace flat UniqueConstraints on quotas.team_id and quotas.user_id: enables per-cluster quota rows (one quota per team+cluster pair)"
  - "Static code inspection for FLUSH-not-COMMIT test: inspect.getsource(audit_write) asserts 'await db.commit()' absent rather than relying on SQLite in-memory isolation (which is shared across aiosqlite sessions)"
  - "HARD_EXPORT_LIMIT=50000 checked via count_export before streaming; returns 409 Conflict with detail.limit and detail.max fields"
  - "X-Forwarded-For trusted only from 127.0.0.1/::1 direct connections; all other clients use request.client.host directly"
  - "PAT lookup_prefix field name confirmed: PersonalAccessToken.lookup_prefix (not prefix_preview)"

patterns-established:
  - "Pattern: audit_write caller contract — always commit audit row before raising; never rely on outer transaction surviving an HTTPException"
  - "Pattern: AuditFilter model_validate — use model_validate({'from': dt}) for the aliased 'from' field"
  - "Pattern: CSV streaming — async generator yielding bytes; BOM first; escape_cell on every cell; never buffer"

requirements-completed:
  - AUDIT-01
  - AUDIT-02
  - AUDIT-03
  - AUDIT-04
  - AUDIT-05

# Metrics
duration: approx 90min
completed: 2026-05-14
---

# Phase 02 Plan 02: Audit Schema + Writer Summary

**Alembic 0003_phase2 migration with per-cluster quota columns and audit-log indices; complete audit subsystem (writer, RBAC reader, CSV streamer, injection-safe exporter, REST routes) using SQLAlchemy 2.0 async with flush-not-commit contract**

## Performance

- **Duration:** approx 90 min
- **Started:** 2026-05-14T15:15:00Z (estimated)
- **Completed:** 2026-05-14T16:53:27Z
- **Tasks:** 2 (each with RED + GREEN TDD commits)
- **Files modified:** 16

## Accomplishments

- Alembic migration 0003_phase2 adds `cluster_id` FK to quotas, replaces flat unique constraints with composite partial UNIQUE indices (`uq_quotas_team_cluster`, `uq_quotas_user_cluster`), and adds `ix_audit_action_time` + `ix_audit_cluster_time`; round-trip upgrade/downgrade verified
- Full audit subsystem implemented: writer (FLUSH-not-COMMIT), RBAC reader (admin=all / non-admin=own / show_team_actions=own+team), streaming CSV exporter with UTF-8 BOM and CSV injection mitigation, REST routes at `/api/v1/audit` and `/api/v1/audit/export.csv`
- 221 tests passing; ruff clean; all TDD RED gates confirmed failing before implementation

## Task Commits

1. **Task 1 RED: Migration test** - `1153e74` (test)
2. **Task 1 GREEN: Migration + Quota model** - `33c31e9` (feat)
3. **Task 2 RED: Audit subsystem tests** - `222ed4e` (test)
4. **Task 2 GREEN: Audit subsystem implementation** - `d087000` (feat)

## Files Created/Modified

- `backend/alembic/versions/0003_phase2.py` - Per-cluster quota columns + audit-log filter indices; batch_alter_table for SQLite; composite partial UNIQUE indices
- `backend/app/models/quota.py` - Extended with `cluster_id` FK; removed flat unique constraints; added composite index table_args
- `backend/app/audit/__init__.py` - Package init
- `backend/app/audit/writer.py` - `audit_write()`: FLUSH-not-COMMIT; JSON payload serialization; returns AuditLog with populated `.id`
- `backend/app/audit/reader.py` - `list_audit()` + `count_export()`; RBAC predicate; filters (from/to/action/user_id/vmid/cluster_id/show_team_actions); LEFT JOINs to User/Team/Cluster/PAT
- `backend/app/audit/csv.py` - `audit_csv_stream()` async generator; BOM-first; header row; per-row escape_cell; HARD_EXPORT_LIMIT via db.stream()
- `backend/app/audit/csv_safe.py` - `escape_cell()`: strip leading whitespace before detecting =/+/-/@ prefix; prefix dangerous cells with single quote
- `backend/app/audit/schemas.py` - `AuditEntry`, `AuditFilter` (alias="from" for from_ field), `AuditPage`
- `backend/app/audit/routes.py` - GET `/` → AuditPage; GET `/export.csv` → StreamingResponse (409 at HARD_EXPORT_LIMIT); cookie+Bearer auth
- `backend/app/core/source_ip.py` - `extract_source_ip()`: X-Forwarded-For from trusted proxies only (127.0.0.1/::1)
- `backend/app/main.py` - Registered `audit_router` at `/api/v1/audit`
- `backend/tests/test_audit_writer.py` - 4 tests: flush_not_commits (static assertion), json payload, none payload, failure path
- `backend/tests/test_audit_reader.py` - 7 tests: admin sees all, non-admin own, show_team_actions, action filter, date range, pagination total, vmid+cluster filter
- `backend/tests/test_audit_csv.py` - 7 tests: BOM, header row, injection escaped, RBAC, escape_cell unit tests
- `backend/tests/test_audit_routes.py` - 7 tests: auth gate, admin sees all, non-admin filtered, PAT auth, CSV BOM, 409 at limit, filter chained
- `backend/tests/test_migrations.py` - Extended with 0003_phase2 round-trip test

## Decisions Made

- **FLUSH-not-COMMIT contract:** `audit_write` always flushes (populates PK) but never commits. The caller must `await session.commit()` before raising `HTTPException` so the audit row persists even when the outer transaction rolls back. This is the "commit-before-raise" pattern locked in Plan 01-05.
- **Composite partial UNIQUE indices for quotas:** The Phase 1 flat `UNIQUE(team_id)` and `UNIQUE(user_id)` constraints were replaced with `UNIQUE(team_id, cluster_id) WHERE team_id IS NOT NULL` to support per-cluster quota rows while keeping global quota (cluster_id=NULL) valid.
- **Static code inspection for test:** SQLite in-memory databases share state across aiosqlite sessions, making transaction isolation untestable. The flush-not-commit test uses `inspect.getsource(audit_write)` to assert `"await db.commit()"` is absent from the function source.
- **PAT field: `lookup_prefix` (confirmed):** PersonalAccessToken exposes `lookup_prefix` not `prefix_preview`; this is what the reader joins and exposes as `actor_pat_prefix` in AuditEntry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed migration downgrade test — SQLite autoindex visibility**
- **Found during:** Task 1 (0003_phase2 migration + Quota ORM)
- **Issue:** `inspect(engine).get_indexes("quotas")` returns `[]` for SQLite inline UniqueConstraints created via `batch_op.create_unique_constraint()` because SQLite stores them as `sqlite_autoindex_*` entries invisible to the inspector
- **Fix:** Replaced inspector call with `PRAGMA index_list('quotas')` and checked `len([r for r in rows if r[2] == 1]) >= 2`
- **Files modified:** `backend/tests/test_migrations.py`
- **Verification:** Downgrade assertion passes; migration round-trip test green
- **Committed in:** `33c31e9` (Task 1 GREEN)

**2. [Rule 1 - Bug] Fixed static assertion scope — module vs. function source**
- **Found during:** Task 2 (audit writer test)
- **Issue:** `inspect.getsource(writer_module)` includes the module docstring which references `await db.commit()` in its explanation of the FLUSH-not-COMMIT contract, causing the "not in source" assertion to fail
- **Fix:** Changed to `inspect.getsource(audit_write)` (the function only, not the module)
- **Files modified:** `backend/tests/test_audit_writer.py`
- **Verification:** Static assertion passes; docstring no longer in scope
- **Committed in:** `d087000` (Task 2 GREEN — fix applied during GREEN phase)

**3. [Rule 1 - Bug] Fixed AuditFilter `from_` ValidationError**
- **Found during:** Task 2 (audit reader test)
- **Issue:** `AuditFilter(from_=now)` raises `ValidationError` because `extra="forbid"` treats `from_` as an unknown field; the field has `alias="from"` and Pydantic v2 requires `model_validate({"from": dt})` or `by_alias=True` population
- **Fix:** Changed reader test to `AuditFilter.model_validate({"from": now})`
- **Files modified:** `backend/tests/test_audit_reader.py`
- **Verification:** Date range filter test passes
- **Committed in:** `d087000` (Task 2 GREEN)

**4. [Rule 1 - Bug] Fixed PAT mint URL + response field**
- **Found during:** Task 2 (audit routes test)
- **Issue 1:** PAT mint helper posted to `/api/v1/me/tokens` (missing trailing slash) — FastAPI 307-redirected but `httpx` async client does not follow redirects by default
- **Issue 2:** PAT mint response contains `"plaintext"` key not `"token"`
- **Fix:** Updated `_make_pat()` to POST to `/api/v1/me/tokens/` and read `resp.json()["plaintext"]`
- **Files modified:** `backend/tests/test_audit_routes.py`
- **Verification:** PAT auth test passes; bearer token accepted by audit route
- **Committed in:** `d087000` (Task 2 GREEN)

**5. [Rule 1 - Bug] Fixed ruff lint errors across test files**
- **Found during:** Task 2 (both RED and GREEN phases)
- **Issue:** Multiple F401 (unused imports: `timedelta`, `sa`, `async_sessionmaker`, `TeamMembership`) and F841 (unused variables: `t1`, `t2`, `u2`, `u3`, `entry`, etc.) in test files; ruff check --fix auto-fixed import ordering (I001)
- **Fix:** Auto-fixed with `ruff --fix`; manually converted `var = await _seed_x(...)` to bare `await _seed_x(...)` for unused seed results
- **Files modified:** `backend/tests/test_audit_reader.py`, `backend/tests/test_audit_csv.py`, `backend/tests/test_audit_routes.py`
- **Verification:** `ruff check backend/` returns zero errors
- **Committed in:** `d087000` (Task 2 GREEN)

---

**Total deviations:** 5 auto-fixed (4 Rule 1 bugs, 1 Rule 1 ruff hygiene)
**Impact on plan:** All fixes were correctness/toolchain issues discovered during TDD verification. No scope changes.

## Issues Encountered

- SQLite in-memory DB does not isolate transactions across aiosqlite sessions — a fundamental limitation documented in the test file; worked around via static code inspection for the FLUSH-not-COMMIT contract test
- Phase-1 UniqueConstraints on quotas were declared inside `create_table` (not as separate `op.create_index` calls), requiring `drop_constraint()` not `drop_index()` in the migration downgrade — identified from migration source inspection

## Canonical Audit Action Strings (UI-SPEC §Audit action labels)

The following `action` values are reserved for Phase 2 callers. Phase 3+ appends to this list.

| `action` value | Badge label | Color |
|----------------|-------------|-------|
| `vm.create` | "create vm" | success |
| `vm.update` | "update vm" | muted |
| `vm.delete` | "delete vm" | destructive |
| `vm.power.start` | "start vm" | warning |
| `vm.power.stop` | "stop vm" | warning |
| `vm.power.reboot` | "reboot vm" | warning |
| `vm.tag.add` | "tag added" | muted |
| `vm.tag.remove` | "tag removed" | muted |
| `vm.notes.update` | "notes updated" | muted |
| `auth.login` | "login" | primary |
| `auth.logout` | "logout" | primary |
| `auth.password.change` | "password changed" | primary |
| `auth.pat.mint` | "PAT minted" | primary |
| `auth.pat.revoke` | "PAT revoked" | primary |
| `auth.ssh-key.add` | "SSH key added" | primary |
| `auth.ssh-key.remove` | "SSH key removed" | primary |
| `auth.session.revoke` | "session revoked" | primary |
| `user.create` | "create user" | success |
| `user.update` | "update user" | muted |
| `user.delete` | "delete user" | destructive |
| `team.create` | "create team" | success |
| `team.update` | "update team" | muted |
| `team.delete` | "delete team" | destructive |
| `quota.update` | "quota updated" | muted |
| `cluster.create` | "register cluster" | success |
| `cluster.update` | "update cluster" | muted |
| `cluster.delete` | "delete cluster" | destructive |

## Known Stubs

None - all routes return real data from the database.

## Threat Flags

None - no new security surface beyond the routes declared in the plan. The `/api/v1/audit/export.csv` route is read-only and covered by RBAC predicate (same as the paginated route). Reads are not audited per D-20.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 2 mutating service functions (Plans 02-03 tags/notes, 02-04 quota edits) can now call `audit_write(db, ...)` synchronously before returning
- `audit_write` signature is stable: `(db, *, actor_user_id, actor_pat_id=None, team_id, cluster_id, action, target_type, target_id, result, source_ip, correlation_id=None, payload_before=None, payload_after=None, error=None)`
- Plan 02-06 frontend can build the audit log page against `GET /api/v1/audit` and `GET /api/v1/audit/export.csv` — both are live
- `quotas.cluster_id` column is ready for Plan 02-04's per-cluster quota writes

---
*Phase: 02-multi-cluster-inventory-quotas-audit*
*Completed: 2026-05-14*
