---
phase: 03-job-queue-lifecycle
plan: 02
subsystem: api
tags: [arq, job-queue, websocket, proxmox, upid-polling, lifecycle, power-actions, rbac]

# Dependency graph
requires:
  - phase: 03-job-queue-lifecycle
    provides: enqueue_job (202 contract), dispatch_and_poll (UPID poller), CONNECTION_MANAGER + jobs_event_pump, map_pve_error, WorkerSettings, connector vm_power/vm_delete/task_status/task_log
  - phase: 02-multi-cluster-inventory-quotas-audit
    provides: require_resource_access RBAC (per-team privsep connector), audit_write flush-not-commit writer, _team_ids_for_user, _scrub_pve_error
  - phase: 01-foundation
    provides: get_current_principal (cookie + Bearer PAT), csrf_protect, decode_access_token, FastAPI app factory
provides:
  - power lifecycle routes — Start/Stop/Reboot/Shutdown/Delete (VM + LXC) all returning 202
  - bulk-power route — one job per VM under a shared batch_id (D-11)
  - run_power_action arq job function — covers vm.power + vm.delete, dispatches via the UPID poller, audits the outcome
  - jobs API — GET /jobs (team-scoped + counts), GET /jobs/{id} (404 out-of-team), POST /jobs/{id}/retry (idempotent kinds only)
  - /api/v1/ws/jobs WebSocket — authenticated handshake, recent-window backfill, team-scoped fan-out registration
affects: [03-03-snapshots-resize-clone-migrate, 03-04-backups, 03 frontend tasks-drawer, 04 provisioning lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First full vertical pipeline slice: enqueue → worker → UPID-poll → Redis pub/sub → WebSocket"
    - "202-Accepted lifecycle route: csrf_protect + require_resource_access + enqueue helper, never blocking on Proxmox"
    - "Bulk fan-out: one job row per VM sharing a uuid4 batch_id, access re-resolved per target"
    - "run_* job function shape: claim → acquire per-team privsep connector → dispatch_and_poll → audit outcome, catches its own PVE exceptions (max_tries=1)"
    - "WebSocket handshake auth before accept(): JWT cookie decode → close(1008) on failure, never register an unauthenticated socket"

key-files:
  created:
    - backend/app/lifecycle/schemas.py
    - backend/app/lifecycle/power.py
    - backend/app/lifecycle/routes.py
    - backend/app/jobs/routes.py
    - backend/app/jobs/ws.py
    - backend/tests/test_lifecycle_power.py
    - backend/tests/test_jobs_routes.py
  modified:
    - backend/app/jobs/functions.py
    - backend/app/jobs/worker.py
    - backend/app/main.py
    - backend/tests/conftest.py

key-decisions:
  - "Scalar ids (cluster_id/team_id/actor_user_id) are captured from ResolvedResource BEFORE enqueue_job — its idempotency-collision rollback expires resolved.cluster and a later lazy attribute access would raise MissingGreenlet"
  - "Lifecycle routes raise a clean 503 when app.state.arq_pool is None (Redis down at boot) instead of crashing with AttributeError deep in enqueue_job"
  - "run_power_action serves BOTH vm.power and vm.delete via one function with a per-kind dispatch closure; the worker registers it under both arq names"
  - "retry re-arms the SAME job row (state→pending, clear upid/error/finished_at) and enqueues a FRESH arq job id (job-{id}-retry-{hex}); the DB row identity is reused so the drawer shows no second row"
  - "IDEMPOTENT_KINDS = {vm.power, vm.snapshot.delete, vm.resize, vm.backup}; vm.delete/clone/migrate/restore excluded (D-16) — non-idempotent retry rejected 409"
  - "WebSocket handler takes Depends(get_db) so its handshake reads run on the same session factory the test override rewires — TestClient WS tests see seeded data"
  - "WS auth supports the cookie session only (no Bearer PAT) — the Tasks drawer is a browser-session feature"

patterns-established:
  - "202 lifecycle route: status_code=202 + Depends(csrf_protect) + explicit operation_id; static segments (bulk-power) declared before {vmid} paths"
  - "Power service: enqueue_power/enqueue_delete write an enqueue-time audit row (result=pending, who requested it); the worker writes the success/failure outcome row"
  - "WebSocket endpoint: authenticate before accept(); backfill on connect; CONNECTION_MANAGER.add(team_ids) + remove() in finally"

requirements-completed: [LIFE-01, LIFE-02, LIFE-03, LIFE-12, LIFE-13, API-04]

# Metrics
duration: 11min
completed: 2026-05-16
---

# Phase 3 Plan 02: Power Lifecycle + Jobs API + Tasks WebSocket Summary

**The first full vertical slice of the job pipeline — power endpoints (Start/Stop/Reboot/Shutdown/Delete + bulk) returning 202, the `run_power_action` arq job function, the jobs API with idempotent-only retry, and the authenticated team-scoped `/ws/jobs` WebSocket — so a power action now exercises enqueue → worker → UPID-poll → Redis pub/sub → WebSocket end-to-end.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-16T12:18:47Z
- **Completed:** 2026-05-16T12:30:13Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files created:** 7, **Files modified:** 4

## Accomplishments

- **Power lifecycle vertical slice.** `POST .../vms/{vmid}/power` (and the
  `lxcs` mirror) for Start / Stop (force) / Reboot / Shutdown (graceful),
  `DELETE .../vms/{vmid}` (purge), and `POST .../vms/bulk-power` — every
  mutating route returns `202 Accepted` with a job id and never blocks on
  Proxmox (CLAUDE.md constraint #1). Bulk power fans out one `vm.power` job
  per VM under a single shared `batch_id` (D-11).
- **`run_power_action` job function.** The first real `run_*` arq function:
  claims the job, acquires the per-team privilege-separated connector, drives
  `dispatch_and_poll` with a per-kind dispatch closure (covers both
  `vm.power` and `vm.delete`), and writes the outcome audit row on success
  AND failure (D-20). Catches its own PVE exceptions so arq never retries a
  power op (`max_tries=1`).
- **Jobs API.** `GET /jobs` (team-scoped, with `running`/`failed` counts for
  the Topbar badge), `GET /jobs/{id}` (404 for out-of-team — don't-leak-
  existence), and `POST /jobs/{id}/retry` which re-arms the failed job's
  *same row* for idempotent kinds only and rejects clone/migrate/delete/
  restore with 409 (D-16).
- **Tasks-drawer WebSocket.** `/api/v1/ws/jobs` authenticates the session
  cookie *before* `accept()` (closes 1008 on failure — never registers an
  unauthenticated socket), backfills the recent team-scoped job window on
  connect, and registers the socket with `CONNECTION_MANAGER` for the
  team-filtered fan-out wired in Plan 03-01.

## Task Commits

Each task was committed atomically (both tasks `tdd="true"` — RED test +
GREEN implementation committed together per the per-task commit protocol):

1. **Task 1: Power lifecycle service + 202 routes + run_power_action** — `5a72f4f` (feat)
2. **Task 2: Jobs API (list/get/retry) + Tasks-drawer WebSocket** — `29d7d78` (feat)

## Files Created/Modified

**Created:**
- `backend/app/lifecycle/schemas.py` — `PowerAction` StrEnum, `PowerRequest`,
  `BulkPowerRequest`/`BulkPowerTarget`, `JobAcceptedResponse`,
  `BulkJobAcceptedResponse` — all `extra="forbid"` (no lock-override field)
- `backend/app/lifecycle/power.py` — `enqueue_power` / `enqueue_delete` /
  `enqueue_bulk_power` — the 202 enqueue layer + enqueue-time audit
- `backend/app/lifecycle/routes.py` — power/delete (VM + LXC mirror) +
  bulk-power routes, every mutation `202` + `csrf_protect`
- `backend/app/jobs/routes.py` — `GET /jobs`, `GET /jobs/{id}`,
  `POST /jobs/{id}/retry` with the `IDEMPOTENT_KINDS` gate
- `backend/app/jobs/ws.py` — the `/ws/jobs` WebSocket endpoint
- `backend/tests/test_lifecycle_power.py` — 9 power-lifecycle tests
- `backend/tests/test_jobs_routes.py` — 8 jobs-API + WebSocket tests

**Modified:**
- `backend/app/jobs/functions.py` — added `run_power_action` (+ `_fail_job`)
- `backend/app/jobs/worker.py` — registered `vm.power` + `vm.delete`
  (`max_tries=1`)
- `backend/app/main.py` — mounted the lifecycle + jobs + jobs-WS routers
- `backend/tests/conftest.py` — `FakeArqPool` fixture; the `client` fixture
  wires it onto `app.state.arq_pool` (the lifespan doesn't run under
  `ASGITransport`)

## Decisions Made

- **Capture scalar ids before `enqueue_job`.** On an idempotency-key
  collision `enqueue_job` issues a `db.rollback()`, which expires every
  object in the session — including `resolved.cluster`. A later
  `resolved.cluster.id` access would then trigger lazy IO outside an async
  context (`MissingGreenlet`). `enqueue_power`/`enqueue_delete` therefore
  read `cluster_id`/`team_id`/`actor_user_id` into locals up front.
- **Clean 503 when the queue is down.** `_require_arq_pool` raises
  `503 Service Unavailable` if `app.state.arq_pool` is `None` (Redis
  unreachable at boot — the API pool is best-effort per Plan 03-01) rather
  than crashing with an `AttributeError`. This is the clear error the 03-01
  SUMMARY anticipated lifecycle routes would surface.
- **One function for `vm.power` + `vm.delete`.** `run_power_action` builds a
  per-kind dispatch closure (`connector.vm_power` vs `connector.vm_delete`);
  the worker registers it under both arq names. Less code, one audit path.
- **Retry re-arms the same row.** `POST /jobs/{id}/retry` resets the failed
  job row to `pending` and clears `upid`/`error`/`friendly_error`/
  `finished_at`/`started_at`, then enqueues a FRESH arq job id
  (`job-{id}-retry-{hex}`) — the original `job-{id}` arq key may still
  linger, but the DB row identity is reused so the drawer shows no second
  row (UI-SPEC §Retry Affordance Contract).
- **WebSocket uses `Depends(get_db)`.** FastAPI resolves dependencies on
  WebSocket routes too — so the handshake's auth + backfill reads run on the
  same session factory the test `get_db` override rewires, letting the
  Starlette `TestClient` WS tests see seeded data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lifecycle routes need an arq pool that tests don't provide**
- **Found during:** Task 1
- **Issue:** The `enqueue_job` contract takes an `arq_pool`; the route reads
  it from `app.state.arq_pool`, populated only by the FastAPI lifespan. Tests
  run under `ASGITransport` with no lifespan, so `arq_pool` was `None` and
  `enqueue_job` crashed with `AttributeError: 'NoneType' object has no
  attribute 'enqueue_job'`.
- **Fix:** (a) Added `_require_arq_pool` to `lifecycle/routes.py` — raises a
  clean `503` when the pool is absent (also the correct production behaviour
  for a Redis outage). (b) Added a `FakeArqPool` recording double to
  `conftest.py` and wired it onto `app.state.arq_pool` in the `client`
  fixture so lifecycle-route tests can enqueue without Redis.
- **Files modified:** `backend/app/lifecycle/routes.py`,
  `backend/tests/conftest.py`
- **Verification:** All 9 `test_lifecycle_power.py` tests pass.
- **Committed in:** `5a72f4f` (Task 1 commit)

**2. [Rule 1 - Bug] `MissingGreenlet` on a duplicate (idempotency-dedup) power POST**
- **Found during:** Task 1
- **Issue:** The second of two identical power POSTs hit `enqueue_job`'s
  idempotency path, which calls `db.rollback()`. That expired
  `resolved.cluster`; the subsequent `resolved.cluster.id` read inside
  `audit_write` triggered lazy IO and raised
  `sqlalchemy.exc.MissingGreenlet`.
- **Fix:** `enqueue_power` and `enqueue_delete` now capture `cluster_id`,
  `team_id` and `actor_user_id` into locals BEFORE calling `enqueue_job`.
- **Files modified:** `backend/app/lifecycle/power.py`
- **Verification:** `test_duplicate_power_post_dedups_to_same_job` passes;
  full suite green.
- **Committed in:** `5a72f4f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug).
**Impact on plan:** Both fixes were necessary for correctness — the 503
guard is also the production-correct behaviour the 03-01 SUMMARY anticipated.
No scope creep; the routes, service, job function and WebSocket are exactly
as the plan specified.

## Issues Encountered

- **`python` not on PATH.** The repo backend uses a `.venv`; commands run as
  `.venv/bin/python` / `.venv/bin/ruff`. No code impact.
- **`test_jwt.py::test_decode_tampered_signature_raises` flaked once.** It
  failed in one intermediate full-suite run, passed in isolation, and passes
  in every subsequent full run (331 passed) once the new Plan 03-02 test
  files shifted collection order. A latent JWT-suite test-isolation
  sensitivity, unrelated to this plan (touches neither `app/core/jwt.py` nor
  `test_jwt.py`). Logged to `deferred-items.md`.

## Out-of-Scope Items Logged

- `backend/app/inventory/service.py:11` — a pre-existing `ruff` F401
  (unused `PVEConnector` import, owned by Plan 02-03) still trips
  `ruff check .` on the whole tree. NOT fixed (scope boundary); already
  recorded in `deferred-items.md` since Plan 03-01. Every file this plan
  created or modified is `ruff`-clean.

## Threat Surface

All seven `<threat_model>` mitigations are in place — no new threat surface
beyond the plan's register:
- **T-03-02-01** (cross-tenant power/delete): every lifecycle route depends on
  `require_resource_access`; bulk power re-resolves access per target.
- **T-03-02-02** (CSRF): all four mutating routes carry `Depends(csrf_protect)`.
- **T-03-02-03** (`skiplock` injection): `PowerAction` is a closed `StrEnum`;
  all schemas are `extra="forbid"`; the literal token appears nowhere in the
  lifecycle module (acceptance grep returns 0).
- **T-03-02-04** (cross-tenant job visibility): `GET /jobs` filters by
  `_team_ids_for_user`; `GET /jobs/{id}` returns 404 out-of-team; the WS
  registers the socket's `team_ids` and `CONNECTION_MANAGER.broadcast`
  re-filters every push.
- **T-03-02-05** (unauthenticated WS): the `/ws/jobs` handler resolves the
  session cookie before `accept()` and closes 1008 on failure.
- **T-03-02-06** (non-idempotent retry): `IDEMPOTENT_KINDS` excludes
  clone/migrate/delete/restore — 409.
- **T-03-02-07** (no audit trail): `enqueue_power`/`enqueue_delete` audit at
  enqueue time; `run_power_action` audits the outcome.

## Next Phase Readiness

- The full job pipeline is proven end-to-end on power operations. Plan 03-03
  (snapshots/resize/clone/migrate) and 03-04 (backups) can now add thin
  per-operation slices: a `202` route → `enqueue_job` → a `run_*` function
  registered in `WorkerSettings.functions` → `dispatch_and_poll`.
- The jobs API + `/ws/jobs` WebSocket give the Phase-3 frontend Tasks drawer
  its complete read + live-update surface.
- `IDEMPOTENT_KINDS` already names the snapshot-delete / resize / backup
  kinds Plans 03/04 will introduce — those plans only need to enqueue jobs of
  the matching `kind`.

## Self-Check: PASSED

- All 7 created key files exist on disk (`lifecycle/schemas.py`,
  `lifecycle/power.py`, `lifecycle/routes.py`, `jobs/routes.py`, `jobs/ws.py`,
  `tests/test_lifecycle_power.py`, `tests/test_jobs_routes.py`).
- Both task commits present in git history (`5a72f4f`, `29d7d78`).
- Plan-level verification: 331 tests pass; `ruff check` clean for every file
  this plan touched; `app.main.create_app()` builds with the lifecycle + jobs
  + jobs-WS routers; OpenAPI exposes all 6 new routes
  (`lifecycle_vm_power`, `lifecycle_lxc_power`, `lifecycle_vm_delete`,
  `lifecycle_lxc_delete`, `lifecycle_bulk_power`, `jobs_list`, `jobs_get`,
  `jobs_retry`) with explicit `operation_id`s, and `/api/v1/ws/jobs` is a
  registered route.

## TDD Gate Compliance

Both Plan 03-02 tasks are `tdd="true"` (task-level, not a plan-level `type:
tdd` gate). Each task's failing test was written and confirmed RED
(`test_lifecycle_power.py`: `404 != 202`; `test_jobs_routes.py`:
team-scoping `AssertionError`) before the implementation was written GREEN.
Per the plan's per-task commit protocol the RED test + GREEN implementation
were committed together as one `feat(...)` commit per task — there are no
separate `test(...)` commits, which is the documented convention for
`tdd="true"` *tasks* (distinct from a plan-level `type: tdd` gate sequence).

---
*Phase: 03-job-queue-lifecycle*
*Completed: 2026-05-16*
