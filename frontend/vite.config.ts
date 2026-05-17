import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // The vendored noVNC v1.6.0 client (src/lib/vendor/novnc, Plan 04-15) uses
  // top-level await in its WebCodecs H264 decoder probe. Vite's default build
  // target (es2020) rejects it. Top-level await is supported by every browser
  // this self-hosted admin GUI targets — tell esbuild to allow it through.
  esbuild: {
    supported: {
      'top-level-await': true
    }
  },
  server: {
    // Forward /api/* to FastAPI in development so `pnpm dev` works with the
    // backend (Plan 01-01) running on :8000 without CORS gymnastics.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: false
      }
    }
  },
  test: {
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    environment: 'node'
  }
});
