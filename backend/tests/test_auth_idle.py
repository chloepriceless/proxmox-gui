"""Task 3 (TDD): server-authoritative idle-session-timeout (AUTH-06).

Behaviours under test (05-01-PLAN Task 3):

- A refresh_tokens row whose last_active_at is older than the configured
  idle_timeout_minutes raises IdleExpired in consume_refresh; /auth/refresh
  returns 401 with detail="session_idle_expired" (distinct from a generic
  expired-token message).
- A row with last_active_at within the window refreshes normally.
- A row with last_active_at NULL is treated as active (falls back to
  created_at) — it does NOT idle-expire.
- issue_refresh stamps last_active_at = now on the new row.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import AppSetting, RefreshToken
from tests.factories import login_as, make_user


async def _seed_setting_row(session_factory, idle_minutes: int = 30) -> None:
    async with session_factory() as session:
        existing = await session.get(AppSetting, 1)
        if existing is None:
            session.add(
                AppSetting(
                    id=1,
                    idle_timeout_minutes=idle_minutes,
                    audit_retention_days=365,
                )
            )
        else:
            existing.idle_timeout_minutes = idle_minutes
        await session.commit()


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    try:
        from app.settings import service as settings_service
    except ImportError:
        yield
        return
    settings_service._cache = None
    yield
    settings_service._cache = None


@pytest.mark.asyncio
async def test_idle_session_refused_with_distinct_signal(
    client, session_factory
):
    await _seed_setting_row(session_factory, idle_minutes=30)
    user = await make_user(session_factory, username="idle1")
    cookies = await login_as(
        client, username="idle1", password="testpass12345"
    )

    # Backdate last_active_at well past the 30-minute window.
    async with session_factory() as session:
        row = (
            await session.execute(
                select(RefreshToken).where(RefreshToken.user_id == user.id)
            )
        ).scalar_one()
        row.last_active_at = datetime.now(UTC) - timedelta(hours=2)
        await session.commit()

    resp = await client.post("/api/v1/auth/refresh", cookies=cookies)
    assert resp.status_code == 401
    assert resp.json()["detail"] == "session_idle_expired"


@pytest.mark.asyncio
async def test_active_session_refreshes_normally(client, session_factory):
    await _seed_setting_row(session_factory, idle_minutes=30)
    user = await make_user(session_factory, username="idle2")
    cookies = await login_as(
        client, username="idle2", password="testpass12345"
    )

    # last_active_at well within the window.
    async with session_factory() as session:
        row = (
            await session.execute(
                select(RefreshToken).where(RefreshToken.user_id == user.id)
            )
        ).scalar_one()
        row.last_active_at = datetime.now(UTC) - timedelta(minutes=2)
        await session.commit()

    resp = await client.post("/api/v1/auth/refresh", cookies=cookies)
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_null_last_active_at_does_not_idle_expire(
    client, session_factory
):
    """A NULL last_active_at must fall back to created_at (Pitfall 3)."""
    await _seed_setting_row(session_factory, idle_minutes=30)
    user = await make_user(session_factory, username="idle3")
    cookies = await login_as(
        client, username="idle3", password="testpass12345"
    )

    # Force last_active_at NULL; created_at is fresh (just-logged-in).
    async with session_factory() as session:
        row = (
            await session.execute(
                select(RefreshToken).where(RefreshToken.user_id == user.id)
            )
        ).scalar_one()
        row.last_active_at = None
        await session.commit()

    resp = await client.post("/api/v1/auth/refresh", cookies=cookies)
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_issue_refresh_stamps_last_active_at(client, session_factory):
    """A freshly-issued refresh row carries a non-NULL last_active_at."""
    user = await make_user(session_factory, username="idle4")
    await login_as(client, username="idle4", password="testpass12345")

    async with session_factory() as session:
        row = (
            await session.execute(
                select(RefreshToken).where(RefreshToken.user_id == user.id)
            )
        ).scalar_one()
        assert row.last_active_at is not None
