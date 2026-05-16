<!--
  /create — the unified provisioning wizard route (Plan 04-10).

  This route IS the wizard shell. It owns:
    - The `Step` state machine — a path-conditional step list (LXC paths skip
      the Cloud-Init step; all four VM paths include it — UI-SPEC step-model
      table, D-03). The model is derived from `stepsForPath`.
    - The chrome assembly — it renders `WizardChrome` with the stepper rail and
      mounts Step 1 (`PathPicker`) directly. Steps 2..N are mount points the
      three sibling step plans plug their per-path step components into:
        * 04-11 — the LXC Source/Resources steps
        * 04-12 — the VM Source/Resources steps
        * 04-13 — the Cloud-Init step
      They render into the marked `{:else if ...}` branches of the step body
      and call the orchestration surface (`next` / `back` / `goToStep`).
    - Draft persistence — `wizardDraft` (sessionStorage-backed) so a mid-wizard
      reload restores the path + step.
    - The discard prompt — closing mid-wizard opens an `alert-dialog`; confirm
      clears the draft and navigates away.
    - The D-04 post-submit routing helper (`completeWithJob`) — on a successful
      202 the sibling step plans call it; it clears the draft, fires the toast,
      and routes to `/inventory/{cluster}/{vmid}` off `response.vmid`.

  Chrome contract: 04-UI-SPEC §"Create wizard". The wizard renders inside the
  authenticated AppShell; `WizardChrome` is its bordered panel.
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import WizardChrome from '$lib/components/wizard/WizardChrome.svelte';
  import PathPicker from '$lib/components/wizard/PathPicker.svelte';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import Boxes from '@lucide/svelte/icons/boxes';
  import {
    stepsForPath,
    canAdvanceFromPathStep,
    inventoryPathForJob,
    shouldPromptDiscard,
    pathKind,
    FINAL_CTA_LABEL,
    WIZARD_STEP_LABEL,
    type WizardPath,
    type WizardStepId
  } from '$lib/components/wizard/wizard-model';
  import { wizardDraft } from '$lib/stores/wizardDraft.svelte';
  import type { ProvisioningJobAccepted } from '$lib/api/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // -- step model ----------------------------------------------------------
  // `wizardDraft` is the single source of truth — both `path` and `step`
  // round-trip through sessionStorage, so a mid-wizard reload restores them.

  /** The ordered step ids for the chosen path (just `['path']` until chosen). */
  const steps = $derived<WizardStepId[]>(stepsForPath(wizardDraft.path));

  /** The 1-based active step, clamped into the current path's step model. */
  const activeStep = $derived(Math.min(wizardDraft.step, steps.length));

  /** The id of the active step — drives the step-body switch below. */
  const activeStepId = $derived<WizardStepId>(steps[activeStep - 1] ?? 'path');

  /** The Cloud-Init step opts into the full-width two-pane layout. */
  const wide = $derived(activeStepId === 'cloud-init');

  /** The right-button label — "Next" on intermediate steps, the path CTA on Review. */
  const nextLabel = $derived(
    activeStepId === 'review' && wizardDraft.path
      ? FINAL_CTA_LABEL[wizardDraft.path]
      : 'Next'
  );

  /**
   * The Next gate. Step 1 needs a chosen path; later steps gate on the sibling
   * step plans' own per-step validation (they bind `stepValid` — until then a
   * later step is permissive so the shell never hard-blocks itself).
   */
  let stepValid = $state(true);
  const nextDisabled = $derived(
    activeStepId === 'path' ? !canAdvanceFromPathStep(wizardDraft.path) : !stepValid
  );

  // -- orchestration surface ----------------------------------------------
  // The shell exposes `next` / `back` / `goToStep` so the sibling step plans
  // drive navigation without re-implementing the step machine.

  /** Advance to the next step (or do nothing on the last step). */
  function next(): void {
    if (nextDisabled) return;
    if (activeStep < steps.length) {
      wizardDraft.goToStep(activeStep + 1);
      stepValid = true;
    }
  }

  /** Step back one step (the chrome hides Back on Step 1). */
  function back(): void {
    if (activeStep > 1) {
      wizardDraft.goToStep(activeStep - 1);
      stepValid = true;
    }
  }

  /** Jump to a specific step — the Review step's "Edit" links use this. */
  function goToStep(target: number): void {
    if (target >= 1 && target <= steps.length) {
      wizardDraft.goToStep(target);
      stepValid = true;
    }
  }

  /** Step 1 chose a path — persist it and reset to step 1 of the new model. */
  function handlePathSelect(path: WizardPath): void {
    wizardDraft.selectPath(path);
    wizardDraft.goToStep(1);
  }

  /**
   * D-04 post-submit landing. The sibling step plans call this from their
   * create-submit handler with the 202 `ProvisioningJobAccepted` body: it
   * clears the draft, fires the "Creating…" toast, and routes to the new
   * resource's detail page using the reserved `vmid` off the response.
   */
  async function completeWithJob(
    clusterId: number,
    job: ProvisioningJobAccepted,
    resourceName: string
  ): Promise<void> {
    wizardDraft.clear();
    toast.info(`Creating ${resourceName}… — Track progress in Tasks.`);
    await goto(inventoryPathForJob(clusterId, job));
  }

  // The orchestration surface the sibling step plans consume. Exposed as a
  // single object so 04-11/12/13 destructure exactly what they need.
  const orchestration = {
    next,
    back,
    goToStep,
    completeWithJob,
    get path() {
      return wizardDraft.path;
    },
    get activeStepId() {
      return activeStepId;
    },
    get clusters() {
      return data.clusters;
    },
    setStepValid: (valid: boolean) => {
      stepValid = valid;
    }
  };
  // `orchestration` is the contract object the step plans wire into; the shell
  // does not consume it itself yet (the step bodies are owned by 04-11/12/13).
  void orchestration;

  // -- discard flow --------------------------------------------------------

  /** Whether the discard-confirm `alert-dialog` is open. */
  let discardOpen = $state(false);

  /**
   * Close the wizard. With no draft progress (still on Step 1, no path) it
   * navigates straight to /inventory; mid-wizard it opens the discard prompt.
   */
  function requestClose(): void {
    if (shouldPromptDiscard(wizardDraft.path, activeStep)) {
      discardOpen = true;
    } else {
      void goto('/inventory');
    }
  }

  /** Confirm discard — clears the draft and leaves the wizard. */
  async function confirmDiscard(): Promise<void> {
    discardOpen = false;
    wizardDraft.clear();
    await goto('/inventory');
  }
</script>

<svelte:head>
  <title>Create — Proxmox GUI</title>
</svelte:head>

<div class="mx-auto w-full max-w-5xl">
  <Card.Root class="overflow-hidden p-0 shadow-sm">
    <WizardChrome
      {steps}
      {activeStep}
      {wide}
      {nextLabel}
      {nextDisabled}
      onBack={back}
      onNext={next}
      onClose={requestClose}
    >
      {#snippet body()}
        {#if activeStepId === 'path'}
          <!-- Step 1 — the six-path picker (owned by this plan). -->
          <PathPicker value={wizardDraft.path} onSelect={handlePathSelect} />
        {:else}
          <!--
            Steps 2..N — Source / Resources / Network / Cloud-Init / Review.
            These step bodies are owned by the sibling wizard-step plans:
              * 04-11 — LXC Source + Resources + Network
              * 04-12 — VM  Source + Resources + Network
              * 04-13 — the Cloud-Init step + the Review step
            They render their per-path step component into this branch,
            switching on `activeStepId` + `wizardDraft.path`, and drive
            navigation through `next` / `back` / `goToStep` / `completeWithJob`
            (the `orchestration` surface above).

            Until they land, the shell renders an honest placeholder so the
            wizard is navigable end-to-end without a blank step body.
          -->
          <div class="flex flex-col gap-2">
            <header class="flex flex-col gap-1">
              <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
                {WIZARD_STEP_LABEL[activeStepId]}
              </h2>
              <p class="text-muted-foreground text-[14px]">
                This step is being built. Use Back to return to the path picker.
              </p>
            </header>
            <p class="text-muted-foreground text-[13px]">
              {#if wizardDraft.path}
                Selected path: <span class="text-foreground font-medium"
                  >{wizardDraft.path}</span
                >
                ({pathKind(wizardDraft.path) === 'lxc' ? 'container' : 'VM'}).
              {/if}
            </p>
          </div>
        {/if}
      {/snippet}
    </WizardChrome>
  </Card.Root>

  {#if data.loadError}
    <!-- The cluster context failed to load — surfaced, non-fatal. -->
    <div class="mt-4">
      <EmptyState
        icon={Boxes}
        heading="Couldn't load your clusters"
        body="The wizard can still start, but cluster-dependent steps may be unavailable. Try reloading."
      />
    </div>
  {/if}
</div>

<!-- Discard-draft confirm (UI-SPEC §Destructive confirmations — the one
     Phase-4 confirm; non-destructive to any Proxmox resource). -->
<AlertDialog.Root bind:open={discardOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Discard this draft?</AlertDialog.Title>
      <AlertDialog.Description>
        Your wizard progress will be lost. The resource has not been created.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <Button variant="ghost" onclick={() => (discardOpen = false)}>Cancel</Button>
      <Button variant="destructive" onclick={confirmDiscard}>Discard draft</Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
