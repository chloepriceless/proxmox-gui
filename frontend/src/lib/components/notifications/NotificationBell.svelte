<!--
  NotificationBell — the Topbar notification bell (Plan 04-14, UI-07).

  Contract: 04-UI-SPEC §"Notification bell" + D-22 / D-23.
    - A 36px (`h-9 w-9`) `variant="ghost"` button — chrome copied verbatim
      from the Phase-3 Tasks-icon block in Topbar.svelte. The `Bell` icon
      swaps to `BellRing` while there are unread completions.
    - A 20px (`h-5 min-w-[1.25rem]`) absolutely-positioned unread badge:
      hidden at 0, `9+` above 9, `bg-primary` normally, `bg-destructive` when
      any unread item is a failed job (the Phase-3 failure-dominance rule).
    - Click opens a 380px popover panel — a scrollable feed of recent task
      *completions* (D-22). Opening the panel calls `api.notifications.markSeen`
      and resets the unread count ("open acknowledges", mirroring the Tasks
      icon). Clicking a row deep-links to the resource.
    - Empty state: `BellOff` + "No notifications" + "Completed tasks will show
      up here."

  The feed is a *derived view* over the jobs table (D-23): the authoritative
  load is `GET /notifications`, reconciled with the live job completions the
  jobsStore already streams.
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import * as Popover from '$lib/components/ui/popover';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import Bell from '@lucide/svelte/icons/bell';
  import BellRing from '@lucide/svelte/icons/bell-ring';
  import BellOff from '@lucide/svelte/icons/bell-off';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import { api } from '$lib/api/client';
  import { jobsStore } from '$lib/stores/jobs.svelte';
  import type { NotificationItem } from '$lib/api/types';
  import {
    badgeClass,
    badgeLabel,
    badgeVisible,
    bellAriaLabel,
    notificationHref,
    notificationTitle,
    reconcileFeed,
    rowAccentClass
  } from './notification-feed';

  // The REST feed — the authoritative load. Refreshed on mount + on open.
  let restItems = $state<NotificationItem[]>([]);
  let restUnread = $state(0);
  let loadError = $state(false);
  let open = $state(false);

  // Project the jobsStore's terminal jobs into NotificationItem shape so the
  // live completion stream reconciles with the REST feed without a refetch.
  const liveItems = $derived(
    jobsStore.jobs
      .filter((j) => j.state === 'succeeded' || j.state === 'failed')
      .map((j) => ({
        id: j.id,
        kind: j.kind,
        state: j.state,
        cluster_id: j.cluster_id,
        team_id: j.team_id,
        friendly_error: j.friendly_error,
        created_at: j.created_at,
        finished_at: j.finished_at
      }))
  );

  const items = $derived(reconcileFeed(restItems, liveItems));
  // The unread count: while the panel is open everything is acknowledged.
  const unreadCount = $derived(open ? 0 : restUnread);
  const showBadge = $derived(badgeVisible(unreadCount));
  const label = $derived(badgeLabel(unreadCount));
  const badgeColor = $derived(badgeClass(items, unreadCount));

  async function load() {
    try {
      const feed = await api.notifications.listNotifications();
      restItems = feed.items;
      restUnread = feed.unread_count;
      loadError = false;
    } catch {
      loadError = true;
    }
  }

  $effect(() => {
    load();
  });

  // Opening the panel marks everything seen (open acknowledges — UI-SPEC).
  async function onOpenChange(next: boolean) {
    open = next;
    if (next) {
      try {
        const feed = await api.notifications.markSeen();
        restItems = feed.items;
        restUnread = feed.unread_count;
        loadError = false;
      } catch {
        // markSeen failure is non-fatal — the panel still opens with the
        // last-known feed; the badge simply does not reset server-side.
      }
    }
  }

  function openRow(item: NotificationItem) {
    open = false;
    const href = notificationHref(item);
    if (href) {
      goto(href);
    } else {
      jobsStore.openDrawer();
    }
  }
</script>

<Popover.Root bind:open {onOpenChange}>
  <Popover.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        class="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={bellAriaLabel(unreadCount)}
      >
        {#if showBadge}
          <BellRing class="size-4" aria-hidden="true" />
        {:else}
          <Bell class="size-4" aria-hidden="true" />
        {/if}
        {#if showBadge}
          <span
            class={`absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold ${badgeColor}`}
            aria-hidden="true"
          >
            {label}
          </span>
        {/if}
      </button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content align="end" class="w-[380px] p-0">
    <div class="border-b border-border px-4 py-3">
      <p class="text-[14px] font-semibold">Notifications</p>
    </div>

    {#if loadError}
      <div class="px-4 py-10 text-center">
        <p class="text-[14px] text-destructive">Couldn't load notifications.</p>
        <button
          type="button"
          class="text-primary mt-2 text-[13px] hover:underline"
          onclick={load}
        >
          Try again
        </button>
      </div>
    {:else if items.length === 0}
      <div class="flex flex-col items-center px-4 py-12 text-center">
        <BellOff class="size-6 text-muted-foreground" aria-hidden="true" />
        <p class="mt-3 text-[14px] font-medium">No notifications</p>
        <p class="mt-1 text-[14px] text-muted-foreground">
          Completed tasks will show up here.
        </p>
      </div>
    {:else}
      <ScrollArea class="max-h-[360px]">
        <ul>
          {#each items as item (item.id)}
            <li>
              <button
                type="button"
                class={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted ${rowAccentClass(item)}`}
                onclick={() => openRow(item)}
              >
                {#if item.state === 'failed'}
                  <CircleAlert
                    class="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                {:else}
                  <CircleCheck
                    class="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                {/if}
                <span class="min-w-0 flex-1">
                  <span class="block text-[14px]">{notificationTitle(item)}</span>
                  {#if item.state === 'failed' && item.friendly_error}
                    <span class="block truncate text-[13px] text-muted-foreground">
                      {item.friendly_error}
                    </span>
                  {/if}
                  {#if item.created_at}
                    <span class="block text-[13px] font-medium text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  {/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </ScrollArea>
    {/if}
  </Popover.Content>
</Popover.Root>
