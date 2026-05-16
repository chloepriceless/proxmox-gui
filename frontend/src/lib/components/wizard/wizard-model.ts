// Wizard model — the pure, framework-free heart of the `/create` wizard shell
// (Plan 04-10).
//
// This module holds the data + pure functions the wizard route and its step
// components share — extracted from the `.svelte` files so the logic is unit
// testable in the `node` vitest env (the same discipline as Phase 3's
// `snapshot-tree.ts` and the jobs-store injectable factory). The shell ships
// this contract; the three sibling step plans (04-11 LXC, 04-12 VM, 04-13
// Cloud-Init) plug their per-path step components into the `WizardStepId`
// surface defined here without touching the route.
//
// References:
//   - 04-UI-SPEC §"Create wizard" — the step-model table + path-picker contract
//   - 04-UI-SPEC §"Copywriting Contract" — the six pinned path-picker cards
//   - D-01 one unified wizard / D-03 the path → … → review step model
//   - D-04 the post-submit `/inventory/{cluster}/{vmid}` landing

import type { ProvisioningJobAccepted } from '$lib/api/types';

// ---------------------------------------------------------------------------
// Paths + steps
// ---------------------------------------------------------------------------

/**
 * The six provisioning paths (D-01). Step 1's path picker chooses one; the
 * `wizardDraft` store persists it; the step model branches on it.
 */
export type WizardPath =
  | 'plain-lxc'
  | 'community-script'
  | 'cloud-image'
  | 'template-clone'
  | 'blank-iso'
  | 'vm-clone';

/** The kind of resource a path produces — drives LXC-vs-VM branching. */
export type WizardResourceKind = 'lxc' | 'vm';

/**
 * A wizard step id. The shell owns `path`; the sibling step plans own the
 * `source` / `resources` / `network` / `cloud-init` / `review` step bodies and
 * mount them against this id surface.
 */
export type WizardStepId =
  | 'path'
  | 'source'
  | 'resources'
  | 'network'
  | 'cloud-init'
  | 'review';

/** Human label for each step — rendered in the stepper rail (Label 13/500). */
export const WIZARD_STEP_LABEL: Record<WizardStepId, string> = {
  path: 'Path',
  source: 'Source',
  resources: 'Resources',
  network: 'Network',
  'cloud-init': 'Cloud-Init',
  review: 'Review'
};

/**
 * The path-conditional step model (UI-SPEC §"Create wizard" step-model table,
 * D-03).
 *
 * Every path is `Path → Source → Resources → Network → [Cloud-Init] → Review`.
 * The Cloud-Init step appears on all four VM paths (D-13) and is ABSENT from
 * both LXC paths. Passing `null` (no path chosen yet) yields just the Path
 * step — Step 1 always renders.
 */
export function stepsForPath(path: WizardPath | null): WizardStepId[] {
  if (path === null) return ['path'];
  const kind = pathKind(path);
  const middle: WizardStepId[] =
    kind === 'lxc'
      ? ['source', 'resources', 'network']
      : ['source', 'resources', 'network', 'cloud-init'];
  return ['path', ...middle, 'review'];
}

/** Which resource kind a path produces. */
export function pathKind(path: WizardPath): WizardResourceKind {
  return path === 'plain-lxc' || path === 'community-script' ? 'lxc' : 'vm';
}

/**
 * Step-1 Next gate — `Next` stays disabled until a path card is chosen
 * (UI-SPEC §Path-picker contract).
 */
export function canAdvanceFromPathStep(path: WizardPath | null): boolean {
  return path !== null;
}

/**
 * Whether closing the wizard now should prompt the discard `alert-dialog`
 * (UI-SPEC §"Wizard chrome contract" — "Closing mid-wizard prompts an
 * alert-dialog"). There is "progress to discard" once a path has been chosen
 * OR the user has moved past Step 1. With no progress the close is silent.
 */
export function shouldPromptDiscard(
  path: WizardPath | null,
  activeStep: number
): boolean {
  return path !== null || activeStep > 1;
}

// ---------------------------------------------------------------------------
// The six path-picker cards (Copywriting Contract — pinned verbatim)
// ---------------------------------------------------------------------------

/** One path-picker card definition. */
export interface PathCard {
  /** The provisioning path this card selects. */
  path: WizardPath;
  /**
   * The lucide icon NAME (the component is resolved in PathPicker.svelte —
   * keeping the name as a string lets this module stay framework-free + unit
   * testable). One of: Container, Rocket, Disc, Boxes, Image, Copy.
   */
  iconName: 'Container' | 'Rocket' | 'Disc' | 'Boxes' | 'Image' | 'Copy';
  /** Card title — Body 14/600 (Copywriting Contract). */
  title: string;
  /** One-line "what this does" — Label 13/400 muted (Copywriting Contract). */
  description: string;
  /** The resource kind — `lxc` or `vm`. */
  kind: WizardResourceKind;
}

/**
 * The six provisioning-path cards, in the pinned grid order (UI-SPEC
 * §Copywriting Contract §"Path-picker cards"). Titles + descriptions + icons
 * are verbatim from the contract.
 */
export const PATH_CARDS: readonly PathCard[] = [
  {
    path: 'plain-lxc',
    iconName: 'Container',
    title: 'Plain LXC',
    description: 'A lightweight container from a system template.',
    kind: 'lxc'
  },
  {
    path: 'community-script',
    iconName: 'Rocket',
    title: 'Community Script',
    description: 'One-click install a curated app into a new container.',
    kind: 'lxc'
  },
  {
    path: 'cloud-image',
    iconName: 'Disc',
    title: 'Cloud-Init image',
    description: 'A VM from an Ubuntu, Debian, or Rocky cloud image.',
    kind: 'vm'
  },
  {
    path: 'template-clone',
    iconName: 'Boxes',
    title: 'Clone a template',
    description: 'A VM cloned from an existing Proxmox template.',
    kind: 'vm'
  },
  {
    path: 'blank-iso',
    iconName: 'Image',
    title: 'Blank VM + ISO',
    description: 'An empty VM that boots from an installation ISO.',
    kind: 'vm'
  },
  {
    path: 'vm-clone',
    iconName: 'Copy',
    title: 'Clone a VM',
    description: 'A copy of one of your existing VMs.',
    kind: 'vm'
  }
] as const;

/** The set of valid path identifiers — used to validate a rehydrated draft. */
export const KNOWN_PATHS: ReadonlySet<string> = new Set(PATH_CARDS.map((c) => c.path));

/**
 * The path-specific terminal CTA label on the Review step's footer
 * (Copywriting Contract §"Primary CTAs"). The sibling step plans read this so
 * the footer's final button is correct per path.
 */
export const FINAL_CTA_LABEL: Record<WizardPath, string> = {
  'plain-lxc': 'Create container',
  'community-script': 'Deploy script',
  'cloud-image': 'Create VM',
  'template-clone': 'Create VM',
  'blank-iso': 'Create VM',
  'vm-clone': 'Clone VM'
};

// ---------------------------------------------------------------------------
// D-04 post-submit routing helper
// ---------------------------------------------------------------------------

/**
 * D-04 post-submit landing — build the `/inventory/{cluster}/{vmid}` path the
 * wizard navigates to on a successful 202.
 *
 * The reserved `vmid` is read off the `ProvisioningJobAccepted` body (the
 * backend reserves it pre-create via the Phase-3 `reserve_vmid`), NEVER the
 * `job_id`. The sibling step plans call this helper so the routing rule lives
 * in exactly one place.
 */
export function inventoryPathForJob(
  clusterId: number,
  job: ProvisioningJobAccepted
): string {
  return `/inventory/${clusterId}/${job.vmid}`;
}
