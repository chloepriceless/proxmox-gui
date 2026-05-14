"""End-to-end route tests for ``/api/v1/users`` (Plan 01-07 Task 2).

Covers the admin user CRUD surface (AUTH-07, AUTH-08):

- ``GET /api/v1/users/`` — admin-only list with team memberships.
- ``POST /api/v1/users/`` — admin-only create; auto-creates personal team
  ``personal-<user_id>`` (D-05); skips PVE bootstrap.
- ``GET /api/v1/users/{user_id}`` — admin-only detail.
- ``PATCH /api/v1/users/{user_id}`` — admin-only update; disable triggers
  session revocation; replace-semantics on team_ids.
- ``DELETE /api/v1/users/{user_id}`` — admin-only delete; cascades
  membership rows.
- ``POST /api/v1/users/{user_id}/password`` — admin-only password reset.
- ``POST/DELETE /api/v1/users/{user_id}/teams[/{team_id}]`` — admin-only
  membership add/remove (personal teams reject — D-05).

Self-guards:
- Admin cannot disable themselves (PATCH self with ``is_active=False``).
- Admin cannot remove their own admin flag (PATCH self with ``is_admin=False``).
- Admin cannot delete themselves.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Team, TeamMembership, User
from tests.factories import login_as, make_user


async def _login_admin(client, session_factory, username="adminx"):
    """Create + login an admin via the test factories.

    Note: this bypasses the setup endpoint so each test starts with a known
    admin without having to thread the setup-only-once gate through fixtures.
    """
    user = await make_user(
        session_factory, username=username, password="adminpass12345",
        is_admin=True,
    )
    cookies = await login_as(client, username=username, password="adminpass12345")
    return user, cookies


# ----------------------------------------------------------------------------
# LIST
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_users_as_admin_returns_users_with_teams(
    client, session_factory,
):
    admin, cookies = await _login_admin(client, session_factory, "adminA")
    await make_user(session_factory, username="userA", password="testpass12345")
    response = await client.get("/api/v1/users/", cookies=cookies)
    assert response.status_code == 200, response.text
    body = response.json()
    usernames = {u["username"] for u in body}
    assert {"adminA", "userA"} <= usernames
    # Each user has at least the personal team listed.
    for u in body:
        assert isinstance(u.get("teams"), list)


@pytest.mark.asyncio
async def test_list_users_as_non_admin_returns_403(
    client, session_factory,
):
    await make_user(session_factory, username="bob", password="testpass12345")
    cookies = await login_as(client, username="bob", password="testpass12345")
    response = await client.get("/api/v1/users/", cookies=cookies)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_users_unauthenticated_returns_401(client, session_factory):
    response = await client.get("/api/v1/users/")
    assert response.status_code == 401


# ----------------------------------------------------------------------------
# CREATE
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_user_creates_user_and_personal_team(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "adminB")
    csrf = cookies["csrf_token"]
    response = await client.post(
        "/api/v1/users/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={
            "username": "newbie",
            "email": "newbie@example.com",
            "password": "newbiepass1234",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["username"] == "newbie"
    assert body["is_admin"] is False
    assert body["is_active"] is True
    assert isinstance(body.get("personal_team_id"), int)

    # Verify the personal team exists with the canonical name.
    async with session_factory() as session:
        team = (
            await session.execute(
                select(Team).where(Team.id == body["personal_team_id"])
            )
        ).scalar_one()
        assert team.personal is True
        assert team.name == f"personal-{body['id']}"


@pytest.mark.asyncio
async def test_create_user_duplicate_username_returns_409(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "adminC")
    csrf = cookies["csrf_token"]
    payload = {
        "username": "dupuser",
        "email": "dup1@example.com",
        "password": "duppass123456",
    }
    r1 = await client.post(
        "/api/v1/users/", cookies=cookies,
        headers={"X-CSRF-Token": csrf}, json=payload,
    )
    assert r1.status_code == 201
    payload2 = dict(payload, email="dup2@example.com")
    r2 = await client.post(
        "/api/v1/users/", cookies=cookies,
        headers={"X-CSRF-Token": csrf}, json=payload2,
    )
    assert r2.status_code == 409, r2.text


@pytest.mark.asyncio
async def test_create_user_with_short_password_returns_422(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "adminD")
    csrf = cookies["csrf_token"]
    response = await client.post(
        "/api/v1/users/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={
            "username": "shortpw2",
            "email": "shortpw2@example.com",
            "password": "x",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_user_with_team_ids_adds_memberships(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "adminE")
    csrf = cookies["csrf_token"]

    # Create a shared team to attach to.
    shared_resp = await client.post(
        "/api/v1/teams/", cookies=cookies,
        headers={"X-CSRF-Token": csrf}, json={"name": "engineering"},
    )
    assert shared_resp.status_code == 201, shared_resp.text
    shared_id = shared_resp.json()["id"]

    # Create user with team_ids.
    response = await client.post(
        "/api/v1/users/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={
            "username": "engineerA",
            "email": "engineerA@example.com",
            "password": "engineerpass12",
            "team_ids": [shared_id],
        },
    )
    assert response.status_code == 201, response.text
    new_user_id = response.json()["id"]

    # Verify TeamMembership exists.
    async with session_factory() as session:
        memberships = (
            await session.execute(
                select(TeamMembership).where(
                    TeamMembership.user_id == new_user_id,
                    TeamMembership.team_id == shared_id,
                )
            )
        ).scalars().all()
        assert len(memberships) == 1


@pytest.mark.asyncio
async def test_create_user_with_personal_team_id_returns_422(
    client, session_factory,
):
    """team_ids cannot include personal teams (D-05)."""
    admin, cookies = await _login_admin(client, session_factory, "adminF")
    csrf = cookies["csrf_token"]
    # Find admin's personal team id.
    async with session_factory() as session:
        admin_personal = (
            await session.execute(
                select(Team).where(Team.personal.is_(True))
            )
        ).scalar_one()
    response = await client.post(
        "/api/v1/users/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={
            "username": "trickster",
            "email": "trickster@example.com",
            "password": "trickpass1234",
            "team_ids": [admin_personal.id],
        },
    )
    assert response.status_code == 422, response.text


# ----------------------------------------------------------------------------
# GET single
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_user_returns_detail(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "adminG")
    target = await make_user(
        session_factory, username="targetU", password="testpass12345",
    )
    response = await client.get(
        f"/api/v1/users/{target.id}", cookies=cookies,
    )
    assert response.status_code == 200, response.text
    assert response.json()["username"] == "targetU"


@pytest.mark.asyncio
async def test_get_user_not_found_returns_404(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "adminH")
    response = await client.get("/api/v1/users/9999", cookies=cookies)
    assert response.status_code == 404


# ----------------------------------------------------------------------------
# PATCH (update)
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_user_updates_email(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "adminI")
    csrf = cookies["csrf_token"]
    target = await make_user(
        session_factory, username="emailU", password="testpass12345",
    )
    response = await client.patch(
        f"/api/v1/users/{target.id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"email": "newemail@example.com"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["email"] == "newemail@example.com"


@pytest.mark.asyncio
async def test_patch_user_self_disable_returns_422(client, session_factory):
    """Self-guard: admin cannot disable themselves."""
    admin, cookies = await _login_admin(client, session_factory, "adminJ")
    csrf = cookies["csrf_token"]
    response = await client.patch(
        f"/api/v1/users/{admin.id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"is_active": False},
    )
    assert response.status_code == 422, response.text
    assert "yourself" in response.json()["detail"].lower() or \
           "your own" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_patch_user_self_remove_admin_returns_422(client, session_factory):
    """Self-guard: admin cannot remove their own admin flag."""
    admin, cookies = await _login_admin(client, session_factory, "adminK")
    csrf = cookies["csrf_token"]
    response = await client.patch(
        f"/api/v1/users/{admin.id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"is_admin": False},
    )
    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_patch_user_replaces_team_memberships(client, session_factory):
    """team_ids has REPLACE semantics for non-personal teams."""
    _, cookies = await _login_admin(client, session_factory, "adminL")
    csrf = cookies["csrf_token"]

    # Create two shared teams.
    t1 = (await client.post(
        "/api/v1/teams/", cookies=cookies,
        headers={"X-CSRF-Token": csrf}, json={"name": "team-alpha"},
    )).json()["id"]
    t2 = (await client.post(
        "/api/v1/teams/", cookies=cookies,
        headers={"X-CSRF-Token": csrf}, json={"name": "team-beta"},
    )).json()["id"]

    # Create user with t1 only.
    create_resp = await client.post(
        "/api/v1/users/", cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={
            "username": "membu", "email": "membu@example.com",
            "password": "membupass1234", "team_ids": [t1],
        },
    )
    user_id = create_resp.json()["id"]

    # Patch to replace with t2 only.
    response = await client.patch(
        f"/api/v1/users/{user_id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"team_ids": [t2]},
    )
    assert response.status_code == 200, response.text

    # Verify only t2 (and personal) memberships remain.
    async with session_factory() as session:
        memberships = (
            await session.execute(
                select(TeamMembership).where(TeamMembership.user_id == user_id)
            )
        ).scalars().all()
        team_ids = {m.team_id for m in memberships}
        assert t2 in team_ids
        assert t1 not in team_ids
        # Personal team membership preserved (not in the replace set).
        personal = (
            await session.execute(
                select(Team).where(
                    Team.personal.is_(True),
                    Team.id.in_(team_ids),
                )
            )
        ).scalars().all()
        assert len(personal) == 1


# ----------------------------------------------------------------------------
# DELETE
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_user_succeeds(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "adminM")
    csrf = cookies["csrf_token"]
    target = await make_user(
        session_factory, username="deleteme", password="testpass12345",
    )
    response = await client.delete(
        f"/api/v1/users/{target.id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 204
    async with session_factory() as session:
        gone = await session.get(User, target.id)
        assert gone is None


@pytest.mark.asyncio
async def test_delete_user_self_returns_422(client, session_factory):
    """Self-guard: admin cannot delete themselves."""
    admin, cookies = await _login_admin(client, session_factory, "adminN")
    csrf = cookies["csrf_token"]
    response = await client.delete(
        f"/api/v1/users/{admin.id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 422, response.text
    assert "yourself" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_user_cascades_personal_team(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "adminO")
    csrf = cookies["csrf_token"]
    create_resp = await client.post(
        "/api/v1/users/", cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={
            "username": "cascadeU", "email": "cascadeU@example.com",
            "password": "cascadepass12",
        },
    )
    new_user_id = create_resp.json()["id"]
    personal_team_id = create_resp.json()["personal_team_id"]

    response = await client.delete(
        f"/api/v1/users/{new_user_id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 204

    async with session_factory() as session:
        team_gone = await session.get(Team, personal_team_id)
        assert team_gone is None


@pytest.mark.asyncio
async def test_delete_user_is_atomic_under_midflow_failure(
    session_factory, monkeypatch,
):
    """HI-03: ``delete_user`` is a single transaction — a mid-flow failure
    leaves the session ROLLED BACK; neither the session-revocation nor the
    user-delete is persisted.

    Previously the implementation called ``revoke_user_sessions`` (which
    committed its own tx) and THEN deleted the user (committed separately).
    If the second commit raised, the user was a "half-deleted ghost" with
    sessions revoked but the row still present.

    We exercise the new single-transaction guarantee by monkey-patching
    ``db.delete`` to raise after the revocation UPDATEs have flushed, and
    asserting that:

    1. The function propagates the exception (no swallow).
    2. After the failure, the user row still exists.
    3. The refresh-token + PAT rows are NOT marked revoked (the rollback
       reverted them).
    """
    from datetime import UTC, datetime, timedelta

    from app.models import PersonalAccessToken, RefreshToken, User
    from app.users.service import delete_user

    # Seed: an admin (current actor) + a target user with one active refresh
    # token and one active PAT.
    admin = await make_user(
        session_factory, username="atomic_admin", password="adminpass12345",
        is_admin=True,
    )
    target = await make_user(
        session_factory, username="atomic_target", password="testpass12345",
    )

    async with session_factory() as s:
        s.add(
            RefreshToken(
                user_id=target.id,
                token_hash="a" * 64,
                expires_at=datetime.now(UTC) + timedelta(days=7),
            )
        )
        s.add(
            PersonalAccessToken(
                user_id=target.id,
                name="atomic-pat",
                lookup_prefix="atomicprefx0",
                token_hash="b" * 64,
            )
        )
        await s.commit()

    # Patch AsyncSession.delete to raise the first time it's called inside
    # delete_user (after the UPDATE statements have flushed). The single
    # `await db.commit()` at the bottom of delete_user is never reached.
    from sqlalchemy.ext.asyncio import AsyncSession

    original_delete = AsyncSession.delete

    async def exploding_delete(self, instance):
        raise RuntimeError("simulated mid-flow failure")

    monkeypatch.setattr(AsyncSession, "delete", exploding_delete)

    async with session_factory() as s:
        with pytest.raises(RuntimeError, match="simulated mid-flow failure"):
            await delete_user(
                s, user_id=target.id, current_admin_user_id=admin.id,
            )

    # Restore for the assertion-phase session.
    monkeypatch.setattr(AsyncSession, "delete", original_delete)

    # Assert: nothing was persisted. The user must still exist, AND the
    # refresh-token + PAT rows must still be live (revoked_at is None).
    async with session_factory() as s:
        user_row = await s.get(User, target.id)
        assert user_row is not None, (
            "delete_user persisted the user delete despite failure — "
            "the operation is NOT atomic"
        )

        refresh_rows = (
            await s.execute(
                select(RefreshToken).where(RefreshToken.user_id == target.id)
            )
        ).scalars().all()
        assert len(refresh_rows) == 1
        assert refresh_rows[0].revoked_at is None, (
            "RefreshToken.revoked_at was persisted despite mid-flow "
            "failure — revocation leaked through the rollback boundary"
        )

        pat_rows = (
            await s.execute(
                select(PersonalAccessToken).where(
                    PersonalAccessToken.user_id == target.id
                )
            )
        ).scalars().all()
        assert len(pat_rows) == 1
        assert pat_rows[0].revoked_at is None, (
            "PAT.revoked_at was persisted despite mid-flow failure — "
            "revocation leaked through the rollback boundary"
        )


# ----------------------------------------------------------------------------
# Password reset
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_set_password_succeeds_and_revokes(
    client, session_factory,
):
    """Admin sets a new password; user is forced to log in again."""
    _, admin_cookies = await _login_admin(client, session_factory, "adminP")
    csrf = admin_cookies["csrf_token"]

    target = await make_user(
        session_factory, username="targetP", password="oldpass12345",
    )
    # Target logs in.
    target_cookies = await login_as(
        client, username="targetP", password="oldpass12345",
    )

    # Admin sets a new password.
    response = await client.post(
        f"/api/v1/users/{target.id}/password",
        cookies=admin_cookies, headers={"X-CSRF-Token": csrf},
        json={"new_password": "brand-new-pass-12345"},
    )
    assert response.status_code == 200, response.text

    # Target's old refresh token should now be revoked.
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        cookies={"refresh_token": target_cookies["refresh_token"]},
    )
    assert refresh_resp.status_code == 401, refresh_resp.text

    # Login with new password works.
    new_login = await client.post(
        "/api/v1/auth/login",
        json={"username": "targetP", "password": "brand-new-pass-12345"},
    )
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_admin_set_password_short_returns_422(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "adminQ")
    csrf = cookies["csrf_token"]
    target = await make_user(
        session_factory, username="targetQ", password="oldpass12345",
    )
    response = await client.post(
        f"/api/v1/users/{target.id}/password",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"new_password": "x"},
    )
    assert response.status_code == 422


# ----------------------------------------------------------------------------
# Team membership add/remove
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_user_to_team_succeeds(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "adminR")
    csrf = cookies["csrf_token"]
    target = await make_user(
        session_factory, username="targetR", password="testpass12345",
    )
    team_id = (await client.post(
        "/api/v1/teams/", cookies=cookies,
        headers={"X-CSRF-Token": csrf}, json={"name": "team-r"},
    )).json()["id"]

    response = await client.post(
        f"/api/v1/users/{target.id}/teams",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"team_id": team_id},
    )
    assert response.status_code == 201, response.text


@pytest.mark.asyncio
async def test_remove_user_from_team_succeeds(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "adminS")
    csrf = cookies["csrf_token"]
    target = await make_user(
        session_factory, username="targetS", password="testpass12345",
    )
    team_id = (await client.post(
        "/api/v1/teams/", cookies=cookies,
        headers={"X-CSRF-Token": csrf}, json={"name": "team-s"},
    )).json()["id"]

    # Add first.
    await client.post(
        f"/api/v1/users/{target.id}/teams",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"team_id": team_id},
    )
    # Remove.
    response = await client.delete(
        f"/api/v1/users/{target.id}/teams/{team_id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_add_user_to_personal_team_returns_422(client, session_factory):
    """D-05: personal-team membership is immutable."""
    _, cookies = await _login_admin(client, session_factory, "adminT")
    csrf = cookies["csrf_token"]
    target = await make_user(
        session_factory, username="targetT", password="testpass12345",
    )
    # target's personal team
    async with session_factory() as session:
        personal = (
            await session.execute(
                select(Team).where(Team.name == f"personal-{target.id}")
            )
        ).scalar_one()

    other = await make_user(
        session_factory, username="otherT", password="testpass12345",
    )
    response = await client.post(
        f"/api/v1/users/{other.id}/teams",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"team_id": personal.id},
    )
    assert response.status_code == 422, response.text


# ----------------------------------------------------------------------------
# Admin gating
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_user_as_non_admin_returns_403(client, session_factory):
    await make_user(session_factory, username="bobx", password="testpass12345")
    cookies = await login_as(client, username="bobx", password="testpass12345")
    csrf = cookies["csrf_token"]
    response = await client.post(
        "/api/v1/users/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={
            "username": "rogue", "email": "rogue@example.com",
            "password": "roguepass1234",
        },
    )
    assert response.status_code == 403
