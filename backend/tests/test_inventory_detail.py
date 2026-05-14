"""TDD RED: Tests for VM/LXC detail endpoint.

Written BEFORE implementation — expected to fail until app/inventory/service.py exists.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.fixtures.pve_responses import (
    CLUSTER_RESOURCES_LXC,
    CLUSTER_RESOURCES_VM,
    FakeProxmox,
    VM_CONFIG,
    VM_STATUS_RUNNING,
)


# ---------------------------------------------------------------------------
# Helpers (shared with test_inventory_list.py style)
# ---------------------------------------------------------------------------


async def _seed_full(
    session_factory,
    *,
    team_id: int = 42,
    poolid: str = "gui-team-42",
) -> tuple:
    from app.models import Cluster, Team, TeamClusterToken, TeamMembership, User

    async with session_factory() as session:
        user = User(
            email=f"detail-user-{team_id}@example.com",
            hashed_password="x",
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
            name="detail-cluster",
            host="pve-detail.test",
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


async def _make_resolved(session_factory, registry, principal, cluster_id, vmid=100):
    from app.inventory.access import resolve_resource

    async with session_factory() as db:
        return await resolve_resource(
            db=db,
            registry=registry,
            principal=principal,
            cluster_id=cluster_id,
            vmid=vmid,
        )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_vm_detail_merges_status_and_config(session_factory):
    """VMDetail merges status payload + config payload correctly."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.service import get_vm_detail

    user, cluster_id, team_id = await _seed_full(session_factory, team_id=42, poolid="gui-team-42")
    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    fake = FakeProxmox(responses={
        "cluster.resources.get": CLUSTER_RESOURCES_VM,
        "nodes.pve-01.qemu.100.status.current.get": VM_STATUS_RUNNING,
        "nodes.pve-01.qemu.100.config.get": VM_CONFIG,
    })

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resolved = await _make_resolved(session_factory, registry, principal, cluster_id, vmid=100)

        async with session_factory() as db:
            detail = await get_vm_detail(db, resolved=resolved)

    assert abs(detail.cpu - 0.12) < 0.001
    assert detail.description == "test VM"
    assert "prod" in detail.tags
    assert detail.status == "running"
    assert detail.vmid == 100
    assert detail.type == "qemu"


@pytest.mark.asyncio
async def test_get_vm_detail_for_lxc_calls_lxc_paths(session_factory):
    """For LXC type, the connector calls lxc.* paths, not qemu.* paths."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.access import resolve_resource
    from app.inventory.service import get_vm_detail

    user, cluster_id, team_id = await _seed_full(session_factory, team_id=46, poolid="gui-team-42")
    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    lxc_status = {"data": {"status": "running", "uptime": 500, "cpu": 0.05,
                           "mem": 536870912, "maxmem": 1073741824,
                           "netin": 10, "netout": 20, "diskread": 5, "diskwrite": 6}}
    lxc_config = {"data": {"hostname": "lxc-a", "description": "lxc notes", "tags": "infra"}}

    fake = FakeProxmox(responses={
        "cluster.resources.get": CLUSTER_RESOURCES_LXC,
        "nodes.pve-01.lxc.200.status.current.get": lxc_status,
        "nodes.pve-01.lxc.200.config.get": lxc_config,
    })

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as db:
            resolved = await resolve_resource(
                db=db,
                registry=registry,
                principal=principal,
                cluster_id=cluster_id,
                vmid=200,
            )

        async with session_factory() as db:
            detail = await get_vm_detail(db, resolved=resolved)

    # Assert LXC paths were called
    lxc_calls = [c[0] for c in fake.calls if "lxc" in c[0].lower()]
    assert any("lxc" in c for c in lxc_calls)
    assert detail.type == "lxc"
    assert detail.vmid == 200


@pytest.mark.asyncio
async def test_get_vm_detail_stopped_vm_zero_values_no_error(session_factory):
    """A stopped VM with all-zero status fields validates without error."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.service import get_vm_detail

    user, cluster_id, team_id = await _seed_full(session_factory, team_id=47, poolid="gui-team-42")
    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    stopped_status = {"data": {"status": "stopped", "uptime": 0, "cpu": 0,
                               "mem": 0, "maxmem": 4294967296, "netin": 0, "netout": 0,
                               "diskread": 0, "diskwrite": 0}}
    stopped_config = {"data": {"name": "vm-stopped", "cores": 2, "memory": 2048,
                               "tags": "", "description": ""}}

    fake = FakeProxmox(responses={
        "cluster.resources.get": CLUSTER_RESOURCES_VM,
        "nodes.pve-01.qemu.100.status.current.get": stopped_status,
        "nodes.pve-01.qemu.100.config.get": stopped_config,
    })

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resolved = await _make_resolved(session_factory, registry, principal, cluster_id, vmid=100)

        async with session_factory() as db:
            detail = await get_vm_detail(db, resolved=resolved)

    assert detail.status == "stopped"
    assert detail.cpu == 0.0
    assert detail.mem == 0
    assert detail.uptime == 0
