"""Tests for the audit reader (backend/app/audit/reader.py).

Verifies RBAC predicate and filter correctness.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth.dependencies import Principal
from app.models import AuditLog, Team, TeamMembership, User


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def reader_engine():
    from app.models.base import Base

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def reader_session(reader_engine):
    factory = async_sessionmaker(reader_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


async def _seed_user(
    session: AsyncSession,
    *,
    user_id: int,
    is_admin: bool = False,
) -> User:
    user = User(
        id=user_id,
        username=f"user{user_id}",
        email=f"user{user_id}@example.com",
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


async def _seed_membership(
    session: AsyncSession, *, user_id: int, team_id: int
) -> None:
    membership = TeamMembership(user_id=user_id, team_id=team_id)
    session.add(membership)
    await session.flush()


async def _seed_log(
    session: AsyncSession,
    *,
    actor_user_id: int | None = None,
    team_id: int | None = None,
    cluster_id: int | None = None,
    action: str = "test.action",
    target_type: str | None = "vm",
    target_id: str | None = "100",
    result: str = "success",
    occurred_at: datetime | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result,
        source_ip=None,
        occurred_at=occurred_at or datetime.now(timezone.utc).replace(tzinfo=None),
    )
    session.add(entry)
    await session.flush()
    return entry


def _make_principal(user: User, mode: str = "session") -> Principal:
    from typing import Literal
    return Principal(user=user, mode=mode)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_sees_every_row(reader_session: AsyncSession) -> None:
    """Admin principal returns all rows regardless of team/actor scope."""
    from app.audit.reader import list_audit
    from app.audit.schemas import AuditFilter

    admin = await _seed_user(reader_session, user_id=1, is_admin=True)
    t1 = await _seed_team(reader_session, team_id=10, name="team-alpha")
    t2 = await _seed_team(reader_session, team_id=11, name="team-beta")
    u2 = await _seed_user(reader_session, user_id=2, is_admin=False)
    u3 = await _seed_user(reader_session, user_id=3, is_admin=False)

    # Seed 5 rows across 3 users and 2 teams
    await _seed_log(reader_session, actor_user_id=1, team_id=10)
    await _seed_log(reader_session, actor_user_id=2, team_id=10)
    await _seed_log(reader_session, actor_user_id=3, team_id=11)
    await _seed_log(reader_session, actor_user_id=None, team_id=None)  # system event
    await _seed_log(reader_session, actor_user_id=2, team_id=11)
    await reader_session.commit()

    principal = _make_principal(admin)
    rows, total = await list_audit(
        reader_session, principal=principal, filters=AuditFilter(), page=1, page_size=50
    )
    assert total == 5, f"Admin should see all 5 rows, got {total}"


@pytest.mark.asyncio
async def test_non_admin_default_sees_only_own_rows(
    reader_session: AsyncSession,
) -> None:
    """Non-admin with show_team_actions=False sees only actor_user_id == me."""
    from app.audit.reader import list_audit
    from app.audit.schemas import AuditFilter

    me = await _seed_user(reader_session, user_id=1, is_admin=False)
    other = await _seed_user(reader_session, user_id=2, is_admin=False)
    t = await _seed_team(reader_session, team_id=10, name="shared-team")
    await _seed_membership(reader_session, user_id=1, team_id=10)
    await _seed_membership(reader_session, user_id=2, team_id=10)

    # 2 mine, 2 other's (same team), 1 system event
    await _seed_log(reader_session, actor_user_id=1, team_id=10, action="vm.tag.add")
    await _seed_log(reader_session, actor_user_id=1, team_id=10, action="vm.notes.update")
    await _seed_log(reader_session, actor_user_id=2, team_id=10, action="vm.tag.add")
    await _seed_log(reader_session, actor_user_id=2, team_id=10, action="quota.update")
    await _seed_log(reader_session, actor_user_id=None, team_id=None, action="user.login")
    await reader_session.commit()

    principal = _make_principal(me)
    rows, total = await list_audit(
        reader_session,
        principal=principal,
        filters=AuditFilter(show_team_actions=False),
        page=1,
        page_size=50,
    )
    assert total == 2, f"Non-admin should see only own 2 rows, got {total}"
    assert all(r.actor_username == "user1" for r in rows)


@pytest.mark.asyncio
async def test_non_admin_with_show_team_actions_sees_team_scoped(
    reader_session: AsyncSession,
) -> None:
    """Non-admin with show_team_actions=True sees own rows + team rows."""
    from app.audit.reader import list_audit
    from app.audit.schemas import AuditFilter

    me = await _seed_user(reader_session, user_id=1, is_admin=False)
    teammate = await _seed_user(reader_session, user_id=2, is_admin=False)
    outsider = await _seed_user(reader_session, user_id=3, is_admin=False)
    t_mine = await _seed_team(reader_session, team_id=10, name="my-team")
    t_other = await _seed_team(reader_session, team_id=20, name="other-team")
    await _seed_membership(reader_session, user_id=1, team_id=10)
    await _seed_membership(reader_session, user_id=2, team_id=10)
    await _seed_membership(reader_session, user_id=3, team_id=20)

    # 1 mine in my team, 1 teammate in my team, 1 outsider in other team
    await _seed_log(reader_session, actor_user_id=1, team_id=10, action="a1")
    await _seed_log(reader_session, actor_user_id=2, team_id=10, action="a2")
    await _seed_log(reader_session, actor_user_id=3, team_id=20, action="a3")
    await reader_session.commit()

    principal = _make_principal(me)
    rows, total = await list_audit(
        reader_session,
        principal=principal,
        filters=AuditFilter(show_team_actions=True),
        page=1,
        page_size=50,
    )
    # Should see my row + teammate's row (both in team 10); outsider excluded
    assert total == 2, f"Should see 2 rows (own + teammate), got {total}"
    actions = {r.action for r in rows}
    assert "a1" in actions
    assert "a2" in actions
    assert "a3" not in actions


@pytest.mark.asyncio
async def test_filter_action_in_list(reader_session: AsyncSession) -> None:
    """action filter returns only matching action strings."""
    from app.audit.reader import list_audit
    from app.audit.schemas import AuditFilter

    admin = await _seed_user(reader_session, user_id=1, is_admin=True)
    await _seed_log(reader_session, action="vm.create", result="success")
    await _seed_log(reader_session, action="vm.delete", result="success")
    await _seed_log(reader_session, action="quota.update", result="success")
    await reader_session.commit()

    principal = _make_principal(admin)
    rows, total = await list_audit(
        reader_session,
        principal=principal,
        filters=AuditFilter(action=["vm.create", "vm.delete"]),
        page=1,
        page_size=50,
    )
    assert total == 2
    actions = {r.action for r in rows}
    assert actions == {"vm.create", "vm.delete"}


@pytest.mark.asyncio
async def test_filter_date_range(reader_session: AsyncSession) -> None:
    """from_ filter returns only rows >= that timestamp."""
    from app.audit.reader import list_audit
    from app.audit.schemas import AuditFilter

    admin = await _seed_user(reader_session, user_id=1, is_admin=True)
    now = datetime(2026, 5, 14, 12, 0, 0)
    past = datetime(2026, 5, 10, 8, 0, 0)
    future = datetime(2026, 5, 20, 0, 0, 0)

    await _seed_log(reader_session, action="old.event", occurred_at=past)
    await _seed_log(reader_session, action="now.event", occurred_at=now)
    await _seed_log(reader_session, action="future.event", occurred_at=future)
    await reader_session.commit()

    principal = _make_principal(admin)
    # Filter: from=now (inclusive)
    rows, total = await list_audit(
        reader_session,
        principal=principal,
        filters=AuditFilter(from_=now),
        page=1,
        page_size=50,
    )
    assert total == 2
    actions = {r.action for r in rows}
    assert "old.event" not in actions
    assert "now.event" in actions
    assert "future.event" in actions


@pytest.mark.asyncio
async def test_pagination_returns_total_independent_of_page(
    reader_session: AsyncSession,
) -> None:
    """total reflects ALL matching rows even when page_size limits the result."""
    from app.audit.reader import list_audit
    from app.audit.schemas import AuditFilter

    admin = await _seed_user(reader_session, user_id=1, is_admin=True)
    for i in range(25):
        await _seed_log(
            reader_session, actor_user_id=1, action=f"event.{i}", target_id=str(i)
        )
    await reader_session.commit()

    principal = _make_principal(admin)
    rows, total = await list_audit(
        reader_session,
        principal=principal,
        filters=AuditFilter(),
        page=1,
        page_size=10,
    )
    assert len(rows) == 10, f"Expected 10 rows on page 1, got {len(rows)}"
    assert total == 25, f"Expected total=25, got {total}"


@pytest.mark.asyncio
async def test_filter_vmid_and_cluster_together(reader_session: AsyncSession) -> None:
    """Filtering by vmid + cluster_id returns only matching rows (Activity tab)."""
    from app.audit.reader import list_audit
    from app.audit.schemas import AuditFilter

    admin = await _seed_user(reader_session, user_id=1, is_admin=True)
    # VM 100 on cluster 5
    await _seed_log(reader_session, action="vm.power.on", target_id="100", cluster_id=5)
    # VM 100 on cluster 6 (different cluster)
    await _seed_log(reader_session, action="vm.power.off", target_id="100", cluster_id=6)
    # VM 200 on cluster 5 (different vm)
    await _seed_log(reader_session, action="vm.create", target_id="200", cluster_id=5)
    await reader_session.commit()

    principal = _make_principal(admin)
    rows, total = await list_audit(
        reader_session,
        principal=principal,
        filters=AuditFilter(vmid=100, cluster_id=5),
        page=1,
        page_size=50,
    )
    assert total == 1
    assert rows[0].action == "vm.power.on"
