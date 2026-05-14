// Re-export of the canonical `cn` helper from $lib/utils.
//
// Why a shim: PLAN.md lists `$lib/utils/cn.ts` in its files manifest, but
// modern shadcn-svelte (v1.2.7) generates components that import from
// `$lib/utils.js`. Both paths must resolve to the same function, so this
// file simply re-exports.
//
// New code should import from `$lib/utils` directly. This shim exists for
// audit-trail compliance with the plan's explicit file list.
export { cn } from '$lib/utils';
