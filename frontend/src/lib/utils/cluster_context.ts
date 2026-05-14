// Cluster context — localStorage-persisted selection for ClusterContextPicker.
//
// UI-SPEC §ClusterContextPicker: state persisted in
// localStorage["proxmox-gui:cluster-context"] as "all" or a cluster_id
// string. SSR-safe: returns ALL_CLUSTERS when window is not available.
//
// T-02-05-03 accept: localStorage is scoped to origin; shared-machine threat
// is out of scope per CONTEXT (single-tenant operator).

const KEY = 'proxmox-gui:cluster-context';

export const ALL_CLUSTERS = 'all' as const;

export type ClusterContext = typeof ALL_CLUSTERS | number;

/**
 * Read the current cluster context from localStorage.
 *
 * Returns `ALL_CLUSTERS` ("all") when:
 *   - Running on the server (typeof window === 'undefined')
 *   - Key is absent or set to "all"
 *   - Stored value is not a valid positive integer
 */
export function getClusterContext(): ClusterContext {
  if (typeof window === 'undefined') return ALL_CLUSTERS; // SSR-safe
  const raw = window.localStorage.getItem(KEY);
  if (raw === null || raw === ALL_CLUSTERS) return ALL_CLUSTERS;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : ALL_CLUSTERS;
}

/**
 * Persist a cluster context selection.
 *
 * Silently no-ops on the server.
 */
export function setClusterContext(v: ClusterContext): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, v === ALL_CLUSTERS ? ALL_CLUSTERS : String(v));
}
