import { error, redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) throw redirect(303, '/');
  const teamId = Number(params.id);
  if (!Number.isFinite(teamId) || teamId <= 0) throw error(404, 'Not found');
  try {
    const quotas = await api.quotas.getTeamQuotas({ teamId }, { fetch });
    return { user: locals.user, teamId, quotas, loadError: false };
  } catch {
    return {
      user: locals.user,
      teamId,
      quotas: { team_id: teamId, team_name: `Team ${teamId}`, rows: [] },
      loadError: true,
    };
  }
};
