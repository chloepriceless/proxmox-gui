<!--
  NetworksTab — the per-team network-scoping admin tab (Plan 04-14, NET-02).

  Contract: 04-UI-SPEC §"Networks admin tab" + D-18 / D-19.
    - The EXACT analog of `QuotaTab.svelte` — D-18 says "parallel to the
      Quotas tab".
    - Per cluster, a `card` section listing that cluster's SDN VNets + legacy
      bridges as a checkbox group (checked = granted).
    - Legacy bridges are checked-by-default (D-19); SDN VNets are unchecked
      until the admin grants them.
    - Reads via `api.networks.getTeamNetworkScope`, saves via
      `api.networks.setTeamNetworkScope` with the page's "Save changes" CTA.
-->
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import Network from '@lucide/svelte/icons/network';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import type { NetworkScopeResponse } from '$lib/api/types';
  import {
    bridgeGrantRows,
    buildScopeUpdate,
    sdnGrantRows,
    type NetworkGrantRow
  } from './networks-tab';

  type ClusterRef = { cluster_id: number; cluster_name: string };

  type Props = {
    teamId: number;
    /** The clusters the team is bound to — drives one card per cluster. */
    clusters: ClusterRef[];
  };

  let { teamId, clusters }: Props = $props();

  /** Per-cluster editable state, keyed by cluster id. */
  type ClusterScopeState = {
    loading: boolean;
    loadError: boolean;
    scope: NetworkScopeResponse | null;
    sdnRows: NetworkGrantRow[];
    bridgeRows: NetworkGrantRow[];
  };

  let byCluster = $state<Record<number, ClusterScopeState>>({});
  let saving = $state(false);
  let formError = $state<string | null>(null);

  async function loadCluster(clusterId: number) {
    byCluster[clusterId] = {
      loading: true,
      loadError: false,
      scope: null,
      sdnRows: [],
      bridgeRows: []
    };
    try {
      const scope = await api.networks.getTeamNetworkScope({ teamId, clusterId });
      byCluster[clusterId] = {
        loading: false,
        loadError: false,
        scope,
        sdnRows: sdnGrantRows(scope),
        bridgeRows: bridgeGrantRows(scope)
      };
    } catch {
      byCluster[clusterId] = {
        loading: false,
        loadError: true,
        scope: null,
        sdnRows: [],
        bridgeRows: []
      };
    }
  }

  $effect(() => {
    for (const c of clusters) {
      if (byCluster[c.cluster_id] === undefined) loadCluster(c.cluster_id);
    }
  });

  /** Persist every loaded cluster's grant set with the page "Save changes" CTA. */
  async function save() {
    saving = true;
    formError = null;
    try {
      for (const c of clusters) {
        const st = byCluster[c.cluster_id];
        if (!st || st.scope === null) continue;
        const body = buildScopeUpdate(st.sdnRows, st.bridgeRows);
        const refreshed = await api.networks.setTeamNetworkScope({
          teamId,
          clusterId: c.cluster_id,
          body
        });
        byCluster[c.cluster_id] = {
          loading: false,
          loadError: false,
          scope: refreshed,
          sdnRows: sdnGrantRows(refreshed),
          bridgeRows: bridgeGrantRows(refreshed)
        };
      }
      toast.success('Network scope updated.');
    } catch {
      formError = "Couldn't save the network scope. Try again.";
      toast.error(formError);
    } finally {
      saving = false;
    }
  }
</script>

{#if formError}
  <Alert.Root variant="destructive" class="mb-4">
    <Alert.Description>{formError}</Alert.Description>
  </Alert.Root>
{/if}

{#if clusters.length === 0}
  <div
    class="border-border bg-muted/30 rounded-md border border-dashed px-6 py-10 text-center"
  >
    <p class="text-sm font-medium">
      This team has no cluster bindings — bind one in the Members tab first.
    </p>
  </div>
{:else}
  <div class="flex flex-col gap-6">
    {#each clusters as c (c.cluster_id)}
      {@const st = byCluster[c.cluster_id]}
      <Card.Root class="p-6">
        <h3 class="mb-1 flex items-center gap-2 text-[14px] font-semibold">
          <Network class="size-4 text-muted-foreground" aria-hidden="true" />
          {c.cluster_name}
        </h3>

        {#if !st || st.loading}
          <div class="mt-3 h-20 w-full animate-pulse rounded bg-muted"></div>
        {:else if st.loadError}
          <p class="mt-3 text-[13px] text-destructive">
            Couldn't load cluster networks.
            <button
              type="button"
              class="text-primary ml-1 hover:underline"
              onclick={() => loadCluster(c.cluster_id)}
            >
              Retry
            </button>
          </p>
        {:else}
          <!-- SDN VNets — unchecked until granted (D-19). -->
          <div class="mt-4">
            <p class="text-[13px] font-medium text-muted-foreground">SDN VNets</p>
            {#if st.sdnRows.length === 0}
              <p class="mt-1 text-[13px] text-muted-foreground">
                {st.scope?.sdn_capable
                  ? 'No SDN VNets on this cluster.'
                  : 'This cluster is not SDN-capable.'}
              </p>
            {:else}
              <div class="mt-2 flex flex-col gap-2">
                {#each st.sdnRows as row, i (row.network_id)}
                  <div class="flex items-center gap-2">
                    <Checkbox
                      id={`net-${c.cluster_id}-sdn-${row.network_id}`}
                      checked={row.granted}
                      disabled={!row.applied}
                      onCheckedChange={(v) => {
                        st.sdnRows[i].granted = v === true;
                      }}
                    />
                    <Label
                      for={`net-${c.cluster_id}-sdn-${row.network_id}`}
                      class="font-normal"
                    >
                      {row.display_name}
                      {#if !row.applied}
                        <span class="text-[12px] text-muted-foreground">(pending)</span>
                      {/if}
                    </Label>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Legacy bridges — checked by default (D-19). -->
          <div class="mt-5">
            <p class="text-[13px] font-medium text-muted-foreground">Legacy bridges</p>
            {#if st.bridgeRows.length === 0}
              <p class="mt-1 text-[13px] text-muted-foreground">
                No legacy bridges on this cluster.
              </p>
            {:else}
              <div class="mt-2 flex flex-col gap-2">
                {#each st.bridgeRows as row, i (row.network_id)}
                  <div class="flex items-center gap-2">
                    <Checkbox
                      id={`net-${c.cluster_id}-br-${row.network_id}`}
                      checked={row.granted}
                      onCheckedChange={(v) => {
                        st.bridgeRows[i].granted = v === true;
                      }}
                    />
                    <Label
                      for={`net-${c.cluster_id}-br-${row.network_id}`}
                      class="font-normal"
                    >
                      {row.display_name}
                    </Label>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </Card.Root>
    {/each}
  </div>

  <div class="mt-4 flex justify-end gap-2">
    <Button onclick={save} disabled={saving}>Save changes</Button>
  </div>
{/if}
