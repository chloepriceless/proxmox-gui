// provisioning-banner — the pure logic for the VM-detail provisioning banner
// (Plan 04-14, D-04, UI-04).
//
// Extracted from `inventory/[cluster]/[vmid]/+page.svelte` so the banner-state
// derivation is unit-testable in the `node` vitest env. The rendered markup is
// exercised end-to-end by `pnpm exec svelte-check`.
//
// References:
//   - 04-UI-SPEC §"Provisioning banner" — running / failed / dismissed states
//   - D-04 (post-submit landing) / Phase-3 D-16 (provisioning is
//     non-idempotent → NO Retry button)

import type { Job } from '$lib/api/types';

/** The job kinds that count as a "create" for the provisioning banner. */
const CREATE_KINDS = new Set(['vm.create', 'vm.create.qemu', 'lxc.create']);

/** The provisioning-banner state — `none` means the banner is not rendered. */
export type BannerState = 'none' | 'running' | 'failed';

/** In-flight job states — the banner shows the spinner for these. */
const IN_FLIGHT = new Set(['pending', 'claimed', 'running']);

/**
 * Find the create job for this VMID in the live job list, if any.
 *
 * The notification/job rows carry no vmid column, so the match is by kind +
 * cluster: the banner only ever shows on the detail page of a VM whose own
 * create job is the freshest create for that cluster. The caller passes the
 * vmid-tagged job when one is identifiable; this helper picks the newest
 * create job for the cluster as the fallback.
 */
export function findCreateJob(
  jobs: Job[],
  clusterId: number
): Job | null {
  const candidates = jobs
    .filter((j) => CREATE_KINDS.has(j.kind) && j.cluster_id === clusterId)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return candidates[0] ?? null;
}

/**
 * Derive the banner state from the create job.
 *
 * - in-flight  → `running` (bg-primary/10 + spinner)
 * - failed     → `failed`  (bg-destructive/10 + error + View-in-Tasks)
 * - succeeded  → `none`    (the banner self-dismisses; the status badge takes over)
 * - no job     → `none`
 */
export function bannerState(job: Job | null): BannerState {
  if (job === null) return 'none';
  if (IN_FLIGHT.has(job.state)) return 'running';
  if (job.state === 'failed') return 'failed';
  return 'none';
}

/** The running-banner copy — pinned (UI-SPEC §"Provisioning banner"). */
export function provisioningRunningText(name: string): string {
  return `Provisioning ${name}… This page updates automatically.`;
}

/**
 * The failure message — the curated friendly PVE error (Phase-3 Error
 * Presentation Contract), falling back to a generic line.
 */
export function provisioningFailureText(job: Job | null): string {
  return job?.friendly_error ?? job?.error ?? 'Provisioning failed.';
}
