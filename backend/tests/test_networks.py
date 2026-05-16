"""Phase 4 Plan 04-07 — the networks backend: SDN connector reads, the
per-team network-scoping CRUD, the SDN-aware picker service + the routes.

TDD: written alongside the SDN/bridge connector reads + ``networks/scoping.py``
+ ``networks/service.py`` + ``networks/routes.py``.

The read-API contract is pinned by spike 04-02 (``04-SPIKE-sdn.md``):

- SDN/bridge reads run against the CLUSTER-ADMIN connector — a per-team
  privsep token cannot enumerate SDN (``GET /cluster/sdn`` → ``403 SDN.Audit``
  and ``GET /nodes/{node}/network`` → ``[]`` for that token). Per-team scoping
  is applied APP-SIDE.
- Applied-vs-pending: a VNet is usable only when its ``state`` field is
  empty/absent (§2 of the spike).
- IPAM free-IP: option b — computed app-side from
  ``GET /cluster/sdn/ipams/{ipam}/status`` + the subnet CIDR (§3).
- Legacy bridges: ``GET /nodes/{node}/network?type=any_bridge`` per node,
  deduped by ``iface`` (§5).
- SDN version floor: PVE 8.1; detection via ``GET /cluster/sdn/zones``
  returning 200 + non-empty after the applied-filter (§4).

Task 1 covers the connector reads + the scoping CRUD.
Task 2 covers the picker service + the routes.

Proxmox REST is exercised through ``FakeProxmox`` (proxmoxer 2.3 is sync).
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import FakeProxmox

# ---------------------------------------------------------------------------
# Canned SDN / bridge payloads — shaped per the 04-SPIKE-sdn.md field set.
# ---------------------------------------------------------------------------

# Zones: dc1 has the built-in `pve` IPAM; dmz has no IPAM (DHCP-only degrade).
SDN_ZONES = [
    {"zone": "dc1", "type": "vxlan", "ipam": "pve", "state": "", "mtu": 1500},
    {"zone": "dmz", "type": "vlan", "state": "", "mtu": 1500},
    {"zone": "draft", "type": "vlan", "ipam": "pve", "state": "new"},
]

# VNets: prod is applied (state empty), staging is pending (state="changed").
SDN_VNETS = [
    {"vnet": "prod", "zone": "dc1", "tag": 100, "type": "vnet", "state": ""},
    {"vnet": "mail", "zone": "dmz", "tag": 200, "type": "vnet", "state": ""},
    {"vnet": "staging", "zone": "dc1", "tag": 101, "type": "vnet",
     "state": "changed", "pending": {"tag": 101}},
]

SDN_SUBNETS_PROD = [
    {"subnet": "dc1-10.0.0.0-24", "cidr": "10.0.0.0/24", "gateway": "10.0.0.1"},
]

# IPAM status — the allocated set. 10.0.0.1 is the gateway, .2/.3 are taken.
SDN_IPAM_STATUS = [
    {"ip": "10.0.0.1", "vnet": "prod", "zone": "dc1"},
    {"ip": "10.0.0.2", "vnet": "prod", "zone": "dc1", "vmid": 100},
    {"ip": "10.0.0.3", "vnet": "prod", "zone": "dc1", "vmid": 101},
]

# Legacy bridges — per node; vmbr0 appears on both nodes (dedup by iface).
NODE1_BRIDGES = [
    {"iface": "vmbr0", "type": "bridge", "cidr": "192.168.20.241/24",
     "gateway": "192.168.20.1", "bridge_vlan_aware": 1, "active": 1},
    {"iface": "vmbr1", "type": "bridge", "cidr": "192.168.10.241/24",
     "active": 1},
]
NODE2_BRIDGES = [
    {"iface": "vmbr0", "type": "bridge", "cidr": "192.168.20.242/24",
     "gateway": "192.168.20.1", "bridge_vlan_aware": 1, "active": 1},
]


def _connector(fake: FakeProxmox):
    """Build a PVEConnector wired to the supplied FakeProxmox."""
    from app.clusters.connector import PVEConnector

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        return PVEConnector(
            host="pve.test", port=8006, token_user="root@pam",
            token_name="gui", token_value="secret", verify_ssl=False,
        )


# ===========================================================================
# Connector SDN/bridge reads (Task 1)
# ===========================================================================


@pytest.mark.asyncio
async def test_connector_sdn_zones_reads_cluster_sdn_zones() -> None:
    """sdn_zones() issues GET /cluster/sdn/zones and returns the parsed list."""
    fake = FakeProxmox(responses={"cluster.sdn.zones.get": SDN_ZONES})
    conn = _connector(fake)
    zones = await conn.sdn_zones()
    assert {z["zone"] for z in zones} == {"dc1", "dmz", "draft"}
    assert ("cluster.sdn.zones.get", (), {}) in fake.calls


@pytest.mark.asyncio
async def test_connector_sdn_vnets_reads_cluster_sdn_vnets() -> None:
    """sdn_vnets() issues GET /cluster/sdn/vnets and returns the parsed list."""
    fake = FakeProxmox(responses={"cluster.sdn.vnets.get": SDN_VNETS})
    conn = _connector(fake)
    vnets = await conn.sdn_vnets()
    assert {v["vnet"] for v in vnets} == {"prod", "mail", "staging"}
    # Each VNet carries its zone link (the IPAM-association join key — §1).
    assert {v["zone"] for v in vnets} == {"dc1", "dmz"}
    assert ("cluster.sdn.vnets.get", (), {}) in fake.calls


@pytest.mark.asyncio
async def test_connector_sdn_subnets_reads_per_vnet_subnet_path() -> None:
    """sdn_subnets(vnet=) issues GET /cluster/sdn/vnets/{vnet}/subnets."""
    fake = FakeProxmox(
        responses={"cluster.sdn.vnets.prod.subnets.get": SDN_SUBNETS_PROD}
    )
    conn = _connector(fake)
    subnets = await conn.sdn_subnets(vnet="prod")
    assert subnets[0]["cidr"] == "10.0.0.0/24"
    assert ("cluster.sdn.vnets.prod.subnets.get", (), {}) in fake.calls


@pytest.mark.asyncio
async def test_connector_sdn_ipam_status_reads_ipam_status_path() -> None:
    """sdn_ipam_status(ipam=) issues GET /cluster/sdn/ipams/{ipam}/status."""
    fake = FakeProxmox(
        responses={"cluster.sdn.ipams.pve.status.get": SDN_IPAM_STATUS}
    )
    conn = _connector(fake)
    status = await conn.sdn_ipam_status(ipam="pve")
    assert {row["ip"] for row in status} == {"10.0.0.1", "10.0.0.2", "10.0.0.3"}
    assert ("cluster.sdn.ipams.pve.status.get", (), {}) in fake.calls


@pytest.mark.asyncio
async def test_connector_node_bridges_reads_any_bridge_per_node() -> None:
    """node_bridges(node=) issues GET /nodes/{node}/network?type=any_bridge."""
    fake = FakeProxmox(responses={"nodes.pve-01.network.get": NODE1_BRIDGES})
    conn = _connector(fake)
    bridges = await conn.node_bridges(node="pve-01")
    assert {b["iface"] for b in bridges} == {"vmbr0", "vmbr1"}
    # The ?type=any_bridge query param is the spike's LEGACY BRIDGE READ verdict.
    net_calls = [c for c in fake.calls if c[0] == "nodes.pve-01.network.get"]
    assert net_calls and net_calls[0][2].get("type") == "any_bridge"


def test_connector_sdn_reads_route_through_breaker() -> None:
    """The new SDN/bridge reads call _call_with_breaker — no raw proxmoxer call."""
    import inspect

    from app.clusters.connector import PVEConnector

    for name in ("sdn_zones", "sdn_vnets", "sdn_subnets", "node_bridges",
                 "sdn_ipam_status"):
        src = inspect.getsource(getattr(PVEConnector, name))
        assert "_call_with_breaker" in src, f"{name} bypasses the breaker"


@pytest.mark.asyncio
async def test_connector_sdn_read_does_not_clear_resource_cache() -> None:
    """The SDN/bridge reads are pure reads — they must not clear the cache."""
    fake = FakeProxmox(responses={"cluster.sdn.zones.get": SDN_ZONES})
    conn = _connector(fake)
    conn._resource_cache.snapshot = [{"vmid": 1}]
    await conn.sdn_zones()
    assert conn._resource_cache.snapshot == [{"vmid": 1}]


# ===========================================================================
# Per-team network-scoping CRUD (Task 1)
# ===========================================================================


async def _seed_team_and_cluster(session_factory, *, team_id: int):
    """Insert a Team + Cluster row; return (team_id, cluster_id)."""
    from app.models import Cluster, Team

    async with session_factory() as session:
        team = Team(id=team_id, name=f"gui-team-{team_id}", personal=False,
                    is_active=True)
        session.add(team)
        await session.flush()
        cluster = Cluster(
            name=f"cluster-{team_id}", host="pve.test", port=8006,
            verify_ssl=False, token_user="root@pam", token_name="gui",
            api_token_secret="bootstrap-secret", is_active=True,
        )
        session.add(cluster)
        await session.flush()
        cid = cluster.id
        await session.commit()
        return team_id, cid


@pytest.mark.asyncio
async def test_get_team_network_scope_empty_for_unscoped_team(
    session_factory,
) -> None:
    """An un-scoped team returns an empty grant set (D-19 — legacy bridges
    are still default-visible; SDN VNets are simply not yet granted)."""
    from app.networks import scoping

    team_id, cluster_id = await _seed_team_and_cluster(session_factory,
                                                       team_id=10)
    async with session_factory() as db:
        scope = await scoping.get_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_id,
        )
    assert scope == {"sdn_vnets": [], "bridges": []}


@pytest.mark.asyncio
async def test_set_team_network_scope_inserts_grants(session_factory) -> None:
    """set_team_network_scope upserts NetworkScope rows grouped by kind."""
    from app.networks import scoping

    team_id, cluster_id = await _seed_team_and_cluster(session_factory,
                                                       team_id=11)
    async with session_factory() as db:
        await scoping.set_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_id,
            sdn_vnets=["prod", "mail"], bridges=["vmbr1"],
        )
    async with session_factory() as db:
        scope = await scoping.get_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_id,
        )
    assert sorted(scope["sdn_vnets"]) == ["mail", "prod"]
    assert scope["bridges"] == ["vmbr1"]


@pytest.mark.asyncio
async def test_set_team_network_scope_removes_revoked_grants(
    session_factory,
) -> None:
    """A second call with a smaller grant set deletes the revoked rows."""
    from app.networks import scoping

    team_id, cluster_id = await _seed_team_and_cluster(session_factory,
                                                       team_id=12)
    async with session_factory() as db:
        await scoping.set_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_id,
            sdn_vnets=["prod", "mail"], bridges=["vmbr0", "vmbr1"],
        )
    async with session_factory() as db:
        await scoping.set_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_id,
            sdn_vnets=["prod"], bridges=[],
        )
    async with session_factory() as db:
        scope = await scoping.get_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_id,
        )
    assert scope == {"sdn_vnets": ["prod"], "bridges": []}


@pytest.mark.asyncio
async def test_set_team_network_scope_is_idempotent_on_duplicate_grant(
    session_factory,
) -> None:
    """Re-writing the same grant set does not violate the composite UNIQUE
    index — the upsert is idempotent (no IntegrityError)."""
    from sqlalchemy import func, select

    from app.models import NetworkScope
    from app.networks import scoping

    team_id, cluster_id = await _seed_team_and_cluster(session_factory,
                                                       team_id=13)
    grant = dict(sdn_vnets=["prod"], bridges=["vmbr0"])
    for _ in range(3):
        async with session_factory() as db:
            await scoping.set_team_network_scope(
                db, team_id=team_id, cluster_id=cluster_id, **grant,
            )
    async with session_factory() as db:
        count = (await db.execute(
            select(func.count()).select_from(NetworkScope).where(
                NetworkScope.team_id == team_id,
                NetworkScope.cluster_id == cluster_id,
            )
        )).scalar_one()
    # Two grants total — one sdn-vnet + one bridge — never duplicated.
    assert count == 2


@pytest.mark.asyncio
async def test_network_scope_is_per_cluster_isolated(session_factory) -> None:
    """A grant on one cluster does not leak into another cluster's scope."""
    from app.models import Cluster
    from app.networks import scoping

    team_id, cluster_a = await _seed_team_and_cluster(session_factory,
                                                      team_id=14)
    async with session_factory() as session:
        cluster_b = Cluster(
            name="cluster-b", host="pve-b.test", port=8006, verify_ssl=False,
            token_user="root@pam", token_name="gui",
            api_token_secret="secret-b", is_active=True,
        )
        session.add(cluster_b)
        await session.flush()
        cluster_b_id = cluster_b.id
        await session.commit()

    async with session_factory() as db:
        await scoping.set_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_a,
            sdn_vnets=["prod"], bridges=[],
        )
    async with session_factory() as db:
        scope_b = await scoping.get_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_b_id,
        )
    assert scope_b == {"sdn_vnets": [], "bridges": []}
