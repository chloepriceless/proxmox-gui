// /admin/clusters — SSR loader.
//
// Defence-in-depth admin gate + SSR pre-fetch of the cluster list.

import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, '/');
  }
  try {
    const clusters = await api.clusters.list({ fetch });
    return { user: locals.user, clusters, loadError: false };
  } catch {
    return { user: locals.user, clusters: [], loadError: true };
  }
};
