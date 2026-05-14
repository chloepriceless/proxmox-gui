<!--
  /admin/users/new — Create a new user.

  Per UI-SPEC §Admin pages + §Form Patterns + §Copywriting Contract:
    - Page title "New user" + description "Create an account and assign team membership." (verbatim).
    - Fields: Username (regex), Email, Password (>=12), Confirm password,
      Is admin (Switch), Teams (multi-select against /api/v1/teams).
    - Submit "Create user" (UI-SPEC primary CTA).
    - 409 (duplicate username) → inline error per UI-SPEC verbatim:
      "A user with that username already exists."
    - 422 → summary alert per UI-SPEC.
    - Success → goto('/admin/users') + toast "User created.".

  STRIDE: T-01-10-03 — password field is PasswordInput (type=password by
  default with reveal toggle); we never echo it back from a server response.
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import PasswordInput from '$lib/components/forms/PasswordInput.svelte';
  import FormSummaryAlert from '$lib/components/forms/FormSummaryAlert.svelte';
  import { api, ApiError } from '$lib/api/client';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // ---- Form state ----
  let username = $state('');
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let isAdmin = $state(false);
  let selectedTeamIds = $state<number[]>([]);
  let submitting = $state(false);
  let formError = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});

  // Show only non-personal teams in the picker (personal teams are
  // user-owned bookkeeping and not assignable here).
  const assignableTeams = $derived(data.teams.filter((t) => !t.personal));

  onMount(() => {
    if (data.loadError) toast.error("Couldn't load teams. You can still create the user.");
  });

  // Username regex matches backend `^[a-zA-Z0-9_.-]{3,64}$` (Plan 07 schema).
  const USERNAME_RE = /^[a-zA-Z0-9_.\-]{3,64}$/;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!username.trim()) {
      errs['user-new-username'] = 'Username is required.';
    } else if (!USERNAME_RE.test(username.trim())) {
      errs['user-new-username'] =
        'Letters, numbers, dots, dashes, underscores (3-64 characters).';
    }
    if (!email.trim()) {
      errs['user-new-email'] = 'Email is required.';
    }
    if (!password) {
      errs['user-new-password'] = 'Password is required.';
    } else if (password.length < 12) {
      errs['user-new-password'] = 'Password must be at least 12 characters.';
    }
    if (password !== confirmPassword) {
      errs['user-new-confirm-password'] = "New passwords don't match.";
    }
    fieldErrors = errs;
    return Object.keys(errs).length === 0;
  }

  function mapCreateError(err: unknown): { field?: string; message?: string; summary?: string } {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        // Could be username OR email duplicate; UI-SPEC error copy maps both.
        const detail = String(
          (err.body as { detail?: unknown } | null)?.detail ?? ''
        ).toLowerCase();
        if (detail.includes('email')) {
          return {
            field: 'user-new-email',
            message: 'A user with that email already exists.'
          };
        }
        return {
          field: 'user-new-username',
          message: 'A user with that username already exists.'
        };
      }
      if (err.status === 422) {
        return { summary: "Couldn't create the user. Check the form for details." };
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

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    if (!validate()) return;
    submitting = true;
    try {
      await api.users.create({
        username: username.trim(),
        email: email.trim(),
        password,
        is_admin: isAdmin,
        team_ids: selectedTeamIds
      });
      toast.success('User created.');
      await goto('/admin/users');
    } catch (err) {
      const mapped = mapCreateError(err);
      if (mapped.field && mapped.message) {
        fieldErrors = { ...fieldErrors, [mapped.field]: mapped.message };
      } else if (mapped.summary) {
        formError = mapped.summary;
      }
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>New user — Proxmox GUI</title>
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
    <h1 class="text-[28px] font-semibold tracking-tight">New user</h1>
    <p class="text-muted-foreground text-sm">Create an account and assign team membership.</p>
  </header>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg font-semibold tracking-tight">Account details</Card.Title>
      <Card.Description>The user signs in with these credentials.</Card.Description>
    </Card.Header>
    <Card.Content>
      <form class="flex flex-col gap-4" onsubmit={handleSubmit} novalidate>
        <FormSummaryAlert errors={fieldErrors} id="user-new-summary" />

        {#if formError}
          <Alert.Root variant="destructive" aria-live="polite">
            <AlertTriangle aria-hidden="true" />
            <Alert.Title>{formError}</Alert.Title>
          </Alert.Root>
        {/if}

        <div class="flex flex-col gap-2">
          <Label for="user-new-username">Username</Label>
          <Input
            id="user-new-username"
            type="text"
            bind:value={username}
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            disabled={submitting}
            required
            aria-invalid={fieldErrors['user-new-username'] ? 'true' : undefined}
          />
          {#if fieldErrors['user-new-username']}
            <p class="text-destructive text-[13px]">{fieldErrors['user-new-username']}</p>
          {:else}
            <p class="text-muted-foreground text-[13px]">
              Letters, numbers, dots, dashes, underscores.
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="user-new-email">Email</Label>
          <Input
            id="user-new-email"
            type="email"
            bind:value={email}
            autocomplete="off"
            disabled={submitting}
            required
            aria-invalid={fieldErrors['user-new-email'] ? 'true' : undefined}
          />
          {#if fieldErrors['user-new-email']}
            <p class="text-destructive text-[13px]">{fieldErrors['user-new-email']}</p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="user-new-password">Initial password</Label>
          <PasswordInput
            id="user-new-password"
            name="password"
            autocomplete="new-password"
            bind:value={password}
            disabled={submitting}
            required
            aria-invalid={fieldErrors['user-new-password'] ? 'true' : undefined}
          />
          {#if fieldErrors['user-new-password']}
            <p class="text-destructive text-[13px]">{fieldErrors['user-new-password']}</p>
          {:else}
            <p class="text-muted-foreground text-[13px]">At least 12 characters.</p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="user-new-confirm-password">Confirm password</Label>
          <PasswordInput
            id="user-new-confirm-password"
            name="confirm_password"
            autocomplete="new-password"
            bind:value={confirmPassword}
            disabled={submitting}
            required
            aria-invalid={fieldErrors['user-new-confirm-password'] ? 'true' : undefined}
          />
          {#if fieldErrors['user-new-confirm-password']}
            <p class="text-destructive text-[13px]">
              {fieldErrors['user-new-confirm-password']}
            </p>
          {/if}
        </div>

        <div class="flex flex-row items-start justify-between gap-4 rounded-md border border-border p-4">
          <div class="flex flex-col gap-1">
            <Label for="user-new-is-admin" class="text-sm font-medium">Administrator</Label>
            <p class="text-muted-foreground text-[13px]">
              Admins can manage users, teams, and clusters.
            </p>
          </div>
          <Switch id="user-new-is-admin" bind:checked={isAdmin} disabled={submitting} />
        </div>

        {#if assignableTeams.length > 0}
          <div class="flex flex-col gap-2">
            <Label>Teams</Label>
            <p class="text-muted-foreground text-[13px]">
              Add the user to one or more shared teams. They automatically get a personal team.
            </p>
            <ul class="flex flex-col gap-2 rounded-md border border-border p-3">
              {#each assignableTeams as team (team.id)}
                {@const checked = selectedTeamIds.includes(team.id)}
                <li class="flex items-center gap-2">
                  <Checkbox
                    id={`team-${team.id}`}
                    {checked}
                    onCheckedChange={(v) => toggleTeam(team.id, v === true)}
                    disabled={submitting}
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
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {#if submitting}
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              Creating...
            {:else}
              Create user
            {/if}
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
