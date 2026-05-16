// /api/v1 notifications methods (Plan 04-14).
//
// Consumes the Plan 04-14 notifications backend:
//   GET  /notifications        → NotificationFeed (derived completions + unread count)
//   POST /notifications/seen   → NotificationFeed (cursor stamped → unread_count 0)
//
// Pattern: mirrors jobs.ts / lifecycle.ts (withFetch helper, MaybeFetch opts,
// per-fn JSDoc).
//
// The notification bell is a *derived view* over the jobs table (D-23) — these
// REST calls are the initial feed load + the open-acknowledges write; the live
// completion events also arrive on the existing jobs WebSocket store.

import { apiJson, type ApiInit } from '$lib/utils/api';
import type { NotificationFeed } from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/**
 * GET /api/v1/notifications — the recent task-completion feed for every team
 * the caller belongs to, plus the `unread_count` the bell badge consumes.
 *
 * The feed is the terminal (`succeeded` / `failed`) rows of the jobs table —
 * completions only (D-22). Cross-tenant jobs are never included.
 */
export async function listNotifications(opts?: MaybeFetch): Promise<NotificationFeed> {
  return apiJson<NotificationFeed>('/notifications', withFetch(opts, { method: 'GET' }));
}

/**
 * POST /api/v1/notifications/seen — stamp the caller's last-seen cursor to now.
 *
 * Call this when the user opens the bell panel ("open acknowledges"). Returns
 * the refreshed feed so the bell can reset its unread badge in one round-trip.
 */
export async function markSeen(opts?: MaybeFetch): Promise<NotificationFeed> {
  return apiJson<NotificationFeed>(
    '/notifications/seen',
    withFetch(opts, { method: 'POST' })
  );
}
