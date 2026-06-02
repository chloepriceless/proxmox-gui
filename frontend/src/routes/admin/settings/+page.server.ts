// /admin/settings — SSR loader.
//
// Defence-in-depth admin gate (mirrors /admin/clusters) + SSR pre-fetch of the
// singleton admin settings row (Plan 05-06 D-01).

import { redirect } from '@sveltejs/kit';
import { getSettings } from '$lib/api/settings';
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
    const settings = await getSettings({ fetch });
    return { user: locals.user, settings, loadError: false };
  } catch {
    return { user: locals.user, settings: null, loadError: true };
  }
};
