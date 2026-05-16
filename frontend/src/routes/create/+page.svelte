<!--
  /create — the unified provisioning wizard route (Plan 04-10, LXC paths
  wired by Plan 04-11, VM paths + the shared node-fit/quota/network building
  blocks wired by Plan 04-12).

  This route IS the wizard shell. It owns:
    - The `Step` state machine — a path-conditional step list (LXC paths skip
      the Cloud-Init step; all four VM paths include it — UI-SPEC step-model
      table, D-03). The model is derived from `stepsForPath`.
    - The chrome assembly — it renders `WizardChrome` with the stepper rail and
      mounts Step 1 (`PathPicker`) directly. Steps 2..N are the per-path step
      bodies:
        * 04-11 — the LXC Source/Resources steps (WIRED)
        * 04-12 — the VM Source/Resources steps + the shared node-fit selector,
          the quota-delta line, the SDN-aware NetworkPicker, the Review step
          (WIRED below — and retro-wired into the LXC paths)
        * 04-13 — the Cloud-Init step (placeholder mount point below)
    - Draft persistence — `wizardDraft` (sessionStorage-backed).
    - The discard prompt.
    - The D-04 post-submit routing helper (`completeWithJob`).

  Wave-6 wiring (Plan 04-12):
    * The four VM paths each mount:
        Path → VmSourceStep → VmResourcesStep → NetworkPicker
             → [Cloud-Init mount point — 04-13] → ReviewStep
    * The LXC Resources step is retro-enriched with the shared `NodeSelect`
      (node-fit) + `QuotaDeltaLine` — rendered alongside `LxcResourcesStep`
      WITHOUT editing that file (it is Plan 04-11's; it exposes comment-only
      mount markers, not prop slots — see the SUMMARY deviation note).
    * The LXC Network step now renders the shared `NetworkPicker`.
    * Both LXC and VM paths land on the shared `ReviewStep`.
  On submit the VM paths call `api.provisioning.createQemu` with the path's
  `source_kind` and route to `/inventory/{cluster}/{vmid}` (D-04).
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
  import NodeSelect from '$lib/components/wizard/NodeSelect.svelte';
  import QuotaDeltaLine from '$lib/components/wizard/QuotaDeltaLine.svelte';
  import NetworkPicker from '$lib/components/wizard/NetworkPicker.svelte';
  import VmSourceStep, {
    type VmSourceValue,
    type CloneSourceOption
  } from '$lib/components/wizard/VmSourceStep.svelte';
  import VmResourcesStep, {
    type VmResourcesValue
  } from '$lib/components/wizard/VmResourcesStep.svelte';
  import ReviewStep, {
    type ReviewSection
  } from '$lib/components/wizard/ReviewStep.svelte';
  import CloudInitEditor from '$lib/components/wizard/CloudInitEditor.svelte';
  import {
    cloudInitFormDefaults,
    toQemuCloudInitFields,
    type CloudInitEditorForm,
    type SshKeyChoice
  } from '$lib/components/wizard/cloudinit-form';
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
  import {
    isVmPath,
    isClonePath,
    sourceKindForPath,
    vmStepValid,
    validateVmStep,
    buildQemuRequest,
    mapQemuCreateError
  } from '$lib/components/wizard/vm-wizard';
  import type { NodeResource } from '$lib/components/wizard/node-fit';
  import type { QuotaBudget } from '$lib/components/wizard/vm-wizard';
  import { wizardDraft } from '$lib/stores/wizardDraft.svelte';
  import { api } from '$lib/api/client';
  import type {
    CatalogEntry,
    NetworkConfigInput,
    ProvisioningJobAccepted
  } from '$lib/api/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // -- step model ----------------------------------------------------------

  /** The ordered step ids for the chosen path (just `['path']` until chosen). */
  const steps = $derived<WizardStepId[]>(stepsForPath(wizardDraft.path));

  /** The 1-based active step, clamped into the current path's step model. */
  const activeStep = $derived(Math.min(wizardDraft.step, steps.length));

  /** The id of the active step — drives the step-body switch below. */
  const activeStepId = $derived<WizardStepId>(steps[activeStep - 1] ?? 'path');

  /** Whether the chosen path is an LXC path. */
  const isLxcPath = $derived(
    wizardDraft.path === 'plain-lxc' || wizardDraft.path === 'community-script'
  );

  /** Whether the chosen path is one of the four VM paths (Plan 04-12). */
  const isVmWizardPath = $derived(wizardDraft.path !== null && isVmPath(wizardDraft.path));

  /** Whether the chosen VM path is a clone path (template-clone / vm-clone). */
  const isVmClone = $derived(wizardDraft.path !== null && isClonePath(wizardDraft.path));

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

  // -- cluster nodes + quota budget ---------------------------------------
  // The provisioning backend exposes no team-scoped node-free-resource API in
  // Phase 4 — node names are derived from the cluster inventory and carry
  // `null` free figures, so node-fit is advisory (every node stays pickable;
  // the backend's row-locked admission + PVE remain the real gate). The quota
  // budget is read from the Phase-2 `api.quotas` figures.

  /** The cluster's nodes (the node-fit input — free figures unknown → null). */
  let clusterNodes = $state<NodeResource[]>([]);
  /** The cluster's inventory VMs (the vm-clone source list). */
  let inventoryVms = $state<CloneSourceOption[]>([]);
  /** The team's quota budget for the targeted cluster (the quota-delta input). */
  let quotaBudget = $state<QuotaBudget | null>(null);

  $effect(() => {
    const cid = clusterId;
    if (cid === null) return;
    let cancelled = false;
    api.inventory
      .listForCluster({ clusterId: cid })
      .then((inv) => {
        if (cancelled) return;
        const nodeNames = [...new Set(inv.items.map((it) => it.node))].sort();
        clusterNodes = nodeNames.map((node) => ({
          node,
          freeCpu: null,
          freeRamMb: null
        }));
        inventoryVms = inv.items
          .filter((it) => it.type === 'qemu')
          .map((it) => ({
            vmid: it.vmid,
            name: it.name ?? `VM ${it.vmid}`,
            node: it.node
          }));
      })
      .catch(() => {
        if (!cancelled) {
          clusterNodes = [];
          inventoryVms = [];
        }
      });
    return () => {
      cancelled = true;
    };
  });

  /** Read the team's quota budget for the targeted cluster. */
  $effect(() => {
    const cid = clusterId;
    const tid = teamId;
    if (cid === null || tid === null) return;
    let cancelled = false;
    api.quotas
      .getMyQuotas()
      .then((q) => {
        if (cancelled) return;
        const team = q.teams.find((t) => t.team_id === tid);
        const row = team?.clusters.find((c) => c.cluster_id === cid);
        quotaBudget = row
          ? {
              usedCpu: row.usage.cpu_cores,
              limitCpu: row.limit.cpu_cores,
              usedRamGb: row.usage.ram_gb,
              limitRamGb: row.limit.ram_gb
            }
          : null;
      })
      .catch(() => {
        if (!cancelled) quotaBudget = null;
      });
    return () => {
      cancelled = true;
    };
  });

  // -- the LXC form bag ----------------------------------------------------

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

  /** The LXC Resources-step value bag. */
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

  // -- the VM form bag -----------------------------------------------------

  /** The VM source value bag (image / iso / clone-source / clone-mode). */
  let vmSource = $state<VmSourceValue>({
    image_id: (wizardDraft.formData.image_id as string) ?? '',
    iso_volid: (wizardDraft.formData.iso_volid as string) ?? '',
    source_vmid: (wizardDraft.formData.source_vmid as number) ?? 0,
    clone_mode:
      (wizardDraft.formData.clone_mode as 'linked' | 'full') ?? 'linked'
  });

  /** The VM Resources-step value bag (name / node / storage / sizing). */
  let vmResources = $state<VmResourcesValue>({
    name: (wizardDraft.formData.name as string) ?? '',
    node: (wizardDraft.formData.node as string) ?? '',
    storage: (wizardDraft.formData.storage as string) ?? '',
    cpu_cores: (wizardDraft.formData.cpu_cores as number) ?? 2,
    memory_mb: (wizardDraft.formData.memory_mb as number) ?? 2048,
    disk_gb: (wizardDraft.formData.disk_gb as number) ?? 32
  });

  /** The chosen NIC config (shared by the LXC + VM Network steps). */
  let networkConfig = $state<NetworkConfigInput | null>(
    (wizardDraft.formData.network as NetworkConfigInput | null) ?? null
  );

  /**
   * The Cloud-Init editor form (the four VM paths only). `cipassword` lives
   * here in-memory ONLY — `cloudInitFormDefaults()` seeds an empty form and it
   * is NEVER written to the wizardDraft sessionStorage store (T-04-13-02 — the
   * draft store's SECRET_KEYS already strips `cipassword`, so this bag is kept
   * out of `persistDraft` entirely).
   */
  let cloudInit = $state<CloudInitEditorForm>(cloudInitFormDefaults());

  /** True when the Cloud-Init step's verdict has a blocking hard error (D-12). */
  let cloudInitGate = $state(false);

  /**
   * The SSH-key catalogue for the Cloud-Init multi-select (D-11). No team-wide
   * SSH-keys-with-public-key read endpoint exists in the Phase-4 frontend
   * surface (`/me/ssh-keys` is per-user and its list response carries no
   * public-key body by design) — so the catalogue is empty for now and the
   * editor renders its "no SSH keys stored" state; the password field (the
   * required credential, D-11) works fully. When a team-scoped
   * keys-with-public-key endpoint lands, populating this is a clean follow-on
   * with no component change (the editor already takes a typed `SshKeyChoice[]`
   * prop). This is the established Plan 04-12 graceful-degradation pattern.
   */
  const sshKeyCatalogue = $state<SshKeyChoice[]>([]);

  /** The submit error (a 409/4xx surfaced inline — the wizard stays put). */
  let submitError = $state<string | null>(null);
  let submitting = $state(false);

  // -- per-step Next gates -------------------------------------------------
  // The VM Resources step / the Network picker signal their own block state.

  /** True when the VM Resources step must block `Next` (node-fit / quota). */
  let vmResourcesGate = $state(false);
  /** True when the VM/LXC Network step has no networks to offer. */
  let networkGate = $state(false);
  /** True when the LXC Resources node-fit has every node blocked. */
  let lxcNodeBlocked = $state(false);

  // -- per-step validation -------------------------------------------------

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

  /**
   * The current VM-step form bag (for `validateVmStep` + `buildQemuRequest`).
   * The cloud-init create fields (`ci_user` / `ci_password` /
   * `ssh_public_keys`) are folded in via `toQemuCloudInitFields` so the
   * `buildQemuRequest` builder carries them into the `createQemu` payload.
   */
  const vmFormBag = $derived({
    image_id: vmSource.image_id,
    iso_volid: vmSource.iso_volid,
    source_vmid: vmSource.source_vmid,
    clone_mode: vmSource.clone_mode,
    name: vmResources.name,
    node: vmResources.node,
    storage: vmResources.storage,
    cpu_cores: vmResources.cpu_cores,
    memory_mb: vmResources.memory_mb,
    disk_gb: vmResources.disk_gb,
    ...toQemuCloudInitFields(cloudInit, sshKeyCatalogue)
  });

  /** Field errors for the active step (empty unless the step has rules). */
  const stepErrors = $derived.by<Record<string, string>>(() => {
    if (!wizardDraft.path) return {};
    if (isLxcPath) return validateLxcStep(activeStepId, wizardDraft.path, lxcFormBag);
    if (isVmWizardPath) return validateVmStep(activeStepId, wizardDraft.path, vmFormBag);
    return {};
  });

  /**
   * The Next gate. Step 1 needs a chosen path; the Source/Resources steps gate
   * on field validation; the Resources/Network steps also gate on the
   * node-fit / quota / no-networks signals.
   */
  const nextDisabled = $derived.by(() => {
    if (activeStepId === 'path') return !canAdvanceFromPathStep(wizardDraft.path);
    if (!wizardDraft.path) return false;
    if (isLxcPath) {
      if (activeStepId === 'source' || activeStepId === 'resources') {
        if (!lxcStepValid(activeStepId, wizardDraft.path, lxcFormBag)) return true;
      }
      if (activeStepId === 'resources' && lxcNodeBlocked) return true;
      if (activeStepId === 'network' && networkGate) return true;
      return false;
    }
    if (isVmWizardPath) {
      if (activeStepId === 'source' || activeStepId === 'resources') {
        if (!vmStepValid(activeStepId, wizardDraft.path, vmFormBag)) return true;
      }
      if (activeStepId === 'resources' && vmResourcesGate) return true;
      if (activeStepId === 'network' && networkGate) return true;
      // The Cloud-Init step disables Next on any hard-error verdict (D-12).
      if (activeStepId === 'cloud-init' && cloudInitGate) return true;
      return false;
    }
    return false;
  });

  // -- orchestration -------------------------------------------------------

  /** Persist the form bag into the draft store (secrets stripped on write). */
  function persistDraft(): void {
    wizardDraft.patchFormData({
      // LXC fields
      ostemplate,
      script_slug: scriptSlug,
      script_options: scriptOptions,
      script_name: scriptName,
      hostname: resources.hostname,
      unprivileged: resources.unprivileged,
      nesting: resources.nesting,
      features: resources.features,
      // VM fields
      image_id: vmSource.image_id,
      iso_volid: vmSource.iso_volid,
      source_vmid: vmSource.source_vmid,
      clone_mode: vmSource.clone_mode,
      name: vmResources.name,
      // shared placement / sizing — written from whichever path is active
      node: isVmWizardPath ? vmResources.node : resources.node,
      storage: isVmWizardPath ? vmResources.storage : resources.storage,
      cpu_cores: isVmWizardPath ? vmResources.cpu_cores : resources.cpu_cores,
      memory_mb: isVmWizardPath ? vmResources.memory_mb : resources.memory_mb,
      disk_gb: isVmWizardPath ? vmResources.disk_gb : resources.disk_gb,
      // shared network
      network: networkConfig
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
        const body = buildLxcRequest(
          { ...lxcFormBag, ...resources, network: networkConfig },
          teamId
        );
        job = await api.provisioning.createLxc({ clusterId, body });
        resourceName = body.hostname;
      } else if (wizardDraft.path === 'community-script') {
        const body = buildCommunityScriptRequest(
          {
            ...lxcFormBag,
            ...resources,
            script_options: scriptOptions,
            network: networkConfig
          },
          teamId
        );
        job = await api.provisioning.createCommunityScript({ clusterId, body });
        resourceName = scriptName || body.hostname;
      } else {
        // One of the four VM paths.
        const body = buildQemuRequest(
          { ...vmFormBag, network: networkConfig },
          teamId,
          wizardDraft.path
        );
        job = await api.provisioning.createQemu({ clusterId, body });
        resourceName = body.name;
      }
      await completeWithJob(clusterId, job, resourceName);
    } catch (err) {
      // A 409 (over-quota) / 4xx surfaces inline — the wizard does NOT
      // navigate away (T-04-11-03 / T-04-12-02).
      submitError = isVmWizardPath ? mapQemuCreateError(err) : mapLxcCreateError(err);
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

  // -- Review sections -----------------------------------------------------

  /** The 1-based step index of a step id in the active path's model. */
  function stepIndex(id: WizardStepId): number {
    const i = steps.indexOf(id);
    return i >= 0 ? i + 1 : 1;
  }

  /** A "—" placeholder for an empty value. */
  function orDash(v: string): string {
    return v.trim() || '—';
  }

  /** The Review sections for the active path. */
  const reviewSections = $derived.by<ReviewSection[]>(() => {
    if (!wizardDraft.path) return [];
    const sections: ReviewSection[] = [];

    if (isLxcPath) {
      sections.push({
        title: 'Source',
        editStep: stepIndex('source'),
        rows:
          wizardDraft.path === 'plain-lxc'
            ? [{ label: 'Template', value: orDash(ostemplate) }]
            : [{ label: 'Script', value: scriptName || scriptSlug || '—' }]
      });
      sections.push({
        title: 'Resources',
        editStep: stepIndex('resources'),
        rows: [
          { label: 'Hostname', value: orDash(resources.hostname) },
          { label: 'Node', value: orDash(resources.node) },
          { label: 'Storage', value: orDash(resources.storage) },
          {
            label: 'Size',
            value: `${resources.cpu_cores} vCPU · ${resources.memory_mb} MB RAM · ${resources.disk_gb} GB disk`
          },
          {
            label: 'Options',
            value:
              [
                resources.unprivileged ? 'unprivileged' : 'privileged',
                resources.nesting ? 'nesting' : null,
                ...resources.features
              ]
                .filter(Boolean)
                .join(', ') || '—'
          }
        ]
      });
    } else {
      sections.push({
        title: 'Source',
        editStep: stepIndex('source'),
        rows: vmSourceReviewRows()
      });
      const resourceRows = [
        { label: 'Name', value: orDash(vmResources.name) },
        { label: 'Node', value: orDash(vmResources.node) }
      ];
      if (!isVmClone) {
        resourceRows.push(
          { label: 'Storage', value: orDash(vmResources.storage) },
          {
            label: 'Size',
            value: `${vmResources.cpu_cores} vCPU · ${vmResources.memory_mb} MB RAM · ${vmResources.disk_gb} GB disk`
          }
        );
      }
      sections.push({
        title: 'Resources',
        editStep: stepIndex('resources'),
        rows: resourceRows
      });
    }

    sections.push({
      title: 'Network',
      editStep: stepIndex('network'),
      rows: [
        {
          label: 'Network',
          value: networkConfig
            ? `${networkConfig.id} (${networkConfig.ip_mode ?? 'dhcp'})`
            : 'Cluster default'
        }
      ]
    });

    return sections;
  });

  /** The Source-section rows for the active VM path. */
  function vmSourceReviewRows(): { label: string; value: string }[] {
    switch (wizardDraft.path) {
      case 'cloud-image':
        return [{ label: 'Cloud image', value: orDash(vmSource.image_id) }];
      case 'blank-iso':
        return [{ label: 'ISO', value: orDash(vmSource.iso_volid) }];
      case 'template-clone':
      case 'vm-clone':
        return [
          {
            label: wizardDraft.path === 'template-clone' ? 'Template' : 'Source VM',
            value: vmSource.source_vmid > 0 ? `VMID ${vmSource.source_vmid}` : '—'
          },
          { label: 'Clone mode', value: vmSource.clone_mode }
        ];
      default:
        return [];
    }
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
          <!-- The two LXC paths — step bodies owned by Plan 04-11; the      -->
          <!-- Resources step is retro-enriched + the Network step + Review -->
          <!-- supplied by Plan 04-12.                                       -->
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
            <!--
              Plan 04-12 retro-enrichment: the shared NodeSelect (node-fit) +
              QuotaDeltaLine render alongside LxcResourcesStep. LxcResourcesStep
              is Plan 04-11's file and exposes comment-only mount markers (not
              prop slots), so the enrichment is composed here in the route — no
              cross-wave edit to that file.
            -->
            <div class="flex flex-col gap-5">
              <NodeSelect
                nodes={clusterNodes}
                value={resources.node}
                requestedCpu={resources.cpu_cores}
                requestedRamMb={resources.memory_mb}
                onChange={(node) => {
                  resources = { ...resources, node };
                  persistDraft();
                }}
                onBlockedChange={(b) => (lxcNodeBlocked = b)}
              />
              <LxcResourcesStep
                nodes={clusterNodes.map((n) => n.node)}
                {teams}
                {teamId}
                value={resources}
                errors={stepErrors}
                onChange={(nextValue) => {
                  resources = nextValue;
                  persistDraft();
                }}
                onTeamChange={(id) => (teamId = id)}
              />
              <QuotaDeltaLine
                requestedCpu={resources.cpu_cores}
                requestedRamMb={resources.memory_mb}
                budget={quotaBudget}
              />
            </div>
          {:else if activeStepId === 'network'}
            {#if clusterId !== null}
              <NetworkPicker
                {clusterId}
                value={networkConfig}
                onChange={(net) => {
                  networkConfig = net;
                  persistDraft();
                }}
                onBlockedChange={(b) => (networkGate = b)}
              />
            {:else}
              <EmptyState
                icon={Boxes}
                heading="No cluster available"
                body="The network picker needs a cluster."
              />
            {/if}
          {:else if activeStepId === 'review'}
            <ReviewStep
              sections={reviewSections}
              requestedCpu={resources.cpu_cores}
              requestedRamMb={resources.memory_mb}
              {quotaBudget}
              {submitError}
              onEdit={goToStep}
            />
          {/if}
        {:else if isVmWizardPath && wizardDraft.path}
          <!-- ============================================================ -->
          <!-- The four VM paths — owned by Plan 04-12.                       -->
          <!-- ============================================================ -->
          {#if activeStepId === 'source'}
            {#if clusterId !== null && teamId !== null}
              <VmSourceStep
                sourceKind={sourceKindForPath(wizardDraft.path)}
                {clusterId}
                {teamId}
                node={vmResources.node}
                sourceVms={inventoryVms}
                value={vmSource}
                errors={stepErrors}
                onChange={(nextValue) => {
                  vmSource = nextValue;
                  persistDraft();
                }}
              />
            {:else}
              <EmptyState
                icon={Boxes}
                heading="No cluster available"
                body="The VM wizard needs a cluster. Register one first."
              />
            {/if}
          {:else if activeStepId === 'resources'}
            <VmResourcesStep
              isClone={isVmClone}
              nodes={clusterNodes}
              {quotaBudget}
              {teams}
              {teamId}
              value={vmResources}
              errors={stepErrors}
              onChange={(nextValue) => {
                vmResources = nextValue;
                persistDraft();
              }}
              onTeamChange={(id) => (teamId = id)}
              onGateChange={(b) => (vmResourcesGate = b)}
            />
          {:else if activeStepId === 'network'}
            {#if clusterId !== null}
              <NetworkPicker
                {clusterId}
                value={networkConfig}
                onChange={(net) => {
                  networkConfig = net;
                  persistDraft();
                }}
                onBlockedChange={(b) => (networkGate = b)}
              />
            {:else}
              <EmptyState
                icon={Boxes}
                heading="No cluster available"
                body="The network picker needs a cluster."
              />
            {/if}
          {:else if activeStepId === 'cloud-init'}
            <!--
              The Cloud-Init two-pane editor (Plan 04-13) — present on all four
              VM paths (D-13). Form left, the live read-only YAML pane right;
              hard errors disable Next, soft warnings advise (D-12). The form's
              `ci_user` / `ci_password` / `ssh_public_keys` flow into the
              `vmFormBag` via `toQemuCloudInitFields` → `buildQemuRequest`.
            -->
            {#if clusterId !== null}
              <CloudInitEditor
                {clusterId}
                sourceKind={sourceKindForPath(wizardDraft.path)}
                sshKeys={sshKeyCatalogue}
                value={cloudInit}
                onChange={(next) => (cloudInit = next)}
                onValidityChange={(blocked) => (cloudInitGate = blocked)}
              />
            {:else}
              <EmptyState
                icon={Boxes}
                heading="No cluster available"
                body="The Cloud-Init editor needs a cluster. Register one first."
              />
            {/if}
          {:else if activeStepId === 'review'}
            <ReviewStep
              sections={reviewSections}
              requestedCpu={isVmClone ? 0 : vmResources.cpu_cores}
              requestedRamMb={isVmClone ? 0 : vmResources.memory_mb}
              {quotaBudget}
              {submitError}
              onEdit={goToStep}
            />
          {/if}
        {:else}
          <!-- No path chosen — should not happen past Step 1. -->
          <div class="flex flex-col gap-2">
            <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
              {WIZARD_STEP_LABEL[activeStepId]}
            </h2>
            <p class="text-muted-foreground text-[14px]">
              Use Back to return to the path picker.
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
