// /profile — server load.
//
// Defence-in-depth: even though +layout.server.ts already gates unauth users
// to /login, we re-check `event.locals.user` here so a stale browser session
// reaching this route directly never renders a phantom "Profile" page for a
// signed-out user. (Plan 01-09 important_constraints.)
//
// The user object is already hydrated by hooks.server.ts (Plan 01-08); this
// loader just surfaces it so the page can read it via `data.user`.

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  return { user: locals.user };
};
