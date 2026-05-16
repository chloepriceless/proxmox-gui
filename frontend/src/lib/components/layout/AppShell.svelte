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
  import TasksDrawer from '$lib/components/jobs/TasksDrawer.svelte';
  import { Toaster } from '$lib/components/ui/sonner';
  import { jobsStore } from '$lib/stores/jobs.svelte';
  import type { CurrentUser } from '$lib/stores/user.svelte';

  type ClusterSummary = { id: number; name: string };

  let {
    user,
    clusters = [],
    children,
  }: { user: CurrentUser; clusters?: ClusterSummary[]; children: Snippet } = $props();

  // Open the Tasks WebSocket once per shell mount; close it on teardown.
  $effect(() => {
    jobsStore.connect();
    return () => jobsStore.disconnect();
  });

  // The Quota drawer and the Tasks drawer are both right-side Sheets — they
  // are mutually exclusive (UI-SPEC Implementation Note 3). When both end up
  // open, the most recently opened one wins and the other is closed.
  let quotaOpen = $state(false);
  let lastOpened = $state<'tasks' | 'quota' | null>(null);
  $effect(() => {
    if (jobsStore.drawerOpen && !quotaOpen) lastOpened = 'tasks';
    else if (quotaOpen && !jobsStore.drawerOpen) lastOpened = 'quota';
    else if (jobsStore.drawerOpen && quotaOpen) {
      // Both open — close whichever was NOT opened last.
      if (lastOpened === 'tasks') quotaOpen = false;
      else jobsStore.closeDrawer();
    }
  });
</script>

<a
  href="#main-content"
  class="bg-primary text-primary-foreground sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
>
  Skip to content
</a>

<div class="bg-background flex min-h-screen flex-col text-foreground">
  <Topbar {user} {clusters} bind:quotaOpen />
  <div class="flex flex-1 overflow-hidden">
    <Sidebar {user} />
    <main id="main-content" class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-screen-xl px-6 py-8">
        {@render children()}
      </div>
    </main>
  </div>
</div>

<!-- Tasks drawer — global right-side Sheet, mounted once per shell alongside
     the QuotaIndicator drawer. Its open-state lives in jobsStore. -->
<TasksDrawer />

<!-- Sonner toast portal — mounted once per shell so any auth'd page can toast.
     Per UI-SPEC §Component States: bottom-right, success/error/info/warning. -->
<Toaster position="bottom-right" richColors closeButton />
