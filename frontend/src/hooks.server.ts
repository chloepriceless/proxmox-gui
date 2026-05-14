// Server-side request hooks (Plan 01-08).
//
// We populate `event.locals.user` from a same-origin probe of /api/v1/me so
// downstream `+page.server.ts` loaders can read it without re-fetching. The
// authoritative redirect logic lives in `+layout.server.ts` which is the
// single per-request gate; this handler only hydrates state.
//
// Pitfall A7: `event.fetch` forwards same-origin cookies automatically.

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  try {
    const res = await event.fetch('/api/v1/me/');
    if (res.ok) {
      event.locals.user = await res.json();
    }
  } catch {
    // Backend unreachable: leave user as null. The +layout.server.ts probe
    // will independently observe `apiReachable=false` and degrade gracefully.
  }
  return resolve(event);
};
