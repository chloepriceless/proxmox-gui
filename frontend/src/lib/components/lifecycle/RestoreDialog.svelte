<!--
  RestoreDialog — the Restore-from-backup dialog (D-07).

  Contract: UI-SPEC §"Restore-from-backup dialog" + §Confirmation matrix +
  §Copywriting Contract.
    - shadcn `dialog`.
    - A radio group: "Overwrite this VM (in-place)" — DEFAULT selected — and
      "Restore as a new VM".
    - In-place: reveals a bg-destructive/10 data-loss warning + a typed-name
      confirm field (the ConfirmByNameDialog pattern, composed inline). The
      CTA is "Restore (overwrite)" and stays disabled until the typed name
      matches the VM name. ENTER does not submit the typed-name field.
    - Restore-as-new: reveals New VMID (number, auto-filled/overridable) +
      New name (text). No typed-name confirm. CTA becomes "Restore as new VM".
      Restore-as-new counts against quota (backend enforces — Plan 03-04).
    - The CTA label swaps with the selected mode.
    - On submit → api.lifecycle.restore({...,mode}) → 202 → enqueue toast.

  STRIDE: T-03-07-06 — every PVE-derived string (vmName, backupFilename) is
  rendered via Svelte text interpolation (auto-escaped); no {@html}.
  T-03-07-07 — the in-place destructive CTA is gated behind the typed-name
  confirm; the backend authorization is the real enforcement point.
-->
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import type { ResourceKind } from '$lib/api/types';

  type Props = {
    open?: boolean;
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    /** Display name — dialog copy + the in-place typed-name target. */
    vmName: string;
    /** The backup file's human-readable filename — shown in the dialog copy. */
    backupFilename: string;
    /** The PVE volume id of the archive being restored — the API `archive`. */
    archiveVolid: string;
  };

  let {
    open = $bindable(false),
    clusterId,
    vmid,
    type,
    vmName,
    backupFilename,
    archiveVolid,
  }: Props = $props();

  /** "in_place" is the default selection (D-07). */
  let mode = $state<'in_place' | 'new'>('in_place');
  /** Typed-name confirm value for the in-place (overwrite) mode. */
  let typed = $state('');
  /** Restore-as-new fields. */
  let newVmid = $state('');
  let newName = $state('');
  let busy = $state(false);

  // Reset every time the dialog opens — never carry state across restores.
  $effect(() => {
    if (!open) return;
    mode = 'in_place';
    typed = '';
    newVmid = '';
    newName = `${vmName}-restore`;
    busy = false;
  });

  // In-place typed-name confirm: trimmed, case-sensitive (ConfirmByNameDialog
  // pattern).
  const matches = $derived(typed.trim() === vmName.trim());
  const showHint = $derived(typed.length > 0 && !matches);

  const newNameValid = $derived(newName.trim().length >= 1);
  // The backend requires a target VMID for restore-as-new (RestoreRequest
  // model validator) — the field is required, not auto-assignable here.
  const newVmidValid = $derived(
    newVmid.trim() !== '' && Number(newVmid.trim()) >= 1
  );

  // The CTA label swaps with the selected mode (UI-SPEC §Copywriting).
  const ctaLabel = $derived(
    mode === 'in_place' ? 'Restore (overwrite)' : 'Restore as new VM'
  );

  // The CTA is disabled until the active mode's inputs are valid.
  const canSubmit = $derived(
    mode === 'in_place' ? matches : newNameValid && newVmidValid
  );

  function onTypedKeydown(event: KeyboardEvent) {
    // ENTER must NOT submit — UI-SPEC §Destructive confirmations.
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  async function handleSubmit() {
    if (busy || !canSubmit) return;
    busy = true;
    try {
      await api.lifecycle.restore({
        clusterId,
        vmid,
        type,
        archive: archiveVolid,
        mode,
        ...(mode === 'new'
          ? { new_vmid: Number(newVmid.trim()), new_name: newName.trim() }
          : {}),
      });
      toast(`Restore started for ${vmName}.`);
      open = false;
    } catch {
      toast.error(`Couldn’t queue the restore for ${vmName}. Try again.`);
    } finally {
      busy = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Restore {vmName}</Dialog.Title>
      <Dialog.Description>
        from {backupFilename}
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4">
      <!-- Mode radio group — in-place is the default (D-07). -->
      <fieldset class="flex flex-col gap-2">
        <legend class="text-[13px] font-medium mb-1">Restore mode</legend>
        <label class="flex items-start gap-2 text-[14px]">
          <input
            type="radio"
            name="restore-mode"
            value="in_place"
            class="mt-1"
            bind:group={mode}
          />
          <span>Overwrite this VM (in-place)</span>
        </label>
        <label class="flex items-start gap-2 text-[14px]">
          <input
            type="radio"
            name="restore-mode"
            value="new"
            class="mt-1"
            bind:group={mode}
          />
          <span>Restore as a new VM</span>
        </label>
      </fieldset>

      {#if mode === 'in_place'}
        <!-- Data-loss warning + typed-name confirm (D-07 / D-10). -->
        <div
          class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3"
        >
          <TriangleAlert
            class="size-4 shrink-0 text-destructive mt-0.5"
            aria-hidden="true"
          />
          <p class="text-[14px] text-foreground">
            This replaces the current disk contents of {vmName} with the backup
            '{backupFilename}'. The current state is lost. This can't be undone.
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <Label for="restore-confirm-name">
            Type
            <code class="bg-muted rounded px-1 py-0.5 font-mono text-xs"
              >{vmName}</code
            >
            to confirm
          </Label>
          <Input
            id="restore-confirm-name"
            type="text"
            bind:value={typed}
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck={false}
            onkeydown={onTypedKeydown}
            aria-invalid={showHint ? 'true' : undefined}
            aria-describedby={showHint ? 'restore-confirm-hint' : undefined}
          />
          {#if showHint}
            <p id="restore-confirm-hint" class="text-destructive text-[13px]">
              Doesn't match — type the name exactly.
            </p>
          {/if}
        </div>
      {:else}
        <!-- Restore-as-new — VMID picker + new name. Counts against quota. -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="restore-new-vmid">New VMID</Label>
            <Input
              id="restore-new-vmid"
              type="number"
              min={1}
              bind:value={newVmid}
              placeholder="e.g. 110"
            />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="restore-new-name">New name</Label>
            <Input
              id="restore-new-name"
              type="text"
              bind:value={newName}
              autocomplete="off"
            />
          </div>
        </div>
        <p class="text-[13px] text-muted-foreground">
          The restored VM counts against your team's quota.
        </p>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (open = false)} disabled={busy}>
        Cancel
      </Button>
      <Button
        variant={mode === 'in_place' ? 'destructive' : 'default'}
        onclick={handleSubmit}
        disabled={busy || !canSubmit}
      >
        {ctaLabel}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
