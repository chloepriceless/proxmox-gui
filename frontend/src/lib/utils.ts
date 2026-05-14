// Canonical shadcn-svelte helpers — every component in $lib/components/ui/
// imports `cn` and `WithElementRef` from this file. Do not relocate.
//
// Plan 01-03 deviation (Rule 3): Modern shadcn-svelte (v1.2.7) generates
// components that import from `$lib/utils.js`. The PLAN.md files list
// `$lib/utils/cn.ts`, which is the legacy layout. We keep `cn` here (so the
// generated components resolve correctly) and place additional helpers
// (`csrf.ts`, `api.ts`) under `$lib/utils/`. Both resolve cleanly because
// TypeScript's module resolver matches the exact file path first.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Adds an optional `ref` and a generic element override to a component's
 * attribute set. Used pervasively by shadcn-svelte primitive components so
 * consumers can `bind:ref` and override the HTML element.
 */
export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, 'child'> : T;
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};
