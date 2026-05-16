"""Pydantic schemas for the networks subsystem — NET-01..04 (Plan 04-07).

The picker (``NetworkPickerResponse``) is a single grouped list — an "SDN
VNets" group and a "Legacy bridges" group — each entry carrying the
applied-state + IPAM-availability flags the frontend renders (UI-SPEC §SDN-
aware network picker). The admin scope schemas back the Networks admin tab
(``NetworkScopeResponse`` for the GET, ``NetworkScopeUpdate`` for the PUT).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class NetworkOption(BaseModel):
    """A single pickable network — an SDN VNet or a legacy bridge.

    ``kind`` discriminates the group: ``"sdn-vnet"`` or ``"bridge"``.
    ``applied`` is the spike-§2 state-derived usability flag — a pending
    (not-yet-applied) SDN VNet is surfaced with ``applied=False`` so the UI
    badges it non-pickable (Pitfall 8). ``ipam_available`` is True when the
    VNet's zone has an IPAM; ``suggested_ip`` is the app-side-computed lowest
    free address (spike §3, option b) — null for DHCP-only entries.
    """

    model_config = ConfigDict(extra="forbid")

    kind: str  # "sdn-vnet" | "bridge"
    network_id: str  # the VNet name or the bridge iface name
    display_name: str
    zone: str | None = None  # SDN VNets only
    tag: int | None = None  # VLAN tag / VXLAN VNI — SDN VNets only
    vlan_aware: bool = False  # legacy bridges — enables a VLAN-tag field
    applied: bool = True  # bridges are always applied; SDN VNets state-derived
    ipam_available: bool = False
    suggested_ip: str | None = None


class NetworkPickerResponse(BaseModel):
    """``200`` body for ``GET /clusters/{id}/networks`` — the grouped picker.

    ``sdn_capable`` reflects the D-21 per-cluster auto-detect: True only on a
    PVE-8.1+ cluster with at least one applied SDN zone. When False the
    ``sdn_vnets`` group is empty and only legacy bridges are offered.
    """

    model_config = ConfigDict(extra="forbid")

    cluster_id: int
    sdn_capable: bool
    sdn_vnets: list[NetworkOption] = Field(default_factory=list)
    bridges: list[NetworkOption] = Field(default_factory=list)


class NetworkScopeResponse(BaseModel):
    """``200`` body for the admin ``GET .../networks`` — the Networks-tab view.

    Carries the cluster's full SDN/bridge inventory (so the admin UI offers
    only valid grants — T-04-07-03) plus the team's current grant set.
    """

    model_config = ConfigDict(extra="forbid")

    team_id: int
    cluster_id: int
    sdn_capable: bool
    available_sdn_vnets: list[NetworkOption] = Field(default_factory=list)
    available_bridges: list[NetworkOption] = Field(default_factory=list)
    granted: dict[str, list[str]] = Field(
        default_factory=lambda: {"sdn_vnets": [], "bridges": []}
    )


class NetworkScopeUpdate(BaseModel):
    """Request body for the admin ``PUT .../networks`` — the new grant set."""

    model_config = ConfigDict(extra="forbid")

    sdn_vnets: list[str] = Field(default_factory=list)
    bridges: list[str] = Field(default_factory=list)
