<!--
  SnapshotsTab — the Snapshots tab body on the VM detail page.

  Contract: UI-SPEC §"Snapshots tab" + §Required loading/empty/error states.
    - A single Card: header "Snapshots" (Heading 18/600) + a "Create snapshot"
      primary button (Camera icon) top-right.
    - Body: SnapshotTree (D-05). Loading = 3 skeleton nodes; empty = Camera
      icon + copy + a Create button; error = "Couldn't load snapshots." + retry.
    - Create button → SnapshotCreateDialog → api.lifecycle.createSnapshot.
    - The tree's onRestore → ConfirmByNameDialog (typed-name, "Restore
      snapshot") → rollbackSnapshot.
    - The tree's onDelete → ConfirmByNameDialog (typed-name, "Delete snapshot")
      → deleteSnapshot.
    - Every mutation returns 202 — the Tasks drawer (Plan 05) takes over the
      progress; we surface the enqueue toast.
-->
<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import Camera from '@lucide/svelte/icons/camera';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import type { ResourceKind, SnapshotItem } from '$lib/api/types';
  import ConfirmByNameDialog from '$lib/components/forms/ConfirmByNameDialog.svelte';
  import SnapshotTree from './SnapshotTree.svelte';
  import SnapshotCreateDialog from './SnapshotCreateDialog.svelte';
  import { currentSnapshotName } from './snapshot-tree';

  type Props = {
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    /** The VM/LXC display name — typed-name confirm target + toast copy. */
    vmName: string;
  };

  let { clusterId, vmid, type, vmName }: Props = $props();

  let snapshots = $state<SnapshotItem[]>([]);
  let loading = $state(true);
  let loadError = $state(false);

  // PVE represents the live VM as a synthetic "current" snapshot. The shared
  // helper detects that marker in the flat list.
  const currentName = $derived(currentSnapshotName(snapshots));

  async function load() {
    loading = true;
    loadError = false;
    try {
      const res = await api.lifecycle.listSnapshots({ clusterId, vmid, type });
      snapshots = res.snapshots;
    } catch {
      loadError = true;
      snapshots = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Re-fetch whenever the VM identity changes.
    void clusterId;
    void vmid;
    void type;
    void load();
  });

  // --- Create dialog ------------------------------------------------------
  let createOpen = $state(false);

  async function onCreateSubmit(d: {
    name: string;
    description: string;
    vmstate: boolean;
  }) {
    await api.lifecycle.createSnapshot({
      clusterId,
      vmid,
      type,
      name: d.name,
      description: d.description,
      vmstate: d.vmstate,
    });
    toast(`Snapshot started for ${vmName}.`);
  }

  // --- Restore confirm (typed-name) --------------------------------------
  let restoreOpen = $state(false);
  let restoreTarget = $state('');

  function openRestore(name: string) {
    restoreTarget = name;
    restoreOpen = true;
  }

  async function confirmRestore() {
    try {
      await api.lifecycle.rollbackSnapshot({ clusterId, vmid, type, name: restoreTarget });
      toast(`Restore started for ${vmName}.`);
    } catch {
      toast.error(`Couldn’t queue the restore for ${vmName}. Try again.`);
    }
  }

  // --- Delete confirm (typed-name) ---------------------------------------
  let deleteOpen = $state(false);
  let deleteTarget = $state('');

  function openDelete(name: string) {
    deleteTarget = name;
    deleteOpen = true;
  }

  async function confirmDelete() {
    try {
      await api.lifecycle.deleteSnapshot({ clusterId, vmid, type, name: deleteTarget });
      toast(`Delete snapshot started for ${vmName}.`);
    } catch {
      toast.error(`Couldn’t queue the snapshot delete for ${vmName}. Try again.`);
    }
  }

  const isEmpty = $derived(
    !loading && !loadError && snapshots.filter((s) => s.name !== 'current').length === 0
  );
</script>

<Card.Root>
  <Card.Header class="flex flex-row items-center justify-between gap-4">
    <Card.Title class="text-[18px] font-semibold">Snapshots</Card.Title>
    {#if !isEmpty}
      <Button size="sm" onclick={() => (createOpen = true)}>
        <Camera class="size-3.5" aria-hidden="true" /> Create snapshot
      </Button>
    {/if}
  </Card.Header>
  <Card.Content>
    {#if loading}
      <!-- 3 skeleton nodes (UI-SPEC §Required states). -->
      <div class="flex flex-col gap-2" aria-hidden="true">
        {#each [0, 1, 2] as i (i)}
          <div class="h-10 animate-pulse rounded bg-muted"></div>
        {/each}
      </div>
    {:else if loadError}
      <div class="flex flex-col items-center gap-3 py-12 text-center">
        <p class="text-[14px] font-medium">Couldn't load snapshots.</p>
        <Button variant="outline" onclick={() => load()}>Try again</Button>
      </div>
    {:else if isEmpty}
      <div class="flex flex-col items-center gap-2 py-12 text-center">
        <Camera class="size-6 text-muted-foreground" aria-hidden="true" />
        <p class="text-[14px] font-medium">No snapshots yet</p>
        <p class="text-[14px] text-muted-foreground">
          Create a snapshot to capture this VM's current state.
        </p>
        <Button class="mt-2" size="sm" onclick={() => (createOpen = true)}>
          <Camera class="size-3.5" aria-hidden="true" /> Create snapshot
        </Button>
      </div>
    {:else}
      <SnapshotTree
        {snapshots}
        {currentName}
        onRestore={openRestore}
        onDelete={openDelete}
      />
    {/if}
  </Card.Content>
</Card.Root>

<!-- Create — form dialog. -->
<SnapshotCreateDialog bind:open={createOpen} {vmName} onSubmit={onCreateSubmit} />

<!-- Restore — typed-name confirm (UI-SPEC §Destructive confirmations). -->
<ConfirmByNameDialog
  bind:open={restoreOpen}
  heading={`Restore ${vmName} to '${restoreTarget}'?`}
  body={`This rolls ${vmName} back to the '${restoreTarget}' state. Changes made since that snapshot are lost. This can't be undone.`}
  targetName={vmName}
  confirmLabel="Restore snapshot"
  onConfirm={confirmRestore}
/>

<!-- Delete — typed-name confirm. The user types the snapshot name. -->
<ConfirmByNameDialog
  bind:open={deleteOpen}
  heading={`Delete snapshot '${deleteTarget}'?`}
  body={`The '${deleteTarget}' snapshot of ${vmName} is removed. Child snapshots that depend on it may also be affected. This can't be undone.`}
  targetName={deleteTarget}
  confirmLabel="Delete snapshot"
  onConfirm={confirmDelete}
/>
