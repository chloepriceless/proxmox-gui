<!--
  IdleCountdownToast — the 2-minute idle warning (Plan 05-06, AUTH-06 D-04).

  A persistent bottom-right toast-styled card with a LIVE countdown and a
  "Stay signed in" button. The layout renders it only while
  `idle.showCountdown` is true. "Stay signed in" calls the cheap no-rotation
  keepalive (idle.staySignedIn) and resets the idle timer.

  It is a dedicated component rather than a sonner toast because it needs
  persistent, live-updating content (the ticking countdown) for the whole warning
  window — sonner's transient toasts are used elsewhere for fire-and-forget
  success/error messages.
-->
<script lang="ts">
  import { idle } from '$lib/stores/idle.svelte';
  import { Button } from '$lib/components/ui/button';

  const seconds = $derived(Math.max(0, idle.secondsRemaining));
  const mm = $derived(Math.floor(seconds / 60));
  const ss = $derived(seconds % 60);
  const label = $derived(`${mm}:${ss.toString().padStart(2, '0')}`);
</script>

<div
  class="bg-popover text-popover-foreground fixed bottom-4 right-4 z-50 w-80 rounded-md border border-border p-4 shadow-lg"
  role="status"
  aria-live="polite"
>
  <p class="text-[14px] font-medium">Session about to expire</p>
  <p class="text-muted-foreground mt-1 text-[13px]">
    You'll be signed out in
    <span class="tabular-nums font-medium">{label}</span>
    due to inactivity.
  </p>
  <div class="mt-3 flex justify-end">
    <Button size="sm" onclick={() => idle.staySignedIn()}>Stay signed in</Button>
  </div>
</div>
