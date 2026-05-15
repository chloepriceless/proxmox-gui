<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { toast } from 'svelte-sonner';
  import Lock from '@lucide/svelte/icons/lock';
  import TagPill from '$lib/components/inventory/TagPill.svelte';
  import TagInput from '$lib/components/inventory/TagInput.svelte';
  import MarkdownNotes from '$lib/components/inventory/MarkdownNotes.svelte';
  import Sparkline from '$lib/components/inventory/Sparkline.svelte';
  import { api } from '$lib/api/client';
  import type { PageData } from './$types';
  import type { RRDSample, ResourceKind } from '$lib/api/types';
  import AuditTable from '$lib/components/audit/AuditTable.svelte';
  import { formatUptime, formatBytes, formatRate, formatPercent } from '$lib/utils/format';

  let { data }: { data: PageData } = $props();

  const detail = $derived(data.detail);

  // VMDetail.type is 'qemu' | 'lxc' (Proxmox native); ResourceKind is 'vm' | 'lxc'
  // (our API path segment). Map qemu → vm for all API calls.
  function toResourceKind(t: 'qemu' | 'lxc'): ResourceKind {
    return t === 'lxc' ? 'lxc' : 'vm';
  }

  // Tab state lives in URL hash (#overview, #activity) per D-18.
  const tabValue = $derived(($page.url.hash.replace('#', '')) || 'overview');

  function setTab(v: string) {
    goto('#' + v, { replaceState: true, keepFocus: true });
  }

  // Optimistic tag/notes override — $derived(localOverride ?? data.field) pattern.
  let localTags = $state<string[] | null>(null);
  let localNotes = $state<string | null>(null);
  const tags = $derived(localTags ?? detail?.tags ?? []);
  const notes = $derived(localNotes ?? detail?.description ?? '');

  // RRD metrics
  let rrd = $state<RRDSample[]>([]);
  let rrdLoading = $state(false);
  let rrdError = $state<string | null>(null);

  $effect(() => {
    if (!detail) return;
    rrdLoading = true;
    rrdError = null;
    api.inventory
      .getRrd({
        clusterId: detail.cluster_id,
        vmid: detail.vmid,
        type: toResourceKind(detail.type),
        timeframe: 'hour',
        cf: 'AVERAGE',
      })
      .then((s) => {
        rrd = s;
        rrdLoading = false;
      })
      .catch(() => {
        rrd = [];
        rrdLoading = false;
        rrdError = "Couldn't load metrics.";
      });
  });

  async function removeTag(t: string) {
    if (!detail) return;
    const next = tags.filter((x) => x !== t);
    localTags = next; // optimistic
    try {
      await api.inventory.setTags({
        clusterId: detail.cluster_id,
        vmid: detail.vmid,
        type: toResourceKind(detail.type),
        tags: next,
      });
      toast.success(`Tag '${t}' removed.`);
      await invalidateAll();
      localTags = null;
    } catch {
      localTags = null; // rollback (T-02-05-07)
      toast.error("Couldn't remove tag. Try again.");
    }
  }

  // Byte → human-readable helpers
  const GB = 1024 ** 3;
  const ramGb = $derived(detail ? Math.round((detail.maxmem / GB) * 10) / 10 : 0);
  const diskGb = $derived(detail ? Math.round((detail.maxdisk / GB) * 10) / 10 : 0);

  // RRD max values for sparkline normalisation
  const maxDiskIO = $derived(Math.max(...rrd.map((s) => s.diskread + s.diskwrite), 1));
  const maxNet = $derived(Math.max(...rrd.map((s) => s.netin + s.netout), 1));
  // Shared timestamp axis for sparkline hover tooltips.
  const rrdTimes = $derived(rrd.map((s) => s.time));
</script>

{#if !detail || data.loadError}
  <div class="rounded-md border border-dashed border-border bg-muted/30 p-10 text-center">
    <p class="text-[14px] font-medium mb-3">Couldn't load VM details.</p>
    <Button variant="outline" onclick={() => invalidateAll()}>Try again</Button>
  </div>
{:else}
  <!-- Breadcrumb -->
  <nav class="text-[13px] text-muted-foreground mb-3" aria-label="Breadcrumb">
    <a href="/inventory" class="hover:underline">Inventory</a>
    <span class="mx-1">&gt;</span>
    <span>{detail.cluster_id}</span>
    <span class="mx-1">&gt;</span>
    <span>{detail.name ?? `VM ${detail.vmid}`}</span>
  </nav>

  <!-- Page header -->
  <header class="mb-6 flex flex-col gap-1">
    <h1 class="text-[28px] font-semibold tracking-tight">
      {detail.name ?? `VM ${detail.vmid}`}
    </h1>
    <p class="font-mono text-[13px] text-muted-foreground">
      {detail.vmid} · cluster {detail.cluster_id} · {detail.node}
    </p>
  </header>

  <!-- Tab strip -->
  <Tabs.Root value={tabValue} onValueChange={setTab}>
    <Tabs.List class="h-9">
      <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
      <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Tabs.Trigger value="snapshots" disabled {...props}>
                <Lock class="size-3 mr-1" aria-hidden="true" /> Snapshots
              </Tabs.Trigger>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Snapshots ship in Phase 3</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Tabs.Trigger value="console" disabled {...props}>
                <Lock class="size-3 mr-1" aria-hidden="true" /> Console
              </Tabs.Trigger>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Console ships in Phase 4</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </Tabs.List>

    <!-- Overview tab -->
    <Tabs.Content value="overview">
      <div class="grid gap-6 mt-6">
        <!-- Row 1: Specs + Network -->
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card.Root class="p-6">
            <h3 class="text-[13px] font-medium text-muted-foreground mb-3">Specs</h3>
            <dl class="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
              <dt class="text-muted-foreground">Status</dt>
              <dd class="font-mono">{detail.status}</dd>
              <dt class="text-muted-foreground">vCPU</dt>
              <dd class="font-mono">{detail.maxcpu}</dd>
              <dt class="text-muted-foreground">RAM</dt>
              <dd class="font-mono">{ramGb} GB</dd>
              <dt class="text-muted-foreground">Disk</dt>
              <dd class="font-mono">{diskGb} GB</dd>
              <dt class="text-muted-foreground">Uptime</dt>
              <dd class="font-mono">{formatUptime(detail.uptime)}</dd>
              <dt class="text-muted-foreground">Type</dt>
              <dd class="font-mono">{detail.type === 'lxc' ? 'LXC' : 'VM (QEMU)'}</dd>
            </dl>
          </Card.Root>

          <Card.Root class="p-6">
            <h3 class="text-[13px] font-medium text-muted-foreground mb-3">Network</h3>
            <dl class="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
              <dt class="text-muted-foreground">Node</dt>
              <dd class="font-mono">{detail.node}</dd>
              <dt class="text-muted-foreground">net0</dt>
              <dd class="font-mono truncate">{String(detail.raw_config?.net0 ?? '—')}</dd>
              <dt class="text-muted-foreground">net1</dt>
              <dd class="font-mono truncate">{String(detail.raw_config?.net1 ?? '—')}</dd>
              <dt class="text-muted-foreground">Net in</dt>
              <dd class="font-mono">{formatBytes(detail.netin)} <span class="text-muted-foreground">total</span></dd>
              <dt class="text-muted-foreground">Net out</dt>
              <dd class="font-mono">{formatBytes(detail.netout)} <span class="text-muted-foreground">total</span></dd>
            </dl>
          </Card.Root>
        </div>

        <!-- Row 2: Metrics -->
        <Card.Root class="p-6">
          <h3 class="text-[13px] font-medium text-muted-foreground mb-3">Metrics (last hour)</h3>
          {#if rrdError}
            <p class="text-[13px] text-destructive">{rrdError}</p>
          {:else if rrdLoading}
            <div class="grid grid-cols-2 gap-6">
              {#each ['CPU %', 'RAM', 'Disk I/O', 'Network'] as label (label)}
                <div>
                  <p class="text-[13px] text-muted-foreground mb-1">{label}</p>
                  <div class="animate-pulse bg-muted rounded h-[80px] w-full"></div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="grid grid-cols-2 gap-6">
              <div>
                <p class="text-[13px] text-muted-foreground mb-1">CPU %</p>
                <Sparkline
                  points={rrd.map((s) => s.cpu)}
                  max={1}
                  format={formatPercent}
                  times={rrdTimes}
                  label="CPU usage over time"
                />
              </div>
              <div>
                <p class="text-[13px] text-muted-foreground mb-1">RAM</p>
                <Sparkline
                  points={rrd.map((s) => s.mem)}
                  max={detail.maxmem || 1}
                  format={formatBytes}
                  times={rrdTimes}
                  label="RAM usage over time"
                />
              </div>
              <div>
                <p class="text-[13px] text-muted-foreground mb-1">Disk I/O</p>
                <Sparkline
                  points={rrd.map((s) => s.diskread + s.diskwrite)}
                  max={maxDiskIO}
                  format={formatRate}
                  times={rrdTimes}
                  label="Disk I/O over time"
                />
              </div>
              <div>
                <p class="text-[13px] text-muted-foreground mb-1">Network</p>
                <Sparkline
                  points={rrd.map((s) => s.netin + s.netout)}
                  max={maxNet}
                  format={formatRate}
                  times={rrdTimes}
                  label="Network throughput over time"
                />
              </div>
            </div>
          {/if}
        </Card.Root>

        <!-- Row 3: Tags -->
        <Card.Root class="p-6">
          <h3 class="text-[13px] font-medium text-muted-foreground mb-3">Tags</h3>
          <div class="flex flex-wrap items-center gap-2">
            {#each tags as t (t)}
              <span class="inline-flex items-center gap-1">
                <TagPill tag={t} />
                <button
                  type="button"
                  class="text-muted-foreground hover:text-destructive text-[12px] leading-none"
                  onclick={() => removeTag(t)}
                  aria-label={`Remove tag ${t}`}
                >
                  ×
                </button>
              </span>
            {/each}
            {#if tags.length === 0}
              <p class="text-[13px] text-muted-foreground">No tags. Add one to organize this resource.</p>
            {/if}
            <TagInput
              clusterId={detail.cluster_id}
              vmid={detail.vmid}
              type={toResourceKind(detail.type)}
              currentTags={tags}
              suggestions={[]}
              onApplied={(next) => {
                localTags = next;
                invalidateAll();
              }}
            />
          </div>
        </Card.Root>

        <!-- Row 4: Notes -->
        <Card.Root class="p-6">
          <h3 class="text-[13px] font-medium text-muted-foreground mb-3">Notes</h3>
          <MarkdownNotes
            clusterId={detail.cluster_id}
            vmid={detail.vmid}
            type={toResourceKind(detail.type)}
            notes={notes}
            onApplied={(n) => {
              localNotes = n;
              invalidateAll();
            }}
          />
        </Card.Root>
      </div>
    </Tabs.Content>

    <!-- Activity tab — AuditTable with locked filters (Plan 02-06) -->
    <Tabs.Content value="activity">
      <div class="mt-6">
        <div class="flex items-center justify-end mb-3">
          <a
            href={`/audit?cluster_id=${detail.cluster_id}&vmid=${detail.vmid}`}
            class="text-primary hover:underline text-[14px]"
          >View in global audit log →</a>
        </div>
        {#await api.audit.list({ filters: { cluster_id: detail.cluster_id, vmid: detail.vmid, page: 1, page_size: 50 } })}
          <AuditTable rows={[]} total={0} page={1} pageSize={50} loading={true}
            lockedFilters={{ cluster_id: detail.cluster_id, vmid: detail.vmid }} />
        {:then result}
          <AuditTable
            rows={result.rows}
            total={result.total}
            page={result.page}
            pageSize={result.page_size}
            lockedFilters={{ cluster_id: detail.cluster_id, vmid: detail.vmid }}
          />
        {:catch}
          <AuditTable rows={[]} total={0} page={1} pageSize={50}
            error="Couldn't load activity."
            lockedFilters={{ cluster_id: detail.cluster_id, vmid: detail.vmid }} />
        {/await}
      </div>
    </Tabs.Content>
  </Tabs.Root>
{/if}
