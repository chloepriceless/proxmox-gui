<!--
  /admin/clusters/[id] — Edit cluster + Test stored token + Delete.

  Per UI-SPEC §Required cluster registration form §"Update token" pattern:
    - The API token secret field is INITIALLY a placeholder ("●●●●●●●●") with
      an "Update token" link button that reveals a real PasswordInput. If left
      hidden / blank on submit, the stored token is preserved.
    - "Test connection" on THIS page calls api.clusters.testExisting({id}) —
      re-validates the STORED token, not the (possibly hidden) form value.
    - Delete uses ConfirmByNameDialog with UI-SPEC verbatim copy.

  STRIDE: T-01-10-03 (token never re-exposed in UI), T-01-10-04 (Test on edit
  uses testExisting which doesn't take a token in the body — no accidental
  cross-wiring), T-01-10-08 (cluster delete cascade — backend 409 surfaced).
-->
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Switch } from '$lib/components/ui/switch';
  import PasswordInput from '$lib/components/forms/PasswordInput.svelte';
  import FormSummaryAlert from '$lib/components/forms/FormSummaryAlert.svelte';
  import ConfirmByNameDialog from '$lib/components/forms/ConfirmByNameDialog.svelte';
  import ClusterStatusPill from '$lib/components/clusters/ClusterStatusPill.svelte';
  import { api, ApiError } from '$lib/api/client';
  import type { ClusterUpdateRequest } from '$lib/api/types';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // ---- Form state (seeded from SSR data once; untrack to silence the
  //      "captures only initial value" warning — by design the form keeps
  //      the typed values stable across invalidateAll() after a save). ----
  let name = $state(untrack(() => data.cluster.name));
  let host = $state(untrack(() => data.cluster.host));
  let port = $state(untrack(() => data.cluster.port));
  let tokenUser = $state(untrack(() => data.cluster.token_user));
  let tokenName = $state(untrack(() => data.cluster.token_name));
  let tlsFingerprint = $state(untrack(() => data.cluster.tls_fingerprint ?? ''));
  let verifySsl = $state(untrack(() => data.cluster.verify_ssl));
  let notes = $state(untrack(() => data.cluster.notes ?? ''));
  let isActive = $state(untrack(() => data.cluster.is_active));

  // Token update pattern (UI-SPEC §Required cluster registration form):
  // Field starts hidden (placeholder dots). User clicks "Update token" to
  // reveal a PasswordInput. If `updatingToken=false` on submit, the existing
  // token is preserved (we omit api_token_secret from the payload).
  let updatingToken = $state(false);
  let newTokenSecret = $state('');

  let saving = $state(false);
  let testing = $state(false);
  let formError = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});

  type TestState = { status: 'ok' | 'failed'; label?: string; detail?: string } | null;
  let testResult = $state<TestState>(null);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs['cluster-edit-name'] = 'Name is required.';
    if (!host.trim()) errs['cluster-edit-host'] = 'Host is required.';
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      errs['cluster-edit-port'] = 'Port must be 1-65535.';
    }
    if (!tokenUser.trim()) errs['cluster-edit-token-user'] = 'Token user is required.';
    if (!tokenName.trim()) errs['cluster-edit-token-name'] = 'Token name is required.';
    if (updatingToken && !newTokenSecret) {
      errs['cluster-edit-token-secret'] = 'New token secret is required.';
    }
    fieldErrors = errs;
    return Object.keys(errs).length === 0;
  }

  function mapEditError(err: unknown): { field?: string; message?: string; summary?: string } {
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
        return { summary: "Couldn't save changes. Check the form for details." };
      }
      if (err.status === 409) {
        return {
          field: 'cluster-edit-name',
          message: 'A cluster with that name is already registered.'
        };
      }
      if (err.status === 502) {
        return { summary: "Couldn't reach that URL. Check the host and port, then try again." };
      }
    }
    return { summary: 'Something went wrong on our side. Please try again.' };
  }

  // ---- Save handler (PATCH) ----
  async function handleSave(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    if (!validate()) return;
    saving = true;
    try {
      const payload: ClusterUpdateRequest = {
        name: name.trim(),
        host: host.trim(),
        port,
        verify_ssl: verifySsl,
        token_user: tokenUser.trim(),
        token_name: tokenName.trim(),
        tls_fingerprint: tlsFingerprint.trim() || null,
        notes: notes.trim() || null,
        is_active: isActive
      };
      // CRITICAL: only include api_token_secret when the user explicitly
      // requested an update. Omitting it tells the backend (Plan 06) to
      // preserve the stored value.
      if (updatingToken && newTokenSecret) {
        payload.api_token_secret = newTokenSecret;
      }
      await api.clusters.update({ id: data.cluster.id, ...payload });
      toast.success('Cluster updated.');
      // Reset the update-token flow after a successful save.
      updatingToken = false;
      newTokenSecret = '';
      await invalidateAll();
    } catch (err) {
      const mapped = mapEditError(err);
      if (mapped.field && mapped.message) {
        fieldErrors = { ...fieldErrors, [mapped.field]: mapped.message };
      } else if (mapped.summary) {
        formError = mapped.summary;
      }
    } finally {
      saving = false;
    }
  }

  // ---- Test connection (re-validates STORED token, not form values) ----
  async function handleTest() {
    testing = true;
    testResult = null;
    try {
      const res = await api.clusters.testExisting({ id: data.cluster.id });
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
    } catch {
      testResult = { status: 'failed', detail: "Couldn't reach that cluster." };
    } finally {
      testing = false;
    }
  }

  // ---- Delete (typed-name confirm) ----
  let deleteOpen = $state(false);

  async function handleDelete() {
    try {
      await api.clusters.del({ id: data.cluster.id });
      toast.success(`${data.cluster.name} was deleted.`);
      await goto('/admin/clusters');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = String((err.body as { detail?: unknown } | null)?.detail ?? '');
        toast.error(detail || "Couldn't delete: cluster has active team bindings.");
      } else {
        toast.error("Couldn't delete that cluster.");
      }
    }
  }
</script>

<svelte:head>
  <title>{data.cluster.name} — Clusters — Proxmox GUI</title>
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
    <h1 class="text-[28px] font-semibold tracking-tight">{data.cluster.name}</h1>
    <p class="text-muted-foreground text-sm">
      Edit this cluster's connection details and credentials.
    </p>
  </header>

  <!-- Edit card -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg font-semibold tracking-tight">Cluster details</Card.Title>
      <Card.Description>
        Change the cluster's name, host, token, or fingerprint. Leave the token field hidden to keep
        the stored value.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <form class="flex flex-col gap-4" onsubmit={handleSave} novalidate>
        <FormSummaryAlert errors={fieldErrors} id="cluster-edit-summary" />

        {#if formError}
          <Alert.Root variant="destructive" aria-live="polite">
            <AlertTriangle aria-hidden="true" />
            <Alert.Title>{formError}</Alert.Title>
          </Alert.Root>
        {/if}

        <div class="flex flex-col gap-2">
          <Label for="cluster-edit-name">Name</Label>
          <Input
            id="cluster-edit-name"
            type="text"
            bind:value={name}
            autocomplete="off"
            spellcheck={false}
            disabled={saving}
            required
            aria-invalid={fieldErrors['cluster-edit-name'] ? 'true' : undefined}
          />
          {#if fieldErrors['cluster-edit-name']}
            <p class="text-destructive text-[13px]">{fieldErrors['cluster-edit-name']}</p>
          {:else}
            <p class="text-muted-foreground text-[13px]">A short identifier you'll see in lists.</p>
          {/if}
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
          <div class="flex flex-col gap-2">
            <Label for="cluster-edit-host">Host</Label>
            <Input
              id="cluster-edit-host"
              type="text"
              bind:value={host}
              autocomplete="off"
              spellcheck={false}
              disabled={saving}
              required
              aria-invalid={fieldErrors['cluster-edit-host'] ? 'true' : undefined}
            />
            {#if fieldErrors['cluster-edit-host']}
              <p class="text-destructive text-[13px]">{fieldErrors['cluster-edit-host']}</p>
            {:else}
              <p class="text-muted-foreground text-[13px]">Hostname or IP of the Proxmox cluster.</p>
            {/if}
          </div>
          <div class="flex flex-col gap-2">
            <Label for="cluster-edit-port">Port</Label>
            <Input
              id="cluster-edit-port"
              type="number"
              bind:value={port}
              min={1}
              max={65535}
              disabled={saving}
              required
              aria-invalid={fieldErrors['cluster-edit-port'] ? 'true' : undefined}
              style="font-variant-numeric: tabular-nums;"
            />
            {#if fieldErrors['cluster-edit-port']}
              <p class="text-destructive text-[13px]">{fieldErrors['cluster-edit-port']}</p>
            {/if}
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="cluster-edit-token-user">Token user</Label>
            <Input
              id="cluster-edit-token-user"
              type="text"
              bind:value={tokenUser}
              autocomplete="off"
              spellcheck={false}
              disabled={saving}
              required
              aria-invalid={fieldErrors['cluster-edit-token-user'] ? 'true' : undefined}
              class="font-mono text-[13px]"
            />
            {#if fieldErrors['cluster-edit-token-user']}
              <p class="text-destructive text-[13px]">{fieldErrors['cluster-edit-token-user']}</p>
            {:else}
              <p class="text-muted-foreground text-[13px]">e.g. root@pam</p>
            {/if}
          </div>
          <div class="flex flex-col gap-2">
            <Label for="cluster-edit-token-name">Token name</Label>
            <Input
              id="cluster-edit-token-name"
              type="text"
              bind:value={tokenName}
              autocomplete="off"
              spellcheck={false}
              disabled={saving}
              required
              aria-invalid={fieldErrors['cluster-edit-token-name'] ? 'true' : undefined}
              class="font-mono text-[13px]"
            />
            {#if fieldErrors['cluster-edit-token-name']}
              <p class="text-destructive text-[13px]">{fieldErrors['cluster-edit-token-name']}</p>
            {:else}
              <p class="text-muted-foreground text-[13px]">e.g. gui</p>
            {/if}
          </div>
        </div>

        <!-- Token secret: UI-SPEC "Update token" pattern.
             - Initially hidden as placeholder dots.
             - "Update token" link reveals the input.
             - On save, only includes the value when updatingToken=true (else
               the stored token is preserved). -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label for="cluster-edit-token-secret">API token secret</Label>
            {#if !updatingToken}
              <button
                type="button"
                class="text-primary text-[13px] font-medium underline-offset-4 hover:underline"
                onclick={() => (updatingToken = true)}
                disabled={saving}
              >
                Update token
              </button>
            {:else}
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground text-[13px] font-medium underline-offset-4 hover:underline"
                onclick={() => {
                  updatingToken = false;
                  newTokenSecret = '';
                }}
                disabled={saving}
              >
                Keep current token
              </button>
            {/if}
          </div>
          {#if updatingToken}
            <PasswordInput
              id="cluster-edit-token-secret"
              name="api_token_secret"
              autocomplete="off"
              bind:value={newTokenSecret}
              disabled={saving}
              required
              aria-invalid={fieldErrors['cluster-edit-token-secret'] ? 'true' : undefined}
            />
            {#if fieldErrors['cluster-edit-token-secret']}
              <p class="text-destructive text-[13px]">{fieldErrors['cluster-edit-token-secret']}</p>
            {:else}
              <p class="text-muted-foreground text-[13px]">
                Paste the new secret value PVE showed you when you rotated the token.
              </p>
            {/if}
          {:else}
            <Input
              id="cluster-edit-token-secret"
              type="password"
              value="••••••••"
              readonly
              disabled
              aria-readonly="true"
              class="font-mono"
            />
            <p class="text-muted-foreground text-[13px]">
              The stored token is preserved. Click "Update token" to change it.
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="cluster-edit-fingerprint">TLS fingerprint (optional)</Label>
          <Input
            id="cluster-edit-fingerprint"
            type="text"
            bind:value={tlsFingerprint}
            autocomplete="off"
            spellcheck={false}
            disabled={saving}
            class="font-mono text-[13px]"
          />
          <p class="text-muted-foreground text-[13px]">
            Required only for self-signed certificates.
          </p>
        </div>

        <div class="flex flex-row items-start gap-2 rounded-md border border-border p-3">
          <Checkbox
            id="cluster-edit-verify-ssl"
            checked={verifySsl}
            onCheckedChange={(v) => (verifySsl = v === true)}
            disabled={saving}
          />
          <div class="flex flex-col gap-1">
            <Label for="cluster-edit-verify-ssl" class="text-sm font-medium">Verify TLS</Label>
            <p class="text-muted-foreground text-[13px]">
              Validate the cluster's TLS certificate chain. Uncheck for self-signed.
            </p>
          </div>
        </div>

        <div
          class="flex flex-row items-start justify-between gap-4 rounded-md border border-border p-4"
        >
          <div class="flex flex-col gap-1">
            <Label for="cluster-edit-active" class="text-sm font-medium">Active</Label>
            <p class="text-muted-foreground text-[13px]">
              Inactive clusters are skipped for new tenant bootstraps.
            </p>
          </div>
          <Switch id="cluster-edit-active" bind:checked={isActive} disabled={saving} />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="cluster-edit-notes">Notes (optional)</Label>
          <Input
            id="cluster-edit-notes"
            type="text"
            bind:value={notes}
            autocomplete="off"
            disabled={saving}
          />
          <p class="text-muted-foreground text-[13px]">
            Free-form internal notes — never sent to Proxmox.
          </p>
        </div>

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

        <div class="flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onclick={() => goto('/admin/clusters')}
            disabled={saving || testing}
          >
            Cancel
          </Button>
          <Button type="button" variant="secondary" onclick={handleTest} disabled={saving || testing}>
            {#if testing}
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              Testing...
            {:else}
              Test connection
            {/if}
          </Button>
          <Button type="submit" disabled={saving || testing}>
            {#if saving}
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

  <!-- Danger zone -->
  <Card.Root class="border-destructive/40">
    <Card.Header>
      <Card.Title class="text-destructive text-lg font-semibold tracking-tight"
        >Danger zone</Card.Title
      >
      <Card.Description>
        Deleting a cluster destroys its encrypted credentials here. The Proxmox cluster itself is
        not affected.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <Button variant="destructive" onclick={() => (deleteOpen = true)}>Delete cluster</Button>
    </Card.Content>
  </Card.Root>
</div>

<ConfirmByNameDialog
  bind:open={deleteOpen}
  heading={`Delete ${data.cluster.name}?`}
  body={`This GUI will stop managing this cluster. The Proxmox cluster itself is not affected. Encrypted tokens stored here are destroyed.`}
  targetName={data.cluster.name}
  confirmLabel="Delete cluster"
  onConfirm={handleDelete}
/>
