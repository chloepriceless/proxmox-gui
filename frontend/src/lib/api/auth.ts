// Auth resource methods — thin typed wrappers over apiFetch / apiJson.
//
// Every method accepts an optional `fetch` parameter so SSR loaders can pass
// `event.fetch` (which forwards same-origin cookies; Pitfall A7). Browser
// callers omit it and the global `fetch` is used.

import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';
import type { LoginRequest } from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  // apiFetch consults the global fetch by default. To honour an SSR-injected
  // fetch we route through the supplied one explicitly.
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/**
 * POST /api/v1/auth/login. Throws ApiError on non-2xx (caller branches on
 * `.status` for 401 / 403 / 429 messaging).
 */
export async function login(
  req: LoginRequest,
  opts?: MaybeFetch
): Promise<void> {
  await apiJson<unknown>(
    '/auth/login',
    withFetch(opts, {
      method: 'POST',
      body: { username: req.username, password: req.password }
    })
  );
}

/** POST /api/v1/auth/logout. Idempotent on the backend; never throws. */
export async function logout(opts?: MaybeFetch): Promise<void> {
  try {
    await apiFetch('/auth/logout', withFetch(opts, { method: 'POST' }));
  } catch {
    // Network failure here is benign — caller still navigates to /login.
  }
}

/** POST /api/v1/auth/refresh. Used by the SPA's silent-refresh path. */
export async function refresh(opts?: MaybeFetch): Promise<void> {
  await apiJson<unknown>(
    '/auth/refresh',
    withFetch(opts, { method: 'POST' })
  );
}
