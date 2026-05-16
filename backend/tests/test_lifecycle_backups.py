"""Phase 3 Plan 04 — backup lifecycle: model, migration, service, routes, cron.

TDD: these tests are written BEFORE the Plan 03-04 backup code lands —
expected to fail (RED) until each task is implemented (GREEN).

Task 1 — the ``BackupSchedule`` ORM model, the ``0005`` migration adding
``clusters.backup_storage``, the cluster PATCH carrying the new field, and the
admin ``GET /clusters/{id}/backup-storages`` enumeration.

Task 2 — the backup service (manual vzdump, file list, restore in-place /
as-new, schedule upsert, keep-last-N prune), the 202 backup routes, the arq
job functions, and the scheduled-backup cron.

Proxmox is exercised through ``FakeProxmox`` (proxmoxer 2.3 is sync).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import select

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import CLUSTER_RESOURCES_VM, FakeProxmox

# A canned UPID for the vzdump / restore actions.
_BACKUP_UPID = "UPID:pve-01:0001:000A:65000000:vzdump:100:gui-team-70@pve:"
_RESTORE_UPID = "UPID:pve-01:0002:000B:65000000:qmrestore:110:gui-team-70@pve:"

# A backup-file content listing PVE returns from the storage content API.
_BACKUP_FILES = [
    {"volid": "local-zfs:backup/vzdump-qemu-100-2026_05_10-00_00_00.vma.zst",
     "filename": "vzdump-qemu-100-2026_05_10-00_00_00.vma.zst",
     "size": 1000, "ctime": 1700000000, "format": "vma.zst", "vmid": 100},
    {"volid": "local-zfs:backup/vzdump-qemu-100-2026_05_11-00_00_00.vma.zst",
     "filename": "vzdump-qemu-100-2026_05_11-00_00_00.vma.zst",
     "size": 1100, "ctime": 1700100000, "format": "vma.zst", "vmid": 100},
    {"volid": "local-zfs:backup/vzdump-qemu-100-2026_05_12-00_00_00.vma.zst",
     "filename": "vzdump-qemu-100-2026_05_12-00_00_00.vma.zst",
     "size": 1200, "ctime": 1700200000, "format": "vma.zst", "vmid": 100},
]

# PVE /nodes/{n}/storage?content=backup row set.
_BACKUP_STORAGES = [
    {"storage": "local-zfs", "type": "zfspool", "content": "backup,images"},
    {"storage": "pbs-main", "type": "pbs", "content": "backup"},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_cluster_and_token(
    session_factory, *, team_id: int, poolid: str = "gui-team-42",
    host: str = "pve-backup.test", backup_storage: str | None = "local-zfs",
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
            backup_storage=backup_storage,
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


def _make_fake_for_backups():
    """A FakeProxmox pre-wired for backup dispatch on vmid 100 (node pve-01)."""
    fake = FakeProxmox(
        responses={
            "nodes.pve-01.vzdump.post": {"data": _BACKUP_UPID},
            "nodes.pve-01.qemu.post": {"data": _RESTORE_UPID},
            "nodes.pve-01.storage.local-zfs.content.get": _BACKUP_FILES,
        }
    )
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    return fake


# ===========================================================================
# Task 1 — model, migration, cluster PATCH, backup-storage enumeration
# ===========================================================================


def test_backup_schedule_model_maps_table():
    """The BackupSchedule ORM model maps the backup_schedules table."""
    from app.models.backup_schedule import BackupSchedule

    assert BackupSchedule.__tablename__ == "backup_schedules"
    cols = set(BackupSchedule.__table__.columns.keys())
    expected = {
        "id", "cluster_id", "team_id", "vmid", "is_lxc", "node", "enabled",
        "frequency", "keep_last", "last_run_at", "last_run_state", "created_at",
    }
    assert expected.issubset(cols), f"missing columns: {expected - cols}"


def test_cluster_model_has_backup_storage():
    """The Cluster model gains a nullable backup_storage column."""
    from app.models.cluster import Cluster

    assert hasattr(Cluster, "backup_storage")
    col = Cluster.__table__.columns["backup_storage"]
    assert col.nullable is True


@pytest.mark.asyncio
async def test_backup_schedule_row_round_trips(session_factory):
    """A BackupSchedule row inserts and reads back through the ORM."""
    from app.models import BackupSchedule
    from app.models.cluster import Cluster
    from app.models.team import Team

    async with session_factory() as session:
        team = Team(id=90, name="gui-team-90", personal=False, is_active=True)
        session.add(team)
        cluster = Cluster(
            name="cluster-90", host="pve-sched.test", port=8006,
            verify_ssl=False, token_user="root@pam", token_name="gui",
            api_token_secret="s", is_active=True,
        )
        session.add(cluster)
        await session.flush()
        sched = BackupSchedule(
            cluster_id=cluster.id, team_id=team.id, vmid=100, is_lxc=False,
            node="pve-01", enabled=True, frequency="daily", keep_last=7,
        )
        session.add(sched)
        await session.commit()
        sched_id = sched.id

    async with session_factory() as session:
        row = await session.get(BackupSchedule, sched_id)
        assert row is not None
        assert row.vmid == 100
        assert row.frequency == "daily"
        assert row.keep_last == 7


@pytest.mark.asyncio
async def test_cluster_patch_persists_backup_storage(client, session_factory):
    """PATCH /clusters/{id} with backup_storage persists it; response includes it."""
    admin = await make_user(session_factory, username="bkadmin", is_admin=True)
    cluster_id, _, _ = await _seed_cluster_and_token(
        session_factory, team_id=71, backup_storage=None,
    )

    cookies = await login_as(client, username="bkadmin", password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    resp = await client.patch(
        f"/api/v1/clusters/{cluster_id}",
        json={"backup_storage": "local-zfs"},
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["backup_storage"] == "local-zfs"

    # GET reflects the persisted value too.
    resp = await client.get(f"/api/v1/clusters/{cluster_id}", cookies=cookies)
    assert resp.json()["backup_storage"] == "local-zfs"
    assert admin.is_admin


@pytest.mark.asyncio
async def test_cluster_patch_clears_backup_storage_to_null(client, session_factory):
    """PATCH with backup_storage=null clears the designation (D-08)."""
    await make_user(session_factory, username="bkclear", is_admin=True)
    cluster_id, _, _ = await _seed_cluster_and_token(
        session_factory, team_id=72, backup_storage="local-zfs",
    )

    cookies = await login_as(client, username="bkclear", password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    resp = await client.patch(
        f"/api/v1/clusters/{cluster_id}",
        json={"backup_storage": None},
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["backup_storage"] is None


@pytest.mark.asyncio
async def test_cluster_patch_omitting_backup_storage_leaves_it(client, session_factory):
    """PATCH without backup_storage in the body leaves the existing value."""
    await make_user(session_factory, username="bkkeep", is_admin=True)
    cluster_id, _, _ = await _seed_cluster_and_token(
        session_factory, team_id=73, backup_storage="local-zfs",
    )

    cookies = await login_as(client, username="bkkeep", password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    resp = await client.patch(
        f"/api/v1/clusters/{cluster_id}",
        json={"notes": "untouched"},
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["backup_storage"] == "local-zfs"


@pytest.mark.asyncio
async def test_backup_storages_enumeration(client, session_factory):
    """GET /clusters/{id}/backup-storages returns content=backup storages."""
    await make_user(session_factory, username="bkstg", is_admin=True)
    cluster_id, _, _ = await _seed_cluster_and_token(session_factory, team_id=74)

    fake = FakeProxmox(responses={
        "nodes.get": [{"node": "pve-01"}, {"node": "pve-02"}],
        "nodes.pve-01.storage.get": _BACKUP_STORAGES,
    })
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="bkstg", password="testpass12345")
        resp = await client.get(
            f"/api/v1/clusters/{cluster_id}/backup-storages", cookies=cookies,
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    storages = {s["storage"] for s in body}
    assert {"local-zfs", "pbs-main"} == storages


# ===========================================================================
# Task 2 — backup service + routes + arq job functions + scheduled-backup cron
# ===========================================================================


@pytest.mark.asyncio
async def test_manual_backup_returns_202(client, session_factory):
    """POST .../backup → 202 with kind="vm.backup" when storage is configured."""
    from app.models import Job

    user = await make_user(session_factory, username="bkrun", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=75,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_backups()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="bkrun", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/backup",
            json={},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    assert resp.json()["kind"] == "vm.backup"

    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.backup")
        )).scalars().all()
    assert len(rows) == 1 and rows[0].state == "pending"


@pytest.mark.asyncio
async def test_manual_backup_rejected_without_storage(client, session_factory):
    """POST .../backup → 409 when the cluster has no backup_storage (D-08)."""
    user = await make_user(session_factory, username="bknostg", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=76, backup_storage=None,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_backups()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="bknostg", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/backup",
            json={},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 409, resp.text
    assert "backup storage" in resp.text.lower()


@pytest.mark.asyncio
async def test_list_backup_files(client, session_factory):
    """GET .../backups lists the VM's backup files via the storage content API."""
    user = await make_user(session_factory, username="bklist", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=77,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_backups()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="bklist", password="testpass12345")
        resp = await client.get(
            f"/api/v1/clusters/{cluster_id}/vms/100/backups", cookies=cookies,
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["backups"]) == 3


@pytest.mark.asyncio
async def test_restore_in_place_returns_202(client, session_factory):
    """POST .../restore mode=in_place → 202 kind="vm.restore"."""
    from app.models import Job

    user = await make_user(session_factory, username="bkrest", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=78,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_backups()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="bkrest", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/restore",
            json={
                "archive": _BACKUP_FILES[0]["volid"],
                "mode": "in_place",
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    assert resp.json()["kind"] == "vm.restore"

    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.restore")
        )).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_restore_as_new_runs_quota_admission(client, session_factory):
    """POST .../restore mode=new → 202 and runs the quota admission path."""
    from app.models import Job

    user = await make_user(session_factory, username="bkrnew", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=79,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_backups()
    fake.responses["cluster.nextid.get"] = 110
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="bkrnew", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/restore",
            json={
                "archive": _BACKUP_FILES[0]["volid"],
                "mode": "new",
                "new_vmid": 110,
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    async with session_factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.restore")
        )).scalars().all()
    assert len(rows) == 1
    payload = json.loads(rows[0].payload)
    assert payload["newid"] == 110


@pytest.mark.asyncio
async def test_backup_schedule_upsert(client, session_factory):
    """PUT .../backup-schedule upserts a BackupSchedule row."""
    from app.models import BackupSchedule

    user = await make_user(session_factory, username="bksch", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=81,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_backups()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="bksch", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.put(
            f"/api/v1/clusters/{cluster_id}/vms/100/backup-schedule",
            json={"enabled": True, "frequency": "daily", "keep_last": 7},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 200, resp.text

    async with session_factory() as db:
        rows = (await db.execute(
            select(BackupSchedule).where(BackupSchedule.vmid == 100)
        )).scalars().all()
    assert len(rows) == 1
    assert rows[0].frequency == "daily" and rows[0].keep_last == 7


@pytest.mark.asyncio
async def test_fire_due_scheduled_backups(session_factory, engine):
    """fire_due_scheduled_backups enqueues for an enabled+due schedule, not disabled."""
    from app.jobs.backups_cron import fire_due_scheduled_backups
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.clusters.registry import PVEConnectorRegistry
    from app.models import BackupSchedule, Cluster, Job, Team, TeamClusterToken

    async with session_factory() as session:
        for tid, vmid, enabled in ((91, 100, True), (92, 101, False)):
            team = Team(id=tid, name=f"gui-team-{tid}", personal=False,
                        is_active=True)
            session.add(team)
            cluster = Cluster(
                id=tid, name=f"cluster-{tid}", host=f"pve-{tid}.test",
                port=8006, verify_ssl=False, token_user="root@pam",
                token_name="gui", api_token_secret="s", is_active=True,
                backup_storage="local-zfs",
            )
            session.add(cluster)
            await session.flush()
            session.add(TeamClusterToken(
                team_id=tid, cluster_id=tid, userid=f"gui-team-{tid}@pve",
                tokenid="api", token_secret="s", poolid=f"gui-team-{tid}",
            ))
            # Both are "due" — last run was 2 days ago — but only one enabled.
            session.add(BackupSchedule(
                cluster_id=tid, team_id=tid, vmid=vmid, is_lxc=False,
                node="pve-01", enabled=enabled, frequency="daily", keep_last=7,
                last_run_at=datetime.now(UTC) - timedelta(days=2),
            ))
        await session.commit()

    class _FakeArqPool:
        def __init__(self) -> None:
            self.enqueued: list = []

        async def enqueue_job(self, *args, **kwargs):  # noqa: ANN002, ANN003
            self.enqueued.append((args, kwargs))
            return None

        async def publish(self, channel, payload):  # noqa: ANN001
            return None

    factory = async_sessionmaker(engine, expire_on_commit=False)
    pool = _FakeArqPool()
    registry = PVEConnectorRegistry(None, factory)
    ctx = {"sessionmaker": factory, "registry": registry,
           "redis": pool, "arq_pool": pool}
    await fire_due_scheduled_backups(ctx)

    # One vm.backup job for the enabled+due schedule only.
    async with factory() as db:
        rows = (await db.execute(
            select(Job).where(Job.kind == "vm.backup")
        )).scalars().all()
    assert len(rows) == 1
    payload = json.loads(rows[0].payload)
    assert payload["vmid"] == 100
    assert payload.get("scheduled") is True


@pytest.mark.asyncio
async def test_keep_last_n_prune_deletes_oldest(session_factory, engine):
    """The keep-last-N prune deletes backup files beyond index N (oldest-first)."""
    from app.jobs.backups_cron import prune_backups
    from sqlalchemy.ext.asyncio import async_sessionmaker

    fake = FakeProxmox(responses={
        "nodes.pve-01.storage.local-zfs.content.get": _BACKUP_FILES,
        f"nodes.pve-01.storage.local-zfs.content.{_BACKUP_FILES[0]['volid']}.delete":
            {"data": None},
    })
    factory = async_sessionmaker(engine, expire_on_commit=False)  # noqa: F841
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        from app.clusters.connector import PVEConnector

        connector = PVEConnector(
            host="pve-01.test", port=8006, token_user="root@pam",
            token_name="gui", token_value="s", verify_ssl=False,
        )
        # keep_last=2 → with 3 files, the single oldest (ctime 1700000000) goes.
        deleted = await prune_backups(
            connector, node="pve-01", storage="local-zfs", vmid=100,
            keep_last=2,
        )
    assert deleted == 1
    delete_calls = fake.find_calls(
        f"nodes.pve-01.storage.local-zfs.content.{_BACKUP_FILES[0]['volid']}.delete"
    )
    assert len(delete_calls) == 1
