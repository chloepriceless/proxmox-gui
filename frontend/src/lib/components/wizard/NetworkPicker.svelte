<!--
  NetworkPicker — the shared SDN-aware grouped network picker (Plan 04-12).

  Contract: 04-UI-SPEC §"SDN-aware network picker" (D-18..D-21, NET-01..04).
    - Calls `api.networks.listNetworks({clusterId})`.
    - Renders a single grouped `radio-group`: an "SDN VNets" group and a
      "Legacy bridges" group, each under a 32px `bg-muted/40` group header.
    - SDN VNets appear only on SDN-capable clusters and only the team's
      admin-granted set (the backend already filters — D-19/D-21). A non-
      `applied` (pending) VNet is rendered NON-pickable (Pitfall 8, T-04-12-04).
    - Below: an IP-assignment `radio-group` — "Auto-pick free IP" (selected by
      default when the chosen network has IPAM, the IP `input` pre-filled with
      `suggested_ip`, fully editable — D-20) and "DHCP" (the default with no
      IPAM).
    - Empty case: when the response has no networks at all, the
      `bg-warning/10` "No networks available" notice shows and the picker
      signals the step to block `Next`.
    - The VNet-vs-bridge and IPAM/DHCP fields carry `HelpTooltip`s (D-25).

  Shared building block: BOTH the VM Network step and the LXC Network step
  (the /create route mounts this for every path).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import HelpTooltip from '$lib/components/shared/HelpTooltip.svelte';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import Network from '@lucide/svelte/icons/network';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { api } from '$lib/api/client';
  import type { NetworkConfigInput, NetworkOption } from '$lib/api/types';
  import {
    networkGroups,
    isNetworkPickable,
    defaultIpAssignment,
    findNetworkOption,
    buildNetworkConfig,
    type NetworkGroups,
    type IpAssignment
  } from './vm-wizard';

  type Props = {
    /** The cluster the wizard provisions into. */
    clusterId: number;
    /** The current NIC config (the wizard's `formData.network`). */
    value?: NetworkConfigInput | null;
    /** Fired with the built NIC config on any change (or `null` when cleared). */
    onChange?: (network: NetworkConfigInput | null) => void;
    /**
     * Fired with the no-networks signal — the Network step disables `Next`
     * while this is true.
     */
    onBlockedChange?: (blocked: boolean) => void;
  };

  let { clusterId, value = null, onChange, onBlockedChange }: Props = $props();

  /** The grouped picker view — `null` until the fetch resolves. */
  let groups = $state<NetworkGroups | null>(null);
  /** A load error message, or `null`. */
  let loadError = $state<string | null>(null);
  /** True while the networks fetch is in flight. */
  let loading = $state(true);

  // The `value` prop is a one-time seed for the picker's own state — once
  // mounted the picker is the authority over its selection. `untrack` reads it
  // once, in a non-reactive scope, so the deliberate initial-value capture is
  // explicit (the same discipline as the Plan 04-09/04-11
  // `state_referenced_locally` fixes — here we genuinely want one-time init,
  // not a derivation).
  const initial = untrack(() => value);

  /** The chosen network id. */
  let selectedId = $state<string>(initial?.id ?? '');
  /** The IP-assignment mode (auto / dhcp). */
  let assignment = $state<IpAssignment>(
    initial?.ip_mode === 'static' ? 'auto' : 'dhcp'
  );
  /** The static IP address (CIDR) — pre-filled from IPAM, fully editable. */
  let ipCidr = $state<string>(initial?.ip_cidr ?? '');
  /** The optional gateway. */
  let gateway = $state<string>(initial?.gateway ?? '');

  /** Fetch the networks for the cluster on mount. */
  $effect(() => {
    let cancelled = false;
    loading = true;
    api.networks
      .listNetworks({ clusterId })
      .then((resp) => {
        if (cancelled) return;
        groups = networkGroups(resp);
        loadError = null;
      })
      .catch(() => {
        if (cancelled) return;
        loadError = "Couldn't load networks.";
        groups = null;
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  /** The currently-selected option, resolved across both groups. */
  const selectedOption = $derived<NetworkOption | null>(
    groups ? findNetworkOption(groups, selectedId) : null
  );

  /** True when the picker has nothing to offer — the empty-state notice. */
  const isEmpty = $derived(Boolean(groups?.isEmpty));

  /** Signal the blocked (no networks) state up to the Network step. */
  $effect(() => {
    onBlockedChange?.(isEmpty);
  });

  /** Emit the built NIC config from the current selection. */
  function emit(): void {
    onChange?.(
      buildNetworkConfig({
        option: selectedOption,
        assignment,
        ip: ipCidr,
        gateway
      })
    );
  }

  /** A network row was chosen — default the IP-assignment + pre-fill the IP. */
  function selectNetwork(networkId: string): void {
    selectedId = networkId;
    const option = groups ? findNetworkOption(groups, networkId) : null;
    assignment = defaultIpAssignment(option);
    // D-20 — pre-fill the IP input with the IPAM suggestion (fully editable).
    ipCidr = option?.suggested_ip ?? '';
    emit();
  }

  /** The IP-assignment radio changed. */
  function selectAssignment(mode: string): void {
    assignment = mode === 'auto' ? 'auto' : 'dhcp';
    emit();
  }
</script>

<section class="flex flex-col gap-5">
  <header class="flex flex-col gap-1">
    <h2 class="text-[18px] font-semibold leading-tight tracking-tight">Network</h2>
    <p class="text-muted-foreground text-[14px]">
      Choose a network and how this resource gets its IP address.
    </p>
  </header>

  {#if loading}
    <p class="text-muted-foreground text-[13px]">Loading networks…</p>
  {:else if loadError}
    <div class="bg-destructive/10 rounded-md p-3">
      <p class="text-destructive text-[13px]">{loadError}</p>
    </div>
  {:else if isEmpty}
    <EmptyState
      icon={TriangleAlert}
      heading="No networks available"
      body="Your team hasn't been granted any networks on this cluster. Ask an administrator."
    />
  {:else if groups}
    <!-- The grouped network radio-group. -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1.5">
        <Label>Network</Label>
        <HelpTooltip
          label="Network"
          text="An SDN VNet is a software-defined network managed by Proxmox SDN; a legacy bridge is a classic Linux bridge. A pending VNet is not yet usable."
        />
      </div>
      <RadioGroup.Root value={selectedId} onValueChange={selectNetwork} class="gap-0">
        {#if groups.sdnCapable && groups.sdnVnets.length > 0}
          <div
            class="bg-muted/40 flex h-8 items-center px-3 text-[13px] font-medium"
          >
            SDN VNets
          </div>
          {#each groups.sdnVnets as vnet (vnet.network_id)}
            {@const pickable = isNetworkPickable(vnet)}
            <label
              class="flex items-center gap-3 border-b px-3 py-2.5 {selectedId ===
              vnet.network_id
                ? 'border-primary bg-accent/40'
                : ''} {pickable ? '' : 'opacity-50'}"
            >
              <RadioGroup.Item value={vnet.network_id} disabled={!pickable} />
              <span class="flex flex-1 flex-col gap-0.5">
                <span class="text-foreground text-[14px]">{vnet.display_name}</span>
                <span class="text-muted-foreground text-[13px]">
                  {vnet.zone ? `zone: ${vnet.zone}` : 'SDN VNet'}{vnet.ipam_available
                    ? ' · IPAM available'
                    : ''}{pickable ? '' : ' · pending — not yet usable'}
                </span>
              </span>
            </label>
          {/each}
        {/if}

        {#if groups.bridges.length > 0}
          <div
            class="bg-muted/40 flex h-8 items-center px-3 text-[13px] font-medium"
          >
            Legacy bridges
          </div>
          {#each groups.bridges as bridge (bridge.network_id)}
            <label
              class="flex items-center gap-3 border-b px-3 py-2.5 {selectedId ===
              bridge.network_id
                ? 'border-primary bg-accent/40'
                : ''}"
            >
              <RadioGroup.Item value={bridge.network_id} />
              <span class="flex flex-1 flex-col gap-0.5">
                <span class="text-foreground text-[14px]">{bridge.display_name}</span>
                <span class="text-muted-foreground text-[13px]">default-visible</span>
              </span>
            </label>
          {/each}
        {/if}
      </RadioGroup.Root>
    </div>

    <!-- IP assignment. -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1.5">
        <Label>IP assignment</Label>
        <HelpTooltip
          label="IP assignment"
          text="Auto-pick assigns a free static address from the network's IPAM; DHCP lets the network hand out an address. Auto-pick is only available on IPAM-backed networks."
        />
      </div>
      <RadioGroup.Root value={assignment} onValueChange={selectAssignment}>
        <label class="flex items-center gap-3">
          <RadioGroup.Item
            value="auto"
            disabled={!selectedOption?.ipam_available}
          />
          <span class="text-[14px]">Auto-pick free IP</span>
        </label>
        {#if assignment === 'auto'}
          <Input
            class="ml-7 w-[16rem]"
            placeholder="10.0.0.10/24"
            value={ipCidr}
            oninput={(e) => {
              ipCidr = e.currentTarget.value;
              emit();
            }}
          />
        {/if}
        <label class="flex items-center gap-3">
          <RadioGroup.Item value="dhcp" />
          <span class="text-[14px]">DHCP</span>
        </label>
      </RadioGroup.Root>
    </div>
  {/if}
</section>
