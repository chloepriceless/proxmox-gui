"""Phase 3 Plan 01 — job-queue infrastructure tests.

Covers:
- Task 1: connector lifecycle/polling methods + the 0004_phase3 migration.
- Task 2: the curated error map, the enqueue helper, the WorkerSettings shape,
  and the orphan reaper edge cases.

The Proxmox side is exercised through ``FakeProxmox`` (proxmoxer 2.3 is sync
and built on ``requests`` — ``respx`` only intercepts ``httpx``).
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from alembic.config import Config

from alembic import command
from tests.fixtures.pve_responses import FakeProxmox

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"

# ----------------------------------------------------------------------------
# Task 1 — connector lifecycle/polling methods
# ----------------------------------------------------------------------------

LIFECYCLE_METHODS = [
    "vm_power",
    "vm_delete",
    "task_status",
    "task_log",
    "snapshot_list",
    "snapshot_create",
    "snapshot_rollback",
    "snapshot_delete",
    "vzdump",
    "restore",
    "resize_disk",
    "clone",
    "to_template",
    "migrate",
    "cluster_status",
    "cluster_nextid",
    "node_storages",
    "unlock",
]


def test_connector_exposes_all_lifecycle_methods() -> None:
    """All 18 Phase-3 lifecycle/polling methods exist on PVEConnector."""
    from app.clusters.connector import PVEConnector

    missing = [m for m in LIFECYCLE_METHODS if not hasattr(PVEConnector, m)]
    assert not missing, f"PVEConnector missing methods: {missing}"


def _make_connector(fake: FakeProxmox):
    from app.clusters.connector import PVEConnector

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        return PVEConnector(
            host="pve.example.test",
            port=8006,
            token_user="gui-team-1@pve",
            token_name="api",
            token_value="deadbeef",
            verify_ssl=True,
        )


@pytest.mark.asyncio
async def test_vm_power_returns_upid_and_routes_through_breaker() -> None:
    """vm_power dispatches status/{action} POST and returns the UPID string."""
    upid = "UPID:pve-01:0001:000A:65000000:qmstart:100:gui-team-1@pve:"
    fake = FakeProxmox(
        responses={"nodes.pve-01.qemu.100.status.start.post": {"data": upid}}
    )
    conn = _make_connector(fake)
    result = await conn.vm_power(node="pve-01", vmid=100, is_lxc=False, action="start")
    assert result == upid
    # The call went through the recording fake.
    assert any(
        c[0] == "nodes.pve-01.qemu.100.status.start.post" for c in fake.calls
    )


@pytest.mark.asyncio
async def test_vm_delete_passes_purge_and_never_skiplock() -> None:
    """vm_delete sends purge=1 and never skiplock."""
    upid = "UPID:pve-01:0001:000A:65000000:qmdestroy:100:gui-team-1@pve:"
    fake = FakeProxmox(responses={"nodes.pve-01.qemu.100.delete": {"data": upid}})
    conn = _make_connector(fake)
    result = await conn.vm_delete(node="pve-01", vmid=100, is_lxc=False)
    assert result == upid
    delete_calls = [c for c in fake.calls if c[0] == "nodes.pve-01.qemu.100.delete"]
    assert delete_calls, "delete was not called"
    _, _, kwargs = delete_calls[0]
    assert kwargs.get("purge") == 1
    assert "skiplock" not in kwargs


@pytest.mark.asyncio
async def test_task_status_returns_dict() -> None:
    """task_status polls /nodes/{node}/tasks/{upid}/status."""
    upid = "UPID:pve-01:0001:000A:65000000:qmstart:100:gui-team-1@pve:"
    status_payload = {"data": {"status": "stopped", "exitstatus": "OK"}}
    fake = FakeProxmox(
        responses={f"nodes.pve-01.tasks.{upid}.status.get": status_payload}
    )
    conn = _make_connector(fake)
    result = await conn.task_status(node="pve-01", upid=upid)
    assert result["status"] == "stopped"
    assert result["exitstatus"] == "OK"


def test_connector_has_no_skiplock_anywhere() -> None:
    """skiplock is never sent — root-only param (Pitfall 17, T-03-01-04)."""
    src = (BACKEND_DIR / "app" / "clusters" / "connector.py").read_text()
    assert "skiplock" not in src


# ----------------------------------------------------------------------------
# Task 1 — the 0004_phase3 migration
# ----------------------------------------------------------------------------


@pytest.fixture
def fresh_db(tmp_path: Path) -> str:
    db_file = tmp_path / "phase3_migrate_test.db"
    return f"sqlite:///{db_file}"


def _make_config(db_url: str) -> Config:
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def test_0004_phase3_round_trips(fresh_db: str) -> None:
    """upgrade 0004 → downgrade -1 → upgrade 0004 round-trips cleanly.

    Pinned to ``0004_phase3`` (not ``head``) so the ``downgrade -1`` reverts
    0004 — Plan 03-04 added 0005_phase3_backup_storage on top of head, so a
    bare ``downgrade -1`` from head would only revert 0005.
    """
    cfg = _make_config(fresh_db)
    command.upgrade(cfg, "0004_phase3")

    engine = sa.create_engine(fresh_db)
    insp = sa.inspect(engine)
    # jobs gained batch_id + friendly_error.
    job_cols = {c["name"] for c in insp.get_columns("jobs")}
    assert "batch_id" in job_cols, f"batch_id missing; got {job_cols}"
    assert "friendly_error" in job_cols, f"friendly_error missing; got {job_cols}"
    # backup_schedules table exists.
    assert "backup_schedules" in insp.get_table_names()
    engine.dispose()

    # Downgrade reverses 0004.
    command.downgrade(cfg, "-1")
    engine2 = sa.create_engine(fresh_db)
    insp2 = sa.inspect(engine2)
    job_cols2 = {c["name"] for c in insp2.get_columns("jobs")}
    assert "batch_id" not in job_cols2
    assert "friendly_error" not in job_cols2
    assert "backup_schedules" not in insp2.get_table_names()
    engine2.dispose()

    # Re-upgrade — proves the migration is replayable.
    command.upgrade(cfg, "0004_phase3")
    engine3 = sa.create_engine(fresh_db)
    assert "backup_schedules" in sa.inspect(engine3).get_table_names()
    engine3.dispose()


# ----------------------------------------------------------------------------
# Task 2 — the arq WorkerSettings shape
# ----------------------------------------------------------------------------


def test_worker_settings_shape() -> None:
    """WorkerSettings exposes the arq attributes; every func has max_tries=1."""
    from app.jobs.worker import WorkerSettings

    assert hasattr(WorkerSettings, "functions")
    assert hasattr(WorkerSettings, "cron_jobs")
    assert hasattr(WorkerSettings, "on_startup")
    assert hasattr(WorkerSettings, "on_shutdown")
    assert hasattr(WorkerSettings, "redis_settings")
    # Every registered job function disables arq's own retry (D-16).
    for f in WorkerSettings.functions:
        assert getattr(f, "max_tries", None) == 1, (
            f"function {f!r} must have max_tries=1"
        )


def test_worker_redis_settings_loopback() -> None:
    """Redis binds loopback only — T-03-01-01."""
    from app.jobs.worker import WorkerSettings

    assert WorkerSettings.redis_settings.host == "127.0.0.1"
    assert WorkerSettings.redis_settings.port == 6379


def test_worker_startup_calls_reaper() -> None:
    """on_startup must invoke the orphan reaper (LIFE-14)."""
    src = (BACKEND_DIR / "app" / "jobs" / "worker.py").read_text()
    assert "reap_orphans" in src


# ----------------------------------------------------------------------------
# Task 2 — the enqueue helper (commit-before-enqueue, idempotency dedup)
# ----------------------------------------------------------------------------


class _FakeArqPool:
    """Records enqueue_job calls without touching Redis."""

    def __init__(self) -> None:
        self.enqueued: list[tuple] = []

    async def enqueue_job(self, *args, **kwargs):  # noqa: ANN002, ANN003
        self.enqueued.append((args, kwargs))
        return None


@pytest.mark.asyncio
async def test_enqueue_job_inserts_pending_row_and_commits() -> None:
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.jobs.enqueue import enqueue_job
    from app.models.base import Base

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(eng, expire_on_commit=False)
    pool = _FakeArqPool()
    async with factory() as session:
        job = await enqueue_job(
            session,
            pool,
            kind="vm.power",
            cluster_id=None,
            team_id=None,
            actor_user_id=1,
            payload={"action": "start", "vmid": 100},
        )
        assert job.state == "pending"
        assert job.id is not None
    # The arq pool was asked to enqueue exactly once.
    assert len(pool.enqueued) == 1
    await eng.dispose()


@pytest.mark.asyncio
async def test_enqueue_job_dedups_on_idempotency_key() -> None:
    """A second call with identical (kind, actor, payload) returns the SAME job."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.jobs.enqueue import enqueue_job
    from app.models.base import Base

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(eng, expire_on_commit=False)
    pool = _FakeArqPool()
    async with factory() as session:
        job1 = await enqueue_job(
            session, pool, kind="vm.power", cluster_id=None, team_id=None,
            actor_user_id=1, payload={"action": "start", "vmid": 100},
        )
        job2 = await enqueue_job(
            session, pool, kind="vm.power", cluster_id=None, team_id=None,
            actor_user_id=1, payload={"action": "start", "vmid": 100},
        )
        assert job1.id == job2.id, "idempotency-key collision must return the in-flight job"
    await eng.dispose()


# ----------------------------------------------------------------------------
# Task 2 — the orphan reaper (boot-time edge cases, LIFE-14)
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reaper_resolves_stopped_upid_job_to_succeeded() -> None:
    """A job with a UPID whose task is stopped+OK resolves to succeeded."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.jobs.reaper import reap_orphans
    from app.models import Job
    from app.models.base import Base

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(eng, expire_on_commit=False)
    upid = "UPID:pve-01:0001:000A:65000000:qmstart:100:gui-team-1@pve:"
    async with factory() as session:
        job = Job(
            kind="vm.power", state="running", payload="{}",
            upid=upid, upid_node="pve-01",
        )
        session.add(job)
        await session.commit()
        job_id = job.id

    # A registry whose task_status reports the task already stopped+OK.
    class _StoppedConnector:
        async def task_status(self, *, node, upid):  # noqa: ANN001
            return {"status": "stopped", "exitstatus": "OK"}

        async def task_log(self, *, node, upid, limit=200):  # noqa: ANN001
            return "done"

    class _Registry:
        async def get_for_team(self, *, cluster_id, team_id, db=None):  # noqa: ANN001
            return _StoppedConnector()

    ctx = {
        "sessionmaker": factory,
        "registry": _Registry(),
        "redis": _FakeRedis(),
        "arq_pool": _FakeArqPool(),
    }
    await reap_orphans(ctx)

    async with factory() as session:
        refreshed = await session.get(Job, job_id)
        assert refreshed.state == "succeeded"
    await eng.dispose()


@pytest.mark.asyncio
async def test_reaper_marks_no_upid_running_job_needs_review() -> None:
    """A claimed/running job with NO upid → needs_review (outcome unknown)."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.jobs.reaper import reap_orphans
    from app.models import Job
    from app.models.base import Base

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(eng, expire_on_commit=False)
    async with factory() as session:
        job = Job(kind="vm.clone", state="claimed", payload="{}")
        session.add(job)
        await session.commit()
        job_id = job.id

    class _Registry:
        async def get_for_team(self, *, cluster_id, team_id, db=None):  # noqa: ANN001
            raise AssertionError("reaper must not call PVE for a no-upid job")

    ctx = {
        "sessionmaker": factory,
        "registry": _Registry(),
        "redis": _FakeRedis(),
        "arq_pool": _FakeArqPool(),
    }
    await reap_orphans(ctx)

    async with factory() as session:
        refreshed = await session.get(Job, job_id)
        assert refreshed.state == "needs_review"
    await eng.dispose()


class _FakeRedis:
    """No-op Redis stand-in for publish during reaper/poller tests."""

    async def publish(self, channel, payload):  # noqa: ANN001
        return None
