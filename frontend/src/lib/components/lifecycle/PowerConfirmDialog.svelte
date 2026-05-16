<!--
  PowerConfirmDialog — the OK/Cancel power confirm.

  Contract: UI-SPEC §"Destructive confirmations" OK/Cancel table + §"Force-Stop
  vs. graceful Stop".
    - alert-dialog (no typed-name — OK/Cancel only).
    - Heading / body / confirm CTA copy is VERBATIM from the UI-SPEC table.
    - Force-Stop uses the destructive-variant styling.
    - The graceful-Stop dialog offers a "Force-stop instead" escalation button.
    - A `busy` guard covers the enqueue round-trip.

  Copies the Svelte 5 runes shape of ConfirmByNameDialog.svelte.
-->
<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';

  /** The power confirmations this dialog covers. */
  export type PowerConfirmKind = 'stop' | 'reboot' | 'shutdown' | 'force-stop';

  type Props = {
    /** Bindable open state. */
    open?: boolean;
    /** Which confirmation to render. */
    kind: PowerConfirmKind;
    /** The VM/LXC display name (interpolated into the copy). */
    vmName: string;
    /** Called when the user confirms — may be async (the enqueue round-trip). */
    onConfirm: () => void | Promise<void>;
    /**
     * Called when the user picks "Force-stop instead" inside the graceful-Stop
     * dialog — the caller swaps this dialog's `kind` to "force-stop".
     */
    onEscalateForceStop?: () => void;
  };

  let {
    open = $bindable(false),
    kind,
    vmName,
    onConfirm,
    onEscalateForceStop,
  }: Props = $props();

  let busy = $state(false);

  // Reset the busy guard each time the dialog opens.
  $effect(() => {
    if (open) busy = false;
  });

  // UI-SPEC §Destructive confirmations — verbatim copy per kind.
  type Copy = { heading: string; body: string; cta: string; destructive: boolean };
  function copyFor(k: PowerConfirmKind, name: string): Copy {
    switch (k) {
      case 'stop':
        return {
          heading: `Stop ${name}?`,
          body: 'Sends a graceful shutdown signal. The guest OS gets a chance to shut down cleanly.',
          cta: 'Stop VM',
          destructive: false,
        };
      case 'reboot':
        return {
          heading: `Reboot ${name}?`,
          body: `Restarts ${name}. In-progress work inside the guest may be interrupted.`,
          cta: 'Reboot VM',
          destructive: false,
        };
      case 'shutdown':
        return {
          heading: `Shut down ${name}?`,
          body: `Sends a graceful ACPI shutdown to ${name}.`,
          cta: 'Shut down',
          destructive: false,
        };
      case 'force-stop':
        return {
          heading: `Force-stop ${name}?`,
          body: 'This cuts power immediately — like pulling the plug. Unsaved data in the guest may be lost. Use only when a graceful stop won’t complete.',
          cta: 'Force-stop',
          destructive: true,
        };
    }
  }

  const copy = $derived(copyFor(kind, vmName));

  async function handleConfirm() {
    if (busy) return;
    busy = true;
    try {
      await onConfirm();
      open = false;
    } finally {
      busy = false;
    }
  }

  function handleCancel() {
    open = false;
  }

  function handleEscalate() {
    onEscalateForceStop?.();
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{copy.heading}</AlertDialog.Title>
      <AlertDialog.Description>{copy.body}</AlertDialog.Description>
    </AlertDialog.Header>

    <AlertDialog.Footer>
      <Button variant="ghost" onclick={handleCancel} disabled={busy}>Cancel</Button>
      {#if kind === 'stop' && onEscalateForceStop}
        <!-- Escalation — "Force-stop instead" (UI-SPEC §Force-Stop vs. graceful Stop). -->
        <Button variant="outline" onclick={handleEscalate} disabled={busy}>
          Force-stop instead
        </Button>
      {/if}
      <Button
        variant={copy.destructive ? 'destructive' : 'default'}
        onclick={handleConfirm}
        disabled={busy}
      >
        {copy.cta}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
