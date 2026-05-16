// /api/v1 community-scripts catalog methods (Plan 04-09).
//
// Consumes the Plan 04-06 catalog backend:
//   GET  /clusters/{id}/catalog          → CatalogListResponse  (curated / full)
//   GET  /clusters/{id}/catalog/{slug}   → CatalogEntryResponse (detail + attribution)
//   POST /catalog/sync                   → CatalogSyncResponse  (admin re-pin, D-05)
//
// Pattern: mirrors lifecycle.ts (withFetch helper, MaybeFetch opts, per-fn JSDoc).

import { apiJson, type ApiInit } from '$lib/utils/api';
import type {
  CatalogEntryResponse,
  CatalogListResponse,
  CatalogSyncResponse,
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
 * GET /api/v1/clusters/{id}/catalog — the community-scripts catalog.
 *
 * `view='curated'` (default) → the featured + admin-override shortlist
 * (LXC-01). `view='full'` → the full catalog, optionally filtered by `q`
 * (substring match on name/slug/description) and `category` (LXC-02).
 */
export async function listCatalog(
  args: { clusterId: number; view?: 'curated' | 'full'; q?: string; category?: string },
  opts?: MaybeFetch
): Promise<CatalogListResponse> {
  const qs = new URLSearchParams();
  if (args.view) qs.set('view', args.view);
  if (args.q) qs.set('q', args.q);
  if (args.category) qs.set('category', args.category);
  const tail = qs.toString() ? `?${qs}` : '';
  return apiJson<CatalogListResponse>(
    `/clusters/${args.clusterId}/catalog${tail}`,
    withFetch(opts, { method: 'GET' })
  );
}

/**
 * GET /api/v1/clusters/{id}/catalog/{slug} — a single script's detail + its
 * LXC-04 attribution block (`source_url` / `commit_sha` / `last_reviewed`).
 */
export async function getCatalogEntry(
  args: { clusterId: number; slug: string },
  opts?: MaybeFetch
): Promise<CatalogEntryResponse> {
  return apiJson<CatalogEntryResponse>(
    `/clusters/${args.clusterId}/catalog/${encodeURIComponent(args.slug)}`,
    withFetch(opts, { method: 'GET' })
  );
}

/**
 * POST /api/v1/catalog/sync — admin re-pin of the catalog to a fresher
 * upstream commit (D-05). Admin-only; a non-admin caller throws a 403
 * ApiError. Returns the `{added, updated, commit_sha}` re-pin summary.
 */
export async function syncCatalog(opts?: MaybeFetch): Promise<CatalogSyncResponse> {
  return apiJson<CatalogSyncResponse>(
    '/catalog/sync',
    withFetch(opts, { method: 'POST' })
  );
}
