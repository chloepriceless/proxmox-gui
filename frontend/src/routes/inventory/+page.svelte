<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Table from '$lib/components/ui/table';
  import { Badge } from '$lib/components/ui/badge';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import CirclePlay from '@lucide/svelte/icons/circle-play';
  import CircleStop from '@lucide/svelte/icons/circle-stop';
  import CirclePause from '@lucide/svelte/icons/circle-pause';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Clock from '@lucide/svelte/icons/clock';
  import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import Play from '@lucide/svelte/icons/play';
  import Square from '@lucide/svelte/icons/square';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import Power from '@lucide/svelte/icons/power';
  import { toast } from 'svelte-sonner';
  import ClusterSection from '$lib/components/inventory/ClusterSection.svelte';
  import FilterChip from '$lib/components/inventory/FilterChip.svelte';
  import TagPill from '$lib/components/inventory/TagPill.svelte';
  import { api } from '$lib/api/client';
  import type {
    ClusterInventory,
    PowerActionName,
    VMInventoryItem,
  } from '$lib/api/types';
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

  // ---- Per-row power menu (D-09) ----
  function vmName(it: VMInventoryItem): string {
    return it.name ?? `VM ${it.vmid}`;
  }

  /** Map the API resource kind from the Proxmox-native item type. */
  function kindOf(it: VMInventoryItem): 'vm' | 'lxc' {
    return it.type === 'lxc' ? 'lxc' : 'vm';
  }

  /** Title-case label for toast / dialog copy. */
  function label(action: PowerActionName): string {
    return action.charAt(0).toUpperCase() + action.slice(1);
  }

  /** Whether a power action is allowed for the row's current status. */
  function actionDisabled(it: VMInventoryItem, action: PowerActionName): boolean {
    if (action === 'start') return it.status === 'running';
    // stop / reboot / shutdown need a running guest.
    return it.status !== 'running';
  }

  async function rowPower(it: VMInventoryItem, action: PowerActionName) {
    try {
      await api.lifecycle.power({
        clusterId: it.cluster_id,
        vmid: it.vmid,
        type: kindOf(it),
        action,
      });
      toast(`${label(action)} queued for ${vmName(it)}.`);
    } catch {
      toast.error(`Couldn’t queue ${label(action)} for ${vmName(it)}. Try again.`);
    }
  }

  // ---- Bulk-select mode (D-11, LIFE-03) ----
  let bulkMode = $state(false);
  /** Keys of selected rows — "clusterId:vmid". */
  let selected = $state<Set<string>>(new Set());

  function rowKey(it: VMInventoryItem): string {
    return `${it.cluster_id}:${it.vmid}`;
  }

  /** Every visible (filtered) item across all visible clusters. */
  const visibleItems = $derived(
    clusters.flatMap((c) => c.items.filter(matchesFilter))
  );

  function isSelected(it: VMInventoryItem): boolean {
    return selected.has(rowKey(it));
  }

  function toggleRow(it: VMInventoryItem) {
    const key = rowKey(it);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selected = next;
  }

  /** Header "select all (filtered)" — checked / indeterminate / unchecked. */
  const allChecked = $derived(
    visibleItems.length > 0 && visibleItems.every(isSelected)
  );
  const someChecked = $derived(visibleItems.some(isSelected) && !allChecked);

  function toggleSelectAll() {
    if (allChecked) {
      selected = new Set();
    } else {
      selected = new Set(visibleItems.map(rowKey));
    }
  }

  function clearSelection() {
    selected = new Set();
  }

  function toggleBulkMode() {
    bulkMode = !bulkMode;
    if (!bulkMode) selected = new Set();
  }

  /** The selected items, resolved back to inventory rows. */
  const selectedItems = $derived(
    visibleItems.filter(isSelected)
  );

  const selectedClusterNames = $derived(
    Array.from(
      new Set(
        selectedItems.map(
          (it) =>
            data.inventory.find((c) => c.cluster_id === it.cluster_id)?.cluster_name ??
            `Cluster ${it.cluster_id}`
        )
      )
    )
  );

  // ---- Bulk confirm dialog (D-11) ----
  let bulkDialogOpen = $state(false);
  let bulkAction = $state<PowerActionName>('start');
  let bulkBusy = $state(false);

  function openBulkConfirm(action: PowerActionName) {
    if (selectedItems.length === 0) return;
    bulkAction = action;
    bulkDialogOpen = true;
  }

  /** "This will reboot 3 resources: vm-100, vm-101, vm-102 …" (truncated). */
  const bulkNameList = $derived.by(() => {
    const names = selectedItems.map(vmName);
    if (names.length <= 6) return names.join(', ');
    return `${names.slice(0, 6).join(', ')} and ${names.length - 6} more`;
  });

  async function confirmBulk() {
    if (bulkBusy || selectedItems.length === 0) return;
    bulkBusy = true;
    try {
      await api.lifecycle.bulkPower({
        action: bulkAction,
        targets: selectedItems.map((it) => ({
          cluster_id: it.cluster_id,
          vmid: it.vmid,
        })),
      });
      toast(`${label(bulkAction)} started for ${selectedItems.length} resources.`);
      bulkDialogOpen = false;
      selected = new Set();
    } catch {
      toast.error(`Couldn’t queue the bulk ${bulkAction}. Try again.`);
    } finally {
      bulkBusy = false;
    }
  }
</script>

<!-- Per-row "⋯" power menu — context-aware; NO Delete (UI-SPEC D-09). -->
{#snippet rowMenu(item: VMInventoryItem)}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="ghost"
          class="h-9 w-9 p-0"
          aria-label={`Actions for ${vmName(item)}`}
          onclick={(e: MouseEvent) => e.stopPropagation()}
        >
          <MoreHorizontal class="size-4" aria-hidden="true" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end">
      <DropdownMenu.Item
        disabled={actionDisabled(item, 'start')}
        onSelect={() => rowPower(item, 'start')}
      >
        <Play class="size-4 mr-2" aria-hidden="true" /> Start
      </DropdownMenu.Item>
      <DropdownMenu.Item
        disabled={actionDisabled(item, 'stop')}
        onSelect={() => rowPower(item, 'stop')}
      >
        <Square class="size-4 mr-2" aria-hidden="true" /> Stop
      </DropdownMenu.Item>
      <DropdownMenu.Item
        disabled={actionDisabled(item, 'reboot')}
        onSelect={() => rowPower(item, 'reboot')}
      >
        <RotateCw class="size-4 mr-2" aria-hidden="true" /> Reboot
      </DropdownMenu.Item>
      <DropdownMenu.Item
        disabled={actionDisabled(item, 'shutdown')}
        onSelect={() => rowPower(item, 'shutdown')}
      >
        <Power class="size-4 mr-2" aria-hidden="true" /> Shutdown
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        onSelect={() => goto(`/inventory/${item.cluster_id}/${item.vmid}`)}
      >
        Open detail →
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}

<!-- One inventory row — shared by the single-cluster + accordion views. -->
{#snippet inventoryRow(item: VMInventoryItem)}
  <Table.Row
    class="hover:bg-muted/50 h-14 {bulkMode ? '' : 'cursor-pointer'}"
    onclick={() => {
      if (!bulkMode) goto(`/inventory/${item.cluster_id}/${item.vmid}`);
    }}
  >
    {#if bulkMode}
      <Table.Cell class="w-10">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected(item)}
            onCheckedChange={() => toggleRow(item)}
            aria-label={`Select ${vmName(item)}`}
          />
        </div>
      </Table.Cell>
    {/if}
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
      <div class="font-medium text-[14px]">{vmName(item)}</div>
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
    <Table.Cell class="text-right">
      <div class="flex items-center justify-end gap-1">
        {#if item.is_stale}
          <Clock class="size-4 text-warning inline" aria-label="Stale data" />
        {/if}
        {@render rowMenu(item)}
        <ChevronRight class="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
    </Table.Cell>
  </Table.Row>
{/snippet}

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
    <Button
      variant="outline"
      size="sm"
      onclick={toggleBulkMode}
      aria-pressed={bulkMode}
    >
      <ListChecks class="size-3.5" aria-hidden="true" /> Select
    </Button>
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

<!-- Bulk-action bar — slides in at ≥1 selected. Only Start / Stop / Reboot
     buttons; a batch destructive action is intentionally excluded
     (ROADMAP-locked exclusion — UI-SPEC Implementation Note 9). -->
{#if bulkMode && selectedItems.length > 0}
  <div
    class="sticky top-[7.5rem] z-10 -mx-6 mb-6 flex h-14 items-center justify-between
           gap-3 border-b border-border bg-muted px-6"
  >
    <div class="flex items-center gap-3">
      <span class="text-[14px] font-medium">{selectedItems.length} selected</span>
      <button
        type="button"
        class="text-[13px] text-primary underline-offset-4 hover:underline"
        onclick={clearSelection}
      >
        Clear selection
      </button>
    </div>
    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" onclick={() => openBulkConfirm('start')}>
        <Play class="size-3.5" aria-hidden="true" /> Start
      </Button>
      <Button variant="outline" size="sm" onclick={() => openBulkConfirm('stop')}>
        <Square class="size-3.5" aria-hidden="true" /> Stop
      </Button>
      <Button variant="outline" size="sm" onclick={() => openBulkConfirm('reboot')}>
        <RotateCw class="size-3.5" aria-hidden="true" /> Reboot
      </Button>
    </div>
  </div>
{/if}

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
        {#if bulkMode}
          <Table.Header>
            <Table.Row>
              <Table.Head class="w-10">
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all filtered"
                />
              </Table.Head>
              <Table.Head colspan={5}></Table.Head>
            </Table.Row>
          </Table.Header>
        {/if}
        <Table.Body>
          {#each filtered as item (item.vmid)}
            {@render inventoryRow(item)}
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
              {#if bulkMode}
                <Table.Header>
                  <Table.Row>
                    <Table.Head class="w-10">
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all filtered"
                      />
                    </Table.Head>
                    <Table.Head colspan={5}></Table.Head>
                  </Table.Row>
                </Table.Header>
              {/if}
              <Table.Body>
                {#each filtered as item (item.vmid)}
                  {@render inventoryRow(item)}
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        {/if}
      </ClusterSection>
    {/each}
  </Accordion.Root>
{/if}

<!-- Bulk confirm — a single alert-dialog covering the whole batch (D-11). -->
<AlertDialog.Root bind:open={bulkDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        {label(bulkAction)} {selectedItems.length} resources?
      </AlertDialog.Title>
      <AlertDialog.Description>
        This {bulkAction}s {selectedItems.length} resources: {bulkNameList}. Each runs as
        its own task.
        {#if selectedClusterNames.length > 1}
          Spanning {selectedClusterNames.join(' and ')}.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <Button
        variant="ghost"
        onclick={() => (bulkDialogOpen = false)}
        disabled={bulkBusy}
      >
        Cancel
      </Button>
      <Button onclick={confirmBulk} disabled={bulkBusy}>
        {label(bulkAction)} {selectedItems.length} resources
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
