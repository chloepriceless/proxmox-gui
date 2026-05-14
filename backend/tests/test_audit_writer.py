"""Tests for the audit writer (backend/app/audit/writer.py).

Verifies the FLUSH-not-COMMIT contract and JSON serialization.
"""

from __future__ import annotations

import json

import pytest
import pytest_asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import AuditLog

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def audit_engine():
    """Fresh in-memory engine with full schema."""
    from app.models.base import Base

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def audit_session(audit_engine):
    factory = async_sessionmaker(audit_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_audit_write_flushes_not_commits(audit_engine) -> None:
    """audit_write FLUSHES (populates PK) but does NOT commit.

    Verifies:
    1. entry.id is set immediately after audit_write (flush has fired)
    2. audit_write does not contain ``await db.commit()`` -- the writer
       module must never commit; the caller owns the transaction.
    3. After the caller commits, the row is visible in a new session.

    NOTE: SQLite in-memory databases share state across aiosqlite sessions
    so we cannot verify isolation via a separate read session -- that is a
    known SQLite :memory: limitation. The canonical contract test is:
    (a) PK is set after audit_write (flush fired), and (b) the writer source
    does not contain a commit call (static assertion).
    """
    import inspect

    from app.audit.writer import audit_write

    # Static assertion: audit_write must never commit.
    # We check only the function source (not the module docstring which
    # references commit() in its explanation of the contract).
    func_source = inspect.getsource(audit_write)
    assert "await db.commit()" not in func_source, (
        "audit_write MUST NOT call db.commit() -- the caller owns the transaction"
    )

    factory = async_sessionmaker(audit_engine, expire_on_commit=False)

    async with factory() as session:
        entry = await audit_write(
            session,
            actor_user_id=None,
            team_id=None,
            cluster_id=None,
            action="test.action",
            target_type="vm",
            target_id="100",
            result="success",
            source_ip="127.0.0.1",
        )
        # PK is set after flush
        assert entry.id is not None, "audit_write must flush so .id is populated"

        # Commit (caller owns this)
        await session.commit()

    # Row is visible after caller commits
    async with factory() as verify_session:
        result = await verify_session.execute(
            sa.select(AuditLog).where(AuditLog.action == "test.action")
        )
        row = result.scalar_one_or_none()
        assert row is not None, "Row missing after caller commits"
        assert row.result == "success"


@pytest.mark.asyncio
async def test_audit_write_json_serializes_payload_before_after(audit_engine) -> None:
    """payload_before and payload_after are JSON-serialized to text."""
    from app.audit.writer import audit_write

    factory = async_sessionmaker(audit_engine, expire_on_commit=False)
    payload_b = {"old_cpu": 2, "name": "my-vm"}
    payload_a = {"new_cpu": 4, "name": "my-vm"}

    async with factory() as session:
        await audit_write(
            session,
            actor_user_id=None,
            team_id=None,
            cluster_id=None,
            action="vm.update",
            target_type="vm",
            target_id="200",
            result="success",
            source_ip=None,
            payload_before=payload_b,
            payload_after=payload_a,
        )
        await session.commit()

    async with factory() as check:
        row = (await check.execute(
            sa.select(AuditLog).where(AuditLog.action == "vm.update")
        )).scalar_one()
        assert json.loads(row.payload_before) == payload_b
        assert json.loads(row.payload_after) == payload_a


@pytest.mark.asyncio
async def test_audit_write_accepts_none_payload(audit_engine) -> None:
    """payload_before/after default to None and are stored as NULL."""
    from app.audit.writer import audit_write

    factory = async_sessionmaker(audit_engine, expire_on_commit=False)

    async with factory() as session:
        await audit_write(
            session,
            actor_user_id=1,
            team_id=None,
            cluster_id=None,
            action="user.login",
            target_type=None,
            target_id=None,
            result="success",
            source_ip="10.0.0.1",
        )
        await session.commit()

    async with factory() as check:
        row = (await check.execute(
            sa.select(AuditLog).where(AuditLog.action == "user.login")
        )).scalar_one()
        assert row.payload_before is None
        assert row.payload_after is None


@pytest.mark.asyncio
async def test_audit_write_failure_path_persists_after_commit(audit_engine) -> None:
    """Failure-path audit rows persist when the caller commits before raising.

    Documents the Plan 01-05 commit-before-raise contract (get_db rolls back
    on exception, so callers MUST commit the audit row before raising).
    """
    from app.audit.writer import audit_write

    factory = async_sessionmaker(audit_engine, expire_on_commit=False)

    async with factory() as session:
        await audit_write(
            session,
            actor_user_id=None,
            team_id=None,
            cluster_id=None,
            action="vm.delete",
            target_type="vm",
            target_id="999",
            result="failure",
            source_ip=None,
            error="permission denied",
        )
        # Caller commits BEFORE raising — this is the contract.
        await session.commit()
        # (Simulated raise would happen here, but the row is already safe.)

    async with factory() as check:
        row = (await check.execute(
            sa.select(AuditLog).where(AuditLog.action == "vm.delete")
        )).scalar_one()
        assert row.result == "failure"
        assert row.error == "permission denied"
