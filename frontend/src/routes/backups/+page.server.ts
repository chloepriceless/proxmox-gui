// /backups — SSR loader for the global scheduled-backup overview page.
//
// Structure copied verbatim from `audit/+page.server.ts`:
//   - Defence-in-depth auth gate: re-check `locals.user`, redirect to /login
//     with a `?next=` round-trip (T-03-07-01 — even though the layout already
//     gates, a stale tab landing here must never render a phantom UI).
//   - SSR pre-fetch passing `event.fetch` into the api client so the session
//     cookie forwards (Pitfall A7).
//
// `GET /backups/schedules` is team-scoped server-side (Plan 03-04
// `_team_ids_for_user`) — the page renders only what the server returns
// (T-03-07-04).

import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const schedules = await api.lifecycle.listScheduledBackups({ fetch });
    return { user: locals.user, schedules, loadError: false };
  } catch {
    return { user: locals.user, schedules: [], loadError: true };
  }
};
