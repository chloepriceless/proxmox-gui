// /admin/users/[id] — SSR loader.
//
// Defence-in-depth admin gate + SSR fetch of the target user AND the team list
// (the multi-select needs both). 404 from the backend → SvelteKit 404 via
// the `error` helper so navigation history stays sane.

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
    throw error(404, 'User not found');
  }

  try {
    const target = await api.users.get({ id }, { fetch });
    let teams: Awaited<ReturnType<typeof api.teams.list>> = [];
    try {
      teams = await api.teams.list({ fetch });
    } catch {
      // Team list failure is non-fatal — edit form can still update non-team fields.
      teams = [];
    }
    return { user: locals.user, target, teams };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw error(404, 'User not found');
    }
    throw error(500, 'Could not load user');
  }
};
