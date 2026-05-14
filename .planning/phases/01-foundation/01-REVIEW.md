---
phase: 01
phase_name: foundation
reviewed_at: 2026-05-14
reviewer: gsd-code-reviewer
files_reviewed: 78
status: issues_found
findings:
  blockers: 2
  high: 3
  medium: 5
  low: 4
  info: 3
---

# Phase 01: Foundation — Code Review Report

**Reviewed:** 2026-05-14  
**Depth:** standard (per-file with cross-module contract checks)  
**Files Reviewed:** 78  
**Status:** issues_found

## Summary

The Phase 1 foundation is architecturally sound and demonstrates careful attention to the threat model. Auth flow (argon2id, refresh-rotation with chain-revoke, CSRF double-submit, PAT peppered hash), multi-tenant invariants (per-team Fernet-encrypted tokens, privilege-separated PVE tokens), and deploy hardening (systemd ASVS V14.1, 0400 key files, unprivileged LXC) are all correctly implemented. No secrets are logged or leaked through API surfaces. The JWT algorithm is pinned; access-token decode enforces issuer + required claims; PAT resolution uses constant-time comparison within the prefix bucket.

Two BLOCKER-grade issues were found: a shell injection in `install.sh` that could run arbitrary commands on the Proxmox VE host if an operator is socially-engineered into passing a malicious `--repo-url`/`--release` flag, and a TOCTOU race on `POST /api/v1/setup/admin` that (under concurrent requests to a fresh instance) can admit two admins without returning 409 to either caller. Three HIGH issues relate to: the X-Forwarded-For header being unconditionally trusted (rate-limit bypass), a subtle dead branch in `resolve_pat` that silently drops the `selectinload` on every real call-site (correctness), and a missing `db.commit()` after `revoke_user_sessions` in `delete_user` that leaves the deleted user's row flushed but not committed before the cascade deletes run. Medium and below findings are documented but are not blocking.

---

## BLOCKER Issues

### BL-01: Shell Injection in `install.sh` via `--repo-url` / `--release`

**File:** `deploy/install.sh:196-203`  
**Category:** security  
**Severity:** BLOCKER

`REPO_URL` and `RELEASE` are operator-supplied strings that land unquoted inside a `bash -c "..."` heredoc passed to `pct exec`. A value containing a single-quote can break out of the embedded shell string and execute arbitrary commands with the privileges of the calling process — which on a Proxmox VE host is typically root.

```bash
# Current (vulnerable) — line 196-203
pct exec "$CTID" -- bash -c "
    set -euo pipefail
    export REPO_URL='$REPO_URL'      # <-- single-quote injection here
    export RELEASE='$RELEASE'
    ...
    curl -fsSL '$REPO_URL/raw/$RELEASE/deploy/lxc/bootstrap.sh' | bash
"
```

An attacker who tricks an operator into running:
```bash
bash install.sh --repo-url "'; id > /tmp/pwned; echo '"
```
gets arbitrary code execution on the host.

**Fix:** Pass the variables as explicit environment prefixes to `pct exec`, not via string interpolation into a quoted shell string. `pct exec` supports `--` followed by a direct command array:

```bash
# Safe alternative: use env vars passed outside the shell string
pct exec "$CTID" -- env \
    REPO_URL="$REPO_URL" \
    RELEASE="$RELEASE" \
    bash -c 'set -euo pipefail
    apt-get update -qq
    apt-get install -y -qq curl ca-certificates
    curl -fsSL "${REPO_URL}/raw/${RELEASE}/deploy/lxc/bootstrap.sh" | bash'
```

Alternatively add `printf '%q'` sanitisation before interpolation, but the `env`-prefix approach is cleaner and eliminates the injection surface entirely.

---

### BL-02: TOCTOU Race on First-Run Admin Creation

**File:** `backend/app/setup/service.py:83-127`  
**Category:** correctness / security  
**Severity:** BLOCKER

`create_initial_admin` calls `no_admin_yet(db)` as a pre-check and then proceeds to insert the admin user, but the check and the insert are two separate statements in the same SQLite session. With SQLite's default `journal_mode=WAL` and `NORMAL` synchronous mode, two concurrent HTTP requests to `POST /api/v1/setup/admin` can both pass the `no_admin_yet` check before either's INSERT is committed, yielding two admin rows and a silent 201 on both responses. The docstring calls this "T-01-07-01 race mitigation" but does not implement any actual serialisation.

SQLite WAL mode does not provide row-level locking. The fix is either:
1. A unique partial index: `CREATE UNIQUE INDEX uq_one_admin ON users (is_admin) WHERE is_admin = 1` — the second INSERT violates it and returns `IntegrityError`, which the existing `except IntegrityError` block already maps to 409.
2. Optimistic: keep the pre-check but catch the IntegrityError from the unique partial index on commit.

**Fix (migration addition):**
```python
# In the Alembic migration for users table
Index(
    "uq_one_admin",
    User.is_admin,
    unique=True,
    postgresql_where=User.is_admin.is_(True),
    sqlite_where=User.is_admin.is_(True),
)
```

This turns an accept-both race into an accept-one/reject-one race, which is the correct semantics for a one-shot setup endpoint.

---

## HIGH Issues

### HI-01: X-Forwarded-For Unconditionally Trusted — Rate-Limit Bypass

**File:** `backend/app/auth/routes.py:46-59`  
**Category:** security  
**Severity:** HIGH

`_client_ip` reads the leftmost `X-Forwarded-For` value without any restriction on which upstream is trusted. In the intended production topology (single Caddy instance in the same LXC), this is fine. However, there is no guard: an external client can forge `X-Forwarded-For: 1.2.3.4` and every request appears to come from a different IP, completely bypassing the 10-attempts/60s rate limit (T-01-05-08).

The threat is meaningful: if port 443 is exposed and Caddy is the only terminator, the attack requires bypassing Caddy — but Caddy does not strip `X-Forwarded-For` by default, it appends the real remote IP. So a forged header from a client to Caddy gives `X-Forwarded-For: forged, real_ip`; taking the leftmost token still returns the forged value.

**Fix:** Either:
- Add a `TRUSTED_PROXIES` setting (default `{"127.0.0.1", "::1"}`) and only honour `X-Forwarded-For` when `request.client.host` is in that set.
- Or, simpler for Phase 1: use `request.client.host` directly (the connection-level IP) since Caddy is same-host; the `X-Forwarded-For` only matters in multi-hop setups.

```python
def _client_ip(request: Request) -> str:
    # Only trust X-Forwarded-For from a configured set of trusted proxies.
    from app.config import settings
    if request.client is not None and request.client.host in settings.trusted_proxies:
        fwd = request.headers.get("X-Forwarded-For")
        if fwd:
            return fwd.split(",")[0].strip()
    if request.client is not None:
        return request.client.host
    return "unknown"
```

---

### HI-02: Dead Branch in `resolve_pat` — `selectinload` Never Applied

**File:** `backend/app/pats/service.py:139-148`  
**Category:** correctness  
**Severity:** HIGH

The `selectinload` for the `user` relationship in `resolve_pat` is inside a conditional expression that evaluates `hasattr(PersonalAccessToken, "user")`. `PersonalAccessToken` has no `user` relationship defined in `app/models/pat.py` — only `user_id` as a plain foreign-key column. Therefore `hasattr(PersonalAccessToken, "user")` always evaluates to `False` at runtime, and the `selectinload(PersonalAccessToken.user)` branch is dead code: the query always runs the `else` branch (without the join).

This means the `selectinload` import (`from sqlalchemy.orm import selectinload`) is effectively unused in this function, and the comment `# Load the user (PersonalAccessToken has no \`user\` relationship...)` on line 178 actually confirms this — the code acknowledges it and loads the user with a separate `db.get(User, c.user_id)`. The dead branch is harmless for correctness today but is misleading, can confuse future readers, and the `# type: ignore[arg-type]` suppresses the type error that would otherwise surface this.

**Fix:** Remove the dead selectinload branch entirely:

```python
candidates = (
    await db.execute(
        select(PersonalAccessToken).where(
            PersonalAccessToken.lookup_prefix == lookup_prefix
        )
    )
).scalars().all()
```

And remove the unused `from sqlalchemy.orm import selectinload` import from this file.

---

### HI-03: `delete_user` Commits Personal-Team and User Deletion After `revoke_user_sessions` Commits

**File:** `backend/app/users/service.py:338-370`  
**Category:** correctness  
**Severity:** HIGH

`delete_user` calls `revoke_user_sessions(db, user_id=user_id)` which itself calls `await db.commit()` (see `auth/service.py:257`). After that commit, the function continues in the same session to `db.delete(personal_team)` and `db.delete(user)`, then calls `await db.commit()` again.

The problem is that `revoke_user_sessions` also calls `update(PersonalAccessToken)` and `revoke_all_for_user` — all flushed and then committed inside its own `await db.commit()`. The subsequent `db.delete(user)` in `delete_user` should work because `expire_on_commit=False` means the `user` object stays live, and the session can still accept new operations. However, if the cascade FK (users → refresh_tokens, PATs) runs on the first `commit()` that `revoke_user_sessions` triggers, and the `user` row is still live at that point, the FK `ON DELETE CASCADE` on `refresh_tokens` and `personal_access_tokens` would only cascade once the user row is deleted in the second commit. This is the intended flow.

The actual bug: if an exception is raised between the first `commit()` (inside `revoke_user_sessions`) and the second `commit()` (at the end of `delete_user`), the session revocations are durably committed but the user and personal-team rows are not deleted. The user ends up in a state where they are not deleted but all their sessions are revoked — a half-deleted ghost account.

**Fix:** Flatten the operation into a single transaction. Inline the PAT + refresh-token revocation directly in `delete_user` using bulk UPDATE statements before the DELETE, then commit once:

```python
async def delete_user(db, *, user_id, current_admin_user_id):
    if user_id == current_admin_user_id:
        raise HTTPException(422, "Cannot delete yourself")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    # Inline revocations (no intermediate commit).
    now = datetime.now(UTC)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await db.execute(
        update(PersonalAccessToken)
        .where(PersonalAccessToken.user_id == user_id, PersonalAccessToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    # Delete personal team + user in one commit.
    personal_team = (await db.execute(...)).scalar_one_or_none()
    if personal_team:
        await db.delete(personal_team)
    await db.delete(user)
    await db.commit()
```

---

## MEDIUM Issues

### ME-01: `setup/service.py` — `create_initial_admin` Relies on Two-Commit Path Through `create_team`

**File:** `backend/app/setup/service.py:109-127`  
**Category:** correctness  
**Severity:** MEDIUM

`create_initial_admin` calls `teams_service.create_team(...)` which internally calls `await db.commit()` at its own conclusion (line 120 of `teams/service.py`). The outer function then calls `db.add(TeamMembership(...))` and `await db.commit()` again. Equivalent to the concern in HI-03: if an exception occurs between the team's internal commit and the outer `db.commit()`, the team row is persisted but the `TeamMembership` binding is lost, leaving the admin user's personal team orphaned.

This is lower severity because it only affects the one-shot first-run path and a partially-created state is visible (wizard would re-present as "admin already exists" on retry), but it is still an atomicity gap that could complicate recovery.

**Fix:** Refactor `teams_service.create_team` to accept an optional `commit=True` parameter, or extract an internal `_create_team_no_commit` helper that the setup service calls, then commits the full operation (user + team + membership) atomically once.

---

### ME-02: `rate_limit.py` — In-Memory Bucket Not Protected Against Concurrent Writes

**File:** `backend/app/auth/rate_limit.py:43-50`  
**Category:** correctness  
**Severity:** MEDIUM

`_buckets` is a plain `dict[str, list[float]]`. Under `uvicorn` with `--workers > 1` (or an ASGI server that uses multiple processes), each worker has its own copy — state is not shared. This is documented as acceptable for v1. However, even within a single worker process, asyncio can interleave coroutines. The `bucket[:] = [...]` compaction and `bucket.append(now)` are both synchronous operations and will not race in CPython's asyncio because the GIL + event loop ensure they run atomically within a single coroutine step. This is safe today.

The issue to flag: the module comment states "state is held in a module-level dict and reset on restart" but does not mention the multi-worker blind spot. If the production uvicorn command ever uses `--workers N` (tempting for CPU scaling), rate limiting silently degrades to N×10 attempts per IP per 60s window. The systemd unit currently does not pass `--workers`, but there is no guard.

**Fix:** Add a comment in the systemd unit or `rate_limit.py` explicitly prohibiting multi-worker uvicorn, OR add an `assert` / startup warning if `PROXMOX_GUI_WORKERS > 1` is detected. Alternatively, note it as a Phase 5 hardening task (redis-backed leaky bucket) since the code is correct for the current single-worker deployment.

---

### ME-03: `install.sh` — Pipe-to-Bash Download Without Integrity Check

**File:** `deploy/install.sh:202`  
**Category:** security  
**Severity:** MEDIUM

```bash
curl -fsSL '$REPO_URL/raw/$RELEASE/deploy/lxc/bootstrap.sh' | bash
```

The bootstrap script is fetched and executed without any signature or hash verification. This is documented in the code (`Pitfall T-01-04-01`) as deferred to Phase 5 (GPG-signed releases, DEPLOY-04). Noting it here as MEDIUM because the current mitigation — "operator must visually verify the install URL" — is not machine-enforceable and is the standard pipe-to-bash threat.

**Fix (Phase 5):** Add GPG signature verification before execution. In Phase 1, at minimum add a `--sha256 <expected>` flag that the operator can supply to assert the downloaded script's hash before execution. Until then, document this clearly in `deploy/README.md` as a known limitation.

---

### ME-04: `clusters/connector.py` — `requests.exceptions.Timeout` Not Caught

**File:** `backend/app/clusters/connector.py:88-109`  
**Category:** correctness  
**Severity:** MEDIUM

The `version()` method catches `AuthenticationError`, `ConnectionError`, `requests.ConnectionError`, and `ResourceException`. It does NOT catch `requests.exceptions.Timeout`. When a Proxmox host is reachable on TCP but hangs during the HTTP response (e.g., Proxmox UI is slow to respond under load), the call will block the `asyncio.to_thread` worker for `timeout=10` seconds and then raise `requests.exceptions.Timeout` which bubbles through to the FastAPI exception handler as a 500 (uncaught, maps to no registered handler → FastAPI's default 500).

`PVEUnreachable` is the correct semantic for a timeout scenario.

**Fix:**
```python
from requests.exceptions import Timeout as RequestsTimeout

async def version(self) -> dict:
    try:
        return await self._call(self._client.version.get)
    except AuthenticationError as exc:
        raise PVEAuthError(str(exc)) from exc
    except (ConnectionError, requests.ConnectionError, RequestsTimeout) as exc:
        raise PVEUnreachable(str(exc)) from exc
    except ResourceException as exc:
        raise PVEAPIError(...) from exc
```

---

### ME-05: `update_cluster` — Can Clear `tls_fingerprint` With Null but Cannot Clear `notes`

**File:** `backend/app/clusters/service.py:292-312`  
**Category:** api / correctness  
**Severity:** MEDIUM

In `update_cluster`, the field-update loop treats `None` as "not provided" for all fields:

```python
if payload.notes is not None:
    row.notes = payload.notes
```

This means there is no way to clear an existing `notes` or `tls_fingerprint` value once set — sending `notes: null` in a PATCH is indistinguishable from "I didn't include this field." This is a common API design issue with PATCH semantics but it creates a correctness gap: admins cannot use the edit form to clear optional text fields.

**Fix:** Use Pydantic's `model_dump(exclude_unset=True)` pattern at the route layer (as is done for `UserUpdate` in `users/routes.py`) and apply only the fields that were explicitly set. For nullable fields where `null` should mean "clear the value," use a sentinel like `pydantic.types.PydanticUndefined` or the `exclude_unset` approach:

```python
payload_dict = payload.model_dump(exclude_unset=True)
for field, value in payload_dict.items():
    setattr(row, field, value)
```

---

## LOW Issues

### LO-01: `auth/service.py:login` — Disabled-User Check After Password Verify Leaks User Existence

**File:** `backend/app/auth/service.py:97-102`  
**Category:** security  
**Severity:** LOW

The `login` function checks `is_active` only after `verify_password` succeeds (lines 97-102). This means a disabled user gets HTTP 403 ("Account disabled") while a non-existent user gets HTTP 401 ("Invalid credentials") — and the response time differs because a disabled-but-correct-password check does not run argon2id. While the status code distinction between 401 and 403 is deliberate (D-09), an attacker with knowledge of valid usernames can confirm a username's disabled status by observing a 403 response more quickly than the argon2id-hash path.

This is LOW because: (1) the attacker must already know the valid username, and (2) disabled accounts are of limited value for further attack. The current 401/403 distinction is intentional and acceptable.

**Fix (optional hardening):** Move the `is_active` check to before `verify_password`, so a disabled user always hits the `verify_password(password, DUMMY_HASH)` path and gets 401 with constant timing. The cost is losing the explicit "account disabled" message, which may be acceptable.

---

### LO-02: `deploy/bootstrap.sh` — `npm ci` Not Pinned, Uses `package-lock.json` But No Hash Check on Packages

**File:** `deploy/lxc/bootstrap.sh:165`  
**Category:** deploy  
**Severity:** LOW

`npm ci --no-audit --no-fund --silent` respects the lockfile, which is good. However `--no-audit` is passed, disabling the npm audit check. In a production deployment script, audit failures should at least be logged even if not blocking. This is LOW because the lockfile pins versions and the frontend is built at deploy time, not at runtime.

**Fix:** Remove `--no-audit` or replace with `--audit-level=high` to log but not fail on low/moderate advisories:
```bash
npm ci --audit-level=high --no-fund --silent
```

---

### LO-03: `auth/dependencies.py` — `csrf_protect` Does Not Check PATCH

**File:** `backend/app/auth/dependencies.py:158`  
**Category:** security  
**Severity:** LOW

`csrf_protect` checks `request.method in {"GET", "HEAD", "OPTIONS"}` for bypass and all others get the CSRF check. PATCH is correctly included (it is not in the bypass set). This is fine.

However, the login route (`POST /api/v1/auth/login`) does NOT have `Depends(csrf_protect)`. This is by design — there is no session cookie on login, so there is no CSRF cookie to compare. This is correct. Noting it for documentation clarity only: a reader might expect CSRF on login but the rationale is sound.

**Fix:** No code change needed. Add an inline comment to `auth/routes.py:login_route` explaining why CSRF is absent: `# No CSRF on login — no session cookie exists yet to forge.`

---

### LO-04: `hooks.server.ts` — `/api/` Proxy Does Not Forward `duplex` for Streaming Bodies

**File:** `frontend/src/hooks.server.ts:18-32`  
**Category:** correctness  
**Severity:** LOW

The SvelteKit server-side proxy for `/api/*` reads the full request body into an `ArrayBuffer` before forwarding it. For large POST bodies (e.g., if future endpoints accept file uploads), this buffers the entire body in memory on the Node server before forwarding. More importantly, in Node 18+ the `fetch` API requires `duplex: 'half'` when a body is provided in some environments; omitting it may cause silent failures on streaming body scenarios.

This is LOW for Phase 1 since no endpoint accepts large bodies, and the proxy is dev-only (Caddy handles prod). Still worth fixing before Phase 4.

**Fix:** Add `duplex: 'half'` to the RequestInit when there is a body:
```typescript
if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
  init.body = await event.request.arrayBuffer();
  (init as RequestInit & { duplex?: string }).duplex = 'half';
}
```

---

## INFO Items

### IN-01: `pats/service.py` — `resolve_pat` Silently Returns `None` on Inactive User — No Audit Hook

**File:** `backend/app/pats/service.py:179-182`  
**Category:** info  
**Severity:** INFO

When a valid, non-revoked, non-expired PAT is presented but the owning user has `is_active=False`, `resolve_pat` returns `None` silently. The auth dependency layer then raises 401 "Invalid PAT." This is the correct security outcome. However, with no audit log in Phase 1, a disabled user repeatedly hitting the API with a stale PAT produces no observable signal. The `last_used_at` update on line 170 is also skipped because it only runs on the matched-and-valid path. Phase 2's audit log should capture PAT-presented-but-user-disabled events.

**No code change needed for Phase 1.** Track as an audit event requirement for Phase 2.

---

### IN-02: `teams/service.py:create_team` — `_internal` Flag as Caller Convention Is Fragile

**File:** `backend/app/teams/service.py:40-48`  
**Category:** info  
**Severity:** INFO

The `_internal` parameter is a caller convention that bypasses the public-API guard (`personal=True` without `_internal=True` raises 422). This is a reasonable approach for v1, but a future maintainer adding a service-layer call to `create_team` might omit `_internal=True` when creating a personal team, unexpectedly raising 422 from a non-HTTP context. The parameter name's underscore prefix communicates "internal," but the pattern could be replaced with a separate `_create_personal_team` helper to make intent explicit.

**No code change needed for Phase 1.** Refactor in Phase 2 when team logic grows.

---

### IN-03: `clusters/service.py` — `update_cluster` Does Not Validate `token_user` Re-Encoding After Partial Update

**File:** `backend/app/clusters/service.py:248-265`  
**Category:** info  
**Severity:** INFO

When `update_cluster` is called with a new `api_token_secret` but without providing `token_user`, the effective `token_user` falls back to the stored value (`row.token_user`). The validation connector is built with this fallback, so the re-validation is against the correct credential. However, if only `token_user` changes (without `api_token_secret`), no re-validation occurs and the stored encrypted secret may now be mismatched with the new user. This is permissible since it's an operator-configurable field, but it means the connector can silently break without a test-connection step.

The `POST /{cluster_id}/test` endpoint exists precisely for this use-case. The admin UI should call it after any token_user edit even without a new secret. This is a UI concern, not a backend bug.

**No code change needed.** Document in the admin UI's cluster-edit page that re-testing after changing `token_user` without a new secret is recommended.

---

## Files Reviewed

```
backend/app/auth/__init__.py
backend/app/auth/dependencies.py
backend/app/auth/rate_limit.py
backend/app/auth/refresh.py
backend/app/auth/routes.py
backend/app/auth/schemas.py
backend/app/auth/service.py
backend/app/clusters/__init__.py
backend/app/clusters/connector.py
backend/app/clusters/errors.py
backend/app/clusters/registry.py
backend/app/clusters/routes.py
backend/app/clusters/schemas.py
backend/app/clusters/service.py
backend/app/config.py
backend/app/core/__init__.py
backend/app/core/cipher.py
backend/app/core/csrf.py
backend/app/core/db.py
backend/app/core/jwt.py
backend/app/core/passwords.py
backend/app/main.py
backend/app/me/__init__.py
backend/app/me/routes.py
backend/app/models/_types.py
backend/app/models/_types_init.py
backend/app/models/cluster.py
backend/app/models/pat.py
backend/app/models/refresh_token.py
backend/app/models/team.py
backend/app/models/team_cluster_token.py
backend/app/models/team_membership.py
backend/app/models/user.py
backend/app/pats/__init__.py
backend/app/pats/routes.py
backend/app/pats/schemas.py
backend/app/pats/service.py
backend/app/proxmox/client.py
backend/app/setup/__init__.py
backend/app/setup/routes.py
backend/app/setup/schemas.py
backend/app/setup/service.py
backend/app/ssh_keys/__init__.py
backend/app/ssh_keys/routes.py
backend/app/ssh_keys/schemas.py
backend/app/ssh_keys/service.py
backend/app/teams/__init__.py
backend/app/teams/bootstrap.py
backend/app/teams/routes.py
backend/app/teams/schemas.py
backend/app/teams/service.py
backend/app/users/__init__.py
backend/app/users/routes.py
backend/app/users/schemas.py
backend/app/users/service.py
backend/alembic/env.py
backend/alembic/versions/0001_initial.py
deploy/caddy/Caddyfile.template
deploy/install.sh
deploy/lxc/bootstrap.sh
deploy/scripts/gen-jwt-secret.sh
deploy/scripts/gen-master-key.sh
deploy/systemd/proxmox-gui-api.service
deploy/systemd/proxmox-gui-worker.service
frontend/src/hooks.server.ts
frontend/src/lib/api/client.ts
frontend/src/lib/components/forms/ConfirmByNameDialog.svelte
frontend/src/lib/components/forms/SecretRevealDialog.svelte
frontend/src/lib/utils/api.ts
frontend/src/lib/utils/csrf.ts
frontend/src/routes/+layout.server.ts
frontend/src/routes/admin/users/+page.svelte
frontend/src/routes/login/+page.svelte
frontend/src/routes/profile/tokens/+page.svelte
frontend/src/routes/setup/+page.server.ts
frontend/src/routes/setup/+page.svelte
```

---

_Reviewed: 2026-05-14_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
