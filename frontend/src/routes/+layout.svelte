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
  import { idle } from '$lib/stores/idle.svelte';
  import { user as userStore } from '$lib/stores/user.svelte';
  import AppShell from '$lib/components/layout/AppShell.svelte';
  import SessionExpiredModal from '$lib/components/auth/SessionExpiredModal.svelte';
  import IdleCountdownToast from '$lib/components/auth/IdleCountdownToast.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  onMount(() => {
    theme.init();
    // AUTH-06 (Plan 05-06): start the client idle timer (UX-only — the server
    // refresh refusal is authoritative). The API layer dispatches a
    // `session_idle_expired` event when /auth/refresh reports the server-side
    // idle expiry first; surface the same re-auth modal (belt-and-braces).
    void idle.init();
    const onServerExpiry = () => idle.markExpired();
    window.addEventListener('session_idle_expired', onServerExpiry);
    return () => window.removeEventListener('session_idle_expired', onServerExpiry);
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
  <!-- Idle-session UX (AUTH-06 D-03/D-04) — rendered ABOVE the shell as
       overlays so the underlying route + in-page state survive a session
       expiry. Only on authenticated, non-public routes. -->
  {#if idle.showCountdown}
    <IdleCountdownToast />
  {/if}
  <SessionExpiredModal />
{:else}
  <!-- /login and /setup own their minimal chrome (centred card on muted bg). -->
  {@render children()}
{/if}
