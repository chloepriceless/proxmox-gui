<!--
  ConsoleTab — the embedded noVNC console tab (Plan 04-14, CON-01/02/03).

  Contract: 04-UI-SPEC §"noVNC Console tab".
    - On mount the tab renders ONLY a centered placeholder (`MonitorPlay` icon,
      "Console" heading, the pinned body copy, an accent "Open console"
      button). There is NO `<iframe>` in the DOM — the vncticket is NEVER
      minted on page load (CON-02, Pitfall 3 — the ticket lives ~30-40s).
    - On "Open console": `api.console.mintVncProxy` is called; while waiting a
      `Loader2` "Connecting to console…" shows; on success the `<iframe>` is
      rendered with `src = relay_url` — the GUI's own reverse-proxied
      WebSocket path, NEVER the Proxmox host (CON-03). `consoleIframeSrc`
      refuses any `:8006` / `vncwebsocket` URL.
    - A "Reconnect" button (`RefreshCw`) re-mints a fresh ticket + reloads the
      iframe; a dropped session shows a `bg-warning/10` "Console session
      ended." strip + Reconnect.
    - A "Fullscreen" control (`Maximize2`, icon-only) expands the container —
      it carries BOTH `aria-label="Fullscreen"` and `title="Fullscreen"`.
-->
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import MonitorPlay from '@lucide/svelte/icons/monitor-play';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Maximize2 from '@lucide/svelte/icons/maximize-2';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import { api } from '$lib/api/client';
  import type { ResourceKind } from '$lib/api/types';
  import {
    consoleIframeSrc,
    iframeVisible,
    placeholderBody,
    type ConsoleState
  } from './console-tab';

  type Props = {
    clusterId: number;
    vmid: number;
    kind: ResourceKind;
    /** The VM/LXC display name — used in the placeholder copy. */
    name: string;
  };

  let { clusterId, vmid, kind, name }: Props = $props();

  let phase = $state<ConsoleState>('placeholder');
  let iframeSrc = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);
  let containerEl: HTMLDivElement | null = $state(null);
  // Bumped on every (re)mint so the iframe is a fresh element — forces a full
  // reload even when the relay URL happens to be byte-identical.
  let iframeKey = $state(0);

  const showIframe = $derived(iframeVisible(phase));
  const bodyCopy = $derived(placeholderBody(name));

  /**
   * Mint a fresh vncproxy ticket and render the iframe. Called ONLY on the
   * user's "Open console" / "Reconnect" click — never on mount (CON-02).
   */
  async function openConsole() {
    phase = 'connecting';
    errorMessage = null;
    try {
      const res = await api.console.mintVncProxy({ clusterId, vmid, kind });
      // CON-03 — refuse to point the iframe at the Proxmox host. A relay URL
      // carrying `:8006` / `vncwebsocket` throws here and surfaces the error
      // state rather than ever leaking the PVE host to the browser.
      iframeSrc = consoleIframeSrc(res.relay_url);
      iframeKey += 1;
      phase = 'live';
    } catch {
      iframeSrc = null;
      errorMessage = "Couldn't open the console. Try again.";
      phase = 'error';
    }
  }

  /** Mark the session dropped — the relay closed the upstream leg. */
  function onIframeError() {
    if (phase === 'live') phase = 'disconnected';
  }

  function fullscreen() {
    containerEl?.requestFullscreen?.();
  }
</script>

{#if phase === 'placeholder' || phase === 'connecting' || phase === 'error'}
  <!-- Placeholder / connecting / error — NO iframe in the DOM (CON-02). -->
  <div
    class="flex min-h-[480px] flex-col items-center justify-center rounded-md border border-border bg-muted/20 px-6 py-12 text-center"
  >
    <MonitorPlay class="size-6 text-muted-foreground" aria-hidden="true" />
    <h3 class="mt-4 text-[18px] font-semibold">Console</h3>
    <p class="mt-1 max-w-md text-[14px] text-muted-foreground">{bodyCopy}</p>

    {#if phase === 'error' && errorMessage}
      <p class="mt-3 inline-flex items-center gap-1.5 text-[13px] text-destructive">
        <CircleAlert class="size-4" aria-hidden="true" />
        {errorMessage}
      </p>
    {/if}

    {#if phase === 'connecting'}
      <p class="mt-6 inline-flex items-center gap-2 text-[14px] text-muted-foreground">
        <Loader2 class="size-4 animate-spin" aria-hidden="true" />
        Connecting to console…
      </p>
    {:else}
      <Button class="mt-6" onclick={openConsole}>
        <MonitorPlay class="size-4" aria-hidden="true" />
        Open console
      </Button>
    {/if}
  </div>
{:else}
  <!-- Live / disconnected — the iframe container with its top bar. -->
  <div
    bind:this={containerEl}
    class="flex min-h-[480px] flex-col overflow-hidden rounded-md border border-border bg-background"
  >
    <div class="flex items-center justify-between border-b border-border px-3 py-2">
      <span class="text-[13px] font-medium text-muted-foreground">
        Console — {name}
      </span>
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm" onclick={openConsole}>
          <RefreshCw class="size-4" aria-hidden="true" />
          Reconnect
        </Button>
        <button
          type="button"
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Fullscreen"
          title="Fullscreen"
          onclick={fullscreen}
        >
          <Maximize2 class="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    {#if phase === 'disconnected'}
      <div
        class="flex items-center gap-2 bg-warning/10 px-3 py-2 text-[13px] text-foreground"
      >
        <CircleAlert class="size-4 text-warning" aria-hidden="true" />
        Console session ended.
        <Button variant="link" size="sm" class="h-auto p-0" onclick={openConsole}>
          Reconnect
        </Button>
      </div>
    {/if}

    {#if showIframe && iframeSrc}
      {#key iframeKey}
        <iframe
          src={iframeSrc}
          title={`Console — ${name}`}
          class="aspect-[16/10] min-h-[480px] w-full flex-1 border-0"
          onerror={onIframeError}
        ></iframe>
      {/key}
    {/if}
  </div>
{/if}
