<script lang="ts">
  import { goto } from '$app/navigation';
  import { page as pageStore } from '$app/stores';
  import * as Tabs from '$lib/components/ui/tabs';
  import QuotaTab from '$lib/components/quotas/QuotaTab.svelte';
  import NetworksTab from '$lib/components/networks/NetworksTab.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const tab = $derived(($pageStore.url.hash.replace('#', '')) || 'members');

  function setTab(v: string) {
    goto('#' + v, { replaceState: true, keepFocus: true });
  }

  // The Networks tab scopes per cluster (D-18) — the cluster set comes from
  // the team's quota rows, which carry one row per bound cluster.
  const teamClusters = $derived(
    data.quotas.rows.map((r) => ({ cluster_id: r.cluster_id, cluster_name: r.cluster_name }))
  );
</script>

<header class="mb-6">
  <h1 class="text-[28px] font-semibold tracking-tight">Team: {data.quotas.team_name}</h1>
</header>

<Tabs.Root value={tab} onValueChange={setTab}>
  <Tabs.List class="h-9">
    <Tabs.Trigger value="members">Members</Tabs.Trigger>
    <Tabs.Trigger value="quotas">Quotas</Tabs.Trigger>
    <Tabs.Trigger value="networks">Networks</Tabs.Trigger>
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

  <Tabs.Content value="networks">
    <p class="text-muted-foreground text-[13px] mt-4 mb-4">
      Per-cluster SDN VNet and legacy-bridge visibility for this team. Legacy
      bridges are granted by default; SDN VNets must be granted explicitly.
    </p>
    {#if data.loadError}
      <p class="text-destructive text-[14px]">
        Couldn't load cluster data. Refresh the page to retry.
      </p>
    {:else}
      <NetworksTab teamId={data.teamId} clusters={teamClusters} />
    {/if}
  </Tabs.Content>
</Tabs.Root>
