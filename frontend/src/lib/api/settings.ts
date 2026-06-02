// Admin settings + keepalive resource methods (Plan 05-06).
//
// Thin typed wrappers over apiJson, mirroring the clusters.ts module shape.
// Backend contracts (Plan 05-01):
//   GET   /api/v1/admin/settings  -> AdminSettings
//   PATCH /api/v1/admin/settings  body { idle_timeout_minutes?, audit_retention_days? }
//   POST  /api/v1/auth/keepalive  -> { ok: true }  (bumps last_active_at, no rotation)

import { apiJson, type ApiInit } from '$lib/utils/api';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

export interface AdminSettings {
  id: number;
  idle_timeout_minutes: number;
  audit_retention_days: number;
  updated_at: string | null;
}

export interface AdminSettingsUpdate {
  idle_timeout_minutes?: number;
  audit_retention_days?: number;
}

/** GET /api/v1/admin/settings — the singleton settings row (admin-gated). */
export async function getSettings(opts?: MaybeFetch): Promise<AdminSettings> {
  return apiJson<AdminSettings>('/admin/settings', withFetch(opts, { method: 'GET' }));
}

/** PATCH /api/v1/admin/settings — update idle timeout / retention (admin-gated). */
export async function updateSettings(
  body: AdminSettingsUpdate,
  opts?: MaybeFetch
): Promise<AdminSettings> {
  return apiJson<AdminSettings>(
    '/admin/settings',
    withFetch(opts, { method: 'PATCH', body: { ...body } })
  );
}

/**
 * POST /api/v1/auth/keepalive — bump the session's last_active_at WITHOUT
 * rotating tokens. The cheap "Stay signed in" ping behind the idle countdown
 * toast (Plan 05-06 D-04). Returns silently; callers reset the idle timer.
 */
export async function keepalive(opts?: MaybeFetch): Promise<void> {
  await apiJson<unknown>('/auth/keepalive', withFetch(opts, { method: 'POST' }));
}
