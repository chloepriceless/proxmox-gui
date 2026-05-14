<!--
  ClusterSection — collapsible per-cluster section on the /inventory page.

  Contract: UI-SPEC §Component Contracts §ClusterSection.

    - Wraps shadcn-svelte Accordion.Item
    - Header: 48px tall (h-12), bg-muted/40, full-width clickable toggle
    - Header children: cluster name (Heading 18/600) + ClusterStatusPill + counter Badge
    - Counter: "(N)" unfiltered, "(N / total)" filtered (D-06)
    - Banner: Alert variant="destructive" between header and body when cluster
      status is 'failed' (D-03 — unreachable cluster)
    - Default: expanded (Accordion.Root passes defaultValue with all cluster ids)
    - Session persistence of open/closed is handled by the parent via Accordion.Root bind:value
-->
<script lang="ts">
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Alert from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import ClusterStatusPill from '$lib/components/clusters/ClusterStatusPill.svelte';
  import type { Snippet } from 'svelte';

  type Props = {
    clusterId: number;
    clusterName: string;
    /** 'ok' | 'failed' | 'untested' | 'stale' | any string from backend */
    clusterStatus: string;
    isStale: boolean;
    lastError: string | null;
    /** Count of items matching current filter. */
    matched: number;
    /** Total items in the cluster (unfiltered). */
    total: number;
    /** Whether any filter is currently active (affects counter label). */
    filterActive: boolean;
    children: Snippet;
  };

  let {
    clusterId,
    clusterName,
    clusterStatus,
    isStale,
    lastError,
    matched,
    total,
    filterActive,
    children,
  }: Props = $props();

  const counterLabel = $derived(
    filterActive ? `(${matched} / ${total})` : `(${total})`
  );

  // When the cluster is stale, show stale pill; otherwise use the backend status.
  const pillStatus = $derived(
    isStale
      ? 'stale'
      : (['ok', 'failed', 'untested'] as string[]).includes(clusterStatus)
        ? (clusterStatus as 'ok' | 'failed' | 'untested')
        : 'untested'
  );
</script>

<Accordion.Item value={`cluster-${clusterId}`} class="border-0">
  <Accordion.Trigger
    class="bg-muted/40 h-12 px-6 hover:bg-muted/60 rounded-md w-full text-left"
  >
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <span class="text-[18px] font-semibold tracking-tight truncate">{clusterName}</span>
      <ClusterStatusPill status={pillStatus} />
      <Badge variant="outline" class="text-[13px] font-medium text-muted-foreground shrink-0">
        {counterLabel}
      </Badge>
    </div>
  </Accordion.Trigger>
  <Accordion.Content class="pt-0 pb-0">
    {#if clusterStatus === 'failed' || (isStale && clusterStatus !== 'ok')}
      <Alert.Root variant="destructive" class="mb-4 mt-2">
        <ShieldAlert class="size-4" />
        <Alert.Title>Cluster {clusterName} unreachable</Alert.Title>
        <Alert.Description>
          {lastError ?? 'Showing last cached data. Actions are read-only until the cluster recovers.'}
        </Alert.Description>
      </Alert.Root>
    {/if}
    {@render children()}
  </Accordion.Content>
</Accordion.Item>
