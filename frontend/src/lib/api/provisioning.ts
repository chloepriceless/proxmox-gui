// /api/v1 provisioning create methods (Plan 04-09).
//
// Consumes the Plan 04-04 provisioning backend — every create route returns
// 202 Accepted with a job id; the worker polls the UPID, the Tasks-drawer
// WebSocket streams progress (CLAUDE.md constraint #1 — no UI surface blocks
// on a UPID poll):
//   POST /clusters/{id}/provisioning/lxc               → 202 ProvisioningJobAccepted
//   POST /clusters/{id}/provisioning/qemu              → 202 ProvisioningJobAccepted
//   POST /clusters/{id}/provisioning/community-script  → 202 ProvisioningJobAccepted
//   POST /clusters/{id}/provisioning/cloudinit/preview → 200 CloudInitPreviewResponse
//
// Pattern: mirrors lifecycle.ts verbatim (withFetch helper, MaybeFetch opts,
// apiJson<T> for typed calls, per-function JSDoc documenting the route).

import { apiJson, type ApiInit } from '$lib/utils/api';
import type {
  CloudInitForm,
  CloudInitPreviewResponse,
  CommunityScriptRequest,
  CreateLxcRequest,
  CreateQemuRequest,
  ProvisioningJobAccepted,
} from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/**
 * POST /api/v1/clusters/{id}/provisioning/lxc — provision a plain LXC.
 *
 * Returns the 202 `ProvisioningJobAccepted` body. Its `vmid` is the
 * app-reserved VMID — the wizard routes to `/inventory/{cluster}/{vmid}`
 * immediately on the 202 (D-04).
 */
export async function createLxc(
  args: { clusterId: number; body: CreateLxcRequest },
  opts?: MaybeFetch
): Promise<ProvisioningJobAccepted> {
  return apiJson<ProvisioningJobAccepted>(
    `/clusters/${args.clusterId}/provisioning/lxc`,
    withFetch(opts, { method: 'POST', body: { ...args.body } })
  );
}

/**
 * POST /api/v1/clusters/{id}/provisioning/qemu — provision a VM.
 *
 * The `source_kind` discriminates the path (cloud-image / blank-iso /
 * template-clone / vm-clone). Returns the 202 `ProvisioningJobAccepted` body;
 * its `vmid` is the app-reserved VMID the wizard routes to (D-04).
 */
export async function createQemu(
  args: { clusterId: number; body: CreateQemuRequest },
  opts?: MaybeFetch
): Promise<ProvisioningJobAccepted> {
  return apiJson<ProvisioningJobAccepted>(
    `/clusters/${args.clusterId}/provisioning/qemu`,
    withFetch(opts, { method: 'POST', body: { ...args.body } })
  );
}

/**
 * POST /api/v1/clusters/{id}/provisioning/community-script — a one-click
 * community-script deploy (LXC-03). Enqueues a two-stage create + install
 * job. Returns the 202 `ProvisioningJobAccepted` body (carries `vmid`).
 */
export async function createCommunityScript(
  args: { clusterId: number; body: CommunityScriptRequest },
  opts?: MaybeFetch
): Promise<ProvisioningJobAccepted> {
  return apiJson<ProvisioningJobAccepted>(
    `/clusters/${args.clusterId}/provisioning/community-script`,
    withFetch(opts, { method: 'POST', body: { ...args.body } })
  );
}

/**
 * POST /api/v1/clusters/{id}/provisioning/cloudinit/preview — render the
 * effective `#cloud-config` + validate the form (VM-05/06/07).
 *
 * A pure transform — no PVE call, no DB write. The two-pane Cloud-Init editor
 * calls this on every form change for the live YAML pane (`lines`) and the
 * block-hard / warn-soft verdict (`verdict`).
 */
export async function cloudinitPreview(
  args: { clusterId: number; body: CloudInitForm },
  opts?: MaybeFetch
): Promise<CloudInitPreviewResponse> {
  return apiJson<CloudInitPreviewResponse>(
    `/clusters/${args.clusterId}/provisioning/cloudinit/preview`,
    withFetch(opts, { method: 'POST', body: { ...args.body } })
  );
}
