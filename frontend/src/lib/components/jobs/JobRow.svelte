<!--
  JobRow — one job row in the Tasks drawer.

  Contract: UI-SPEC §"Job row contract" + §"Color §Job state mapping".
    - 3px left-edge tint bar per job state.
    - Line 1: state icon + task-type label + elapsed timer (right-aligned).
    - Line 2: UPID (Mono 13/400 muted, truncate, full value in `title`).
    - Failed jobs: <JobErrorDetail> + (idempotent kinds only) a Retry button.
    - Orphan-reaper re-attach badge for orphaned jobs.
    - Every row carries an icon AND a state word (no color-only — a11y floor).
    - The elapsed value is aria-hidden (the state word carries meaning).
-->
<script lang="ts">
  import Clock from '@lucide/svelte/icons/clock';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import CircleSlash from '@lucide/svelte/icons/circle-slash';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { Button } from '$lib/components/ui/button';
  import JobErrorDetail from './JobErrorDetail.svelte';
  import { jobsStore } from '$lib/stores/jobs.svelte';
  import { formatElapsed } from '$lib/utils/elapsed';
  import type { Job, JobState } from '$lib/api/types';

  type Props = {
    job: Job;
    /** Ticking epoch-ms so the elapsed timer moves (owned by TasksDrawer). */
    nowMs: number;
  };

  let { job, nowMs }: Props = $props();

  /**
   * Idempotent kinds that may be retried from the UI (D-16, UI-SPEC §Retry).
   * Non-idempotent kinds (clone/migrate/delete/restore) get NO Retry button.
   */
  const IDEMPOTENT = new Set([
    'vm.power',
    'vm.snapshot.delete',
    'vm.resize',
    'vm.backup',
  ]);

  // Per-state visual treatment — icon, state word, left-edge tint, spinner.
  type StateMeta = { word: string; bar: string; fg: string; spin: boolean };
  function meta(state: JobState): StateMeta {
    switch (state) {
      case 'pending':
      case 'claimed':
        return { word: state, bar: 'border-l-border', fg: 'text-muted-foreground', spin: false };
      case 'running':
        return { word: 'running', bar: 'border-l-border', fg: 'text-foreground', spin: true };
      case 'succeeded':
        return { word: 'done', bar: 'border-l-success', fg: 'text-success', spin: false };
      case 'failed':
        return { word: 'failed', bar: 'border-l-destructive', fg: 'text-destructive', spin: false };
      case 'orphaned':
        return { word: 'orphaned', bar: 'border-l-warning', fg: 'text-warning', spin: false };
      case 'needs_review':
        return { word: 'needs review', bar: 'border-l-warning', fg: 'text-warning', spin: false };
    }
  }

  const m = $derived(meta(job.state));
  const elapsed = $derived(formatElapsed(job.created_at, nowMs));
  const isRetryable = $derived(job.state === 'failed' && IDEMPOTENT.has(job.kind));

  /** Pretty task-type label: "vm.power" → "Power", "vm.snapshot.create" → "Snapshot create". */
  const label = $derived(prettyLabel(job.kind));
  function prettyLabel(kind: string): string {
    const tail = kind.split('.').slice(1).join(' ') || kind;
    return tail.charAt(0).toUpperCase() + tail.slice(1);
  }

  let retrying = $state(false);
  async function onRetry() {
    if (retrying) return;
    retrying = true;
    try {
      await jobsStore.retry(job.id);
    } finally {
      retrying = false;
    }
  }
</script>

<div class={`flex min-h-14 flex-col gap-1 border-l-2 ${m.bar} bg-background py-3 pl-3 pr-2`}>
  <!-- Line 1: state icon + label + elapsed -->
  <div class="flex items-center gap-2">
    {#if m.spin}
      <Loader2 class={`size-4 shrink-0 animate-spin ${m.fg}`} aria-hidden="true" />
    {:else if job.state === 'pending' || job.state === 'claimed'}
      <Clock class={`size-4 shrink-0 ${m.fg}`} aria-hidden="true" />
    {:else if job.state === 'succeeded'}
      <CircleCheck class={`size-4 shrink-0 ${m.fg}`} aria-hidden="true" />
    {:else if job.state === 'failed'}
      <CircleAlert class={`size-4 shrink-0 ${m.fg}`} aria-hidden="true" />
    {:else if job.state === 'orphaned'}
      <TriangleAlert class={`size-4 shrink-0 ${m.fg}`} aria-hidden="true" />
    {:else}
      <CircleSlash class={`size-4 shrink-0 ${m.fg}`} aria-hidden="true" />
    {/if}

    <span class="flex-1 truncate text-[14px] text-foreground">{label}</span>

    <!-- State word carries the meaning for screen readers (a11y). -->
    <span class={`text-[13px] font-medium ${m.fg}`} aria-live="polite">{m.word}</span>

    <!-- Elapsed timer is decorative for SR — aria-hidden (UI-SPEC a11y). -->
    <span class="font-mono text-[13px] tabular-nums text-muted-foreground" aria-hidden="true">
      {elapsed}
    </span>
  </div>

  <!-- Line 2: UPID -->
  {#if job.upid}
    <p class="truncate font-mono text-[13px] text-muted-foreground" title={job.upid}>
      {job.upid}
    </p>
  {/if}

  <!-- Orphan-reaper re-attach badge (warning) -->
  {#if job.state === 'orphaned'}
    <p class="flex items-center gap-1 text-[13px] text-warning">
      <RefreshCw class="size-3.5" aria-hidden="true" />
      Re-attached after a restart
    </p>
  {/if}

  <!-- Failed job: friendly error + technical detail + (idempotent) Retry -->
  {#if job.state === 'failed'}
    <div class="mt-1">
      <JobErrorDetail
        friendly={job.friendly_error ?? job.error ?? 'The task failed. See technical details below.'}
        raw={job.error}
        upid={job.upid}
        log={null}
      />
    </div>
    {#if isRetryable}
      <div class="mt-2">
        <Button variant="outline" size="sm" onclick={onRetry} disabled={retrying}>
          {#if retrying}
            <Loader2 class="size-3.5 mr-1 animate-spin" aria-hidden="true" />
            Retrying…
          {:else}
            <RotateCw class="size-3.5 mr-1" aria-hidden="true" />
            Retry job
          {/if}
        </Button>
      </div>
    {/if}
  {/if}
</div>
