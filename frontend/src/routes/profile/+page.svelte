<!--
  /profile — Account self-service home.

  Per UI-SPEC §Profile pages:
    - Page title "Profile" / description "Manage your account." (verbatim).
    - Single column inside the app shell, 720px max content width.
    - Each subsection a <Card>: header (Heading 18/600 + body description) + content.
    - Section 1 — "Change password" (form): current + new + confirm passwords.
    - Section 2 — "Appearance" (theme toggle inline): Light / Dark / System.

  Form contract per UI-SPEC §Form Patterns:
    - PasswordInput from Plan 08 (Eye / EyeOff toggle).
    - FormSummaryAlert at top + inline per-field errors.
    - Mapped error copy: 403 (current_password incorrect) → inline on current_password;
      422 (validation) → inline per field; otherwise summary alert.

  Success path: Plan 05 backend revokes OTHER refresh-token rows; the current
  session is preserved. Toast surfaces "Password updated. Other sessions were
  signed out." (UI-SPEC §Error state copy verbatim string).
-->
<script lang="ts">
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import PasswordInput from '$lib/components/forms/PasswordInput.svelte';
  import FormSummaryAlert from '$lib/components/forms/FormSummaryAlert.svelte';
  import { api, ApiError } from '$lib/api/client';
  import { theme, type ThemeMode } from '$lib/stores/theme.svelte';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import Monitor from '@lucide/svelte/icons/monitor';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // ---- Change-password form state ----
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let submitting = $state(false);
  let formError = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});

  function resetForm() {
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
    fieldErrors = {};
    formError = null;
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!currentPassword) {
      errs['profile-current-password'] = 'Current password is required.';
    }
    if (!newPassword) {
      errs['profile-new-password'] = 'New password is required.';
    } else if (newPassword.length < 12) {
      errs['profile-new-password'] = 'Password must be at least 12 characters.';
    }
    if (newPassword !== confirmPassword) {
      errs['profile-confirm-password'] = "New passwords don't match.";
    }
    fieldErrors = errs;
    return Object.keys(errs).length === 0;
  }

  function mapError(err: unknown): { field?: string; summary?: string } {
    if (err instanceof ApiError) {
      // Backend (Plan 05) returns 403 when current_password verification fails.
      if (err.status === 403) {
        return { field: 'profile-current-password' };
      }
      // 422 validation — try to surface the message inline on new-password.
      if (err.status === 422) {
        return { summary: 'Password must be at least 12 characters.' };
      }
      if (err.status === 401) {
        // Session expired during the request — toast + redirect handled by
        // the layout next-tick; for now surface the generic message.
        return { summary: 'Your session expired. Please sign in again.' };
      }
    }
    return { summary: 'Something went wrong on our side. Please try again.' };
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    if (!validate()) return;
    submitting = true;
    try {
      await api.me.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      // Plan 05 backend revokes OTHER refresh rows; this session continues.
      toast.success('Password updated. Other sessions were signed out.');
      resetForm();
    } catch (err) {
      const mapped = mapError(err);
      if (mapped.field === 'profile-current-password') {
        fieldErrors = {
          ...fieldErrors,
          'profile-current-password': "That current password isn't right."
        };
      } else if (mapped.summary) {
        formError = mapped.summary;
      }
    } finally {
      submitting = false;
    }
  }

  // ---- Theme toggle (inline 3-button row per plan §Action) ----
  type ThemeOption = { value: ThemeMode; label: string; icon: typeof Sun };
  const themeOptions: ThemeOption[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor }
  ];

  function chooseTheme(mode: ThemeMode) {
    theme.setMode(mode);
  }
</script>

<svelte:head>
  <title>Profile — Proxmox GUI</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6">
  <header class="flex flex-col gap-2">
    <h1 class="text-[28px] font-semibold tracking-tight">Profile</h1>
    <p class="text-muted-foreground text-sm">Manage your account.</p>
  </header>

  <!-- Account summary (informational; supports the "user can see who they are" UX) -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg font-semibold tracking-tight">Account</Card.Title>
      <Card.Description>Signed in as the user shown below.</Card.Description>
    </Card.Header>
    <Card.Content>
      <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[120px_1fr]">
        <dt class="text-muted-foreground">Username</dt>
        <dd class="font-medium">{data.user.username}</dd>
        <dt class="text-muted-foreground">Email</dt>
        <dd class="font-medium">{data.user.email}</dd>
        <dt class="text-muted-foreground">Role</dt>
        <dd class="font-medium">{data.user.is_admin ? 'Administrator' : 'Member'}</dd>
      </dl>
    </Card.Content>
  </Card.Root>

  <!-- Change password card -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg font-semibold tracking-tight">Change password</Card.Title>
      <Card.Description>Update the password you use to sign in.</Card.Description>
    </Card.Header>
    <Card.Content>
      <form class="flex flex-col gap-4" onsubmit={handleSubmit} novalidate>
        <FormSummaryAlert errors={fieldErrors} id="profile-password-summary" />

        {#if formError}
          <Alert.Root variant="destructive" aria-live="polite">
            <AlertTriangle aria-hidden="true" />
            <Alert.Title>{formError}</Alert.Title>
          </Alert.Root>
        {/if}

        <div class="flex flex-col gap-2">
          <Label for="profile-current-password">Current password</Label>
          <PasswordInput
            id="profile-current-password"
            name="current_password"
            autocomplete="current-password"
            bind:value={currentPassword}
            disabled={submitting}
            required
            aria-invalid={fieldErrors['profile-current-password'] ? 'true' : undefined}
          />
          {#if fieldErrors['profile-current-password']}
            <p class="text-destructive text-[13px]">
              {fieldErrors['profile-current-password']}
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="profile-new-password">New password</Label>
          <PasswordInput
            id="profile-new-password"
            name="new_password"
            autocomplete="new-password"
            bind:value={newPassword}
            disabled={submitting}
            required
            aria-invalid={fieldErrors['profile-new-password'] ? 'true' : undefined}
            aria-describedby="profile-new-password-help"
          />
          {#if fieldErrors['profile-new-password']}
            <p id="profile-new-password-help" class="text-destructive text-[13px]">
              {fieldErrors['profile-new-password']}
            </p>
          {:else}
            <p id="profile-new-password-help" class="text-muted-foreground text-[13px]">
              At least 12 characters.
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="profile-confirm-password">Confirm new password</Label>
          <PasswordInput
            id="profile-confirm-password"
            name="confirm_password"
            autocomplete="new-password"
            bind:value={confirmPassword}
            disabled={submitting}
            required
            aria-invalid={fieldErrors['profile-confirm-password'] ? 'true' : undefined}
          />
          {#if fieldErrors['profile-confirm-password']}
            <p class="text-destructive text-[13px]">
              {fieldErrors['profile-confirm-password']}
            </p>
          {/if}
        </div>

        <div class="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {#if submitting}
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              Updating password...
            {:else}
              Update password
            {/if}
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>

  <!-- Appearance (inline theme toggle) -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg font-semibold tracking-tight">Appearance</Card.Title>
      <Card.Description>Theme follows your system unless you set a preference.</Card.Description>
    </Card.Header>
    <Card.Content>
      <div
        role="radiogroup"
        aria-label="Theme preference"
        class="border-border bg-muted/50 inline-flex items-center rounded-md border p-1"
      >
        {#each themeOptions as option (option.value)}
          {@const active = theme.mode === option.value}
          <button
            type="button"
            role="radio"
            aria-checked={active}
            onclick={() => chooseTheme(option.value)}
            class="inline-flex h-8 items-center gap-1.5 rounded px-3 text-[13px] font-medium transition-colors {active
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'}"
          >
            <option.icon class="size-4" aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        {/each}
      </div>
    </Card.Content>
  </Card.Root>
</div>
