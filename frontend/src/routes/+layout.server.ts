// Root layout server load — STUB shipped in Plan 01-03 (frontend-scaffold).
//
// TODO(01-08): replace with real auth probe.
//
// Plan 01-08 (frontend-auth-shell) will replace this stub with:
//   1. GET /api/v1/me — hydrate `user` (or redirect to /login on 401)
//   2. GET /api/v1/setup/status — set `setupNeeded` (or 404 the /setup route
//      when an admin already exists, per first-run wizard contract)
//
// For Phase 1 Plan 03 we ship the contract shape: { user, setupNeeded,
// apiReachable } so downstream pages can render their loading/empty states
// without a backend present. The /health probe (Plan 01-01 endpoint) tells
// us whether the API is reachable; we tolerate failure so the frontend dev
// loop works without uvicorn running.

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch }) => {
  let apiReachable = false;
  try {
    const res = await fetch('/api/v1/health');
    apiReachable = res.ok;
  } catch {
    apiReachable = false;
  }
  return {
    user: null,
    setupNeeded: false,
    apiReachable
  };
};
