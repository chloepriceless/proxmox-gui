<!--
  /admin/clusters/new — Register cluster (with TWO DISTINCT BUTTONS).

  Per UI-SPEC §Required cluster registration form + §Copywriting Contract:
    - Page title "Register cluster" / "Connect to a Proxmox VE cluster using
      an API token." (verbatim).
    - Fields IN ORDER (UI-SPEC §Form Patterns §Required cluster registration form):
      1. Name (slug-like)
      2. URL (https://pve.example.com:8006) → parsed to host + port on submit
      3. API token ID (user@realm!tokenid) → split to token_user + token_name
      4. API token secret (PasswordInput)
      5. TLS fingerprint (optional)
    - TWO DISTINCT BUTTONS (WARNING-4 fix; UI-SPEC):
        - "Test connection" (variant="secondary", LEFT of primary) calls
          api.clusters.test() → POST /api/v1/clusters/test (DRY-RUN, NO DB write).
        - "Register cluster" (variant="default", RIGHT, primary) calls
          api.clusters.create() → POST /api/v1/clusters/ (PERSISTS).
    - On Test success → inline ClusterStatusPill status="ok" with version.
    - On Test failure → inline ClusterStatusPill status="failed" + Alert with
      mapped UI-SPEC error copy.
    - Register does NOT require Test (UI-SPEC explicitly allows bypass).

  STRIDE:
    - T-01-10-04: Test calls /clusters/test (dry-run). Register calls /clusters/
      (persists). DISTINCT methods, DISTINCT endpoints, DISTINCT buttons —
      verified in checkpoint step 15 Network tab.
    - T-01-10-03: api_token_secret field is PasswordInput; backend never
      echoes it back; form state cleared on success navigation.
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import PasswordInput from '$lib/components/forms/PasswordInput.svelte';
  import FormSummaryAlert from '$lib/components/forms/FormSummaryAlert.svelte';
  import ClusterStatusPill from '$lib/components/clusters/ClusterStatusPill.svelte';
  import { api, ApiError } from '$lib/api/client';
  import type { ClusterCreateRequest, ClusterTestRequest } from '$lib/api/types';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';

  // ---- Form state ----
  let name = $state('');
  let url = $state('');
  let tokenId = $state('');
  let tokenSecret = $state('');
  let tlsFingerprint = $state('');
  let verifySsl = $state(true);

  // Mutually exclusive submit lifecycles for Test vs Register so each button
  // shows its own spinner without crossing wires (the whole point of the
  // two-distinct-button contract).
  let testing = $state(false);
  let registering = $state(false);

  // Test outcome surfaced inline next to / under the Test button.
  type TestState = { status: 'ok' | 'failed'; label?: string; detail?: string } | null;
  let testResult = $state<TestState>(null);

  // Form-level errors (shared by both flows).
  let formError = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});

  // Parse "https://pve.example.com:8006" → { host, port }. Defaults port 8006.
  function parseUrl(raw: string): { host: string; port: number } | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const u = new URL(trimmed);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      const port = u.port ? Number(u.port) : 8006;
      if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
      return { host: u.hostname, port };
    } catch {
      return null;
    }
  }

  // Parse "user@realm!tokenid" → { token_user, token_name }.
  // Backend (Plan 06) validates `name@(pam|pve)` for token_user.
  const TOKEN_ID_RE = /^([a-zA-Z0-9._-]+@(pam|pve))!([a-zA-Z0-9._-]+)$/;
  function parseTokenId(raw: string): { token_user: string; token_name: string } | null {
    const trimmed = raw.trim();
    const m = TOKEN_ID_RE.exec(trimmed);
    if (!m) return null;
    return { token_user: m[1], token_name: m[3] };
  }

  /**
   * Validate the form for submission. Both Test and Register share this
   * baseline — Test ALSO requires the same set because the API requires
   * host/token/secret to do anything meaningful.
   */
  function validate(): {
    name?: string;
    parsedUrl: { host: string; port: number } | null;
    parsedToken: { token_user: string; token_name: string } | null;
  } | null {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs['cluster-new-name'] = 'Name is required.';
    const parsedUrl = parseUrl(url);
    if (!url.trim()) {
      errs['cluster-new-url'] = 'URL is required.';
    } else if (!parsedUrl) {
      errs['cluster-new-url'] = 'Enter a URL like https://pve.example.com:8006.';
    }
    const parsedToken = parseTokenId(tokenId);
    if (!tokenId.trim()) {
      errs['cluster-new-token-id'] = 'API token ID is required.';
    } else if (!parsedToken) {
      errs['cluster-new-token-id'] =
        'Format: user@realm!tokenid (e.g. root@pam!gui).';
    }
    if (!tokenSecret) {
      errs['cluster-new-token-secret'] = 'API token secret is required.';
    }
    fieldErrors = errs;
    if (Object.keys(errs).length > 0) return null;
    return { name: name.trim(), parsedUrl, parsedToken };
  }

  // Map backend errors to UI-SPEC §Error state copy.
  function mapClusterError(
    err: unknown
  ): { field?: string; message?: string; summary?: string } {
    if (err instanceof ApiError) {
      const detail = String(
        (err.body as { detail?: unknown } | null)?.detail ?? ''
      ).toLowerCase();
      if (err.status === 422) {
        if (detail.includes('fingerprint')) {
          return {
            summary: "The server's certificate fingerprint doesn't match. Refusing to connect."
          };
        }
        if (detail.includes('reject') || detail.includes('token') || detail.includes('auth')) {
          return { summary: 'Proxmox rejected that token. Verify the realm and token ID.' };
        }
        return { summary: "Couldn't reach that URL. Check the host and port, then try again." };
      }
      if (err.status === 409) {
        return {
          field: 'cluster-new-name',
          message: 'A cluster with that name is already registered.'
        };
      }
      if (err.status === 502) {
        return {
          summary: "Couldn't reach that URL. Check the host and port, then try again."
        };
      }
    }
    return { summary: 'Something went wrong on our side. Please try again.' };
  }

  // ---- TEST BUTTON HANDLER — calls /clusters/test (DRY-RUN, NO DB write) ----
  async function handleTest(event: MouseEvent) {
    event.preventDefault();
    formError = null;
    testResult = null;
    const parsed = validate();
    if (!parsed || !parsed.parsedUrl || !parsed.parsedToken) return;
    testing = true;
    try {
      const body: ClusterTestRequest = {
        host: parsed.parsedUrl.host,
        port: parsed.parsedUrl.port,
        verify_ssl: verifySsl,
        token_user: parsed.parsedToken.token_user,
        token_name: parsed.parsedToken.token_name,
        api_token_secret: tokenSecret,
        tls_fingerprint: tlsFingerprint.trim() || null
      };
      const res = await api.clusters.test(body);
      if (res.ok) {
        testResult = {
          status: 'ok',
          label: res.version ? `Connection OK (${res.version})` : 'Connection OK'
        };
      } else {
        testResult = {
          status: 'failed',
          detail: res.error ?? "Couldn't connect to that cluster."
        };
      }
    } catch (err) {
      const mapped = mapClusterError(err);
      testResult = {
        status: 'failed',
        detail: mapped.summary ?? "Couldn't connect to that cluster."
      };
    } finally {
      testing = false;
    }
  }

  // ---- REGISTER BUTTON HANDLER — calls /clusters/ (PERSISTS) ----
  // This is a DIFFERENT handler calling a DIFFERENT api method. Test result
  // is NOT a prerequisite (UI-SPEC explicitly allows bypass) — we just submit.
  async function handleRegister(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    const parsed = validate();
    if (!parsed || !parsed.parsedUrl || !parsed.parsedToken || !parsed.name) return;
    registering = true;
    try {
      const body: ClusterCreateRequest = {
        name: parsed.name,
        host: parsed.parsedUrl.host,
        port: parsed.parsedUrl.port,
        verify_ssl: verifySsl,
        token_user: parsed.parsedToken.token_user,
        token_name: parsed.parsedToken.token_name,
        api_token_secret: tokenSecret,
        tls_fingerprint: tlsFingerprint.trim() || null
      };
      await api.clusters.create(body);
      toast.success('Cluster registered.');
      await goto('/admin/clusters');
    } catch (err) {
      const mapped = mapClusterError(err);
      if (mapped.field && mapped.message) {
        fieldErrors = { ...fieldErrors, [mapped.field]: mapped.message };
      } else if (mapped.summary) {
        formError = mapped.summary;
      }
    } finally {
      registering = false;
    }
  }
</script>

<svelte:head>
  <title>Register cluster — Proxmox GUI</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6">
  <header class="flex flex-col gap-2">
    <a
      href="/admin/clusters"
      class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px]"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Back to Clusters
    </a>
    <h1 class="text-[28px] font-semibold tracking-tight">Register cluster</h1>
    <p class="text-muted-foreground text-sm">Connect to a Proxmox VE cluster using an API token.</p>
  </header>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg font-semibold tracking-tight">Cluster details</Card.Title>
      <Card.Description>
        Test the connection to verify your token, then register the cluster.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <!-- The form's submit handler is REGISTER (default browser submit
           behaviour). The Test button has its own onclick handler and
           type="button" so it does NOT trigger form submission. -->
      <form class="flex flex-col gap-4" onsubmit={handleRegister} novalidate>
        <FormSummaryAlert errors={fieldErrors} id="cluster-new-summary" />

        {#if formError}
          <Alert.Root variant="destructive" aria-live="polite">
            <AlertTriangle aria-hidden="true" />
            <Alert.Title>{formError}</Alert.Title>
          </Alert.Root>
        {/if}

        <div class="flex flex-col gap-2">
          <Label for="cluster-new-name">Name</Label>
          <Input
            id="cluster-new-name"
            type="text"
            bind:value={name}
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            placeholder="prod-cluster-1"
            disabled={registering || testing}
            required
            aria-invalid={fieldErrors['cluster-new-name'] ? 'true' : undefined}
          />
          {#if fieldErrors['cluster-new-name']}
            <p class="text-destructive text-[13px]">{fieldErrors['cluster-new-name']}</p>
          {:else}
            <p class="text-muted-foreground text-[13px]">A short identifier you'll see in lists.</p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="cluster-new-url">URL</Label>
          <Input
            id="cluster-new-url"
            type="url"
            bind:value={url}
            autocomplete="off"
            spellcheck={false}
            placeholder="https://pve.example.com:8006"
            disabled={registering || testing}
            required
            aria-invalid={fieldErrors['cluster-new-url'] ? 'true' : undefined}
          />
          {#if fieldErrors['cluster-new-url']}
            <p class="text-destructive text-[13px]">{fieldErrors['cluster-new-url']}</p>
          {:else}
            <p class="text-muted-foreground text-[13px]">
              https://pve.example.com:8006 — the management URL of the Proxmox cluster.
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="cluster-new-token-id">API token ID</Label>
          <Input
            id="cluster-new-token-id"
            type="text"
            bind:value={tokenId}
            autocomplete="off"
            spellcheck={false}
            placeholder="root@pam!gui"
            disabled={registering || testing}
            required
            aria-invalid={fieldErrors['cluster-new-token-id'] ? 'true' : undefined}
            class="font-mono text-[13px]"
          />
          {#if fieldErrors['cluster-new-token-id']}
            <p class="text-destructive text-[13px]">{fieldErrors['cluster-new-token-id']}</p>
          {:else}
            <p class="text-muted-foreground text-[13px]">
              Format: user@realm!tokenid (e.g. root@pam!gui)
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="cluster-new-token-secret">API token secret</Label>
          <PasswordInput
            id="cluster-new-token-secret"
            name="api_token_secret"
            autocomplete="off"
            bind:value={tokenSecret}
            disabled={registering || testing}
            required
            aria-invalid={fieldErrors['cluster-new-token-secret'] ? 'true' : undefined}
          />
          {#if fieldErrors['cluster-new-token-secret']}
            <p class="text-destructive text-[13px]">{fieldErrors['cluster-new-token-secret']}</p>
          {:else}
            <p class="text-muted-foreground text-[13px]">
              Paste the secret value PVE showed you when you created the token.
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="cluster-new-fingerprint">TLS fingerprint (optional)</Label>
          <Input
            id="cluster-new-fingerprint"
            type="text"
            bind:value={tlsFingerprint}
            autocomplete="off"
            spellcheck={false}
            placeholder="AA:BB:CC:..."
            disabled={registering || testing}
            class="font-mono text-[13px]"
          />
          <p class="text-muted-foreground text-[13px]">
            Required only for self-signed certificates.
          </p>
        </div>

        <div class="flex flex-row items-start gap-2 rounded-md border border-border p-3">
          <Checkbox
            id="cluster-new-verify-ssl"
            checked={verifySsl}
            onCheckedChange={(v) => (verifySsl = v === true)}
            disabled={registering || testing}
          />
          <div class="flex flex-col gap-1">
            <Label for="cluster-new-verify-ssl" class="text-sm font-medium">Verify TLS</Label>
            <p class="text-muted-foreground text-[13px]">
              Validate the cluster's TLS certificate chain. Uncheck for self-signed.
            </p>
          </div>
        </div>

        <!-- Test result inline indicator (UI-SPEC §Form Patterns — inline pill
             next to the Test button after the call completes). -->
        {#if testResult}
          <div class="flex flex-col gap-2">
            <ClusterStatusPill status={testResult.status} label={testResult.label} />
            {#if testResult.status === 'failed' && testResult.detail}
              <Alert.Root variant="destructive" aria-live="polite">
                <AlertTriangle aria-hidden="true" />
                <Alert.Title>{testResult.detail}</Alert.Title>
              </Alert.Root>
            {/if}
          </div>
        {/if}

        <!-- THREE FOOTER BUTTONS: Cancel (ghost), Test connection (secondary,
             onclick → /clusters/test), Register cluster (default, form submit
             → /clusters/). UI-SPEC §Required cluster registration form.
             CRITICAL: Test and Register are NOT the same code path. -->
        <div class="flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onclick={() => goto('/admin/clusters')}
            disabled={registering || testing}
          >
            Cancel
          </Button>
          <!-- Test connection — calls api.clusters.test() (dry-run; NO DB write) -->
          <Button
            type="button"
            variant="secondary"
            onclick={handleTest}
            disabled={registering || testing}
          >
            {#if testing}
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              Testing...
            {:else}
              Test connection
            {/if}
          </Button>
          <!-- Register cluster — submits the form → api.clusters.create() (persists) -->
          <Button type="submit" disabled={registering || testing}>
            {#if registering}
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              Registering...
            {:else}
              Register cluster
            {/if}
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
