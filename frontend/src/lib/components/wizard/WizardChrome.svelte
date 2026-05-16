<!--
  WizardChrome — the reusable `/create` wizard chrome (Plan 04-10).

  Contract: 04-UI-SPEC §"Wizard chrome contract".
    - Header: title "Create" (Heading 18/600) + an icon-only `X` close button
      that MUST carry `aria-label="Close wizard"`.
    - Stepper rail: a horizontal stepper above the step body. Active step
      `bg-primary`; completed steps `--success` with a `Check`; future steps
      `--muted`. Step labels are Label 13/500. Reuses the Phase-1
      `setup/+page.svelte` pip + connecting-line markup.
    - Footer: a 64px (`h-16`) sticky bar. `[← Back]` left (`variant="ghost"`,
      hidden on Step 1); `[Next →]` / the final CTA right (accent).
    - The step body is injected by the route through the `body` snippet. It is
      `max-w-[45rem]` centered, EXCEPT a step that opts into `wide` (the
      Cloud-Init step) which takes the full content width.

  This component is pure chrome — it owns no step state. The `/create` route
  drives `steps` / `activeStep` and the Back/Next handlers; the sibling step
  plans (04-11/12/13) render their step content into the `body` snippet.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import { WIZARD_STEP_LABEL, type WizardStepId } from './wizard-model';

  type Props = {
    /** The ordered step ids for the current path (from `stepsForPath`). */
    steps: WizardStepId[];
    /** The 1-based index of the active step. */
    activeStep: number;
    /** The step body — rendered by the route / sibling step plans. */
    body: Snippet;
    /** Back handler — `Back` is hidden when this is absent or on Step 1. */
    onBack?: () => void;
    /** Next / final-CTA handler. */
    onNext?: () => void;
    /** Close-wizard handler (the route shows the discard dialog). */
    onClose: () => void;
    /** The right-button label — "Next" on intermediate steps, the path CTA on Review. */
    nextLabel?: string;
    /** Disables the right button (e.g. Step-1 Next until a path is chosen). */
    nextDisabled?: boolean;
    /** Opts the step body into full content width (the Cloud-Init step). */
    wide?: boolean;
  };

  let {
    steps,
    activeStep,
    body,
    onBack,
    onNext,
    onClose,
    nextLabel = 'Next',
    nextDisabled = false,
    wide = false
  }: Props = $props();

  /** Back is shown only past Step 1 and only when a handler is wired. */
  const showBack = $derived(activeStep > 1 && typeof onBack === 'function');
</script>

<div class="flex h-full min-h-[32rem] flex-col">
  <!-- ============================================================== -->
  <!-- Header — title "Create" + the close `X` -->
  <!-- ============================================================== -->
  <header class="flex items-center justify-between gap-4 border-b px-6 py-4">
    <h1 class="text-[18px] font-semibold tracking-tight">Create</h1>
    <Button
      variant="ghost"
      size="icon"
      onclick={onClose}
      aria-label="Close wizard"
    >
      <X class="size-4" aria-hidden="true" />
    </Button>
  </header>

  <!-- ============================================================== -->
  <!-- Stepper rail — pip + connecting line (Phase-1 setup-wizard markup) -->
  <!-- ============================================================== -->
  <ol
    class="flex w-full items-center gap-2 border-b px-6 py-4"
    aria-label="Wizard progress"
  >
    {#each steps as stepId, i (stepId)}
      {@const stepNo = i + 1}
      {@const isComplete = activeStep > stepNo}
      {@const isActive = activeStep === stepNo}
      <li class="flex flex-1 items-center gap-2">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-medium {isActive
            ? 'bg-primary text-primary-foreground border-primary'
            : isComplete
              ? 'bg-success text-success-foreground border-success'
              : 'bg-muted text-muted-foreground border-border'}"
          aria-current={isActive ? 'step' : undefined}
          aria-label="Step {stepNo}: {WIZARD_STEP_LABEL[stepId]}"
        >
          {#if isComplete}
            <Check class="size-4" aria-hidden="true" />
          {:else}
            {stepNo}
          {/if}
        </span>
        <span
          class="text-[13px] font-medium whitespace-nowrap {isActive
            ? 'text-foreground'
            : 'text-muted-foreground'}"
        >
          {WIZARD_STEP_LABEL[stepId]}
        </span>
        {#if i < steps.length - 1}
          <span
            aria-hidden="true"
            class="h-[2px] flex-1 {isComplete ? 'bg-success' : 'bg-border'}"
          ></span>
        {/if}
      </li>
    {/each}
  </ol>

  <!-- ============================================================== -->
  <!-- Step body — injected by the route; centered unless `wide` -->
  <!-- ============================================================== -->
  <div class="flex-1 overflow-y-auto px-6 py-6">
    <div class="mx-auto w-full {wide ? '' : 'max-w-[45rem]'}">
      {@render body()}
    </div>
  </div>

  <!-- ============================================================== -->
  <!-- Footer — 64px sticky, Back left (hidden on Step 1) / Next right -->
  <!-- ============================================================== -->
  <footer
    class="bg-background sticky bottom-0 flex h-16 items-center justify-between gap-2 border-t px-6"
  >
    <div>
      {#if showBack}
        <Button variant="ghost" type="button" onclick={onBack}>Back</Button>
      {/if}
    </div>
    <Button type="button" onclick={onNext} disabled={nextDisabled}>
      {nextLabel}
    </Button>
  </footer>
</div>
