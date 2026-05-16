<!--
  LxcResourcesStep — the LXC "Resources" step (Plan 04-11).

  Contract: 04-UI-SPEC §"Resources step contract" (LXC-06, LXC-07).
    - A target-node `Select`, a storage `Select` (content-type filtered —
      Pitfall 16), and CPU-cores / Memory-GB / Disk-GB number inputs.
    - The LXC-07 toggles:
        * "Unprivileged container" — a `Switch`, default ON.
        * "Nesting" — a `Switch`, default OFF.
        * "Features" — a `checkbox` group (keyctl, fuse).
    - Every PVE-specific field (node, storage, unprivileged, nesting,
      features) carries a `HelpTooltip` (D-25).

  Node-fit + quota-delta enrichment: the live quota-delta line and the
  node-fit (per-node free-resource) selector are owned by Plan 04-12's shared
  `NodeSelect` + `QuotaDeltaLine` building blocks. THIS plan ships the plain
  node `Select` + a clearly-marked mount slot (see the marked region below);
  Plan 04-12 (wave 6) delivers the enrichment. This file stays in Plan 04-11's
  files_modified only — 04-12 does NOT re-edit it (no cross-wave file overlap).

  Data: the node + storage lists have no dedicated wizard API in this phase,
  so they are passed in as props. An empty list falls back to a free-text
  `Input` so the step is never hard-blocked — every value is re-validated
  server-side on create.
-->
<script lang="ts">
  import * as Select from '$lib/components/ui/select';
  import { Switch } from '$lib/components/ui/switch';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import HelpTooltip from '$lib/components/shared/HelpTooltip.svelte';
  import { LXC_FEATURE_FLAGS, type LxcFeatureFlag } from './lxc-wizard';

  /** The Resources-step form values this step owns. */
  export type LxcResourcesValue = {
    node: string;
    storage: string;
    hostname: string;
    cpu_cores: number;
    memory_mb: number;
    disk_gb: number;
    unprivileged: boolean;
    nesting: boolean;
    features: LxcFeatureFlag[];
  };

  /** A team the container can be owned by — the create body's `team_id`. */
  export type LxcOwnerTeam = { id: number; name: string };

  type Props = {
    /** The cluster's nodes. Empty → a free-text fallback. */
    nodes?: string[];
    /** The cluster's `content=rootdir`-capable storages. Empty → a free-text fallback. */
    storages?: string[];
    /**
     * The teams the user may provision into. A team `Select` is shown only
     * when there is more than one — a single team needs no picker.
     */
    teams?: LxcOwnerTeam[];
    /** The chosen owning team id (the create body's `team_id`). */
    teamId?: number | null;
    /** The current Resources-step values. */
    value: LxcResourcesValue;
    /** Per-field validation errors (`field → message`) — surfaced inline. */
    errors?: Record<string, string>;
    /** Fired on any field change with the full updated value bag. */
    onChange?: (next: LxcResourcesValue) => void;
    /** Fired when the owning team changes. */
    onTeamChange?: (teamId: number) => void;
  };

  let {
    nodes = [],
    storages = [],
    teams = [],
    teamId = null,
    value,
    errors = {},
    onChange,
    onTeamChange
  }: Props = $props();

  /** The label for the team Select trigger. */
  const teamLabel = $derived(
    teams.find((t) => t.id === teamId)?.name ?? 'Select a team'
  );

  /** Emit a patched value bag. */
  function patch(part: Partial<LxcResourcesValue>): void {
    onChange?.({ ...value, ...part });
  }

  /** Toggle a feature flag in/out of the `features` array (LXC-07). */
  function toggleFeature(flag: LxcFeatureFlag, on: boolean): void {
    const set = new Set(value.features);
    if (on) set.add(flag);
    else set.delete(flag);
    patch({ features: [...set] });
  }

  /** Coerce a number input to an integer (NaN → 0 so the field stays bound). */
  function toInt(raw: string): number {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
</script>

<section class="flex flex-col gap-5">
  <header class="flex flex-col gap-1">
    <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
      Size your container
    </h2>
    <p class="text-muted-foreground text-[14px]">
      Choose where the container runs and how much CPU, memory, and disk it gets.
    </p>
  </header>

  <!-- Owning team — shown only when the user belongs to more than one team. -->
  {#if teams.length > 1}
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1.5">
        <Label for="lxc-team">Owning team</Label>
        <HelpTooltip
          label="Owning team"
          text="The team this container counts against for quota and visibility. Only members of the team can see and manage it."
        />
      </div>
      <Select.Root
        type="single"
        value={teamId != null ? String(teamId) : undefined}
        onValueChange={(v) => v && onTeamChange?.(Number(v))}
      >
        <Select.Trigger id="lxc-team" class="w-full">{teamLabel}</Select.Trigger>
        <Select.Content>
          {#each teams as team (team.id)}
            <Select.Item value={String(team.id)}>{team.name}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
  {/if}

  <!-- Placement: node + storage. -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <!-- ================================================================== -->
    <!-- Node-fit mount slot (Plan 04-12):                                   -->
    <!-- Plan 04-12 ships the shared `NodeSelect` (per-node free-resource     -->
    <!-- fit) + `QuotaDeltaLine`. Until wave 6 lands those, this plain node   -->
    <!-- `Select` is the node picker. 04-12 wires the enrichment WITHOUT      -->
    <!-- re-editing this file (no cross-wave file overlap).                  -->
    <!-- ================================================================== -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1.5">
        <Label for="lxc-node">Target node</Label>
        <HelpTooltip
          label="Target node"
          text="The Proxmox host the container runs on. Each node has its own free CPU, memory, and storage."
        />
      </div>
      {#if nodes.length > 0}
        <Select.Root
          type="single"
          value={value.node || undefined}
          onValueChange={(v) => patch({ node: v ?? '' })}
        >
          <Select.Trigger id="lxc-node" class="w-full">
            {value.node || 'Select a node'}
          </Select.Trigger>
          <Select.Content>
            {#each nodes as node (node)}
              <Select.Item value={node}>{node}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {:else}
        <Input
          id="lxc-node"
          placeholder="pve1"
          value={value.node}
          oninput={(e) => patch({ node: e.currentTarget.value })}
        />
      {/if}
      {#if errors.node}
        <p class="text-[13px] text-destructive">{errors.node}</p>
      {/if}
    </div>

    <div class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1.5">
        <Label for="lxc-storage">Storage</Label>
        <HelpTooltip
          label="Storage"
          text="The storage pool the container's root disk is created on. Only storages that can hold a container root filesystem are listed."
        />
      </div>
      {#if storages.length > 0}
        <Select.Root
          type="single"
          value={value.storage || undefined}
          onValueChange={(v) => patch({ storage: v ?? '' })}
        >
          <Select.Trigger id="lxc-storage" class="w-full">
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
          id="lxc-storage"
          placeholder="local-lvm"
          value={value.storage}
          oninput={(e) => patch({ storage: e.currentTarget.value })}
        />
      {/if}
      {#if errors.storage}
        <p class="text-[13px] text-destructive">{errors.storage}</p>
      {/if}
    </div>
  </div>

  <!-- Hostname. -->
  <div class="flex flex-col gap-1.5">
    <Label for="lxc-hostname">Hostname</Label>
    <Input
      id="lxc-hostname"
      placeholder="web01"
      value={value.hostname}
      oninput={(e) => patch({ hostname: e.currentTarget.value })}
    />
    {#if errors.hostname}
      <p class="text-[13px] text-destructive">{errors.hostname}</p>
    {/if}
  </div>

  <!-- Sizing — CPU / Memory / Disk. -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <div class="flex flex-col gap-1.5">
      <Label for="lxc-cpu">CPU cores</Label>
      <Input
        id="lxc-cpu"
        type="number"
        min="1"
        value={value.cpu_cores}
        oninput={(e) => patch({ cpu_cores: toInt(e.currentTarget.value) })}
      />
      {#if errors.cpu_cores}
        <p class="text-[13px] text-destructive">{errors.cpu_cores}</p>
      {/if}
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="lxc-memory">Memory (MB)</Label>
      <Input
        id="lxc-memory"
        type="number"
        min="1"
        value={value.memory_mb}
        oninput={(e) => patch({ memory_mb: toInt(e.currentTarget.value) })}
      />
      {#if errors.memory_mb}
        <p class="text-[13px] text-destructive">{errors.memory_mb}</p>
      {/if}
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="lxc-disk">Disk (GB)</Label>
      <Input
        id="lxc-disk"
        type="number"
        min="1"
        value={value.disk_gb}
        oninput={(e) => patch({ disk_gb: toInt(e.currentTarget.value) })}
      />
      {#if errors.disk_gb}
        <p class="text-[13px] text-destructive">{errors.disk_gb}</p>
      {/if}
    </div>
  </div>

  <!-- ==================================================================== -->
  <!-- Quota-delta mount slot (Plan 04-12):                                  -->
  <!-- Plan 04-12's `QuotaDeltaLine` renders the live "this uses N of M      -->
  <!-- cores…" line here from the sizing values above.                      -->
  <!-- ==================================================================== -->

  <!-- LXC-07 — container options. -->
  <fieldset class="flex flex-col gap-4 rounded-md border p-4">
    <legend class="px-1 text-[13px] font-semibold">Container options</legend>

    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-1.5">
          <Label for="lxc-unprivileged">Unprivileged container</Label>
          <HelpTooltip
            label="Unprivileged container"
            text="An unprivileged container maps its root to a non-root host user — the recommended, safer default. Disable only when the workload genuinely needs host-level privileges."
          />
        </div>
        <p class="text-muted-foreground text-[13px]">Recommended for most workloads.</p>
      </div>
      <Switch
        id="lxc-unprivileged"
        checked={value.unprivileged}
        onCheckedChange={(v) => patch({ unprivileged: v })}
      />
    </div>

    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-1.5">
          <Label for="lxc-nesting">Nesting</Label>
          <HelpTooltip
            label="Nesting"
            text="Nesting lets the container run its own containers (e.g. Docker) or systemd cleanly. Off by default."
          />
        </div>
        <p class="text-muted-foreground text-[13px]">
          Enable to run Docker or nested containers inside this LXC.
        </p>
      </div>
      <Switch
        id="lxc-nesting"
        checked={value.nesting}
        onCheckedChange={(v) => patch({ nesting: v })}
      />
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-1.5">
        <span class="text-[14px] font-medium">Features</span>
        <HelpTooltip
          label="Features"
          text="Extra container features. keyctl exposes the kernel keyring (some apps need it); fuse allows FUSE-based filesystem mounts."
        />
      </div>
      <div class="flex flex-col gap-2">
        {#each LXC_FEATURE_FLAGS as flag (flag)}
          <div class="flex items-center gap-2">
            <Checkbox
              id={`lxc-feature-${flag}`}
              checked={value.features.includes(flag)}
              onCheckedChange={(v) => toggleFeature(flag, v === true)}
            />
            <Label for={`lxc-feature-${flag}`} class="font-normal">{flag}</Label>
          </div>
        {/each}
      </div>
    </div>
  </fieldset>
</section>
