"""Phase 3 Plan 04 Task 3 — clone / template-convert / migrate lifecycle.

TDD: written BEFORE app/lifecycle/{clone,migrate,clone_migrate_routes}.py and
the clone/migrate job functions are wired — expected to fail (RED) until Task 3
lands.

Covers:
- POST .../clone → 202 kind="vm.clone" after quota admission passes.
- clone with no new_vmid allocates one via cluster_nextid + reservation.
- clone → 409 when quota admission rejects it.
- POST .../convert-template on a qemu VM → 202 kind="vm.template"; on an LXC
  → 422 (RESEARCH A7).
- POST .../migrate → 202 kind="vm.migrate"; the payload bwlimit is KiB/s.
- migrate pre-flight rejects a non-quorate cluster (409).
- migrate pre-flight rejects a node-local cicustom snippet (409).

Proxmox is exercised through ``FakeProxmox`` (proxmoxer 2.3 is sync).
"""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from sqlalchemy import select

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import CLUSTER_RESOURCES_VM, FakeProxmox

_CLONE_UPID = "UPID:pve-01:0001:000A:65000000:qmclone:100:gui-team-50@pve:"
_TEMPLATE_UPID = "UPID:pve-01:0002:000B:65000000:qmtemplate:100:gui-team-50@pve:"
_MIGRATE_UPID = "UPID:pve-01:0003:000C:65000000:qmigrate:100:gui-team-50@pve:"

# A quorate cluster status payload.
_CLUSTER_STATUS_QUORATE = [
    {"type": "cluster", "quorate": 1, "name": "pve-cluster"},
    {"type": "node", "name": "pve-01", "online": 1},
    {"type": "node", "name": "pve-02", "online": 1},
]
_CLUSTER_STATUS_NO_QUORUM = [
    {"type": "cluster", "quorate": 0, "name": "pve-cluster"},
    {"type": "node", "name": "pve-01", "online": 1},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_cluster_and_token(
    session_factory, *, team_id: int, poolid: str = "gui-team-42",
    host: str = "pve-cm.test",
):
    """Seed Cluster + Team + TeamClusterToken; return (cluster_id, team_id, poolid)."""
    from app.models import Cluster, Team, TeamClusterToken

    async with session_factory() as session:
        team = Team(id=team_id, name=f"gui-team-{team_id}", personal=False,
                    is_active=True)
        session.add(team)
        await session.flush()

        cluster = Cluster(
            name=f"cluster-{team_id}", host=host, port=8006, verify_ssl=False,
            token_user="root@pam", token_name="gui",
            api_token_secret="bootstrap-secret", is_active=True,
        )
        session.add(cluster)
        await session.flush()

        token = TeamClusterToken(
            team_id=team.id, cluster_id=cluster.id,
            userid=f"gui-team-{team_id}@pve", tokenid="api",
            token_secret=f"team-{team_id}-secret", poolid=poolid,
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


async def _set_team_quota(session_factory, *, team_id, cluster_id, vm_count):
    """Insert a tight team quota row so admission can be exercised."""
    from app.models import Quota

    async with session_factory() as session:
        session.add(Quota(team_id=team_id, cluster_id=cluster_id,
                           vm_count=vm_count))
        await session.commit()


def _make_fake_for_clone_migrate(*, cluster_status=None, vm_config=None):
    """A FakeProxmox pre-wired for clone/template/migrate dispatch on vmid 100."""
    fake = FakeProxmox(
        responses={
            "nodes.pve-01.qemu.100.clone.post": {"data": _CLONE_UPID},
            "nodes.pve-01.qemu.100.template.post": {"data": _TEMPLATE_UPID},
            "nodes.pve-01.qemu.100.migrate.post": {"data": _MIGRATE_UPID},
            "cluster.nextid.get": 150,
            "cluster.status.get": cluster_status or _CLUSTER_STATUS_QUORATE,
            "nodes.pve-01.qemu.100.config.get": vm_config or {"cores": 4},
            "nodes.pve-01.storage.get": [
                {"storage": "local", "type": "dir", "shared": 0},
                {"storage": "cephfs", "type": "cephfs", "shared": 1},
            ],
        }
    )
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    return fake


# ===========================================================================
# Clone
# ===========================================================================


@pytest.mark.asyncio
async def test_clone_returns_202(client, session_factory):
    """POST .../clone → 202 kind="vm.clone" after quota admission passes."""
    from app.models import Job

    user = await make_user(session_factory, username="cloner", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=50,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_clone_migrate()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="cloner", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/clone",
            json={"name": "c1", "full": True, "target_node": "pve-02",
                  "target_storage": "local", "new_vmid": 160},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    assert resp.json()["kind"] == "vm.clone"

    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.clone")
        )).scalars().all()
    assert len(rows) == 1
    assert json.loads(rows[0].payload)["newid"] == 160


@pytest.mark.asyncio
async def test_clone_allocates_vmid_when_absent(client, session_factory):
    """Clone with no new_vmid allocates one via cluster_nextid + reservation."""
    from app.models import Job

    user = await make_user(session_factory, username="cloneauto", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=51,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_clone_migrate()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="cloneauto",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/clone",
            json={"name": "c2", "full": False, "target_node": "pve-02"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.clone")
        )).scalars().all()
    # cluster_nextid → 150 was allocated.
    assert json.loads(rows[0].payload)["newid"] == 150


@pytest.mark.asyncio
async def test_reserve_vmid_no_collision_on_concurrent_alloc():
    """Two concurrent reserve_vmid calls never return the same id (Pitfall 1)."""
    import asyncio

    from app.lifecycle.clone import reserve_vmid

    class _Conn:
        async def cluster_nextid(self):
            # PVE's nextid is not atomic — return the SAME id to both callers.
            return 200

    conn = _Conn()
    a, b = await asyncio.gather(
        reserve_vmid(cluster_id=999, connector=conn),
        reserve_vmid(cluster_id=999, connector=conn),
    )
    assert a != b, "concurrent reservations must not collide"


@pytest.mark.asyncio
async def test_clone_rejected_when_quota_exceeded(client, session_factory):
    """Clone → 409 when the quota admission check rejects it."""
    user = await make_user(session_factory, username="clonequota", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=52,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)
    # The fixture cluster has 2 VMs in the pool; a vm_count quota of 2 leaves
    # zero headroom — a clone (requested_count=1) would exceed it.
    await _set_team_quota(session_factory, team_id=team_id,
                          cluster_id=cluster_id, vm_count=2)

    fake = _make_fake_for_clone_migrate()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="clonequota",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/clone",
            json={"name": "c3", "full": True, "target_node": "pve-02",
                  "new_vmid": 170},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 409, resp.text


# ===========================================================================
# Template conversion
# ===========================================================================


@pytest.mark.asyncio
async def test_convert_template_qemu_returns_202(client, session_factory):
    """POST .../convert-template on a qemu VM → 202 kind="vm.template"."""
    from app.models import Job

    user = await make_user(session_factory, username="tmpl", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=53,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_clone_migrate()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="tmpl", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/convert-template",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    assert resp.json()["kind"] == "vm.template"
    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.template")
        )).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_convert_template_lxc_rejected_422(client, session_factory):
    """POST .../convert-template on an LXC → 422 (RESEARCH A7)."""
    from tests.fixtures.pve_responses import CLUSTER_RESOURCES_LXC

    user = await make_user(session_factory, username="tmpllxc", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=54,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = FakeProxmox(responses={})
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_LXC)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="tmpllxc",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/lxcs/200/convert-template",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 422, resp.text
    assert "container" in resp.text.lower()


# ===========================================================================
# Migrate
# ===========================================================================


@pytest.mark.asyncio
async def test_migrate_returns_202_and_converts_bwlimit(client, session_factory):
    """POST .../migrate → 202 kind="vm.migrate"; payload bwlimit is KiB/s."""
    from app.models import Job

    user = await make_user(session_factory, username="migr", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=55,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_clone_migrate()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="migr", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/migrate",
            json={"target_node": "pve-02", "online": True, "bwlimit_mbps": 50},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    assert resp.json()["kind"] == "vm.migrate"
    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.migrate")
        )).scalars().all()
    # 50 MB/s → 50 * 1024 KiB/s.
    assert json.loads(rows[0].payload)["bwlimit"] == 50 * 1024


@pytest.mark.asyncio
async def test_migrate_rejected_on_non_quorate_cluster(client, session_factory):
    """A migrate pre-flight on a non-quorate cluster → 409."""
    user = await make_user(session_factory, username="migrq", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=56,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_clone_migrate(cluster_status=_CLUSTER_STATUS_NO_QUORUM)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="migrq", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/migrate",
            json={"target_node": "pve-02", "online": True},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 409, resp.text
    assert "quorum" in resp.text.lower()


@pytest.mark.asyncio
async def test_migrate_rejected_on_node_local_snippet(client, session_factory):
    """A migrate pre-flight on a VM with a node-local cicustom snippet → 409."""
    user = await make_user(session_factory, username="migrs", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=57,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    # cicustom references "local" — which the fixture lists with shared=0.
    fake = _make_fake_for_clone_migrate(
        vm_config={"cores": 4, "cicustom": "user=local:snippets/user.yml"},
    )
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="migrs", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/migrate",
            json={"target_node": "pve-02", "online": True},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 409, resp.text
