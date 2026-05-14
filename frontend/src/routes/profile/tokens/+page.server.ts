// /profile/tokens — SSR loader.
//
// Defence-in-depth auth check + pre-fetch the PAT list. The list NEVER
// carries plaintext (T-01-09-01); plaintext only ever appears in the POST
// response and is shown once via SecretRevealDialog.

import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const tokens = await api.me.listTokens({ fetch });
    return { user: locals.user, tokens, loadError: false };
  } catch {
    return { user: locals.user, tokens: [], loadError: true };
  }
};
