// Server-side request hooks — stub for Plan 01-03.
//
// Plan 01-08 (frontend-auth-shell) wires auth gating here: it will inspect
// the access JWT cookie, populate event.locals.user via /api/v1/me, and
// redirect unauthenticated requests away from protected routes.

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  return resolve(event);
};
