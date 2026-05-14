---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/pyproject.toml
  - backend/app/__init__.py
  - backend/app/main.py
  - backend/app/config.py
  - backend/app/core/__init__.py
  - backend/app/core/cipher.py
  - backend/app/core/jwt.py
  - backend/app/core/passwords.py
  - backend/app/core/csrf.py
  - backend/app/core/db.py
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
  - backend/.env.example
  - backend/ruff.toml
  - backend/mypy.ini
autonomous: true
requirements:
  - API-01
  - API-03
user_setup: []
tags:
  - backend
  - scaffold
  - fastapi
  - sqlalchemy
must_haves:
  truths:
    - "FastAPI app boots via `uvicorn app.main:app` and serves /api/openapi.json"
    - "OpenAPI 3.1 spec exposed at /api/openapi.json, Swagger UI at /api/docs, ReDoc at /api/redoc"
    - "SecretCipher round-trips a string through Fernet using a 32-byte master key"
    - "Argon2id password hash + verify works via pwdlib"
    - "JWT issuance + decode round-trips a payload with HS256 + 15-min exp"
    - "pytest suite (test_cipher.py, test_jwt.py, test_passwords.py) is green"
  artifacts:
    - path: "backend/pyproject.toml"
      provides: "Project metadata, pinned dependencies"
      contains: "fastapi==0.136.1"
    - path: "backend/app/main.py"
      provides: "FastAPI app factory + lifespan"
      exports: ["create_app", "app"]
    - path: "backend/app/core/cipher.py"
      provides: "Fernet wrapper SecretCipher"
      exports: ["SecretCipher"]
    - path: "backend/app/core/jwt.py"
      provides: "Access + refresh JWT helpers"
      exports: ["issue_access_token", "decode_access_token"]
    - path: "backend/app/core/passwords.py"
      provides: "Argon2id hash + verify"
      exports: ["hash_password", "verify_password"]
    - path: "backend/app/core/csrf.py"
      provides: "Double-submit CSRF helpers"
      exports: ["mint_csrf_token", "verify_csrf"]
    - path: "backend/app/core/db.py"
      provides: "Async engine, sessionmaker, get_db dependency"
      exports: ["engine", "async_session", "get_db", "run_migrations"]
    - path: "backend/app/config.py"
      provides: "pydantic-settings Settings"
      exports: ["Settings", "settings"]
  key_links:
    - from: "backend/app/main.py"
      to: "backend/app/core/db.py"
      via: "lifespan calls run_migrations() and engine.dispose()"
      pattern: "run_migrations|engine\\.dispose"
    - from: "backend/app/main.py"
      to: "backend/app/core/cipher.py"
      via: "lifespan loads SecretCipher.from_file(settings.master_key_path) and install_cipher()"
      pattern: "SecretCipher.from_file"
    - from: "backend/app/models/_types.py"
      to: "backend/app/models/_types_init.py"
      via: "EncryptedSecret TypeDecorator reads cipher via _get_cipher() module-level accessor"
      pattern: "_get_cipher|install_cipher"
---

<objective>
Stand up the FastAPI backend skeleton with every foundational primitive subsequent plans will compose: app factory + lifespan, pydantic-settings config, async SQLAlchemy engine + session DI, Fernet-wrapped SecretCipher, argon2id password helpers, PyJWT access-token helpers, CSRF double-submit helpers, the `EncryptedSecret` TypeDecorator scaffold, the `proxmoxer` thin-wrapper module shape, and the pytest+ASGI test harness.

Purpose: Every later Phase 1 plan (auth, clusters, teams, users, setup) imports from `app.core/*` and `app.models/*`. Getting these primitives right once means every subsequent plan is straight composition — no foundational rework.

Output: A green `pytest` run on cipher/jwt/passwords; a FastAPI app that boots and serves `/api/openapi.json`, `/api/docs`, `/api/redoc`, and `/api/v1/health` (the only route in this plan).
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-RESEARCH.md
@.planning/research/STACK.md
@.planning/research/ARCHITECTURE.md
@.planning/research/PITFALLS.md
@CLAUDE.md

<interfaces>
<!-- These contracts will be consumed by Plans 02, 05, 06, 07. They are the foundation. -->

From backend/app/config.py (this plan creates):
```python
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PROXMOX_GUI_", env_file=".env", extra="ignore")
    master_key_path: Path = Path("/etc/proxmox-gui/master.key")
    database_url: str = "sqlite+aiosqlite:///./app.db"
    jwt_secret_file: Path | None = None
    jwt_secret: str = ""   # populated in __post_init__ from jwt_secret_file or env
    pat_pepper: str = ""   # same pattern
    sql_echo: bool = False
    cookie_secure: bool = True       # set False only for local dev / tests
    cookie_samesite: str = "lax"
    access_token_ttl_seconds: int = 15 * 60
    refresh_token_ttl_seconds: int = 7 * 24 * 3600
    csrf_cookie_name: str = "csrf_token"
    log_level: str = "INFO"

settings = Settings()  # module-level singleton; tests can monkeypatch
```

From backend/app/core/cipher.py:
```python
class SecretCipher:
    @classmethod
    def from_file(cls, path: Path) -> "SecretCipher": ...
    def __init__(self, key_bytes: bytes): ...   # raises ValueError if len != 32
    def encrypt(self, plaintext: str) -> bytes: ...
    def decrypt(self, ciphertext: bytes) -> str: ...
```

From backend/app/core/jwt.py:
```python
ALG = "HS256"
def issue_access_token(user_id: int, *, is_admin: bool) -> str: ...
def decode_access_token(token: str) -> dict: ...  # raises jwt.PyJWTError on bad token
```

From backend/app/core/passwords.py:
```python
def hash_password(plaintext: str) -> str: ...   # argon2id, pwdlib defaults
def verify_password(plaintext: str, hash: str) -> bool: ...
DUMMY_HASH: str   # precomputed dummy hash for constant-time login attempts
```

From backend/app/core/csrf.py:
```python
def mint_csrf_token() -> str: ...   # secrets.token_urlsafe(32)
def verify_csrf(cookie_value: str | None, header_value: str | None) -> bool: ...
```

From backend/app/core/db.py:
```python
engine: AsyncEngine
async_session: async_sessionmaker[AsyncSession]
async def get_db() -> AsyncIterator[AsyncSession]: ...
async def run_migrations() -> None: ...
```

From backend/app/models/_types.py + _types_init.py:
```python
class EncryptedSecret(TypeDecorator): ...   # uses _get_cipher() at bind/result time
def install_cipher(cipher: SecretCipher) -> None: ...   # called by lifespan
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Project + dependency bootstrap (pyproject.toml, ruff, mypy, .env.example, test harness)</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (§Installation, §Pattern 2, §Conftest)
    - /home/dev/vm-deployment-gui/CLAUDE.md (technology stack pins)
  </read_first>
  <files>
    backend/pyproject.toml,
    backend/ruff.toml,
    backend/mypy.ini,
    backend/.env.example,
    backend/app/__init__.py,
    backend/app/config.py,
    backend/tests/__init__.py,
    backend/tests/conftest.py
  </files>
  <behavior>
    - Test 1: `pytest --collect-only` succeeds (zero collection errors).
    - Test 2: `from app.config import settings` works and yields a `Settings` instance with `master_key_path` defaulting to `/etc/proxmox-gui/master.key`.
    - Test 3: Setting env `PROXMOX_GUI_DATABASE_URL=sqlite+aiosqlite:///:memory:` overrides `settings.database_url`.
  </behavior>
  <action>
    Create `backend/pyproject.toml` with project metadata `name="proxmox-gui"`, `version="0.1.0"`, `requires-python=">=3.12"`, and exact dependency pins from 01-RESEARCH.md §Installation: fastapi==0.136.1, uvicorn[standard]==0.46.0, proxmoxer==2.3.0, requests==2.32.3, sqlalchemy[asyncio]==2.0.49, aiosqlite==0.22.1, alembic==1.18.4, pwdlib[argon2]==0.3.0, argon2-cffi==25.1.0, pyjwt==2.12.1, cryptography==45.0.7, pydantic==2.13.4, pydantic-settings==2.14.1, structlog==25.5.0, python-multipart==0.0.20, httpx==0.28.1. Use `[dependency-groups] dev = ["ruff==0.15.12", "mypy", "pytest", "pytest-asyncio==1.3.0", "respx"]`. Configure `[tool.pytest.ini_options] asyncio_mode = "auto"`, `testpaths = ["tests"]`, `pythonpath = ["."]`.

    Create `backend/ruff.toml` with line-length=100, target-version="py312", select=["E", "F", "I", "B", "UP", "ASYNC"], ignore=["E501"].

    Create `backend/mypy.ini` with python_version=3.12, plugins=pydantic.mypy, strict_optional=True, ignore_missing_imports=True (third-party shim).

    Create `backend/.env.example` listing every `PROXMOX_GUI_*` env var with a comment explaining each (master key path, DB URL, JWT secret file, PAT pepper, cookie_secure=false for dev).

    Create `backend/app/config.py` implementing the `Settings` class shown in <interfaces>. Use `pydantic_settings.BaseSettings` with `env_prefix="PROXMOX_GUI_"`. Add a `@model_validator(mode="after")` that, if `jwt_secret` is empty AND `jwt_secret_file` is set AND readable, reads the file and populates `jwt_secret`; same for `pat_pepper`/`pat_pepper_file`. If both are empty after this, the validator generates ephemeral values via `secrets.token_urlsafe(48)` and emits a `warnings.warn(...)` (acceptable for dev/test; the installer always writes the files in prod). Export `settings = Settings()` at module level.

    Create `backend/app/__init__.py` (empty).

    Create `backend/tests/__init__.py` (empty).

    Create `backend/tests/conftest.py` copying the conftest shape from 01-RESEARCH.md §Conftest for async tests. Use `pytest_asyncio` fixtures; build an in-memory SQLite engine; install a test `SecretCipher(b"\x00" * 32)`; expose `engine`, `session_factory`, `app`, `client` fixtures. Do NOT import models yet — leave `Base.metadata.create_all` for Plan 02 to wire (use `from app.models.base import Base` and tolerate ImportError with a TODO comment that Plan 02 lands the models). For now Phase 1 Task 1 only needs the cipher install + a placeholder `app` fixture that imports `create_app` from `app.main` (which Task 2 below creates).
  </action>
  <verify>
    <automated>cd backend && python -c "from app.config import settings; assert settings.master_key_path.name == 'master.key'; print('OK')" && python -m pytest --collect-only 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/pyproject.toml` exists; `grep -q 'fastapi==0.136.1' backend/pyproject.toml`
    - File `backend/.env.example` exists; `grep -q 'PROXMOX_GUI_MASTER_KEY_PATH' backend/.env.example`
    - `cd backend && python -c "from app.config import settings; print(settings.database_url)"` exits 0
    - `cd backend && python -m pytest --collect-only` exits 0
  </acceptance_criteria>
  <done>Project metadata + dependencies declared, Settings importable, pytest can collect (no test failures yet).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Core primitives — SecretCipher, JWT, passwords, CSRF, db engine, EncryptedSecret type, app factory + lifespan</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (§Pattern 1, §Pattern 2, §Pattern 3, §Pattern 5, §Pitfall A2, §Pitfall A6)
    - /home/dev/vm-deployment-gui/.planning/research/PITFALLS.md (Pitfall 22 self-backup)
    - /home/dev/vm-deployment-gui/backend/app/config.py (created in Task 1)
  </read_first>
  <files>
    backend/app/core/__init__.py,
    backend/app/core/cipher.py,
    backend/app/core/jwt.py,
    backend/app/core/passwords.py,
    backend/app/core/csrf.py,
    backend/app/core/db.py,
    backend/app/models/base.py,
    backend/app/models/_types.py,
    backend/app/models/_types_init.py,
    backend/app/proxmox/__init__.py,
    backend/app/proxmox/client.py,
    backend/app/main.py,
    backend/tests/test_cipher.py,
    backend/tests/test_jwt.py,
    backend/tests/test_passwords.py
  </files>
  <behavior>
    - Test (test_cipher): SecretCipher.from_file rejects a key file of wrong length; encrypt/decrypt round-trip preserves the string; install_cipher + EncryptedSecret round-trip a string through a SQLAlchemy column.
    - Test (test_jwt): issue_access_token then decode_access_token returns the same `sub`, `adm`, `iss="proxmox-gui"`; expired tokens (constructed manually via `freezegun` or by patching `datetime.now`) raise `jwt.ExpiredSignatureError`.
    - Test (test_passwords): hash_password then verify_password is True for the matching plaintext, False otherwise; constant-time verify with DUMMY_HASH does not raise.
    - Test (boot): `httpx.AsyncClient(transport=ASGITransport(app=app))` GET /api/openapi.json returns 200 with `openapi == "3.1.0"`; GET /api/v1/health returns `{"status": "ok"}`.
  </behavior>
  <action>
    **cipher.py:** Implement `SecretCipher` exactly as 01-RESEARCH.md §Pattern 3 — `from_file(Path) -> SecretCipher` (reads 32 bytes, base64-encodes to derive Fernet key, raises ValueError on wrong length), `encrypt(str) -> bytes`, `decrypt(bytes) -> str`. Per Pitfall A6: when reading the key file, `os.stat(path).st_mode & 0o077 == 0` MUST hold, else raise `RuntimeError("master.key must not be readable by group/other")`. In test/dev mode (settings.cookie_secure=False) skip the perm check — gate behind `if settings.cookie_secure:`.

    **jwt.py:** `issue_access_token(user_id, *, is_admin) -> str` and `decode_access_token(token) -> dict` per 01-RESEARCH.md §Pattern 5. HS256 with `settings.jwt_secret`. Include `sub` (str), `adm` (bool), `iat`, `exp`, `jti` (uuid4), `iss="proxmox-gui"`. `decode_access_token` uses `options={"require": ["exp", "sub", "iat"]}` and `algorithms=[ALG]` (Pitfall A8: only HS256, no `none`).

    **passwords.py:** Use `pwdlib.PasswordHash.recommended()` (argon2id under `[argon2]` extra) — instantiate once as module-level `_hasher`. Expose `hash_password(plaintext) -> str` and `verify_password(plaintext, hash) -> bool`. Precompute `DUMMY_HASH = _hasher.hash("dummy-for-constant-time-comparisons")` at module import (used by login to defeat user enumeration timing).

    **csrf.py:** `mint_csrf_token() -> str = secrets.token_urlsafe(32)` and `verify_csrf(cookie_value, header_value) -> bool` — returns False if either is None/empty or `secrets.compare_digest(cookie, header)` is False.

    **db.py:** Per 01-RESEARCH.md §Pattern 2 + SQLite PRAGMA listener. `create_async_engine(settings.database_url, future=True, pool_pre_ping=True, connect_args={"check_same_thread": False})`. `async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)`. `async def get_db()` yields session, commits on success, rolls back on exception. `async def run_migrations()` runs `alembic upgrade head` programmatically via `alembic.config.Config` pointing at `backend/alembic.ini` and `alembic.command.upgrade(cfg, "head")` (wrap in `asyncio.to_thread` because alembic is sync) — tolerate `FileNotFoundError` if alembic.ini doesn't exist yet (Plan 02 creates it; this plan only ships the function). Add the `@event.listens_for(engine.sync_engine, "connect")` listener emitting `PRAGMA journal_mode=WAL`, `PRAGMA synchronous=NORMAL`, `PRAGMA foreign_keys=ON`, `PRAGMA busy_timeout=5000`.

    **models/base.py:** `from sqlalchemy.orm import DeclarativeBase` ; `class Base(DeclarativeBase): pass`. Add a `TimestampMixin` with `created_at`, `updated_at` `Mapped[datetime]` columns using `server_default=text("CURRENT_TIMESTAMP")`. Export `Base` and `TimestampMixin` from this module. NOTE: `backend/app/models/__init__.py` is OWNED by Plan 02 (it populates the package with model imports). This plan creates `base.py`, `_types.py`, `_types_init.py` only — Plan 01's app code imports directly from `app.models.base` (not from `app.models` package root). When Plan 02 runs, it creates the `__init__.py` that re-exports everything.

    **models/_types_init.py:** Module-level `_cipher: SecretCipher | None = None`; `def install_cipher(c): global _cipher; _cipher = c`; `def _get_cipher() -> SecretCipher: if _cipher is None: raise RuntimeError("cipher not installed"); return _cipher`. Export both.

    **models/_types.py:** `class EncryptedSecret(TypeDecorator)` with `impl = LargeBinary`, `cache_ok = True`, `process_bind_param(value, dialect)` returns None if value is None else `_get_cipher().encrypt(value)`; `process_result_value(value, dialect)` returns None if value is None else `_get_cipher().decrypt(value)`.

    **proxmox/client.py:** Stub `class PVEThinClient` with docstring "Phase 1 placeholder. Plan 06 implements PVEConnector against this shape." and a `NotImplementedError`-raising `__init__`. The file exists so later plans can import without ImportError.

    **main.py:** Implement `create_app()` + `lifespan` exactly per 01-RESEARCH.md §Pattern 1. In lifespan: (1) load `SecretCipher.from_file(settings.master_key_path)` if file exists, else use ephemeral `SecretCipher(secrets.token_bytes(32))` with a `warnings.warn(...)` (dev mode); (2) call `install_cipher(cipher)`; (3) `await run_migrations()`; (4) yield; (5) `await engine.dispose()`. FastAPI config: `title="Proxmox Self-Service GUI"`, `version="0.1.0"`, `openapi_url="/api/openapi.json"`, `docs_url="/api/docs"`, `redoc_url="/api/redoc"`. Add ONE route in this plan: `@app.get("/api/v1/health", tags=["health"])` returning `{"status": "ok", "version": "0.1.0"}`. Add a TrustedHostMiddleware comment (not active in dev). Export module-level `app = create_app()`.

    **Tests:**
    - `test_cipher.py`: round-trip test, wrong-length raises ValueError, install_cipher + EncryptedSecret bound to a tiny `Base`-derived model writes/reads via in-memory SQLite.
    - `test_jwt.py`: issue + decode preserves payload; decode of malformed token raises `jwt.InvalidTokenError`; expired token raises `jwt.ExpiredSignatureError` (use `freezegun` if convenient or just craft a token with `exp=0`).
    - `test_passwords.py`: round-trip, mismatch returns False, hashing the same password twice yields different outputs (Argon2id salt randomness).
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_cipher.py tests/test_jwt.py tests/test_passwords.py -x -q && python -c "from app.main import app; print(app.title)"</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend && python -m pytest tests/test_cipher.py tests/test_jwt.py tests/test_passwords.py -x` exits 0
    - `grep -q 'from cryptography.fernet import Fernet' backend/app/core/cipher.py`
    - `grep -q 'algorithms=\[ALG\]' backend/app/core/jwt.py` (Pitfall A8 + algorithm-confusion mitigation)
    - `grep -q 'PRAGMA journal_mode = WAL' backend/app/core/db.py`
    - `grep -q 'expire_on_commit=False' backend/app/core/db.py` (Pitfall A2)
    - `grep -q 'render_as_batch' backend/app/core/db.py || true` (NOT required here; Plan 02 puts it in env.py)
    - `cd backend && python -c "from app.main import app; assert any(r.path == '/api/v1/health' for r in app.routes); print('OK')"` exits 0
    - `cd backend && python -c "import httpx; from httpx import ASGITransport, AsyncClient; import asyncio; from app.main import app; async def t(): async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as c: r = await c.get('/api/openapi.json'); assert r.status_code == 200 and r.json()['openapi'] == '3.1.0'; asyncio.run(t()); print('OK')"` exits 0
  </acceptance_criteria>
  <done>All seven core primitives exist with passing tests; FastAPI boots; OpenAPI 3.1 spec served; /api/v1/health responds 200.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Filesystem → process | `master.key` (Pitfall A6); JWT signing key file; PAT pepper file |
| Untrusted module import → cipher access | `_get_cipher()` global accessor; misuse = decrypting with wrong key in tests |
| OpenAPI publication | `/api/openapi.json` exposes route shapes to anyone who can reach the API |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01-01 | Information disclosure | `master.key` permissions | mitigate | `SecretCipher.from_file` enforces `os.stat(path).st_mode & 0o077 == 0` (Pitfall A6); installer (Plan 04) sets `chmod 0400 root:proxmox-gui` |
| T-01-01-02 | Tampering | JWT algorithm confusion | mitigate | `decode_access_token` pins `algorithms=[ALG]` (HS256 only) — never `["HS256", "none"]`; rejects `alg=none` (Pitfall A8) |
| T-01-01-03 | Repudiation | JWT replay | accept (for now) | Access JWT is 15-min TTL (D-10). Refresh rotation + replay detection lands in Plan 05 (`replaced_by_id` chain) |
| T-01-01-04 | Information disclosure | OpenAPI exposes admin routes | accept | `/api/openapi.json` is publicly readable from inside the LXC's reverse-proxy; routes themselves still require auth. Spec is not a secret. Audit-level info exposure documented. |
| T-01-01-05 | Denial of service | argon2id CPU exhaustion (login flood) | mitigate (deferred) | `pwdlib` recommended params are deliberately CPU-bound; rate-limiting lives in Plan 05's login route, not here |
| T-01-01-06 | Tampering | EncryptedSecret bind without cipher installed | mitigate | `_get_cipher()` raises `RuntimeError("cipher not installed")`; lifespan calls `install_cipher` before any DB session can open |
| T-01-01-07 | Information disclosure | structlog logging of secrets | mitigate | Settings never logs `jwt_secret` / `pat_pepper`; pydantic `SecretStr` is NOT used here intentionally so that `settings.jwt_secret` is plain str — but any structlog `add_log_level` config is explicitly forbidden from binding `settings` itself. Document in module docstring. |
| T-01-01-08 | Tampering | aiosqlite same-thread crash on commit-then-access | mitigate | `expire_on_commit=False` per Pitfall A2 |

**ASVS L1 mappings (cryptography + session foundation):**
- V2.4 (password storage) → argon2id via pwdlib recommended params
- V3.2 (session token generation) → HS256 + 256-bit `jwt_secret` (Settings validates length); `jti` UUID4 per token
- V6.2 (algorithms) → Fernet enforces AES-128-CBC + HMAC-SHA256
- V7.4 (error handling) → JWT decode raises specific exceptions, no stack trace in response (FastAPI default)
</threat_model>

<verification>
- `cd backend && python -m pytest -x -q` exits 0
- `cd backend && uvicorn app.main:app --port 8000 &` then `curl -s http://127.0.0.1:8000/api/openapi.json | head -c 200` shows `"openapi":"3.1.0"`
- `cd backend && ruff check .` exits 0
</verification>

<success_criteria>
Backend scaffold is in place; every later plan can `from app.core.cipher import SecretCipher`, `from app.core.jwt import issue_access_token`, `from app.core.db import get_db`, `from app.models.base import Base`, etc., without ImportError. OpenAPI 3.1 spec is being served. Tests for the three crypto primitives are green.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-01-SUMMARY.md` with:
- What was built (file list)
- Key decisions made under Claude's discretion (service-user name, ruff config, mypy strictness)
- Any deviations from research with rationale
- Test count + pass/fail
</output>
