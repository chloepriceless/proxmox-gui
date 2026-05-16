---
phase: 04-provisioning-networking-console
plan: 02
subsystem: research-spike
tags: [sdn, networks, ipam, proxmox, spike, rbac]
dependency_graph:
  requires:
    - "Phase 4 RESEARCH.md Open Questions 2/3 + Assumption A3 (SDN read path, IPAM free-IP)"
  provides:
    - "04-SPIKE-sdn.md — evidence-backed SDN read-API contract for networks/service.py"
    - "SDN VERSION FLOOR: PVE 8.1; applied-vs-pending via per-object state field"
    - "IPAM FREE-IP: option b (app-side computation), DHCP-only per-VNet degrade"
    - "RBAC finding: per-team privsep token cannot read SDN/bridges — 04-07 reads with cluster-admin connector + scopes app-side"
  affects:
    - "04-07 (networks backend — SDN reads, picker service, per-team scoping)"
tech_stack:
  added: []
  patterns:
    - "Spike-gated plan: a research doc pins the read-API contract a later implementation plan builds against"
key_files:
  created:
    - .planning/phases/04-provisioning-networking-console/04-SPIKE-sdn.md
  modified: []
decisions:
  - "VNET READ: GET /cluster/sdn/vnets — IPAM is a zone property (ipam field on GET /cluster/sdn/zones), not a VNet field"
  - "APPLIED STATE READ: per-object state field + pending object on the list endpoints; ?running=1 / ?pending=1 query params live-verified — a VNet is usable only when state is empty/absent"
  - "IPAM FREE-IP: option b — POST .../ips requires the IP, so compute next-free app-side from GET /cluster/sdn/ipams/{ipam}/status + subnet CIDR; DHCP-only is the per-VNet degrade (D-20)"
  - "SDN VERSION FLOOR: PVE 8.1 — detection via GET /cluster/sdn/zones (200 + non-empty after applied-filter); a 403 means a token-permission gap, not absent SDN"
  - "LEGACY BRIDGE READ: GET /nodes/{node}/network?type=any_bridge per node, dedup by iface"
  - "RBAC: the per-team privsep token returns 403 (SDN.Audit) on /cluster/sdn — 04-07 must read SDN/bridges with the cluster-admin connector and apply per-team scoping app-side (granting team tokens SDN.Audit would break D-18 tenant isolation)"
patterns_established:
  - "Network reads run as the cluster-admin connector with app-side per-team scoping — distinct from the privsep-token model used for VM/LXC reads"
requirements-completed: []
metrics:
  duration: ~7 min
  completed: 2026-05-16
  tasks: 2
  files: 1
---

# Phase 4 Plan 02: SDN Read-API Spike Summary

**Pinned the SDN read-API contract for 04-07 against the live PVE 9.1.2 cluster — applied-vs-pending via a per-object `state` field, IPAM free-IP computed app-side, PVE 8.1 floor — and surfaced a load-bearing RBAC finding: the per-team privsep token cannot enumerate SDN, so network reads must run as the cluster-admin connector with app-side scoping.**

## Performance

- **Duration:** ~7 min
- **Completed:** 2026-05-16
- **Tasks:** 2 (1 investigation + 1 human-verify checkpoint)
- **Files modified:** 1 (created)

## Accomplishments

- Produced `04-SPIKE-sdn.md` (367 lines) answering all 7 gating questions, each with a verdict line, backed by a live PVE 9.1.2 cluster probe (5 nodes, both the cluster-admin token and a per-team privsep token) and the official `pve-docs` API-viewer schema.
- Resolved Research Open Questions 2 and 3 and Assumption A3.
- Surfaced a new RBAC constraint that materially shapes 04-07's design.
- Delivered a concrete connector-read contract (`sdn_zones`, `sdn_vnets`, `sdn_subnets`, `node_bridges`, IPAM status) for `networks/service.py`.

## Task Commits

1. **Task 1: Investigate the SDN read API and produce the spike findings document** — `800d093` (docs)
2. **Task 2: Human-verify checkpoint** — approved by the user; no commit (verification gate)

**Worktree merge:** `c53d793`

## Files Created/Modified

- `.planning/phases/04-provisioning-networking-console/04-SPIKE-sdn.md` — SDN spike findings: zone/VNet/subnet read endpoints, applied-vs-pending mechanism, the IPAM next-free-IP path, the version floor + SDN-capable detection, legacy-bridge enumeration, partial-node-offline behavior, and the read-API contract for 04-07.

## Decisions Made

- **`VNET READ: GET /cluster/sdn/vnets`** — IPAM is a *zone* property (`ipam` field on `GET /cluster/sdn/zones`), not a VNet field.
- **`APPLIED STATE READ`** — per-object `state` field + a `pending` object on the list endpoints; `?running=1` / `?pending=1` query params live-verified as accepted. A VNet is usable only when `state` is empty/absent.
- **`IPAM FREE-IP: option b`** — `POST .../ips` requires the IP (option a not viable); compute next-free app-side from `GET /cluster/sdn/ipams/{ipam}/status` + subnet CIDR. DHCP-only is the per-VNet degrade (D-20) where a zone has no IPAM.
- **`SDN VERSION FLOOR: PVE 8.1`** — detection via `GET /cluster/sdn/zones` (200 + non-empty after applied-filter); a 403 indicates a token-permission gap, not absent SDN.
- **`LEGACY BRIDGE READ: GET /nodes/{node}/network?type=any_bridge`** per node, dedup by `iface`.
- **RBAC (the load-bearing finding):** the per-team privsep token — the exact token Phase 4 provisioning runs as — returned `403 (/sdn, SDN.Audit)` on `GET /cluster/sdn` and `[]` for `GET /nodes/{node}/network` on every node, while the cluster-admin token saw everything. 04-07's `networks/service.py` must read SDN/bridges with the **cluster-admin connector** and apply per-team scoping app-side. The spike rejected the alternative (granting every team token `SDN.Audit`) because it would break D-18 tenant isolation.

## Deviations from Plan

None — plan executed as written. The plan's `<interfaces>` block sketched the SDN connector reads; the spike confirmed/corrected their shape and surfaced the RBAC constraint, which is exactly the spike's purpose.

## Issues Encountered

The live cluster has the SDN subsystem present and reachable but **zero zones/VNets configured**. Endpoint existence, query-param acceptance, RBAC behavior, and legacy-bridge enumeration are all live-verified; populated zone/VNet/subnet field sets are taken from the authoritative API-viewer schema and tagged `[SCHEMA — verified against API-viewer]`. A small number of populated-cluster specifics are tagged `[ASSUMED — verify at implementation]`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **04-07 (networks backend)** now has a concrete read-API contract: the connector reads to add, the applied-state filter rule, the app-side IPAM computation, and the version-floor detection.
- Material change for 04-07 vs. the original plan: network reads run as the cluster-admin connector with app-side per-team scoping, not as the per-team privsep token.

---
*Phase: 04-provisioning-networking-console*
*Completed: 2026-05-16*
