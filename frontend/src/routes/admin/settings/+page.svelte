<!--
  /admin/settings — admin Settings page (Plan 05-06, D-01).

  Two cards:
    - General: the server-authoritative idle timeout (D-02) + audit retention
      window (D-06), saved via PATCH /admin/settings.
    - Self-update (DEPLOY-04): "Update now" enqueues the worker self-update job
      (202 + job_id) then reconnect-polls /api/v1/health across the API restart
      and reloads onto the new code. The job also appears in the Tasks drawer.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { updateSettings } from '$lib/api/settings';
  import { startSelfUpdate, health } from '$lib/api/selfupdate';
  import { ApiError } from '$lib/utils/api';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Seed the editable form once from the SSR load (defaults if it failed).
  // `untrack` makes the read-once intent explicit — re-seeding on a data change
  // is deliberately NOT wanted while the admin is editing the fields.
  let idleTimeout = $state<number>(
    untrack(() => data.settings?.idle_timeout_minutes ?? 30)
  );
  let retentionDays = $state<number>(
    untrack(() => data.settings?.audit_retention_days ?? 365)
  );
  let saving = $state(false);

  // Self-update state.
  let updating = $state(false);
  let updateMessage = $state<string | null>(null);
  let updateError = $state<string | null>(null);

  onMount(() => {
    if (data.loadError) toast.error("Couldn't load settings. Showing defaults.");
  });

  async function saveSettings(e: Event) {
    e.preventDefault();
    if (saving) return;
    saving = true;
    try {
      const updated = await updateSettings({
        idle_timeout_minutes: Number(idleTimeout),
        audit_retention_days: Number(retentionDays)
      });
      idleTimeout = updated.idle_timeout_minutes;
      retentionDays = updated.audit_retention_days;
      toast.success('Settings saved.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Try again.';
      toast.error(`Couldn't save settings. ${msg}`);
    } finally {
      saving = false;
    }
  }

  async function runSelfUpdate() {
    if (updating) return;
    updating = true;
    updateError = null;
    try {
      const { job_id } = await startSelfUpdate();
      updateMessage = `Update started (task #${job_id}). The app will restart and reconnect automatically — watch the Tasks drawer for progress.`;
      toast(`Self-update started (task #${job_id}).`);
      await pollHealthThenReload();
    } catch (err) {
      updating = false;
      const msg = err instanceof ApiError ? err.message : 'Try again.';
      updateError = `Couldn't start the update. ${msg}`;
      toast.error('Couldn’t start the self-update.');
    }
  }

  // Reconnect-poll /api/v1/health: wait for the API to go DOWN (restarting)
  // then come back UP, and reload onto the new code. If it never goes down
  // (e.g. a SHA-mismatch abort that rolls back before any restart), fall back
  // to a timeout that points the admin at the Tasks drawer for the verdict.
  async function pollHealthThenReload() {
    const start = Date.now();
    const MAX_MS = 5 * 60 * 1000;
    let sawDown = false;
    while (Date.now() - start < MAX_MS) {
      await new Promise((r) => setTimeout(r, 3000));
      const ok = await health();
      if (!ok) {
        sawDown = true;
        continue;
      }
      if (sawDown) {
        window.location.reload();
        return;
      }
    }
    updating = false;
    updateError =
      'The update is taking longer than expected — check the Tasks drawer for its status.';
  }
</script>

<header class="mb-6">
  <h1 class="text-[28px] font-semibold tracking-tight">Settings</h1>
  <p class="text-muted-foreground mt-1 text-sm">
    Installation-wide settings for sessions, audit retention, and updates.
  </p>
</header>

<div class="flex max-w-2xl flex-col gap-6">
  <!-- General settings -->
  <Card.Root>
    <Card.Header>
      <Card.Title>General</Card.Title>
      <Card.Description>Session idle timeout and audit log retention.</Card.Description>
    </Card.Header>
    <Card.Content>
      <form onsubmit={saveSettings} class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <Label for="idle_timeout_minutes">Idle timeout (minutes)</Label>
          <Input
            id="idle_timeout_minutes"
            type="number"
            min="1"
            max="1440"
            bind:value={idleTimeout}
            class="max-w-[12rem]"
          />
          <p class="text-muted-foreground text-[13px]">
            Users are signed out after this long without activity (a warning shows
            2 minutes before).
          </p>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="audit_retention_days">Audit retention (days)</Label>
          <Input
            id="audit_retention_days"
            type="number"
            min="1"
            max="3650"
            bind:value={retentionDays}
            class="max-w-[12rem]"
          />
          <p class="text-muted-foreground text-[13px]">
            Audit entries older than this are rolled into compressed archives
            nightly.
          </p>
        </div>
        <div>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>

  <!-- Self-update -->
  <Card.Root>
    <Card.Header>
      <Card.Title>Self-update</Card.Title>
      <Card.Description>
        Pull the latest tagged release, verify it, and apply it with an automatic
        rollback if the new version fails its health check.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      {#if updateMessage}
        <p class="text-[14px]" role="status" aria-live="polite">{updateMessage}</p>
      {/if}
      {#if updateError}
        <p class="text-destructive text-[14px]" role="alert">{updateError}</p>
      {/if}
      <div>
        <Button onclick={runSelfUpdate} disabled={updating}>
          {updating ? 'Updating…' : 'Update now'}
        </Button>
      </div>
    </Card.Content>
  </Card.Root>
</div>
