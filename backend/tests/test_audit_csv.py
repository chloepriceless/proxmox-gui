"""Tests for the audit CSV export (backend/app/audit/csv.py + csv_safe.py)."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth.dependencies import Principal
from app.models import AuditLog, Team, User

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def csv_engine():
    from app.models.base import Base

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def csv_session(csv_engine):
    factory = async_sessionmaker(csv_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


async def _seed_user(
    session: AsyncSession, *, user_id: int, is_admin: bool = False
) -> User:
    user = User(
        id=user_id,
        username=f"csvuser{user_id}",
        email=f"csvuser{user_id}@example.com",
        password_hash="x",
        is_admin=is_admin,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _seed_team(session: AsyncSession, *, team_id: int, name: str) -> Team:
    team = Team(id=team_id, name=name, personal=False, is_active=True)
    session.add(team)
    await session.flush()
    return team


async def _seed_log(
    session: AsyncSession,
    *,
    actor_user_id: int | None = None,
    team_id: int | None = None,
    action: str = "csv.test",
    target_id: str | None = "100",
    result: str = "success",
    error: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        team_id=team_id,
        action=action,
        target_type="vm",
        target_id=target_id,
        result=result,
        error=error,
        occurred_at=datetime.now(UTC).replace(tzinfo=None),
    )
    session.add(entry)
    await session.flush()
    return entry


def _make_principal(user: User, mode: str = "session") -> Principal:
    return Principal(user=user, mode=mode)  # type: ignore[arg-type]


async def _collect_stream(generator) -> bytes:
    """Collect all chunks from an async generator into bytes."""
    chunks = []
    async for chunk in generator:
        chunks.append(chunk)
    return b"".join(chunks)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_csv_first_bytes_are_bom(csv_session: AsyncSession) -> None:
    """UTF-8 BOM (0xEF 0xBB 0xBF) must be the first 3 bytes of the stream."""
    from app.audit.csv import audit_csv_stream
    from app.audit.schemas import AuditFilter

    admin = await _seed_user(csv_session, user_id=1, is_admin=True)
    await _seed_log(csv_session, actor_user_id=1)
    await _seed_log(csv_session, actor_user_id=1, action="vm.delete")
    await csv_session.commit()

    principal = _make_principal(admin)
    gen = audit_csv_stream(csv_session, principal=principal, filters=AuditFilter())
    body = await _collect_stream(gen)

    assert body[:3] == b"\xef\xbb\xbf", (
        f"Expected UTF-8 BOM as first 3 bytes, got {body[:3]!r}"
    )


@pytest.mark.asyncio
async def test_csv_header_row_present(csv_session: AsyncSession) -> None:
    """Header row with expected column names is present after the BOM."""
    from app.audit.csv import audit_csv_stream
    from app.audit.schemas import AuditFilter

    admin = await _seed_user(csv_session, user_id=1, is_admin=True)
    await _seed_log(csv_session, actor_user_id=1)
    await csv_session.commit()

    principal = _make_principal(admin)
    gen = audit_csv_stream(csv_session, principal=principal, filters=AuditFilter())
    body = await _collect_stream(gen)

    # Decode (skip BOM)
    text = body.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    header = next(reader)
    assert "timestamp" in header
    assert "action" in header
    assert "result" in header


@pytest.mark.asyncio
async def test_csv_injection_escaped(csv_session: AsyncSession) -> None:
    """Cells starting with = + - @ are prefixed with a single quote."""
    from app.audit.csv import audit_csv_stream
    from app.audit.schemas import AuditFilter

    admin = await _seed_user(csv_session, user_id=1, is_admin=True)
    # error cell starting with '=' (injection attempt)
    await _seed_log(
        csv_session,
        actor_user_id=1,
        action="vm.hack",
        target_id="=HYPERLINK(\"http://evil.com\",\"click me\")",
        error="=cmd|/c calc",
    )
    await csv_session.commit()

    principal = _make_principal(admin)
    gen = audit_csv_stream(csv_session, principal=principal, filters=AuditFilter())
    body = await _collect_stream(gen)

    text = body.decode("utf-8-sig")
    # Both dangerous values should be prefixed with single quote
    assert "'=HYPERLINK" in text, f"target_id injection not escaped in: {text}"
    assert "'=cmd|/c calc" in text, f"error injection not escaped in: {text}"


@pytest.mark.asyncio
async def test_csv_respects_rbac(csv_session: AsyncSession) -> None:
    """Non-admin export excludes rows belonging to other teams."""
    from app.audit.csv import audit_csv_stream
    from app.audit.schemas import AuditFilter

    me = await _seed_user(csv_session, user_id=1, is_admin=False)
    await _seed_user(csv_session, user_id=2, is_admin=False)
    await _seed_team(csv_session, team_id=10, name="my-team")
    await _seed_team(csv_session, team_id=20, name="other-team")

    # 1 row I own, 3 rows owned by others in other team
    await _seed_log(
        csv_session, actor_user_id=1, team_id=10, action="own.action"
    )
    await _seed_log(
        csv_session, actor_user_id=2, team_id=20, action="other.action.1"
    )
    await _seed_log(
        csv_session, actor_user_id=2, team_id=20, action="other.action.2"
    )
    await _seed_log(
        csv_session, actor_user_id=2, team_id=20, action="other.action.3"
    )
    await csv_session.commit()

    principal = _make_principal(me)
    gen = audit_csv_stream(csv_session, principal=principal, filters=AuditFilter())
    body = await _collect_stream(gen)

    text = body.decode("utf-8-sig")
    assert "own.action" in text
    assert "other.action.1" not in text
    assert "other.action.2" not in text
    assert "other.action.3" not in text


# ---------------------------------------------------------------------------
# csv_safe.escape_cell unit tests
# ---------------------------------------------------------------------------


def test_escape_cell_leaves_normal_values_unchanged() -> None:
    from app.audit.csv_safe import escape_cell

    assert escape_cell("normal text") == "normal text"
    assert escape_cell("") == ""
    assert escape_cell(None) == ""
    assert escape_cell(42) == "42"


def test_escape_cell_prefixes_dangerous_starts() -> None:
    from app.audit.csv_safe import escape_cell

    assert escape_cell("=SUM(A1:A10)").startswith("'")
    assert escape_cell("+1234567890").startswith("'")
    assert escape_cell("-1234567890").startswith("'")
    assert escape_cell("@SUM(A1)").startswith("'")


def test_escape_cell_strips_leading_whitespace_for_detection() -> None:
    """Leading whitespace should not mask a dangerous prefix."""
    from app.audit.csv_safe import escape_cell

    # "  =evil" — first non-whitespace char is '='
    result = escape_cell("  =evil")
    assert result.startswith("'"), f"Expected prefix quote, got: {result}"
