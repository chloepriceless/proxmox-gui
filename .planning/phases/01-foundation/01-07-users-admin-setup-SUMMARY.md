---
phase: 01-foundation
plan: 07
subsystem: users-admin-setup
tags:
  - backend
  - users
  - admin
  - setup-wizard
  - first-run
  - revocation
  - self-guard
  - tdd

# Dependency graph
requires:
  - phase: 01-01-backend-scaffold
    provides: "get_db, settings, hash_password"
  - phase: 01-02-db-schema
    provides: "User, Team, TeamMembership models"
  - phase: 01-05-auth-subsystem
    provides: "require_admin, csrf_protect, Principal, get_current_principal, revoke_user_sessions hook"
  - phase: 01-06-clusters-tenant-bootstrap
    provides: "teams.service.create_team(registry=None, auto_bootstrap=False) signature for personal-team creation"
provides:
  - "GET /api/v1/setup/status — open endpoint returns {no_admin_yet, cluster_count}"
  - "POST /api/v1/setup/admin — open IFF no_admin_yet, creates initial admin + personal team"
  - "GET /api/v1/users/ — admin list of users with team memberships"
  - "POST /api/v1/users/ — admin create user + auto-personal-team + optional shared memberships"
  - "GET /api/v1/users/{user_id} — admin user detail"
  - "PATCH /api/v1/users/{user_id} — admin update; disable triggers session revocation; team_ids replace semantics"
  - "DELETE /api/v1/users/{user_id} — admin delete; cascades personal team and memberships"
  - "POST /api/v1/users/{user_id}/password — admin password reset (revokes sessions)"
  - "POST /api/v1/users/{user_id}/teams — admin add membership"
  - "DELETE /api/v1/users/{user_id}/teams/{team_id} — admin remove membership"
  - "Self-guard: admin cannot disable, demote, or delete themselves (T-01-07-03/04/05)"
  - "Disable-user revocation chain: PATCH is_active=false synchronously calls revoke_user_sessions"
affects:
  - 01-08-frontend-auth-shell (consumes /setup/status to decide whether to render the wizard)
  - 01-09-frontend-account (admin password-reset flow surfaces a forced-logout banner)
  - 01-10-frontend-admin (consumes the entire /api/v1/users surface for the admin Users page)
  - 02-* (audit-log writer composes with admin user CRUD; same Principal)

# Tech tracking
tech-stack:
  added:
    - "email-validator==2.3.0 (Rule 3 — pydantic EmailStr requires it; was missing from pyproject.toml)"
  patterns:
    - "Self-guard at service layer: routes pass current_admin_user_id from principal; service raises 422 if user_id == current_admin_user_id AND is_admin/is_active in payload (or DELETE)"
    - "is_active True→False transition detection BEFORE applying the change; revoke_user_sessions called inside the same transaction (commits the user UPDATE in the same atomic operation)"
    - "team_ids REPLACE semantics: only non-personal memberships participate; personal-team membership row is preserved"
    - "Personal team naming convention: 'personal-<user_id>' (matches D-05 + tests/factories.py + 01-RESEARCH §Anti-Patterns)"
    - "Setup endpoints are CSRF-free (no session yet); admin-creation route is one-shot, gated on no_admin_yet predicate inside the insert transaction (T-01-07-01 race mitigation)"
    - "model_dump(exclude_unset=True) drives field-by-field PATCH semantics — distinguishes 'set to None' from 'not present'"

key-files:
  created:
    - backend/app/setup/__init__.py
    - backend/app/setup/service.py
    - backend/app/setup/routes.py
    - backend/app/setup/schemas.py
    - backend/app/users/__init__.py
    - backend/app/users/service.py
    - backend/app/users/routes.py
    - backend/app/users/schemas.py
    - backend/tests/test_setup.py
    - backend/tests/test_users.py
    - backend/tests/test_disable_user_revokes.py
  modified:
    - backend/app/main.py
    - backend/pyproject.toml

key-decisions:
  - "is_active True→False transition handled inside update_user: revoke_user_sessions is called AFTER the user.is_active update is flushed, so its commit picks up both the user UPDATE and the revocation in one atomic transaction. This avoids a brief window where is_active=False but tokens are still live."
  - "team_ids on update_user has REPLACE semantics on non-personal teams only. The personal-team membership row is never touched, so a PATCH with team_ids=[] correctly leaves the user with their personal team (and nothing else)."
  - "Admin self-modification guards (is_admin, is_active, delete) live at the service layer with current_admin_user_id passed from the principal. Direct callers (admin CLI scripts, tests) get the same protection as HTTP callers."
  - "Personal team name is 'personal-<user_id>' (per D-05 + 01-RESEARCH §Anti-Patterns + Plan 02 model docstring). Stable across username changes; matches what tests/factories.py make_user produces."
  - "create_initial_admin in the setup service re-checks no_admin_yet inside the insert transaction (T-01-07-01 race mitigation). The IntegrityError handler also catches a username/email uniqueness violation as a fallback."
  - "Admin password reset (POST /users/{id}/password) does NOT verify an old password — accepted by design per T-01-07-08 (recovery flow). Sessions are revoked so the user must log in with the new password; audit (Phase 2) will record the reset."
  - "team_ids=[personal_team_id] is rejected with 422 at user-create time and at PATCH time (D-05 immutability). Same error message in both code paths."
  - "Setup endpoints are CSRF-free: there is no session yet, so there is no csrf_token cookie to compare against. The double-submit pattern only applies to authenticated cookie-session routes."
  - "There is intentionally NO /api/v1/setup/cluster route. Cluster registration during the wizard goes through the authenticated /api/v1/clusters once the admin is logged in (CONTEXT D-18 lenient first-run; Plan 08's UI auto-logs-in after the admin step)."

patterns-established:
  - "Personal-team auto-creation in user-create flows: any code path that mints a User MUST also create a 'personal-<user_id>' team via teams.service.create_team(registry=None, _internal=True, auto_bootstrap=False) and insert the membership row — see service.create_user and setup.service.create_initial_admin."
  - "Self-guard pattern for admin routes: route layer extracts principal.user.id, passes as current_admin_user_id keyword to the service, service raises 422 with 'Cannot ... yourself' messaging."
  - "Session revocation on critical state change: any service function that disables a user OR rotates their password MUST call revoke_user_sessions (Plan 05 hook) and let it own the commit — single-transaction guarantee."

requirements-completed:
  - AUTH-07  # Disable user (revokes refresh + PATs immediately)
  - AUTH-08  # Admin assigns users to teams (now end-to-end via /users/{id}/teams in addition to /teams/{id}/members from Plan 06)
  - DEPLOY-05  # First-run setup wizard backend (GET /setup/status, POST /setup/admin)
  # API-01 + API-03 already shipped via Plan 01-05 (this plan extends the OpenAPI surface)

# Metrics
duration: ~11min
completed: 2026-05-14
---

# Phase 01 Plan 07: Users Admin + Setup Summary

**First-run setup backend (GET /setup/status + POST /setup/admin per CONTEXT D-18 lenient first-run) + admin user CRUD with auto-personal-team (D-05), self-guard (T-01-07-03/04/05), team-membership replace semantics, and synchronous session revocation on disable (AUTH-07, T-01-07-06). 34 new tests; total 166 pass; ruff clean. The OpenAPI 3.1 spec now covers 25 distinct paths across all of Phase 1's authenticated surface.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-14T04:46:35Z
- **Completed:** 2026-05-14T04:57:44Z
- **Tasks:** 2 (both `type=auto` + `tdd=true`)
- **Commits:** 4 (test → feat → test → feat; TDD RED→GREEN per task)
- **Files created:** 11 (8 backend modules + 3 test files)
- **Files modified:** 2 (`app/main.py` router includes; `pyproject.toml` adds email-validator)

## Accomplishments

- **First-run setup wizard backend (DEPLOY-05):**
  - `GET /api/v1/setup/status` (open) returns `{no_admin_yet, cluster_count}`. The frontend (Plan 08) reads this to decide whether to render the wizard.
  - `POST /api/v1/setup/admin` (open IFF `no_admin_yet`) creates the very first admin user + their personal team in one transaction. Re-checks the predicate inside the insert (T-01-07-01 race mitigation). Once an admin exists, returns 409 "Initial setup already completed".
  - The wizard backend is intentionally **lenient** per CONTEXT D-18: only the admin step is mandatory. Cluster registration during the wizard goes through the regular `POST /api/v1/clusters` once the admin is logged in.
  - There is **no `/api/v1/setup/cluster` route** — verified by `test_setup_cluster_route_does_not_exist`.

- **Admin user CRUD (AUTH-07, AUTH-08):** 8 method-distinct routes on `/api/v1/users`. Every route is admin-gated (`require_admin`); every mutating route additionally requires CSRF (`csrf_protect`). The `current_admin_user_id` flows from the request principal into each service function for the self-guard checks.

- **Self-guard (T-01-07-03/04/05):** Admin cannot toggle their own `is_admin` or `is_active` (PATCH self → 422 "Cannot modify your own admin/active state"). Admin cannot delete themselves (DELETE self → 422 "Cannot delete yourself"). All three branches are tested individually.

- **Disable-user revocation chain (AUTH-07; T-01-07-06):** PATCH `/api/v1/users/{id}` with `{is_active: false}` detects the True→False transition BEFORE applying the change, then synchronously calls `revoke_user_sessions(user_id)` (Plan 05's hook) which revokes all non-revoked refresh tokens AND PATs in one transaction. Verified end-to-end by `test_disable_user_revokes_refresh_and_pat_end_to_end`: a disabled user's refresh cookie returns 401 from `/api/v1/auth/refresh` AND their Bearer PAT returns 401 from `/api/v1/me/`.

- **Re-enable does not un-revoke** (`test_re_enable_does_not_un_revoke_old_credentials`): once revoked, refresh tokens stay dead. Re-enabling a user does NOT resurrect their old refresh tokens or PATs — the user must log in again. This guards against a `disable + re-enable` bypass of session revocation.

- **Personal team auto-creation (D-05):** Both `setup.service.create_initial_admin` and `users.service.create_user` mint a `personal-<user_id>` team via `teams.service.create_team(registry=None, personal=True, _internal=True, auto_bootstrap=False)` (Plan 06's WARNING-6 signature accommodates this). No PVE bootstrap on personal teams; lazy bootstrap is Phase 2's concern.

- **team_ids REPLACE semantics on PATCH:** When `team_ids` is in the PATCH payload, the user's non-personal memberships are replaced with that exact set. Personal-team membership is preserved (never touched). Personal team_ids in the request → 422.

- **Admin password reset (T-01-07-08 accepted by design):** `POST /api/v1/users/{id}/password` lets an admin set a new password without verifying the old one (recovery flow). The user's sessions are revoked; they must log in with the new password.

- **Test count:** 132 → 166 (34 new tests across 3 files), all green; ruff clean.

## Routes Shipped

### Setup (2 endpoints — both open, no auth)

| Method | Path                       | Description                                       |
|--------|----------------------------|---------------------------------------------------|
| GET    | `/api/v1/setup/status`     | Predicate flags (no_admin_yet + cluster_count)    |
| POST   | `/api/v1/setup/admin`      | Create initial admin + personal team (one-shot)   |

### Users (8 method-distinct endpoints — all admin-gated)

| Method | Path                                                    | Description                                                |
|--------|---------------------------------------------------------|------------------------------------------------------------|
| GET    | `/api/v1/users/`                                        | List users with team memberships                           |
| POST   | `/api/v1/users/`                                        | Create user + auto-personal-team + optional shared teams   |
| GET    | `/api/v1/users/{user_id}`                               | User detail                                                |
| PATCH  | `/api/v1/users/{user_id}`                               | Update — disable triggers session revocation               |
| DELETE | `/api/v1/users/{user_id}`                               | Delete — self-delete blocked                               |
| POST   | `/api/v1/users/{user_id}/password`                      | Admin password reset (revokes sessions)                    |
| POST   | `/api/v1/users/{user_id}/teams`                         | Add team membership (rejects personal teams)               |
| DELETE | `/api/v1/users/{user_id}/teams/{team_id}`               | Remove team membership                                     |

**Total:** 10 method-distinct endpoints; 25 OpenAPI paths across all of Phase 1.

## Phase 1 OpenAPI Surface (25 paths)

```
/api/v1/auth/login, /api/v1/auth/logout, /api/v1/auth/refresh
/api/v1/clusters/, /api/v1/clusters/test, /api/v1/clusters/{cluster_id}, /api/v1/clusters/{cluster_id}/test
/api/v1/health
/api/v1/me/, /api/v1/me/password
/api/v1/me/ssh-keys/, /api/v1/me/ssh-keys/{key_id}
/api/v1/me/tokens/, /api/v1/me/tokens/{token_id}
/api/v1/setup/admin, /api/v1/setup/status
/api/v1/teams/, /api/v1/teams/{team_id}, /api/v1/teams/{team_id}/members, /api/v1/teams/{team_id}/members/{user_id}
/api/v1/users/, /api/v1/users/{user_id}, /api/v1/users/{user_id}/password, /api/v1/users/{user_id}/teams, /api/v1/users/{user_id}/teams/{team_id}
```

Plan 08's frontend can drive every screen against this spec.

## Task Commits

Each task committed atomically with TDD RED→GREEN discipline:

1. **Task 1 RED — failing first-run setup tests** — `db93fab` (test)
2. **Task 1 GREEN — first-run setup wizard backend** — `e8af0fb` (feat)
3. **Task 2 RED — failing user-admin + disable-revocation tests** — `4d89cfe` (test)
4. **Task 2 GREEN — admin user CRUD + self-guard + disable revocation** — `105b7d8` (feat)

**Plan metadata commit:** TBD (this commit) — captures SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md.

## Files Created/Modified

### Setup package (`backend/app/setup/`)

- `__init__.py` — package marker + module roadmap docstring
- `schemas.py` — `SetupStatusResponse`, `SetupAdminRequest` (12+ char password, username regex, EmailStr), `SetupAdminResponse`
- `service.py` — `no_admin_yet` (predicate), `cluster_count`, `create_initial_admin` (re-checks predicate inside the insert tx + auto-creates personal team via `teams.service.create_team(registry=None, _internal=True)`)
- `routes.py` — open router with 2 endpoints (no auth, no CSRF — there is no session yet)

### Users package (`backend/app/users/`)

- `__init__.py` — package marker + invariants docstring
- `schemas.py` — `TeamSummary`, `UserCreate` (12+ char password, username regex, EmailStr, optional team_ids), `UserUpdate` (all-optional with `extra="forbid"`), `AdminPasswordRequest`, `MembershipAdd`, `UserResponse`, `UserCreateResponse` (adds `personal_team_id`), `UserDetailResponse`
- `service.py` — `create_user`, `_add_shared_memberships`, `list_users`, `get_user`, `update_user` (self-guard + disable→revoke + team_ids replace), `_replace_shared_memberships`, `delete_user` (self-guard + cascade), `set_user_password`, `add_user_to_team`, `remove_user_from_team`
- `routes.py` — admin-only router with 8 method-distinct endpoints; current admin id flows from principal into each service call

### Tests (`backend/tests/`)

- `test_setup.py` — 9 tests: status on empty DB, status after admin, create admin success (verifies User + Team + TeamMembership in DB), second-create returns 409, short-password 422, invalid-username 422, invalid-email 422, post-setup login works end-to-end, no /setup/cluster route exists
- `test_users.py` — 23 tests: list as admin / non-admin / unauth, create + auto-personal-team, dup username 409, short password 422, team_ids adds memberships, personal team_id rejected 422, GET detail / 404, PATCH email, PATCH self-disable 422, PATCH self-remove-admin 422, PATCH team_ids REPLACE, DELETE success, DELETE self 422, DELETE cascades personal team, admin password reset (verifies revocation + new login works), admin password reset short pw 422, add/remove team membership, personal team membership rejected 422, non-admin → 403
- `test_disable_user_revokes.py` — 2 end-to-end tests: disable revokes refresh + PAT (proves both are dead via /auth/refresh and Bearer /me/), re-enable does NOT un-revoke old credentials

### Modified

- `backend/app/main.py` — included `setup_router` under `/api/v1/setup` (tag `setup`) and `users_router` under `/api/v1/users` (tag `users`)
- `backend/pyproject.toml` — added `email-validator==2.3.0` (Rule 3 fix — pydantic `EmailStr` requires it; not previously installed)

## Decisions Made

- **Disable-revocation transaction sequencing.** `update_user` detects the `is_active` True→False transition BEFORE applying the change, then `setattr`s the field, then `flush()`es, then calls `revoke_user_sessions(user_id)` which commits the entire transaction (the user UPDATE + the refresh-token + PAT updates). This guarantees no window where `is_active=False` is committed but tokens are still live.
- **Personal team membership in PATCH `team_ids`.** REPLACE semantics on PATCH `team_ids` only affects non-personal teams. The personal-team membership row is queried separately and never touched. A PATCH with `team_ids=[]` correctly leaves the user with only their personal team.
- **Admin self-guard at service layer.** `update_user` and `delete_user` accept `current_admin_user_id` as a required keyword, so the guard is enforced regardless of who calls them (HTTP route, test, future admin CLI). The route layer pulls `principal.user.id` from `Depends(get_current_principal)`.
- **`no_admin_yet` predicate uses `is_admin.is_(True)` not `is_admin == True`.** SQLAlchemy idiom — `==` against Python `True` works but ruff flags it; `.is_(True)` is the canonical form. Functionally equivalent.
- **Setup endpoints accept any password ≥ 12 chars.** Matches `PasswordChangeRequest` from Plan 05; ASVS V2.1 baseline. Phase 5 may add zxcvbn (D-?, deferred).
- **Personal team naming is `personal-<user_id>` not `<username>-personal`.** Stable across username changes (D-05 immutability). Matches `tests/factories.py::make_user`, Plan 02's model docstring, and 01-RESEARCH §Anti-Patterns.
- **Setup wizard backend is intentionally lean.** Only the two endpoints. There is no `POST /api/v1/setup/cluster` and no theme/preferences endpoint; both are entirely Plan 08's concern (frontend wizard) using the regular authenticated routes.
- **Admin password reset bypasses the old-password check.** T-01-07-08 accept-by-design (recovery flow). Sessions are revoked so the user MUST log in with the new password — this is the practical safety net. Phase 2's audit log will record who-reset-whom.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `email-validator` package was not installed**

- **Found during:** Task 1 GREEN, running `test_setup.py` for the first time.
- **Issue:** `pydantic.EmailStr` requires the optional `email-validator` package. The first test that posted an EmailStr field raised `ImportError: email-validator is not installed` from inside pydantic's networks module. The package was missing from `backend/pyproject.toml` despite Plan 01's stack including pydantic.
- **Fix:** `pip install email-validator==2.3.0` and added the dependency to `[project].dependencies` in `pyproject.toml`.
- **Files modified:** `backend/pyproject.toml`
- **Verification:** All 9 setup tests pass after the install.
- **Committed in:** `e8af0fb` (Task 1 GREEN)

**2. [Rule 1 - Bug] `email-validator` rejected `.test` TLD on first attempt**

- **Found during:** Task 1 GREEN, after fixing Deviation 1.
- **Issue:** The setup tests originally used `@example.test` email addresses (matching `tests/factories.py::make_user`'s default). The `email-validator` library treats `.test` as a special-use reserved name and rejects it with "value is not a valid email address: The part after the @-sign is a special-use or reserved name". Note that pwdlib / Plan 05's tests don't hit this because they construct emails inline as plain strings without going through pydantic validation.
- **Fix:** Replaced all `@example.test` with `@example.com` in `tests/test_setup.py`. The same TLD limitation will apply to any future test that runs an EmailStr validator over a fixture email — `tests/factories.py` may need a follow-up audit if other plans hit it.
- **Files modified:** `backend/tests/test_setup.py`
- **Verification:** All 9 setup tests pass.
- **Committed in:** `e8af0fb` (Task 1 GREEN)

**3. [Rule 1 - Bug] PAT mint response field was `plaintext`, not `token`**

- **Found during:** Task 2 GREEN, running `test_disable_user_revokes_refresh_and_pat_end_to_end`.
- **Issue:** I wrote the test against `response.json()["token"]` but Plan 05's `PATMintResponse` schema (in `app/pats/schemas.py`) names the show-once field `plaintext`. KeyError on `["token"]`.
- **Fix:** Changed the test to read `response.json()["plaintext"]`.
- **Files modified:** `backend/tests/test_disable_user_revokes.py`
- **Verification:** Both disable-revocation tests pass.
- **Committed in:** `105b7d8` (Task 2 GREEN)

**4. [Rule 3 - Blocking] ruff auto-fixes (I001) + manual fix (F841 unused locals)**

- **Found during:** Final ruff verification at end of Task 2.
- **Issue:** Stylistic / unused-import errors flagged by ruff after each green commit. 2 fixable I001 import-order issues; 2 manual F841 fixes for unused `admin = await make_user(...)` results in test setup blocks.
- **Fix:** `ruff check . --fix` for the auto-fixables; manual two-line edit to drop the unused `admin =` assignments.
- **Files modified:** `backend/app/users/service.py`, `backend/app/users/schemas.py`, `backend/tests/test_disable_user_revokes.py`
- **Verification:** `ruff check .` → "All checks passed!"
- **Committed in:** `105b7d8` (Task 2 GREEN)

---

**Total deviations:** 4 (1 Rule-1 bug from misremembered field name, 1 Rule-1 from email-validator's TLD rule, 2 Rule-3 blocking).
**Impact on plan:** Zero scope change. Deviation 1 is a real missing dependency that Plan 01 should have shipped (likely an oversight when constructing the original `pyproject.toml` since `pydantic.EmailStr` was not used until Plan 07). Deviations 2 and 3 are test-data / test-misremembering corrections.

## Threat-Model Conformance

| Threat ID    | Disposition | Implemented in this plan                                                                                                              |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T-01-07-01   | mitigate    | `setup.service.create_initial_admin` re-checks `no_admin_yet` inside the same transaction that inserts the admin row. The IntegrityError fallback also catches a uniqueness violation. Tested by `test_setup_admin_second_call_returns_409`. |
| T-01-07-02   | accept      | Predicate gate (`no_admin_yet`) is the SOLE barrier on `POST /setup/admin`. Documented as accepted v1 design (CONTEXT D-19's bootstrap-token sidecar deferred per Q2 resolution in Plan 06's plan-check). The trust assumption is that the operator just installed the LXC and only their browser can plausibly reach it on first boot. |
| T-01-07-03   | mitigate    | Self-guard rejects PATCH with `is_active=False` targeting self. Tested by `test_patch_user_self_disable_returns_422`. |
| T-01-07-04   | mitigate    | Same self-guard rejects PATCH with `is_admin=False` targeting self. Tested by `test_patch_user_self_remove_admin_returns_422`. |
| T-01-07-05   | mitigate    | Self-guard rejects DELETE self → 422 "Cannot delete yourself". Tested by `test_delete_user_self_returns_422`. |
| T-01-07-06   | mitigate    | `revoke_user_sessions` called synchronously on `is_active` True→False transition. Verified end-to-end by `test_disable_user_revokes_refresh_and_pat_end_to_end` — both refresh cookie and PAT are dead after disable. |
| T-01-07-07   | mitigate    | All `/api/v1/users` routes are admin-gated. Tested by `test_list_users_as_non_admin_returns_403` and `test_create_user_as_non_admin_returns_403`. |
| T-01-07-08   | accept      | Admin POST `/users/{id}/password` sets a new password without verifying the old (recovery flow per design). `revoke_user_sessions` forces the user to log in with the new password. Audit (Phase 2) records who-reset-whom. Tested by `test_admin_set_password_succeeds_and_revokes`. |
| T-01-07-09   | accept      | Personal team names are not user-facing (Plan 08 UI shows "<username> (personal)" label; the raw name is internal). |
| T-01-07-10   | accept (Phase 2 writer) | audit_log schema exists; writer lands Phase 2. v1 admin actions during setup are trusted by operator-of-install. |
| T-01-07-11   | mitigate (partial) | Username uniqueness enforced by the DB UNIQUE constraint (case-sensitive on SQLite TEXT by default). The pydantic regex constrains the input charset but does NOT lowercase — accepted as v1 design. CONTEXT-discretion lowercase-on-insert deferred (would invalidate existing admins from Plan 05 tests during the upgrade window). |
| T-01-07-12   | accept      | Out of scope for password complexity in v1. Phase 5 may add zxcvbn (CONTEXT discretion). |

ASVS L1 mappings:
- V4.1 (account creation) → username regex + EmailStr validation
- V4.2 (administrative interface) → all `/api/v1/users` routes require_admin
- V4.3 (privilege management) → self-guard prevents lockout
- V2.7 (administrative password reset) → revoke_user_sessions after admin-set password
- V3.5 (session termination) → revoke_user_sessions on disable/delete

## Issues Encountered

- **Missing `email-validator` package** (Deviation 1). Caught at first test that exercised `pydantic.EmailStr`. Plan 01's `pyproject.toml` did not include it because pydantic was not used with EmailStr fields in Plans 01-06. Now added.
- **`@example.test` rejected by email-validator** (Deviation 2). The library applies RFC 6761 special-use TLD rules. Tests now use `@example.com` instead. Note this could affect future tests in other plans — the existing factories use `@example.test` defaults, but those construct the email directly into the DB without round-tripping through a pydantic EmailStr validator, so they don't hit the rule.
- **PAT mint response field name** (Deviation 3). Misremembered. Worth a quick scan of upcoming plan tests to make sure the right field name is used.

## Verification Results

| Check                                                                                                | Result                                                          |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `cd backend && python -m pytest tests/test_setup.py -x`                                              | **9 passed**                                                    |
| `cd backend && python -m pytest tests/test_users.py tests/test_disable_user_revokes.py -x`           | **25 passed**                                                   |
| `cd backend && python -m pytest -q` (full suite)                                                     | **166 passed, 5 warnings**                                      |
| `cd backend && ruff check .`                                                                         | **All checks passed!**                                          |
| `grep -q 'no_admin_yet' app/setup/service.py`                                                        | OK                                                              |
| `grep -qE 'is_admin == True\|is_admin\.is_\(True\)\|is_admin=True' app/setup/service.py`             | OK (`.is_(True)` form)                                          |
| `grep -q 'personal=True' app/setup/service.py`                                                       | OK (personal team auto-creation)                                |
| `grep -q 'min_length=12' app/setup/schemas.py`                                                       | OK (password floor)                                             |
| `grep -qE 'pattern=.*\^.*\$' app/setup/schemas.py`                                                   | OK (username pattern)                                           |
| `python -c "from app.main import app; paths=[r.path for r in app.routes]; assert '/api/v1/setup/cluster' not in paths"` | OK (no cluster setup route)                       |
| `grep "registry: ConnectorRegistry \| None = None" app/teams/service.py`                             | OK (Plan 06 signature preserved)                                |
| `grep -q 'revoke_user_sessions' app/users/service.py`                                                | OK (disable revokes tokens)                                     |
| `grep -q 'current_admin_user_id' app/users/service.py`                                               | OK (self-guard wiring)                                          |
| `grep -qE 'Cannot.*yourself\|Cannot modify your own' app/users/service.py`                           | OK (self-guard messages)                                        |
| `grep -q 'personal-' app/users/service.py`                                                           | OK (personal team naming)                                       |
| `grep -q 'team_ids' app/users/schemas.py`                                                            | OK                                                              |
| `grep -q 'min_length=12' app/users/schemas.py`                                                       | OK                                                              |
| Live route inspection: `/api/v1/users/{user_id}/teams/{team_id}` present                             | OK                                                              |
| OpenAPI spec path count                                                                              | **25 paths** (covers all of Phase 1 surface)                    |

## User Setup Required

None — Plan 07 is pure backend code. The first-run wizard becomes user-visible when Plan 08's frontend lands. After Plan 08 ships:

- On first boot, the operator visits `https://<lxc>/` and lands on the wizard.
- Wizard step 1 (welcome) is informational.
- Wizard step 2 (create admin) calls `POST /api/v1/setup/admin`.
- The frontend then auto-logs-in via `POST /api/v1/auth/login` with the just-created credentials.
- Wizard step 3 (optional cluster) calls `POST /api/v1/clusters/test` then `POST /api/v1/clusters/`.
- Wizard step 4 (theme/preferences) is entirely frontend state.

For local development:
- No additional `.env` changes needed.
- `email-validator==2.3.0` is now in `pyproject.toml`; existing developer environments will need a `pip install -e .` (or equivalent) to pick it up.

## Phase 2 Followups (Outstanding TODOs)

1. **Audit-log writer integration (T-01-07-10).** Admin user CRUD (create/disable/delete/password-reset) and team membership changes need audit entries. The audit_log schema is present from Plan 02; the writer ships in Phase 2.
2. **Lazy bootstrap of personal teams on first PVE need.** Today personal teams have ZERO PVE state (no pool, no user, no token). Phase 2 will lazy-bootstrap them when the user first creates a VM/LXC.
3. **`last_login` field on User detail.** The schema field exists (`UserDetailResponse.last_login`) but is always `None` in v1. Phase 2's audit log will populate it.
4. **Admin "force log out" button.** Currently the only way to forcibly log out a user is to disable + re-enable them (which the test suite verifies works). A dedicated "revoke all sessions for this user" admin action could be added in Phase 5 polish.
5. **Optional username case-folding (T-01-07-11).** Today usernames are case-sensitive. Lowercasing on insert would prevent "Alice" vs "alice" confusion but would also need an upgrade path for existing data.

## Hooks Exposed for Later Plans

- `app.setup.service.no_admin_yet(db) -> bool` — Plan 08 frontend's `setup-mode` decision; Phase 5 reset-tooling can also use this.
- `app.setup.service.create_initial_admin(db, ...)` — direct call site for any future "import admin from env" bootstrap variant.
- `app.users.service.create_user(db, ...)` — Phase 2 may compose this with audit entries.
- `app.users.service.set_user_password` — Phase 5 may wire this into a password-recovery email flow.
- `app.users.service.add_user_to_team` / `remove_user_from_team` — Phase 2 may compose these with quota recalculation.
- The self-guard pattern (route extracts principal, passes `current_admin_user_id` to service) is the template for all future admin-only mutation routes.

## Self-Check: PASSED

Verified at write time:

- All 11 created files exist on disk + 2 modified files (`app/main.py`, `pyproject.toml`)
- All four commit hashes (`db93fab`, `e8af0fb`, `4d89cfe`, `105b7d8`) reachable from `master`
- `pytest -q` reports 166 passed
- `ruff check .` reports "All checks passed!"
- Live route inspection confirms 10 method-distinct endpoints across `/api/v1/setup` + `/api/v1/users`; total Phase 1 OpenAPI surface = 25 paths
- All acceptance-criteria greps pass

---

*Phase: 01-foundation*
*Plan: 07-users-admin-setup*
*Completed: 2026-05-14*
