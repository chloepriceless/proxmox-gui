// `/api/v1/setup` resource methods.
//
// The setup endpoints are intentionally CSRF-free on the backend (no session
// exists yet on first-run), so apiFetch's CSRF header injection is a no-op
// here — there is no `csrf_token` cookie to read.

import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';
import type { SetupAdminRequest, SetupAdminResponse, SetupStatus } from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/**
 * GET /api/v1/setup/status. Returns the predicate flags or null when the API
 * is unreachable (which is treated as "do not redirect to setup" — better to
 * land on /login and surface the unreachable state there).
 */
export async function status(opts?: MaybeFetch): Promise<SetupStatus | null> {
  try {
    const res = await apiFetch('/setup/status', withFetch(opts, { method: 'GET' }));
    if (!res.ok) return null;
    return (await res.json()) as SetupStatus;
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/setup/admin. Returns 201 on success, 409 if an admin already
 * exists. The wizard wraps this in a try/catch and inspects ApiError.status.
 */
export async function createAdmin(
  body: SetupAdminRequest,
  opts?: MaybeFetch
): Promise<SetupAdminResponse> {
  return apiJson<SetupAdminResponse>(
    '/setup/admin',
    withFetch(opts, { method: 'POST', body: { ...body } })
  );
}
