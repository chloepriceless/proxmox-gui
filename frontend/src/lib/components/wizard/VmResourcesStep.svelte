<!--
  VmResourcesStep — the VM "Resources" step (Plan 04-12, VM-09).

  Contract: 04-UI-SPEC §"Resources step contract" + §"Node-fit selector".
    - A VM name `Input`.
    - The shared `NodeSelect` (node-fit — disables unfit nodes with the reason).
    - A storage `Select` (content-type filtered — Pitfall 16) + CPU-cores /
      Memory-GB / Disk-GB inputs.
    - The shared `QuotaDeltaLine` — the live "+N vCPU, +N GB RAM" delta.
    - Every PVE-specific field carries a `HelpTooltip` (D-25).
    - `Next` is disabled when `NodeSelect` signals all-blocked OR `QuotaDeltaLine`
      signals over-quota — surfaced up via `onGateChange`.

  For the clone paths (template-clone / vm-clone) the clone copies the source's
  disks + sizing, so only the name + node + (optional) storage are shown — the
  CPU/Memory/Disk inputs are hidden.
-->
<script lang="ts">
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import HelpTooltip from '$lib/components/shared/HelpTooltip.svelte';
  import NodeSelect from './NodeSelect.svelte';
  import QuotaDeltaLine from './QuotaDeltaLine.svelte';
  import type { NodeResource } from './node-fit';
  import type { QuotaBudget } from './vm-wizard';

  /** A team the VM can be owned by — the create body's `team_id`. */
  export type VmOwnerTeam = { id: number; name: string };

  /** The Resources-step value bag this step owns. */
  export type VmResourcesValue = {
    name: string;
    node: string;
    storage: string;
    cpu_cores: number;
    memory_mb: number;
    disk_gb: number;
  };

  type Props = {
    /** True for a clone path — the sizing inputs are hidden (the clone copies them). */
    isClone?: boolean;
    /** The cluster's nodes with live free CPU/RAM figures (the node-fit input). */
    nodes?: NodeResource[];
    /** The cluster's VM-image-capable storages. Empty → a free-text fallback. */
    storages?: string[];
    /** The team's quota budget for the targeted cluster (the quota-delta input). */
    quotaBudget?: QuotaBudget | null;
    /** The teams the user may provision into — a team `Select` shows when >1. */
    teams?: VmOwnerTeam[];
    /** The chosen owning team id (the create body's `team_id`). */
    teamId?: number | null;
    /** The current Resources-step values. */
    value: VmResourcesValue;
    /** Per-field validation errors (`field → message`) — surfaced inline. */
    errors?: Record<string, string>;
    /** Fired on any field change with the full updated value bag. */
    onChange?: (next: VmResourcesValue) => void;
    /** Fired when the owning team changes. */
    onTeamChange?: (teamId: number) => void;
    /**
     * Fired with the step's Next gate — `true` when the step must block `Next`
     * (node-fit all-blocked or quota exceeded).
     */
    onGateChange?: (blocked: boolean) => void;
  };

  let {
    isClone = false,
    nodes = [],
    storages = [],
    quotaBudget = null,
    teams = [],
    teamId = null,
    value,
    errors = {},
    onChange,
    onTeamChange,
    onGateChange
  }: Props = $props();

  /** The label for the team Select trigger. */
  const teamLabel = $derived(
    teams.find((t) => t.id === teamId)?.name ?? 'Select a team'
  );

  /** Emit a patched value bag. */
  function patch(part: Partial<VmResourcesValue>): void {
    onChange?.({ ...value, ...part });
  }

  /** Coerce a number input to an integer (NaN → 0 so the field stays bound). */
  function toInt(raw: string): number {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }

  // -- Next gate: node-fit all-blocked OR over-quota ----------------------

  /** True when no node can fit the request. */
  let nodeBlocked = $state(false);
  /** True when the request exceeds the team's quota. */
  let overQuota = $state(false);

  /** Surface the combined Next gate up to the route. */
  $effect(() => {
    onGateChange?.(nodeBlocked || overQuota);
  });
</script>

<section class="flex flex-col gap-5">
  <header class="flex flex-col gap-1">
    <h2 class="text-[18px] font-semibold leading-tight tracking-tight">Resources</h2>
    <p class="text-muted-foreground text-[14px]">
      Set the host node, storage, and size for this resource.
    </p>
  </header>

  <!-- Owning team — shown only when the user belongs to more than one team. -->
  {#if teams.length > 1}
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1.5">
        <Label for="vm-team">Owning team</Label>
        <HelpTooltip
          label="Owning team"
          text="The team this VM counts against for quota and visibility. Only members of the team can see and manage it."
        />
      </div>
      <Select.Root
        type="single"
        value={teamId != null ? String(teamId) : undefined}
        onValueChange={(v) => v && onTeamChange?.(Number(v))}
      >
        <Select.Trigger id="vm-team" class="w-full">{teamLabel}</Select.Trigger>
        <Select.Content>
          {#each teams as team (team.id)}
            <Select.Item value={String(team.id)}>{team.name}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
  {/if}

  <!-- VM name. -->
  <div class="flex flex-col gap-1.5">
    <Label for="vm-name">Name</Label>
    <Input
      id="vm-name"
      placeholder="web01"
      value={value.name}
      oninput={(e) => patch({ name: e.currentTarget.value })}
    />
    {#if errors.name}
      <p class="text-destructive text-[13px]">{errors.name}</p>
    {/if}
  </div>

  <!-- Placement: the shared node-fit selector + storage. -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <NodeSelect
      {nodes}
      value={value.node}
      requestedCpu={value.cpu_cores}
      requestedRamMb={value.memory_mb}
      error={errors.node}
      onChange={(node) => patch({ node })}
      onBlockedChange={(b) => (nodeBlocked = b)}
    />

    {#if !isClone}
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <Label for="vm-storage">Storage</Label>
          <HelpTooltip
            label="Storage"
            text="The storage pool the VM's disk is created on. Only storages that can hold a VM disk image are listed."
          />
        </div>
        {#if storages.length > 0}
          <Select.Root
            type="single"
            value={value.storage || undefined}
            onValueChange={(v) => v && patch({ storage: v })}
          >
            <Select.Trigger id="vm-storage" class="w-full">
              {value.storage || 'Select storage'}
            </Select.Trigger>
            <Select.Content>
              {#each storages as storage (storage)}
                <Select.Item value={storage}>{storage}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {:else}
          <Input
            id="vm-storage"
            placeholder="local-lvm"
            value={value.storage}
            oninput={(e) => patch({ storage: e.currentTarget.value })}
          />
        {/if}
        {#if errors.storage}
          <p class="text-destructive text-[13px]">{errors.storage}</p>
        {/if}
      </div>
    {/if}
  </div>

  {#if !isClone}
    <!-- Sizing — CPU / Memory / Disk. -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <Label for="vm-cpu">CPU cores</Label>
          <HelpTooltip
            label="CPU cores"
            text="The number of virtual CPU cores assigned to the VM."
          />
        </div>
        <Input
          id="vm-cpu"
          type="number"
          min="1"
          value={value.cpu_cores}
          oninput={(e) => patch({ cpu_cores: toInt(e.currentTarget.value) })}
        />
        {#if errors.cpu_cores}
          <p class="text-destructive text-[13px]">{errors.cpu_cores}</p>
        {/if}
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <Label for="vm-memory">Memory (MB)</Label>
          <HelpTooltip
            label="Memory"
            text="The RAM assigned to the VM, in megabytes."
          />
        </div>
        <Input
          id="vm-memory"
          type="number"
          min="1"
          value={value.memory_mb}
          oninput={(e) => patch({ memory_mb: toInt(e.currentTarget.value) })}
        />
        {#if errors.memory_mb}
          <p class="text-destructive text-[13px]">{errors.memory_mb}</p>
        {/if}
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <Label for="vm-disk">Disk (GB)</Label>
          <HelpTooltip
            label="Disk"
            text="The size of the VM's primary disk, in gigabytes."
          />
        </div>
        <Input
          id="vm-disk"
          type="number"
          min="1"
          value={value.disk_gb}
          oninput={(e) => patch({ disk_gb: toInt(e.currentTarget.value) })}
        />
        {#if errors.disk_gb}
          <p class="text-destructive text-[13px]">{errors.disk_gb}</p>
        {/if}
      </div>
    </div>

    <!-- The live quota-delta line (D-08). -->
    <QuotaDeltaLine
      requestedCpu={value.cpu_cores}
      requestedRamMb={value.memory_mb}
      budget={quotaBudget}
      onOverQuotaChange={(o) => (overQuota = o)}
    />
  {:else}
    <p class="text-muted-foreground text-[13px]">
      A clone copies the source's CPU, memory, and disks. You can resize the new
      VM after it is created.
    </p>
  {/if}
</section>
