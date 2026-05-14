<!--
  /login — Sign in form per UI-SPEC §Login.

  Layout:
    - Centred card on bg-muted page background, max-w-sm (400px).
    - Logo + product name above the card (Hetzner-style).
    - Card heading "Sign in", body "Enter your credentials to continue.".
    - Username + PasswordInput (with Eye/EyeOff toggle).
    - Optional "Remember me" checkbox.
    - Primary button "Sign in" full-width with Loader2 + "Signing in..."
      while submitting.
    - Below card: muted text "Need help? Contact your administrator.".

  Error handling (mapped from UI-SPEC §Error state copy):
    - 401 → "Wrong username or password."
    - 403 → "This account is disabled. Contact your administrator."
    - 429 → "Too many sign-in attempts. Try again in a minute."
    - other → generic "Something went wrong on our side. Please try again."

  Session-expired state:
    - When `?expired=1` is in the URL, an Alert banner appears above the card.

  Post-login navigation:
    - If `?next=...` is set (preserved by +layout.server.ts on the redirect),
      navigate there; otherwise navigate to /.
    - Both are validated to be relative paths to defend against open-redirect.
-->
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import PasswordInput from '$lib/components/forms/PasswordInput.svelte';
  import FormSummaryAlert from '$lib/components/forms/FormSummaryAlert.svelte';
  import { api, ApiError } from '$lib/api/client';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';

  let username = $state('');
  let password = $state('');
  let rememberMe = $state(false);
  let submitting = $state(false);
  let formError = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});

  const sessionExpired = $derived($page.url.searchParams.has('expired'));
  const nextParam = $derived($page.url.searchParams.get('next'));

  function safeNext(raw: string | null): string {
    // Defend against open-redirect: only allow same-origin relative paths
    // beginning with `/` and NOT `//` (which would be protocol-relative).
    if (!raw) return '/';
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
    if (raw.startsWith('/login') || raw.startsWith('/setup')) return '/';
    return raw;
  }

  function mapError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) return 'Wrong username or password.';
      if (err.status === 403) return 'This account is disabled. Contact your administrator.';
      if (err.status === 429) return 'Too many sign-in attempts. Try again in a minute.';
    }
    return 'Something went wrong on our side. Please try again.';
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs['login-username'] = 'Username is required.';
    if (!password) errs['login-password'] = 'Password is required.';
    fieldErrors = errs;
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    if (!validate()) return;
    submitting = true;
    try {
      await api.auth.login({
        username: username.trim(),
        password,
        remember_me: rememberMe
      });
      await invalidateAll();
      await goto(safeNext(nextParam), { invalidateAll: true });
    } catch (err) {
      formError = mapError(err);
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in — Proxmox GUI</title>
</svelte:head>

<div class="bg-muted flex min-h-screen items-center justify-center px-4 py-12">
  <div class="flex w-full max-w-sm flex-col items-center gap-6">
    <div class="flex items-center gap-2">
      <svg
        viewBox="0 0 24 24"
        class="text-primary size-8"
        role="img"
        aria-label="Proxmox GUI logo"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
      <span class="text-lg font-semibold tracking-tight">Proxmox GUI</span>
    </div>

    {#if sessionExpired}
      <Alert.Root class="bg-warning/10 border-warning/30 text-warning w-full">
        <AlertTriangle aria-hidden="true" />
        <Alert.Title class="text-warning">Session expired</Alert.Title>
        <Alert.Description class="text-foreground"
          >Your session expired. Please sign in again.</Alert.Description
        >
      </Alert.Root>
    {/if}

    <Card.Root class="w-full">
      <Card.Header>
        <Card.Title class="text-lg font-semibold tracking-tight">Sign in</Card.Title>
        <Card.Description>Enter your credentials to continue.</Card.Description>
      </Card.Header>
      <Card.Content>
        <form class="flex flex-col gap-4" onsubmit={handleSubmit} novalidate>
          <FormSummaryAlert errors={fieldErrors} id="login-summary" />

          {#if formError}
            <Alert.Root variant="destructive" aria-live="polite">
              <AlertTriangle aria-hidden="true" />
              <Alert.Title>{formError}</Alert.Title>
            </Alert.Root>
          {/if}

          <div class="flex flex-col gap-2">
            <Label for="login-username">Username</Label>
            <Input
              id="login-username"
              type="text"
              name="username"
              autocomplete="username"
              autocapitalize="off"
              autocorrect="off"
              spellcheck={false}
              bind:value={username}
              disabled={submitting}
              required
              aria-invalid={fieldErrors['login-username'] ? 'true' : undefined}
            />
            {#if fieldErrors['login-username']}
              <p class="text-destructive text-[13px]">{fieldErrors['login-username']}</p>
            {/if}
          </div>

          <div class="flex flex-col gap-2">
            <Label for="login-password">Password</Label>
            <PasswordInput
              id="login-password"
              name="password"
              autocomplete="current-password"
              bind:value={password}
              disabled={submitting}
              required
              aria-invalid={fieldErrors['login-password'] ? 'true' : undefined}
            />
            {#if fieldErrors['login-password']}
              <p class="text-destructive text-[13px]">{fieldErrors['login-password']}</p>
            {/if}
          </div>

          <label class="flex items-center gap-2 text-sm">
            <Checkbox bind:checked={rememberMe} disabled={submitting} />
            <span>Remember me</span>
          </label>

          <Button type="submit" class="w-full" disabled={submitting}>
            {#if submitting}
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              Signing in...
            {:else}
              Sign in
            {/if}
          </Button>
        </form>
      </Card.Content>
    </Card.Root>

    <p class="text-muted-foreground text-[13px]">Need help? Contact your administrator.</p>
  </div>
</div>
