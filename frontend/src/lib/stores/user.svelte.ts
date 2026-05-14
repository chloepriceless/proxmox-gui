// Current-user store — placeholder shape for Plan 01-03.
//
// Plan 01-08 (frontend-auth-shell) wires the real /api/v1/me probe in
// +layout.server.ts and hydrates this store from `data.user` in
// +layout.svelte. For Phase 1 Plan 03 we ship the contract so downstream
// code can compile against the final import path.

export type CurrentUser = {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
} | null;

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
