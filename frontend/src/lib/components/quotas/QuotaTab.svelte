<script lang="ts">
  import { untrack } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Alert from '$lib/components/ui/alert';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import { ApiError } from '$lib/utils/api';
  import type { TeamQuotaPage, QuotaLimitInput } from '$lib/api/types';

  type Props = {
    teamId: number;
    initial: TeamQuotaPage;
    onSaved?: (page: TeamQuotaPage) => void;
  };
  let { teamId, initial, onSaved }: Props = $props();

  let rows = $state(untrack(() => initial.rows.map(r => ({
    cluster_id: r.cluster_id,
    cluster_name: r.cluster_name,
    cpu_cores: r.limit.cpu_cores,
    ram_gb: r.limit.ram_gb,
    disk_gb: r.limit.disk_gb,
    vm_count: r.limit.vm_count,
    usage_cpu: r.usage.cpu_cores,
    usage_ram_gb: r.usage.ram_gb,
    usage_disk_gb: r.usage.disk_gb,
    usage_vms: r.usage.vm_count + r.usage.lxc_count,
  }))));

  let saving = $state(false);
  let formError = $state<string | null>(null);
  let conflict = $state<{
    cluster_id: number;
    usage: { cpu_cores: number; ram_gb: number; disk_gb: number; vm_count: number };
    requested_limit: QuotaLimitInput;
    message: string;
  } | null>(null);

  function pct(used: number, limit: number | null): number {
    if (!limit || limit <= 0) return 0;
    return Math.round((used / limit) * 100);
  }

  function pctClass(p: number): string {
    if (p >= 95) return 'text-destructive';
    if (p >= 80) return 'text-warning';
    return 'text-muted-foreground';
  }

  function buildPayload(): QuotaLimitInput[] {
    return rows.map(r => ({
      cluster_id: r.cluster_id,
      cpu_cores: r.cpu_cores,
      ram_gb: r.ram_gb,
      disk_gb: r.disk_gb,
      vm_count: r.vm_count,
    }));
  }

  async function save(allowOver = false) {
    saving = true;
    formError = null;
    try {
      const page = await api.quotas.setTeamQuotas({ teamId, rows: buildPayload(), allowOver });
      onSaved?.(page);
      conflict = null;
      toast.success('Quotas updated.');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = (e.body as Record<string, unknown>) ?? {};
        const detail = (body.detail as Record<string, unknown>) ?? {};
        conflict = {
          cluster_id: detail.cluster_id as number,
          usage: detail.usage as { cpu_cores: number; ram_gb: number; disk_gb: number; vm_count: number },
          requested_limit: detail.requested_limit as QuotaLimitInput,
          message: (detail.message as string) ?? 'Current usage exceeds the new limit.',
        };
      } else {
        formError = "Couldn't save quotas. Try again.";
        toast.error(formError);
      }
    } finally {
      saving = false;
    }
  }

  function clusterName(id: number): string {
    return rows.find(r => r.cluster_id === id)?.cluster_name ?? `Cluster ${id}`;
  }

  // Aggregate footer (sum-or-null per dimension).
  function sumOrNull(arr: (number | null | undefined)[]): number | null {
    let total = 0;
    for (const v of arr) {
      if (v == null) return null;
      total += v;
    }
    return total;
  }

  const aggCpu = $derived(sumOrNull(rows.map(r => r.cpu_cores)));
  const aggRam = $derived(sumOrNull(rows.map(r => r.ram_gb)));
  const aggDisk = $derived(sumOrNull(rows.map(r => r.disk_gb)));
  const aggCount = $derived(sumOrNull(rows.map(r => r.vm_count)));
</script>

{#if formError}
  <Alert.Root variant="destructive" class="mb-4">
    <Alert.Description>{formError}</Alert.Description>
  </Alert.Root>
{/if}

{#if rows.length === 0}
  <div class="border-border bg-muted/30 rounded-md border border-dashed px-6 py-10 text-center">
    <p class="text-sm font-medium">This team has no cluster bindings — bind one in the Members tab first.</p>
  </div>
{:else}
  <div class="rounded-md border border-border overflow-hidden">
    <table class="w-full text-[13px]">
      <thead class="bg-muted/40">
        <tr>
          <th class="text-left px-4 py-2 font-medium">Cluster</th>
          <th class="px-2 py-2 font-medium">vCPU</th>
          <th class="px-2 py-2 font-medium">RAM (GB)</th>
          <th class="px-2 py-2 font-medium">Disk (GB)</th>
          <th class="px-2 py-2 font-medium">VM count</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r, i (r.cluster_id)}
          <tr class="border-t border-border">
            <td class="px-4 py-3">
              <div class="font-medium">{r.cluster_name}</div>
              <div class={`text-[12px] ${pctClass(Math.max(
                pct(r.usage_cpu, r.cpu_cores),
                pct(r.usage_ram_gb, r.ram_gb),
                pct(r.usage_disk_gb, r.disk_gb),
                pct(r.usage_vms, r.vm_count)
              ))}`}>
                current usage: {r.usage_cpu} / {r.cpu_cores ?? '∞'} vCPU, {r.usage_ram_gb} / {r.ram_gb ?? '∞'} GB
              </div>
            </td>
            <td class="px-2 py-3">
              <Input
                type="number"
                min="0"
                value={r.cpu_cores ?? ''}
                oninput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  rows[i].cpu_cores = v === '' ? null : Number(v);
                }}
                class="w-20"
              />
            </td>
            <td class="px-2 py-3">
              <Input
                type="number"
                min="0"
                value={r.ram_gb ?? ''}
                oninput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  rows[i].ram_gb = v === '' ? null : Number(v);
                }}
                class="w-20"
              />
            </td>
            <td class="px-2 py-3">
              <Input
                type="number"
                min="0"
                value={r.disk_gb ?? ''}
                oninput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  rows[i].disk_gb = v === '' ? null : Number(v);
                }}
                class="w-20"
              />
            </td>
            <td class="px-2 py-3">
              <Input
                type="number"
                min="0"
                value={r.vm_count ?? ''}
                oninput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  rows[i].vm_count = v === '' ? null : Number(v);
                }}
                class="w-20"
              />
            </td>
          </tr>
        {/each}
      </tbody>
      <tfoot class="bg-muted/30 border-t border-border">
        <tr>
          <td class="px-4 py-3 font-medium">Aggregate (auto)</td>
          <td class="px-2 py-3 font-mono">{aggCpu ?? '∞'}</td>
          <td class="px-2 py-3 font-mono">{aggRam ?? '∞'}</td>
          <td class="px-2 py-3 font-mono">{aggDisk ?? '∞'}</td>
          <td class="px-2 py-3 font-mono">{aggCount ?? '∞'}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="flex justify-end gap-2 mt-4">
    <Button onclick={() => save(false)} disabled={saving}>Save changes</Button>
  </div>
{/if}

<!-- Lower quota conflict dialog -->
<Dialog.Root open={conflict !== null} onOpenChange={(o) => { if (!o) conflict = null; }}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Lower quota limit on {initial.team_name}?</Dialog.Title>
      <Dialog.Description>
        {#if conflict}
          Current usage on {clusterName(conflict.cluster_id)} ({conflict.usage.cpu_cores} vCPU,
          {conflict.usage.ram_gb} GB RAM, {conflict.usage.vm_count} VMs) exceeds the new limit
          ({conflict.requested_limit.cpu_cores ?? '∞'} vCPU,
          {conflict.requested_limit.ram_gb ?? '∞'} GB,
          {conflict.requested_limit.vm_count ?? '∞'} VMs). Saving will leave the team over-quota
          until usage drops. New creates will be blocked.
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="ghost" onclick={() => conflict = null}>Cancel</Button>
      <Button variant="destructive" onclick={() => save(true)} disabled={saving}>
        Lower limit anyway
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
