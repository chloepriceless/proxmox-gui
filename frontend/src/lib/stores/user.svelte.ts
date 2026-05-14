// Current-user store — hydrated from +layout.svelte's data.user every load.
//
// Plan 01-08 (frontend-auth-shell) hydrates this from the real /api/v1/me
// probe done in +layout.server.ts.

import type { User } from '$lib/api/types';

export type CurrentUser = User | null;

class UserStore {
  current: CurrentUser = $state(null);

  set(u: CurrentUser): void {
    this.current = u;
  }

  clear(): void {
    this.current = null;
  }
}

export const user = new UserStore();
