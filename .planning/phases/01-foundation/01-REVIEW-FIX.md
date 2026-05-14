---
phase: 01
phase_name: foundation
fixed_at: 2026-05-14
fixer: gsd-code-fixer
review_path: .planning/phases/01-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
tests_before: 166
tests_after: 171
frontend_check: clean
---

# Phase 01: Foundation — Code Review Fix Report

**Fixed at:** 2026-05-14
**Source review:** `.planning/phases/01-foundation/01-REVIEW.md`
**Iteration:** 1
**Scope:** BLOCKERs (BL-01, BL-02) + HIGH findings (HI-01, HI-02, HI-03). MEDIUM/LOW/INFO deferred per operator instruction.

## Summary

| Finding ID | Status | Commit  | One-line note |
|------------|--------|---------|---------------|
| BL-01      | fixed  | b83409b | Shell injection in `pct exec` heredoc closed via `env`-prefix; shellcheck clean. |
| BL-02      | fixed  | d2600e5 | TOCTOU on first-run admin closed by unique partial index on `users(is_admin) WHERE is_admin=1`; +3 tests. |
| HI-01      | fixed  | cc18d19 | `X-Forwarded-For` honoured only when peer is in new `trusted_proxies` setting; rotated-header bypass test added. |
| HI-02      | fixed  | 657bcb1 | Dead `hasattr(...)`/`selectinload(PersonalAccessToken.user)` branch removed; unused import dropped. |
| HI-03      | fixed  | 4890ee7 | `delete_user` collapsed to a single transaction; atomicity test asserts rollback boundary holds under mid-flow failure. |

## Test result delta

| Stage           | Backend pytest | Frontend `pnpm run check` |
|-----------------|----------------|---------------------------|
| Before fixes    | 166 passed     | 0 errors / 0 warnings (untouched) |
| After fixes     | 171 passed     | 0 errors / 0 warnings |
| Delta           | +5 new tests (BL-02 ×3, HI-01 ×1, HI-03 ×1) | clean (no frontend changes) |

`pytest -x -q` exit 0. `pnpm run check` exit 0.

## Fixed Issues

### BL-01: Shell injection in `install.sh` via `--repo-url` / `--release`

**Files modified:** `deploy/install.sh`
**Commit:** b83409b
**Applied fix:** Replaced `pct exec "$CTID" -- bash -c "...export REPO_URL='$REPO_URL'..."` with `pct exec "$CTID" -- env REPO_URL="$REPO_URL" RELEASE="$RELEASE" bash -c '...curl -fsSL "${REPO_URL}/raw/${RELEASE}/..."...'`. The inner heredoc is now fully single-quoted at the host level (no interpolation possible), and the inner shell expands `${REPO_URL}` / `${RELEASE}` from its own env. A `# shellcheck disable=SC2016` directive documents the intentional single-quoting.

**Verification:** `shellcheck deploy/install.sh` clean. `bash -n` clean.

### BL-02: TOCTOU race on first-run admin creation

**Files modified:** `backend/alembic/versions/0002_add_uq_one_admin.py` (new), `backend/app/models/user.py`, `backend/tests/test_setup.py`
**Commit:** d2600e5
**Applied fix:**
1. New Alembic migration `0002_add_uq_one_admin` adds a unique partial index: `CREATE UNIQUE INDEX uq_one_admin ON users (is_admin) WHERE is_admin = 1`.
2. Mirrored the same constraint into the `User` ORM model's `__table_args__` so `Base.metadata.create_all` in tests builds the same schema as Alembic does in production.
3. The existing `except IntegrityError → 409` handler in `setup/service.py` is now reachable on a concurrent race; no service code change required.
4. Added 3 regression tests proving the constraint rejects a second `is_admin=1` row, the wizard returns 409 from a post-race state, and the index is present at the DDL level.

**Verification:** `pytest tests/test_setup.py tests/test_migrations.py` clean. Direct migration cycle (`upgrade head → downgrade base → upgrade head`) verified against an on-disk SQLite DB.

### HI-01: `X-Forwarded-For` unconditionally trusted

**Files modified:** `backend/app/config.py`, `backend/app/auth/routes.py`, `backend/tests/test_auth.py`
**Commit:** cc18d19
**Applied fix:** Added `trusted_proxies: list[str] = []` to `Settings` (safe default — empty). `_client_ip` now honours the leftmost `X-Forwarded-For` token ONLY when `request.client.host` is in `settings.trusted_proxies`; otherwise it falls back to the direct TCP peer. Production operators set `PROXMOX_GUI_TRUSTED_PROXIES=["127.0.0.1","::1"]` in the systemd unit's environment for the standard same-host Caddy + LXC topology.

**Verification:** New test `test_login_xff_ignored_when_peer_not_trusted` rotates the forged header across 15 requests with `trusted_proxies=[]` and asserts the per-IP limiter still trips — proving the bucket is keyed by the real peer. Existing rate-limit test updated to opt in to `trusted_proxies`.

### HI-02: Dead `selectinload` branch in `resolve_pat`

**Files modified:** `backend/app/pats/service.py`
**Commit:** 657bcb1
**Applied fix:** Removed the `hasattr(PersonalAccessToken, "user") then selectinload(...) else ...` branch entirely. `PersonalAccessToken` has no `user` relationship in the Phase-1 model — `hasattr` always returned False, so the `selectinload` path was dead code masked by `# type: ignore[arg-type]`. Removed the now-unused `from sqlalchemy.orm import selectinload` import. The user is still fetched explicitly via `db.get(User, c.user_id)` after a hash match.

**Verification:** `pytest tests/test_pats.py` — 8/8 pass. Python AST parse clean.

### HI-03: `delete_user` split-commit atomicity

**Files modified:** `backend/app/users/service.py`, `backend/tests/test_users.py`
**Commit:** 4890ee7
**Applied fix:** Inlined the refresh-token + PAT revocation as bulk `UPDATE` statements directly in `delete_user`, removed the call to `revoke_user_sessions` (which committed mid-flow), and consolidated everything into a single `await db.commit()` at the bottom of the function. A mid-flow exception now rolls back the entire operation; no "half-deleted ghost" state.

**Verification:** New test `test_delete_user_is_atomic_under_midflow_failure` monkey-patches `AsyncSession.delete` to raise after the revoke `UPDATE`s have flushed, then asserts (1) the user row still exists, (2) `RefreshToken.revoked_at` is still `None`, and (3) `PAT.revoked_at` is still `None` — proving the rollback boundary holds.

## Skipped Issues

None. All 5 in-scope findings (BL-01, BL-02, HI-01, HI-02, HI-03) were fixed in iteration 1.

## Out-of-Scope Items (Deferred)

Per operator instruction, MEDIUM/LOW/INFO findings from 01-REVIEW.md and known dev-only items remain deferred:

- **ME-01** Two-commit path in `create_initial_admin` via `create_team` (similar pattern to HI-03; lower severity because only affects one-shot first-run path).
- **ME-02** In-memory rate-limit bucket vs. multi-worker uvicorn (current single-worker deployment is safe; revisit in Phase 5).
- **ME-03** Pipe-to-bash without integrity check (documented as deferred to Phase 5 DEPLOY-04: GPG-signed releases).
- **ME-04** `requests.exceptions.Timeout` not caught in `clusters/connector.py::version()` (should map to `PVEUnreachable`).
- **ME-05** PATCH semantics for clearing nullable fields (`notes`, `tls_fingerprint`).
- **LO-01** Disabled-user timing distinguishable from non-existent user (intentional 401/403 split — see review).
- **LO-02** `npm ci --no-audit` (lockfile-pinned; LOW).
- **LO-03** Inline comment on login CSRF absence (doc nit).
- **LO-04** `hooks.server.ts` proxy `duplex: 'half'` (dev-only).
- **IN-01..03** No code changes required (Phase 2 audit, refactor candidates, UI ergonomics).

The `ssh-rsa key rejection` backlog item (`.planning/backlog/ssh-rsa-key-acceptance.md`) is out of scope per the fix instructions and remains tracked there.

---

_Fixed: 2026-05-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
