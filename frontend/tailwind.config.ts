import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 uses CSS-first configuration via `@theme` in `src/app.css`.
 * This file exists so shadcn-svelte's `components.json` can point at it, and
 * so the dark-mode strategy + content globs are explicit for tooling that
 * still reads the JS config.
 */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,svelte,ts}']
} satisfies Config;
