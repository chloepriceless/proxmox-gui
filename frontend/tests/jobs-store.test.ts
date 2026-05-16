// Unit tests for the WebSocket jobs store (Plan 03-05).
//
// The store accepts an injectable WebSocket factory + a `silent` flag so the
// reconnect / backfill / upsert logic can be exercised in the `node` test
// environment without a real socket or sonner toasts.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { JobsStore, type WsLike } from '../src/lib/stores/jobs.svelte';
import type { Job, JobState } from '../src/lib/api/types';

/** A controllable fake WebSocket. */
class FakeWs implements WsLike {
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  closed = false;
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  /** Simulate the socket opening. */
  open(): void {
    this.onopen?.({});
  }

  /** Simulate an inbound frame (object form — store handles JSON or object). */
  emit(data: unknown): void {
    this.onmessage?.({ data });
  }

  /** Simulate the socket dropping. */
  drop(): void {
    this.closed = true;
    this.onclose?.({});
  }

  close(): void {
    this.closed = true;
  }
}

/** Minimal Job factory. */
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

/** Spin up a store wired to a single FakeWs we can drive. */
function setup() {
  const sockets: FakeWs[] = [];
  const store = new JobsStore({
    silent: true,
    wsUrl: 'ws://test/api/v1/ws/jobs',
    wsFactory: (url: string) => {
      const ws = new FakeWs(url);
      sockets.push(ws);
      return ws;
    },
  });
  return { store, sockets };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('JobsStore — connection', () => {
  it('connects to the /api/v1/ws/jobs URL', () => {
    const { store, sockets } = setup();
    store.connect();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toContain('ws/jobs');
  });

  it('marks connected=true on open and false on drop', () => {
    const { store, sockets } = setup();
    store.connect();
    expect(store.connected).toBe(false);
    sockets[0].open();
    expect(store.connected).toBe(true);
    sockets[0].drop();
    expect(store.connected).toBe(false);
  });

  it('connect() is idempotent — a second call opens no second socket', () => {
    const { store, sockets } = setup();
    store.connect();
    store.connect();
    expect(sockets).toHaveLength(1);
  });
});

describe('JobsStore — backfill reconciliation by id', () => {
  it('replaces the list from a backfill frame', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    sockets[0].emit({ type: 'backfill', jobs: [makeJob(1, 'running'), makeJob(2, 'succeeded')] });
    expect(store.jobs).toHaveLength(2);
  });

  it('de-dupes by job id across two backfills (reconnect contract)', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    sockets[0].emit({ type: 'backfill', jobs: [makeJob(1, 'running')] });
    // Reconnect: server re-sends a backfill carrying the SAME job id.
    sockets[0].emit({ type: 'backfill', jobs: [makeJob(1, 'succeeded'), makeJob(2, 'running')] });
    expect(store.jobs).toHaveLength(2); // no duplicate id-1 row
    expect(store.jobs.find((j) => j.id === 1)?.state).toBe('succeeded');
  });

  it('trims the list to the most recent 50 jobs', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    const many: Job[] = [];
    for (let i = 1; i <= 70; i++) many.push(makeJob(i, 'succeeded'));
    sockets[0].emit({ type: 'backfill', jobs: many });
    expect(store.jobs).toHaveLength(50);
  });
});

describe('JobsStore — single-job upsert', () => {
  it('upserts a job by id without spawning a duplicate row', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    sockets[0].emit({ type: 'job.running', job: makeJob(5, 'running') });
    sockets[0].emit({ type: 'job.completed', job: makeJob(5, 'succeeded') });
    expect(store.jobs).toHaveLength(1);
    expect(store.jobs[0].state).toBe('succeeded');
  });

  it('auto-opens the drawer for a long-running kind (D-02)', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    expect(store.drawerOpen).toBe(false);
    sockets[0].emit({ type: 'job.running', job: makeJob(9, 'running', { kind: 'vm.backup' }) });
    expect(store.drawerOpen).toBe(true);
  });

  it('does NOT auto-open the drawer for a fast power action', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    sockets[0].emit({ type: 'job.running', job: makeJob(10, 'running', { kind: 'vm.power' }) });
    expect(store.drawerOpen).toBe(false);
  });
});

describe('JobsStore — derived counts', () => {
  it('computes running / pending / failed / in-flight counts', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    sockets[0].emit({
      type: 'backfill',
      jobs: [
        makeJob(1, 'running'),
        makeJob(2, 'running'),
        makeJob(3, 'pending'),
        makeJob(4, 'failed'),
        makeJob(5, 'succeeded'),
      ],
    });
    expect(store.runningCount).toBe(2);
    expect(store.pendingCount).toBe(1);
    expect(store.failedCount).toBe(1);
    expect(store.inFlightCount).toBe(3);
  });
});

describe('JobsStore — failure acknowledgement', () => {
  it('marks failures unacknowledged on a failed transition', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    expect(store.failuresAcknowledged).toBe(true);
    sockets[0].emit({ type: 'job.running', job: makeJob(7, 'running') });
    sockets[0].emit({
      type: 'job.completed',
      job: makeJob(7, 'failed', { friendly_error: 'VM is locked.' }),
    });
    expect(store.failuresAcknowledged).toBe(false);
  });

  it('openDrawer() acknowledges failures and opens the drawer', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    sockets[0].emit({ type: 'job.completed', job: makeJob(8, 'failed') });
    expect(store.failuresAcknowledged).toBe(false);
    store.openDrawer();
    expect(store.drawerOpen).toBe(true);
    expect(store.failuresAcknowledged).toBe(true);
  });
});

describe('JobsStore — reconnect with backoff', () => {
  it('reconnects after a drop and reconciles via a fresh backfill', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    sockets[0].emit({ type: 'backfill', jobs: [makeJob(1, 'running')] });

    sockets[0].drop();
    expect(store.connected).toBe(false);

    // Backoff timer fires → a second socket is created.
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);

    sockets[1].open();
    sockets[1].emit({ type: 'backfill', jobs: [makeJob(1, 'succeeded')] });
    expect(store.connected).toBe(true);
    expect(store.jobs).toHaveLength(1);
    expect(store.jobs[0].state).toBe('succeeded');
  });

  it('disconnect() cancels any scheduled reconnect', () => {
    const { store, sockets } = setup();
    store.connect();
    sockets[0].open();
    sockets[0].drop();
    store.disconnect();
    vi.advanceTimersByTime(60000);
    expect(sockets).toHaveLength(1); // no reconnect after explicit disconnect
  });
});
