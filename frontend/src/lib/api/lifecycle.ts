// /api/v1 lifecycle mutation methods.
//
// Consumes Plan 03-02 backend endpoints — every mutating route returns 202
// Accepted with a job id; the worker polls the UPID, the Tasks-drawer
// WebSocket streams progress (CLAUDE.md constraint #1 — no UI surface blocks
// on a UPID poll):
//   POST   /clusters/{id}/vms/{vmid}/power   { action } → 202 JobAccepted
//   POST   /clusters/{id}/lxcs/{vmid}/power  { action } → 202 JobAccepted
//   DELETE /clusters/{id}/vms/{vmid}                    → 202 JobAccepted
//   DELETE /clusters/{id}/lxcs/{vmid}                   → 202 JobAccepted
//   POST   /clusters/{id}/vms/bulk-power     { action, targets } → 202 BulkJobAccepted
//
// Pattern: mirrors inventory.ts verbatim (withFetch helper, basePath helper
// that picks vms/lxcs from `type`).

import { apiJson, type ApiInit } from '$lib/utils/api';
import type {
  BulkJobAccepted,
  JobAccepted,
  PowerActionName,
  ResourceKind,
} from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/** Picks the `vms` / `lxcs` URL segment from a ResourceKind. */
function basePath(clusterId: number, kind: ResourceKind, vmid: number): string {
  const seg = kind === 'lxc' ? 'lxcs' : 'vms';
  return `/clusters/${clusterId}/${seg}/${vmid}`;
}

/**
 * POST /api/v1/clusters/{id}/{vms|lxcs}/{vmid}/power — Start / Stop / Reboot /
 * Shutdown a single resource. Returns the 202 JobAccepted body.
 */
export async function power(
  args: {
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    action: PowerActionName;
  },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/power`,
    withFetch(opts, { method: 'POST', body: { action: args.action } })
  );
}

/**
 * DELETE /api/v1/clusters/{id}/{vms|lxcs}/{vmid} — purge a resource. Returns
 * the 202 JobAccepted body.
 */
export async function del(
  args: { clusterId: number; vmid: number; type: ResourceKind },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    basePath(args.clusterId, args.type, args.vmid),
    withFetch(opts, { method: 'DELETE' })
  );
}

/**
 * POST /api/v1/clusters/{id}/vms/bulk-power — fan a power action out across a
 * selection. Per Plan 03-02 the route lives under one cluster prefix; the
 * `targets` each carry their own `cluster_id` so the backend re-resolves
 * access per target (the prefix cluster id is path chrome only). We pass the
 * first target's cluster id as that prefix.
 */
export async function bulkPower(
  args: {
    action: PowerActionName;
    targets: { cluster_id: number; vmid: number }[];
  },
  opts?: MaybeFetch
): Promise<BulkJobAccepted> {
  const prefixCluster = args.targets[0]?.cluster_id;
  if (prefixCluster === undefined) {
    throw new Error('bulkPower requires at least one target');
  }
  return apiJson<BulkJobAccepted>(
    `/clusters/${prefixCluster}/vms/bulk-power`,
    withFetch(opts, { method: 'POST', body: { action: args.action, targets: args.targets } })
  );
}
