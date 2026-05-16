// vm-wizard — the pure, framework-free logic for the four VM wizard paths and
// the shared SDN-aware network picker (Plan 04-12).
//
// This module holds the data + pure functions the VM wizard step components
// (`VmSourceStep`, `VmResourcesStep`, `ReviewStep`, `NetworkPicker`,
// `NodeSelect`, `QuotaDeltaLine`) and the `/create` route share — extracted
// from the `.svelte` files so the logic is unit-testable in the `node` vitest
// env (the same discipline as Plan 04-10's `wizard-model.ts` and Plan 04-11's
// `lxc-wizard.ts`). The rendered Svelte props/markup are exercised end-to-end
// by `pnpm exec svelte-check`.
//
// References:
//   - 04-UI-SPEC §"Step model" + §"Resources step contract" + §"Review step
//     contract" + §"SDN-aware network picker"
//   - 04-CONTEXT.md D-04 / D-13 / D-15 / D-19..D-21 / D-24
//   - VM-01/02/03/04/09/10, NET-01..04

import type {
  CreateQemuRequest,
  NetworkConfigInput,
  NetworkOption,
  NetworkPickerResponse
} from '$lib/api/types';
import type { WizardPath, WizardStepId } from './wizard-model';

// ---------------------------------------------------------------------------
// VM source kinds + step model
// ---------------------------------------------------------------------------

/** The four VM provisioning source kinds — the `CreateQemuRequest.source_kind`. */
export type VmSourceKind = 'cloud-image' | 'template-clone' | 'blank-iso' | 'vm-clone';

/** Map a VM wizard path to its `source_kind`. */
export function sourceKindForPath(path: WizardPath): VmSourceKind {
  switch (path) {
    case 'cloud-image':
      return 'cloud-image';
    case 'template-clone':
      return 'template-clone';
    case 'blank-iso':
      return 'blank-iso';
    case 'vm-clone':
      return 'vm-clone';
    default:
      throw new Error(`sourceKindForPath: ${path} is not a VM path`);
  }
}

/** Whether a path is a clone path (template-clone / vm-clone). */
export function isClonePath(path: WizardPath): boolean {
  return path === 'template-clone' || path === 'vm-clone';
}

/**
 * The path-conditional VM step list (UI-SPEC §"Step model" table). All four VM
 * paths are `Path → Source → Resources → Network → Cloud-Init → Review` — the
 * Cloud-Init step is present on every VM path (D-13).
 *
 * This mirrors `stepsForPath` from `wizard-model.ts` for the four VM paths and
 * exists so the VM step components can assert their own step list without
 * importing the whole shell model.
 */
export function vmStepsForPath(path: WizardPath): WizardStepId[] {
  if (!isVmPath(path)) {
    throw new Error(`vmStepsForPath: ${path} is not a VM path`);
  }
  return ['path', 'source', 'resources', 'network', 'cloud-init', 'review'];
}

/** Whether a path is one of the four VM paths. */
export function isVmPath(path: WizardPath): boolean {
  return (
    path === 'cloud-image' ||
    path === 'template-clone' ||
    path === 'blank-iso' ||
    path === 'vm-clone'
  );
}

// ---------------------------------------------------------------------------
// Network picker logic (NET-01..04)
// ---------------------------------------------------------------------------

/** The two IP-assignment modes the network picker offers (D-20). */
export type IpAssignment = 'auto' | 'dhcp';

/** A flat, grouped view of the network picker response — for the UI render. */
export interface NetworkGroups {
  /** Whether the cluster is SDN-capable (D-21) — drives the SDN group header. */
  sdnCapable: boolean;
  /** The granted SDN VNets (may include pending, non-`applied` ones). */
  sdnVnets: NetworkOption[];
  /** The always-visible legacy bridges. */
  bridges: NetworkOption[];
  /** True when the picker has nothing at all to offer (the empty-state notice). */
  isEmpty: boolean;
}

/**
 * Reduce a `NetworkPickerResponse` into the grouped view the picker renders.
 * `isEmpty` is true only when BOTH groups are empty — that case shows the
 * `bg-warning/10` "No networks available" notice and blocks `Next`.
 */
export function networkGroups(resp: NetworkPickerResponse): NetworkGroups {
  const sdnVnets = resp.sdn_vnets ?? [];
  const bridges = resp.bridges ?? [];
  return {
    sdnCapable: resp.sdn_capable,
    sdnVnets,
    bridges,
    isEmpty: sdnVnets.length === 0 && bridges.length === 0
  };
}

/**
 * Whether a network option is pickable. A non-`applied` SDN VNet (a pending
 * VNet — spike 04-02 §2, Pitfall 8) is surfaced but un-pickable so a real
 * create can never select an unusable network (T-04-12-04). Legacy bridges are
 * always `applied` from the backend.
 */
export function isNetworkPickable(option: NetworkOption): boolean {
  return option.applied;
}

/**
 * The default IP-assignment for a chosen network (D-20). When the network has
 * an IPAM, "Auto-pick free IP" is selected by default (with the suggested IP
 * pre-filled); a network without IPAM defaults to DHCP.
 */
export function defaultIpAssignment(option: NetworkOption | null): IpAssignment {
  return option?.ipam_available ? 'auto' : 'dhcp';
}

/**
 * Find a network option by its `network_id` across both groups (the picker's
 * selection lookup). Returns `null` when nothing matches.
 */
export function findNetworkOption(
  groups: NetworkGroups,
  networkId: string | null
): NetworkOption | null {
  if (!networkId) return null;
  return (
    groups.sdnVnets.find((o) => o.network_id === networkId) ??
    groups.bridges.find((o) => o.network_id === networkId) ??
    null
  );
}

/**
 * Build the `NetworkConfigInput` (the create body's `network` field) from the
 * picker selection. Returns `null` when nothing is selected — the backend then
 * applies the cluster default NIC.
 *
 * An `auto` IP-assignment with a non-empty `ip` becomes a `static` NIC; `dhcp`
 * (or `auto` with no address) becomes a `dhcp` NIC.
 */
export function buildNetworkConfig(args: {
  option: NetworkOption | null;
  assignment: IpAssignment;
  ip?: string | null;
  gateway?: string | null;
}): NetworkConfigInput | null {
  const { option, assignment } = args;
  if (!option) return null;
  const ip = (args.ip ?? '').trim();
  const useStatic = assignment === 'auto' && ip.length > 0;
  return {
    kind: option.kind === 'sdn-vnet' ? 'sdn-vnet' : 'bridge',
    id: option.network_id,
    ip_mode: useStatic ? 'static' : 'dhcp',
    ip_cidr: useStatic ? ip : null,
    gateway: useStatic ? (args.gateway ?? '').trim() || null : null,
    vlan_tag: option.tag ?? null
  };
}

// ---------------------------------------------------------------------------
// Quota-delta logic (the live "+N vCPU, +N GB RAM" line — D-08, VM-10)
// ---------------------------------------------------------------------------

/** The requested sizing the quota delta is computed for. */
export interface QuotaDeltaRequest {
  /** Requested CPU cores. */
  cpu: number;
  /** Requested RAM in MB. */
  ramMb: number;
}

/** The team's current usage + limit for the cluster the wizard targets. */
export interface QuotaBudget {
  /** Cores already used. */
  usedCpu: number;
  /** Cores limit — `null` means unlimited. */
  limitCpu: number | null;
  /** GB RAM already used. */
  usedRamGb: number;
  /** GB RAM limit — `null` means unlimited. */
  limitRamGb: number | null;
}

/** The computed quota-delta verdict the `QuotaDeltaLine` renders. */
export interface QuotaDelta {
  /** Requested CPU cores (the "+N vCPU" figure). */
  deltaCpu: number;
  /** Requested RAM in whole GB (the "+N GB RAM" figure). */
  deltaRamGb: number;
  /** True when the request would push usage past a limit. */
  overQuota: boolean;
  /** The human "+2 vCPU, +4 GB RAM" delta string. */
  label: string;
}

/**
 * Compute the live quota delta for a requested size against the team's budget
 * (D-08, VM-10). `overQuota` is true when adding the request to current usage
 * would exceed either limit (an unlimited `null` limit never triggers it);
 * when over-quota the `QuotaDeltaLine` renders `text-destructive` and signals
 * the step to disable `Next`.
 *
 * Passing `budget` as `null` (no quota data wired) yields `overQuota: false` —
 * the delta is still shown, the backend's row-locked admission remains the
 * real gate (T-04-12-02).
 */
export function computeQuotaDelta(
  request: QuotaDeltaRequest,
  budget: QuotaBudget | null
): QuotaDelta {
  const deltaCpu = request.cpu;
  const deltaRamGb = Math.round((request.ramMb / 1024) * 10) / 10;
  let overQuota = false;
  if (budget) {
    if (budget.limitCpu !== null && budget.usedCpu + deltaCpu > budget.limitCpu) {
      overQuota = true;
    }
    if (
      budget.limitRamGb !== null &&
      budget.usedRamGb + deltaRamGb > budget.limitRamGb
    ) {
      overQuota = true;
    }
  }
  return {
    deltaCpu,
    deltaRamGb,
    overQuota,
    label: `+${deltaCpu} vCPU, +${deltaRamGb} GB RAM`
  };
}

// ---------------------------------------------------------------------------
// Step validation
// ---------------------------------------------------------------------------

/** The wizard form bag, loosely typed (the shell's `WizardFormData`). */
export type VmFormData = Record<string, unknown>;

/** A per-field error map — `field → message`. Empty means the step is valid. */
export type VmFieldErrors = Record<string, string>;

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asPositiveInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Validate one VM wizard step's fields (the `setup/+page.svelte` `validateX`
 * pattern). Returns a `field → message` map; an empty map means the step may
 * advance. The `path` selects the source-step rules per `source_kind`.
 */
export function validateVmStep(
  step: WizardStepId,
  path: WizardPath,
  formData: VmFormData
): VmFieldErrors {
  const errors: VmFieldErrors = {};

  if (step === 'source') {
    switch (path) {
      case 'cloud-image':
        if (!asString(formData.image_id)) {
          errors.image_id = 'Pick a cloud image to continue.';
        }
        break;
      case 'blank-iso':
        if (!asString(formData.iso_volid)) {
          errors.iso_volid = 'Pick an installation ISO to continue.';
        }
        break;
      case 'template-clone':
      case 'vm-clone':
        if (asPositiveInt(formData.source_vmid) === null) {
          errors.source_vmid =
            path === 'template-clone'
              ? 'Pick a template to clone.'
              : 'Pick a VM to clone.';
        }
        break;
      default:
        break;
    }
    return errors;
  }

  if (step === 'resources') {
    if (!asString(formData.name)) errors.name = 'Enter a name for the VM.';
    if (!asString(formData.node)) errors.node = 'Pick a target node.';
    // The clone paths copy the source's disk + sizing — only name + node +
    // placement are required; the non-clone paths need full sizing + storage.
    if (!isClonePath(path)) {
      if (!asString(formData.storage)) errors.storage = 'Pick a storage.';
      if (asPositiveInt(formData.cpu_cores) === null) {
        errors.cpu_cores = 'CPU cores must be a positive whole number.';
      }
      if (asPositiveInt(formData.memory_mb) === null) {
        errors.memory_mb = 'Memory must be a positive whole number.';
      }
      if (asPositiveInt(formData.disk_gb) === null) {
        errors.disk_gb = 'Disk size must be a positive whole number.';
      }
    }
    return errors;
  }

  // `path`, `network`, `cloud-init`, and `review` are gated by their own
  // components / the shell — no VM-specific field rule here.
  return errors;
}

/** Whether a validated step has zero field errors. */
export function vmStepValid(
  step: WizardStepId,
  path: WizardPath,
  formData: VmFormData
): boolean {
  return Object.keys(validateVmStep(step, path, formData)).length === 0;
}

// ---------------------------------------------------------------------------
// Request builder — wizard form bag → CreateQemuRequest
// ---------------------------------------------------------------------------

/** Pull the optional NIC config off the form bag, or `null` when unset. */
function readNetwork(formData: VmFormData): NetworkConfigInput | null {
  const net = formData.network;
  if (net && typeof net === 'object') return net as NetworkConfigInput;
  return null;
}

/**
 * Translate the wizard `formData` bag into a `CreateQemuRequest` body for one
 * of the four VM paths (VM-01/02/03/04/09). The caller supplies `team_id` (the
 * wizard's resolved owning team) and the `path`.
 *
 * The `source_kind` is derived from the path. For the clone paths
 * (`template-clone` / `vm-clone`) the sizing/network fields are still sent but
 * the backend ignores them — the clone copies the source's config — and
 * `source_vmid` + `clone_mode` carry the clone intent. For the non-clone paths
 * (`cloud-image` / `blank-iso`) the sizing + storage are required.
 */
export function buildQemuRequest(
  formData: VmFormData,
  teamId: number,
  path: WizardPath
): CreateQemuRequest {
  const source_kind = sourceKindForPath(path);
  const base: CreateQemuRequest = {
    team_id: teamId,
    source_kind,
    node: asString(formData.node),
    name: asString(formData.name),
    network: readNetwork(formData)
  };

  if (source_kind === 'cloud-image') {
    return {
      ...base,
      storage: asString(formData.storage) || null,
      cpu_cores: asPositiveInt(formData.cpu_cores),
      memory_mb: asPositiveInt(formData.memory_mb),
      disk_gb: asPositiveInt(formData.disk_gb),
      image_id: asString(formData.image_id) || null,
      ci_user: asString(formData.ci_user) || null,
      ci_password: asString(formData.ci_password) || null,
      ssh_public_keys: asString(formData.ssh_public_keys) || null
    };
  }

  if (source_kind === 'blank-iso') {
    return {
      ...base,
      storage: asString(formData.storage) || null,
      cpu_cores: asPositiveInt(formData.cpu_cores),
      memory_mb: asPositiveInt(formData.memory_mb),
      disk_gb: asPositiveInt(formData.disk_gb),
      iso_volid: asString(formData.iso_volid) || null
    };
  }

  // template-clone / vm-clone — the clone copies the source config.
  const clone_mode = formData.clone_mode === 'full' ? 'full' : 'linked';
  return {
    ...base,
    source_vmid: asPositiveInt(formData.source_vmid),
    clone_mode
  };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map a VM create-call failure to an inline, human message (the
 * `setup/+page.svelte` `mapXError` pattern, mirroring `mapLxcCreateError`). A
 * 409 is the quota-admission rejection (Plan 04-04) — surfaced inline, the
 * wizard does NOT navigate away (T-04-12-02).
 */
export function mapQemuCreateError(err: unknown): string {
  const e = err as { status?: number; detail?: string; message?: string };
  const detail = (e?.detail ?? '').toLowerCase();
  if (e?.status === 409) {
    return detail
      ? `This would exceed your team's quota: ${e.detail}`
      : "This would exceed your team's quota. Reduce the size and try again.";
  }
  if (e?.status === 403) {
    return "You don't have permission to provision into this team or cluster, or to clone that source.";
  }
  if (e?.status === 422) {
    return 'Please check the wizard fields and try again.';
  }
  if (e?.status === 404) {
    return 'The selected image, ISO, template, or source VM is no longer available.';
  }
  return "Couldn't start the create job. Try again.";
}
