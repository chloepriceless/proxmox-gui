// job-refresh — detect when a tracked job has just finished, so the mounted
// page can re-fetch (live VM status after a power/lifecycle action).
//
// Why: a power action enqueues a job; the worker runs it and the `/ws/jobs`
// WebSocket streams the state changes into `jobsStore`. But nothing re-loads
// the inventory list / VM-detail page, so the run-state badge stays stale
// until a manual reload. AppShell feeds `jobsStore.jobs` through
// `jobsWarrantRefresh` and calls `invalidateAll()` on a true result.

import type { Job, JobState } from '$lib/api/types';

/** A job in one of these states has finished — its target's state changed. */
const TERMINAL: ReadonlySet<JobState> = new Set<JobState>(['succeeded', 'failed']);

/**
 * Return whether any job just transitioned into a terminal state since the
 * last call. `seen` maps job id → last-observed state and is mutated in place.
 *
 * A job seen for the first time NEVER triggers a refresh — that covers the
 * WebSocket `backfill` frame, which replays already-completed history on
 * every (re)connect. Only an observed non-terminal → terminal transition of
 * an already-tracked job returns true.
 */
export function jobsWarrantRefresh(jobs: Job[], seen: Map<number, JobState>): boolean {
  let refresh = false;
  for (const job of jobs) {
    const prev = seen.get(job.id);
    const nowTerminal = TERMINAL.has(job.state);
    const wasTerminal = prev !== undefined && TERMINAL.has(prev);
    if (prev !== undefined && nowTerminal && !wasTerminal) {
      refresh = true;
    }
    seen.set(job.id, job.state);
  }
  return refresh;
}
