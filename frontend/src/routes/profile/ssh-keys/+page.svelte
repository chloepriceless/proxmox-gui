<!--
  /profile/ssh-keys — SSH keys list / add / delete.

  Per UI-SPEC §Profile pages + §Copywriting Contract:
    - Page title "SSH keys" (verbatim) + description
      "Public keys you can attach when creating VMs and containers." (verbatim).
    - Single Card "SSH keys" with "Add SSH key" button at top-right of the card.
    - List rows: name (medium 500) + monospace 13px fingerprint + relative
      created_at + MoreHorizontal dropdown → "Delete".
    - Empty state copy verbatim from UI-SPEC §Required loading / empty / error.
    - Delete: ConfirmByNameDialog (Plan 08), targetName=key.name.
    - Add SSH key dialog: name + public_key textarea, primary CTA "Add key",
      422 inline error verbatim "That doesn't look like an SSH public key.
      Paste the contents of a `.pub` file."

  STRIDE: T-01-09-03 — public-key text rendered through Svelte default
  escaping (no innerHTML); fingerprint comes from the backend (not user).
-->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import FormSummaryAlert from '$lib/components/forms/FormSummaryAlert.svelte';
  import ConfirmByNameDialog from '$lib/components/forms/ConfirmByNameDialog.svelte';
  import { api, ApiError } from '$lib/api/client';
  import type { SshKey } from '$lib/api/types';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Optimistic local override — when we mutate (add / delete) we set this to
  // the fresh client-fetched list so the user sees the change immediately.
  // When null, we fall through to whatever SSR (or a subsequent
  // invalidateAll-triggered re-load) exposed via `data.keys`.
  let localOverride = $state<SshKey[] | null>(null);
  const keys = $derived<SshKey[]>(localOverride ?? data.keys);

  onMount(() => {
    if (data.loadError) toast.error("Couldn't load keys.");
  });

  // ---- Add SSH key dialog ----
  let addOpen = $state(false);
  let newName = $state('');
  let newPublicKey = $state('');
  let addSubmitting = $state(false);
  let addFormError = $state<string | null>(null);
  let addFieldErrors = $state<Record<string, string>>({});

  function resetAddForm() {
    newName = '';
    newPublicKey = '';
    addFieldErrors = {};
    addFormError = null;
  }

  $effect(() => {
    if (addOpen) resetAddForm();
  });

  function validateAdd(): boolean {
    const errs: Record<string, string> = {};
    if (!newName.trim()) errs['ssh-add-name'] = 'Name is required.';
    if (!newPublicKey.trim()) errs['ssh-add-public-key'] = 'Public key is required.';
    addFieldErrors = errs;
    return Object.keys(errs).length === 0;
  }

  function mapAddError(err: unknown): { field?: string; message?: string; summary?: string } {
    if (err instanceof ApiError) {
      if (err.status === 422) {
        return {
          field: 'ssh-add-public-key',
          message:
            "That doesn't look like an SSH public key. Paste the contents of a `.pub` file."
        };
      }
      if (err.status === 409) {
        return {
          field: 'ssh-add-public-key',
          message: 'You already have a key with that fingerprint.'
        };
      }
    }
    return { summary: 'Something went wrong on our side. Please try again.' };
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault();
    addFormError = null;
    if (!validateAdd()) return;
    addSubmitting = true;
    try {
      await api.me.addSshKey({
        name: newName.trim(),
        public_key: newPublicKey.trim()
      });
      // Re-fetch the list so the new row appears with the backend-derived
      // fingerprint (we never trust client-side parsing for that field).
      const fresh = await api.me.listSshKeys();
      localOverride = fresh;
      toast.success('Key added.');
      addOpen = false;
      await invalidateAll();
    } catch (err) {
      const mapped = mapAddError(err);
      if (mapped.field && mapped.message) {
        addFieldErrors = { ...addFieldErrors, [mapped.field]: mapped.message };
      } else if (mapped.summary) {
        addFormError = mapped.summary;
      }
    } finally {
      addSubmitting = false;
    }
  }

  // ---- Delete (typed-name confirm) ----
  let deleteOpen = $state(false);
  let deleteTarget = $state<SshKey | null>(null);

  function openDelete(key: SshKey) {
    deleteTarget = key;
    deleteOpen = true;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await api.me.deleteSshKey({ id: target.id });
      localOverride = keys.filter((k) => k.id !== target.id);
      toast.success('Key deleted.');
      await invalidateAll();
    } catch {
      // 404 is the cross-user / already-deleted case — same message either way.
      toast.error("Couldn't delete that key.");
    } finally {
      deleteTarget = null;
    }
  }

  // ---- Relative-time helper (months/days/hours/minutes) ----
  function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
  }
</script>

<svelte:head>
  <title>SSH keys — Proxmox GUI</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6">
  <header class="flex flex-col gap-2">
    <h1 class="text-[28px] font-semibold tracking-tight">SSH keys</h1>
    <p class="text-muted-foreground text-sm">
      Public keys you can attach when creating VMs and containers.
    </p>
  </header>

  <Card.Root>
    <Card.Header class="flex flex-row items-start justify-between gap-4 space-y-0">
      <div class="flex flex-col gap-1.5">
        <Card.Title class="text-lg font-semibold tracking-tight">SSH keys</Card.Title>
        <Card.Description>
          Public keys you can attach when creating VMs and containers.
        </Card.Description>
      </div>
      <Button onclick={() => (addOpen = true)}>Add SSH key</Button>
    </Card.Header>
    <Card.Content>
      {#if keys.length === 0}
        <div
          class="border-border bg-muted/30 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-10 text-center"
        >
          <KeyRound class="text-muted-foreground size-6" aria-hidden="true" />
          <p class="text-sm font-medium">No SSH keys yet</p>
          <p class="text-muted-foreground text-[13px]">
            Add a public key to enable per-VM SSH access (used in Phase 4).
          </p>
        </div>
      {:else}
        <ul class="divide-border divide-y">
          {#each keys as key (key.id)}
            <li class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="text-sm font-medium">{key.name}</span>
                <code
                  class="text-muted-foreground truncate font-mono text-[13px]"
                  title={key.fingerprint}>{key.fingerprint}</code
                >
                <span class="text-muted-foreground text-[13px]">
                  Added {relativeTime(key.created_at)}
                </span>
              </div>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <button
                      {...props}
                      class="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-md transition-colors"
                      aria-label={`Actions for ${key.name}`}
                    >
                      <MoreHorizontal class="size-4" aria-hidden="true" />
                    </button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item
                    class="text-destructive focus:text-destructive"
                    onSelect={() => openDelete(key)}
                  >
                    Delete
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </li>
          {/each}
        </ul>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<!-- Add SSH key dialog -->
<Dialog.Root bind:open={addOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Add an SSH public key</Dialog.Title>
      <Dialog.Description>
        Paste the contents of a `.pub` file. We compute the fingerprint server-side.
      </Dialog.Description>
    </Dialog.Header>

    <form class="flex flex-col gap-4" onsubmit={handleAdd} novalidate>
      <FormSummaryAlert errors={addFieldErrors} id="ssh-add-summary" />

      {#if addFormError}
        <Alert.Root variant="destructive" aria-live="polite">
          <AlertTriangle aria-hidden="true" />
          <Alert.Title>{addFormError}</Alert.Title>
        </Alert.Root>
      {/if}

      <div class="flex flex-col gap-2">
        <Label for="ssh-add-name">Name</Label>
        <Input
          id="ssh-add-name"
          type="text"
          bind:value={newName}
          autocomplete="off"
          placeholder="laptop"
          disabled={addSubmitting}
          required
          aria-invalid={addFieldErrors['ssh-add-name'] ? 'true' : undefined}
        />
        {#if addFieldErrors['ssh-add-name']}
          <p class="text-destructive text-[13px]">{addFieldErrors['ssh-add-name']}</p>
        {:else}
          <p class="text-muted-foreground text-[13px]">A short label so you can identify this key.</p>
        {/if}
      </div>

      <div class="flex flex-col gap-2">
        <Label for="ssh-add-public-key">Public key</Label>
        <Textarea
          id="ssh-add-public-key"
          bind:value={newPublicKey}
          rows={5}
          spellcheck={false}
          placeholder={"ssh-ed25519 AAAA... user@host"}
          disabled={addSubmitting}
          required
          class="font-mono text-[13px]"
          aria-invalid={addFieldErrors['ssh-add-public-key'] ? 'true' : undefined}
        />
        {#if addFieldErrors['ssh-add-public-key']}
          <p class="text-destructive text-[13px]">{addFieldErrors['ssh-add-public-key']}</p>
        {:else}
          <p class="text-muted-foreground text-[13px]">
            Paste the contents of your `.pub` file (e.g. <code>~/.ssh/id_ed25519.pub</code>).
          </p>
        {/if}
      </div>

      <Dialog.Footer>
        <Button type="button" variant="ghost" onclick={() => (addOpen = false)} disabled={addSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={addSubmitting}>
          {#if addSubmitting}
            <Loader2 class="size-4 animate-spin" aria-hidden="true" />
            Adding...
          {:else}
            Add key
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete confirmation (typed-name) -->
{#if deleteTarget}
  <ConfirmByNameDialog
    bind:open={deleteOpen}
    heading={`Delete '${deleteTarget.name}'?`}
    body="This key is removed from your account. Existing VMs that already have this key keep it."
    targetName={deleteTarget.name}
    confirmLabel="Delete key"
    onConfirm={handleDelete}
  />
{/if}
