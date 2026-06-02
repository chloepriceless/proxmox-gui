// Self-update resource methods (Plan 05-06, DEPLOY-04).
//
// Backend contracts (Plan 05-04):
//   POST /api/v1/admin/self-update  -> 202 { job_id }  (admin + CSRF)
//   GET  /api/v1/health             -> 200 (UNAUTHENTICATED — the reconnect-poll
//                                     target the SPA hits across the API restart)

import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

export interface SelfUpdateResponse {
  job_id: number;
}

/**
 * POST /api/v1/admin/self-update — enqueue the worker self-update job. Returns
 * 202 with the job id so the caller can subscribe via the Tasks drawer and/or
 * reconnect-poll `health()` across the API restart. `targetVersion` omitted =
 * latest tagged release.
 */
export async function startSelfUpdate(
  targetVersion?: string,
  opts?: MaybeFetch
): Promise<SelfUpdateResponse> {
  return apiJson<SelfUpdateResponse>(
    '/admin/self-update/',
    withFetch(opts, {
      method: 'POST',
      body: targetVersion ? { target_version: targetVersion } : {}
    })
  );
}

/**
 * GET /api/v1/health — returns true on a 200. The self-update restarts the API,
 * so the browser reconnect-polls this until it comes back on the new code
 * (Plan 05-04 RESEARCH §Pattern 5). Never throws — a failed fetch during the
 * restart blip is the expected "not back yet" signal.
 */
export async function health(opts?: MaybeFetch): Promise<boolean> {
  try {
    const res = await apiFetch('/health', withFetch(opts, { method: 'GET' }));
    return res.ok;
  } catch {
    return false;
  }
}
