// WebSocket-backed jobs store — the live source of truth for the Tasks drawer
// and the Topbar count badge.
//
// Plan 03-05. Consumes the Plan 03-02 `/api/v1/ws/jobs` WebSocket:
//   on connect → { type: "backfill", jobs: [...] }
//   thereafter → { type: "job.running" | "job.progress" | "job.completed", job }
//                { type: "reaper.reattached", job_ids: [...] }
//
// `.svelte.ts` rune-store convention (mirrors stores/user.svelte.ts) — a class
// holding `$state` fields, exported as a singleton.
//
// Reconnect contract (UI-SPEC §"WebSocket / reconnection contract"):
//   - On a dropped socket: `connected = false`, schedule a backoff reconnect.
//   - On reconnect the server re-sends `backfill`; the store reconciles by
//     `job.id` so no duplicate rows ever appear.
//   - The list is client-trimmed to the most recent 50 jobs (T-03-05-05 —
//     memory stays bounded).

import { toast } from 'svelte-sonner';
import { api } from '$lib/api/client';
import type { Job, JobState } from '$lib/api/types';

/** Long-running kinds that auto-open the drawer when enqueued (D-02). */
const LONG_KINDS = new Set(['vm.clone', 'vm.migrate', 'vm.backup', 'vm.restore']);

/** Terminal states — a transition into one of these fires the completion toast. */
const TERMINAL: ReadonlySet<JobState> = new Set<JobState>(['succeeded', 'failed']);

/** Max job rows kept client-side (UI-SPEC ordering rule + T-03-05-05). */
const MAX_JOBS = 50;

/** Reconnect backoff steps in ms — not a tight loop (T-03-05-05). */
const BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];

/** Inbound WebSocket message shapes. */
type WsMessage =
  | { type: 'backfill'; jobs: Job[] }
  | { type: 'job.running' | 'job.progress' | 'job.completed'; job: Job }
  | { type: 'reaper.reattached'; job_ids: number[] };

/** Minimal WebSocket surface the store needs — lets tests inject a fake. */
export interface WsLike {
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

export type WsFactory = (url: string) => WsLike;

/** Build the same-origin ws/wss URL for the jobs WebSocket. */
function defaultWsUrl(): string {
  if (typeof location === 'undefined') return 'ws://localhost/api/v1/ws/jobs';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/api/v1/ws/jobs`;
}

/** Pretty action label for toast copy — "vm.power" → "Power", etc. */
function actionLabel(kind: string): string {
  const tail = kind.split('.').slice(1).join(' ') || kind;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

class JobsStore {
  /** Live job list, newest-first, trimmed to MAX_JOBS. */
  jobs = $state<Job[]>([]);
  /** Whether the WebSocket is currently open. */
  connected = $state(false);
  /** Whether the Tasks drawer Sheet is open. */
  drawerOpen = $state(false);
  /**
   * False while there is an unacknowledged failure — drives the red badge.
   * Opening the drawer acknowledges (sets it back to true).
   */
  failuresAcknowledged = $state(true);

  // Derived counts — consumed by the Topbar badge + the drawer summary line.
  runningCount = $derived(this.jobs.filter((j) => j.state === 'running').length);
  pendingCount = $derived(
    this.jobs.filter((j) => j.state === 'pending' || j.state === 'claimed').length
  );
  failedCount = $derived(this.jobs.filter((j) => j.state === 'failed').length);
  inFlightCount = $derived(this.runningCount + this.pendingCount);

  #ws: WsLike | null = null;
  #wsFactory: WsFactory;
  #wsUrl: string;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #reconnectAttempt = 0;
  #closedByUs = false;
  /** When true (tests), the store skips firing sonner toasts. */
  #silent: boolean;

  constructor(opts?: { wsFactory?: WsFactory; wsUrl?: string; silent?: boolean }) {
    this.#wsFactory =
      opts?.wsFactory ??
      ((url: string) => new WebSocket(url) as unknown as WsLike);
    this.#wsUrl = opts?.wsUrl ?? defaultWsUrl();
    this.#silent = opts?.silent ?? false;
  }

  /** Open the WebSocket. Idempotent — a second call while open is a no-op. */
  connect(): void {
    if (this.#ws) return;
    this.#closedByUs = false;
    this.#openSocket();
  }

  /** Close the WebSocket and cancel any pending reconnect. */
  disconnect(): void {
    this.#closedByUs = true;
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    if (this.#ws) {
      this.#ws.close();
      this.#ws = null;
    }
    this.connected = false;
  }

  #openSocket(): void {
    const ws = this.#wsFactory(this.#wsUrl);
    this.#ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.#reconnectAttempt = 0;
    };
    ws.onmessage = (ev) => this.#handleMessage(ev.data);
    ws.onclose = () => {
      this.connected = false;
      this.#ws = null;
      if (!this.#closedByUs) this.#scheduleReconnect();
    };
    ws.onerror = () => {
      // onclose follows an error; reconnect is scheduled there.
    };
  }

  #scheduleReconnect(): void {
    if (this.#reconnectTimer) return;
    const delay = BACKOFF_MS[Math.min(this.#reconnectAttempt, BACKOFF_MS.length - 1)];
    this.#reconnectAttempt += 1;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      if (!this.#closedByUs) this.#openSocket();
    }, delay);
  }

  /** Parse + dispatch one inbound WebSocket frame. */
  #handleMessage(data: unknown): void {
    let msg: WsMessage;
    try {
      msg = typeof data === 'string' ? (JSON.parse(data) as WsMessage) : (data as WsMessage);
    } catch {
      return; // ignore malformed frames
    }
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'backfill') {
      this.#applyBackfill(msg.jobs ?? []);
    } else if (
      msg.type === 'job.running' ||
      msg.type === 'job.progress' ||
      msg.type === 'job.completed'
    ) {
      if (msg.job) this.upsertJob(msg.job);
    } else if (msg.type === 'reaper.reattached') {
      const n = msg.job_ids?.length ?? 0;
      if (n > 0 && !this.#silent) {
        toast.info(`Resumed tracking ${n} task(s) that were running before a restart.`);
      }
    }
  }

  /**
   * Replace the list from a `backfill` frame, reconciled by `id` — on a
   * reconnect this is the de-dup point (UI-SPEC reconnect contract).
   */
  #applyBackfill(incoming: Job[]): void {
    const byId = new Map<number, Job>();
    for (const j of this.jobs) byId.set(j.id, j);
    for (const j of incoming) byId.set(j.id, j);
    this.jobs = this.#sortAndTrim([...byId.values()]);
  }

  /**
   * Upsert a single job by `id` — replaces an existing row or prepends a new
   * one (never spawns a duplicate). On a transition into a terminal state the
   * completion toast fires (D-03); a long-kind job auto-opens the drawer (D-02).
   */
  upsertJob(job: Job): void {
    const prev = this.jobs.find((j) => j.id === job.id);
    const next = this.jobs.filter((j) => j.id !== job.id);
    next.unshift(job);
    this.jobs = this.#sortAndTrim(next);

    // Auto-open the drawer for long-running kinds on first sighting (D-02).
    if (!prev && LONG_KINDS.has(job.kind)) {
      this.drawerOpen = true;
    }

    // Fire the completion toast on a transition into a terminal state (D-03).
    const enteredTerminal =
      TERMINAL.has(job.state) && (!prev || !TERMINAL.has(prev.state));
    if (enteredTerminal) {
      if (job.state === 'failed') {
        this.failuresAcknowledged = false;
        if (!this.#silent) {
          const detail = job.friendly_error ?? job.error ?? 'see the Tasks drawer';
          toast.error(`${actionLabel(job.kind)} failed: ${detail}.`, {
            duration: Infinity,
            action: { label: 'Open in Tasks', onClick: () => this.openDrawer() },
          });
        }
      } else if (job.state === 'succeeded' && !this.#silent) {
        toast.success(`${actionLabel(job.kind)} finished.`);
      }
    }
  }

  /** newest-first, running floated above completed, trimmed to MAX_JOBS. */
  #sortAndTrim(list: Job[]): Job[] {
    const rank = (s: JobState): number =>
      s === 'running' || s === 'pending' || s === 'claimed' ? 0 : 1;
    const sorted = [...list].sort((a, b) => {
      const r = rank(a.state) - rank(b.state);
      if (r !== 0) return r;
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
    return sorted.slice(0, MAX_JOBS);
  }

  /** Open the drawer — opening also acknowledges any failures (UI-SPEC). */
  openDrawer(): void {
    this.drawerOpen = true;
    this.failuresAcknowledged = true;
  }

  /** Close the drawer. */
  closeDrawer(): void {
    this.drawerOpen = false;
  }

  /**
   * Retry a failed job (D-16). Re-arms the SAME job row server-side; the
   * WebSocket then streams its pending→running transition back in place.
   */
  async retry(id: number): Promise<void> {
    await api.jobs.retryJob(id);
  }
}

/** The singleton store the app shell, drawer and Topbar all consume. */
export const jobsStore = new JobsStore();

/** Exported for unit tests that need an isolated instance with a fake socket. */
export { JobsStore };
