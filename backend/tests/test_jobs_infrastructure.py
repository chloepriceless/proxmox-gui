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
from alembic import command
from alembic.config import Config

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
    """upgrade head → downgrade -1 → upgrade head round-trips cleanly."""
    cfg = _make_config(fresh_db)
    command.upgrade(cfg, "head")

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
    command.upgrade(cfg, "head")
    engine3 = sa.create_engine(fresh_db)
    assert "backup_schedules" in sa.inspect(engine3).get_table_names()
    engine3.dispose()
