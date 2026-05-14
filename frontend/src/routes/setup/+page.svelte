<!--
  /setup — first-run wizard (D-19; UI-SPEC §First-run wizard).

  4-step stepper:
    Step 1: Welcome           — informational
    Step 2: Create admin      — mandatory (D-18)
    Step 3: Register cluster  — optional / skippable (D-18)
    Step 4: Done              — sign-in CTA

  Layout chrome:
    - Horizontal stepper (4 pips, 28x28 circles) above the active card.
    - Card: bg-card, 1px border, rounded-lg, p-12 (UI-SPEC 2xl=48px),
      max-w-[35rem], shadow-sm. Centered by the parent layout.

  Step 2 calls api.setup.createAdmin then api.auth.login (auto-login) so step 3
  can hit the authenticated /api/v1/clusters endpoints.

  Step 3:
    - "Test connection" (variant=secondary) calls api.clusters.test
    - "Register cluster" (primary) calls api.clusters.create then advances
    - "Skip for now" link advances without registering

  All copy is verbatim from UI-SPEC §Copywriting Contract.
-->
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import PasswordInput from '$lib/components/forms/PasswordInput.svelte';
  import FormSummaryAlert from '$lib/components/forms/FormSummaryAlert.svelte';
  import { api, ApiError } from '$lib/api/client';
  import type { ClusterTestResponse } from '$lib/api/types';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import CheckCircle2 from '@lucide/svelte/icons/circle-check-big';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import Check from '@lucide/svelte/icons/check';
  import Loader2 from '@lucide/svelte/icons/loader-2';

  // ---- stepper state -------------------------------------------------------
  type Step = 1 | 2 | 3 | 4;
  let step = $state<Step>(1);

  // ---- step 2 (admin) state ----------------------------------------------
  let adminUsername = $state('');
  let adminEmail = $state('');
  let adminPassword = $state('');
  let adminPasswordConfirm = $state('');
  let adminSubmitting = $state(false);
  let adminFormError = $state<string | null>(null);
  let adminFieldErrors = $state<Record<string, string>>({});

  // ---- step 3 (cluster) state --------------------------------------------
  let clusterName = $state('');
  let clusterHost = $state('');
  let clusterPort = $state(8006);
  let clusterTokenUser = $state('');
  let clusterTokenName = $state('');
  let clusterTokenSecret = $state('');
  let clusterFingerprint = $state('');
  let clusterTesting = $state(false);
  let clusterRegistering = $state(false);
  let clusterFormError = $state<string | null>(null);
  let clusterFieldErrors = $state<Record<string, string>>({});
  let clusterTestResult = $state<ClusterTestResponse | null>(null);

  // ---- validation --------------------------------------------------------
  const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,64}$/;

  function validateAdmin(): boolean {
    const errs: Record<string, string> = {};
    if (!adminUsername.trim()) errs['setup-username'] = 'Username is required.';
    else if (!USERNAME_RE.test(adminUsername.trim()))
      errs['setup-username'] =
        'Username must be 3-64 characters of letters, digits, dot, dash, or underscore.';
    if (!adminEmail.trim()) errs['setup-email'] = 'Email is required.';
    else if (!/.+@.+\..+/.test(adminEmail.trim())) errs['setup-email'] = 'Email is invalid.';
    if (adminPassword.length < 12)
      errs['setup-password'] = 'Password must be at least 12 characters.';
    if (adminPassword !== adminPasswordConfirm)
      errs['setup-password-confirm'] = "New passwords don't match.";
    adminFieldErrors = errs;
    return Object.keys(errs).length === 0;
  }

  function validateCluster(): boolean {
    const errs: Record<string, string> = {};
    if (!clusterName.trim()) errs['cluster-name'] = 'Name is required.';
    if (!clusterHost.trim()) errs['cluster-host'] = 'Host is required.';
    else if (/^https?:\/\//i.test(clusterHost.trim()))
      errs['cluster-host'] = 'Use bare hostname or IP, not a URL (no http:// prefix).';
    if (!clusterTokenUser.trim()) errs['cluster-token-user'] = 'Token user is required.';
    else if (!/^[A-Za-z0-9._@-]+@(pam|pve)$/.test(clusterTokenUser.trim()))
      errs['cluster-token-user'] = 'Token user must be of the form name@pam or name@pve.';
    if (!clusterTokenName.trim()) errs['cluster-token-name'] = 'Token name is required.';
    if (!clusterTokenSecret) errs['cluster-token-secret'] = 'Token secret is required.';
    clusterFieldErrors = errs;
    return Object.keys(errs).length === 0;
  }

  // ---- error mapping (UI-SPEC §Error state copy) -------------------------
  function mapAdminError(err: unknown): string {
    if (err instanceof ApiError) {
      const detail =
        err.body && typeof err.body === 'object' && 'detail' in err.body
          ? String((err.body as { detail: unknown }).detail).toLowerCase()
          : '';
      if (err.status === 409 && detail.includes('username'))
        return 'A user with that username already exists.';
      if (err.status === 409 && detail.includes('email'))
        return 'A user with that email already exists.';
      if (err.status === 409) return 'Initial setup already completed.';
      if (err.status === 422) return 'Please check the form fields and try again.';
    }
    return 'Something went wrong on our side. Please try again.';
  }

  function mapClusterError(err: unknown): string {
    if (err instanceof ApiError) {
      const detail =
        err.body && typeof err.body === 'object' && 'detail' in err.body
          ? String((err.body as { detail: unknown }).detail).toLowerCase()
          : '';
      if (err.status === 409 && detail.includes('name'))
        return 'A cluster with that name is already registered.';
      if (detail.includes('unreach') || detail.includes('connect'))
        return "Couldn't reach that URL. Check the host and port, then try again.";
      if (detail.includes('fingerprint'))
        return "The server's certificate fingerprint doesn't match. Refusing to connect.";
      if (detail.includes('token') || err.status === 401 || err.status === 403)
        return 'Proxmox rejected that token. Verify the realm and token ID.';
    }
    return 'Something went wrong on our side. Please try again.';
  }

  function mapTestResult(res: ClusterTestResponse): ClusterTestResponse {
    if (res.ok) return res;
    const detail = (res.error ?? '').toLowerCase();
    if (detail.includes('unreach') || detail.includes('connect'))
      return { ...res, error: "Couldn't reach that URL. Check the host and port, then try again." };
    if (detail.includes('fingerprint'))
      return { ...res, error: "The server's certificate fingerprint doesn't match. Refusing to connect." };
    if (detail.includes('token'))
      return { ...res, error: 'Proxmox rejected that token. Verify the realm and token ID.' };
    return res;
  }

  // ---- step handlers -----------------------------------------------------
  async function submitAdmin(event: SubmitEvent) {
    event.preventDefault();
    adminFormError = null;
    if (!validateAdmin()) return;
    adminSubmitting = true;
    try {
      await api.setup.createAdmin({
        username: adminUsername.trim(),
        email: adminEmail.trim(),
        password: adminPassword
      });
      // Auto-login so step 3 (authenticated /api/v1/clusters) works.
      await api.auth.login({ username: adminUsername.trim(), password: adminPassword });
      // Refresh layout data so locals.user reflects the new session before
      // step 3 (which calls authenticated endpoints) runs.
      await invalidateAll();
      step = 3;
    } catch (err) {
      adminFormError = mapAdminError(err);
    } finally {
      adminSubmitting = false;
    }
  }

  async function testCluster() {
    clusterFormError = null;
    clusterTestResult = null;
    if (!validateCluster()) return;
    clusterTesting = true;
    try {
      const res = await api.clusters.test({
        host: clusterHost.trim(),
        port: clusterPort,
        verify_ssl: true,
        token_user: clusterTokenUser.trim(),
        token_name: clusterTokenName.trim(),
        api_token_secret: clusterTokenSecret,
        tls_fingerprint: clusterFingerprint.trim() || null
      });
      clusterTestResult = mapTestResult(res);
    } catch (err) {
      clusterFormError = mapClusterError(err);
    } finally {
      clusterTesting = false;
    }
  }

  async function registerCluster(event: SubmitEvent) {
    event.preventDefault();
    clusterFormError = null;
    if (!validateCluster()) return;
    clusterRegistering = true;
    try {
      await api.clusters.create({
        name: clusterName.trim(),
        host: clusterHost.trim(),
        port: clusterPort,
        verify_ssl: true,
        token_user: clusterTokenUser.trim(),
        token_name: clusterTokenName.trim(),
        api_token_secret: clusterTokenSecret,
        tls_fingerprint: clusterFingerprint.trim() || null
      });
      step = 4;
    } catch (err) {
      clusterFormError = mapClusterError(err);
    } finally {
      clusterRegistering = false;
    }
  }

  function skipCluster() {
    step = 4;
  }

  function backToStep2() {
    // From step 3 the admin is already created — Back is harmless navigation.
    step = 2;
  }

  async function finish() {
    // Step 4 → /login. The wizard intentionally signs the auto-login session
    // OUT first so the operator's first deliberate sign-in happens at /login,
    // matching UI-SPEC §First-run wizard step 4 ("Sign in to start").
    await api.auth.logout();
    await invalidateAll();
    await goto('/login');
  }

  // ---- stepper pip helpers ----------------------------------------------
  const STEP_LABELS: Record<Step, string> = {
    1: 'Welcome',
    2: 'Create admin',
    3: 'Register cluster',
    4: 'Done'
  };
  const STEPS: Step[] = [1, 2, 3, 4];
</script>

<svelte:head>
  <title>Set up — Proxmox GUI</title>
</svelte:head>

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

<!-- Stepper: 4 pips with connecting lines. -->
<ol class="flex w-full items-center justify-between gap-2" aria-label="Setup progress">
  {#each STEPS as s, i (s)}
    {@const isComplete = step > s}
    {@const isActive = step === s}
    <li class="flex flex-1 items-center gap-2">
      <span
        class="flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-medium {isActive
          ? 'bg-primary text-primary-foreground border-primary'
          : isComplete
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background text-muted-foreground border-border'}"
        aria-current={isActive ? 'step' : undefined}
        aria-label="Step {s}: {STEP_LABELS[s]}"
      >
        {#if isComplete}
          <Check class="size-4" aria-hidden="true" />
        {:else}
          {s}
        {/if}
      </span>
      {#if i < STEPS.length - 1}
        <span
          aria-hidden="true"
          class="h-[2px] flex-1 {step > s ? 'bg-primary' : 'bg-border'}"
        ></span>
      {/if}
    </li>
  {/each}
</ol>

<Card.Root class="w-full p-12 shadow-sm">
  <!-- ============================================================== -->
  <!-- Step 1: Welcome -->
  <!-- ============================================================== -->
  {#if step === 1}
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <h1 class="text-[28px] font-semibold tracking-tight">Welcome to Proxmox GUI</h1>
        <p class="text-muted-foreground text-sm">
          Let's set up your installation. This takes about a minute.
        </p>
      </header>
      <footer class="flex justify-end">
        <Button onclick={() => (step = 2)}>Get started</Button>
      </footer>
    </div>

  <!-- ============================================================== -->
  <!-- Step 2: Create admin (mandatory per D-18) -->
  <!-- ============================================================== -->
  {:else if step === 2}
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <h1 class="text-[28px] font-semibold tracking-tight">Create the first admin</h1>
        <p class="text-muted-foreground text-sm">
          This user has full access and can create more users later.
        </p>
      </header>

      <form class="flex flex-col gap-4" onsubmit={submitAdmin} novalidate>
        <FormSummaryAlert errors={adminFieldErrors} id="setup-admin-summary" />

        {#if adminFormError}
          <Alert.Root variant="destructive" aria-live="polite">
            <AlertTriangle aria-hidden="true" />
            <Alert.Title>{adminFormError}</Alert.Title>
          </Alert.Root>
        {/if}

        <div class="flex flex-col gap-2">
          <Label for="setup-username">Username</Label>
          <Input
            id="setup-username"
            name="username"
            autocomplete="username"
            autocapitalize="off"
            bind:value={adminUsername}
            disabled={adminSubmitting}
            required
            aria-invalid={adminFieldErrors['setup-username'] ? 'true' : undefined}
          />
          {#if adminFieldErrors['setup-username']}
            <p class="text-destructive text-[13px]">{adminFieldErrors['setup-username']}</p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="setup-email">Email</Label>
          <Input
            id="setup-email"
            type="email"
            name="email"
            autocomplete="email"
            bind:value={adminEmail}
            disabled={adminSubmitting}
            required
            aria-invalid={adminFieldErrors['setup-email'] ? 'true' : undefined}
          />
          {#if adminFieldErrors['setup-email']}
            <p class="text-destructive text-[13px]">{adminFieldErrors['setup-email']}</p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="setup-password">Password</Label>
          <PasswordInput
            id="setup-password"
            name="password"
            autocomplete="new-password"
            bind:value={adminPassword}
            disabled={adminSubmitting}
            required
            aria-invalid={adminFieldErrors['setup-password'] ? 'true' : undefined}
          />
          <p class="text-muted-foreground text-[13px]">At least 12 characters.</p>
          {#if adminFieldErrors['setup-password']}
            <p class="text-destructive text-[13px]">{adminFieldErrors['setup-password']}</p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="setup-password-confirm">Confirm password</Label>
          <PasswordInput
            id="setup-password-confirm"
            name="password_confirm"
            autocomplete="new-password"
            bind:value={adminPasswordConfirm}
            disabled={adminSubmitting}
            required
            aria-invalid={adminFieldErrors['setup-password-confirm'] ? 'true' : undefined}
          />
          {#if adminFieldErrors['setup-password-confirm']}
            <p class="text-destructive text-[13px]">
              {adminFieldErrors['setup-password-confirm']}
            </p>
          {/if}
        </div>

        <footer class="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={adminSubmitting}>
            {#if adminSubmitting}
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              Creating admin...
            {:else}
              Create admin
            {/if}
          </Button>
        </footer>
      </form>
    </div>

  <!-- ============================================================== -->
  <!-- Step 3: Register cluster (skippable per D-18) -->
  <!-- ============================================================== -->
  {:else if step === 3}
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <h1 class="text-[28px] font-semibold tracking-tight">Register your first Proxmox cluster</h1>
        <p class="text-muted-foreground text-sm">
          Optional. You can add clusters later from the admin area.
        </p>
      </header>

      <form class="flex flex-col gap-4" onsubmit={registerCluster} novalidate>
        <FormSummaryAlert errors={clusterFieldErrors} id="setup-cluster-summary" />

        {#if clusterFormError}
          <Alert.Root variant="destructive" aria-live="polite">
            <AlertTriangle aria-hidden="true" />
            <Alert.Title>{clusterFormError}</Alert.Title>
          </Alert.Root>
        {/if}

        <div class="flex flex-col gap-2">
          <Label for="cluster-name">Name</Label>
          <Input
            id="cluster-name"
            name="name"
            placeholder="production"
            bind:value={clusterName}
            disabled={clusterRegistering || clusterTesting}
            required
            aria-invalid={clusterFieldErrors['cluster-name'] ? 'true' : undefined}
          />
          {#if clusterFieldErrors['cluster-name']}
            <p class="text-destructive text-[13px]">{clusterFieldErrors['cluster-name']}</p>
          {/if}
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2 flex flex-col gap-2">
            <Label for="cluster-host">Host</Label>
            <Input
              id="cluster-host"
              name="host"
              placeholder="pve.example.com"
              bind:value={clusterHost}
              disabled={clusterRegistering || clusterTesting}
              required
              aria-invalid={clusterFieldErrors['cluster-host'] ? 'true' : undefined}
            />
            {#if clusterFieldErrors['cluster-host']}
              <p class="text-destructive text-[13px]">{clusterFieldErrors['cluster-host']}</p>
            {/if}
          </div>
          <div class="flex flex-col gap-2">
            <Label for="cluster-port">Port</Label>
            <Input
              id="cluster-port"
              name="port"
              type="number"
              min="1"
              max="65535"
              bind:value={clusterPort}
              disabled={clusterRegistering || clusterTesting}
              required
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="cluster-token-user">API token user</Label>
          <Input
            id="cluster-token-user"
            name="token_user"
            placeholder="root@pam"
            autocomplete="off"
            bind:value={clusterTokenUser}
            disabled={clusterRegistering || clusterTesting}
            required
            aria-invalid={clusterFieldErrors['cluster-token-user'] ? 'true' : undefined}
          />
          <p class="text-muted-foreground text-[13px]">Format: name@pam or name@pve.</p>
          {#if clusterFieldErrors['cluster-token-user']}
            <p class="text-destructive text-[13px]">{clusterFieldErrors['cluster-token-user']}</p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="cluster-token-name">API token name</Label>
          <Input
            id="cluster-token-name"
            name="token_name"
            placeholder="proxmox-gui"
            autocomplete="off"
            bind:value={clusterTokenName}
            disabled={clusterRegistering || clusterTesting}
            required
            aria-invalid={clusterFieldErrors['cluster-token-name'] ? 'true' : undefined}
          />
          {#if clusterFieldErrors['cluster-token-name']}
            <p class="text-destructive text-[13px]">{clusterFieldErrors['cluster-token-name']}</p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="cluster-token-secret">API token secret</Label>
          <PasswordInput
            id="cluster-token-secret"
            name="token_secret"
            autocomplete="new-password"
            bind:value={clusterTokenSecret}
            disabled={clusterRegistering || clusterTesting}
            required
            aria-invalid={clusterFieldErrors['cluster-token-secret'] ? 'true' : undefined}
          />
          {#if clusterFieldErrors['cluster-token-secret']}
            <p class="text-destructive text-[13px]">{clusterFieldErrors['cluster-token-secret']}</p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="cluster-fingerprint">TLS fingerprint (optional)</Label>
          <Input
            id="cluster-fingerprint"
            name="fingerprint"
            placeholder="AB:CD:EF:..."
            bind:value={clusterFingerprint}
            disabled={clusterRegistering || clusterTesting}
          />
          <p class="text-muted-foreground text-[13px]">
            Required only for self-signed certificates.
          </p>
        </div>

        {#if clusterTestResult}
          {#if clusterTestResult.ok}
            <div
              class="bg-success/10 border-success/30 text-success flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              role="status"
            >
              <CheckCircle2 class="size-4" aria-hidden="true" />
              <span>Connection OK{clusterTestResult.version ? ` — Proxmox VE ${clusterTestResult.version}` : ''}</span>
            </div>
          {:else}
            <div
              class="bg-destructive/10 border-destructive/30 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              role="status"
            >
              <ShieldAlert class="size-4" aria-hidden="true" />
              <span>{clusterTestResult.error ?? 'Connection failed.'}</span>
            </div>
          {/if}
        {/if}

        <footer class="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="ghost" type="button" onclick={backToStep2} disabled={clusterRegistering || clusterTesting}>
            Back
          </Button>
          <div class="flex items-center gap-2">
            <Button
              variant="link"
              type="button"
              onclick={skipCluster}
              disabled={clusterRegistering || clusterTesting}
            >
              Skip for now
            </Button>
            <Button
              variant="secondary"
              type="button"
              onclick={testCluster}
              disabled={clusterTesting || clusterRegistering}
            >
              {#if clusterTesting}
                <Loader2 class="size-4 animate-spin" aria-hidden="true" />
                Testing...
              {:else}
                Test connection
              {/if}
            </Button>
            <Button type="submit" disabled={clusterRegistering || clusterTesting}>
              {#if clusterRegistering}
                <Loader2 class="size-4 animate-spin" aria-hidden="true" />
                Registering...
              {:else}
                Register cluster
              {/if}
            </Button>
          </div>
        </footer>
      </form>
    </div>

  <!-- ============================================================== -->
  <!-- Step 4: Done -->
  <!-- ============================================================== -->
  {:else if step === 4}
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <h1 class="text-[28px] font-semibold tracking-tight">You're all set</h1>
        <p class="text-muted-foreground text-sm">Sign in to start managing your clusters.</p>
      </header>
      <footer class="flex justify-end">
        <Button onclick={finish}>Sign in</Button>
      </footer>
    </div>
  {/if}
</Card.Root>
