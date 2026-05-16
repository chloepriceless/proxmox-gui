"""Pytest fixtures for the Proxmox-GUI backend test suite.

Patterned after ``.planning/phases/01-foundation/01-RESEARCH.md §Conftest``.

Plan 01 Task 1 ships the scaffold; Task 2 fills in the core primitives
(``app.core.cipher``, ``app.models._types_init``, ``app.models.base``, ``app.main``).
The conftest is import-guarded so Task 1's ``pytest --collect-only`` can succeed
even before Task 2 has landed those modules. After Task 2 the guards become
no-ops and full fixtures are available.

Plan 02 (db-schema) lands the SQLAlchemy models — until then
``Base.metadata.create_all`` creates an empty schema, which is fine for the
crypto/JWT/password unit tests.
"""

from __future__ import annotations

import os
import warnings

# Tests run without a master.key file. Disable cookie_secure so the SecretCipher
# permission-check is skipped in lifespan startup (see app.core.cipher).
os.environ.setdefault("PROXMOX_GUI_COOKIE_SECURE", "false")
# Use an in-memory DB for tests by default. Individual tests may override.
os.environ.setdefault("PROXMOX_GUI_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
# Silence the ephemeral-secret warning emitted by Settings on import — tests
# don't need a real signing key.
warnings.filterwarnings("ignore", message=".*ephemeral.*", category=UserWarning)

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402

try:
    from app.core.cipher import SecretCipher
    from app.models._types_init import install_cipher

    _CORE_AVAILABLE = True
except ImportError:
    # Task 2 has not yet landed app.core.cipher / app.models._types_init.
    # Allow ``pytest --collect-only`` to succeed during Task 1 bootstrap.
    SecretCipher = None  # type: ignore[assignment,misc]
    install_cipher = None  # type: ignore[assignment]
    _CORE_AVAILABLE = False


@pytest.fixture(autouse=True)
def install_test_cipher():
    """Install a deterministic test cipher so EncryptedSecret columns work in tests."""
    if not _CORE_AVAILABLE:
        yield
        return
    cipher = SecretCipher(b"\x00" * 32)
    install_cipher(cipher)
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limit_buckets():
    """Clear the in-memory rate-limit state between tests.

    The limiter (``app.auth.rate_limit._buckets``) is module-level on purpose
    (single-process design for v1). Without this reset, every login in every
    test contributes to the same dict, which trips the 10/60s gate by the
    time the SSH-key + PAT suites run — false-positive 429s mask real bugs.
    """
    try:
        from app.auth import rate_limit
    except ImportError:
        yield
        return
    rate_limit._buckets.clear()
    yield
    rate_limit._buckets.clear()


@pytest.fixture(autouse=True)
def _reset_vmid_reservations():
    """Clear the in-process VMID reservation state between tests.

    ``app.lifecycle.clone._reserved`` is a module-level per-cluster reserved
    set (single-process design — Pitfall 1). The in-memory test DB resets per
    test, so ``cluster.id`` autoincrement restarts at 1 every test — without
    this reset, a VMID reserved by one test still appears live to the next
    test on the same cluster_id, shifting the allocated id (a false-positive
    assertion failure, never a real bug). The harness owns isolation, not the
    production module.
    """
    try:
        from app.lifecycle import clone
    except ImportError:
        yield
        return
    clone._reserved.clear()
    clone._cluster_locks.clear()
    yield
    clone._reserved.clear()
    clone._cluster_locks.clear()


@pytest_asyncio.fixture
async def engine():
    """Per-test in-memory SQLite engine with full schema created."""
    from sqlalchemy.ext.asyncio import create_async_engine

    from app.models.base import Base

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    from sqlalchemy.ext.asyncio import async_sessionmaker

    return async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def app(session_factory):
    """FastAPI app with the DB dependency rewired to the per-test session factory."""
    from app.core.db import get_db
    from app.main import create_app

    a = create_app()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    a.dependency_overrides[get_db] = override_get_db
    return a


class FakeArqPool:
    """Records ``enqueue_job`` calls without touching Redis.

    The API process holds an arq pool on ``app.state.arq_pool`` (populated by
    the lifespan). Tests don't run the lifespan, so lifecycle-route tests set
    ``app.state.arq_pool`` to one of these via the ``app`` fixture below.
    """

    def __init__(self) -> None:
        self.enqueued: list[tuple] = []

    async def enqueue_job(self, *args, **kwargs):  # noqa: ANN002, ANN003
        self.enqueued.append((args, kwargs))
        return None

    async def publish(self, channel, payload):  # noqa: ANN001
        return None


@pytest_asyncio.fixture
async def client(app):
    from httpx import ASGITransport, AsyncClient

    # Lifecycle routes require an arq pool on app.state; the lifespan doesn't
    # run under ASGITransport so wire a recording fake (Redis-free).
    if getattr(app.state, "arq_pool", None) is None:
        app.state.arq_pool = FakeArqPool()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
