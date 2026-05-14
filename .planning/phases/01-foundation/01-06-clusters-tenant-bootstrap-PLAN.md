---
phase: 01-foundation
plan: 06
type: execute
wave: 3
depends_on:
  - 01
  - 02
  - 05
files_modified:
  - backend/app/clusters/__init__.py
  - backend/app/clusters/connector.py
  - backend/app/clusters/registry.py
  - backend/app/clusters/service.py
  - backend/app/clusters/routes.py
  - backend/app/clusters/schemas.py
  - backend/app/clusters/errors.py
  - backend/app/teams/__init__.py
  - backend/app/teams/bootstrap.py
  - backend/app/teams/service.py
  - backend/app/teams/routes.py
  - backend/app/teams/schemas.py
  - backend/app/main.py
  - backend/tests/test_clusters.py
  - backend/tests/test_connector.py
  - backend/tests/test_tenant_bootstrap.py
  - backend/tests/test_teams.py
  - backend/tests/fixtures/__init__.py
  - backend/tests/fixtures/pve_responses.py
autonomous: true
requirements:
  - CLUST-01
  - CLUST-05
  - CLUST-06
  - AUTH-08
  - API-01
  - API-03
user_setup: []
tags:
  - backend
  - clusters
  - proxmoxer
  - multi-tenant
  - tenant-bootstrap
must_haves:
  truths:
    - "POST /api/v1/clusters validates the token via `version.get` BEFORE persisting (Pitfall A4)"
    - "Cluster API token is Fernet-encrypted at rest via EncryptedSecret column"
    - "Every cluster resource URL is `/api/v1/clusters/{cluster_id}/...` per CLUST-05"
    - "PVEConnector calls go through `asyncio.to_thread` wrapper (Pitfall A3)"
    - "PVEConnectorRegistry caches one connector per cluster_id; `invalidate(id)` removes the cached entry on cluster edit/delete"
    - "POST /api/v1/teams (admin-only) auto-bootstraps PVE objects on every active cluster (D-02): pool, user, privsep token, ACL"
    - "On partial bootstrap failure, GUI rolls back PVE-side objects (best-effort) AND rolls back the DB transaction"
    - "DELETE /api/v1/teams/{id} returns 409 when team_cluster_tokens rows exist for that team (D-04 letter: operator must manually remove team from each cluster via Phase 2 endpoint before delete)"
    - "Per-team PVE token is stored Fernet-encrypted in team_cluster_tokens.token_secret"
    - "Personal teams (D-05) cannot be created via this route; the personal=False guard rejects them"
  artifacts:
    - path: "backend/app/clusters/connector.py"
      provides: "PVEConnector wrapping proxmoxer with asyncio.to_thread"
      exports: ["PVEConnector"]
    - path: "backend/app/clusters/registry.py"
      provides: "PVEConnectorRegistry cache keyed by cluster_id"
      exports: ["PVEConnectorRegistry"]
    - path: "backend/app/clusters/service.py"
      provides: "register_cluster, validate_token, update_cluster, delete_cluster, list_clusters"
      exports: ["register_cluster", "validate_token", "update_cluster", "delete_cluster", "list_clusters"]
    - path: "backend/app/teams/bootstrap.py"
      provides: "Transactional D-02 tenant bootstrap with rollback"
      exports: ["bootstrap_tenant_on_clusters", "teardown_tenant_on_clusters"]
    - path: "backend/app/teams/service.py"
      provides: "create_team (with bootstrap), update_team, delete_team, add_member, remove_member"
      exports: ["create_team", "update_team", "delete_team", "add_member", "remove_member"]
  key_links:
    - from: "backend/app/clusters/routes.py"
      to: "backend/app/clusters/service.py"
      via: "POST /clusters calls service.register_cluster which calls connector.validate before persist"
      pattern: "register_cluster"
    - from: "backend/app/teams/bootstrap.py"
      to: "backend/app/clusters/registry.py"
      via: "bootstrap_tenant_on_clusters acquires per-cluster connector from registry"
      pattern: "registry.get"
    - from: "backend/app/teams/service.py"
      to: "backend/app/teams/bootstrap.py"
      via: "create_team calls bootstrap_tenant_on_clusters after team row insert"
      pattern: "bootstrap_tenant_on_clusters"
    - from: "backend/app/main.py"
      to: "backend/app/clusters/routes.py + teams/routes.py"
      via: "include_router for clusters + teams under /api/v1"
      pattern: "include_router"
---

<objective>
Implement the Proxmox-cluster registry, the per-cluster `PVEConnector` (proxmoxer wrapped with `asyncio.to_thread`), the `PVEConnectorRegistry` lazy cache, the admin-only cluster CRUD routes (CLUST-01, CLUST-05, CLUST-06), and the transactional D-02 tenant-bootstrap flow (create PVE pool + user + privilege-separated token + ACL on every active cluster, with best-effort rollback on partial failure). Also: team CRUD routes (admin-only) that drive bootstrap, and team membership add/remove (AUTH-08).

This is the most complex plan in Phase 1: it touches Proxmox via the live API (mocked in tests via `respx` against `proxmoxer`'s `requests` backend) and must be transactionally safe across DB + PVE.

Purpose: Plan 07's first-run wizard creates the initial admin's personal team (which has no PVE bootstrap when no clusters exist yet) and offers optional cluster registration. Plan 08's UI surfaces register-cluster + create-team flows.

Output: 17 routes across `/api/v1/clusters` and `/api/v1/teams`; tenant bootstrap exercised end-to-end against `respx`-mocked PVE responses; all routes admin-gated.
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-RESEARCH.md
@.planning/research/PITFALLS.md
@.planning/research/ARCHITECTURE.md
@CLAUDE.md
@.planning/phases/01-foundation/01-01-SUMMARY.md
@.planning/phases/01-foundation/01-02-SUMMARY.md
@.planning/phases/01-foundation/01-05-SUMMARY.md

<interfaces>

```python
# backend/app/clusters/connector.py
class PVEConnector:
    def __init__(self, *, host, port, token_user, token_name, token_value, verify_ssl, tls_fingerprint=None): ...
    async def version(self) -> dict: ...
    async def validate(self) -> None: ...
    async def create_pool(self, poolid: str, comment: str = "") -> None: ...
    async def delete_pool(self, poolid: str) -> None: ...
    async def create_user(self, userid: str, comment: str = "") -> None: ...
    async def delete_user(self, userid: str) -> None: ...
    async def create_token(self, userid: str, tokenid: str, *, privsep: bool = True) -> dict: ...
    async def set_pool_acl(self, poolid: str, *, userid: str, role: str) -> None: ...
```

```python
# backend/app/clusters/registry.py
class PVEConnectorRegistry:
    def __init__(self, cipher: SecretCipher, session_factory): ...
    async def get(self, cluster_id: int) -> PVEConnector: ...
    def invalidate(self, cluster_id: int) -> None: ...
```

```python
# backend/app/teams/bootstrap.py
class BootstrapResult:
    cluster_id: int
    poolid: str
    userid: str
    tokenid: str
    plaintext_token: str

async def bootstrap_tenant_on_clusters(db, registry, *, team: Team, comment: str) -> list[BootstrapResult]: ...
async def teardown_tenant_on_clusters(db, registry, *, team: Team) -> None: ...
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: PVE connector, registry, cluster CRUD routes</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (Pattern 7, Pitfall A3, Pitfall A4)
    - /home/dev/vm-deployment-gui/.planning/research/PITFALLS.md (Pitfall 7 cluster vs node, Pitfall 11 storage namespace)
    - /home/dev/vm-deployment-gui/backend/app/models/cluster.py
    - /home/dev/vm-deployment-gui/backend/app/core/cipher.py
    - /home/dev/vm-deployment-gui/backend/app/auth/dependencies.py
  </read_first>
  <files>
    backend/app/clusters/__init__.py,
    backend/app/clusters/connector.py,
    backend/app/clusters/registry.py,
    backend/app/clusters/errors.py,
    backend/app/clusters/service.py,
    backend/app/clusters/routes.py,
    backend/app/clusters/schemas.py,
    backend/app/main.py,
    backend/tests/fixtures/__init__.py,
    backend/tests/fixtures/pve_responses.py,
    backend/tests/test_connector.py,
    backend/tests/test_clusters.py
  </files>
  <behavior>
    - test_connector: PVEConnector.version returns the mocked payload; calls invoke proxmoxer through asyncio.to_thread.
    - test_connector: validate() succeeds on 200; raises PVEAuthError on 401; raises PVEUnreachable on connection error.
    - test_connector: create_pool sends POST /pools with the right body (respx intercept verifies URL + body).
    - test_clusters: POST /api/v1/clusters as a non-admin returns 403.
    - test_clusters: POST with malformed host (URL prefix included) returns 422.
    - test_clusters: POST where token fails validation returns 422 and NO cluster row is persisted.
    - test_clusters: POST with valid token persists row with api_token_secret Fernet-encrypted (raw BLOB is NOT the plaintext).
    - test_clusters: GET /api/v1/clusters never returns the decrypted token.
    - test_clusters: POST /api/v1/clusters/{id}/test re-validates and returns version on success.
    - test_clusters: POST /api/v1/clusters/test (dry-run; WARNING 4 fix) with valid token returns `{ok: true, version, release}` and persists NO cluster row (verified by SELECT COUNT(*) = 0 after the call).
    - test_clusters: POST /api/v1/clusters/test with invalid token returns `{ok: false, error: "Proxmox rejected that token."}` and persists NO cluster row.
    - test_clusters: POST /api/v1/clusters/test with unreachable host returns `{ok: false, error: "Couldn't reach that URL."}` and persists NO cluster row.
    - test_clusters: PATCH /api/v1/clusters/{id} without api_token_secret preserves existing token.
    - test_clusters: PATCH with new api_token_secret re-validates.
    - test_clusters: DELETE returns 409 if team_cluster_tokens rows exist for this cluster.
    - test_clusters: DELETE calls registry.invalidate(id).
  </behavior>
  <action>
    errors.py — Define exceptions: `PVEUnreachable(Exception)`, `PVEAuthError(Exception)`, `PVEAPIError(Exception)` (carries status_code, body). Mapped to HTTP via FastAPI exception_handlers registered in main.py.

    connector.py — Implement PVEConnector per 01-RESEARCH.md Pattern 7. Use `proxmoxer.ProxmoxAPI(host, port=port, user=token_user, token_name=token_name, token_value=token_value, verify_ssl=verify_ssl, timeout=10)`. Wrap every call in `await asyncio.to_thread(...)` via private `_call(fn, *args, **kwargs)`. For `tls_fingerprint`: Phase 1 stores it but only enforces verify_ssl=True/False. If `tls_fingerprint` is set AND `verify_ssl=False`, raise NotImplementedError("Per-cluster TLS fingerprint pinning is Phase 5 polish; in Phase 1 use verify_ssl=True with a trusted CA or accept verify_ssl=False without fingerprint"). Document in UI (Plan 08).

    Methods:
    - `version()` → `self._client.version.get()` returning dict.
    - `validate()` → calls version(); translate proxmoxer.AuthenticationError → PVEAuthError, requests.ConnectionError → PVEUnreachable, other proxmoxer.ResourceException → PVEAPIError(status, body).
    - `create_pool(poolid, comment)` → POST /pools.
    - `delete_pool(poolid)` → DELETE /pools/{poolid}.
    - `create_user(userid, comment)` → POST /access/users.
    - `delete_user(userid)` → DELETE /access/users/{userid}.
    - `create_token(userid, tokenid, *, privsep=True)` → POST /access/users/{userid}/token/{tokenid}; returns full payload.
    - `set_pool_acl(poolid, *, userid, role)` → PUT /access/acl with path=/pool/{poolid}, users=userid, roles=role, propagate=1.

    registry.py — Implement PVEConnectorRegistry per 01-RESEARCH.md Pattern 7. `__init__(cipher, session_factory)` stores both. `_connectors: dict[int, PVEConnector] = {}`. `get(cluster_id)` lazy-loads: open session via session_factory, fetch Cluster, build connector with decrypted token (EncryptedSecret transparently decrypts), cache + return. `invalidate(cluster_id)` pops cache. `clear_all()` for tests.

    service.py:
    - `test_cluster(payload) -> ClusterTestResponse` (WARNING 4 fix): build a transient PVEConnector from payload, call `await connector.version()` (which calls validate internally); on success return `{ok: True, version: payload["version"], release: payload["release"]}`. Catch PVEAuthError → `{ok: False, error: "Proxmox rejected that token."}`. Catch PVEUnreachable → `{ok: False, error: "Couldn't reach that URL."}`. Catch PVEAPIError → `{ok: False, error: "Proxmox returned an unexpected error."}`. **No DB write at all.**
    - `register_cluster(db, *, payload, principal)`: build a transient PVEConnector from payload, call validate() (Pitfall A4: validate-before-write). On success insert row (api_token_secret column triggers Fernet encryption). Commit. Return row.
    - `validate_token(db, cluster_id)`: load row, build transient connector with decrypted token, call version(), return dict.
    - `update_cluster(db, registry, *, cluster_id, payload)`: load row; if payload.api_token_secret is set build new transient connector, validate, persist on success, else preserve existing token. Always call registry.invalidate(cluster_id).
    - `delete_cluster(db, registry, *, cluster_id)`: count team_cluster_tokens for cluster_id; if > 0 raise HTTPException(409, "Cluster has bootstrapped tenants. Delete or migrate teams first."). Delete row. registry.invalidate(cluster_id).
    - `list_clusters(db)`: SELECT all clusters; map to ClusterResponse.

    routes.py — Router under prefix `/api/v1/clusters`. Mutating routes: `Depends(require_admin) + Depends(csrf_protect)`. GET routes: `Depends(require_admin)`. Endpoints:
    - `POST /test` — **dry-run** (WARNING 4 fix; consumed by Plan 10's Admin Clusters page "Test" button). Body `ClusterTestRequest(host, port, verify_ssl, token_user, token_name, api_token_secret, tls_fingerprint?)` — same shape as ClusterCreate minus `name`/`notes`. Builds a transient PVEConnector, calls `await connector.version()` (which internally invokes `.validate()`), returns `{ok: bool, version: str | None, release: str | None, error: str | None}`. **NO DB WRITE.** On PVEAuthError → `{ok: false, error: "Proxmox rejected that token."}`; on PVEUnreachable → `{ok: false, error: "Couldn't reach that URL."}`; on success → `{ok: true, version: "8.2.4", release: "8.2"}`. Admin-only + csrf_protect.
    - `POST /` — body ClusterCreate → 201 ClusterResponse. **Persists** the cluster (use this after `/test` succeeds, or skip test and let this validate-before-persist).
    - `GET /` — list ClusterResponse.
    - `GET /{cluster_id}` — single ClusterResponse.
    - `PATCH /{cluster_id}` — body ClusterUpdate (all fields optional).
    - `POST /{cluster_id}/test` — re-validate an existing cluster's stored token. Returns `{ok: bool, version: str | None, error: str | None}`.
    - `DELETE /{cluster_id}` — 204 on success, 409 if bootstrapped.

    The registry instance is created in main.py lifespan and exposed via `app.state.registry`; a FastAPI dependency `get_registry(request) -> PVEConnectorRegistry` reads it.

    schemas.py:
    - `ClusterCreate(name, host, port=8006, verify_ssl=True, token_user, token_name, api_token_secret, tls_fingerprint=None, notes=None)`.
    - `ClusterTestRequest(host, port=8006, verify_ssl=True, token_user, token_name, api_token_secret, tls_fingerprint=None)` — dry-run request shape (no name, no notes).
    - `ClusterTestResponse(ok: bool, version: str | None = None, release: str | None = None, error: str | None = None)`.
    - `ClusterUpdate(name?, host?, port?, verify_ssl?, token_user?, token_name?, api_token_secret?, tls_fingerprint?, notes?, is_active?)`.
    - `ClusterResponse(id, name, host, port, verify_ssl, token_user, token_name, tls_fingerprint, is_active, notes, created_at, updated_at)` — NO api_token_secret.
    - Add a pydantic validator on `host`: rejects values starting with `http://` or `https://` (422 "Use bare hostname or IP, not a URL").
    - Add a validator on `token_user`: must match `^[A-Za-z0-9._@-]+@(pam|pve)$` (basic shape check).

    main.py — Lifespan now also instantiates `app.state.registry = PVEConnectorRegistry(app.state.cipher, async_session_maker)`. Register exception handlers: `PVEUnreachable` → 502 {"detail": "Couldn't reach that Proxmox URL."}, `PVEAuthError` → 422 {"detail": "Proxmox rejected that token."}, `PVEAPIError` → 502 {"detail": "Proxmox returned an unexpected error."}. Include clusters_router with prefix `/api/v1/clusters`.

    tests/fixtures/pve_responses.py — respx fixtures:
    - 200 GET /api2/json/version → `{"data": {"version": "8.2.4", "release": "8.2", "repoid": "abc"}}`.
    - 401 GET /api2/json/version → `{"data": null, "errors": "401 No ticket"}` (proxmoxer auth-error case).
    - Connection error case via respx route.mock(side_effect=ConnectionError).
    - 200 POST /api2/json/pools, 200 DELETE /api2/json/pools/{id}.
    - 200 POST /api2/json/access/users, 200 DELETE /api2/json/access/users/{id}.
    - 200 POST /api2/json/access/users/{id}/token/{tid} → `{"data": {"value": "01234567-aaaa-bbbb-cccc-deadbeef0001", "info": {"privsep": 1}}}`.
    - 200 PUT /api2/json/access/acl.
    Export factory functions to bind them inside `respx.mock()` context.

    Tests:
    - test_connector.py: Use `respx.mock` to intercept proxmoxer's underlying requests. Verify version/validate/create_pool/create_user/create_token/set_pool_acl shapes. Verify asyncio.to_thread is invoked (`monkeypatch.setattr` + counter).
    - test_clusters.py: Use the admin-user factory + login helper from Plan 05. Test the full route surface with respx-mocked PVE responses.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_connector.py tests/test_clusters.py -x -v 2>&1 | tail -30 ; python -c "from app.main import app; paths=[r.path for r in app.routes]; assert any('/clusters' in p for p in paths); print('OK', sum(1 for p in paths if '/clusters' in p), 'cluster routes')"</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend && python -m pytest tests/test_connector.py tests/test_clusters.py -x` exits 0
    - `grep -q 'asyncio.to_thread' backend/app/clusters/connector.py` (Pitfall A3)
    - `grep -q 'PVEAuthError' backend/app/clusters/errors.py`
    - `grep -q 'validate()' backend/app/clusters/service.py` (Pitfall A4: validate before persist)
    - `grep -q 'invalidate' backend/app/clusters/registry.py`
    - `grep -q 'EncryptedSecret\|api_token_secret' backend/app/clusters/service.py || grep -q 'EncryptedSecret' backend/app/models/cluster.py`
    - `cd backend && python -c "from app.main import app; paths=[r.path for r in app.routes]; assert '/api/v1/clusters/{cluster_id}/test' in paths or any('/test' in p for p in paths)"` exits 0
    - `grep -q 'http://' backend/app/clusters/schemas.py` (validator rejects URL prefixes)
    - `cd backend && python -c "from app.main import app; paths=[r.path for r in app.routes]; assert '/api/v1/clusters/test' in paths"` exits 0 (WARNING 4 fix; dry-run endpoint registered before the {id}/test variant)
    - `grep -q 'ClusterTestRequest' backend/app/clusters/schemas.py` (dry-run schema present)
    - `grep -q 'test_cluster\|test_cluster(' backend/app/clusters/service.py` (service-layer dry-run function)
  </acceptance_criteria>
  <done>Cluster CRUD routes ship; connector wrapped with asyncio.to_thread; validate-before-persist enforced; registry caches connectors; tests green against respx-mocked PVE responses.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Tenant bootstrap (D-02) + team CRUD + team membership routes</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (Pattern 8 tenant bootstrap)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-CONTEXT.md (D-01, D-02, D-04, D-05, D-06, D-07)
    - /home/dev/vm-deployment-gui/.planning/research/PITFALLS.md (Pitfall 5 multi-tenant ACL)
    - /home/dev/vm-deployment-gui/backend/app/models/team.py
    - /home/dev/vm-deployment-gui/backend/app/models/team_cluster_token.py
    - /home/dev/vm-deployment-gui/backend/app/clusters/registry.py (created in Task 1)
  </read_first>
  <files>
    backend/app/teams/__init__.py,
    backend/app/teams/bootstrap.py,
    backend/app/teams/service.py,
    backend/app/teams/routes.py,
    backend/app/teams/schemas.py,
    backend/app/main.py,
    backend/tests/test_tenant_bootstrap.py,
    backend/tests/test_teams.py
  </files>
  <behavior>
    - test_tenant_bootstrap: With 0 active clusters, create_team inserts a team row + zero team_cluster_tokens rows; returns 201.
    - test_tenant_bootstrap: With 2 active clusters, create_team makes exactly 5 PVE calls per cluster (create_pool, create_user, create_token, set_pool_acl, and a sanity-check version probe is NOT required) → 10 calls total; 2 team_cluster_tokens rows persisted.
    - test_tenant_bootstrap: When the second cluster's create_token fails, the transaction rolls back: 0 team_cluster_tokens rows in DB; PVE-side rollback called delete_user + delete_pool on BOTH clusters (the half-bootstrapped one AND the fully-bootstrapped one); 500 returned with `{"detail": "Tenant bootstrap failed on cluster '<name>': ..."}`.
    - test_tenant_bootstrap: bootstrap is idempotent against existing-pool errors — if create_pool returns PVE's "pool already exists" error (translated to PVEAPIError), the service surfaces it as 409 "Pool name collision on cluster: ...". No partial bootstrap left behind.
    - test_teams: POST /api/v1/teams with personal=True is rejected 422 (cannot create personal teams via API; D-05 — personal teams are auto-created at user creation).
    - test_teams: DELETE /api/v1/teams/{id} where the team has team_cluster_tokens rows returns 409 with detail mentioning "active cluster bindings" (D-04 letter; option a). Asserted by `test_delete_team_with_cluster_bindings_returns_409`.
    - test_teams: DELETE /api/v1/teams/{id} where team has NO team_cluster_tokens rows succeeds (204); no PVE teardown is invoked (admin must have unbound manually first).
    - test_teams: PATCH /api/v1/teams/{id}/members POST/DELETE add/remove user memberships.
  </behavior>
  <action>
    teams/bootstrap.py — Implement per 01-RESEARCH.md Pattern 8 with TIGHTER rollback semantics:

    Class `BootstrapResult` (dataclass): cluster_id, poolid, userid, tokenid, plaintext_token.

    `async def bootstrap_tenant_on_clusters(db, registry, *, team, comment) -> list[BootstrapResult]`:
    1. Query `SELECT * FROM clusters WHERE is_active = True`. If empty → return [] (Plan 07's first-run admin scenario).
    2. `bootstrap_state: dict[int, dict] = {}` tracking `pool_created: bool, user_created: bool, token_value: dict | None` per cluster_id.
    3. For each cluster in order:
       - `conn = await registry.get(cluster.id)`
       - `poolid = f"gui-team-{team.id}"`; `userid = f"gui-team-{team.id}@pve"`; `tokenid = "api"` (PVE naming from CONTEXT.md Discretion section).
       - `await conn.create_pool(poolid, comment=f"GUI tenant {team.name}")` → set `bootstrap_state[cluster.id]['pool_created'] = True`.
       - `await conn.create_user(userid, comment=f"GUI tenant {team.name}")` → set `user_created = True`.
       - `token_payload = await conn.create_token(userid, tokenid, privsep=True)` → store `token_value`.
       - `await conn.set_pool_acl(poolid, userid=userid, role="PVEVMUser")`.
       - Add TeamClusterToken row to db (do NOT commit yet — outer transaction).
       - Append BootstrapResult(...).
    4. On any exception: invoke `_rollback_pve_state(registry, bootstrap_state, team)` (best-effort: for each cluster where ANY state exists, attempt delete_user then delete_pool — wrap each in try/except, log warnings). Re-raise as `BootstrapFailed(cluster_name=<name>, original=e)`.
    5. Return BootstrapResult list.

    `async def teardown_tenant_on_clusters(db, registry, *, team)`:
    - For each TeamClusterToken row for team.id, best-effort delete the PVE-side user + pool (delete_user then delete_pool, swallow individual exceptions, log).
    - Caller deletes the DB rows (cascade via FK).

    `BootstrapFailed(Exception)` carries `cluster_name` and `original`. Custom FastAPI exception handler in main.py maps it to 500 with the structured detail.

    teams/service.py:
    - `async def create_team(db, registry: ConnectorRegistry | None = None, *, name, personal=False, _internal=False, auto_bootstrap=True) -> Team` (registry defaults to None so Plan 07's create_initial_admin can call without a registry; if registry is None and auto_bootstrap=True and clusters exist → raise; if registry is None and either auto_bootstrap=False OR no clusters exist → proceed without bootstrap):
        - If `personal=True` and caller is NOT the internal first-run/setup flow (use a keyword `_internal=False`), raise HTTPException(422, "Personal teams are auto-created; cannot create via API"). Plan 07's setup.service uses `_internal=True` for the admin's personal team.
        - Insert Team row with `personal=personal, name=name`.
        - `await db.flush()` to get team.id.
        - If `auto_bootstrap` is True AND `personal` is False, call `bootstrap_tenant_on_clusters(db, registry, team=team, comment=name)` — adds TeamClusterToken rows.
        - `await db.commit()`.
        - Return team.
    - `async def update_team(db, *, team_id, payload) -> Team`: load row; reject if `personal=True` (D-05 immutable). Allow updating name, is_active, but NOT personal/created_at.
    - `async def delete_team(db, registry, *, team_id) -> None`:
        - Load team; reject if `personal=True` (HTTPException 422 "Personal teams cannot be deleted").
        - **D-04 semantics (option a — letter of the decision):** First check `await db.scalar(select(func.count()).select_from(team_cluster_tokens).where(team_cluster_tokens.c.team_id == team.id))`. If `> 0`, raise `HTTPException(409, detail="Team has active cluster bindings — remove from clusters first (phase-2 endpoint, manual cleanup in v1)")`. The operator must manually remove the team from each cluster (Phase 2 provides a "remove team from cluster" endpoint) before deleting the team.
        - If count is 0: delete TeamClusterToken rows (defensive — should be empty); delete Team row; commit. Do NOT call teardown_tenant_on_clusters here — that path is removed per WARNING 7 fix (no implicit PVE teardown on team delete; admin must explicitly unbind first).
    - `async def add_member(db, *, team_id, user_id)`: insert TeamMembership row; idempotent (catch IntegrityError on PK conflict, return existing).
    - `async def remove_member(db, *, team_id, user_id)`: delete TeamMembership row. If team is personal, reject ("Personal team membership is immutable" per D-05).

    teams/routes.py — Router under prefix `/api/v1/teams`. All routes: `Depends(require_admin) + Depends(csrf_protect)`. Endpoints:
    - `POST /` — body `TeamCreate(name)`. Returns 201 TeamResponse.
    - `GET /` — list of teams (id, name, personal, is_active, member_count).
    - `GET /{team_id}` — TeamDetailResponse with member list.
    - `PATCH /{team_id}` — TeamUpdate.
    - `DELETE /{team_id}` — 204 or 409.
    - `POST /{team_id}/members` — body `{user_id: int}` → 201.
    - `DELETE /{team_id}/members/{user_id}` — 204.

    teams/schemas.py: TeamCreate, TeamUpdate, TeamResponse (id, name, personal, is_active, member_count, created_at), TeamDetailResponse (extends with members: list of UserSummary), MembershipCreate(user_id).

    main.py: Register BootstrapFailed exception handler → 500 with structured body. Include teams_router under `/api/v1/teams`.

    Tests:
    - test_tenant_bootstrap.py: Use respx with multiple cluster registrations (insert 2 Cluster rows pointing at host1, host2 with mocked endpoints). Verify the 5-call-per-cluster shape on success, the rollback (3 calls in: pool+user+token then ANOTHER cluster's create_token fails → 2 deletes per cluster called) on failure, the idempotency on existing-pool error.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_tenant_bootstrap.py -x -v 2>&1 | tail -30 ; python -c "from app.main import app; paths=[r.path for r in app.routes]; assert any('/teams' in p for p in paths); print('OK', sum(1 for p in paths if '/teams' in p), 'team routes')"</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend && python -m pytest tests/test_tenant_bootstrap.py -x` exits 0
    - `grep -q 'bootstrap_state\|bootstrap_state\b' backend/app/teams/bootstrap.py` (tracking dict for rollback)
    - `grep -q 'delete_user\|delete_pool' backend/app/teams/bootstrap.py` (rollback path present)
    - `grep -q 'PVEVMUser' backend/app/teams/bootstrap.py` (correct PVE role per D-02 + D-06)
    - `grep -q 'gui-team-' backend/app/teams/bootstrap.py` (PVE naming convention from CONTEXT discretion)
    - `grep -q 'personal=True\|personal: *True' backend/app/teams/service.py` (D-05 guard)
    - `grep -q 'is_active.*True\|is_active=True' backend/app/teams/bootstrap.py` (only active clusters bootstrap)
    - `cd backend && python -c "from app.main import app; paths=[r.path for r in app.routes]; assert '/api/v1/teams/{team_id}/members' in paths or any('/teams' in p and '/members' in p for p in paths)"` exits 0
    - `grep -q "registry: ConnectorRegistry | None = None" backend/app/teams/service.py` (consistent signature with Plan 07's call site; see WARNING 6 fix)
    - `cd backend && pytest backend/tests/test_teams.py::test_delete_team_with_cluster_bindings_returns_409 -q` exits 0 (WARNING 7 fix; D-04 option-a 409 path)
    - `grep -q "active cluster bindings" backend/app/teams/service.py` (D-04 letter; the 409 detail copy)
  </acceptance_criteria>
  <done>D-02 tenant bootstrap is transactional with PVE-side rollback; team CRUD + membership routes ship; tests verify 5-calls-per-cluster shape and rollback semantics.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| App → PVE cluster | API token (admin-level per D-03); over HTTPS; verify_ssl by default |
| App DB → PVE cluster API token | Stored Fernet-encrypted; decrypted only in connector init |
| Tenant team_id → PVE pool | Pool name = `gui-team-<id>`; ACL scoped to pool; PVE enforces (D-01) |
| Team-create transaction | Spans DB + multiple PVE clusters; partial failure must not leave inconsistent state |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-06-01 | Information disclosure | Cluster API token in API response | mitigate | ClusterResponse schema explicitly omits api_token_secret; tests verify byte-level absence. |
| T-01-06-02 | Tampering | Save invalid token, then "test" fails after | mitigate | Pitfall A4: validate() before INSERT. PATCH with new token validates before update. |
| T-01-06-03 | Information disclosure | Decrypted token leaked to log | mitigate | EncryptedSecret never logs values; structlog config (Phase 5) adds redaction. Connector logs only host:port. |
| T-01-06-04 | Tampering | Partial tenant bootstrap leaves orphan PVE objects | mitigate | bootstrap_tenant_on_clusters tracks bootstrap_state and rolls back PVE side (best-effort) on any failure. Test verifies. |
| T-01-06-05 | Elevation of privilege | Single super-token used for all tenants (anti-pattern) | mitigate | D-01: per-tenant privilege-separated tokens; super-token is registration-only. Each team has its own token in team_cluster_tokens. Phase 2's connector layer will use the per-team token, not the registration token, when reading on behalf of a tenant user. |
| T-01-06-06 | Information disclosure | Multi-cluster cross-tenant leak via shared connector cache | mitigate | Registry keyed by cluster_id; connector uses CLUSTER-WIDE registration token (not tenant token). Phase 2 will add a SEPARATE per-(team, cluster) connector path for tenant-scoped reads. |
| T-01-06-07 | Tampering | Concurrent team create with the same name → race | mitigate | teams.name has UNIQUE constraint; the second INSERT raises IntegrityError → 409 "team name already exists". |
| T-01-06-08 | Denial of service | PVE down during team create | mitigate | bootstrap_tenant_on_clusters fails fast on PVEUnreachable; rollback; 500 returned with cluster name for retry. |
| T-01-06-09 | Information disclosure | Token in PATCH request body via URL log | mitigate | uvicorn `--no-access-log` (set in systemd unit Plan 04); Caddy access log omitted by default. Body never appears in URL. |
| T-01-06-10 | Spoofing | TLS fingerprint mismatch silently accepted | accept (deferred) | Phase 1 stores fingerprint but does not enforce it (NotImplementedError thrown if combined with verify_ssl=False). Phase 5 implements pinning. Documented limitation. |
| T-01-06-11 | Repudiation | No audit log entry on cluster registration | accept (Phase 2 writer) | audit_log schema exists; writer ships in Phase 2. Phase 1 cluster registration is admin-only and inherently trusted. |
| T-01-06-12 | Tampering | bootstrap_tenant rollback deletes the WRONG PVE user (name collision) | accept | Pool/user names use `gui-team-<id>` — id is DB autoincrement, unique per install. Operators warned in deploy/README.md to avoid manually creating PVE users matching `gui-team-*`. |
| T-01-06-13 | Elevation of privilege | Registration token revoked → bootstrap on existing team breaks | accept | If admin rotates the registration token without coordinating, future team creates fail. Surfaced clearly as 422 "Proxmox rejected that token" on the next create attempt. Phase 5 polish could add a "test all clusters" admin button. |

ASVS L1 mappings:
- V8.3 (data at rest) → Fernet via EncryptedSecret on clusters.api_token_secret + team_cluster_tokens.token_secret
- V13.1 (privilege separation) → per-tenant privsep PVE tokens (D-01)
- V13.2 (least privilege at API layer) → tenant tokens scoped to a single pool via PVEVMUser role
- V14.2 (third-party trust) → Proxmox API trusted via verify_ssl by default; fingerprint pinning deferred
</threat_model>

<verification>
- `cd backend && python -m pytest tests/test_connector.py tests/test_clusters.py tests/test_tenant_bootstrap.py -x -v` exits 0
- All acceptance-criteria greps pass
- `cd backend && python -c "from app.main import app; print(len([r for r in app.routes if '/clusters' in getattr(r,'path','') or '/teams' in getattr(r,'path','')]))"` shows 15+
</verification>

<success_criteria>
Admins can register Proxmox clusters; tokens are validated before persist and stored encrypted. Admins can create shared teams; tenant bootstrap creates PVE pool + user + privilege-separated token + ACL on every active cluster; failures roll back. Team membership add/remove works. Plan 07's setup flow can register the first admin's personal team without bootstrapping (zero clusters). Plan 08's UI can drive the cluster + team admin pages.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-06-SUMMARY.md` documenting:
- Cluster + team routes (full list)
- PVE naming conventions used (gui-team-{id}, @pve realm, "api" tokenid)
- ACL role assigned (PVEVMUser on pool, propagate=1)
- Bootstrap rollback semantics tested
- Test count + pass/fail
- Assumption A6 from research (admin-level token permissions) — note status: requires manual verification against a real PVE cluster before Phase 2 (Plan 06's success_criteria already calls this out)
- Phase 2 followups: tenant-scoped read connector path; real inventory check on team delete
</output>
