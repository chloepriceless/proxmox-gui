"""Phase 4 Plan 04 — provisioning backend (connector + migration + models + module).

TDD: written BEFORE the connector methods, the 0006_phase4 migration, the
three new ORM models, and the ``provisioning/`` module land — expected to fail
(RED) until Tasks 1 and 2 land.

Task 1 covers:
- ``create_qemu`` / ``create_lxc`` / ``download_url`` / ``node_resources``
  connector methods — each routed through ``_call_with_breaker``.
- The 0006_phase4 migration creates ``network_scope`` / ``catalog_pin`` /
  ``notification_seen`` and downgrades cleanly.
- The three new ORM models exist with their schema-invariant ALLOWLIST
  rationale and the schema-invariant test still passes.

Task 2 covers:
- ``POST .../provisioning/lxc`` / ``.../provisioning/qemu`` → 202 + a
  ``ProvisioningJobAcceptedResponse`` carrying the reserved ``vmid``.
- Quota admission runs (and rejects 409) BEFORE the VMID is reserved.
- The build payload carries ``pool=<TeamClusterToken.poolid>``.
- A cross-tenant create returns 403.
- The job functions dispatch through ``_run_polled_job``.

Proxmox is exercised through ``FakeProxmox`` (proxmoxer 2.3 is sync).
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from alembic.config import Config

from alembic import command
from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import CLUSTER_RESOURCES_VM, FakeProxmox

_QEMU_UPID = "UPID:pve-01:0001:000A:65000000:qmcreate:150:gui-team-70@pve:"
_LXC_UPID = "UPID:pve-01:0002:000B:65000000:vzcreate:150:gui-team-70@pve:"
_DL_UPID = "UPID:pve-01:0003:000C:65000000:download:storage:gui-team-70@pve:"

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


# ===========================================================================
# Connector methods (Task 1)
# ===========================================================================


def _connector(fake: FakeProxmox):
    """Build a PVEConnector wired to the supplied FakeProxmox."""
    from app.clusters.connector import PVEConnector

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        return PVEConnector(
            host="pve.test", port=8006, token_user="gui-team-70@pve",
            token_name="api", token_value="secret", verify_ssl=False,
        )


@pytest.mark.asyncio
async def test_connector_create_qemu_posts_and_returns_upid() -> None:
    """create_qemu POSTs to nodes(node).qemu with vmid + config, returns the UPID."""
    fake = FakeProxmox(responses={"nodes.pve-01.qemu.post": {"data": _QEMU_UPID}})
    conn = _connector(fake)
    # Pre-seed a stale cache snapshot to confirm a mutating call clears it.
    conn._resource_cache.snapshot = [{"vmid": 1}]
    upid = await conn.create_qemu(
        node="pve-01", vmid=150, cores=2, memory=2048, name="vm-new",
    )
    assert upid == _QEMU_UPID
    assert conn._resource_cache.snapshot is None
    dotted, _args, kwargs = fake.calls[-1]
    assert dotted == "nodes.pve-01.qemu.post"
    assert kwargs["vmid"] == 150
    assert kwargs["cores"] == 2


@pytest.mark.asyncio
async def test_connector_create_lxc_posts_and_returns_upid() -> None:
    """create_lxc POSTs to nodes(node).lxc with vmid + ostemplate, returns the UPID."""
    fake = FakeProxmox(responses={"nodes.pve-01.lxc.post": {"data": _LXC_UPID}})
    conn = _connector(fake)
    upid = await conn.create_lxc(
        node="pve-01", vmid=150, ostemplate="local:vztmpl/debian-12.tar.zst",
        cores=1, memory=512,
    )
    assert upid == _LXC_UPID
    dotted, _args, kwargs = fake.calls[-1]
    assert dotted == "nodes.pve-01.lxc.post"
    assert kwargs["vmid"] == 150
    assert kwargs["ostemplate"] == "local:vztmpl/debian-12.tar.zst"


@pytest.mark.asyncio
async def test_connector_download_url_posts_and_returns_upid() -> None:
    """download_url POSTs to nodes(node).storage(storage) download-url, returns UPID."""
    fake = FakeProxmox(
        responses={"nodes.pve-01.storage.local.download-url.post": {"data": _DL_UPID}}
    )
    conn = _connector(fake)
    upid = await conn.download_url(
        node="pve-01", storage="local", content="iso",
        url="https://example.test/x.iso", filename="x.iso",
    )
    assert upid == _DL_UPID
    dotted, _args, kwargs = fake.calls[-1]
    assert dotted == "nodes.pve-01.storage.local.download-url.post"
    assert kwargs["content"] == "iso"
    assert kwargs["filename"] == "x.iso"


@pytest.mark.asyncio
async def test_connector_node_resources_reads_per_node_capacity() -> None:
    """node_resources GETs cluster/resources?type=node — per-node cpu/mem (VM-10)."""
    nodes = [
        {"node": "pve-01", "type": "node", "maxcpu": 16, "cpu": 0.25,
         "maxmem": 68719476736, "mem": 8589934592},
        {"node": "pve-02", "type": "node", "maxcpu": 8, "cpu": 0.10,
         "maxmem": 34359738368, "mem": 4294967296},
    ]
    fake = FakeProxmox(responses={"cluster.resources.get": nodes})
    conn = _connector(fake)
    # Pre-seed a cache snapshot — a read must NOT clear it.
    conn._resource_cache.snapshot = [{"vmid": 1}]
    result = await conn.node_resources()
    assert {n["node"] for n in result} == {"pve-01", "pve-02"}
    assert conn._resource_cache.snapshot == [{"vmid": 1}]
    dotted, _args, kwargs = fake.calls[-1]
    assert dotted == "cluster.resources.get"
    assert kwargs.get("type") == "node"


# ===========================================================================
# 0006_phase4 migration (Task 1)
# ===========================================================================


def _make_config(db_url: str) -> Config:
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


@pytest.fixture
def fresh_db(tmp_path: Path) -> str:
    return f"sqlite:///{tmp_path / 'provisioning_migrate.db'}"


def test_0006_phase4_creates_new_tables(fresh_db: str) -> None:
    """upgrade head creates network_scope / catalog_pin / notification_seen."""
    cfg = _make_config(fresh_db)
    command.upgrade(cfg, "head")
    engine = sa.create_engine(fresh_db)
    tables = set(sa.inspect(engine).get_table_names())
    engine.dispose()
    for t in ("network_scope", "catalog_pin", "notification_seen"):
        assert t in tables, f"{t} missing after upgrade head; got {tables}"


def test_0006_phase4_round_trips(fresh_db: str) -> None:
    """upgrade head → downgrade -1 → upgrade head — the migration round-trips."""
    cfg = _make_config(fresh_db)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "-1")
    engine = sa.create_engine(fresh_db)
    after_down = set(sa.inspect(engine).get_table_names())
    engine.dispose()
    for t in ("network_scope", "catalog_pin", "notification_seen"):
        assert t not in after_down, f"{t} still present after downgrade -1"
    # Back up — confirms the upgrade is replayable after a downgrade.
    command.upgrade(cfg, "head")
    engine2 = sa.create_engine(fresh_db)
    after_up = set(sa.inspect(engine2).get_table_names())
    engine2.dispose()
    for t in ("network_scope", "catalog_pin", "notification_seen"):
        assert t in after_up


def test_0006_phase4_revision_chains_after_0005() -> None:
    """0006_phase4 declares revision/down_revision correctly."""
    import re

    rev = BACKEND_DIR / "alembic" / "versions" / "0006_phase4.py"
    assert rev.exists(), "0006_phase4.py migration file is missing"
    content = rev.read_text()
    assert re.search(
        r'^\s*revision(?:\s*:\s*[^=]+)?\s*=\s*["\']0006_phase4["\']',
        content, re.MULTILINE,
    ), "revision id is not '0006_phase4'"
    assert re.search(
        r'^\s*down_revision(?:\s*:\s*[^=]+)?\s*=\s*["\']0005_phase3_backup_storage["\']',
        content, re.MULTILINE,
    ), "down_revision is not '0005_phase3_backup_storage'"
    assert "def upgrade" in content
    assert "def downgrade" in content


# ===========================================================================
# New ORM models + schema invariant (Task 1)
# ===========================================================================


def test_new_models_import_and_register() -> None:
    """The three new models import and register on Base.metadata."""
    from app.models import Base, CatalogPin, NetworkScope, NotificationSeen  # noqa: F401

    for t in ("network_scope", "catalog_pin", "notification_seen"):
        assert t in Base.metadata.tables, f"{t} not on Base.metadata"


def test_schema_invariant_still_passes_with_new_tables() -> None:
    """Pitfall A5: every non-allowlisted table carries team_id; the new tables
    are either team-scoped or explicitly allow-listed with a rationale."""
    from tests.test_schema_invariants import test_every_non_allowlisted_table_has_team_id

    test_every_non_allowlisted_table_has_team_id()


# ===========================================================================
# Provisioning module — routes + service + schemas + job functions (Task 2)
# ===========================================================================


async def _seed_cluster_and_token(
    session_factory, *, team_id: int, poolid: str | None = None,
    host: str = "pve-prov.test",
):
    """Seed Cluster + Team + TeamClusterToken; return (cluster_id, team_id, poolid)."""
    from app.models import Cluster, Team, TeamClusterToken

    poolid = poolid or f"gui-team-{team_id}"
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
    from app.models import Quota

    async with session_factory() as session:
        session.add(Quota(team_id=team_id, cluster_id=cluster_id,
                           vm_count=vm_count))
        await session.commit()


def _make_fake_for_provisioning():
    """A FakeProxmox pre-wired for create dispatch + nextid + resources."""
    fake = FakeProxmox(
        responses={
            "nodes.pve-01.qemu.post": {"data": _QEMU_UPID},
            "nodes.pve-01.lxc.post": {"data": _LXC_UPID},
            "cluster.nextid.get": 150,
        }
    )
    # resolve / quota admission read /cluster/resources.
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    return fake


@pytest.mark.asyncio
async def test_create_lxc_returns_202_with_vmid(client, session_factory) -> None:
    """POST .../provisioning/lxc → 202 {job_id,state,kind,vmid}; kind=lxc.create."""
    from app.models import Job

    user = await make_user(session_factory, username="provlxc", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=70,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_provisioning()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="provlxc",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/provisioning/lxc",
            json={
                "team_id": team_id, "node": "pve-01", "storage": "local-lvm",
                "ostemplate": "local:vztmpl/debian-12.tar.zst",
                "cpu_cores": 1, "memory_mb": 512, "disk_gb": 8,
                "hostname": "ct-new",
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["kind"] == "lxc.create"
    assert body["vmid"] == 150
    assert "job_id" in body and "state" in body

    async with session_factory() as db:
        rows = (await db.execute(
            sa.select(Job).where(Job.kind == "lxc.create")
        )).scalars().all()
    assert len(rows) == 1
    assert json.loads(rows[0].payload)["vmid"] == 150


@pytest.mark.asyncio
async def test_create_qemu_cloud_image_returns_202_with_vmid(
    client, session_factory
) -> None:
    """POST .../provisioning/qemu (cloud-image) → 202 with vmid; kind=vm.create.qemu."""
    from app.models import Job

    user = await make_user(session_factory, username="provqemu", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=71,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_provisioning()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="provqemu",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/provisioning/qemu",
            json={
                "team_id": team_id, "source_kind": "cloud-image",
                "node": "pve-01", "storage": "local-lvm",
                "cpu_cores": 2, "memory_mb": 2048, "disk_gb": 20,
                "name": "vm-new", "image_id": "local:iso/debian-12.qcow2",
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["kind"] == "vm.create.qemu"
    assert body["vmid"] == 150

    async with session_factory() as db:
        rows = (await db.execute(
            sa.select(Job).where(Job.kind == "vm.create.qemu")
        )).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_create_payload_carries_team_pool(client, session_factory) -> None:
    """The build payload's config carries pool=<TeamClusterToken.poolid> (Pitfall 5/7)."""
    from app.models import Job

    user = await make_user(session_factory, username="provpool", is_admin=False)
    # A poolid that is NOT str(team_id) — proves the column is read, not rebuilt.
    cluster_id, team_id, poolid = await _seed_cluster_and_token(
        session_factory, team_id=72, poolid="gui-team-72",
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_provisioning()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="provpool",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/provisioning/lxc",
            json={
                "team_id": team_id, "node": "pve-01", "storage": "local-lvm",
                "ostemplate": "local:vztmpl/debian-12.tar.zst",
                "cpu_cores": 1, "memory_mb": 512, "disk_gb": 8,
                "hostname": "ct-pool",
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text

    async with session_factory() as db:
        row = (await db.execute(
            sa.select(Job).where(Job.kind == "lxc.create")
        )).scalars().one()
    config = json.loads(row.payload)["config"]
    assert config.get("pool") == poolid


@pytest.mark.asyncio
async def test_create_rejected_when_quota_exceeded(client, session_factory) -> None:
    """A create that would exceed the team quota → 409 (admission before reserve)."""
    user = await make_user(session_factory, username="provquota", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=73,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)
    # The fixture pool has 2 VMs; a vm_count quota of 2 leaves zero headroom.
    await _set_team_quota(session_factory, team_id=team_id,
                          cluster_id=cluster_id, vm_count=2)

    fake = _make_fake_for_provisioning()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="provquota",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/provisioning/qemu",
            json={
                "team_id": team_id, "source_kind": "cloud-image",
                "node": "pve-01", "storage": "local-lvm",
                "cpu_cores": 2, "memory_mb": 2048, "disk_gb": 20,
                "name": "vm-q", "image_id": "local:iso/debian-12.qcow2",
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 409, resp.text


@pytest.mark.asyncio
async def test_create_cross_tenant_team_returns_403(client, session_factory) -> None:
    """A create for a team the principal does not belong to → 403 (T-04-04-01)."""
    user = await make_user(session_factory, username="provxt", is_admin=False)
    # Seed a team the user is NOT a member of.
    cluster_id, other_team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=74,
    )
    # The user has only their personal team — not team 74.

    fake = _make_fake_for_provisioning()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="provxt",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/provisioning/lxc",
            json={
                "team_id": other_team_id, "node": "pve-01",
                "storage": "local-lvm",
                "ostemplate": "local:vztmpl/debian-12.tar.zst",
                "cpu_cores": 1, "memory_mb": 512, "disk_gb": 8,
                "hostname": "ct-xt",
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_provisioning_job_accepted_response_has_vmid() -> None:
    """ProvisioningJobAcceptedResponse subclasses JobAcceptedResponse + adds vmid."""
    from app.lifecycle.schemas import JobAcceptedResponse
    from app.provisioning.schemas import ProvisioningJobAcceptedResponse

    assert issubclass(ProvisioningJobAcceptedResponse, JobAcceptedResponse)
    model = ProvisioningJobAcceptedResponse(
        job_id=1, state="pending", kind="lxc.create", vmid=150,
    )
    assert model.vmid == 150
    assert model.job_id == 1
    assert "vmid" in ProvisioningJobAcceptedResponse.model_fields


@pytest.mark.asyncio
async def test_run_create_qemu_dispatches_through_polled_job() -> None:
    """run_create_qemu builds a dispatch that calls connector.create_qemu."""
    import inspect as _inspect

    from app.jobs import provisioning_functions

    src = _inspect.getsource(provisioning_functions)
    assert "_run_polled_job" in src
    assert "connector.create_qemu" in src
    assert "connector.create_lxc" in src
    assert "connector.download_url" in src
    # The three job functions exist and are coroutines.
    for name in ("run_create_qemu", "run_create_lxc", "run_download"):
        fn = getattr(provisioning_functions, name)
        assert _inspect.iscoroutinefunction(fn)


def test_app_boots_with_provisioning_router() -> None:
    """create_app() succeeds and mounts a provisioning_create_lxc operation."""
    from app.main import create_app

    app = create_app()
    op_ids = {
        route.operation_id
        for route in app.routes
        if getattr(route, "operation_id", None)
    }
    assert "provisioning_create_lxc" in op_ids
    assert "provisioning_create_qemu" in op_ids
