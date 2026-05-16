<!--
  TasksDrawer — the global Tasks activity feed.

  Contract: UI-SPEC §"Tasks drawer".
    - Sheet side=right, 420px wide.
    - Header: "Tasks" + summary line "{N} running · {N} failed" / "No active tasks".
    - Body: scroll-area of <JobRow>s, newest-first, running floated above done.
    - Batch grouping (D-11): jobs sharing a batch_id under a collapsible header.
    - A 1s setInterval ticks a local nowMs so elapsed timers move.
    - Disconnected: a warning strip "Reconnecting to live updates…".
    - Empty: centered Activity icon + copy.
    - `open` is bound to jobsStore.drawerOpen.
-->
<script lang="ts">
  import * as Sheet from '$lib/components/ui/sheet';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import Activity from '@lucide/svelte/icons/activity';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import JobRow from './JobRow.svelte';
  import { jobsStore } from '$lib/stores/jobs.svelte';
  import type { Job } from '$lib/api/types';

  // 1s tick so elapsed timers move — even while disconnected (UI-SPEC).
  let nowMs = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
    return () => clearInterval(id);
  });

  /** A batch-group view-model: the shared header + its child jobs. */
  type Group =
    | { kind: 'single'; job: Job }
    | { kind: 'batch'; batchId: string; jobs: Job[] };

  // Group the (already newest-first, running-floated) job list by batch_id.
  const groups = $derived(buildGroups(jobsStore.jobs));
  function buildGroups(jobs: Job[]): Group[] {
    const out: Group[] = [];
    const batchIndex = new Map<string, number>();
    for (const job of jobs) {
      if (job.batch_id) {
        const existing = batchIndex.get(job.batch_id);
        if (existing === undefined) {
          batchIndex.set(job.batch_id, out.length);
          out.push({ kind: 'batch', batchId: job.batch_id, jobs: [job] });
        } else {
          (out[existing] as { kind: 'batch'; batchId: string; jobs: Job[] }).jobs.push(job);
        }
      } else {
        out.push({ kind: 'single', job });
      }
    }
    return out;
  }

  /** Batch header tally — "{done} done · {running} running" / "{N} done". */
  function batchTally(jobs: Job[]): string {
    const done = jobs.filter((j) => j.state === 'succeeded').length;
    const failed = jobs.filter((j) => j.state === 'failed').length;
    const running = jobs.filter(
      (j) => j.state === 'running' || j.state === 'pending' || j.state === 'claimed'
    ).length;
    const parts: string[] = [];
    if (done > 0) parts.push(`${done} done`);
    if (running > 0) parts.push(`${running} running`);
    if (failed > 0) parts.push(`${failed} failed`);
    return parts.length ? parts.join(' · ') : `${jobs.length} done`;
  }

  /** A batch header label from its first job's kind — "Bulk reboot ×5". */
  function batchLabel(jobs: Job[]): string {
    const kind = jobs[0]?.kind ?? 'job';
    const action = kind.split('.').slice(1).join(' ') || kind;
    return `Bulk ${action} ×${jobs.length}`;
  }

  /** A batch is expanded by default while any child still runs. */
  function batchHasRunning(jobs: Job[]): boolean {
    return jobs.some(
      (j) => j.state === 'running' || j.state === 'pending' || j.state === 'claimed'
    );
  }

  const summary = $derived(
    jobsStore.runningCount === 0 && jobsStore.failedCount === 0
      ? 'No active tasks'
      : `${jobsStore.runningCount} running · ${jobsStore.failedCount} failed`
  );
</script>

<Sheet.Root bind:open={jobsStore.drawerOpen}>
  <Sheet.Content side="right" class="w-[420px] sm:w-[420px]">
    <Sheet.Header>
      <Sheet.Title>Tasks</Sheet.Title>
      <Sheet.Description>{summary}</Sheet.Description>
    </Sheet.Header>

    <div class="mt-4 flex flex-col gap-2" style="max-height: calc(100vh - 9rem);">
      <!-- Disconnected strip — bg-warning/10, no `Alert` warning variant exists. -->
      {#if !jobsStore.connected}
        <div
          role="status"
          class="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning"
        >
          <Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
          Reconnecting to live updates…
        </div>
      {/if}

      {#if jobsStore.jobs.length === 0}
        <!-- Empty state -->
        <div class="flex flex-col items-center gap-2 py-12 text-center">
          <Activity class="size-6 text-muted-foreground" aria-hidden="true" />
          <p class="text-[18px] font-semibold tracking-tight">No tasks yet</p>
          <p class="text-[14px] text-muted-foreground">
            Lifecycle actions you run will show their progress here.
          </p>
        </div>
      {:else}
        <ScrollArea class="flex-1" style="max-height: calc(100vh - 11rem);">
          <div class="flex flex-col divide-y divide-border">
            {#each groups as group (group.kind === 'batch' ? `b:${group.batchId}` : `s:${group.job.id}`)}
              {#if group.kind === 'single'}
                <JobRow job={group.job} {nowMs} />
              {:else}
                <Collapsible.Root open={batchHasRunning(group.jobs)}>
                  <Collapsible.Trigger>
                    {#snippet child({ props })}
                      <button
                        {...props}
                        type="button"
                        class="flex h-10 w-full items-center gap-2 bg-muted/40 px-3 text-[13px] font-medium text-foreground"
                      >
                        {#if batchHasRunning(group.jobs)}
                          <ChevronDown class="size-3.5" aria-hidden="true" />
                        {:else}
                          <ChevronRight class="size-3.5" aria-hidden="true" />
                        {/if}
                        <span class="flex-1 text-left">{batchLabel(group.jobs)}</span>
                        <span class="text-muted-foreground">{batchTally(group.jobs)}</span>
                      </button>
                    {/snippet}
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <div class="flex flex-col divide-y divide-border pl-4">
                      {#each group.jobs as job (job.id)}
                        <JobRow {job} {nowMs} />
                      {/each}
                    </div>
                  </Collapsible.Content>
                </Collapsible.Root>
              {/if}
            {/each}
          </div>
        </ScrollArea>
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>
