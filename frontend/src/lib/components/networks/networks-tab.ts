// networks-tab — the pure, framework-free logic for the per-team Networks
// admin tab (Plan 04-14, NET-02, D-18/D-19).
//
// Extracted from `NetworksTab.svelte` so the checkbox-grid grant model is
// unit-testable in the `node` vitest env (the same discipline as Plan 04-11's
// `lxc-wizard.ts`). The rendered Svelte props/markup are exercised end-to-end
// by `pnpm exec svelte-check`.
//
// References:
//   - 04-UI-SPEC §"Networks admin tab" — per-cluster checkbox group
//   - D-18 (Networks tab parallel to Quotas) / D-19 (legacy bridges checked by
//     default, SDN VNets unchecked until granted)
//   - Plan 04-07 networks backend — `NetworkScopeResponse` / `NetworkScopeUpdate`

import type { NetworkOption, NetworkScopeResponse, NetworkScopeUpdate } from '$lib/api/types';

/** One checkbox row in the per-cluster grant grid. */
export interface NetworkGrantRow {
  network_id: string;
  display_name: string;
  /** "sdn-vnet" | "bridge" — drives which group the row sits in. */
  kind: string;
  /** Whether this network is currently granted to the team. */
  granted: boolean;
  /** A pending (not-yet-applied) SDN VNet is surfaced but not pickable. */
  applied: boolean;
}

/**
 * Build the editable SDN-VNet grant rows from a `NetworkScopeResponse`.
 *
 * D-19: SDN VNets are UNCHECKED until an admin grants them — a VNet is
 * `granted` only when its id is in `granted.sdn_vnets`.
 */
export function sdnGrantRows(scope: NetworkScopeResponse): NetworkGrantRow[] {
  const grantedSet = new Set(scope.granted.sdn_vnets);
  return scope.available_sdn_vnets.map((opt: NetworkOption) => ({
    network_id: opt.network_id,
    display_name: opt.display_name,
    kind: opt.kind,
    granted: grantedSet.has(opt.network_id),
    applied: opt.applied
  }));
}

/**
 * Build the editable legacy-bridge grant rows from a `NetworkScopeResponse`.
 *
 * D-19: legacy bridges are CHECKED BY DEFAULT — when the team has no saved
 * grant set yet (`granted.bridges` is empty) every bridge starts granted; once
 * an explicit grant set exists the saved selection is honoured.
 */
export function bridgeGrantRows(scope: NetworkScopeResponse): NetworkGrantRow[] {
  const hasSavedBridges = scope.granted.bridges.length > 0;
  const grantedSet = new Set(scope.granted.bridges);
  return scope.available_bridges.map((opt: NetworkOption) => ({
    network_id: opt.network_id,
    display_name: opt.display_name,
    kind: opt.kind,
    // No saved set yet → default-visible (D-19); otherwise honour the save.
    granted: hasSavedBridges ? grantedSet.has(opt.network_id) : true,
    applied: opt.applied
  }));
}

/**
 * Collapse the edited SDN + bridge rows into the `NetworkScopeUpdate` body the
 * `PUT .../networks` endpoint expects — just the granted ids per group.
 */
export function buildScopeUpdate(
  sdnRows: NetworkGrantRow[],
  bridgeRows: NetworkGrantRow[]
): NetworkScopeUpdate {
  return {
    sdn_vnets: sdnRows.filter((r) => r.granted).map((r) => r.network_id),
    bridges: bridgeRows.filter((r) => r.granted).map((r) => r.network_id)
  };
}
