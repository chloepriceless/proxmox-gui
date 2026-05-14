// `/api/v1/me` resource methods. Plans 09 will extend this module with
// `listSshKeys`, `listTokens`, `changePassword`, etc.

import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';
import type { User } from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/**
 * GET /api/v1/me. Returns the User on 200, `null` on 401 / 403.
 *
 * The "null on auth failure" behaviour is what the +layout.server.ts probe
 * needs — it must not throw on the unauthenticated case (that is the
 * normal pre-login state).
 */
export async function get(opts?: MaybeFetch): Promise<User | null> {
  const res = await apiFetch('/me/', withFetch(opts, { method: 'GET' }));
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(`GET /api/v1/me failed with status ${res.status}`);
  }
  return (await res.json()) as User;
}

/**
 * Variant that throws on any non-2xx (including 401). Useful from inside
 * authenticated client-side flows that should never see an unauth response.
 */
export async function getStrict(opts?: MaybeFetch): Promise<User> {
  return apiJson<User>('/me/', withFetch(opts, { method: 'GET' }));
}
