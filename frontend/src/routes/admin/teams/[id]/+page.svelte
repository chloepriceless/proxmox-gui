<script lang="ts">
  import { goto } from '$app/navigation';
  import { page as pageStore } from '$app/stores';
  import * as Tabs from '$lib/components/ui/tabs';
  import QuotaTab from '$lib/components/quotas/QuotaTab.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const tab = $derived(($pageStore.url.hash.replace('#', '')) || 'members');

  function setTab(v: string) {
    goto('#' + v, { replaceState: true, keepFocus: true });
  }
</script>

<header class="mb-6">
  <h1 class="text-[28px] font-semibold tracking-tight">Team: {data.quotas.team_name}</h1>
</header>

<Tabs.Root value={tab} onValueChange={setTab}>
  <Tabs.List class="h-9">
    <Tabs.Trigger value="members">Members</Tabs.Trigger>
    <Tabs.Trigger value="quotas">Quotas</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="members">
    <p class="text-muted-foreground text-[14px] mt-6">
      Member management ships in Phase 1 admin shell — Phase 2 adds the Quotas tab to this same page.
    </p>
  </Tabs.Content>

  <Tabs.Content value="quotas">
    <p class="text-muted-foreground text-[13px] mt-4 mb-4">
      Per-cluster limits enforced on every create or resize.
    </p>
    {#if data.loadError}
      <p class="text-destructive text-[14px]">Couldn't load quota data. Refresh the page to retry.</p>
    {:else}
      <QuotaTab
        teamId={data.teamId}
        initial={data.quotas}
        onSaved={() => location.reload()}
      />
    {/if}
  </Tabs.Content>
</Tabs.Root>
