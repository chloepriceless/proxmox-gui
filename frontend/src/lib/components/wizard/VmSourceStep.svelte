<!--
  VmSourceStep — the per-path "Source" step for the four VM paths (Plan 04-12).

  Contract: 04-UI-SPEC §"Step model" + §Copywriting Contract.
    - cloud-image (VM-01, D-15): a cloud-image picker (`api.iso.listCloudImages`).
        Heading "Pick a cloud image".
    - template-clone (VM-02): a `Select` of the cluster's PVE templates + a
        linked/full `clone_mode` radio. Heading "Pick a template to clone".
    - blank-iso (VM-03): the full `IsoLibrary` browser (Plan 04-13) — the
        on-storage ISO table + command search, the curated ISO list, and the
        free-URL download. Heading "Pick an installation ISO".
    - vm-clone (VM-04): a `Select` of the user's existing VMs + the linked/full
        `clone_mode` radio. Heading "Pick a VM to clone".

  The component switches its rendered UI on the active path's `source_kind`.
  The template / VM-clone source lists have no dedicated wizard API in this
  phase, so they are passed in as props with a free-text fallback (the
  established Plan 04-11 graceful-degradation pattern) — every value is
  re-validated server-side on create.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import * as Select from '$lib/components/ui/select';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import HelpTooltip from '$lib/components/shared/HelpTooltip.svelte';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import IsoLibrary from './IsoLibrary.svelte';
  import Disc from '@lucide/svelte/icons/disc';
  import { api } from '$lib/api/client';
  import type { CloudImage } from '$lib/api/types';
  import type { VmSourceKind } from './vm-wizard';

  /** One pickable clone source (a PVE template or an existing VM). */
  export type CloneSourceOption = {
    /** The source VMID. */
    vmid: number;
    /** A human label — the resource name. */
    name: string;
    /** The node it lives on (informational). */
    node?: string;
  };

  /** The VM-source value bag this step owns. */
  export type VmSourceValue = {
    /** cloud-image — the chosen cloud-image id. */
    image_id: string;
    /** blank-iso — the chosen ISO volume id. */
    iso_volid: string;
    /** template-clone / vm-clone — the chosen source VMID (0 = none). */
    source_vmid: number;
    /** template-clone / vm-clone — the clone mode. */
    clone_mode: 'linked' | 'full';
  };

  type Props = {
    /** The active VM path's source kind — switches the rendered UI. */
    sourceKind: VmSourceKind;
    /** The cluster the wizard provisions into. */
    clusterId: number;
    /** The owning team id — `listIsos` is team-scoped. */
    teamId: number;
    /** The node ISOs are enumerated on (`listIsos` needs it). */
    node?: string;
    /** The cluster's PVE templates (template-clone). Empty → free-text fallback. */
    templates?: CloneSourceOption[];
    /** The user's existing VMs (vm-clone). Empty → free-text fallback. */
    sourceVms?: CloneSourceOption[];
    /** The current source value bag. */
    value: VmSourceValue;
    /** Per-field validation errors — surfaced inline. */
    errors?: Record<string, string>;
    /** Fired on any field change with the full updated value bag. */
    onChange?: (next: VmSourceValue) => void;
  };

  let {
    sourceKind,
    clusterId,
    teamId,
    node = '',
    templates = [],
    sourceVms = [],
    value,
    errors = {},
    onChange
  }: Props = $props();

  /** Emit a patched value bag. */
  function patch(part: Partial<VmSourceValue>): void {
    onChange?.({ ...value, ...part });
  }

  // -- cloud-image (VM-01) -------------------------------------------------

  /** The curated cloud-image list — fetched for the cloud-image path. */
  let cloudImages = $state<CloudImage[]>([]);
  /** True while the cloud-image fetch is in flight. */
  let imagesLoading = $state(false);
  /** A cloud-image load error, or `null`. */
  let imagesError = $state<string | null>(null);

  // -- blank-iso (VM-03) ---------------------------------------------------
  // The on-storage ISO list, the curated list, and the free-URL download are
  // owned by the `IsoLibrary` browser (Plan 04-13) — it fetches `listIsos`
  // itself. This step passes the curated cloud-image list (also fetched here)
  // through as the IsoLibrary's curated set.

  /**
   * Fetch the source list the active path needs. The cloud-image path needs
   * the curated image list; the blank-iso path's `IsoLibrary` also consumes
   * the curated list (the same curated download pattern serves both — D-15).
   */
  $effect(() => {
    const kind = sourceKind;
    if (kind !== 'cloud-image' && kind !== 'blank-iso') return;
    let cancelled = false;
    imagesLoading = true;
    api.iso
      .listCloudImages({ clusterId })
      .then((list) => {
        if (!cancelled) {
          cloudImages = list;
          imagesError = null;
        }
      })
      .catch(() => {
        if (!cancelled) imagesError = "Couldn't load cloud images.";
      })
      .finally(() => {
        if (!cancelled) imagesLoading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  /** The clone-source list for the active clone path. */
  const cloneSources = $derived(
    sourceKind === 'template-clone' ? templates : sourceVms
  );

  /** The label for the clone-source Select trigger. */
  const cloneSourceLabel = $derived(
    cloneSources.find((s) => s.vmid === value.source_vmid)?.name ??
      (value.source_vmid > 0
        ? `VMID ${value.source_vmid}`
        : sourceKind === 'template-clone'
          ? 'Select a template'
          : 'Select a VM')
  );

  /** A one-time free-text seed for the clone-source VMID fallback input. */
  const initialVmid = untrack(() => value.source_vmid);
  let vmidText = $state<string>(initialVmid > 0 ? String(initialVmid) : '');
</script>

<section class="flex flex-col gap-5">
  {#if sourceKind === 'cloud-image'}
    <!-- ==================== cloud-image (VM-01, D-15) ==================== -->
    <header class="flex flex-col gap-1">
      <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
        Pick a cloud image
      </h2>
      <p class="text-muted-foreground text-[14px]">
        Choose an OS image. It downloads to storage if it isn't already there.
      </p>
    </header>

    {#if imagesLoading}
      <p class="text-muted-foreground text-[13px]">Loading cloud images…</p>
    {:else if imagesError}
      <div class="bg-destructive/10 rounded-md p-3">
        <p class="text-destructive text-[13px]">{imagesError}</p>
      </div>
    {:else if cloudImages.length === 0}
      <EmptyState
        icon={Disc}
        heading="No cloud images available"
        body="No curated cloud images are configured for this cluster."
      />
    {:else}
      <div class="flex flex-col gap-2">
        <RadioGroup.Root
          value={value.image_id}
          onValueChange={(v) => patch({ image_id: v })}
        >
          {#each cloudImages as image (image.id)}
            <label
              class="flex items-center gap-3 rounded-md border px-3 py-2.5 {value.image_id ===
              image.id
                ? 'border-primary bg-accent/40'
                : ''}"
            >
              <RadioGroup.Item value={image.id} />
              <span class="flex flex-1 flex-col gap-0.5">
                <span class="text-foreground text-[14px] font-medium">{image.name}</span>
                <span class="text-muted-foreground text-[13px]">
                  {image.os_family}
                  {image.version}
                </span>
              </span>
            </label>
          {/each}
        </RadioGroup.Root>
        {#if errors.image_id}
          <p class="text-destructive text-[13px]">{errors.image_id}</p>
        {/if}
      </div>
    {/if}
  {:else if sourceKind === 'blank-iso'}
    <!-- ====================== blank-iso (VM-03) ========================= -->
    <!--
      The full ISO library browser (Plan 04-13) — the on-storage ISO table
      with a command search, the curated ISO list, and the free-URL download
      (D-16/D-17). It fetches `listIsos` itself; the curated cloud-image list
      is passed through. Selecting an on-storage ISO patches `iso_volid`.
    -->
    <header class="flex flex-col gap-1">
      <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
        Pick an installation ISO
      </h2>
      <p class="text-muted-foreground text-[14px]">
        Browse ISOs on storage, pick a curated one, or download one by URL.
      </p>
    </header>

    <IsoLibrary
      {clusterId}
      {teamId}
      {node}
      curated={cloudImages}
      value={value.iso_volid}
      error={errors.iso_volid}
      onSelect={(volid) => patch({ iso_volid: volid })}
    />
  {:else}
    <!-- ============= template-clone (VM-02) / vm-clone (VM-04) ========== -->
    <header class="flex flex-col gap-1">
      <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
        {sourceKind === 'template-clone'
          ? 'Pick a template to clone'
          : 'Pick a VM to clone'}
      </h2>
      <p class="text-muted-foreground text-[14px]">
        {sourceKind === 'template-clone'
          ? 'Choose an existing Proxmox template.'
          : 'Choose an existing VM to copy.'}
      </p>
    </header>

    <div class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1.5">
        <Label for="vm-clone-source">
          {sourceKind === 'template-clone' ? 'Template' : 'Source VM'}
        </Label>
        <HelpTooltip
          label={sourceKind === 'template-clone' ? 'Template' : 'Source VM'}
          text="The clone copies this source's disks and configuration. Only resources your team can see are listed."
        />
      </div>
      {#if cloneSources.length > 0}
        <Select.Root
          type="single"
          value={value.source_vmid > 0 ? String(value.source_vmid) : undefined}
          onValueChange={(v) => v && patch({ source_vmid: Number(v) })}
        >
          <Select.Trigger id="vm-clone-source" class="w-full">
            {cloneSourceLabel}
          </Select.Trigger>
          <Select.Content>
            {#each cloneSources as src (src.vmid)}
              <Select.Item value={String(src.vmid)}>
                {src.name} (VMID {src.vmid}{src.node ? ` · ${src.node}` : ''})
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {:else}
        <Input
          id="vm-clone-source"
          type="number"
          min="1"
          placeholder="9000"
          value={vmidText}
          oninput={(e) => {
            vmidText = e.currentTarget.value;
            patch({ source_vmid: Number(e.currentTarget.value) || 0 });
          }}
        />
        <p class="text-muted-foreground text-[13px]">
          Enter the {sourceKind === 'template-clone' ? 'template' : 'VM'}'s VMID.
        </p>
      {/if}
      {#if errors.source_vmid}
        <p class="text-destructive text-[13px]">{errors.source_vmid}</p>
      {/if}
    </div>

    <!-- linked / full clone mode. -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1.5">
        <Label>Clone mode</Label>
        <HelpTooltip
          label="Clone mode"
          text="A linked clone shares the source's base disk (fast, space-efficient, depends on the source); a full clone is an independent copy."
        />
      </div>
      <RadioGroup.Root
        value={value.clone_mode}
        onValueChange={(v) => patch({ clone_mode: v === 'full' ? 'full' : 'linked' })}
      >
        <label class="flex items-center gap-3">
          <RadioGroup.Item value="linked" />
          <span class="text-[14px]">Linked clone — fast, shares the source disk</span>
        </label>
        <label class="flex items-center gap-3">
          <RadioGroup.Item value="full" />
          <span class="text-[14px]">Full clone — an independent copy</span>
        </label>
      </RadioGroup.Root>
    </div>
  {/if}
</section>
