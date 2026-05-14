<script lang="ts">
  // Redirect /inventory/[cluster]/[vmid]/activity to the parent page's #activity
  // hash tab. The canonical URL for the Activity tab is
  // /inventory/{cluster}/{vmid}#activity — the /activity sub-route exists only
  // so deep-linked URLs (e.g. from audit log "View in page") resolve correctly.
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  onMount(() => {
    const { cluster, vmid } = $page.params;
    goto(`/inventory/${cluster}/${vmid}#activity`, { replaceState: true });
  });
</script>

<p class="text-muted-foreground text-[14px]">Redirecting to Activity tab…</p>
