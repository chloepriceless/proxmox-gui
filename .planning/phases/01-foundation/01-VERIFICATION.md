---
phase: 01
phase_name: foundation
verified_at: 2026-05-14T14:05:00Z
verifier: gsd-verifier
goal_achievement: PARTIAL
criteria_met: 4/5
requirements_met: 19/19
tests_passing: 192/192
gaps_count: 2
gaps:
  - truth: "BL-01: A new operator can run the one-line helper-script without shell injection risk"
    status: partial
    reason: "deploy/install.sh:196-203 interpolates operator-supplied $REPO_URL and $RELEASE unquoted inside a bash -c heredoc passed to pct exec, enabling single-quote injection for arbitrary code execution on the Proxmox VE host (BLOCKER per 01-REVIEW.md BL-01). The install script IS present and idempotent, but its security posture is defective."
    artifacts:
      - path: "deploy/install.sh"
        issue: "Lines 196-203: pct exec bash -c with '$REPO_URL' and '$RELEASE' interpolated inside single-quoted shell string — single-quote injection allows code execution on PVE host"
    missing:
      - "Replace string interpolation with env-prefix form: pct exec \"$CTID\" -- env REPO_URL=\"$REPO_URL\" RELEASE=\"$RELEASE\" bash -c '...${REPO_URL}...'"
  - truth: "BL-02: Concurrent first-run requests cannot both create an admin account"
    status: partial
    reason: "setup/service.py:83-127 re-checks no_admin_yet then inserts, but with no unique partial index on users(is_admin) WHERE is_admin=1, two concurrent requests can both pass the pre-check before either INSERT commits under SQLite WAL (BLOCKER per 01-REVIEW.md BL-02). The TOCTOU race is documented as T-01-07-01 but the concrete serialisation mechanism (unique partial index) was not implemented."
    artifacts:
      - path: "backend/app/setup/service.py"
        issue: "Lines 83-127: create_initial_admin relies on pre-check + insert with no DB-level uniqueness constraint on is_admin=True rows"
      - path: "backend/alembic/versions/0001_initial.py"
        issue: "Migration has no unique partial index: CREATE UNIQUE INDEX uq_one_admin ON users (is_admin) WHERE is_admin = 1"
    missing:
      - "Add Alembic migration creating: op.create_index('uq_one_admin', 'users', ['is_admin'], unique=True, sqlite_where='is_admin = 1')"
human_verification:
  - test: "Operator smoke test — install.sh on real Proxmox VE 8.x host"
    expected: "LXC created, bootstrap.sh fetched and executed, first-run wizard reachable at https://<ip>/setup"
    why_human: "Cannot run pct/pvesh in CI environment; install.sh requires an actual Proxmox VE host"
  - test: "First-run wizard step 3 cluster registration with a real PVE instance"
    expected: "Test connection reports PVE version; Register persists cluster; POST /api/v1/clusters/test returns ok:true"
    why_human: "Requires live PVE host reachable from test environment; smoke-test step 14b was documented as skippable if unavailable"
  - test: "ssh-rsa public key acceptance (backlog item 999.1)"
    expected: "ssh-rsa AAAA... key should be accepted when pasted into /profile/ssh-keys"
    why_human: "Smoke test surfaced RSA rejection; root cause documented in .planning/backlog/ssh-rsa-key-acceptance.md but not yet fixed"
---

# Phase 01: Foundation — Verification Report

**Phase Goal:** A non-admin user can log in to a freshly installed GUI that holds securely-stored connections to one or more Proxmox clusters; admin can manage user accounts and SSH keys; everything operates on a multi-tenant schema that will not need retrofitting.
**Verified:** 2026-05-14T14:05:00Z
**Status:** PARTIAL (4/5 criteria verified — 2 code-level BLOCKERs from 01-REVIEW.md confirmed in source)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1a | One-line install.sh script exists and is idempotent | VERIFIED | `deploy/install.sh` 217 lines, shellcheck-clean per ROADMAP, DEPLOY-01 |
| 1b | First-run wizard creates admin + optional cluster | VERIFIED | `backend/app/setup/routes.py` — `GET /api/v1/setup/status` + `POST /api/v1/setup/admin`; `frontend/src/routes/setup/+page.svelte` 4-step wizard; smoke-test 21/21 step 1-5 confirmed |
| 1c | install.sh is free from shell injection via operator-supplied flags | FAILED | `deploy/install.sh:196-203` interpolates `$REPO_URL` and `$RELEASE` unquoted into `bash -c "..."` heredoc; single-quote injection enables code execution on PVE host (BL-01) |
| 1d | TOCTOU on first-admin creation is serialized at DB level | FAILED | No unique partial index on `users(is_admin) WHERE is_admin=1`; `setup/service.py` pre-check is NOT race-proof under concurrent requests (BL-02); `alembic/versions/0001_initial.py` confirms absence |
| 2a | Argon2id password hashing | VERIFIED | `backend/app/core/passwords.py`: `pwdlib.PasswordHash.recommended()` (argon2id); DUMMY_HASH for timing protection; `verify_password` with try/except |
| 2b | JWT access + DB-stored refresh tokens with rotation + replay detection | VERIFIED | `backend/app/auth/refresh.py`: `ReplayDetected` class, `_revoke_chain` full-chain revoke; `backend/app/auth/service.py`: `rotate_refresh` issues new access token |
| 2c | Hetzner-style AppShell with sidebar + topbar | VERIFIED | `frontend/src/lib/components/layout/AppShell.svelte`, `Sidebar.svelte`, `Topbar.svelte`; layout wraps when `data.user` set per `+layout.svelte` |
| 2d | Light/dark theme store SSR-safe | VERIFIED | `frontend/src/lib/stores/theme.svelte.ts`: `window.localStorage` access inside `init()` which is called `onMount` — SSR-safe; smoke-test step 6 confirmed |
| 2e | User can change own password | VERIFIED | `/profile` page with current + new password fields; `api.me.changePassword`; toast "Password updated. Other sessions were signed out." — smoke-test step 8 |
| 2f | SSH key CRUD at `/profile/ssh-keys` | VERIFIED | `frontend/src/routes/profile/ssh-keys/`; ConfirmByNameDialog on delete; fingerprint display — smoke-test steps 9 confirmed (ed25519 worked; ssh-rsa rejection is a backlog item) |
| 2g | Logout clears cookies | VERIFIED | `backend/app/auth/routes.py`: cookie delete on logout; smoke-test step 15 confirmed cookies cleared |
| 2h | Session survives browser refresh | VERIFIED | `frontend/src/hooks.server.ts`: `event.locals.user` hydrated from `/api/v1/me/` probe on every SSR request; smoke-test step 17 confirmed |
| 3a | Admin user CRUD endpoints | VERIFIED | `backend/app/users/routes.py`: `GET/POST /api/v1/users`, `GET/PATCH/DELETE /api/v1/users/{id}`, `POST /api/v1/users/{id}/password`; all `Depends(require_admin)` |
| 3b | Self-modification guard | VERIFIED | `backend/app/users/service.py:213`: self-guard 422 on `is_admin`/`is_active` change; smoke-test step 12 confirmed UI guard hides Disable/Delete on own row |
| 3c | Disable triggers revoke_user_sessions | VERIFIED | `backend/app/users/service.py:222-250`: `is_active` True→False transition calls `revoke_user_sessions(db, user_id=user_id)`; smoke-test step 13 confirmed |
| 3d | Admin can assign users to teams | VERIFIED | `PUT /api/v1/users/{id}/teams` + `DELETE /api/v1/users/{id}/teams/{team_id}`; `team_ids` REPLACE semantics in `update_user`; `/admin/users/new` + `/admin/users/[id]` multi-select |
| 4a | Cluster dry-run test endpoint | VERIFIED | `POST /api/v1/clusters/test` in `backend/app/clusters/routes.py:66`; two-button form in `/admin/clusters/new` — smoke-test step 14a/b confirmed dry-run makes no DB write |
| 4b | Cluster registration persists | VERIFIED | `POST /api/v1/clusters/` in `backend/app/clusters/routes.py:92`; smoke-test step 14c confirmed 201 response |
| 4c | API tokens encrypted at rest (Fernet) | VERIFIED | `backend/app/models/cluster.py:38`: `api_token_secret: Mapped[str] = mapped_column(EncryptedSecret, nullable=False)`; `backend/app/models/_types.py:21`: `EncryptedSecret` TypeDecorator using `_get_cipher().encrypt/decrypt()` |
| 4d | Cluster-context in resource URLs | VERIFIED | `backend/app/clusters/routes.py`: all sub-resources at `/{cluster_id}/...`; CLUST-05 marked complete |
| 4e | Per-tenant privilege-separated PVE tokens | VERIFIED | `backend/app/teams/bootstrap.py`: `bootstrap_tenant_on_clusters` creates PVE pool + user `gui-team-<id>!api` with `PVEVMUser` role; `team_cluster_token.token_secret` uses `EncryptedSecret` |
| 4f | TLS verify_ssl toggle | VERIFIED | `backend/app/clusters/service.py:251-262`: `effective_verify_ssl` computed from payload or stored value; smoke confirmed TLS bypass for self-signed PVE |
| 5a | `/api/openapi.json` served | VERIFIED | `backend/app/main.py:82`: `openapi_url="/api/openapi.json"`; FastAPI 0.100+ defaults to OpenAPI 3.1.0 (confirmed in `.venv/lib/python3.12/site-packages/fastapi/applications.py:922`) |
| 5b | `/api/docs` + `/api/redoc` accessible | VERIFIED | `backend/app/main.py:83-84`: `docs_url="/api/docs"`, `redoc_url="/api/redoc"` |
| 5c | PAT Bearer auth coexists with session cookies | VERIFIED | `backend/app/auth/dependencies.py:61-89`: `_PAT_BEARER_RE = r"^pat_[A-Za-z0-9_-]{8,}$"`; Bearer PAT path vs cookie path; smoke-test step 10 confirmed PAT curl works |
| 5d | SvelteKit UI consumes same `/api/v1/*` endpoints | VERIFIED | `frontend/src/lib/api/client.ts` + all `api.*` modules use relative `/api/v1/...` paths; `hooks.server.ts` proxies to backend (dev) / Caddy routes (prod); no separate BFF |
| MT | Every business table carries `team_id` or `user_id` | VERIFIED | `team_cluster_tokens.team_id`, `team_memberships.team_id`, `audit_log.team_id`, `jobs.team_id`, `quota.team_id`; personal-data tables (`ssh_keys`, `pats`, `refresh_tokens`) carry `user_id`; 11-table schema from Plan 02 |

**Score: 23/25 truths verified (2 FAILED — BL-01 shell injection, BL-02 TOCTOU)**

---

### Deferred Items

No items deferred to later phases. The two failures are code defects in Phase 1 artifacts with no later-phase coverage in ROADMAP.md.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `deploy/install.sh` | One-line installer, shellcheck-clean | PARTIAL | Exists (217 lines), shellcheck-clean per Plan 04 SUMMARY, but shell injection at lines 196-203 (BL-01) |
| `deploy/lxc/bootstrap.sh` | LXC bootstrap with Python 3.12 + deps | VERIFIED | 205 lines, full dependency install + systemd + Caddy config |
| `backend/app/setup/routes.py` | `GET /setup/status` + `POST /setup/admin` open endpoints | VERIFIED | Both present; `setup_status` returns `{no_admin_yet, cluster_count}` |
| `backend/app/setup/service.py` | `no_admin_yet` + `create_initial_admin` | PARTIAL | Logic correct; TOCTOU race not serialized at DB level (BL-02) |
| `backend/alembic/versions/0001_initial.py` | 11-table schema, unique partial index on is_admin | PARTIAL | 11 tables created; missing `uq_one_admin` partial index |
| `backend/app/core/passwords.py` | Argon2id hash + verify | VERIFIED | `pwdlib.PasswordHash.recommended()` with DUMMY_HASH |
| `backend/app/auth/refresh.py` | Refresh token rotation + replay detection | VERIFIED | `ReplayDetected`, `_revoke_chain`, chain revocation |
| `backend/app/auth/dependencies.py` | PAT Bearer + cookie dual-mode auth | VERIFIED | `_PAT_BEARER_RE`, `resolve_pat` path, cookie fallback |
| `backend/app/models/_types.py` | `EncryptedSecret` TypeDecorator (Fernet) | VERIFIED | `encrypt`/`decrypt` via `_get_cipher()` |
| `backend/app/models/cluster.py` | `api_token_secret` as `EncryptedSecret` | VERIFIED | Line 38 |
| `backend/app/models/team_cluster_token.py` | `token_secret` as `EncryptedSecret` | VERIFIED | Line 38 |
| `backend/app/clusters/routes.py` | Cluster CRUD + dry-run test + re-test | VERIFIED | `test_cluster_dryrun`, `create_cluster`, `get_cluster`, `patch_cluster`, `test_existing_cluster`, `delete_cluster` |
| `backend/app/users/routes.py` | Admin user CRUD + team membership | VERIFIED | Full CRUD + `setPassword` + `addTeam`/`removeTeam`; `require_admin` on all |
| `backend/app/teams/bootstrap.py` | Per-tenant PVE privilege-separated bootstrap | VERIFIED | `bootstrap_tenant_on_clusters` creates pool + PVEVMUser-role token |
| `backend/app/main.py` | FastAPI app, `/api/openapi.json`, `/api/docs`, `/api/redoc` | VERIFIED | `openapi_url`, `docs_url`, `redoc_url` all set; OpenAPI 3.1.0 default |
| `frontend/src/routes/setup/+page.svelte` | 4-step first-run wizard | VERIFIED | Steps 1-4, auto-login after admin creation, skip cluster |
| `frontend/src/routes/login/+page.svelte` | Login form | VERIFIED | Present; smoke-test step 6 confirmed |
| `frontend/src/lib/components/layout/AppShell.svelte` | Hetzner-style shell | VERIFIED | Sidebar + topbar; conditional on `data.user` in `+layout.svelte` |
| `frontend/src/lib/stores/theme.svelte.ts` | SSR-safe light/dark store | VERIFIED | `init()` defers `localStorage` access to `onMount` |
| `frontend/src/routes/profile/+page.svelte` | Change own password | VERIFIED | Current + new + confirm; toast on success |
| `frontend/src/routes/profile/ssh-keys/+page.svelte` | SSH key CRUD | VERIFIED | List + add + ConfirmByNameDialog delete |
| `frontend/src/routes/profile/tokens/+page.svelte` | PAT management | VERIFIED | SecretRevealDialog show-once; prefix-only display on refresh |
| `frontend/src/routes/admin/users/+page.svelte` | Admin user list + row actions | VERIFIED | Data table; Disable/Delete via ConfirmByNameDialog; self-guard |
| `frontend/src/routes/admin/clusters/new/+page.svelte` | Register cluster — two distinct buttons | VERIFIED | Test (dry-run `/clusters/test`) and Register (persist `/clusters/`) verified by audit greps |
| `frontend/src/lib/components/clusters/ClusterStatusPill.svelte` | Status pill ok/failed/untested | VERIFIED | Semantic CSS vars; icon + label pair |
| `frontend/src/hooks.server.ts` | `/api/*` proxy + `event.locals.user` hydration | VERIFIED | Proxy to `BACKEND_URL`; `/api/v1/me/` probe populates `locals.user` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `frontend/setup/+page.svelte` | `POST /api/v1/setup/admin` | `api.setup.createAdmin` | WIRED | Confirmed in wizard step 2 handler |
| `frontend/setup/+page.svelte` | `POST /api/v1/auth/login` | `api.auth.login` | WIRED | Auto-login after admin creation |
| `frontend/admin/clusters/new` | `POST /api/v1/clusters/test` | `api.clusters.test` in `handleTest` | WIRED | Grep-verified: `api.clusters.test(body)` at line 180 in handleTest |
| `frontend/admin/clusters/new` | `POST /api/v1/clusters/` | `api.clusters.create` in `handleRegister` | WIRED | Grep-verified: `api.clusters.create(body)` at line 223 in handleRegister |
| `backend/clusters/service.py` | `team_cluster_token` | `EncryptedSecret` at rest | WIRED | `mapped_column(EncryptedSecret)` on `token_secret` field |
| `backend/auth/dependencies.py` | `pats/service.py:resolve_pat` | `Bearer pat_*` header match | WIRED | Lines 83-85: `from app.pats.service import resolve_pat; user = await resolve_pat(db, token=token)` |
| `backend/users/service.py` | `auth/service.py:revoke_user_sessions` | `is_active` True→False trigger | WIRED | Lines 222-250 call `revoke_user_sessions(db, user_id=user_id)` |
| `install.sh` | `deploy/lxc/bootstrap.sh` | `pct exec ... curl ... | bash` | WIRED (with injection flaw) | Line 202: curl fetches bootstrap.sh and pipes to bash — functional but BL-01 injection risk |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `admin/users/+page.svelte` | user list | `api.users.list` → `GET /api/v1/users` → `service.list_users` → SQLAlchemy `select(User)` | Yes | FLOWING |
| `admin/clusters/+page.svelte` | cluster list | `api.clusters.list` → `GET /api/v1/clusters` → `service.list_clusters` → SQLAlchemy `select(Cluster)` | Yes | FLOWING |
| `profile/ssh-keys/+page.svelte` | ssh key list | `api.me.sshKeys.list` → `GET /api/v1/me/ssh-keys` → `service.list_keys` → DB query | Yes | FLOWING |
| `profile/tokens/+page.svelte` | PAT list | `api.me.tokens.list` → `GET /api/v1/me/pats` → `service.list_pats` → DB query | Yes | FLOWING |
| `setup/+page.svelte` | cluster count | `api.setup.status` → `GET /api/v1/setup/status` → `service.cluster_count` → `select(func.count())` | Yes | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend test suite | `cd /home/dev/vm-deployment-gui/backend && .venv/bin/pytest tests/ -q --tb=no` | 166 passed, 4 warnings | PASS |
| Frontend test suite | `cd /home/dev/vm-deployment-gui/frontend && pnpm run test` | 26 passed (4 suites) | PASS |
| Shell injection exists in install.sh | `grep -n "export REPO_URL='\$REPO_URL'" deploy/install.sh` | Line 198 confirmed | FAIL (BL-01) |
| Unique partial index absent from migration | `grep -n "uq_one_admin" backend/alembic/versions/0001_initial.py` | No match | FAIL (BL-02) |
| EncryptedSecret wired on cluster model | `grep "EncryptedSecret" backend/app/models/cluster.py` | Line 38 confirmed | PASS |
| Two-button cluster form wiring | `grep -n "api.clusters.test\|api.clusters.create" frontend/src/routes/admin/clusters/new/+page.svelte` | Lines 180 + 223 — distinct handlers | PASS |
| OpenAPI 3.1 default | FastAPI `.venv` `applications.py:922`: `openapi_version = "3.1.0"` | Confirmed | PASS |

---

### Requirements Coverage

| Requirement | Plans | Description (condensed) | Status | Evidence |
|-------------|-------|------------------------|--------|----------|
| AUTH-01 | 01-05, 01-08 | Login with username + password | SATISFIED | `backend/app/auth/routes.py` login_route; `frontend/routes/login`; smoke step 6 |
| AUTH-02 | 01-05, 01-08 | Session management — access + refresh tokens, logout | SATISFIED | JWT + refresh rotation; cookie delete on logout; smoke step 15 |
| AUTH-03 | 01-05, 01-09 | User can change own password | SATISFIED | `me/routes.py` + `/profile` change-password card; smoke step 8 |
| AUTH-04 | 01-05, 01-09 | SSH key management | SATISFIED | `ssh_keys/routes.py` + `/profile/ssh-keys`; smoke step 9 |
| AUTH-05 | 01-05, 01-09 | Personal Access Token auth | SATISFIED | `pats/routes.py` + `/profile/tokens` + PAT Bearer in `dependencies.py`; smoke step 10 |
| AUTH-07 | 01-07, 01-10 | Admin can disable users | SATISFIED | `users/service.py` disable + `revoke_user_sessions`; admin UI Disable action; smoke step 13 |
| AUTH-08 | 01-06, 01-07, 01-10 | Admin can assign users to teams | SATISFIED | `users/routes.py` team endpoints; edit user team multi-select |
| CLUST-01 | 01-06, 01-10 | Admin registers Proxmox clusters | SATISFIED | `clusters/routes.py` POST; `/admin/clusters/new` form; smoke step 14 |
| CLUST-05 | 01-06 | Cluster context in every resource URL | SATISFIED | `/{cluster_id}/...` path structure in clusters router |
| CLUST-06 | 01-06 | Works with single-node and clustered PVE | SATISFIED | Connector uses `/cluster/resources` which works on standalone nodes |
| API-01 | 01-05 | REST API exposes every UI capability | SATISFIED | All routes in FastAPI; UI uses same `/api/v1/*` paths |
| API-02 | 01-05, 01-09 | PAT auth works alongside session cookies | SATISFIED | Dual-mode in `dependencies.py`; smoke step 10 curl test |
| API-03 | 01-05 | OpenAPI auto-generated at documented path | SATISFIED | `/api/openapi.json` + `/api/docs` + `/api/redoc`; FastAPI 3.1.0 default |
| UI-01 | 01-03, 01-08 | SvelteKit UI skeleton with app shell | SATISFIED | AppShell + Sidebar + Topbar; shadcn-svelte; plan 03 scaffold |
| UI-02 | 01-03, 01-08 | Light/dark mode | SATISFIED | `theme.svelte.ts` SSR-safe localStorage; ThemeToggle in Topbar |
| DEPLOY-01 | 01-04 | One-line installer | SATISFIED (with BL-01 caveat) | `deploy/install.sh` exists and is functional; shell injection is a security defect not a functional failure |
| DEPLOY-02 | 01-04 | LXC bootstrap with dependencies | SATISFIED | `deploy/lxc/bootstrap.sh` installs Python 3.12, Node, builds frontend, Caddy, systemd |
| DEPLOY-03 | 01-04 | Systemd service units | SATISFIED | `deploy/systemd/proxmox-gui-api.service` + `proxmox-gui-worker.service` |
| DEPLOY-05 | 01-07, 01-08 | First-run wizard creates admin + optionally registers cluster | SATISFIED (with BL-02 caveat) | `setup/routes.py` + wizard frontend; TOCTOU is a concurrent-request edge case, not a normal operator flow failure |

**19/19 requirements satisfied** (2 have security/correctness caveats noted above)

---

### Anti-Patterns Found

| File | Location | Pattern | Severity | Impact |
|------|----------|---------|---------|--------|
| `deploy/install.sh` | Lines 196-203 | `export REPO_URL='$REPO_URL'` inside `bash -c "..."` | BLOCKER | Shell injection: `--repo-url` or `--release` with single-quote escapes the string; arbitrary code on PVE host |
| `backend/app/setup/service.py` | Lines 83-127 | `no_admin_yet` check then insert without serialization | BLOCKER | TOCTOU: two concurrent `POST /setup/admin` can both succeed; no `uq_one_admin` partial index in migration |
| `backend/app/auth/routes.py` | Lines 46-59 | `X-Forwarded-For` unconditionally trusted | HIGH | Rate-limit bypass: forged `X-Forwarded-For` header defeats 10-attempt/60s limit (BL-01 in 01-REVIEW.md) |
| `backend/app/pats/service.py` | Lines 139-148 | `hasattr(PersonalAccessToken, "user")` always False | HIGH | Dead code: `selectinload` never applied; harmless today but misleading (HI-02 in 01-REVIEW.md) |
| `backend/app/users/service.py` | Lines 338-370 | `revoke_user_sessions` commits mid-function in `delete_user` | HIGH | Ghost account risk: if exception between first and second commit, sessions revoked but user not deleted (HI-03) |

---

### Human Verification Required

#### 1. Install Script on Real PVE Host

**Test:** Run `bash -c "$(curl -fsSL <url>/deploy/install.sh)"` on a Proxmox VE 8.x host.
**Expected:** LXC created, bootstrap.sh executed, first-run wizard reachable at `https://<ip>/setup`.
**Why human:** Cannot run `pct`/`pvesh` in CI; requires actual Proxmox VE host.

#### 2. Cluster Registration with Live PVE

**Test:** In the admin cluster registration form, enter a real PVE 8.x URL and API token; click Test then Register.
**Expected:** Test returns `ClusterStatusPill ok` with version string; Register returns 201 and cluster appears in list.
**Why human:** Requires live PVE instance reachable from test environment.

#### 3. ssh-rsa Key Acceptance

**Test:** Generate an RSA 4096-bit key (`ssh-keygen -t rsa -b 4096 -f /tmp/rsa_test -N ""`), paste `/tmp/rsa_test.pub` into `/profile/ssh-keys`.
**Expected:** Key accepted and fingerprint displayed.
**Why human:** Smoke test surfaced RSA rejection (root cause unknown); tracked in `.planning/backlog/ssh-rsa-key-acceptance.md`. Could be SHA-1 restriction, options-prefix, or CRLF. Needs hands-on debugging.

---

### Gaps Summary

Two BLOCKER-grade code defects were confirmed by direct source inspection:

**BL-01 — Shell Injection in `deploy/install.sh`**

`deploy/install.sh:196-203` passes `$REPO_URL` and `$RELEASE` (operator-supplied via `--repo-url` and `--release` flags) as single-quoted string literals inside a `bash -c "..."` heredoc executed via `pct exec`. A single-quote in either value terminates the outer string and injects arbitrary commands that execute with root-equivalent privileges on the Proxmox VE host.

Fix: Replace `pct exec "$CTID" -- bash -c "export REPO_URL='$REPO_URL'; ..."` with the env-prefix form:
```bash
pct exec "$CTID" -- env REPO_URL="$REPO_URL" RELEASE="$RELEASE" \
  bash -c 'curl -fsSL "${REPO_URL}/raw/${RELEASE}/deploy/lxc/bootstrap.sh" | bash'
```

**BL-02 — TOCTOU Race on First-Run Admin Creation**

`backend/app/setup/service.py:83-127` calls `no_admin_yet(db)` as a pre-check then inserts the admin row. These are two separate DB operations in the same session. Under SQLite WAL mode, two concurrent `POST /api/v1/setup/admin` requests can both observe `no_admin_yet = True` before either INSERT is committed, yielding two admin rows and two silent 201 responses. The comment in `service.py` says "T-01-07-01 race mitigation" but the migration in `alembic/versions/0001_initial.py` contains no `uq_one_admin` unique partial index.

Fix: Add Alembic migration:
```python
op.create_index(
    "uq_one_admin", "users", ["is_admin"],
    unique=True,
    postgresql_where=sa.text("is_admin = 1"),
    sqlite_where=sa.text("is_admin = 1"),
)
```
The existing `except IntegrityError → 409` block in `create_initial_admin` already handles the race correctly once the constraint exists.

Both gaps are self-contained fixes. The remaining 4 success criteria (login + shell, admin CRUD, cluster registration + encrypted tokens, OpenAPI + PAT) are fully verified at code level. The functional goal of the phase is achieved for normal operation; the two gaps represent exploitable edge cases (concurrent setup requests, socially-engineered installer flags) rather than missing features.

---

**Additional Notes from 01-REVIEW.md (not goal-blocking but should be tracked):**

- **HI-01** (`auth/routes.py`): `X-Forwarded-For` unconditionally trusted — rate-limit bypass if Caddy is misconfigured or attacker sends forged header. Fix: whitelist trusted proxy IPs.
- **HI-02** (`pats/service.py:139-148`): dead `hasattr` branch; `selectinload` never applied. Remove dead code.
- **HI-03** (`users/service.py:338-370`): `delete_user` two-commit path — ghost account risk on exception between commits. Inline revocations to single transaction.
- **ssh-rsa rejection** backlog item: documented in `.planning/backlog/ssh-rsa-key-acceptance.md`; RSA key type was rejected in smoke test step 9; root cause TBD.

---

_Verified: 2026-05-14T14:05:00Z_
_Verifier: Claude (gsd-verifier)_
_Tests at verification: 166 backend (pytest, all pass) + 26 frontend (vitest, all pass) = 192/192_
