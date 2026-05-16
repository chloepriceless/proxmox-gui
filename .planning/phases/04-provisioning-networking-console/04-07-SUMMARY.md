---
phase: 04-provisioning-networking-console
plan: 07
subsystem: networks-backend
tags: [networking, sdn, ipam, network-scoping, multi-tenancy, spike-gated]
dependency_graph:
  requires:
    - "app.models.NetworkScope + the 0006_phase4 migration (Plan 04-04)"
    - "app.clusters.connector.PVEConnector._call_with_breaker (Phase 2)"
    - "app.clusters.registry.PVEConnectorRegistry.get — the cluster-admin connector (Phase 1)"
    - "app.inventory.access._team_ids_for_user / _team_tokens_for_cluster (Phase 2)"
    - "04-SPIKE-sdn.md — the approved read-API contract (Plan 04-02)"
  provides:
    - "GET /api/v1/clusters/{id}/networks — the team-scoped grouped SDN/bridge picker"
    - "GET/PUT /api/v1/admin/teams/{tid}/clusters/{cid}/networks — the Networks admin tab CRUD"
    - "connector.sdn_zones / sdn_vnets / sdn_subnets / sdn_ipam_status / node_bridges reads"
    - "networks.service.list_networks_for_team + list_cluster_network_inventory"
    - "networks.scoping.get_team_network_scope + set_team_network_scope"
  affects:
    - "backend/app/clusters/connector.py (shared — append-only SDN read methods)"
    - "backend/app/main.py (shared — networks router mounted)"
tech_stack:
  added: []
  patterns:
    - "SDN/bridge reads run on the cluster-admin connector (registry.get), NOT the per-team privsep token — the privsep token cannot enumerate SDN (403 SDN.Audit); per-team visibility is filtered app-side (spike 04-02 §7)"
    - "set_team_network_scope is a diff-based idempotent upsert against the composite UNIQUE index — analog of quotas/service.py scoping CRUD"
    - "the picker mirrors inventory/service.py's per-node try/skip graceful-degradation pattern for partial-node-offline"
key_files:
  created:
    - backend/app/networks/__init__.py
    - backend/app/networks/scoping.py
    - backend/app/networks/schemas.py
    - backend/app/networks/service.py
    - backend/app/networks/routes.py
    - backend/tests/test_networks.py
  modified:
    - backend/app/clusters/connector.py
    - backend/app/main.py
decisions:
  - "networks/service.py drives every SDN/bridge read with the cluster-admin connector (registry.get), never the per-team privsep token — spike 04-02 §7: a privsep team token returns 403 SDN.Audit on /cluster/sdn and [] on /nodes/{node}/network. Per-team visibility is applied app-side via NetworkScope grants. Granting team tokens SDN.Audit was explicitly rejected (would break D-18 tenant isolation)"
  - "SDN-capable detection (D-21) = PVE release >= 8.1 AND sdn_zones() returns >=1 APPLIED zone; an unparseable release tuple or a 403/unreachable SDN read degrades to legacy-bridges-only rather than mis-detecting SDN"
  - "applied-vs-pending uses the per-object `state` field — empty/absent ⇒ applied (usable); any non-empty value ⇒ applied=False (Pitfall 8). The picker still surfaces a pending VNet, flagged non-pickable, rather than hiding it"
  - "IPAM free-IP is computed app-side (spike §3 option b): zone.ipam → sdn_ipam_status allocated set + the VNet's first subnet CIDR → lowest unallocated host, skipping network/broadcast/gateway. A zone with no ipam, or any IPAM read failure, degrades to DHCP-only (suggested_ip null)"
  - "the picker route resolves the principal's team for the cluster from team_cluster_tokens (tokens[0].team_id); a principal with no team bound to the cluster → 403 (T-04-07-01)"
metrics:
  duration: ~9 min
  completed: 2026-05-16
  tasks: 2
  files: 8
  tests: 462 pass (25 new)
---

# Phase 4 Plan 07: Networks Backend Summary

The spike-gated networking half of Phase 4: the SDN connector reads, the
SDN-aware team-scoped network picker, the per-team network-scoping CRUD, and
the routes. The picker serves a grouped list — SDN VNets (gated by admin
grants) and legacy bridges (default-visible) — with applied-state filtering
and IPAM-aware free-IP suggestions, all built against the evidence-backed
read-API contract pinned by spike 04-02 (`04-SPIKE-sdn.md`).

## What Shipped

**Task 1 — SDN connector reads + the network-scoping CRUD.** Five new
`PVEConnector` reads, each routed through `_call_with_breaker` and NOT
clearing the resource cache: `sdn_zones` (`GET /cluster/sdn/zones`),
`sdn_vnets` (`GET /cluster/sdn/vnets`), `sdn_subnets`
(`GET /cluster/sdn/vnets/{vnet}/subnets`), `sdn_ipam_status`
(`GET /cluster/sdn/ipams/{ipam}/status`), and `node_bridges`
(`GET /nodes/{node}/network?type=any_bridge`) — the exact paths from spike
04-02 §7. `networks/scoping.py` ships `get_team_network_scope` /
`set_team_network_scope` over the Plan-04-04 `NetworkScope` table: the setter
is a diff-based idempotent upsert (INSERT new pairs, DELETE revoked pairs) so
re-writing an identical grant set never violates the composite UNIQUE index.

**Task 2 — the picker service + the routes.** `networks/schemas.py` defines
`NetworkOption` (with `applied` / `ipam_available` / `suggested_ip` flags),
`NetworkPickerResponse`, `NetworkScopeResponse`, `NetworkScopeUpdate`.
`networks/service.py` ships `list_networks_for_team` — it drives every
SDN/bridge read with the **cluster-admin connector** (spike §7), auto-detects
SDN capability (PVE 8.1+ floor + ≥1 applied zone — D-21), filters SDN VNets
to the team's `NetworkScope` grants (D-19), derives `applied` from the
per-object `state` field (Pitfall 8), computes a free static IP app-side from
the IPAM status + subnet CIDR (D-20), enumerates and dedups legacy bridges by
`iface`, and degrades gracefully when a node is offline. `routes.py` exposes
the team-scoped `GET /clusters/{id}/networks` picker (NOT admin-gated) plus
the admin `GET`/`PUT /admin/teams/{tid}/clusters/{cid}/networks` scoping
endpoints; `main.py` mounts the router.

## Must-Haves Verification

- A user can list the networks available to their team — SDN VNets grouped
  separately from legacy bridges — `test_get_networks_picker_route` +
  `test_picker_shows_only_granted_vnets`.
- Until an admin scopes a team, only legacy bridges are visible; SDN VNets
  stay hidden (D-19) — `test_picker_unscoped_team_sees_bridges_only`
  (empty `sdn_vnets`, bridges present).
- An admin can scope per-cluster SDN/bridge visibility per team (NET-02) —
  `test_admin_put_team_network_scope_saves_grants` +
  `test_admin_get_team_network_scope_route`; a non-admin → 403
  (`test_admin_*_non_admin_403`).
- An IPAM-backed VNet returns a free static IP; a no-IPAM VNet returns
  DHCP-only (NET-03) — `test_picker_vnet_carries_applied_and_ipam_flags`
  (`prod` → `suggested_ip == "10.0.0.4"`; `mail` → `ipam_available False`,
  `suggested_ip None`).
- SDN VNets surface only on SDN-capable PVE-8+ clusters; legacy bridges
  otherwise (NET-04, D-21) — `test_picker_non_sdn_cluster_bridges_only` +
  `test_picker_pre_8_1_cluster_hides_sdn`.

## Spike Authority Compliance (04-SPIKE-sdn.md)

The spike is authoritative where it conflicts with the pre-spike plan
sketch. Every load-bearing finding was implemented as stated:

- **RBAC (§7):** `list_networks_for_team` and `list_cluster_network_inventory`
  call `registry.get(cluster_id)` — the cluster-admin connector — for every
  SDN/bridge read. The per-team privsep token is never used for a network
  read. Per-team scoping is applied app-side via `scoping.get_team_network_scope`.
  Team tokens are NOT granted `SDN.Audit`.
- **Applied-vs-pending (§2):** `_is_applied` treats an empty/absent `state`
  as applied; any non-empty `state` ⇒ `applied=False`.
- **IPAM free-IP (§3, option b):** `_next_free_ip` computes the lowest free
  host from `sdn_ipam_status` + the subnet CIDR; no `POST .../ips` allocate
  call. DHCP-only is the per-VNet degrade when the zone has no `ipam`.
- **Legacy bridges (§5):** `node_bridges` uses `?type=any_bridge`; the
  service dedups by `iface` across nodes.
- **Version floor (§4):** the SDN floor is `(8, 1)`; detection is
  `version().release >= 8.1` AND `sdn_zones()` returns ≥1 applied zone.

## Deviations from Plan

None — the plan executed as written. The plan's interface sketch already
deferred the load-bearing details to the spike's verdict lines, and every
spike finding was implemented directly. No bugs, no missing critical
functionality, no blocking issues, no architectural changes.

## Threat Model Compliance

- **T-04-07-01 (cross-tenant SDN visibility)** — `list_networks_for_team`
  filters SDN VNets through `get_team_network_scope`; the picker route
  resolves the principal's own team from `team_cluster_tokens` and 403s a
  principal with no team bound to the cluster.
- **T-04-07-02 (network-scoping CRUD by a non-admin)** — both admin routes
  carry `Depends(require_admin)`; the PUT additionally carries
  `Depends(csrf_protect)`. Verified by `test_admin_*_non_admin_403`.
- **T-04-07-03 (granting a cross-cluster VNet)** — `set_team_network_scope`
  writes are keyed by `cluster_id`; the admin GET returns only that
  cluster's real inventory. Verified by `test_network_scope_is_per_cluster_isolated`.
- **T-04-07-04 (partial-node-offline hard-fail)** — `_list_bridges` wraps the
  per-node read in a try/skip loop; a no-quorum cluster returns no bridges
  instead of raising. Verified by `test_picker_degrades_when_a_node_is_offline`.
- **T-04-07-05 (pending VNet presented as usable)** — every VNet carries an
  `applied` flag from the `state` field; pending VNets are surfaced
  `applied=False`. Verified by `test_picker_vnet_carries_applied_and_ipam_flags`.

No new threat surface beyond the plan's `<threat_model>` was introduced.

## Notes for Later Phase-4 Plans

- The frontend networking plan consumes `NetworkPickerResponse` (the grouped
  picker) and `NetworkScopeResponse` (the admin Networks tab).
- The provisioning wizard's Network step will pick a `NetworkOption` and
  translate it into the PVE `net0` config — a `bridge` entry maps to
  `bridge=<iface>`, an `sdn-vnet` entry maps to `bridge=<vnet>` with the
  static IP / DHCP choice driving `ipconfig0`.
- `suggested_ip` is a pre-fill hint — the wizard must keep the IP field
  editable and offer the DHCP alternative (D-20).

## Self-Check: PASSED

All six created files exist on disk; all four task commits (`b81c155`,
`1b84838`, `98b5b40`, `0ce14e1`) are present in `git log`.
