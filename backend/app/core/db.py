"""SQLAlchemy 2.0 async engine, sessionmaker, and ``get_db`` dependency.

``expire_on_commit=False`` is mandatory (Pitfall A2): otherwise post-commit
attribute access on an aiosqlite-backed object triggers an implicit reload
under asyncio and crashes with "concurrent operation already in progress".

SQLite-specific PRAGMAs are emitted on every fresh connection:
- ``journal_mode = WAL`` — concurrent reader + single writer model.
- ``synchronous = NORMAL`` — fsync on commit only (durable enough for our
  workload, much faster than FULL).
- ``foreign_keys = ON`` — SQLite leaves FKs off by default. We need them.
- ``busy_timeout = 5000`` — 5-second wait on writer contention before erroring.

:func:`run_migrations` calls ``alembic upgrade head`` via the sync Alembic API
inside an executor thread. The function tolerates a missing ``alembic.ini``
because Plan 01 ships the call but Plan 02 lands the actual migrations
directory.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings

# ---------------------------------------------------------------------------
# Engine + sessionmaker
# ---------------------------------------------------------------------------

engine = create_async_engine(
    settings.database_url,
    echo=settings.sql_echo,
    future=True,
    pool_pre_ping=True,
    # SQLite + aiosqlite requires this to be False so that the connection can
    # be handed across asyncio tasks. (Each task still owns its own session.)
    connect_args={"check_same_thread": False},
)

async_session: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Pitfall A2
    autoflush=False,
)


# ---------------------------------------------------------------------------
# SQLite PRAGMA listener — runs on every fresh connection
# ---------------------------------------------------------------------------

@event.listens_for(engine.sync_engine, "connect")
def _apply_sqlite_pragmas(dbapi_conn, _connection_record) -> None:
    """Apply WAL + foreign-keys + busy-timeout PRAGMAs."""
    cur = dbapi_conn.cursor()
    try:
        # Order matters: journal_mode must be set before write activity.
        cur.execute("PRAGMA journal_mode = WAL")
        cur.execute("PRAGMA synchronous = NORMAL")
        cur.execute("PRAGMA foreign_keys = ON")
        cur.execute("PRAGMA busy_timeout = 5000")
    finally:
        cur.close()


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_db() -> AsyncIterator[AsyncSession]:
    """Yield a session; commit on clean exit, rollback on any exception."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ---------------------------------------------------------------------------
# Alembic bridge — Plan 02 lands the actual migrations
# ---------------------------------------------------------------------------

async def run_migrations() -> None:
    """Run ``alembic upgrade head`` in a worker thread.

    Tolerates a missing ``alembic.ini`` so Plan 01 can ship the call before
    Plan 02 lands the migrations directory. Any other failure propagates.

    The filesystem check and the Alembic invocation both run inside the worker
    thread (``asyncio.to_thread``) to keep the event loop free of any sync I/O
    — Pitfall A3 + ruff ASYNC240 conformance.
    """

    def _upgrade() -> None:
        from pathlib import Path

        alembic_ini = Path(__file__).resolve().parents[2] / "alembic.ini"
        if not alembic_ini.exists():
            # Plan 02 will create alembic.ini and the migrations directory.
            return

        # Imported lazily so Plan 01 tests don't fail if alembic ever has an
        # incompatible import-time side effect.
        from alembic import command
        from alembic.config import Config

        cfg = Config(str(alembic_ini))
        command.upgrade(cfg, "head")

    await asyncio.to_thread(_upgrade)
