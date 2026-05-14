import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';
import type { AuditFilterParams } from '$lib/api/types';

function parseFilters(url: URL): AuditFilterParams {
  const sp = url.searchParams;
  const list = (k: string) => {
    const v = sp.get(k);
    return v ? v.split(',').filter(Boolean) : undefined;
  };
  return {
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    action: list('action'),
    user_id: sp.get('user_id') ? Number(sp.get('user_id')) : undefined,
    target_type: list('type'),
    vmid: sp.get('vmid') ? Number(sp.get('vmid')) : undefined,
    cluster_id: sp.get('cluster_id') ? Number(sp.get('cluster_id')) : undefined,
    show_team_actions: sp.get('show_team_actions') === '1' || sp.get('show_team_actions') === 'true',
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    page_size: 50,
  };
}

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  const filters = parseFilters(url);
  try {
    const page = await api.audit.list({ filters }, { fetch });
    return { user: locals.user, page, filters, loadError: false };
  } catch {
    return {
      user: locals.user,
      page: { rows: [], total: 0, page: 1, page_size: 50 },
      filters,
      loadError: true,
    };
  }
};
