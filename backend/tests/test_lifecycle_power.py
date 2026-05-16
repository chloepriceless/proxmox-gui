"""Phase 3 Plan 02 Task 1 — power lifecycle service + routes + run_power_action.

TDD RED: written BEFORE app/lifecycle/{schemas,power,routes}.py and the
``run_power_action`` job function exist — expected to fail until Task 1 lands.

Covers:
- POST .../vms/{vmid}/power → 202 + a numeric job id; one pending vm.power row.
- A duplicate identical power POST collapses onto the SAME job id (idempotency).
- An unknown action → 422; ``skiplock`` never accepted on any schema.
- DELETE .../vms/{vmid} → 202 with kind="vm.delete".
- bulk-power fans out one job per VM under a shared batch_id.
- A power POST on a cross-tenant VM → 403 (don't-leak-existence).
- ``run_power_action`` claims the job, dispatches via the poller, audits.

Proxmox is exercised through ``FakeProxmox`` (proxmoxer 2.3 is sync).
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import select

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import CLUSTER_RESOURCES_VM, FakeProxmox

# A canned UPID for the start action.
_START_UPID = "UPID:pve-01:0001:000A:65000000:qmstart:100:gui-team-42@pve:"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_cluster_and_token(
    session_factory, *, team_id: int = 42, poolid: str = "gui-team-42",
    host: str = "pve-power.test",
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


def _make_fake_for_power():
    """A FakeProxmox pre-wired for power dispatch on vmid 100/101 (node pve-01)."""
    fake = FakeProxmox(
        responses={
            "nodes.pve-01.qemu.100.status.start.post": {"data": _START_UPID},
            "nodes.pve-01.qemu.100.status.stop.post": {"data": _START_UPID},
            "nodes.pve-01.qemu.100.status.reboot.post": {"data": _START_UPID},
            "nodes.pve-01.qemu.100.status.shutdown.post": {"data": _START_UPID},
            "nodes.pve-01.qemu.100.delete": {"data": _START_UPID},
            "nodes.pve-02.qemu.101.status.reboot.post": {"data": _START_UPID},
        }
    )
    # require_resource_access calls list_resources (type=vm then type=lxc).
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", [])
    return fake


# ---------------------------------------------------------------------------
# Tests — power routes return 202
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_power_start_returns_202_and_pending_job(client, session_factory):
    """POST .../vms/100/power {action:start} → 202 + numeric job id; one pending row."""
    from app.models import Job

    user = await make_user(session_factory, username="poweruser", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=42)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_power()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="poweruser", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/power",
            json={"action": "start"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 202, resp.text
    body = resp.json()
    job_id = body.get("job_id")
    assert isinstance(job_id, int) and job_id > 0, body

    async with session_factory() as db:
        rows = (await db.execute(select(Job).where(Job.kind == "vm.power"))).scalars().all()
    assert len(rows) == 1
    assert rows[0].state == "pending"


@pytest.mark.asyncio
async def test_duplicate_power_post_dedups_to_same_job(client, session_factory):
    """A second identical power POST returns the SAME job id (idempotency dedup)."""
    from app.models import Job

    user = await make_user(session_factory, username="poweridem", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=43)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = FakeProxmox(responses={"nodes.pve-01.qemu.100.status.start.post": {"data": _START_UPID}})
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", [])
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", [])

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="poweridem", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        r1 = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/power",
            json={"action": "start"}, cookies=cookies, headers={"X-CSRF-Token": csrf},
        )
        r2 = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/power",
            json={"action": "start"}, cookies=cookies, headers={"X-CSRF-Token": csrf},
        )

    assert r1.status_code == 202 and r2.status_code == 202
    assert r1.json()["job_id"] == r2.json()["job_id"]

    async with session_factory() as db:
        rows = (await db.execute(select(Job).where(Job.kind == "vm.power"))).scalars().all()
    assert len(rows) == 1, "duplicate POST must not insert a second row"


@pytest.mark.asyncio
async def test_unknown_action_returns_422(client, session_factory):
    """An unknown action value is rejected 422 by the pydantic enum."""
    user = await make_user(session_factory, username="powerbad", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=44)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_power()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="powerbad", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/power",
            json={"action": "bananas"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_skiplock_field_is_rejected(client, session_factory):
    """A forged ``skiplock`` body field is rejected 422 (extra='forbid')."""
    user = await make_user(session_factory, username="powerskip", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=45)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_power()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="powerskip", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/power",
            json={"action": "start", "skiplock": 1},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_vm_returns_202_with_vm_delete_kind(client, session_factory):
    """DELETE .../vms/100 → 202 with a vm.delete job row."""
    from app.models import Job

    user = await make_user(session_factory, username="powerdel", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=46)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_power()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="powerdel", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.request(
            "DELETE",
            f"/api/v1/clusters/{cluster_id}/vms/100",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 202, resp.text
    async with session_factory() as db:
        rows = (await db.execute(select(Job).where(Job.kind == "vm.delete"))).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_bulk_power_fans_out_one_job_per_vm_with_shared_batch_id(
    client, session_factory
):
    """bulk-power {reboot, targets:[100,101]} → two jobs sharing one batch_id."""
    from app.models import Job

    user = await make_user(session_factory, username="powerbulk", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=47)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = FakeProxmox(responses={})
    # bulk re-resolves access per target — each resolve does a vm + lxc list.
    for _ in range(2):
        fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
        fake.queue_response("cluster.resources.get", [])

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="powerbulk", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/bulk-power",
            json={
                "action": "reboot",
                "targets": [
                    {"cluster_id": cluster_id, "vmid": 100},
                    {"cluster_id": cluster_id, "vmid": 101},
                ],
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body.get("batch_id")
    assert len(body.get("job_ids", [])) == 2

    async with session_factory() as db:
        rows = (await db.execute(select(Job).where(Job.kind == "vm.power"))).scalars().all()
    assert len(rows) == 2
    batch_ids = {r.batch_id for r in rows}
    assert len(batch_ids) == 1 and None not in batch_ids


@pytest.mark.asyncio
async def test_power_cross_tenant_returns_403(client, session_factory):
    """A power POST on a VM in a team the user is not on → 403."""
    owner = await make_user(session_factory, username="powerowner", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=48)
    await _add_user_to_team(session_factory, user_id=owner.id, team_id=team_id)

    # A second user with no membership on this cluster.
    await make_user(session_factory, username="powerother", is_admin=False)

    fake = _make_fake_for_power()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="powerother", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/power",
            json={"action": "start"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_power_post_writes_enqueue_audit_row(client, session_factory):
    """The enqueue path writes an audit row recording who requested the action."""
    from app.models import AuditLog

    user = await make_user(session_factory, username="poweraudit", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=49)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_power()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="poweraudit", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/power",
            json={"action": "start"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text

    async with session_factory() as db:
        rows = (await db.execute(
            select(AuditLog).where(AuditLog.action.like("vm.power%"))
        )).scalars().all()
    assert len(rows) >= 1
    assert rows[0].actor_user_id == user.id


# ---------------------------------------------------------------------------
# Tests — run_power_action job function
# ---------------------------------------------------------------------------


class _FakeRedis:
    async def publish(self, channel, payload):  # noqa: ANN001
        return None


@pytest.mark.asyncio
async def test_run_power_action_dispatches_and_audits(session_factory, engine):
    """run_power_action claims the job, dispatches via the poller, audits outcome."""
    import json

    from app.jobs.functions import run_power_action
    from app.models import AuditLog, Cluster, Job, Team, TeamClusterToken

    async with session_factory() as session:
        team = Team(id=70, name="gui-team-70", personal=False, is_active=True)
        session.add(team)
        await session.flush()
        cluster = Cluster(
            name="cluster-70", host="pve-run.test", port=8006, verify_ssl=False,
            token_user="root@pam", token_name="gui", api_token_secret="bootstrap-secret",
            is_active=True,
        )
        session.add(cluster)
        await session.flush()
        session.add(TeamClusterToken(
            team_id=team.id, cluster_id=cluster.id, userid="gui-team-70@pve",
            tokenid="api", token_secret="team-70-secret", poolid="gui-team-70",
        ))
        await session.flush()
        job = Job(
            kind="vm.power", state="pending",
            cluster_id=cluster.id, team_id=team.id, actor_user_id=None,
            payload=json.dumps({"node": "pve-01", "vmid": 100, "is_lxc": False,
                                "action": "start"}),
        )
        session.add(job)
        await session.commit()
        job_id = job.id
        cluster_id = cluster.id
        team_id = team.id

    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.status.start.post": {"data": _START_UPID},
        f"nodes.pve-01.tasks.{_START_UPID}.status.get": {"data": {"status": "stopped", "exitstatus": "OK"}},
        f"nodes.pve-01.tasks.{_START_UPID}.log.get": {"data": [{"n": 1, "t": "done"}]},
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
        await run_power_action(ctx, job_id)

    async with factory() as db:
        refreshed = await db.get(Job, job_id)
        assert refreshed.state == "succeeded", refreshed.state
        audit_rows = (await db.execute(
            select(AuditLog).where(AuditLog.action.like("vm.power%"))
        )).scalars().all()
    assert len(audit_rows) >= 1, "worker must audit the outcome"
    assert cluster_id and team_id  # silence unused
