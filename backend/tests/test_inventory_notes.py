"""TDD RED: Tests for PUT /clusters/{id}/vms/{vmid}/notes (inventory notes write path).

Written BEFORE routes.py exists — expected to fail until inventory routes are wired.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import (
    CLUSTER_RESOURCES_VM,
    FakeProxmox,
    VM_CONFIG,
    VM_STATUS_RUNNING,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_cluster_and_token(session_factory, *, team_id: int = 52, poolid: str = "gui-team-42"):
    from app.models import Cluster, Team, TeamClusterToken

    async with session_factory() as session:
        team = Team(id=team_id, name=f"gui-team-{team_id}", personal=False, is_active=True)
        session.add(team)
        await session.flush()

        cluster = Cluster(
            name="notes-cluster",
            host="pve-notes.test",
            port=8006,
            verify_ssl=False,
            token_user="root@pam",
            token_name="gui",
            api_token_secret="bootstrap-secret",
            is_active=True,
        )
        session.add(cluster)
        await session.flush()

        token = TeamClusterToken(
            team_id=team.id,
            cluster_id=cluster.id,
            userid=f"gui-team-{team_id}@pve",
            tokenid="api",
            token_secret=f"team-{team_id}-secret",
            poolid=poolid,
        )
        session.add(token)
        await session.commit()
        await session.refresh(cluster)
        return cluster.id, team.id, poolid


async def _add_user_to_team(session_factory, *, user_id: int, team_id: int):
    from app.models import TeamMembership

    async with session_factory() as session:
        session.add(TeamMembership(team_id=team_id, user_id=user_id))
        await session.commit()


def _make_notes_fake():
    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.status.current.get": VM_STATUS_RUNNING,
        "nodes.pve-01.qemu.100.config.get": VM_CONFIG,
        "nodes.pve-01.qemu.100.config.put": None,
    })
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", [])
    return fake


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_notes_writes_description_and_audits(client, session_factory, app):
    """PUT /clusters/1/vms/100/notes writes description to PVE and creates audit row."""
    from sqlalchemy import select

    from app.models import AuditLog

    user = await make_user(session_factory, username="notesuser", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=52)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_notes_fake()
    notes_text = "# Hello\nWorld"

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="notesuser", password="testpass12345")
        csrf = cookies.get("csrf_token", "")

        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/notes",
            json={"notes": notes_text},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 200, resp.text

    # Check PVE config.put was called with description
    put_calls = [c for c in fake.calls if "config.put" in c[0]]
    assert len(put_calls) >= 1
    put_kwargs = put_calls[0][2]
    assert put_kwargs.get("description") == notes_text

    # Check audit row
    async with session_factory() as db:
        rows = (await db.execute(
            select(AuditLog).where(AuditLog.action == "vm.notes.update", AuditLog.result == "success")
        )).scalars().all()
    assert len(rows) >= 1
    import json
    after = json.loads(rows[0].payload_after)
    assert after.get("description") == notes_text


@pytest.mark.asyncio
async def test_put_notes_8001_chars_returns_422(client, session_factory):
    """Notes longer than 8000 characters returns 422."""
    user = await make_user(session_factory, username="noteslong", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=53)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_notes_fake()

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="noteslong", password="testpass12345")
        csrf = cookies.get("csrf_token", "")

        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/notes",
            json={"notes": "x" * 8001},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_notes_pve_failure_audits_then_502(client, session_factory):
    """When PVE config.put raises, PUT returns 502 and writes failure audit with scrubbed error."""
    from sqlalchemy import select

    from app.models import AuditLog

    user = await make_user(session_factory, username="notesfail", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=54)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.status.current.get": VM_STATUS_RUNNING,
        "nodes.pve-01.qemu.100.config.get": VM_CONFIG,
    })
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", [])
    fake.queue_error(
        "nodes.pve-01.qemu.100.config.put",
        ConnectionError("PVEAPIToken=root@pam!gui=secret connection refused"),
    )

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="notesfail", password="testpass12345")
        csrf = cookies.get("csrf_token", "")

        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/notes",
            json={"notes": "some notes"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 502

    async with session_factory() as db:
        rows = (await db.execute(
            select(AuditLog).where(AuditLog.action == "vm.notes.update", AuditLog.result == "failure")
        )).scalars().all()
    assert len(rows) >= 1
    audit_row = rows[0]
    if audit_row.error:
        assert "PVEAPIToken=" not in audit_row.error


@pytest.mark.asyncio
async def test_put_notes_csrf_required(client, session_factory):
    """Session-auth PUT notes without X-CSRF-Token returns 403."""
    user = await make_user(session_factory, username="notescsrf", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=55)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_notes_fake()

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="notescsrf", password="testpass12345")

        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/notes",
            json={"notes": "hello"},
            cookies=cookies,
            # No X-CSRF-Token
        )

    assert resp.status_code == 403
