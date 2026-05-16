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


# ===========================================================================
# SDN-aware picker service + the networks routes (Task 2)
# ===========================================================================

VERSION_PVE9 = {"data": {"version": "9.1.2", "release": "9.1", "repoid": "x"}}
VERSION_PVE7 = {"data": {"version": "7.4.1", "release": "7.4", "repoid": "y"}}


async def _seed_full(session_factory, *, team_id: int, with_membership_user=None):
    """Seed Team + Cluster + TeamClusterToken (+ optional membership).

    Returns (cluster_id, team_id, poolid).
    """
    from app.models import Cluster, Team, TeamClusterToken, TeamMembership

    poolid = f"gui-team-{team_id}"
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
        session.add(TeamClusterToken(
            team_id=team.id, cluster_id=cid,
            userid=f"gui-team-{team_id}@pve", tokenid="api",
            token_secret=f"team-{team_id}-secret", poolid=poolid,
        ))
        if with_membership_user is not None:
            session.add(TeamMembership(team_id=team.id,
                                       user_id=with_membership_user))
        await session.commit()
        return cid, team_id, poolid


def _fake_sdn_cluster(*, vnets=None, zones=None, version=None,
                      bridge_nodes=None, ipam_status=None,
                      subnets_by_vnet=None):
    """A FakeProxmox pre-wired for the SDN picker reads."""
    fake = FakeProxmox(responses={
        "version.get": version or VERSION_PVE9,
        "cluster.sdn.zones.get": zones if zones is not None else SDN_ZONES,
        "cluster.sdn.vnets.get": vnets if vnets is not None else SDN_VNETS,
        "cluster.sdn.ipams.pve.status.get":
            ipam_status if ipam_status is not None else SDN_IPAM_STATUS,
        "nodes.get": [{"node": n} for n in (bridge_nodes or {"pve-01"})],
    })
    sb = subnets_by_vnet if subnets_by_vnet is not None else {
        "prod": SDN_SUBNETS_PROD,
    }
    for vnet, subnets in sb.items():
        fake.responses[f"cluster.sdn.vnets.{vnet}.subnets.get"] = subnets
    for node, bridges in (bridge_nodes or {"pve-01": NODE1_BRIDGES}).items():
        fake.responses[f"nodes.{node}.network.get"] = bridges
    return fake


@pytest.mark.asyncio
async def test_picker_unscoped_team_sees_bridges_only(session_factory) -> None:
    """An un-scoped team on an SDN cluster: legacy bridges (D-19) + EMPTY
    sdn_vnets group."""
    from app.networks import service

    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=20)
    fake = _fake_sdn_cluster(bridge_nodes={"pve-01": NODE1_BRIDGES})
    from app.clusters.registry import PVEConnectorRegistry

    async with session_factory() as db:
        registry = PVEConnectorRegistry(None, session_factory)
        with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
            resp = await service.list_networks_for_team(
                db, registry, cluster_id=cluster_id, team_id=team_id,
            )
    assert resp.sdn_vnets == []
    assert {b.network_id for b in resp.bridges} == {"vmbr0", "vmbr1"}
    assert resp.sdn_capable is True


@pytest.mark.asyncio
async def test_picker_shows_only_granted_vnets(session_factory) -> None:
    """After an admin grants a VNet, it appears in the picker; un-granted
    VNets do not."""
    from app.networks import scoping, service
    from app.clusters.registry import PVEConnectorRegistry

    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=21)
    async with session_factory() as db:
        await scoping.set_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_id,
            sdn_vnets=["prod"], bridges=[],
        )
    fake = _fake_sdn_cluster(bridge_nodes={"pve-01": NODE1_BRIDGES})
    async with session_factory() as db:
        registry = PVEConnectorRegistry(None, session_factory)
        with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
            resp = await service.list_networks_for_team(
                db, registry, cluster_id=cluster_id, team_id=team_id,
            )
    # Only "prod" was granted — "mail" / "staging" are hidden.
    assert {v.network_id for v in resp.sdn_vnets} == {"prod"}


@pytest.mark.asyncio
async def test_picker_vnet_carries_applied_and_ipam_flags(
    session_factory,
) -> None:
    """Each VNet carries `applied` (state-derived) + `ipam_available`; a
    granted IPAM-backed applied VNet gets a suggested_ip."""
    from app.networks import scoping, service
    from app.clusters.registry import PVEConnectorRegistry

    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=22)
    async with session_factory() as db:
        # Grant prod (applied, dc1 has IPAM) + mail (applied, dmz no IPAM)
        # + staging (pending).
        await scoping.set_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_id,
            sdn_vnets=["prod", "mail", "staging"], bridges=[],
        )
    fake = _fake_sdn_cluster(bridge_nodes={"pve-01": NODE1_BRIDGES})
    async with session_factory() as db:
        registry = PVEConnectorRegistry(None, session_factory)
        with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
            resp = await service.list_networks_for_team(
                db, registry, cluster_id=cluster_id, team_id=team_id,
            )
    by_id = {v.network_id: v for v in resp.sdn_vnets}
    # prod: applied, IPAM-backed (dc1 has ipam=pve) → suggested_ip computed.
    assert by_id["prod"].applied is True
    assert by_id["prod"].ipam_available is True
    # .1 gw + .2 + .3 allocated → lowest free is .4.
    assert by_id["prod"].suggested_ip == "10.0.0.4"
    # mail: applied but dmz has NO ipam → DHCP-only degrade (D-20).
    assert by_id["mail"].applied is True
    assert by_id["mail"].ipam_available is False
    assert by_id["mail"].suggested_ip is None
    # staging: pending (state="changed") → applied False (Pitfall 8).
    assert by_id["staging"].applied is False


@pytest.mark.asyncio
async def test_picker_non_sdn_cluster_bridges_only(session_factory) -> None:
    """On a non-SDN cluster (no zones), sdn_vnets is empty + sdn_capable
    False; legacy bridges only (NET-04, D-21)."""
    from app.networks import service
    from app.clusters.registry import PVEConnectorRegistry

    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=23)
    # Empty zones AND empty vnets — SDN subsystem present but unconfigured.
    fake = _fake_sdn_cluster(zones=[], vnets=[],
                             bridge_nodes={"pve-01": NODE1_BRIDGES})
    async with session_factory() as db:
        registry = PVEConnectorRegistry(None, session_factory)
        with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
            resp = await service.list_networks_for_team(
                db, registry, cluster_id=cluster_id, team_id=team_id,
            )
    assert resp.sdn_vnets == []
    assert resp.sdn_capable is False
    assert {b.network_id for b in resp.bridges} == {"vmbr0", "vmbr1"}


@pytest.mark.asyncio
async def test_picker_pre_8_1_cluster_hides_sdn(session_factory) -> None:
    """A PVE 7.x cluster is below the SDN floor — sdn_capable False even if
    SDN endpoints would respond (D-21 version floor)."""
    from app.networks import service
    from app.clusters.registry import PVEConnectorRegistry

    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=24)
    fake = _fake_sdn_cluster(version=VERSION_PVE7,
                             bridge_nodes={"pve-01": NODE1_BRIDGES})
    async with session_factory() as db:
        registry = PVEConnectorRegistry(None, session_factory)
        with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
            resp = await service.list_networks_for_team(
                db, registry, cluster_id=cluster_id, team_id=team_id,
            )
    assert resp.sdn_capable is False
    assert resp.sdn_vnets == []


@pytest.mark.asyncio
async def test_picker_bridges_deduped_across_nodes(session_factory) -> None:
    """vmbr0 exists on two nodes — the picker dedups by iface (spike §5)."""
    from app.networks import service
    from app.clusters.registry import PVEConnectorRegistry

    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=25)
    fake = _fake_sdn_cluster(bridge_nodes={
        "pve-01": NODE1_BRIDGES, "pve-02": NODE2_BRIDGES,
    })
    async with session_factory() as db:
        registry = PVEConnectorRegistry(None, session_factory)
        with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
            resp = await service.list_networks_for_team(
                db, registry, cluster_id=cluster_id, team_id=team_id,
            )
    # vmbr0 (both nodes) + vmbr1 (node-1 only) → one vmbr0 entry, no dup.
    ids = [b.network_id for b in resp.bridges]
    assert sorted(ids) == ["vmbr0", "vmbr1"]
    assert ids.count("vmbr0") == 1


@pytest.mark.asyncio
async def test_picker_degrades_when_a_node_is_offline(session_factory) -> None:
    """One node's bridge read fails — the picker returns the reachable node's
    bridges instead of hard-failing (spike §6, Pitfall 8)."""
    from app.clusters.errors import PVEUnreachable
    from app.networks import service
    from app.clusters.registry import PVEConnectorRegistry

    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=26)
    fake = _fake_sdn_cluster(bridge_nodes={
        "pve-01": NODE1_BRIDGES, "pve-02": NODE2_BRIDGES,
    })
    # pve-02's bridge read raises — the offline node.
    fake.queue_error("nodes.pve-02.network.get", PVEUnreachable("node down"))
    async with session_factory() as db:
        registry = PVEConnectorRegistry(None, session_factory)
        with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
            resp = await service.list_networks_for_team(
                db, registry, cluster_id=cluster_id, team_id=team_id,
            )
    # pve-01 still reachable → vmbr0 + vmbr1 surface; no exception raised.
    assert {b.network_id for b in resp.bridges} == {"vmbr0", "vmbr1"}


# ---- Routes -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_networks_picker_route(client, session_factory) -> None:
    """GET /clusters/{id}/networks returns the grouped picker for the
    principal's team (NOT admin-gated)."""
    user = await make_user(session_factory, username="netuser",
                           is_admin=False)
    cluster_id, team_id, _ = await _seed_full(
        session_factory, team_id=30, with_membership_user=user.id,
    )
    fake = _fake_sdn_cluster(bridge_nodes={"pve-01": NODE1_BRIDGES})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="netuser",
                                 password="testpass12345")
        resp = await client.get(
            f"/api/v1/clusters/{cluster_id}/networks", cookies=cookies,
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "sdn_vnets" in body and "bridges" in body
    assert {b["network_id"] for b in body["bridges"]} == {"vmbr0", "vmbr1"}
    assert body["sdn_capable"] is True


@pytest.mark.asyncio
async def test_admin_get_team_network_scope_route(client, session_factory) -> None:
    """GET /admin/teams/{tid}/clusters/{cid}/networks (admin) returns the
    cluster inventory + the team's grants."""
    await make_user(session_factory, username="netadmin", is_admin=True)
    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=31)
    fake = _fake_sdn_cluster(bridge_nodes={"pve-01": NODE1_BRIDGES})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="netadmin",
                                 password="testpass12345")
        resp = await client.get(
            f"/api/v1/admin/teams/{team_id}/clusters/{cluster_id}/networks",
            cookies=cookies,
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # The admin view carries the cluster's full SDN/bridge inventory...
    assert {v["network_id"] for v in body["available_sdn_vnets"]} >= {"prod"}
    assert {b["network_id"] for b in body["available_bridges"]} == {"vmbr0",
                                                                    "vmbr1"}
    # ...plus the team's current (empty) grants.
    assert body["granted"] == {"sdn_vnets": [], "bridges": []}


@pytest.mark.asyncio
async def test_admin_get_team_network_scope_non_admin_403(
    client, session_factory,
) -> None:
    """A non-admin GET on the admin scope route → 403 (T-04-07-02)."""
    await make_user(session_factory, username="netplain", is_admin=False)
    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=32)
    cookies = await login_as(client, username="netplain",
                             password="testpass12345")
    resp = await client.get(
        f"/api/v1/admin/teams/{team_id}/clusters/{cluster_id}/networks",
        cookies=cookies,
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_admin_put_team_network_scope_saves_grants(
    client, session_factory,
) -> None:
    """PUT /admin/teams/{tid}/clusters/{cid}/networks (admin) saves grants
    via set_team_network_scope."""
    from app.networks import scoping

    await make_user(session_factory, username="netadmin2", is_admin=True)
    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=33)
    fake = _fake_sdn_cluster(bridge_nodes={"pve-01": NODE1_BRIDGES})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="netadmin2",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.put(
            f"/api/v1/admin/teams/{team_id}/clusters/{cluster_id}/networks",
            json={"sdn_vnets": ["prod"], "bridges": ["vmbr1"]},
            cookies=cookies, headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 200, resp.text
    async with session_factory() as db:
        scope = await scoping.get_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_id,
        )
    assert scope == {"sdn_vnets": ["prod"], "bridges": ["vmbr1"]}


@pytest.mark.asyncio
async def test_admin_put_team_network_scope_non_admin_403(
    client, session_factory,
) -> None:
    """A non-admin PUT on the admin scope route → 403 (T-04-07-02)."""
    await make_user(session_factory, username="netplain2", is_admin=False)
    cluster_id, team_id, _ = await _seed_full(session_factory, team_id=34)
    cookies = await login_as(client, username="netplain2",
                             password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    resp = await client.put(
        f"/api/v1/admin/teams/{team_id}/clusters/{cluster_id}/networks",
        json={"sdn_vnets": ["prod"], "bridges": []},
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 403, resp.text


def test_networks_router_is_mounted() -> None:
    """The networks router is wired into the app (the picker + admin routes)."""
    from app.main import create_app

    app = create_app()
    paths = {route.path for route in app.routes}
    assert "/api/v1/clusters/{cluster_id}/networks" in paths
    assert (
        "/api/v1/admin/teams/{team_id}/clusters/{cluster_id}/networks" in paths
    )
