<!--
  NodeSelect — the shared node-fit target-node selector (Plan 04-12).

  Contract: 04-UI-SPEC §"Node-fit selector" (D-24, VM-10).
    - A target-node `Select`. A node that cannot fit the requested CPU/RAM is
      DISABLED (un-pickable, `opacity-50`) with the reason shown inline
      (Label 13/500 muted): "node-1 — 2 GB free, needs 4 GB".
    - When EVERY node is unfit a `bg-warning/10` notice appears above the
      selector and the `onBlockedChange` signal disables the step's `Next`.
    - Fit re-evaluates whenever the requested CPU/Memory changes — `nodeFit`
      is `$derived`, so a new `request` recomputes it.
    - Carries a `HelpTooltip` (D-25).

  Shared building block: BOTH the VM Resources step (`VmResourcesStep`) and the
  LXC Resources step (`LxcResourcesStep`, retro-wired by the /create route)
  embed this. It reads its node list as a prop — `NodeResource[]` carrying the
  live free CPU/RAM (the backend `connector.node_resources` figures). When the
  list is empty it falls back to a free-text `Input` so the wizard is never
  hard-blocked (the established Plan 04-11 graceful-degradation pattern); the
  node value is re-validated server-side on create.
-->
<script lang="ts">
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import HelpTooltip from '$lib/components/shared/HelpTooltip.svelte';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import {
    computeNodeFit,
    allBlocked,
    type NodeResource,
    type NodeFit
  } from './node-fit';

  type Props = {
    /**
     * The cluster's nodes with their live free CPU/RAM figures. Empty → the
     * free-text fallback (no fit computed — node-fit is advisory).
     */
    nodes?: NodeResource[];
    /** The currently-selected node name. */
    value?: string;
    /** The requested CPU cores — drives the fit computation. */
    requestedCpu: number;
    /** The requested RAM in MB — drives the fit computation. */
    requestedRamMb: number;
    /** Per-field validation error for the node field — surfaced inline. */
    error?: string;
    /** Fired when the user picks / types a node. */
    onChange?: (node: string) => void;
    /**
     * Fired with the all-nodes-blocked signal — the Resources step disables
     * `Next` while this is true.
     */
    onBlockedChange?: (blocked: boolean) => void;
  };

  let {
    nodes = [],
    value = '',
    requestedCpu,
    requestedRamMb,
    error,
    onChange,
    onBlockedChange
  }: Props = $props();

  /** The per-node fit verdict — recomputed whenever the request or list changes. */
  const nodeFit = $derived<NodeFit[]>(
    computeNodeFit({ requestedCpu, requestedRamMb }, nodes)
  );

  /** True when no node has room — the Resources step blocks `Next`. */
  const blocked = $derived(allBlocked(nodeFit));

  /** Signal the all-blocked state up to the Resources step. */
  $effect(() => {
    onBlockedChange?.(blocked);
  });

  /** Fit lookup by node name — the option render reads `fits` / `reason`. */
  const fitByNode = $derived(new Map(nodeFit.map((f) => [f.node, f])));
</script>

<div class="flex flex-col gap-1.5">
  <div class="flex items-center gap-1.5">
    <Label for="node-select">Target node</Label>
    <HelpTooltip
      label="Target node"
      text="The Proxmox host this resource runs on. A node that doesn't have enough free CPU or memory for this size is shown disabled."
    />
  </div>

  {#if blocked}
    <!-- Every node is unfit — the all-blocked warning notice (D-24). -->
    <div
      class="bg-warning/10 border-warning/30 flex items-start gap-2 rounded-md border p-3"
    >
      <TriangleAlert class="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p class="text-foreground text-[13px]">
        No node currently has room for this size. Reduce CPU or memory, or try
        again later.
      </p>
    </div>
  {/if}

  {#if nodes.length > 0}
    <Select.Root
      type="single"
      value={value || undefined}
      onValueChange={(v) => v && onChange?.(v)}
    >
      <Select.Trigger id="node-select" class="w-full">
        {value || 'Select a node'}
      </Select.Trigger>
      <Select.Content>
        {#each nodes as n (n.node)}
          {@const fit = fitByNode.get(n.node)}
          <Select.Item
            value={n.node}
            disabled={fit ? !fit.fits : false}
            class={fit && !fit.fits ? 'opacity-50' : ''}
          >
            <span class="flex flex-col gap-0.5">
              <span>{n.node}</span>
              {#if fit && !fit.fits && fit.reason}
                <span class="text-muted-foreground text-[13px] font-medium">
                  {fit.reason}
                </span>
              {/if}
            </span>
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  {:else}
    <!-- Fallback — no node list available; accept the node name directly. -->
    <Input
      id="node-select"
      placeholder="pve1"
      {value}
      oninput={(e) => onChange?.(e.currentTarget.value)}
    />
  {/if}

  {#if error}
    <p class="text-destructive text-[13px]">{error}</p>
  {/if}
</div>
