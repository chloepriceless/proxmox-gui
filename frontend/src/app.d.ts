// See https://svelte.dev/docs/kit/types#app
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user: { id: number; username: string; is_admin: boolean } | null;
    }
    interface PageData {
      user: { id: number; username: string; email: string; is_admin: boolean } | null;
      setupNeeded: boolean;
      apiReachable: boolean;
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
