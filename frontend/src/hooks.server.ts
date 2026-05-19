// Server-side request hooks (Plan 01-08).
//
// We populate `event.locals.user` from a same-origin probe of /api/v1/me so
// downstream `+page.server.ts` loaders can read it without re-fetching. The
// authoritative redirect logic lives in `+layout.server.ts` which is the
// single per-request gate; this handler only hydrates state.
//
// Pitfall A7: `event.fetch` forwards same-origin cookies automatically.

import type { Handle } from '@sveltejs/kit';

// Dev/preview convenience: when the Node server runs without a real reverse
// proxy in front of it (e.g. `node build/index.js` for smoke-testing without
// Caddy), forward /api/* requests to the FastAPI backend. In production this
// path is unreachable because Caddy terminates /api/* upstream of Node.
const BACKEND_URL = process.env.PROXMOX_GUI_BACKEND_URL ?? 'http://127.0.0.1:8000';

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/api/')) {
    const upstream = `${BACKEND_URL}${event.url.pathname}${event.url.search}`;
    const headers = new Headers(event.request.headers);
    headers.delete('host');
    const init: RequestInit = {
      method: event.request.method,
      headers,
      redirect: 'manual'
    };
    if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
      init.body = await event.request.arrayBuffer();
      // LO-04: Node 18+'s undici fetch requires `duplex: 'half'` whenever a
      // body is supplied — without it a request with a body can silently
      // fail (notably for streaming/upload payloads). It is not in the DOM
      // `RequestInit` type, hence the cast.
      (init as RequestInit & { duplex?: 'half' }).duplex = 'half';
    }
    return fetch(upstream, init);
  }

  event.locals.user = null;
  try {
    const res = await event.fetch('/api/v1/me/');
    if (res.ok) {
      event.locals.user = await res.json();
    }
  } catch {
    // Backend unreachable: leave user as null. The +layout.server.ts probe
    // will independently observe `apiReachable=false` and degrade gracefully.
  }
  return resolve(event);
};
