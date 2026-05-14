// /profile/ssh-keys — SSR loader.
//
// Defence-in-depth auth check (see /profile/+page.server.ts rationale).
// Pre-fetches the SSH key list so the first paint already shows the user's
// existing keys (no client-side spinner on initial render).
//
// SSR fetch passes `event.fetch` so cookies forward (Pitfall A7); on a 401
// during cookie probing the layout server will already have redirected, but
// we still defend at this loader.

import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const keys = await api.me.listSshKeys({ fetch });
    return { user: locals.user, keys, loadError: false };
  } catch {
    // Network / unexpected backend error — render the page with empty state
    // so the user can still try the "Add key" flow. Toast surfaces the error
    // client-side via the page's onMount derivation.
    return { user: locals.user, keys: [], loadError: true };
  }
};
