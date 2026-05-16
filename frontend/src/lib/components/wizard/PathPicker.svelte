<!--
  PathPicker — wizard Step 1, the six-path picker (Plan 04-10).

  Contract: 04-UI-SPEC §"Path-picker (Step 1) contract" + §"Copywriting
  Contract" §"Path-picker cards".
    - Six selectable cards in a responsive grid: 3-up ≥1024px, 2-up ≥640px,
      1-up below. Each card 160px tall, min 240px wide, `sm` (8px) grid gap.
    - Each card: a 24px icon, a Body 14/600 title, a Label 13/400 muted
      one-line description.
    - Single-select via a `radio-group` — `role="radiogroup"` on the grid,
      `role="radio"` on each card (the `bits-ui` RadioGroup primitive gives
      arrow-key navigation + Space/Enter confirm + `aria-checked`).
    - The chosen card gets a `border-primary` ring + a small `text-primary`
      check (top-right); the card body stays `bg-card`.
    - The six cards / icons / copy are pinned in `wizard-model.ts` (PATH_CARDS)
      verbatim from the Copywriting Contract.

  A11y (04-UI-SPEC §Accessibility Floor): selection is never colour-only — the
  selected card carries both a visible `Check` icon AND the `aria-checked`
  state the RadioGroup primitive sets.
-->
<script lang="ts">
  import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
  import Check from '@lucide/svelte/icons/check';
  import Container from '@lucide/svelte/icons/container';
  import Rocket from '@lucide/svelte/icons/rocket';
  import Disc from '@lucide/svelte/icons/disc';
  import Boxes from '@lucide/svelte/icons/boxes';
  import Image from '@lucide/svelte/icons/image';
  import Copy from '@lucide/svelte/icons/copy';
  import type { Component } from 'svelte';
  import { PATH_CARDS, type WizardPath } from './wizard-model';

  type Props = {
    /** The currently-chosen path (bindable) — `null` until the user picks. */
    value?: WizardPath | null;
    /** Fired when a card is chosen. */
    onSelect?: (path: WizardPath) => void;
  };

  let { value = $bindable(null), onSelect }: Props = $props();

  /** Resolve a card's pinned icon name to its lucide component. */
  const ICONS: Record<string, Component> = {
    Container,
    Rocket,
    Disc,
    Boxes,
    Image,
    Copy
  };

  /** The RadioGroup primitive works on a string value — '' means unselected. */
  let groupValue = $state<string>(value ?? '');

  function handleChange(next: string) {
    groupValue = next;
    value = next as WizardPath;
    onSelect?.(next as WizardPath);
  }
</script>

<div class="flex flex-col gap-2">
  <header class="flex flex-col gap-1">
    <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
      Choose what to create
    </h2>
    <p class="text-muted-foreground text-[14px]">
      Pick a provisioning path to get started.
    </p>
  </header>

  <RadioGroupPrimitive.Root
    bind:value={groupValue}
    onValueChange={handleChange}
    aria-label="Provisioning path"
    class="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-3"
  >
    {#each PATH_CARDS as card (card.path)}
      {@const Icon = ICONS[card.iconName]}
      {@const selected = groupValue === card.path}
      <RadioGroupPrimitive.Item
        value={card.path}
        class="bg-card relative flex h-40 min-w-60 cursor-pointer flex-col items-start gap-2 rounded-lg border p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring {selected
          ? 'border-primary ring-1 ring-primary'
          : 'border-border'}"
      >
        {#if selected}
          <Check
            class="text-primary absolute right-3 top-3 size-4"
            aria-hidden="true"
          />
        {/if}
        <Icon class="size-6 text-foreground" aria-hidden="true" />
        <span class="text-[14px] font-semibold text-foreground">{card.title}</span>
        <span class="text-muted-foreground text-[13px]">{card.description}</span>
      </RadioGroupPrimitive.Item>
    {/each}
  </RadioGroupPrimitive.Root>
</div>
