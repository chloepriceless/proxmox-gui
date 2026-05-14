<!--
  ConfirmByNameDialog — typed-name destructive confirmation.

  Contract: UI-SPEC §Destructive confirmations.
    - Heading: action-specific (passed via prop).
    - Body: explains consequences in one sentence (passed via prop).
    - Input: "Type {targetName} to confirm". Comparison is case-sensitive,
      trimmed of leading/trailing whitespace only.
    - ENTER inside the input does NOT submit (we intercept Enter and prevent
      default + propagation). The user MUST click the destructive button.
    - The destructive button is disabled until the input matches.
    - Inline hint "Doesn't match — type the name exactly." appears when the
      input is non-empty AND doesn't match.
    - Backed by AlertDialog (bits-ui) — escape closes the dialog by default
      (cancel-equivalent), which is the standard destructive-confirm pattern.

  Note: legacy bits-ui prop names were `closeOnEscape` / `closeOnOutsideClick`;
  modern bits-ui replaced them with `escapeKeydownBehavior` /
  `interactOutsideBehavior`. We use the modern names. The string literal
  `closeOnEscape={false}` appears nowhere because escape SHOULD close this
  dialog (it is the cancel action).
-->
<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  type Props = {
    /** Bindable open state. */
    open?: boolean;
    /** Dialog heading, e.g. "Delete alice?". */
    heading: string;
    /** Body copy describing the consequences. */
    body: string;
    /** The literal name the user must type to confirm. */
    targetName: string;
    /** Label on the destructive button, e.g. "Delete user". */
    confirmLabel: string;
    /** Cancel button label (defaults to "Cancel"). */
    cancelLabel?: string;
    /**
     * Whether the action is destructive (red button). Defaults to true since
     * this dialog is purpose-built for destructive flows.
     */
    destructive?: boolean;
    /** Called when the user clicks the confirm button. */
    onConfirm: () => void | Promise<void>;
    /** Called when the user cancels (clicks Cancel or hits ESC). */
    onCancel?: () => void;
  };

  let {
    open = $bindable(false),
    heading,
    body,
    targetName,
    confirmLabel,
    cancelLabel = 'Cancel',
    destructive = true,
    onConfirm,
    onCancel
  }: Props = $props();

  let typed = $state('');
  let busy = $state(false);

  // Comparison: trim leading / trailing whitespace, case-sensitive.
  const matches = $derived(typed.trim() === targetName.trim());
  const showHint = $derived(typed.length > 0 && !matches);

  // Reset the input every time the dialog opens — never carry over state
  // across destructive confirmations.
  $effect(() => {
    if (open) {
      typed = '';
      busy = false;
    }
  });

  function onKeydown(event: KeyboardEvent) {
    // ENTER must NOT submit — UI-SPEC §Destructive confirmations.
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  async function handleConfirm() {
    if (!matches || busy) return;
    busy = true;
    try {
      await onConfirm();
    } finally {
      busy = false;
      open = false;
    }
  }

  function handleCancel() {
    onCancel?.();
    open = false;
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{heading}</AlertDialog.Title>
      <AlertDialog.Description>{body}</AlertDialog.Description>
    </AlertDialog.Header>

    <div class="flex flex-col gap-2">
      <Label for="confirm-by-name-input">
        Type <code class="bg-muted rounded px-1 py-0.5 font-mono text-xs">{targetName}</code>
        to confirm
      </Label>
      <Input
        id="confirm-by-name-input"
        type="text"
        bind:value={typed}
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        onkeydown={onKeydown}
        aria-invalid={showHint ? 'true' : undefined}
        aria-describedby={showHint ? 'confirm-by-name-hint' : undefined}
      />
      {#if showHint}
        <p id="confirm-by-name-hint" class="text-destructive text-[13px]">
          Doesn't match — type the name exactly.
        </p>
      {/if}
    </div>

    <AlertDialog.Footer>
      <Button variant="ghost" onclick={handleCancel} disabled={busy}>{cancelLabel}</Button>
      <Button
        variant={destructive ? 'destructive' : 'default'}
        disabled={!matches || busy}
        onclick={handleConfirm}
      >
        {confirmLabel}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
