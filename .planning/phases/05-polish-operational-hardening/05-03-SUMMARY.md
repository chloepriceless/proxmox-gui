---
phase: 05-polish-operational-hardening
plan: 03
subsystem: audit
tags: [audit, retention, arq, csv, gzip, path-traversal, cluster-probe]

# Dependency graph
requires:
  - phase: 05-polish-operational-hardening
    plan: 01
    provides: app_setting (audit_retention_days), worker stub registrations (roll_audit_log + probe_clusters), get_setting reader
  - phase: 03-job-queue-lifecycle
    provides: arq WorkerSettings cron_jobs slot, backups_cron sweep pattern
  - phase: 02-multi-cluster-inventory-quotas-audit
    provides: audit_csv_stream + escape_cell + AuditLog model
  - phase: 02-multi-cluster-inventory-quotas-audit
    provides: PVEConnectorRegistry + connector.version + PVEUnreachable/PVEAuthError/PVEAPIError
provides:
  - "audit_header_row + audit_row shared CSV formatters (no drift between user export and retention archive)"
  - "app.audit.archive: write_audit_archive + list_archives + resolve_archive_path with path-traversal guard"
  - "roll_audit_log nightly cron — write-then-delete; reads audit_retention_days fresh each run"
  - "GET /api/v1/audit/archives + GET /api/v1/audit/archives/{name} (admin-only)"
  - "probe_clusters arq cron — sweeps every active cluster, persists status to the registry's cached connector"
affects: [05-04-self-update]

# Tech tracking
tech-stack:
  added:
    - "gzip (stdlib) — .csv.gz archive writer"
  patterns:
    - "Write-then-delete ordering (archive durable before DELETE) — T-05-03-03"
    - "Path-traversal guard via is_relative_to(base.resolve()) — Pitfall 5"
    - "Per-item try/except sweep — one bad cluster never aborts the cron"
    - "Shared CSV row/header helpers — user export + archive cannot drift"

key-files:
  created:
    - backend/app/audit/archive.py
    - backend/tests/test_audit_retention.py
    - backend/tests/test_audit_archives.py
    - backend/tests/test_cluster_probe.py
  modified:
    - backend/app/audit/csv.py
    - backend/app/audit/routes.py
    - backend/app/jobs/retention_cron.py
    - backend/app/clusters/probe.py

key-decisions:
  - "Archive layout uses the same header + row format as the user export (shared audit_header_row / audit_row helpers); the archive simply omits the RBAC predicate."
  - "Archives are NOT auto-pruned in v1 — they are the compliance artifact (RESEARCH Open Question 3 / T-05-03-05 accept). Filename is audit-<from>-<to>.csv.gz so an operator can sort by date when manually clearing."
  - "Reachability status persists to the worker registry's cached connector (in-memory across cron runs) rather than to a clusters.status DB column — matches the field health.py updates and avoids an unnecessary 0008 migration. The worker registry is held for the process's lifetime."
  - "Path-traversal guard rejects on the LITERAL presence of '/', '\\\\', or '..' before resolving — defence in depth alongside the is_relative_to check."

patterns-established:
  - "Single shared CSV serialisation surface (audit_header_row + audit_row) reused by every audit export path"
  - "arq cron defensive wrapping: module-level try/except + per-item try/except so neither shape of failure crashes the worker"

requirements-completed: [AUDIT-06]

# Metrics
duration: ~50min
completed: 2026-05-19
---

# Phase 5 Plan 03: Audit Retention Rotation & Scheduled Cluster Probe Summary

**Nightly arq cron rolls audit_log rows past audit_retention_days into a write-then-delete .csv.gz archive (AUDIT-06); admin can list and path-traversal-safely download those archives; scheduled cron probes every active cluster every 15 minutes and persists reachability — replacing the two 05-01 placeholder cron bodies with real implementations.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-05-19
- **Completed:** 2026-05-19
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- **AUDIT-06 audit-retention cron (D-06/D-07):** `roll_audit_log` reads
  `audit_retention_days` fresh each run, archives every `audit_log` row whose
  `occurred_at < now - retention` into a `audit-<from>-<to>.csv.gz` under
  `/var/lib/proxmox-gui/audit-archives/`, then deletes the rolled rows. The
  DELETE only fires after the gzip file handle is closed (write-then-delete
  ordering — T-05-03-03). A `NULL` retention window or a no-op run is
  handled defensively.
- **Shared CSV serialisation helpers:** `audit_header_row()` and
  `audit_row(...)` factor the per-cell `escape_cell` formatting and the
  column list out of `audit_csv_stream`. The user export and the retention
  archive now share one canonical row shape — they can only drift via this
  one helper (RESEARCH §Pattern 4).
- **Admin archive list + download (D-08):**
  - `GET /api/v1/audit/archives` returns `[{name, size_bytes, ctime}]`,
    newest first.
  - `GET /api/v1/audit/archives/{name}` streams the gzip as
    `Content-Disposition: attachment`. Path-traversal guard
    (`resolve_archive_path`) rejects any name containing `/`, `\`, or `..`
    AND asserts `is_relative_to(ARCHIVE_DIR.resolve())` (T-05-03-01 /
    Pitfall 5). Both routes are `require_admin` — the archives are the
    unscoped compliance dump, never RBAC-filtered (T-05-03-02).
- **Scheduled cluster health probe (carryover CLUST-06):**
  `probe_clusters` iterates every active `Cluster` row, acquires the
  cached connector from `ctx["registry"]`, calls `connector.version()`, and
  updates the same in-memory `status`/`last_seen_healthy`/`last_error`
  fields the in-process `health.py` probe writes. The registry is process-
  lifetime, so the same connector instance is reused on subsequent cron
  runs and status persists across runs without a new DB column. Per-cluster
  try/except so one `PVEUnreachable` cannot abort the sweep (T-05-03-04).
- **Both 05-01 placeholders replaced with real bodies** — `worker.py` did
  not need editing; only the function bodies changed.

## Task Commits

Each task followed the TDD RED → GREEN cycle:

1. **Task 1: audit-retention cron + CSV.gz archive writer (AUDIT-06)**
   - `44cb49e` test(05-03): add failing tests for audit retention cron
   - `24441e7` feat(05-03): audit retention cron + CSV.gz archive writer (AUDIT-06)
2. **Task 2: audit-archive list + download routes + scheduled cluster probe**
   - `676cecb` test(05-03): add failing tests for audit-archive routes + probe_clusters
   - `4a3bffb` feat(05-03): audit-archive routes + scheduled cluster health probe

_TDD gate compliance: each task has a `test(...)` commit (RED) preceding
its `feat(...)` commit (GREEN). No REFACTOR commits were needed — the
shared-helper extraction in `audit_csv_stream` is part of the GREEN commit
that introduces the helpers, since it does not change behaviour._

## Files Created/Modified

**Created:**

- `backend/app/audit/archive.py` — `write_audit_archive` + `list_archives`
  + `resolve_archive_path` with the path-traversal guard.
- `backend/tests/test_audit_retention.py` — 5 behaviour tests for
  `roll_audit_log` (archive+delete, no-op fresh, header parity,
  write-then-delete source ordering, archive-failure recovery).
- `backend/tests/test_audit_archives.py` — 7 route tests
  (admin list, non-admin 403, admin download, traversal 400 for `..` and
  `\`, non-admin download 403).
- `backend/tests/test_cluster_probe.py` — 2 probe tests (all reachable
  → status='ok'; one unreachable does not abort the sweep).

**Modified:**

- `backend/app/audit/csv.py` — factor `audit_header_row()` + `audit_row()`
  shared helpers; `audit_csv_stream` now delegates to them.
- `backend/app/audit/routes.py` — add `GET /archives` +
  `GET /archives/{name}` routes (both `require_admin`).
- `backend/app/jobs/retention_cron.py` — replace placeholder body with the
  real cron (read setting → select rolled rows → archive → delete).
- `backend/app/clusters/probe.py` — replace placeholder body with the real
  cron (sweep `Cluster` rows → `connector.version()` → update status).

## Decisions Made

- **Archive layout = user-export layout.** The same header + row formatter
  used by `GET /audit/export.csv` writes the archive — operators can open a
  `.csv.gz` in Excel and get the columns they expect. The retention path
  simply omits the RBAC predicate (the archive is the unscoped compliance
  dump; access is gated by `require_admin` at the HTTP layer).
- **Status persists on the connector, not the DB row.** The plan said
  "persist each cluster's reachability status" but no `clusters.status`
  column exists, and the plan's `files_modified` does not list a migration.
  The connector instance carries `status` / `last_seen_healthy` /
  `last_error` (the same fields `health.py` updates), the worker registry
  caches connectors for the process's lifetime, so probe results survive
  across cron runs without a new migration. This is the field the plan's
  Patterns map cited ("the same field `health.py` updates").
- **Archive directory layout under `/var/lib/proxmox-gui/audit-archives/`.**
  Outside `/opt` — survives a self-update tarball swap (Pitfall 7). Tests
  monkeypatch `archive.ARCHIVE_DIR` to a `tmp_path` so they never write to
  the real LXC filesystem.
- **Defensive double-wrap on the retention cron.** The Task 1 plan body
  asks for a single try/except around the run; I additionally surrounded
  the entire `roll_audit_log` body in try/except so a `get_setting` /
  registry-level failure also fails-soft. The behaviour test exercises the
  inner `write_audit_archive` failure path — the un-archived row stays.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Path-traversal test had to avoid raw `/` in the URL**

- **Found during:** Task 2 RED phase
- **Issue:** The plan suggested
  `GET /api/v1/audit/archives/..%2F..%2Fetc%2Fpasswd` as the
  traversal-rejection probe. Starlette decodes `%2F` to `/` before
  matching, which splits the URL across path segments — the route
  `/archives/{name}` never matches and the response is a 404 from
  FastAPI's path matcher, not a 400 from our guard.
- **Fix:** Used two single-segment names that still trigger the guard's
  literal-string checks: `..etc-passwd` (the `..` substring) and
  `foo%5Cbar.csv.gz` (an encoded backslash). Both correctly return 400
  from `resolve_archive_path`. The double-coverage proves both prongs
  of the guard work.
- **Files modified:** `backend/tests/test_audit_archives.py`
- **Verification:** Both 400 assertions pass; the route reachability
  matches the production attack surface (a real attacker would either
  send the `..` substring directly or use a backslash).

**Total deviations:** 1 auto-fixed (test-harness URL encoding correction).
**Impact on plan:** None — production code is unchanged from the plan's
intent; only the test URL shape adjusts to how Starlette decodes paths.

## Known Stubs

None. Both placeholder cron bodies from 05-01 are now real implementations.

## Issues Encountered

- The bare `pytest` / `python` commands in the plan's `<verify>` blocks are
  not on PATH in this environment; used the project's `.venv/bin/python -m`
  equivalents. Worker import is covered by
  `python -c "from app.jobs.worker import WorkerSettings"`.
- One test initially failed because the RED test used `async def _boom`
  for a now-synchronous `write_audit_archive` mock — fixed by making the
  mock synchronous (matches the real signature).

## TDD Gate Compliance

Both tasks completed the RED → GREEN cycle. Each task's failing-test
commit (`test(05-03)`) precedes its implementation commit (`feat(05-03)`).
No test passed unexpectedly during a RED phase. No REFACTOR commits were
required — the `audit_csv_stream` refactor is part of the GREEN commit
that introduces the shared helpers (mechanical extraction; no behaviour
change).

## Verification Results

- `cd backend && .venv/bin/python -m pytest tests/test_audit_retention.py tests/test_audit_archives.py tests/test_cluster_probe.py -q` — **14 passed**.
- `cd backend && .venv/bin/python -m pytest tests/test_audit_csv.py tests/test_audit_routes.py -q` — **14 passed** (no regression from the `audit/csv.py` refactor).
- `cd backend && .venv/bin/python -c "from app.jobs.worker import WorkerSettings"` — worker imports cleanly with `cron_jobs=3`.
- Full backend suite: **580 passed**, 0 failed.

## Acceptance Criteria

- [x] `grep -q "async def roll_audit_log" backend/app/jobs/retention_cron.py` — PASS
- [x] `! grep -q "NotImplementedError" backend/app/jobs/retention_cron.py` — PASS
- [x] `grep -q "audit_retention_days" backend/app/jobs/retention_cron.py` — PASS
- [x] `grep -qE "def write_audit_archive\|def list_archives\|def resolve_archive_path" backend/app/audit/archive.py` — PASS
- [x] `grep -q "is_relative_to" backend/app/audit/archive.py` — PASS
- [x] `grep -q "gzip" backend/app/audit/archive.py` — PASS
- [x] DELETE statement appears AFTER the `write_audit_archive` call in `retention_cron.py` — VERIFIED by source-inspection test + manual read
- [x] `grep -q "audit_archives_list" backend/app/audit/routes.py` — PASS
- [x] `grep -q "audit_archive_download" backend/app/audit/routes.py` — PASS
- [x] `grep -q "require_admin" backend/app/audit/routes.py` (on the archive routes) — PASS
- [x] `grep -q "FileResponse" backend/app/audit/routes.py` — PASS
- [x] `grep -q "async def probe_clusters" backend/app/clusters/probe.py` — PASS
- [x] `! grep -q "NotImplementedError" backend/app/clusters/probe.py` — PASS
- [x] `grep -qE "version\(\)" backend/app/clusters/probe.py` — PASS
- [x] `grep -q "PVEUnreachable" backend/app/clusters/probe.py` — PASS

## Next Phase Readiness

- AUDIT-06 is complete. The frontend admin Audit page can now consume
  `GET /audit/archives` + `GET /audit/archives/{name}` directly — no new
  backend surface needed for the D-08 "list + download" UX.
- The carryover scheduled cluster health probe is live; reachability now
  refreshes every 15 minutes even when no API call has happened in
  between.
- The two 05-01 placeholder cron bodies are now real — Plan 05-04 only
  needs to land `run_self_update`, which is also pre-registered in
  `WorkerSettings.functions`.

## Self-Check: PASSED

All 4 created files exist on disk:

- `backend/app/audit/archive.py` ✓
- `backend/tests/test_audit_retention.py` ✓
- `backend/tests/test_audit_archives.py` ✓
- `backend/tests/test_cluster_probe.py` ✓

All 4 task commits are present in `git log`:

- `44cb49e` (Task 1 RED) ✓
- `24441e7` (Task 1 GREEN) ✓
- `676cecb` (Task 2 RED) ✓
- `4a3bffb` (Task 2 GREEN) ✓

---

_Phase: 05-polish-operational-hardening_
_Completed: 2026-05-19_
