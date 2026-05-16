<!--
  BackupsTab — the per-VM Backups tab body on the VM detail page.

  Contract: UI-SPEC §"Backups tab" + §Required loading/empty/error states +
  §Copywriting Contract.
    - The BackupScheduleCard on top, then a Backup-files Card.
    - Backup-files Card: header "Backups" + a "Back up now" primary button
      (Database icon) → api.lifecycle.backupNow.
    - Body: a file list, 48px (h-12) rows — filename (Mono 13/400 truncate),
      size (tabular-nums), timestamp, a MoreHorizontal menu: "Restore from
      this backup" (opens RestoreDialog — D-07) + "Delete backup file"
      (typed-name ConfirmByNameDialog — CTA "Delete backup").
    - Backup target not configured (D-08): when `backupStorageConfigured` is
      false, the "Back up now" button + the schedule card are disabled and a
      bg-warning/10 banner renders the UI-SPEC verbatim copy.
    - Loading = 3 skeleton rows; empty = Database icon + copy; error =
      "Couldn't load backups." + retry.

  STRIDE: T-03-07-06 — backup filenames are rendered via Svelte text
  interpolation (auto-escaped); no {@html}.
-->
<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Button } from '$lib/components/ui/button';
  import Database from '@lucide/svelte/icons/database';
  import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import type { BackupFile, ResourceKind } from '$lib/api/types';
  import { formatBytes, formatClock } from '$lib/utils/format';
  import ConfirmByNameDialog from '$lib/components/forms/ConfirmByNameDialog.svelte';
  import BackupScheduleCard from './BackupScheduleCard.svelte';
  import RestoreDialog from './RestoreDialog.svelte';

  type Props = {
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    /** Display name — toast copy + the restore/delete dialog targets. */
    vmName: string;
    /** False when the cluster has no designated backup storage (D-08). */
    backupStorageConfigured: boolean;
  };

  let { clusterId, vmid, type, vmName, backupStorageConfigured }: Props =
    $props();

  let backups = $state<BackupFile[]>([]);
  let loading = $state(true);
  let loadError = $state(false);
  let backingUp = $state(false);

  async function load() {
    loading = true;
    loadError = false;
    try {
      const res = await api.lifecycle.listBackups({ clusterId, vmid, type });
      // Newest-first by creation time.
      backups = [...res.backups].sort((a, b) => b.ctime - a.ctime);
    } catch {
      loadError = true;
      backups = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void clusterId;
    void vmid;
    void type;
    void load();
  });

  /** Back up now — enqueues the 202 job + the enqueue toast. */
  async function onBackupNow() {
    if (backingUp || !backupStorageConfigured) return;
    backingUp = true;
    try {
      await api.lifecycle.backupNow({ clusterId, vmid, type });
      toast(`Backup started for ${vmName}.`);
    } catch {
      toast.error(`Couldn’t queue the backup for ${vmName}. Try again.`);
    } finally {
      backingUp = false;
    }
  }

  // --- Restore dialog ----------------------------------------------------
  let restoreOpen = $state(false);
  let restoreVolid = $state('');
  let restoreFilename = $state('');

  function openRestore(b: BackupFile) {
    restoreVolid = b.volid;
    restoreFilename = b.filename;
    restoreOpen = true;
  }

  // --- Delete backup file confirm (typed-name) ---------------------------
  let deleteOpen = $state(false);
  let deleteVolid = $state('');
  let deleteFilename = $state('');

  function openDelete(b: BackupFile) {
    deleteVolid = b.volid;
    deleteFilename = b.filename;
    deleteOpen = true;
  }

  async function confirmDelete() {
    try {
      await api.lifecycle.deleteBackupFile({
        clusterId,
        vmid,
        type,
        volid: deleteVolid,
      });
      toast(`Delete backup started for ${vmName}.`);
    } catch {
      toast.error(`Couldn’t queue the backup delete. Try again.`);
    }
  }

  const isEmpty = $derived(!loading && !loadError && backups.length === 0);
</script>

<div class="flex flex-col gap-6">
  <!-- D-08: no-backup-storage banner. -->
  {#if !backupStorageConfigured}
    <div
      class="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3"
      role="status"
    >
      <TriangleAlert
        class="size-4 shrink-0 text-warning mt-0.5"
        aria-hidden="true"
      />
      <p class="text-[14px] text-foreground">
        No backup storage is configured for this cluster. Ask an administrator
        to set one.
      </p>
    </div>
  {/if}

  <!-- Schedule card (top). -->
  <BackupScheduleCard {clusterId} {vmid} {type} {backupStorageConfigured} />

  <!-- Backup-files card. -->
  <Card.Root>
    <Card.Header class="flex flex-row items-center justify-between gap-4">
      <Card.Title class="text-[18px] font-semibold">Backups</Card.Title>
      <Button
        size="sm"
        onclick={onBackupNow}
        disabled={!backupStorageConfigured || backingUp}
      >
        <Database class="size-3.5" aria-hidden="true" /> Back up now
      </Button>
    </Card.Header>
    <Card.Content>
      {#if loading}
        <!-- 3 skeleton rows (UI-SPEC §Required states). -->
        <div class="flex flex-col gap-2" aria-hidden="true">
          {#each [0, 1, 2] as i (i)}
            <div class="h-12 animate-pulse rounded bg-muted"></div>
          {/each}
        </div>
      {:else if loadError}
        <div class="flex flex-col items-center gap-3 py-12 text-center">
          <p class="text-[14px] font-medium">Couldn't load backups.</p>
          <Button variant="outline" onclick={() => load()}>Try again</Button>
        </div>
      {:else if isEmpty}
        <div class="flex flex-col items-center gap-2 py-12 text-center">
          <Database class="size-6 text-muted-foreground" aria-hidden="true" />
          <p class="text-[14px] font-medium">No backups yet</p>
          <p class="text-[14px] text-muted-foreground">
            Run a backup or set a schedule to protect this resource.
          </p>
        </div>
      {:else}
        <ul class="flex flex-col divide-y divide-border">
          {#each backups as b (b.volid)}
            <li class="flex h-12 items-center gap-3">
              <span
                class="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground"
                title={b.filename}
              >
                {b.filename}
              </span>
              <span
                class="shrink-0 text-[14px] text-muted-foreground"
                style="font-variant-numeric: tabular-nums;"
              >
                {formatBytes(b.size)}
              </span>
              <span
                class="hidden shrink-0 text-[14px] text-muted-foreground sm:inline"
              >
                {formatClock(b.ctime)}
              </span>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <Button
                      {...props}
                      variant="ghost"
                      size="icon"
                      class="size-9 shrink-0"
                      aria-label={`Backup actions for ${b.filename}`}
                    >
                      <MoreHorizontal class="size-4" aria-hidden="true" />
                    </Button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item onSelect={() => openRestore(b)}>
                    Restore from this backup
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => openDelete(b)}>
                    Delete backup file
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

<!-- Restore — the D-07 dialog (in-place vs restore-as-new). -->
<RestoreDialog
  bind:open={restoreOpen}
  {clusterId}
  {vmid}
  {type}
  {vmName}
  backupFilename={restoreFilename}
  archiveVolid={restoreVolid}
/>

<!-- Delete backup file — typed-name confirm (UI-SPEC §Destructive
     confirmations). The user types the backup filename. -->
<ConfirmByNameDialog
  bind:open={deleteOpen}
  heading={`Delete backup '${deleteFilename}'?`}
  body={`This backup file is permanently removed from storage. This can't be undone.`}
  targetName={deleteFilename}
  confirmLabel="Delete backup"
  onConfirm={confirmDelete}
/>
