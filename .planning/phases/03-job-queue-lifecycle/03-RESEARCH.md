# Phase 3: Job Queue & Lifecycle - Research

**Researched:** 2026-05-16
**Domain:** Async job queue (arq + Redis), Proxmox VE UPID polling, VM/LXC lifecycle operations, WebSocket progress streaming
**Confidence:** HIGH for arq/Redis/proxmoxer stack and UPID semantics (verified against PyPI registry + proxmoxer docs + existing connector code); MEDIUM for PVE error-string catalogue and live/offline migration param shapes (PVE error text varies 7.x↔8.x↔9.x); HIGH for the integration points (read directly from shipped code).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

CONTEXT.md ships 16 locked decisions (D-01..D-16). The planner MUST honor every one verbatim. Copied below:

**Tasks Drawer & Live Progress**
- **D-01:** Tasks drawer scope = team-wide. Shows all jobs across every team the user belongs to, no per-user filter toggle. (Admin "all-resources" overview vs. team-scoped remains an OPEN question — not resolved here.)
- **D-02:** Drawer auto-open = long jobs only (clone / migrate / backup / restore). Fast power actions leave it collapsed with a live count badge; the enqueue toast confirms those.
- **D-03:** Completion notification = toast on every finish (success and failure) via the existing sonner Toaster. UI-07 bell is Phase 4.
- **D-04:** Progress display = status + elapsed (spinner, task-type label, elapsed timer, UPID). NO percentage parsing from the PVE task log (Pitfall 13). For backup jobs, surface structured `INFO:` lines from the task log when present.

**Snapshots & Backups**
- **D-05:** Snapshot display = indented tree view with branch visualization + "current" marker.
- **D-06:** Backup surfaces = both per-VM (Backups tab) and global (`/backups` page).
- **D-07:** Restore-from-backup = ask each time (in-place overwrite vs. restore into new VMID; default in-place). In-place is a data-loss op → typed-name confirm. Restore-as-new allocates a new VMID and counts against quota.
- **D-08:** Backup target = admin-preset per cluster (new admin config surface on `/admin/clusters/{id}`). User chooses ONLY retention. Retention granularity for v1 = simple "keep last N".

**Action Controls & Confirmations**
- **D-09:** Action button placement = detail toolbar + list "⋯" menu.
- **D-10:** Destructive confirmation = typed-name for every data-loss op (Delete, restore-snapshot, in-place restore). Force-Stop = OK/Cancel. Reboot/graceful Shutdown = lighter OK/Cancel. Reuse `ConfirmByNameDialog`.
- **D-11:** Bulk actions = one job per VM, grouped under a batch header. Single confirm dialog for the batch. Bulk Delete excluded.
- **D-12:** Resize & migrate forms = simple + Advanced disclosure. Resize: core CPU/RAM/disk + inline reboot-required warnings; disk-grow online-only, shrink blocked. Migrate: target-node + summary; bwlimit + live/offline behind "Advanced" (bwlimit stays visible, just in Advanced).

**Errors & Retry**
- **D-13:** Error mapping = curated table + raw fallback. Unrecognized errors fall back to raw PVE message — never swallowed.
- **D-14:** Technical detail = expandable "Show technical details" (raw stderr + UPID + task log).
- **D-15:** Redaction = none. All users see full raw technical detail. Conscious deviation from Pitfall 24's redaction advice, accepted for the small-team home-lab audience.
- **D-16:** Retry = idempotent ops only (start, stop, reboot, shutdown, snapshot-delete, resize, backup), keyed off `jobs.idempotency_key`. Non-idempotent ops (clone, migrate, delete, restore) show no retry button.

### Claude's Discretion

- **In-app "Unlock" affordance for locked VMs** — researcher confirms whether the per-tenant privsep token can perform a plain `unlock`. (RESOLVED below — see Open Questions Q1.)
- **Clone wizard** — VMID auto-allocated via `/cluster/nextid` with app-level reservation (Pitfall 1), user-overridable; clone name; linked vs. full; target node/storage.
- **Snapshot options** — include-RAM-state toggle, snapshot name/description.
- **WebSocket reconnection / backfill** for the Tasks drawer after a dropped connection.
- **arq concurrency + UPID poll cadence** — tight cadence for first ~10s, exponential backoff, cap ~30s.
- **Orphan-reaper admin surface** for `needs_review` jobs.
- **Embedded Redis provisioning** in the LXC (4th systemd unit vs. bundled).

### Deferred Ideas (OUT OF SCOPE)

- **Full PVE prune retention** (keep-daily/weekly/monthly/yearly) — v1 ships simple "keep last N".
- **Admin "all-resources" overview** vs. team-scoped admin — open design question carried from Phase 2.
- **UI-07 in-app notification bell** — Phase 4.
- **noVNC console (Console tab)** — Phase 4.
- **Audit log retention / rotation** (Pitfall 21, AUDIT-06) — Phase 5.
- **Quota reconciliation / drift detection sweep** — not Phase 3 scope.
- **Pitfall-8 personal-team-token bootstrap gap** — Phase 1 follow-up, tracked in HANDOFF.md.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | Start, Stop (graceful), Reboot, Shutdown (hard), Delete VMs and LXCs | proxmoxer `status/{start,stop,reboot,shutdown}` POST + qemu/lxc DELETE — all UPID-returning; §Proxmox Call Reference |
| LIFE-02 | Destructive actions require typed-name confirm / OK-Cancel | UI-only (D-10) — `ConfirmByNameDialog` reuse; no new research |
| LIFE-03 | Bulk Start/Stop/Reboot from list (bulk Delete excluded) | One `Job` row per VM (D-11); needs a `batch_id` column — §Schema Changes |
| LIFE-04 | Create/restore/delete manual snapshots; snapshot tree | proxmoxer `snapshot` POST/DELETE + rollback POST; tree from `snapshot` GET `parent` field — §Proxmox Call Reference |
| LIFE-05 | Manual backup (vzdump or PBS) | `vzdump` POST on node scope with `storage=` + `vmid=`; PBS is just a storage target — §Backup |
| LIFE-06 | Scheduled backup jobs + retention | `/cluster/backup` jobs API OR app-side arq cron — recommendation in §Scheduled Backups |
| LIFE-07 | Restore from backup | `qmrestore`-equivalent: qemu/lxc POST with `archive=` — §Restore |
| LIFE-08 | Resize CPU/RAM (reboot-required warnings via hotplug) | Synchronous config PUT `cores=`/`memory=`; hotplug detection from `hotplug=` config field — §Resize |
| LIFE-09 | Grow disk online, shrink blocked | `resize` PUT endpoint, `+NG` syntax; shrink rejected app-side — §Resize |
| LIFE-10 | Clone (linked/full), convert to template | `clone` POST (UPID), `template` POST (UPID) — §Clone |
| LIFE-11 | Migrate (live/offline, bwlimit) | `migrate` POST (UPID) with `online=` + `bwlimit=` — §Migrate |
| LIFE-12 | Tasks drawer, poll UPID, surface stderr | arq worker + UPID poll loop + WebSocket — §Architecture Patterns |
| LIFE-13 | One-click retry where safe | arq re-enqueue keyed off `idempotency_key` (D-16) — §Retry |
| LIFE-14 | Orphaned tasks re-attached on app boot | Orphan reaper scans non-terminal jobs on startup — §Pattern 3 |
| API-04 | Mutating endpoints return 202 + job id | Enqueue-then-202 pattern — §Architecture Patterns |
| UI-06 | PVE errors → human-readable | Curated error map (D-13) — §PVE Error Surface |
</phase_requirements>

## Summary

Phase 3 builds the async job pipeline that every Proxmox mutation flows through, then layers the full set of existing-VM lifecycle operations on top. The infrastructure half is the hard part: an `arq` worker process backed by an embedded Redis, a durable UPID-polling loop, an orphan reaper on boot, a WebSocket endpoint feeding the Tasks drawer, and the 202-Accepted enqueue contract on every write endpoint. The lifecycle half is comparatively mechanical once the pipeline exists — each operation is a thin proxmoxer call wrapped in a job kind.

The codebase is well-prepared. The `jobs` table is already shipped (Plan 01-02) with the exact `pending → claimed → running → succeeded/failed/orphaned/needs_review` state machine, an `idempotency_key` unique column, and `upid`/`upid_node` columns. The `PVEConnector` already wraps proxmoxer with `asyncio.to_thread`, a `pybreaker` circuit breaker, and a 30s resource cache; Phase 3 extends it with mutating lifecycle calls and a `task_status`/`task_log` poller. The worker systemd unit ships installed-but-disabled with a `sleep infinity` placeholder ExecStart that Phase 3 replaces. Per-tenant privsep tokens already exist in `team_cluster_tokens` — every lifecycle call executes as the team token, never the bootstrap admin token.

**Primary recommendation:** Use **arq 0.26.3** (not the newer 0.28.0 — see Standard Stack rationale) with a **4th systemd unit running Debian's stock `redis-server` 7.0.x bound to `127.0.0.1`**. Build the worker as `WorkerSettings` exposing one async function per job kind; persist the UPID to the `jobs` row **before** the polling loop starts (Pitfall 12); treat the first `/tasks/{upid}/status` response as authoritative (Pitfall 2); push job-state changes to WebSocket subscribers via **Redis pub/sub** so the API process and the worker process stay decoupled. Power actions are the first vertical slice — they exercise enqueue → worker → UPID-poll → WebSocket → drawer → toast end-to-end before clone/migrate/backup are added.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Enqueue a mutation, return 202 + job id | API / Backend (FastAPI route + service) | Database (insert `jobs` row) | The HTTP request must never block on Proxmox; it writes a job row and returns immediately (CLAUDE.md constraint, API-04). |
| Job execution + UPID dispatch | Worker process (arq) | Cluster Connector | Long ops (clone, migrate, backup) run 5–30 min; only a separate process survives an API restart and an HTTP timeout. |
| UPID polling loop | Worker process (arq) | Cluster Connector | Polling is the worker's job; the API process never polls (Anti-Pattern 2). |
| Orphan reaper on boot | Worker process (arq `on_startup` hook) | Database + Cluster Connector | Reaper must run where the worker runs — it re-attaches the worker's own polling loops. |
| Job-state → live UI push | Worker (publish) → API (WebSocket fan-out) | Redis pub/sub | Worker and API are separate processes; Redis pub/sub is the only shared channel. An in-process event hub (ARCHITECTURE.md Pattern from a single-binary design) does NOT work across two processes. |
| WebSocket endpoint for Tasks drawer | API / Backend (FastAPI WebSocket route) | Redis pub/sub subscriber | The browser connects to the API process; the API subscribes to Redis and fans out. |
| Quota check for clone / restore-as-new | API / Backend (service, pre-enqueue) | Database row-lock | Admission control happens before the job is enqueued (Pattern 6, TOCTOU Pitfall 6). |
| PVE error → friendly text mapping | API / Backend (error-map module) | Frontend (renders) | The curated map is server-side data the worker attaches to the failed job row; the frontend renders it. Keeps the map in one testable place. |
| Snapshot tree rendering | Browser / Client (recursive Svelte component) | API (flat snapshot list) | API returns the flat list with `parent` pointers; the client builds the tree (UI-SPEC D-05, hand-rolled component). |
| Migration snippet pre-flight | API / Backend (service, pre-enqueue) | Cluster Connector | Refusal must happen before the job is enqueued so the user gets an immediate, actionable error (Pitfall 20). |
| Scheduled backup trigger | Worker process (arq cron) | Database (schedule rows) | arq has a native cron facility; the schedule lives in the app DB, the worker fires it. |

### System Architecture Diagram

```
                          BROWSER (SvelteKit SPA)
   ┌──────────────────────────────────────────────────────────────────┐
   │  Action toolbar / bulk bar / dialogs                              │
   │       │ POST mutation                          ▲ live job updates │
   │       ▼                                        │ (WebSocket)      │
   └───────┼────────────────────────────────────────┼──────────────────┘
           │ HTTPS via Caddy                        │ wss:// via Caddy
   ┌───────▼────────────────────────────────────────┼──────────────────┐
   │  API PROCESS  (proxmox-gui-api.service, FastAPI/uvicorn)           │
   │                                                                    │
   │  lifecycle routes ──┐                    ws/jobs endpoint ◄────┐   │
   │    1. RBAC gate     │                      subscribes to      │   │
   │    2. pre-flight    │                      Redis pub/sub ──────┘   │
   │       (quorum,      │                                              │
   │        snippet,     ▼                                              │
   │        quota)   enqueue helper ──► arq.create_pool().enqueue_job() │
   │    3. INSERT jobs row (pending, idempotency_key)                   │
   │    4. return 202 {job_id}                                          │
   └────────────────────┬───────────────────────────▲──────────────────┘
                         │ Redis (job queue)         │ Redis (pub/sub
                         ▼                           │  job.{id} events)
   ┌─────────────────────────────────────────────────┼──────────────────┐
   │  REDIS  (proxmox-gui-redis.service — 127.0.0.1:6379, NEW 4th unit) │
   │   - arq job queue (sorted set + job hashes)                        │
   │   - pub/sub channel for job-state change events                    │
   └─────────────────────┬───────────────────────────▲──────────────────┘
                          │ arq worker polls queue    │ publish events
   ┌──────────────────────▼───────────────────────────┼──────────────────┐
   │  WORKER PROCESS  (proxmox-gui-worker.service, arq WorkerSettings)   │
   │                                                                     │
   │  on_startup:  ORPHAN REAPER ── scan jobs in pending/claimed/running │
   │               with a UPID → re-attach poll; no UPID → needs_review  │
   │                                                                     │
   │  job function (per kind: vm.power, vm.snapshot.create, vm.clone …): │
   │    1. claim → state=claimed                                         │
   │    2. connector = registry.get_for_team(cluster, team)              │
   │    3. UPID = connector.<mutating call>()                            │
   │    4. PERSIST upid + upid_node to jobs row  ◄── BEFORE polling      │
   │    5. state=running ; publish job.running                           │
   │    6. POLL /nodes/{node}/tasks/{upid}/status  (adaptive cadence)    │
   │         first response authoritative; exitstatus OK → succeeded     │
   │    7. on terminal: write audit row, publish job.completed           │
   └──────────────────────┬──────────────────────────────────────────────┘
                           │ proxmoxer (asyncio.to_thread, per-team token)
   ┌───────────────────────▼──────────────────────────────────────────────┐
   │  PROXMOX VE CLUSTER(S)  — :8006 REST API, PVEAPIToken auth            │
   └───────────────────────────────────────────────────────────────────────┘
```

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `arq` | **0.26.3** | Async Redis-backed job queue + worker | The asyncio-native job queue; `WorkerSettings` class, `func()` job config, native cron, `Retry` exception. Already named in STACK.md + ROADMAP locked notes. `[VERIFIED: PyPI registry]` |
| `redis` (python client) | **5.3.1** | Redis client used by arq AND by the API process for pub/sub | arq 0.26.3 requires `redis[hiredis]>=4.2.0,<6`. 5.3.1 is the newest in-range release. `[VERIFIED: PyPI — arq requires_dist `redis[hiredis]<6,>=4.2.0`]` |
| `redis-server` (Debian package) | **7.0.x** (`5:7.0.15-1~deb12u6`) | Embedded Redis broker in the LXC | Ships in Debian 12 `main` — `apt-get install redis-server`, no extra apt repo. `[VERIFIED: packages.debian.org/bookworm/redis-server]` |
| `proxmoxer` | **2.3.0** (already installed) | Proxmox VE REST API client | Already in `pyproject.toml`; the only mature Python PVE client. Provides `proxmoxer.tools.Tasks` (`blocking_status`, `decode_upid`, `decode_log`). `[VERIFIED: backend/pyproject.toml + proxmoxer docs]` |

**arq version decision — DO NOT use 0.28.0:** arq 0.28.0 (released 2026-04-16) is the latest, but 0.26.3 is the version Context7 indexes and the version with the most stable documented `WorkerSettings`/`func`/`enqueue_job` surface. `[CITED: context7 /python-arq/arq lists v0.26.3]` 0.27.0 and 0.28.0 are recent and lightly documented. **Recommendation: pin `arq==0.26.3`.** All three share the same `redis<6` constraint, so the redis pin is unaffected. `[ASSUMED]` that 0.26.3's API is fully sufficient for this phase — it is, based on the documented `WorkerSettings` shape below. If the planner prefers latest, 0.28.0 is API-compatible for everything this phase uses; the conservative pin is the recommendation.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `hiredis` | (pulled in by `redis[hiredis]`) | C-accelerated Redis protocol parser | Transitive — installs automatically with `redis[hiredis]`. Worth keeping for the small perf win on pub/sub. |
| `pybreaker` | 1.4.1 (already installed) | Circuit breaker on the PVE connector | Already wired into `PVEConnector._call_with_breaker`. Lifecycle mutations route through `_call_with_breaker` — the worker inherits breaker-open → `PVEUnreachable` behavior for free. |

**No new WebSocket library needed.** FastAPI/Starlette has native `WebSocket` support (`@router.websocket(...)`). `uvicorn[standard]` (already installed) bundles `websockets`. The Tasks-drawer endpoint is a plain Starlette WebSocket route. `[VERIFIED: backend/pyproject.toml ships fastapi==0.136.1 + uvicorn[standard]==0.46.0]`

**No date library on the backend** for elapsed-time — elapsed is computed client-side (UI-SPEC §Component States: ~12-line formatter, no `dayjs`/`luxon`/`date-fns`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| arq + Redis | SQLite-backed queue (`goqite`/`liteq` pattern, hand-rolled in Python) | ROADMAP names this as the explicit fallback "if Redis is dropped late". A SQLite queue avoids the 4th process but loses arq's mature cron/retry/`enqueue_job` semantics and forces a hand-rolled poll loop with `SELECT ... claim` contention handling. **Feasible but not recommended** — the LXC already runs systemd (D-17 `nesting=1`), so a 4th unit is cheap. Decision: ship arq + Redis; keep the SQLite fallback documented but unbuilt. |
| Redis pub/sub for worker→API events | In-process event hub (ARCHITECTURE.md "Live State Hub") | The ARCHITECTURE.md hub assumes a **single binary**. Phase 1 D-17 split the deployment into separate `api` and `worker` systemd units — they are two processes. An in-process hub cannot cross that boundary. Redis pub/sub is mandatory given the two-process split. |
| Redis pub/sub | Worker writes job state to DB; API polls DB for WebSocket fan-out | Works, but adds DB read load proportional to connected clients × poll rate and adds latency. Pub/sub is push, near-zero latency, and Redis is already present. Use pub/sub; the DB row remains the durable source of truth (events are fire-and-forget). |
| Embedded `redis-server` as a 4th systemd unit | Bundle a Redis binary inside the app / run Redis as an arq subprocess | Debian ships `redis-server` in `main` with a proper systemd unit. Bundling re-implements packaging that apt already does. **4th systemd unit is the clear winner.** |
| `redis-server` | `valkey` (Redis fork) | Debian 12 ships `redis-server` directly; valkey is the Debian 13+ path. Stick with `redis-server` for the Debian-12 target (D-16). |

**Installation:**
```bash
# backend/pyproject.toml — add to dependencies:
#   "arq==0.26.3",
#   "redis[hiredis]==5.3.1",
# (proxmoxer, pybreaker already present)
cd backend && pip install -e .

# In the LXC (deploy/lxc/bootstrap.sh Step 1 — add to apt-get install):
apt-get install -y -qq redis-server
```

**Version verification performed:**
- `arq` — latest 0.28.0 (2026-04-16); recommended pin **0.26.3** (Context7-indexed, stable docs). `[VERIFIED: pypi.org/pypi/arq/json]`
- `redis` (py) — latest 7.4.0, but arq caps `<6`; newest in-range is **5.3.1**. `[VERIFIED: pypi.org/pypi/redis/json + arq requires_dist]`
- `redis-server` (Debian 12) — `5:7.0.15-1~deb12u6` in `main`. `[VERIFIED: packages.debian.org/bookworm/redis-server]`
- `proxmoxer` — 2.3.0 is latest AND the installed version. `[VERIFIED: pypi.org/pypi/proxmoxer/json + backend/pyproject.toml]`

## Architecture Patterns

### Recommended Project Structure

New backend modules (CONTEXT §Integration Points names `backend/app/jobs/` and `backend/app/lifecycle/`):

```
backend/app/
├── jobs/
│   ├── __init__.py
│   ├── worker.py          # arq WorkerSettings + on_startup/on_shutdown hooks
│   ├── functions.py       # one async job function per kind (vm_power, vm_snapshot_create, ...)
│   ├── enqueue.py         # FastAPI-side helper: insert jobs row + arq enqueue_job + return 202
│   ├── poller.py          # UPID polling loop (adaptive cadence, first-response-authoritative)
│   ├── reaper.py          # orphan reaper — on_startup scan of non-terminal jobs
│   ├── events.py          # Redis pub/sub publish (worker) + subscribe (API)
│   ├── routes.py          # GET /jobs (list, team-scoped), GET /jobs/{id}, POST /jobs/{id}/retry
│   ├── ws.py              # @router.websocket("/ws/jobs") — Tasks drawer live stream
│   ├── service.py         # job-row CRUD, state transitions, batch grouping
│   └── schemas.py         # JobResponse, JobListResponse pydantic models
├── lifecycle/
│   ├── __init__.py
│   ├── routes.py          # all mutating endpoints — power/snapshot/backup/resize/clone/migrate
│   ├── power.py           # power-action service (start/stop/reboot/shutdown/delete)
│   ├── snapshots.py       # snapshot create/rollback/delete + tree builder
│   ├── backups.py         # vzdump trigger, backup-file list, restore, schedule CRUD
│   ├── resize.py          # CPU/RAM/disk resize + hotplug detection
│   ├── clone.py           # clone + template conversion + VMID reservation
│   ├── migrate.py         # migrate + snippet pre-flight + quorum check
│   ├── errors.py          # curated PVE-error → friendly-message map (D-13)
│   └── schemas.py         # request/response pydantic models per operation
└── clusters/
    └── connector.py       # EXTEND — add lifecycle mutating calls + task_status/task_log
```

**`PVEConnector` extension** — Phase 3 adds methods to the existing class (do NOT make a new client). New methods route through `_call_with_breaker` (inherits the circuit breaker). New methods needed:
`vm_power(node, vmid, is_lxc, action)`, `vm_delete(node, vmid, is_lxc)`, `task_status(node, upid)`, `task_log(node, upid, limit)`, `snapshot_list/create/rollback/delete`, `vzdump(node, vmid, storage, ...)`, `restore(node, vmid, archive, ...)`, `resize_disk(node, vmid, disk, size)`, `clone(node, vmid, newid, ...)`, `to_template(node, vmid)`, `migrate(node, vmid, target, online, bwlimit)`, `cluster_status()` (quorum), `cluster_nextid()`, `node_storages(node, content)`, `unlock(node, vmid, is_lxc)`.

### Pattern 1: arq Worker — `WorkerSettings` shape

**What:** arq's worker is configured by a class (conventionally `WorkerSettings`) whose attributes the `arq` CLI reads. Job functions are plain `async def` coroutines whose **first parameter is `ctx`** (a dict arq passes in, holding the redis pool and anything set in `on_startup`).

**When to use:** This is the worker entry point. `deploy/systemd/proxmox-gui-worker.service` ExecStart becomes `arq app.jobs.worker.WorkerSettings`.

```python
# backend/app/jobs/worker.py
# Source: https://arq-docs.helpmanual.io/ (verified via context7 /websites/arq-docs_helpmanual_io)
from arq.connections import RedisSettings
from arq import func, cron

from app.jobs.functions import (
    run_power_action, run_snapshot_create, run_snapshot_rollback,
    run_snapshot_delete, run_backup, run_restore, run_resize,
    run_clone, run_template_convert, run_migrate,
)
from app.jobs.reaper import reap_orphans
from app.jobs.backups_cron import fire_due_scheduled_backups

async def on_startup(ctx: dict) -> None:
    # ctx already carries ctx['redis'] (the arq pool). Open the app DB engine,
    # install the cipher (worker process needs it to decrypt cluster tokens),
    # build the PVEConnectorRegistry, then run the orphan reaper.
    ...                                  # see Pattern 3
    await reap_orphans(ctx)              # LIFE-14 — on every boot, no exceptions

async def on_shutdown(ctx: dict) -> None:
    await ctx['engine'].dispose()

class WorkerSettings:
    functions = [
        # func() wraps a coroutine to configure per-job retry/timeout.
        # max_tries=1 => arq does NOT auto-retry. Phase-3 retry is USER-driven
        # (D-16) — a fresh job is enqueued; arq must not silently re-run.
        func(run_power_action,      name='vm.power',            max_tries=1, timeout=120),
        func(run_snapshot_create,   name='vm.snapshot.create',  max_tries=1, timeout=600),
        func(run_snapshot_rollback, name='vm.snapshot.rollback',max_tries=1, timeout=900),
        func(run_snapshot_delete,   name='vm.snapshot.delete',  max_tries=1, timeout=300),
        func(run_backup,            name='vm.backup',           max_tries=1, timeout=14400),
        func(run_restore,           name='vm.restore',          max_tries=1, timeout=14400),
        func(run_resize,            name='vm.resize',           max_tries=1, timeout=120),
        func(run_clone,             name='vm.clone',            max_tries=1, timeout=14400),
        func(run_template_convert,  name='vm.template',         max_tries=1, timeout=300),
        func(run_migrate,           name='vm.migrate',          max_tries=1, timeout=14400),
    ]
    cron_jobs = [
        # Check the schedule table every 5 min; fire vzdump jobs that are due.
        cron(fire_due_scheduled_backups, minute=set(range(0, 60, 5))),
    ]
    on_startup = on_startup
    on_shutdown = on_shutdown
    redis_settings = RedisSettings(host='127.0.0.1', port=6379, database=0)
    max_jobs = 6              # concurrency cap — see Pattern note below
    job_timeout = 14400       # 4h ceiling; per-func timeout overrides
    keep_result = 3600        # arq's own result key TTL (we use the DB row as truth)
    health_check_interval = 30
```

**Concurrency knob (`max_jobs`):** `max_jobs=6` matches the ARCHITECTURE.md "worker pool size 4–8" guidance for the 5-cluster scale tier. Each job spends most of its life in an `asyncio.sleep` between UPID polls, so 6 concurrent jobs is conservative and the `asyncio.to_thread` pool inside `PVEConnector` (Python default `min(32, cpu+4)`) comfortably absorbs it. `[ASSUMED]` 6 is adequate — see Assumptions A2.

**`max_tries=1` is deliberate.** arq's automatic retry would silently re-run a job after a transient failure — for a non-idempotent op like `clone` that means a duplicate VM (Pitfall 12 warning sign). Phase-3 retry is **user-initiated** (D-16): the retry button enqueues a *new* job reusing the failed job's identity. Setting `max_tries=1` disables arq's own retry. The worker's job function catches `PVEUnreachable`/`PVEAPIError` itself and marks the job `failed` — it never lets arq see the exception.

### Pattern 2: Enqueue helper — the 202-Accepted contract

**What:** Every mutating lifecycle route calls one shared helper that (1) computes the idempotency key, (2) inserts the `jobs` row in `pending`, (3) enqueues the arq job, (4) returns `202`.

**When to use:** Every POST/PUT/DELETE in `app/lifecycle/routes.py` (API-04, CLAUDE.md constraint).

```python
# backend/app/jobs/enqueue.py  (sketch — pattern, not literal)
import hashlib, json
from sqlalchemy.exc import IntegrityError

async def enqueue_job(
    db, arq_pool, *, kind: str, cluster_id: int, team_id: int,
    actor_user_id: int, payload: dict, batch_id: str | None = None,
) -> Job:
    # Pitfall 12: idempotency_key = hash(method+path+actor+body). The UNIQUE
    # constraint on jobs.idempotency_key makes a double-submit collide loudly.
    raw = json.dumps({'kind': kind, 'actor': actor_user_id, 'payload': payload},
                      sort_keys=True)
    idem = hashlib.sha256(raw.encode()).hexdigest()[:128]

    job = Job(kind=kind, cluster_id=cluster_id, team_id=team_id,
              actor_user_id=actor_user_id, payload=json.dumps(payload),
              idempotency_key=idem, state='pending', batch_id=batch_id)
    db.add(job)
    try:
        await db.flush()                 # surfaces the UNIQUE collision now
    except IntegrityError:
        await db.rollback()
        existing = await find_job_by_idempotency_key(db, idem)
        return existing                  # return the in-flight job, not a new one
    await db.commit()                    # COMMIT before enqueue — see note

    # arq job id == our DB job id, so the worker can SELECT the row immediately.
    await arq_pool.enqueue_job(kind, job.id, _job_id=f'job-{job.id}')
    return job
```

**Commit-before-enqueue ordering is critical.** If the worker picks up the job before the API process commits the row, the worker's `SELECT` finds nothing. Commit the `jobs` row first, then enqueue. The arq enqueue is the last step; if it fails, the orphan reaper picks the row up (it scans for `pending` rows with no progress — see Pattern 3 edge cases). This mirrors the project's established "service layer commits before raising HTTPException" pattern (Plan 01-05).

**arq pool on the API side:** the API process needs an `arq` redis pool to call `enqueue_job`. Create it once in `lifespan` via `arq.create_pool(RedisSettings(...))`, store on `app.state.arq_pool`, close on shutdown. This is separate from the worker's pool — both point at the same Redis.

### Pattern 3: UPID polling — first response authoritative (Pitfall 2)

**What:** The worker dispatches the mutating call, gets a UPID back, **persists it to the `jobs` row before polling**, then polls `/nodes/{node}/tasks/{upid}/status` on an adaptive cadence until the task is terminal.

**The non-negotiable ordering (Pitfall 12):** UPID → DB → poll. Never poll-then-persist.

```python
# backend/app/jobs/poller.py  (pattern)
async def dispatch_and_poll(ctx, job, connector, dispatch_fn):
    # 1. Dispatch the mutating call. proxmoxer returns the UPID string.
    upid = await dispatch_fn()                       # e.g. connector.vm_power(...)
    node = proxmoxer.tools.Tasks.decode_upid(upid)['node']

    # 2. PERSIST BEFORE POLLING (Pitfall 12). If the worker dies here, the
    #    reaper finds upid populated and re-attaches.
    await update_job(ctx, job.id, upid=upid, upid_node=node,
                     state='running', started_at=utcnow())
    await publish_event(ctx, 'job.running', job.id)

    # 3. Poll. FIRST response is authoritative (Pitfall 2): fast ops
    #    (start/stop/snapshot-delete) are already 'stopped' on poll #1.
    delay = 0.5
    while True:
        status = await connector.task_status(node=node, upid=upid)
        if status['status'] == 'stopped':            # terminal — do NOT wait
            ok = status.get('exitstatus') == 'OK'
            log_tail = await connector.task_log(node=node, upid=upid, limit=200)
            if ok:
                await finish_job(ctx, job.id, state='succeeded', log=log_tail)
            else:
                friendly = map_pve_error(status.get('exitstatus'), log_tail)
                await finish_job(ctx, job.id, state='failed',
                                 error=status.get('exitstatus'),
                                 friendly=friendly, log=log_tail)
            await publish_event(ctx, 'job.completed', job.id)
            return
        await publish_event(ctx, 'job.progress', job.id)
        await asyncio.sleep(delay)
        delay = min(delay * 1.6, 30.0)               # 0.5→0.8→1.3→...→cap 30s
```

**`exitstatus` semantics:** `/tasks/{upid}/status` returns `{"status": "running"|"stopped", "exitstatus": "<string>"}`. `exitstatus` is **present only when `status == "stopped"`**. `exitstatus == "OK"` means success; anything else (`"WARNINGS: N"`, an error string, a non-zero-code message) means failure. Treat the exact string `"OK"` as the only success value. `[CITED: proxmoxer.github.io/docs/2.0/tools/tasks/ — example shows `'exitstatus': 'OK'`]` `[ASSUMED]` that `"WARNINGS: N"` should be treated as failure-with-warnings — backup jobs in particular can finish "OK" or with warnings; the planner should decide whether `WARNINGS:` is a soft-success. Recommended: surface it as `succeeded` with the warning text shown, since the backup file exists. See Assumptions A3.

**Adaptive cadence:** start at 500ms, multiply by ~1.6 each poll, cap at 30s. This satisfies the CONTEXT discretion item ("tight cadence first ~10s, exponential backoff, cap ~30s") and the Pitfall performance table ("exponential backoff after first 10s; cap at 30s"). The geometric `0.5 → 0.8 → 1.3 → 2.1 → 3.4 → 5.5 → 8.8 → 14 → 22 → 30` reaches the cap around the 9th poll (~30s elapsed).

**proxmoxer's `Tasks.blocking_status` is NOT used.** It is a blocking poll loop — fine for scripts, wrong here. The worker needs an `async` loop that publishes progress events between polls. Use `Tasks.decode_upid` (UPID parsing — handles the trailing `user@realm` correctly so we don't split on `:` naively, per Pitfall 2 point 5) and `Tasks.decode_log` (joins the JSON log array into a string for the "Show technical details" panel). `[CITED: proxmoxer docs — decode_upid returns {upid,node,pid,pstart,starttime,type,id,user,comment}]`

### Pattern 4: Orphan Reaper on boot (Pattern 3 from ARCHITECTURE.md, LIFE-14)

**What:** In the worker's `on_startup` hook, scan the `jobs` table for rows in non-terminal states (`pending`, `claimed`, `running`) and reconcile each against Proxmox.

```python
# backend/app/jobs/reaper.py  (pattern)
async def reap_orphans(ctx):
    rows = await select_jobs(ctx, states=['pending', 'claimed', 'running'])
    reattached = []
    for job in rows:
        if job.upid:
            # Has a UPID → the PVE call WAS issued. Poll once.
            connector = await registry.get_for_team(
                cluster_id=job.cluster_id, team_id=job.team_id)
            try:
                status = await connector.task_status(node=job.upid_node, upid=job.upid)
            except PVEAPIError as e:
                if e.status_code == 404:
                    # UPID aged out of PVE's task-log window → outcome unknown.
                    await update_job(ctx, job.id, state='needs_review',
                        error='UPID no longer known to Proxmox after restart')
                    continue
                raise
            if status['status'] == 'stopped':
                ok = status.get('exitstatus') == 'OK'
                await finish_job(ctx, job.id,
                                 state='succeeded' if ok else 'failed', ...)
            else:
                # Still running — re-enqueue a re-attach poll job for it.
                await arq_pool.enqueue_job('job.reattach', job.id)
                await update_job(ctx, job.id, state='orphaned')  # transient marker
                reattached.append(job.id)
        else:
            # No UPID. The PVE call may or may not have fired.
            # claimed/running with no UPID → state unknown → needs_review.
            # pending with no UPID → safe to re-enqueue (call never started).
            if job.state == 'pending':
                await arq_pool.enqueue_job(job.kind, job.id, _job_id=f'job-{job.id}')
            else:
                await update_job(ctx, job.id, state='needs_review',
                    error='Worker died before Proxmox returned a UPID; '
                          'outcome unknown')
    if reattached:
        await publish_event(ctx, 'reaper.reattached', {'job_ids': reattached})
```

**Edge cases (each must be handled):**
1. **`upid` set, task still running** — re-attach: enqueue a poll-only job, mark `orphaned` transiently then `running` once the poll job picks it up. The UI shows the `RefreshCw` "re-attached" badge (UI-SPEC) and the toast "Resumed tracking N task(s)".
2. **`upid` set, task already `stopped`** — resolve directly to `succeeded`/`failed` without re-dispatching.
3. **`upid` set, PVE returns 404** — UPID aged out of Proxmox's task-log retention window (Pitfall 2 point 4: "after the task-log retention window the UPID becomes unfetchable"). Outcome genuinely unknown → `needs_review`.
4. **No `upid`, state `pending`** — the PVE call never fired; safe to re-enqueue normally (idempotency_key already prevents a double if the API also retried).
5. **No `upid`, state `claimed`/`running`** — the worker died between claim and UPID-receipt; we cannot know if the side effect happened → `needs_review` (ARCHITECTURE.md Pattern 3 trade-off: "Jobs that crashed before dispatching cannot be safely retried"). This is exactly why `clone`/`migrate`/`delete`/`restore` are NOT auto-retried (D-16).

**`needs_review` and `orphaned` surface in the Tasks drawer** with `TriangleAlert`/`CircleSlash` icons (UI-SPEC §Color). The orphan-reaper admin surface for `needs_review` jobs is a Claude's-discretion item — recommend a simple filtered view on the global jobs list (`?state=needs_review`), no separate page in v1.

### Pattern 5: WebSocket fan-out via Redis pub/sub

**What:** The worker publishes a small JSON event to a Redis pub/sub channel on every job-state change. The API process runs one Redis subscriber that fans events out to connected Tasks-drawer WebSockets.

**Why pub/sub and not a DB poll:** the worker and API are separate processes (D-17). Redis is the only shared channel. Events are push (near-zero latency, no DB load); the `jobs` row remains the durable source of truth.

```python
# backend/app/jobs/events.py  (pattern)

# --- worker side: publish ---
async def publish_event(ctx, event_type: str, job_id: int):
    job = await get_job(ctx, job_id)
    payload = json.dumps({
        'type': event_type, 'job': serialize_job(job),  # full row snapshot
    })
    await ctx['redis'].publish('jobs:events', payload)

# --- API side: one subscriber task, started in lifespan ---
async def jobs_event_pump(app):
    redis = await arq.create_pool(RedisSettings(host='127.0.0.1'))
    pubsub = redis.pubsub()
    await pubsub.subscribe('jobs:events')
    async for message in pubsub.listen():
        if message['type'] != 'message':
            continue
        event = json.loads(message['data'])
        # fan out to every connected socket whose user is on the job's team (D-01)
        await CONNECTION_MANAGER.broadcast(event)
```

```python
# backend/app/jobs/ws.py  (pattern)
@router.websocket('/ws/jobs')
async def jobs_ws(websocket: WebSocket):
    user = await authenticate_ws(websocket)        # cookie session — see note
    if user is None:
        await websocket.close(code=1008)
        return
    team_ids = await team_ids_for_user(user.id)    # D-01: team-wide scope
    await websocket.accept()
    # Backfill: replay the recent window so a reconnecting drawer reconciles.
    recent = await list_recent_jobs(team_ids, limit=50)   # UI-SPEC reconnect contract
    await websocket.send_json({'type': 'backfill', 'jobs': recent})
    CONNECTION_MANAGER.add(websocket, team_ids)
    try:
        while True:
            await websocket.receive_text()         # keepalive / client pings
    except WebSocketDisconnect:
        CONNECTION_MANAGER.remove(websocket)
```

**Authorization re-check on every push (Pitfall — "WebSocket auth-check only on connect"):** the `CONNECTION_MANAGER.broadcast` must filter each event by the socket's `team_ids` so a job for team B never reaches a socket subscribed for team A only. D-01 scopes the drawer team-wide, so the filter is "does the job's `team_id` intersect this socket's `team_ids`". Re-evaluate on every event, not just at subscribe.

**WebSocket auth:** the browser sends its session cookie on the WS upgrade (same-origin via Caddy). Reuse the existing cookie-session principal resolution. Note Caddy must forward `Upgrade`/`Connection` headers — verify the Caddyfile already passes WebSocket upgrades to the API upstream (Phase 1 Caddyfile reverse-proxies `/api/*`; the `/api/v1/ws/jobs` path is under `/api/*` so it should already route — confirm `proxy` directive does not strip upgrade headers; Caddy's `reverse_proxy` handles WebSockets transparently by default).

**Reconnection/backfill (Claude's discretion — pinned by UI-SPEC):** on reconnect the server replays the last-50 / last-1h window; the client reconciles by `job.id` (no duplicate rows). The `backfill` message type above delivers this. While disconnected the drawer keeps elapsed timers ticking client-side from `created_at`.

### Anti-Patterns to Avoid

- **Polling the UPID inside the HTTP handler** — Anti-Pattern 2. The API process returns 202 and is done; the worker polls. No exceptions.
- **Treating the first `stopped` status as "task never ran"** — Pitfall 2. Fast ops finish before poll #1. First response is authoritative.
- **Polling `/nodes/{node}/tasks/active`** — drops completed tasks. Always use `/tasks/{upid}/status` which works for the retention window after completion.
- **Splitting a UPID on `:`** — the trailing `user@realm` contains `@` and the format is positional. Use `Tasks.decode_upid`.
- **Scraping the vzdump log for a percentage** — Pitfall 13, D-04. Log formats are unstable across PVE versions. Use `exitstatus`; surface only structured `INFO:` lines.
- **Auto-retrying clone/migrate/delete on transient failure** — Pitfall 12. `max_tries=1`; user-driven retry only, idempotent kinds only (D-16).
- **An in-process event hub** — does not cross the api/worker process boundary. Use Redis pub/sub.
- **Exposing `skiplock`** — Pitfall 17, ROADMAP-locked. Never in the UI, never in a request schema.
- **Binding Redis to `0.0.0.0`** — the embedded Redis is LXC-local; bind `127.0.0.1` only (see Security Domain).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async job queue + worker pool | A `SELECT ... FOR UPDATE` claim loop on a SQLite table | `arq` + Redis | arq gives durable enqueue, concurrency cap, cron, job-id dedup, graceful shutdown — all the bits a hand-rolled loop gets subtly wrong (claim races, lost jobs on crash, no backpressure). |
| UPID string parsing | `upid.split(':')` | `proxmoxer.tools.Tasks.decode_upid` | The trailing `user@realm` field breaks naive splitting; the format is positional with optional fields (Pitfall 2 point 5). |
| Task-log assembly | Manual join of the JSON log array | `proxmoxer.tools.Tasks.decode_log` | Handles the `[{n, t}]` line-object shape and joins consistently. |
| Blocking "wait for task" in scripts/tests | A sleep-poll loop | `proxmoxer.tools.Tasks.blocking_status` | Fine for *test fixtures* asserting a task finished; NOT for the worker (which needs an async progress-publishing loop). |
| Circuit breaker on PVE calls | Failure-count bookkeeping | `pybreaker` via existing `_call_with_breaker` | Already wired in `PVEConnector`; lifecycle calls route through it for free. |
| WebSocket server | A raw socket server | FastAPI/Starlette `@router.websocket` | uvicorn[standard] bundles `websockets`; FastAPI handles the upgrade, framing, lifecycle. |
| Cron scheduling for backups | A `while True: sleep(60)` thread | arq `cron()` in `WorkerSettings.cron_jobs` | arq's cron handles missed-tick semantics and runs inside the worker's event loop. |
| Retry/backoff between UPID polls | ad-hoc | A geometric-backoff inline loop is fine here | This one IS fine to hand-roll — it's ~5 lines and domain-specific (see Pattern 3). Just don't hand-roll the *queue*. |

**Key insight:** the queue, the worker lifecycle, and UPID parsing are exactly the pieces where a hand-rolled version looks done but isn't — it loses jobs on crash, double-runs on race, mis-parses a UPID with an `@` in the user. arq + proxmoxer's `Tasks` helpers are mature; lean on them. The *adaptive poll cadence* and the *orphan reaper logic* are genuinely project-specific and are written by hand — but on top of those libraries, not instead of them.

## Runtime State Inventory

> Phase 3 is mostly greenfield (new modules), but it provisions a new runtime service (Redis) and re-wires a systemd unit — so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The `jobs` table already exists (Plan 01-02). Phase 3 likely adds a `batch_id` column (D-11 grouping) and possibly a `friendly_error` column + a new `backup_schedules` table. Existing rows: none in production (Phase 3 not yet run). | Alembic migration `0004_phase3` — additive columns + new table. Hand-written, explicitly-named constraints (project pattern). No data migration of existing `jobs` rows needed. |
| Live service config | A **new** Redis service runs in the LXC. Its config (`/etc/redis/redis.conf`) is NOT in git — it is the Debian package default, modified by bootstrap.sh to bind `127.0.0.1`. | bootstrap.sh must `apt-get install redis-server`, set `bind 127.0.0.1 -::1` + `protected-mode yes` (Debian default already does this), and `systemctl enable --now redis-server`. Document the config delta in `deploy/README.md`. |
| OS-registered state | `proxmox-gui-worker.service` is currently installed with a `sleep infinity` placeholder ExecStart. A **new** `proxmox-gui-redis.service` is NOT needed if the stock Debian `redis-server.service` is used directly. | (1) Rewrite `deploy/systemd/proxmox-gui-worker.service` ExecStart to `arq app.jobs.worker.WorkerSettings`, add `After=redis-server.service`, `Requires=redis-server.service`. (2) bootstrap.sh: uncomment `systemctl enable --now proxmox-gui-worker.service`. (3) Use Debian's stock `redis-server.service` — do NOT author a 4th custom unit; `apt` installs and enables it. The "4th systemd unit" is `redis-server.service` from the package. |
| Secrets/env vars | The worker process needs `PROXMOX_GUI_MASTER_KEY_PATH` and `PROXMOX_GUI_DATABASE_URL` to decrypt cluster tokens — the worker unit **already sets both** (verified in the shipped unit file). No new secret. Redis runs auth-less on loopback (acceptable — see Security Domain). | None for secrets. Verify the worker unit's `ReadWritePaths` still covers the DB path (it does: `/var/lib/proxmox-gui`). |
| Build artifacts / installed packages | Adding `arq` + `redis` to `backend/pyproject.toml` means the venv must be reinstalled. `backend/proxmox_gui.egg-info/` (or equivalent) goes stale after the dependency change. | bootstrap.sh already runs `pip install -e backend` on every non-marker run; the idempotent-exit branch only runs `alembic upgrade head` — so an *upgrade* to a Phase-3 build via the marker path will NOT pick up new pip deps. **Planner note:** the idempotent short-circuit in bootstrap.sh skips `pip install`. A Phase-3 deploy onto an existing install needs either a marker bump or a `pip install` in the idempotent branch. Flag for the deploy plan. |

**The canonical question — what runtime state survives a repo update?** After every file is updated: (1) Redis must be installed and running — a code update alone doesn't install it; bootstrap.sh must be re-run with the package step. (2) The worker unit must be re-installed and enabled — the old `sleep infinity` unit keeps running until `daemon-reload` + `restart`. (3) The venv must have `arq`/`redis` — the bootstrap idempotent-exit path skips `pip install`, so a Phase-3 upgrade via the marker is incomplete. All three are bootstrap.sh changes the deploy plan must own.

## Common Pitfalls

### Pitfall 1: UPID polling started after the task finished (Pitfall 2 from PITFALLS.md)
**What goes wrong:** Fast ops (start, stop, snapshot-delete, config-set) finish in <1s — before the worker's first poll. Naive code waiting for a `running→stopped` *transition* never sees one and reports a phantom failure or hangs.
**Why it happens:** Proxmox has no "queued" state; tasks go straight to `running` then `stopped`. The faster the cluster, the more often the race is lost.
**How to avoid:** Treat the **first** `/tasks/{upid}/status` response as authoritative. If `status == "stopped"` on poll #1, inspect `exitstatus` and finish immediately. (Pattern 3 above.)
**Warning signs:** UI stuck "in progress" but the VM state already changed in Proxmox; tests that pass slow and fail fast.

### Pitfall 2: Task state lost on app restart (Pitfall 12)
**What goes wrong:** The worker restarts mid-clone; the in-flight poll loop dies; the UI shows the job lost; the user retries → two clones.
**How to avoid:** Persist the UPID to the `jobs` row *before* polling (Pattern 3). On boot, the orphan reaper re-attaches (Pattern 4). The `idempotency_key` unique constraint blocks a duplicate enqueue.
**Warning signs:** Duplicate VMs after a deploy; "pending forever" jobs; the same action twice in the audit log.
**Verification (CONTEXT §Specifics):** kill-and-restart the worker during a clone; the operation must complete and the drawer must show the `RefreshCw` re-attach badge.

### Pitfall 3: vzdump log scraping breaks across PVE versions (Pitfall 13)
**What goes wrong:** Parsing the backup log for `Backup job finished successfully` or a `%` figure breaks when PVE changes the log format.
**How to avoid:** D-04 — use `exitstatus`, never scrape. For richer display, surface only structured `INFO: <key>: <value>` lines and tolerate missing keys.
**Warning signs:** Backup jobs flip between success/failure display after a PVE upgrade.

### Pitfall 4: `/cluster/nextid` VMID race on clone (Pitfall 1)
**What goes wrong:** Two clone wizards both call `/cluster/nextid`, both get the same ID, one clone fails "VM already exists".
**How to avoid:** App-level reservation. Maintain an in-DB "reserved VMID" set (or a per-cluster lock) valid ~60s; on a `clone` create error matching "already exists", retry with the next ID (bounded 5 tries). The VMID field is user-overridable (CONTEXT clone discretion). See Open Question Q2.
**Warning signs:** "VMID already exists" under concurrent clones.

### Pitfall 5: Migration breaks node-local snippet references (Pitfall 20)
**What goes wrong:** A VM with `cicustom=user=local:snippets/foo.yaml` migrates; `local` is per-node; the snippet is missing on the target; the VM won't boot its cloud-init.
**How to avoid:** Migration **pre-flight** (before enqueue): read the VM config; if `cicustom` references a storage that is node-local (not NFS/CephF/shared), refuse with the friendly error. The hook lives in Phase 3 even though snippets are *written* in Phase 4 (ROADMAP locked note). See §Migrate.
**Warning signs:** Migrated VMs lose SSH access / cloud-init config.

### Pitfall 6: Cluster quorum loss makes writes inconsistent (Pitfall 18)
**What goes wrong:** A cluster loses quorum; `pmxcfs` goes read-only; write attempts fail or apply inconsistently.
**How to avoid:** Pre-flight every *write* with `GET /cluster/status` → check `quorate == 1`. If not quorate, reject the enqueue with the friendly "cluster lost quorum" error (D-13 map row). Block at the API layer, not just the UI.
**Warning signs:** "cluster not ready - no quorum?" in task logs after a node outage.

### Pitfall 7: `skiplock` is root-only — locked VMs (Pitfall 17)
**What goes wrong:** A VM is locked (mid-backup, mid-migration, or a stale lock); a delete/stop fails; code is tempted to retry with `skiplock`.
**How to avoid:** Never expose or send `skiplock` — it is `root@pam`-only and the GUI uses privsep tokens. Detect the locked-VM error, show the curated friendly message. See Open Question Q1 for whether the GUI can offer a working plain "Unlock".
**Warning signs:** "can't lock file" / "VM is locked" errors.

### Pitfall 8: Quota TOCTOU on clone / restore-as-new (Pitfall 6)
**What goes wrong:** Two clone forms submitted together both pass the quota check, the user overshoots quota.
**How to avoid:** Clone and restore-as-new *create* resources → they go through the Phase 2 quota admission path (DB row-lock around check + a pending-consumption row) **before** the job is enqueued. Power/snapshot/resize-down/backup do not create new VMs and skip this. Resize *up* must re-check quota.
**Warning signs:** Team over quota after concurrent clones.

### Pitfall 9: WebSocket authorization checked only at connect
**What goes wrong:** A long-lived drawer socket keeps receiving job events for a team the user was removed from.
**How to avoid:** Re-filter every pub/sub event against the socket's current `team_ids` on every push (Pattern 5). D-01 scopes team-wide; the filter is the job's `team_id` ∩ socket's teams.

### Pitfall 10: bootstrap.sh idempotent path skips `pip install`
**What goes wrong:** Deploying a Phase-3 build onto an existing install hits the `.installed` marker short-circuit, which only runs `alembic upgrade head` — the venv never gets `arq`/`redis`, the worker unit crashes on import.
**How to avoid:** The deploy plan must either bump/relocate the marker or add a `pip install -e backend` step to the idempotent branch. Documented in Runtime State Inventory.

## Code Examples

### Power action — proxmoxer call (verified shape against existing connector)
```python
# backend/app/clusters/connector.py — NEW method, routes through _call_with_breaker
async def vm_power(self, *, node: str, vmid: int, is_lxc: bool, action: str) -> str:
    """POST /nodes/{node}/{qemu|lxc}/{vmid}/status/{action}.
    action ∈ {start, stop, reboot, shutdown}. Returns the UPID string.
    'stop' is hard/force; 'shutdown' is graceful ACPI. Both return a UPID.
    """
    base = (self._client.nodes(node).lxc(vmid) if is_lxc
            else self._client.nodes(node).qemu(vmid))
    fn = getattr(base.status, action).post
    upid = await self._call_with_breaker(fn)
    self._resource_cache.snapshot = None     # invalidate so next list shows new state
    return upid
```
`[VERIFIED: matches the chained-attribute pattern in the shipped connector — `self._client.nodes(node).qemu(vmid).status.current.get`]`

### UPID status + log polling
```python
async def task_status(self, *, node: str, upid: str) -> dict:
    """GET /nodes/{node}/tasks/{upid}/status -> {status, exitstatus?, ...}."""
    fn = self._client.nodes(node).tasks(upid).status.get
    return await self._call_with_breaker(fn)

async def task_log(self, *, node: str, upid: str, limit: int = 200) -> str:
    """GET /nodes/{node}/tasks/{upid}/log -> joined plain text."""
    from proxmoxer.tools import Tasks
    fn = self._client.nodes(node).tasks(upid).log.get
    raw = await self._call_with_breaker(fn, limit=limit)
    return Tasks.decode_log(raw)
```
`[CITED: proxmoxer.github.io/docs/2.0/tools/tasks/ — Tasks.decode_log joins the JSON log array]`

### Snapshot tree — flat list with parent pointers
```python
async def snapshot_list(self, *, node, vmid, is_lxc) -> list[dict]:
    """GET /nodes/{node}/{qemu|lxc}/{vmid}/snapshot.
    Each item: {name, parent?, snaptime?, description?, vmstate?}.
    The synthetic 'current' item marks the live state. Build the tree
    client-side from the `parent` field (D-05 — recursive Svelte component).
    """
    base = (self._client.nodes(node).lxc(vmid) if is_lxc
            else self._client.nodes(node).qemu(vmid))
    return await self._call_with_breaker(base.snapshot.get)
```
`[ASSUMED: the `snapshot` GET returns `parent` and a `current` pseudo-entry — standard PVE behavior, but verify field names against a live PVE 8/9 during execution. See Assumptions A4.]`

## Proxmox Call Reference (per lifecycle operation)

Every call below executes through the **per-team privsep connector** (`registry.get_for_team`), never the bootstrap admin token. "UPID" = the call returns a task UPID and must go through the poll loop. "Sync" = synchronous config write, returns immediately (no UPID).

| Operation | proxmoxer call (chained) | Returns | Notes |
|-----------|--------------------------|---------|-------|
| Start | `nodes(n).qemu(id).status.start.post()` / `.lxc(id)` | **UPID** | Fast — often `stopped` on poll #1. |
| Stop (hard / force) | `...status.stop.post()` | **UPID** | This is force-stop. |
| Shutdown (graceful) | `...status.shutdown.post()` | **UPID** | ACPI; can hang if guest ignores it — that's why Force-Stop escalation exists. |
| Reboot | `...status.reboot.post()` | **UPID** | |
| Delete | `nodes(n).qemu(id).delete()` / `.lxc(id)` | **UPID** | Add `purge=1` to also drop the VM from backup/replication jobs (recommend). NEVER pass `skiplock`. |
| Snapshot create | `...snapshot.post(snapname=, description=, vmstate=)` | **UPID** | `vmstate=1` includes RAM (qemu only; CONTEXT snapshot discretion toggle). |
| Snapshot rollback | `...snapshot(name).rollback.post()` | **UPID** | Destructive (D-10 typed-name). |
| Snapshot delete | `...snapshot(name).delete()` | **UPID** | Idempotent → retry-eligible (D-16). |
| Snapshot list/tree | `...snapshot.get()` | Sync (list) | Build tree from `parent`. |
| Backup (vzdump) | `nodes(n).vzdump.post(vmid=, storage=, mode=, compress=, notes_template=)` | **UPID** | PBS is just a `storage=` whose type is `pbs`. `mode` ∈ snapshot/suspend/stop. See §Backup. |
| Restore | `nodes(n).qemu.post(vmid=, archive=, ...)` / `.lxc.post(vmid=, ostemplate=archive, ...)` | **UPID** | qmrestore/pct-restore equivalent — see §Restore. `force=1` for in-place overwrite. |
| Resize CPU/RAM | `nodes(n).qemu(id).config.put(cores=, memory=)` | **Sync** | Config write, no UPID. Hotplug decides reboot-required — see §Resize. |
| Resize disk (grow) | `nodes(n).qemu(id).resize.put(disk=, size='+10G')` | **Sync** (mostly) | `size` is a delta (`+10G`) or absolute. Shrink rejected app-side. |
| Clone | `nodes(n).qemu(id).clone.post(newid=, name=, full=, target=, storage=)` | **UPID** | `full=0` linked, `full=1` full. See §Clone. |
| Convert to template | `nodes(n).qemu(id).template.post()` | **UPID** (qemu) | One-way. LXC templates differ — see §Template. |
| Migrate | `nodes(n).qemu(id).migrate.post(target=, online=, bwlimit=)` | **UPID** | `online=1` live, `online=0` offline. `bwlimit` in KiB/s. See §Migrate. |
| Cluster quorum | `cluster.status.get()` | Sync | Find the `type=='cluster'` item, check `quorate`. |
| Next free VMID | `cluster.nextid.get()` | Sync (int) | Pitfall 1 — not atomic. |
| Node storages | `nodes(n).storage.get(content='backup')` | Sync (list) | For the backup-storage admin picker (D-08) and restore-archive listing. |
| Storage content (backups) | `nodes(n).storage(sid).content.get(content='backup', vmid=)` | Sync (list) | Lists backup files for a VM (Backups tab, restore picker). |
| Unlock | see Open Question Q1 | — | `config.put(lock='')` may work for non-`skiplock` locks via the privsep token; needs live confirmation. |

### Resize (LIFE-08, LIFE-09)
CPU/RAM resize is a **synchronous** `config.put(cores=N, memory=MB)` — no UPID, no job poll loop needed (but for consistency still flows through a `vm.resize` job so it appears in the drawer; the job function just does the sync write and marks `succeeded`).

**Hotplug detection for the reboot-required warning (D-12):** read the VM config (`config.get()`); the `hotplug` field is a comma-list, e.g. `hotplug: network,disk,usb` or `hotplug: 1` (all) or `hotplug: 0` (none). CPU hotplug requires `cpu` in the list; memory hotplug requires `memory`. If `cpu` is absent, a `cores` change needs a reboot → show the inline warning. If `memory` absent, a `memory` change needs a reboot. `[ASSUMED: the exact hotplug token names are `cpu`/`memory` — standard PVE, but the planner should confirm against `qm config` output. Memory hotplug also needs guest support; the GUI can only check the PVE-side flag. See Assumptions A5.]`

**Disk grow:** `resize.put(disk='scsi0', size='+8G')`. The `+` makes it a delta. **Shrink is blocked app-side** (LIFE-09) — never send a smaller size; the UI enforces `min = current` and the service rejects it with the friendly "disks can only grow" message. Online grow works for running VMs with most controllers; the job is mostly synchronous.

### Backup (LIFE-05) and Scheduled Backups (LIFE-06)
**Manual backup:** `nodes(n).vzdump.post(vmid=<id>, storage=<admin-preset>, mode='snapshot', compress='zstd')`. Returns a UPID; the job polls it. The admin-preset storage (D-08) is read from a new per-cluster admin config field. PBS targets are storages of type `pbs` — the same `vzdump` call, the storage just happens to be PBS-backed; no separate PBS API.

**Scheduled backups (LIFE-06) — recommendation:** there are two paths.
1. **PVE-native `/cluster/backup` jobs API** — create a backup job in Proxmox itself; PVE's own scheduler runs it. Pro: survives even if the GUI is down. Con: PVE's job model (vzdump.conf, calendar events) is richer than D-08's "keep last N" and harder to map cleanly; retention via PVE's prune is the *deferred* full-prune feature.
2. **App-side arq cron** — a `backup_schedules` table (vmid, cluster, frequency, keep_last); an arq `cron` job every 5 min fires due `vm.backup` jobs; retention ("keep last N") is enforced app-side by listing backup files and deleting the oldest beyond N.

**Recommendation: app-side arq cron (path 2).** It matches D-08's simple "keep last N" exactly, keeps retention logic in one testable place, and the worker already exists. PVE-native jobs would duplicate scheduling state outside the app DB (a Runtime-State-Inventory smell — config living in PVE not git). The "keep last N" deletion: after a scheduled backup finishes, list `storage(sid).content.get(content='backup', vmid=id)`, sort by `ctime`, delete files beyond index N via `storage(sid).content(volid).delete()`. `[ASSUMED: per-VM backup files are enumerable and individually deletable via the storage content API — standard PVE, confirm volid format during execution. Assumptions A6.]`

### Restore (LIFE-07)
Restore is "create a VM/LXC from an archive". For qemu: `nodes(n).qemu.post(vmid=<target>, archive=<volid>, ...)`; for LXC: `nodes(n).lxc.post(vmid=<target>, ostemplate=<archive volid>, restore=1, ...)`. Returns a UPID.
- **In-place overwrite (D-07 default):** `force=1` + the *same* vmid → overwrites. Data-loss op → typed-name confirm (D-10).
- **Restore-as-new:** a fresh vmid (allocated like clone, Pitfall 1) → counts against quota → goes through admission control.

### Clone (LIFE-10)
`nodes(n).qemu(id).clone.post(newid=, name=, full=<0|1>, target=<node>, storage=)`. Returns a UPID. `full=0` = linked clone (fast, shares base disk, source must usually be a template or have a snapshot); `full=1` = full clone (independent, slow). `newid` from `/cluster/nextid` + app reservation (Pitfall 1), user-overridable (CONTEXT discretion). Clone creates a resource → quota admission applies. **Non-idempotent → no retry button (D-16).**

### Template conversion (LIFE-10)
qemu: `nodes(n).qemu(id).template.post()` — converts the VM to a template (one-way; UI-SPEC warning-tinted confirm). LXC: container templates work differently (LXC "templates" are vztmpl files, not converted-in-place containers). **Scope note:** the success criteria say "convert a VM to a template" — treat template conversion as **qemu-only** in Phase 3; if the user opens it on an LXC, disable with an explanatory tooltip. `[ASSUMED — confirm the LXC template story is out of Phase-3 scope with the planner. Assumptions A7.]`

### Migrate (LIFE-11)
`nodes(n).qemu(id).migrate.post(target=<node>, online=<0|1>, bwlimit=<KiB/s>)`. Returns a UPID. `online=1` = live migration (VM stays running; requires shared storage or does a storage migration); `online=0` = offline. `bwlimit` caps migration bandwidth in **KiB/s** (`0` = unlimited) — the UI-SPEC says the field is labelled MB/s, so convert: `bwlimit_KiB = mb_per_s * 1024`. `[ASSUMED: bwlimit unit is KiB/s — this is the documented PVE unit for vzdump/migration bwlimit, but verify; the UI shows MB/s so the conversion must be explicit. Assumptions A8.]`

**Migration pre-flight (Pitfall 20, before enqueue):**
1. `cluster.status.get()` → quorum check (Pitfall 18).
2. `config.get()` → if `cicustom` references a node-local storage, refuse. Determining "node-local": the snippet volid is `<storage>:snippets/<file>`; check that `<storage>`'s type is shared (NFS/CephFS/CIFS) via `nodes(n).storage.get()` → the storage's `shared` flag. If `shared != 1` → refuse with the curated "node-local resource" message.

## PVE Error Surface — seed for the curated error map (D-13)

The curated map matches against the `exitstatus` string and the task-log tail. PVE error strings are not perfectly stable across 7.x/8.x/9.x, so **match on substrings, case-insensitive**, and always fall back to the raw message (D-13, never swallow). Seed entries (the UI-SPEC §Error Presentation locks the friendly copy — reproduce verbatim):

| PVE error substring (case-insensitive) | Friendly message |
|-----------------------------------------|------------------|
| `can't lock file`, `VM is locked`, `CT is locked`, `unable to acquire lock` | "VM is locked — unlock it from the detail page, then retry." |
| `not enough memory`, `would exceed`, `insufficient`, `no space left on device` (on a node) | "The target node doesn't have enough free CPU or memory. Pick another node." |
| `storage '...' does not exist`, `storage '...' is not online`, `unable to activate storage`, `storage is disabled` | "The storage for this operation isn't available right now. Check the cluster, then retry." |
| `cicustom`, `snippet`, `volume ... does not exist` (in a migrate context) | "This VM references a file that only exists on its current node. It can't be migrated until that's resolved." |
| `cluster not ready`, `no quorum`, `quorum` | "The Proxmox cluster has lost quorum — writes are paused until it recovers." |
| `no space left`, `storage full`, `not enough free space` (backup context) | "The backup storage is out of space. Free up space or reduce retention." |
| `unable to shrink`, `shrink`, `can't shrink disk` | "Disks can only grow. Shrinking is not supported by Proxmox." |
| `timeout`, `got timeout`, `connection timed out` | "Couldn't reach the Proxmox node in time. It may be busy — try again shortly." |
| `Permission check failed`, `403`, `no permission`, `only root` | "Your team's token can't perform this action on this resource. Contact an administrator." |
| `already exists`, `VM ... already exists` (clone/restore-as-new) | (clone-retry path handles this; if surfaced) raw message + retry from form |
| _(no match)_ | raw PVE message verbatim — **never** "operation failed" |

`[ASSUMED: the exact substrings above — they are drawn from common PVE error text seen across forum threads and the PITFALLS.md research, but PVE wording shifts between versions. The planner/executor should treat this as a *seed* and refine against real task-log output during execution. The match-on-substring + raw-fallback design (D-13) means an unmatched error is still shown correctly — it just isn't prettified. Assumptions A1.]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-process background-task polling (asyncio task in the API) | Separate worker process + Redis-backed durable queue | The moment D-17 split api/worker into two systemd units | An in-process hub/poller cannot survive an API restart or cross the process boundary — arq + Redis is mandatory, not optional. |
| `PVEVMUser` role grants write perms | PVE 9 narrowed `PVEVMUser` to read+power only; write perms moved to `PVEVMAdmin` | PVE 9 | Already handled — Phase 1 bootstrap grants `PVEVMAdmin` (noted in `connector.py` `set_pool_acl` docstring). Lifecycle writes execute as a `PVEVMAdmin`-scoped token. |
| arq 0.25/0.26 | arq 0.28.0 (2026-04-16) | 2026 | 0.28.0 is latest; **recommended pin is 0.26.3** for documentation stability. All 0.2x share `redis<6`. |
| redis-py 4/5 | redis-py 7.4 latest | 2025–26 | arq caps `redis<6`; pin **5.3.1**. |

**Deprecated/outdated:**
- Do not model the worker on `proxmoxer.tools.Tasks.blocking_status` — it blocks; use it only in test fixtures.
- Do not reuse the ARCHITECTURE.md "in-memory Live State Hub" design — it predates the two-process split; Redis pub/sub replaces it.

## Project Constraints (from CLAUDE.md)

The planner must verify every plan against these (CLAUDE.md authority = locked decision):

1. **Every mutating Proxmox call returns a UPID** → every HTTP write enqueues a job, returns `202`, the worker polls. No sync waiting on Proxmox in the request path. (Resize CPU/RAM is a *sync* config write with no UPID — it still flows through a job for drawer consistency, but the job completes without a poll loop.)
2. **Persist UPIDs before polling** (Pitfall 12) — Pattern 3 ordering is non-negotiable.
3. **Use per-tenant privilege-separated tokens** — all lifecycle calls go through `registry.get_for_team(cluster_id, team_id)`. Never the bootstrap admin token. Proxmox enforces ACLs natively.
4. **`asyncio.to_thread` for all proxmoxer I/O** — new connector methods route through `_call`/`_call_with_breaker` (which already bridge to a thread). CI greps `connector.py` for `asyncio.to_thread`.
5. **Multi-tenancy invariants** — `jobs.team_id` is set on every job; the Tasks drawer is team-scoped (D-01); WebSocket fan-out filters by team.
6. **Atomic commits per task** — conventional commit messages, one focused commit per task.
7. **`cicustom` snippets require snippets-enabled storage** — relevant to migration pre-flight (Pitfall 20).
8. **Hand-written Alembic migrations** — `0004_phase3` with explicitly-named constraints (project pattern, Plan 01-02 decision).
9. **Service layer commits before raising `HTTPException`** — the enqueue helper commits the `jobs` row (and any audit row) before any error path.
10. **Power actions are audited** (Phase 2 D-20) — every lifecycle mutation writes an audit row; the audit writer FLUSHes, the caller commits.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The PVE error substrings in the curated map are representative across PVE 7/8/9 | PVE Error Surface | LOW — D-13's raw-fallback means an unmatched error still displays correctly; only the prettification is missed. Refine against live task logs. |
| A2 | `max_jobs=6` worker concurrency is adequate for the target scale | Pattern 1 | LOW — easily tuned; ARCHITECTURE.md suggests 4–8. Most job time is `asyncio.sleep` between polls. |
| A3 | `exitstatus` other than exactly `"OK"` = failure; `"WARNINGS: N"` handling is the planner's call | Pattern 3 | MEDIUM — a backup that finishes with warnings has a valid backup file; treating it as hard-failure would confuse users. Recommend: `WARNINGS:` → `succeeded` with the warning shown. |
| A4 | The `snapshot` GET returns a `parent` field and a synthetic `current` entry | Code Examples | LOW — standard PVE behavior; the tree builder just needs the real field names confirmed against a live cluster. |
| A5 | Hotplug tokens are literally `cpu` / `memory` in the `hotplug` config string | Resize | MEDIUM — if the token names differ, the reboot-required warning fires wrong. Confirm against `qm config` output during execution. |
| A6 | Per-VM backup files are enumerable + individually deletable via the storage content API | Backup | MEDIUM — "keep last N" retention depends on listing + deleting backup volids. Confirm the volid format and the `content(volid).delete()` call. |
| A7 | LXC in-place "convert to template" is out of Phase-3 scope (qemu-only) | Template | LOW — success criteria say "convert a VM to a template"; LXC vztmpl creation is a different mechanism. Confirm with the planner. |
| A8 | `bwlimit` for migration is in KiB/s | Migrate | MEDIUM — the UI labels the field MB/s; a wrong unit assumption means a 1024× bandwidth error. Verify the PVE migrate `bwlimit` unit. |
| A9 | arq 0.26.3's API surface (`WorkerSettings`, `func`, `cron`, `enqueue_job`, `create_pool`, `Retry`) is sufficient and stable | Standard Stack | LOW — these are arq's core, stable since well before 0.26. 0.28.0 is API-compatible if the planner prefers latest. |
| A10 | Caddy's `reverse_proxy` already forwards WebSocket upgrades for `/api/*` | Pattern 5 | LOW — Caddy handles WS transparently by default; just confirm the Phase-1 Caddyfile doesn't override. |

## Open Questions

1. **Can the per-tenant privsep token perform a plain `unlock`?** (Claude's-discretion item — researcher was asked to confirm.)
   - **What we know:** `skiplock` is `root@pam`-only (Pitfall 17) — definitively unavailable to privsep tokens. A *plain* unlock is `config.put(lock='')` (clearing the lock field), which requires the `VM.Config.Options` privilege. The Phase-1 bootstrap grants the per-tenant token `PVEVMAdmin`, which **includes `VM.Config.Options`**.
   - **What's unclear:** Whether PVE permits clearing the `lock` field via `config.put` while the VM is *itself* locked — some PVE versions reject any `config.put` on a locked VM regardless of the field being changed. The lock that matters most (a stale `backup`/`migrate` lock) may or may not be clearable this way.
   - **Recommendation:** Build the curated error message to guide the user ("unlock from the detail page") AND add an "Unlock" affordance on the detail page that attempts `config.put(lock='')`. If PVE rejects it, the error map catches the rejection and the message degrades gracefully to "unlock from Proxmox directly". Treat the Unlock button as best-effort. **Confirm the exact behavior against a live PVE 8/9 with a deliberately-locked VM during execution** — this is a 5-minute manual test.

2. **VMID reservation mechanism for clone (Pitfall 1).** A per-cluster in-process lock is the simplest (the API runs one process); but clone is *enqueued* and the VMID is allocated by the *worker*, which is a different process. Recommendation: allocate the VMID in the **API process at enqueue time** (inside the same DB transaction, with a short-lived `reserved_vmid` row or a per-cluster advisory lock), store it in the job payload, and have the worker use the pre-allocated ID. This keeps the reservation in one process. The planner should decide the reservation table shape.

3. **Does `WARNINGS: N` exitstatus count as success?** (See Assumptions A3.) Recommendation: yes, `succeeded` with the warning surfaced — the backup/operation file exists. Planner confirms.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `redis-server` (Debian pkg) | arq job queue + pub/sub | ✓ (in Debian 12 `main`) | `5:7.0.15-1~deb12u6` | SQLite-backed queue (ROADMAP fallback) — not recommended |
| `arq` (PyPI) | Worker, queue | ✓ | 0.26.3 recommended | — |
| `redis` (PyPI client) | arq + API pub/sub | ✓ | 5.3.1 (arq caps `<6`) | — |
| `proxmoxer` | All PVE calls | ✓ (installed) | 2.3.0 | — |
| `pybreaker` | Circuit breaker | ✓ (installed) | 1.4.1 | — |
| FastAPI WebSocket / `websockets` | Tasks drawer stream | ✓ (uvicorn[standard] bundles it) | — | — |
| systemd | Worker + Redis units (D-17, `nesting=1`) | ✓ (LXC runs systemd) | — | — |
| A live Proxmox cluster for verification | Manual checks A4/A5/A6/A8 + Q1 | unknown (CI uses `FakeProxmox`) | — | `FakeProxmox` recording fake (Plan 01-06 pattern) covers unit tests; live-cluster checks deferred to manual verification |

**Missing dependencies with no fallback:** none — all required pieces are available.
**Missing dependencies with fallback:** the SQLite-queue fallback for Redis exists but is explicitly *not* recommended (a 4th process via systemd is cheap; arq's semantics are worth keeping).

**Note for the planner:** unit tests should extend the existing `FakeProxmox` (Plan 01-06: class-level recording fake, chained-attribute → dotted-string keys) to record UPID-returning calls and `tasks/{upid}/status` responses. The crash-safe orphan-reaper verification (CONTEXT §Specifics: "kill-and-restart test during a clone") needs either a live cluster or a `FakeProxmox` that can simulate a still-running task across a simulated restart.

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json` — this section is **omitted** per the researcher instructions. The project uses pytest (221→249 tests through Phase 2) and the planner follows the established TDD-commit pattern; no Nyquist test-map is required.

## Security Domain

> `security_enforcement` is not explicitly set in `config.json` — treated as enabled. The project carries an ASVS-aware history (Phase 1 cited V14.1/V14.4/V14.5; Phase 2 cited CSV-injection / X-Forwarded-For trust).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | WebSocket upgrade reuses the existing cookie-session principal resolution; PAT-bearer also accepted per Phase 1. No new auth mechanism. |
| V3 Session Management | yes | The Tasks-drawer WebSocket is bound to the session; on session revoke the socket should be dropped (re-check on push — Pitfall 9). |
| V4 Access Control | yes | Every lifecycle endpoint re-runs the Phase 2 `resolve_resource` / `require_resource_access` RBAC gate (returns 403 for cross-tenant, never 404-leaks). The job's `team_id` scopes the drawer (D-01). WebSocket fan-out filters every event by team. |
| V5 Input Validation | yes | All lifecycle request bodies are pydantic models (`extra="forbid"` pattern from Phase 1). `skiplock` must not be a field on ANY schema (Pitfall 17). VMID/node/disk/storage values validated before reaching proxmoxer. |
| V6 Cryptography | no (no new crypto) | Cluster tokens are decrypted by the existing `EncryptedSecret` TypeDecorator; the worker process installs the same cipher. No hand-rolled crypto. |
| V14 Configuration | yes | Redis bound to `127.0.0.1` only; the worker systemd unit keeps the Phase-1 hardening directives (`NoNewPrivileges`, `ProtectSystem`, `ReadWritePaths`). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Redis reachable from outside the LXC → unauthenticated queue access / RCE-adjacent | Tampering / Elevation | Bind `bind 127.0.0.1 -::1`, `protected-mode yes` (Debian default). Redis is LXC-loopback-only; no `requirepass` needed because nothing else on loopback should reach it, but the planner may add one for defense-in-depth. |
| A user enqueues a job for a VM they don't own | Elevation of Privilege | RBAC gate at the lifecycle route (Phase 2 `require_resource_access`) BEFORE enqueue; the worker also executes as the *team* privsep token, so even a missed app-side check is caught by Proxmox's own ACL. |
| Cross-tenant job visibility via the Tasks drawer / WebSocket | Information Disclosure | `jobs.team_id` set on every job; WebSocket fan-out filters every event by the socket's team set; re-checked on every push (Pitfall 9). |
| `skiplock` privilege escalation (acting as root) | Elevation of Privilege | `skiplock` never exposed, never a schema field, never sent (Pitfall 17, ROADMAP-locked). |
| Raw PVE error leaks node/storage internal paths to non-admins | Information Disclosure | **Conscious accepted risk (D-15)** — no redaction; all users see raw detail. Documented deviation from Pitfall 24, accepted for the small-team home-lab audience. The planner must not "fix" this — it is a decision. |
| Idempotency-key forgery → replaying another user's job | Tampering | The key includes `actor_user_id`; a different actor produces a different key. The RBAC gate still runs per request. |
| Worker decrypts cluster tokens — token exposure if worker memory dumped | Information Disclosure | Same posture as the API process (both hold the cipher). The worker unit has the Phase-1 hardening (`PrivateTmp`, `ProtectHome`); acceptable. |

## Sources

### Primary (HIGH confidence)
- `backend/app/models/job.py`, `backend/app/clusters/connector.py`, `backend/app/clusters/registry.py`, `backend/app/main.py`, `deploy/lxc/bootstrap.sh`, `deploy/systemd/proxmox-gui-worker.service` — read directly; the integration surface.
- `proxmoxer.github.io/docs/2.0/tools/tasks/` — `Tasks.blocking_status`, `decode_upid`, `decode_log` signatures; UPID format; `exitstatus` example. `[CITED]`
- PyPI registry (`pypi.org/pypi/{arq,redis,proxmoxer}/json`) — version + dependency verification. `[VERIFIED]`
- `packages.debian.org/bookworm/redis-server` — Debian 12 ships `redis-server 5:7.0.15-1~deb12u6` in `main`. `[VERIFIED]`
- Context7 `/websites/arq-docs_helpmanual_io` — `WorkerSettings`, `func()`, `enqueue_job`, `Retry`, `RedisSettings` shapes. `[CITED]`
- `.planning/research/ARCHITECTURE.md` §Pattern 2/3, `.planning/research/PITFALLS.md` §1,2,6,12,13,17,18,20,24, `.planning/research/STACK.md` — project research baseline. `[CITED]`

### Secondary (MEDIUM confidence)
- arq documentation site (`arq-docs.helpmanual.io`) — cron, on_startup/on_shutdown semantics, worker concurrency.
- Proxmox VE API behavior for lifecycle endpoints (clone/migrate/vzdump/snapshot params) — drawn from PITFALLS.md research + proxmoxer's chained-resource conventions; the exact param names should be confirmed against a live PVE during execution (see Assumptions).

### Tertiary (LOW confidence)
- The curated PVE-error substring map (A1) — composed from forum-thread error wording cited in PITFALLS.md; a seed, not a verified catalogue. The D-13 raw-fallback design makes an imperfect map safe.

## Metadata

**Confidence breakdown:**
- Standard stack (arq/redis/proxmoxer/redis-server): **HIGH** — versions and dependency constraints verified against PyPI and Debian package indexes; the existing connector code confirms the proxmoxer integration shape.
- Architecture (worker/poller/reaper/pub-sub patterns): **HIGH** — the patterns are dictated by the shipped two-process split (D-17) and the shipped `jobs` schema; arq's `WorkerSettings` shape is documented.
- Proxmox call signatures (per-operation): **MEDIUM** — the chained-attribute call shapes are verified against the existing connector; the exact *parameter names* (clone `full`, migrate `bwlimit` unit, snapshot `parent` field, hotplug tokens) carry assumptions to confirm against a live cluster.
- PVE error catalogue: **LOW-MEDIUM** — a seed map; D-13's raw-fallback makes it safe to refine during execution.
- Pitfalls: **HIGH** — drawn directly from the project's own PITFALLS.md, all cross-referenced.

**Research date:** 2026-05-16
**Valid until:** 2026-06-15 (30 days — arq/redis/proxmoxer are stable; the PVE call assumptions should be confirmed at execution time regardless of date).
