// /console/embed — the GUI-origin noVNC client page load (Plan 04-15, CON-01).
//
// This route is loaded INSIDE the ConsoleTab `<iframe>`. It hosts the vendored
// noVNC RFB client (`$lib/vendor/novnc`) and connects it to the GUI relay
// WebSocket — never to a Proxmox host (CON-03).
//
// The page is a browser-only client surface: `ssr = false` because the RFB
// client touches `window` / `WebSocket` on mount and must not server-render.
//
// SECURITY — threat T-04-15-01 (`ws`-param injection):
//   The `ws` query param is attacker-influenceable. It is validated here, in
//   the load function, BEFORE it ever reaches the page (where it becomes a
//   WebSocket URL). Only a same-origin relay PATH is accepted; an absolute
//   `wss://attacker/...` URL or a direct-Proxmox `:8006` URL is rejected and
//   the page renders an error state instead of opening a hostile socket.
//   The check reuses `isSafeRelayUrl` from `console-tab.ts` so the GUI has a
//   single notion of "safe relay path".

import { isSafeRelayUrl } from '$lib/components/console/console-tab';
import type { PageLoad } from './$types';

/** The RFB client is a browser-only client — never server-render this page. */
export const ssr = false;
/** It is a pure client-rendered surface inside the Console-tab iframe. */
export const csr = true;

/**
 * Validate the `ws` query param to a same-origin relay path.
 *
 * Accepts ONLY a string that `isSafeRelayUrl` deems safe — i.e. it starts with
 * `/api/v1/ws/console/` (a relative GUI-origin path), carries no `:8006` PVE
 * web port, and is not a raw `vncwebsocket` Proxmox URL. A relative path that
 * starts with `/api/v1/ws/console/` cannot be an absolute URL (`^[a-z]+:`) or
 * a protocol-relative URL (`^//`) — those are rejected by construction.
 */
function safeWsParam(raw: string | null): string | null {
  if (!raw) return null;
  // Defence in depth — explicitly reject absolute / protocol-relative URLs
  // even though `isSafeRelayUrl`'s startsWith check already would.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (raw.startsWith('//')) return null;
  return isSafeRelayUrl(raw) ? raw : null;
}

export const load: PageLoad = ({ url }) => {
  // `ws: null` => the page renders a plain "Console unavailable." error
  // state and never instantiates RFB. Do NOT throw — an opaque 500 inside
  // the iframe is a worse experience than an inline error.
  const ws = safeWsParam(url.searchParams.get('ws'));
  return { ws };
};
