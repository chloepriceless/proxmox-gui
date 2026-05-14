<!--
  /setup layout — minimal wrapper.

  The root +layout.svelte already bypasses the AppShell when the pathname is
  under /setup (see route detection there). This layout exists primarily to
  give SvelteKit a stable parent for the /setup tree, and to enforce the
  centred-on-muted background per UI-SPEC §First-run wizard.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="bg-muted min-h-screen px-4 py-12">
  <div class="mx-auto flex w-full max-w-[35rem] flex-col items-center gap-6">
    {@render children()}
  </div>
</div>
