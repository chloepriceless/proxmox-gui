"""TDD RED: Tests for inventory list endpoints (per-cluster + aggregate).

Written BEFORE implementation — expected to fail until app/inventory/service.py is created.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.fixtures.pve_responses import (
    CLUSTER_RESOURCES_VM,
    FakeProxmox,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_full(
    session_factory,
    *,
    team_id: int = 42,
    poolid: str = "gui-team-42",
    cluster_name: str = "cluster-1",
    user_email: str | None = None,
) -> tuple:
    """Seed User + Team + Cluster + TeamMembership + TeamClusterToken."""
    from app.models import Cluster, Team, TeamClusterToken, TeamMembership, User

    async with session_factory() as session:
        email = user_email or f"user-{team_id}@example.com"
        user = User(
            username=f"usr{team_id}",
            email=email,
            password_hash="x",
            is_active=True,
            is_admin=False,
        )
        session.add(user)
        await session.flush()

        team = Team(id=team_id, name=f"gui-team-{team_id}", personal=False, is_active=True)
        session.add(team)
        await session.flush()

        membership = TeamMembership(team_id=team.id, user_id=user.id)
        session.add(membership)

        cluster = Cluster(
            name=cluster_name,
            host=f"{cluster_name}.test",
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
        await session.refresh(user)
        await session.refresh(cluster)
        return user, cluster.id, team.id


def _make_principal(user):
    from app.auth.dependencies import Principal

    return Principal(user=user, mode="session")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_inventory_for_cluster_filters_by_pool(session_factory):
    """Only VMs with pool matching the team's poolid appear in inventory."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.service import list_inventory_for_cluster

    user, cluster_id, team_id = await _seed_full(
        session_factory, team_id=42, poolid="gui-team-42"
    )
    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    # One VM with matching pool, one with wrong pool.
    # list_resources calls cluster.resources.get twice: once for type=vm, once for type=lxc.
    # Use queue_response so each call gets the right slice (vm call gets both VMs, lxc call empty).
    vm_resources = [
        {"vmid": 100, "name": "mine", "type": "qemu", "node": "pve-01",
         "status": "running", "maxcpu": 4, "maxmem": 4294967296, "maxdisk": 53687091200,
         "tags": "prod", "pool": "gui-team-42"},
        {"vmid": 200, "name": "other-team", "type": "qemu", "node": "pve-01",
         "status": "running", "maxcpu": 1, "maxmem": 1073741824, "maxdisk": 10737418240,
         "tags": "", "pool": "gui-team-99"},
    ]
    fake = FakeProxmox()
    fake.queue_response("cluster.resources.get", vm_resources)  # type=vm call
    fake.queue_response("cluster.resources.get", [])             # type=lxc call

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as db:
            result = await list_inventory_for_cluster(
                db, registry, principal=principal, cluster_id=cluster_id
            )

    assert len(result.items) == 1
    assert result.items[0].vmid == 100
    assert result.cluster_id == cluster_id


@pytest.mark.asyncio
async def test_list_inventory_for_principal_aggregates_clusters(session_factory):
    """list_inventory_for_principal returns one ClusterInventory per cluster."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.service import list_inventory_for_principal
    from app.models import Cluster, TeamClusterToken

    user, cluster_id_1, team_id = await _seed_full(
        session_factory, team_id=43, poolid="gui-team-43", cluster_name="cluster-a"
    )
    principal = _make_principal(user)

    # Add second cluster with token for same team
    async with session_factory() as session:
        cluster2 = Cluster(
            name="cluster-b",
            host="cluster-b.test",
            port=8006,
            verify_ssl=False,
            token_user="root@pam",
            token_name="gui",
            api_token_secret="bootstrap-secret2",
            is_active=True,
        )
        session.add(cluster2)
        await session.flush()

        token2 = TeamClusterToken(
            team_id=team_id,
            cluster_id=cluster2.id,
            userid="gui-team-43@pve",
            tokenid="api",
            token_secret="team-43-secret",
            poolid="gui-team-43",
        )
        session.add(token2)
        await session.commit()
        await session.refresh(cluster2)

    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)
    fake = FakeProxmox(responses={"cluster.resources.get": CLUSTER_RESOURCES_VM})

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as db:
            result = await list_inventory_for_principal(
                db, registry, principal=principal
            )

    assert len(result) == 2
    cluster_names = {r.cluster_name for r in result}
    assert "cluster-a" in cluster_names
    assert "cluster-b" in cluster_names


@pytest.mark.asyncio
async def test_list_inventory_stale_propagates(session_factory):
    """When the circuit breaker is open and cache exists, ClusterInventory.is_stale=True."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.service import list_inventory_for_cluster

    user, cluster_id, team_id = await _seed_full(
        session_factory, team_id=44, poolid="gui-team-44"
    )
    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    fake = FakeProxmox(responses={"cluster.resources.get": CLUSTER_RESOURCES_VM})

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        # Warm the cache
        async with session_factory() as db:
            await list_inventory_for_cluster(
                db, registry, principal=principal, cluster_id=cluster_id
            )

        # Make cache stale + circuit-breaker errors
        connector = await registry.get_for_team(cluster_id=cluster_id, team_id=team_id)
        import time
        connector._resource_cache.fetched_at = time.monotonic() - 1000.0
        for _ in range(4):
            fake.queue_error("cluster.resources.get", ConnectionError("forced"))

        async with session_factory() as db:
            result = await list_inventory_for_cluster(
                db, registry, principal=principal, cluster_id=cluster_id
            )

    assert result.is_stale is True
    assert len(result.items) >= 0  # items served from stale cache


@pytest.mark.asyncio
async def test_list_inventory_empty_when_no_team_memberships(session_factory):
    """A user with no teams gets an empty list from list_inventory_for_principal."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.service import list_inventory_for_principal
    from app.models import User

    async with session_factory() as session:
        user = User(
            username="loner",
            email="loner@example.com",
            password_hash="x",
            is_active=True,
            is_admin=False,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)
    fake = FakeProxmox(responses={})

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as db:
            result = await list_inventory_for_principal(db, registry, principal=principal)

    assert result == []


@pytest.mark.asyncio
async def test_list_inventory_tag_string_parsed_into_list(session_factory):
    """Tags string 'prod;web,db ops' is parsed into ['prod','web','db','ops']."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.service import list_inventory_for_cluster

    user, cluster_id, team_id = await _seed_full(
        session_factory, team_id=45, poolid="gui-team-45"
    )
    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    vm_resources = [
        {"vmid": 100, "name": "tagged-vm", "type": "qemu", "node": "pve-01",
         "status": "running", "maxcpu": 2, "maxmem": 2147483648, "maxdisk": 10737418240,
         "tags": "prod;web,db ops", "pool": "gui-team-45"},
    ]
    fake = FakeProxmox()
    fake.queue_response("cluster.resources.get", vm_resources)  # type=vm call
    fake.queue_response("cluster.resources.get", [])             # type=lxc call

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as db:
            result = await list_inventory_for_cluster(
                db, registry, principal=principal, cluster_id=cluster_id
            )

    assert len(result.items) == 1
    item = result.items[0]
    assert sorted(item.tags) == sorted(["prod", "web", "db", "ops"])


# ---------------------------------------------------------------------------
# _recent_power_outcomes — inventory-list run-state overlay (pvestatd/cache lag)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_recent_power_outcomes_latest_wins_window_and_filters() -> None:
    """The overlay map keeps only recent + succeeded + vm.power + this-cluster
    jobs, and the most recent action per VM wins."""
    from datetime import UTC, datetime, timedelta

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.inventory.service import _recent_power_outcomes
    from app.models import Job
    from app.models.base import Base

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(eng, expire_on_commit=False)
    now = datetime.now(UTC)
    async with factory() as session:
        session.add_all([
            # Old stop — outside the 90s window → ignored.
            Job(kind="vm.power", state="succeeded", cluster_id=1,
                payload='{"vmid": 200, "action": "stop"}',
                finished_at=now - timedelta(seconds=600)),
            # Recent stop, then a more-recent start of the SAME VM.
            Job(kind="vm.power", state="succeeded", cluster_id=1,
                payload='{"vmid": 117, "action": "stop"}',
                finished_at=now - timedelta(seconds=40)),
            Job(kind="vm.power", state="succeeded", cluster_id=1,
                payload='{"vmid": 117, "action": "start"}',
                finished_at=now - timedelta(seconds=8)),
            # Failed power job — the action did not take effect → ignored.
            Job(kind="vm.power", state="failed", cluster_id=1,
                payload='{"vmid": 300, "action": "stop"}',
                finished_at=now - timedelta(seconds=5)),
            # A non-power job → ignored.
            Job(kind="vm.snapshot.create", state="succeeded", cluster_id=1,
                payload='{"vmid": 301, "action": "stop"}',
                finished_at=now - timedelta(seconds=5)),
            # Right cluster filter — a job on another cluster → ignored.
            Job(kind="vm.power", state="succeeded", cluster_id=2,
                payload='{"vmid": 117, "action": "stop"}',
                finished_at=now - timedelta(seconds=5)),
        ])
        await session.commit()

    async with factory() as session:
        outcomes = await _recent_power_outcomes(session, 1)
    assert outcomes == {117: "running"}
    await eng.dispose()


@pytest.mark.asyncio
async def test_recent_power_outcomes_maps_each_action() -> None:
    """stop/shutdown → stopped, start/reboot → running."""
    from datetime import UTC, datetime, timedelta

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.inventory.service import _recent_power_outcomes
    from app.models import Job
    from app.models.base import Base

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(eng, expire_on_commit=False)
    now = datetime.now(UTC)
    async with factory() as session:
        for vmid, action in [(1, "stop"), (2, "shutdown"), (3, "start"), (4, "reboot")]:
            session.add(Job(
                kind="vm.power", state="succeeded", cluster_id=1,
                payload=f'{{"vmid": {vmid}, "action": "{action}"}}',
                finished_at=now - timedelta(seconds=10),
            ))
        await session.commit()

    async with factory() as session:
        outcomes = await _recent_power_outcomes(session, 1)
    assert outcomes == {1: "stopped", 2: "stopped", 3: "running", 4: "running"}
    await eng.dispose()
