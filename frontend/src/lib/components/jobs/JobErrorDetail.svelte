<!--
  JobErrorDetail — the failed-job error presentation (D-13/D-14/D-15, UI-06).

  Contract: UI-SPEC §"Error Presentation Contract".
    - Friendly message FIRST (Body 14/400 text-foreground).
    - A "Show technical details" collapsible below it (chevron + Label 13/500).
    - Expanded: raw stderr + UPID + task-log tail in a Mono 13/400 --muted
      block, whitespace-pre-wrap, max-h-64 scroll.
    - NO redaction — all users see the full detail (D-15).

  Security (T-03-05-02): every value is rendered as Svelte text interpolation
  ({friendly} / {raw} / {upid} / {log}) — Svelte auto-escapes. No {@html}
  appears anywhere in this component.
-->
<script lang="ts">
  import * as Collapsible from '$lib/components/ui/collapsible';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  type Props = {
    /** Curated human-readable error — always shown. */
    friendly: string;
    /** Raw PVE stderr. */
    raw: string | null;
    /** The PVE task UPID. */
    upid: string | null;
    /** Tail of the PVE task log. */
    log: string | null;
  };

  let { friendly, raw, upid, log }: Props = $props();

  let expanded = $state(false);

  // Only render the collapsible when there is technical detail to show.
  const hasDetail = $derived(Boolean(raw || upid || log));
</script>

<div class="flex flex-col gap-2">
  <!-- Friendly message — Body 14/400, never swallowed (Pitfall 24). -->
  <p class="text-[14px] text-foreground">{friendly}</p>

  {#if hasDetail}
    <Collapsible.Root bind:open={expanded}>
      <Collapsible.Trigger>
        {#snippet child({ props })}
          <button
            {...props}
            type="button"
            class="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {#if expanded}
              <ChevronDown class="size-3.5" aria-hidden="true" />
              Hide technical details
            {:else}
              <ChevronRight class="size-3.5" aria-hidden="true" />
              Show technical details
            {/if}
          </button>
        {/snippet}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div
          class="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-3 font-mono text-[13px] text-foreground"
        >
          {#if upid}<div class="text-muted-foreground">UPID: {upid}</div>{/if}
          {#if raw}<div class="mt-1">{raw}</div>{/if}
          {#if log}<div class="mt-1 text-muted-foreground">{log}</div>{/if}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  {/if}
</div>
