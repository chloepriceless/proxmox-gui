/**
 * Shared navigation definitions (Plan 05-05, D-13).
 *
 * The sidebar nav-item arrays + the `isActive` helper used to live inside
 * `Sidebar.svelte`. They are factored out here so `Sidebar.svelte` (the static
 * `lg+` rail) AND `MobileNav.svelte` (the `<lg` hamburger drawer) share exactly
 * ONE nav definition — there is no second place a route can drift.
 */
import type { Component } from 'svelte';
import User from '@lucide/svelte/icons/user';
import KeyRound from '@lucide/svelte/icons/key-round';
import Key from '@lucide/svelte/icons/key';
import ExternalLink from '@lucide/svelte/icons/external-link';
import Users from '@lucide/svelte/icons/users';
import UsersRound from '@lucide/svelte/icons/users-round';
import Server from '@lucide/svelte/icons/server';
import Settings from '@lucide/svelte/icons/settings';
import ListChecks from '@lucide/svelte/icons/list-checks';
import History from '@lucide/svelte/icons/history';
import CalendarClock from '@lucide/svelte/icons/calendar-clock';

export type NavItem = {
  href: string;
  label: string;
  icon: Component;
  external?: boolean;
};

export const resourceItems: NavItem[] = [
  { href: '/inventory', label: 'Inventory', icon: ListChecks },
  { href: '/audit', label: 'Audit log', icon: History },
  { href: '/backups', label: 'Backups', icon: CalendarClock }
];

export const accountItems: NavItem[] = [
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/profile/ssh-keys', label: 'SSH keys', icon: KeyRound },
  { href: '/profile/tokens', label: 'API tokens', icon: Key }
];

export const adminItems: NavItem[] = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/teams', label: 'Teams', icon: UsersRound },
  { href: '/admin/clusters', label: 'Clusters', icon: Server },
  { href: '/admin/settings', label: 'Settings', icon: Settings }
];

export const docsItem: NavItem = {
  href: '/api/v1/docs',
  label: 'API docs',
  icon: ExternalLink,
  external: true
};

/**
 * Whether a nav href is the active route. Exact match on the link, plus a
 * nested `startsWith(href + '/')` so `/profile` is not flagged active when the
 * user is on `/profile/ssh-keys` (a distinct nav item).
 */
export function isActive(href: string, pathname: string): boolean {
  if (href === pathname) return true;
  return pathname.startsWith(href + '/');
}
