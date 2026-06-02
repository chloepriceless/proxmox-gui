<!--
  /create layout — the small-screen gate for the provisioning wizard (D-16).

  UI-03 explicitly EXEMPTS the wizards from the mobile reflow: a multi-step
  provisioning flow does not reflow gracefully into a phone viewport. So below
  `md` we render a calm "best on a larger screen" notice instead of cramming
  the wizard; at `md+` the wizard renders normally.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Monitor from '@lucide/svelte/icons/monitor';

  let { children }: { children: Snippet } = $props();
</script>

<!-- <md: graceful gate (the wizard is intentionally not reflowed). -->
<div
  class="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-12 text-center md:hidden"
>
  <Monitor class="size-8 text-muted-foreground" aria-hidden="true" />
  <h1 class="text-[18px] font-semibold">Best on a larger screen</h1>
  <p class="text-muted-foreground max-w-sm text-[14px]">
    The create wizard works best on a larger screen. Open this page on a tablet
    or desktop to provision a new VM or container.
  </p>
  <a
    href="/inventory"
    class="text-primary text-[14px] underline-offset-4 hover:underline"
  >
    ← Back to inventory
  </a>
</div>

<!-- md+: the wizard renders normally. -->
<div class="hidden md:block">
  {@render children()}
</div>
