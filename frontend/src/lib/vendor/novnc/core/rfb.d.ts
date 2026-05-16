// Type shim for the vendored noVNC RFB client (Plan 04-15).
//
// This declaration file is NOT part of upstream noVNC — it is added by this
// project so TypeScript / svelte-check resolves the types of the vendored
// `rfb.js` from here instead of traversing into the third-party `.js` source
// (whose Babel-free ESM is not written for `checkJs` and would flood
// implicit-any errors on code we do not own).
//
// It declares only the small surface the `/console/embed` page uses; the
// runtime behaviour is the real vendored `rfb.js`.

/** Options accepted by the noVNC `RFB` constructor (v1.6.0). */
export interface RFBOptions {
  shared?: boolean;
  credentials?: { username?: string; password?: string; target?: string };
  repeaterID?: string;
  wsProtocols?: string[];
}

/**
 * The noVNC RFB client. Connects to a VNC server over a WebSocket and renders
 * the framebuffer into the `target` element.
 *
 * See `frontend/src/lib/vendor/novnc/README.md` for provenance (v1.6.0).
 */
export default class RFB extends EventTarget {
  constructor(target: Element, urlOrChannel: string, options?: RFBOptions);

  /** Scale the remote framebuffer to fit the target element. */
  scaleViewport: boolean;
  /** Ask the server to resize its session to the target element's size. */
  resizeSession: boolean;
  /** Clip (rather than scale) the framebuffer to the target element. */
  clipViewport: boolean;
  /** Render the session without forwarding input. */
  viewOnly: boolean;
  /** CSS background applied behind the framebuffer. */
  background: string;

  /** Tear down the connection. */
  disconnect(): void;
}
