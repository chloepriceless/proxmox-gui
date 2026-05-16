"""Plan 04-14 Task 1 — the notifications backend (derived feed + last-seen cursor).

TDD RED: written BEFORE app/notifications/{service,routes}.py exist.

The notification bell is a *derived view* over the existing ``jobs`` table —
there is no separate notification store (D-23). It surfaces only terminal job
events (``succeeded`` / ``failed`` — D-22, completions only) for the caller's
teams, plus an ``unread_count`` derived from the per-user ``NotificationSeen``
cursor.

Covers:
- GET /notifications returns the recent terminal jobs for the caller's teams.
- In-flight jobs (pending/claimed/running) are excluded (D-22 — completions only).
- ``unread_count`` = the number of feed rows newer than the caller's cursor.
- POST /notifications/seen upserts the cursor to utcnow() → unread_count is 0.
- A user sees only their own teams' job notifications (cross-tenant isolation).
- With no NotificationSeen row yet, every feed row counts as unread.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from tests.factories import login_as, make_user

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_team(session_factory, *, team_id: int, name: str | None = None):
    from app.models import Team

    async with session_factory() as session:
        team = Team(
            id=team_id, name=name or f"team-{team_id}", personal=False, is_active=True
        )
        session.add(team)
        await session.commit()
        return team_id


async def _add_user_to_team(session_factory, *, user_id: int, team_id: int):
    from app.models import TeamMembership

    async with session_factory() as session:
        session.add(TeamMembership(team_id=team_id, user_id=user_id))
        await session.commit()


async def _make_job(
    session_factory,
    *,
    team_id: int | None,
    kind: str = "vm.create",
    state: str = "succeeded",
    created_at: datetime | None = None,
    payload: str = "{}",
) -> int:
    from app.models import Job

    async with session_factory() as session:
        job = Job(kind=kind, state=state, team_id=team_id, payload=payload)
        if created_at is not None:
            job.created_at = created_at
        session.add(job)
        await session.commit()
        return job.id


async def _set_seen_cursor(session_factory, *, user_id: int, when: datetime):
    from app.models import NotificationSeen

    async with session_factory() as session:
        session.add(NotificationSeen(user_id=user_id, last_seen_at=when))
        await session.commit()


# ---------------------------------------------------------------------------
# GET /notifications — the derived feed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_notifications_feed_returns_recent_completed_jobs(
    client, session_factory
):
    """GET /notifications returns the caller's teams' terminal jobs."""
    user = await make_user(session_factory, username="notif1", is_admin=False)
    team_id = await _make_team(session_factory, team_id=70)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    job_id = await _make_job(
        session_factory, team_id=team_id, kind="vm.create", state="succeeded"
    )

    cookies = await login_as(client, username="notif1", password="testpass12345")
    resp = await client.get("/api/v1/notifications", cookies=cookies)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    ids = {item["id"] for item in body["items"]}
    assert job_id in ids
    item = next(i for i in body["items"] if i["id"] == job_id)
    assert item["kind"] == "vm.create"
    assert item["state"] == "succeeded"
    assert "created_at" in item


@pytest.mark.asyncio
async def test_notifications_feed_excludes_in_flight_jobs(client, session_factory):
    """In-flight jobs (pending/claimed/running) are NOT in the feed (D-22)."""
    user = await make_user(session_factory, username="notif2", is_admin=False)
    team_id = await _make_team(session_factory, team_id=71)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    running = await _make_job(session_factory, team_id=team_id, state="running")
    pending = await _make_job(session_factory, team_id=team_id, state="pending")
    claimed = await _make_job(session_factory, team_id=team_id, state="claimed")
    done = await _make_job(session_factory, team_id=team_id, state="succeeded")
    failed = await _make_job(session_factory, team_id=team_id, state="failed")

    cookies = await login_as(client, username="notif2", password="testpass12345")
    resp = await client.get("/api/v1/notifications", cookies=cookies)

    assert resp.status_code == 200, resp.text
    ids = {item["id"] for item in resp.json()["items"]}
    assert done in ids
    assert failed in ids
    assert running not in ids
    assert pending not in ids
    assert claimed not in ids


@pytest.mark.asyncio
async def test_notifications_unread_count_uses_seen_cursor(client, session_factory):
    """unread_count = number of feed rows newer than NotificationSeen.last_seen_at."""
    user = await make_user(session_factory, username="notif3", is_admin=False)
    team_id = await _make_team(session_factory, team_id=72)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    now = datetime.now(UTC)
    # Cursor sits between an old job and two newer jobs.
    await _make_job(
        session_factory,
        team_id=team_id,
        state="succeeded",
        created_at=now - timedelta(hours=2),
    )
    await _set_seen_cursor(
        session_factory, user_id=user.id, when=now - timedelta(hours=1)
    )
    await _make_job(
        session_factory,
        team_id=team_id,
        state="succeeded",
        created_at=now - timedelta(minutes=30),
    )
    await _make_job(
        session_factory,
        team_id=team_id,
        state="failed",
        created_at=now - timedelta(minutes=10),
    )

    cookies = await login_as(client, username="notif3", password="testpass12345")
    resp = await client.get("/api/v1/notifications", cookies=cookies)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["unread_count"] == 2


@pytest.mark.asyncio
async def test_notifications_all_unread_when_no_seen_row(client, session_factory):
    """With no NotificationSeen row, every feed row counts as unread."""
    user = await make_user(session_factory, username="notif4", is_admin=False)
    team_id = await _make_team(session_factory, team_id=73)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    await _make_job(session_factory, team_id=team_id, state="succeeded")
    await _make_job(session_factory, team_id=team_id, state="failed")
    await _make_job(session_factory, team_id=team_id, state="succeeded")

    cookies = await login_as(client, username="notif4", password="testpass12345")
    resp = await client.get("/api/v1/notifications", cookies=cookies)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["unread_count"] == 3
    assert body["unread_count"] == len(body["items"])


@pytest.mark.asyncio
async def test_notifications_feed_is_cross_tenant_scoped(client, session_factory):
    """A user never sees another team's job completions."""
    user = await make_user(session_factory, username="notif5", is_admin=False)
    team_id = await _make_team(session_factory, team_id=74)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)
    other_team = await _make_team(session_factory, team_id=75)

    mine = await _make_job(session_factory, team_id=team_id, state="succeeded")
    theirs = await _make_job(session_factory, team_id=other_team, state="succeeded")

    cookies = await login_as(client, username="notif5", password="testpass12345")
    resp = await client.get("/api/v1/notifications", cookies=cookies)

    assert resp.status_code == 200, resp.text
    ids = {item["id"] for item in resp.json()["items"]}
    assert mine in ids
    assert theirs not in ids


# ---------------------------------------------------------------------------
# POST /notifications/seen — the cursor upsert
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mark_seen_resets_unread_count(client, session_factory):
    """POST /notifications/seen stamps the cursor to now → unread_count is 0."""
    user = await make_user(session_factory, username="notif6", is_admin=False)
    team_id = await _make_team(session_factory, team_id=76)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    await _make_job(session_factory, team_id=team_id, state="succeeded")
    await _make_job(session_factory, team_id=team_id, state="failed")

    cookies = await login_as(client, username="notif6", password="testpass12345")

    before = await client.get("/api/v1/notifications", cookies=cookies)
    assert before.json()["unread_count"] == 2

    csrf = cookies.get("csrf_token", "")
    seen = await client.post(
        "/api/v1/notifications/seen",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
    )
    assert seen.status_code in (200, 204), seen.text

    after = await client.get("/api/v1/notifications", cookies=cookies)
    assert after.json()["unread_count"] == 0


@pytest.mark.asyncio
async def test_mark_seen_upserts_existing_cursor(client, session_factory):
    """Calling /seen twice updates the same NotificationSeen row (no duplicate)."""
    from sqlalchemy import func, select

    from app.models import NotificationSeen

    user = await make_user(session_factory, username="notif7", is_admin=False)
    team_id = await _make_team(session_factory, team_id=77)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    cookies = await login_as(client, username="notif7", password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    headers = {"X-CSRF-Token": csrf}
    await client.post("/api/v1/notifications/seen", cookies=cookies, headers=headers)
    await client.post("/api/v1/notifications/seen", cookies=cookies, headers=headers)

    async with session_factory() as session:
        count = await session.scalar(
            select(func.count())
            .select_from(NotificationSeen)
            .where(NotificationSeen.user_id == user.id)
        )
    assert count == 1


@pytest.mark.asyncio
async def test_notifications_requires_auth(client):
    """An unauthenticated GET /notifications is rejected."""
    resp = await client.get("/api/v1/notifications")
    assert resp.status_code == 401
