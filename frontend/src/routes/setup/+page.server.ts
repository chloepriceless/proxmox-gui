// /setup server load — defence-in-depth gate.
//
// +layout.server.ts already redirects every non-/setup route to /setup when
// `no_admin_yet` is true; here we do the inverse — if the predicate is FALSE
// (admin already exists) we redirect away from /setup. This prevents the
// wizard from being visited after first-run completes.

import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  const status = await api.setup.status({ fetch });
  // If we can't reach the API, let the user see the wizard's "API unreachable"
  // copy rather than redirect. If we CAN reach it and admin exists, redirect.
  if (status && !status.no_admin_yet) {
    throw redirect(303, '/login');
  }
  return {};
};
