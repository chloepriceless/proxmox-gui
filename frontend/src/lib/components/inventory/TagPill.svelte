<!--
  TagPill — colored tag badge with auto-derived hue.

  Contract: UI-SPEC §Component Contracts §TagPill.

    Shape: inline-flex h-6 px-2 rounded-md border text-[13px] font-medium
    Color: paletteFor(tag) — FNV-1a hash → 12-bucket palette (UI-SPEC table)
    Height: h-6 = 24px (4px-grid; smaller than FilterChip h-7=28px)

  When `onClick` is provided, renders as a <button> (clickable in list view
  to add as filter, or in detail page to open edit popover). Otherwise a
  non-interactive <span>.
-->
<script lang="ts">
  import { paletteFor } from '$lib/utils/tag_palette';

  type Props = {
    tag: string;
    onClick?: () => void;
    class?: string;
  };

  let { tag, onClick, class: className = '' }: Props = $props();

  const palette = $derived(paletteFor(tag));
</script>

{#if onClick}
  <button
    type="button"
    onclick={onClick}
    class="inline-flex items-center h-6 px-2 rounded-md border text-[13px] font-medium {palette} {className}"
    aria-label={`Tag ${tag}`}
  >
    {tag}
  </button>
{:else}
  <span
    class="inline-flex items-center h-6 px-2 rounded-md border text-[13px] font-medium {palette} {className}"
    aria-label={`Tag ${tag}`}
  >
    {tag}
  </span>
{/if}
