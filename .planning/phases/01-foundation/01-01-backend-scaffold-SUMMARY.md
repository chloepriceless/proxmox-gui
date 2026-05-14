---
phase: 01-foundation
plan: 01
subsystem: backend
tags:
  - backend
  - fastapi
  - sqlalchemy
  - pydantic-settings
  - jwt
  - argon2id
  - fernet
  - alembic
  - pytest
  - asyncio
  - sqlite

# Dependency graph
requires: []
provides:
  - "FastAPI app factory + lifespan with master.key loading"
  - "Fernet SecretCipher with file-permission gate (Pitfall A6)"
  - "Async SQLAlchemy engine + sessionmaker + get_db dependency"
  - "SQLite WAL/foreign_keys/busy_timeout PRAGMA listener"
  - "HS256 JWT issue + decode helpers with algorithm pinning"
  - "argon2id password hash/verify + constant-time DUMMY_HASH"
  - "Double-submit CSRF mint/verify helpers"
  - "EncryptedSecret SQLAlchemy TypeDecorator (transparent at-rest encryption)"
  - "pytest-asyncio harness with cipher/engine/session/app/client fixtures"
  - "Proxmox thin-client module shape (placeholder for Plan 06)"
  - "OpenAPI 3.1 spec + Swagger UI + ReDoc at /api/openapi.json /api/docs /api/redoc"
  - "/api/v1/health unauthenticated liveness probe"
affects:
  - 01-02-db-schema (consumes Base + EncryptedSecret + get_db)
  - 01-04-deployment-skeleton (consumes app.main:app entry point)
  - 01-05-auth-subsystem (consumes JWT + CSRF + passwords + get_db)
  - 01-06-clusters-tenant-bootstrap (consumes EncryptedSecret + PVEThinClient shape)
  - 01-07-users-admin-setup (consumes passwords + get_db)

# Tech tracking
tech-stack:
  added:
    - fastapi==0.136.1
    - uvicorn[standard]==0.46.0
    - sqlalchemy[asyncio]==2.0.49
    - aiosqlite==0.22.1
    - alembic==1.18.4
    - pwdlib[argon2]==0.3.0
    - argon2-cffi==25.1.0
    - pyjwt==2.12.1
    - cryptography==45.0.7
    - pydantic==2.13.4
    - pydantic-settings==2.14.1
    - structlog==25.5.0
    - proxmoxer==2.3.0
    - httpx==0.28.1
    - pytest, pytest-asyncio==1.3.0, respx, ruff==0.15.12, mypy
  patterns:
    - "App factory + asynccontextmanager lifespan (Pattern 1)"
    - "Async session DI with expire_on_commit=False (Pattern 2, Pitfall A2)"
    - "Fernet TypeDecorator with module-level cipher install (Pattern 3)"
    - "HS256 JWT with algorithms=[ALG] pinning + iss/exp/sub/iat required claims (Pattern 5)"
    - "Argon2id via pwdlib.PasswordHash.recommended() singleton"
    - "Double-submit CSRF via secrets.compare_digest"
    - "pydantic-settings with file-or-env secret loading + ephemeral fallback warning"
    - "Redacted __repr__ on Settings as defense-in-depth for T-01-01-07"

key-files:
  created:
    - backend/pyproject.toml
    - backend/ruff.toml
    - backend/mypy.ini
    - backend/.env.example
    - backend/app/__init__.py
    - backend/app/config.py
    - backend/app/main.py
    - backend/app/core/__init__.py
    - backend/app/core/cipher.py
    - backend/app/core/csrf.py
    - backend/app/core/db.py
    - backend/app/core/jwt.py
    - backend/app/core/passwords.py
    - backend/app/models/base.py
    - backend/app/models/_types.py
    - backend/app/models/_types_init.py
    - backend/app/proxmox/__init__.py
    - backend/app/proxmox/client.py
    - backend/tests/__init__.py
    - backend/tests/conftest.py
    - backend/tests/test_cipher.py
    - backend/tests/test_jwt.py
    - backend/tests/test_passwords.py
    - backend/tests/test_config.py
    - .gitignore
  modified: []

key-decisions:
  - "Defense-in-depth Settings.__repr__ redaction for jwt_secret/pat_pepper (T-01-01-07)"
  - "run_migrations tolerates missing alembic.ini so Plan 01 can ship the call before Plan 02 lands migrations"
  - "PVEThinClient is a NotImplementedError stub — module shape only, real impl in Plan 06"
  - "Conftest imports are guarded with try/except ImportError so pytest --collect-only succeeds during Task 1 bootstrap"
  - "Ephemeral JWT secret / PAT pepper fallback emits UserWarning — acceptable for dev/test, installer always writes files in prod"
  - "cookie_secure=False in dev mode also disables the master.key 0o077 perm check (Pitfall A6) so unprivileged developers can iterate without root"

patterns-established:
  - "App factory + lifespan: every later plan adds routers via create_app(), never mutates the module-level app directly except for tests via dependency_overrides"
  - "TypeDecorator + module-level cipher singleton (install_cipher / _get_cipher): the only safe way to get the cipher into SQLAlchemy bind/result hooks, which run outside FastAPI request context"
  - "Pydantic-settings with file-OR-env secrets: production writes files; dev can inline env vars; ephemeral fallback warns rather than crashing"
  - "JWT decode pins algorithms=[ALG] + issuer + required claims — no JWT helper in this codebase will ever accept alg=none"

requirements-completed:
  - API-01
  - API-03

# Metrics
duration: ~25min
completed: 2026-05-14
---

# Phase 01 Plan 01: Backend Scaffold Summary

**FastAPI 0.136 + SQLAlchemy 2.0 async backend skeleton with Fernet SecretCipher, HS256 JWT, argon2id passwords, double-submit CSRF, EncryptedSecret SQLA TypeDecorator, and a green 33-test pytest harness.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-14T03:00:00Z (approximate)
- **Completed:** 2026-05-14T03:25:00Z (approximate)
- **Tasks:** 2 (both auto + tdd)
- **Files created:** 25 (24 in backend/, 1 .gitignore at repo root)

## Accomplishments

- FastAPI app factory + lifespan that loads master.key, installs cipher, runs migrations, disposes engine on shutdown
- All seven core primitives shipped: SecretCipher, JWT, passwords, CSRF, async DB engine, EncryptedSecret TypeDecorator, PVEThinClient stub
- OpenAPI 3.1 spec auto-served at `/api/openapi.json`; Swagger UI at `/api/docs`; ReDoc at `/api/redoc`
- Single unauth endpoint `/api/v1/health` returns `{status: ok, version: 0.1.0}` — verified via live `uvicorn` boot
- pytest-asyncio harness with autouse cipher installer + per-test in-memory engine + ASGI client fixtures
- 33 tests, all green; `ruff check .` passes clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Project + dependency bootstrap (pyproject, ruff, mypy, .env.example, config, conftest)** — `5acb964` (chore)
2. **Task 2: Core primitives — cipher, JWT, passwords, CSRF, db, EncryptedSecret, app factory, tests** — `b32862c` (feat)

Plus one Rule-2 deviation commit (see below):

3. **Settings.__repr__ redaction for T-01-01-07** — `afc1d9b` (fix)

## Files Created/Modified

### Configuration

- `backend/pyproject.toml` — project metadata + exact dependency pins from 01-RESEARCH §Installation; `[dependency-groups] dev`; `[tool.pytest.ini_options]` with `asyncio_mode=auto`
- `backend/ruff.toml` — line-length 100, target py312, select `E F I B UP ASYNC`, ignore E501 + B008 (FastAPI Depends idiom)
- `backend/mypy.ini` — pydantic plugin + strict_optional + ignore_missing_imports
- `backend/.env.example` — every `PROXMOX_GUI_*` env var documented
- `.gitignore` — Python, .venv, *.db, master.key, jwt.secret, pat.pepper, node artifacts

### Application code

- `backend/app/__init__.py` — empty package marker
- `backend/app/config.py` — `Settings` (pydantic-settings) with file-or-env secret loading, ephemeral fallback (warns), and redacted `__repr__` / `__str__`
- `backend/app/main.py` — `create_app()` + `lifespan` (load master.key → install_cipher → run_migrations → yield → engine.dispose). Exports module-level `app = create_app()`. Ships `/api/v1/health` only.
- `backend/app/core/__init__.py` — package marker with import-direction rule
- `backend/app/core/cipher.py` — `SecretCipher` (Fernet over 32-byte raw key); `from_file` enforces `os.stat & 0o077 == 0` when `cookie_secure=True` (T-01-01-01)
- `backend/app/core/jwt.py` — `issue_access_token`, `decode_access_token`; `ALG="HS256"` pinned; required claims; issuer validation
- `backend/app/core/passwords.py` — `hash_password`, `verify_password` (argon2id); `DUMMY_HASH` for constant-time login miss
- `backend/app/core/csrf.py` — `mint_csrf_token`, `verify_csrf` (constant-time compare_digest)
- `backend/app/core/db.py` — async engine + sessionmaker (`expire_on_commit=False`); SQLite PRAGMA listener (WAL, foreign_keys, busy_timeout); `get_db` dep; `run_migrations` bridge (Alembic invoked inside `asyncio.to_thread`, tolerates missing `alembic.ini`)
- `backend/app/models/base.py` — `Base(DeclarativeBase)` + `TimestampMixin` (Plan 02 owns `models/__init__.py`)
- `backend/app/models/_types.py` — `EncryptedSecret(TypeDecorator)` over `LargeBinary`, `cache_ok=True`
- `backend/app/models/_types_init.py` — `install_cipher` / `_get_cipher` module-level singleton (raises if cipher absent — T-01-01-06)
- `backend/app/proxmox/__init__.py`, `client.py` — `PVEThinClient` placeholder (NotImplementedError); module shape only

### Tests

- `backend/tests/__init__.py` — empty
- `backend/tests/conftest.py` — autouse cipher installer; per-test in-memory engine + session_factory + app + httpx ASGI client; import-guarded so Task 1 collects before Task 2 lands modules
- `backend/tests/test_cipher.py` — 11 tests: round-trip, unicode, wrong-length, non-bytes, wrong-key fails (`InvalidToken`), encrypt non-str rejected, `from_file` length + perm checks (prod and dev mode), EncryptedSecret SQLA round-trip + NULL passthrough + uninstalled-cipher StatementError chaining
- `backend/tests/test_jwt.py` — 9 tests: round-trip, non-admin flag, malformed/tampered/expired/wrong-issuer/`alg=none`/wrong-key all rejected; `jti` uniqueness
- `backend/tests/test_passwords.py` — 7 tests: hash+verify, mismatch, salt randomness, DUMMY_HASH safety + argon2id format, malformed hash → False, empty inputs
- `backend/tests/test_config.py` — 5 tests: default master_key_path, repr/str both redact `jwt_secret` + `pat_pepper`, attributes remain plain str

## Decisions Made

- **Settings repr redaction (Rule 2 / T-01-01-07):** Even though the plan documents "Settings never logs secrets" as a process control, added a technical control on top: `__repr__` masks `jwt_secret` and `pat_pepper` with `***REDACTED***`. The attribute itself remains plain str (jwt.encode + sha256 contract preserved). See deviation §1 below.
- **`run_migrations` tolerates missing `alembic.ini`:** Plan 01 ships the call, Plan 02 lands the migrations directory. The filesystem check now lives inside the worker thread (`asyncio.to_thread`) to satisfy ruff ASYNC240 and Pitfall A3 (no sync I/O on the event loop).
- **Conftest import-guards:** `try/except ImportError` around the Task-2 imports lets Task 1's `pytest --collect-only` succeed before Task 2 lands its modules. After Task 2 the guards are no-ops.
- **`cookie_secure=False` disables perm-check too:** In test/dev mode the strict `os.stat & 0o077 == 0` check is skipped so unprivileged developers can iterate without root. Production always sets `cookie_secure=True` and the installer writes the file at mode 0400.
- **Ephemeral secret fallback emits `UserWarning`:** If neither `PROXMOX_GUI_JWT_SECRET` nor `_FILE` is set, generate via `secrets.token_urlsafe(48)` and warn. Acceptable for dev/test; the installer always writes the files in prod.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Settings `__repr__` redaction for T-01-01-07**
- **Found during:** Final verification (post-Task 2)
- **Issue:** The plan's threat model registers T-01-01-07 (info disclosure via structlog binding of `settings`) with disposition "mitigate" — but the only mitigation listed is a module docstring prohibition. That's a process control. Standard pydantic-settings `BaseSettings` `__repr__` includes the live `jwt_secret` and `pat_pepper` values, so a single offending `log.info("settings", **settings.model_dump())` leaks the live JWT signing key.
- **Fix:** Added `Settings.__repr__` (and `__str__` alias) that emits `***REDACTED***` in place of `jwt_secret` / `pat_pepper`. The attribute access remains plain `str` so jwt.encode / hashlib.sha256 still work unchanged (preserving the plan's explicit "no SecretStr" decision).
- **Files modified:** `backend/app/config.py`, `backend/tests/test_config.py`
- **Verification:** 5 new regression tests in `test_config.py`; `repr(settings)` no longer contains the live secret value
- **Committed in:** `afc1d9b` (separate `fix(01-01)` commit)

**2. [Rule 3 - Blocking] ruff auto-fixes (PEP 563, datetime.UTC, ASYNC240)**
- **Found during:** Task 2 verification (`ruff check .`)
- **Issue:** Plan 01 turns on ruff with `select=[E, F, I, B, UP, ASYNC]`; that catches 22 stylistic issues across our fresh files (quoted annotations made redundant by `from __future__ import annotations`, `datetime.timezone.utc` → `datetime.UTC`, `typing.AsyncIterator` → `collections.abc.AsyncIterator`, unused `pydantic.Field` import, pathlib in async function).
- **Fix:** Ran `ruff check . --fix`; 20 fixes auto-applied. The remaining 2 errors fixed manually: (a) `B017 pytest.raises(Exception)` → `pytest.raises(InvalidToken)` (more specific), (b) `ASYNC240` resolved by moving the pathlib check inside the `_upgrade` worker function in `run_migrations`.
- **Files modified:** `backend/app/config.py`, `backend/app/core/db.py`, `backend/app/core/jwt.py`, `backend/app/main.py`, `backend/app/models/_types_init.py`, `backend/tests/test_cipher.py`, `backend/tests/test_jwt.py`
- **Verification:** `ruff check .` → "All checks passed!"; `pytest -x -q` → 33 passed
- **Committed in:** `b32862c` (rolled into the Task-2 commit) + `afc1d9b` (test_cipher.py InvalidToken fix split out)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both deviations are necessary for correctness/security. No scope creep — Rule 2 fix is a 15-line technical hardening of a threat the plan already acknowledged; Rule 3 fixes are tooling conformance the plan itself enabled by selecting the rule set.

## Issues Encountered

- **First test_cipher.py run failed on `test_encrypted_secret_raises_without_installed_cipher`:** the `RuntimeError` from `_get_cipher()` is wrapped by SQLAlchemy in `StatementError` at bind time. Adjusted the test to assert `StatementError` and inspect `.__cause__` for the chained `RuntimeError`. This is the actual production behavior — a clearer error reaches the caller via the chain.
- **Live `uvicorn` smoke test:** booted the server on `127.0.0.1:8765`, probed both `/api/openapi.json` (returned `openapi: "3.1.0"`) and `/api/v1/health` (returned `{status: ok, version: 0.1.0}`), then killed the process. No `await engine.dispose()` warnings on shutdown.

## Verification Results

| Check                                                                | Result                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pytest -x -q` from `backend/`                                       | **33 passed**, 5 warnings (ephemeral-secret + insecure-key-length, both intentional)  |
| `ruff check .`                                                       | **All checks passed**                                                                 |
| Live `uvicorn app.main:app` → `GET /api/openapi.json`                | **200**; body has `openapi: "3.1.0"`, `info.title: "Proxmox Self-Service GUI"`        |
| Live `uvicorn app.main:app` → `GET /api/v1/health`                   | **200** `{"status":"ok","version":"0.1.0"}`                                           |
| `grep 'fastapi==0.136.1' pyproject.toml`                             | OK                                                                                    |
| `grep 'PROXMOX_GUI_MASTER_KEY_PATH' .env.example`                    | OK                                                                                    |
| `grep 'from cryptography.fernet import Fernet' app/core/cipher.py`   | OK                                                                                    |
| `grep 'algorithms=\[ALG\]' app/core/jwt.py`                          | OK                                                                                    |
| `grep 'PRAGMA journal_mode = WAL' app/core/db.py`                    | OK                                                                                    |
| `grep 'expire_on_commit=False' app/core/db.py`                       | OK                                                                                    |
| `from app.main import app; app has /api/v1/health route`             | OK                                                                                    |
| `repr(settings)` does NOT contain live `jwt_secret`                  | OK (redacted to `***REDACTED***`)                                                     |
| `app/models/__init__.py` was NOT created                             | OK (Plan 02 owns it — respected)                                                      |

## Threat-Model Conformance

| Threat ID    | Disposition                | Implemented in this plan                                                                                                              |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T-01-01-01   | mitigate                   | `SecretCipher.from_file` checks `os.stat & 0o077 == 0` when `cookie_secure=True`; raises `RuntimeError` if loose                      |
| T-01-01-02   | mitigate                   | `decode_access_token` pins `algorithms=[ALG]` + validates issuer; alg=none token rejected (test covers this)                          |
| T-01-01-03   | accept (deferred to P-05)  | 15-min access TTL is in effect; refresh rotation is Plan 05                                                                           |
| T-01-01-04   | accept                     | OpenAPI 3.1 spec is publicly readable inside the LXC; routes still require auth (no protected routes yet — health is unauth by design)|
| T-01-01-05   | mitigate (deferred to P-05)| argon2id cost is already in effect via `pwdlib.PasswordHash.recommended()`; rate-limiting lives in Plan 05's login route               |
| T-01-01-06   | mitigate                   | `_get_cipher()` raises `RuntimeError("cipher not installed")`; lifespan installs cipher before any DB session opens (test covers this)|
| T-01-01-07   | mitigate                   | Docstring prohibition + **defense-in-depth `Settings.__repr__` redaction** (Rule-2 deviation, see above)                              |
| T-01-01-08   | mitigate                   | `async_sessionmaker(..., expire_on_commit=False)` set in `app/core/db.py`                                                             |

## User Setup Required

None — Plan 01 is pure scaffolding. Plan 04 (deployment-skeleton) will introduce the installer that writes `/etc/proxmox-gui/master.key` and the systemd units.

For local development the `.env.example` documents every required variable; copy to `.env` and leave the master-key fields empty to use the ephemeral fallback (with warnings).

## Next Phase Readiness

- **Plan 02 (db-schema)** can now create `app/models/__init__.py` that re-exports concrete model classes inheriting from `app.models.base.Base`. EncryptedSecret + cipher install path is ready for the cluster-token and refresh-token columns.
- **Plan 04 (deployment-skeleton)** can wire `uvicorn app.main:app` as a systemd unit; the entry point is module-stable.
- **Plan 05 (auth-subsystem)** can import everything from `app.core.{jwt, passwords, csrf, db}` and add its router via `create_app()`.
- **Plan 06 (clusters-tenant-bootstrap)** can replace the `PVEThinClient` placeholder with the real `PVEConnector` shape per 01-RESEARCH §Pattern 7.

No blockers carried forward.

## Self-Check: PASSED

Verified at write time:
- All 25 files claimed above exist on disk
- All three commit hashes (`5acb964`, `b32862c`, `afc1d9b`) are reachable from `master`
- All 33 tests pass; ruff clean; live uvicorn boot succeeds; OpenAPI 3.1 served

---

*Phase: 01-foundation*
*Plan: 01-backend-scaffold*
*Completed: 2026-05-14*
