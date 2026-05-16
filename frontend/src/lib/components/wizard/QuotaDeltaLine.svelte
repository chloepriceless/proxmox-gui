<!--
  QuotaDeltaLine — the shared live quota-delta line (Plan 04-12).

  Contract: 04-UI-SPEC §"Resources step contract" (inherits Phase-2 D-08, VM-10).
    - Given the requested sizing it renders "+N vCPU, +N GB RAM" (Label 13/500).
    - In-budget: `text-muted-foreground`.
    - Over-quota: `text-destructive` — and `onOverQuotaChange` signals the step
      to disable `Next`; a `HelpTooltip` explains why.
    - Re-evaluates whenever the requested CPU/Memory changes (`delta` is
      `$derived`).

  Shared building block: BOTH the VM Resources step (`VmResourcesStep`) and the
  LXC Resources step (`LxcResourcesStep`, retro-wired by the /create route)
  embed this. The quota budget is read as a prop — `QuotaBudget` carrying the
  team's current usage + limit for the targeted cluster (the Phase-2
  `api.quotas` figures). When no budget is wired the delta still shows; the
  backend's row-locked admission remains the real gate.
-->
<script lang="ts">
  import HelpTooltip from '$lib/components/shared/HelpTooltip.svelte';
  import { computeQuotaDelta, type QuotaBudget, type QuotaDelta } from './vm-wizard';

  type Props = {
    /** The requested CPU cores. */
    requestedCpu: number;
    /** The requested RAM in MB. */
    requestedRamMb: number;
    /**
     * The team's current usage + limit for the targeted cluster. `null` when
     * no quota data is wired — the delta still renders, never over-quota.
     */
    budget?: QuotaBudget | null;
    /**
     * Fired with the over-quota signal — the Resources step disables `Next`
     * while this is true.
     */
    onOverQuotaChange?: (overQuota: boolean) => void;
  };

  let {
    requestedCpu,
    requestedRamMb,
    budget = null,
    onOverQuotaChange
  }: Props = $props();

  /** The quota delta — recomputed whenever the request or budget changes. */
  const delta = $derived<QuotaDelta>(
    computeQuotaDelta({ cpu: requestedCpu, ramMb: requestedRamMb }, budget)
  );

  /** Signal the over-quota state up to the Resources step. */
  $effect(() => {
    onOverQuotaChange?.(delta.overQuota);
  });
</script>

<div class="flex items-center gap-1.5">
  <p
    class="text-[13px] font-medium {delta.overQuota
      ? 'text-destructive'
      : 'text-muted-foreground'}"
  >
    {delta.overQuota ? `${delta.label} — over quota` : delta.label}
  </p>
  {#if delta.overQuota}
    <HelpTooltip
      label="Over quota"
      text="This size would push your team past its CPU or memory quota on this cluster. Reduce the size, or ask an administrator to raise the limit."
    />
  {/if}
</div>
