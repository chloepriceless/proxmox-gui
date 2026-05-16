# Phase 4: Provisioning, Networking & Console - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 38 (new/modified)
**Analogs found:** 33 / 38

> Phase 4 adds **no new architectural primitives**. Almost every new file has a strong
> in-repo analog from Phases 1-3. The five files with no analog are exactly the three
> spike-gated risk domains (community-script `pct exec`, noVNC WS proxy, SDN reads) plus
> two genuinely-new shared frontend components. The planner should map every new
> provisioning route/job to the proven Phase-3 `_run_polled_job` / `enqueue_clone` shape
> and keep the spike domains isolated.

---

## File Classification

### Backend — new modules

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/provisioning/routes.py` | route | request-response | `backend/app/lifecycle/clone_migrate_routes.py` | exact |
| `backend/app/provisioning/service.py` | service | request-response | `backend/app/lifecycle/clone.py` | exact |
| `backend/app/provisioning/cloudinit.py` | service/utility | transform | `backend/app/audit/csv.py` (pure transform) | partial |
| `backend/app/provisioning/schemas.py` | schema | — | `backend/app/lifecycle/schemas.py` | exact |
| `backend/app/catalog/routes.py` | route | CRUD / request-response | `backend/app/quotas/routes.py` | role-match |
| `backend/app/catalog/service.py` | service | transform / file-I/O | `backend/app/quotas/service.py` | role-match |
| `backend/app/catalog/snapshot.json` | config (vendored data) | — | *(none — bundled data file)* | no analog |
| `backend/app/networks/routes.py` | route | request-response (reads) | `backend/app/quotas/routes.py` | role-match |
| `backend/app/networks/service.py` | service | request-response (PVE reads) | `backend/app/inventory/service.py` | role-match |
| `backend/app/networks/scoping.py` | service | CRUD | `backend/app/quotas/service.py` | exact |
| `backend/app/iso/routes.py` | route | request-response + 202 | `backend/app/lifecycle/clone_migrate_routes.py` | role-match |
| `backend/app/console/routes.py` | route | request-response (mint) | `backend/app/lifecycle/routes.py` | role-match |
| `backend/app/console/proxy.py` | route | streaming (WS relay) | `backend/app/jobs/ws.py` | partial |
| `backend/app/jobs/provisioning_functions.py` | job-function | event-driven (worker) | `backend/app/jobs/clone_migrate_functions.py` | exact |
| `backend/app/notifications/routes.py` | route | request-response (reads) | `backend/app/jobs/routes.py` | role-match |
| `backend/app/notifications/service.py` | service | CRUD (last-seen) | `backend/app/jobs/service.py` | role-match |

### Backend — modified existing files

| Modified File | Role | What Changes | Analog (in-file pattern) |
|---------------|------|--------------|--------------------------|
| `backend/app/clusters/connector.py` | service | +`create_qemu`, `create_lxc`, `lxc_exec`, `vncproxy`, `sdn_*`, `download_url`, `lxc_features` | existing `clone` / `vm_power` / `node_storages` methods |
| `backend/app/jobs/worker.py` | config | register `vm.create.*`, `lxc.create`, `lxc.community-script`, `storage.download` | existing `func(run_clone, name='vm.clone', max_tries=1, timeout=14400)` lines |
| `backend/app/models/__init__.py` | model index | add new model class imports | existing alphabetised import block |
| `backend/app/main.py` | config | mount new routers | existing router-include block |

### Backend — new models + migration

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `backend/app/models/network_scope.py` | model | — | `backend/app/models/quota.py` | exact |
| `backend/app/models/catalog_pin.py` | model | — | `backend/app/models/cluster.py` | role-match |
| `backend/app/models/notification_seen.py` | model | — | `backend/app/models/refresh_token.py` (per-user row) | role-match |
| `backend/alembic/versions/0006_phase4.py` | migration | — | `backend/alembic/versions/0004_phase3.py` | exact |

### Frontend — new API modules

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `frontend/src/lib/api/provisioning.ts` | api-client | request-response + 202 | `frontend/src/lib/api/lifecycle.ts` | exact |
| `frontend/src/lib/api/catalog.ts` | api-client | request-response | `frontend/src/lib/api/quotas.ts` | role-match |
| `frontend/src/lib/api/networks.ts` | api-client | request-response | `frontend/src/lib/api/inventory.ts` | role-match |
| `frontend/src/lib/api/iso.ts` | api-client | request-response + 202 | `frontend/src/lib/api/lifecycle.ts` | exact |
| `frontend/src/lib/api/console.ts` | api-client | request-response (mint) | `frontend/src/lib/api/lifecycle.ts` | role-match |

### Frontend — new routes + components

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/routes/create/+page.svelte` | route/component | request-response | `frontend/src/routes/setup/+page.svelte` | exact |
| `frontend/src/routes/create/+page.server.ts` | route loader | request-response | `frontend/src/routes/admin/teams/[id]/+page.server.ts` | role-match |
| `frontend/src/lib/components/wizard/PathPicker.svelte` | component | event-driven | *(radio-group + card composition)* | partial |
| `frontend/src/lib/components/wizard/ResourcesStep.svelte` | component | request-response | `frontend/src/lib/components/lifecycle/ResizeDialog.svelte` | role-match |
| `frontend/src/lib/components/wizard/CloudInitEditor.svelte` | component | transform | `frontend/src/lib/components/lifecycle/SnapshotTree.svelte` (hand-rolled render) | partial |
| `frontend/src/lib/components/wizard/NetworkPicker.svelte` | component | request-response | `frontend/src/lib/components/inventory/ClusterContextPicker.svelte` | partial |
| `frontend/src/lib/components/wizard/CatalogBrowser.svelte` | component | request-response | `frontend/src/lib/components/audit` table + `command` | partial |
| `frontend/src/lib/components/console/ConsoleTab.svelte` | component | streaming (iframe) | *(plain iframe — no analog)* | no analog |
| `frontend/src/lib/components/notifications/NotificationBell.svelte` | component | event-driven | `frontend/src/lib/components/jobs/TasksDrawer.svelte` + Topbar Tasks icon | role-match |
| `frontend/src/lib/components/shared/EmptyState.svelte` | component | — | *(none — new shared primitive)* | no analog |
| `frontend/src/lib/components/shared/HelpTooltip.svelte` | component | — | *(tooltip composition — new)* | no analog |
| (modified) `frontend/src/lib/components/layout/Topbar.svelte` | component | — | mounts `NotificationBell` left of Tasks icon | self (Tasks-icon block) |
| (modified) `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` | route/component | — | Console tab fills disabled placeholder; provisioning banner | self (Tabs block) |
| (modified) `frontend/src/routes/inventory/+page.svelte` | route/component | — | "Create" primary button + EmptyState | self |
| (modified) `frontend/src/routes/admin/teams/[id]/+page.svelte` | route/component | — | add "Networks" tab parallel to Quotas | self (Tabs block) |
| `frontend/src/lib/components/networks/NetworksTab.svelte` | component | CRUD | `frontend/src/lib/components/quotas/QuotaTab.svelte` | exact |

---

## Pattern Assignments

### `backend/app/provisioning/routes.py` (route, request-response)

**Analog:** `backend/app/lifecycle/clone_migrate_routes.py`

This is the closest possible analog — provisioning routes are structurally identical to
the clone/migrate routes: every mutating endpoint returns `202`, carries
`Depends(csrf_protect)`, declares `operation_id` + `summary`, and delegates to a
`service.enqueue_*` function. Copy the entire file shape.

**Imports + router pattern** (`clone_migrate_routes.py:19-37`):
```python
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.lifecycle.routes import _get_registry, _require_arq_pool
from app.lifecycle.schemas import JobAcceptedResponse

router = APIRouter()

def _job_accepted(job) -> JobAcceptedResponse:
    return JobAcceptedResponse(job_id=job.id, state=job.state, kind=job.kind)
```

**202 + CSRF route decorator** (`clone_migrate_routes.py:41-66`):
```python
@router.post(
    "/clusters/{cluster_id}/provisioning/qemu",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Provision a VM (cloud-init / template-clone / blank+ISO)",
    operation_id="provisioning_create_qemu",
    dependencies=[Depends(csrf_protect)],
)
async def create_qemu(
    request: Request,
    payload: CreateQemuRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> JobAcceptedResponse:
    job = await service.enqueue_create_qemu(
        db, _require_arq_pool(request),
        principal=principal, request=payload, registry=registry,
        source_ip=extract_source_ip(request),
    )
    return _job_accepted(job)
```

**Important difference vs clone:** clone resolves an *existing* resource via
`Depends(require_resource_access)` → `ResolvedResource`. Provisioning creates a *new*
resource so there is no resource to resolve — the route resolves the team + cluster
itself and the service calls `registry.get_for_team(...)` directly. For the
template-clone (VM-02) and VM-clone (VM-04) paths, the source IS an existing resource —
those wrap the existing `clone.enqueue_clone` (RESEARCH §VM-02/VM-04: "reuse the Phase-3
clone path entirely"), so they DO use `require_resource_access`.

---

### `backend/app/provisioning/service.py` (service, request-response)

**Analog:** `backend/app/lifecycle/clone.py` — specifically `enqueue_clone` (lines 168-242)

`enqueue_create_qemu` / `enqueue_create_lxc` are near-copies of `enqueue_clone`. The
RESEARCH §"Code Examples" block pins the exact shape. Reuse `reserve_vmid` and
`run_quota_admission` **verbatim** — they are exported from `clone.py` for exactly this.

**Quota admission BEFORE reserve, reserve BEFORE enqueue** (`clone.py:194-223`):
```python
# clone.py — copy this ordering exactly:
if request.new_vmid is not None:
    newid = int(request.new_vmid)
else:
    newid = await reserve_vmid(cluster_id=cluster_id, connector=connector)

# Quota admission BEFORE the job is enqueued — rejects 409 (Pitfall 6/8).
await run_quota_admission(db, registry, team_id=team_id,
                          cluster_id=cluster_id, source_vm_item=item)

payload = { "node": ..., "vmid": vmid, "newid": newid, ... }
job = await enqueue_job(db, arq_pool, kind="vm.clone",
                        cluster_id=cluster_id, team_id=team_id,
                        actor_user_id=actor_user_id, payload=payload)
```

**Critical note for provisioning:** `clone.py`'s `run_quota_admission` sizes the request
from a *source VM's* reported cpu/mem/disk (`source_vm_item`). Provisioning has no source
VM — it has user-entered sizing from the wizard. The planner must add a sibling helper
(`run_quota_admission_for_request`, named in RESEARCH §"Code Examples" line 305) that
sizes from the request's `requested_cpu` / `requested_ram_bytes` / `requested_disk_bytes`
directly via `QuotaPreviewRequest`. The `would_exceed` → 409 branch (`clone.py:132-143`)
is copied unchanged.

**Audit-write the pending row + commit** (`clone.py:226-242`):
```python
await audit_write(db, actor_user_id=..., team_id=..., cluster_id=...,
                  action="vm.create", target_type="vm", target_id=str(newid),
                  result="pending", source_ip=source_ip,
                  payload_after={"job_id": job_id, "vmid": newid, ...})
await db.commit()
return job
```

**Pool-join (Pitfall 5/7):** the create payload must carry `pool=<team_pool>` so PVE
creates the VM directly inside the team's pool. The team pool name is resolvable from the
`TeamClusterToken` row the connector was minted from — the planner determines the lookup;
the constraint (CLAUDE.md #7) is non-negotiable.

---

### `backend/app/provisioning/cloudinit.py` (service/utility, transform)

**Analog:** `backend/app/audit/csv.py` — a pure stateless transform module (no DB, no PVE).

This file owns two pure functions: the `#cloud-config` effective-config render (VM-05/06)
and the hand-rolled field validator (VM-07). RESEARCH §"Code Examples" pins the render
shape:

```python
# render_cloudinit_preview returns a list of YamlLine(text, injected) so the FE
# can dim + badge PVE-injected lines (D-10). user-set fields: ciuser, cipassword,
# sshkeys, ipconfig0. PVE-injected (badged "PVE default"): chpasswd.expire, etc.
def render_cloudinit_preview(form: CloudInitForm) -> list[YamlLine]:
    ...
```

**Validator pattern (D-12 block-hard / warn-soft):** RESEARCH A5 + the Standard Stack
table recommend a hand-rolled validator over the `ciuser`/`cipassword`/`sshkeys`/
`ipconfig`/`packages`/`runcmd` field set — no `cloud-init` CLI dependency. The hard /
soft split mirrors the Phase-2 quota admission verdict shape: a `would_exceed`-style
result object with `hard_errors: list` + `soft_warnings: list` rather than raising.

---

### `backend/app/provisioning/schemas.py` (schema)

**Analog:** `backend/app/lifecycle/schemas.py`

Per-path Pydantic request models. `CloneRequest` in `lifecycle/schemas.py` is the
template — a flat Pydantic model with optional fields. `JobAcceptedResponse` is reused
directly (imported from `lifecycle.schemas`, not redefined). Each VM/LXC path gets its
own request model; a `to_pve_config()` method on each (RESEARCH §"Code Examples" line
308) translates wizard input → the proxmoxer kwargs dict.

---

### `backend/app/jobs/provisioning_functions.py` (job-function, event-driven)

**Analog:** `backend/app/jobs/clone_migrate_functions.py` — specifically `_run_polled_job`
(lines 79-144) and `run_clone` (lines 147-196)

This is an **exact** match. `run_create_qemu`, `run_create_lxc`, `run_download` are
structurally identical to `run_clone`: a `_build` closure that returns a `_dispatch`
coroutine, fed into `_run_polled_job`. Import `_run_polled_job` from
`clone_migrate_functions` (it is already a shared body — do NOT re-implement it).

**The dispatch-closure + `_run_polled_job` pattern** (`clone_migrate_functions.py:199-215`,
the simplest example — `run_template_convert`):
```python
async def run_create_qemu(ctx: dict, job_id: int) -> None:
    def _build(connector, payload):
        node = payload["node"]
        vmid = int(payload["vmid"])
        config = payload["config"]

        async def _dispatch() -> str:
            return await connector.create_qemu(node=node, vmid=vmid, **config)
        return _dispatch

    await _run_polled_job(
        ctx, job_id, fn_name="run_create_qemu", audit_action="vm.create",
        build_dispatch=_build,
        target_id_from_payload=lambda p: str(p["vmid"]),
    )
```

`_run_polled_job` already does: claim → `registry.get_for_team` → `dispatch_and_poll`
(persists UPID before polling — Pitfall 2) → `map_pve_error` on failure → audit outcome.
Provisioning jobs get all of this free.

**The community-script job is the ONE exception — Pattern 3, two-stage, spike-gated.**
`run_community_script` is NOT a single `_run_polled_job` call. RESEARCH §"Code Examples"
+ §Pattern 3: Stage 1 is `create_lxc` (UPID-polled, like `run_create_lxc`); Stage 2 is
`lxc_exec` of the install script *inside* the running container, streaming stdout/stderr
to the Tasks drawer via `publish_event`. The exact `lxc_exec` shape and the streaming
mechanism are **spike 3 deliverables (A1/A2)** — do not plan `run_community_script`
before the spike. If stage 2 fails, mark the job failed but do NOT delete the LXC
(Pitfall 8 — "created but install failed").

**`run_download` (ISO / cloud-image, Pitfall 7):** dispatches `connector.download_url`
which calls PVE's `POST /nodes/{node}/storage/{storage}/download-url` — PVE downloads
directly to its storage and returns a UPID. The GUI never proxies bytes. Structurally a
plain `_run_polled_job`.

---

### `backend/app/clusters/connector.py` (EXTEND — new PVE methods)

**Analog (in-file):** existing `clone` (lines 602-632), `vm_power` (413-429),
`node_storages` (692-702), `storage_content` (704-720)

Every new method follows the project convention precisely (documented in the file's own
header comment, lines 399-411):
1. Route through `_call_with_breaker` — inherits the circuit breaker + uniform
   `PVEUnreachable` / `PVEAuthError` / `PVEAPIError` surface.
2. The `fn = (... lxc ... if is_lxc else ... qemu ...)` branch shape for dual-type calls.
3. Mutating calls invalidate the cache: `self._resource_cache.snapshot = None`.
4. Never send the root-only lock-override parameter (privsep tokens).

**Mutating-create method shape** (model on `clone`, lines 602-632 — RESEARCH §Pattern 1):
```python
async def create_qemu(self, *, node: str, vmid: int, **config: Any) -> str:
    """POST /nodes/{node}/qemu — create a VM, returns a UPID."""
    fn = self._client.nodes(node).qemu.post
    upid = await self._call_with_breaker(fn, vmid=vmid, **config)
    self._resource_cache.snapshot = None
    return upid

async def create_lxc(self, *, node: str, vmid: int, ostemplate: str,
                     **config: Any) -> str:
    """POST /nodes/{node}/lxc — create a container, returns a UPID."""
    fn = self._client.nodes(node).lxc.post
    upid = await self._call_with_breaker(fn, vmid=vmid, ostemplate=ostemplate,
                                         **config)
    self._resource_cache.snapshot = None
    return upid
```

**Storage / ISO read methods** already have near-exact analogs — `node_storages` (line
692, takes a `content=` filter — exactly what Pitfall 16 content-type filtering needs)
and `storage_content` (line 704). New ISO/cloud-image reads copy these verbatim with
`content="iso"` / `content="vztmpl"` / `content="images"`.

**`cluster_nextid` already exists** (line 676) — `reserve_vmid` already wraps it. No new
work for VMID allocation.

**`vncproxy`, `lxc_exec`, `sdn_*` — spike-gated.** `vncproxy` is a `POST .../vncproxy`
returning `{ticket, port}` — structurally a normal `_call_with_breaker` POST, but the
ticket-lifetime + single-encoding behaviour is **spike 2**. `lxc_exec` and the SDN reads
are **spikes 1 and 3** — the exact endpoints are not yet known (RESEARCH A2/A3, the
`lxc_exec` docstring in §Pattern 1 explicitly flags this).

---

### `backend/app/jobs/worker.py` (EXTEND — register job functions)

**Analog (in-file):** the existing `functions = [...]` list (lines 116-137)

Add new `func(...)` entries following the exact existing form. Non-idempotent creates get
`max_tries=1` (D-16) and a generous timeout (clone uses `14400`):
```python
# copy the shape of this existing line:
func(run_clone, name='vm.clone', max_tries=1, timeout=14400),
# new Phase-4 entries:
func(run_create_qemu, name='vm.create.qemu', max_tries=1, timeout=14400),
func(run_create_lxc, name='lxc.create', max_tries=1, timeout=3600),
func(run_community_script, name='lxc.community-script', max_tries=1, timeout=3600),
func(run_download, name='storage.download', max_tries=1, timeout=14400),
```
Also add the `from app.jobs.provisioning_functions import ...` line to the import block
(lines 28-42).

---

### `backend/app/catalog/service.py` (service, transform / file-I/O)

**Analog:** `backend/app/quotas/service.py` (service-layer read/write shape) +
`httpx.AsyncClient` for the admin "Sync catalog" pull (RESEARCH Standard Stack)

The catalog module reads the **vendored** `snapshot.json` floor (D-05) and parses
community-script metadata into option fields (D-07). The metadata-parse with a
**defaults-only fallback** when parsing fails (D-07) mirrors the Phase-3 D-13 pattern
"curated map + raw fallback". The exact metadata field set + format stability is **spike
3 (A7)**.

---

### `backend/app/networks/routes.py` + `service.py` + `scoping.py`

**Analogs:** `quotas/routes.py` (route), `inventory/service.py` (PVE reads),
`quotas/service.py` (the per-team scoping CRUD)

`networks/scoping.py` is an **exact** analog of the quota team-scoping pattern: a new
per-team table, admin-only CRUD via `Depends(require_admin)`, surfaced on
`/admin/teams/{id}`. The route file copies `quotas/routes.py` including the
`_get_registry` helper (lines 35-47) and the `require_admin` dependency.

`networks/service.py` (SDN enumeration) is **spike 1** — the applied-vs-pending read path
and IPAM free-IP mechanism are unknown (RESEARCH A3, Open Questions 2-3). The
legacy-bridge fallback (NET-04) and DHCP-only IPAM degrade (D-20) are the acceptable v1
floors.

---

### `backend/app/console/proxy.py` (route, streaming WS relay)

**Analog:** `backend/app/jobs/ws.py` — for the **auth-before-accept** handshake only

`ws.py` is the analog for the security-critical handshake: authenticate the
`access_token` cookie BEFORE `accept()`, `close(1008)` on failure (RESEARCH Security
Domain — "noVNC WS handshake authenticates the `access_token` cookie BEFORE `accept()`").

**Auth-before-accept handshake** (`ws.py:46-83`):
```python
async def _resolve_ws_user(websocket, db) -> User | None:
    token = websocket.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        return None
    user = await db.get(User, user_id)
    return user if (user and user.is_active) else None

@router.websocket("/ws/console/...")
async def console_ws(websocket, db = Depends(get_db)):
    user = await _resolve_ws_user(websocket, db)
    if user is None:
        await websocket.close(code=1008)   # never accept() unauthenticated
        return
    # ... resolve resource ownership (cross-tenant → close) ...
    await websocket.accept()
```

**Beyond the handshake there is NO analog** — `ws.py` is a one-way fan-out (server →
browser), the console proxy is a **bidirectional byte relay** between the browser iframe
and `wss://pve-host:8006/.../vncwebsocket`. The relay loop, the Caddy WS-header /
buffering tuning, and the single-encoding rule are **spike 2 deliverables (A4/A8)**.

---

### `backend/app/notifications/routes.py` + `service.py`

**Analog:** `backend/app/jobs/routes.py` + `backend/app/jobs/service.py`

The bell is a **derived view** — no new job storage (D-23). The feed reads recent rows
from the existing `jobs` table (exactly what `jobs_list` already does — `routes.py:54-72`,
using `_team_ids_for_user` + `service.list_recent_jobs`). The only new persisted state is
a per-user "last seen" timestamp for the unread count. The new model is a single per-user
row; the routes are team-scoped reads copying the `jobs_list` shape.

---

### `backend/app/models/network_scope.py` / `catalog_pin.py` / `notification_seen.py`

**Analog:** `backend/app/models/quota.py`

`quota.py` is the model template — note its header documents the **schema-invariant
allowlist** rationale (CLAUDE.md #10 — `tenant_id` on every relevant row). `network_scope`
is team-scoped by nature (carries `team_id`); `notification_seen` is per-user;
`catalog_pin` is global config. Each new model must add its allowlist rationale comment
the way `quota.py` does (`tests/test_schema_invariants.py` enforces this).

### `backend/alembic/versions/0006_phase4.py`

**Analog:** `backend/alembic/versions/0004_phase3.py` — hand-written, explicitly-named
migration (project convention, CLAUDE.md). Copy its structure: explicit `op.create_table`
with named constraints, a real `downgrade()`.

---

### `frontend/src/lib/api/provisioning.ts` / `iso.ts` / `console.ts` / `catalog.ts` / `networks.ts`

**Analog:** `frontend/src/lib/api/lifecycle.ts`

`lifecycle.ts` is the **exact** template for every new API module. It pins: the
`withFetch` helper (lines 38-41), the `MaybeFetch` opts pattern, `apiJson<T>` for typed
calls, the per-function JSDoc documenting the route + 202 contract.

**The 202-returning mutation pattern** (`lifecycle.ts:225-233` — `clone`):
```typescript
export async function clone(
  args: { clusterId: number; vmid: number; type: ResourceKind; body: CloneRequest },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/clone`,
    withFetch(opts, { method: 'POST', body: { ...args.body } })
  );
}
```

`provisioning.ts` and `iso.ts` (downloads) return `JobAccepted` (202). `catalog.ts` /
`networks.ts` are pure reads — copy the GET shape (`lifecycle.ts:120-128`, `listSnapshots`).
New request/response types go in `frontend/src/lib/api/types.ts` alongside
`CloneRequest` / `JobAccepted`.

---

### `frontend/src/routes/create/+page.svelte` (route/component, stepped wizard)

**Analog:** `frontend/src/routes/setup/+page.svelte` — the Phase-1 four-step setup wizard

This is the **exact** analog the CONTEXT (D-03) and UI-SPEC explicitly name ("consistent
with the Phase-1 four-step first-run setup wizard"). Copy:

**Stepper state machine** (`setup/+page.svelte:42-44, 240-247`):
```typescript
type Step = 1 | 2 | 3 | 4;
let step = $state<Step>(1);
const STEP_LABELS: Record<Step, string> = { 1: 'Welcome', ... };
const STEPS: Step[] = [1, 2, 3, 4];
```

**Stepper rail render** (`setup/+page.svelte:275-303`) — the pip + connecting-line
markup, active/complete/future state classes (`bg-primary` / `Check` icon /
`bg-background`). UI-SPEC §"Wizard chrome contract" maps this directly: active step
`bg-primary`, completed `--success` with a check, future `--muted`.

**Per-step validation + error-mapping** (`setup/+page.svelte:72-101, 104-148`) — the
`validateX()` → `Record<string, string>` field-errors pattern and the `mapXError(err)`
ApiError → friendly-string mapping. The Cloud-Init step's hard/soft validation (D-12)
extends this with a two-bucket result.

**Submit handler shape** (`setup/+page.svelte:198-220`) — `submitting` flag, try/catch,
`api.X.create(...)`, advance on success. The wizard's final submit calls
`api.provisioning.createQemu/createLxc`, then per D-04 routes to
`/inventory/{cluster}/{vmid}` and fires a `sonner` toast.

**New for the wizard (no analog — UI-SPEC §"Form-state persistence"):** the
`sessionStorage`-backed draft store keyed by a draft id. The Phase-1 wizard had no
persistence; this is a small, declared addition.

---

### `frontend/src/lib/components/wizard/CloudInitEditor.svelte` (component, transform)

**Analog:** `frontend/src/lib/components/lifecycle/SnapshotTree.svelte` — for the
hand-rolled read-only render discipline

UI-SPEC §"Cloud-Init YAML pane" explicitly forbids a code-editor library and points at
"the Phase 3 hand-rolled snapshot tree" as precedent. `SnapshotTree.svelte` (with its
helper `snapshot-tree.ts`) is the model: a derived data structure rendered with plain
markup. The YAML pane is a styled `<pre>` with per-line `Badge variant="outline"` spans
for PVE-injected lines (D-10). The form half (left pane) composes standard `form` +
`input` + `radio-group` primitives.

---

### `frontend/src/lib/components/networks/NetworksTab.svelte` (component, CRUD)

**Analog:** `frontend/src/lib/components/quotas/QuotaTab.svelte`

D-18 explicitly: "a Networks tab on `/admin/teams/{id}`, **parallel to the Phase-2 Quotas
tab**". `QuotaTab.svelte` is the exact analog — same admin per-cluster grid editor shape.
The parent `admin/teams/[id]/+page.svelte` adds a third `Tabs.Trigger` next to the
existing Members/Quotas triggers (the file's existing pattern, lines 20-46):
```svelte
<Tabs.List class="h-9">
  <Tabs.Trigger value="members">Members</Tabs.Trigger>
  <Tabs.Trigger value="quotas">Quotas</Tabs.Trigger>
  <Tabs.Trigger value="networks">Networks</Tabs.Trigger>   <!-- new -->
</Tabs.List>
```

---

### `frontend/src/lib/components/notifications/NotificationBell.svelte` (component)

**Analog:** the Tasks-icon block in `frontend/src/lib/components/layout/Topbar.svelte`
(lines 53-113) + `TasksDrawer.svelte`

UI-SPEC: "identical chrome to the Phase-3 Tasks icon". The Topbar Tasks-icon block IS the
analog — copy the 36px ghost button + the absolutely-positioned unread-count badge with
the `9+` overflow + the destructive-on-failure color switch:

**Badge with failure-dominance color** (`Topbar.svelte:55-65`):
```typescript
const badgeVisible = $derived(taskCount > 0 || hasUnackedFailure);
const badgeLabel = $derived(taskCount > 9 ? '9+' : String(taskCount));
const badgeClass = $derived(
  hasUnackedFailure
    ? 'bg-destructive text-destructive-foreground'
    : 'bg-primary text-primary-foreground'
);
```

The bell reads job completion/failure events from the existing `jobsStore`
(`$lib/stores/jobs.svelte`) — the same store the Tasks icon uses. The panel
(`dropdown-menu` + `scroll-area`) mirrors `TasksDrawer.svelte`'s row layout.

---

### `frontend/src/lib/components/console/ConsoleTab.svelte`, `shared/EmptyState.svelte`, `shared/HelpTooltip.svelte`

See §No Analog Found below.

---

## Shared Patterns

### Mutation → 202 + worker poll (CLAUDE.md constraint #1)
**Source:** `backend/app/jobs/enqueue.py` (`enqueue_job`) + `backend/app/lifecycle/clone_migrate_routes.py`
**Apply to:** every provisioning, ISO-download route — `provisioning/routes.py`, `iso/routes.py`
Every mutating route enqueues a job (`enqueue_job` — commits the row BEFORE the arq
enqueue, `enqueue.py:86-91`), returns `JobAcceptedResponse` with `status_code=202`. No
route blocks on a UPID poll. The worker's `_run_polled_job` handles the rest.

### VMID reservation + quota admission (Pitfall 1, 6, 8)
**Source:** `backend/app/lifecycle/clone.py` — `reserve_vmid` (lines 78-97), `run_quota_admission` (100-143)
**Apply to:** `provisioning/service.py` — every VM/LXC create
Reuse `reserve_vmid` verbatim (per-cluster `asyncio.Lock` + 60s reserved set). Run quota
admission BEFORE `reserve_vmid`, reserve BEFORE `enqueue_job`. Provisioning needs a
request-sized admission variant (sizes from wizard input, not a source VM).

### Polled-job worker body (Pitfall 2, 12)
**Source:** `backend/app/jobs/clone_migrate_functions.py` — `_run_polled_job` (lines 79-144)
**Apply to:** every provisioning job function except the community-script two-stage job
`_run_polled_job` is a shared, importable body: claim → connector → `dispatch_and_poll`
(persists the UPID before the first poll — crash-safe) → `map_pve_error` → audit. New job
functions supply only a `_build` dispatch closure.

### All proxmoxer I/O through `_call_with_breaker`
**Source:** `backend/app/clusters/connector.py` — `_call_with_breaker` (lines 143-166)
**Apply to:** every new connector method
Inherits the circuit breaker + the uniform exception surface. Mutating calls also do
`self._resource_cache.snapshot = None`. The `fn = (lxc if is_lxc else qemu)` branch is
the convention for dual-type calls.

### Connector access — per-team privsep token + pool join (CLAUDE.md #7, Pitfall 5)
**Source:** `backend/app/clusters/registry.py` — `registry.get_for_team(cluster_id, team_id)`
**Apply to:** every provisioning / network / console call
Every create runs as the per-tenant team token; the create payload carries `pool=`. Never
a single super-token.

### CSRF on every mutation
**Source:** `backend/app/lifecycle/clone_migrate_routes.py` — `dependencies=[Depends(csrf_protect)]`
**Apply to:** every mutating route in `provisioning/`, `iso/`, `catalog/` (sync), `networks/scoping`, `console/` (mint)

### Defense-in-depth auth gates (layout + page + service)
**Source:** `backend/app/quotas/routes.py` (`Depends(require_admin)` on admin routes, lines 100-101) + `jobs/routes.py` (`_team_ids_for_user` team scoping)
**Apply to:** `catalog` sync + `networks/scoping` are admin-gated (`require_admin`); provisioning/console are team-scoped (`get_for_team` + ownership resolution). Cross-tenant → 403/404.

### WebSocket auth-before-accept
**Source:** `backend/app/jobs/ws.py` — `_resolve_ws_user` + `close(1008)` before `accept()`
**Apply to:** `console/proxy.py`
Authenticate the `access_token` cookie BEFORE `accept()`; cookie-only (no PAT).

### Audit pipeline (pending → outcome)
**Source:** `backend/app/audit/writer.py` `audit_write` — called in `clone.py:226` (pending) and `clone_migrate_functions.py:54-77` `_audit_outcome` (terminal)
**Apply to:** every provisioning + community-script job; the install-output capture for community-scripts also writes to audit (CLAUDE.md #8).

### Frontend API module shape
**Source:** `frontend/src/lib/api/lifecycle.ts` — `withFetch` helper + `apiJson<T>` + per-fn JSDoc
**Apply to:** all five new `api/*.ts` modules

### Stepped-wizard chrome
**Source:** `frontend/src/routes/setup/+page.svelte` — `Step` state machine + pip rail (lines 275-303) + `validateX` / `mapXError`
**Apply to:** `routes/create/+page.svelte`

### Tabbed admin sub-page
**Source:** `frontend/src/routes/admin/teams/[id]/+page.svelte` — `Tabs.Root` + `#hash`-driven tab + `setTab`
**Apply to:** the new Networks tab; the now-enabled Console tab on the inventory detail page follows the same `Tabs` pattern (already in `inventory/[cluster]/[vmid]/+page.svelte`).

---

## No Analog Found

Files with no close in-repo match — the planner should use RESEARCH.md patterns and the
gating spikes instead.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/app/console/proxy.py` (relay loop only) | route | streaming | Bidirectional WS byte-relay; `jobs/ws.py` covers only the auth handshake, not a relay. **Spike 2** deliverable (RESEARCH §Pattern 4, A4/A8). |
| `backend/app/networks/service.py` (SDN reads) | service | request-response | No SDN client library; applied-vs-pending + IPAM free-IP unknown. **Spike 1** deliverable (RESEARCH A3, Open Questions 2-3). |
| `run_community_script` in `provisioning_functions.py` | job-function | event-driven (two-stage) | Two-stage create + `pct exec` install with output streaming — not a plain `_run_polled_job`. **Spike 3** deliverable (RESEARCH §Pattern 3, A1/A2). |
| `backend/app/catalog/snapshot.json` | config (vendored data) | — | A bundled data file, not code — no pattern to copy. Format is **spike 3 (A7)**. |
| `frontend/src/lib/components/console/ConsoleTab.svelte` | component | streaming (iframe) | Plain `<iframe>` pointed at the GUI's reverse-proxied noVNC URL; no embedded library (UI-SPEC forbids `@novnc/novnc`). No iframe component exists in the repo. |
| `frontend/src/lib/components/shared/EmptyState.svelte` | component | — | New shared primitive (icon + heading + body + CTA). UI-SPEC §Surface Inventory specifies it; nothing equivalent exists. Small hand-rolled card-less block. |
| `frontend/src/lib/components/shared/HelpTooltip.svelte` | component | — | New shared primitive composing the existing `tooltip`/`popover` + `HelpCircle` icon. The composition is new even though the primitives exist. |

> Note: the "no analog" items for `console/proxy.py`, `networks/service.py`, and
> `run_community_script` are **not** unmapped risk to absorb in planning — they are
> exactly the three ROADMAP-mandated spikes. The planner should sequence the spikes
> first (plans 04-01..03) and plan these files only against the spike outputs.

---

## Metadata

**Analog search scope:** `backend/app/{lifecycle,jobs,clusters,quotas,inventory,audit,ssh_keys,models}`,
`backend/alembic/versions`, `frontend/src/{routes,lib/api,lib/components}`

**Files scanned:** ~50 (backend modules + frontend routes/components/api)

**Pattern extraction date:** 2026-05-16

**Key insight (carried from RESEARCH):** Phase 4 is an *integration* phase. The hard
concurrency/durability problems — VMID race, quota TOCTOU, UPID crash-safety, job
streaming — were already solved in Phases 1-3 and have exact in-repo analogs. The
genuinely-new work is isolated to the three spike domains. 33 of 38 files map to a proven
analog; the closer the planner holds new files to those analogs, the lower the execution
risk.
