// /admin — the admin landing page SSR loader (Plan 04-11).
//
// Defence-in-depth admin gate (mirrors /admin/clusters/+page.server.ts): an
// unauthenticated user is redirected to /login, a non-admin to /. The page
// hosts the "Sync catalog" control (D-05) — the real authorisation is the
// `require_admin` on the backend `POST /catalog/sync`; this gate is
// defence-in-depth (T-04-11-02).

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
