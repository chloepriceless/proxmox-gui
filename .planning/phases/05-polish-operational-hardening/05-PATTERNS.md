# Phase 5: Polish & Operational Hardening - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 31 new/modified surfaces
**Analogs found:** 31 / 31 (every surface has at least a role-match analog; one new data-flow — self-update orchestration — is a partial-match)

This phase ships **no new product capability**. Almost everything is a hardening
overlay on an existing seam. Pattern reuse should be near-total — the planner
should treat "find the existing analog and copy it" as the default for every
file below. The codebase already has: arq cron (`backups_cron.py`), single-row
config tables (`catalog_pin`), DB-backed services with audit (`quotas/service.py`),
admin route groups (`clusters/routes.py`), the connector seam (`connector.py`),
the SSH `pct exec` transport (`connector._ssh_pct_exec`), and shadcn-svelte
`Sheet` + `Table` + `DropdownMenu` primitives.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/models/app_setting.py` | model | CRUD | `backend/app/models/catalog_pin.py` | exact (single-row global config table) |
| `backend/app/settings/service.py` | service | CRUD | `backend/app/quotas/service.py` | role-match (CRUD service + audit) |
| `backend/app/settings/routes.py` | route | request-response | `backend/app/clusters/routes.py` (GET/PATCH pair) | exact (admin GET/PATCH) |
| `backend/app/settings/schemas.py` | schema | — | `backend/app/clusters/schemas.py` | exact (Create/Update/Response trio) |
| `backend/alembic/versions/0007_phase5.py` | migration | — | `backend/alembic/versions/0006_phase4.py` | role-match (new table) + needs ALTER (see below) |
| `backend/app/auth/refresh.py` (EDIT) | service | request-response | itself (`consume_refresh`) | exact (extend existing chokepoint) |
| `backend/app/auth/routes.py` (EDIT) | route | request-response | itself (`/refresh`, `_clear_session_cookies`) | exact |
| `backend/app/models/refresh_token.py` (EDIT) | model | CRUD | itself (`created_at` column) | exact (add `last_active_at`) |
| `backend/app/jobs/retention_cron.py` | utility | batch | `backend/app/jobs/backups_cron.py` | exact (arq cron, write-then-delete) |
| `backend/app/audit/archive.py` | service | file-I/O | `backend/app/audit/csv.py` + `backups_cron.py::prune_backups` | role-match (reuses csv row formatter) |
| `backend/app/audit/routes.py` (EDIT) | route | file-I/O | itself (`export_audit_csv` → StreamingResponse) | exact (add archive list + download) |
| `backend/app/clusters/probe.py` | utility | event-driven | `backend/app/jobs/backups_cron.py` + `clusters/health.py` | role-match (arq cron sweep) |
| `backend/app/clusters/pinning.py` | utility | request-response | `backend/app/clusters/connector.py` constructor | partial (new — HTTPAdapter subclass) |
| `backend/app/clusters/connector.py` (EDIT) | service | request-response | itself (`__init__` lines 92-109) | exact (replace `NotImplementedError` guard) |
| `backend/app/clusters/service.py` (EDIT) | service | request-response | itself (`test_cluster`) | exact (add fingerprint capture to Test) |
| `backend/app/selfupdate/routes.py` | route | request-response | `backend/app/jobs/routes.py::jobs_retry` (202 enqueue) | role-match (202-enqueue) |
| `backend/app/selfupdate/service.py` | service | file-I/O | `backend/app/iso/service.py` (download + verify helpers) | partial (manifest fetch + SHA-256) |
| `backend/app/jobs/selfupdate_functions.py` | utility | batch | `backend/app/jobs/backup_functions.py` | role-match (arq job function) |
| `backend/app/jobs/worker.py` (EDIT) | config | — | itself (`functions`, `cron_jobs`) | exact (register 3 new entries) |
| `backend/app/security/rate_limit.py` (carryover ME-02) | utility | request-response | `backend/app/auth/rate_limit.py` | exact (Redis-back the token bucket) |
| `backend/app/config.py` (EDIT, carryover) | config | — | itself (`_populate_secrets_from_files`) | exact (COOKIE_SECURE startup warning) |
| `backend/app/{setup,pats,teams,ssh_keys}/service.py` (carryover) | service | CRUD | each itself + `quotas/service.py` | exact (review/bug-fix existing) |
| `backend/app/{users,teams,clusters}/schemas.py` (carryover) | schema | — | `clusters/schemas.py` (`_UNSET` sentinel) | exact (ME-05 nullable-clear, ssh-rsa validator) |
| `frontend/src/lib/components/layout/MobileNav.svelte` | component | — | `Sidebar.svelte` + `ui/sheet/*` | role-match (hamburger trigger + Sheet) |
| `frontend/src/lib/components/layout/Sidebar.svelte` (EDIT) | component | — | itself | exact (wrap nav arrays in Sheet on `<lg`) |
| `frontend/src/lib/components/auth/SessionExpiredModal.svelte` | component | — | `ui/dialog/*` + `ConfirmByNameDialog.svelte` | role-match (modal overlay) |
| `frontend/src/lib/components/auth/IdleCountdownToast.svelte` | component | — | `ui/sonner/*` + `notifications/NotificationBell.svelte` | role-match (transient toast) |
| `frontend/src/lib/stores/idle.svelte.ts` | store | event-driven | `frontend/src/lib/stores/theme.svelte.ts` | role-match (`$state` rune store) |
| `frontend/src/routes/admin/settings/+page.svelte` | component | request-response | `frontend/src/routes/admin/clusters/+page.svelte` | exact (admin form page) |
| `frontend/src/lib/api/settings.ts` + `selfupdate.ts` | utility | request-response | `frontend/src/lib/api/clusters.ts` | exact (apiJson wrappers) |
| `frontend/src/routes/inventory/+page.svelte` (EDIT) | component | — | itself + `clusters/+page.svelte` Table | exact (Table→card-stack reflow) |
| `frontend/src/hooks.server.ts` (EDIT, carryover) | middleware | request-response | itself | exact (review/bug-fix) |
| `deploy/install.sh` (EDIT) | config | — | itself | exact (`--update` flag, idempotent re-run) |
| `deploy/lxc/bootstrap.sh` (EDIT, carryover) | config | — | itself | exact (idempotent guards, releases/current layout) |
| `deploy/lxc/update.sh` (NEW) | config | batch | `deploy/lxc/bootstrap.sh` | role-match (factored in-LXC update routine) |
| `deploy/caddy/Caddyfile.template` (EDIT, carryover) | config | — | itself (`header { }` block) | exact (add CSP) |

---

## Pattern Assignments

### `backend/app/models/app_setting.py` (model, CRUD)

**Analog:** `backend/app/models/catalog_pin.py` — the closest existing model is
a **single-row global config table** with no `team_id`. The new settings table
is the same shape: one row, operator config, schema-invariant allowlisted.

Copy the entire structure of `catalog_pin.py` lines 19-53. Key things to carry over:
- `from __future__ import annotations`, `Mapped`/`mapped_column` imports, `Base` import (lines 19-26).
- `id: Mapped[int] = mapped_column(primary_key=True)` (line 32).
- Timestamp columns with `server_default=text("CURRENT_TIMESTAMP")` (lines 35-38).
- `updated_by_user_id` nullable FK `ForeignKey("users.id", name="fk_app_setting_user")` — copy the FK-with-explicit-name pattern from `catalog_pin.py:42-44`.
- The module docstring **must** include the `schema-invariant ALLOWLIST` block verbatim-shaped from `catalog_pin.py:13-17` — the project's `tests/test_schema_invariants.py` requires every `team_id`-less table to be allowlisted with a rationale.

**RESEARCH §Pattern 3 decision:** single-row **typed-columns** table (not key/value).
Columns: `id` (always 1), `idle_timeout_minutes INT`, `audit_retention_days INT`,
`updated_at`, `updated_by_user_id`.

---

### `backend/app/settings/service.py` (service, CRUD)

**Analog:** `backend/app/quotas/service.py` — a DB-backed CRUD service that
upserts a config row and writes a before/after audit entry.

**Imports + audit pattern** (`quotas/service.py` lines 1-26, 183-196):
```python
from app.audit.writer import audit_write
from app.auth.dependencies import Principal
# ... inside the setter, after the flush:
await audit_write(
    db,
    actor_user_id=principal.user.id,
    team_id=None,                       # global config — no team
    cluster_id=None,
    action="settings.update",
    target_type="settings",
    target_id="1",
    result="success",
    source_ip=source_ip,
    correlation_id=correlation_id,
    payload_before=before,              # dict of old values
    payload_after=new_values,           # dict of new values
)
await db.commit()
```
Copy the `_row_payload(row)` helper shape from `quotas/service.py:42-55` for the
before/after diff.

**In-process cache (RESEARCH §Pattern 3):** Add a module-level
`_cache: AppSetting | None = None`. `get_setting(db)` lazy-loads + caches;
`set_setting(...)` writes, commits, then sets `_cache = None`. The **worker
process reads the table directly** through `ctx['sessionmaker']` — no
cross-process invalidation; each process owns its own cache. Document this
invariant inline (RESEARCH: "no IPC needed").

**`get_setting` must be NULL-defensive** — see Pitfall 3 below.

---

### `backend/app/settings/routes.py` (route, request-response)

**Analog:** `backend/app/clusters/routes.py` — the GET/PATCH route pair on an
admin-gated resource.

**Admin-gating + CSRF pattern** (`clusters/routes.py` lines 110-156):
```python
from app.auth.dependencies import csrf_protect, get_current_principal, require_admin
from app.core.db import get_db

router = APIRouter()

@router.get("/", response_model=SettingsResponse,
            operation_id="settings_get",
            dependencies=[Depends(require_admin)])
async def get_settings(db: AsyncSession = Depends(get_db)) -> SettingsResponse:
    ...

@router.patch("/", response_model=SettingsResponse,
              operation_id="settings_patch",
              dependencies=[Depends(require_admin), Depends(csrf_protect)])
async def patch_settings(
    request: Request,
    payload: SettingsUpdate,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    ...
```
The rule: **read routes** = `[Depends(require_admin)]` only; **mutating routes**
= `[Depends(require_admin), Depends(csrf_protect)]` (`clusters/routes.py:9`,
docstring). Pull `source_ip` via `extract_source_ip(request)` and
`correlation_id` via `request.headers.get("X-Request-Id")` — copy from
`quotas/routes.py:135-138`.

Mount under `/api/v1/admin/settings` in `app/main.py` (the orchestrator's
"new admin route group" — register the router the same way `clusters` is).

---

### `backend/app/settings/schemas.py` (schema)

**Analog:** `backend/app/clusters/schemas.py` — the Create/Update/Response trio
with `ConfigDict(from_attributes=True)` on the response model.

Only need `SettingsUpdate` (PATCH body — all fields `Optional`, with
`Field(ge=...)` bounds, e.g. `idle_timeout_minutes: int | None = Field(default=None, ge=1, le=1440)`)
and `SettingsResponse` (`model_config = ConfigDict(from_attributes=True)`,
`clusters/schemas.py:167`). No write-only/secret fields here, so the
`api_token_secret`-omission contract does not apply.

---

### `backend/alembic/versions/0007_phase5.py` (migration)

**Analog:** `backend/alembic/versions/0006_phase4.py` — `op.create_table` with
**explicitly-named** constraints/indexes.

**CRITICAL DIFFERENCE from the 0006 analog:** 0006 only *creates tables*
(SQLite-safe with plain DDL). 0007 also needs an **ALTER on the existing
`refresh_tokens` table** to add `last_active_at`. SQLite cannot `ALTER TABLE ...
ADD COLUMN` with arbitrary constraints — use Alembic's **batch mode**
(`with op.batch_alter_table("refresh_tokens") as batch_op: batch_op.add_column(...)`).
The 0006 docstring (line 23) explicitly notes "no SQLite ALTER — op.create_table
is DDL-safe ... without the batch dance" — 0007 *does* need the batch dance.

**Backfill (Pitfall 3 — non-negotiable):** after adding the column, run
`op.execute("UPDATE refresh_tokens SET last_active_at = created_at WHERE last_active_at IS NULL")`
so existing sessions do not all instantly idle-expire.

Copy from `0006_phase4.py`: the `revision`/`down_revision` header block
(lines 38-41 — `down_revision = "0006_phase4"`), the explicit `name=` on every
constraint (lines 59-71), and the reverse-order `downgrade()` (lines 125-131).
The `settings` table create is a verbatim adaptation of the `catalog_pin` create
block (`0006_phase4.py:81-99`).

---

### `backend/app/auth/refresh.py` (EDIT — service, request-response)

**Analog:** itself — `consume_refresh` (lines 96-145) is the single
server-side chokepoint. The idle check is an additive overlay.

Add an `IdleExpired(InvalidRefresh)` exception class next to `ReplayDetected`
(lines 40-46) — same subclass-for-pointed-message pattern. Inside
`consume_refresh`, **after** the revoked/replay checks (after line 143, before
`return row`), insert the idle check. RESEARCH §Code Examples gives the exact
shape:
```python
idle_minutes = await get_setting(db, "idle_timeout_minutes")   # settings cache
last_active = row.last_active_at or row.created_at             # NULL-defensive
if last_active.tzinfo is None:
    last_active = last_active.replace(tzinfo=UTC)
if (datetime.now(UTC) - last_active) > timedelta(minutes=idle_minutes):
    raise IdleExpired("idle timeout")
```
Note the **naive-datetime normalisation** — `consume_refresh` already does this
for `expires_at` (lines 122-124); copy that exact `.replace(tzinfo=UTC)` guard.
On `issue_refresh` (line 78-84), set `last_active_at=datetime.now(UTC)` on the
new row.

---

### `backend/app/auth/routes.py` (EDIT — route, request-response)

**Analog:** itself — the `/refresh` route already catches `InvalidRefresh` /
`ReplayDetected`. Add an `except IdleExpired` arm that calls
`_clear_session_cookies(response)` (lines 115-120) and returns a 401 with a
distinct `detail` so the SPA can show the modal vs a generic logout.

For the **"Stay signed in" keepalive** (D-04), RESEARCH recommends a dedicated
`POST /api/v1/auth/keepalive` that bumps `refresh_tokens.last_active_at` without
rotating the token — cheaper than burning a rotation. Model it on the existing
`/refresh` route's cookie-resolution preamble (read the `refresh_token` cookie,
`hash_refresh`, look up the row) but skip `issue_refresh`. The keepalive is
exempt from CSRF for the same reason `/refresh` is (httpOnly cookie — documented
`routes.py:13-16`).

---

### `backend/app/jobs/retention_cron.py` (utility, batch — AUDIT-06)

**Analog:** `backend/app/jobs/backups_cron.py` — the established arq-cron module.

Copy the module shape exactly:
- Module docstring explaining the cron entry point (`backups_cron.py:1-20`).
- `from __future__ import annotations`, `logging`, `datetime`/`timedelta`,
  `sqlalchemy.select` imports (lines 22-31).
- The cron function signature `async def roll_audit_log(ctx: dict) -> None:` and
  `sessionmaker = ctx["sessionmaker"]` / `async with sessionmaker() as db:`
  (`backups_cron.py:62-74`).
- The **per-item try/except that does not abort the sweep** (`backups_cron.py:113-119`).

**Sequence (RESEARCH §Pattern 4):**
1. Read `audit_retention_days` from the `settings` table (fresh each run — the worker reads the DB directly).
2. `cutoff = now - timedelta(days=...)`; `select(AuditLog).where(AuditLog.occurred_at < cutoff)`.
3. Stream rows into `gzip.open(...)` via the shared CSV row-formatter (see `archive.py` below).
4. **`DELETE` only after the `.gz` is fsync'd + closed** — write-then-delete ordering (RESEARCH Anti-Pattern + Pitfall: never delete before the archive is durable).
5. System action — carries **no `team_id`** (mirror how `fire_due_scheduled_backups` passes `team_id=schedule.team_id`; here it is `None`).

---

### `backend/app/audit/archive.py` (service, file-I/O — AUDIT-06)

**Analogs:** `backend/app/audit/csv.py` (the row formatter) +
`backups_cron.py::prune_backups` (the list-files-and-act shape).

`audit/csv.py`'s `audit_csv_stream` (lines 31-116) is **RBAC-scoped** for the
user-facing export. The retention archive needs an **unscoped** dump. Per
RESEARCH §Pattern 4: **factor the `csv.writer` row-formatting** (the header row
`csv.py:76-90` + the per-row `escape_cell` block `csv.py:97-112`) into a shared
helper both call sites use — the retention path calls it without the
`_build_rbac_predicate` (`csv.py:46`). Reuse `_BOM` (line 28) and
`escape_cell` from `audit/csv_safe.py`.

**Archive download (D-08):** add `GET /api/v1/audit/archives` (list dir: name,
size, ctime) and `GET /api/v1/audit/archives/{name}` (stream the `.csv.gz`).
The list/download path-handling is new; the streaming-response shape is the
exact `export_audit_csv` pattern (`audit/routes.py:122-127`) — swap
`StreamingResponse` for `FileResponse`, keep the `Content-Disposition`
attachment header. **Path-traversal guard is mandatory — see Pitfall 5.**

---

### `backend/app/audit/routes.py` (EDIT — route, file-I/O)

**Analog:** itself — `export_audit_csv` (lines 93-127) is the streaming-download
pattern. Add the two archive routes. Note `export_audit_csv` uses
`get_current_principal` (RBAC-scoped); the **archive routes should be
`require_admin`** (D-08 — admin Audit page; archives are not RBAC-filtered).

---

### `backend/app/clusters/probe.py` (utility, event-driven — carryover scheduled health probe)

**Analogs:** `backend/app/jobs/backups_cron.py` (the arq-cron sweep) +
`backend/app/clusters/health.py` (the per-connector probe logic).

`clusters/health.py` already has `health_probe_loop` — a `while True` in-process
loop owned by the API's registry. The carryover item wants a **scheduled** probe
that survives as a worker cron. The new `probe.py` is the arq-cron wrapper:
- Cron function `async def probe_clusters(ctx: dict) -> None:` — same `ctx` /
  `sessionmaker` / `registry` access as `backups_cron.py:70-74`.
- For each `Cluster` row, acquire the connector and call `connector.version()`,
  catching `PVEUnreachable`/`PVEAuthError`/`PVEAPIError` exactly as
  `health.py:35` does, and persist the result to a `clusters` status field.
- Per-cluster try/except so one bad cluster does not stop the sweep
  (`backups_cron.py:113-119`).

Register in `WorkerSettings.cron_jobs` (see worker.py edit below).

---

### `backend/app/clusters/pinning.py` (utility — TLS fingerprint pinning, D-20)

**Analog:** none exact — this is a **new** `requests.adapters.HTTPAdapter`
subclass. RESEARCH §Pattern 1 gives the verified-correct class body verbatim:
```python
from requests.adapters import HTTPAdapter

class FingerprintPinningAdapter(HTTPAdapter):
    def __init__(self, fingerprint: str, **kw):
        self._fingerprint = fingerprint.replace(":", "").lower()
        super().__init__(**kw)
    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        pool_kwargs["assert_fingerprint"] = self._fingerprint
        pool_kwargs["assert_hostname"] = False
        super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)
```
Also house the stdlib `capture_fingerprint(host, port)` helper here (RESEARCH
§Pattern 1 — `ssl` + `socket` + `hashlib.sha256` of the DER cert).

**RESEARCH Open Question Q1 / Assumption A1:** the proxmoxer 2.3 session
mount-seam is MEDIUM-confidence — the planner should schedule a 1-task spike
*and a negative test* (wrong cert → connection refused, Pitfall 4) before
relying on this. The adapter class itself is verified; the mount point is not.

---

### `backend/app/clusters/connector.py` (EDIT — service, request-response)

**Analog:** itself — the constructor at lines 81-148.

The exact change: **remove the `NotImplementedError` guard at lines 95-100**
(the Phase-1 placeholder for `tls_fingerprint and not verify_ssl`) and replace it
with mounting `FingerprintPinningAdapter` on the proxmoxer session. The
connector already stores `self.tls_fingerprint` (line 140) — that is the input.
Every PVE call already routes through `_call` / `_call_with_breaker`
(lines 165-200); the adapter sits below all of that, so no per-method change is
needed once the mount point is correct.

---

### `backend/app/clusters/service.py` (EDIT — service, request-response)

**Analog:** itself — `test_cluster` (the dry-run validator behind
`POST /clusters/test`). D-20 capture-on-register: during the Test flow, after
the reachability check, call `capture_fingerprint(host, port)` and surface the
SHA-256 in the `ClusterTestResponse`. Add a `tls_fingerprint: str | None` field
to `ClusterTestResponse` (`clusters/schemas.py:104-111`). The admin confirms it;
it persists to `clusters.tls_fingerprint` (column already exists —
RESEARCH A4).

---

### `backend/app/selfupdate/routes.py` (route, request-response — DEPLOY-04)

**Analog:** `backend/app/jobs/routes.py::jobs_retry` (lines 97-158) — the
202-Accepted enqueue contract.

`POST /api/v1/admin/self-update` is a 202-enqueue, `require_admin` + `csrf_protect`.
Copy from `jobs_retry`: `status_code=status.HTTP_202_ACCEPTED`, the
`arq_pool = getattr(request.app.state, "arq_pool", None)` lookup with the 503
fallback (lines 145-150), and `await arq_pool.enqueue_job(...)`.

**Note:** self-update is a *system* operation, not a tenant op — it likely does
**not** go through `jobs/enqueue.py::enqueue_job` (which requires
`cluster_id`/`team_id` and builds an idempotency key for VM ops). Either pass
`cluster_id=None, team_id=None, actor_user_id=<admin>` if a `jobs` row is
desired for Tasks-drawer visibility, or enqueue the arq job directly like
`jobs_retry`'s `arq_pool.enqueue_job` line. The planner should decide; RESEARCH
favours job-row visibility ("reuses the existing job/UPID/Tasks-drawer
infrastructure").

---

### `backend/app/selfupdate/service.py` (service, file-I/O)

**Analog:** `backend/app/iso/service.py` — closest existing "fetch a remote
artifact" service. The new helpers (release-manifest fetch over HTTPS,
`hashlib.sha256` verification of the tarball against the manifest) have no exact
analog; RESEARCH §Standard Stack pins the stdlib primitives: `hashlib`,
`tempfile`/`shutil`, `subprocess`/`asyncio.create_subprocess_exec`. Keep this
file to pure helpers; the orchestration lives in the job function.

---

### `backend/app/jobs/selfupdate_functions.py` (utility, batch — the highest-risk file)

**Analog:** `backend/app/jobs/backup_functions.py` — an arq job function module.
Copy the module/function shape (`async def run_self_update(ctx: dict, job_id: int)`),
the `ctx['sessionmaker']` access, and the terminal-state job-row update pattern.

**Sequence — RESEARCH §Pattern 5 (verbatim, do not improvise):**
1. Fetch release manifest + tarball over HTTPS.
2. `hashlib.sha256` the tarball, compare to manifest — abort on mismatch (D-10 / ME-03).
3. **WAL-safe DB snapshot** — `sqlite3.connect(src).backup(dst)` — NEVER `shutil.copy` (Pitfall 1). RESEARCH §Code Examples gives `snapshot_db()`.
4. Unpack into `releases/<tag>/`; `pip install -e backend`; use the **committed** `frontend/build/` (do not run `pnpm build` in the LXC — MEMORY "frontend build node_modules trap").
5. `alembic upgrade head`.
6. Atomic symlink swap `current → releases/<tag>` (`ln -sfn`).
7. `systemctl restart proxmox-gui-api proxmox-gui-frontend` — the API dies here; the worker survives (separate systemd unit).
8. Poll the new API `GET /api/v1/health` up to ~60s.
9. Healthy → mark job done, `systemctl restart proxmox-gui-worker` LAST.
10. Unhealthy → **auto-rollback**: restore DB, repoint symlink, restart API, mark job failed.

**Pitfall 2:** the orchestration MUST run in the worker, never the API.
**Pitfall 7:** persistent state (`/etc/proxmox-gui/*`, the GUI SSH key,
`/var/lib/proxmox-gui/`) lives outside `/opt` — the swap touches only `/opt`.
**RESEARCH Open Question Q2 / Assumption A5:** worker `systemctl` privilege is
MEDIUM-confidence — resolve in planning (scoped sudoers entry written by
`bootstrap.sh`).

---

### `backend/app/jobs/worker.py` (EDIT — config)

**Analog:** itself — `WorkerSettings` (lines 111-164).

Three additive edits, all copying existing lines:
- Register `run_self_update` in `functions` — copy a `func(...)` line from
  lines 124-151, e.g. `func(run_self_update, name='admin.self-update', max_tries=1, timeout=1800)`.
- Register `roll_audit_log` and `probe_clusters` in `cron_jobs` — the list at
  lines 155-157 currently has one `cron(...)` entry; add two. RESEARCH §Code
  Examples: `cron(roll_audit_log, hour={3}, minute={0})`.
- Add the corresponding imports at the top (mirror lines 28-48).

---

### `backend/app/security/rate_limit.py` (carryover ME-02 — utility)

**Analog:** `backend/app/auth/rate_limit.py` — the in-memory token bucket.

RESEARCH §Claude's Discretion / §State of the Art: **move the token-bucket
state to Redis** (a hard dependency since Phase 3) so it stops being a
per-uvicorn-worker blind spot. Keep the `check_rate(key, *, limit, window)` /
`check_login_rate(ip, ...)` public signatures (`auth/rate_limit.py:28-60`)
unchanged so call sites do not move — only the `_buckets` dict (line 25)
becomes a Redis sorted-set / token-bucket. The carryover item moves the file to
`backend/app/security/`; update the import in `auth/routes.py:27`.

---

### `backend/app/config.py` (EDIT — carryover COOKIE_SECURE warning)

**Analog:** itself — `_populate_secrets_from_files` (lines 84-122) is the
`model_validator(mode="after")` that already emits `warnings.warn(...)` for
dev-only fallbacks. Add a `cookie_secure is False` branch that emits the same
shape of `UserWarning` ("COOKIE_SECURE=false — DEV ONLY"). Copy the
`warnings.warn(..., stacklevel=2)` call shape from lines 106-110.

---

### Carryover service/schema files (`setup/`, `pats/`, `teams/`, `ssh_keys/`, `{users,teams,clusters}/schemas.py`)

**Analog:** each file is its own analog — these are **bug-fixes / review
remediations**, not new code. D-19 mandates **one consolidated carryover plan**.
Per-item descriptions live in `.planning/phases/01-foundation/01-REVIEW.md` —
the planner must read it for ME-01..05, LO-01..04, IN-01..03.

Two concrete schema patterns to reuse:
- **ME-05 (PATCH clear-nullable-fields):** `clusters/schemas.py:20-22, 133, 142-144`
  already solves this — the `_UNSET` sentinel + `backup_storage_set()` method.
  Any carryover field that must distinguish "absent" from "explicit null" copies
  this exact `_UNSET` pattern.
- **`ssh-rsa` validator bug (backlog 999.1):** lives in `ssh_keys/` — the
  `field_validator` pattern is `clusters/schemas.py:59-71` (`@field_validator`
  + `@classmethod` + regex match → `ValueError`).

---

### `frontend/src/lib/components/layout/MobileNav.svelte` + `Sidebar.svelte` (EDIT) (component — UI-03 D-13)

**Analogs:** `Sidebar.svelte` (the existing nav) + `lib/components/ui/sheet/*`
(shadcn-svelte `Sheet`, already vendored — verified present).

`Sidebar.svelte` already has the `<lg` breakpoint awareness — line 70:
`class="... hidden ... lg:flex lg:w-60 ..."` and `lg:inline` on every label
(lines 103, 138, 150). The reflow:
- Keep the static `<aside>` at `lg:flex hidden` (it already is).
- New `MobileNav.svelte`: a hamburger `Button` (`lg:hidden`) that triggers a
  `Sheet` (`ui/sheet`). Inside the `Sheet`, **reuse the exact `resourceItems` /
  `accountItems` / `adminItems` arrays** (`Sidebar.svelte:36-52`) and the
  `isActive` helper (lines 61-66) — factor those into a shared module or import
  from `Sidebar.svelte` so there is one nav definition.
- `Sheet` handles focus-trap / escape / scroll-lock / ARIA for free (RESEARCH
  §Don't Hand-Roll) — helps D-17.

---

### `frontend/src/lib/components/auth/SessionExpiredModal.svelte` (component — D-03)

**Analogs:** `lib/components/ui/dialog/*` + `forms/ConfirmByNameDialog.svelte`
(a hand-assembled modal over the `Dialog` primitive).

D-03 is explicit: this is an **overlay component, not a route navigation**.
RESEARCH §Pattern 2: render it conditionally *above* `{@render children()}` in
the **root layout** (`routes/+layout.svelte` — currently lines 47-54) so the
underlying route + component state survive. The modal contains a minimal
re-login form; on success it unmounts. Copy the `Dialog` open/close + overlay
wiring from `ConfirmByNameDialog.svelte`.

---

### `frontend/src/lib/components/auth/IdleCountdownToast.svelte` + `lib/stores/idle.svelte.ts` (D-04)

**Analogs:** `lib/components/ui/sonner/*` (the toast primitive) +
`lib/stores/theme.svelte.ts` (the `$state`-rune store pattern).

`theme.svelte.ts` is the template for a `$state`-based singleton store with an
`init()` method (the layout calls `theme.init()` `onMount` —
`+layout.svelte:25-27`). `idle.svelte.ts` is the same shape: `$state` tracking
`lastActivity`, debounced `mousemove`/`keydown`/`click`/`scroll` listeners
installed in `init()`, derived `secondsUntilIdle`. At
`idle_timeout - 2min` it shows `IdleCountdownToast`; at `idle_timeout` it shows
`SessionExpiredModal`. The idle-window value comes from the settings API.

---

### `frontend/src/routes/admin/settings/+page.svelte` + `lib/api/settings.ts` / `selfupdate.ts` (D-01, DEPLOY-04)

**Analogs:** `routes/admin/clusters/+page.svelte` (admin page with header +
form + toast) and `lib/api/clusters.ts` (the `apiJson` wrapper module).

`clusters/+page.svelte` is the template for an admin page: the `<header>` with
`h1` + description (lines 141-152), `toast.success`/`toast.error` from
`svelte-sonner`, `ApiError`-aware catch blocks (lines 100-108), and the
`{ data }: { data: PageData }` `$props()` pattern. The Settings page is simpler
(a form, not a table) but the chrome is identical.

`lib/api/settings.ts` copies `clusters.ts` exactly: `apiJson<T>(path, withFetch(...))`
wrappers, one per endpoint. `selfupdate.ts` is one `apiJson` POST returning the
job id.

---

### `frontend/src/routes/inventory/+page.svelte` (EDIT — UI-03 D-14)

**Analog:** itself + the `Table` usage in `admin/clusters/+page.svelte`
(lines 175-261).

RESEARCH §Pattern 6 (card-stack): render the existing `<table>` at `md:` and
above (`hidden md:table`), and a stacked `<div>`-of-cards at `<md`
(`md:hidden block`) using `lib/components/ui/card/*`. The per-row
`DropdownMenu` action menu (the exact `DropdownMenu.Root` block at
`admin/clusters/+page.svelte:225-255`) is reused verbatim as the per-card action
menu — same component, different container.

---

### `deploy/install.sh` (EDIT) + `deploy/lxc/update.sh` (NEW) + `bootstrap.sh` (EDIT) (DEPLOY-04, D-09/D-12, UAT-1c)

**Analog:** `deploy/install.sh` itself + `deploy/lxc/bootstrap.sh`.

`install.sh` already has the flag parser (lines 75-112) — add `--update` there.
Add an existing-CTID detector (the current behaviour fails at `pct create` —
line 25 docstring). When the CTID exists or `--update` is passed, `pct exec`
into the LXC and run `deploy/lxc/update.sh` instead of `pct create`.

`update.sh` is the **factored in-LXC update routine** that both `install.sh
--update` and the `run_self_update` worker job invoke (RESEARCH §Pattern 5,
"one command for install and update"). Model its idempotent structure on
`bootstrap.sh`.

**SSH trust (D-21, UAT-1c) — RESEARCH §Code Examples gives the verbatim block.**
The `ssh-keygen -t ed25519` + idempotent `grep -qF "$PUBKEY" || echo >>
authorized_keys` (Pitfall 6) goes in `install.sh` (runs as root on the host).
Mirror the existing idempotent guards already in `bootstrap.sh` (the redis
`bind` line check, referenced in RESEARCH). The key lands in `/etc/proxmox-gui/`
with `chmod 0400` — copy the perms pattern from `deploy/scripts/gen-master-key.sh`.

---

### `deploy/caddy/Caddyfile.template` (EDIT — carryover CSP)

**Analog:** itself — the `header { }` block (lines 47-56). The block already has
`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`. Add a `Content-Security-Policy` line; the inline comment at
line 54 ("CSP intentionally omitted in Phase 1; Phase 5 polish hardens") is the
exact line to replace.

**RESEARCH §Security Domain CSP note:** SvelteKit injects inline
`<script>`/`<style>`; a strict `script-src 'self'` breaks hydration. Use a
permissive-but-meaningful CSP — `default-src 'self'; frame-ancestors 'self';
img-src 'self' data: https:` with `'unsafe-inline'` for styles — OR let
SvelteKit emit a nonce-based CSP via `kit.csp` in `svelte.config.js`.
`frame-ancestors 'self'` is the load-bearing directive (it replaces
`X-Frame-Options: SAMEORIGIN`, line 52) and is safe for the same-origin noVNC
iframe.

---

## Shared Patterns

### Admin route gating
**Source:** `backend/app/clusters/routes.py` (whole file), `quotas/routes.py:96-139`
**Apply to:** every new admin route (`settings`, `selfupdate`, audit archive routes)
```python
# read route:
dependencies=[Depends(require_admin)]
# mutating route:
dependencies=[Depends(require_admin), Depends(csrf_protect)]
```
Mutating routes additionally pull `source_ip = extract_source_ip(request)` and
`correlation_id = request.headers.get("X-Request-Id")` and pass them to the
service for audit (`quotas/routes.py:135-138`).

### Audit-write on every config mutation
**Source:** `backend/app/quotas/service.py:183-196` (`audit_write`)
**Apply to:** `settings/service.py` (`settings.update`), `clusters/service.py`
(fingerprint pin confirm), `selfupdate` (update started/finished/rolled-back)
Always: `flush()` to populate the row id → `audit_write(... payload_before=...,
payload_after=...)` → `commit()`.

### arq cron registration
**Source:** `backend/app/jobs/worker.py:155-157`, `jobs/backups_cron.py`
**Apply to:** `retention_cron.py` (`roll_audit_log`), `clusters/probe.py`
(`probe_clusters`)
Every cron function: `async def fn(ctx: dict) -> None`, `sessionmaker =
ctx["sessionmaker"]`, `async with sessionmaker() as db:`, per-item try/except
that does not abort the sweep, registered in `WorkerSettings.cron_jobs`.

### Single-row config table
**Source:** `backend/app/models/catalog_pin.py`
**Apply to:** `models/app_setting.py`
One `id`-PK row, no `team_id`, FK `name=`-explicit, **must** be allowlisted in
`tests/test_schema_invariants.py` with a rationale block in the module docstring.

### Naive-datetime normalisation (SQLite strips tzinfo)
**Source:** `backend/app/auth/refresh.py:122-124`, `jobs/backups_cron.py:57-58`
**Apply to:** the idle check in `consume_refresh`, the retention cutoff in
`roll_audit_log`, the probe timestamps
```python
if dt.tzinfo is None:
    dt = dt.replace(tzinfo=UTC)
```

### 202-Accepted enqueue
**Source:** `backend/app/jobs/routes.py:97-158` (`jobs_retry`), `jobs/enqueue.py`
**Apply to:** `selfupdate/routes.py`
`status_code=status.HTTP_202_ACCEPTED`; `arq_pool = getattr(request.app.state,
"arq_pool", None)` with a 503 fallback; `await arq_pool.enqueue_job(...)`.

### Streaming file download
**Source:** `backend/app/audit/routes.py:93-127` (`export_audit_csv`)
**Apply to:** the audit-archive download route — swap `StreamingResponse` for
`FileResponse`, keep `Content-Disposition: attachment; filename="..."`.

---

## No Analog Found

No file has *zero* analog. Two files are the only **partial-match / new-mechanism**
surfaces — the planner should lean on RESEARCH (not a codebase copy) for the
mechanism, while still copying the surrounding module conventions:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/app/clusters/pinning.py` | utility | request-response | `requests.HTTPAdapter` subclassing has no precedent in the repo. RESEARCH §Pattern 1 supplies the verified class body; the proxmoxer mount-seam needs a spike (Open Question Q1). |
| `backend/app/jobs/selfupdate_functions.py` | utility | batch | Self-update orchestration (detached handoff, atomic symlink swap, auto-rollback) is a new data flow — `backup_functions.py` matches only the *arq-job-function module shape*. The sequence itself is RESEARCH §Pattern 5; the systemctl-privilege question (Q2) needs planning-time resolution. |

---

## Metadata

**Analog search scope:** `backend/app/` (all 130 modules), `backend/alembic/versions/`,
`deploy/`, `frontend/src/` (routes, lib/components, lib/stores, lib/api, hooks).
**Files scanned in depth:** `jobs/backups_cron.py`, `jobs/worker.py`, `audit/csv.py`,
`audit/routes.py`, `auth/refresh.py`, `auth/routes.py`, `auth/rate_limit.py`,
`clusters/connector.py`, `clusters/routes.py`, `clusters/schemas.py`,
`clusters/health.py`, `config.py`, `models/refresh_token.py`, `models/catalog_pin.py`,
`quotas/service.py`, `quotas/routes.py`, `jobs/routes.py`, `jobs/enqueue.py`,
`alembic/versions/0006_phase4.py`, `deploy/install.sh`, `deploy/caddy/Caddyfile.template`,
`frontend/src/lib/components/layout/Sidebar.svelte`, `frontend/src/routes/+layout.svelte`,
`frontend/src/hooks.server.ts`, `frontend/src/routes/admin/clusters/+page.svelte`,
`frontend/src/lib/api/clusters.ts`, `frontend/src/routes/audit/+page.svelte`.
**Pattern extraction date:** 2026-05-19
