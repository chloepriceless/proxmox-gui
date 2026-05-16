"""Phase 3 Plan 03 Task 1 — snapshot lifecycle service + routes + job functions.

TDD RED: written BEFORE app/lifecycle/{snapshots,snapshot_routes}.py, the
snapshot schemas, and the ``run_snapshot_*`` job functions exist — expected to
fail until Task 1 lands.

Covers:
- GET .../snapshots → 200 with a flat list; each item carries ``name`` and
  optionally ``parent`` (the client builds the tree from ``parent`` — D-05).
- POST .../snapshots → 202 with kind="vm.snapshot.create".
- POST .../snapshots/{name}/rollback → 202 with kind="vm.snapshot.rollback".
- DELETE .../snapshots/{name} → 202 with kind="vm.snapshot.delete".
- Snapshot routes on a cross-tenant VM → 403 (don't-leak-existence).
- ``run_snapshot_create`` dispatches the PVE call via the poller and audits.

Proxmox is exercised through ``FakeProxmox`` (proxmoxer 2.3 is sync).
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import select

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import CLUSTER_RESOURCES_VM, FakeProxmox

# A canned UPID for the snapshot-create action.
_SNAP_UPID = "UPID:pve-01:0001:000A:65000000:qmsnapshot:100:gui-team-60@pve:"

# The flat snapshot list PVE returns from the snapshot GET — note the synthetic
# ``current`` entry and the ``parent`` pointers used to build the tree (D-05).
_SNAPSHOT_LIST = [
    {"name": "base", "snaptime": 1700000000, "description": "first"},
    {"name": "after-update", "parent": "base", "snaptime": 1700000100,
     "description": "post patch", "vmstate": 0},
    {"name": "current", "parent": "after-update", "description": "You are here!"},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_cluster_and_token(
    session_factory, *, team_id: int, poolid: str = "gui-team-42",
    host: str = "pve-snap.test",
):
    """Seed Cluster + Team + TeamClusterToken; return (cluster_id, team_id, poolid)."""
    from app.models import Cluster, Team, TeamClusterToken

    async with session_factory() as session:
        team = Team(id=team_id, name=f"gui-team-{team_id}", personal=False, is_active=True)
        session.add(team)
        await session.flush()

        cluster = Cluster(
            name=f"cluster-{team_id}",
            host=host,
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


def _make_fake_for_snapshots():
    """A FakeProxmox pre-wired for snapshot dispatch on vmid 100 (node pve-01)."""
    fake = FakeProxmox(
        responses={
            "nodes.pve-01.qemu.100.snapshot.get": _SNAPSHOT_LIST,
            "nodes.pve-01.qemu.100.snapshot.post": {"data": _SNAP_UPID},
            "nodes.pve-01.qemu.100.snapshot.snap1.rollback.post": {"data": _SNAP_UPID},
            "nodes.pve-01.qemu.100.snapshot.snap1.delete": {"data": _SNAP_UPID},
        }
    )
    # require_resource_access calls list_resources — one /cluster/resources
    # call with type=vm returns both VMs and LXCs.
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    return fake


# ---------------------------------------------------------------------------
# Tests — snapshot routes
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_snapshots_returns_flat_parent_pointer_list(client, session_factory):
    """GET .../snapshots → 200; each item carries name + (optionally) parent."""
    user = await make_user(session_factory, username="snaplist", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=60)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_snapshots()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="snaplist", password="testpass12345")
        resp = await client.get(
            f"/api/v1/clusters/{cluster_id}/vms/100/snapshots",
            cookies=cookies,
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    snaps = body["snapshots"]
    assert isinstance(snaps, list) and len(snaps) == 3
    names = {s["name"] for s in snaps}
    assert {"base", "after-update", "current"} == names
    by_name = {s["name"]: s for s in snaps}
    assert by_name["after-update"]["parent"] == "base"
    assert by_name["base"]["parent"] is None


@pytest.mark.asyncio
async def test_snapshot_create_returns_202(client, session_factory):
    """POST .../snapshots → 202 with kind="vm.snapshot.create"; one pending row."""
    from app.models import Job

    user = await make_user(session_factory, username="snapcreate", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=61)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_snapshots()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="snapcreate", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/snapshots",
            json={"name": "snap1", "description": "d", "vmstate": False},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["kind"] == "vm.snapshot.create"
    assert isinstance(body["job_id"], int) and body["job_id"] > 0

    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.snapshot.create")
        )).scalars().all()
    assert len(rows) == 1
    assert rows[0].state == "pending"


@pytest.mark.asyncio
async def test_snapshot_rollback_returns_202(client, session_factory):
    """POST .../snapshots/{name}/rollback → 202 with kind="vm.snapshot.rollback"."""
    from app.models import Job

    user = await make_user(session_factory, username="snaprb", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=62)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_snapshots()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="snaprb", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/snapshots/snap1/rollback",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 202, resp.text
    assert resp.json()["kind"] == "vm.snapshot.rollback"
    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.snapshot.rollback")
        )).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_snapshot_delete_returns_202(client, session_factory):
    """DELETE .../snapshots/{name} → 202 with kind="vm.snapshot.delete"."""
    from app.models import Job

    user = await make_user(session_factory, username="snapdel", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=63)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_snapshots()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="snapdel", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.request(
            "DELETE",
            f"/api/v1/clusters/{cluster_id}/vms/100/snapshots/snap1",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 202, resp.text
    assert resp.json()["kind"] == "vm.snapshot.delete"
    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.snapshot.delete")
        )).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_snapshot_create_cross_tenant_returns_403(client, session_factory):
    """A snapshot POST on a VM in a team the user is not on → 403."""
    owner = await make_user(session_factory, username="snapowner", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=64)
    await _add_user_to_team(session_factory, user_id=owner.id, team_id=team_id)

    await make_user(session_factory, username="snapother", is_admin=False)

    fake = _make_fake_for_snapshots()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="snapother", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/snapshots",
            json={"name": "snap1"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_snapshot_vmstate_on_lxc_is_rejected(client, session_factory):
    """vmstate=True on an LXC snapshot → 422 (RAM state is qemu-only)."""
    from tests.fixtures.pve_responses import CLUSTER_RESOURCES_LXC

    user = await make_user(session_factory, username="snaplxc", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=65)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    # /cluster/resources?type=vm returns both VMs and LXCs in one call.
    fake = FakeProxmox(responses={})
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_LXC)

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="snaplxc", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/lxcs/200/snapshots",
            json={"name": "snap1", "vmstate": True},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# Tests — run_snapshot_create job function
# ---------------------------------------------------------------------------


class _FakeRedis:
    async def publish(self, channel, payload):  # noqa: ANN001
        return None


@pytest.mark.asyncio
async def test_run_snapshot_create_dispatches_and_audits(session_factory, engine):
    """run_snapshot_create claims the job, dispatches via the poller, audits."""
    import json

    from app.jobs.snapshot_functions import run_snapshot_create
    from app.models import AuditLog, Cluster, Job, Team, TeamClusterToken

    async with session_factory() as session:
        team = Team(id=80, name="gui-team-80", personal=False, is_active=True)
        session.add(team)
        await session.flush()
        cluster = Cluster(
            name="cluster-80", host="pve-snaprun.test", port=8006, verify_ssl=False,
            token_user="root@pam", token_name="gui", api_token_secret="bootstrap-secret",
            is_active=True,
        )
        session.add(cluster)
        await session.flush()
        session.add(TeamClusterToken(
            team_id=team.id, cluster_id=cluster.id, userid="gui-team-80@pve",
            tokenid="api", token_secret="team-80-secret", poolid="gui-team-80",
        ))
        await session.flush()
        job = Job(
            kind="vm.snapshot.create", state="pending",
            cluster_id=cluster.id, team_id=team.id, actor_user_id=None,
            payload=json.dumps({"node": "pve-01", "vmid": 100, "is_lxc": False,
                                "snapname": "snap1", "description": "d",
                                "vmstate": False}),
        )
        session.add(job)
        await session.commit()
        job_id = job.id

    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.snapshot.post": {"data": _SNAP_UPID},
        f"nodes.pve-01.tasks.{_SNAP_UPID}.status.get": {
            "data": {"status": "stopped", "exitstatus": "OK"}},
        f"nodes.pve-01.tasks.{_SNAP_UPID}.log.get": {"data": [{"n": 1, "t": "done"}]},
    })

    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.clusters.registry import PVEConnectorRegistry

    factory = async_sessionmaker(engine, expire_on_commit=False)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, factory)
        ctx = {
            "sessionmaker": factory,
            "registry": registry,
            "redis": _FakeRedis(),
            "arq_pool": _FakeRedis(),
        }
        await run_snapshot_create(ctx, job_id)

    async with factory() as db:
        refreshed = await db.get(Job, job_id)
        assert refreshed.state == "succeeded", refreshed.state
        audit_rows = (await db.execute(
            select(AuditLog).where(AuditLog.action.like("vm.snapshot%"))
        )).scalars().all()
    assert len(audit_rows) >= 1, "worker must audit the outcome"
