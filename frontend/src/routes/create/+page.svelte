<!--
  /create — the unified provisioning wizard route (Plan 04-10, LXC paths
  wired by Plan 04-11).

  This route IS the wizard shell. It owns:
    - The `Step` state machine — a path-conditional step list (LXC paths skip
      the Cloud-Init step; all four VM paths include it — UI-SPEC step-model
      table, D-03). The model is derived from `stepsForPath`.
    - The chrome assembly — it renders `WizardChrome` with the stepper rail and
      mounts Step 1 (`PathPicker`) directly. Steps 2..N are mount points:
        * 04-11 — the LXC Source/Resources steps (WIRED below)
        * 04-12 — the VM Source/Resources steps
        * 04-13 — the Cloud-Init step
    - Draft persistence — `wizardDraft` (sessionStorage-backed).
    - The discard prompt.
    - The D-04 post-submit routing helper (`completeWithJob`).

  Plan 04-11 wires the two LXC paths into the step-orchestration surface:
    * plain-lxc:        Path → LxcTemplateStep → LxcResourcesStep → Network → Review
    * community-script: Path → CatalogBrowser  → LxcResourcesStep → Network → Review
  On submit the Review step calls `api.provisioning.createLxc` /
  `createCommunityScript` and routes to `/inventory/{cluster}/{vmid}` (D-04).
  The Network step body is owned by Plan 04-12 — until it lands the LXC paths
  render an honest placeholder for the `network` step.
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import WizardChrome from '$lib/components/wizard/WizardChrome.svelte';
  import PathPicker from '$lib/components/wizard/PathPicker.svelte';
  import CatalogBrowser from '$lib/components/wizard/CatalogBrowser.svelte';
  import LxcTemplateStep from '$lib/components/wizard/LxcTemplateStep.svelte';
  import LxcResourcesStep, {
    type LxcResourcesValue
  } from '$lib/components/wizard/LxcResourcesStep.svelte';
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
  import {
    lxcStepValid,
    validateLxcStep,
    buildLxcRequest,
    buildCommunityScriptRequest,
    mapLxcCreateError,
    LXC_RESOURCE_DEFAULTS,
    type LxcFeatureFlag
  } from '$lib/components/wizard/lxc-wizard';
  import { wizardDraft } from '$lib/stores/wizardDraft.svelte';
  import { api } from '$lib/api/client';
  import type { CatalogEntry, ProvisioningJobAccepted } from '$lib/api/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // -- step model ----------------------------------------------------------

  /** The ordered step ids for the chosen path (just `['path']` until chosen). */
  const steps = $derived<WizardStepId[]>(stepsForPath(wizardDraft.path));

  /** The 1-based active step, clamped into the current path's step model. */
  const activeStep = $derived(Math.min(wizardDraft.step, steps.length));

  /** The id of the active step — drives the step-body switch below. */
  const activeStepId = $derived<WizardStepId>(steps[activeStep - 1] ?? 'path');

  /** Whether the chosen path is an LXC path (this plan owns those step bodies). */
  const isLxcPath = $derived(
    wizardDraft.path === 'plain-lxc' || wizardDraft.path === 'community-script'
  );

  /** The Cloud-Init step opts into the full-width two-pane layout. */
  const wide = $derived(activeStepId === 'cloud-init');

  /** The right-button label — "Next" on intermediate steps, the path CTA on Review. */
  const nextLabel = $derived(
    activeStepId === 'review' && wizardDraft.path
      ? FINAL_CTA_LABEL[wizardDraft.path]
      : 'Next'
  );

  // -- owning team + cluster ----------------------------------------------

  /** The teams the user may provision into. */
  const teams = $derived(
    (data.user?.teams ?? []).map((t) => ({ id: t.id, name: t.name }))
  );

  /** The chosen owning team — defaults to the user's personal team. */
  let teamId = $state<number | null>(null);
  $effect(() => {
    if (teamId === null && data.user?.teams?.length) {
      const personal = data.user.teams.find((t) => t.personal);
      teamId = (personal ?? data.user.teams[0]).id;
    }
  });

  /** The cluster the wizard provisions into — the first available cluster. */
  const clusterId = $derived<number | null>(data.clusters[0]?.id ?? null);

  // -- the LXC form bag ----------------------------------------------------
  // The wizard's per-step values live in `wizardDraft.formData`; the route
  // mirrors the LXC fields into typed locals for the step components and
  // writes back through `wizardDraft.patchFormData`.

  /** The plain-LXC template volume id (the `ostemplate`). */
  let ostemplate = $state<string>((wizardDraft.formData.ostemplate as string) ?? '');

  /** The selected community-script slug. */
  let scriptSlug = $state<string>((wizardDraft.formData.script_slug as string) ?? '');
  /** The D-07 script-option values for the selected community-script. */
  let scriptOptions = $state<Record<string, string>>(
    (wizardDraft.formData.script_options as Record<string, string>) ?? {}
  );
  /** The selected community-script name (for the Review summary + toast). */
  let scriptName = $state<string>((wizardDraft.formData.script_name as string) ?? '');

  /** The Resources-step value bag (node / storage / sizing / LXC-07 toggles). */
  let resources = $state<LxcResourcesValue>({
    node: (wizardDraft.formData.node as string) ?? '',
    storage: (wizardDraft.formData.storage as string) ?? '',
    hostname: (wizardDraft.formData.hostname as string) ?? '',
    cpu_cores: (wizardDraft.formData.cpu_cores as number) ?? 1,
    memory_mb: (wizardDraft.formData.memory_mb as number) ?? 512,
    disk_gb: (wizardDraft.formData.disk_gb as number) ?? 8,
    unprivileged:
      (wizardDraft.formData.unprivileged as boolean) ??
      LXC_RESOURCE_DEFAULTS.unprivileged,
    nesting: (wizardDraft.formData.nesting as boolean) ?? LXC_RESOURCE_DEFAULTS.nesting,
    features:
      (wizardDraft.formData.features as LxcFeatureFlag[]) ?? [
        ...LXC_RESOURCE_DEFAULTS.features
      ]
  });

  /** The submit error (a 409/4xx surfaced inline — the wizard stays put). */
  let submitError = $state<string | null>(null);
  let submitting = $state(false);

  // -- per-step validation -------------------------------------------------
  // Gate the footer Next button on the LXC step's own field validation.

  /** The current LXC-step form bag (for `validateLxcStep`). */
  const lxcFormBag = $derived({
    ostemplate,
    script_slug: scriptSlug,
    node: resources.node,
    storage: resources.storage,
    hostname: resources.hostname,
    cpu_cores: resources.cpu_cores,
    memory_mb: resources.memory_mb,
    disk_gb: resources.disk_gb
  });

  /** Field errors for the active step (empty unless the step has rules). */
  const stepErrors = $derived(
    isLxcPath && wizardDraft.path
      ? validateLxcStep(activeStepId, wizardDraft.path, lxcFormBag)
      : {}
  );

  /**
   * The Next gate. Step 1 needs a chosen path; LXC steps gate on
   * `validateLxcStep`; an unwired step (network) stays permissive.
   */
  const nextDisabled = $derived.by(() => {
    if (activeStepId === 'path') return !canAdvanceFromPathStep(wizardDraft.path);
    if (isLxcPath && wizardDraft.path) {
      if (activeStepId === 'source' || activeStepId === 'resources') {
        return !lxcStepValid(activeStepId, wizardDraft.path, lxcFormBag);
      }
    }
    return false;
  });

  // -- orchestration -------------------------------------------------------

  /** Persist the LXC form bag into the draft store (secrets stripped on write). */
  function persistDraft(): void {
    wizardDraft.patchFormData({
      ostemplate,
      script_slug: scriptSlug,
      script_options: scriptOptions,
      script_name: scriptName,
      node: resources.node,
      storage: resources.storage,
      hostname: resources.hostname,
      cpu_cores: resources.cpu_cores,
      memory_mb: resources.memory_mb,
      disk_gb: resources.disk_gb,
      unprivileged: resources.unprivileged,
      nesting: resources.nesting,
      features: resources.features
    });
  }

  /** Advance to the next step. */
  function next(): void {
    if (nextDisabled) return;
    persistDraft();
    if (activeStep < steps.length) wizardDraft.goToStep(activeStep + 1);
  }

  /** Step back one step. */
  function back(): void {
    if (activeStep > 1) wizardDraft.goToStep(activeStep - 1);
  }

  /** Jump to a specific step — the Review step's "Edit" links use this. */
  function goToStep(target: number): void {
    if (target >= 1 && target <= steps.length) wizardDraft.goToStep(target);
  }

  /** Step 1 chose a path — persist it and reset to step 1 of the new model. */
  function handlePathSelect(path: WizardPath): void {
    wizardDraft.selectPath(path);
    wizardDraft.goToStep(1);
  }

  /** The community-script card was confirmed in `ScriptDetailPanel`. */
  function handleScriptSelect(
    entry: CatalogEntry,
    optionValues: Record<string, string>
  ): void {
    scriptSlug = entry.slug;
    scriptName = entry.name;
    scriptOptions = optionValues;
    if (!resources.hostname) resources.hostname = entry.slug;
    persistDraft();
  }

  /**
   * D-04 post-submit landing — clears the draft, fires the toast, routes to
   * the new resource's detail page using the reserved `vmid`.
   */
  async function completeWithJob(
    cluster: number,
    job: ProvisioningJobAccepted,
    resourceName: string
  ): Promise<void> {
    wizardDraft.clear();
    toast.info(`Creating ${resourceName}… — Track progress in Tasks.`);
    await goto(inventoryPathForJob(cluster, job));
  }

  /** The Review step's terminal CTA — submit the create job. */
  async function submit(): Promise<void> {
    if (submitting || clusterId === null || teamId === null || !wizardDraft.path) return;
    submitting = true;
    submitError = null;
    try {
      let job: ProvisioningJobAccepted;
      let resourceName: string;
      if (wizardDraft.path === 'plain-lxc') {
        const body = buildLxcRequest({ ...lxcFormBag, ...resources }, teamId);
        job = await api.provisioning.createLxc({ clusterId, body });
        resourceName = body.hostname;
      } else {
        const body = buildCommunityScriptRequest(
          { ...lxcFormBag, ...resources, script_options: scriptOptions },
          teamId
        );
        job = await api.provisioning.createCommunityScript({ clusterId, body });
        resourceName = scriptName || body.hostname;
      }
      await completeWithJob(clusterId, job, resourceName);
    } catch (err) {
      // A 409 (over-quota) / 4xx surfaces inline — the wizard does NOT
      // navigate away (T-04-11-03).
      submitError = mapLxcCreateError(err);
    } finally {
      submitting = false;
    }
  }

  /** The footer's right-button handler — submit on Review, else advance. */
  function handleNext(): void {
    if (activeStepId === 'review') void submit();
    else next();
  }

  // -- discard flow --------------------------------------------------------

  let discardOpen = $state(false);

  function requestClose(): void {
    if (shouldPromptDiscard(wizardDraft.path, activeStep)) discardOpen = true;
    else void goto('/inventory');
  }

  async function confirmDiscard(): Promise<void> {
    discardOpen = false;
    wizardDraft.clear();
    await goto('/inventory');
  }

  /** A read-only summary row for the Review step. */
  type ReviewRow = { label: string; value: string };
  const reviewRows = $derived.by<ReviewRow[]>(() => {
    const rows: ReviewRow[] = [];
    if (wizardDraft.path === 'plain-lxc') {
      rows.push({ label: 'Template', value: ostemplate || '—' });
    } else {
      rows.push({ label: 'Script', value: scriptName || scriptSlug || '—' });
    }
    rows.push(
      { label: 'Hostname', value: resources.hostname || '—' },
      { label: 'Node', value: resources.node || '—' },
      { label: 'Storage', value: resources.storage || '—' },
      {
        label: 'Size',
        value: `${resources.cpu_cores} vCPU · ${resources.memory_mb} MB RAM · ${resources.disk_gb} GB disk`
      },
      {
        label: 'Options',
        value: [
          resources.unprivileged ? 'unprivileged' : 'privileged',
          resources.nesting ? 'nesting' : null,
          ...resources.features
        ]
          .filter(Boolean)
          .join(', ')
      }
    );
    return rows;
  });
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
      nextDisabled={nextDisabled || submitting}
      onBack={back}
      onNext={handleNext}
      onClose={requestClose}
    >
      {#snippet body()}
        {#if activeStepId === 'path'}
          <!-- Step 1 — the six-path picker. -->
          <PathPicker value={wizardDraft.path} onSelect={handlePathSelect} />
        {:else if isLxcPath && wizardDraft.path}
          <!-- ============================================================ -->
          <!-- The two LXC paths — owned by Plan 04-11.                       -->
          <!-- ============================================================ -->
          {#if activeStepId === 'source' && wizardDraft.path === 'plain-lxc'}
            <LxcTemplateStep
              value={ostemplate}
              onChange={(v) => {
                ostemplate = v;
                persistDraft();
              }}
            />
          {:else if activeStepId === 'source' && wizardDraft.path === 'community-script'}
            {#if clusterId !== null}
              <CatalogBrowser
                {clusterId}
                selectedSlug={scriptSlug}
                onSelect={handleScriptSelect}
              />
            {:else}
              <EmptyState
                icon={Boxes}
                heading="No cluster available"
                body="The community-scripts catalog needs a cluster. Register one first."
              />
            {/if}
          {:else if activeStepId === 'resources'}
            <LxcResourcesStep
              {teams}
              {teamId}
              value={resources}
              errors={stepErrors}
              onChange={(next) => {
                resources = next;
                persistDraft();
              }}
              onTeamChange={(id) => (teamId = id)}
            />
          {:else if activeStepId === 'network'}
            <!--
              The Network step body is owned by Plan 04-12 (the shared
              SDN-aware network picker). Until wave 6 lands it the LXC paths
              show an honest placeholder; the create body sends `network:
              null` (the backend applies the cluster default NIC).
            -->
            <div class="flex flex-col gap-2">
              <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
                {WIZARD_STEP_LABEL.network}
              </h2>
              <p class="text-muted-foreground text-[14px]">
                The network picker ships with Plan 04-12. The container will use
                the cluster's default network for now.
              </p>
            </div>
          {:else if activeStepId === 'review'}
            <!-- The Review step — a read-only summary + the terminal CTA. -->
            <div class="flex flex-col gap-4">
              <header class="flex flex-col gap-1">
                <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
                  Review &amp; create
                </h2>
                <p class="text-muted-foreground text-[14px]">
                  Check the details below, then create the container.
                </p>
              </header>

              <dl class="divide-border divide-y rounded-md border">
                {#each reviewRows as row (row.label)}
                  <div class="flex items-center justify-between gap-4 px-4 py-2.5">
                    <dt class="text-muted-foreground text-[13px]">{row.label}</dt>
                    <dd class="text-[14px] font-medium">{row.value}</dd>
                  </div>
                {/each}
              </dl>

              {#if submitError}
                <div class="bg-destructive/10 rounded-md p-3">
                  <p class="text-[13px] text-destructive">{submitError}</p>
                </div>
              {/if}

              <div class="flex gap-2">
                <Button variant="link" class="h-auto p-0" onclick={() => goToStep(2)}>
                  Edit details
                </Button>
              </div>
            </div>
          {/if}
        {:else}
          <!--
            VM-path steps (04-12) + the Cloud-Init step (04-13) — placeholder
            until those plans land.
          -->
          <div class="flex flex-col gap-2">
            <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
              {WIZARD_STEP_LABEL[activeStepId]}
            </h2>
            <p class="text-muted-foreground text-[14px]">
              This step is being built. Use Back to return to the path picker.
            </p>
            {#if wizardDraft.path}
              <p class="text-muted-foreground text-[13px]">
                Selected path: <span class="text-foreground font-medium"
                  >{wizardDraft.path}</span
                >
                ({pathKind(wizardDraft.path) === 'lxc' ? 'container' : 'VM'}).
              </p>
            {/if}
          </div>
        {/if}
      {/snippet}
    </WizardChrome>
  </Card.Root>

  {#if data.loadError}
    <div class="mt-4">
      <EmptyState
        icon={Boxes}
        heading="Couldn't load your clusters"
        body="The wizard can still start, but cluster-dependent steps may be unavailable. Try reloading."
      />
    </div>
  {/if}
</div>

<!-- Discard-draft confirm. -->
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
