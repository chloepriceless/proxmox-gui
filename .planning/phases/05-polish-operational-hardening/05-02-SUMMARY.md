---
phase: 05-polish-operational-hardening
plan: 02
subsystem: backend-security + deploy + frontend
tags: [carryover, security, tls-pinning, rate-limit, csp, hardening]
requires:
  - "Phase 1 foundation (auth, clusters, teams, users, pats, ssh_keys, deploy)"
  - "Plan 05-01 (AppSetting model, idle-timeout — auth/routes.py integration)"
provides:
  - "TLS fingerprint pinning for self-signed PVE clusters (FingerprintPinningAdapter + capture_fingerprint)"
  - "Redis-backed rate limiter (app/security/rate_limit.py) with in-memory fallback"
  - "Caddy Content-Security-Policy header"
  - "Atomic first-run admin creation; constant-time disabled-user login"
affects:
  - "backend/app/clusters/* — connector now mounts a pinning adapter"
  - "backend/app/auth/* — rate limiter relocated; login timing fixed"
  - "deploy/caddy/Caddyfile.template — CSP header added"
tech-stack:
  added:
    - "urllib3 assert_fingerprint (via requests HTTPAdapter subclass) for TLS pinning"
    - "redis-py sync client for the shared rate-limit token bucket"
  patterns:
    - "Shared nullable-clearable PATCH sentinel (app/core/patch.py)"
    - "Two-function split replacing a fragile internal-flag (create_team)"
key-files:
  created:
    - backend/app/clusters/pinning.py
    - backend/app/security/__init__.py
    - backend/app/security/rate_limit.py
    - backend/app/core/patch.py
    - backend/tests/test_tls_pinning.py
    - backend/tests/test_carryover.py
    - backend/tests/test_rate_limit.py
  modified:
    - backend/app/clusters/connector.py
    - backend/app/clusters/service.py
    - backend/app/clusters/schemas.py
    - backend/app/auth/rate_limit.py
    - backend/app/auth/routes.py
    - backend/app/auth/service.py
    - backend/app/setup/service.py
    - backend/app/teams/service.py
    - backend/app/teams/routes.py
    - backend/app/teams/schemas.py
    - backend/app/users/service.py
    - backend/app/users/schemas.py
    - backend/app/pats/service.py
    - backend/app/ssh_keys/service.py
    - backend/app/config.py
    - deploy/caddy/Caddyfile.template
    - deploy/README.md
    - frontend/src/hooks.server.ts
decisions:
  - "TLS pinning mount seam: mount FingerprintPinningAdapter on proxmoxer's persistent session (ProxmoxAPI._store['session']) — the spike confirmed the seam is reliable; no ssl pre-flight fallback needed"
  - "Rate limiter: Redis-backed with a process-local in-memory fallback so the limiter is functional (not fail-open) when Redis is down"
metrics:
  duration: "~95 min"
  completed: "2026-05-19"
  tasks: 3
  files_created: 7
  files_modified: 18
  tests_added: 24
---

# Phase 5 Plan 02: Consolidated Phase-1 Carryover Summary

The single consolidated carryover plan (D-19) — closes all Phase-1
review/verification debt in one plan: TLS fingerprint pinning (D-20), a
Redis-backed rate limiter, the Caddy CSP header, the COOKIE_SECURE warning,
the ssh-rsa validator bug, and the ME/LO/IN correctness/security items.

## What Shipped

### Task 1 — TLS fingerprint pinning (D-20)

`backend/app/clusters/pinning.py` is new:
- `FingerprintPinningAdapter(HTTPAdapter)` — injects urllib3's
  `assert_fingerprint` into the connection pool; a leaf-cert SHA-256 mismatch
  raises `ssl.SSLError`. `assert_hostname=False` — the fingerprint is the
  trust anchor, cert-chain validation stays off.
- `capture_fingerprint(host, port)` — stdlib `ssl`/`socket`/`hashlib` helper
  that fetches the PVE leaf cert's SHA-256 for the capture-on-register (TOFU)
  flow.
- `mount_pinning_adapter(client, fingerprint)` — mounts the adapter on
  proxmoxer's session.

The Phase-1 `NotImplementedError` guard in `connector.py` is **removed**;
when a cluster carries a `tls_fingerprint` with `verify_ssl=False`, the
connector now mounts the adapter. `test_cluster` captures the fingerprint and
`ClusterTestResponse` surfaces it. The connector also catches
`requests.exceptions.SSLError` (a fingerprint mismatch) and maps it to
`PVEUnreachable`.

**Spike outcome (RESEARCH Open Question Q1 — the mount seam):** RESOLVED to
the **session-mount path**, no `ssl` pre-flight fallback needed. The
installed proxmoxer 2.3.0 source (`proxmoxer/core.py:216`) builds
`ProxmoxHttpSession` (a `requests.Session` subclass) exactly once at
`ProxmoxAPI` construction and stores it at `ProxmoxAPI._store["session"]`;
every API call reuses that same session object (`core.py:143`). Mounting the
adapter on that persistent session is therefore reliable. The
**negative test** (`test_wrong_fingerprint_is_refused` — a wrong-cert host
MUST be refused, Pitfall 4) is green against a real local self-signed HTTPS
server.

### Task 2 — backend correctness/security carryover

| Item | Fix |
|------|-----|
| ME-01 | `create_initial_admin` commits user + personal team + membership in one transaction |
| IN-02 | `create_team(_internal=True)` flag replaced by two functions: `create_team_for_admin_bootstrap` (no-commit personal path) + public `create_team`. All call sites (`setup`, `users`, `teams/routes`) updated. |
| ME-02 | Rate limiter relocated to `app/security/rate_limit.py`, re-implemented on a Redis sorted-set sliding window with a process-local in-memory fallback. `auth/rate_limit.py` kept as a re-export shim; `auth/routes.py` imports from the new path. |
| ME-04 | `connector.version()` + `_call_with_breaker` now catch `requests.exceptions.Timeout` → `PVEUnreachable` (was an uncaught 500) |
| ME-05 | Shared `_UNSET`/`is_set` sentinel in `app/core/patch.py`; `clusters/schemas.py` uses it, `users`/`teams` schemas adopt the convention |
| LO-01 | Disabled-user login runs a dummy Argon2id verify before the 403 — constant-time, no account-disabled timing leak |
| LO-03 | Explicit CSRF-absence + CSRF-rotation comments on the login route |
| IN-01 | `resolve_pat` writes a `pat.rejected_user_disabled` audit entry when a still-valid PAT is presented by a disabled user |
| IN-03 | `ClusterUpdate` `@model_validator` rejects changing `token_user` without `api_token_secret` |
| ssh-rsa (999.1) | Root cause: an `authorized_keys` **options prefix** (`from="…" ssh-rsa AAAA…`) made the parser treat the options token as the key type. Fixed by `_strip_options_prefix` + CRLF normalisation. NOT a `cryptography` SHA-1 issue — RSA parses fine. |

### Task 3 — deploy + frontend carryover

- **Caddy CSP** — `Content-Security-Policy` directive added to the
  `header { }` block: `default-src 'self'; frame-ancestors 'self';
  img-src 'self' data: https:; style-src 'self' 'unsafe-inline';
  script-src 'self' 'unsafe-inline'; connect-src 'self'`. `'unsafe-inline'`
  scoped to script/style so SvelteKit hydration works; `frame-ancestors 'self'`
  is the modern clickjacking defence.
- **COOKIE_SECURE warning** — `config.py` emits a startup `UserWarning` when
  `cookie_secure=false` is set against a non-local DB. `deploy/README.md`
  gains a "Security configuration" section documenting the flag as dev-only.
- **LO-04** — `hooks.server.ts` `/api` proxy adds `duplex: 'half'` for
  body-carrying requests (Node 18+ undici requirement).
- `frontend/build/` rebuilt so the `duplex` fix reaches the deployed artifact.

## Deviations from Plan

### Items already resolved (no change needed)

**LO-02 (`bootstrap.sh` `--no-audit`)** — investigated; there is no
`--no-audit` flag anywhere in `deploy/`. `bootstrap.sh` ships a pre-built
`frontend/build/` artifact and runs no `npm ci` at deploy time (Step 7
comment), so the LO-02 concern was already closed by the build-artifact
approach. The acceptance criterion `! grep -q "no-audit"` is satisfied.
`bootstrap.sh` was therefore not modified despite being in `files_modified`.

**COOKIE_SECURE production default** — the production systemd unit
(`deploy/systemd/proxmox-gui-api.service:22`) already sets
`PROXMOX_GUI_COOKIE_SECURE=true`, and `backend/.env.example` already
documents the flag as dev-only. Only the startup warning + README section
were new.

### Test updates required by the API changes (Rule 3 — blocking)

- `tests/test_connector.py::test_tls_fingerprint_without_verify_ssl_raises_not_implemented`
  asserted the now-removed Phase-1 guard; replaced with
  `test_tls_fingerprint_mounts_pinning_adapter`.
- `tests/test_tenant_bootstrap.py` — eight tests passed
  `create_team(..., personal=False)`; the `personal` parameter was removed by
  IN-02, so the calls were updated to drop it.

### Naming note

The `! grep -q "_internal" teams/service.py` acceptance check still matches
3 times — all in **docstrings** describing the IN-02 fix (i.e. documenting
the flag that was removed). The `_internal` *parameter* is gone, verified by
`test_create_team_signature_dropped_internal_flag`. The docstring provenance
was kept deliberately.

### Auth gates

None.

## Verification

- `cd backend && python -m pytest -q` — **568 passed, 0 failed**.
- `tests/test_tls_pinning.py` — 7 passed, including the wrong-cert negative
  test against a real local self-signed HTTPS server.
- `tests/test_carryover.py` + `tests/test_rate_limit.py` — all green.
- `cd frontend && pnpm exec svelte-check --threshold error` — 0 errors,
  0 warnings.
- `frontend/build/` rebuilt; `node_modules` restored (0 staged deletions).

### Tooling gap

`caddy validate` could not run — `caddy` is not installed in this
environment (`docker` also unavailable). The CSP change is a single
string-valued directive in an existing valid `header { }` block, identical in
shape to the `Strict-Transport-Security` directive above it; braces remain
balanced (21/21). The change should be confirmed with `caddy validate` in an
environment that has Caddy before deploy.

## Threat Flags

None — no new security surface beyond the threat model in the plan. All
nine STRIDE register entries (T-05-02-01 .. T-05-02-09) are addressed.

## Self-Check: PASSED

Created files verified present:
- `backend/app/clusters/pinning.py` — FOUND
- `backend/app/security/rate_limit.py` — FOUND
- `backend/app/core/patch.py` — FOUND
- `backend/tests/test_tls_pinning.py` — FOUND
- `backend/tests/test_carryover.py` — FOUND
- `backend/tests/test_rate_limit.py` — FOUND

Commits verified in `git log`:
- `beda13b` feat(05-02): TLS fingerprint pinning — FOUND
- `f577bf6` fix(05-02): backend correctness/security carryover — FOUND
- `2e02210` feat(05-02): deploy + frontend carryover — FOUND
