// /admin/users — SSR loader.
//
// Defence-in-depth: re-check `event.locals.user` AND `is_admin` here. The
// +layout.server.ts gate (Plan 08) already redirects unauth users to /login,
// but a non-admin user landing on /admin/* must also be turned away (Plan 07's
// require_admin would return 403, but we redirect to / for a better UX).
//
// Pre-fetches the user list via SSR so the first paint is populated.

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
    const users = await api.users.list({ fetch });
    return { user: locals.user, users, loadError: false };
  } catch {
    return { user: locals.user, users: [], loadError: true };
  }
};
