"""TDD RED: Tests for PUT /clusters/{id}/vms/{vmid}/tags (inventory tags write path).

Written BEFORE routes.py exists — expected to fail until inventory routes are wired.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import (
    CLUSTER_RESOURCES_VM,
    VM_CONFIG,
    VM_STATUS_RUNNING,
    FakeProxmox,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_cluster_and_token(session_factory, *, team_id: int = 42, poolid: str = "gui-team-42"):
    """Seed Cluster + Team + TeamClusterToken + TeamMembership for a seeded user.

    Returns (cluster_id, team_id, poolid).
    """
    from app.models import Cluster, Team, TeamClusterToken

    async with session_factory() as session:
        team = Team(id=team_id, name=f"gui-team-{team_id}", personal=False, is_active=True)
        session.add(team)
        await session.flush()

        cluster = Cluster(
            name="test-cluster",
            host="pve-tags.test",
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


def _make_fake_for_vm100(extra_responses=None):
    """Build a FakeProxmox pre-wired for vmid=100 on node pve-01."""
    responses = {
        "nodes.pve-01.qemu.100.status.current.get": VM_STATUS_RUNNING,
        "nodes.pve-01.qemu.100.config.get": VM_CONFIG,
        "nodes.pve-01.qemu.100.config.put": None,
    }
    if extra_responses:
        responses.update(extra_responses)
    fake = FakeProxmox(responses=responses)
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", [])  # lxc call
    return fake


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_tags_writes_to_pve_and_audits(client, session_factory, app):
    """PUT /clusters/1/vms/100/tags succeeds, writes PVE tags joined ';', creates audit row."""
    from sqlalchemy import select

    from app.models import AuditLog

    user = await make_user(session_factory, username="tagsuser", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=42)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_vm100()

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="tagsuser", password="testpass12345")
        csrf = cookies.get("csrf_token", "")

        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/tags",
            json={"tags": ["prod", "web"]},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 200, resp.text

    # Check PVE config.put was called with sorted/joined tags
    put_calls = [c for c in fake.calls if "config.put" in c[0]]
    assert len(put_calls) >= 1
    put_kwargs = put_calls[0][2]
    assert put_kwargs.get("tags") == "prod;web"

    # Check audit row was created
    async with session_factory() as db:
        rows = (await db.execute(
            select(AuditLog).where(AuditLog.action == "vm.tag.update", AuditLog.result == "success")
        )).scalars().all()
    assert len(rows) >= 1


@pytest.mark.asyncio
async def test_put_tags_invalid_regex_returns_422_no_audit(client, session_factory):
    """Invalid tag format returns 422 without writing an audit row."""
    from sqlalchemy import select

    from app.models import AuditLog

    user = await make_user(session_factory, username="tagsbad", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=43)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_vm100()

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="tagsbad", password="testpass12345")
        csrf = cookies.get("csrf_token", "")

        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/tags",
            json={"tags": ["Prod!", "@@@"]},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 422

    async with session_factory() as db:
        rows = (await db.execute(select(AuditLog))).scalars().all()
    assert len(rows) == 0


@pytest.mark.asyncio
async def test_put_tags_pve_unreachable_returns_502_and_audits_failure(client, session_factory):
    """When PVE throws PVEUnreachable, PUT returns 502 and writes a failure audit row with scrubbed error."""
    from sqlalchemy import select

    from app.models import AuditLog

    user = await make_user(session_factory, username="tagsunreach", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=44)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.status.current.get": VM_STATUS_RUNNING,
        "nodes.pve-01.qemu.100.config.get": VM_CONFIG,
    })
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", [])
    # config.put raises PVEUnreachable (via ConnectionError which breaker maps)
    fake.queue_error("nodes.pve-01.qemu.100.config.put", ConnectionError("PVEAPIToken=root@pam!gui=secret forced error"))

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="tagsunreach", password="testpass12345")
        csrf = cookies.get("csrf_token", "")

        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/tags",
            json={"tags": ["prod"]},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 502

    async with session_factory() as db:
        rows = (await db.execute(
            select(AuditLog).where(AuditLog.action == "vm.tag.update", AuditLog.result == "failure")
        )).scalars().all()
    assert len(rows) >= 1
    # Token must be scrubbed from error field
    audit_row = rows[0]
    if audit_row.error:
        assert "PVEAPIToken=" not in audit_row.error
        assert "token_value=" not in audit_row.error.lower()


@pytest.mark.asyncio
async def test_put_tags_csrf_required(client, session_factory):
    """Session-auth PUT without X-CSRF-Token returns 403."""
    user = await make_user(session_factory, username="tagscsrf", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=45)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_vm100()

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="tagscsrf", password="testpass12345")

        # No X-CSRF-Token header
        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/tags",
            json={"tags": ["prod"]},
            cookies=cookies,
        )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_put_tags_pat_auth_bypasses_csrf(client, session_factory, app):
    """Bearer PAT auth bypasses CSRF check; PUT succeeds and audit row has actor_user_id set."""
    from sqlalchemy import select

    from app.models import AuditLog

    user = await make_user(session_factory, username="tagspat", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=46)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    # Mint a PAT via the API
    cookies = await login_as(client, username="tagspat", password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    mint_resp = await client.post(
        "/api/v1/me/tokens/",
        json={"name": "test-pat"},
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
    )
    assert mint_resp.status_code == 201, mint_resp.text
    pat_plaintext = mint_resp.json()["plaintext"]

    fake = _make_fake_for_vm100()

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/tags",
            json={"tags": ["prod"]},
            headers={"Authorization": f"Bearer {pat_plaintext}"},
            # No cookies, no CSRF header
        )

    assert resp.status_code == 200, resp.text

    async with session_factory() as db:
        rows = (await db.execute(
            select(AuditLog).where(AuditLog.action == "vm.tag.update", AuditLog.result == "success")
        )).scalars().all()
    assert len(rows) >= 1
    assert rows[0].actor_user_id == user.id


@pytest.mark.asyncio
async def test_put_tags_cross_tenant_returns_403(client, session_factory):
    """Non-member user PUT to a VM in another team's pool returns 403."""
    # User 1: owns team-42 with the VM
    user_owner = await make_user(session_factory, username="owner42", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=42)
    await _add_user_to_team(session_factory, user_id=user_owner.id, team_id=team_id)

    # User 2: has no membership on this cluster (create but don't bind to any team token)
    await make_user(session_factory, username="other99", is_admin=False)

    fake = _make_fake_for_vm100()

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="other99", password="testpass12345")
        csrf = cookies.get("csrf_token", "")

        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/tags",
            json={"tags": ["prod"]},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_put_tags_invalidates_cache(client, session_factory):
    """After a PUT tags, the next list call hits PVE fresh (cache invalidated)."""
    user = await make_user(session_factory, username="tagscache", is_admin=False)
    cluster_id, team_id, poolid = await _seed_cluster_and_token(session_factory, team_id=47)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.status.current.get": VM_STATUS_RUNNING,
        "nodes.pve-01.qemu.100.config.get": VM_CONFIG,
        "nodes.pve-01.qemu.100.config.put": None,
    })
    # Pre-load queue for list before PUT (vm + lxc)
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", [])
    # After PUT cache is invalidated — next list call must hit PVE again
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", [])

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="tagscache", password="testpass12345")
        csrf = cookies.get("csrf_token", "")

        # First: list to populate cache
        await client.get(
            f"/api/v1/clusters/{cluster_id}/inventory",
            cookies=cookies,
        )
        calls_before = len([c for c in fake.calls if "cluster.resources.get" in c[0]])

        # PUT tags (invalidates cache)
        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/tags",
            json={"tags": ["new-tag"]},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200, resp.text

        # Second: list after PUT — should call PVE again (cache was invalidated)
        await client.get(
            f"/api/v1/clusters/{cluster_id}/inventory",
            cookies=cookies,
        )
        calls_after = len([c for c in fake.calls if "cluster.resources.get" in c[0]])

    # Before: 2 (vm+lxc for list). After PUT + re-list: at least 2 more
    assert calls_after > calls_before + 1
