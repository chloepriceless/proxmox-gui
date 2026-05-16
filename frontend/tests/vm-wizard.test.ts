// VM wizard behaviour tests — Plan 04-12.
//
// The vitest environment is `node` — no DOM, so Svelte components cannot be
// mounted (same constraint as every Phase 1-4 component test, which are all
// logic-only — see tests/lxc-wizard.test.ts, tests/wizard-draft.test.ts).
//
// We therefore test the *logic* the VM wizard carries, exercising the real
// code in `vm-wizard.ts`:
//   Task 1 — the shared building blocks: the SDN-aware network picker's
//     grouping + pickability + IPAM-auto-pick defaulting + NIC builder, and
//     the quota-delta computation (the `QuotaDeltaLine` content).
//   Task 2 — the four VM source paths: the per-path step list, the per-path
//     source-step validation, the `CreateQemuRequest` builder per `source_kind`,
//     and the create-error mapping.
//
// The rendered Svelte props/markup are exercised end-to-end by
// `pnpm exec svelte-check` (the typed-props contract) — see the plan verify.

import { describe, expect, it } from 'vitest';
import {
  // network picker
  networkGroups,
  isNetworkPickable,
  defaultIpAssignment,
  findNetworkOption,
  buildNetworkConfig,
  // quota delta
  computeQuotaDelta,
  // VM paths
  sourceKindForPath,
  isClonePath,
  isVmPath,
  vmStepsForPath,
  validateVmStep,
  vmStepValid,
  buildQemuRequest,
  mapQemuCreateError
} from '$lib/components/wizard/vm-wizard';
import type { NetworkOption, NetworkPickerResponse } from '$lib/api/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function vnet(over: Partial<NetworkOption>): NetworkOption {
  return {
    kind: 'sdn-vnet',
    network_id: 'vnet-prod',
    display_name: 'vnet-prod',
    zone: 'dc1',
    tag: null,
    vlan_aware: false,
    applied: true,
    ipam_available: true,
    suggested_ip: '10.0.0.4/24',
    ...over
  };
}

function bridge(over: Partial<NetworkOption>): NetworkOption {
  return {
    kind: 'bridge',
    network_id: 'vmbr0',
    display_name: 'vmbr0',
    zone: null,
    tag: null,
    vlan_aware: false,
    applied: true,
    ipam_available: false,
    suggested_ip: null,
    ...over
  };
}

function pickerResponse(over: Partial<NetworkPickerResponse>): NetworkPickerResponse {
  return {
    cluster_id: 1,
    sdn_capable: true,
    sdn_vnets: [vnet({})],
    bridges: [bridge({})],
    ...over
  };
}

// ===========================================================================
// Task 1 — the SDN-aware network picker logic
// ===========================================================================

describe('networkGroups', () => {
  it('splits the response into an SDN VNet group and a legacy-bridge group', () => {
    const g = networkGroups(pickerResponse({}));
    expect(g.sdnCapable).toBe(true);
    expect(g.sdnVnets.map((v) => v.network_id)).toEqual(['vnet-prod']);
    expect(g.bridges.map((b) => b.network_id)).toEqual(['vmbr0']);
    expect(g.isEmpty).toBe(false);
  });

  it('marks the picker empty only when both groups are empty', () => {
    expect(networkGroups(pickerResponse({ sdn_vnets: [], bridges: [] })).isEmpty).toBe(
      true
    );
    // Bridges-only is NOT empty (a non-SDN cluster always has at least a bridge).
    expect(networkGroups(pickerResponse({ sdn_vnets: [] })).isEmpty).toBe(false);
  });

  it('a non-SDN cluster carries only bridges', () => {
    const g = networkGroups(
      pickerResponse({ sdn_capable: false, sdn_vnets: [] })
    );
    expect(g.sdnCapable).toBe(false);
    expect(g.sdnVnets).toHaveLength(0);
    expect(g.bridges).toHaveLength(1);
  });
});

describe('isNetworkPickable', () => {
  it('an applied SDN VNet is pickable', () => {
    expect(isNetworkPickable(vnet({ applied: true }))).toBe(true);
  });

  it('a non-applied (pending) SDN VNet is NOT pickable', () => {
    expect(isNetworkPickable(vnet({ applied: false }))).toBe(false);
  });

  it('a legacy bridge is always pickable', () => {
    expect(isNetworkPickable(bridge({}))).toBe(true);
  });
});

describe('defaultIpAssignment', () => {
  it('selects Auto-pick by default for an IPAM-backed network', () => {
    expect(defaultIpAssignment(vnet({ ipam_available: true }))).toBe('auto');
  });

  it('defaults to DHCP for a network without IPAM', () => {
    expect(defaultIpAssignment(vnet({ ipam_available: false }))).toBe('dhcp');
    expect(defaultIpAssignment(bridge({}))).toBe('dhcp');
  });

  it('defaults to DHCP when nothing is selected', () => {
    expect(defaultIpAssignment(null)).toBe('dhcp');
  });
});

describe('findNetworkOption', () => {
  it('resolves a selection across both groups', () => {
    const g = networkGroups(pickerResponse({}));
    expect(findNetworkOption(g, 'vnet-prod')?.kind).toBe('sdn-vnet');
    expect(findNetworkOption(g, 'vmbr0')?.kind).toBe('bridge');
    expect(findNetworkOption(g, 'nope')).toBeNull();
    expect(findNetworkOption(g, null)).toBeNull();
  });
});

describe('buildNetworkConfig', () => {
  it('returns null when nothing is selected — the cluster default NIC applies', () => {
    expect(
      buildNetworkConfig({ option: null, assignment: 'dhcp' })
    ).toBeNull();
  });

  it('builds a static NIC for an auto-pick assignment with an IP', () => {
    const cfg = buildNetworkConfig({
      option: vnet({ network_id: 'vnet-prod' }),
      assignment: 'auto',
      ip: '10.0.0.4/24'
    });
    expect(cfg).toEqual({
      kind: 'sdn-vnet',
      id: 'vnet-prod',
      ip_mode: 'static',
      ip_cidr: '10.0.0.4/24',
      gateway: null,
      vlan_tag: null
    });
  });

  it('builds a DHCP NIC for the dhcp assignment', () => {
    const cfg = buildNetworkConfig({
      option: bridge({ network_id: 'vmbr0' }),
      assignment: 'dhcp'
    });
    expect(cfg?.kind).toBe('bridge');
    expect(cfg?.ip_mode).toBe('dhcp');
    expect(cfg?.ip_cidr).toBeNull();
  });

  it('falls back to DHCP when auto-pick is chosen but no IP was entered', () => {
    const cfg = buildNetworkConfig({
      option: vnet({}),
      assignment: 'auto',
      ip: '   '
    });
    expect(cfg?.ip_mode).toBe('dhcp');
  });
});

// ===========================================================================
// Task 1 — the quota-delta logic (the QuotaDeltaLine content)
// ===========================================================================

describe('computeQuotaDelta', () => {
  it('renders the "+N vCPU, +N GB RAM" delta string', () => {
    const d = computeQuotaDelta({ cpu: 2, ramMb: 4096 }, null);
    expect(d.deltaCpu).toBe(2);
    expect(d.deltaRamGb).toBe(4);
    expect(d.label).toBe('+2 vCPU, +4 GB RAM');
  });

  it('is in-budget (not over-quota) when the request fits the limit', () => {
    const d = computeQuotaDelta(
      { cpu: 2, ramMb: 4096 },
      { usedCpu: 4, limitCpu: 16, usedRamGb: 8, limitRamGb: 32 }
    );
    expect(d.overQuota).toBe(false);
  });

  it('is over-quota when the request would exceed the CPU limit', () => {
    const d = computeQuotaDelta(
      { cpu: 8, ramMb: 4096 },
      { usedCpu: 12, limitCpu: 16, usedRamGb: 8, limitRamGb: 64 }
    );
    expect(d.overQuota).toBe(true);
  });

  it('is over-quota when the request would exceed the RAM limit', () => {
    const d = computeQuotaDelta(
      { cpu: 2, ramMb: 16384 },
      { usedCpu: 2, limitCpu: 16, usedRamGb: 24, limitRamGb: 32 }
    );
    expect(d.overQuota).toBe(true);
  });

  it('an unlimited (null) limit is never over-quota', () => {
    const d = computeQuotaDelta(
      { cpu: 999, ramMb: 999999 },
      { usedCpu: 0, limitCpu: null, usedRamGb: 0, limitRamGb: null }
    );
    expect(d.overQuota).toBe(false);
  });

  it('is never over-quota when no budget is wired', () => {
    expect(computeQuotaDelta({ cpu: 64, ramMb: 999999 }, null).overQuota).toBe(false);
  });
});

// ===========================================================================
// Task 2 — the four VM source paths
// ===========================================================================

describe('sourceKindForPath / isVmPath / isClonePath', () => {
  it('maps each VM path to its source_kind', () => {
    expect(sourceKindForPath('cloud-image')).toBe('cloud-image');
    expect(sourceKindForPath('template-clone')).toBe('template-clone');
    expect(sourceKindForPath('blank-iso')).toBe('blank-iso');
    expect(sourceKindForPath('vm-clone')).toBe('vm-clone');
  });

  it('throws for an LXC path', () => {
    expect(() => sourceKindForPath('plain-lxc')).toThrow();
  });

  it('identifies the four VM paths', () => {
    for (const p of ['cloud-image', 'template-clone', 'blank-iso', 'vm-clone'] as const) {
      expect(isVmPath(p)).toBe(true);
    }
    expect(isVmPath('plain-lxc')).toBe(false);
    expect(isVmPath('community-script')).toBe(false);
  });

  it('identifies the clone paths', () => {
    expect(isClonePath('template-clone')).toBe(true);
    expect(isClonePath('vm-clone')).toBe(true);
    expect(isClonePath('cloud-image')).toBe(false);
    expect(isClonePath('blank-iso')).toBe(false);
  });
});

describe('vmStepsForPath', () => {
  it('every VM path is Path → Source → Resources → Network → Cloud-Init → Review', () => {
    for (const p of ['cloud-image', 'template-clone', 'blank-iso', 'vm-clone'] as const) {
      expect(vmStepsForPath(p)).toEqual([
        'path',
        'source',
        'resources',
        'network',
        'cloud-init',
        'review'
      ]);
    }
  });

  it('all four VM paths include the Cloud-Init step (D-13)', () => {
    for (const p of ['cloud-image', 'template-clone', 'blank-iso', 'vm-clone'] as const) {
      expect(vmStepsForPath(p)).toContain('cloud-init');
    }
  });

  it('throws for an LXC path', () => {
    expect(() => vmStepsForPath('plain-lxc')).toThrow();
  });
});

describe('validateVmStep — source step', () => {
  it('cloud-image needs an image_id', () => {
    expect(validateVmStep('source', 'cloud-image', {}).image_id).toBeTruthy();
    expect(
      validateVmStep('source', 'cloud-image', { image_id: 'ubuntu-24.04' })
    ).toEqual({});
  });

  it('blank-iso needs an iso_volid', () => {
    expect(validateVmStep('source', 'blank-iso', {}).iso_volid).toBeTruthy();
    expect(
      validateVmStep('source', 'blank-iso', { iso_volid: 'local:iso/x.iso' })
    ).toEqual({});
  });

  it('template-clone needs a source_vmid', () => {
    expect(validateVmStep('source', 'template-clone', {}).source_vmid).toBeTruthy();
    expect(
      validateVmStep('source', 'template-clone', { source_vmid: 9000 })
    ).toEqual({});
  });

  it('vm-clone needs a source_vmid', () => {
    expect(validateVmStep('source', 'vm-clone', {}).source_vmid).toBeTruthy();
    expect(validateVmStep('source', 'vm-clone', { source_vmid: 101 })).toEqual({});
  });
});

describe('validateVmStep — resources step', () => {
  const fullSizing = {
    name: 'web01',
    node: 'pve1',
    storage: 'local-lvm',
    cpu_cores: 2,
    memory_mb: 4096,
    disk_gb: 32
  };

  it('a non-clone path needs name, node, storage, and full sizing', () => {
    expect(validateVmStep('resources', 'cloud-image', fullSizing)).toEqual({});
    expect(validateVmStep('resources', 'cloud-image', {}).name).toBeTruthy();
    expect(validateVmStep('resources', 'cloud-image', {}).storage).toBeTruthy();
    expect(validateVmStep('resources', 'cloud-image', {}).cpu_cores).toBeTruthy();
  });

  it('a clone path needs only name + node — the clone copies the source sizing', () => {
    expect(
      validateVmStep('resources', 'template-clone', { name: 'clone1', node: 'pve1' })
    ).toEqual({});
    // No storage / sizing required for a clone.
    const errs = validateVmStep('resources', 'vm-clone', { name: 'c', node: 'pve1' });
    expect(errs.storage).toBeUndefined();
    expect(errs.cpu_cores).toBeUndefined();
  });

  it('a clone path still needs a name and a node', () => {
    expect(validateVmStep('resources', 'vm-clone', {}).name).toBeTruthy();
    expect(validateVmStep('resources', 'vm-clone', {}).node).toBeTruthy();
  });

  it('vmStepValid reflects the error map', () => {
    expect(vmStepValid('resources', 'cloud-image', fullSizing)).toBe(true);
    expect(vmStepValid('resources', 'cloud-image', {})).toBe(false);
  });
});

describe('buildQemuRequest', () => {
  it('builds a cloud-image request with the cloud-image source_kind + CI fields', () => {
    const req = buildQemuRequest(
      {
        node: 'pve1',
        name: 'web01',
        storage: 'local-lvm',
        cpu_cores: 2,
        memory_mb: 4096,
        disk_gb: 32,
        image_id: 'ubuntu-24.04',
        ci_user: 'ubuntu',
        ssh_public_keys: 'ssh-ed25519 AAAA'
      },
      7,
      'cloud-image'
    );
    expect(req.source_kind).toBe('cloud-image');
    expect(req.team_id).toBe(7);
    expect(req.image_id).toBe('ubuntu-24.04');
    expect(req.cpu_cores).toBe(2);
    expect(req.ci_user).toBe('ubuntu');
  });

  it('builds a blank-iso request with the blank-iso source_kind + iso_volid', () => {
    const req = buildQemuRequest(
      {
        node: 'pve1',
        name: 'win01',
        storage: 'local-lvm',
        cpu_cores: 4,
        memory_mb: 8192,
        disk_gb: 64,
        iso_volid: 'local:iso/windows.iso'
      },
      3,
      'blank-iso'
    );
    expect(req.source_kind).toBe('blank-iso');
    expect(req.iso_volid).toBe('local:iso/windows.iso');
  });

  it('builds a template-clone request carrying source_vmid + clone_mode', () => {
    const req = buildQemuRequest(
      { node: 'pve1', name: 'fromtmpl', source_vmid: 9000, clone_mode: 'full' },
      1,
      'template-clone'
    );
    expect(req.source_kind).toBe('template-clone');
    expect(req.source_vmid).toBe(9000);
    expect(req.clone_mode).toBe('full');
  });

  it('builds a vm-clone request, defaulting clone_mode to linked', () => {
    const req = buildQemuRequest(
      { node: 'pve1', name: 'copy', source_vmid: 101 },
      1,
      'vm-clone'
    );
    expect(req.source_kind).toBe('vm-clone');
    expect(req.source_vmid).toBe(101);
    expect(req.clone_mode).toBe('linked');
  });

  it('carries the NIC config off the form bag', () => {
    const network = { kind: 'bridge' as const, id: 'vmbr0', ip_mode: 'dhcp' as const };
    const req = buildQemuRequest(
      {
        node: 'pve1',
        name: 'web01',
        storage: 'local-lvm',
        cpu_cores: 1,
        memory_mb: 1024,
        disk_gb: 8,
        image_id: 'debian-12',
        network
      },
      1,
      'cloud-image'
    );
    expect(req.network).toEqual(network);
  });
});

describe('mapQemuCreateError', () => {
  it('maps a 409 to an over-quota message', () => {
    expect(mapQemuCreateError({ status: 409 })).toMatch(/quota/i);
    expect(mapQemuCreateError({ status: 409, detail: '3 cores over' })).toContain(
      '3 cores over'
    );
  });

  it('maps a 403 to a permission message (covers a forged clone source)', () => {
    expect(mapQemuCreateError({ status: 403 })).toMatch(/permission/i);
  });

  it('maps a 404 to an unavailable-source message', () => {
    expect(mapQemuCreateError({ status: 404 })).toMatch(/no longer available/i);
  });

  it('falls back to a generic message for an unknown error', () => {
    expect(mapQemuCreateError(new Error('boom'))).toMatch(/try again/i);
  });
});
