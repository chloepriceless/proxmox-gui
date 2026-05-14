<!--
  ClusterStatusPill — colored pill indicating cluster connection status.

  Contract: UI-SPEC §Color §Semantic color usage (cluster-status pills).

    | Status    | Background        | Border            | Foreground        | Icon          | Default label    |
    |-----------|-------------------|-------------------|-------------------|---------------|------------------|
    | ok        | bg-success/10     | border-success/30 | text-success      | CheckCircle2  | Connection OK    |
    | failed    | bg-destructive/10 | border-destructive/30 | text-destructive | ShieldAlert | Connection failed |
    | untested  | bg-muted          | border-border     | text-muted-foreground | Plug      | Not yet tested   |

  All colors come from CSS variables (--success / --destructive / --muted /
  --border). No raw hex values; defence-in-depth on UI-SPEC §Color (no
  inline hex anywhere) AND on the a11y floor (UI-SPEC §Accessibility — colour
  is never the sole channel; every state has a Lucide icon AND a text label).
-->
<script lang="ts">
  import CheckCircle2 from '@lucide/svelte/icons/circle-check-big';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import Plug from '@lucide/svelte/icons/plug';

  type Props = {
    /** UI-SPEC semantic state. Choose by mapping cluster.status from the API. */
    status: 'ok' | 'failed' | 'untested';
    /** Optional label override. Defaults are UI-SPEC verbatim. */
    label?: string;
    /** Optional extra CSS class for the wrapper. */
    class?: string;
  };

  let { status, label, class: className = '' }: Props = $props();

  const defaultLabel = $derived(
    status === 'ok' ? 'Connection OK' : status === 'failed' ? 'Connection failed' : 'Not yet tested'
  );

  // Per UI-SPEC §Color §Semantic color usage — exact token tuple per state.
  const colorClasses = $derived(
    status === 'ok'
      ? 'bg-success/10 border-success/30 text-success'
      : status === 'failed'
        ? 'bg-destructive/10 border-destructive/30 text-destructive'
        : 'bg-muted border-border text-muted-foreground'
  );
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[13px] font-medium {colorClasses} {className}"
  role="status"
>
  {#if status === 'ok'}
    <CheckCircle2 class="size-3.5" aria-hidden="true" />
  {:else if status === 'failed'}
    <ShieldAlert class="size-3.5" aria-hidden="true" />
  {:else}
    <Plug class="size-3.5" aria-hidden="true" />
  {/if}
  <span>{label ?? defaultLabel}</span>
</span>
