// /api/v1 ISO / cloud-image library methods (Plan 04-09).
//
// Consumes the Plan 04-05 ISO backend:
//   GET  /clusters/{id}/iso                → IsoItem[]    (content-filtered ISO list)
//   GET  /clusters/{id}/iso/cloud-images   → CloudImage[] (curated cloud-image list)
//   POST /clusters/{id}/iso/download       → 202 JobAccepted (URL download — D-17, open)
//
// Pattern: mirrors lifecycle.ts (withFetch helper, MaybeFetch opts, per-fn JSDoc).
// The download route returns the 202 JobAccepted shape — PVE fetches the bytes,
// the GUI never proxies them (Pitfall 7); the worker polls the UPID.

import { apiJson, type ApiInit } from '$lib/utils/api';
import type { CloudImage, IsoDownloadRequest, IsoItem, JobAccepted } from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/**
 * GET /api/v1/clusters/{id}/iso — the ISO library across the node's
 * iso-capable storages (Pitfall 16 — content-filtered, VM-08). A team-scoped
 * read; NOT admin-gated. A cross-tenant `teamId` → 403.
 */
export async function listIsos(
  args: { clusterId: number; teamId: number; node: string },
  opts?: MaybeFetch
): Promise<IsoItem[]> {
  const qs = new URLSearchParams({ team_id: String(args.teamId), node: args.node });
  const res = await apiJson<{ isos: IsoItem[] }>(
    `/clusters/${args.clusterId}/iso?${qs}`,
    withFetch(opts, { method: 'GET' })
  );
  return res.isos;
}

/**
 * GET /api/v1/clusters/{id}/iso/cloud-images — the curated official
 * cloud-image list (VM-01 / D-15). Static config data — no PVE call.
 */
export async function listCloudImages(
  args: { clusterId: number },
  opts?: MaybeFetch
): Promise<CloudImage[]> {
  const res = await apiJson<{ images: CloudImage[] }>(
    `/clusters/${args.clusterId}/iso/cloud-images`,
    withFetch(opts, { method: 'GET' })
  );
  return res.images;
}

/**
 * POST /api/v1/clusters/{id}/iso/download — download an ISO / cloud image by
 * URL. Returns the 202 JobAccepted body. NOT admin-gated (D-17 — any
 * authenticated, team-scoped user). The backend rejects a non-http(s) URL 422
 * (SSRF — T-04-05-01) and a cross-tenant team 403.
 */
export async function downloadIso(
  args: { clusterId: number; body: IsoDownloadRequest },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `/clusters/${args.clusterId}/iso/download`,
    withFetch(opts, { method: 'POST', body: { ...args.body } })
  );
}
