---
phase: 01-foundation
plan: 05
subsystem: auth
tags:
  - backend
  - auth
  - sessions
  - jwt
  - csrf
  - argon2id
  - refresh-rotation
  - pats
  - ssh-keys
  - rate-limit
  - tdd

# Dependency graph
requires:
  - phase: 01-01-backend-scaffold
    provides: "issue_access_token, decode_access_token, hash_password, verify_password, DUMMY_HASH, mint_csrf_token, verify_csrf, get_db, settings (TTLs, cookie_secure, pat_pepper, csrf_cookie_name)"
  - phase: 01-02-db-schema
    provides: "User, Team, TeamMembership, RefreshToken, PersonalAccessToken, SshKey models"
provides:
  - "POST /api/v1/auth/login (3-cookie session: access + refresh httpOnly + csrf JS-readable)"
  - "POST /api/v1/auth/refresh with chain-replay detection (Pitfall 22)"
  - "POST /api/v1/auth/logout (idempotent; clears all 3 cookies + revokes row)"
  - "GET /api/v1/me/ (cookie OR Bearer pat_* — dual-mode)"
  - "POST /api/v1/me/password (verify current + revoke all OTHER refresh rows)"
  - "GET/POST/GET-by-id/DELETE /api/v1/me/ssh-keys with cryptography-validated parse + SHA256 fingerprint"
  - "GET/POST/DELETE /api/v1/me/tokens (PATs) with show-once plaintext + prefix_preview metadata"
  - "Principal dataclass + get_current_principal/require_admin/csrf_protect dependencies (D-12 + D-13)"
  - "consume_refresh + ReplayDetected exception + _revoke_chain (T-01-05-02 mitigation)"
  - "revoke_user_sessions hook for Plan 07's disable_user (AUTH-07)"
  - "In-memory per-IP login rate limiter (10/60s default; T-01-05-08)"
  - "Pitfall A8 mitigation: Bearer must match ^pat_[A-Za-z0-9_-]{8,}$ or 401"
affects:
  - 01-06-clusters-tenant-bootstrap (composes require_admin on every cluster mutating route)
  - 01-07-users-admin-setup (calls revoke_user_sessions on disable_user; uses Principal + csrf_protect)
  - 01-08-frontend-auth-shell (consumes /auth/login + /me + /auth/refresh + /auth/logout + csrf_token cookie)
  - 01-09-frontend-account (consumes /me/password + /me/ssh-keys + /me/tokens)
  - 01-10-frontend-admin (consumes require_admin gating; admin routes use the same Principal)
  - 02-* (audit-log writer will compose with refresh / logout / login flows; same Principal)
  - 03-* (job queue writes go through csrf_protect; same Principal)

# Tech tracking
tech-stack:
  added: []  # No new top-level deps — all primitives already in Plan 01.
  patterns:
    - "Dual-mode auth via Principal + get_current_principal (cookie OR Bearer PAT) — Pattern 4 in 01-RESEARCH"
    - "DB-stored refresh tokens with replaced_by_id self-FK rotation chain + cascade revoke on replay (Pattern 5)"
    - "PAT format pat_<24 url-safe>; (lookup_prefix, sha256(pepper||token)) two-step constant-time lookup (Pattern 6)"
    - "SSH key parse via cryptography.serialization.load_ssh_public_key — no shell execution (T-01-05-09)"
    - "Double-submit CSRF as dependency, NOT middleware (composed per-route via dependencies=[Depends(csrf_protect)])"
    - "Service layer commits its own transactions before raising HTTPException so revocations survive get_db rollback"
    - "Sliding-window in-memory rate-limit bucket keyed (route, ip) with X-Forwarded-For preference"

key-files:
  created:
    - backend/app/auth/__init__.py
    - backend/app/auth/dependencies.py
    - backend/app/auth/rate_limit.py
    - backend/app/auth/refresh.py
    - backend/app/auth/routes.py
    - backend/app/auth/schemas.py
    - backend/app/auth/service.py
    - backend/app/me/__init__.py
    - backend/app/me/routes.py
    - backend/app/pats/__init__.py
    - backend/app/pats/routes.py
    - backend/app/pats/schemas.py
    - backend/app/pats/service.py
    - backend/app/ssh_keys/__init__.py
    - backend/app/ssh_keys/routes.py
    - backend/app/ssh_keys/schemas.py
    - backend/app/ssh_keys/service.py
    - backend/tests/factories.py
    - backend/tests/test_auth.py
    - backend/tests/test_csrf.py
    - backend/tests/test_pats.py
    - backend/tests/test_refresh_rotation.py
    - backend/tests/test_ssh_keys.py
  modified:
    - backend/app/main.py
    - backend/tests/conftest.py

key-decisions:
  - "consume_refresh commits chain-revoke BEFORE raising ReplayDetected — get_db rollback would otherwise discard revocations and a replay would not see the chain dead"
  - "Refresh cookie path scoped to /api/v1/auth (smaller blast radius); access + csrf cookies path=/"
  - "POST /api/v1/auth/refresh has NO csrf dependency — httpOnly refresh cookie + SameSite=Lax suffices; documented inline"
  - "Pitfall A8 strict shape check on Bearer: ^pat_[A-Za-z0-9_-]{8,}$; anything else → 401 (does NOT fall through to cookie)"
  - "Task 1 GREEN landed PAT + SSH service AND routes because Task 1's test_csrf needs PAT-Bearer auth + SSH-key POST end-to-end; Task 2 only added the dedicated PAT + SSH tests"
  - "Autouse rate-limit reset fixture lives in conftest.py (not per-test) because the limiter is module-level by design — test isolation is the harness's responsibility, not production's"
  - "PAT routes reject Bearer-PAT auth (403 'PAT cannot manage tokens') — T-01-05-10 elevation-of-privilege mitigation"
  - "SSH-key cross-user delete returns 404 (not 403) — T-01-05-11 don't-leak-existence pattern, same as GitHub/GitLab"
  - "PAT cross-user revoke also returns 404 — same pattern for the same reason"
  - "Rate limiter is in-memory only (T-01-05-14 accept disposition; Phase 5 can harden to redis if abuse observed)"

patterns-established:
  - "Service-layer commits: any service function that may raise HTTPException after writing critical state (revocations, audit) MUST commit the state before raising — get_db rolls back on exception"
  - "Dependency chain for protected routes: Depends(get_current_principal) for auth, Depends(csrf_protect) for state-changing cookie routes; PAT-auth automatically bypasses csrf_protect"
  - "Test factories live in tests/factories.py — re-usable make_user(session_factory, ...) + login_as(client, ...) helpers; future plans extend this module"
  - "Conftest owns process-state reset for module-level singletons (cipher, rate limiter); production code does NOT reset these"
  - "Bearer-shape gate is regex-strict and pre-DB; saves a DB round-trip on malformed Bearer values and forces Pitfall A8 conformance"

requirements-completed:
  - AUTH-01  # username/password login (argon2id + JWT)
  - AUTH-02  # password storage (argon2id via pwdlib + change-password flow)
  - AUTH-03  # session management (cookies + refresh rotation)
  - AUTH-04  # logout (clears cookies, revokes refresh row)
  - AUTH-05  # SSH key CRUD
  - API-01   # REST API contract surface (auth endpoints OpenAPI-tagged)
  - API-02   # Personal Access Tokens
  - API-03   # OpenAPI 3.1 spec covers the new endpoints

# Metrics
duration: ~14min
completed: 2026-05-14
---

# Phase 01 Plan 05: Auth Subsystem Summary

**Local-auth surface: Argon2id login with 3-cookie sessions (D-09), refresh rotation with chain-replay detection (T-01-05-02), dual-mode `get_current_principal` (cookie OR Bearer pat_*), double-submit CSRF dependency (D-13), per-IP login rate limiter (T-01-05-08), `/me` + SSH-key CRUD + PAT CRUD with show-once plaintext, plus the `revoke_user_sessions` hook Plan 07 will call from `disable_user` (AUTH-07).**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-14T03:54:49Z
- **Completed:** 2026-05-14T04:08:06Z
- **Tasks:** 2 (both `type=auto` + `tdd=true`)
- **Commits:** 4 (test → feat → test → fix; TDD discipline preserved across both tasks)
- **Files created:** 23 (18 backend modules + 5 test files)
- **Files modified:** 2 (`app/main.py` routers, `tests/conftest.py` rate-limit reset)

## Accomplishments

- **Login flow (D-09 + D-13):** `POST /api/v1/auth/login` mints HS256 access JWT + Argon2id verifies `DUMMY_HASH` on user-miss (T-01-05-01 enumeration mitigation) + sets three cookies (`access_token` httpOnly, `refresh_token` httpOnly path=/api/v1/auth, `csrf_token` JS-readable for the SPA).
- **Refresh rotation with chain-replay detection (Pitfall 22 / T-01-05-02):** `consume_refresh` walks the `replaced_by_id` chain on replay and revokes every reachable row, then commits BEFORE raising so a real chain-replay attack cannot recover via the get_db rollback.
- **Dual-mode auth (D-12):** Single `get_current_principal` dependency resolves either a cookie session OR `Authorization: Bearer pat_*`. Pitfall A8 strict regex `^pat_[A-Za-z0-9_-]{8,}$` rejects all other Bearer shapes with 401 instead of silently falling through to cookie auth.
- **Double-submit CSRF (D-13):** `csrf_protect` dependency reads cookie + `X-CSRF-Token` header, constant-time compares via `verify_csrf`. PAT auth bypasses (no cookie); safe methods bypass (GET/HEAD/OPTIONS); composed per-route via `dependencies=[Depends(csrf_protect)]`.
- **Rate limiter (T-01-05-08):** In-memory sliding-window bucket, 10 attempts/60s per IP. X-Forwarded-For preferred for reverse-proxy correctness (Caddy ships behind the LXC).
- **SSH-key CRUD (AUTH-05):** Parses RSA / ed25519 / ecdsa via `cryptography.hazmat.primitives.serialization.load_ssh_public_key` (T-01-05-09 — no shell exec), derives `SHA256:<base64>` fingerprint over the wire-format blob; cross-user DELETE returns 404 (T-01-05-11).
- **PAT CRUD (API-02):** `mint_pat` returns plaintext exactly once; storage is `(lookup_prefix indexed, sha256(pepper||token))` for ~O(1) candidate selection + `secrets.compare_digest` for the final compare (T-01-05-07); `revoke_pat` does cross-user check via `WHERE id=:id AND user_id=:uid` (T-01-05-11); PAT auth on `/me/tokens/*` is rejected 403 (T-01-05-10).
- **`revoke_user_sessions` hook:** Plan 07's `disable_user` will call this — revokes refresh tokens AND PATs in one transaction (AUTH-07).
- **Test count:** 56 → 90 (34 new tests across 5 files), all green; ruff clean.

## Task Commits

Each task committed atomically with TDD red→green discipline:

1. **Task 1 RED — failing auth + refresh-rotation + CSRF tests** — `e4894fa` (test)
2. **Task 1 GREEN — auth subsystem implementation (login/refresh/logout/me/csrf + PAT and SSH-key routes since Task 1's CSRF test exercises both via Bearer pat_*)** — `56bcf44` (feat)
3. **Task 2 RED — SSH-key + PAT route + service tests** — `3827480` (test)
4. **Task 2 GREEN — autouse rate-limit reset fixture in conftest.py + ruff fixup** — `48462b6` (fix)

**Plan metadata:** TBD (this commit) — captures SUMMARY.md + STATE.md + ROADMAP.md.

## Files Created/Modified

### Auth core (`backend/app/auth/`)

- `__init__.py` — package marker + module-roadmap docstring
- `dependencies.py` — `Principal` dataclass; `get_current_principal` (regex-gated Bearer PAT → cookie fallback); `require_admin`; `csrf_protect`
- `refresh.py` — `hash_refresh` (sha256), `issue_refresh` (rotation chain pointer set), `consume_refresh` (revocation + replay detection + chain-revoke commit), `revoke_all_for_user`, `compute_expires_at`; `InvalidRefresh` / `ReplayDetected` exceptions
- `rate_limit.py` — module-level `_buckets` dict + `check_rate` (sliding window) + `check_login_rate` defaults (10/60s)
- `routes.py` — `/login`, `/refresh`, `/logout`; `_client_ip` (XFF-aware); `_set_session_cookies` / `_clear_session_cookies` helpers; explicit no-CSRF note on `/refresh`
- `schemas.py` — `LoginRequest/Response`, `MeResponse`, `TeamSummary`, `RefreshResponse`, `LogoutResponse`, `PasswordChangeRequest` (12+ chars)
- `service.py` — `login`, `refresh` (catches `ReplayDetected`), `logout` (idempotent), `change_password` (verify current + revoke siblings), `revoke_user_sessions` (Plan 07 hook); `LoginResult` dataclass

### `/me` (`backend/app/me/`)

- `__init__.py` — package marker
- `routes.py` — `GET /` (returns `MeResponse` with selectinload-populated teams); `POST /password` (CSRF-protected; preserves current session via `keep_session_id` derived from the current refresh cookie's hash)

### SSH keys (`backend/app/ssh_keys/`)

- `__init__.py` — package marker
- `service.py` — `parse_ssh_pubkey` (cryptography validate + base64 decode + SHA256 fingerprint); `add_ssh_key` (UQ check first for nice 409); `delete_ssh_key` (404 on cross-user); `list_ssh_keys`; `get_ssh_key`
- `routes.py` — `/`, `/{key_id}`, `POST /`, `DELETE /{key_id}`; csrf_protect on writes
- `schemas.py` — `SshKeyCreate`, `SshKeyResponse` (no `public_key` in list), `SshKeyDetailResponse` (with `public_key`)

### PATs (`backend/app/pats/`)

- `__init__.py` — package marker
- `service.py` — `mint_pat` (random body, prefix index, hash with pepper), `resolve_pat` (constant-time within prefix candidates), `revoke_pat` (404 on cross-user); `MintedPAT` dataclass; `_hash_pat` (`sha256(pepper||token)`)
- `routes.py` — `/`, `POST /`, `DELETE /{token_id}`; `_reject_pat_auth` enforces T-01-05-10
- `schemas.py` — `PATCreate`, `PATMintResponse` (with plaintext — show-once), `PATListItem` (with `prefix_preview` — never plaintext)

### Tests (`backend/tests/`)

- `factories.py` — `make_user(session_factory, ...)` + `login_as(client, ...)` reusable helpers
- `test_auth.py` — 8 tests: success cookies, wrong-pw, unknown-user-uses-DUMMY_HASH, disabled→403, /me unauth→401, /me with session, logout clears, rate limit→429
- `test_refresh_rotation.py` — 4 tests: rotate marks replaced, replay revokes chain, expired→401, missing cookie→401
- `test_csrf.py` — 5 tests: no header→403, with header→passes, GET→bypass, PAT→bypass, non-pat Bearer→401
- `test_ssh_keys.py` — 8 tests: valid ed25519→201, malformed→422, duplicate→409, owner-isolation, delete→204, cross-user→404, GET-by-id includes key, RSA+ed25519+ecdsa parse + fingerprint, malformed raises
- `test_pats.py` — 8 tests: mint→201+plaintext, list→prefix_preview only, Bearer-on-me→200, past expires_at→422, delete→204 and Bearer fails, PAT-on-tokens→403, prefix-collision resolve, cross-user revoke→404

### Modified

- `backend/app/main.py` — wires `auth_router`, `me_router`, `ssh_keys_router`, `pats_router` into `create_app()` with OpenAPI tags `auth` / `me` / `ssh-keys` / `tokens`
- `backend/tests/conftest.py` — autouse `_reset_rate_limit_buckets` fixture (clears `app.auth.rate_limit._buckets` before + after every test)

## Cookie Shape (D-09 + D-13)

| Cookie | httponly | secure | samesite | max_age | path |
|--------|----------|--------|----------|---------|------|
| `access_token` | **True** | from `settings.cookie_secure` | from `settings.cookie_samesite` (lax) | `access_token_ttl_seconds` (15min) | `/` |
| `refresh_token` | **True** | same | same | `refresh_token_ttl_seconds` (7d) | `/api/v1/auth` |
| `csrf_token` | **False** (JS-readable) | same | same | `refresh_token_ttl_seconds` | `/` |

All three are rotated on every successful `/login` and `/refresh` (CSRF Q4 resolution). Logout clears all three via `Max-Age=0` with matching `path` attrs.

## PAT Storage Shape (Pattern 6)

- Plaintext format: `pat_<24 url-safe base64 chars>` (24 = `secrets.token_urlsafe(18)`)
- Indexed `lookup_prefix` = first 12 chars of the body (after `pat_`)
- Stored `token_hash` = `sha256(settings.pat_pepper || plaintext).hexdigest()` — 64 hex chars
- Plaintext NEVER stored. POST response is the ONLY surface returning it.
- List response shows `prefix_preview = "pat_<first-8-of-lookup_prefix>..."` — non-secret disambiguator

## Rate-Limit Parameters

- Per-IP login: **10 attempts / 60 s sliding window**. 11th attempt → 429.
- Keyed by route+IP: `f"login:{ip}"`.
- IP source: first hop of `X-Forwarded-For` if present (Caddy in production), else `request.client.host`.
- Module-level state, lost on process restart (T-01-05-14, disposition accept).

## Decisions Made

- **`consume_refresh` commits chain-revoke before raising `ReplayDetected`.** Discovered while running the replay-detection test: `get_db` rolls back on any exception, which silently undid the chain revocation. The fix is small (one `await db.commit()` after `_revoke_chain`) but critical for the threat-model invariant T-01-05-02. Documented in `refresh.py` inline.
- **Refresh route has NO `csrf_protect` dependency.** Documented inline as an intentional exception: the `refresh_token` cookie is itself httpOnly, so a cross-site forged request can submit it but cannot read it back to fake an `X-CSRF-Token` header. SameSite=Lax + httpOnly is sufficient. The route still rotates the CSRF cookie on success (Q4 resolution).
- **Pitfall A8 is enforced via strict regex on Bearer.** `^pat_[A-Za-z0-9_-]{8,}$` — anything else (a JWT, a malformed PAT, garbage) → 401 "Unsupported auth scheme" instead of falling through to cookie auth. Eliminates JWT-via-Bearer ambiguity entirely.
- **Task 1 GREEN landed Task 2's PAT + SSH-key implementation.** Task 1's `test_csrf::test_pat_request_bypasses_csrf` exercises PAT-Bearer auth doing a POST `/api/v1/me/ssh-keys/` — both subsystems must be wired for that single test to be runnable. Task 2 RED therefore only added the dedicated PAT + SSH route tests; Task 2 GREEN was the test-isolation fix (autouse rate-limit reset).
- **Cross-user DELETE / revoke returns 404, not 403.** Same response shape as a not-found row so an attacker can't enumerate IDs across users (T-01-05-11). Tested.
- **PAT cannot manage PATs.** `/api/v1/me/tokens/*` checks `principal.via_pat` and returns 403 (T-01-05-10). Tested.
- **PasswordChangeRequest min length = 12.** Matches ASVS V2.1 baseline. Higher values can be set in Phase 5 polish via Settings if desired.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chain-revoke not committed before exception**

- **Found during:** Task 1 GREEN, running `test_refresh_replay_detection_revokes_entire_chain`.
- **Issue:** `consume_refresh` flushed (via `_revoke_chain` → `db.flush()`) but did not commit before raising `ReplayDetected`. The auth route's `get_db` dependency rolls back on any propagating exception, which silently undid the cascade revocation — a subsequent replay would have succeeded. This directly defeats T-01-05-02.
- **Fix:** Added `await db.commit()` after `_revoke_chain` in `app/auth/refresh.py::consume_refresh`. Documented inline why this is required.
- **Files modified:** `backend/app/auth/refresh.py`
- **Verification:** `test_refresh_replay_detection_revokes_entire_chain` now asserts all rows revoked AND a follow-up replay with the *new* token also fails (chain dead).
- **Committed in:** `56bcf44` (Task 1 GREEN)

**2. [Rule 1 - Bug] Module-level rate-limit state polluted test isolation**

- **Found during:** Task 2 tests (login_as 11+ times across the file → 429 in subsequent tests).
- **Issue:** `app.auth.rate_limit._buckets` is a module-level dict — by design, for v1 single-process operation (T-01-05-14 accept). But across tests in a single pytest invocation, every login adds to the same dict, so the 11th login in any test (after enough setup) trips the 429 gate and breaks unrelated assertions.
- **Fix:** Added an autouse pytest fixture `_reset_rate_limit_buckets` in `tests/conftest.py` that clears `_buckets` before AND after every test. Production behaviour is unchanged; only the test harness gets the reset.
- **Files modified:** `backend/tests/conftest.py`
- **Verification:** Full suite went from "6 failures in test_pats.py due to 429" to 90 passing.
- **Committed in:** `48462b6` (Task 2 GREEN)

**3. [Rule 1 - Bug] Hand-written RSA pubkey in service-parse test was invalid**

- **Found during:** Task 2 tests (`test_parse_rsa_ed25519_ecdsa_all_yield_fingerprints`).
- **Issue:** The hand-typed RSA key fixture in `test_ssh_keys.py` was not a valid OpenSSH-wire-format encoding — `cryptography.serialization.load_ssh_public_key` refused it with "Invalid format". Hand-typed base64 is almost always wrong for a real curve point.
- **Fix:** Generated three real key fixtures once via `cryptography.hazmat.primitives.asymmetric.{rsa,ec,ed25519}` + `public_bytes(OpenSSH, OpenSSH)`. Pasted the public-key text into the test. Private keys discarded — only the public shape matters.
- **Files modified:** `backend/tests/test_ssh_keys.py`
- **Verification:** All three keys (RSA, ECDSA, ed25519) parse and yield distinct `SHA256:` fingerprints.
- **Committed in:** `3827480` (Task 2 RED — landed alongside the test itself).

**4. [Rule 3 - Blocking] ruff `I001` import-order on test files**

- **Found during:** Final ruff verification.
- **Issue:** Two test files had unsorted imports; `ruff check . --fix` auto-fixed them. No semantic effect.
- **Files modified:** `backend/tests/test_pats.py`, `backend/tests/test_ssh_keys.py`, `backend/app/auth/{schemas,service}.py`, `backend/app/me/routes.py`
- **Verification:** `ruff check .` → "All checks passed!"
- **Committed in:** `56bcf44` (Task 1) and `48462b6` (Task 2)

**5. [Rule 3 - Blocking] B007 unused loop variable in rate-limit test**

- **Found during:** Final ruff verification.
- **Issue:** `for i in range(11):` — `i` unused inside the loop body.
- **Fix:** Renamed `i` → `_`.
- **Files modified:** `backend/tests/test_auth.py`
- **Committed in:** `56bcf44`

---

**Total deviations:** 5 auto-fixed (3 Rule 1 bugs, 2 Rule 3 blocking).
**Impact on plan:** Zero scope change. Deviation #1 is a critical correctness fix for T-01-05-02 (chain-replay revocation must persist). Deviation #2 is test-harness hygiene (production unaffected). Deviation #3 is test-data correctness. #4 + #5 are ruff conformance auto-fixes.

## Threat-Model Conformance

| Threat ID | Disposition | Implemented in this plan |
|-----------|-------------|--------------------------|
| T-01-05-01 | mitigate | `service.login` always calls `verify_password(password, DUMMY_HASH)` on user-miss. Test `test_login_unknown_user_returns_401_and_uses_dummy_hash` verifies via monkeypatched spy on `verify_password`. |
| T-01-05-02 | mitigate | `consume_refresh` walks the `replaced_by_id` chain on replay, revokes every row, commits, then raises `ReplayDetected`. Test `test_refresh_replay_detection_revokes_entire_chain` proves the entire chain is dead after replay. |
| T-01-05-03 | mitigate | `refresh_token` cookie path scoped to `/api/v1/auth`. Body never contains the value. uvicorn launched via Plan 04's systemd unit with no access-log path. |
| T-01-05-04 | mitigate | `csrf_protect` dependency reads cookie + header, constant-time compares. Tested for bypass on PAT (200) and reject without header (403). |
| T-01-05-05 | mitigate | `decode_access_token` pins `algorithms=[ALG]` (Plan 01); Pitfall A8 regex `^pat_[A-Za-z0-9_-]{8,}$` rejects all non-PAT Bearer values 401. Test `test_bearer_non_pat_rejected_with_401` verifies. |
| T-01-05-06 | mitigate | PAT plaintext is returned only on POST (show-once). DB stores only `lookup_prefix` + `sha256(pepper||token)`. List/detail responses use `prefix_preview` field. `test_list_returns_metadata_only_no_plaintext` asserts. |
| T-01-05-07 | mitigate | `resolve_pat` narrows candidates by indexed `lookup_prefix`; final compare uses `secrets.compare_digest`. `test_resolve_pat_constant_time_with_shared_prefix` inserts two rows with the same prefix and proves both resolve to the right user. |
| T-01-05-08 | mitigate | `check_login_rate(ip, limit=10, window=60.0)`; 11th attempt → 429. `test_login_rate_limit_returns_429_after_threshold` verifies. |
| T-01-05-09 | mitigate | `parse_ssh_pubkey` uses `cryptography.hazmat.primitives.serialization.load_ssh_public_key` — pure parse, never shell-executed. Stored as plain text. Test `test_post_malformed_key_returns_422` verifies garbage rejected. |
| T-01-05-10 | mitigate | `app/pats/routes.py::_reject_pat_auth` raises 403 if `principal.via_pat`. `test_pat_cannot_manage_tokens` verifies. |
| T-01-05-11 | mitigate | Cross-user DELETE returns 404, NOT 403. `test_user_a_cannot_delete_user_b_key_returns_404` and `test_revoke_other_user_pat_returns_404` verify. |
| T-01-05-12 | accept | `service.logout` is idempotent — silently succeeds on missing/expired/unknown refresh secret. Audit-log writer (Phase 2) will record the attempt. |
| T-01-05-13 | accept | `replaced_by_id` chain is on `refresh_tokens` rows — admins already have full DB access. Documented; no additional control. |
| T-01-05-14 | accept | In-memory rate-limit state is process-local. Documented in `rate_limit.py` module docstring. Phase 5 can harden to redis if abuse observed. |

## Issues Encountered

- **Rate-limit cross-test pollution** (covered in Deviation #2). Module-level state by design for production single-process operation; test harness needs explicit reset. The fix is one autouse fixture in conftest.py — simpler than rearchitecting the limiter as instance-per-app.
- **Chain-revoke transaction lifecycle** (covered in Deviation #1). The interaction between `get_db`'s on-exception rollback and the service-layer's mid-flight revocation was subtle — required walking through the test failure step-by-step to find. Now the invariant "any revocation that MUST persist past an HTTPException commits before raising" is documented as a pattern.
- **Hand-written SSH key fixtures** (covered in Deviation #3). Lesson: never hand-type base64 for tests — generate once via the library you're testing against.
- **Conftest read-before-edit hook warning during execution.** Worked around by re-reading the file via the Read tool before each edit; no functional impact.

## Verification Results

| Check | Result |
| --- | --- |
| `cd backend && python -m pytest -x -q` | **90 passed**, 5 warnings (Plan 01 ephemeral-secret + InsecureKeyLength, intentional) |
| `python -m pytest tests/test_auth.py tests/test_refresh_rotation.py tests/test_csrf.py -x` | **17 passed** |
| `python -m pytest tests/test_ssh_keys.py tests/test_pats.py -x` | **17 passed** |
| `python -m pytest -k "test_resolve_pat or test_constant_time" -x` | **1 passed** |
| `ruff check .` | **All checks passed!** |
| `grep -q 'ReplayDetected\|replay' app/auth/refresh.py` | OK |
| `grep -q 'algorithms=\[ALG\]' app/core/jwt.py` | OK (preserved from Plan 01) |
| `grep -q 'DUMMY_HASH' app/auth/service.py` | OK |
| `grep -q 'httponly=False' app/auth/routes.py` | OK (CSRF cookie, D-13) |
| `grep -q 'httponly=True' app/auth/routes.py` | OK (access + refresh, D-09) |
| `grep -q 'samesite' app/auth/routes.py` | OK |
| `grep -q 'X-Forwarded-For' app/auth/routes.py` | OK |
| `grep -q 'secrets.compare_digest' app/pats/service.py` | OK |
| `grep -q 'load_ssh_public_key' app/ssh_keys/service.py` | OK |
| `grep -q 'SHA256' app/ssh_keys/service.py` | OK |
| `grep -q 'lookup_prefix' app/pats/service.py` | OK |
| `grep -q 'plaintext' app/pats/routes.py` | OK (show-once mint) |
| `grep -q 'prefix_preview' app/pats/routes.py` | OK (list metadata) |
| `from app.main import app; required routes present` | OK (`/api/v1/auth/{login,refresh,logout}`, `/api/v1/me/`, `/api/v1/me/password`, `/api/v1/me/ssh-keys/{,key_id}`, `/api/v1/me/tokens/{,token_id}`) |

## User Setup Required

None — Plan 05 is pure backend code. Plan 04's installer already ships `/etc/proxmox-gui/{master.key,jwt.secret,pat.pepper}` at mode 0400; this plan reads them via `settings`.

For local development, no additional `.env` changes needed beyond Plan 01's defaults. Ephemeral fallback secrets (warned via `UserWarning`) are sufficient for the test suite.

## Next Phase Readiness

- **Plan 01-06 (clusters-tenant-bootstrap)** can `from app.auth.dependencies import require_admin` and compose `dependencies=[Depends(require_admin), Depends(csrf_protect)]` on every cluster mutating route. The Principal is already loaded once per request; admin routes get the same object.
- **Plan 01-07 (users-admin-setup)** can `from app.auth.service import revoke_user_sessions` and call it from `disable_user` — the contract is fixed: revokes refresh tokens + PATs in one transaction. AUTH-07 is fully wireable.
- **Plan 01-08 (frontend-auth-shell)** can wire `apiJson` against the documented cookie shape; CSRF helper in `$lib/utils/csrf.ts` reads `document.cookie` for the `csrf_token` value (D-13). Token rotation is automatic — the browser will re-set cookies on every `/refresh`.
- **Plan 01-09 (frontend-account)** has stable endpoints for `/me/password`, `/me/ssh-keys`, `/me/tokens` — OpenAPI 3.1 spec exposes the schemas for code-gen if the frontend chooses that route.
- **Plan 01-10 (frontend-admin)** gets the `require_admin` story end-to-end: 403 from any admin endpoint when a non-admin tries.
- **Plan 02-*** audit-log writer can compose with `login`/`refresh`/`logout` via a structlog event in the service layer; no API change needed.

No blockers carried forward.

## Hooks Exposed for Later Plans

- `app.auth.service.revoke_user_sessions(db, *, user_id)` — Plan 07 disable-user hook
- `app.auth.dependencies.require_admin` — Plan 06 cluster routes; Plan 07 admin routes; Plan 10 admin UI
- `app.auth.dependencies.csrf_protect` — every mutating cookie-session route from Plan 06 onward
- `app.auth.dependencies.Principal` (+ `via_pat` property) — service-layer decision point for "does this caller have a cookie or a PAT?"
- `app.pats.service.resolve_pat` — already wired into `get_current_principal`; future direct callers (CLI testing tools, integration tests) can use it
- `app.ssh_keys.service.parse_ssh_pubkey` — Plan 04 Cloud-Init wiring (Phase 4) will consume the normalised text for cloud-init `users:` blocks

## Self-Check: PASSED

Verified at write time:

- All 25 files claimed above exist on disk (23 created + 2 modified)
- All four commit hashes (`e4894fa`, `56bcf44`, `3827480`, `48462b6`) are reachable from `master`
- `pytest -x -q` reports 90 passed
- `ruff check .` reports "All checks passed!"
- Live route inspection via `python -c "from app.main import app; ..."` confirms all 9 endpoints wired

---

*Phase: 01-foundation*
*Plan: 05-auth-subsystem*
*Completed: 2026-05-14*
