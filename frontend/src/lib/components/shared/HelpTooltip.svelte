<!--
  HelpTooltip — the UI-05 shared `?`-icon inline-help primitive (Plan 04-09).

  Contract: 04-UI-SPEC §Shared Components — "HelpTooltip" + D-25.
    - A 14px `HelpCircle` icon (`text-muted-foreground`), placed inline after
      a field label.
    - The icon lives inside a REAL focusable `<button type="button">` with an
      `aria-label` of the form `Help: <label>` — keyboard-reachable.
    - On hover / focus:
        * no `learnMoreHref` → a `tooltip` (short text only).
        * `learnMoreHref` set → a `popover` so the "Learn more" link is
          actually clickable (tooltip content is not reliably interactive).
    - The displayed content carries `role="tooltip"` so it is announced.
    - The "Learn more" link uses the `ExternalLink` icon, `variant="link"`,
      and opens in a new tab.

  Both branches are keyboard-reachable: the trigger is a button, and the
  popover variant traps focus so the "Learn more" link is tab-reachable.
-->
<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as Popover from '$lib/components/ui/popover';
  import { Button } from '$lib/components/ui/button';
  import HelpCircle from '@lucide/svelte/icons/help-circle';
  import ExternalLink from '@lucide/svelte/icons/external-link';

  type Props = {
    /** The field name — composes the trigger's `aria-label` ("Help: <label>"). */
    label: string;
    /** The short in-app explanation (Label 13/400). */
    text: string;
    /** Optional deep link to the official Proxmox docs. */
    learnMoreHref?: string;
    class?: string;
  };

  let { label, text, learnMoreHref, class: className = '' }: Props = $props();

  const triggerBase =
    'text-muted-foreground hover:text-foreground inline-flex size-3.5 items-center ' +
    'justify-center rounded-full align-middle outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-ring';
  const triggerClass = $derived(`${triggerBase} ${className}`);
</script>

{#if learnMoreHref}
  <Popover.Root>
    <Popover.Trigger>
      {#snippet child({ props })}
        <button {...props} type="button" class={triggerClass} aria-label={`Help: ${label}`}>
          <HelpCircle class="size-3.5" aria-hidden="true" />
        </button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="max-w-xs" role="tooltip">
      <p class="text-[13px] leading-normal">{text}</p>
      <Button
        href={learnMoreHref}
        variant="link"
        size="sm"
        class="h-auto justify-start p-0"
        target="_blank"
        rel="noopener noreferrer"
      >
        Learn more
        <ExternalLink class="size-3.5" aria-hidden="true" />
      </Button>
    </Popover.Content>
  </Popover.Root>
{:else}
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <button {...props} type="button" class={triggerClass} aria-label={`Help: ${label}`}>
            <HelpCircle class="size-3.5" aria-hidden="true" />
          </button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content role="tooltip">
        <span class="text-[13px]">{text}</span>
      </Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
