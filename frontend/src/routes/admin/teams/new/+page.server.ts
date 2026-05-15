// /admin/teams/new — SSR loader.
//
// Admin gate only (defence-in-depth) — the create form needs no pre-fetched
// data; a new team is just a name.

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, '/');
  }
  return { user: locals.user };
};
