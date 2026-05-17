// Tests for jobsWarrantRefresh — the live-status-refresh trigger that drives
// AppShell's invalidateAll() after a power/lifecycle job finishes.

import { describe, it, expect } from 'vitest';
import { jobsWarrantRefresh } from '../src/lib/stores/job-refresh';
import type { Job, JobState } from '../src/lib/api/types';

function makeJob(id: number, state: JobState, over: Partial<Job> = {}): Job {
  return {
    id,
    kind: 'vm.power',
    state,
    cluster_id: 1,
    team_id: 1,
    upid: `UPID:node-01:0000${id}::`,
    upid_node: 'node-01',
    error: null,
    friendly_error: null,
    batch_id: null,
    created_at: new Date(Date.UTC(2026, 4, 16, 12, 0, id)).toISOString(),
    started_at: null,
    finished_at: null,
    ...over,
  };
}

describe('jobsWarrantRefresh', () => {
  it('does NOT refresh on first sighting of a running job', () => {
    const seen = new Map<number, JobState>();
    expect(jobsWarrantRefresh([makeJob(1, 'running')], seen)).toBe(false);
    expect(seen.get(1)).toBe('running');
  });

  it('refreshes when a tracked job transitions running -> succeeded', () => {
    const seen = new Map<number, JobState>();
    jobsWarrantRefresh([makeJob(1, 'running')], seen); // prime
    expect(jobsWarrantRefresh([makeJob(1, 'succeeded')], seen)).toBe(true);
  });

  it('refreshes on running -> failed too', () => {
    const seen = new Map<number, JobState>();
    jobsWarrantRefresh([makeJob(7, 'running')], seen);
    expect(jobsWarrantRefresh([makeJob(7, 'failed')], seen)).toBe(true);
  });

  it('does NOT refresh for a job seen for the first time already terminal (backfill history)', () => {
    const seen = new Map<number, JobState>();
    // A reconnect backfill replays completed jobs — must not trigger a refresh.
    expect(jobsWarrantRefresh([makeJob(1, 'succeeded'), makeJob(2, 'failed')], seen)).toBe(false);
  });

  it('does NOT refresh again once a terminal job stays terminal', () => {
    const seen = new Map<number, JobState>();
    jobsWarrantRefresh([makeJob(1, 'running')], seen);
    expect(jobsWarrantRefresh([makeJob(1, 'succeeded')], seen)).toBe(true);
    // Same terminal job re-observed (e.g. another job's event re-renders the list).
    expect(jobsWarrantRefresh([makeJob(1, 'succeeded')], seen)).toBe(false);
  });

  it('refreshes once when several jobs finish in the same update', () => {
    const seen = new Map<number, JobState>();
    jobsWarrantRefresh([makeJob(1, 'running'), makeJob(2, 'running')], seen);
    expect(
      jobsWarrantRefresh([makeJob(1, 'succeeded'), makeJob(2, 'succeeded')], seen)
    ).toBe(true);
  });

  it('does not refresh while a job is still pending/claimed/running', () => {
    const seen = new Map<number, JobState>();
    jobsWarrantRefresh([makeJob(1, 'pending')], seen);
    expect(jobsWarrantRefresh([makeJob(1, 'claimed')], seen)).toBe(false);
    expect(jobsWarrantRefresh([makeJob(1, 'running')], seen)).toBe(false);
  });
});
