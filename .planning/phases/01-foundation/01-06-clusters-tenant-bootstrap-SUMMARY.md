---
phase: 01-foundation
plan: 06
subsystem: clusters
tags:
  - backend
  - clusters
  - proxmoxer
  - multi-tenant
  - tenant-bootstrap
  - asyncio
  - tdd

# Dependency graph
requires:
  - phase: 01-01-backend-scaffold
    provides: "EncryptedSecret TypeDecorator, SecretCipher, get_db, app factory"
  - phase: 01-02-db-schema
    provides: "Cluster, Team, TeamMembership, TeamClusterToken, User models"
  - phase: 01-05-auth-subsystem
    provides: "require_admin, csrf_protect, Principal — admin-gating + CSRF dependency"
provides:
  - "PVEConnector wrapping proxmoxer with asyncio.to_thread (Pitfall A3)"
  - "PVEConnectorRegistry — lazy per-cluster connector cache, invalidated on edit/delete"
  - "POST /api/v1/clusters/test — dry-run validate (no DB write) for the admin Test button"
  - "Cluster CRUD — register / list / get / patch / re-test / delete (admin-only)"
  - "validate-before-persist on register + patch-with-new-token (Pitfall A4)"
  - "PVE exception handlers (PVEUnreachable→502, PVEAuthError→422, PVEAPIError→502)"
  - "BootstrapFailed exception handler → 500 with cluster_name in detail"
  - "D-02 tenant bootstrap — pool + user + privsep token + ACL on every active cluster"
  - "Best-effort PVE rollback on partial bootstrap failure (T-01-06-04)"
  - "Team CRUD + membership add/remove (admin-only)"
  - "D-04 option-a delete-team gate (409 on active cluster bindings)"
  - "D-05 personal-team immutability (POST personal=True → 422; DELETE personal → 422)"
  - "create_team(registry: ConnectorRegistry | None = None, ...) — Plan-07-friendly signature"
affects:
  - 01-07-users-admin-setup (uses create_team(registry=None) for the first-run admin's personal team)
  - 01-10-frontend-admin (consumes the cluster + team admin endpoints via OpenAPI)
  - 02-* (per-tenant connector path on top of TeamClusterToken; cluster reachability probe)

# Tech tracking
tech-stack:
  added: []   # No new top-level deps — proxmoxer + sqlalchemy already in Plan 01.
  patterns:
    - "PVEConnector: asyncio.to_thread bridges sync proxmoxer; one _call helper enforces uniformity"
    - "PVEConnectorRegistry: dict-cache keyed by cluster_id; invalidate(id) on edit/delete"
    - "Validate-before-persist: every cluster INSERT or token-changing PATCH validates first (Pitfall A4)"
    - "EncryptedSecret column never logged or returned — write-only schemas; ClusterResponse omits api_token_secret"
    - "FakeProxmox test double: chained-attribute recording fake replaces ProxmoxAPI in tests (proxmoxer uses requests; respx is httpx-only)"
    - "bootstrap_state dict tracks per-cluster (pool_created, user_created, token) for rollback dispatch"
    - "Registry.get(db=...) accepts caller-supplied session for read-your-writes inside an open transaction"
    - "Pydantic ConfigDict(extra='forbid') on TeamCreate enforces D-05 personal=True rejection at the schema layer"

key-files:
  created:
    - backend/app/clusters/__init__.py
    - backend/app/clusters/connector.py
    - backend/app/clusters/errors.py
    - backend/app/clusters/registry.py
    - backend/app/clusters/routes.py
    - backend/app/clusters/schemas.py
    - backend/app/clusters/service.py
    - backend/app/teams/__init__.py
    - backend/app/teams/bootstrap.py
    - backend/app/teams/routes.py
    - backend/app/teams/schemas.py
    - backend/app/teams/service.py
    - backend/tests/fixtures/__init__.py
    - backend/tests/fixtures/pve_responses.py
    - backend/tests/test_clusters.py
    - backend/tests/test_connector.py
    - backend/tests/test_teams.py
    - backend/tests/test_tenant_bootstrap.py
    - .planning/phases/01-foundation/deferred-items.md
  modified:
    - backend/app/main.py

key-decisions:
  - "FakeProxmox over respx: proxmoxer 2.3 uses sync `requests`, not httpx; respx cannot intercept it. The plan's <important_constraints> explicitly calls for the FakeProxmox approach."
  - "Registry.get(db=...) optional caller session: in-memory SQLite + connection-isolation breaks the registry's separate-session pattern when the outer transaction has only flushed (not committed). The optional db= param is also the right read-your-writes idiom in production."
  - "ClusterResponse explicitly omits api_token_secret (T-01-06-01) — write/read schemas are SEPARATE classes, not the same class with field-exclusion. Keeps the type-system contract honest."
  - "Routes: POST /api/v1/clusters/test (dry-run) registered BEFORE POST /api/v1/clusters/{id}/test — FastAPI's path matcher would otherwise route /test to {cluster_id}=test (int_parsing 422)."
  - "Bootstrap ordering inside one cluster: create_pool → create_user → create_token → set_pool_acl. ACL is intentionally LAST so a failed token-mint leaves no orphan ACL pointing at a non-existent user."
  - "Rollback ordering: delete_user FIRST, delete_pool SECOND. PVE deletes the user's ACLs cascade with the user — pool is then safe to delete without dangling references."
  - "BootstrapFailed.cluster_name field exposed for the FastAPI handler so the 500 response identifies the failing cluster — operators can fix and retry without grep'ing logs."
  - "TeamCreate uses ConfigDict(extra='forbid') so personal=True is rejected at validation time. Defense in depth on top of the service-layer 422."
  - "Bootstrap exception path explicitly calls db.rollback() in create_team BEFORE re-raising — get_db's on-exception rollback would otherwise interact with the bootstrap's PVE rollback timing."
  - "Cipher arg on PVEConnectorRegistry.__init__ is currently unused (EncryptedSecret transparently decrypts at row-load time). Kept as a stable injection point for Phase 2's tenant-scoped registry variant."

patterns-established:
  - "Adapter wrap: PVEConnector wraps proxmoxer; future adapters (e.g. arq job runner in Phase 3) follow the same _call/asyncio.to_thread pattern."
  - "Registry/cache pattern: every per-tenant resource (Phase 2's per-(team,cluster) connector, Phase 4's noVNC connection pool) follows the same lazy-cache + invalidate(id) shape."
  - "Test double for sync 3rd-party clients: when the upstream library uses requests / urllib3 / blocking IO, prefer a recording fake at the class boundary over an HTTP-level mocker. respx-equivalent for requests is `responses`, but a class-level fake is more readable for chained-attribute APIs like proxmoxer."
  - "Validate-before-persist as a service-layer invariant: every external-system token/credential write goes through a validate() pass first."
  - "Schema separation: write schema(s) carry secrets; read schema (Response) explicitly does not. No `Field(exclude=...)` magic."

requirements-completed:
  - CLUST-01  # Admin can register Proxmox clusters
  - CLUST-05  # Cluster context in every resource URL (/api/v1/clusters/{id}/...)
  - CLUST-06  # Works with single-node and clustered PVE (manual probe via POST /{id}/test)
  - AUTH-08   # Admin assign users to teams (membership add/remove + auto-bootstrap)

# Metrics
duration: ~21min
completed: 2026-05-14
---

# Phase 01 Plan 06: Clusters + Tenant Bootstrap Summary

**Per-cluster Proxmox connector (proxmoxer wrapped in asyncio.to_thread) + admin cluster CRUD with validate-before-persist + dry-run /test endpoint + D-02 tenant bootstrap (pool + user + privsep token + PVEVMUser ACL on every active cluster, with best-effort PVE rollback on partial failure) + team CRUD with D-04 delete-blocked-on-bindings gate + admin-only membership add/remove. 42 new tests; total 132 pass; ruff clean.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-05-14T04:14:54Z
- **Completed:** 2026-05-14T04:36:05Z
- **Tasks:** 2 (both `type=auto` + `tdd=true`)
- **Commits:** 4 (test → feat → test → feat; TDD RED→GREEN per task)
- **Files created:** 18 (12 backend modules + 5 test files + 1 deferred-items.md)
- **Files modified:** 1 (`app/main.py` for handlers + router includes)

## Accomplishments

- **PVEConnector** (`app/clusters/connector.py`): wraps `proxmoxer.ProxmoxAPI` with `await asyncio.to_thread(...)` (Pitfall A3 — non-negotiable). Methods: `version`, `validate`, `create_pool`, `delete_pool`, `create_user`, `delete_user`, `create_token`, `set_pool_acl`. `tls_fingerprint + verify_ssl=False` raises `NotImplementedError` (Phase 5 polish).
- **PVEConnectorRegistry** (`app/clusters/registry.py`): per-cluster lazy connector cache. `get(cluster_id, *, db=None)` builds a connector from the (decrypted) cluster row, caches it, returns it. `invalidate(id)` drops cache. `clear_all()` for tests. The optional `db=` parameter lets callers re-use their open session (read-your-writes; also a hard requirement for in-memory SQLite test isolation).
- **Cluster CRUD** (`app/clusters/{service,routes,schemas}.py`):
  - `POST /api/v1/clusters/test` — dry-run validate (NO DB write) for the admin Test button.
  - `POST /api/v1/clusters/` — validate-before-persist (Pitfall A4); returns `ClusterResponse` with NO `api_token_secret`.
  - `GET /api/v1/clusters/` — list.
  - `GET /api/v1/clusters/{id}` — read one.
  - `PATCH /api/v1/clusters/{id}` — preserves token unless `api_token_secret` provided; re-validates if so; always invalidates registry cache.
  - `POST /api/v1/clusters/{id}/test` — re-validate stored token.
  - `DELETE /api/v1/clusters/{id}` — 204 or 409 if any `team_cluster_tokens` row binds the cluster.
- **PVE exception handlers** in `app/main.py`: `PVEUnreachable→502`, `PVEAuthError→422`, `PVEAPIError→502`, `BootstrapFailed→500` with structured `{detail: "Tenant bootstrap failed on cluster '<name>': ..."}`.
- **D-02 tenant bootstrap** (`app/teams/bootstrap.py`): `bootstrap_tenant_on_clusters(db, registry, *, team, comment)` mints, on every active cluster, in order: `create_pool('gui-team-<id>')` → `create_user('gui-team-<id>@pve')` → `create_token(privsep=True)` → `set_pool_acl(role='PVEVMUser', propagate=1)` → `team_cluster_tokens` row insert (Fernet-encrypted token). On failure: `bootstrap_state` dict tracks per-cluster (pool_created, user_created, token) and `_rollback_pve_state` walks every cluster touched, calling `delete_user` then `delete_pool`, each wrapped in try/except + log. Re-raises `BootstrapFailed(cluster_name, original)`.
- **Team CRUD** (`app/teams/{service,routes,schemas}.py`):
  - `POST /api/v1/teams/` — admin-only; auto-bootstraps on every active cluster (D-02). `personal=True` rejected at schema (`extra=forbid`) AND service layers.
  - `GET /api/v1/teams/` / `GET /api/v1/teams/{id}` — list (with `member_count`) / detail (with `members`).
  - `PATCH /api/v1/teams/{id}` — name + is_active only; personal teams reject (D-05).
  - `DELETE /api/v1/teams/{id}` — **D-04 option-a (WARNING-7 fix):** 409 if `team_cluster_tokens` rows exist, with message "Team has active cluster bindings — remove from clusters first (phase-2 endpoint, manual cleanup in v1)". Personal teams 422.
  - `POST/DELETE /api/v1/teams/{id}/members[/{user_id}]` — idempotent add/remove; reject on personal team (D-05).
- **Plan-07-friendly signature:** `create_team(db, registry: ConnectorRegistry | None = None, *, name, personal=False, _internal=False, auto_bootstrap=True)`. Plan 07's `create_initial_admin` can call it with `registry=None` when no clusters are registered yet.

## Routes Shipped

### Clusters (7 method-distinct endpoints)

| Method | Path                                  | Description                                    |
|--------|---------------------------------------|------------------------------------------------|
| POST   | `/api/v1/clusters/test`               | Dry-run validate (NO DB write)                 |
| POST   | `/api/v1/clusters/`                   | Register cluster (validate-before-persist)     |
| GET    | `/api/v1/clusters/`                   | List clusters                                  |
| GET    | `/api/v1/clusters/{cluster_id}`       | Read cluster                                   |
| PATCH  | `/api/v1/clusters/{cluster_id}`       | Patch cluster                                  |
| POST   | `/api/v1/clusters/{cluster_id}/test`  | Re-validate stored token (CLUST-06 manual)     |
| DELETE | `/api/v1/clusters/{cluster_id}`       | Delete (409 if bound)                          |

### Teams (7 method-distinct endpoints)

| Method | Path                                                | Description                            |
|--------|-----------------------------------------------------|----------------------------------------|
| POST   | `/api/v1/teams/`                                    | Create + auto-bootstrap (D-02)         |
| GET    | `/api/v1/teams/`                                    | List teams                             |
| GET    | `/api/v1/teams/{team_id}`                           | Read team + members                    |
| PATCH  | `/api/v1/teams/{team_id}`                           | Patch (name / is_active)               |
| DELETE | `/api/v1/teams/{team_id}`                           | Delete (409 if bound, 422 if personal) |
| POST   | `/api/v1/teams/{team_id}/members`                   | Add member (idempotent)                |
| DELETE | `/api/v1/teams/{team_id}/members/{user_id}`         | Remove member                          |

**Total: 14 method-distinct endpoints across `/api/v1/clusters` + `/api/v1/teams`.**

## PVE Naming Conventions Used

Per CONTEXT.md "Discretion" + Plan 06:

- **Pool:** `gui-team-<team_id>` (D-06)
- **User:** `gui-team-<team_id>@pve` (the `@pve` realm is the GUI's local-realm convention)
- **Token id:** `api` (so the full PVE-side token name is `gui-team-<id>@pve!api`)
- **Pool ACL role:** `PVEVMUser` (D-02 + D-06 — least privilege)
- **ACL path:** `/pool/gui-team-<team_id>` with `propagate=1`
- **Comment:** `"GUI tenant <team_name>"` on both pool and user

## Bootstrap Rollback Semantics (Tested)

When ANY step fails on ANY cluster:

1. Outer DB transaction rolls back (Team row + any partial TeamClusterToken rows discarded).
2. Best-effort PVE cleanup walks every cluster in `bootstrap_state` (i.e. every cluster the bootstrap touched, including the failing one):
   - If `user_created` is True → `delete_user(userid)` (try/except, log warning on failure)
   - If `pool_created` is True → `delete_pool(poolid)` (try/except, log warning)
3. Re-raise `BootstrapFailed(cluster_name=..., original=...)` → handler returns 500 with `{detail: "Tenant bootstrap failed on cluster '<name>': <orig>"}`.

This is verified end-to-end by `test_bootstrap_rolls_back_on_partial_failure` — the second cluster's `create_token` is wired to raise; the test asserts (a) zero `team_cluster_tokens` rows, (b) BOTH clusters got `delete_user` + `delete_pool`, (c) the exception identifies the failing cluster name.

## Task Commits

Each task committed atomically with TDD RED→GREEN discipline:

1. **Task 1 RED — failing connector + cluster route tests** — `a99ff11` (test)
2. **Task 1 GREEN — connector + registry + cluster CRUD + handlers** — `7248247` (feat)
3. **Task 2 RED — failing tenant-bootstrap + team CRUD tests** — `5195945` (test)
4. **Task 2 GREEN — bootstrap + team CRUD + membership routes** — `2103697` (feat)

**Plan metadata commit:** TBD (this commit) — captures SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md.

## Files Created/Modified

### Cluster package (`backend/app/clusters/`)

- `__init__.py` — package marker + module roadmap docstring
- `connector.py` — `PVEConnector` with `_call` → `asyncio.to_thread`; eight methods (version, validate, create_pool, delete_pool, create_user, delete_user, create_token, set_pool_acl); raises `PVEAuthError`/`PVEUnreachable`/`PVEAPIError` instead of leaking proxmoxer exceptions
- `errors.py` — `PVEUnreachable`, `PVEAuthError`, `PVEAPIError(status_code, body)`
- `registry.py` — `PVEConnectorRegistry(cipher, session_factory)` with `get(cluster_id, *, db=None)`, `invalidate(id)`, `clear_all()`
- `routes.py` — admin-only router with 7 method-distinct endpoints; `get_registry(request)` dependency reads from `app.state.registry`, builds on-demand if absent (test harness path)
- `schemas.py` — `ClusterCreate`/`ClusterUpdate`/`ClusterResponse`/`ClusterTestRequest`/`ClusterTestResponse`; URL-prefix-in-host validator + `name@(pam|pve)` validator on `token_user`
- `service.py` — `test_cluster`, `register_cluster`, `validate_token`, `update_cluster`, `delete_cluster`, `list_clusters`, `get_cluster`; all validate-before-persist where a token is set/changed

### Team package (`backend/app/teams/`)

- `__init__.py` — package marker + decision-boundary docstring
- `bootstrap.py` — `BootstrapResult` dataclass, `BootstrapFailed` exception, `bootstrap_tenant_on_clusters`, `_rollback_pve_state`, `teardown_tenant_on_clusters`
- `schemas.py` — `TeamCreate` (extra=forbid), `TeamUpdate`, `TeamResponse`, `TeamDetailResponse`, `MembershipCreate`, `UserSummary`
- `service.py` — `create_team` (Plan-07-friendly signature), `update_team`, `delete_team` (D-04), `list_teams`, `get_team_with_members`, `add_member`, `remove_member`
- `routes.py` — admin-only router with 7 method-distinct endpoints (CRUD + member add/remove)

### Tests (`backend/tests/`)

- `fixtures/__init__.py` — package marker
- `fixtures/pve_responses.py` — `FakeProxmox` chained-attribute recording test double + canned response payloads + exception factories (auth_error / connection_error / pve_api_error / pool_exists_error)
- `test_connector.py` — 13 tests: version, asyncio.to_thread spy, validate {success / auth / unreachable / api}, create_pool/delete_pool, create_user/delete_user, create_token (privsep), set_pool_acl, tls_fingerprint guard
- `test_clusters.py` — 15 tests: admin gate, schema validators, validate-before-persist (no row on bad token), encrypted-at-rest BLOB, GET never returns token, dry-run /test (valid/invalid/unreachable/no DB write), POST /{id}/test, PATCH preserve / re-validate, DELETE 409-on-binding, registry-invalidate
- `test_tenant_bootstrap.py` — 5 tests: 0-cluster no-op, 4-5 PVE calls per cluster on success, PVE naming, partial-failure rollback (BOTH clusters cleaned), pool-collision treated as BootstrapFailed
- `test_teams.py` — 9 tests: personal=True → 422, 0-cluster create succeeds, admin gate, list with member_count, DELETE 409 (acceptance gate), DELETE 204, DELETE personal → 422, member add/remove + idempotency, remove from personal → 422

### Modified

- `backend/app/main.py` — added `app.state.registry` to lifespan; registered four exception handlers (3 PVE + 1 BootstrapFailed); included `clusters_router` and `teams_router`

## Decisions Made

- **FakeProxmox over respx for proxmoxer mocking.** proxmoxer 2.3 is built on synchronous `requests`, which `respx` (httpx-only) cannot intercept. The plan body's `<important_constraints>` already directs us to "mock the proxmoxer ProxmoxAPI class with a FakeProxmox that records calls" — implemented as a chained-attribute recording fake that mirrors proxmoxer's `client.access.users("u").token("api").post(privsep=1)` shape and dispatches against a `responses` dict keyed by dotted-path strings.
- **`PVEConnectorRegistry.get(*, db=None)` accepts a caller-supplied session.** During bootstrap, the outer transaction has only `flushed` (not committed) the team row; the registry's separate connection (default behavior) cannot see the new row in test environments (in-memory SQLite + connection isolation) — and even in production this is the correct read-your-writes semantics for a long-running multi-cluster transaction.
- **`ClusterResponse` is a separate class (not `ClusterCreate` with `Field(exclude=...)`).** Type-system contract: the response model can never accidentally include `api_token_secret`. Greps stay honest. T-01-06-01 mitigation.
- **Route order matters.** `POST /api/v1/clusters/test` (dry-run) is declared BEFORE `POST /api/v1/clusters/{cluster_id}/test`. FastAPI's path matcher is order-sensitive — the int-coerced `{cluster_id}` would otherwise eat the literal `/test` segment and yield `int_parsing` 422.
- **Bootstrap step ordering inside one cluster.** `create_pool → create_user → create_token → set_pool_acl`. ACL is intentionally LAST so a token-mint failure leaves no orphan ACL pointing at a non-existent user. Rollback ordering is the inverse: `delete_user` first (PVE cascades the user's ACLs); `delete_pool` second.
- **`TeamCreate` uses `ConfigDict(extra="forbid")`.** Defense-in-depth: `personal=True` is rejected at the pydantic validator AND at the service layer. Either gate alone would suffice; both keep the contract tight.
- **`create_team` accepts `registry: ConnectorRegistry | None = None`.** WARNING-6 fix per the plan: Plan 07's first-run admin path needs to create a personal team without a registry when zero clusters are registered yet. Service raises if registry is None AND active clusters exist AND auto_bootstrap is True (developer-error guard).
- **`delete_team` does NOT call `teardown_tenant_on_clusters`.** D-04 letter / WARNING-7 fix: operator must explicitly unbind via a Phase-2 endpoint before delete. We ship `teardown_tenant_on_clusters` for symmetry / Phase-2 use but never invoke it from this plan's delete path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Registry's separate session couldn't see flushed-uncommitted rows in tests**

- **Found during:** Task 2 GREEN, running `test_bootstrap_makes_5_calls_per_cluster_on_success` after wiring the bootstrap.
- **Issue:** `bootstrap_tenant_on_clusters` flushes a Team row in the outer session, then loops calling `await registry.get(cluster.id)`. The registry default opens its own session (separate connection). With aiosqlite + in-memory SQLite, that separate connection cannot see uncommitted writes from the outer connection — and worse, when the inner session closes it `rollback`s the connection, which (since the in-memory pool routes both to the same physical connection in some configurations) wipes the outer session's uncommitted INSERT. Result: outer session sees zero rows on commit, `db.refresh(team)` raises `InvalidRequestError: Could not refresh instance`.
- **Fix:** Added an optional `db` parameter to `PVEConnectorRegistry.get(cluster_id, *, db=None)`. Bootstrap passes `db=db` so the cluster row is loaded through the outer transaction (read-your-writes). The default behavior (open own session) is unchanged for callers like the routes that always operate inside a single request session.
- **Why this is also right in production:** Even with a real Postgres backend, the bootstrap operation inserts a TeamClusterToken row through the outer transaction and reads it back transactionally. Forcing a separate session would break the read-your-writes idiom and require a commit-then-read dance that's harder to reason about.
- **Files modified:** `backend/app/clusters/registry.py` (added `db` param), `backend/app/teams/bootstrap.py` (passes `db=db` from `bootstrap_tenant_on_clusters` and `_rollback_pve_state` and `teardown_tenant_on_clusters`).
- **Committed in:** `2103697` (Task 2 GREEN).

**2. [Rule 3 - Blocking] ruff auto-fixes (I001, F401, UP035, F841)**

- **Found during:** Final ruff verification at end of each task.
- **Issue:** Stylistic / unused-import errors flagged by ruff after each green commit. 9 fixable in Task 1 + 4 fixable in Task 2; one F841 (unused `admin_id` variable in `test_clusters.py` and unused `rows` variable in `test_tenant_bootstrap.py`) required a manual one-line edit because ruff's F841 fix is hidden behind --unsafe-fixes.
- **Fix:** `ruff check . --fix` for the auto-fixables; manual two-line edit for the unused locals.
- **Files modified:** `backend/app/clusters/service.py`, `backend/tests/fixtures/pve_responses.py`, `backend/tests/test_clusters.py`, `backend/tests/test_teams.py`, `backend/tests/test_tenant_bootstrap.py`.
- **Committed in:** rolled into the same GREEN commits (`7248247` and `2103697`).

**3. [Out of scope] Pre-existing flake in `tests/test_jwt.py::test_decode_tampered_signature_raises`**

- **Found during:** Final full-suite run with `-x`.
- **Issue:** The test from Plan 01 flips the LAST char of a base64url JWT signature between "A" and "B"; depending on the original signature's padding the bytes can decode to a still-valid signature. ~3/5 pass rate locally.
- **Action:** NOT fixed (out of scope per deviation Rule scope-boundary). Logged to `.planning/phases/01-foundation/deferred-items.md` for a follow-up auth-touching plan.

---

**Total deviations:** 3 (1 Rule-1 bug, 1 Rule-3 blocking, 1 out-of-scope deferred).
**Impact on plan:** Zero scope change. The Rule-1 bug fix is a correctness improvement that benefits production too (read-your-writes semantics).

## Threat-Model Conformance

| Threat ID    | Disposition                | Implemented in this plan                                                                                                              |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T-01-06-01   | mitigate                   | `ClusterResponse` schema explicitly omits `api_token_secret`; `test_get_clusters_never_returns_decrypted_token` and `test_post_with_valid_token_persists_encrypted` verify byte-level absence in the response and the encrypted-at-rest BLOB. |
| T-01-06-02   | mitigate                   | `register_cluster` and `update_cluster` (when token changes) call `connector.validate()` BEFORE the INSERT/UPDATE — Pitfall A4. Tests `test_post_with_failing_token_validation_returns_422_and_no_row` and `test_patch_with_new_token_revalidates` verify. |
| T-01-06-03   | mitigate                   | `EncryptedSecret` decrypts the token only during the connector init; the connector itself never logs the value. Module logging is structured (host:port only). |
| T-01-06-04   | mitigate                   | `bootstrap_state` dict + `_rollback_pve_state` cleanup; `BootstrapFailed` raises. Test `test_bootstrap_rolls_back_on_partial_failure` verifies BOTH clusters get `delete_user`+`delete_pool` after one's `create_token` fails. |
| T-01-06-05   | mitigate                   | D-01 enforced: `create_token(privsep=True)` mints privilege-separated tokens; `set_pool_acl` grants only `PVEVMUser` on the team's pool. The bootstrap (admin-level) token is used here ONLY for provisioning. Phase 2 will add a separate per-(team,cluster) connector path that uses the per-tenant token. |
| T-01-06-06   | mitigate                   | Registry is keyed by `cluster_id` and uses the cluster-wide bootstrap token. Phase-2 will add a separate per-(team,cluster) registry path; Phase 1 surface is admin-only. |
| T-01-06-07   | mitigate                   | `teams.name` UNIQUE constraint catches concurrent creates → IntegrityError → 409 "team name already exists". `test_post_team_zero_clusters_succeeds` exercises a normal create; the dup path is implicit but the IntegrityError handler is in `create_team`. |
| T-01-06-08   | mitigate                   | `bootstrap_tenant_on_clusters` fails fast on `PVEUnreachable` (catches at the connector layer); rolls back DB and re-raises `BootstrapFailed`. The 500 response identifies the failing cluster for retry. |
| T-01-06-09   | mitigate                   | Token field appears only in request bodies; uvicorn `--no-access-log` is the systemd unit default (Plan 04). The token never appears in URL params. |
| T-01-06-10   | accept (deferred to P-05)  | `tls_fingerprint` field is stored on `Cluster` but the connector raises `NotImplementedError` if combined with `verify_ssl=False` so operators cannot believe pinning is active. Phase 5 implements full TOFU pinning. |
| T-01-06-11   | accept (Phase 2 writer)    | `audit_log` schema is present (Plan 02); writer ships in Phase 2. Phase-1 cluster admin is inherently trusted (admin-only routes, no audit consumer yet). |
| T-01-06-12   | accept                     | Pool/user names are `gui-team-<id>` where `id` is DB autoincrement, unique per install. Operators warned in the inline service docstring. |
| T-01-06-13   | accept                     | If admin rotates the bootstrap token without coordinating, future team creates fail with 422 "Proxmox rejected that token". Surfaced clearly. |

## Issues Encountered

- **Connection-isolation bug in tests** (covered in Deviation #1). aiosqlite + in-memory SQLite + multi-session in a single test produced subtle "row disappears on outer commit" symptoms because the inner session's connection close called rollback. The fix (optional `db=` on `registry.get`) is also correct production semantics.
- **FakeProxmox path-extending semantics** required care. `client.pools('gui-team-1').delete()` becomes the dotted path `pools.gui-team-1.delete`; `client.access.users('u@pve').token('api').post(privsep=1)` becomes `access.users.u@pve.token.api.post`. The `_Node` class uses `_HTTP_METHODS = {get, post, put, delete}` to distinguish "extend the path with this positional arg" from "this is the HTTP-verb leaf call".
- **Ruff `extra="forbid"` interaction with FastAPI 422.** When a client posts `{"name": "x", "personal": true}` to `POST /api/v1/teams/`, pydantic raises `ValidationError` because `personal` is an "extra" field. FastAPI maps this to 422 automatically; no custom handler needed.

## Verification Results

| Check                                                                                  | Result                                                          |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `cd backend && python -m pytest tests/test_connector.py tests/test_clusters.py -x -v`  | **28 passed**                                                   |
| `cd backend && python -m pytest tests/test_tenant_bootstrap.py -x -v`                  | **5 passed**                                                    |
| `cd backend && python -m pytest tests/test_teams.py -x -v`                             | **9 passed**                                                    |
| `cd backend && python -m pytest -q` (full suite)                                       | **132 passed, 5 warnings**                                      |
| `cd backend && ruff check .`                                                           | **All checks passed**                                           |
| `cd backend && pytest tests/test_teams.py::test_delete_team_with_cluster_bindings_returns_409 -q` | **1 passed** (D-04 acceptance gate)                  |
| `grep -q 'asyncio.to_thread' app/clusters/connector.py`                                | OK                                                              |
| `grep -q 'PVEAuthError' app/clusters/errors.py`                                        | OK                                                              |
| `grep -q 'validate()' app/clusters/service.py`                                         | OK                                                              |
| `grep -q 'invalidate' app/clusters/registry.py`                                        | OK                                                              |
| `grep -q 'EncryptedSecret' app/models/cluster.py`                                      | OK (preserved from Plan 02)                                     |
| `grep -q 'http://' app/clusters/schemas.py`                                            | OK (URL-prefix validator)                                       |
| `grep -q 'ClusterTestRequest' app/clusters/schemas.py`                                 | OK                                                              |
| `grep -q 'test_cluster' app/clusters/service.py`                                       | OK                                                              |
| `python -c "...; assert '/api/v1/clusters/test' in paths"`                             | OK (dry-run endpoint present)                                   |
| `python -c "...; assert '/api/v1/clusters/{cluster_id}/test' in paths"`                | OK (re-validate endpoint present)                               |
| `grep -q 'bootstrap_state' app/teams/bootstrap.py`                                     | OK                                                              |
| `grep -q 'delete_user\|delete_pool' app/teams/bootstrap.py`                            | OK (rollback path)                                              |
| `grep -q 'PVEVMUser' app/teams/bootstrap.py`                                           | OK (D-02 + D-06 role)                                           |
| `grep -q 'gui-team-' app/teams/bootstrap.py`                                           | OK (PVE naming)                                                 |
| `grep -q 'personal=True' app/teams/service.py`                                         | OK (D-05 guard)                                                 |
| `grep -q 'is_active.*True' app/teams/bootstrap.py`                                     | OK (only active clusters)                                       |
| `grep -q "registry: ConnectorRegistry | None = None" app/teams/service.py`             | OK (WARNING-6 signature)                                        |
| `grep -q "active cluster bindings" app/teams/service.py`                               | OK (D-04 letter)                                                |
| Live route inspection: clusters + teams routes                                         | 14 method-distinct endpoints across `/api/v1/clusters` + `/api/v1/teams` |

## Assumption A6 Status

The plan's Assumption A6 from research — admin-level token permissions (`User.Modify`, `Pool.Allocate`, `Realm.Allocate`, `Sys.Audit` at `/`) — is **NOT verified** against a live PVE cluster in this plan. Plan 06 mocks the entire PVE surface via `FakeProxmox`. Manual verification against a real PVE 8.x cluster MUST happen before Phase 2 begins consuming the per-tenant tokens for inventory/lifecycle reads. Documented requirement: the operator's bootstrap token needs the four permissions above; if any is missing, `create_pool` / `create_user` / `create_token` / `set_pool_acl` will fail with `PVEAPIError` and the team-create flow surfaces a `BootstrapFailed` 500 with the cluster name.

## Phase 2 Followups

These are intentionally out of scope for Plan 06 but documented here so Phase 2's planner has a stable reference:

1. **Tenant-scoped read connector path.** Today's `PVEConnectorRegistry` uses the cluster-wide bootstrap (admin) token for every cluster. Phase 2 needs a SECOND registry variant keyed by `(team_id, cluster_id)` that uses the row from `team_cluster_tokens`. The connector class itself doesn't need to change — only how the registry constructs it.
2. **Real inventory check on team delete.** Today's `delete_team` returns 409 only if `team_cluster_tokens` rows exist. The full D-04 specification ALSO requires refusing delete when the tenant owns any VMs/LXCs. Phase 2's per-cluster inventory data lets us add that check.
3. **Cluster reachability probe + read-only banner** (CLUST-03 / CLUST-04). Today we only do manual probe via `POST /api/v1/clusters/{id}/test`. Phase 2 ships the periodic probe + UI banner.
4. **TOFU TLS fingerprint enforcement** (T-01-06-10). Today we store the fingerprint and refuse the `verify_ssl=False + fingerprint` combo; Phase 5 implements actual pinning.
5. **Audit-log writer integration** (T-01-06-11). Cluster register / team create / membership add/remove all need audit entries. Schema is present (Plan 02); writer ships in Phase 2.

## User Setup Required

None — Plan 06 is pure backend code, fully tested against mocked PVE. The operator-visible cluster registration flow ships in Plan 10 (frontend admin UI).

For local development:

- No additional `.env` changes beyond Plan 01's defaults.
- No PVE cluster needed for any test; `FakeProxmox` covers the entire surface.

## Hooks Exposed for Later Plans

- `app.clusters.connector.PVEConnector` — Phase 2/3 add read/write methods on top of this class
- `app.clusters.registry.PVEConnectorRegistry` — Phase 2 wraps with a per-tenant variant
- `app.clusters.service.test_cluster` — Plan 10 admin "Test" button consumes
- `app.teams.service.create_team(registry=None, ...)` — Plan 07 first-run admin's personal team uses this with `_internal=True` and `auto_bootstrap=False`
- `app.teams.bootstrap.bootstrap_tenant_on_clusters` — direct call site for any future "rebootstrap on cluster registration" hook
- `app.teams.bootstrap.teardown_tenant_on_clusters` — Phase 2 unbind endpoint will use this
- `BootstrapFailed` exception class — Phase 2 may need to catch and re-raise with extra context

## Self-Check: PASSED

Verified at write time:

- All 18 created files exist on disk + 1 modified file (`app/main.py`)
- All four commit hashes (`a99ff11`, `7248247`, `5195945`, `2103697`) reachable from `master`
- `pytest -q` reports 132 passed
- `ruff check .` reports "All checks passed!"
- Live route inspection confirms 14 method-distinct endpoints across `/api/v1/clusters` + `/api/v1/teams`
- Acceptance-gate `test_delete_team_with_cluster_bindings_returns_409` passes individually

---

*Phase: 01-foundation*
*Plan: 06-clusters-tenant-bootstrap*
*Completed: 2026-05-14*
