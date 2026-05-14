<!--
  AppShell — vertical Topbar + horizontal (Sidebar + Main) grid.

  Contract: UI-SPEC §Layout Contracts §App shell.
    - Topbar fixed at 56px (h-14) across all auth'd routes.
    - Sidebar 240px expanded (w-60), 56px collapsed (w-14) at <lg.
    - Main: max-w-screen-xl, px-6 (lg=24px), py-8 (xl=32px), centred.
    - Skip-to-content link for keyboard users (a11y floor).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Topbar from '$lib/components/layout/Topbar.svelte';
  import type { CurrentUser } from '$lib/stores/user.svelte';

  let { user, children }: { user: CurrentUser; children: Snippet } = $props();
</script>

<a
  href="#main-content"
  class="bg-primary text-primary-foreground sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
>
  Skip to content
</a>

<div class="bg-background flex min-h-screen flex-col text-foreground">
  <Topbar {user} />
  <div class="flex flex-1 overflow-hidden">
    <Sidebar {user} />
    <main id="main-content" class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-screen-xl px-6 py-8">
        {@render children()}
      </div>
    </main>
  </div>
</div>
