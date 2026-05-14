<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Table from '$lib/components/ui/table';
  import { Badge } from '$lib/components/ui/badge';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import CirclePlay from '@lucide/svelte/icons/circle-play';
  import CircleStop from '@lucide/svelte/icons/circle-stop';
  import CirclePause from '@lucide/svelte/icons/circle-pause';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Clock from '@lucide/svelte/icons/clock';
  import ClusterSection from '$lib/components/inventory/ClusterSection.svelte';
  import FilterChip from '$lib/components/inventory/FilterChip.svelte';
  import TagPill from '$lib/components/inventory/TagPill.svelte';
  import type { ClusterInventory, VMInventoryItem } from '$lib/api/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Status sort priority: running first, then paused, stopped, error, unknown.
  const STATUS_ORDER: Record<string, number> = {
    running: 0,
    paused: 1,
    stopped: 2,
    error: 3,
    unknown: 4,
  };

  // ---- Filter state (from URL params, per D-04) ----
  const params = $derived($page.url.searchParams);
  const q = $derived(params.get('q')?.toLowerCase() ?? '');
  const statusFilter = $derived(
    new Set((params.get('status') ?? '').split(',').filter(Boolean))
  );
  const tagFilter = $derived(
    new Set((params.get('tag') ?? '').split(',').filter(Boolean))
  );
  const clusterFilter = $derived(
    params.get('cluster') ? Number(params.get('cluster')) : null
  );
  const sort = $derived(params.get('sort') ?? 'status');
  const filterActive = $derived(
    q.length > 0 || statusFilter.size > 0 || tagFilter.size > 0 || clusterFilter !== null
  );

  function setParam(key: string, value: string | null) {
    const url = new URL($page.url);
    if (value === null || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
    goto(url.pathname + url.search, { keepFocus: true, replaceState: true });
  }

  function clearAll() {
    goto($page.url.pathname, { keepFocus: false });
  }

  function matchesFilter(it: VMInventoryItem): boolean {
    if (
      q &&
      !(
        it.name?.toLowerCase().includes(q) ||
        String(it.vmid).includes(q) ||
        it.tags.some((t) => t.includes(q))
      )
    ) {
      return false;
    }
    if (statusFilter.size > 0 && !statusFilter.has(it.status)) return false;
    if (tagFilter.size > 0 && !it.tags.some((t) => tagFilter.has(t))) return false;
    return true;
  }

  function compareItems(a: VMInventoryItem, b: VMInventoryItem): number {
    if (sort === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
    if (sort === 'vmid') return a.vmid - b.vmid;
    if (sort === 'last_changed') return 0; // backend doesn't expose — Phase 5 polish
    // Default: status priority + alphabetical name
    const sd = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (sd !== 0) return sd;
    return (a.name ?? '').localeCompare(b.name ?? '');
  }

  // Clusters visible given the current cluster filter.
  const clusters = $derived<ClusterInventory[]>(
    clusterFilter === null
      ? data.inventory
      : data.inventory.filter((c) => c.cluster_id === clusterFilter)
  );
</script>

<!-- Page header -->
<header class="flex flex-row items-start justify-between gap-4 mb-6">
  <div class="flex flex-col gap-1">
    <h1 class="text-[28px] font-semibold tracking-tight">Inventory</h1>
    <p class="text-muted-foreground text-[14px]">Your VMs and LXCs across all clusters.</p>
  </div>
</header>

<!-- Sticky filter row -->
<div class="sticky top-14 z-10 bg-background border-b border-border py-4 -mx-6 px-6 mb-6 flex flex-col gap-3">
  <div class="flex items-center gap-3">
    <Input
      placeholder="Search by name, vmid, or tag…"
      value={params.get('q') ?? ''}
      oninput={(e) => setParam('q', (e.target as HTMLInputElement).value)}
      class="flex-1"
    />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="outline" {...props}>Sort ▾</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onclick={() => setParam('sort', null)}>Status (default)</DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => setParam('sort', 'name')}>Name A→Z</DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => setParam('sort', 'vmid')}>VMID</DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => setParam('sort', 'last_changed')}>Last changed</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  {#if filterActive}
    <div class="flex flex-wrap items-center gap-2">
      {#if q}
        <FilterChip label={`search: ${q}`} onRemove={() => setParam('q', null)} />
      {/if}
      {#each Array.from(statusFilter) as s (s)}
        <FilterChip
          label={`status: ${s}`}
          onRemove={() => {
            const next = Array.from(statusFilter).filter((v) => v !== s).join(',');
            setParam('status', next || null);
          }}
        />
      {/each}
      {#each Array.from(tagFilter) as t (t)}
        <FilterChip
          label={`tag: ${t}`}
          onRemove={() => {
            const next = Array.from(tagFilter).filter((v) => v !== t).join(',');
            setParam('tag', next || null);
          }}
        />
      {/each}
      {#if clusterFilter !== null}
        <FilterChip
          label={`cluster: ${data.inventory.find((c) => c.cluster_id === clusterFilter)?.cluster_name ?? clusterFilter}`}
          onRemove={() => setParam('cluster', null)}
        />
      {/if}
      <button
        type="button"
        class="text-[13px] text-primary underline-offset-4 hover:underline"
        onclick={clearAll}
      >
        Clear all
      </button>
    </div>
  {/if}
</div>

<!-- Main content -->
{#if data.loadError}
  <div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center">
    <p class="text-[14px] font-medium">Couldn't load inventory.</p>
    <Button variant="outline" onclick={() => invalidateAll()}>Try again</Button>
  </div>
{:else if clusters.length === 0}
  <div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-16 text-center">
    <p class="text-[14px] font-medium">No VMs or LXCs in your scope yet.</p>
  </div>
{:else if data.inventory.length === 1 && clusterFilter === null}
  <!-- D-01: single cluster — flat table, no section header -->
  {@const c = data.inventory[0]}
  {@const filtered = c.items.filter(matchesFilter).sort(compareItems)}
  {#if filtered.length === 0}
    <div class="px-6 py-6 text-muted-foreground text-[14px]">
      {filterActive
        ? 'No VMs match the current filter in this cluster.'
        : `No VMs in ${c.cluster_name}.`}
    </div>
  {:else}
    <div class="rounded-md border border-border">
      <Table.Root>
        <Table.Body>
          {#each filtered as item (item.vmid)}
            <Table.Row
              class="hover:bg-muted/50 cursor-pointer h-14"
              onclick={() => goto(`/inventory/${item.cluster_id}/${item.vmid}`)}
            >
              <Table.Cell class="w-[140px]">
                {#if item.status === 'running'}
                  <CirclePlay class="size-4 text-success inline mr-1" />
                {:else if item.status === 'paused'}
                  <CirclePause class="size-4 text-warning inline mr-1" />
                {:else if item.status === 'stopped'}
                  <CircleStop class="size-4 text-muted-foreground inline mr-1" />
                {:else}
                  <CircleAlert class="size-4 text-destructive inline mr-1" />
                {/if}
                <span class="text-[14px]">{item.status}</span>
              </Table.Cell>
              <Table.Cell>
                <div class="font-medium text-[14px]">{item.name ?? `VM ${item.vmid}`}</div>
                <div class="font-mono text-[13px] text-muted-foreground">{item.vmid}</div>
              </Table.Cell>
              <Table.Cell>
                <div class="flex flex-wrap gap-1">
                  {#each item.tags.slice(0, 3) as t (t)}
                    <TagPill
                      tag={t}
                      onClick={() => {
                        const nxt = Array.from(new Set([...Array.from(tagFilter), t])).join(',');
                        setParam('tag', nxt);
                      }}
                    />
                  {/each}
                  {#if item.tags.length > 3}
                    <Badge variant="outline">+{item.tags.length - 3}</Badge>
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell class="text-muted-foreground text-[14px]">{item.node}</Table.Cell>
              <Table.Cell class="text-right w-[40px]">
                {#if item.is_stale}
                  <Clock class="size-4 text-warning inline mr-2" aria-label="Stale data" />
                {/if}
                <ChevronRight class="size-4 text-muted-foreground inline" />
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/if}
{:else}
  <!-- ≥2 clusters OR a specific cluster filter active — Accordion sections (D-01) -->
  <Accordion.Root
    type="multiple"
    value={clusters.map((c) => `cluster-${c.cluster_id}`)}
    class="flex flex-col gap-6"
  >
    {#each clusters as c (c.cluster_id)}
      {@const filtered = c.items.filter(matchesFilter).sort(compareItems)}
      <ClusterSection
        clusterId={c.cluster_id}
        clusterName={c.cluster_name}
        clusterStatus={c.cluster_status}
        isStale={c.is_stale}
        lastError={c.last_error}
        matched={filtered.length}
        total={c.items.length}
        {filterActive}
      >
        {#if filtered.length === 0}
          <div class="px-6 py-6 text-muted-foreground text-[14px]">
            {filterActive
              ? 'No VMs match the current filter in this cluster.'
              : `No VMs in ${c.cluster_name}.`}
          </div>
        {:else}
          <div class="rounded-md border border-border">
            <Table.Root>
              <Table.Body>
                {#each filtered as item (item.vmid)}
                  <Table.Row
                    class="hover:bg-muted/50 cursor-pointer h-14"
                    onclick={() => goto(`/inventory/${item.cluster_id}/${item.vmid}`)}
                  >
                    <Table.Cell class="w-[140px]">
                      {#if item.status === 'running'}
                        <CirclePlay class="size-4 text-success inline mr-1" />
                      {:else if item.status === 'paused'}
                        <CirclePause class="size-4 text-warning inline mr-1" />
                      {:else if item.status === 'stopped'}
                        <CircleStop class="size-4 text-muted-foreground inline mr-1" />
                      {:else}
                        <CircleAlert class="size-4 text-destructive inline mr-1" />
                      {/if}
                      <span class="text-[14px]">{item.status}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div class="font-medium text-[14px]">{item.name ?? `VM ${item.vmid}`}</div>
                      <div class="font-mono text-[13px] text-muted-foreground">{item.vmid}</div>
                    </Table.Cell>
                    <Table.Cell>
                      <div class="flex flex-wrap gap-1">
                        {#each item.tags.slice(0, 3) as t (t)}
                          <TagPill
                            tag={t}
                            onClick={() => {
                              const nxt = Array.from(new Set([...Array.from(tagFilter), t])).join(',');
                              setParam('tag', nxt);
                            }}
                          />
                        {/each}
                        {#if item.tags.length > 3}
                          <Badge variant="outline">+{item.tags.length - 3}</Badge>
                        {/if}
                      </div>
                    </Table.Cell>
                    <Table.Cell class="text-muted-foreground text-[14px]">{item.node}</Table.Cell>
                    <Table.Cell class="text-right w-[40px]">
                      {#if item.is_stale}
                        <Clock class="size-4 text-warning inline mr-2" aria-label="Stale data" />
                      {/if}
                      <ChevronRight class="size-4 text-muted-foreground inline" />
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        {/if}
      </ClusterSection>
    {/each}
  </Accordion.Root>
{/if}
