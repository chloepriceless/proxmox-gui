// /admin/clusters/[id] — SSR loader.
//
// Admin gate + SSR fetch of the cluster being edited. 404 from the backend
// becomes a SvelteKit 404 page.

import { error, redirect } from '@sveltejs/kit';
import { api, ApiError } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, '/');
  }

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw error(404, 'Cluster not found');
  }

  try {
    const cluster = await api.clusters.get({ id }, { fetch });
    return { user: locals.user, cluster };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw error(404, 'Cluster not found');
    }
    throw error(500, 'Could not load cluster');
  }
};
