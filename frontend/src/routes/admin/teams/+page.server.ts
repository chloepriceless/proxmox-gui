// /admin/teams — SSR loader.
//
// Defence-in-depth: re-check `event.locals.user` AND `is_admin` here. The
// +layout.server.ts gate already redirects unauth users to /login, but a
// non-admin landing on /admin/* must also be turned away.
//
// Pre-fetches the team list via SSR so the first paint is populated.

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
    const teams = await api.teams.list({ fetch });
    return { user: locals.user, teams, loadError: false };
  } catch {
    return { user: locals.user, teams: [], loadError: true };
  }
};
