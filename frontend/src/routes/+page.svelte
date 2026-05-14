<!--
  Root dashboard — Phase 1 placeholder authenticated landing page.

  Per UI-SPEC, this is the only auth'd page in Phase 1 that doesn't have
  specific feature content; it just demonstrates the shell renders. Plans
  09 + 10 add /profile/*, /admin/*; Phase 2 lights up real inventory here.
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
