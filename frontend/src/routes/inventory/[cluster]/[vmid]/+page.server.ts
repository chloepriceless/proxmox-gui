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

import { error, redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import { ApiError } from '$lib/utils/api';
import type { PageServerLoad } from './$types';

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
    return { user: locals.user, detail, loadError: false };
  } catch (e1) {
    if (!(e1 instanceof ApiError && e1.status === 403)) {
      // Non-auth error on VM try — still attempt LXC before giving up.
    }
    try {
      const detail = await api.inventory.getDetail({ clusterId, vmid, type: 'lxc', fetch });
      return { user: locals.user, detail, loadError: false };
    } catch (e2) {
      if (e2 instanceof ApiError && (e2.status === 403 || e2.status === 404)) {
        // Cross-tenant existence probe prevention: return 404 for both cases.
        throw error(404, 'Not found');
      }
      // Other errors (network, 500, etc.) — render graceful error state.
      return { user: locals.user, detail: null, loadError: true };
    }
  }
};
