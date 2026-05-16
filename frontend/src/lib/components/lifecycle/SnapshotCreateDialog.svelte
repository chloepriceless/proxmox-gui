<!--
  SnapshotCreateDialog — the snapshot-create form dialog.

  Contract: UI-SPEC §"Snapshot-create dialog" + §Confirmation matrix (form
  dialog) + §Copywriting Contract.
    - shadcn `dialog` form.
    - Fields: Snapshot name (text, required, 1..40), Description (textarea,
      optional), "Include RAM state" Switch (default off).
    - Cancel (variant="ghost", left) + primary CTA "Create snapshot".
    - A `busy` $state guard covers the enqueue round-trip; fields reset on open.
-->
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Switch } from '$lib/components/ui/switch';

  type Props = {
    /** Bindable open state. */
    open?: boolean;
    /** The VM/LXC display name (interpolated into the dialog copy). */
    vmName: string;
    /**
     * Called when the user submits — may be async (the enqueue round-trip).
     * Resolving closes the dialog; throwing keeps it open.
     */
    onSubmit: (d: { name: string; description: string; vmstate: boolean }) => Promise<void>;
  };

  let { open = $bindable(false), vmName, onSubmit }: Props = $props();

  let name = $state('');
  let description = $state('');
  let vmstate = $state(false);
  let busy = $state(false);

  // Reset every field each time the dialog opens.
  $effect(() => {
    if (open) {
      name = '';
      description = '';
      vmstate = false;
      busy = false;
    }
  });

  const nameValid = $derived(name.trim().length >= 1 && name.trim().length <= 40);

  async function handleSubmit() {
    if (busy || !nameValid) return;
    busy = true;
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        vmstate,
      });
      open = false;
    } finally {
      busy = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Create snapshot</Dialog.Title>
      <Dialog.Description>
        Capture the current state of {vmName}.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <Label for="snapshot-name">Snapshot name</Label>
        <Input
          id="snapshot-name"
          type="text"
          bind:value={name}
          maxlength={40}
          placeholder="e.g. before-upgrade"
          autocomplete="off"
        />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="snapshot-description">Description</Label>
        <Textarea
          id="snapshot-description"
          bind:value={description}
          placeholder="Optional — why you took this snapshot."
          rows={3}
        />
      </div>

      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <Label for="snapshot-vmstate">Include RAM state</Label>
          <p class="text-[13px] text-muted-foreground">
            Captures the running memory; the snapshot takes longer and uses more space.
          </p>
        </div>
        <Switch id="snapshot-vmstate" bind:checked={vmstate} />
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (open = false)} disabled={busy}>
        Cancel
      </Button>
      <Button onclick={handleSubmit} disabled={busy || !nameValid}>
        Create snapshot
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
