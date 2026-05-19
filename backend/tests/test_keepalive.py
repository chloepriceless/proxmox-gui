"""Task 3 (TDD): POST /api/v1/auth/keepalive — the "Stay signed in" ping (D-04).

Behaviours under test (05-01-PLAN Task 3):

- POST /auth/keepalive with a valid refresh cookie bumps the row's
  last_active_at and returns 200, WITHOUT rotating the token (the refresh
  cookie value is unchanged — no issue_refresh).
- POST /auth/keepalive with no/invalid cookie returns 401.
- The worker imports cleanly with the three new job entry points registered.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import RefreshToken
from tests.factories import login_as, make_user


@pytest.mark.asyncio
async def test_keepalive_bumps_last_active_without_rotation(
    client, session_factory
):
    user = await make_user(session_factory, username="ka1")
    cookies = await login_as(client, username="ka1", password="testpass12345")

    # Backdate last_active_at so the bump is observable.
    async with session_factory() as session:
        row = (
            await session.execute(
                select(RefreshToken).where(RefreshToken.user_id == user.id)
            )
        ).scalar_one()
        row.last_active_at = datetime.now(UTC) - timedelta(minutes=20)
        await session.commit()
        old_row_id = row.id

    resp = await client.post("/api/v1/auth/keepalive", cookies=cookies)
    assert resp.status_code == 200, resp.text

    # The refresh cookie value must be unchanged — no rotation.
    assert "refresh_token" not in resp.cookies or (
        resp.cookies.get("refresh_token") == cookies["refresh_token"]
    )

    async with session_factory() as session:
        rows = (
            await session.execute(
                select(RefreshToken).where(RefreshToken.user_id == user.id)
            )
        ).scalars().all()
        # Still exactly one row — keepalive does NOT rotate.
        assert len(rows) == 1
        row = rows[0]
        assert row.id == old_row_id
        assert row.revoked_at is None
        # last_active_at bumped to ~now.
        la = row.last_active_at
        if la.tzinfo is None:
            la = la.replace(tzinfo=UTC)
        assert (datetime.now(UTC) - la) < timedelta(minutes=1)


@pytest.mark.asyncio
async def test_keepalive_without_cookie_returns_401(client):
    resp = await client.post("/api/v1/auth/keepalive")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_keepalive_with_invalid_cookie_returns_401(client):
    resp = await client.post(
        "/api/v1/auth/keepalive",
        cookies={"refresh_token": "not-a-real-token"},
    )
    assert resp.status_code == 401


def test_worker_imports_with_new_job_registrations() -> None:
    """worker.py imports cleanly with admin.self-update + the two new crons."""
    from app.jobs.worker import WorkerSettings

    func_names = {getattr(f, "name", None) for f in WorkerSettings.functions}
    assert "admin.self-update" in func_names

    # roll_audit_log + probe_clusters registered as cron jobs.
    cron_coros = {
        getattr(c, "coroutine", c).__name__ for c in WorkerSettings.cron_jobs
    }
    assert "roll_audit_log" in cron_coros
    assert "probe_clusters" in cron_coros
