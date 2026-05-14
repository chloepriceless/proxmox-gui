<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import * as Sheet from '$lib/components/ui/sheet';
  import { Progress } from '$lib/components/ui/progress';
  import * as Card from '$lib/components/ui/card';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import type { MyQuotasResponse, ClusterQuotaRow } from '$lib/api/types';

  let open = $state(false);
  let data = $state<MyQuotasResponse | null>(null);
  let loadError = $state<string | null>(null);

  async function refresh() {
    try {
      data = await api.quotas.getMyQuotas();
      loadError = null;
      checkToast(data);
    } catch {
      loadError = 'Quota unavailable';
    }
  }

  // Re-fetch on every navigation (page key changes).
  let navKey = $derived($page.url.pathname + $page.url.search);
  $effect(() => { void navKey; refresh(); });
  onMount(refresh);

  function maxUtilization(rows: ClusterQuotaRow[]): number {
    let u = 0;
    for (const r of rows) {
      const l = r.limit;
      if (l.cpu_cores) u = Math.max(u, r.usage.cpu_cores / l.cpu_cores);
      if (l.ram_gb)    u = Math.max(u, r.usage.ram_gb / l.ram_gb);
      if (l.disk_gb)   u = Math.max(u, r.usage.disk_gb / l.disk_gb);
      if (l.vm_count)  u = Math.max(u, (r.usage.vm_count + r.usage.lxc_count) / l.vm_count);
    }
    return u;
  }

  function checkToast(d: MyQuotasResponse) {
    if (typeof window === 'undefined') return;
    for (const team of d.teams) {
      const u = maxUtilization(team.clusters);
      if (u >= 0.95) {
        const key = `proxmox-gui:quota-toast-fired:critical:${team.team_id}`;
        if (!window.sessionStorage.getItem(key)) {
          toast.error(`Quota critical: 95% on team ${team.team_name}. Creates will be blocked.`);
          window.sessionStorage.setItem(key, '1');
        }
      } else if (u >= 0.80) {
        const key = `proxmox-gui:quota-toast-fired:warning:${team.team_id}`;
        if (!window.sessionStorage.getItem(key)) {
          toast.warning(`Approaching quota: 80% on team ${team.team_name}.`);
          window.sessionStorage.setItem(key, '1');
        }
      }
    }
  }

  const primaryTeam = $derived(data?.teams[0] ?? null);
  const utilization = $derived(primaryTeam ? maxUtilization(primaryTeam.clusters) : 0);

  const blockClasses = $derived(
    utilization >= 0.95
      ? 'bg-destructive/10 border-destructive/30 text-destructive'
      : utilization >= 0.80
        ? 'bg-warning/10 border-warning/30 text-warning'
        : 'bg-muted border-border text-foreground'
  );

  const compactCpu = $derived(
    primaryTeam
      ? `${primaryTeam.aggregate_usage.cpu_cores}/${primaryTeam.aggregate_limit.cpu_cores ?? '∞'}`
      : '--/--'
  );
  const compactRam = $derived(
    primaryTeam
      ? `${primaryTeam.aggregate_usage.ram_gb}/${primaryTeam.aggregate_limit.ram_gb ?? '∞'}GB`
      : '--/--'
  );

  function pct(used: number, limit: number | null): number {
    if (!limit || limit <= 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        class="inline-flex items-center gap-2 h-7 px-3 rounded-md border text-[13px] font-medium transition-colors hover:opacity-80 {blockClasses}"
        aria-label={`Quota: ${compactCpu} CPU, ${compactRam} RAM. Click for details.`}
        aria-live="polite"
      >
        <span class="text-muted-foreground font-medium">CPU</span>
        <span class="font-mono tabular-nums">{compactCpu}</span>
        <span class="text-muted-foreground">·</span>
        <span class="text-muted-foreground font-medium">RAM</span>
        <span class="font-mono tabular-nums">{compactRam}</span>
      </button>
    {/snippet}
  </Sheet.Trigger>

  <Sheet.Content side="right" class="w-[400px] sm:w-[480px]">
    <Sheet.Header>
      <Sheet.Title>Quota usage</Sheet.Title>
    </Sheet.Header>
    <div
      class="flex flex-col gap-6 mt-6 overflow-y-auto"
      style="max-height: calc(100vh - 12rem);"
    >
      {#if loadError}
        <p class="text-[13px] text-muted-foreground">{loadError}</p>
      {:else if !data || data.teams.length === 0}
        <p class="text-[13px] text-muted-foreground">
          You have no quotas configured. Contact your administrator.
        </p>
      {:else}
        {#each data.teams as team (team.team_id)}
          <Card.Root class="p-4">
            <h3 class="text-[18px] font-semibold tracking-tight mb-2">{team.team_name}</h3>
            {#each team.clusters as c (c.cluster_id)}
              <div class="mt-4">
                <p class="text-[14px] font-medium">{c.cluster_name}</p>
                <div class="flex flex-col gap-2 mt-2 text-[13px]">
                  <div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">vCPU</span>
                      <span class="font-mono">{c.usage.cpu_cores} / {c.limit.cpu_cores ?? '∞'}</span>
                    </div>
                    <Progress value={pct(c.usage.cpu_cores, c.limit.cpu_cores)} class="h-2 mt-1" />
                  </div>
                  <div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">RAM</span>
                      <span class="font-mono">{c.usage.ram_gb} / {c.limit.ram_gb ?? '∞'} GB</span>
                    </div>
                    <Progress value={pct(c.usage.ram_gb, c.limit.ram_gb)} class="h-2 mt-1" />
                  </div>
                  <div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Disk</span>
                      <span class="font-mono">{c.usage.disk_gb} / {c.limit.disk_gb ?? '∞'} GB</span>
                    </div>
                    <Progress value={pct(c.usage.disk_gb, c.limit.disk_gb)} class="h-2 mt-1" />
                  </div>
                  <div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">VMs</span>
                      <span class="font-mono">{c.usage.vm_count + c.usage.lxc_count} / {c.limit.vm_count ?? '∞'}</span>
                    </div>
                    <Progress
                      value={pct(c.usage.vm_count + c.usage.lxc_count, c.limit.vm_count)}
                      class="h-2 mt-1"
                    />
                  </div>
                </div>
              </div>
            {/each}
          </Card.Root>
        {/each}
        <p class="text-[12px] text-muted-foreground">
          Quotas are set by your administrator. Contact them to raise a limit.
        </p>
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>
