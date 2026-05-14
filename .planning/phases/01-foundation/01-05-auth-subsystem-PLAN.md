---
phase: 01-foundation
plan: 05
type: execute
wave: 2
depends_on:
  - 01
  - 02
files_modified:
  - backend/app/auth/__init__.py
  - backend/app/auth/dependencies.py
  - backend/app/auth/service.py
  - backend/app/auth/refresh.py
  - backend/app/auth/rate_limit.py
  - backend/app/auth/routes.py
  - backend/app/auth/schemas.py
  - backend/app/ssh_keys/__init__.py
  - backend/app/ssh_keys/service.py
  - backend/app/ssh_keys/routes.py
  - backend/app/ssh_keys/schemas.py
  - backend/app/pats/__init__.py
  - backend/app/pats/service.py
  - backend/app/pats/routes.py
  - backend/app/pats/schemas.py
  - backend/app/me/__init__.py
  - backend/app/me/routes.py
  - backend/app/me/schemas.py
  - backend/app/main.py
  - backend/tests/test_auth.py
  - backend/tests/test_refresh_rotation.py
  - backend/tests/test_pats.py
  - backend/tests/test_ssh_keys.py
  - backend/tests/test_csrf.py
  - backend/tests/factories.py
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - API-01
  - API-02
  - API-03
user_setup: []
tags:
  - backend
  - auth
  - sessions
  - jwt
  - csrf
  - pats
must_haves:
  truths:
    - "POST /api/v1/auth/login with valid credentials returns 200 + sets httpOnly access_token, refresh_token cookies + JS-readable csrf_token cookie"
    - "POST /api/v1/auth/login with invalid credentials returns 401 with constant-time argon2 verify (no user enumeration)"
    - "POST /api/v1/auth/refresh rotates refresh token; the OLD refresh token is marked revoked + replaced_by_id set"
    - "Replaying a revoked refresh token revokes the entire chain (replay detection) and returns 401"
    - "POST /api/v1/auth/logout clears all three cookies and revokes the refresh row"
    - "POST /api/v1/me/password verifies current password + revokes all other refresh tokens for the user"
    - "GET /api/v1/me returns the current Principal (works via cookie OR Bearer pat_*)"
    - "Bearer pat_* requests skip CSRF (D-13)"
    - "Cookie-session state-changing requests without matching X-CSRF-Token return 403"
    - "POST /api/v1/me/ssh-keys with a valid SSH public key returns 201 with derived SHA256 fingerprint"
    - "POST /api/v1/me/tokens returns the plaintext PAT exactly ONCE; subsequent GETs return only metadata"
    - "Disabling a user (Plan 07) invalidates their refresh tokens immediately (covered by service.disable_user revocation hook)"
  artifacts:
    - path: "backend/app/auth/dependencies.py"
      provides: "get_current_principal, require_admin, csrf_protect dependencies"
      exports: ["Principal", "get_current_principal", "require_admin", "csrf_protect"]
    - path: "backend/app/auth/service.py"
      provides: "login, refresh, logout, change_password"
      exports: ["login", "refresh", "logout", "change_password", "revoke_user_sessions"]
    - path: "backend/app/auth/routes.py"
      provides: "/api/v1/auth/login, /refresh, /logout"
      contains: "@router.post"
    - path: "backend/app/me/routes.py"
      provides: "/api/v1/me, /api/v1/me/password"
      contains: "/me"
    - path: "backend/app/ssh_keys/routes.py"
      provides: "/api/v1/me/ssh-keys CRUD"
      contains: "/me/ssh-keys"
    - path: "backend/app/pats/routes.py"
      provides: "/api/v1/me/tokens CRUD"
      contains: "/me/tokens"
  key_links:
    - from: "backend/app/auth/routes.py"
      to: "backend/app/auth/service.py"
      via: "login/refresh/logout/change_password handlers call service functions"
      pattern: "service\\."
    - from: "backend/app/auth/dependencies.py"
      to: "backend/app/core/jwt.py"
      via: "get_current_principal decodes access_token cookie via decode_access_token"
      pattern: "decode_access_token"
    - from: "backend/app/auth/refresh.py"
      to: "backend/app/models/refresh_token.py"
      via: "rotation flow reads/writes RefreshToken rows; replaced_by_id chain for replay detection"
      pattern: "RefreshToken"
    - from: "backend/app/main.py"
      to: "backend/app/auth/routes.py + me/routes.py + ssh_keys/routes.py + pats/routes.py"
      via: "create_app() includes these routers"
      pattern: "include_router"
---

<objective>
Land the entire local-auth surface: login (Argon2id constant-time), refresh-rotation with chain-replay detection, logout, password change, CSRF double-submit middleware, the dual-mode `get_current_principal` dependency (cookie OR Bearer pat_*), `/api/v1/me`, SSH key CRUD, PAT CRUD (with "show once" semantics), and a per-IP in-memory login rate limiter. Every CONTEXT decision in §GUI Auth Surface (D-09 to D-13) is implemented exactly.

Purpose: Plans 06 and 07 build on this — cluster routes use `require_admin`, team-create uses CSRF + Principal, user admin uses `revoke_user_sessions` on disable. The session/JWT/CSRF model is the contract for every subsequent route in the project.

Output: Comprehensive auth test suite green (login flow, refresh rotation, replay detection, password change, CSRF allow/reject, PAT mint+resolve+revoke, SSH key parse+fingerprint). 7 new routers wired into the FastAPI app.
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
@CLAUDE.md
@.planning/phases/01-foundation/01-01-SUMMARY.md
@.planning/phases/01-foundation/01-02-SUMMARY.md

<interfaces>
<!-- Contracts every later plan composes against. -->

```python
# backend/app/auth/dependencies.py
class Principal:
    user: User
    mode: Literal["session", "pat"]
    via_pat: bool   # property

async def get_current_principal(request, db) -> Principal: ...
async def require_admin(principal=Depends(get_current_principal)) -> Principal: ...
async def csrf_protect(request, principal=Depends(get_current_principal)) -> None: ...
```

```python
# backend/app/auth/service.py
class LoginResult:
    user: User
    access_token: str
    refresh_token: str   # plaintext, send via cookie, never store
    csrf_token: str       # plaintext, send via JS-readable cookie

async def login(db, *, username: str, password: str, user_agent: str, ip: str) -> LoginResult: ...
async def refresh(db, *, refresh_secret: str, user_agent: str, ip: str) -> LoginResult: ...
async def logout(db, *, refresh_secret: str | None) -> None: ...
async def change_password(db, *, user: User, current: str, new: str, keep_session_id: int | None) -> None: ...
async def revoke_user_sessions(db, *, user_id: int) -> None: ...   # called by Plan 07's disable_user
```

```python
# backend/app/pats/service.py
class MintedPAT:
    plaintext: str   # "pat_..." — returned to client ONCE
    row: PersonalAccessToken
async def mint_pat(db, *, user: User, name: str, expires_at: datetime | None) -> MintedPAT: ...
async def resolve_pat(db, *, token: str) -> User | None: ...   # constant-time
async def revoke_pat(db, *, pat_id: int, user_id: int) -> None: ...
```

```python
# backend/app/ssh_keys/service.py
def parse_ssh_pubkey(text: str) -> tuple[str, str]: ...  # (normalized_openssh, "SHA256:base64")
async def add_ssh_key(db, *, user: User, name: str, public_key: str) -> SshKey: ...
```
</interfaces>

<existing_artifacts>
From Plan 01:
- `app.core.jwt.issue_access_token(user_id, *, is_admin) -> str`
- `app.core.jwt.decode_access_token(token) -> dict`
- `app.core.passwords.hash_password / verify_password / DUMMY_HASH`
- `app.core.csrf.mint_csrf_token / verify_csrf`
- `app.core.db.get_db`
- `app.config.settings` (TTLs, cookie_secure, pat_pepper, csrf_cookie_name)

From Plan 02:
- `app.models.User`, `Team`, `TeamMembership`, `RefreshToken`, `PersonalAccessToken`, `SshKey`
</existing_artifacts>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Auth core — dependencies, refresh rotation with replay detection, login/refresh/logout service, rate limiter, routes, schemas</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (§Pattern 4, §Pattern 5, §Pattern 9, §Login flow, §Pitfall A8, §Pitfall A10)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-CONTEXT.md (D-09 through D-13)
    - /home/dev/vm-deployment-gui/backend/app/core/jwt.py
    - /home/dev/vm-deployment-gui/backend/app/core/passwords.py
    - /home/dev/vm-deployment-gui/backend/app/core/csrf.py
    - /home/dev/vm-deployment-gui/backend/app/models/refresh_token.py
  </read_first>
  <files>
    backend/app/auth/__init__.py,
    backend/app/auth/dependencies.py,
    backend/app/auth/refresh.py,
    backend/app/auth/service.py,
    backend/app/auth/rate_limit.py,
    backend/app/auth/routes.py,
    backend/app/auth/schemas.py,
    backend/app/main.py,
    backend/tests/factories.py,
    backend/tests/test_auth.py,
    backend/tests/test_refresh_rotation.py,
    backend/tests/test_csrf.py
  </files>
  <behavior>
    - test_auth: login with correct password returns 200, sets 3 cookies (access_token httpOnly, refresh_token httpOnly, csrf_token NOT httpOnly).
    - test_auth: login with wrong password returns 401 AND argon2 verify was still invoked (constant-time — measured by ensuring response time variance is bounded; or simpler: assert `verify_password` was called via spy/mock when user doesn't exist by precomputed DUMMY_HASH).
    - test_auth: login when user.is_active=False returns 403.
    - test_auth: GET /api/v1/me without auth returns 401; with valid access_token cookie returns 200 with user JSON.
    - test_refresh_rotation: refresh with valid token returns new access + new refresh; OLD refresh row has revoked_at set, replaced_by_id pointing to new row.
    - test_refresh_rotation: replaying an already-rotated refresh revokes entire chain and returns 401 ("session compromised — please log in again"); subsequent refreshes from any node of the chain return 401.
    - test_refresh_rotation: expired refresh returns 401.
    - test_auth: logout clears cookies (Max-Age=0 / Set-Cookie deletion) and marks refresh revoked.
    - test_csrf: state-changing request via cookie without `X-CSRF-Token` header returns 403.
    - test_csrf: state-changing request via cookie WITH matching `X-CSRF-Token` header passes.
    - test_csrf: Bearer pat_* request without CSRF passes (D-13).
    - test_csrf: GET request without CSRF passes (safe methods).
    - test_auth (rate limiting): 11th login attempt from the same IP within 60 seconds returns 429.
  </behavior>
  <action>
    **app/auth/refresh.py** — implement refresh token persistence + rotation per 01-RESEARCH.md §Pattern 5 + the replay detection invariant. Functions:
    - `def hash_refresh(secret: str) -> str` → `hashlib.sha256(secret.encode()).hexdigest()`. Note: refresh tokens are HASHED (not Fernet-encrypted) because we need to look them up by hash, and the server doesn't need to display them again. The hash alone gives revocation without symmetric reversal.
    - `async def issue_refresh(db, *, user_id, user_agent, ip, expires_at, replaced_from: int | None = None) -> tuple[str, RefreshToken]`:
      - Generate `secret = secrets.token_urlsafe(48)` (≈64 chars).
      - Compute `token_hash = hash_refresh(secret)`.
      - Insert RefreshToken row.
      - If `replaced_from` is not None, set `replaced_from.replaced_by_id = new_row.id` and `replaced_from.revoked_at = now`. Caller flushes.
      - Return `(secret, row)`.
    - `async def consume_refresh(db, *, secret) -> RefreshToken`:
      - Compute hash, `SELECT ... WHERE token_hash = :h`.
      - If row missing → raise `InvalidRefresh("not found")`.
      - If `expires_at < now` → raise `InvalidRefresh("expired")` (and revoke for cleanliness).
      - If `revoked_at IS NOT NULL`:
        - **Replay detection:** If `replaced_by_id` is non-null, this is a replay of an already-rotated token → revoke the entire CHAIN. Walk `replaced_by_id` forward, set every row's `revoked_at` = now (idempotent). Raise `ReplayDetected("session compromised")`.
        - Otherwise (revoked-but-not-replaced, e.g., via logout) → raise `InvalidRefresh("revoked")`.
      - Return the row (caller will pass to `issue_refresh(..., replaced_from=row)`).
    - `async def revoke_all_for_user(db, *, user_id, except_id=None) -> int`: UPDATE refresh_tokens SET revoked_at=now WHERE user_id=? AND revoked_at IS NULL AND id != COALESCE(:except_id, -1). Returns row count.

    **app/auth/rate_limit.py** — Simple in-memory bucketed rate limiter per CONTEXT.md "Claude's discretion → login rate-limiting / lockout policy (in-memory bucketed limiter for v1)". Module-level `_buckets: dict[str, list[float]] = {}`. `def check_login_rate(ip: str, *, limit: int = 10, window: float = 60.0) -> bool`: returns True if allowed, False if over the limit. Cleans entries older than `window`. Resets when process restarts (acceptable for v1; doc-comment notes this is intentional).

    **app/auth/dependencies.py** — Implement per 01-RESEARCH.md §Pattern 4 with the EXACT semantics from D-12 (Bearer pat_*) and D-13 (CSRF for cookies only). Add Pitfall A8: reject ANY Bearer token that does not match `^pat_[A-Za-z0-9_-]+$` with 401 "unsupported auth scheme" (NO accidental JWT-via-Bearer). Use `from app.pats.service import resolve_pat` (created in Task 2; allow forward reference via lazy import inside the function).

    **app/auth/schemas.py** — pydantic models:
    - `LoginRequest(username: str, password: str)`.
    - `LoginResponse(user_id: int, username: str, email: str, is_admin: bool, must_change_password: bool = False)` (the `must_change_password` flag is reserved for Phase 5 / future use; defaults False).
    - `MeResponse(id: int, username: str, email: str, is_admin: bool, teams: list[TeamSummary])` where `TeamSummary` is `(id: int, name: str, personal: bool)`.
    - `RefreshResponse(refreshed_at: datetime)` — minimal body since the heavy lifting is the cookie reset.
    - `LogoutResponse(message: str = "Logged out")`.
    - `PasswordChangeRequest(current_password: str, new_password: str = Field(min_length=12))`.

    **app/auth/service.py** — Implement `login`, `refresh`, `logout`, `change_password`, `revoke_user_sessions`. Constant-time login flow per 01-RESEARCH.md §Login flow:
    - Always call `verify_password(payload.password, DUMMY_HASH)` when user doesn't exist (defeats user enumeration).
    - On success, `issue_access_token(user.id, is_admin=user.is_admin)`, `issue_refresh(...)`, `mint_csrf_token()`.
    - Return `LoginResult`.
    - `change_password` calls `verify_password(current, user.password_hash)`, raises `HTTPException(403, "current password incorrect")` on fail; sets `user.password_hash = hash_password(new)`; calls `revoke_all_for_user(db, user_id=user.id, except_id=keep_session_id)`.
    - `revoke_user_sessions(db, *, user_id)` is the Plan-07 hook — wraps `revoke_all_for_user` with `except_id=None` AND revokes all the user's PATs (`UPDATE personal_access_tokens SET revoked_at = now WHERE user_id = ?`). Document the hook as Plan 07's disable-user revocation call site.

    **app/auth/routes.py** — Build the router under prefix `/api/v1/auth`:
    - `POST /login` (no auth) — accepts `LoginRequest`. Calls rate limiter using `request.client.host` (or `X-Forwarded-For` first value if behind Caddy — extract via a small helper that prefers X-Forwarded-For). On limit-exceeded → 429. On success → service.login → set 3 cookies per D-09 + D-13:
      - `access_token`: httponly=True, secure=settings.cookie_secure, samesite=settings.cookie_samesite, max_age=settings.access_token_ttl_seconds, path="/".
      - `refresh_token`: same flags, max_age=settings.refresh_token_ttl_seconds, path="/api/v1/auth" (scoped so other routes don't see it).
      - `csrf_token`: httponly=False (JS-readable!), secure=settings.cookie_secure, samesite=settings.cookie_samesite, max_age=settings.refresh_token_ttl_seconds, path="/".
      Return `LoginResponse`.
    - `POST /refresh` (cookie-only — refresh cookie). Read `refresh_token` cookie; if missing → 401. Call `service.refresh`. On `ReplayDetected` → 401 with body `{"detail": "Session compromised — log in again."}` AND clear cookies. On success → set NEW cookies (same shape as login) and return `RefreshResponse`. Note this route DOES NOT require CSRF because the refresh cookie itself is httpOnly and presence is sufficient; document the exception.
    - `POST /logout` (auth required via cookie OR PAT, but really cookie-driven). Read `refresh_token` cookie if present; revoke. Clear all 3 cookies. Always returns 200.

    **app/me/__init__.py + app/me/routes.py + app/me/schemas.py** — under prefix `/api/v1/me`:
    - `GET /` returns `MeResponse` (current Principal). Use `Depends(get_current_principal)`. Selectinload teams.
    - `POST /password` — `Depends(get_current_principal)`, `Depends(csrf_protect)`. Calls `service.change_password` with `keep_session_id=<current refresh id>`. Body: `PasswordChangeRequest`. On success returns `{"message": "Password updated. Other sessions revoked."}`.

    **app/main.py** — Update lifespan to: load JWT secret + PAT pepper from files if `settings.jwt_secret_file`/`settings.pat_pepper_file` are set and the secrets are not yet populated. Wire routers: `app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])`, `app.include_router(me_router, prefix="/api/v1/me", tags=["me"])`. Add `app.include_router(ssh_keys_router, prefix="/api/v1/me/ssh-keys", tags=["ssh-keys"])` and `app.include_router(pats_router, prefix="/api/v1/me/tokens", tags=["tokens"])` (these are wired in Task 2 — preserve the wiring location).

    **backend/tests/factories.py** — small helpers: `async def make_user(db, *, username="u1", password="testpass12345", is_admin=False, is_active=True) -> User`, `async def login_as(client, *, username, password) -> dict` returning the response cookies. Reusable across test files.

    **Tests** — implement the behaviors listed above. Use `httpx.AsyncClient` against the FastAPI app via `ASGITransport`. For each test, build a fresh in-memory SQLite (via the conftest fixture from Plan 01) and run migrations once with `Base.metadata.create_all` (test mode — fast path; the real app uses Alembic).

    Critical test for replay detection: log in → refresh once (token1 → token2) → attempt to refresh with token1 again → assert 401 AND token2's row also has revoked_at set (cascade revoke).
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_auth.py tests/test_refresh_rotation.py tests/test_csrf.py -x -v 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend && python -m pytest tests/test_auth.py tests/test_refresh_rotation.py tests/test_csrf.py -x` exits 0
    - `grep -q 'ReplayDetected\|replay' backend/app/auth/refresh.py` (chain-revoke logic present)
    - `grep -q 'algorithms=\[ALG\]' backend/app/core/jwt.py` (re-verify Pitfall A8 mitigation still in place)
    - `grep -q 'DUMMY_HASH' backend/app/auth/service.py` (constant-time login)
    - `grep -q 'httponly=False' backend/app/auth/routes.py` (CSRF cookie JS-readable per D-13)
    - `grep -q 'httponly=True' backend/app/auth/routes.py` (access + refresh cookies httpOnly per D-09)
    - `grep -q 'samesite' backend/app/auth/routes.py`
    - `grep -q 'X-Forwarded-For' backend/app/auth/routes.py` (rate-limit uses real client IP when reverse-proxied)
    - `cd backend && python -c "from app.main import app; paths = [r.path for r in app.routes]; assert '/api/v1/auth/login' in paths and '/api/v1/auth/refresh' in paths and '/api/v1/auth/logout' in paths and '/api/v1/me/' in paths; print('OK')"` exits 0
  </acceptance_criteria>
  <done>Login/refresh/logout/password change/CSRF tests all green; replay detection verified; rate limiter active; routes mounted.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: SSH key + PAT subsystems with show-once secrets</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (§Pattern 6, §SSH key parse)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-CONTEXT.md (D-12, Discretion: SSH key storage shape)
    - /home/dev/vm-deployment-gui/backend/app/models/ssh_key.py
    - /home/dev/vm-deployment-gui/backend/app/models/pat.py
    - /home/dev/vm-deployment-gui/backend/app/auth/dependencies.py (created in Task 1)
  </read_first>
  <files>
    backend/app/ssh_keys/__init__.py,
    backend/app/ssh_keys/service.py,
    backend/app/ssh_keys/routes.py,
    backend/app/ssh_keys/schemas.py,
    backend/app/pats/__init__.py,
    backend/app/pats/service.py,
    backend/app/pats/routes.py,
    backend/app/pats/schemas.py,
    backend/tests/test_ssh_keys.py,
    backend/tests/test_pats.py
  </files>
  <behavior>
    - test_ssh_keys: POST /api/v1/me/ssh-keys with valid ed25519 returns 201 and stores `SHA256:...` fingerprint.
    - test_ssh_keys: POST with malformed key (e.g., missing base64) returns 422 "Invalid SSH public key".
    - test_ssh_keys: POST with duplicate (user_id, name) returns 409.
    - test_ssh_keys: GET /api/v1/me/ssh-keys returns only the current user's keys.
    - test_ssh_keys: DELETE /api/v1/me/ssh-keys/{id} returns 204; subsequent GET shows the key gone.
    - test_ssh_keys: User A cannot DELETE user B's key (returns 404, not 403 — don't leak existence).
    - test_pats: POST /api/v1/me/tokens returns 201 with body `{"id": ..., "name": ..., "plaintext": "pat_..." }` — `plaintext` is the full token.
    - test_pats: GET /api/v1/me/tokens returns rows with NO `plaintext` field, only metadata + `prefix_preview` (first 8 chars after pat_).
    - test_pats: Using `Authorization: Bearer <plaintext>` on GET /api/v1/me returns 200 with mode=pat.
    - test_pats: POST /api/v1/me/tokens with expires_at in the past returns 422.
    - test_pats: DELETE /api/v1/me/tokens/{id} marks revoked_at; subsequent Bearer auth with that token returns 401.
    - test_pats: `resolve_pat` is constant-time within candidates sharing a lookup_prefix (verified by inserting 2 PATs with the same prefix — synthetic collision — and asserting both resolve correctly without timing leak).
  </behavior>
  <action>
    **app/ssh_keys/service.py** — Implement `parse_ssh_pubkey(text) -> (normalized_openssh, "SHA256:<base64>")` per 01-RESEARCH.md §SSH key parse with fingerprint. Use `cryptography.hazmat.primitives.serialization.load_ssh_public_key`. Strip the optional comment (third whitespace-separated chunk) when normalizing. Add unit-test edge cases: RSA, ed25519, ecdsa, malformed. `async def add_ssh_key(db, *, user, name, public_key) -> SshKey`: parse → normalize → write row → return. On duplicate UNIQUE(user_id, name) raise `HTTPException(409, "A key with that name already exists")`. On duplicate fingerprint across user (rare but possible if a user pastes the same key twice with different names) — allow it (D-? Claude's discretion; document inline).

    **app/ssh_keys/routes.py** — Router under prefix `/api/v1/me/ssh-keys`. All routes `Depends(get_current_principal) + Depends(csrf_protect)` (except GET). Endpoints:
    - `POST /` — body `{name: str, public_key: str}` → 201 `{id, name, fingerprint, created_at}`.
    - `GET /` → list of the current user's keys (id, name, fingerprint, created_at — never public_key on list).
    - `GET /{id}` → full key including `public_key` (for "view raw" UX).
    - `DELETE /{id}` → 204. Returns 404 if not owned by current user (don't leak existence).

    **app/ssh_keys/schemas.py** — pydantic: `SshKeyCreate(name, public_key)`, `SshKeyResponse(id, name, fingerprint, created_at)`, `SshKeyDetailResponse` extends with `public_key`.

    **app/pats/service.py** — Implement `mint_pat`, `resolve_pat`, `revoke_pat` per 01-RESEARCH.md §Pattern 6. PAT format: `pat_<24-char urlsafe>`. `mint_pat(db, *, user, name, expires_at)`:
    - Generate body `secrets.token_urlsafe(18)` (24 chars).
    - `plaintext = f"pat_{body}"`.
    - `lookup_prefix = body[:12]`.
    - `token_hash = sha256(settings.pat_pepper + plaintext).hexdigest()`.
    - Insert row.
    - Return `MintedPAT(plaintext=plaintext, row=row)`.

    `resolve_pat(db, *, token)`:
    - Validate prefix `pat_`. If not → return None.
    - Extract body. `lookup_prefix = body[:12]`.
    - `SELECT * FROM personal_access_tokens WHERE lookup_prefix = :lp` → candidates list.
    - Compute `target_hash = sha256(settings.pat_pepper + token).hexdigest()`.
    - Iterate candidates: skip if `revoked_at` set or `expires_at < now`; use `secrets.compare_digest(c.token_hash, target_hash)`.
    - On match, UPDATE `last_used_at = now` (best-effort; if it races with revoke, idempotent), return the `c.user` (selectinload).
    - On no match, return None.

    `revoke_pat(db, *, pat_id, user_id)`: UPDATE with WHERE id=:id AND user_id=:uid; if 0 rows → 404.

    **app/pats/routes.py** — Router under prefix `/api/v1/me/tokens`. All routes require `Depends(get_current_principal) + Depends(csrf_protect)` (PAT-authed requests for these routes are EXCLUDED — a PAT cannot manage other PATs; enforce via `if principal.via_pat: raise HTTPException(403, "PAT cannot manage tokens")`). Endpoints:
    - `POST /` — body `{name: str, expires_at: datetime | None}` → 201 `{id, name, expires_at, plaintext: "pat_..."}` (show-once).
    - `GET /` → list with metadata only — `{id, name, prefix_preview, expires_at, last_used_at, revoked_at, created_at}` where `prefix_preview = "pat_" + lookup_prefix[:8] + "..."`.
    - `DELETE /{id}` → 204; sets `revoked_at`.

    **app/pats/schemas.py** — `PATCreate(name, expires_at)`, `PATMintResponse(...with plaintext)`, `PATListItem(...no plaintext)`.

    **Wire routers in app/main.py** — IF Task 1 didn't already do this, ensure `create_app()` includes:
    ```python
    from app.pats.routes import router as pats_router
    from app.ssh_keys.routes import router as ssh_keys_router
    app.include_router(ssh_keys_router, prefix="/api/v1/me/ssh-keys", tags=["ssh-keys"])
    app.include_router(pats_router, prefix="/api/v1/me/tokens", tags=["tokens"])
    ```

    Also update `app/auth/dependencies.py` to resolve the forward reference: replace the lazy import comment with `from app.pats.service import resolve_pat`.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_ssh_keys.py tests/test_pats.py -x -v 2>&1 | tail -40 && python -c "from app.main import app; paths = [r.path for r in app.routes]; assert any('/api/v1/me/ssh-keys' in p for p in paths) and any('/api/v1/me/tokens' in p for p in paths); print('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend && python -m pytest tests/test_ssh_keys.py tests/test_pats.py -x` exits 0
    - `grep -q 'secrets.compare_digest' backend/app/pats/service.py` (constant-time PAT match)
    - `grep -q 'load_ssh_public_key' backend/app/ssh_keys/service.py`
    - `grep -q 'SHA256' backend/app/ssh_keys/service.py`
    - `grep -q 'lookup_prefix' backend/app/pats/service.py`
    - `grep -q 'plaintext' backend/app/pats/routes.py` (show-once response contains plaintext on POST)
    - `grep -L 'plaintext' backend/app/pats/routes.py | xargs grep -c 'prefix_preview' 2>/dev/null` (GET response uses prefix_preview, not plaintext — soft check)
    - `cd backend && python -m pytest -k "test_resolve_pat or test_constant_time" -x` exits 0
  </acceptance_criteria>
  <done>SSH key + PAT subsystems shipped; show-once semantics enforced; PAT auth works end-to-end (Bearer header → resolve_pat → Principal); tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → cookies | httpOnly access/refresh prevent JS read; CSRF cookie deliberately JS-readable |
| Bearer token → user | PAT resolution must be constant-time and reject non-`pat_*` Bearer values |
| Refresh chain | Old refresh token presented after rotation = compromised; revoke whole chain |
| SSH key text → file | Untrusted input parsed by `cryptography` — never `eval` / shell-execute |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-05-01 | Spoofing | User enumeration via login timing | mitigate | `verify_password(plaintext, DUMMY_HASH)` always called even when user row absent (Pattern 5 + §Login flow). Acceptance criteria enforces presence. |
| T-01-05-02 | Tampering | Refresh token replay | mitigate | `replaced_by_id` self-FK chain; presenting an already-rotated token triggers chain-revoke on entire family. Test verifies. |
| T-01-05-03 | Information disclosure | Refresh token in URL log | mitigate | Refresh is in `refresh_token` cookie with `path=/api/v1/auth` — limits cookie scope. Body never contains the value. Caddy access log disabled (`--no-access-log` on uvicorn; Caddy `log` directive omitted by default). |
| T-01-05-04 | Tampering | CSRF on state-changing cookie sessions | mitigate | Double-submit (D-13). `csrf_protect` dependency reads cookie + header, `secrets.compare_digest`, returns 403 on mismatch. PAT bypass documented. |
| T-01-05-05 | Spoofing | Algorithm-confusion attack on JWT | mitigate | `decode_access_token` pins `algorithms=["HS256"]` (Plan 01 enforced). Pitfall A8: only `pat_*` prefix accepted for Bearer; arbitrary JWT-via-Bearer rejected 401. |
| T-01-05-06 | Information disclosure | PAT plaintext stored in DB | mitigate | Only `lookup_prefix` (first 12 chars body) + `sha256(pepper + token)` stored. Plaintext shown ONCE on POST response. Acceptance criteria enforce. |
| T-01-05-07 | Spoofing | PAT timing attack | mitigate | `secrets.compare_digest` on hash comparison; candidate set narrowed by indexed `lookup_prefix`; constant-time within candidates. |
| T-01-05-08 | Denial of service | Login brute-force | mitigate | Per-IP in-memory bucket: 10 attempts / 60s → 429 (CONTEXT.md discretion). Phase 5 could harden to leaky bucket + redis. |
| T-01-05-09 | Tampering | SSH key text contains shell metacharacters | mitigate | Parsed by `cryptography.hazmat.primitives.serialization.load_ssh_public_key` — pure parse, never shell-executed. Stored as plain text in DB; consumed by Phase 4 cloud-init only via YAML serialization (not shell concatenation). |
| T-01-05-10 | Elevation of privilege | PAT manages other PATs (privilege escalation) | mitigate | PAT-authed requests to `/api/v1/me/tokens/*` rejected 403 ("PAT cannot manage tokens"). Tested. |
| T-01-05-11 | Information disclosure | DELETE returns 403/404 leaks existence | mitigate | Cross-user DELETE returns 404 (not 403) — same response shape as "not found" so attackers can't enumerate IDs across users. |
| T-01-05-12 | Repudiation | Logout silently succeeds for invalid refresh token | accept | `logout` is idempotent (no error on missing/expired refresh) so the user experience is "log out always works." Audit log writer (Phase 2) will record logout attempts. |
| T-01-05-13 | Information disclosure | Refresh token in `replaced_by_id` chain visible to other admins via SQL | accept | Chain is on a `refresh_tokens` row inspectable by anyone with DB access. Admins already have full DB access; not a new risk. |
| T-01-05-14 | Tampering | rate_limit in-memory bucket lost on restart | accept | Documented: rate limiter is best-effort within a process lifetime. Phase 5 can harden if abuse observed. |

**ASVS L1 mappings:**
- V2.1 (password security) → min 12 chars (`PasswordChangeRequest`), argon2id verify, change requires current password
- V2.4 (password storage) → argon2id via pwdlib (Plan 01)
- V3.2 (session token generation) → 256-bit JWT signing key + `jti` UUID4 + 15-min TTL
- V3.5 (logout / session termination) → revoke refresh row + clear cookies; revoke_user_sessions hook for admin disable
- V3.7 (CSRF protection) → double-submit pattern (D-13)
- V5.1 (input validation) → pydantic schemas + min_length=12 on passwords
- V6.4 (key derivation / management) → PAT pepper from `/etc/proxmox-gui/pat.pepper` (Plan 04 generator)
- V13.2 (REST API) → Bearer pat_* + httpOnly cookie dual mode
</threat_model>

<verification>
- `cd backend && python -m pytest tests/test_auth.py tests/test_refresh_rotation.py tests/test_csrf.py tests/test_pats.py tests/test_ssh_keys.py -x -v` exits 0
- All key acceptance-criteria greps pass
- Manual integration smoke (post-wave): login, hit GET /api/v1/me with the access cookie → 200; mint a PAT, hit GET /api/v1/me with Bearer header → 200
</verification>

<success_criteria>
The auth surface is complete and battle-ready. Plan 06 (clusters) will use `require_admin`; Plan 07 (users/teams/setup) will call `revoke_user_sessions` on disable; Plan 08 (UI) will use `apiJson` against `/auth/login`, `/me`, `/me/password`, `/me/ssh-keys`, `/me/tokens`. Refresh rotation + replay detection is the security backbone for everything that follows.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-05-SUMMARY.md` documenting:
- Auth endpoints (full list with method + path + auth requirement)
- Cookie shape (name, httponly, samesite, max_age, path)
- PAT format + storage shape
- Rate-limit parameters
- Test count + pass/fail
- Any deviations from research (none expected — research already settled every fork)
- The Plan 07 / Plan 06 hooks exposed: `revoke_user_sessions(user_id)`, `require_admin`
</output>
