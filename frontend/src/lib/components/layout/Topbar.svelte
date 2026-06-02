<!--
  Topbar — 56px tall, full-width header.

  Contract: UI-SPEC §Topbar contract.
    - Left: 24×24 logo + product name "Proxmox GUI" (Heading 18/600).
    - Center: ClusterContextPicker (Phase 2 — replaces Phase 1 disabled <Select>).
    - Right: [QuotaIndicator slot] ThemeToggle + UserMenu (DropdownMenu off avatar).
    - Bottom border 1px --border.

  Phase 2 (Plan 02-05):
    - Disabled <Select> replaced with <ClusterContextPicker /> combobox.
    - A comment slot reserves the QuotaIndicator position for Plan 02-06.
    - Topbar now receives `clusters` prop from AppShell (sourced from
      +layout.server.ts which fetches api.clusters.list).
-->
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import MobileNav from '$lib/components/layout/MobileNav.svelte';
  import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte';
  import ClusterContextPicker from '$lib/components/inventory/ClusterContextPicker.svelte';
  import QuotaIndicator from '$lib/components/quotas/QuotaIndicator.svelte';
  import NotificationBell from '$lib/components/notifications/NotificationBell.svelte';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import { api } from '$lib/api/client';
  import { jobsStore } from '$lib/stores/jobs.svelte';
  import type { CurrentUser } from '$lib/stores/user.svelte';

  type ClusterSummary = { id: number; name: string };

  // `quotaOpen` is bindable so AppShell can keep the Quota drawer and the
  // Tasks drawer mutually exclusive (UI-SPEC Implementation Note 3).
  let {
    user,
    clusters = [],
    quotaOpen = $bindable(false),
  }: { user: CurrentUser; clusters?: ClusterSummary[]; quotaOpen?: boolean } = $props();

  function initials(u: NonNullable<CurrentUser>): string {
    const name = u.username || u.email || '?';
    const parts = name.split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async function logout() {
    // api.auth.logout swallows errors — backend logout is idempotent.
    await api.auth.logout();
    await invalidateAll();
    await goto('/login');
  }

  // Tasks-icon count badge (UI-SPEC §"Topbar — Tasks icon" + §"Tasks count
  // badge color"). The badge shows the in-flight count; it turns destructive
  // when there is an unacknowledged failure, primary while running.
  const taskCount = $derived(jobsStore.inFlightCount);
  const hasUnackedFailure = $derived(
    jobsStore.failedCount > 0 && !jobsStore.failuresAcknowledged
  );
  const badgeVisible = $derived(taskCount > 0 || hasUnackedFailure);
  const badgeLabel = $derived(taskCount > 9 ? '9+' : String(taskCount));
  const badgeClass = $derived(
    hasUnackedFailure
      ? 'bg-destructive text-destructive-foreground'
      : 'bg-primary text-primary-foreground'
  );
</script>

<header
  class="bg-background flex h-14 items-center justify-between gap-4 border-b border-border px-4 lg:px-6"
>
  <div class="flex items-center gap-2">
    <!-- Mobile hamburger — only visible <lg, where the Sidebar rail is hidden. -->
    <MobileNav {user} />
    <!-- Logo: simple geometric mark. Replace with a designed SVG later. -->
    <svg
      viewBox="0 0 24 24"
      class="size-6 text-primary"
      role="img"
      aria-label="Proxmox GUI logo"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
    <span class="text-lg font-semibold tracking-tight">Proxmox GUI</span>
  </div>

  <div class="hidden md:block">
    <ClusterContextPicker {clusters} />
  </div>

  <div class="flex items-center gap-2">
    <!-- Notification bell — Plan 04-14, left of the Tasks icon (UI-07). -->
    <NotificationBell />
    <!-- Tasks icon — left of QuotaIndicator. Click opens the Tasks drawer. -->
    <button
      type="button"
      class="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={`Tasks: ${jobsStore.runningCount} running, ${jobsStore.failedCount} failed. Open task drawer.`}
      onclick={() => jobsStore.openDrawer()}
    >
      <ListChecks class="size-4" aria-hidden="true" />
      {#if badgeVisible}
        <span
          class={`absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold ${badgeClass}`}
          aria-hidden="true"
        >
          {badgeLabel}
        </span>
      {/if}
    </button>
    <QuotaIndicator bind:open={quotaOpen} />
    <ThemeToggle />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <button
            {...props}
            class="bg-muted text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-full border border-border text-[11px] font-semibold transition-colors"
            aria-label="Open user menu"
          >
            {user ? initials(user) : '?'}
          </button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item>
          {#snippet child({ props })}
            <a href="/profile" {...props}>Profile</a>
          {/snippet}
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          {#snippet child({ props })}
            <a href="/profile/ssh-keys" {...props}>SSH keys</a>
          {/snippet}
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          {#snippet child({ props })}
            <a href="/profile/tokens" {...props}>API tokens</a>
          {/snippet}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={logout}>Log out</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</header>
