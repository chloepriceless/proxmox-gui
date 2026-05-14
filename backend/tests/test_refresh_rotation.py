"""Refresh-rotation + replay-detection tests.

Per 01-05-auth-subsystem-PLAN.md Task 1 behaviours:

- POST /api/v1/auth/refresh with valid refresh cookie rotates the token:
  new access + new refresh; old row revoked + replaced_by_id → new row.
- Replaying the OLD refresh cookie after rotation → 401 AND every row in
  the chain is revoked (cascade-revoke for "session compromised").
- Refresh with an expired refresh row → 401.
- Refresh with no refresh cookie → 401.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import RefreshToken
from tests.factories import login_as, make_user


@pytest.mark.asyncio
async def test_refresh_rotates_and_marks_old_row_replaced(
    client, session_factory
):
    user = await make_user(session_factory, username="rot1")
    cookies = await login_as(client, username="rot1", password="testpass12345")

    response = await client.post(
        "/api/v1/auth/refresh", cookies=cookies
    )
    assert response.status_code == 200, response.text

    # Two rows should exist for this user: old revoked + replaced_by_id set;
    # new row active.
    async with session_factory() as session:
        rows = (
            await session.execute(
                select(RefreshToken).where(RefreshToken.user_id == user.id)
                .order_by(RefreshToken.id)
            )
        ).scalars().all()
        assert len(rows) == 2
        old, new = rows
        assert old.revoked_at is not None
        assert old.replaced_by_id == new.id
        assert new.revoked_at is None
        assert new.replaced_by_id is None


@pytest.mark.asyncio
async def test_refresh_replay_detection_revokes_entire_chain(
    client, session_factory
):
    """Re-using a rotated refresh token = compromised session → revoke chain."""
    user = await make_user(session_factory, username="replay1")
    initial_cookies = await login_as(
        client, username="replay1", password="testpass12345"
    )

    # First refresh: rotates token1 → token2.
    r1 = await client.post("/api/v1/auth/refresh", cookies=initial_cookies)
    assert r1.status_code == 200
    # token2 is now in r1 cookies; capture token1's value for replay.
    token1 = initial_cookies["refresh_token"]
    # Sanity: the cookies after r1 contain a *different* refresh_token.
    token2 = r1.cookies["refresh_token"]
    assert token1 != token2

    # Now replay token1: server must detect chain-replay and revoke EVERY
    # refresh row for the user.
    replay = await client.post(
        "/api/v1/auth/refresh",
        cookies={"refresh_token": token1},
    )
    assert replay.status_code == 401
    assert "compromised" in replay.json()["detail"].lower()

    # All rows for the user should now be revoked.
    async with session_factory() as session:
        rows = (
            await session.execute(
                select(RefreshToken).where(RefreshToken.user_id == user.id)
            )
        ).scalars().all()
        assert len(rows) >= 2
        assert all(r.revoked_at is not None for r in rows)

    # Subsequent attempt with token2 also fails — entire chain dead.
    third = await client.post(
        "/api/v1/auth/refresh",
        cookies={"refresh_token": token2},
    )
    assert third.status_code == 401


@pytest.mark.asyncio
async def test_refresh_with_expired_row_returns_401(client, session_factory):
    user = await make_user(session_factory, username="exp1")
    cookies = await login_as(client, username="exp1", password="testpass12345")

    # Backdate the row's expires_at.
    async with session_factory() as session:
        row = (
            await session.execute(
                select(RefreshToken).where(RefreshToken.user_id == user.id)
            )
        ).scalar_one()
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()

    response = await client.post("/api/v1/auth/refresh", cookies=cookies)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_without_cookie_returns_401(client):
    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401
