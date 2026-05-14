<!--
  Sidebar — Hetzner-style left rail.

  Contract: UI-SPEC §Sidebar contract.
    - Phase 1 sections: "Account" (always visible), "Admin" (is_admin only).
    - Phase 2 additions (Plan 02-05): "Resources" section above "Account"
      with Inventory + Audit log links (UI-SPEC §Sidebar nav additions).
    - Active item: bg-muted background + 3px left-edge primary bar.
    - 240px wide >=lg, collapses to 56px icon-only at <lg.
    - All icons drawn from the UI-SPEC §Icons allow-list.
-->
<script lang="ts">
  import { page } from '$app/stores';
  import User from '@lucide/svelte/icons/user';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import Key from '@lucide/svelte/icons/key';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Users from '@lucide/svelte/icons/users';
  import Server from '@lucide/svelte/icons/server';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import History from '@lucide/svelte/icons/history';
  import type { Component } from 'svelte';
  import type { CurrentUser } from '$lib/stores/user.svelte';

  type NavItem = {
    href: string;
    label: string;
    icon: Component;
    external?: boolean;
  };

  let { user }: { user: CurrentUser } = $props();

  const resourceItems: NavItem[] = [
    { href: '/inventory', label: 'Inventory', icon: ListChecks },
    { href: '/audit', label: 'Audit log', icon: History }
  ];

  const accountItems: NavItem[] = [
    { href: '/profile', label: 'Profile', icon: User },
    { href: '/profile/ssh-keys', label: 'SSH keys', icon: KeyRound },
    { href: '/profile/tokens', label: 'API tokens', icon: Key }
  ];

  const adminItems: NavItem[] = [
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/clusters', label: 'Clusters', icon: Server }
  ];

  const docsItem: NavItem = {
    href: '/api/v1/docs',
    label: 'API docs',
    icon: ExternalLink,
    external: true
  };

  function isActive(href: string, pathname: string): boolean {
    // Exact match on root segment; startsWith for nested. Avoid matching
    // '/profile/ssh-keys' as active when '/profile' is the link.
    if (href === pathname) return true;
    return pathname.startsWith(href + '/');
  }
</script>

<aside
  class="bg-muted/40 hidden h-full w-14 shrink-0 border-r border-border lg:flex lg:w-60 lg:flex-col"
  aria-label="Primary navigation"
>
  <nav class="flex flex-1 flex-col gap-6 px-2 py-4 lg:px-3">

    <!-- Resources section (Phase 2) — Inventory + Audit log -->
    <div>
      <h2
        class="text-muted-foreground mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-wider lg:block"
      >
        Resources
      </h2>
      <ul class="flex flex-col gap-0.5">
        {#each resourceItems as item (item.href)}
          {@const active = isActive(item.href, $page.url.pathname)}
          <li class="relative">
            {#if active}
              <span
                aria-hidden="true"
                class="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary"
              ></span>
            {/if}
            <a
              href={item.href}
              class="flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors hover:bg-muted {active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'}"
              aria-current={active ? 'page' : undefined}
            >
              <item.icon
                class="size-4 shrink-0 {active ? 'text-primary' : ''}"
                aria-hidden="true"
              />
              <span class="hidden lg:inline">{item.label}</span>
            </a>
          </li>
        {/each}
      </ul>
    </div>

    <!-- Account section -->
    <div>
      <h2
        class="text-muted-foreground mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-wider lg:block"
      >
        Account
      </h2>
      <ul class="flex flex-col gap-0.5">
        {#each accountItems as item (item.href)}
          {@const active = isActive(item.href, $page.url.pathname)}
          <li class="relative">
            {#if active}
              <span
                aria-hidden="true"
                class="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary"
              ></span>
            {/if}
            <a
              href={item.href}
              class="flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors hover:bg-muted {active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'}"
              aria-current={active ? 'page' : undefined}
            >
              <item.icon
                class="size-4 shrink-0 {active ? 'text-primary' : ''}"
                aria-hidden="true"
              />
              <span class="hidden lg:inline">{item.label}</span>
            </a>
          </li>
        {/each}
        <li class="relative">
          <a
            href={docsItem.href}
            target="_blank"
            rel="noopener noreferrer"
            class="flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <docsItem.icon class="size-4 shrink-0" aria-hidden="true" />
            <span class="hidden lg:inline">{docsItem.label}</span>
          </a>
        </li>
      </ul>
    </div>

    {#if user?.is_admin}
      <div>
        <h2
          class="text-muted-foreground mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-wider lg:block"
        >
          Admin
        </h2>
        <ul class="flex flex-col gap-0.5">
          {#each adminItems as item (item.href)}
            {@const active = isActive(item.href, $page.url.pathname)}
            <li class="relative">
              {#if active}
                <span
                  aria-hidden="true"
                  class="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary"
                ></span>
              {/if}
              <a
                href={item.href}
                class="flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors hover:bg-muted {active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'}"
                aria-current={active ? 'page' : undefined}
              >
                <item.icon
                  class="size-4 shrink-0 {active ? 'text-primary' : ''}"
                  aria-hidden="true"
                />
                <span class="hidden lg:inline">{item.label}</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </nav>
</aside>
