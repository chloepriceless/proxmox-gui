<!--
  /backups — the global scheduled-backup + retention overview page (D-06).

  Contract: UI-SPEC §"Global /backups page" + §Copywriting Contract +
  §Required loading/empty/error states.
    - Page header: title "Backups" + description "Scheduled backup jobs and
      retention across your VMs and LXCs." (verbatim).
    - A shadcn `table` (NOT data-table — no client sort in v1): columns
      Resource (links to that VM's Backups tab), Cluster, Frequency,
      Keep-last, Last run (ok/fail icon + timestamp), Next run.
    - Empty: 3xl top margin, CalendarClock icon, "No scheduled backups" +
      "Open a VM's Backups tab to set up a schedule."
    - Error: "Couldn't load scheduled backups." + retry.

  Read-only page — plain `data` is fine ($derived seeds from SSR).

  STRIDE: T-03-07-06 — every PVE-derived string is rendered via Svelte text
  interpolation (auto-escaped); no {@html}.
-->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import * as Table from '$lib/components/ui/table';
  import { Button } from '$lib/components/ui/button';
  import CalendarClock from '@lucide/svelte/icons/calendar-clock';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import { formatClock } from '$lib/utils/format';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const schedules = $derived(data.schedules);
  const loadError = $derived(data.loadError);
  const isEmpty = $derived(!loadError && schedules.length === 0);

  /** The VM's Backups tab deep-link — vm/lxc both land on #backups. */
  function resourceHref(clusterId: number, vmid: number): string {
    return `/inventory/${clusterId}/${vmid}#backups`;
  }

  /** Title-case the backend frequency string. */
  function freqLabel(f: string): string {
    return f ? f.charAt(0).toUpperCase() + f.slice(1) : '—';
  }

  /** Next-run hint — daily/weekly cadence shown as plain text. */
  function nextRunLabel(frequency: string): string {
    if (frequency === 'daily') return 'Within 24h';
    if (frequency === 'weekly') return 'Within 7d';
    return '—';
  }
</script>

<svelte:head>
  <title>Backups — Proxmox GUI</title>
</svelte:head>

<header class="mb-6">
  <h1 class="text-[28px] font-semibold tracking-tight">Backups</h1>
  <p class="text-muted-foreground text-sm mt-1">
    Scheduled backup jobs and retention across your VMs and LXCs.
  </p>
</header>

{#if loadError}
  <div
    class="rounded-md border border-dashed border-border bg-muted/30 p-10 text-center"
  >
    <p class="text-[14px] font-medium mb-3">Couldn't load scheduled backups.</p>
    <Button variant="outline" onclick={() => invalidateAll()}>Try again</Button>
  </div>
{:else if isEmpty}
  <div class="mt-16 flex flex-col items-center gap-2 text-center">
    <CalendarClock class="size-6 text-muted-foreground" aria-hidden="true" />
    <p class="text-[14px] font-medium">No scheduled backups</p>
    <p class="text-[14px] text-muted-foreground">
      Open a VM's Backups tab to set up a schedule.
    </p>
  </div>
{:else}
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>Resource</Table.Head>
        <Table.Head>Cluster</Table.Head>
        <Table.Head>Frequency</Table.Head>
        <Table.Head>Keep-last</Table.Head>
        <Table.Head>Last run</Table.Head>
        <Table.Head>Next run</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each schedules as row (`${row.cluster_id}-${row.vmid}`)}
        <Table.Row>
          <Table.Cell>
            <a
              href={resourceHref(row.cluster_id, row.vmid)}
              class="text-primary hover:underline font-mono text-[13px]"
            >
              {row.is_lxc ? 'CT' : 'VM'} {row.vmid}
            </a>
          </Table.Cell>
          <Table.Cell>{row.cluster_id}</Table.Cell>
          <Table.Cell>{freqLabel(row.frequency)}</Table.Cell>
          <Table.Cell style="font-variant-numeric: tabular-nums;">
            {row.keep_last}
          </Table.Cell>
          <Table.Cell>
            {#if row.last_run_at}
              <span class="inline-flex items-center gap-1">
                {#if row.last_run_state === 'fail'}
                  <CircleAlert
                    class="size-3.5 text-destructive"
                    aria-hidden="true"
                  />
                  <span class="text-[14px]">Failed</span>
                {:else}
                  <CircleCheck
                    class="size-3.5 text-success"
                    aria-hidden="true"
                  />
                  <span class="text-[14px]">OK</span>
                {/if}
                <span class="text-[13px] text-muted-foreground">
                  {formatClock(Math.floor(new Date(row.last_run_at).getTime() / 1000))}
                </span>
              </span>
            {:else}
              <span class="text-[13px] text-muted-foreground">Never run</span>
            {/if}
          </Table.Cell>
          <Table.Cell class="text-[13px] text-muted-foreground">
            {nextRunLabel(row.frequency)}
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{/if}
