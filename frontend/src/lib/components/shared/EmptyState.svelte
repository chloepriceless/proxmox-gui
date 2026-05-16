<!--
  EmptyState — the UI-04 shared empty-state primitive (Plan 04-09).

  Contract: 04-UI-SPEC §Shared Components — "EmptyState".
    - A centered block — NOT wrapped in a `Card`; it sits directly in the
      list area.
    - Layout: centered, `2xl` vertical padding (48px — `py-12`), an optional
      `3xl` top margin (64px — `mt-16`) for a fully-empty full-page list, a
      24px `text-muted-foreground` icon, a heading (Heading 18/600), a body
      line (Body 14/400 muted), and an optional primary CTA.
    - The CTA renders ONLY when both `ctaLabel` and `ctaHref` are present —
      some empty states are informational only.
    - The CTA is a primary `button` rendered AS an `<a href={ctaHref}>` so it
      is a real navigable link (deep-links into e.g. `/create`).
-->
<script lang="ts">
  import type { Component } from 'svelte';
  import { Button } from '$lib/components/ui/button';

  type Props = {
    /** A lucide icon component (e.g. `Boxes`). Rendered at 24px, muted. */
    icon: Component;
    /** Heading 18/600 — the empty-state title. */
    heading: string;
    /** Body 14/400 muted — the one-line explanation. */
    body: string;
    /** CTA label — rendered only when `ctaHref` is also set. */
    ctaLabel?: string;
    /** CTA target — rendered only when `ctaLabel` is also set. */
    ctaHref?: string;
    /** Adds the `3xl` (64px) top margin for a fully-empty full-page list. */
    fullPage?: boolean;
    class?: string;
  };

  let {
    icon: Icon,
    heading,
    body,
    ctaLabel,
    ctaHref,
    fullPage = false,
    class: className = ''
  }: Props = $props();

  const hasCta = $derived(Boolean(ctaLabel) && Boolean(ctaHref));
</script>

<div
  class="flex flex-col items-center justify-center gap-2 py-12 text-center {fullPage
    ? 'mt-16'
    : ''} {className}"
>
  <Icon class="size-6 text-muted-foreground" aria-hidden="true" />
  <h2 class="text-[18px] font-semibold leading-tight tracking-tight">{heading}</h2>
  <p class="text-[14px] text-muted-foreground">{body}</p>
  {#if hasCta}
    <Button href={ctaHref} class="mt-2">{ctaLabel}</Button>
  {/if}
</div>
