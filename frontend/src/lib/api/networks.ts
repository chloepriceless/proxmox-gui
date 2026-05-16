// /api/v1 networks methods (Plan 04-09).
//
// Consumes the Plan 04-07 networks backend:
//   GET /clusters/{id}/networks                          → NetworkPickerResponse
//   GET /admin/teams/{tid}/clusters/{cid}/networks       → NetworkScopeResponse
//   PUT /admin/teams/{tid}/clusters/{cid}/networks       → NetworkScopeResponse
//
// Pattern: mirrors lifecycle.ts (withFetch helper, MaybeFetch opts, per-fn JSDoc).

import { apiJson, type ApiInit } from '$lib/utils/api';
import type { NetworkPickerResponse, NetworkScopeResponse, NetworkScopeUpdate } from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/**
 * GET /api/v1/clusters/{id}/networks — the team-scoped grouped network picker.
 *
 * Returns the SDN VNets the principal's team has been granted plus the
 * always-visible legacy bridges (D-19). NOT admin-gated — any authenticated,
 * team-scoped user. A principal with no team bound to the cluster → 403.
 */
export async function listNetworks(
  args: { clusterId: number },
  opts?: MaybeFetch
): Promise<NetworkPickerResponse> {
  return apiJson<NetworkPickerResponse>(
    `/clusters/${args.clusterId}/networks`,
    withFetch(opts, { method: 'GET' })
  );
}

/**
 * GET /api/v1/admin/teams/{tid}/clusters/{cid}/networks — the Networks admin
 * tab view: the cluster's full SDN/bridge inventory + the team's current
 * grant set (NET-02). Admin-only.
 */
export async function getTeamNetworkScope(
  args: { teamId: number; clusterId: number },
  opts?: MaybeFetch
): Promise<NetworkScopeResponse> {
  return apiJson<NetworkScopeResponse>(
    `/admin/teams/${args.teamId}/clusters/${args.clusterId}/networks`,
    withFetch(opts, { method: 'GET' })
  );
}

/**
 * PUT /api/v1/admin/teams/{tid}/clusters/{cid}/networks — persist the team's
 * SDN/bridge network grant set for a cluster (NET-02). Admin-only. Returns the
 * refreshed Networks-tab view.
 */
export async function setTeamNetworkScope(
  args: { teamId: number; clusterId: number; body: NetworkScopeUpdate },
  opts?: MaybeFetch
): Promise<NetworkScopeResponse> {
  return apiJson<NetworkScopeResponse>(
    `/admin/teams/${args.teamId}/clusters/${args.clusterId}/networks`,
    withFetch(opts, { method: 'PUT', body: { ...args.body } })
  );
}
