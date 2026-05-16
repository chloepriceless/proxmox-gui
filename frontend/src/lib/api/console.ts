// /api/v1 console methods (Plan 04-09).
//
// Consumes the Plan 04-08 console backend:
//   POST /clusters/{id}/vms/{vmid}/console/vncproxy   → VncProxyResponse
//   POST /clusters/{id}/lxcs/{vmid}/console/vncproxy  → VncProxyResponse
//
// Pattern: mirrors lifecycle.ts (withFetch helper, MaybeFetch opts, per-fn JSDoc).
//
// The mint MUST happen ON the user's "Open console" click — never on page load
// (the PVE vncticket lives ~30-40s, Pitfall 3). The load-bearing field of the
// response is `relay_url`: the GUI's own reverse-proxied WebSocket path the
// noVNC iframe connects to — never the Proxmox host URL (CON-03).

import { apiJson, type ApiInit } from '$lib/utils/api';
import type { ResourceKind, VncProxyResponse } from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/**
 * POST /api/v1/clusters/{id}/{vms|lxcs}/{vmid}/console/vncproxy — mint a noVNC
 * console ticket for a resource the caller owns.
 *
 * Call this ON the "Open console" click, never on page load (the vncticket
 * lives ~30-40s — Pitfall 3 / CON-02). A cross-tenant resource → 403. The
 * returned `relay_url` is the GUI-origin WebSocket path the iframe connects
 * to (CON-03).
 */
export async function mintVncProxy(
  args: { clusterId: number; vmid: number; kind: ResourceKind },
  opts?: MaybeFetch
): Promise<VncProxyResponse> {
  const seg = args.kind === 'lxc' ? 'lxcs' : 'vms';
  return apiJson<VncProxyResponse>(
    `/clusters/${args.clusterId}/${seg}/${args.vmid}/console/vncproxy`,
    withFetch(opts, { method: 'POST' })
  );
}
