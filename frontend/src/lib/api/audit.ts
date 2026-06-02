import { apiJson, type ApiInit } from '$lib/utils/api';
import type { AuditFilterParams, AuditPage } from './types';

type FetchLike = typeof fetch;
interface MaybeFetch { fetch?: FetchLike; }
function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

function buildParams(f: AuditFilterParams | undefined): URLSearchParams {
  const u = new URLSearchParams();
  if (!f) return u;
  if (f.from) u.set('from', f.from);
  if (f.to) u.set('to', f.to);
  if (f.action && f.action.length) u.set('action', f.action.join(','));
  if (typeof f.user_id === 'number') u.set('user_id', String(f.user_id));
  if (f.target_type && f.target_type.length) u.set('target_type', f.target_type.join(','));
  if (typeof f.vmid === 'number') u.set('vmid', String(f.vmid));
  if (typeof f.cluster_id === 'number') u.set('cluster_id', String(f.cluster_id));
  if (f.show_team_actions) u.set('show_team_actions', 'true');
  if (typeof f.page === 'number') u.set('page', String(f.page));
  if (typeof f.page_size === 'number') u.set('page_size', String(f.page_size));
  return u;
}

export async function list(
  args: { filters?: AuditFilterParams } = {},
  opts?: MaybeFetch,
): Promise<AuditPage> {
  const qs = buildParams(args.filters);
  const tail = qs.toString() ? `?${qs}` : '';
  return apiJson<AuditPage>(`/audit/${tail}`, withFetch(opts, { method: 'GET' }));
}

// ---------------------------------------------------------------------------
// Plan 05-06 additions — audit-archive listing + download (AUDIT-06 / D-08)
// ---------------------------------------------------------------------------

/** One rolled-off archive file from GET /api/v1/audit/archives. */
export interface AuditArchive {
  name: string;
  size_bytes: number;
  ctime: number;
}

/** GET /api/v1/audit/archives — the .csv.gz retention archives (admin-gated). */
export async function listArchives(opts?: MaybeFetch): Promise<AuditArchive[]> {
  return apiJson<AuditArchive[]>('/audit/archives', withFetch(opts, { method: 'GET' }));
}

/**
 * The download URL for one archive (GET /api/v1/audit/archives/{name}, served
 * as an attachment). Used as a plain <a href> so the browser streams the file.
 */
export function archiveDownloadUrl(name: string): string {
  return `/api/v1/audit/archives/${encodeURIComponent(name)}`;
}

export async function exportCsv(
  args: { filters?: AuditFilterParams } = {},
  opts?: MaybeFetch,
): Promise<Blob> {
  const qs = buildParams(args.filters);
  const tail = qs.toString() ? `?${qs}` : '';
  const fetchFn = (opts?.fetch ?? fetch) as FetchLike;
  const res = await fetchFn(`/api/v1/audit/export.csv${tail}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    const { ApiError } = await import('$lib/utils/api');
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, `GET /audit/export.csv failed`, body);
  }
  return res.blob();
}
