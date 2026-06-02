<!--
  MobileNav — the <lg hamburger drawer (Plan 05-05, D-13).

  A hamburger Button (class `lg:hidden` so it only shows below the `lg`
  breakpoint where the static Sidebar rail is hidden) that opens a left-side
  shadcn-svelte Sheet. The Sheet is the vendored bits-ui Dialog primitive —
  focus-trap, scroll-lock, Escape handling and the dialog ARIA come for free
  (RESEARCH §Don't Hand-Roll — this also serves the D-17 a11y pass).

  The nav arrays come from `$lib/nav` — the SAME definitions the Sidebar uses,
  so the two navs can never drift.
-->
<script lang="ts">
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';
  import Menu from '@lucide/svelte/icons/menu';
  import * as Sheet from '$lib/components/ui/sheet';
  import { Button } from '$lib/components/ui/button';
  import {
    resourceItems,
    accountItems,
    adminItems,
    docsItem,
    isActive
  } from '$lib/nav';
  import type { CurrentUser } from '$lib/stores/user.svelte';

  let { user }: { user: CurrentUser } = $props();

  let open = $state(false);

  // Close the drawer after any client-side navigation so it does not linger
  // over the page the user just navigated to.
  afterNavigate(() => {
    open = false;
  });

  const linkClass =
    'flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors';
</script>

<Sheet.Root bind:open>
  <Sheet.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="ghost"
        size="icon"
        class="lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu class="size-5" aria-hidden="true" />
      </Button>
    {/snippet}
  </Sheet.Trigger>
  <Sheet.Content side="left" class="w-72 sm:w-72">
    <Sheet.Header>
      <Sheet.Title>Navigation</Sheet.Title>
    </Sheet.Header>

    <nav class="flex flex-col gap-6 overflow-y-auto px-2 pb-6" aria-label="Primary">
      <!-- Resources -->
      <div>
        <h2 class="text-muted-foreground mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider">
          Resources
        </h2>
        <ul class="flex flex-col gap-0.5">
          {#each resourceItems as item (item.href)}
            {@const active = isActive(item.href, $page.url.pathname)}
            <li>
              <a
                href={item.href}
                class="{linkClass} {active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                aria-current={active ? 'page' : undefined}
              >
                <item.icon class="size-4 shrink-0 {active ? 'text-primary' : ''}" aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>

      <!-- Account -->
      <div>
        <h2 class="text-muted-foreground mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider">
          Account
        </h2>
        <ul class="flex flex-col gap-0.5">
          {#each accountItems as item (item.href)}
            {@const active = isActive(item.href, $page.url.pathname)}
            <li>
              <a
                href={item.href}
                class="{linkClass} {active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                aria-current={active ? 'page' : undefined}
              >
                <item.icon class="size-4 shrink-0 {active ? 'text-primary' : ''}" aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            </li>
          {/each}
          <li>
            <a
              href={docsItem.href}
              target="_blank"
              rel="noopener noreferrer"
              class="{linkClass} text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <docsItem.icon class="size-4 shrink-0" aria-hidden="true" />
              <span>{docsItem.label}</span>
            </a>
          </li>
        </ul>
      </div>

      {#if user?.is_admin}
        <!-- Admin -->
        <div>
          <h2 class="text-muted-foreground mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider">
            Admin
          </h2>
          <ul class="flex flex-col gap-0.5">
            {#each adminItems as item (item.href)}
              {@const active = isActive(item.href, $page.url.pathname)}
              <li>
                <a
                  href={item.href}
                  class="{linkClass} {active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                  aria-current={active ? 'page' : undefined}
                >
                  <item.icon class="size-4 shrink-0 {active ? 'text-primary' : ''}" aria-hidden="true" />
                  <span>{item.label}</span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </nav>
  </Sheet.Content>
</Sheet.Root>
