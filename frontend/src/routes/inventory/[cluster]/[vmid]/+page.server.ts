// /inventory/[cluster]/[vmid] — SSR loader for VM/LXC detail.
//
// Defence-in-depth auth gate (Plan 01-09 pattern).
//
// Type resolution: tries VM first, falls back to LXC. Both 403 → 404 so URL
// probing can't distinguish "doesn't exist" from "access denied"
// (T-02-05-06 / T-02-03-01 carry-through).
//
// On any non-403 API error: returns loadError=true with detail=null so the
// page can render a graceful error state.
//
// Plan 03-07: the Backups tab needs the cluster's `backup_storage` (D-08) to
// know whether to disable the backup surfaces. `GET /clusters/{id}` is
// admin-gated, so this is a best-effort fetch — non-admin users get
// `backupStorageConfigured: true` and the backend's 409 guard is the real
// enforcement point.

import { error, redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import { ApiError } from '$lib/utils/api';
import type { PageServerLoad } from './$types';

/**
 * Best-effort read of the cluster's backup-storage designation. Returns
 * `true` (optimistic) when the cluster cannot be fetched — e.g. a non-admin
 * user (the `GET /clusters/{id}` route is admin-only). The backend `POST
 * .../backup` 409 guard remains the authoritative D-08 enforcement.
 */
async function probeBackupStorage(
  clusterId: number,
  fetch: typeof globalThis.fetch
): Promise<boolean> {
  try {
    const cluster = await api.clusters.get({ id: clusterId }, { fetch });
    return !!cluster.backup_storage;
  } catch {
    return true;
  }
}

export const load: PageServerLoad = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }

  const clusterId = Number(params.cluster);
  const vmid = Number(params.vmid);

  if (!Number.isInteger(clusterId) || clusterId <= 0 || !Number.isInteger(vmid) || vmid <= 0) {
    throw error(404, 'Not found');
  }

  // Try VM first; on 403 fall back to LXC (D-01: detail page auto-detects type).
  // Both 403 → surface 404 (T-02-05-06: don't leak existence across tenants).
  try {
    const detail = await api.inventory.getDetail({ clusterId, vmid, type: 'vm', fetch });
    const backupStorageConfigured = await probeBackupStorage(clusterId, fetch);
    return { user: locals.user, detail, backupStorageConfigured, loadError: false };
  } catch (e1) {
    if (!(e1 instanceof ApiError && e1.status === 403)) {
      // Non-auth error on VM try — still attempt LXC before giving up.
    }
    try {
      const detail = await api.inventory.getDetail({ clusterId, vmid, type: 'lxc', fetch });
      const backupStorageConfigured = await probeBackupStorage(clusterId, fetch);
      return { user: locals.user, detail, backupStorageConfigured, loadError: false };
    } catch (e2) {
      if (e2 instanceof ApiError && (e2.status === 403 || e2.status === 404)) {
        // Cross-tenant existence probe prevention: return 404 for both cases.
        throw error(404, 'Not found');
      }
      // Other errors (network, 500, etc.) — render graceful error state.
      return {
        user: locals.user,
        detail: null,
        backupStorageConfigured: true,
        loadError: true,
      };
    }
  }
};
