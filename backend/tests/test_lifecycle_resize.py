"""Phase 3 Plan 03 Task 2 — resize lifecycle service + routes + run_resize.

TDD RED: written BEFORE app/lifecycle/{resize,resize_routes}.py, the resize
schemas, and the ``run_resize`` job function exist — expected to fail until
Task 2 lands.

Covers:
- GET .../resize-info → current cores/memory + disk list + hotplug booleans.
- When the ``hotplug`` config string lacks ``cpu`` → ``cpu_hotplug`` is false.
- POST .../resize {cores,memory} → 202 with kind="vm.resize".
- POST .../resize with a disk grow → 202.
- POST .../resize with a disk SHRINK → 422 "can only grow" (server-side block).
- ``run_resize`` performs the synchronous config write, marks the job
  ``succeeded`` with NO poll loop (CPU/RAM resize has no UPID).

Proxmox is exercised through ``FakeProxmox`` (proxmoxer 2.3 is sync).
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import select

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import CLUSTER_RESOURCES_VM, FakeProxmox

# A VM config with hotplug=network,disk (NO cpu, NO memory) and a 32 GB scsi0.
_VM_CONFIG_NO_CPU_HOTPLUG = {
    "name": "vm-prod-1",
    "cores": 4,
    "memory": 4096,
    "hotplug": "network,disk",
    "scsi0": "local-lvm:vm-100-disk-0,size=32G",
    "virtio0": "local-lvm:vm-100-disk-1,size=100G",
}

# A VM config with hotplug=1 (all hotplug enabled).
_VM_CONFIG_ALL_HOTPLUG = {
    "name": "vm-prod-1",
    "cores": 2,
    "memory": 2048,
    "hotplug": "1",
    "scsi0": "local-lvm:vm-100-disk-0,size=32G",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_cluster_and_token(
    session_factory, *, team_id: int, poolid: str = "gui-team-42",
    host: str = "pve-resize.test",
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


def _make_fake_for_resize(config: dict | None = None):
    """A FakeProxmox pre-wired for resize on vmid 100 (node pve-01)."""
    cfg = config or _VM_CONFIG_NO_CPU_HOTPLUG
    fake = FakeProxmox(
        responses={
            "nodes.pve-01.qemu.100.config.get": cfg,
            "nodes.pve-01.qemu.100.config.put": {"data": None},
            "nodes.pve-01.qemu.100.resize.put": {"data": None},
        }
    )
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    return fake


# ---------------------------------------------------------------------------
# Tests — resize-info
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resize_info_reports_cpu_ram_disks_and_hotplug(client, session_factory):
    """GET .../resize-info → cores/memory + disk sizes + hotplug booleans."""
    user = await make_user(session_factory, username="rzinfo", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=90)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_resize()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="rzinfo", password="testpass12345")
        resp = await client.get(
            f"/api/v1/clusters/{cluster_id}/vms/100/resize-info",
            cookies=cookies,
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["cores"] == 4
    assert body["memory"] == 4096
    disks = {d["disk"]: d["size_gb"] for d in body["disks"]}
    assert disks["scsi0"] == 32
    assert disks["virtio0"] == 100


@pytest.mark.asyncio
async def test_resize_info_cpu_hotplug_false_when_token_absent(client, session_factory):
    """hotplug string without 'cpu' → cpu_hotplug=false (cores change needs reboot)."""
    user = await make_user(session_factory, username="rznohp", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=91)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_resize(_VM_CONFIG_NO_CPU_HOTPLUG)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="rznohp", password="testpass12345")
        resp = await client.get(
            f"/api/v1/clusters/{cluster_id}/vms/100/resize-info",
            cookies=cookies,
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["cpu_hotplug"] is False
    assert body["memory_hotplug"] is False


@pytest.mark.asyncio
async def test_resize_info_hotplug_all_enabled(client, session_factory):
    """hotplug='1' → both cpu_hotplug and memory_hotplug are true."""
    user = await make_user(session_factory, username="rzallhp", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=92)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_resize(_VM_CONFIG_ALL_HOTPLUG)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="rzallhp", password="testpass12345")
        resp = await client.get(
            f"/api/v1/clusters/{cluster_id}/vms/100/resize-info",
            cookies=cookies,
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["cpu_hotplug"] is True
    assert body["memory_hotplug"] is True


# ---------------------------------------------------------------------------
# Tests — resize routes
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resize_cpu_ram_returns_202(client, session_factory):
    """POST .../resize {cores,memory} → 202 with kind="vm.resize"."""
    from app.models import Job

    user = await make_user(session_factory, username="rzcpu", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=93)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_resize()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="rzcpu", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/resize",
            json={"cores": 8, "memory": 8192},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["kind"] == "vm.resize"
    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.resize")
        )).scalars().all()
    assert len(rows) == 1
    assert rows[0].state == "pending"


@pytest.mark.asyncio
async def test_resize_disk_grow_returns_202(client, session_factory):
    """POST .../resize disk grow (32 → 64 GB) → 202."""
    user = await make_user(session_factory, username="rzgrow", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=94)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_resize()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="rzgrow", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/resize",
            json={"disks": [{"disk": "scsi0", "new_size_gb": 64}]},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text


@pytest.mark.asyncio
async def test_resize_disk_shrink_rejected_422(client, session_factory):
    """POST .../resize with a disk SHRINK → 422 'can only grow' (LIFE-09)."""
    user = await make_user(session_factory, username="rzshrink", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=95)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_resize()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="rzshrink", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/resize",
            json={"disks": [{"disk": "scsi0", "new_size_gb": 16}]},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 422, resp.text
    assert "can only grow" in resp.text.lower()


@pytest.mark.asyncio
async def test_resize_skiplock_field_rejected(client, session_factory):
    """A forged ``skiplock`` resize body field is rejected 422 (extra='forbid')."""
    user = await make_user(session_factory, username="rzskip", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=96)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_resize()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="rzskip", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/resize",
            json={"cores": 4, "skiplock": 1},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Tests — run_resize job function
# ---------------------------------------------------------------------------


class _FakeRedis:
    async def publish(self, channel, payload):  # noqa: ANN001
        return None


@pytest.mark.asyncio
async def test_run_resize_does_sync_write_and_marks_succeeded(session_factory, engine):
    """run_resize performs the sync config write and marks the job succeeded —
    no poll loop (CPU/RAM resize has no UPID)."""
    import json

    from app.jobs.resize_functions import run_resize
    from app.models import AuditLog, Cluster, Job, Team, TeamClusterToken

    async with session_factory() as session:
        team = Team(id=110, name="gui-team-110", personal=False, is_active=True)
        session.add(team)
        await session.flush()
        cluster = Cluster(
            name="cluster-110", host="pve-rzrun.test", port=8006, verify_ssl=False,
            token_user="root@pam", token_name="gui", api_token_secret="bootstrap-secret",
            is_active=True,
        )
        session.add(cluster)
        await session.flush()
        session.add(TeamClusterToken(
            team_id=team.id, cluster_id=cluster.id, userid="gui-team-110@pve",
            tokenid="api", token_secret="team-110-secret", poolid="gui-team-110",
        ))
        await session.flush()
        job = Job(
            kind="vm.resize", state="pending",
            cluster_id=cluster.id, team_id=team.id, actor_user_id=None,
            payload=json.dumps({"node": "pve-01", "vmid": 100, "is_lxc": False,
                                "cores": 8, "memory": 8192, "disks": []}),
        )
        session.add(job)
        await session.commit()
        job_id = job.id

    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.config.put": {"data": None},
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
        await run_resize(ctx, job_id)

    async with factory() as db:
        refreshed = await db.get(Job, job_id)
        assert refreshed.state == "succeeded", refreshed.state
        assert refreshed.upid is None, "CPU/RAM resize has no UPID — no poll loop"
        audit_rows = (await db.execute(
            select(AuditLog).where(AuditLog.action.like("vm.resize%"))
        )).scalars().all()
    assert len(audit_rows) >= 1, "worker must audit the outcome"
    # The sync config write was actually issued.
    config_puts = fake.find_calls("nodes.pve-01.qemu.100.config.put")
    assert len(config_puts) == 1
