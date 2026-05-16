// console-tab — the pure, framework-free logic for the embedded noVNC
// Console tab (Plan 04-14, CON-01/02/03).
//
// Extracted from `ConsoleTab.svelte` so the mint-state machine and the
// relay-URL safety check are unit-testable in the `node` vitest env (the same
// discipline as Plan 04-11's `lxc-wizard.ts`). The rendered Svelte
// props/markup are exercised end-to-end by `pnpm exec svelte-check`.
//
// References:
//   - 04-UI-SPEC §"noVNC Console tab" — placeholder → connecting → live →
//     disconnected; mint-on-click; the reverse-proxied relay URL
//   - CON-02 (never mint on page load) / CON-03 (no Proxmox-host URL exposure)
//   - Plan 04-08 console backend — `mintVncProxy` returns `{ticket, port,
//     relay_url}`; `relay_url` is the GUI-origin reverse-proxied WebSocket path

/** The Console-tab state machine (UI-SPEC §"Console tab" states). */
export type ConsoleState =
  | 'placeholder' // iframe NOT rendered — the "Open console" CTA is shown
  | 'connecting' // mint in flight — Loader2 + "Connecting to console…"
  | 'live' // the iframe is rendered against the relay URL
  | 'disconnected' // the session dropped — bg-warning strip + Reconnect
  | 'error'; // the mint call failed — retry offered

/** The iframe is in the DOM only in the `live` state — never on page load. */
export function iframeVisible(state: ConsoleState): boolean {
  return state === 'live';
}

/**
 * Reject any console URL that points at the Proxmox host instead of the GUI's
 * own reverse-proxied relay (CON-03). The Proxmox web UI / vncwebsocket lives
 * on `:8006`; the GUI relay is a same-origin `/api/v1/ws/console/...` path.
 *
 * A safe relay URL is a relative `/api/...` path OR an absolute URL whose host
 * is NOT a Proxmox `:8006` endpoint and whose path is the console relay path.
 */
export function isSafeRelayUrl(relayUrl: string): boolean {
  if (!relayUrl) return false;
  // The unmistakable Proxmox-host tell — the PVE web port. CON-03 forbids it.
  if (relayUrl.includes(':8006')) return false;
  // A same-origin relative relay path is always safe.
  if (relayUrl.startsWith('/api/v1/ws/console/')) return true;
  // An absolute URL is safe only if it carries the GUI relay path and no
  // :8006 port (already excluded above). A raw `vncwebsocket` PVE path is a
  // Proxmox-host URL leak.
  if (relayUrl.includes('/vncwebsocket')) return false;
  return relayUrl.includes('/api/v1/ws/console/');
}

/**
 * The placeholder body copy — pinned (UI-SPEC §"Console tab contract").
 * `name` is the VM/LXC display name.
 */
export function placeholderBody(name: string): string {
  return `Open a live console session to ${name}. The session opens in this panel.`;
}

/**
 * Build the iframe `src` from a freshly-minted `relay_url`. Throws when the
 * URL would expose the Proxmox host (CON-03) — the caller surfaces the error
 * state rather than ever pointing the iframe at `:8006`.
 */
export function consoleIframeSrc(relayUrl: string): string {
  if (!isSafeRelayUrl(relayUrl)) {
    throw new Error('Refusing to render a console iframe at a non-relay URL');
  }
  return relayUrl;
}
