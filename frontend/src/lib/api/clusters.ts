// Minimal cluster surface Plan 01-08's setup wizard needs (test + create).
// Plan 10 will add list / get / patch / delete + the full Cluster type.

import { apiJson, type ApiInit } from '$lib/utils/api';
import type {
  ClusterCreateRequest,
  ClusterResponse,
  ClusterTestRequest,
  ClusterTestResponse
} from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/**
 * POST /api/v1/clusters/test — dry-run reach + token check. Backend is
 * admin + CSRF protected, so this is only callable from inside an
 * authenticated session (e.g. wizard step 3 after the auto-login of step 2).
 */
export async function test(
  body: ClusterTestRequest,
  opts?: MaybeFetch
): Promise<ClusterTestResponse> {
  return apiJson<ClusterTestResponse>(
    '/clusters/test',
    withFetch(opts, { method: 'POST', body: { ...body } })
  );
}

/** POST /api/v1/clusters/ — register a new cluster. */
export async function create(
  body: ClusterCreateRequest,
  opts?: MaybeFetch
): Promise<ClusterResponse> {
  return apiJson<ClusterResponse>(
    '/clusters/',
    withFetch(opts, { method: 'POST', body: { ...body } })
  );
}
