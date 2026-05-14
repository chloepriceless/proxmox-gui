// /api/v1 inventory resource methods.
//
// Consumes Plan 02-03 backend endpoints:
//   GET  /me/inventory                           → ClusterInventory[]
//   GET  /clusters/{id}/inventory                → ClusterInventory
//   GET  /clusters/{id}/vms/{vmid}               → VMDetail
//   GET  /clusters/{id}/lxcs/{vmid}              → VMDetail
//   GET  /clusters/{id}/vms/{vmid}/rrd           → RRDSample[]
//   PUT  /clusters/{id}/vms/{vmid}/tags          → VMDetail
//   PUT  /clusters/{id}/vms/{vmid}/notes         → VMDetail
//   (LXC mirrors the above with /lxcs/{vmid}/...)
//
// Pattern: mirrors clusters.ts verbatim (withFetch helper, MaybeFetch interface).

import { apiJson, type ApiInit } from '$lib/utils/api';
import type { ClusterInventory, ResourceKind, RRDSample, VMDetail } from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

function basePath(clusterId: number, kind: ResourceKind, vmid?: number): string {
  const seg = kind === 'lxc' ? 'lxcs' : 'vms';
  return vmid === undefined
    ? `/clusters/${clusterId}/${seg}`
    : `/clusters/${clusterId}/${seg}/${vmid}`;
}

/** GET /api/v1/me/inventory — all clusters the user has access to. */
export async function listAll(opts?: MaybeFetch): Promise<ClusterInventory[]> {
  return apiJson<ClusterInventory[]>('/me/inventory', withFetch(opts, { method: 'GET' }));
}

/** GET /api/v1/clusters/{id}/inventory — single cluster inventory. */
export async function listForCluster(
  args: { clusterId: number },
  opts?: MaybeFetch
): Promise<ClusterInventory> {
  return apiJson<ClusterInventory>(
    `/clusters/${args.clusterId}/inventory`,
    withFetch(opts, { method: 'GET' })
  );
}

/** GET /api/v1/clusters/{id}/vms/{vmid} or /lxcs/{vmid} — VM/LXC detail. */
export async function getDetail(
  args: { clusterId: number; vmid: number; type: ResourceKind; fetch?: FetchLike },
  opts?: MaybeFetch
): Promise<VMDetail> {
  // Support fetch being passed either via args (SSR pattern) or opts
  const fetchOpts: MaybeFetch = { fetch: args.fetch ?? opts?.fetch };
  return apiJson<VMDetail>(
    basePath(args.clusterId, args.type, args.vmid),
    withFetch(fetchOpts, { method: 'GET' })
  );
}

/**
 * GET /api/v1/clusters/{id}/vms/{vmid}/rrd — RRD time-series data.
 *
 * timeframe defaults to 'hour'; cf defaults to 'AVERAGE'.
 */
export async function getRrd(
  args: {
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year';
    cf?: 'AVERAGE' | 'MAX';
  },
  opts?: MaybeFetch
): Promise<RRDSample[]> {
  const qs = new URLSearchParams();
  if (args.timeframe) qs.set('timeframe', args.timeframe);
  if (args.cf) qs.set('cf', args.cf);
  const tail = qs.toString() ? `?${qs}` : '';
  return apiJson<RRDSample[]>(
    `${basePath(args.clusterId, args.type, args.vmid)}/rrd${tail}`,
    withFetch(opts, { method: 'GET' })
  );
}

/**
 * PUT /api/v1/clusters/{id}/vms/{vmid}/tags — replace tags on a VM/LXC.
 *
 * Tags must match /^[a-z0-9_-]+$/ (validated client-side in TagInput; also
 * enforced server-side via PVE_TAG_RE — T-02-05-02).
 */
export async function setTags(
  args: { clusterId: number; vmid: number; type: ResourceKind; tags: string[] },
  opts?: MaybeFetch
): Promise<VMDetail> {
  return apiJson<VMDetail>(
    `${basePath(args.clusterId, args.type, args.vmid)}/tags`,
    withFetch(opts, { method: 'PUT', body: { tags: args.tags } })
  );
}

/**
 * PUT /api/v1/clusters/{id}/vms/{vmid}/notes — update notes (PVE description).
 *
 * Max 8000 chars enforced client-side in MarkdownNotes (D-15).
 */
export async function setNotes(
  args: { clusterId: number; vmid: number; type: ResourceKind; notes: string },
  opts?: MaybeFetch
): Promise<VMDetail> {
  return apiJson<VMDetail>(
    `${basePath(args.clusterId, args.type, args.vmid)}/notes`,
    withFetch(opts, { method: 'PUT', body: { notes: args.notes } })
  );
}
