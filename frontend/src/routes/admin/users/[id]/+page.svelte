<!--
  /admin/users/[id] — Edit user form + reset password + disable/delete.

  Per UI-SPEC §Admin pages + §Form Patterns + §Destructive confirmations:
    - Heading: username + role badge.
    - Edit card: Email, Is admin (Switch, disabled-on-self), Is active
      (Switch, disabled-on-self), Teams (multi-select replaces current).
    - Submit "Save changes" (UI-SPEC primary CTA).
    - Reset password card (separate, admin-set): "Update password" CTA → on
      success, toast "Password reset. The user must sign in again.".
    - Danger card (only if not self): Disable + Delete buttons → ConfirmByNameDialog
      with UI-SPEC verbatim copy.

  STRIDE:
    - T-01-10-01 (self-modification): Switches disabled-on-self; Disable/Delete
      buttons hidden when target is self.
    - T-01-10-02 (destructive without confirm): all destructive routes through
      ConfirmByNameDialog (Plan 08).
    - T-01-10-05 (stale session impersonation): `data.user.id` comes from a
      fresh SSR /me probe (Plan 08 hooks.server.ts) on every navigation.
-->
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import PasswordInput from '$lib/components/forms/PasswordInput.svelte';
  import FormSummaryAlert from '$lib/components/forms/FormSummaryAlert.svelte';
  import ConfirmByNameDialog from '$lib/components/forms/ConfirmByNameDialog.svelte';
  import { api, ApiError } from '$lib/api/client';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const isSelf = $derived(data.target.id === data.user.id);
  // Personal team is bookkeeping — only show shared teams in the picker AND
  // only those are what the backend's team_ids REPLACE semantics touch.
  const assignableTeams = $derived(data.teams.filter((t) => !t.personal));

  // ---- Edit form state (seeded from SSR data) ----
  // We deliberately seed from the initial prop value and keep the typed form
  // values stable across reactive updates of `data` (e.g. invalidateAll() after
  // a save). `untrack` tells Svelte we KNOW this captures the prop only once.
  let email = $state(untrack(() => data.target.email));
  let isAdmin = $state(untrack(() => data.target.is_admin));
  let isActive = $state(untrack(() => data.target.is_active));
  // Pre-select non-personal teams the user currently belongs to.
  let selectedTeamIds = $state<number[]>(
    untrack(() => data.target.teams.filter((t) => !t.personal).map((t) => t.id))
  );
  let editSubmitting = $state(false);
  let editFormError = $state<string | null>(null);
  let editFieldErrors = $state<Record<string, string>>({});

  function mapUpdateError(err: unknown): { field?: string; message?: string; summary?: string } {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return {
          field: 'user-edit-email',
          message: 'A user with that email already exists.'
        };
      }
      if (err.status === 422) {
        const detail = String((err.body as { detail?: unknown } | null)?.detail ?? '');
        if (detail.toLowerCase().includes('yourself')) {
          return { summary: 'You cannot modify your own admin or active state.' };
        }
        return { summary: "Couldn't save changes. Check the form for details." };
      }
    }
    return { summary: 'Something went wrong on our side. Please try again.' };
  }

  function toggleTeam(teamId: number, checked: boolean) {
    if (checked) {
      if (!selectedTeamIds.includes(teamId)) {
        selectedTeamIds = [...selectedTeamIds, teamId];
      }
    } else {
      selectedTeamIds = selectedTeamIds.filter((id) => id !== teamId);
    }
  }

  async function handleEdit(event: SubmitEvent) {
    event.preventDefault();
    editFormError = null;
    editFieldErrors = {};
    if (!email.trim()) {
      editFieldErrors = { 'user-edit-email': 'Email is required.' };
      return;
    }
    editSubmitting = true;
    try {
      // Self-guard: never send is_admin / is_active for self (UI hides the
      // switches, but defence in depth).
      const payload: {
        email: string;
        is_admin?: boolean;
        is_active?: boolean;
        team_ids: number[];
      } = {
        email: email.trim(),
        team_ids: selectedTeamIds
      };
      if (!isSelf) {
        payload.is_admin = isAdmin;
        payload.is_active = isActive;
      }
      await api.users.update({ id: data.target.id, ...payload });
      toast.success('Changes saved.');
      await invalidateAll();
    } catch (err) {
      const mapped = mapUpdateError(err);
      if (mapped.field && mapped.message) {
        editFieldErrors = { ...editFieldErrors, [mapped.field]: mapped.message };
      } else if (mapped.summary) {
        editFormError = mapped.summary;
      }
    } finally {
      editSubmitting = false;
    }
  }

  // ---- Reset password form state ----
  let newPassword = $state('');
  let confirmPassword = $state('');
  let pwSubmitting = $state(false);
  let pwFormError = $state<string | null>(null);
  let pwFieldErrors = $state<Record<string, string>>({});

  function validatePassword(): boolean {
    const errs: Record<string, string> = {};
    if (!newPassword) {
      errs['user-edit-new-password'] = 'New password is required.';
    } else if (newPassword.length < 12) {
      errs['user-edit-new-password'] = 'Password must be at least 12 characters.';
    }
    if (newPassword !== confirmPassword) {
      errs['user-edit-confirm-password'] = "New passwords don't match.";
    }
    pwFieldErrors = errs;
    return Object.keys(errs).length === 0;
  }

  async function handleResetPassword(event: SubmitEvent) {
    event.preventDefault();
    pwFormError = null;
    if (!validatePassword()) return;
    pwSubmitting = true;
    try {
      await api.users.setPassword({ id: data.target.id, new_password: newPassword });
      toast.success('Password reset. The user must sign in again.');
      newPassword = '';
      confirmPassword = '';
      pwFieldErrors = {};
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        pwFormError = 'Password must be at least 12 characters.';
      } else {
        pwFormError = 'Something went wrong on our side. Please try again.';
      }
    } finally {
      pwSubmitting = false;
    }
  }

  // ---- Disable / Delete (typed-name confirm) ----
  let disableOpen = $state(false);
  let deleteOpen = $state(false);

  async function handleDisable() {
    try {
      await api.users.update({ id: data.target.id, is_active: false });
      toast.success(`${data.target.username} was disabled.`);
      isActive = false;
      await invalidateAll();
    } catch {
      toast.error("Couldn't disable that user.");
    }
  }

  async function handleDelete() {
    try {
      await api.users.del({ id: data.target.id });
      toast.success(`${data.target.username} was deleted.`);
      await goto('/admin/users');
    } catch {
      toast.error("Couldn't delete that user.");
    }
  }
</script>

<svelte:head>
  <title>{data.target.username} — Users — Proxmox GUI</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6">
  <header class="flex flex-col gap-2">
    <a
      href="/admin/users"
      class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px]"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Back to Users
    </a>
    <div class="flex flex-row items-center gap-2">
      <h1 class="text-[28px] font-semibold tracking-tight">{data.target.username}</h1>
      {#if data.target.is_admin}
        <Badge variant="default">Admin</Badge>
      {/if}
      {#if !data.target.is_active}
        <Badge variant="secondary">Disabled</Badge>
      {/if}
      {#if isSelf}
        <Badge variant="outline">You</Badge>
      {/if}
    </div>
    <p class="text-muted-foreground text-sm">
      Edit this user's account and team membership.
    </p>
  </header>

  <!-- Edit user card -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg font-semibold tracking-tight">Account</Card.Title>
      <Card.Description>Change the user's email, role, status, and team membership.</Card.Description>
    </Card.Header>
    <Card.Content>
      <form class="flex flex-col gap-4" onsubmit={handleEdit} novalidate>
        <FormSummaryAlert errors={editFieldErrors} id="user-edit-summary" />

        {#if editFormError}
          <Alert.Root variant="destructive" aria-live="polite">
            <AlertTriangle aria-hidden="true" />
            <Alert.Title>{editFormError}</Alert.Title>
          </Alert.Root>
        {/if}

        <div class="flex flex-col gap-2">
          <Label for="user-edit-email">Email</Label>
          <Input
            id="user-edit-email"
            type="email"
            bind:value={email}
            autocomplete="off"
            disabled={editSubmitting}
            required
            aria-invalid={editFieldErrors['user-edit-email'] ? 'true' : undefined}
          />
          {#if editFieldErrors['user-edit-email']}
            <p class="text-destructive text-[13px]">{editFieldErrors['user-edit-email']}</p>
          {/if}
        </div>

        <div
          class="flex flex-row items-start justify-between gap-4 rounded-md border border-border p-4"
        >
          <div class="flex flex-col gap-1">
            <Label for="user-edit-is-admin" class="text-sm font-medium">Administrator</Label>
            <p class="text-muted-foreground text-[13px]">
              {#if isSelf}
                You cannot change your own admin status.
              {:else}
                Admins can manage users, teams, and clusters.
              {/if}
            </p>
          </div>
          <Switch
            id="user-edit-is-admin"
            bind:checked={isAdmin}
            disabled={editSubmitting || isSelf}
          />
        </div>

        <div
          class="flex flex-row items-start justify-between gap-4 rounded-md border border-border p-4"
        >
          <div class="flex flex-col gap-1">
            <Label for="user-edit-is-active" class="text-sm font-medium">Active</Label>
            <p class="text-muted-foreground text-[13px]">
              {#if isSelf}
                You cannot disable your own account.
              {:else}
                Disabled users cannot sign in and have their sessions revoked.
              {/if}
            </p>
          </div>
          <Switch
            id="user-edit-is-active"
            bind:checked={isActive}
            disabled={editSubmitting || isSelf}
          />
        </div>

        {#if assignableTeams.length > 0}
          <div class="flex flex-col gap-2">
            <Label>Teams</Label>
            <p class="text-muted-foreground text-[13px]">
              Select the shared teams this user belongs to. (Personal team is kept automatically.)
            </p>
            <ul class="flex flex-col gap-2 rounded-md border border-border p-3">
              {#each assignableTeams as team (team.id)}
                {@const checked = selectedTeamIds.includes(team.id)}
                <li class="flex items-center gap-2">
                  <Checkbox
                    id={`team-${team.id}`}
                    {checked}
                    onCheckedChange={(v) => toggleTeam(team.id, v === true)}
                    disabled={editSubmitting}
                  />
                  <Label for={`team-${team.id}`} class="text-sm font-normal">{team.name}</Label>
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onclick={() => goto('/admin/users')}
            disabled={editSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={editSubmitting}>
            {#if editSubmitting}
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              Saving...
            {:else}
              Save changes
            {/if}
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>

  <!-- Reset password card -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg font-semibold tracking-tight">Reset password</Card.Title>
      <Card.Description>
        Set a new password for this user. Their active sessions are revoked.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <form class="flex flex-col gap-4" onsubmit={handleResetPassword} novalidate>
        <FormSummaryAlert errors={pwFieldErrors} id="user-edit-password-summary" />

        {#if pwFormError}
          <Alert.Root variant="destructive" aria-live="polite">
            <AlertTriangle aria-hidden="true" />
            <Alert.Title>{pwFormError}</Alert.Title>
          </Alert.Root>
        {/if}

        <div class="flex flex-col gap-2">
          <Label for="user-edit-new-password">New password</Label>
          <PasswordInput
            id="user-edit-new-password"
            name="new_password"
            autocomplete="new-password"
            bind:value={newPassword}
            disabled={pwSubmitting}
            required
            aria-invalid={pwFieldErrors['user-edit-new-password'] ? 'true' : undefined}
          />
          {#if pwFieldErrors['user-edit-new-password']}
            <p class="text-destructive text-[13px]">{pwFieldErrors['user-edit-new-password']}</p>
          {:else}
            <p class="text-muted-foreground text-[13px]">At least 12 characters.</p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="user-edit-confirm-password">Confirm new password</Label>
          <PasswordInput
            id="user-edit-confirm-password"
            name="confirm_password"
            autocomplete="new-password"
            bind:value={confirmPassword}
            disabled={pwSubmitting}
            required
            aria-invalid={pwFieldErrors['user-edit-confirm-password'] ? 'true' : undefined}
          />
          {#if pwFieldErrors['user-edit-confirm-password']}
            <p class="text-destructive text-[13px]">
              {pwFieldErrors['user-edit-confirm-password']}
            </p>
          {/if}
        </div>

        <div class="flex justify-end">
          <Button type="submit" disabled={pwSubmitting}>
            {#if pwSubmitting}
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              Resetting...
            {:else}
              Update password
            {/if}
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>

  <!-- Danger zone — hidden for self. -->
  {#if !isSelf}
    <Card.Root class="border-destructive/40">
      <Card.Header>
        <Card.Title class="text-destructive text-lg font-semibold tracking-tight"
          >Danger zone</Card.Title
        >
        <Card.Description>
          {#if data.target.is_active}
            Disable this user to revoke their sessions immediately, or delete them permanently.
          {:else}
            This user is already disabled. Delete them permanently if they no longer need access.
          {/if}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div class="flex flex-wrap gap-2">
          {#if data.target.is_active}
            <Button variant="outline" onclick={() => (disableOpen = true)}>Disable user</Button>
          {/if}
          <Button variant="destructive" onclick={() => (deleteOpen = true)}>Delete user</Button>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}
</div>

{#if !isSelf}
  <ConfirmByNameDialog
    bind:open={disableOpen}
    heading={`Disable ${data.target.username}?`}
    body={`${data.target.username} won't be able to sign in. Active sessions are revoked immediately. You can re-enable them later.`}
    targetName={data.target.username}
    confirmLabel="Disable user"
    onConfirm={handleDisable}
  />
  <ConfirmByNameDialog
    bind:open={deleteOpen}
    heading={`Delete ${data.target.username}?`}
    body={`Their account is removed permanently. Their team memberships are dropped. VMs they created stay with the team. This can't be undone.`}
    targetName={data.target.username}
    confirmLabel="Delete user"
    onConfirm={handleDelete}
  />
{/if}
