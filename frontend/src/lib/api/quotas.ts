import { apiJson, type ApiInit } from '$lib/utils/api';
import type {
  MyQuotasResponse, QuotaLimitInput, QuotaPreview, TeamQuotaPage,
} from './types';

type FetchLike = typeof fetch;
interface MaybeFetch { fetch?: FetchLike; }
function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

export async function getTeamQuotas(
  args: { teamId: number }, opts?: MaybeFetch,
): Promise<TeamQuotaPage> {
  return apiJson<TeamQuotaPage>(`/teams/${args.teamId}/quotas`,
    withFetch(opts, { method: 'GET' }));
}

export async function setTeamQuotas(
  args: { teamId: number; rows: QuotaLimitInput[]; allowOver?: boolean },
  opts?: MaybeFetch,
): Promise<TeamQuotaPage> {
  return apiJson<TeamQuotaPage>(`/teams/${args.teamId}/quotas`,
    withFetch(opts, {
      method: 'PUT',
      body: { rows: args.rows, allow_over: args.allowOver ?? false },
    }));
}

export async function getMyQuotas(opts?: MaybeFetch): Promise<MyQuotasResponse> {
  return apiJson<MyQuotasResponse>(`/me/quotas`,
    withFetch(opts, { method: 'GET' }));
}

export async function preview(
  args: {
    teamId: number; clusterId: number;
    requestedCpu?: number; requestedRamBytes?: number;
    requestedDiskBytes?: number; requestedCount?: number;
  },
  opts?: MaybeFetch,
): Promise<QuotaPreview> {
  return apiJson<QuotaPreview>(`/quotas/preview`,
    withFetch(opts, {
      method: 'POST',
      body: {
        team_id: args.teamId,
        cluster_id: args.clusterId,
        requested_cpu: args.requestedCpu ?? 0,
        requested_ram_bytes: args.requestedRamBytes ?? 0,
        requested_disk_bytes: args.requestedDiskBytes ?? 0,
        requested_count: args.requestedCount ?? 0,
      },
    }));
}
