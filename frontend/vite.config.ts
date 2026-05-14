import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
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
