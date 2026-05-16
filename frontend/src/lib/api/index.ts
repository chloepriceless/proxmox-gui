// Phase-4 API namespace re-export (Plan 04-09).
//
// The canonical typed import surface every page uses is `$lib/api/client`
// (`api.provisioning.createLxc(...)`, etc.). This `index.ts` re-exports the
// five Phase-4 API client modules — provisioning, catalog, networks, iso,
// console — under the same `api` namespace so they are reachable both via
// the namespace AND via a direct module import:
//
//   import { api } from '$lib/api';                  // the namespace
//   import * as provisioning from '$lib/api/provisioning';  // a single module
//
// The five Wave-3 modules are thin typed wrappers over the shipped Wave-2
// backend routes (Plans 04-04..08); all authorization is enforced server-side
// (threat T-04-09-01/02 — the client cannot widen access).

export { api, ApiError } from './client';
export type { Api } from './client';
export type * from './types';

export * as provisioning from './provisioning';
export * as catalog from './catalog';
export * as networks from './networks';
export * as iso from './iso';
export * as console from './console';
export * as notifications from './notifications';
