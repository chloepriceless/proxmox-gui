# Phase 3: Job Queue & Lifecycle - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 35 (new/modified)
**Analogs found:** 31 / 35

This document tells the planner/executor *which shipped file each new Phase 3
file should copy patterns from*. It is concrete: every excerpt carries a path
and line numbers. The two new modules (`backend/app/jobs/`, `backend/app/lifecycle/`)
have no exact analog as modules, but every *file inside them* has a strong
per-file analog in an existing module.

---

## File Classification

### Backend — new modules

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `backend/app/jobs/__init__.py` | package marker | — | `backend/app/inventory/__init__.py` | exact |
| `backend/app/jobs/worker.py` | config / process entry | event-driven | (no analog — RESEARCH §Pattern 1) | none |
| `backend/app/jobs/functions.py` | service (job handlers) | event-driven | `backend/app/inventory/service.py` (commit-before-raise, connector use) | role-match |
| `backend/app/jobs/enqueue.py` | utility (enqueue helper) | request-response | `backend/app/audit/writer.py` (flush-then-caller-owns-txn) | partial |
| `backend/app/jobs/poller.py` | utility (UPID poll loop) | streaming / polling | `backend/app/clusters/health.py` (background probe loop) | role-match |
| `backend/app/jobs/reaper.py` | service (boot-time sweep) | batch | `backend/app/teams/bootstrap.py` (idempotent sweep) | partial |
| `backend/app/jobs/events.py` | utility (Redis pub/sub) | pub-sub | (no analog — RESEARCH §Pattern 4) | none |
| `backend/app/jobs/service.py` | service (job-row CRUD) | CRUD | `backend/app/quotas/service.py` | role-match |
| `backend/app/jobs/routes.py` | route (job list/get/retry) | request-response | `backend/app/clusters/routes.py` | exact |
| `backend/app/jobs/ws.py` | route (WebSocket endpoint) | streaming | `backend/app/clusters/routes.py` (router + Request scope) | partial |
| `backend/app/jobs/schemas.py` | schema (pydantic) | — | `backend/app/inventory/schemas.py` | exact |
| `backend/app/lifecycle/__init__.py` | package marker | — | `backend/app/inventory/__init__.py` | exact |
| `backend/app/lifecycle/routes.py` | route (all mutations) | request-response | `backend/app/inventory/routes.py` (team-scoped, csrf, resource access) | exact |
| `backend/app/lifecycle/power.py` | service (power actions) | CRUD | `backend/app/inventory/service.py` (`update_vm_tags`) | exact |
| `backend/app/lifecycle/snapshots.py` | service (snapshot ops + tree) | CRUD | `backend/app/inventory/service.py` | role-match |
| `backend/app/lifecycle/backups.py` | service (vzdump / restore / schedule) | CRUD + file-I/O | `backend/app/inventory/service.py` | role-match |
| `backend/app/lifecycle/resize.py` | service (CPU/RAM/disk) | CRUD | `backend/app/inventory/service.py` (`update_vm_notes` read-then-write) | role-match |
| `backend/app/lifecycle/clone.py` | service (clone + template) | CRUD | `backend/app/inventory/service.py` | role-match |
| `backend/app/lifecycle/migrate.py` | service (migrate + preflight) | CRUD | `backend/app/inventory/service.py` | role-match |
| `backend/app/lifecycle/errors.py` | utility (PVE error map) | transform | `backend/app/clusters/errors.py` | partial |
| `backend/app/lifecycle/schemas.py` | schema (pydantic) | — | `backend/app/inventory/schemas.py` | exact |

### Backend — extended / new migration

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `backend/app/clusters/connector.py` | service (PVE client) | request-response | (self — extend existing methods) | exact |
| `backend/app/models/job.py` | model | — | (self — schema shipped; add `batch_id`) | exact |
| `backend/app/main.py` | config (router registration + lifespan) | — | (self — `create_app` include_router block) | exact |
| `backend/alembic/versions/0004_phase3.py` | migration | — | `backend/alembic/versions/0003_phase2.py` | exact |

### Deploy

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `deploy/systemd/proxmox-gui-worker.service` | config (systemd unit) | — | (self — replace placeholder ExecStart) | exact |
| `deploy/systemd/proxmox-gui-redis.service` | config (systemd unit) | — | `deploy/systemd/proxmox-gui-worker.service` | role-match |
| `deploy/lxc/bootstrap.sh` | config (install script) | — | (self — extend apt + systemctl blocks) | exact |

### Frontend — new

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `frontend/src/lib/api/jobs.ts` | api client | request-response | `frontend/src/lib/api/inventory.ts` | exact |
| `frontend/src/lib/api/lifecycle.ts` | api client | request-response | `frontend/src/lib/api/inventory.ts` | exact |
| `frontend/src/lib/components/jobs/TasksDrawer.svelte` | component | streaming | `frontend/src/lib/components/quotas/QuotaIndicator.svelte` (Sheet drawer in AppShell) | role-match |
| `frontend/src/lib/stores/jobs.svelte.ts` (WS client) | store | streaming | `frontend/src/lib/stores/user.svelte.ts` (`.svelte.ts` rune store) | partial |
| `frontend/src/lib/components/jobs/JobRow.svelte` | component | — | `frontend/src/lib/components/inventory/Sparkline.svelte` (hand-rolled, no dep) | partial |
| `frontend/src/lib/components/jobs/JobErrorDetail.svelte` | component | — | `frontend/src/lib/components/inventory/MarkdownNotes.svelte` (collapsible block) | partial |
| `frontend/src/lib/components/lifecycle/ActionToolbar.svelte` | component | — | `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` (toolbar host) | partial |
| `frontend/src/lib/components/lifecycle/SnapshotTree.svelte` | component | — | `frontend/src/lib/components/inventory/Sparkline.svelte` (hand-rolled recursive) | partial |
| `frontend/src/lib/components/lifecycle/*Dialog.svelte` (Resize/Migrate/Clone/Restore/etc.) | component | — | `frontend/src/lib/components/forms/ConfirmByNameDialog.svelte` | role-match |
| `frontend/src/routes/backups/+page.svelte` + `+page.server.ts` | route (page) | request-response | `frontend/src/routes/audit/+page.svelte` + `+page.server.ts` | exact |

### Frontend — modified

| Modified File | Role | What Changes | Closest Analog | Match Quality |
|---------------|------|--------------|----------------|---------------|
| `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` | route | mount ActionToolbar; fill Snapshots tab; add Backups tab; remove Snapshots `Lock` | (self) | exact |
| `frontend/src/lib/components/layout/AppShell.svelte` | component | mount `TasksDrawer` alongside QuotaIndicator drawer | (self) | exact |
| `frontend/src/lib/components/layout/Topbar.svelte` | component | add Tasks icon + count badge left of QuotaIndicator | (self) | exact |
| `frontend/src/routes/inventory/+page.svelte` | route | row `⋯` menu + bulk-select bar | (self) | exact |
| `frontend/src/routes/admin/clusters/[id]/+page.svelte` | route | backup-storage `Select` field | (self) | exact |
| `frontend/src/lib/api/client.ts` | config | register `jobs` + `lifecycle` namespaces | (self) | exact |
| `frontend/src/lib/api/types.ts` | types | add Job / lifecycle types | (self) | exact |

---

## Pattern Assignments

### `backend/app/lifecycle/routes.py` (route, request-response)

**Analog:** `backend/app/inventory/routes.py`

This is the closest analog in the whole repo: team-scoped routes under
`/api/v1/clusters/{cluster_id}/...`, RBAC via the `require_resource_access`
dependency, `csrf_protect` on every mutation, mirrored `vms`/`lxcs` paths.
**The critical Phase 3 delta:** every mutating route returns `202 Accepted` +
job id instead of `200` + the resource (API-04, CLAUDE.md constraint). Use
`status_code=status.HTTP_202_ACCEPTED` and call the enqueue helper instead of
running the PVE write inline.

**Router + imports** (`inventory/routes.py:1-25`):
```python
from fastapi import APIRouter, Depends, Path, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory.access import ResolvedResource, require_resource_access

router = APIRouter()
```

**Mutating route shape — reuse `require_resource_access` + `csrf_protect`** (`inventory/routes.py:147-169`). Phase 3 swaps the inline write for an enqueue + 202:
```python
@router.put(
    "/clusters/{cluster_id}/vms/{vmid}/tags",
    response_model=VMDetail,                          # → Phase 3: JobResponse, status 202
    operation_id="inventory_vm_tags_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_vm_tags(
    request: Request,
    payload: TagsUpdate,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.update_vm_tags(
        db, principal=principal, resolved=resolved, new_tags=payload.tags,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )
```

**Route-order rule** — declare static paths before `{int}` paths (`clusters/routes.py:1-7`): the `/backups` global page route and any `/jobs` collection route must precede `/{cluster_id}/...` variants or FastAPI 422s on `int_parsing`.

**Resource access for power/snapshot/etc.** — reuse the shipped dependency `require_resource_access` (`inventory/access.py:132-145`); it resolves `(cluster_id, vmid)` → `ResolvedResource{cluster, team_id, poolid, connector, vm_item, is_stale}`. The connector it hands back is **already the per-team privsep connector** — every lifecycle mutation enqueued from it executes as the team token (CONTEXT D-01 / `team_cluster_tokens`).

---

### `backend/app/jobs/enqueue.py` (utility, request-response)

**Analog:** `backend/app/audit/writer.py` (transaction-discipline) + RESEARCH §Pattern 2 (literal sketch).

The enqueue helper mirrors `audit_write`'s contract style: a focused helper
that the route's service layer calls. **Key transaction rule from the codebase**
(`audit/writer.py:1-19`, `inventory/service.py:262-317`): the service layer
**commits before raising `HTTPException`**. Phase 3's enqueue helper extends
this — it `commit`s the `jobs` row *before* the arq `enqueue_job` call (RESEARCH
"commit-before-enqueue ordering is critical"), and on the `IntegrityError`
unique-collision path it rolls back and returns the in-flight job.

**Idempotency-key pattern** — already designed into the model (`models/job.py:40-44`): `idempotency_key` is `String(128)`, nullable, `unique`. The helper computes `sha256(method+path+actor+body)[:128]`, inserts, `flush()`es to surface the collision, and on `IntegrityError` returns the existing row (RESEARCH §Pattern 2).

**Flush-then-caller-owns-txn discipline to copy** (`audit/writer.py:55-80`):
```python
entry = AuditLog(...)
db.add(entry)
await db.flush()           # surfaces .id and constraint violations now
return entry               # NEVER commits — caller owns the transaction
```

---

### `backend/app/jobs/functions.py` (service, event-driven — arq job handlers)

**Analog:** `backend/app/inventory/service.py` (`update_vm_tags`, lines 228-321).

Each arq job function (`run_power_action`, `run_clone`, …) is structurally a
service function: open work, call the connector, audit, persist state. Copy
three things from `update_vm_tags`:

1. **Connector acquisition** — via the registry, per-team (`inventory/service.py:54-58`):
   ```python
   team_conn = await registry.get_for_team(cluster_id=cluster_id, team_id=team_id, db=db)
   ```
   (`get_for_team` signature: `clusters/registry.py:130-136` — keyword-only `cluster_id`, `team_id`, `db`.)

2. **Connector-exception → friendly handling** (`inventory/service.py:286-301`) — catch `PVEUnreachable` / `PVEAuthError` / generic; for Phase 3 the worker marks the job `failed` and stores the mapped friendly message (it must NOT let arq see the exception — RESEARCH `max_tries=1` rationale).

3. **Audit on both success and failure** (`inventory/service.py:270-317`) — every lifecycle mutation writes an audit row (CONTEXT Phase 2 D-20). The worker calls `audit_write` then `db.commit()`.

**UPID persistence ordering** (`models/job.py:9-13`, RESEARCH §Pattern 1 step 4): the job function persists `upid` + `upid_node` to the `jobs` row **before** the polling loop starts. This is the Pitfall 12 mitigation and is non-negotiable.

---

### `backend/app/jobs/poller.py` (utility, streaming / polling loop)

**Analog:** `backend/app/clusters/health.py` (background probe loop).

`health.py` runs a periodic background `asyncio` loop probing PVE. The UPID
poller is the same shape — an `async` loop with adaptive cadence
(`asyncio.sleep`, tight for ~10s then exponential backoff capped ~30s, CONTEXT
"arq concurrency + UPID poll cadence"). The first `/tasks/{upid}/status`
response is authoritative (Pitfall 2).

All PVE calls inside the loop go through the new `connector.task_status()` /
`connector.task_log()` methods (see connector pattern below) — never call
proxmoxer directly.

---

### `backend/app/jobs/routes.py` (route, request-response — job list/get/retry)

**Analog:** `backend/app/clusters/routes.py`.

A plain CRUD-style router: `GET /jobs` (list, team-wide per CONTEXT D-01),
`GET /jobs/{id}`, `POST /jobs/{id}/retry`. Copy the router skeleton, the
`operation_id` naming convention, and the `get_registry(request)` helper that
reads `request.app.state.registry`.

**`get_registry` from app.state — copy verbatim** (`clusters/routes.py:36-51`, also `inventory/routes.py:28-40`):
```python
def get_registry(request: Request) -> PVEConnectorRegistry:
    registry = getattr(request.app.state, "registry", None)
    if registry is None:
        from sqlalchemy.ext.asyncio import async_sessionmaker
        from app.core.db import engine
        registry = PVEConnectorRegistry(None, async_sessionmaker(engine, expire_on_commit=False))
        request.app.state.registry = registry
    return registry
```

**Operation-id + status-code convention** (`clusters/routes.py:84-92`): every route declares an explicit `operation_id`, `summary`, and `status_code` (use `status.HTTP_202_ACCEPTED` for the retry route — it re-enqueues).

The `POST /jobs/{id}/retry` route is gated to idempotent kinds only (CONTEXT D-16): `start, stop, reboot, shutdown, snapshot-delete, resize, backup`.

---

### `backend/app/jobs/ws.py` (route, streaming — WebSocket endpoint)

**Analog:** `backend/app/clusters/routes.py` (router + `Request`-scope registry) — there is **no shipped WebSocket endpoint**, so the planner should follow RESEARCH §Pattern 4 (Starlette `@router.websocket("/ws/jobs")`, subscribe to Redis pub/sub via `app/jobs/events.py`, fan out). Reuse the `request.app.state` access pattern for the registry/Redis pool. JWT auth on the WS handshake reuses `app.core.jwt` decode — the planner should confirm the cookie/token reading path against `app/auth/dependencies.py`.

---

### `backend/app/clusters/connector.py` (service — EXTEND, do not replace)

**Analog:** the file itself — Phase 3 *adds methods to the existing `PVEConnector` class*.

**Every new mutating/polling method routes through `_call_with_breaker`** so it inherits the circuit breaker and the uniform exception surface (`connector.py:143-167`). Do NOT use the bootstrap-only `_call` for lifecycle ops.

**Method shape to copy — qemu/lxc branch + `_call_with_breaker`** (`connector.py:231-247`, 253-269):
```python
async def get_vm_status(self, *, node: str, vmid: int, is_lxc: bool) -> dict:
    fn = (
        self._client.nodes(node).lxc(vmid).status.current.get
        if is_lxc
        else self._client.nodes(node).qemu(vmid).status.current.get
    )
    return await self._call_with_breaker(fn)
```

**Cache-invalidation after a write** (`connector.py:266-269`): after a mutating call, set `self._resource_cache.snapshot = None` so the next `list_resources()` reflects the post-write state.

**New methods to add** (RESEARCH §"PVEConnector extension"): `vm_power`, `vm_delete`, `task_status`, `task_log`, `snapshot_list/create/rollback/delete`, `vzdump`, `restore`, `resize_disk`, `clone`, `to_template`, `migrate`, `cluster_status` (quorum preflight), `cluster_nextid`, `node_storages`, `unlock`. All follow the `fn = (... lxc ... if is_lxc else ... qemu ...)` + `_call_with_breaker(fn, **kwargs)` shape.

The bootstrap pool/user/token methods (`connector.py:303-397`) and the `_call` helper stay **unchanged**.

---

### `backend/alembic/versions/0004_phase3.py` (migration)

**Analog:** `backend/alembic/versions/0003_phase2.py` (exact).

Phase 3 needs a `batch_id` column on `jobs` (CONTEXT D-11 grouping) and likely
new indices. Copy `0003_phase2.py` verbatim for structure.

**Revision header convention** (`0003_phase2.py:42-45`):
```python
revision: str = "0004_phase3"
down_revision: str | None = "0003_phase2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
```

**SQLite ALTER → `op.batch_alter_table`, explicit names** (`0003_phase2.py:53-73`): every column add goes inside `with op.batch_alter_table("jobs") as batch_op:` (`render_as_batch=True` is set in `alembic/env.py:86`). Every constraint/index has an explicit `name=` (Plan 01-02 locked rule). `op.create_index` for new indices can sit outside the batch block (`0003_phase2.py:78-105`). A `downgrade()` that reverses the change is mandatory (`0003_phase2.py:108-121`).

File-naming convention: `NNNN_<slug>.py`, zero-padded 4-digit, e.g. `0004_phase3.py` (matches `0001_initial.py` … `0003_phase2.py`).

---

### `backend/app/main.py` (config — router registration + worker is separate)

**Analog:** the file itself — extend the `create_app()` `include_router` block.

**Router registration pattern** (`main.py:164-203`): import the router locally inside `create_app`, then `app.include_router(...)` with a `prefix` and `tags`:
```python
from app.jobs.routes import router as jobs_router
from app.lifecycle.routes import router as lifecycle_router
...
app.include_router(jobs_router, prefix="/api/v1", tags=["jobs"])
app.include_router(lifecycle_router, prefix="/api/v1", tags=["lifecycle"])
```
The WebSocket route mounts on the same `jobs_router` (prefix `/api/v1`, so the endpoint path is `/api/v1/ws/jobs`).

**Lifespan addition** — the API process needs a Redis pool for pub/sub fan-out; add it to `app.state` in the lifespan alongside `app.state.registry` (`main.py:64-67`). The arq **worker** is a *separate process* (`deploy/systemd/proxmox-gui-worker.service`) — it does NOT run inside this app; `worker.py` has its own `on_startup`/`on_shutdown` (RESEARCH §Pattern 1).

---

### `frontend/src/lib/api/jobs.ts` / `lifecycle.ts` (api client, request-response)

**Analog:** `frontend/src/lib/api/inventory.ts` (exact — its header literally says "mirrors clusters.ts verbatim").

**Module skeleton — `withFetch` + `MaybeFetch` + `basePath`** (`inventory.ts:15-34`):
```typescript
import { apiJson, type ApiInit } from '$lib/utils/api';
import type { ... } from './types';

type FetchLike = typeof fetch;
interface MaybeFetch { fetch?: FetchLike; }

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}
```

**Method shape — `apiJson<T>` + path + `withFetch`** (`inventory.ts:96-104`):
```typescript
export async function setTags(
  args: { clusterId: number; vmid: number; type: ResourceKind; tags: string[] },
  opts?: MaybeFetch
): Promise<VMDetail> {
  return apiJson<VMDetail>(
    `${basePath(args.clusterId, args.type, args.vmid)}/tags`,
    withFetch(opts, { method: 'PUT', body: { tags: args.tags } })
  );
}
```
Phase 3 lifecycle mutations return a `JobResponse` (202) rather than `VMDetail` — type the return accordingly.

**Client registration** (`client.ts:27-50`): add `import * as jobsModule from './jobs';` / `lifecycleModule`, then add `jobs: jobsModule, lifecycle: lifecycleModule` to the `api` object. Never break the existing surface (the file's EXTENSION CONTRACT, `client.ts:13-18`).

---

### `frontend/src/routes/backups/+page.svelte` + `+page.server.ts` (route page)

**Analog:** `frontend/src/routes/audit/+page.{svelte,server.ts}` (exact — both are authenticated list pages using a shadcn `table`).

**SSR loader auth gate — defense-in-depth** (`inventory/[cluster]/[vmid]/+page.server.ts:17-21`):
```typescript
export const load: PageServerLoad = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  ...
};
```
**Always pass `event.fetch` into the api client** so cookies forward in SSR (`+page.server.ts:33`, Pitfall A7).

---

### `frontend/src/lib/components/jobs/TasksDrawer.svelte` (component, streaming)

**Analog:** `frontend/src/lib/components/quotas/QuotaIndicator.svelte` — the existing right-side `Sheet` drawer, mounted in `AppShell.svelte`. The TasksDrawer mounts beside it; the two are mutually exclusive (UI-SPEC Implementation Note 3).

**AppShell mount point** (`AppShell.svelte:33-47`): the new `<TasksDrawer />` mounts in the `<div class="bg-background flex min-h-screen flex-col">` alongside `<Topbar>` and the existing `<Toaster>`. The `Toaster` is already mounted once per shell (`AppShell.svelte:47`) — job-completion toasts (CONTEXT D-03) call `toast.success/error` from `svelte-sonner`, exactly as the VM detail page does (`inventory/[cluster]/[vmid]/+page.svelte:8, 82-87`).

**Svelte 5 runes — props + state** (from `ConfirmByNameDialog.svelte:53-79`, `+page.svelte:20, 40-46`):
```svelte
let { open = $bindable(false), ... }: Props = $props();
let typed = $state('');
const matches = $derived(typed.trim() === targetName.trim());
$effect(() => { if (open) { typed = ''; } });
```

---

### `frontend/src/lib/stores/jobs.svelte.ts` (store — WebSocket client)

**Analog:** `frontend/src/lib/stores/user.svelte.ts` (the `.svelte.ts` rune-store convention). No shipped WebSocket client exists — the planner follows UI-SPEC §"WebSocket / reconnection contract": connect on mount, reconcile by `job.id` on reconnect, keep elapsed timers ticking client-side from `created_at`. The store holds the job list `$state` and exposes derived running/failed counts for the Topbar badge.

---

### `frontend/src/lib/components/lifecycle/*Dialog.svelte` (components)

**Analog:** `frontend/src/lib/components/forms/ConfirmByNameDialog.svelte`.

`ConfirmByNameDialog` is **reused verbatim** for Delete / restore-snapshot /
in-place restore / delete-snapshot / delete-backup-file (CONTEXT D-10, UI-SPEC
Implementation Note 6) — do NOT author a new typed-name dialog. The new
Resize / Migrate / Clone / Restore form dialogs copy its structure:

**Dialog component contract** (`ConfirmByNameDialog.svelte:29-104`): typed
`Props` object with `open = $bindable(false)`, an `onConfirm: () => void | Promise<void>`
callback, a `busy` `$state` guard, `$effect` to reset state on open, and a
footer with `Cancel` (`variant="ghost"`, left) + one primary CTA. Form dialogs
use `$lib/components/ui/dialog` instead of `alert-dialog`; OK/Cancel confirms
use `alert-dialog` (UI-SPEC §Confirmation matrix).

---

### `frontend/src/lib/components/lifecycle/SnapshotTree.svelte` (component)

**Analog:** `frontend/src/lib/components/inventory/Sparkline.svelte` (hand-rolled, zero npm dependency).

UI-SPEC D-05 mandates a **hand-rolled recursive Svelte component** — no
tree-view library. This mirrors the shipped Phase 2 decision to hand-roll
`Sparkline.svelte` rather than import a chart library. Indent guides are CSS
borders; `role="tree"` / `role="treeitem"` with roving tabindex.

---

### `deploy/systemd/proxmox-gui-worker.service` + `proxmox-gui-redis.service`

**Analog:** the worker unit itself (`deploy/systemd/proxmox-gui-worker.service`) — Phase 1 shipped it as a `sleep infinity` placeholder explicitly labelled "Phase 3 wires arq" (lines 1-6, 21).

**ExecStart replacement** (`proxmox-gui-worker.service:20-21`): replace
```
ExecStart=/bin/sh -c 'echo "worker placeholder — phase 3 wires arq"; sleep infinity'
```
with the arq invocation (RESEARCH §Pattern 1): `ExecStart=/opt/proxmox-gui/.venv/bin/arq app.jobs.worker.WorkerSettings`. Keep the hardening block (`NoNewPrivileges`, `ProtectSystem=full`, `ReadWritePaths=...`, lines 27-32) verbatim. Add `proxmox-gui-redis.service` to the `After=`/`Wants=` list.

The new `proxmox-gui-redis.service` copies the `[Unit]`/`[Service]`/`[Install]`
hardening skeleton from the worker unit (or simply enables Debian's stock
`redis-server` unit — RESEARCH §"Embedded redis-server as a 4th systemd unit").

---

### `deploy/lxc/bootstrap.sh`

**Analog:** the file itself — extend two existing blocks.

- **apt block** (`bootstrap.sh:75`): add `redis-server` to the `apt-get install -y -qq \` list (RESEARCH §Installation).
- **systemd block** (`bootstrap.sh:216-253`): the worker line is currently commented out — `# systemctl enable --now proxmox-gui-worker.service  # Phase 3 wires arq` (line 253). Phase 3 uncomments it and adds `redis` enablement. Follow the existing `install -m 0644 ... /etc/systemd/system/...` + `systemctl daemon-reload` + `systemctl enable --now` pattern (lines 225-226, 244-246).

---

## Shared Patterns

### Service-layer transaction discipline: commit-before-raise
**Source:** `backend/app/audit/writer.py:1-19`; `backend/app/inventory/service.py:262-301`
**Apply to:** every file in `backend/app/lifecycle/`, `backend/app/jobs/functions.py`, `backend/app/jobs/enqueue.py`
`audit_write` **flushes, never commits** — the caller owns the transaction.
When a service path will `raise HTTPException`, it must `await db.commit()`
*before* raising (otherwise `get_db` rolls back and the audit row is lost):
```python
except Exception as exc:  # noqa: BLE001
    await audit_write(db, ..., result="failure", error=_scrub_pve_error(str(exc)))
    await db.commit()                       # commit BEFORE raising
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="...") from exc
```
The enqueue helper extends this: `commit` the `jobs` row *before* `arq_pool.enqueue_job(...)`.

### Audit every mutation (success AND failure)
**Source:** `backend/app/inventory/service.py:270-317` (`update_vm_tags`)
**Apply to:** every lifecycle service + every arq job function
Every lifecycle mutation writes an `audit_write` row on both the success and
failure path (CONTEXT Phase 2 D-20). Use `_scrub_pve_error` (`inventory/service.py:215-225`)
to strip token substrings from any PVE error string before persisting it.

### Per-team privsep connector acquisition
**Source:** `backend/app/clusters/registry.py:130-136`; `backend/app/inventory/access.py:99-123`
**Apply to:** every lifecycle service + every arq job function
Lifecycle calls execute as the **team token**, never the bootstrap admin
token (CONTEXT D-01). Acquire via `registry.get_for_team(cluster_id=..., team_id=..., db=...)`.
Routes get it for free through the `require_resource_access` dependency
(`ResolvedResource.connector`); the worker re-acquires it inside the job
function from the job row's `cluster_id` + `team_id`.

### All proxmoxer I/O through `_call_with_breaker`
**Source:** `backend/app/clusters/connector.py:143-167`
**Apply to:** every new method on `PVEConnector`
Never call proxmoxer directly. `_call_with_breaker` wraps the sync call in
`asyncio.to_thread` (Pitfall A3) and the `pybreaker` circuit breaker, and
translates exceptions into `PVEUnreachable` / `PVEAuthError` / `PVEAPIError`.

### 202-Accepted enqueue contract
**Source:** RESEARCH §Pattern 2; CLAUDE.md Proxmox constraint #1; `models/job.py`
**Apply to:** every mutating route in `backend/app/lifecycle/routes.py`
Every POST/PUT/DELETE inserts a `jobs` row, enqueues an arq job, and returns
`status.HTTP_202_ACCEPTED` + the job id. No HTTP request ever blocks on a UPID
poll. Routes still carry `Depends(csrf_protect)` (`inventory/routes.py:153`).

### Defense-in-depth auth gates (layout + page + service)
**Source:** `frontend/.../[vmid]/+page.server.ts:17-21`; `backend/app/inventory/access.py`
**Apply to:** `/backups` route, all frontend Phase 3 routes, all backend routes
SSR loaders re-check `locals.user` and `throw redirect(303, '/login?next=...')`;
backend routes gate via `Depends(get_current_principal)` + `require_resource_access`.

### Svelte 5 runes + shadcn-svelte component shape
**Source:** `frontend/src/lib/components/forms/ConfirmByNameDialog.svelte:23-104`
**Apply to:** every new `.svelte` component
Typed `Props` type, `$props()` destructure with `$bindable()` for two-way
props, `$state` / `$derived` / `$effect`, components imported as namespaces
(`import * as Dialog from '$lib/components/ui/dialog'`). No new shadcn blocks
are added in Phase 3 (UI-SPEC §Registry Safety) — compose from the installed set.

---

## No Analog Found

Files with no close shipped match — the planner must follow RESEARCH.md
patterns directly rather than copying an existing file.

| File | Role | Data Flow | Reason | Use Instead |
|------|------|-----------|--------|-------------|
| `backend/app/jobs/worker.py` | process entry / config | event-driven | No arq worker exists yet; the worker unit is a `sleep infinity` placeholder | RESEARCH §Pattern 1 (`WorkerSettings` shape, verbatim) |
| `backend/app/jobs/events.py` | utility | pub-sub | No Redis pub/sub anywhere in the codebase | RESEARCH §Pattern 4 (worker publish / API subscribe) |
| `backend/app/jobs/ws.py` | route | streaming | No shipped WebSocket endpoint | RESEARCH §Pattern 4 + Starlette `@router.websocket`; reuse `clusters/routes.py` registry-from-`app.state` pattern |
| `frontend/src/lib/stores/jobs.svelte.ts` | store | streaming | No WebSocket client exists; `user.svelte.ts` only gives the `.svelte.ts` rune-store convention | UI-SPEC §"WebSocket / reconnection contract" + `user.svelte.ts` store shape |

---

## Metadata

**Analog search scope:** `backend/app/{clusters,inventory,audit,quotas,teams,models}/`, `backend/alembic/versions/`, `deploy/systemd/`, `deploy/lxc/`, `frontend/src/lib/{api,components,stores}/`, `frontend/src/routes/`
**Files scanned:** ~40 source files read or grepped
**Key conventions confirmed against shipped code:**
- Routers: explicit `operation_id` + `summary` + `status_code`; static paths before `{int}` paths; `get_registry(request)` from `app.state`.
- Services: commit-before-raise; `audit_write` flush-not-commit; `_scrub_pve_error`; per-team connector via `registry.get_for_team`.
- Connector: every call through `_call_with_breaker`; `lxc`/`qemu` branch; cache-invalidate after writes.
- Migrations: `NNNN_<slug>.py`, `op.batch_alter_table` for SQLite ALTER, explicit `name=` on every constraint/index, mandatory `downgrade()`.
- Frontend api modules: `withFetch` / `MaybeFetch` / `apiJson<T>`; namespaced re-export in `client.ts`; pass `event.fetch` in SSR.
- Frontend components: Svelte 5 runes, typed `Props`, `$bindable`, shadcn-svelte namespace imports, no new registry blocks.

**Pattern extraction date:** 2026-05-16
