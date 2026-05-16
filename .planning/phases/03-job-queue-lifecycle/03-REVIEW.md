---
phase: 03-job-queue-lifecycle
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 88
files_reviewed_list:
  - backend/alembic/versions/0004_phase3.py
  - backend/alembic/versions/0005_phase3_backup_storage.py
  - backend/app/clusters/connector.py
  - backend/app/clusters/routes.py
  - backend/app/clusters/schemas.py
  - backend/app/clusters/service.py
  - backend/app/jobs/__init__.py
  - backend/app/jobs/backup_functions.py
  - backend/app/jobs/backups_cron.py
  - backend/app/jobs/clone_migrate_functions.py
  - backend/app/jobs/enqueue.py
  - backend/app/jobs/events.py
  - backend/app/jobs/functions.py
  - backend/app/jobs/poller.py
  - backend/app/jobs/reaper.py
  - backend/app/jobs/resize_functions.py
  - backend/app/jobs/routes.py
  - backend/app/jobs/schemas.py
  - backend/app/jobs/service.py
  - backend/app/jobs/snapshot_functions.py
  - backend/app/jobs/worker.py
  - backend/app/jobs/ws.py
  - backend/app/lifecycle/__init__.py
  - backend/app/lifecycle/backup_routes.py
  - backend/app/lifecycle/backups.py
  - backend/app/lifecycle/clone.py
  - backend/app/lifecycle/clone_migrate_routes.py
  - backend/app/lifecycle/errors.py
  - backend/app/lifecycle/migrate.py
  - backend/app/lifecycle/power.py
  - backend/app/lifecycle/resize.py
  - backend/app/lifecycle/resize_routes.py
  - backend/app/lifecycle/routes.py
  - backend/app/lifecycle/schemas.py
  - backend/app/lifecycle/snapshot_routes.py
  - backend/app/lifecycle/snapshots.py
  - backend/app/main.py
  - backend/app/models/__init__.py
  - backend/app/models/backup_schedule.py
  - backend/app/models/cluster.py
  - backend/app/models/job.py
  - backend/pyproject.toml
  - backend/tests/conftest.py
  - backend/tests/test_jobs_infrastructure.py
  - backend/tests/test_jobs_routes.py
  - backend/tests/test_lifecycle_backups.py
  - backend/tests/test_lifecycle_clone_migrate.py
  - backend/tests/test_lifecycle_errors.py
  - backend/tests/test_lifecycle_power.py
  - backend/tests/test_lifecycle_resize.py
  - backend/tests/test_lifecycle_snapshots.py
  - backend/tests/test_migrations.py
  - backend/tests/test_models_metadata.py
  - deploy/README.md
  - deploy/lxc/bootstrap.sh
  - deploy/systemd/proxmox-gui-worker.service
  - frontend/src/lib/api/client.ts
  - frontend/src/lib/api/clusters.ts
  - frontend/src/lib/api/jobs.ts
  - frontend/src/lib/api/lifecycle.ts
  - frontend/src/lib/api/types.ts
  - frontend/src/lib/components/jobs/JobErrorDetail.svelte
  - frontend/src/lib/components/jobs/JobRow.svelte
  - frontend/src/lib/components/jobs/TasksDrawer.svelte
  - frontend/src/lib/components/layout/AppShell.svelte
  - frontend/src/lib/components/layout/Sidebar.svelte
  - frontend/src/lib/components/layout/Topbar.svelte
  - frontend/src/lib/components/lifecycle/ActionToolbar.svelte
  - frontend/src/lib/components/lifecycle/BackupScheduleCard.svelte
  - frontend/src/lib/components/lifecycle/BackupsTab.svelte
  - frontend/src/lib/components/lifecycle/CloneDialog.svelte
  - frontend/src/lib/components/lifecycle/ConvertTemplateDialog.svelte
  - frontend/src/lib/components/lifecycle/MigrateDialog.svelte
  - frontend/src/lib/components/lifecycle/PowerConfirmDialog.svelte
  - frontend/src/lib/components/lifecycle/ResizeDialog.svelte
  - frontend/src/lib/components/lifecycle/RestoreDialog.svelte
  - frontend/src/lib/components/lifecycle/SnapshotCreateDialog.svelte
  - frontend/src/lib/components/lifecycle/SnapshotTree.svelte
  - frontend/src/lib/components/lifecycle/SnapshotsTab.svelte
  - frontend/src/lib/components/lifecycle/snapshot-tree.ts
  - frontend/src/lib/components/quotas/QuotaIndicator.svelte
  - frontend/src/lib/stores/jobs.svelte.ts
  - frontend/src/lib/utils/elapsed.ts
  - frontend/src/routes/admin/clusters/[id]/+page.svelte
  - frontend/src/routes/backups/+page.server.ts
  - frontend/src/routes/backups/+page.svelte
  - frontend/src/routes/inventory/+page.svelte
  - frontend/src/routes/inventory/[cluster]/[vmid]/+page.server.ts
  - frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte
  - frontend/tests/backups-page.test.ts
  - frontend/tests/elapsed.test.ts
  - frontend/tests/jobs-store.test.ts
  - frontend/tests/snapshot-tree.test.ts
findings:
  critical: 0
  warning: 6
  info: 7
  total: 13
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 88
**Status:** issues_found

## Summary

Phase 3 implements the arq job queue, UPID polling, the orphan reaper, and the
full VM/LXC lifecycle surface (power, snapshots, resize, backup/restore,
clone/migrate). The code is well-structured and disciplined: it adheres
closely to the project's hard constraints. Specifically verified as correct:

- **202-Accepted contract** — every mutating route returns `202` and enqueues
  a job; no route blocks on a UPID poll.
- **UPID-before-poll ordering** — `poller.dispatch_and_poll` persists the UPID
  + node and commits before the first `task_status` call (Pitfall 12).
- **Commit-before-enqueue** — `enqueue_job` commits the DB row before the arq
  enqueue, so the worker can always `SELECT` the row.
- **Privsep tokens** — lifecycle workers acquire `registry.get_for_team`; the
  bootstrap admin token is never used for tenant operations.
- **Cross-tenant existence** — `jobs_get` / `jobs_retry` return `404` (not
  `403`) for out-of-team jobs; lifecycle routes route through
  `require_resource_access`; the detail-page loader collapses 403→404.
- **No lock-override** — every mutating schema is `extra="forbid"`; no
  connector method ever sends the root-only `skiplock` parameter.
- **`max_tries=1`** — arq auto-retry is disabled on every job kind;
  non-idempotent kinds are excluded from the retry endpoint.

No Critical issues were found. The findings below are correctness bugs in the
worker/poller/reaper edge paths and a small set of quality items. None violate
a security constraint, but several would produce stuck or mis-stated jobs in
real failure scenarios.

## Warnings

### WR-01: Poller never times out — a permanently-running PVE task pins a worker slot forever

**File:** `backend/app/jobs/poller.py:82-126`
**Issue:** `dispatch_and_poll`'s poll loop is `while True:` with no iteration
or wall-clock ceiling. It exits only when PVE reports `status == "stopped"`.
arq's per-function `timeout` (e.g. `14400` for backup/clone) will eventually
cancel the coroutine, but cancellation happens *outside* the `try` blocks in
the job functions — `dispatch_and_poll` raises `asyncio.CancelledError`, which
is not in the `(PVEUnreachable, PVEAPIError, PVEAuthError)` tuple caught by
`run_power_action` / `run_backup` / etc. The job row is therefore left in
state `running` with a populated UPID forever (until the next worker boot,
when the reaper re-attaches it). For the duration, one of the 6 `max_jobs`
slots is consumed. A PVE task that genuinely hangs (e.g. a wedged migration)
is not surfaced to the user as failed within any bounded time.
**Fix:** Add a wall-clock deadline to the poll loop and raise a typed timeout
the job functions catch:
```python
import time
_POLL_DEADLINE_S = 14000  # below arq's 14400 func timeout

deadline = time.monotonic() + _POLL_DEADLINE_S
while True:
    if time.monotonic() > deadline:
        async with sessionmaker() as db:
            await finish_job(
                db, job.id, state="needs_review",
                error="Polling timed out; outcome unknown — check Proxmox.",
            )
            await db.commit()
        return
    status = await connector.task_status(node=node, upid=upid)
    ...
```

### WR-02: A reaper-resolved or retried job is silently re-run by the original `dispatch_and_poll` call

**File:** `backend/app/jobs/poller.py:65-81`, `backend/app/jobs/functions.py:60-71`
**Issue:** Each job function re-claims with a terminal-state guard
(`if job.state in {"succeeded","failed","needs_review"}: return`), but that
check runs ONCE, at claim time. `dispatch_and_poll` then unconditionally calls
`dispatch_fn()` — issuing the mutating PVE call — without re-reading the row.
If a job is claimed, then (e.g.) the `jobs_retry` endpoint resets it or the
reaper marks it `orphaned`/`needs_review` in the window between claim and
dispatch, the worker still fires the PVE mutation. For non-idempotent kinds
(`vm.clone`, `vm.migrate`, `vm.restore`) this is exactly the double-execution
`max_tries=1` is meant to prevent. The window is narrow but real, especially
on the reaper's edge-case-1 path which re-enqueues `job.reattach` while the
original may still be queued.
**Fix:** Re-read the row and re-check the terminal/claimed guard inside
`dispatch_and_poll` immediately before `await dispatch_fn()`, and abort if the
state is no longer `claimed`. Alternatively, use a conditional UPDATE
(`UPDATE jobs SET state='running' WHERE id=? AND state='claimed'`) and bail if
zero rows were affected.

### WR-03: `job.reattach` is enqueued but never registered as a worker function

**File:** `backend/app/jobs/reaper.py:131`, `backend/app/jobs/worker.py:116-137`
**Issue:** The reaper's edge-case-1 path (`_reconcile_with_upid`) calls
`arq_pool.enqueue_job("job.reattach", job.id)` for a job whose PVE task is
still running after a worker restart. No function named `job.reattach` exists
in `WorkerSettings.functions`. arq will accept the enqueue but the worker has
no handler — the job is dropped, the row stays `orphaned` indefinitely, and
the `reaper.reattached` event tells the UI "Resumed tracking N task(s)" when
in fact nothing resumed. This breaks LIFE-14 edge case 1 (the most common
reaper case — a long backup/clone running across a worker restart).
**Fix:** Register a `job.reattach` function that re-attaches to the existing
UPID and polls it to terminal (essentially the poll-only half of
`dispatch_and_poll`, skipping the dispatch). Add it to
`WorkerSettings.functions` with `max_tries=1`.

### WR-04: Idempotency key collapses a legitimately-repeated power action onto a stale terminal job

**File:** `backend/app/jobs/enqueue.py:32-40,74-84`
**Issue:** The idempotency key is `sha256({kind, actor, payload})` with no
time component and no nonce. `find_job_by_idempotency_key` matches *any* job
with that key regardless of state. Scenario: a user clicks "Reboot VM 100",
the job runs and reaches `succeeded`. An hour later the same user clicks
"Reboot VM 100" again — identical kind/actor/payload → identical key → the
`UNIQUE` insert fails → `enqueue_job` returns the *old, succeeded* job. The
route answers `202` with the stale job id; nothing is actually enqueued; the
VM is never rebooted. The user sees a job that is already green and assumes it
worked. This silently drops legitimate repeat operations for every idempotent
kind (power, snapshot-delete, resize, backup).
**Fix:** Scope the idempotency key to a short window, or only dedup against
*non-terminal* jobs. Simplest correct fix: when `find_job_by_idempotency_key`
returns a job already in a terminal state, treat it as a non-collision —
generate a fresh key (append a nonce/timestamp bucket) and insert a new row.
The dedup should only collapse genuine in-flight double-submits.

### WR-05: `update_cluster` invalidates the registry but never invalidates per-team connectors / backup-storage caches used by the worker

**File:** `backend/app/clusters/service.py:444-459`
**Issue:** `update_cluster` calls `registry.invalidate(cluster_id)` and
restarts the probe — that handles the API process. But the arq **worker** is
a separate process (D-17) with its own `PVEConnectorRegistry` built in
`worker.on_startup`. When an admin rotates a cluster token or changes
`backup_storage`, the worker's registry keeps serving connectors built from
the old token until the worker process restarts. A token rotation therefore
silently breaks all in-flight and newly-enqueued jobs for that cluster until
someone restarts `proxmox-gui-worker.service`. This is a cross-process
state-consistency gap, not just a cache-staleness nit, because the worker has
no invalidation channel.
**Fix:** Have the worker's registry resolve connectors lazily per job
(re-read the cluster row + token each time `get_for_team` is called, or cache
with a short TTL keyed on the cluster row's `updated_at`), or publish a
cluster-invalidation event on Redis that the worker subscribes to. At minimum,
document the "restart the worker after a cluster edit" operational requirement
in `deploy/README.md`.

### WR-06: WebSocket handshake authenticates with the JWT cookie but skips CSRF / origin checks

**File:** `backend/app/jobs/ws.py:46-92`
**Issue:** `_resolve_ws_user` authenticates the `/ws/jobs` upgrade purely
from the `access_token` cookie. WebSocket upgrade requests are not subject to
the browser same-origin policy the way `fetch` is — a page on any origin can
open `wss://<host>/api/v1/ws/jobs`, and the browser will attach the session
cookie (cross-site WebSocket hijacking). The drawer payload is read-only
(job-state snapshots scoped to the user's teams), so the blast radius is
information disclosure of the victim's own job activity rather than a
mutation — which is why this is a Warning, not Critical. But the project's
own comments (`Pitfall 9`, `T-03-02-05`) treat WS auth carefully, and the
mutating routes all carry `csrf_protect`; the WS endpoint should not be the
soft spot.
**Fix:** Validate the `Origin` header on the WebSocket upgrade against the
expected host before `accept()` (FastAPI exposes `websocket.headers["origin"]`).
Reject a mismatched/absent origin with `close(code=1008)`, mirroring the
existing unauthenticated-handshake path.

## Info

### IN-01: `_reconcile_with_upid` re-raises a non-404 `PVEAPIError`, aborting the whole reaper sweep

**File:** `backend/app/jobs/reaper.py:90-102`
**Issue:** Inside the per-job reconcile, a `PVEAPIError` whose `status_code`
is not `404` is `raise`d. `reap_orphans` has no per-job try/except around the
`_reconcile_*` calls, so one job hitting (e.g.) a transient `500` from PVE
aborts reconciliation of every remaining non-terminal job. `worker.on_startup`
catches it and lets the worker boot, but the un-reconciled jobs stay stuck
until the next restart.
**Fix:** Wrap each `_reconcile_*` call in `reap_orphans`'s loop in a
try/except that logs and marks the single job `needs_review`, so one bad job
cannot starve the rest of the sweep.

### IN-02: Restore-as-new reserves a VMID but never records it in the in-process reserved set

**File:** `backend/app/lifecycle/backups.py:228-237`, `backend/app/lifecycle/clone.py:78-97`
**Issue:** `enqueue_restore` (mode `new`, no explicit `new_vmid`) calls
`reserve_vmid`, which DOES record the id in `_reserved`. That part is fine.
But when the caller *does* pass `request.new_vmid`, neither restore nor clone
records that user-chosen id in the reserved set — so a concurrent `reserve_vmid`
for the same cluster could hand `cluster_nextid()`'s value, collide, and only
the `run_clone` "already exists" backstop saves it (restore has no such
backstop). Low-probability, but restore-as-new with a manually-typed VMID has
no collision protection at all.
**Fix:** When an explicit `new_vmid` is supplied, also insert it into the
per-cluster reserved set (or run it through a `reserve_vmid`-style lock path)
so concurrent allocations skip it.

### IN-03: `enqueue_bulk_power` partial-failure leaves an orphaned batch with no rollback

**File:** `backend/app/lifecycle/power.py:160-200`
**Issue:** The bulk fan-out resolves + enqueues each target in a loop, and
`enqueue_power` commits per job. If target 3 of 5 raises `403`
(cross-tenant) the exception propagates out of `bulk_power` and the route
returns an error — but targets 1 and 2 are already committed and enqueued.
The user gets an error response yet two VMs still get powered. The docstring
acknowledges this ("the partial work already enqueued is fine"), so it is an
intentional decision, but the route returns no information about which
targets succeeded, so the client cannot reconcile.
**Fix:** Either resolve+validate all targets first (fail the whole batch on
any 403 before enqueuing anything), or return a per-target result list so the
client can show partial success. Document the chosen behavior in the OpenAPI
summary.

### IN-04: `run_backup` keep-last-N prune uses a connector that may be from a stale registry

**File:** `backend/app/jobs/backup_functions.py:133-145`
**Issue:** The prune step reuses the `connector` captured at the top of
`run_backup`. For a long backup (hours) the circuit breaker / token may have
changed underneath it. This is minor — the prune is explicitly best-effort
and a failure only logs a warning — but it is worth a comment so a future
reader does not assume the prune connector is fresh.
**Fix:** Add a one-line comment noting the prune intentionally reuses the
dispatch-time connector and that a stale-connector prune failure is tolerated.

### IN-05: `backups_cron` stamps `last_run_at` even when the `vm.backup` enqueue is followed by a commit failure

**File:** `backend/app/jobs/backups_cron.py:103-126`
**Issue:** `enqueue_job` commits the job row itself, then `fire_due_scheduled_backups`
sets `schedule.last_run_at = now` and flushes, then commits once at the end of
the loop. If the final `db.commit()` fails (or a later schedule in the same
loop raises before the commit), earlier schedules have their job row committed
(by `enqueue_job`) but their `last_run_at` flush is rolled back — so next tick
they fire again, double-backing-up. Per-schedule commit of the `last_run_at`
stamp would make each schedule's enqueue+stamp atomic.
**Fix:** Commit `last_run_at` per schedule immediately after a successful
`enqueue_job`, rather than once at the end of the sweep.

### IN-06: `_cicustom_storage` only inspects the first storage reference in a multi-entry `cicustom`

**File:** `backend/app/lifecycle/migrate.py:65-81`
**Issue:** `cicustom` can carry several comma-separated `key=storage:path`
entries (e.g. `user=local:snippets/u.yml,network=local:snippets/n.yml`).
`_cicustom_storage` returns the first storage id found and stops. If the
*first* entry references a shared storage but a *later* entry references a
node-local one, the migrate pre-flight passes and the migration then fails
mid-flight on the node-local snippet. The snippet feature lands in Phase 4, so
this is currently a latent bug.
**Fix:** Parse and check every storage id referenced by `cicustom`, failing
the pre-flight if any one of them is node-local.

### IN-07: `worker.on_startup` falls back to an ephemeral cipher with only a `warnings.warn`

**File:** `backend/app/jobs/worker.py:70-79`
**Issue:** When `settings.master_key_path` is absent, the worker builds an
ephemeral random cipher. It then cannot decrypt any cluster token, so
`registry.get_for_team` fails for every job — every job goes to `needs_review`
via the connector-unavailable path. A `warnings.warn` is easy to miss in
`journalctl`. This is the documented DEV/TEST behavior, but in production a
missing/unreadable `master.key` should be a loud, fatal startup error so the
operator notices immediately rather than discovering every job silently
failing.
**Fix:** In a non-test environment, treat a missing `master_key_path` as a
fatal `RuntimeError` (or at least `logger.error`), matching how the API
process should behave. The ephemeral fallback should be gated behind an
explicit dev/test flag.

---

_Reviewed: 2026-05-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
