// Login server load — empty.
//
// +layout.server.ts already redirects authenticated users away from /login,
// so by the time we reach this load function we know the visitor is
// unauthenticated. There is nothing to fetch up-front; the form submits
// client-side via api.auth.login.

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return {};
};
