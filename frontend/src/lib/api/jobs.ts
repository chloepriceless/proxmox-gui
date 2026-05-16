// /api/v1 jobs API methods.
//
// Consumes Plan 03-02 backend endpoints:
//   GET  /jobs?state=&limit=   → JobListResponse (jobs + running/failed counts)
//   GET  /jobs/{id}            → Job
//   POST /jobs/{id}/retry      → JobAccepted (idempotent kinds only — 409 otherwise)
//
// Pattern: mirrors inventory.ts verbatim (withFetch helper, MaybeFetch interface,
// apiJson<T>). The live job feed comes from the WebSocket store
// (stores/jobs.svelte.ts) — these REST calls are the initial load + retry.

import { apiJson, type ApiInit } from '$lib/utils/api';
import type { Job, JobAccepted, JobListResponse } from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/**
 * GET /api/v1/jobs — recent jobs for every team the user belongs to, plus the
 * `running` / `failed` counts the Topbar badge consumes.
 */
export async function listJobs(
  args?: { state?: string; limit?: number },
  opts?: MaybeFetch
): Promise<JobListResponse> {
  const qs = new URLSearchParams();
  if (args?.state) qs.set('state', args.state);
  if (args?.limit !== undefined) qs.set('limit', String(args.limit));
  const tail = qs.toString() ? `?${qs}` : '';
  return apiJson<JobListResponse>(`/jobs${tail}`, withFetch(opts, { method: 'GET' }));
}

/** GET /api/v1/jobs/{id} — a single job row (404 when out-of-team). */
export async function getJob(id: number, opts?: MaybeFetch): Promise<Job> {
  return apiJson<Job>(`/jobs/${id}`, withFetch(opts, { method: 'GET' }));
}

/**
 * POST /api/v1/jobs/{id}/retry — re-arms the SAME failed job row (D-16).
 *
 * The backend rejects non-idempotent kinds (clone/migrate/delete/restore) with
 * 409 — the UI only renders the Retry button for idempotent kinds, so this is
 * a defence-in-depth gate, not the primary guard.
 */
export async function retryJob(id: number, opts?: MaybeFetch): Promise<JobAccepted> {
  return apiJson<JobAccepted>(`/jobs/${id}/retry`, withFetch(opts, { method: 'POST' }));
}
