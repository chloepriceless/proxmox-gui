"""SDN-aware network picker service — NET-01/03/04 (Plan 04-07).

Modelled on ``app.inventory.service`` (PVE reads + the Phase-2 stale-cache
graceful-degradation pattern). The read-API contract is pinned by spike 04-02
(``04-SPIKE-sdn.md``):

- **RBAC (load-bearing — spike §7):** a per-team privsep token CANNOT
  enumerate SDN — ``GET /cluster/sdn`` → ``403 SDN.Audit`` and
  ``GET /nodes/{node}/network`` → ``[]`` for that token. This service drives
  every SDN/bridge read with the **cluster-admin connector**
  (``registry.get``) and applies per-team scoping APP-SIDE via
  ``scoping.get_team_network_scope``. The per-team privsep token is never
  used for a network read.
- **Applied-vs-pending (§2):** a VNet is usable only when its ``state`` field
  is empty/absent. A non-empty ``state`` ⇒ ``applied=False`` (Pitfall 8 — the
  GUI never offers a VNet whose Linux bridge does not yet exist on the nodes).
- **SDN capability (§4, D-21):** the cluster is PVE 8.1+ AND
  ``sdn_zones()`` returns at least one APPLIED zone. Below 8.1, or with no
  applied zone, SDN is hidden and only legacy bridges are offered.
- **IPAM free-IP (§3, option b, D-20):** for a granted, applied VNet whose
  zone has an ``ipam`` set, the lowest unallocated host address is computed
  app-side from ``sdn_ipam_status`` + the subnet CIDR. A zone with no
  ``ipam`` degrades to DHCP-only (``ipam_available=False``, no suggested_ip).
- **Legacy bridges (§5):** ``node_bridges`` per node, deduped by ``iface``.
- **Partial-node-offline (§6):** per-node bridge reads are wrapped — an
  offline node is skipped, the reachable nodes' bridges still surface.
"""

from __future__ import annotations

import ipaddress

from sqlalchemy.ext.asyncio import AsyncSession

from app.clusters.connector import PVEConnector
from app.clusters.registry import PVEConnectorRegistry
from app.networks import scoping
from app.networks.schemas import NetworkOption, NetworkPickerResponse

# D-21 / spike §4 — SDN core is stable from PVE 8.1; below it, SDN is hidden.
_SDN_VERSION_FLOOR = (8, 1)


def _release_tuple(release: str | None) -> tuple[int, int]:
    """Parse a PVE ``release`` string (e.g. ``"9.1"``) into ``(major, minor)``.

    An unparseable value yields ``(0, 0)`` — treated as below the SDN floor,
    so a version probe that returns a surprising shape degrades to
    legacy-bridges-only rather than mis-detecting SDN.
    """
    if not release:
        return (0, 0)
    parts = str(release).split(".")
    try:
        major = int(parts[0])
        minor = int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        return (0, 0)
    return (major, minor)


def _is_applied(obj: dict) -> bool:
    """A zone/VNet is APPLIED iff its ``state`` field is empty/absent (spike §2).

    Any non-empty ``state`` (``new`` / ``changed`` / ``deleted``) means the
    object has a pending, not-yet-applied change.
    """
    return not (obj.get("state") or "").strip()


def _next_free_ip(cidr: str, gateway: str | None, allocated: set[str]) -> str | None:
    """Compute the lowest unallocated host address in ``cidr`` (spike §3, option b).

    Skips the network address, the broadcast address, the gateway, and every
    IP already in ``allocated``. Returns ``None`` if the subnet is full or the
    CIDR is unparseable (graceful degrade to DHCP).
    """
    try:
        network = ipaddress.ip_network(cidr, strict=False)
    except (ValueError, TypeError):
        return None
    skip = set(allocated)
    if gateway:
        skip.add(str(gateway).split("/")[0])
    for host in network.hosts():
        if str(host) not in skip:
            return str(host)
    return None


async def _list_bridges(conn: PVEConnector) -> list[NetworkOption]:
    """Enumerate every legacy Linux/OVS bridge cluster-wide, deduped by iface.

    The bridge list is per-node (spike §5). A node that is offline / out of
    quorum raises on its ``node_bridges`` read — that node is skipped and the
    reachable nodes' bridges still surface (spike §6, Pitfall 8). A bridge
    named ``vmbr0`` typically exists on every node, so the result is deduped
    by ``iface`` for the cluster-wide picker.
    """
    try:
        nodes = await conn.list_nodes()
    except Exception:  # noqa: BLE001 — no quorum at all → no bridges, no crash.
        return []

    seen: dict[str, NetworkOption] = {}
    for node_row in nodes:
        node = node_row.get("node")
        if not node:
            continue
        try:
            bridges = await conn.node_bridges(node=node)
        except Exception:  # noqa: BLE001 — offline node: skip, keep the rest.
            continue
        for br in bridges:
            iface = br.get("iface")
            if not iface or iface in seen:
                continue
            cidr = br.get("cidr")
            label = f"{iface} ({cidr})" if cidr else iface
            seen[iface] = NetworkOption(
                kind="bridge",
                network_id=iface,
                display_name=label,
                vlan_aware=bool(br.get("bridge_vlan_aware")),
                applied=True,  # a configured legacy bridge is always applied.
                ipam_available=False,  # legacy bridges never have IPAM (D-20).
            )
    return list(seen.values())


async def _build_vnet_option(
    conn: PVEConnector,
    vnet: dict,
    zone: dict | None,
) -> NetworkOption:
    """Build the picker entry for one SDN VNet — applied + IPAM flags.

    ``ipam_available`` is True when the VNet's zone carries an ``ipam`` id.
    For an applied, IPAM-backed VNet a ``suggested_ip`` is computed from
    ``sdn_ipam_status`` + the VNet's first subnet CIDR (spike §3, option b);
    any read failure on that path degrades to DHCP-only (no suggested_ip).
    """
    vnet_name = vnet.get("vnet", "")
    zone_name = vnet.get("zone")
    applied = _is_applied(vnet)
    ipam_id = (zone or {}).get("ipam") or ""
    label = (
        f"{vnet_name} (zone: {zone_name})" if zone_name else vnet_name
    )
    option = NetworkOption(
        kind="sdn-vnet",
        network_id=vnet_name,
        display_name=label,
        zone=zone_name,
        tag=vnet.get("tag"),
        applied=applied,
        ipam_available=bool(ipam_id),
        suggested_ip=None,
    )
    # Only compute a free IP for an applied, IPAM-backed VNet (D-20).
    if not (applied and ipam_id):
        return option
    try:
        subnets = await conn.sdn_subnets(vnet=vnet_name)
        if not subnets:
            return option
        subnet = subnets[0]
        cidr = subnet.get("cidr") or subnet.get("subnet")
        if not cidr:
            return option
        status_rows = await conn.sdn_ipam_status(ipam=ipam_id)
        allocated = {
            str(row.get("ip")).split("/")[0]
            for row in status_rows
            if row.get("ip")
        }
        option.suggested_ip = _next_free_ip(cidr, subnet.get("gateway"),
                                            allocated)
    except Exception:  # noqa: BLE001 — IPAM read failed → DHCP-only degrade.
        option.suggested_ip = None
    return option


async def _detect_sdn_capable(conn: PVEConnector) -> tuple[bool, list[dict]]:
    """D-21 per-cluster SDN auto-detect (spike §4).

    Returns ``(sdn_capable, applied_zones)``. SDN is usable iff the cluster is
    PVE 8.1+ AND ``sdn_zones()`` returns at least one APPLIED zone. A read
    failure (a token without ``SDN.Audit``, an unreachable cluster) is treated
    as "no SDN" — the picker degrades to legacy bridges rather than crashing.
    """
    try:
        version = await conn.version()
    except Exception:  # noqa: BLE001
        return False, []
    if _release_tuple((version or {}).get("release")) < _SDN_VERSION_FLOOR:
        return False, []
    try:
        zones = await conn.sdn_zones()
    except Exception:  # noqa: BLE001 — 403 SDN.Audit / unreachable → no SDN.
        return False, []
    applied_zones = [z for z in (zones or []) if _is_applied(z)]
    return (len(applied_zones) > 0), applied_zones


async def list_networks_for_team(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    cluster_id: int,
    team_id: int,
) -> NetworkPickerResponse:
    """Build the team-scoped grouped network picker for ``cluster_id``.

    SDN VNets are filtered to the team's ``NetworkScope`` grants (D-19 —
    un-granted VNets are hidden); legacy bridges are always surfaced
    (default-visible, D-19). Every SDN/bridge read uses the cluster-admin
    connector (spike §7 — the per-team privsep token cannot enumerate SDN).
    """
    from fastapi import HTTPException, status

    from app.models import Cluster

    cluster = await db.get(Cluster, cluster_id)
    if cluster is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found"
        )

    # Spike §7: the SDN reads MUST run as the cluster-admin connector.
    conn = await registry.get(cluster_id, db=db)

    sdn_capable, applied_zones = await _detect_sdn_capable(conn)
    zones_by_name = {z.get("zone"): z for z in applied_zones}

    sdn_options: list[NetworkOption] = []
    if sdn_capable:
        grants = await scoping.get_team_network_scope(
            db, team_id=team_id, cluster_id=cluster_id,
        )
        granted_vnets = set(grants["sdn_vnets"])
        try:
            vnets = await conn.sdn_vnets()
        except Exception:  # noqa: BLE001 — SDN read failed → bridges-only.
            vnets = []
        for vnet in vnets:
            vnet_name = vnet.get("vnet", "")
            # D-19: a team sees only the VNets an admin explicitly granted.
            if vnet_name not in granted_vnets:
                continue
            zone = zones_by_name.get(vnet.get("zone"))
            sdn_options.append(await _build_vnet_option(conn, vnet, zone))

    bridges = await _list_bridges(conn)

    return NetworkPickerResponse(
        cluster_id=cluster_id,
        sdn_capable=sdn_capable,
        sdn_vnets=sdn_options,
        bridges=bridges,
    )


async def list_cluster_network_inventory(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    cluster_id: int,
) -> tuple[bool, list[NetworkOption], list[NetworkOption]]:
    """Return the cluster's FULL SDN/bridge inventory — the admin Networks tab.

    Unlike :func:`list_networks_for_team` this applies NO per-team scope
    filter: the admin needs to see every grantable VNet/bridge to build the
    Networks-tab checkbox group (T-04-07-03 — the UI offers only valid
    grants). Returns ``(sdn_capable, all_sdn_vnets, all_bridges)``.
    """
    from fastapi import HTTPException, status

    from app.models import Cluster

    cluster = await db.get(Cluster, cluster_id)
    if cluster is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found"
        )

    conn = await registry.get(cluster_id, db=db)
    sdn_capable, applied_zones = await _detect_sdn_capable(conn)
    zones_by_name = {z.get("zone"): z for z in applied_zones}

    sdn_options: list[NetworkOption] = []
    if sdn_capable:
        try:
            vnets = await conn.sdn_vnets()
        except Exception:  # noqa: BLE001
            vnets = []
        for vnet in vnets:
            zone = zones_by_name.get(vnet.get("zone"))
            sdn_options.append(await _build_vnet_option(conn, vnet, zone))

    bridges = await _list_bridges(conn)
    return sdn_capable, sdn_options, bridges
