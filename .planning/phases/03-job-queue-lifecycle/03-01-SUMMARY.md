---
phase: 03-job-queue-lifecycle
plan: 01
subsystem: infra
tags: [arq, redis, job-queue, proxmox, upid-polling, alembic, systemd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: PVEConnector + circuit breaker, jobs table schema, registry.get_for_team, EncryptedSecret cipher, systemd worker placeholder unit
  - phase: 02-multi-cluster-inventory-quotas-audit
    provides: connector read/write methods, audit writer (flush-not-commit), inventory access RBAC
provides:
  - arq worker process (WorkerSettings + on_startup/on_shutdown) — runnable via `arq app.jobs.worker.WorkerSettings`
  - enqueue_job — the 202-Accepted enqueue contract with idempotency-key dedup
  - dispatch_and_poll — durable UPID polling loop (persist-before-poll, first-response-authoritative)
  - reap_orphans — boot-time orphan reaper covering all 5 edge cases
  - Redis pub/sub event channel (publish_event + ConnectionManager + jobs_event_pump)
  - map_pve_error — curated PVE-error → friendly-message map with raw fallback
  - 18 PVEConnector lifecycle/polling methods
  - 0004_phase3 migration — batch_id + friendly_error on jobs, backup_schedules table
  - deploy wiring — loopback-bound Redis + arq worker systemd unit
affects: [03-02-power-actions, 03-03-snapshots-resize-clone-migrate, 03-04-backups, 03 lifecycle routes, 03 frontend tasks-drawer]

# Tech tracking
tech-stack:
  added: ["arq==0.26.3", "redis[hiredis]==5.3.1"]
  patterns:
    - "Enqueue → worker → UPID-poll → Redis pub/sub pipeline"
    - "commit-before-enqueue ordering (jobs row committed before arq enqueue)"
    - "persist-UPID-before-poll (Pitfall 12) — UPID → DB → poll, never the reverse"
    - "first-response-authoritative UPID polling with adaptive geometric cadence"
    - "curated error map: case-insensitive substring matching with raw verbatim fallback"

key-files:
  created:
    - backend/alembic/versions/0004_phase3.py
    - backend/app/lifecycle/__init__.py
    - backend/app/lifecycle/errors.py
    - backend/app/jobs/__init__.py
    - backend/app/jobs/worker.py
    - backend/app/jobs/functions.py
    - backend/app/jobs/enqueue.py
    - backend/app/jobs/poller.py
    - backend/app/jobs/reaper.py
    - backend/app/jobs/events.py
    - backend/app/jobs/service.py
    - backend/app/jobs/schemas.py
    - backend/tests/test_jobs_infrastructure.py
    - backend/tests/test_lifecycle_errors.py
  modified:
    - backend/pyproject.toml
    - backend/app/models/job.py
    - backend/app/clusters/connector.py
    - backend/app/main.py
    - backend/tests/test_migrations.py
    - deploy/systemd/proxmox-gui-worker.service
    - deploy/lxc/bootstrap.sh
    - deploy/README.md

key-decisions:
  - "Error-map rules support OR-substrings and AND-tuple matchers; the cicustom rule precedes the broad storage rule so a migrate-time 'volume does not exist' maps to the node-local-file message"
  - "WARNINGS: exitstatus → succeeded (with the warning surfaced), not failed — a backup that warns still has a valid backup file (RESEARCH A3)"
  - "arq worker on_startup installs the cipher itself (separate process from the API) and aliases ctx['redis'] to ctx['arq_pool'] so reaper/poller read a stable key"
  - "API arq pool + jobs_event_pump are best-effort in the lifespan — a Redis outage must not block API boot"
  - "bootstrap.sh idempotent-exit branch now re-runs pip install + redis provisioning so a Phase-3 upgrade deploy never leaves the worker crashing on a missing arq import"

patterns-established:
  - "202-Accepted enqueue contract: enqueue_job inserts a pending jobs row, commits BEFORE the arq enqueue, dedups on a sha256(kind+actor+payload) idempotency key"
  - "UPID poller: persist upid+upid_node+running BEFORE the poll loop; treat the first stopped status as authoritative; adaptive cadence 0.5s→×1.6→cap 30s"
  - "Orphan reaper: 5 boot-time edge cases — upid+running re-attach, upid+stopped resolve, upid+404 needs_review, no-upid+pending re-enqueue, no-upid+claimed/running needs_review"
  - "Connector lifecycle methods: every PVE call routes through _call_with_breaker; the root-only lock-override param is never sent"

requirements-completed: [API-04, LIFE-12, LIFE-13, LIFE-14, UI-06]

# Metrics
duration: 17min
completed: 2026-05-16
---

# Phase 3 Plan 01: Job-Queue Infrastructure Summary

**The enqueue → arq-worker → UPID-poll → Redis-pub/sub pipeline: a runnable arq worker, durable UPID polling, a 5-edge-case orphan reaper, the 202-Accepted enqueue contract, the curated PVE-error map, 18 connector lifecycle methods, the 0004_phase3 migration, and loopback-bound Redis deploy wiring.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-16T11:55:32Z
- **Completed:** 2026-05-16T12:12:58Z
- **Tasks:** 3
- **Files created:** 14, **Files modified:** 8

## Accomplishments

- The Phase 3 job pipeline foundation every later plan depends on: a real arq
  worker (`WorkerSettings` with `on_startup`/`on_shutdown`), the `enqueue_job`
  202-contract helper, the `dispatch_and_poll` UPID poller, the `reap_orphans`
  boot-time reaper, and the Redis pub/sub event channel.
- `PVEConnector` extended with 18 lifecycle/polling methods (`vm_power`,
  `vm_delete`, `task_status`, `task_log`, `snapshot_*`, `vzdump`, `restore`,
  `resize_disk`, `clone`, `to_template`, `migrate`, `cluster_status`,
  `cluster_nextid`, `node_storages`, `unlock`) — all routed through the circuit
  breaker, zero references to the root-only lock-override parameter.
- The curated PVE-error map (`map_pve_error`) — case-insensitive substring
  matching against locked friendly copy, raw verbatim fallback, never a vague
  generic placeholder (Pitfall 24 / D-13).
- The `0004_phase3` migration — `batch_id` + `friendly_error` columns on
  `jobs`, plus the `backup_schedules` table for LIFE-06 — round-trips cleanly.
- Deploy wiring: `bootstrap.sh` installs loopback-bound Redis, the worker unit
  runs `arq`, and the idempotent-exit branch re-runs `pip install` so a
  Phase-3 upgrade deploy gets arq/redis into the venv.

## Task Commits

Each task was committed atomically:

1. **Task 1: Dependencies, 0004_phase3 migration, connector lifecycle methods** — `5e8b575` (feat)
2. **Task 2: Curated PVE-error map + jobs package (worker/enqueue/poller/reaper/events)** — `1169ef2` (feat)
3. **Task 3: Deploy wiring — Redis install, worker arq unit, bootstrap upgrade-trap fix** — `ffafee2` (feat)

_Tasks 1 & 2 were `tdd="true"`; tests were written RED first, then implementation made them GREEN — both committed together per task as the plan's per-task commit protocol directs._

## Files Created/Modified

**Created:**
- `backend/app/jobs/worker.py` — arq `WorkerSettings`, `on_startup` (cipher + registry + reaper), `on_shutdown`
- `backend/app/jobs/enqueue.py` — `enqueue_job` 202-contract helper with idempotency dedup
- `backend/app/jobs/poller.py` — `dispatch_and_poll` UPID polling loop
- `backend/app/jobs/reaper.py` — `reap_orphans` boot-time orphan reconciliation
- `backend/app/jobs/events.py` — Redis pub/sub publish + `ConnectionManager` + `jobs_event_pump`
- `backend/app/jobs/service.py` — job-row CRUD + state transitions
- `backend/app/jobs/schemas.py` — `JobResponse`/`JobListResponse` + `serialize_job`
- `backend/app/jobs/functions.py` — `noop_job` stub (Plans 02/03/04 add real `run_*`)
- `backend/app/lifecycle/errors.py` — `map_pve_error` curated error map
- `backend/alembic/versions/0004_phase3.py` — the Phase-3 migration
- `backend/tests/test_jobs_infrastructure.py`, `backend/tests/test_lifecycle_errors.py` — 22 + 9 tests

**Modified:**
- `backend/pyproject.toml` — added `arq==0.26.3`, `redis[hiredis]==5.3.1`
- `backend/app/models/job.py` — `batch_id` + `friendly_error` columns + `ix_jobs_batch_id`
- `backend/app/clusters/connector.py` — 18 lifecycle/polling methods
- `backend/app/main.py` — lifespan creates the arq pool + starts `jobs_event_pump`
- `backend/tests/test_migrations.py` — updated table-set expectations for the 12th table
- `deploy/systemd/proxmox-gui-worker.service` — arq `ExecStart` + `Requires=redis-server.service`
- `deploy/lxc/bootstrap.sh` — Redis install/loopback-guard, worker enable, idempotent-branch fix
- `deploy/README.md` — documents Redis as the 4th loopback-bound runtime service

## Decisions Made

- **Error-map matcher model.** Plan rules included an AND condition
  (`volume`+`does not exist`). The map supports a matcher being either a
  string (OR-substring) or a tuple (AND-group), and orders the `cicustom`
  rule before the broad storage rule so a migrate-time
  `volume '...' does not exist` maps to the node-local-file message.
- **`WARNINGS:` exitstatus → succeeded** (RESEARCH A3) — surfaced as a
  `friendly_error` "Completed with warnings: ..." while keeping the job
  terminal-success, because a backup that warns still has a valid file.
- **Worker process self-installs the cipher.** The arq worker is a separate
  process from the API, so `on_startup` loads `master.key` and calls
  `install_cipher` itself before building the registry.
- **API arq pool is best-effort.** A Redis outage at API boot is caught and
  warned, never fatal — the API still serves; lifecycle routes (Plan 02) will
  surface a clear error if the queue is down.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test_migrations.py` table-set assertions broken by the new table**
- **Found during:** Task 1 (0004_phase3 migration)
- **Issue:** `test_upgrade_head_creates_all_eleven_tables` asserted an exact
  11-table set (`business == expected`); the new `backup_schedules` table is a
  legitimate 12th. `test_0003_phase2_round_trip` used `downgrade -1` from
  `head` — with `head` now `0004_phase3`, that reverted 0004 instead of the
  0003 the test targets.
- **Fix:** Renamed the table test to `..._all_business_tables`, added
  `backup_schedules` to the expected set; pinned the 0003 round-trip test to
  `upgrade(cfg, "0003_phase2")` so its `downgrade -1` reverts 0003.
- **Files modified:** `backend/tests/test_migrations.py`
- **Verification:** `pytest tests/test_migrations.py` — 8 passed.
- **Committed in:** `5e8b575` (Task 1 commit)

**2. [Rule 1 - Bug] Pre-existing `main.py` import-sort lint fixed**
- **Found during:** Task 2 (`main.py` lifespan changes)
- **Issue:** `ruff` (pinned 0.15.12) flagged an I001 un-sorted import block at
  `main.py:73` (a pre-existing in-function import that an older ruff
  tolerated). Task 2 legitimately modifies `main.py`, and the plan's Task 1
  step 5 / Task 2 verify both run `ruff check .`.
- **Fix:** Added the blank line between the stdlib and first-party in-function
  imports.
- **Files modified:** `backend/app/main.py`
- **Verification:** `ruff check app/main.py` — clean.
- **Committed in:** `1169ef2` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes).
**Impact on plan:** Both fixes were necessary to keep the test suite and
lint green after a correct schema change. No scope creep — the migration
and lifespan changes are exactly as the plan specified.

## Issues Encountered

- **shellcheck not installed.** The Task 3 verify needs `shellcheck`; the
  environment lacked it and `apt-get` was unprivileged. Resolved by
  downloading the static `shellcheck-stable` binary to `/tmp` and running it
  from there — `bootstrap.sh` is shellcheck-clean.
- **The Write tool appended stray `</content>`/`</invoke>` tags** to several
  newly-created files, causing `SyntaxError` on first import. Stripped with a
  targeted `sed` on each affected file; all files verified clean afterwards.

## Known Stubs

- `backend/app/jobs/functions.py` — `noop_job` is an **intentional** stub.
  The plan explicitly specifies it as the single placeholder `functions`
  entry so `worker.py` imports cleanly and the worker can start; Plans
  02/03/04 add the real `run_*` job functions. Documented in the module
  docstring. Not a blocker for this plan's goal (build the pipeline shell).

## Out-of-Scope Items Logged

- `backend/app/inventory/service.py:11` — a pre-existing `ruff` F401
  (unused `PVEConnector` import, owned by Plan 02-03) was discovered but NOT
  fixed (scope boundary). Logged to
  `.planning/phases/03-job-queue-lifecycle/deferred-items.md`.

## Next Phase Readiness

- The job pipeline shell is complete and runnable. Plan 03-02 (power actions)
  can now add thin per-operation job kinds: register `run_*` functions in
  `WorkerSettings.functions`, call `enqueue_job` from a `202`-returning route,
  and drive `dispatch_and_poll` from each job function.
- The `0004_phase3` migration is landed, so `batch_id` (bulk grouping) and
  `backup_schedules` (Plan 04) are schema-stable.
- **Operational note:** the worker process needs a running Redis. In the LXC
  this is handled by `bootstrap.sh`; for local development the worker/API
  expect Redis on `127.0.0.1:6379` (the API pool degrades gracefully if it
  is absent, but the worker requires it).

## Self-Check: PASSED

- All 7 spot-checked key files exist on disk (`worker.py`, `enqueue.py`,
  `poller.py`, `reaper.py`, `events.py`, `errors.py`, `0004_phase3.py`).
- All 3 task commits present in git history (`5e8b575`, `1169ef2`, `ffafee2`).
- Plan-level verification: 314 tests pass; `0004_phase3` migration
  round-trips (`upgrade head → downgrade -1 → upgrade head`, exit 0);
  `from app.jobs.worker import WorkerSettings` imports without error;
  `shellcheck deploy/lxc/bootstrap.sh` clean.

---
*Phase: 03-job-queue-lifecycle*
*Completed: 2026-05-16*
