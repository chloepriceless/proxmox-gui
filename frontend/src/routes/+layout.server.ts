// Root layout server load — real auth probe (Plan 01-08).
//
// Behaviour:
//   1. Probe GET /api/v1/setup/status (open endpoint, no auth required).
//      If `no_admin_yet` is true, redirect every non-/setup route to /setup.
//   2. Probe GET /api/v1/me with same-origin cookies forwarded by event.fetch
//      (Pitfall A7). 200 → user; 401/403 → null.
//   3. If user is null AND not on /login or /setup, redirect to /login with
//      the original pathname preserved as `?next=...`.
//   4. Return { user, setupNeeded, apiReachable } for the SPA layout.

import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { LayoutServerLoad } from './$types';

const SETUP_PREFIX = '/setup';
const LOGIN_PATH = '/login';

function isSetupRoute(pathname: string): boolean {
  return pathname === SETUP_PREFIX || pathname.startsWith(`${SETUP_PREFIX}/`);
}

function isLoginRoute(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
}

export const load: LayoutServerLoad = async ({ fetch, url }) => {
  const setupStatus = await api.setup.status({ fetch });
  const apiReachable = setupStatus !== null;

  // 1. setup-needed gate (no_admin_yet) — redirects everywhere EXCEPT /setup
  // routes themselves. /login and /setup are otherwise treated symmetrically:
  // both are unauthenticated public surfaces.
  if (setupStatus?.no_admin_yet) {
    if (!isSetupRoute(url.pathname)) {
      throw redirect(303, '/setup');
    }
    return { user: null, setupNeeded: true, apiReachable };
  }

  // 2. auth probe via /me. Returns null on 401/403/network failure.
  const user = apiReachable ? await api.me.get({ fetch }) : null;

  // 3. unauth gate — redirect to /login if not on /login or /setup.
  if (user === null) {
    if (!isLoginRoute(url.pathname) && !isSetupRoute(url.pathname)) {
      const next = url.pathname + url.search;
      const search = next === '/' ? '' : `?next=${encodeURIComponent(next)}`;
      throw redirect(303, `${LOGIN_PATH}${search}`);
    }
    return { user: null, setupNeeded: false, apiReachable };
  }

  // 4. happy path — admin already exists, user is logged in.
  return { user, setupNeeded: false, apiReachable };
};
