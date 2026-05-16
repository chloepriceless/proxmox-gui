<!--
  /admin — the admin landing page (Plan 04-11).

  Per UI-SPEC §"Admin Sync catalog surface" (D-05):
    - Hosts the "Sync catalog" control — a `RefreshCw`-icon button calling
      `api.catalog.syncCatalog`. On success it shows the returned re-pin
      summary ("{N} scripts added, {M} updated, pinned to commit {hash}").
    - The page is admin-gated by `+page.server.ts` (defence-in-depth — the
      real boundary is `require_admin` on `POST /catalog/sync`, T-04-11-02).
    - It also links to the existing admin sub-pages (Users / Teams / Clusters)
      so the admin area has a real index.
-->
<script lang="ts">
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { api, ApiError } from '$lib/api/client';
  import type { CatalogSyncResponse } from '$lib/api/types';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Users from '@lucide/svelte/icons/users';
  import UsersRound from '@lucide/svelte/icons/users-round';
  import Server from '@lucide/svelte/icons/server';

  let syncing = $state(false);
  /** The last sync result, shown as the re-pin summary. */
  let lastSync = $state<CatalogSyncResponse | null>(null);
  let syncError = $state<string | null>(null);

  /** Pull a fresher community-scripts commit + re-pin the catalog (D-05). */
  async function syncCatalog(): Promise<void> {
    if (syncing) return;
    syncing = true;
    syncError = null;
    try {
      const res = await api.catalog.syncCatalog();
      lastSync = res;
      toast.success(`Catalog synced — pinned to commit ${res.commit_sha}.`);
    } catch (err) {
      lastSync = null;
      syncError =
        err instanceof ApiError && err.status === 403
          ? 'You need admin rights to sync the catalog.'
          : "Couldn't sync the catalog. Try again.";
      toast.error(syncError);
    } finally {
      syncing = false;
    }
  }

  const adminLinks = [
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/teams', label: 'Teams', icon: UsersRound },
    { href: '/admin/clusters', label: 'Clusters', icon: Server }
  ];
</script>

<svelte:head>
  <title>Admin — Proxmox GUI</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
  <header class="flex flex-col gap-1">
    <h1 class="text-[22px] font-semibold tracking-tight">Admin</h1>
    <p class="text-muted-foreground text-[14px]">
      Manage users, teams, clusters, and the community-scripts catalog.
    </p>
  </header>

  <!-- The Sync-catalog surface (D-05). -->
  <Card.Root>
    <Card.Header>
      <Card.Title>Community-scripts catalog</Card.Title>
      <Card.Description>
        The catalog is pinned to a specific community-scripts commit. Sync to
        pull a fresher upstream snapshot and re-pin.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      <div>
        <Button onclick={syncCatalog} disabled={syncing}>
          <RefreshCw
            class="size-4 {syncing ? 'animate-spin' : ''}"
            aria-hidden="true"
          />
          {syncing ? 'Syncing…' : 'Sync catalog'}
        </Button>
      </div>

      {#if lastSync}
        <p class="text-[13px] text-success">
          {lastSync.added} scripts added, {lastSync.updated} updated, pinned to commit
          <span class="font-mono">{lastSync.commit_sha}</span>.
        </p>
      {:else if syncError}
        <p class="text-[13px] text-destructive">{syncError}</p>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Admin sub-page links. -->
  <Card.Root>
    <Card.Header>
      <Card.Title>Manage</Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-wrap gap-2">
      {#each adminLinks as link (link.href)}
        {@const Icon = link.icon}
        <Button href={link.href} variant="outline">
          <Icon class="size-4" aria-hidden="true" />
          {link.label}
        </Button>
      {/each}
    </Card.Content>
  </Card.Root>
</div>
