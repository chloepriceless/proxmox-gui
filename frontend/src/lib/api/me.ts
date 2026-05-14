// `/api/v1/me` resource methods.
//
// Plan 01-08 shipped `get` + `getStrict` (the SSR auth probe).
// Plan 01-09 EXTENDS this module additively with the account self-service
// surface: changePassword + SSH-key CRUD + PAT CRUD. Existing exports are
// preserved; new exports are appended below.

import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';
import type {
  PATCreateRequest,
  PATListItem,
  PATMintResponse,
  PasswordChangeRequest,
  SshKey,
  SshKeyCreateRequest,
  User
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

// ---------------------------------------------------------------------------
// Plan 01-09 additions — account self-service surface
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/me/password — change own password.
 *
 * Backend (Plan 01-05) verifies `current_password` and then revokes every
 * OTHER refresh-token row for this user (the current session is preserved).
 * The UI surfaces "Password updated. Other sessions were signed out." on 200.
 *
 * Errors:
 *   - 403: current password incorrect → caller maps to inline error on the
 *     current_password field (UI-SPEC §Error state copy).
 *   - 422: validation (e.g. new password < 12 chars) → caller renders inline.
 */
export async function changePassword(
  body: PasswordChangeRequest,
  opts?: MaybeFetch
): Promise<void> {
  await apiJson<unknown>(
    '/me/password',
    withFetch(opts, { method: 'POST', body: { ...body } })
  );
}

// ---- SSH keys ----

/** GET /api/v1/me/ssh-keys — list this user's SSH keys (no public_key body). */
export async function listSshKeys(opts?: MaybeFetch): Promise<SshKey[]> {
  return apiJson<SshKey[]>('/me/ssh-keys/', withFetch(opts, { method: 'GET' }));
}

/**
 * POST /api/v1/me/ssh-keys — add a public key.
 *
 * Errors:
 *   - 422: parse failed → "That doesn't look like an SSH public key. Paste
 *     the contents of a `.pub` file." (UI-SPEC §Error state copy).
 *   - 409: duplicate fingerprint for this user.
 */
export async function addSshKey(
  body: SshKeyCreateRequest,
  opts?: MaybeFetch
): Promise<SshKey> {
  return apiJson<SshKey>(
    '/me/ssh-keys/',
    withFetch(opts, { method: 'POST', body: { ...body } })
  );
}

/**
 * DELETE /api/v1/me/ssh-keys/{id} — remove a key.
 *
 * Backend returns 204 on success and 404 on cross-user attempts
 * (T-01-05-11 don't-leak-existence pattern). UI surfaces 404 as the same
 * "Couldn't load keys / Couldn't delete" message — never differentiates.
 */
export async function deleteSshKey(
  args: { id: number },
  opts?: MaybeFetch
): Promise<void> {
  const res = await apiFetch(
    `/me/ssh-keys/${args.id}`,
    withFetch(opts, { method: 'DELETE' })
  );
  if (!res.ok && res.status !== 204) {
    // apiFetch does not throw — surface the failure to the caller.
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
    throw new ApiError(res.status, `DELETE /me/ssh-keys/${args.id} failed`, parsed);
  }
}

// ---- Personal Access Tokens (PATs) ----

/** GET /api/v1/me/tokens — list this user's PATs (prefix_preview only). */
export async function listTokens(opts?: MaybeFetch): Promise<PATListItem[]> {
  return apiJson<PATListItem[]>('/me/tokens/', withFetch(opts, { method: 'GET' }));
}

/**
 * POST /api/v1/me/tokens — mint a new PAT.
 *
 * Returns the plaintext exactly once (T-01-09-01). The UI MUST feed the
 * plaintext into SecretRevealDialog and clear it on dismiss; the backend can
 * never re-display the value.
 */
export async function mintToken(
  body: PATCreateRequest,
  opts?: MaybeFetch
): Promise<PATMintResponse> {
  return apiJson<PATMintResponse>(
    '/me/tokens/',
    withFetch(opts, { method: 'POST', body: { ...body } })
  );
}

/**
 * DELETE /api/v1/me/tokens/{id} — revoke a PAT (irreversible).
 *
 * Same 404-leak-protection semantics as deleteSshKey. Backend (Plan 01-05)
 * additionally rejects PAT-Bearer auth on this endpoint with 403 (a PAT
 * cannot manage other PATs — T-01-05-10).
 */
export async function revokeToken(
  args: { id: number },
  opts?: MaybeFetch
): Promise<void> {
  const res = await apiFetch(
    `/me/tokens/${args.id}`,
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
    throw new ApiError(res.status, `DELETE /me/tokens/${args.id} failed`, parsed);
  }
}
