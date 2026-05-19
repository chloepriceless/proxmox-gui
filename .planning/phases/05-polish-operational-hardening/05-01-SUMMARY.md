---
phase: 05-polish-operational-hardening
plan: 01
subsystem: auth
tags: [fastapi, sqlalchemy, alembic, arq, idle-timeout, settings, refresh-token]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: refresh-token rotation chain, consume_refresh chokepoint, audit_write
  - phase: 03-job-queue-lifecycle
    provides: arq WorkerSettings (functions + cron_jobs registration pattern)
provides:
  - app_setting single-row runtime-config table + 0007_phase5 migration
  - admin GET/PATCH /api/v1/admin/settings (idle timeout + audit retention)
  - settings service with get_setting reader + in-process cache
  - server-authoritative idle-session-timeout enforcement in consume_refresh
  - IdleExpired exception + session_idle_expired refresh-route signal
  - POST /api/v1/auth/keepalive (no-rotation session extension)
  - worker.py registration of admin.self-update, roll_audit_log, probe_clusters
affects: [05-02-mobile-a11y, 05-03-carryover-retention, 05-04-self-update]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-row typed-columns config table (catalog_pin analog) with schema-invariant allowlist"
    - "In-process settings cache; worker reads DB directly (no cross-process IPC)"
    - "Server-authoritative idle gate layered onto the existing refresh chokepoint"
    - "Placeholder worker job/cron modules so downstream plans land only function bodies"

key-files:
  created:
    - backend/app/models/app_setting.py
    - backend/app/settings/__init__.py
    - backend/app/settings/schemas.py
    - backend/app/settings/service.py
    - backend/app/settings/routes.py
    - backend/alembic/versions/0007_phase5.py
    - backend/app/jobs/selfupdate_functions.py
    - backend/app/jobs/retention_cron.py
    - backend/app/clusters/probe.py
    - backend/tests/test_app_setting_model.py
    - backend/tests/test_settings.py
    - backend/tests/test_auth_idle.py
    - backend/tests/test_keepalive.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/models/refresh_token.py
    - backend/app/auth/refresh.py
    - backend/app/auth/routes.py
    - backend/app/jobs/worker.py
    - backend/app/main.py
    - backend/tests/conftest.py
    - backend/tests/test_schema_invariants.py
    - backend/tests/test_migrations.py
    - backend/tests/test_models_metadata.py
    - backend/tests/test_provisioning.py

key-decisions:
  - "Idle window stored in the settings table (D-02 default 30 min); the idle check reads it via get_setting on every refresh"
  - "Keepalive bumps last_active_at without rotation — cheaper than burning a refresh-token rotation"
  - "session_idle_expired is a stable machine token (not prose) so the SPA can distinguish an idle expiry from a generic logout"
  - "Three downstream worker entry points registered now via thin NotImplementedError placeholders so 05-03/05-04 do not re-edit worker.py"

patterns-established:
  - "Single-row config table: catalog_pin analog, FK name= explicit, allowlisted in test_schema_invariants with a rationale"
  - "Settings cache: module-level _cache invalidated on write; worker process reads the DB directly"
  - "Idle enforcement: NULL-defensive (last_active_at or created_at) + naive-datetime tzinfo normalisation"

requirements-completed: [AUTH-06]

# Metrics
duration: ~40min
completed: 2026-05-19
---

# Phase 5 Plan 01: Runtime Settings & Idle-Session Timeout Backend Summary

**DB-backed runtime Settings layer (app_setting table + admin GET/PATCH) plus server-authoritative idle-session-timeout enforced inside the refresh-token chokepoint, with a no-rotation keepalive route and three pre-registered worker job entry points.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-05-19
- **Completed:** 2026-05-19
- **Tasks:** 3
- **Files modified:** 24 (13 created, 11 modified)

## Accomplishments

- `app_setting` single-row global config table (D-01) — canonical home for the
  idle-timeout value (D-02, default 30 min) and the audit-retention value
  (D-06, default 365 days); landed via the single Phase-5 migration `0007_phase5`.
- `refresh_tokens.last_active_at` column added via SQLite batch mode and
  backfilled from `created_at` so existing sessions survive the deploy
  (Pitfall 3 / Threat T-05-01-04).
- Admin `GET/PATCH /api/v1/admin/settings` — admin-gated, CSRF-protected on the
  mutation, writes a `settings.update` audit row with before/after payloads,
  invalidates an in-process cache so changes are live without a restart.
- Server-authoritative idle gate: `IdleExpired` raised inside `consume_refresh`;
  `/auth/refresh` returns 401 `detail="session_idle_expired"` — a distinct
  signal for the D-03 re-auth modal.
- `POST /api/v1/auth/keepalive` (D-04) — extends a session by bumping
  `last_active_at` without rotating the token; CSRF-exempt like `/refresh`.
- `worker.py` registers `admin.self-update`, `roll_audit_log`, and
  `probe_clusters` so plans 05-03/05-04 land only function bodies.

## Task Commits

Each task followed the TDD RED → GREEN cycle:

1. **Task 1: app_setting model + 0007 migration + schema-invariant allowlist**
   - `59b976f` test(05-01): add failing tests for AppSetting model + 0007 migration
   - `2555e30` feat(05-01): add AppSetting model + 0007_phase5 migration
2. **Task 2: settings service + admin GET/PATCH routes with cache + audit**
   - `d49381b` test(05-01): add failing tests for settings service + admin routes
   - `3fc5512` feat(05-01): add settings service + admin GET/PATCH routes
3. **Task 3: idle enforcement in refresh, keepalive route, worker registrations**
   - `10799a7` test(05-01): add failing tests for idle timeout, keepalive, worker jobs
   - `a6b26a7` feat(05-01): enforce idle timeout, add keepalive route + worker jobs

_TDD gate compliance: each task has a `test(...)` commit (RED) preceding its
`feat(...)` commit (GREEN). No REFACTOR commits were needed._

## Files Created/Modified

**Created:**
- `backend/app/models/app_setting.py` — single-row `AppSetting` ORM model (D-01)
- `backend/app/settings/{__init__,schemas,service,routes}.py` — settings package
- `backend/alembic/versions/0007_phase5.py` — settings table + `last_active_at` + backfill
- `backend/app/jobs/selfupdate_functions.py` — `run_self_update` placeholder (TODO 05-04)
- `backend/app/jobs/retention_cron.py` — `roll_audit_log` placeholder (TODO 05-03)
- `backend/app/clusters/probe.py` — `probe_clusters` placeholder (TODO 05-03)
- `backend/tests/test_app_setting_model.py`, `test_settings.py`, `test_auth_idle.py`, `test_keepalive.py`

**Modified:**
- `backend/app/models/__init__.py` — register `AppSetting`
- `backend/app/models/refresh_token.py` — add `last_active_at` column
- `backend/app/auth/refresh.py` — `IdleExpired` class + idle check + `last_active_at` stamp
- `backend/app/auth/routes.py` — `except IdleExpired` arm + `POST /auth/keepalive`
- `backend/app/jobs/worker.py` — register three new job/cron entry points
- `backend/app/main.py` — mount the settings router at `/api/v1/admin/settings`
- `backend/tests/conftest.py` — autouse fixture resetting the settings cache
- `backend/tests/test_schema_invariants.py` — allowlist `app_setting`
- `backend/tests/{test_migrations,test_models_metadata,test_provisioning}.py` — account for the new table + 0007 head

## Decisions Made

- **Idle-window granularity:** the idle check runs on each `/auth/refresh`,
  so effective enforcement granularity is the access-JWT TTL — accepted per the
  CONTEXT.md "Claude's discretion" note.
- **Keepalive over rotation:** the keepalive route bumps `last_active_at`
  directly rather than calling `issue_refresh`; rotating on every 2-minute
  warning ping would needlessly churn the rotation chain.
- **Placeholder modules raise `NotImplementedError`:** chosen over empty stubs
  so an accidental early invocation fails loudly; each carries a
  `# TODO(05-03)` / `# TODO(05-04)` marker.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated three pre-existing strict table-set assertions**
- **Found during:** Task 1 (and surfaced fully by the post-Task-3 full-suite run)
- **Issue:** `test_migrations.py::test_upgrade_head_creates_all_business_tables`,
  `test_models_metadata.py::test_metadata_has_exactly_all_business_tables`, and
  `test_provisioning.py::test_0006_phase4_round_trips` each hard-code the exact
  set of business tables / use `downgrade -1` from `head`. The new `app_setting`
  table and the new `0007_phase5` head broke all three.
- **Fix:** Added `app_setting` to the two expected-table sets (and bumped the
  metadata count 15 → 16); changed the 0006 round-trip test to downgrade to the
  explicit `0005_phase3_backup_storage` revision instead of a bare `-1` (the
  same pattern already used by `test_migrations`' 0003 round-trip test).
- **Files modified:** `backend/tests/test_migrations.py`,
  `backend/tests/test_models_metadata.py`, `backend/tests/test_provisioning.py`
- **Verification:** All three tests pass; full backend suite 535 passed.
- **Committed in:** `2555e30` (Task 1) and `a6b26a7` (Task 3).

**2. [Rule 2 - Missing Critical] Added a settings-cache reset fixture to conftest**
- **Found during:** Task 3
- **Issue:** The settings service's module-level `_cache` is per-process; a row
  cached by a settings test would otherwise leak into a later test running
  against a different in-memory DB — a cross-test isolation hazard.
- **Fix:** Added an autouse `_reset_settings_cache` fixture to `conftest.py`,
  mirroring the existing `_reset_rate_limit_buckets` / `_reset_vmid_reservations`
  fixtures, and removed the now-redundant per-file fixtures.
- **Files modified:** `backend/tests/conftest.py`, `backend/tests/test_settings.py`,
  `backend/tests/test_auth_idle.py`
- **Verification:** Full backend suite green on a fresh run.
- **Committed in:** `a6b26a7` (Task 3 commit).

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical test isolation)
**Impact on plan:** Both auto-fixes are test-harness corrections required by the
new table/migration. No production-scope creep — the three placeholder modules
are explicitly mandated by the plan, not deviations.

## Known Stubs

Three placeholder modules were created **intentionally and per the plan** so
that `worker.py` does not need re-editing by downstream plans. Each raises
`NotImplementedError` and carries an explicit TODO marker. They are NOT
reachable in plan 05-01's surface (no route or cron actually fires them in this
plan's tests) and are resolved by later phase-5 plans:

| Stub | File | Resolved by |
|------|------|-------------|
| `run_self_update` | `backend/app/jobs/selfupdate_functions.py` | Plan 05-04 (DEPLOY-04 self-update orchestration) |
| `roll_audit_log` | `backend/app/jobs/retention_cron.py` | Plan 05-03 (AUDIT-06 audit retention cron) |
| `probe_clusters` | `backend/app/clusters/probe.py` | Plan 05-03 (carryover scheduled health probe) |

These do not block plan 05-01's goal: the settings layer and idle-timeout
backend are fully functional. The worker `cron`/`func` registrations only
reference the symbols; an invocation would fail loudly, which is the intended
fail-fast behaviour until 05-03/05-04 land the bodies.

## Issues Encountered

- The bare `alembic` / `python` commands in the plan's `<verify>` blocks are
  not on PATH in this environment; used the project's `.venv/bin/python -m`
  equivalents. Migration round-trip behaviour is fully covered by the new
  `test_app_setting_model.py` tests and `test_migrations.py`.

## TDD Gate Compliance

All three tasks completed the RED → GREEN cycle. Each task's failing-test
commit (`test(...)`) precedes its implementation commit (`feat(...)`). No test
passed unexpectedly during a RED phase. No REFACTOR commits were required.

## Verification Results

- `0007_phase5` applies cleanly; `downgrade -1` then `upgrade head` round-trips.
- `test_schema_invariants.py`, `test_settings.py`, `test_auth_idle.py`,
  `test_keepalive.py`, `test_app_setting_model.py` — all green.
- `from app.jobs.worker import WorkerSettings` imports with all three new
  registrations (`admin.self-update`, `roll_audit_log`, `probe_clusters`).
- Full backend suite: **535 passed**, 0 failed.

## Next Phase Readiness

- The settings layer is the canonical config home for plan 05-03 (audit
  retention reads `audit_retention_days` via `get_setting`) and the frontend
  Settings page.
- `worker.py` will not need re-editing by 05-03/05-04 — only the three
  placeholder bodies must be filled in.
- The idle-timeout backend is complete; the frontend idle countdown +
  `SessionExpiredModal` (D-03/D-04) is a separate downstream plan and consumes
  `GET /admin/settings` for the window and `POST /auth/keepalive` for the ping.

## Self-Check: PASSED

All 14 expected files exist on disk; all 6 task commits
(`59b976f`, `2555e30`, `d49381b`, `3fc5512`, `10799a7`, `a6b26a7`) are present
in the git history.

---
*Phase: 05-polish-operational-hardening*
*Completed: 2026-05-19*
