<!--
  ReviewStep — the wizard Review step (Plan 04-12).

  Contract: 04-UI-SPEC §"Review step contract".
    - A read-only summary grouped into `card` sections mirroring the steps
      (Path, Source, Resources, Network, Cloud-Init when present).
    - Each section has an "Edit" link (`variant="link"`) jumping back to that
      step.
    - The live quota-delta line repeats here for a last confirmation.
    - The terminal provisioning CTA lives in the wizard footer (not here).

  Used by BOTH the VM paths (Plan 04-12) and the LXC paths (Plan 04-11 mounts
  it too). The caller supplies the per-section row data + the step indices the
  "Edit" links jump to — this component is purely presentational.
-->
<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import QuotaDeltaLine from './QuotaDeltaLine.svelte';
  import type { QuotaBudget } from './vm-wizard';

  /** One read-only summary row inside a Review section. */
  export type ReviewRow = { label: string; value: string };

  /** One Review section — mirrors a wizard step. */
  export type ReviewSection = {
    /** The section title (Path / Source / Resources / Network / Cloud-Init). */
    title: string;
    /** The summary rows. */
    rows: ReviewRow[];
    /** The 1-based wizard step index the "Edit" link jumps to. */
    editStep: number;
  };

  type Props = {
    /** The ordered Review sections. */
    sections: ReviewSection[];
    /** The requested CPU cores — for the repeated quota-delta line. */
    requestedCpu?: number;
    /** The requested RAM in MB — for the repeated quota-delta line. */
    requestedRamMb?: number;
    /** The team's quota budget — for the repeated quota-delta line. */
    quotaBudget?: QuotaBudget | null;
    /** An inline submit error (a 409/4xx — surfaced without navigating away). */
    submitError?: string | null;
    /** Fired when an "Edit" link is clicked, with the target step index. */
    onEdit?: (step: number) => void;
  };

  let {
    sections,
    requestedCpu = 0,
    requestedRamMb = 0,
    quotaBudget = null,
    submitError = null,
    onEdit
  }: Props = $props();

  /** Whether the repeated quota-delta line should render (non-clone sizing). */
  const showQuotaDelta = $derived(requestedCpu > 0 && requestedRamMb > 0);
</script>

<section class="flex flex-col gap-4">
  <header class="flex flex-col gap-1">
    <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
      Review and create
    </h2>
    <p class="text-muted-foreground text-[14px]">
      Check the configuration, then create your resource.
    </p>
  </header>

  {#each sections as section (section.title)}
    <Card.Root class="p-0">
      <div class="flex items-center justify-between border-b px-4 py-2.5">
        <h3 class="text-[14px] font-semibold">{section.title}</h3>
        <Button
          variant="link"
          class="h-auto p-0 text-[13px]"
          onclick={() => onEdit?.(section.editStep)}
        >
          Edit
        </Button>
      </div>
      <dl class="divide-border divide-y">
        {#each section.rows as row (row.label)}
          <div class="flex items-center justify-between gap-4 px-4 py-2">
            <dt class="text-muted-foreground text-[13px]">{row.label}</dt>
            <dd class="text-[14px] font-medium">{row.value}</dd>
          </div>
        {/each}
      </dl>
    </Card.Root>
  {/each}

  {#if showQuotaDelta}
    <div class="flex items-center justify-between gap-4 px-1">
      <span class="text-muted-foreground text-[13px]">This resource adds</span>
      <QuotaDeltaLine
        {requestedCpu}
        {requestedRamMb}
        budget={quotaBudget}
      />
    </div>
  {/if}

  {#if submitError}
    <div class="bg-destructive/10 rounded-md p-3">
      <p class="text-destructive text-[13px]">{submitError}</p>
    </div>
  {/if}
</section>
