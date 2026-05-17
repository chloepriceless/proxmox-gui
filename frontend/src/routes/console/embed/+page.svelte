<!--
  /console/embed — the GUI-origin noVNC client page (Plan 04-15, CON-01).

  This page is loaded INSIDE the ConsoleTab `<iframe>`. It hosts the vendored
  noVNC RFB client and connects it to the GUI relay WebSocket.

  Contract (04-SPIKE-novnc.md §7):
    - The iframe loads THIS page — a GUI-origin HTML document — never a raw
      WebSocket path and never `wss://pve-host:8006`.
    - The RFB client opens its WebSocket to the GUI's OWN origin: the absolute
      `wss://` URL is built from `window.location` + the validated relay path
      (`data.ws`). The relay backend (Plan 04-08) holds the Proxmox `:8006`
      leg + the vncticket — neither ever reaches the browser (CON-03).
    - `data.ws` is `null` when the `ws` query param was missing or failed the
      `+page.ts` same-origin validation (threat T-04-15-01) — the page then
      renders a plain error and does NOT instantiate RFB.
    - This is a bare client surface — no app shell / Topbar / sidebar; it
      lives in an iframe. Just a `<svelte:head>` title + the RFB target div.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  // The vendored noVNC RFB client (Plan 04-15 — in-repo ESM, NOT an npm
  // dependency; UI-SPEC §704 forbids @novnc/novnc in package.json).
  import RFB from '$lib/vendor/novnc/core/rfb.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  /** The RFB canvas target — noVNC renders the framebuffer into this div. */
  let screenEl: HTMLDivElement | null = $state(null);

  /**
   * The connection lifecycle state — drives the status overlay. Starts
   * `unavailable` and is promoted to `connecting` on mount once a validated
   * relay path is confirmed; this avoids reading `data` outside a reactive
   * context (the load `data` is stable for the lifetime of this page).
   */
  let status = $state<'connecting' | 'connected' | 'ended' | 'unavailable'>(
    'unavailable'
  );

  onMount(() => {
    // No validated relay path => render the error state, never open a socket.
    if (!data.ws || !screenEl) {
      status = 'unavailable';
      return;
    }
    status = 'connecting';

    // Build the ABSOLUTE relay URL from the GUI's OWN origin (CON-03). The
    // page MUST NOT connect to a Proxmox host directly — only ever to the
    // GUI relay path, which the backend relays onward to PVE.
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const relayUrl = proto + '//' + window.location.host + data.ws;

    // Instantiate the vendored RFB client against the GUI relay WebSocket.
    const rfb = new RFB(screenEl, relayUrl, {});
    // Fit the remote framebuffer to the iframe viewport.
    rfb.scaleViewport = true;
    rfb.resizeSession = false;

    const onConnect = () => {
      status = 'connected';
    };
    const onDisconnect = () => {
      status = 'ended';
    };
    rfb.addEventListener('connect', onConnect);
    rfb.addEventListener('disconnect', onDisconnect);

    return () => {
      rfb.removeEventListener('connect', onConnect);
      rfb.removeEventListener('disconnect', onDisconnect);
      try {
        rfb.disconnect();
      } catch {
        // Already torn down — nothing to do.
      }
    };
  });
</script>

<svelte:head>
  <title>Console</title>
</svelte:head>

<!-- The status overlay sits ABOVE the framebuffer (z-index) — it never gates
     whether the framebuffer div exists. -->
{#if status === 'connecting'}
  <div class="overlay">
    <p>Connecting…</p>
  </div>
{:else if status === 'ended'}
  <div class="overlay">
    <p>Console session ended.</p>
  </div>
{:else if status === 'unavailable'}
  <div class="overlay">
    <p>Console unavailable.</p>
  </div>
{/if}
<!-- The RFB framebuffer target — UNCONDITIONALLY mounted so `bind:this`
     populates `screenEl` before onMount runs. It must NOT live behind a
     status-gated branch: status starts 'unavailable', so a conditional
     screen div would be absent at onMount → screenEl null → status stuck
     'unavailable' forever (the console could never connect). -->
<div bind:this={screenEl} class="screen"></div>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #000;
  }

  .screen {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family:
      ui-sans-serif,
      system-ui,
      -apple-system,
      sans-serif;
    font-size: 14px;
    color: #d4d4d8;
    background: #000;
  }
</style>
