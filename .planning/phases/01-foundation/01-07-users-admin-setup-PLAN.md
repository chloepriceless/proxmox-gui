---
phase: 01-foundation
plan: 07
type: execute
wave: 4
depends_on:
  - 01
  - 02
  - 05
  - 06
files_modified:
  - backend/app/users/__init__.py
  - backend/app/users/service.py
  - backend/app/users/routes.py
  - backend/app/users/schemas.py
  - backend/app/setup/__init__.py
  - backend/app/setup/service.py
  - backend/app/setup/routes.py
  - backend/app/setup/schemas.py
  - backend/app/main.py
  - backend/tests/test_users.py
  - backend/tests/test_setup.py
  - backend/tests/test_disable_user_revokes.py
autonomous: true
requirements:
  - AUTH-07
  - AUTH-08
  - DEPLOY-05
  - API-01
  - API-03
user_setup: []
tags:
  - backend
  - users
  - admin
  - setup-wizard
  - first-run
must_haves:
  truths:
    - "GET /api/v1/setup/status returns {no_admin_yet: bool}; returns true when zero users with is_admin=True exist"
    - "POST /api/v1/setup/admin (no auth) creates the initial admin + auto-creates the admin's personal team (D-05); returns 409 if any admin already exists"
    - "POST /api/v1/setup/cluster (no auth, gated on no_admin_yet=False AND zero clusters registered) is REJECTED; cluster registration during setup goes through the authenticated admin's session"
    - "Admin can POST /api/v1/users to create a new user; the new user's personal team is auto-created (D-05) but no PVE bootstrap (personal teams skip bootstrap per Plan 06)"
    - "Admin can PATCH /api/v1/users/{id} to disable a user (is_active=False); this revokes all the user's refresh tokens + PATs immediately (AUTH-07)"
    - "Admin can DELETE /api/v1/users/{id} — removes user; team_memberships cascade; personal team is deleted with the user"
    - "Admin cannot disable or delete themselves (self-modification guard)"
    - "POST /api/v1/users/{id}/teams adds membership; DELETE removes membership; personal teams reject these operations (D-05)"
    - "GET /api/v1/users (admin-only) lists users with their team memberships"
  artifacts:
    - path: "backend/app/users/service.py"
      provides: "create_user, list_users, update_user, delete_user, set_password (admin)"
      exports: ["create_user", "list_users", "get_user", "update_user", "delete_user"]
    - path: "backend/app/setup/service.py"
      provides: "no_admin_yet predicate, complete_first_run flow"
      exports: ["no_admin_yet", "create_initial_admin"]
    - path: "backend/app/setup/routes.py"
      provides: "/api/v1/setup/status, /api/v1/setup/admin"
      contains: "/api/v1/setup"
  key_links:
    - from: "backend/app/users/routes.py"
      to: "backend/app/auth/service.py"
      via: "disable_user calls revoke_user_sessions(user_id) to invalidate refresh tokens + PATs"
      pattern: "revoke_user_sessions"
    - from: "backend/app/setup/routes.py"
      to: "backend/app/users/service.py + app/teams/service.py"
      via: "create_initial_admin uses create_user (admin variant) then teams.service.create_team(personal=True, _internal=True)"
      pattern: "create_team"
    - from: "backend/app/main.py"
      to: "backend/app/setup/routes.py + users/routes.py"
      via: "include_router under /api/v1/setup and /api/v1/users"
      pattern: "include_router"
---

<objective>
Land the admin-only user CRUD surface (AUTH-07, AUTH-08) and the first-run setup gate (DEPLOY-05). New users are created with an auto-created personal team (D-05) but NO PVE bootstrap (personal teams skip bootstrap per Plan 06's create_team rule). Disabling a user invalidates their refresh tokens and PATs immediately via the `revoke_user_sessions` hook exposed by Plan 05. Self-modification is guarded — an admin cannot disable or delete themselves.

The setup flow is intentionally MINIMAL per CONTEXT D-18: the only mandatory step in the wizard backend is creating the initial admin. Cluster registration during setup is OPTIONAL and happens via the regular `POST /api/v1/clusters` (Plan 06) once the admin is logged in — the wizard frontend (Plan 08) handles this by automatically logging the admin in after step 2 and presenting step 3 (cluster) as an authenticated admin.

Output: 10 routes across `/api/v1/users` + `/api/v1/setup`; the lenient first-run contract (D-18) implemented; user-disable revocation tested; admin self-guard tested.
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-RESEARCH.md
@CLAUDE.md
@.planning/phases/01-foundation/01-01-SUMMARY.md
@.planning/phases/01-foundation/01-02-SUMMARY.md
@.planning/phases/01-foundation/01-05-SUMMARY.md
@.planning/phases/01-foundation/01-06-SUMMARY.md

<interfaces>

```python
# backend/app/users/service.py
async def create_user(db, *, username, email, password, is_admin=False, team_ids: list[int] | None = None) -> User: ...
async def list_users(db) -> list[UserResponse]: ...
async def get_user(db, *, user_id) -> User: ...
async def update_user(db, *, user_id, payload, current_admin_user_id) -> User: ...
async def delete_user(db, *, user_id, current_admin_user_id) -> None: ...
async def set_user_password(db, *, user_id, new_password, current_admin_user_id) -> None: ...

# backend/app/setup/service.py
# Note: create_initial_admin does NOT take a registry parameter — first-run runs before any
# cluster is registered, so no bootstrap occurs. The internal create_team(registry=None, ...)
# call passes None because Plan 06's create_team signature is:
#   async def create_team(db, registry: ConnectorRegistry | None = None, *, name, personal=False, _internal=False, auto_bootstrap=True) -> Team
# making the call site consistent.
async def no_admin_yet(db) -> bool: ...
async def create_initial_admin(db, *, username, email, password) -> tuple[User, Team]: ...
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Setup gate (no_admin_yet, create_initial_admin) + setup routes</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (Pattern 9 first-run gate)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-CONTEXT.md (D-18, D-19)
    - /home/dev/vm-deployment-gui/backend/app/teams/service.py (created in Plan 06)
    - /home/dev/vm-deployment-gui/backend/app/core/passwords.py
  </read_first>
  <files>
    backend/app/setup/__init__.py,
    backend/app/setup/service.py,
    backend/app/setup/routes.py,
    backend/app/setup/schemas.py,
    backend/app/main.py,
    backend/tests/test_setup.py
  </files>
  <behavior>
    - test_setup: GET /api/v1/setup/status on empty DB returns `{"no_admin_yet": true, "cluster_count": 0}`.
    - test_setup: POST /api/v1/setup/admin with valid payload (username, email, password >= 12 chars) creates admin user + personal team `personal-<user_id>`; returns 201 with `{user_id, personal_team_id, username}`.
    - test_setup: Second POST to /api/v1/setup/admin returns 409 `{"detail": "Initial setup already completed"}`.
    - test_setup: GET /api/v1/setup/status after creating admin returns `{"no_admin_yet": false, "cluster_count": 0}`.
    - test_setup: POST /api/v1/setup/admin with password < 12 chars returns 422.
    - test_setup: POST /api/v1/setup/admin with duplicate username returns 409 (unique constraint).
    - test_setup: After admin creation, the admin can `POST /api/v1/auth/login` and receive cookies (end-to-end smoke).
  </behavior>
  <action>
    setup/service.py — Per 01-RESEARCH.md Pattern 9:

    `async def no_admin_yet(db) -> bool`:
    ```python
    count = await db.scalar(select(func.count()).select_from(User).where(User.is_admin == True))
    return count == 0
    ```

    `async def cluster_count(db) -> int`: `await db.scalar(select(func.count()).select_from(Cluster))`.

    `async def create_initial_admin(db, *, username, email, password) -> tuple[User, Team]`:
    1. Check `await no_admin_yet(db)`; if False raise HTTPException(409, "Initial setup already completed").
    2. Hash password via `hash_password(password)`.
    3. Insert User(username, email, password_hash=hash, is_admin=True, is_active=True). Await db.flush() to get id.
    4. Call `teams.service.create_team(db, registry=None, name=f"personal-{user.id}", personal=True, _internal=True, auto_bootstrap=False)`. Document inline: personal teams do NOT bootstrap PVE objects per D-05 + D-06 (personal teams have pools but Plan 06's bootstrap is skipped for personal teams during setup since there are no clusters yet anyway — but even with clusters, the personal team gets bootstrapped lazily on first PVE need; for v1, lazy-bootstrap is Phase 2's concern. Phase 1 personal teams have ZERO PVE state).
       - NOTE: This means Plan 06's `create_team` accepts `_internal=True` even when `personal=True`. Plan 06 already handles this via the `_internal` flag in the validation guard.
    5. Insert TeamMembership(team_id=team.id, user_id=user.id).
    6. await db.commit().
    7. Return (user, team).

    setup/routes.py — Router under prefix `/api/v1/setup`. All routes NO AUTH. CSRF NOT applied here (no session yet). Endpoints:
    - `GET /status` → `{no_admin_yet: bool, cluster_count: int}`.
    - `POST /admin` — body `SetupAdminRequest(username, email, password)`. Calls create_initial_admin. Returns 201 with `SetupAdminResponse(user_id, personal_team_id, username)`. Per 01-RESEARCH.md Pattern 9.
    
    Note: There is NO `/api/v1/setup/cluster` route — cluster registration during the wizard goes through the regular `POST /api/v1/clusters` once the admin is authenticated (Plan 08's UI logs the admin in after step 2). Document this clearly in routes.py module docstring.

    setup/schemas.py — pydantic:
    - `SetupAdminRequest(username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$"), email: EmailStr, password: str = Field(min_length=12))`.
    - `SetupAdminResponse(user_id: int, personal_team_id: int, username: str)`.
    - `SetupStatusResponse(no_admin_yet: bool, cluster_count: int)`.

    main.py — Include setup_router under `/api/v1/setup`.

    Tests:
    - test_setup.py: Exercise the full flow. Use httpx.AsyncClient + the in-memory SQLite test fixture from Plan 01/05. After admin creation, ensure subsequent login works (this requires that the user creation actually persists; verify by `await db.execute(select(User))` returning the row).
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_setup.py -x -v 2>&1 | tail -20 ; python -c "from app.main import app; paths=[r.path for r in app.routes]; assert '/api/v1/setup/status' in paths and '/api/v1/setup/admin' in paths; print('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend && python -m pytest tests/test_setup.py -x` exits 0
    - `grep -q 'no_admin_yet' backend/app/setup/service.py`
    - `grep -q 'is_admin == True\|is_admin=True' backend/app/setup/service.py`
    - `grep -q 'personal=True' backend/app/setup/service.py` (personal team auto-creation)
    - `grep -q 'min_length=12' backend/app/setup/schemas.py` (password floor per UI-SPEC + research)
    - `grep -qE 'pattern=.*\^.*\$' backend/app/setup/schemas.py` (username pattern validator)
    - `cd backend && python -c "from app.main import app; paths=[r.path for r in app.routes]; assert '/api/v1/setup/cluster' not in paths"` exits 0 (no separate cluster setup route; goes through /api/v1/clusters)
    - `grep "registry: ConnectorRegistry | None = None" backend/app/teams/service.py` returns ≥1 match (consistent create_team signature; see WARNING 6 fix)
  </acceptance_criteria>
  <done>Setup status + initial admin creation routes ship; password floor enforced; subsequent login works end-to-end; second admin-create returns 409.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Admin user CRUD routes (AUTH-07, AUTH-08) with self-guard + disable revocation</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-CONTEXT.md (D-05, D-07; Discretion: User-disable semantics)
    - /home/dev/vm-deployment-gui/backend/app/auth/service.py (revoke_user_sessions hook from Plan 05)
    - /home/dev/vm-deployment-gui/backend/app/teams/service.py (Plan 06)
    - /home/dev/vm-deployment-gui/backend/app/auth/dependencies.py (require_admin)
  </read_first>
  <files>
    backend/app/users/__init__.py,
    backend/app/users/service.py,
    backend/app/users/routes.py,
    backend/app/users/schemas.py,
    backend/app/main.py,
    backend/tests/test_users.py,
    backend/tests/test_disable_user_revokes.py
  </files>
  <behavior>
    - test_users: GET /api/v1/users as admin returns list including all users + their team memberships.
    - test_users: GET /api/v1/users as non-admin returns 403.
    - test_users: POST /api/v1/users as admin with valid payload creates user; personal team `personal-<user_id>` auto-created; returns 201 with user + personal_team_id.
    - test_users: POST /api/v1/users with duplicate username returns 409.
    - test_users: POST /api/v1/users with team_ids=[shared_team_id] adds memberships (D-08 admission control on whether to enforce quota deferred to Phase 2).
    - test_users: PATCH /api/v1/users/{id} can update email, is_active, is_admin, team memberships (replace).
    - test_users: Admin cannot PATCH their own is_admin or is_active (self-guard 422 "Cannot modify your own admin/active state").
    - test_users: DELETE /api/v1/users/{id} succeeds; personal team is deleted with cascade; shared team memberships are removed but shared teams remain.
    - test_users: Admin cannot DELETE themselves (422 "Cannot delete yourself").
    - test_users: POST /api/v1/users/{id}/password (admin-set password) requires admin; user is forced to log in again on next access.
    - test_users: POST /api/v1/users/{id}/teams/{team_id} adds team membership; DELETE removes.
    - test_users: Adding membership to a personal team returns 422 "Personal teams have immutable membership."
    - test_disable_user_revokes: After PATCH /api/v1/users/{id} with `{is_active: false}`, the disabled user's existing refresh tokens are revoked AND their PATs are revoked. Verify by attempting a refresh with the old refresh_token → 401, and a Bearer auth with the old PAT → 401.
  </behavior>
  <action>
    users/service.py:

    `async def create_user(db, *, username, email, password, is_admin=False, team_ids=None) -> tuple[User, Team]`:
    1. Hash password.
    2. Insert User(username, email, password_hash, is_admin, is_active=True). Flush → user.id.
    3. Create personal team via `teams.service.create_team(db, registry=None, name=f"personal-{user.id}", personal=True, _internal=True, auto_bootstrap=False)`.
    4. Insert TeamMembership for the personal team.
    5. For each `team_id` in `team_ids or []`: validate team exists + is not personal; insert TeamMembership.
    6. Commit. Return (user, personal_team).

    `async def list_users(db) -> list[UserResponse]`: SELECT users + selectinload teams. Map to response schema.

    `async def get_user(db, *, user_id) -> User`: SELECT one + selectinload teams. 404 if not found.

    `async def update_user(db, *, user_id, payload, current_admin_user_id) -> User`:
    - Load user. 404 if not found.
    - Self-guard: if `user_id == current_admin_user_id` and payload.is_admin is set OR payload.is_active is set → raise 422 "Cannot modify your own admin/active state."
    - Apply field-by-field updates from payload (only fields explicitly present — pydantic `model_dump(exclude_unset=True)`).
    - If is_active transitions from True → False, call `revoke_user_sessions(db, user_id=user_id)` (Plan 05 hook).
    - If team_ids is in payload, REPLACE all non-personal memberships: delete current memberships for non-personal teams, insert new ones. Document the replace semantics in docstring.
    - Commit; return user.

    `async def delete_user(db, *, user_id, current_admin_user_id) -> None`:
    - Self-guard: if `user_id == current_admin_user_id` raise 422 "Cannot delete yourself."
    - Load user.
    - revoke_user_sessions first (clean up tokens before user vanishes — refresh_tokens row would cascade delete anyway, but this is defensive).
    - Delete personal team (where personal=True AND id IN user's teams) — cascade deletes membership.
    - Delete user (FKs ON DELETE CASCADE handle the rest).
    - Commit.

    `async def set_user_password(db, *, user_id, new_password, current_admin_user_id) -> None`:
    - Hash new_password; update `user.password_hash`.
    - revoke_user_sessions(user_id) so the user is forced to log in with the new password.
    - Commit.

    users/routes.py — Router under prefix `/api/v1/users`. All routes `Depends(require_admin) + Depends(csrf_protect)` (GET excludes csrf_protect since safe method). Endpoints:
    - `POST /` — body `UserCreate(username, email, password, is_admin=False, team_ids: list[int] | None = None)` → 201 `UserResponse + personal_team_id`.
    - `GET /` — list of `UserResponse`.
    - `GET /{user_id}` — single `UserDetailResponse` with full team membership.
    - `PATCH /{user_id}` — body `UserUpdate(email?, is_admin?, is_active?, team_ids?)`.
    - `DELETE /{user_id}` — 204.
    - `POST /{user_id}/password` — body `AdminPasswordRequest(new_password: str = Field(min_length=12))`.
    - `POST /{user_id}/teams` — body `MembershipAdd(team_id)` → 201.
    - `DELETE /{user_id}/teams/{team_id}` — 204.

    Pass `current_admin_user_id = principal.user.id` from the dependency into service functions for the self-guard checks.

    users/schemas.py:
    - `UserCreate(username, email: EmailStr, password: str = Field(min_length=12), is_admin: bool = False, team_ids: list[int] | None = None)`. Username validator: `^[a-zA-Z0-9_.-]{3,64}$`.
    - `UserUpdate` (all Optional).
    - `UserResponse(id, username, email, is_admin, is_active, created_at, teams: list[TeamSummary])`.
    - `UserDetailResponse` extends with `last_login: datetime | None` (deferred — schema field present, populated in Phase 2's audit-driven last-login).
    - `AdminPasswordRequest(new_password: str = Field(min_length=12))`.
    - `MembershipAdd(team_id: int)`.

    main.py — Include users_router under `/api/v1/users`.

    Tests:
    - test_users.py: All behaviors above.
    - test_disable_user_revokes.py: End-to-end:
      1. Create admin via setup.
      2. Admin creates user U.
      3. U logs in → access + refresh + csrf cookies.
      4. U mints a PAT P.
      5. Admin PATCHes U with `{is_active: false}`.
      6. Verify: POST /api/v1/auth/refresh with U's refresh cookie returns 401; GET /api/v1/me with Bearer P returns 401.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_users.py tests/test_disable_user_revokes.py -x -v 2>&1 | tail -30 ; python -c "from app.main import app; paths=[r.path for r in app.routes]; assert '/api/v1/users/' in paths or any('/users' in p for p in paths); print('OK', sum(1 for p in paths if '/users' in p), 'user routes')"</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend && python -m pytest tests/test_users.py tests/test_disable_user_revokes.py -x` exits 0
    - `grep -q 'revoke_user_sessions' backend/app/users/service.py` (disable revokes tokens)
    - `grep -q 'current_admin_user_id' backend/app/users/service.py` (self-guard wiring)
    - `grep -q 'Cannot.*yourself\|Cannot modify your own' backend/app/users/service.py` (self-guard message)
    - `grep -q "personal-" backend/app/users/service.py` (personal team naming convention)
    - `grep -q 'team_ids' backend/app/users/schemas.py`
    - `grep -q 'min_length=12' backend/app/users/schemas.py`
    - `cd backend && python -c "from app.main import app; paths=[r.path for r in app.routes]; assert '/api/v1/users/{user_id}/teams/{team_id}' in paths or any('/users/' in p and '/teams/' in p for p in paths); print('OK')"` exits 0
  </acceptance_criteria>
  <done>User admin CRUD routes ship; self-guard prevents lockout; disable revokes refresh + PATs immediately; team membership add/remove ships; tests verify end-to-end revocation.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| First-run public endpoint → admin creation | No auth; gated solely on `no_admin_yet` predicate; one-shot |
| Admin → user CRUD | require_admin + csrf_protect (cookie-session) or PAT (no csrf) |
| Admin → self | Self-guard prevents lockout and self-elevation removal |
| Disable user → live sessions | revoke_user_sessions invalidates refresh + PATs synchronously |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-07-01 | Elevation of privilege | Race to create first admin | mitigate | `no_admin_yet` checked inside the same transaction that inserts the admin row; second concurrent request finds admin exists → 409. Test verifies. Plan 04's bootstrap.sh delivers a fresh DB so only one operator races. |
| T-01-07-02 | Spoofing | Anyone hits /setup/admin and becomes admin | mitigate | Predicate gate (`no_admin_yet`) is the only barrier; documented as accepted v1 design. CONTEXT D-19 calls out a bootstrap-token sidecar option (Claude's discretion to defer). Phase 1 ships without — the network boundary (operator just installed the LXC, only their browser can reach it on first boot) is the trust assumption. |
| T-01-07-03 | Elevation of privilege | Admin disables their own account | mitigate | Self-guard rejects PATCH with is_active=False targeting self. Test verifies. |
| T-01-07-04 | Elevation of privilege | Admin removes their own is_admin flag | mitigate | Same self-guard rejects PATCH with is_admin=False targeting self. |
| T-01-07-05 | Denial of service | Admin deletes themselves and locks out | mitigate | Self-guard rejects DELETE self. |
| T-01-07-06 | Tampering | Disabling a user but their refresh/PAT still works | mitigate | revoke_user_sessions called synchronously on is_active False transition. Tested. |
| T-01-07-07 | Information disclosure | User list exposes email + admin flag to non-admin | mitigate | All /api/v1/users routes admin-gated. Plan 05's /api/v1/me is the user-facing self-info endpoint. |
| T-01-07-08 | Tampering | Admin password reset bypasses old-password check | accept (by design) | admin POST /users/{id}/password sets a new password without verifying the old (recovery flow). revoke_user_sessions forces the user to log in with the new password. Auditing (Phase 2) records who-reset-whom. |
| T-01-07-09 | Information disclosure | Personal team name leaks user id ("personal-42") | accept | Personal team names are not user-facing (Plan 08 UI shows "<username> (personal)" label; the raw name is internal). Acceptable. |
| T-01-07-10 | Repudiation | Setup completed but no audit record | accept (Phase 2 writer) | audit_log schema exists; writer lands Phase 2. v1 admin actions during setup are trusted by operator-of-install. |
| T-01-07-11 | Spoofing | Username case sensitivity bypass (Alice vs alice) | mitigate | username field UNIQUE in DB; SQLite by default is case-sensitive on TEXT. To prevent confusion, lowercase the username on insert (claude-discretion: enforce lowercase in pydantic validator). Document. |
| T-01-07-12 | Tampering | Admin sets a user's password to a value they reuse for their own login | accept | Out of scope for password complexity in v1. Phase 5 may add zxcvbn (CONTEXT discretion). |

ASVS L1 mappings:
- V4.1 (account creation) → username regex + email validation
- V4.2 (administrative interface) → all user routes require_admin
- V4.3 (privilege management) → self-guard prevents lockout
- V2.7 (administrative password reset) → revoke_user_sessions after admin-set password
- V3.5 (session termination) → revoke_user_sessions on disable/delete
</threat_model>

<verification>
- `cd backend && python -m pytest tests/test_setup.py tests/test_users.py tests/test_disable_user_revokes.py -x -v` exits 0
- All acceptance-criteria greps pass
- `cd backend && python -c "from app.main import app; print(len([r for r in app.routes if any(s in getattr(r,'path','') for s in ['/users','/setup','/teams','/clusters','/me','/auth'])]))"` shows 30+ routes across all Phase 1 endpoints
</verification>

<success_criteria>
First-run wizard backend is functional: GET /setup/status, POST /setup/admin. Initial admin creation auto-creates the personal team. Admins can fully manage users (CRUD + team membership) with self-guard and synchronous session revocation on disable. The OpenAPI spec (auto-generated) covers every Phase 1 capability — plan 08's frontend can drive every screen against the same API.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-07-SUMMARY.md` documenting:
- Setup + user routes (full list)
- Self-guard semantics
- Personal team naming convention used (`personal-<user_id>`)
- Disable-user revocation chain verified end-to-end
- Test count + pass/fail
- OpenAPI spec route count (run `curl /api/openapi.json | jq '.paths | length'` and report)
- Outstanding TODOs for Phase 2 (audit writer; lazy bootstrap of personal teams on first PVE use)
</output>
