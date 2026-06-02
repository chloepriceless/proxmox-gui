// Idle-session store (Plan 05-06, AUTH-06 D-03/D-04) — Svelte 5 runes singleton.
//
// Contract (RESEARCH §Pattern 2 — the CLIENT side of idle timeout):
//   - Tracks `lastActivity`; debounced mousemove/keydown/click/scroll/touch
//     listeners bump it.
//   - The idle window comes from the admin settings (idle_timeout_minutes,
//     D-02 default 30); init() fetches it.
//   - ~2 min before the window elapses, `showCountdown` flips true → the layout
//     surfaces IdleCountdownToast (a live countdown + a "Stay signed in"
//     keepalive button).
//   - At the window, `showExpired` flips true → the layout surfaces
//     SessionExpiredModal (an in-place re-auth overlay that preserves route).
//
// IMPORTANT — this timer is UX-ONLY. The AUTHORITATIVE idle gate is the
// server-side refresh refusal (Plan 05-01: /auth/refresh -> 401
// session_idle_expired). A tampered client clock cannot extend a session past
// the server window (Threat T-05-06-01); markExpired() also lets the API layer
// drive the modal when the server reports expiry first.
//
// SSR safety: state is rune-backed so the module imports on the server; init()
// and the listeners are guarded by `typeof window`.

import { getSettings, keepalive } from '$lib/api/settings';

const DEFAULT_IDLE_MINUTES = 30;
const WARN_LEAD_MS = 2 * 60 * 1000; // surface the countdown 2 min before logout
const ACTIVITY_THROTTLE_MS = 1000;
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

class IdleStore {
  /** Last observed user activity (epoch ms). */
  lastActivity = $state(Date.now());
  /** The configured idle window in ms (default 30 min until init() loads it). */
  idleTimeoutMs = $state(DEFAULT_IDLE_MINUTES * 60 * 1000);
  /** Ticked once per second by init()'s interval so the deriveds recompute. */
  now = $state(Date.now());
  /** True once the session has idle-expired (locally or per the server). */
  expired = $state(false);

  private started = false;

  /** Milliseconds until idle logout (never negative). */
  msUntilIdle = $derived(
    Math.max(0, this.idleTimeoutMs - (this.now - this.lastActivity))
  );
  /** Whole seconds remaining — drives the countdown toast label. */
  secondsRemaining = $derived(Math.ceil(this.msUntilIdle / 1000));
  /** Show the 2-minute countdown toast (but not once fully expired). */
  showCountdown = $derived(
    !this.expired && this.msUntilIdle > 0 && this.msUntilIdle <= WARN_LEAD_MS
  );
  /** Show the session-expired re-auth modal. */
  showExpired = $derived(this.expired);

  /**
   * Install activity listeners + the 1s tick, and load the configured idle
   * window. Safe to call once (guards re-entry). Called from the root layout's
   * onMount alongside theme.init().
   */
  async init(): Promise<void> {
    if (typeof window === 'undefined' || this.started) return;
    this.started = true;

    // Best-effort: load the admin-configured idle window. A failure (not yet
    // logged in / API down) keeps the 30-min default.
    try {
      const s = await getSettings();
      if (s?.idle_timeout_minutes && s.idle_timeout_minutes > 0) {
        this.idleTimeoutMs = s.idle_timeout_minutes * 60 * 1000;
      }
    } catch {
      // keep default
    }

    let lastBump = 0;
    const onActivity = () => {
      const t = Date.now();
      if (t - lastBump < ACTIVITY_THROTTLE_MS) return;
      lastBump = t;
      // Activity does NOT silently revive an expired session — re-auth is
      // required via the modal; only resume() clears `expired`.
      if (!this.expired) this.lastActivity = t;
    };
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    setInterval(() => {
      this.now = Date.now();
      if (!this.expired && this.msUntilIdle <= 0) this.expired = true;
    }, 1000);
  }

  /** "Stay signed in" — the cheap no-rotation keepalive; resets the timer. */
  async staySignedIn(): Promise<void> {
    try {
      await keepalive();
    } catch {
      // The next real API call will get the authoritative answer; resetting
      // the local timer here is harmless even if the keepalive failed.
    }
    this.lastActivity = Date.now();
    this.now = Date.now();
  }

  /** Let the API layer drive the modal when the SERVER reports expiry first. */
  markExpired(): void {
    this.expired = true;
  }

  /** Called after a successful re-auth in SessionExpiredModal. */
  resume(): void {
    this.expired = false;
    this.lastActivity = Date.now();
    this.now = Date.now();
  }
}

export const idle = new IdleStore();
