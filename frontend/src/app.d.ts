// See https://svelte.dev/docs/kit/types#app
import type { User } from '$lib/api/types';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user: User | null;
    }
    interface PageData {
      user: User | null;
      setupNeeded: boolean;
      apiReachable: boolean;
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
