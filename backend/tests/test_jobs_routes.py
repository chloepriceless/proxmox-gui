"""Phase 3 Plan 02 Task 2 — jobs API (list/get/retry) + the Tasks-drawer WS.

TDD RED: written BEFORE app/jobs/routes.py and app/jobs/ws.py exist.

Covers:
- GET /jobs is team-scoped (a job for an out-of-team is absent).
- GET /jobs/{id} → 200 in-team; 404 out-of-team (don't-leak-existence).
- POST /jobs/{id}/retry re-enqueues a FAILED idempotent job (202).
- POST /jobs/{id}/retry on a FAILED vm.clone → 409 (non-idempotent).
- POST /jobs/{id}/retry on a non-failed job → 409.
- WS /api/v1/ws/jobs without a session → closed with 1008.
- WS /api/v1/ws/jobs with a session → a backfill message scoped to the teams.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

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


async def _make_job(session_factory, *, team_id: int | None, kind: str = "vm.power",
                    state: str = "succeeded") -> int:
    from app.models import Job

    async with session_factory() as session:
        job = Job(kind=kind, state=state, team_id=team_id, payload="{}")
        session.add(job)
        await session.commit()
        return job.id


# ---------------------------------------------------------------------------
# GET /jobs — team scoping
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_jobs_is_team_scoped(client, session_factory):
    """GET /jobs returns only jobs in the caller's team set."""
    user = await make_user(session_factory, username="jobslist", is_admin=False)
    team_id = await _make_team(session_factory, team_id=60)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)
    other_team = await _make_team(session_factory, team_id=61)

    in_team_job = await _make_job(session_factory, team_id=team_id)
    out_team_job = await _make_job(session_factory, team_id=other_team)

    cookies = await login_as(client, username="jobslist", password="testpass12345")
    resp = await client.get("/api/v1/jobs", cookies=cookies)

    assert resp.status_code == 200, resp.text
    ids = {j["id"] for j in resp.json()["jobs"]}
    assert in_team_job in ids
    assert out_team_job not in ids


@pytest.mark.asyncio
async def test_get_job_in_team_200_out_of_team_404(client, session_factory):
    """GET /jobs/{id} → 200 in-team, 404 out-of-team (don't-leak-existence)."""
    user = await make_user(session_factory, username="jobsget", is_admin=False)
    team_id = await _make_team(session_factory, team_id=62)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)
    other_team = await _make_team(session_factory, team_id=63)

    in_team_job = await _make_job(session_factory, team_id=team_id)
    out_team_job = await _make_job(session_factory, team_id=other_team)

    cookies = await login_as(client, username="jobsget", password="testpass12345")

    r_in = await client.get(f"/api/v1/jobs/{in_team_job}", cookies=cookies)
    assert r_in.status_code == 200, r_in.text
    assert r_in.json()["id"] == in_team_job

    r_out = await client.get(f"/api/v1/jobs/{out_team_job}", cookies=cookies)
    assert r_out.status_code == 404


# ---------------------------------------------------------------------------
# POST /jobs/{id}/retry
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_retry_failed_idempotent_job_reenqueues(client, session_factory):
    """POST /jobs/{id}/retry on a FAILED vm.power job → 202 + reuses identity."""
    from app.models import Job

    user = await make_user(session_factory, username="jobsretry", is_admin=False)
    team_id = await _make_team(session_factory, team_id=64)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    job_id = await _make_job(
        session_factory, team_id=team_id, kind="vm.power", state="failed"
    )

    cookies = await login_as(client, username="jobsretry", password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    resp = await client.post(
        f"/api/v1/jobs/{job_id}/retry", cookies=cookies, headers={"X-CSRF-Token": csrf}
    )

    assert resp.status_code == 202, resp.text
    async with session_factory() as db:
        rows = (await db.execute(select(Job))).scalars().all()
    # The same job row identity is reused — no second visible row.
    assert len(rows) == 1
    assert rows[0].id == job_id
    assert rows[0].state == "pending"


@pytest.mark.asyncio
async def test_retry_non_idempotent_clone_rejected_409(client, session_factory):
    """POST /jobs/{id}/retry on a FAILED vm.clone → 409 (non-idempotent, D-16)."""
    user = await make_user(session_factory, username="jobsclone", is_admin=False)
    team_id = await _make_team(session_factory, team_id=65)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    job_id = await _make_job(
        session_factory, team_id=team_id, kind="vm.clone", state="failed"
    )

    cookies = await login_as(client, username="jobsclone", password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    resp = await client.post(
        f"/api/v1/jobs/{job_id}/retry", cookies=cookies, headers={"X-CSRF-Token": csrf}
    )
    assert resp.status_code == 409, resp.text


@pytest.mark.asyncio
async def test_retry_non_failed_job_rejected_409(client, session_factory):
    """POST /jobs/{id}/retry on a job not in state failed → 409."""
    user = await make_user(session_factory, username="jobsrunning", is_admin=False)
    team_id = await _make_team(session_factory, team_id=66)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    job_id = await _make_job(
        session_factory, team_id=team_id, kind="vm.power", state="running"
    )

    cookies = await login_as(client, username="jobsrunning", password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    resp = await client.post(
        f"/api/v1/jobs/{job_id}/retry", cookies=cookies, headers={"X-CSRF-Token": csrf}
    )
    assert resp.status_code == 409, resp.text


@pytest.mark.asyncio
async def test_retry_delete_kind_rejected_409(client, session_factory):
    """vm.delete is destructive — retry rejected 409 (D-16)."""
    user = await make_user(session_factory, username="jobsdelretry", is_admin=False)
    team_id = await _make_team(session_factory, team_id=67)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    job_id = await _make_job(
        session_factory, team_id=team_id, kind="vm.delete", state="failed"
    )

    cookies = await login_as(client, username="jobsdelretry", password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    resp = await client.post(
        f"/api/v1/jobs/{job_id}/retry", cookies=cookies, headers={"X-CSRF-Token": csrf}
    )
    assert resp.status_code == 409, resp.text


# ---------------------------------------------------------------------------
# WebSocket /api/v1/ws/jobs
# ---------------------------------------------------------------------------


def test_ws_jobs_unauthenticated_closed_1008(session_factory):
    """A WS connect with no valid session is closed with code 1008."""
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    from app.core.db import get_db
    from app.main import create_app

    app = create_app()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as tc:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with tc.websocket_connect("/api/v1/ws/jobs") as ws:
                ws.receive_text()
        assert exc_info.value.code == 1008


@pytest.mark.asyncio
async def test_ws_jobs_authenticated_receives_backfill(client, session_factory):
    """A WS connect WITH a valid session receives a team-scoped backfill message."""
    import anyio
    from starlette.testclient import TestClient

    from app.core.db import get_db
    from app.main import create_app

    user = await make_user(session_factory, username="jobsws", is_admin=False)
    team_id = await _make_team(session_factory, team_id=68)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)
    await _make_job(session_factory, team_id=team_id, kind="vm.power", state="running")

    cookies = await login_as(client, username="jobsws", password="testpass12345")

    app = create_app()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    def _run_ws_test() -> dict:
        with TestClient(app, cookies=cookies) as tc:
            with tc.websocket_connect("/api/v1/ws/jobs") as ws:
                return ws.receive_json()

    msg = await anyio.to_thread.run_sync(_run_ws_test)
    assert msg["type"] == "backfill"
    assert isinstance(msg["jobs"], list)
    # The seeded running job in the user's team is in the backfill.
    assert any(j["team_id"] == team_id for j in msg["jobs"])
