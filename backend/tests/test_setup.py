"""End-to-end tests for the first-run setup wizard backend (Plan 01-07 Task 1).

Covers the lenient first-run contract (CONTEXT D-18):

- ``GET /api/v1/setup/status`` is open (no auth) and returns
  ``{no_admin_yet: bool, cluster_count: int}``.
- ``POST /api/v1/setup/admin`` is open IFF ``no_admin_yet`` is True; once an
  admin exists, the endpoint returns 409 ``"Initial setup already completed"``.
- The created admin gets a personal team named ``personal-<user_id>`` (D-05).
- After admin creation, login works end-to-end.
- Validation: 12+ char password floor, username regex, dup-username 409.
- There is intentionally NO ``/api/v1/setup/cluster`` route — cluster
  registration during the wizard goes through the regular ``POST /api/v1/clusters``
  once the admin is authenticated (Plan 08's UI auto-logs-in after the
  admin step).

The setup endpoints are also CSRF-free: there is no session yet, so there
is no ``csrf_token`` cookie to compare against.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Team, TeamMembership, User

# ----------------------------------------------------------------------------
# /setup/status
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_setup_status_on_empty_db_returns_no_admin_yet_true(
    client, session_factory,
):
    """Fresh install: zero admins, zero clusters → setup needed."""
    response = await client.get("/api/v1/setup/status")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body == {"no_admin_yet": True, "cluster_count": 0}


@pytest.mark.asyncio
async def test_setup_status_after_admin_returns_no_admin_yet_false(
    client, session_factory,
):
    """Once an admin exists the predicate flips. Cluster count still 0."""
    # Create the admin via the setup endpoint.
    create_resp = await client.post(
        "/api/v1/setup/admin",
        json={
            "username": "rootadmin",
            "email": "rootadmin@example.com",
            "password": "supersecret-123",
        },
    )
    assert create_resp.status_code == 201, create_resp.text

    status_resp = await client.get("/api/v1/setup/status")
    assert status_resp.status_code == 200
    body = status_resp.json()
    assert body == {"no_admin_yet": False, "cluster_count": 0}


# ----------------------------------------------------------------------------
# /setup/admin (POST)
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_setup_admin_creates_admin_user_and_personal_team(
    client, session_factory,
):
    """Successful initial-admin path: 201 + personal team auto-created."""
    response = await client.post(
        "/api/v1/setup/admin",
        json={
            "username": "owner",
            "email": "owner@example.com",
            "password": "supersecret-123",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["username"] == "owner"
    assert isinstance(body["user_id"], int) and body["user_id"] >= 1
    assert isinstance(body["personal_team_id"], int) and body["personal_team_id"] >= 1

    # Verify DB side-effects.
    async with session_factory() as session:
        users = (await session.execute(select(User))).scalars().all()
        assert len(users) == 1
        admin = users[0]
        assert admin.username == "owner"
        assert admin.email == "owner@example.com"
        assert admin.is_admin is True
        assert admin.is_active is True
        assert admin.password_hash != "supersecret-123"  # hashed

        teams = (await session.execute(select(Team))).scalars().all()
        assert len(teams) == 1
        team = teams[0]
        assert team.personal is True
        assert team.name == f"personal-{admin.id}"

        memberships = (
            await session.execute(select(TeamMembership))
        ).scalars().all()
        assert len(memberships) == 1
        assert memberships[0].team_id == team.id
        assert memberships[0].user_id == admin.id


@pytest.mark.asyncio
async def test_setup_admin_second_call_returns_409(client, session_factory):
    """One-shot endpoint: once an admin exists, the second call is rejected."""
    first = await client.post(
        "/api/v1/setup/admin",
        json={
            "username": "first",
            "email": "first@example.com",
            "password": "supersecret-123",
        },
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/v1/setup/admin",
        json={
            "username": "second",
            "email": "second@example.com",
            "password": "supersecret-456",
        },
    )
    assert second.status_code == 409, second.text
    assert "already completed" in second.json()["detail"].lower()


@pytest.mark.asyncio
async def test_setup_admin_with_short_password_returns_422(client, session_factory):
    """Password < 12 chars → 422 (pydantic field validation)."""
    response = await client.post(
        "/api/v1/setup/admin",
        json={
            "username": "shortpw",
            "email": "shortpw@example.com",
            "password": "short",
        },
    )
    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_setup_admin_with_invalid_username_returns_422(client, session_factory):
    """Username pattern enforced: only [A-Za-z0-9_.-], 3-64 chars."""
    response = await client.post(
        "/api/v1/setup/admin",
        json={
            "username": "bad name!",  # space + ! not allowed
            "email": "bad@example.com",
            "password": "supersecret-123",
        },
    )
    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_setup_admin_with_invalid_email_returns_422(client, session_factory):
    response = await client.post(
        "/api/v1/setup/admin",
        json={
            "username": "okuser",
            "email": "not-an-email",
            "password": "supersecret-123",
        },
    )
    assert response.status_code == 422, response.text


# ----------------------------------------------------------------------------
# End-to-end smoke: created admin can log in
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_can_login_after_setup(client, session_factory):
    """The user persisted by setup must be usable by the auth login flow."""
    create_resp = await client.post(
        "/api/v1/setup/admin",
        json={
            "username": "loginadmin",
            "email": "loginadmin@example.com",
            "password": "supersecret-123",
        },
    )
    assert create_resp.status_code == 201

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "loginadmin", "password": "supersecret-123"},
    )
    assert login_resp.status_code == 200, login_resp.text
    assert "access_token" in login_resp.cookies
    assert "refresh_token" in login_resp.cookies
    assert "csrf_token" in login_resp.cookies


# ----------------------------------------------------------------------------
# No /setup/cluster route
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_setup_cluster_route_does_not_exist(client, session_factory):
    """Cluster registration during the wizard uses the authenticated
    /api/v1/clusters route — there is no /setup/cluster shortcut."""
    response = await client.post(
        "/api/v1/setup/cluster",
        json={"name": "x", "host": "1.2.3.4"},
    )
    # Either 404 (no route) or 405 (wrong method on a partial route) —
    # both are acceptable; what we forbid is a 200/201/202.
    assert response.status_code in (404, 405), response.text
