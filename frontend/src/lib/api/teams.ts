// `/api/v1/teams` resource methods — admin-only surface.
//
// Plan 01-10 (frontend-admin) — the admin /users edit page needs the team
// list to populate the team-membership selector. Full team CRUD is exposed
// here for completeness; the Phase 1 admin UI only consumes `list`.

import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';
import type {
  Team,
  TeamCreateRequest,
  TeamDetail,
  TeamUpdateRequest
} from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/** GET /api/v1/teams/ — list teams (with member_count). */
export async function list(opts?: MaybeFetch): Promise<Team[]> {
  return apiJson<Team[]>('/teams/', withFetch(opts, { method: 'GET' }));
}

/** GET /api/v1/teams/{id} — team detail with members. */
export async function get(args: { id: number }, opts?: MaybeFetch): Promise<TeamDetail> {
  return apiJson<TeamDetail>(`/teams/${args.id}`, withFetch(opts, { method: 'GET' }));
}

/**
 * POST /api/v1/teams/ — create + auto-bootstrap tenant on every active cluster.
 *
 * Note: `personal: true` is rejected at both the schema (extra=forbid) and
 * service layers; personal teams are only mintable via the user-create path.
 */
export async function create(body: TeamCreateRequest, opts?: MaybeFetch): Promise<Team> {
  return apiJson<Team>(
    '/teams/',
    withFetch(opts, { method: 'POST', body: { ...body } })
  );
}

/** PATCH /api/v1/teams/{id} — update name or is_active. Personal teams reject. */
export async function update(
  args: { id: number } & TeamUpdateRequest,
  opts?: MaybeFetch
): Promise<Team> {
  const { id, ...payload } = args;
  return apiJson<Team>(
    `/teams/${id}`,
    withFetch(opts, { method: 'PATCH', body: { ...payload } })
  );
}

/**
 * DELETE /api/v1/teams/{id} — D-04 option-a: returns 409 if any
 * team_cluster_tokens rows exist (operator must unbind first). Personal teams
 * reject with 422.
 */
export async function del(args: { id: number }, opts?: MaybeFetch): Promise<void> {
  const res = await apiFetch(`/teams/${args.id}`, withFetch(opts, { method: 'DELETE' }));
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
    throw new ApiError(res.status, `DELETE /teams/${args.id} failed`, parsed);
  }
}
