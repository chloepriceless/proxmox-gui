// /inventory — SSR loader.
//
// Defence-in-depth auth gate: re-checks locals.user even though +layout.server.ts
// already gates every authenticated route (Plan 01-09 pattern — stale browser
// tab protection).
//
// Calls api.inventory.listAll which hits GET /api/v1/me/inventory and returns
// all ClusterInventory objects the current user has access to.
//
// On API failure: returns loadError=true and an empty inventory array so the
// page can render a graceful "Couldn't load inventory" error state without
// crashing the SSR render.

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
    return { user: locals.user, inventory, loadError: false };
  } catch {
    return { user: locals.user, inventory: [], loadError: true };
  }
};
