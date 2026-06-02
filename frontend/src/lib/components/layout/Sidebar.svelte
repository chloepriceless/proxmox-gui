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
  import type { CurrentUser } from '$lib/stores/user.svelte';
  // Shared nav definitions (Plan 05-05, D-13) — one source for both the
  // static lg+ rail (this file) and the <lg hamburger drawer (MobileNav).
  import {
    resourceItems,
    accountItems,
    adminItems,
    docsItem,
    isActive
  } from '$lib/nav';

  let { user }: { user: CurrentUser } = $props();
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
