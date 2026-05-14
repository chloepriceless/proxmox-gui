<!--
  SecretRevealDialog — show-once secret reveal (PAT plaintext, etc.).

  Contract: UI-SPEC §Token / secret display.
    - Banner uses `--warning` palette + AlertTriangle icon.
    - Secret shown in monospace inside `<code>` with copy-to-clipboard button.
    - Copy button shows `Check` for 2s after a successful copy, then reverts.
    - Primary button "I've saved it" — only way to dismiss.
    - Dialog is NON-DISMISSABLE by ESC or click-outside (legacy bits-ui prop
      names: `closeOnEscape={false}` / `closeOnOutsideClick={false}`; modern
      bits-ui: `escapeKeydownBehavior="ignore"` /
      `interactOutsideBehavior="ignore"`). We use the modern names below.
    - On dismiss: clears the bound `secret` prop AND calls `onDismissed`.

  Note: T-01-08-04 mitigation — the secret lives only in component state and
  the bound prop, never in localStorage.
-->
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';

  type Props = {
    /** Bindable open state. */
    open?: boolean;
    /** The bindable secret string. Cleared when the dialog is dismissed. */
    secret?: string;
    /** Heading copy — defaults to UI-SPEC value. */
    label?: string;
    /** Body copy — defaults to UI-SPEC value. */
    body?: string;
    /** Called once the user dismisses with "I've saved it". */
    onDismissed?: () => void;
    /** Optional confirm button label. */
    confirmLabel?: string;
  };

  let {
    open = $bindable(false),
    secret = $bindable(''),
    label = "Save this token now.",
    body = "You won't see it again. Store it somewhere safe.",
    onDismissed,
    confirmLabel = "I've saved it"
  }: Props = $props();

  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    return () => {
      if (copyTimer !== null) clearTimeout(copyTimer);
    };
  });

  async function copyToClipboard() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      copied = true;
      if (copyTimer !== null) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copied = false;
        copyTimer = null;
      }, 2000);
    } catch {
      // Clipboard may be denied (insecure context, permissions). The user
      // can still triple-click + copy from the visible code element.
    }
  }

  function dismiss() {
    secret = '';
    open = false;
    onDismissed?.();
  }
</script>

<!-- escapeKeydownBehavior + interactOutsideBehavior are the modern bits-ui
     equivalents of the legacy closeOnEscape / closeOnOutsideClick props. -->
<Dialog.Root bind:open>
  <Dialog.Content
    showCloseButton={false}
    escapeKeydownBehavior="ignore"
    interactOutsideBehavior="ignore"
  >
    <Dialog.Header>
      <div
        class="bg-warning/10 border-warning/30 text-warning flex items-start gap-3 rounded-md border p-3"
      >
        <AlertTriangle class="size-5 shrink-0" aria-hidden="true" />
        <div class="flex flex-col gap-1">
          <Dialog.Title class="text-warning text-base font-semibold">{label}</Dialog.Title>
          <Dialog.Description class="text-foreground text-[13px]">{body}</Dialog.Description>
        </div>
      </div>
    </Dialog.Header>

    <div class="flex items-center gap-2">
      <code
        class="bg-muted block flex-1 overflow-x-auto rounded px-3 py-2 font-mono text-[13px] leading-normal"
      >{secret}</code>
      <Button
        variant="outline"
        size="icon"
        onclick={copyToClipboard}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      >
        {#if copied}
          <Check class="size-4" aria-hidden="true" />
        {:else}
          <Copy class="size-4" aria-hidden="true" />
        {/if}
      </Button>
    </div>

    <Dialog.Footer>
      <Button onclick={dismiss}>{confirmLabel}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
