<!--
  Root layout — every page renders inside this.

  Behaviour in Plan 01-03:
    - Imports app.css once at the SPA root.
    - Calls theme.init() onMount to align the persisted preference with the
      reactive store (app.html already applied the dark class synchronously
      to prevent FOUC; init() is the runtime authority going forward).
    - Wraps {@render children()} in <AppShell> when data.user is set.
      For unauthenticated routes (Plan 08 adds /login and /setup) the shell
      is bypassed and the page renders bare against the muted background.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import '../app.css';
  import { theme } from '$lib/stores/theme.svelte';
  import { user as userStore } from '$lib/stores/user.svelte';
  import AppShell from '$lib/components/layout/AppShell.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  onMount(() => {
    theme.init();
  });

  // Hydrate the user store from the server load. Plan 08 wires the real
  // /api/v1/me probe; for now `data.user` is always null and the store
  // stays empty.
  $effect(() => {
    userStore.set(data.user);
  });
</script>

{#if data.user}
  <AppShell user={data.user}>
    {@render children()}
  </AppShell>
{:else}
  <div class="bg-background min-h-screen text-foreground">
    <AppShell user={null}>
      {@render children()}
    </AppShell>
  </div>
{/if}
