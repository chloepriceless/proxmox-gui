<!--
  Root dashboard — Phase 1 placeholder.

  This is the only feature route this plan implements. Plan 08 (frontend
  UI implementation) adds /login, /setup, /profile/*, /admin/*.
-->
<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Dashboard — Proxmox GUI</title>
</svelte:head>

<div class="flex flex-col gap-6">
  <header class="flex flex-col gap-2">
    <h1 class="text-[28px] font-semibold tracking-tight">Dashboard</h1>
    <p class="text-muted-foreground text-sm">VM and LXC inventory lands in Phase 2.</p>
  </header>

  {#if !data.apiReachable}
    <p class="text-muted-foreground text-sm">
      Backend unreachable. Start the FastAPI service to see live data.
    </p>
  {/if}
</div>
