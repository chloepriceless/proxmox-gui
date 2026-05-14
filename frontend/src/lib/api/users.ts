// `/api/v1/users` resource methods — admin-only surface.
//
// Plan 01-10 (frontend-admin) — these wrappers back the /admin/users routes.
// Every method is gated by the backend's require_admin dependency (Plan 07);
// a non-admin session hitting these endpoints receives 403. The UI's sidebar
// hides the Admin section for non-admins (defence in depth, never the only gate).

import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';
import type {
  AdminPasswordRequest,
  AdminUser,
  AdminUserCreateRequest,
  AdminUserCreateResponse,
  AdminUserDetail,
  AdminUserUpdateRequest,
  TeamSummary
} from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/** GET /api/v1/users/ — admin list of users with team memberships. */
export async function list(opts?: MaybeFetch): Promise<AdminUser[]> {
  return apiJson<AdminUser[]>('/users/', withFetch(opts, { method: 'GET' }));
}

/** GET /api/v1/users/{id} — admin user detail. */
export async function get(args: { id: number }, opts?: MaybeFetch): Promise<AdminUserDetail> {
  return apiJson<AdminUserDetail>(`/users/${args.id}`, withFetch(opts, { method: 'GET' }));
}

/**
 * POST /api/v1/users/ — admin create user + auto-personal-team + optional
 * shared memberships.
 *
 * Errors:
 *   - 409: duplicate username/email → caller maps inline.
 *   - 422: validation (short password, invalid email, personal team_id) → inline.
 */
export async function create(
  body: AdminUserCreateRequest,
  opts?: MaybeFetch
): Promise<AdminUserCreateResponse> {
  return apiJson<AdminUserCreateResponse>(
    '/users/',
    withFetch(opts, { method: 'POST', body: { ...body } })
  );
}

/**
 * PATCH /api/v1/users/{id} — admin update.
 *
 * Notes:
 *   - is_active True→False triggers session revocation server-side (Plan 07).
 *   - team_ids has REPLACE semantics on non-personal teams only.
 *   - Self-modification rejected with 422 — UI also hides those controls.
 */
export async function update(
  args: { id: number } & AdminUserUpdateRequest,
  opts?: MaybeFetch
): Promise<AdminUserDetail> {
  const { id, ...payload } = args;
  return apiJson<AdminUserDetail>(
    `/users/${id}`,
    withFetch(opts, { method: 'PATCH', body: { ...payload } })
  );
}

/**
 * DELETE /api/v1/users/{id} — admin delete; cascades personal team and
 * memberships. Self-delete rejected with 422.
 */
export async function del(args: { id: number }, opts?: MaybeFetch): Promise<void> {
  const res = await apiFetch(`/users/${args.id}`, withFetch(opts, { method: 'DELETE' }));
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
    throw new ApiError(res.status, `DELETE /users/${args.id} failed`, parsed);
  }
}

/**
 * POST /api/v1/users/{id}/password — admin password reset.
 *
 * Backend does NOT verify the old password (recovery flow). Sessions are
 * revoked so the target user MUST log in with the new password.
 */
export async function setPassword(
  args: { id: number; new_password: string },
  opts?: MaybeFetch
): Promise<void> {
  const body: AdminPasswordRequest = { new_password: args.new_password };
  await apiJson<unknown>(
    `/users/${args.id}/password`,
    withFetch(opts, { method: 'POST', body: { ...body } })
  );
}

/** POST /api/v1/users/{id}/teams — add a shared team membership. */
export async function addTeam(
  args: { id: number; team_id: number },
  opts?: MaybeFetch
): Promise<TeamSummary> {
  return apiJson<TeamSummary>(
    `/users/${args.id}/teams`,
    withFetch(opts, { method: 'POST', body: { team_id: args.team_id } })
  );
}

/** DELETE /api/v1/users/{id}/teams/{team_id} — remove a shared team membership. */
export async function removeTeam(
  args: { id: number; team_id: number },
  opts?: MaybeFetch
): Promise<void> {
  const res = await apiFetch(
    `/users/${args.id}/teams/${args.team_id}`,
    withFetch(opts, { method: 'DELETE' })
  );
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
    throw new ApiError(
      res.status,
      `DELETE /users/${args.id}/teams/${args.team_id} failed`,
      parsed
    );
  }
}
