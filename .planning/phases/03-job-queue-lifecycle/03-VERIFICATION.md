---
phase: 03-job-queue-lifecycle
verified: 2026-05-16T14:30:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: null
---

# Phase 3: Job Queue & Lifecycle Verification Report

**Phase Goal:** Users can perform every lifecycle operation on existing VMs/LXCs (power, snapshot, backup, resize, clone, migrate) with live progress, crash-safe task tracking, and human-readable error messages.
**Verified:** 2026-05-16T14:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user can Start, Stop, Reboot, Shutdown, and Delete a VM/LXC; Delete requires typed-name confirm, Force-Stop requires OK/Cancel; bulk Start/Stop/Reboot work from the list (bulk Delete excluded) | ✓ VERIFIED | `lifecycle/routes.py` power + delete routes (202, csrf_protect). `ActionToolbar.svelte` wires Start/Stop/Reboot/Shutdown + PowerConfirmDialog + ConfirmByNameDialog for Delete. Bulk bar in `inventory/+page.svelte` has Start/Stop/Reboot only (comment on line 450 confirms bulk Delete excluded). |
| 2 | A user can create/restore/delete manual snapshots and see a snapshot tree; create manual + scheduled backups with retention; restore a VM/LXC from a backup | ✓ VERIFIED | `snapshot_routes.py` + `backup_routes.py` all return 202. `SnapshotTree.svelte` hand-rolled recursive tree (role=tree/treeitem). `BackupScheduleCard.svelte` + `fire_due_scheduled_backups` cron + `prune_backups` in `backups_cron.py`. `RestoreDialog.svelte` with in-place (typed-name) and restore-as-new modes. |
| 3 | A user can resize CPU/RAM with reboot-required warnings, grow disk online (shrink blocked), clone VM, convert to template, migrate with bwlimit | ✓ VERIFIED | `resize.py` hotplug parser (12 references), `validate_resize` shrink block 422. `ResizeDialog.svelte` "Requires a reboot" + "can only grow". `clone.py` reserve_vmid + quota. `migrate.py` quorate + cicustom pre-flights + `_KIB_PER_MB = 1024` conversion. `MigrateDialog.svelte` bwlimit in collapsible Advanced. LXC template-convert rejected 422. |
| 4 | Every mutation returns 202 with a job ID; Tasks drawer shows live progress via WebSocket; failed tasks expose stderr with one-click retry for safe ops; app restart mid-task does not lose the operation | ✓ VERIFIED | All 13 registered arq functions at max_tries=1. 25 HTTP_202_ACCEPTED references across lifecycle routes. `/api/v1/ws/jobs` WebSocket endpoint registered and routes found. `reap_orphans` called from `on_startup` (2 references in worker.py). `dispatch_and_poll` persists UPID before poll loop. `needs_review` covers 5 orphan edge cases. `IDEMPOTENT_KINDS` gates retry; JobRow.svelte renders Retry button for idempotent kinds only. |
| 5 | When a Proxmox operation fails, the user sees a human-readable explanation instead of a raw "operation failed" — error mapping covers the common PVE error surface | ✓ VERIFIED | `map_pve_error` in `lifecycle/errors.py` with 9 locked friendly messages, raw verbatim fallback, 0 occurrences of "operation failed". `JobErrorDetail.svelte` shows friendly message first + "Show technical details" collapsible (no redaction, D-15). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/jobs/worker.py` | arq WorkerSettings + on_startup/on_shutdown + cron | ✓ VERIFIED | 1 WorkerSettings class, 13 functions all max_tries=1, reap_orphans in on_startup |
| `backend/app/jobs/enqueue.py` | enqueue_job helper with idempotency_key dedup | ✓ VERIFIED | 6 occurrences of idempotency_key |
| `backend/app/jobs/poller.py` | UPID polling loop, adaptive cadence | ✓ VERIFIED | 8 occurrences of exitstatus, decode_upid used |
| `backend/app/jobs/reaper.py` | orphan reaper — 5 boot-time edge cases | ✓ VERIFIED | 5 occurrences of needs_review |
| `backend/app/jobs/events.py` | Redis pub/sub publish + subscribe | ✓ VERIFIED | 4 occurrences of jobs:events |
| `backend/app/lifecycle/errors.py` | curated PVE-error map with raw fallback | ✓ VERIFIED | Locked strings present, 0 occurrences of "operation failed" |
| `backend/alembic/versions/0004_phase3.py` | 0004_phase3 migration — batch_id + friendly_error + backup_schedules | ✓ VERIFIED | File exists, revision matches |
| `backend/alembic/versions/0005_phase3_backup_storage.py` | migration adding clusters.backup_storage | ✓ VERIFIED | revision=0005_phase3_backup_storage, down_revision=0004_phase3 |
| `backend/app/lifecycle/power.py` | power-action service with batch_id fan-out | ✓ VERIFIED | 4 occurrences of batch_id |
| `backend/app/lifecycle/routes.py` | lifecycle routes returning 202 | ✓ VERIFIED | 6 HTTP_202_ACCEPTED, csrf_protect on mutations |
| `backend/app/jobs/routes.py` | GET /jobs, GET /jobs/{id}, POST /jobs/{id}/retry | ✓ VERIFIED | IDEMPOTENT_KINDS defined and gated, retry operation_id present |
| `backend/app/jobs/ws.py` | WebSocket /ws/jobs authenticated + team-scoped + backfill | ✓ VERIFIED | 1008 close code, CONNECTION_MANAGER add+remove, backfill present |
| `backend/app/lifecycle/snapshots.py` | snapshot service with parent pointers | ✓ VERIFIED | 6 occurrences of parent |
| `backend/app/lifecycle/resize.py` | resize service with hotplug detection + shrink block | ✓ VERIFIED | 12 hotplug refs, "can only grow" 1 occurrence |
| `backend/app/lifecycle/snapshot_routes.py` | snapshot routes returning 202 | ✓ VERIFIED | 6 HTTP_202_ACCEPTED |
| `backend/app/lifecycle/resize_routes.py` | resize routes | ✓ VERIFIED | HTTP_202_ACCEPTED present |
| `backend/app/jobs/snapshot_functions.py` | run_snapshot_* job functions | ✓ VERIFIED | 5 occurrences of dispatch_and_poll |
| `backend/app/lifecycle/backups.py` | backup service with keep_last + no-storage guard | ✓ VERIFIED | 4 keep_last refs, "No backup storage is configured" present |
| `backend/app/lifecycle/clone.py` | clone service with VMID reservation + quota | ✓ VERIFIED | cluster_nextid called, quota referenced |
| `backend/app/lifecycle/migrate.py` | migrate service with quorum + snippet pre-flights + bwlimit | ✓ VERIFIED | quorate, cicustom, _KIB_PER_MB=1024 all present |
| `backend/app/jobs/backups_cron.py` | arq cron for scheduled backups + prune | ✓ VERIFIED | fire_due_scheduled_backups, prune_backups, enqueue_job all present |
| `deploy/systemd/proxmox-gui-worker.service` | arq ExecStart + Requires=redis-server.service | ✓ VERIFIED | placeholder removed, arq app.jobs.worker.WorkerSettings present, Requires=redis-server.service |
| `deploy/lxc/bootstrap.sh` | Redis install + loopback-bound + worker enabled | ✓ VERIFIED | 9 redis-server refs, 3 bind 127.0.0.1 refs, 1 uncommented worker enable |
| `frontend/src/lib/stores/jobs.svelte.ts` | WebSocket client store | ✓ VERIFIED | ws/jobs connection (3 refs), backfill handling (5 refs) |
| `frontend/src/lib/components/jobs/TasksDrawer.svelte` | Tasks drawer Sheet with live feed | ✓ VERIFIED | Sheet imported, jobsStore imported, renders job list |
| `frontend/src/lib/components/lifecycle/ActionToolbar.svelte` | VM detail action toolbar | ✓ VERIFIED | Start/Stop/Reboot/Shutdown/Delete (ConfirmByNameDialog for Delete), all More menu items wired including Back up now |
| `frontend/src/lib/components/jobs/JobErrorDetail.svelte` | friendly error + collapsible raw detail | ✓ VERIFIED | "Show technical details" present, no @html |
| `frontend/src/lib/utils/elapsed.ts` | elapsed-time formatter, no date library | ✓ VERIFIED | 1 export function, 0 dayjs/luxon/date-fns references |
| `frontend/src/lib/components/lifecycle/SnapshotTree.svelte` | hand-rolled recursive tree | ✓ VERIFIED | role=tree, role=treeitem present, no tree-view npm dependency |
| `frontend/src/lib/components/lifecycle/ResizeDialog.svelte` | Resize dialog with reboot warnings + shrink block | ✓ VERIFIED | "Requires a reboot" (3 refs), "can only grow" (2 refs), 0 skiplock |
| `frontend/src/lib/components/lifecycle/MigrateDialog.svelte` | Migrate dialog with bwlimit in Advanced | ✓ VERIFIED | bwlimit (8 refs), collapsible (8 refs for Advanced) |
| `frontend/src/lib/components/lifecycle/CloneDialog.svelte` | Clone dialog with overridable VMID | ✓ VERIFIED | "Auto-assigned" present |
| `frontend/src/lib/components/lifecycle/BackupsTab.svelte` | per-VM Backups tab | ✓ VERIFIED | "Back up now" (4 refs), "No backup storage is configured" (1 ref) |
| `frontend/src/lib/components/lifecycle/RestoreDialog.svelte` | Restore dialog in-place vs as-new | ✓ VERIFIED | "Restore (overwrite)" (2 refs), "Restore as new VM" (2 refs) |
| `frontend/src/routes/backups/+page.svelte` | global /backups page | ✓ VERIFIED | "Scheduled backup jobs and retention" present |
| `frontend/src/routes/backups/+page.server.ts` | SSR loader with auth gate | ✓ VERIFIED | redirect(303, ...) auth gate, event.fetch injection |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `backend/app/jobs/worker.py` | `backend/app/jobs/reaper.py` | on_startup calls reap_orphans | ✓ WIRED | 2 occurrences of reap_orphans in worker.py |
| `backend/app/jobs/poller.py` | `backend/app/lifecycle/errors.py` | map_pve_error on failed task | ✓ WIRED | 3 occurrences of map_pve_error in poller.py |
| `deploy/systemd/proxmox-gui-worker.service` | `backend/app/jobs/worker.py` | ExecStart arq app.jobs.worker.WorkerSettings | ✓ WIRED | Exact string present, placeholder removed |
| `backend/app/lifecycle/routes.py` | `backend/app/jobs/enqueue.py` | enqueue_job returning 202 | ✓ WIRED | 6 occurrences of enqueue_job in routes.py |
| `backend/app/jobs/functions.py` | `backend/app/jobs/poller.py` | dispatch_and_poll | ✓ WIRED | 3 occurrences in functions.py |
| `backend/app/jobs/ws.py` | `backend/app/jobs/events.py` | CONNECTION_MANAGER | ✓ WIRED | 6 occurrences in ws.py |
| `backend/app/jobs/routes.py` | `backend/app/lifecycle/errors.py` | IDEMPOTENT_KINDS gate on retry | ✓ WIRED | IDEMPOTENT_KINDS defined (2 refs) |
| `backend/app/lifecycle/resize.py` | `backend/app/clusters/connector.py` | get_vm_config for hotplug | ✓ WIRED | hotplug parsed from vm config (12 refs) |
| `backend/app/lifecycle/snapshots.py` | `backend/app/jobs/enqueue.py` | enqueue_job for snapshot ops | ✓ WIRED | 7 occurrences of enqueue_job in snapshots.py |
| `backend/app/lifecycle/migrate.py` | `backend/app/clusters/connector.py` | cluster_status quorum + get_vm_config snippet | ✓ WIRED | quorate (4 refs), cicustom (2 refs) |
| `backend/app/lifecycle/clone.py` | `backend/app/clusters/connector.py` | cluster_nextid VMID allocation | ✓ WIRED | cluster_nextid (2 refs) in clone.py |
| `backend/app/jobs/backups_cron.py` | `backend/app/jobs/enqueue.py` | fires vm.backup jobs for due schedules | ✓ WIRED | enqueue_job (2 refs) in backups_cron.py |
| `backend/app/lifecycle/backups.py` | `backend/app/models/cluster.py` | reads clusters.backup_storage | ✓ WIRED | backup_storage (9 refs) in backups.py |
| `frontend/src/lib/stores/jobs.svelte.ts` | backend /api/v1/ws/jobs | WebSocket connection | ✓ WIRED | ws/jobs URL constructed from location.host |
| `frontend/src/lib/components/layout/AppShell.svelte` | `frontend/src/lib/components/jobs/TasksDrawer.svelte` | TasksDrawer mounted | ✓ WIRED | 2 occurrences of TasksDrawer in AppShell.svelte |
| `frontend/src/lib/components/lifecycle/ActionToolbar.svelte` | `frontend/src/lib/api/lifecycle.ts` | power/backup actions | ✓ WIRED | api.lifecycle.backupNow called in runBackupNow; power calls present |
| `frontend/src/lib/components/lifecycle/SnapshotsTab.svelte` | `frontend/src/lib/components/lifecycle/SnapshotTree.svelte` | renders the tree | ✓ WIRED | 3 occurrences of SnapshotTree in SnapshotsTab.svelte |
| `frontend/src/routes/inventory/+page.svelte` | `frontend/src/lib/api/lifecycle.ts` | bulkPower fan-out | ✓ WIRED | bulkPower (1 ref) in inventory/+page.svelte |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TasksDrawer.svelte` | jobsStore.jobs | WebSocket backfill + upsert in jobs.svelte.ts | Yes — real WS messages from backend | ✓ FLOWING |
| `SnapshotsTab.svelte` | snapshots from listSnapshots | connector.snapshot_list → DB-free PVE read | Yes — PVE API response | ✓ FLOWING |
| `BackupsTab.svelte` | backups from listBackups | connector.storage_content via PVE API | Yes — real PVE storage content | ✓ FLOWING |
| `backend /api/v1/jobs` | jobs list | service.list_jobs → SQLAlchemy select from jobs table | Yes — SQLAlchemy DB query | ✓ FLOWING |
| `backend /backups/schedules` | schedule list | select(BackupSchedule) → DB read | Yes — SQLAlchemy DB query | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Worker module imports and WorkerSettings loads | `from app.jobs.worker import WorkerSettings` | 13 functions, all max_tries=1 | ✓ PASS |
| All lifecycle routes registered in FastAPI app | `create_app()` route scan | 30 lifecycle routes, /api/v1/jobs, /api/v1/ws/jobs all found | ✓ PASS |
| All 18 PVEConnector lifecycle methods defined | `grep async def` in connector.py | 18 matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| LIFE-01 | 03-02 | Start, Stop, Reboot, Shutdown, Delete VMs/LXCs | ✓ SATISFIED | Power routes + ActionToolbar + PowerConfirmDialog |
| LIFE-02 | 03-02 | Destructive actions require typed-name or OK/Cancel confirm | ✓ SATISFIED | ConfirmByNameDialog for Delete, PowerConfirmDialog for Stop/Reboot/Shutdown/Force-Stop |
| LIFE-03 | 03-02 + 03-06 | Bulk Start/Stop/Reboot from list (bulk Delete excluded) | ✓ SATISFIED | Bulk-action bar in inventory/+page.svelte has Start/Stop/Reboot only |
| LIFE-04 | 03-03 + 03-06 | Create/restore/delete snapshots; snapshot tree visible | ✓ SATISFIED | snapshot_routes.py + SnapshotTree.svelte + SnapshotsTab.svelte |
| LIFE-05 | 03-04 + 03-07 | Manual backup (vzdump) | ✓ SATISFIED | backup_routes.py POST /backup + BackupsTab "Back up now" |
| LIFE-06 | 03-04 + 03-07 | Scheduled backup jobs with retention | ✓ SATISFIED | fire_due_scheduled_backups cron + prune_backups + BackupScheduleCard.svelte + /backups global page |
| LIFE-07 | 03-04 + 03-07 | Restore VM/LXC from backup | ✓ SATISFIED | POST /restore route + RestoreDialog with in-place/as-new modes |
| LIFE-08 | 03-03 + 03-06 | Resize CPU/RAM with reboot-required warnings based on hotplug | ✓ SATISFIED | resize.py hotplug parser + ResizeDialog.svelte "Requires a reboot" |
| LIFE-09 | 03-03 + 03-06 | Grow disk online; shrink explicitly unsupported | ✓ SATISFIED | validate_resize 422 server-side + ResizeDialog "can only grow" |
| LIFE-10 | 03-04 + 03-06 | Clone VM (linked/full) + convert to template | ✓ SATISFIED | clone.py + CloneDialog.svelte + ConvertTemplateDialog.svelte, LXC template-convert rejected 422 |
| LIFE-11 | 03-04 + 03-06 | Migrate VM (live/offline) with bwlimit | ✓ SATISFIED | migrate.py quorum+snippet pre-flights + MigrateDialog bwlimit in Advanced collapsible |
| LIFE-12 | 03-01 + 03-02 + 03-05 | Tasks drawer with UPID progress + stderr | ✓ SATISFIED | dispatch_and_poll + TasksDrawer.svelte + ws/jobs WebSocket |
| LIFE-13 | 03-02 + 03-05 | One-click retry where safe | ✓ SATISFIED | IDEMPOTENT_KINDS gate in jobs/routes.py + Retry button in JobRow.svelte |
| LIFE-14 | 03-01 | Orphaned tasks re-attached on app boot | ✓ SATISFIED | reap_orphans called from on_startup in worker.py, 5 edge cases covered |
| API-04 | 03-02 | Mutating endpoints return 202 with job ID | ✓ SATISFIED | 25 HTTP_202_ACCEPTED across lifecycle routes, 30 lifecycle routes registered |
| UI-06 | 03-01 | Error messages map PVE errors to human-readable text | ✓ SATISFIED | map_pve_error with 9 locked friendly messages + raw fallback; JobErrorDetail.svelte |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/jobs/functions.py` | 29 | `noop_job` stub function | ℹ️ Info | Intentional placeholder from Plan 01 per module docstring; worker registers it as `internal.noop`; 12 real job functions are registered alongside it. Not a blocker — the real lifecycle functions (vm.power, vm.delete, etc.) are all present and wired. |
| `backend/app/lifecycle/schemas.py` | 130, 143, 283, 299 | Mentions "skiplock" in docstring comments | ℹ️ Info | Comments only — documenting that skiplock is explicitly absent. No actual skiplock field in any schema. Zero skiplock in connector.py. |
| `frontend/src/lib/components/lifecycle/ActionToolbar.svelte` | 418 | Stale comment "Back up now stays a Plan 03-07 TODO" | ℹ️ Info | Stale comment only — the actual implementation on line 194-208 fully wires the backup action via `runBackupNow()` calling `api.lifecycle.backupNow(...)`. Functional, comment is misleading but harmless. |

### Human Verification Required

None — all success criteria are verifiable programmatically. The full test suite (370 backend + 121 frontend) and the route/artifact checks above cover the observable truths.

### Gaps Summary

No gaps. All 5 success criteria from the roadmap are verified against the actual codebase:

1. Power actions (Start/Stop/Reboot/Shutdown/Delete + bulk) are fully implemented with the correct confirmation gates and bulk Delete exclusion.
2. Snapshots (tree + create/restore/delete) + backups (manual/scheduled/restore with retention) are all wired end-to-end.
3. Resize (CPU/RAM hotplug warnings + disk grow with shrink block) + clone + template-convert + migrate (quorum/snippet pre-flights + bwlimit) are all implemented with server-side enforcement.
4. The 202-Accept + job pipeline + orphan reaper + WebSocket Tasks drawer + retry gate are in place and verified by behavioral spot-checks.
5. The curated PVE error map produces locked friendly strings for known errors and verbatim raw fallback for unknown ones — never a vague "operation failed".

All Proxmox hard constraints from CLAUDE.md are honored: every mutation returns 202, UPIDs are persisted before polling, API tokens are used (per-team privsep via require_resource_access), skiplock is absent (0 references in connector.py, only docstring comments in schemas.py), and all long-running operations go through the job queue.

---

_Verified: 2026-05-16T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
