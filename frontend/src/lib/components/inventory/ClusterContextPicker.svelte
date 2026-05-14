<!--
  ClusterContextPicker — Topbar combobox for selecting the active cluster context.

  Contract: UI-SPEC §Component Contracts §ClusterContextPicker.

    Mount: Topbar center (replaces Phase 1 disabled <Select>)
    Trigger: Button variant="outline" 220px wide, h-9, ChevronsUpDown icon
    Options: "All clusters" + each cluster name
    State: localStorage["proxmox-gui:cluster-context"] (D-02)
    URL sync: updates ?cluster= on the current page on selection change

  The cluster context and the URL filter chip are independent (UI-SPEC D-02):
  the picker is a session-wide preference; the URL filter is page-scoped.
  Picking a cluster here writes to localStorage AND updates the URL if on a
  page that supports per-cluster filtering (/inventory).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
  import * as Popover from '$lib/components/ui/popover';
  import * as Command from '$lib/components/ui/command';
  import { Button } from '$lib/components/ui/button';
  import {
    ALL_CLUSTERS,
    getClusterContext,
    setClusterContext,
    type ClusterContext,
  } from '$lib/utils/cluster_context';

  type Cluster = { id: number; name: string };

  type Props = {
    clusters: Cluster[];
    class?: string;
  };

  let { clusters, class: className = '' }: Props = $props();

  let open = $state(false);
  let value = $state<ClusterContext>(ALL_CLUSTERS);

  onMount(() => {
    value = getClusterContext();
  });

  const label = $derived(
    value === ALL_CLUSTERS
      ? 'All clusters'
      : (clusters.find((c) => c.id === value)?.name ?? `Cluster ${value}`)
  );

  function choose(v: ClusterContext) {
    value = v;
    setClusterContext(v);
    open = false;
    // Sync the URL ?cluster= filter chip on /inventory so the visible list
    // reflows without a full page navigation.
    const url = new URL($page.url);
    if (v === ALL_CLUSTERS) {
      url.searchParams.delete('cluster');
    } else {
      url.searchParams.set('cluster', String(v));
    }
    goto(url.pathname + url.search, { replaceState: true, keepFocus: true });
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        variant="outline"
        class="w-[220px] justify-between h-9 {className}"
        {...props}
        aria-label="Cluster context"
      >
        <span class="truncate text-[14px]">{label}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-[260px] p-0" align="start">
    <Command.Root>
      <Command.Input placeholder="Filter clusters…" />
      <Command.List>
        <Command.Empty>No clusters registered. Ask your administrator.</Command.Empty>
        <Command.Group>
          <Command.Item value={ALL_CLUSTERS} onSelect={() => choose(ALL_CLUSTERS)}>
            All clusters
          </Command.Item>
          {#each clusters as c (c.id)}
            <Command.Item value={String(c.id)} onSelect={() => choose(c.id)}>
              {c.name}
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
