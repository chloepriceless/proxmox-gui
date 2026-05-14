"""End-to-end route tests for ``/api/v1/teams``.

Covers the team CRUD admin surface (Plan 06 Task 2):

- POST /teams  — admin-only; rejects personal=True via API.
- GET  /teams  — list.
- GET  /teams/{id} — detail with members.
- PATCH /teams/{id} — name + is_active updates.
- DELETE /teams/{id}:
    - 409 if team_cluster_tokens rows exist (D-04 letter; the test
      ``test_delete_team_with_cluster_bindings_returns_409`` is the
      acceptance-criteria gate).
    - 422 if personal=True.
    - 204 on success.
- POST /teams/{id}/members — add a user (idempotent).
- DELETE /teams/{id}/members/{uid} — remove a user.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import func, select

from app.models import Team, TeamClusterToken, TeamMembership
from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import FakeProxmox


async def _login_admin(client, session_factory, username="admin"):
    user = await make_user(
        session_factory, username=username, password="adminpass12345",
        is_admin=True,
    )
    cookies = await login_as(client, username=username, password="adminpass12345")
    return user, cookies


# ----------------------------------------------------------------------------
# CREATE
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_team_with_personal_true_returns_422(client, session_factory):
    """Personal teams are auto-created by Plan 07 — the API forbids
    creating them via this endpoint (D-05 immutability)."""
    _, cookies = await _login_admin(client, session_factory, "admin1")
    csrf = cookies["csrf_token"]
    response = await client.post(
        "/api/v1/teams/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"name": "shouldnt-be-personal", "personal": True},
    )
    # FastAPI either rejects the unknown field via 422 or our service does.
    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_post_team_zero_clusters_succeeds(client, session_factory):
    """Without any clusters, creating a shared team just inserts the row."""
    _, cookies = await _login_admin(client, session_factory, "admin2")
    csrf = cookies["csrf_token"]
    response = await client.post(
        "/api/v1/teams/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"name": "zero-cluster-team"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "zero-cluster-team"
    assert body["personal"] is False
    assert body["is_active"] is True


@pytest.mark.asyncio
async def test_post_team_as_non_admin_returns_403(client, session_factory):
    await make_user(session_factory, username="bob_t", password="testpass12345")
    cookies = await login_as(client, username="bob_t", password="testpass12345")
    csrf = cookies["csrf_token"]
    response = await client.post(
        "/api/v1/teams/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"name": "should-be-blocked"},
    )
    assert response.status_code == 403


# ----------------------------------------------------------------------------
# LIST + GET
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_teams_returns_member_count(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "admin3")
    csrf = cookies["csrf_token"]
    # Create one shared team via API (member_count=0).
    await client.post(
        "/api/v1/teams/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"name": "list-test-team"},
    )
    response = await client.get("/api/v1/teams/", cookies=cookies)
    assert response.status_code == 200
    teams = response.json()
    # admin3 has a personal team auto-created by make_user → 2 teams total.
    assert len(teams) >= 2
    by_name = {t["name"]: t for t in teams}
    assert "list-test-team" in by_name
    assert by_name["list-test-team"]["member_count"] == 0


# ----------------------------------------------------------------------------
# DELETE — D-04 option-a: 409 if any team_cluster_tokens row exists
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_team_with_cluster_bindings_returns_409(
    client, session_factory,
):
    """Acceptance-criteria gate (WARNING 7 fix): D-04 letter.

    If any ``team_cluster_tokens`` row references the team, DELETE returns
    409 with a message about ""active cluster bindings"". Operator must
    manually unbind via Phase-2 endpoint first.
    """
    _, cookies = await _login_admin(client, session_factory, "admin4")
    csrf = cookies["csrf_token"]

    # Create a team via API (no clusters → no auto-bootstrap).
    create_resp = await client.post(
        "/api/v1/teams/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"name": "bound-team"},
    )
    assert create_resp.status_code == 201
    team_id = create_resp.json()["id"]

    # Manually insert a fake cluster + team_cluster_tokens row (avoid the
    # PVE round-trip; we're testing the delete gate, not the bootstrap).
    from app.models import Cluster
    async with session_factory() as session:
        cluster = Cluster(
            name="binding-cluster", host="some-host", port=8006,
            verify_ssl=True, token_user="root@pam", token_name="t",
            api_token_secret="x",
        )
        session.add(cluster)
        await session.flush()
        session.add(TeamClusterToken(
            team_id=team_id, cluster_id=cluster.id,
            userid=f"gui-team-{team_id}@pve", tokenid="api",
            token_secret="bound-token", poolid=f"gui-team-{team_id}",
        ))
        await session.commit()

    response = await client.delete(
        f"/api/v1/teams/{team_id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 409
    assert "active cluster bindings" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_team_without_bindings_succeeds(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "admin5")
    csrf = cookies["csrf_token"]
    create_resp = await client.post(
        "/api/v1/teams/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"name": "deletable-team"},
    )
    team_id = create_resp.json()["id"]
    response = await client.delete(
        f"/api/v1/teams/{team_id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 204, response.text

    async with session_factory() as session:
        row = await session.get(Team, team_id)
    assert row is None


@pytest.mark.asyncio
async def test_delete_personal_team_returns_422(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "admin6")
    csrf = cookies["csrf_token"]
    # The admin's personal team was created by make_user.
    async with session_factory() as session:
        result = await session.execute(
            select(Team).where(Team.personal.is_(True))
        )
        personal = result.scalars().first()
    response = await client.delete(
        f"/api/v1/teams/{personal.id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 422


# ----------------------------------------------------------------------------
# Membership add / remove
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_and_remove_team_member(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "admin7")
    csrf = cookies["csrf_token"]
    new_user = await make_user(
        session_factory, username="new_member", password="memberpass12345",
    )
    create_resp = await client.post(
        "/api/v1/teams/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"name": "membership-team"},
    )
    team_id = create_resp.json()["id"]

    # POST member.
    add_resp = await client.post(
        f"/api/v1/teams/{team_id}/members",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"user_id": new_user.id},
    )
    assert add_resp.status_code == 201, add_resp.text

    # Verify in DB.
    async with session_factory() as session:
        n = await session.scalar(
            select(func.count()).select_from(TeamMembership)
            .where(TeamMembership.team_id == team_id)
            .where(TeamMembership.user_id == new_user.id)
        )
    assert n == 1

    # POST again → idempotent (still 201 or 200, not error).
    add_resp_2 = await client.post(
        f"/api/v1/teams/{team_id}/members",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"user_id": new_user.id},
    )
    assert add_resp_2.status_code in (200, 201)

    # DELETE member.
    rm_resp = await client.delete(
        f"/api/v1/teams/{team_id}/members/{new_user.id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert rm_resp.status_code == 204
    async with session_factory() as session:
        n = await session.scalar(
            select(func.count()).select_from(TeamMembership)
            .where(TeamMembership.team_id == team_id)
            .where(TeamMembership.user_id == new_user.id)
        )
    assert n == 0


@pytest.mark.asyncio
async def test_remove_member_from_personal_team_rejected(
    client, session_factory,
):
    """Personal team membership is immutable per D-05."""
    _, cookies = await _login_admin(client, session_factory, "admin8")
    csrf = cookies["csrf_token"]
    user = await make_user(
        session_factory, username="lonely_user", password="lonelypass12345",
    )
    async with session_factory() as session:
        result = await session.execute(
            select(Team).where(Team.personal.is_(True), Team.name == f"personal-{user.id}")
        )
        personal = result.scalars().first()
    response = await client.delete(
        f"/api/v1/teams/{personal.id}/members/{user.id}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 422
