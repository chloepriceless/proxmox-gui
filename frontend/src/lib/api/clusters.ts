// /api/v1/clusters resource methods.
//
// Plan 08 shipped the minimal surface (test + create) for the setup wizard.
// Plan 10 EXTENDS additively with list, get, update, del, testExisting.
// Plan 08's `test` and `create` exports are preserved unchanged — the setup
// wizard continues to import them from this module.
//
// WARNING-4 fix (per UI-SPEC §Required cluster registration form):
//   - `test()` hits POST /api/v1/clusters/test — DRY-RUN, NO DB write.
//   - `create()` hits POST /api/v1/clusters/ — PERSISTS the cluster.
//   - `testExisting()` hits POST /api/v1/clusters/{id}/test — re-validates the
//     STORED token (does not accept a new token in the body).
// These are THREE DISTINCT endpoints + THREE DISTINCT methods; the
// admin Clusters page binds them to TWO DISTINCT BUTTONS ("Test connection" +
// "Register cluster") that the user clicks separately.

import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';
import type {
  Cluster,
  ClusterCreateRequest,
  ClusterResponse,
  ClusterTestRequest,
  ClusterTestResponse,
  ClusterUpdateRequest
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
 * POST /api/v1/clusters/test — DRY-RUN reach + token check.
 *
 * WARNING-4 fix (UI-SPEC §Required cluster registration form):
 *   - NO DB write. The backend (Plan 06) explicitly does not persist anything.
 *   - Returns `{ ok, version, release, error }`.
 *   - Bound to the "Test connection" button on the admin Clusters registration
 *     form. The button MUST NOT call `create()`.
 *
 * Backend is admin + CSRF protected, so this is only callable from inside an
 * authenticated session.
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

/**
 * POST /api/v1/clusters/ — register a new cluster (PERSISTS).
 *
 * WARNING-4 fix (UI-SPEC §Required cluster registration form):
 *   - This is the SEPARATE persisting endpoint, distinct from `test()`.
 *   - Bound to the "Register cluster" button. The button MUST NOT call
 *     `test()` (or vice versa) — they are not the same code path.
 *
 * Backend re-validates the token (Pitfall A4) before insert. On a token
 * validation failure the response is 422 + NO row created.
 */
export async function create(
  body: ClusterCreateRequest,
  opts?: MaybeFetch
): Promise<ClusterResponse> {
  return apiJson<ClusterResponse>(
    '/clusters/',
    withFetch(opts, { method: 'POST', body: { ...body } })
  );
}

// ---------------------------------------------------------------------------
// Plan 01-10 additions — full admin CRUD surface
// ---------------------------------------------------------------------------

/** GET /api/v1/clusters/ — admin list of clusters (no api_token_secret). */
export async function list(opts?: MaybeFetch): Promise<Cluster[]> {
  return apiJson<Cluster[]>('/clusters/', withFetch(opts, { method: 'GET' }));
}

/** GET /api/v1/clusters/{id} — cluster detail (no api_token_secret). */
export async function get(args: { id: number }, opts?: MaybeFetch): Promise<Cluster> {
  return apiJson<Cluster>(`/clusters/${args.id}`, withFetch(opts, { method: 'GET' }));
}

/**
 * PATCH /api/v1/clusters/{id} — update cluster.
 *
 * If `api_token_secret` is omitted from the payload, the stored token is
 * preserved (UI-SPEC §Required cluster registration form "Update token"
 * pattern). When present, the backend re-validates BEFORE persisting (Pitfall
 * A4) and invalidates the connector cache.
 */
export async function update(
  args: { id: number } & ClusterUpdateRequest,
  opts?: MaybeFetch
): Promise<Cluster> {
  const { id, ...payload } = args;
  return apiJson<Cluster>(
    `/clusters/${id}`,
    withFetch(opts, { method: 'PATCH', body: { ...payload } })
  );
}

/**
 * DELETE /api/v1/clusters/{id} — delete cluster.
 *
 * Backend (Plan 06) returns 409 if any `team_cluster_tokens` row binds this
 * cluster — the operator must unbind teams first (Phase 2 endpoint).
 */
export async function del(args: { id: number }, opts?: MaybeFetch): Promise<void> {
  const res = await apiFetch(`/clusters/${args.id}`, withFetch(opts, { method: 'DELETE' }));
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '');
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    const { ApiError } = await import('$lib/utils/api');
    throw new ApiError(res.status, `DELETE /clusters/${args.id} failed`, parsed);
  }
}

/**
 * POST /api/v1/clusters/{id}/test — re-validate the STORED token.
 *
 * Distinct from `test()`, which validates a new token from a form body. This
 * endpoint takes NO body; it loads the cluster row, decrypts the stored token,
 * and probes `/version`. Used by the per-row "Test connection" action on the
 * Clusters list and by the edit page.
 */
export async function testExisting(
  args: { id: number },
  opts?: MaybeFetch
): Promise<ClusterTestResponse> {
  return apiJson<ClusterTestResponse>(
    `/clusters/${args.id}/test`,
    withFetch(opts, { method: 'POST' })
  );
}

// ---------------------------------------------------------------------------
// Plan 03-07 additions — backup-storage designation (D-08)
// ---------------------------------------------------------------------------

/** One backup-capable storage from `GET /clusters/{id}/backup-storages`. */
export interface BackupStorageItem {
  storage: string;
  type: string | null;
}

/**
 * GET /api/v1/clusters/{id}/backup-storages — the cluster's `content=backup`
 * storages, for the admin backup-storage Select (D-08). Admin-gated.
 *
 * The PATCH that designates the storage uses `update()` with `backup_storage`
 * in the payload — there is no separate setter.
 */
export async function listBackupStorages(
  clusterId: number,
  opts?: MaybeFetch
): Promise<BackupStorageItem[]> {
  return apiJson<BackupStorageItem[]>(
    `/clusters/${clusterId}/backup-storages`,
    withFetch(opts, { method: 'GET' })
  );
}
