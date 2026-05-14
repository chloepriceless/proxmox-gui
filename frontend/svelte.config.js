import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * SvelteKit config — Phase 1 scaffold (Plan 01-03).
 *
 * Notes:
 * - adapter-node: single-LXC deployment supervised by systemd.
 * - $lib alias: shadcn-svelte components and stores import via `$lib/*`.
 * - kit.csrf.checkOrigin = false (via empty trustedOrigins): Caddy is the
 *   trust boundary and the API enforces a double-submit CSRF cookie pattern
 *   (decision D-13). The API-side csrf_protect dependency is the
 *   authoritative check; SvelteKit's built-in same-origin check is left at
 *   defaults so it remains active for SvelteKit-handled form POSTs while the
 *   API handles its own.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      $lib: './src/lib'
    }
  }
};

export default config;
