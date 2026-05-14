// Typed API client — single import surface for every page.
//
// Usage:
//   import { api } from '$lib/api/client';
//   await api.auth.login({ username, password });
//   const me = await api.me.get();
//   const status = await api.setup.status();
//
// SSR loaders MUST pass `event.fetch` so cookies forward (Pitfall A7):
//   const me = await api.me.get({ fetch });
//   const status = await api.setup.status({ fetch });
//
// EXTENSION CONTRACT (for Plans 09 / 10 and beyond):
//   - Add new domain methods as a sibling module under `frontend/src/lib/api/`
//     (e.g. `users.ts`, `pats.ts`).
//   - Re-export the namespaced object below; never break the existing surface.
//   - Generated types may live under `./generated/` once openapi-ts is wired.
//
// Errors:
//   - Wrappers built on `apiJson<T>` throw `ApiError` (re-exported from
//     `$lib/utils/api`). Callers branch on `err.status` for 401 / 403 / 409
//     / 422 / 429 messaging per UI-SPEC §Error state copy.
//   - Wrappers built on `apiFetch` (currently `me.get` and `auth.logout`)
//     return null/void on auth failure rather than throwing — see those
//     modules for the exact behaviour.

import * as authModule from './auth';
import * as meModule from './me';
import * as setupModule from './setup';
import * as clustersModule from './clusters';
import * as usersModule from './users';
import * as teamsModule from './teams';

export { ApiError } from '$lib/utils/api';
export type * from './types';

export const api = {
  auth: authModule,
  me: meModule,
  setup: setupModule,
  clusters: clustersModule,
  users: usersModule,
  teams: teamsModule
} as const;

export type Api = typeof api;
