<!--
  /profile/tokens — Personal Access Tokens list / create / revoke.

  Per UI-SPEC §Profile pages + §Token / secret display + §Copywriting:
    - Title "Personal Access Tokens" (verbatim) + description
      "Authenticate the REST API with the same permissions as your account." (verbatim).
    - Single Card "Personal Access Tokens" with "Create token" CTA.
    - List rows: name, mono prefix_preview, expires_at relative ("never" if null),
      last_used_at relative, status badge (active / revoked / expired).
    - MoreHorizontal dropdown → "Revoke" (destructive).
    - Empty state copy: "No tokens yet — Create a Personal Access Token..." (UI-SPEC).
    - Create flow: dialog with name + optional expiry → POST /me/tokens →
      response.plaintext fed to SecretRevealDialog (Plan 08), label
      "Save this token now." body "You won't see it again. Store it
      somewhere safe." (UI-SPEC verbatim, also defaults inside the dialog).
    - Revoke: ConfirmByNameDialog (Plan 08), targetName=token.name, body
      "Any application using this token loses access immediately. This can't
      be undone." (UI-SPEC verbatim).

  STRIDE:
    - T-01-09-01: SecretRevealDialog clears `secret` on dismiss; never
      written to localStorage.
    - T-01-09-04: After mint AND after revoke we re-fetch the list so the
      status badge reflects backend truth.
-->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import FormSummaryAlert from '$lib/components/forms/FormSummaryAlert.svelte';
  import ConfirmByNameDialog from '$lib/components/forms/ConfirmByNameDialog.svelte';
  import SecretRevealDialog from '$lib/components/forms/SecretRevealDialog.svelte';
  import { api, ApiError } from '$lib/api/client';
  import type { PATListItem } from '$lib/api/types';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
  import Key from '@lucide/svelte/icons/key';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Optimistic local override (see ssh-keys page rationale). When null, fall
  // through to whatever SSR / invalidateAll exposed via `data.tokens`.
  let localOverride = $state<PATListItem[] | null>(null);
  const tokens = $derived<PATListItem[]>(localOverride ?? data.tokens);

  onMount(() => {
    if (data.loadError) toast.error("Couldn't load tokens.");
  });

  // ---- Create dialog ----
  let createOpen = $state(false);
  let newName = $state('');
  let newExpiresAt = $state('');
  let createSubmitting = $state(false);
  let createFormError = $state<string | null>(null);
  let createFieldErrors = $state<Record<string, string>>({});

  function resetCreateForm() {
    newName = '';
    newExpiresAt = '';
    createFieldErrors = {};
    createFormError = null;
  }

  $effect(() => {
    if (createOpen) resetCreateForm();
  });

  function validateCreate(): boolean {
    const errs: Record<string, string> = {};
    if (!newName.trim()) errs['pat-create-name'] = 'Name is required.';
    if (newExpiresAt) {
      const ts = Date.parse(newExpiresAt);
      if (Number.isNaN(ts)) {
        errs['pat-create-expires'] = "That date doesn't look right.";
      } else if (ts <= Date.now()) {
        errs['pat-create-expires'] = 'Expiry must be in the future.';
      }
    }
    createFieldErrors = errs;
    return Object.keys(errs).length === 0;
  }

  function mapCreateError(err: unknown): { field?: string; message?: string; summary?: string } {
    if (err instanceof ApiError) {
      if (err.status === 422) {
        return { summary: "Couldn't create the token. Check the name and expiry." };
      }
      if (err.status === 409) {
        return { field: 'pat-create-name', message: 'You already have a token with that name.' };
      }
    }
    return { summary: 'Something went wrong on our side. Please try again.' };
  }

  // ---- Show-once reveal dialog state ----
  let revealOpen = $state(false);
  let revealedSecret = $state('');

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    createFormError = null;
    if (!validateCreate()) return;
    createSubmitting = true;
    try {
      // Backend takes ISO 8601; the date input emits YYYY-MM-DD (no time).
      // Promote to end-of-day UTC so a chosen date doesn't expire immediately.
      let expires_at: string | null = null;
      if (newExpiresAt) {
        const d = new Date(`${newExpiresAt}T23:59:59Z`);
        expires_at = d.toISOString();
      }
      const minted = await api.me.mintToken({
        name: newName.trim(),
        expires_at
      });
      // Close the form dialog FIRST so the SecretRevealDialog has the foreground.
      createOpen = false;
      // Surface the show-once plaintext via SecretRevealDialog.
      revealedSecret = minted.plaintext;
      revealOpen = true;
      // Refresh the list so the new prefix_preview row appears (T-01-09-04).
      const fresh = await api.me.listTokens();
      localOverride = fresh;
      await invalidateAll();
    } catch (err) {
      const mapped = mapCreateError(err);
      if (mapped.field && mapped.message) {
        createFieldErrors = { ...createFieldErrors, [mapped.field]: mapped.message };
      } else if (mapped.summary) {
        createFormError = mapped.summary;
      }
    } finally {
      createSubmitting = false;
    }
  }

  function handleRevealDismissed() {
    // SecretRevealDialog clears its own bound `secret` prop; we additionally
    // clear our local mirror as belt-and-braces (T-01-09-01).
    revealedSecret = '';
  }

  // ---- Revoke (typed-name confirm) ----
  let revokeOpen = $state(false);
  let revokeTarget = $state<PATListItem | null>(null);

  function openRevoke(token: PATListItem) {
    revokeTarget = token;
    revokeOpen = true;
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    const target = revokeTarget;
    try {
      await api.me.revokeToken({ id: target.id });
      // Re-fetch instead of mutating locally — backend may have updated more
      // than one column (revoked_at + status). T-01-09-04.
      const fresh = await api.me.listTokens();
      localOverride = fresh;
      toast.success('Token revoked.');
      await invalidateAll();
    } catch {
      toast.error("Couldn't revoke that token.");
    } finally {
      revokeTarget = null;
    }
  }

  // ---- Helpers ----
  type Status = 'active' | 'revoked' | 'expired';

  function statusOf(token: PATListItem): Status {
    if (token.revoked_at) return 'revoked';
    if (token.expires_at && Date.parse(token.expires_at) <= Date.now()) return 'expired';
    return 'active';
  }

  function relativeTime(iso: string | null): string {
    if (!iso) return 'never';
    const then = new Date(iso).getTime();
    const now = Date.now();
    const future = then > now;
    const diff = Math.abs(now - then);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return future ? 'in less than a minute' : 'just now';
    if (minutes < 60)
      return future
        ? `in ${minutes} minute${minutes === 1 ? '' : 's'}`
        : `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
      return future
        ? `in ${hours} hour${hours === 1 ? '' : 's'}`
        : `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30)
      return future
        ? `in ${days} day${days === 1 ? '' : 's'}`
        : `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12)
      return future
        ? `in ${months} month${months === 1 ? '' : 's'}`
        : `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return future ? `in ${years} year${years === 1 ? '' : 's'}` : `${years} year${years === 1 ? '' : 's'} ago`;
  }
</script>

<svelte:head>
  <title>Personal Access Tokens — Proxmox GUI</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6">
  <header class="flex flex-col gap-2">
    <h1 class="text-[28px] font-semibold tracking-tight">Personal Access Tokens</h1>
    <p class="text-muted-foreground text-sm">
      Authenticate the REST API with the same permissions as your account.
    </p>
  </header>

  <Card.Root>
    <Card.Header class="flex flex-row items-start justify-between gap-4 space-y-0">
      <div class="flex flex-col gap-1.5">
        <Card.Title class="text-lg font-semibold tracking-tight">Personal Access Tokens</Card.Title>
        <Card.Description>
          Authenticate the REST API with the same permissions as your account.
        </Card.Description>
      </div>
      <Button onclick={() => (createOpen = true)}>Create token</Button>
    </Card.Header>
    <Card.Content>
      {#if tokens.length === 0}
        <div
          class="border-border bg-muted/30 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-10 text-center"
        >
          <Key class="text-muted-foreground size-6" aria-hidden="true" />
          <p class="text-sm font-medium">No tokens yet</p>
          <p class="text-muted-foreground text-[13px]">
            Create a Personal Access Token to use the REST API.
          </p>
        </div>
      {:else}
        <ul class="divide-border divide-y">
          {#each tokens as token (token.id)}
            {@const status = statusOf(token)}
            <li class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">{token.name}</span>
                  {#if status === 'active'}
                    <Badge variant="secondary">Active</Badge>
                  {:else if status === 'revoked'}
                    <Badge variant="destructive">Revoked</Badge>
                  {:else}
                    <Badge variant="outline">Expired</Badge>
                  {/if}
                </div>
                <code class="text-muted-foreground truncate font-mono text-[13px]"
                  >{token.prefix_preview}</code
                >
                <span class="text-muted-foreground text-[13px]">
                  Expires {relativeTime(token.expires_at)} · Last used {relativeTime(
                    token.last_used_at
                  )}
                </span>
              </div>
              {#if status === 'active'}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <button
                        {...props}
                        class="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-md transition-colors"
                        aria-label={`Actions for ${token.name}`}
                      >
                        <MoreHorizontal class="size-4" aria-hidden="true" />
                      </button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item
                      class="text-destructive focus:text-destructive"
                      onSelect={() => openRevoke(token)}
                    >
                      Revoke
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<!-- Create-token dialog -->
<Dialog.Root bind:open={createOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Create a Personal Access Token</Dialog.Title>
      <Dialog.Description>
        Tokens authenticate the REST API with the same permissions as your account.
      </Dialog.Description>
    </Dialog.Header>

    <form class="flex flex-col gap-4" onsubmit={handleCreate} novalidate>
      <FormSummaryAlert errors={createFieldErrors} id="pat-create-summary" />

      {#if createFormError}
        <Alert.Root variant="destructive" aria-live="polite">
          <AlertTriangle aria-hidden="true" />
          <Alert.Title>{createFormError}</Alert.Title>
        </Alert.Root>
      {/if}

      <div class="flex flex-col gap-2">
        <Label for="pat-create-name">Name</Label>
        <Input
          id="pat-create-name"
          type="text"
          bind:value={newName}
          autocomplete="off"
          placeholder="ci-deploy"
          disabled={createSubmitting}
          required
          aria-invalid={createFieldErrors['pat-create-name'] ? 'true' : undefined}
        />
        {#if createFieldErrors['pat-create-name']}
          <p class="text-destructive text-[13px]">{createFieldErrors['pat-create-name']}</p>
        {:else}
          <p class="text-muted-foreground text-[13px]">A short label so you can identify this token.</p>
        {/if}
      </div>

      <div class="flex flex-col gap-2">
        <Label for="pat-create-expires">Expires (optional)</Label>
        <Input
          id="pat-create-expires"
          type="date"
          bind:value={newExpiresAt}
          disabled={createSubmitting}
          aria-invalid={createFieldErrors['pat-create-expires'] ? 'true' : undefined}
        />
        {#if createFieldErrors['pat-create-expires']}
          <p class="text-destructive text-[13px]">{createFieldErrors['pat-create-expires']}</p>
        {:else}
          <p class="text-muted-foreground text-[13px]">Leave empty for a token that never expires.</p>
        {/if}
      </div>

      <Dialog.Footer>
        <Button
          type="button"
          variant="ghost"
          onclick={() => (createOpen = false)}
          disabled={createSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createSubmitting}>
          {#if createSubmitting}
            <Loader2 class="size-4 animate-spin" aria-hidden="true" />
            Creating...
          {:else}
            Create token
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<!-- Show-once reveal dialog (Plan 08 component).
     Defaults match UI-SPEC verbatim:
       label = "Save this token now."
       body  = "You won't see it again. Store it somewhere safe." -->
<SecretRevealDialog
  bind:open={revealOpen}
  bind:secret={revealedSecret}
  onDismissed={handleRevealDismissed}
/>

<!-- Revoke confirmation (typed-name) -->
{#if revokeTarget}
  <ConfirmByNameDialog
    bind:open={revokeOpen}
    heading={`Revoke '${revokeTarget.name}'?`}
    body="Any application using this token loses access immediately. This can't be undone."
    targetName={revokeTarget.name}
    confirmLabel="Revoke token"
    onConfirm={handleRevoke}
  />
{/if}
