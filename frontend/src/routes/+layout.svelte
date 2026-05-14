<!--
  Root layout — every page renders inside this.

  Behaviour:
    - Imports app.css once at the SPA root.
    - Calls theme.init() onMount to align the persisted preference with the
      reactive store (app.html already applied the dark class synchronously
      to prevent FOUC; init() is the runtime authority going forward).
    - Wraps {@render children()} in <AppShell> when data.user is set AND we
      are NOT on /login or /setup. Those routes use their own minimal chrome
      (centred card on muted background) and must NOT inherit the sidebar.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { page } from '$app/stores';
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
  // /api/v1/me probe; the store reflects whatever +layout.server.ts returned.
  $effect(() => {
    userStore.set(data.user);
  });

  const pathname = $derived($page.url.pathname);
  // SvelteKit 2's typed pathname is a string-literal union of known routes.
  // We coerce to plain string for the prefix checks so future routes don't
  // trip the literal narrowing.
  const isPublic = $derived(
    (pathname as string) === '/login' ||
      (pathname as string).startsWith('/login/') ||
      (pathname as string) === '/setup' ||
      (pathname as string).startsWith('/setup/')
  );
</script>

{#if data.user && !isPublic}
  <AppShell user={data.user} clusters={data.clusters ?? []}>
    {@render children()}
  </AppShell>
{:else}
  <!-- /login and /setup own their minimal chrome (centred card on muted bg). -->
  {@render children()}
{/if}
