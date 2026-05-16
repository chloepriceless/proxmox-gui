// Notification-bell behaviour tests — Plan 04-14 Task 2.
//
// The vitest environment is `node` — no DOM, so Svelte components cannot be
// mounted (same constraint as every Phase 1-4 component test, which are all
// logic-only — see tests/lxc-wizard.test.ts, tests/empty-state.test.ts).
//
// We therefore test the *logic* the NotificationBell carries, exercising the
// real code in `notification-feed.ts`:
//   - the badge label / visibility / failure-dominance color
//   - the bell aria-label
//   - the feed reconciliation (REST + live jobsStore, terminal-only, sorted)
//   - the notification row title + accent + deep-link
//
// The rendered Svelte props/markup are exercised end-to-end by
// `pnpm exec svelte-check` (the typed-props contract) — see the plan verify.

import { describe, expect, it } from 'vitest';
import {
  badgeClass,
  badgeLabel,
  badgeVisible,
  bellAriaLabel,
  notificationHref,
  notificationTitle,
  reconcileFeed,
  rowAccentClass
} from '$lib/components/notifications/notification-feed';
import type { NotificationItem } from '$lib/api/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function item(over: Partial<NotificationItem>): NotificationItem {
  return {
    id: 1,
    kind: 'vm.create',
    state: 'succeeded',
    cluster_id: 1,
    team_id: 1,
    friendly_error: null,
    created_at: '2026-05-16T10:00:00Z',
    finished_at: '2026-05-16T10:01:00Z',
    ...over
  };
}

// ---------------------------------------------------------------------------
// Badge — visibility, label, failure-dominance color
// ---------------------------------------------------------------------------

describe('NotificationBell badge', () => {
  it('hides the badge at 0 unread', () => {
    expect(badgeVisible(0)).toBe(false);
  });

  it('shows the badge with at least one unread completion', () => {
    expect(badgeVisible(1)).toBe(true);
    expect(badgeVisible(5)).toBe(true);
  });

  it('labels the badge with the exact count up to 9', () => {
    expect(badgeLabel(0)).toBe('0');
    expect(badgeLabel(3)).toBe('3');
    expect(badgeLabel(9)).toBe('9');
  });

  it('overflows to "9+" above 9', () => {
    expect(badgeLabel(10)).toBe('9+');
    expect(badgeLabel(42)).toBe('9+');
  });

  it('is bg-primary when every unread item is a succeeded job', () => {
    const items = [item({ id: 1, state: 'succeeded' }), item({ id: 2, state: 'succeeded' })];
    expect(badgeClass(items, 2)).toContain('bg-primary');
  });

  it('is bg-destructive when ANY unread item is a failed job', () => {
    const items = [item({ id: 1, state: 'succeeded' }), item({ id: 2, state: 'failed' })];
    expect(badgeClass(items, 2)).toContain('bg-destructive');
  });

  it('only the first unreadCount rows count toward the failure-dominance color', () => {
    // The failed job is the 3rd row but unreadCount is 2 — it is already read.
    const items = [
      item({ id: 1, state: 'succeeded' }),
      item({ id: 2, state: 'succeeded' }),
      item({ id: 3, state: 'failed' })
    ];
    expect(badgeClass(items, 2)).toContain('bg-primary');
  });
});

// ---------------------------------------------------------------------------
// Bell aria-label
// ---------------------------------------------------------------------------

describe('NotificationBell aria-label', () => {
  it('composes the pinned aria-label copy', () => {
    expect(bellAriaLabel(0)).toBe('Notifications: 0 unread. Open notifications.');
    expect(bellAriaLabel(4)).toBe('Notifications: 4 unread. Open notifications.');
  });
});

// ---------------------------------------------------------------------------
// Feed reconciliation — REST + live, terminal-only, newest-first
// ---------------------------------------------------------------------------

describe('reconcileFeed', () => {
  it('keeps only terminal (succeeded/failed) rows — completions only (D-22)', () => {
    const live = [
      item({ id: 1, state: 'running' }),
      item({ id: 2, state: 'pending' }),
      item({ id: 3, state: 'succeeded' })
    ];
    const out = reconcileFeed([], live);
    expect(out.map((r) => r.id)).toEqual([3]);
  });

  it('merges by id — the live row wins over the stale REST row', () => {
    const rest = [item({ id: 7, state: 'succeeded', kind: 'vm.create' })];
    const live = [item({ id: 7, state: 'failed', kind: 'vm.create' })];
    const out = reconcileFeed(rest, live);
    expect(out).toHaveLength(1);
    expect(out[0].state).toBe('failed');
  });

  it('sorts newest-first by created_at', () => {
    const rest = [
      item({ id: 1, created_at: '2026-05-16T08:00:00Z' }),
      item({ id: 2, created_at: '2026-05-16T12:00:00Z' }),
      item({ id: 3, created_at: '2026-05-16T10:00:00Z' })
    ];
    const out = reconcileFeed(rest, []);
    expect(out.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it('trims to the limit', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      item({ id: i + 1, created_at: `2026-05-16T${String(i % 24).padStart(2, '0')}:00:00Z` })
    );
    expect(reconcileFeed(many, [], 50)).toHaveLength(50);
  });
});

// ---------------------------------------------------------------------------
// Notification row — title, accent, deep-link
// ---------------------------------------------------------------------------

describe('notification row', () => {
  it('titles a succeeded create job from its kind', () => {
    expect(notificationTitle(item({ kind: 'vm.create', state: 'succeeded' }))).toBe('Create');
  });

  it('titles a failed job with a "failed" suffix', () => {
    expect(notificationTitle(item({ kind: 'vm.backup', state: 'failed' }))).toBe('Backup failed');
  });

  it('tints a succeeded row with border-l-success', () => {
    expect(rowAccentClass(item({ state: 'succeeded' }))).toContain('border-success');
  });

  it('tints a failed row with border-l-destructive', () => {
    expect(rowAccentClass(item({ state: 'failed' }))).toContain('border-destructive');
  });

  it('deep-links a cluster-tagged row to the cluster inventory', () => {
    expect(notificationHref(item({ cluster_id: 3 }))).toBe('/inventory?cluster=3');
  });

  it('returns null for a job with no cluster (caller opens the Tasks drawer)', () => {
    expect(notificationHref(item({ cluster_id: null }))).toBeNull();
  });
});
