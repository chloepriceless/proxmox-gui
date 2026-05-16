// /create — the unified provisioning wizard SSR loader (Plan 04-10).
//
// Auth gate (T-04-10-01): the wizard route is authenticated + team-scoped.
// This loader re-checks `locals.user` and redirects an unauthenticated user
// to /login with the original path preserved as `?next=...` — defence in
// depth even though +layout.server.ts already gates every authenticated route
// (the Plan 01-09 stale-tab pattern). The real authorisation is enforced
// server-side on the create POST (Plan 04-04).
//
// Cluster context: the wizard needs the clusters the current user can
// provision into. `api.inventory.listAll` (GET /api/v1/me/inventory) is the
// team-scoped source — it returns one entry per cluster the user has access
// to (`api.clusters.list` is admin-only, so it cannot be used here). The
// wizard's Resources step (owned by 04-11/12) reads this cluster list.
//
// On API failure the loader degrades gracefully — `loadError=true` + an
// empty cluster list — so the wizard still renders Step 1 (the path picker
// needs no cluster) rather than crashing the SSR render.

import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }

  try {
    const inventory = await api.inventory.listAll({ fetch });
    const clusters = inventory.map((c) => ({
      id: c.cluster_id,
      name: c.cluster_name,
      status: c.cluster_status,
      is_stale: c.is_stale
    }));
    return { user: locals.user, clusters, loadError: false };
  } catch {
    return { user: locals.user, clusters: [], loadError: true };
  }
};
