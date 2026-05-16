// /api/v1 lifecycle mutation methods.
//
// Consumes Plan 03-02 backend endpoints — every mutating route returns 202
// Accepted with a job id; the worker polls the UPID, the Tasks-drawer
// WebSocket streams progress (CLAUDE.md constraint #1 — no UI surface blocks
// on a UPID poll):
//   POST   /clusters/{id}/vms/{vmid}/power   { action } → 202 JobAccepted
//   POST   /clusters/{id}/lxcs/{vmid}/power  { action } → 202 JobAccepted
//   DELETE /clusters/{id}/vms/{vmid}                    → 202 JobAccepted
//   DELETE /clusters/{id}/lxcs/{vmid}                   → 202 JobAccepted
//   POST   /clusters/{id}/vms/bulk-power     { action, targets } → 202 BulkJobAccepted
//
// Pattern: mirrors inventory.ts verbatim (withFetch helper, basePath helper
// that picks vms/lxcs from `type`).

import { apiJson, type ApiInit } from '$lib/utils/api';
import type {
  BackupListResponse,
  BackupSchedule,
  BulkJobAccepted,
  CloneRequest,
  JobAccepted,
  MigrateRequest,
  PowerActionName,
  ResizeInfo,
  ResizeRequest,
  ResourceKind,
  ScheduledBackupRow,
  SnapshotListResponse,
} from './types';

type FetchLike = typeof fetch;

interface MaybeFetch {
  fetch?: FetchLike;
}

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

/** Picks the `vms` / `lxcs` URL segment from a ResourceKind. */
function basePath(clusterId: number, kind: ResourceKind, vmid: number): string {
  const seg = kind === 'lxc' ? 'lxcs' : 'vms';
  return `/clusters/${clusterId}/${seg}/${vmid}`;
}

/**
 * POST /api/v1/clusters/{id}/{vms|lxcs}/{vmid}/power — Start / Stop / Reboot /
 * Shutdown a single resource. Returns the 202 JobAccepted body.
 */
export async function power(
  args: {
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    action: PowerActionName;
  },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/power`,
    withFetch(opts, { method: 'POST', body: { action: args.action } })
  );
}

/**
 * DELETE /api/v1/clusters/{id}/{vms|lxcs}/{vmid} — purge a resource. Returns
 * the 202 JobAccepted body.
 */
export async function del(
  args: { clusterId: number; vmid: number; type: ResourceKind },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    basePath(args.clusterId, args.type, args.vmid),
    withFetch(opts, { method: 'DELETE' })
  );
}

/**
 * POST /api/v1/clusters/{id}/vms/bulk-power — fan a power action out across a
 * selection. Per Plan 03-02 the route lives under one cluster prefix; the
 * `targets` each carry their own `cluster_id` so the backend re-resolves
 * access per target (the prefix cluster id is path chrome only). We pass the
 * first target's cluster id as that prefix.
 */
export async function bulkPower(
  args: {
    action: PowerActionName;
    targets: { cluster_id: number; vmid: number }[];
  },
  opts?: MaybeFetch
): Promise<BulkJobAccepted> {
  const prefixCluster = args.targets[0]?.cluster_id;
  if (prefixCluster === undefined) {
    throw new Error('bulkPower requires at least one target');
  }
  return apiJson<BulkJobAccepted>(
    `/clusters/${prefixCluster}/vms/bulk-power`,
    withFetch(opts, { method: 'POST', body: { action: args.action, targets: args.targets } })
  );
}

// ---------------------------------------------------------------------------
// Plan 03-06 — snapshot lifecycle (Plan 03-03 backend contracts)
//
//   GET    /clusters/{id}/{vms|lxcs}/{vmid}/snapshots               → SnapshotListResponse
//   POST   /clusters/{id}/{vms|lxcs}/{vmid}/snapshots               → 202 JobAccepted
//   POST   /clusters/{id}/{vms|lxcs}/{vmid}/snapshots/{name}/rollback → 202 JobAccepted
//   DELETE /clusters/{id}/{vms|lxcs}/{vmid}/snapshots/{name}         → 202 JobAccepted
// ---------------------------------------------------------------------------

/**
 * GET .../snapshots — the flat parent-pointer snapshot list (a pure read, no
 * job). The Snapshots tab hands this to `SnapshotTree.svelte`, which builds the
 * indented hierarchy client-side (D-05).
 */
export async function listSnapshots(
  args: { clusterId: number; vmid: number; type: ResourceKind },
  opts?: MaybeFetch
): Promise<SnapshotListResponse> {
  return apiJson<SnapshotListResponse>(
    `${basePath(args.clusterId, args.type, args.vmid)}/snapshots`,
    withFetch(opts, { method: 'GET' })
  );
}

/** POST .../snapshots — create a snapshot. `vmstate` captures running RAM. */
export async function createSnapshot(
  args: {
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    name: string;
    description: string;
    vmstate: boolean;
  },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/snapshots`,
    withFetch(opts, {
      method: 'POST',
      body: { name: args.name, description: args.description, vmstate: args.vmstate },
    })
  );
}

/** POST .../snapshots/{name}/rollback — roll the VM back to a snapshot. */
export async function rollbackSnapshot(
  args: { clusterId: number; vmid: number; type: ResourceKind; name: string },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/snapshots/${encodeURIComponent(
      args.name
    )}/rollback`,
    withFetch(opts, { method: 'POST' })
  );
}

/** DELETE .../snapshots/{name} — delete a snapshot. */
export async function deleteSnapshot(
  args: { clusterId: number; vmid: number; type: ResourceKind; name: string },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/snapshots/${encodeURIComponent(
      args.name
    )}`,
    withFetch(opts, { method: 'DELETE' })
  );
}

// ---------------------------------------------------------------------------
// Plan 03-06 — resize lifecycle (Plan 03-03 backend contracts)
//
//   GET  /clusters/{id}/{vms|lxcs}/{vmid}/resize-info → ResizeInfo
//   POST /clusters/{id}/{vms|lxcs}/{vmid}/resize      → 202 JobAccepted
// ---------------------------------------------------------------------------

/**
 * GET .../resize-info — current cores/memory + the disk list + the
 * hotplug-derived reboot-required flags. The Resize dialog reads this on open.
 */
export async function getResizeInfo(
  args: { clusterId: number; vmid: number; type: ResourceKind },
  opts?: MaybeFetch
): Promise<ResizeInfo> {
  return apiJson<ResizeInfo>(
    `${basePath(args.clusterId, args.type, args.vmid)}/resize-info`,
    withFetch(opts, { method: 'GET' })
  );
}

/**
 * POST .../resize — apply a CPU / memory / disk-grow change. The backend
 * rejects a disk shrink 422 (LIFE-09 enforcement point); the UI min is a UX
 * affordance only.
 */
export async function resize(
  args: { clusterId: number; vmid: number; type: ResourceKind; body: ResizeRequest },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/resize`,
    withFetch(opts, { method: 'POST', body: { ...args.body } })
  );
}

// ---------------------------------------------------------------------------
// Plan 03-06 — clone / convert-template / migrate (Plan 03-04 backend contracts)
//
//   POST /clusters/{id}/{vms|lxcs}/{vmid}/clone            → 202 JobAccepted
//   POST /clusters/{id}/vms/{vmid}/convert-template        → 202 JobAccepted
//   POST /clusters/{id}/{vms|lxcs}/{vmid}/migrate          → 202 JobAccepted
// ---------------------------------------------------------------------------

/**
 * POST .../clone — linked/full clone. Omit `new_vmid` to let the server
 * auto-assign the VMID via its app-level reservation (Pitfall 1).
 */
export async function clone(
  args: { clusterId: number; vmid: number; type: ResourceKind; body: CloneRequest },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/clone`,
    withFetch(opts, { method: 'POST', body: { ...args.body } })
  );
}

/**
 * POST .../convert-template — convert a qemu VM to a template (one-way). The
 * backend rejects an LXC 422; the toolbar disables the menu item for LXC.
 */
export async function convertTemplate(
  args: { clusterId: number; vmid: number },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `/clusters/${args.clusterId}/vms/${args.vmid}/convert-template`,
    withFetch(opts, { method: 'POST' })
  );
}

/**
 * POST .../migrate — live/offline migrate to another node. `bwlimit_mbps` is
 * MB/s (0 = unlimited); the backend converts to PVE's KiB/s.
 */
export async function migrate(
  args: { clusterId: number; vmid: number; type: ResourceKind; body: MigrateRequest },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/migrate`,
    withFetch(opts, { method: 'POST', body: { ...args.body } })
  );
}

// ---------------------------------------------------------------------------
// Plan 03-07 — backup / restore / schedule (Plan 03-04 backend contracts)
//
//   POST   /clusters/{id}/{vms|lxcs}/{vmid}/backup            → 202 JobAccepted
//                                                               (409 if no
//                                                               backup_storage)
//   GET    /clusters/{id}/{vms|lxcs}/{vmid}/backups           → BackupListResponse
//   POST   /clusters/{id}/{vms|lxcs}/{vmid}/restore           → 202 JobAccepted
//   GET    /clusters/{id}/{vms|lxcs}/{vmid}/backup-schedule   → BackupSchedule
//   PUT    /clusters/{id}/{vms|lxcs}/{vmid}/backup-schedule   → BackupSchedule
//   DELETE /clusters/{id}/{vms|lxcs}/{vmid}/backups/{volid}   → 202 JobAccepted
//   GET    /backups/schedules                                 → ScheduledBackupRow[]
// ---------------------------------------------------------------------------

/**
 * POST .../backup — enqueue a manual vzdump. Returns the 202 JobAccepted body;
 * a 409 ApiError is thrown when the cluster has no designated backup storage
 * (D-08 — the UI guards this with a disabled button + banner, but the backend
 * is the enforcement point).
 */
export async function backupNow(
  args: { clusterId: number; vmid: number; type: ResourceKind },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/backup`,
    withFetch(opts, { method: 'POST' })
  );
}

/** GET .../backups — the VM's backup file list (a pure read, no job). */
export async function listBackups(
  args: { clusterId: number; vmid: number; type: ResourceKind },
  opts?: MaybeFetch
): Promise<BackupListResponse> {
  return apiJson<BackupListResponse>(
    `${basePath(args.clusterId, args.type, args.vmid)}/backups`,
    withFetch(opts, { method: 'GET' })
  );
}

/**
 * POST .../restore — restore from a backup archive. `mode` is "in_place"
 * (overwrite the existing VM) or "new" (a fresh VMID, runs quota admission
 * server-side). `new_vmid` / `new_name` are only used for the "new" mode.
 */
export async function restore(
  args: {
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    archive: string;
    mode: 'in_place' | 'new';
    new_vmid?: number;
    new_name?: string;
  },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/restore`,
    withFetch(opts, {
      method: 'POST',
      body: {
        archive: args.archive,
        mode: args.mode,
        ...(args.new_vmid !== undefined ? { new_vmid: args.new_vmid } : {}),
        ...(args.new_name !== undefined ? { new_name: args.new_name } : {}),
      },
    })
  );
}

/**
 * GET .../backup-schedule — the current backup schedule row, or `null` when
 * the VM has no schedule yet (the backend returns `null`, not 404).
 */
export async function getSchedule(
  args: { clusterId: number; vmid: number; type: ResourceKind },
  opts?: MaybeFetch
): Promise<BackupSchedule | null> {
  return apiJson<BackupSchedule | null>(
    `${basePath(args.clusterId, args.type, args.vmid)}/backup-schedule`,
    withFetch(opts, { method: 'GET' })
  );
}

/** PUT .../backup-schedule — upsert the backup schedule. Returns the saved row. */
export async function saveSchedule(
  args: {
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    enabled: boolean;
    frequency: 'daily' | 'weekly';
    keep_last: number;
  },
  opts?: MaybeFetch
): Promise<BackupSchedule> {
  return apiJson<BackupSchedule>(
    `${basePath(args.clusterId, args.type, args.vmid)}/backup-schedule`,
    withFetch(opts, {
      method: 'PUT',
      body: {
        enabled: args.enabled,
        frequency: args.frequency,
        keep_last: args.keep_last,
      },
    })
  );
}

/** DELETE .../backups/{volid} — delete a backup file from storage. */
export async function deleteBackupFile(
  args: { clusterId: number; vmid: number; type: ResourceKind; volid: string },
  opts?: MaybeFetch
): Promise<JobAccepted> {
  return apiJson<JobAccepted>(
    `${basePath(args.clusterId, args.type, args.vmid)}/backups/${encodeURIComponent(
      args.volid
    )}`,
    withFetch(opts, { method: 'DELETE' })
  );
}

/**
 * GET /backups/schedules — the team-scoped scheduled-backup list for the
 * global `/backups` page (D-06).
 */
export async function listScheduledBackups(
  opts?: MaybeFetch
): Promise<ScheduledBackupRow[]> {
  return apiJson<ScheduledBackupRow[]>(
    '/backups/schedules',
    withFetch(opts, { method: 'GET' })
  );
}
