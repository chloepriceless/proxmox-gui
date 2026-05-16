// notification-feed — the pure, framework-free logic for the Topbar
// notification bell (Plan 04-14, UI-07).
//
// Extracted from `NotificationBell.svelte` so the badge / title / feed-row
// logic is unit-testable in the `node` vitest env (the same discipline as
// Plan 04-11's `lxc-wizard.ts` and Phase 3's `snapshot-tree.ts`). The rendered
// Svelte props/markup are exercised end-to-end by `pnpm exec svelte-check`.
//
// References:
//   - 04-UI-SPEC §"Notification bell" — the 20px badge, `9+` overflow, the
//     primary-vs-destructive failure-dominance rule, the row contract
//   - D-22 (completions only) / D-23 (derived feed, no new store)

import type { NotificationItem } from '$lib/api/types';

/** The unread cursor: badge hidden at 0, `9+` above 9. */
export const BADGE_OVERFLOW = 9;

/** Terminal job states the bell surfaces — completions only (D-22). */
const TERMINAL = new Set(['succeeded', 'failed']);

/**
 * The unread-count badge label. Hidden at 0 (the caller checks
 * `badgeVisible`); `9+` once the count passes {@link BADGE_OVERFLOW}.
 */
export function badgeLabel(unreadCount: number): string {
  if (unreadCount > BADGE_OVERFLOW) return `${BADGE_OVERFLOW}+`;
  return String(unreadCount);
}

/** The badge renders only when there is at least one unread completion. */
export function badgeVisible(unreadCount: number): boolean {
  return unreadCount > 0;
}

/**
 * The badge color class. `bg-destructive` dominates when ANY unread item is a
 * failed job (the Phase-3 failure-dominance rule); `bg-primary` otherwise.
 *
 * Only the first `unreadCount` feed rows are "unread" — the feed is
 * newest-first and the cursor count tells us how many lead rows are new.
 */
export function badgeClass(items: NotificationItem[], unreadCount: number): string {
  const unread = items.slice(0, Math.max(0, unreadCount));
  const anyFailed = unread.some((it) => it.state === 'failed');
  return anyFailed
    ? 'bg-destructive text-destructive-foreground'
    : 'bg-primary text-primary-foreground';
}

/** The Topbar bell `aria-label` — pinned copy (UI-SPEC §Notification bell). */
export function bellAriaLabel(unreadCount: number): string {
  return `Notifications: ${unreadCount} unread. Open notifications.`;
}

/**
 * The human-readable title for one feed row — "Created vm-101",
 * "Backup vm-200 failed", etc. Derived from the job `kind` + `state`; the kind
 * is `subsystem.verb[.detail]` (e.g. `vm.create`, `vm.snapshot.delete`).
 */
export function notificationTitle(item: NotificationItem): string {
  const parts = item.kind.split('.');
  const verb = parts.slice(1).join(' ') || item.kind;
  const pretty = verb.charAt(0).toUpperCase() + verb.slice(1);
  if (item.state === 'failed') {
    return item.friendly_error ? `${pretty} failed` : `${pretty} failed`;
  }
  return pretty;
}

/** A succeeded row tints its left edge `--success`; a failed row `--destructive`. */
export function rowAccentClass(item: NotificationItem): string {
  return item.state === 'failed'
    ? 'border-l-2 border-destructive'
    : 'border-l-2 border-success';
}

/**
 * Reconcile the REST feed with the live job events from the jobsStore.
 *
 * The bell's authoritative feed is `GET /notifications`, but the jobsStore
 * also streams completions live — merge by `id` (the jobsStore row wins on a
 * conflict since it is the freshest), keep only TERMINAL rows (D-22), sort
 * newest-first, and trim. A row missing a `created_at` sorts last.
 */
export function reconcileFeed(
  restItems: NotificationItem[],
  liveItems: NotificationItem[],
  limit = 50
): NotificationItem[] {
  const byId = new Map<number, NotificationItem>();
  for (const it of restItems) byId.set(it.id, it);
  for (const it of liveItems) byId.set(it.id, it);
  const merged = [...byId.values()].filter((it) => TERMINAL.has(it.state));
  merged.sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
  return merged.slice(0, limit);
}

/**
 * The deep-link target for a feed row — the resource detail page when the job
 * carries a cluster, otherwise null (the caller falls back to opening the
 * Tasks drawer). The vmid is not on the notification row, so a cluster-only
 * job links to the cluster inventory filtered view.
 */
export function notificationHref(item: NotificationItem): string | null {
  if (item.cluster_id == null) return null;
  return `/inventory?cluster=${item.cluster_id}`;
}
