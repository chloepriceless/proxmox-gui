---
phase: 03-job-queue-lifecycle
plan: 03
subsystem: api
tags: [arq, job-queue, proxmox, lifecycle, snapshots, resize, hotplug, upid-polling]

# Dependency graph
requires:
  - phase: 03-job-queue-lifecycle
    provides: enqueue_job (202 contract), dispatch_and_poll (UPID poller), finish_job/update_job, map_pve_error, _fail_job, WorkerSettings.functions, connector snapshot_list/create/rollback/delete + resize_disk + get_vm_config/set_vm_config
  - phase: 02-multi-cluster-inventory-quotas-audit
    provides: require_resource_access RBAC (per-team privsep connector), audit_write flush-not-commit writer
  - phase: 01-foundation
    provides: get_current_principal, csrf_protect, FastAPI app factory
provides:
  - snapshot lifecycle routes — GET list (flat parent-pointer tree) + 202 create/rollback/delete (VM + LXC mirrors)
  - run_snapshot_create / run_snapshot_rollback / run_snapshot_delete arq job functions — dispatch via the UPID poller, audit the outcome
  - resize lifecycle routes — GET resize-info (hotplug-derived reboot flags) + 202 resize (VM + LXC mirrors)
  - run_resize arq job function — synchronous config write with no poll loop, still surfaced in the Tasks drawer
  - server-side disk-shrink rejection (422) — the API is the LIFE-09 enforcement point, not the UI
  - hotplug-token parser — derives cpu_hotplug / memory_hotplug from the VM hotplug config field
affects: [03-04-backups, 03 frontend snapshots-tab, 03 frontend resize-dialog, 04 provisioning lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot job functions share one _run_snapshot_job body, kind-dispatched (like run_power_action covers vm.power + vm.delete)"
    - "Sync-write job function: run_resize claims → writes config.put → finish_job(succeeded) directly, NO dispatch_and_poll (CPU/RAM resize has no UPID)"
    - "Server-side validation gate: validate_resize rejects disk shrink 422 before the job is ever enqueued — UI min is UX-only"
    - "Disk-size parsing: regex disk-key matcher + size= token converter, baked current sizes into the job payload so the worker computes the +NG delta"

key-files:
  created:
    - backend/app/lifecycle/snapshots.py
    - backend/app/lifecycle/snapshot_routes.py
    - backend/app/lifecycle/resize.py
    - backend/app/lifecycle/resize_routes.py
    - backend/app/jobs/snapshot_functions.py
    - backend/app/jobs/resize_functions.py
    - backend/tests/test_lifecycle_snapshots.py
    - backend/tests/test_lifecycle_resize.py
  modified:
    - backend/app/lifecycle/schemas.py
    - backend/app/jobs/worker.py
    - backend/app/main.py

key-decisions:
  - "Snapshot routes live in a separate snapshot_routes.py (not lifecycle/routes.py) — keeps the modular layout clean; _require_arq_pool is imported from lifecycle/routes.py rather than duplicated"
  - "The three run_snapshot_* functions share one _run_snapshot_job body, kind-dispatched — one claim/connector/dispatch/audit path, mirroring run_power_action's vm.power+vm.delete reuse"
  - "run_resize does NOT call dispatch_and_poll — a CPU/RAM resize is a synchronous config.put with no UPID; the job is marked succeeded directly via finish_job, still flowing through a vm.resize jobs row for Tasks-drawer consistency"
  - "validate_resize runs server-side BEFORE enqueue — a disk shrink (or an unknown disk id) is rejected 422; the worker never receives a non-positive +NG delta"
  - "Current per-disk sizes are parsed from the VM config and baked into the resize job payload so the worker computes the +NG delta without a second config read"
  - "vmstate=True on an LXC snapshot is rejected 422 (RAM state is qemu-only) before any job is enqueued"

patterns-established:
  - "Snapshot service: list_snapshots is a pure read (no job, no audit) returning the flat parent-pointer list; enqueue_snapshot_* follow the 202 + enqueue-audit + commit pattern"
  - "Sync-write job function: claim → running → synchronous PVE write → finish_job(state) directly → outcome audit → publish job.completed, with no poll loop"
  - "hotplug parser: hotplug='1' → all flags true; '0'/'' → all false; comma list → token membership; absent → false (PVE default lacks cpu/memory)"

requirements-completed: [LIFE-04, LIFE-08, LIFE-09, API-04]

# Metrics
duration: 12min
completed: 2026-05-16
---

# Phase 3 Plan 03: Snapshot & Resize Lifecycle Summary

**The second and third lifecycle operation groups layered onto the proven job pipeline — snapshot create/rollback/delete returning 202 with a flat parent-pointer list reader for the client-built tree, and CPU/RAM/disk resize with hotplug-derived reboot-required flags, an online disk grow using the `+NG` delta, and a server-side disk-shrink rejection.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-16T12:36:24Z
- **Completed:** 2026-05-16T12:48:07Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files created:** 8, **Files modified:** 3

## Accomplishments

- **Snapshot lifecycle.** `GET .../snapshots` (VM + LXC) returns the flat
  snapshot list — each item normalized into a `SnapshotItem` carrying a
  `parent` pointer so the client builds the indented tree (D-05). `POST`
  create, `POST .../{snapname}/rollback`, and `DELETE .../{snapname}` all
  return `202 Accepted` with their job kinds; rollback is a non-idempotent
  job, snapshot-delete is retry-eligible (D-16). `vmstate=True` on an LXC is
  rejected 422 (RAM state is qemu-only).
- **`run_snapshot_*` job functions.** Three thin coroutines over one shared
  `_run_snapshot_job` body — claim the job, acquire the per-team privsep
  connector, dispatch the snapshot call through `dispatch_and_poll`, audit the
  outcome on success AND failure. Catches their own PVE exceptions
  (`max_tries=1`).
- **Resize lifecycle.** `GET .../resize-info` reports current cores/memory,
  the disk list with parsed sizes, and `cpu_hotplug`/`memory_hotplug` booleans
  derived from the VM's `hotplug` config field — when a flag is `false` the
  resize dialog shows its inline reboot-required warning. `POST .../resize`
  returns `202`; a disk grow uses the `+NG` delta syntax.
- **Server-side shrink block (LIFE-09).** `validate_resize` rejects any disk
  whose `new_size_gb` is not strictly larger than the current size — and any
  unknown disk id — with a `422` *before* the job is enqueued. The UI `min` is
  a UX affordance only; the API is the enforcement point.
- **Sync-write job pattern.** `run_resize` performs the synchronous
  `set_vm_config` (and per-disk `resize_disk`) and marks the job `succeeded`
  directly via `finish_job` — **no `dispatch_and_poll`**, because a CPU/RAM
  resize returns no UPID. The job still flows through a `vm.resize` jobs row so
  it appears in the Tasks drawer (RESEARCH §Resize).

## Task Commits

Each task was committed atomically (both tasks `tdd="true"` — RED test +
GREEN implementation committed together per the per-task commit protocol):

1. **Task 1: Snapshot service + routes + arq job functions** — `59cfb5a` (feat)
2. **Task 2: Resize service + routes — CPU/RAM sync write, hotplug detection, disk grow** — `79178b0` (feat)

## Files Created/Modified

**Created:**
- `backend/app/lifecycle/snapshots.py` — snapshot service: `list_snapshots`
  (flat parent-pointer reader) + `enqueue_snapshot_create/rollback/delete`
- `backend/app/lifecycle/snapshot_routes.py` — GET list + 202 create/rollback/
  delete (VM + LXC mirrors), every mutation csrf-gated
- `backend/app/lifecycle/resize.py` — resize service: `get_resize_info`
  (hotplug parser + disk-size parser), `validate_resize` (shrink block),
  `enqueue_resize`
- `backend/app/lifecycle/resize_routes.py` — GET resize-info + 202 resize
  (VM + LXC mirrors)
- `backend/app/jobs/snapshot_functions.py` — `run_snapshot_create/rollback/
  delete` over a shared `_run_snapshot_job` body
- `backend/app/jobs/resize_functions.py` — `run_resize` synchronous-write job
  function (no poll loop)
- `backend/tests/test_lifecycle_snapshots.py` — 7 snapshot tests
- `backend/tests/test_lifecycle_resize.py` — 8 resize tests

**Modified:**
- `backend/app/lifecycle/schemas.py` — added `SnapshotCreateRequest`,
  `SnapshotItem`, `SnapshotListResponse`, `ResizeRequest`, `DiskGrow`,
  `ResizeInfoResponse`, `DiskInfo` — all `extra="forbid"` (no lock-override
  field)
- `backend/app/jobs/worker.py` — registered `vm.snapshot.create` (timeout
  600), `vm.snapshot.rollback` (900), `vm.snapshot.delete` (300), `vm.resize`
  (120) — all `max_tries=1`
- `backend/app/main.py` — mounted `snapshot_router` + `resize_router`

## Decisions Made

- **Separate `snapshot_routes.py` / `resize_routes.py`.** A dedicated file per
  operation group keeps the modular layout clean (the plan explicitly directed
  this). `_require_arq_pool` and `_job_accepted` semantics are imported/mirrored
  from `lifecycle/routes.py` rather than duplicated.
- **One shared body for the snapshot job functions.** The three
  `run_snapshot_*` functions delegate to `_run_snapshot_job`, which selects the
  PVE call from `job.kind` — one claim → connector → `dispatch_and_poll` →
  audit path, exactly as `run_power_action` covers both `vm.power` and
  `vm.delete`.
- **`run_resize` skips `dispatch_and_poll`.** A CPU/RAM resize is a
  synchronous `config.put` with no UPID, so there is nothing to poll. The job
  function claims the row, does the synchronous write(s), and calls
  `finish_job(state="succeeded")` directly — then audits and publishes
  `job.completed`. The job still flows through a `vm.resize` jobs row for
  Tasks-drawer consistency (RESEARCH §Resize).
- **Shrink rejection is pre-enqueue.** `validate_resize` runs inside
  `enqueue_resize` *before* `enqueue_job` — a disk shrink (or an unknown disk
  id) never produces a job. The worker additionally guards against a
  non-positive `+NG` delta as defense-in-depth.
- **Current disk sizes baked into the payload.** `enqueue_resize` parses the
  VM config once for the shrink check and stores each disk's current size in
  the job payload, so the worker computes `new - current` without a second
  config read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test seeded a non-matching pool id, producing a phantom 403**
- **Found during:** Task 1 (snapshot route tests)
- **Issue:** `test_lifecycle_snapshots.py`'s `_seed_cluster_and_token` helper
  defaulted `poolid="gui-team-snap"`, but the shared `CLUSTER_RESOURCES_VM`
  fixture row carries `pool="gui-team-42"`. `require_resource_access` matches
  the resource's `pool` field against the token's `poolid`, so every snapshot
  route test would have returned 403 instead of exercising the route.
- **Fix:** Changed the helper's default `poolid` to `gui-team-42` to match the
  fixture (the same value the power-slice tests use).
- **Files modified:** `backend/tests/test_lifecycle_snapshots.py`
- **Verification:** All 7 snapshot tests pass.
- **Committed in:** `59cfb5a` (Task 1 commit)

**2. [Rule 1 - Bug] LXC test queued two `/cluster/resources` responses for a single-call API**
- **Found during:** Task 1 (`test_snapshot_vmstate_on_lxc_is_rejected`)
- **Issue:** The LXC test queued `[]` then `CLUSTER_RESOURCES_LXC` for
  `cluster.resources.get`, assuming `list_resources` makes a `type=vm` then a
  `type=lxc` call. `PVEConnector.list_resources` makes exactly ONE
  `/cluster/resources?type=vm` call — PVE returns both VMs and LXCs in that
  single response — so the first queued `[]` was consumed and the LXC was
  never found (phantom 403). The `_make_fake_for_snapshots` helper had the same
  stale double-queue.
- **Fix:** Queue `CLUSTER_RESOURCES_LXC` as the single response; removed the
  leftover second `cluster.resources.get` queue entry from the helper.
- **Files modified:** `backend/tests/test_lifecycle_snapshots.py`
- **Verification:** `test_snapshot_vmstate_on_lxc_is_rejected` passes; full
  suite green.
- **Committed in:** `59cfb5a` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 test bugs).
**Impact on plan:** Both fixes were corrections to the *test* code this plan
authored (TDD RED phase) — the production snapshot/resize code is exactly as
the plan specified. No scope creep.

## Issues Encountered

- **`python` not on PATH.** The repo backend uses a `.venv`; commands ran as
  `.venv/bin/python` / `.venv/bin/ruff`. No code impact (same as Plan 03-02).

## Out-of-Scope Items Logged

- `backend/app/inventory/service.py:11` — a pre-existing `ruff` F401
  (unused `PVEConnector` import, owned by Plan 02-03) still trips
  `ruff check .` on the whole tree. NOT fixed (scope boundary); already
  recorded in `.planning/phases/03-job-queue-lifecycle/deferred-items.md`
  since Plan 03-01. Every file this plan created or modified is `ruff`-clean.

## Threat Surface

All six `<threat_model>` mitigations are in place — no new threat surface
beyond the plan's register:
- **T-03-03-01** (cross-tenant snapshot/resize): every route depends on
  `require_resource_access`; a cross-tenant VM is rejected 403 before any
  enqueue (`test_snapshot_create_cross_tenant_returns_403`).
- **T-03-03-02** (CSRF): all seven mutating routes carry
  `Depends(csrf_protect)`.
- **T-03-03-03** (disk-shrink tampering): `validate_resize` rejects any
  `new_size_gb <= current` with 422 server-side, before enqueue
  (`test_resize_disk_shrink_rejected_422`).
- **T-03-03-04** (`skiplock` via resize body): `ResizeRequest` is
  `extra="forbid"` and has no lock-override field — the literal token appears
  nowhere in `resize.py` / `resize_routes.py` (acceptance grep returns 0);
  `test_resize_skiplock_field_rejected` confirms a forged field is 422'd.
- **T-03-03-05** (malformed disk identifier): `validate_resize` only resizes
  disks present in the parsed VM config — an unknown disk id has no current
  size and is rejected 422.
- **T-03-03-06** (no audit trail): `enqueue_snapshot_*` / `enqueue_resize`
  audit at enqueue time; `run_snapshot_*` / `run_resize` write the outcome
  audit row on success and failure.

## Known Stubs

None — every route is wired to a real service, every job function dispatches a
real PVE call. No placeholder/empty-value flows.

## Next Phase Readiness

- Three of the Phase-3 lifecycle operation groups are now live on the job
  pipeline (power from 03-02, snapshots + resize from this plan). Plan 03-04
  (backups) follows the same thin-slice recipe: a `202` route → `enqueue_job`
  → a `run_*` function registered in `WorkerSettings.functions` →
  `dispatch_and_poll` (backups have a UPID, unlike resize).
- The snapshot-list reader gives the Phase-3 frontend Snapshots tab its
  complete read surface; `resize-info` gives the resize dialog its current
  values and the hotplug-derived reboot warnings.
- `IDEMPOTENT_KINDS` (Plan 03-02) already includes `vm.snapshot.delete` and
  `vm.resize`, so the jobs-API retry gate accepts them with no further change;
  `vm.snapshot.rollback` is correctly excluded (non-idempotent).

## Self-Check: PASSED

- All 8 created key files exist on disk (`lifecycle/snapshots.py`,
  `lifecycle/snapshot_routes.py`, `lifecycle/resize.py`,
  `lifecycle/resize_routes.py`, `jobs/snapshot_functions.py`,
  `jobs/resize_functions.py`, `tests/test_lifecycle_snapshots.py`,
  `tests/test_lifecycle_resize.py`).
- Both task commits present in git history (`59cfb5a`, `79178b0`).
- Plan-level verification: 346 tests pass (15 new — 7 snapshot + 8 resize);
  `ruff check` clean for every file this plan touched (the single tree-wide
  error is the pre-existing deferred F401 in `inventory/service.py`);
  `app.main.create_app()` builds with the snapshot + resize routers; OpenAPI
  exposes all 12 new operation_ids (`lifecycle_snapshots_list`,
  `lifecycle_snapshot_create/rollback/delete`, `lifecycle_resize_info`,
  `lifecycle_resize`, plus the six `lifecycle_lxc_*` mirrors).

## TDD Gate Compliance

Both Plan 03-03 tasks are `tdd="true"` (task-level, not a plan-level `type:
tdd` gate). Each task's failing tests were written and confirmed RED
(`test_lifecycle_snapshots.py`: `404 != 200`; `test_lifecycle_resize.py`:
`404` on `resize-info`) before the implementation was written GREEN. Per the
per-task commit protocol the RED tests + GREEN implementation were committed
together as one `feat(...)` commit per task — the documented convention for
`tdd="true"` *tasks* (distinct from a plan-level `type: tdd` gate sequence).

---
*Phase: 03-job-queue-lifecycle*
*Completed: 2026-05-16*
