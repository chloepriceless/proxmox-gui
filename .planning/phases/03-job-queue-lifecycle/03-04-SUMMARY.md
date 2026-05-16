---
phase: 03-job-queue-lifecycle
plan: 04
subsystem: api
tags: [arq, job-queue, proxmox, lifecycle, backups, vzdump, restore, clone, migrate, cron, quota-admission]

# Dependency graph
requires:
  - phase: 03-job-queue-lifecycle
    provides: enqueue_job (202 contract), dispatch_and_poll (UPID poller), map_pve_error, _fail_job, WorkerSettings.functions + cron_jobs, connector vzdump/restore/clone/to_template/migrate/cluster_status/cluster_nextid/node_storages/get_vm_config, 0004_phase3 backup_schedules table
  - phase: 02-multi-cluster-inventory-quotas-audit
    provides: require_resource_access RBAC (per-team privsep connector), audit_write flush-not-commit writer, check_and_preview quota admission primitive, _team_ids_for_user
  - phase: 01-foundation
    provides: get_current_principal, csrf_protect, require_admin, FastAPI app factory, Alembic migration chain
provides:
  - backup lifecycle — manual vzdump (202), backup-file list, restore (in-place / as-new), backup-schedule CRUD, global /backups page
  - scheduled-backup arq cron — fires due BackupSchedule rows every 5 minutes; keep-last-N retention prune on the backup job's success path
  - clone lifecycle — linked/full clone with app-reserved VMID + quota admission, template-convert (qemu-only, LXC rejected 422)
  - migrate lifecycle — live/offline migrate with bwlimit, quorum + node-local-snippet pre-flights rejecting the enqueue
  - BackupSchedule ORM model + 0005_phase3_backup_storage migration (clusters.backup_storage column)
  - admin per-cluster backup-storage designation — GET /clusters/{id}/backup-storages + PATCH backup_storage (nullable-clearable)
  - reserve_vmid + run_quota_admission shared create-flow helpers (consumed by clone and restore-as-new)
affects: [04-provisioning-networking-console, 03 frontend backups-tab, 03 frontend clone-migrate-dialogs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-side arq cron for scheduled work — fire_due_scheduled_backups computes due-ness from frequency + last_run_at, registered via arq cron(minute=set(range(0,60,5)))"
    - "Keep-last-N retention as an in-job prune — run_backup's success path prunes only when the job carries scheduled=true (D-08)"
    - "App-level VMID reservation — per-cluster asyncio.Lock + short-TTL in-process reserved set guards /cluster/nextid non-atomicity (Pitfall 1)"
    - "Server-side migrate pre-flights — quorum + node-local cicustom snippet checks reject the enqueue at the API layer, not just the UI"
    - "Quota admission before enqueue — clone + restore-as-new route through the Phase 2 check_and_preview primitive sizing from the source VM"
    - "Nullable-clearable PATCH field — _UNSET sentinel distinguishes absent / null / set for clusters.backup_storage"

key-files:
  created:
    - backend/app/models/backup_schedule.py
    - backend/alembic/versions/0005_phase3_backup_storage.py
    - backend/app/lifecycle/backups.py
    - backend/app/lifecycle/backup_routes.py
    - backend/app/lifecycle/clone.py
    - backend/app/lifecycle/migrate.py
    - backend/app/lifecycle/clone_migrate_routes.py
    - backend/app/jobs/backup_functions.py
    - backend/app/jobs/backups_cron.py
    - backend/app/jobs/clone_migrate_functions.py
    - backend/tests/test_lifecycle_backups.py
    - backend/tests/test_lifecycle_clone_migrate.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/models/cluster.py
    - backend/app/clusters/schemas.py
    - backend/app/clusters/routes.py
    - backend/app/clusters/service.py
    - backend/app/clusters/connector.py
    - backend/app/lifecycle/schemas.py
    - backend/app/jobs/worker.py
    - backend/app/main.py
    - backend/tests/test_jobs_infrastructure.py
    - backend/tests/test_models_metadata.py

key-decisions:
  - "Scheduled-backup retention is an in-job prune — run_backup prunes keep-last-N on success only when the job carries scheduled=true + keep_last; the cron stamps those into the payload. Keeps retention in one testable place (RESEARCH recommendation)"
  - "VMID reservation uses a per-cluster asyncio.Lock + 60s in-process reserved set — the API runs as one process so an in-process lock is the simplest correct mechanism (RESEARCH Q2); the worker bounded-retries on a PVE 'already exists' as a final backstop"
  - "clone.py owns the shared reserve_vmid + run_quota_admission helpers — restore-as-new (Task 2) and clone (Task 3) both consume them; the file ships with Task 2 because restore-as-new needs it"
  - "run_backup_delete is a synchronous job (no UPID poll) — a storage content delete is fast; it still flows through a job row for Tasks-drawer consistency, mirroring run_resize"
  - "clusters.backup_storage uses an _UNSET-sentinel PATCH field — a plain str|None could not tell 'absent' from 'explicit null'; the admin must be able to disable backups (D-08 / UI-SPEC 'None — backups disabled')"
  - "quorum pre-flight treats an absent type=='cluster' status item as quorate (pass) — a single-node cluster has no cluster-status row; only an explicit quorate!=1 blocks the migrate"
  - "node-local snippet pre-flight: a cicustom-referenced storage missing from the snippets storage list, or with shared!=1, blocks the migrate — most VMs have no cicustom so the check passes trivially"

patterns-established:
  - "App-side arq cron: a cron(fn, minute=set(range(0,60,5))) entry in WorkerSettings.cron_jobs; the cron fn queries due rows, enqueues jobs, stamps last_run_at"
  - "Shared poll-job body: _run_polled_job in clone_migrate_functions covers clone/template/migrate — claim → connector → dispatch_and_poll → audit, like _run_snapshot_job"
  - "Create-flow quota admission: run_quota_admission sizes a QuotaPreviewRequest from the source VM's maxcpu/maxmem/maxdisk and rejects would_exceed 409 before enqueue"

requirements-completed: [LIFE-05, LIFE-06, LIFE-07, LIFE-10, LIFE-11, API-04]

# Metrics
duration: 17min
completed: 2026-05-16
---

# Phase 3 Plan 04: Backups, Clone & Migrate Lifecycle Summary

**The heaviest lifecycle operations layered onto the proven job pipeline — manual + scheduled backups (vzdump 202 + an arq cron firing due `BackupSchedule` rows with keep-last-N retention), restore (in-place overwrite / as-new through quota admission), clone (linked/full with an app-reserved VMID + quota admission), template-convert (qemu-only), and migrate (live/offline with bwlimit + quorum & node-local-snippet pre-flights) — plus the admin per-cluster backup-storage designation and the `BackupSchedule` ORM model.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-16T12:53:39Z
- **Completed:** 2026-05-16T13:10:25Z
- **Tasks:** 3 (all `tdd="true"`)
- **Files created:** 12, **Files modified:** 11

## Accomplishments

- **Backup lifecycle (LIFE-05/06/07).** `POST .../backup` returns `202`
  (`vm.backup`) when the cluster has a designated `backup_storage`, `409` with
  the D-08 guard message when it does not. `GET .../backups` lists a VM's
  backup files via the storage content API. `POST .../restore` handles both
  `in_place` (overwrite, `force=1`) and `new` (fresh VMID through the Phase 2
  quota admission path). `PUT .../backup-schedule` upserts a `BackupSchedule`
  row; `GET /backups/schedules` is the team-scoped global page (D-06).
- **Scheduled-backup arq cron (LIFE-06).** `fire_due_scheduled_backups` runs
  every 5 minutes — computes due-ness from `frequency` + `last_run_at` (daily
  ≥ 24h, weekly ≥ 7d), enqueues a `vm.backup` job per due enabled schedule
  (stamping `scheduled: true` + `keep_last`), and stamps `last_run_at`.
  `run_backup`'s success path then runs `prune_backups` — list the VM's backup
  files by `ctime`, delete the oldest beyond `keep_last` (D-08).
- **Clone + template-convert (LIFE-10).** `POST .../clone` returns `202`
  (`vm.clone`) — the VMID is allocated via `reserve_vmid` (per-cluster
  `asyncio.Lock` + a short-TTL reserved set against the `/cluster/nextid`
  race, Pitfall 1) when the request omits one, and the clone runs the Phase 2
  quota admission check before enqueue. `POST .../convert-template` returns
  `202` (`vm.template`) on a qemu VM; an LXC convert is rejected `422` with an
  explanatory message (RESEARCH A7).
- **Migrate (LIFE-11).** `POST .../migrate` returns `202` (`vm.migrate`) after
  two server-side pre-flights — a non-quorate cluster is rejected `409`
  (Pitfall 18), and a VM whose `cicustom` references a node-local
  (non-shared) storage is rejected `409` (Pitfall 20). The UI's MB/s bwlimit
  is converted explicitly to PVE's KiB/s (RESEARCH A8).
- **Admin backup-storage designation (D-08).** A `0005_phase3_backup_storage`
  migration adds the nullable `clusters.backup_storage` column; `PATCH
  /clusters/{id}` carries it as a nullable-clearable field (the `_UNSET`
  sentinel distinguishes absent / null / set); `GET
  /clusters/{id}/backup-storages` enumerates the cluster's `content=backup`
  storages for the admin Select.

## Task Commits

Each task was committed atomically (all three `tdd="true"` — RED tests + GREEN
implementation committed together per the per-task commit protocol):

1. **Task 1: backup_schedules ORM model + clusters.backup_storage + admin config** — `5f6e81d` (feat)
2. **Task 2: backup service, 202 routes, arq job functions + scheduled cron** — `2694b73` (feat)
3. **Task 3: clone + template-convert + migrate routes, pre-flights, job functions** — `ba808e1` (feat)

## Files Created/Modified

**Created:**
- `backend/app/models/backup_schedule.py` — `BackupSchedule` ORM model
- `backend/alembic/versions/0005_phase3_backup_storage.py` — `clusters.backup_storage` migration
- `backend/app/lifecycle/backups.py` — backup service (enqueue/list/restore/schedule CRUD)
- `backend/app/lifecycle/backup_routes.py` — 202 backup/restore/delete + schedule routes
- `backend/app/lifecycle/clone.py` — `reserve_vmid` + `run_quota_admission` helpers + clone/template enqueue layer
- `backend/app/lifecycle/migrate.py` — `preflight_migrate` (quorum + snippet) + `enqueue_migrate`
- `backend/app/lifecycle/clone_migrate_routes.py` — 202 clone/convert-template/migrate routes
- `backend/app/jobs/backup_functions.py` — `run_backup` / `run_restore` / `run_backup_delete`
- `backend/app/jobs/backups_cron.py` — `fire_due_scheduled_backups` cron + `prune_backups`
- `backend/app/jobs/clone_migrate_functions.py` — `run_clone` / `run_template_convert` / `run_migrate`
- `backend/tests/test_lifecycle_backups.py` — 15 backup tests
- `backend/tests/test_lifecycle_clone_migrate.py` — 9 clone/migrate tests

**Modified:**
- `backend/app/models/__init__.py` — registered `BackupSchedule`
- `backend/app/models/cluster.py` — added the `backup_storage` column
- `backend/app/clusters/schemas.py` — `backup_storage` on `ClusterResponse`/`ClusterUpdate`; `BackupStorageItem`
- `backend/app/clusters/routes.py` — `GET /clusters/{id}/backup-storages`
- `backend/app/clusters/service.py` — `backup_storage` PATCH handling + `list_backup_storages`
- `backend/app/clusters/connector.py` — `list_nodes`, `storage_content`, `delete_storage_content`
- `backend/app/lifecycle/schemas.py` — backup + clone + migrate schemas
- `backend/app/jobs/worker.py` — registered 6 new job kinds + the scheduled-backup cron
- `backend/app/main.py` — mounted the backup + clone_migrate routers
- `backend/tests/test_jobs_infrastructure.py` — pinned the 0004 round-trip test (deviation)
- `backend/tests/test_models_metadata.py` — expects the `backup_schedules` ORM table (deviation)

## Decisions Made

- **In-job keep-last-N prune.** `run_backup` prunes retention on its success
  path only when the job payload carries `scheduled: true` + `keep_last` (the
  cron stamps both). One testable retention path (RESEARCH recommendation);
  the prune is best-effort — a prune failure never flips the succeeded backup.
- **In-process VMID reservation.** `reserve_vmid` holds a per-cluster
  `asyncio.Lock` while it asks PVE for the next id and skips ids in a short-TTL
  in-process reserved set. The API is a single process so an in-process lock
  is the simplest correct mechanism (RESEARCH Q2); `run_clone` bounded-retries
  on a PVE "already exists" (5 tries) as a final backstop.
- **`clone.py` ships with Task 2.** Restore-as-new (Task 2) and clone (Task 3)
  both consume `reserve_vmid` + `run_quota_admission`; the shared file landed
  in the Task 2 commit because restore-as-new depends on it, with Task 3 only
  adding the routes + job functions.
- **`backup_storage` is a nullable-clearable PATCH field.** A plain
  `str | None` could not distinguish "absent from the body" (leave unchanged)
  from "explicit null" (clear). An `_UNSET` sentinel default + a
  `backup_storage_set()` predicate gives the admin a way to disable backups
  (D-08 / UI-SPEC "None — backups disabled").
- **Quorum pre-flight passes on a single-node cluster.** When `cluster_status`
  has no `type=='cluster'` item the migrate is allowed — only an explicit
  `quorate != 1` blocks it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added connector node/storage-content methods**
- **Found during:** Task 1 (then extended in Task 2)
- **Issue:** The plan's backup-storage enumeration needs a node name, the
  backup-file list needs a storage content listing, and the keep-last-N prune
  needs a content delete — but `PVEConnector` had no `list_nodes`,
  `storage_content`, or `delete_storage_content` method. Without them Task 1's
  `GET /clusters/{id}/backup-storages` and Task 2's `list_backups` / prune
  could not be implemented.
- **Fix:** Added three connector methods — `list_nodes` (`GET /nodes`),
  `storage_content` (`GET .../storage/{sid}/content`), and
  `delete_storage_content` (`DELETE .../content/{volid}`), all routed through
  `_call_with_breaker` like every other lifecycle call.
- **Files modified:** `backend/app/clusters/connector.py`
- **Verification:** `test_backup_storages_enumeration`,
  `test_list_backup_files`, `test_keep_last_n_prune_deletes_oldest` pass.
- **Committed in:** `5f6e81d` / `2694b73` (Task 1 / Task 2 commits)

**2. [Rule 1 - Bug] `test_0004_phase3_round_trips` broken by the 0005 migration**
- **Found during:** Task 3 (full-suite verification)
- **Issue:** The test does `command.upgrade(cfg, "head")` then
  `command.downgrade(cfg, "-1")`. With `head` now `0005_phase3_backup_storage`
  the `-1` reverts 0005, not the 0004 the test targets — so its
  `assert "batch_id" not in job_cols2` failed (0004 was never reverted). Same
  bug pattern the Plan 03-01 SUMMARY documented for `test_0003_phase2_round_trip`.
- **Fix:** Pinned the test's upgrade/re-upgrade to `0004_phase3` so its
  `downgrade -1` reverts 0004.
- **Files modified:** `backend/tests/test_jobs_infrastructure.py`
- **Verification:** `pytest tests/test_jobs_infrastructure.py` — all pass.
- **Committed in:** `ba808e1` (Task 3 commit)

**3. [Rule 1 - Bug] `test_metadata_has_exactly_eleven_business_tables` broken by the new ORM model**
- **Found during:** Task 3 (full-suite verification)
- **Issue:** The test asserted an exact 11-table business set. Task 1 added the
  `BackupSchedule` ORM model (the `backup_schedules` *table* shipped in the
  0004_phase3 migration in Plan 03-01, but no model bound it until now), so
  `Base.metadata` legitimately carries a 12th table.
- **Fix:** Renamed the test to `..._all_business_tables`, added
  `backup_schedules` to the expected set, and bumped the count assertion to 12.
- **Files modified:** `backend/tests/test_models_metadata.py`
- **Verification:** `pytest tests/test_models_metadata.py` — all pass; no other
  test references the old function name.
- **Committed in:** `ba808e1` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bug fixes).
**Impact on plan:** All three were necessary for correctness — the connector
methods are the only way to implement the plan's storage enumeration / prune,
and the two test fixes correct stale assertions broken by a correct schema
change (the plan's Task 1 explicitly mandates the `0005` migration and the
`BackupSchedule` model). No scope creep — backup/clone/migrate are exactly as
the plan specified.

## Issues Encountered

- **`python` not on PATH.** The repo backend uses a `.venv`; commands ran as
  `.venv/bin/python` / `.venv/bin/ruff` / `.venv/bin/alembic` (same as Plans
  03-02 / 03-03). No code impact.
- **`test_jwt.py::test_decode_tampered_signature_raises` flaked once** in the
  full-suite run, passes in isolation and in every subsequent run. This is the
  documented latent JWT test-isolation sensitivity logged to
  `deferred-items.md` since Plan 03-02 — unrelated to this plan (touches
  neither `app/core/jwt.py` nor `test_jwt.py`).

## Out-of-Scope Items Logged

- `backend/app/inventory/service.py:11` — the pre-existing `ruff` F401
  (unused `PVEConnector` import, owned by Plan 02-03) still trips
  `ruff check .` on the whole tree. NOT fixed (scope boundary); recorded in
  `.planning/phases/03-job-queue-lifecycle/deferred-items.md` since Plan 03-01.
  Every file this plan created or modified is `ruff`-clean.

## Threat Surface

All eight `<threat_model>` mitigations are in place — no new threat surface
beyond the plan's register:
- **T-03-04-01** (cross-tenant backup/clone/migrate): every per-VM route
  depends on `require_resource_access` — a cross-tenant VM is 403'd before any
  enqueue.
- **T-03-04-02** (CSRF): every mutating route carries `Depends(csrf_protect)`.
- **T-03-04-03** (quota bypass): clone + restore-as-new run `run_quota_admission`
  (the Phase 2 `check_and_preview` row-locked admission) BEFORE the job is
  enqueued — `test_clone_rejected_when_quota_exceeded` confirms the 409.
- **T-03-04-04** (VMID collision): `reserve_vmid` allocates under a per-cluster
  `asyncio.Lock` + a short-TTL reserved set; `run_clone` bounded-retries on a
  PVE "already exists" — `test_reserve_vmid_no_collision_on_concurrent_alloc`
  confirms two concurrent allocations never collide.
- **T-03-04-05** (inconsistent migrate): `preflight_migrate` rejects a
  non-quorate cluster and a node-local `cicustom` snippet at the API layer —
  `test_migrate_rejected_on_non_quorate_cluster` /
  `test_migrate_rejected_on_node_local_snippet` confirm both 409s.
- **T-03-04-06** (`skiplock` injection): every schema is `extra="forbid"`; the
  literal token appears nowhere in `clone.py` / `migrate.py` /
  `clone_migrate_routes.py` (acceptance grep returns 0).
- **T-03-04-07** (storage-name disclosure): `GET /clusters/{id}/backup-storages`
  is `require_admin`-gated — accepted per the plan's register.
- **T-03-04-08** (no audit trail): every enqueue writes an enqueue-time audit
  row; the worker writes the outcome row on success and failure. The
  scheduled-backup cron jobs carry the schedule's `team_id` so the audit
  attributes them.

## Known Stubs

None — every route is wired to a real service, every job function dispatches a
real PVE call, and the cron fires real `vm.backup` jobs. No placeholder /
empty-value flows.

## Next Phase Readiness

- All six Phase-3 lifecycle operation groups are now live on the job pipeline
  (power 03-02, snapshots + resize 03-03, backups + clone + migrate this plan).
  The remaining Phase-3 plans (03-05..03-07) are the frontend Tasks drawer,
  the per-VM lifecycle UI, and the global `/backups` page — every backend
  surface they consume now exists.
- The scheduled-backup cron is registered; in the LXC the worker process runs
  it automatically. `IDEMPOTENT_KINDS` (Plan 03-02) already includes
  `vm.backup`; `vm.restore` / `vm.clone` / `vm.migrate` / `vm.backup.delete`
  are correctly excluded from the jobs-API retry gate (non-idempotent, D-16).
- The admin backup-storage designation gives the Phase-3 `/admin/clusters/{id}`
  page its `backup_storage` field + the `backup-storages` enumeration.
- Phase 4 provisioning will write `cicustom` snippets — the migrate
  node-local-snippet pre-flight hook already lives here (ROADMAP locked note),
  so a Phase-4 snippet on node-local storage is correctly caught at migrate
  time with no further work.

## Self-Check: PASSED

- All 12 created key files exist on disk (verified via `[ -f ]`).
- All 3 task commits present in git history (`5f6e81d`, `2694b73`, `ba808e1`).
- Plan-level verification: 369 tests pass (24 new — 15 backup + 9
  clone/migrate); the 1 full-suite `test_jwt` flake passes in isolation; the
  single tree-wide `ruff` error is the pre-existing deferred F401 in
  `inventory/service.py` (every file this plan touched is `ruff`-clean); both
  migrations round-trip (`upgrade head → downgrade -1 → upgrade head`, exit 0);
  `app.main.create_app()` builds with the backup + clone_migrate routers; the
  arq `WorkerSettings` carries 13 functions + 1 cron job.

---
*Phase: 03-job-queue-lifecycle*
*Completed: 2026-05-16*
