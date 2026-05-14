<!--
  FilterChip — removable filter pill for the inventory filter row.

  Contract: UI-SPEC §Component Contracts §FilterChip.

    Shape: inline-flex h-7 px-2 rounded-md border border-border bg-muted
    Label: "key: value" format (e.g. "status: running", "tag: prod")
    Remove button: X icon, aria-label="Remove filter {label}"
    Locked variant: Lock icon replaces X, no click handler

  4px-grid fix (commits a035ce9 + b99cad1 in UI-SPEC): h-7 = 28px, which is
  on the 4px grid. gap-2 (8px) between dot/label/X.
-->
<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import Lock from '@lucide/svelte/icons/lock';

  type Props = {
    /** Display label — "key: value" format per UI-SPEC. */
    label: string;
    /** Called when user clicks the × remove button. Omit for non-removable chips. */
    onRemove?: () => void;
    /** When true, replaces × with a Lock icon and suppresses the click handler. */
    locked?: boolean;
    /**
     * Optional Tailwind class for the colored status dot (used when filtering
     * by VM status — e.g. "bg-success" for "running"). Omitted for all other
     * filter types.
     */
    statusColor?: string;
    class?: string;
  };

  let { label, onRemove, locked = false, statusColor, class: className = '' }: Props = $props();
</script>

<span
  class="inline-flex items-center gap-2 h-7 px-2 rounded-md border border-border bg-muted text-foreground text-[13px] font-medium {className}"
>
  {#if statusColor}
    <span class="size-2 rounded-full {statusColor}" aria-hidden="true"></span>
  {/if}
  <span>{label}</span>
  {#if locked}
    <Lock class="size-3 text-muted-foreground" aria-hidden="true" />
  {:else if onRemove}
    <button
      type="button"
      onclick={onRemove}
      class="-mr-1 inline-flex size-4 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
      aria-label={`Remove filter ${label}`}
    >
      <X class="size-3" />
    </button>
  {/if}
</span>
