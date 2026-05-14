<!--
  /admin/clusters — Admin cluster list.

  Per UI-SPEC §Admin pages + §Copywriting Contract:
    - Page title "Clusters" + description "Proxmox VE clusters this installation can manage." (verbatim).
    - Primary CTA: "Register cluster" → /admin/clusters/new.
    - Data table columns: Name, Host, Port, Status (ClusterStatusPill — initial
      "Not yet tested"), TLS, Created.
    - Row actions: Edit, Test connection (api.clusters.testExisting → updates
      the pill), Delete (ConfirmByNameDialog).
    - Empty state copy verbatim: "No clusters registered — Register a Proxmox
      cluster to get started." with inline "Register cluster" button.

  STRIDE: T-01-10-02 (delete without typed confirm), T-01-10-08 (cascade
  guard — backend returns 409 if team_cluster_tokens rows exist; we surface
  the 409 detail message via toast).
-->
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Table from '$lib/components/ui/table';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import ConfirmByNameDialog from '$lib/components/forms/ConfirmByNameDialog.svelte';
  import ClusterStatusPill from '$lib/components/clusters/ClusterStatusPill.svelte';
  import { api, ApiError } from '$lib/api/client';
  import type { Cluster } from '$lib/api/types';
  import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
  import Plus from '@lucide/svelte/icons/plus';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let localOverride = $state<Cluster[] | null>(null);
  const clusters = $derived<Cluster[]>(localOverride ?? data.clusters);

  // Per-row test status. Keyed by cluster.id. `undefined` means "not yet
  // tested in this session"; testExisting() result lands here.
  let rowStatus = $state<Record<number, 'ok' | 'failed' | 'untested'>>({});
  let rowLabel = $state<Record<number, string | undefined>>({});
  let testingId = $state<number | null>(null);

  onMount(() => {
    if (data.loadError) toast.error("Couldn't load clusters. Try again.");
  });

  async function refreshList() {
    try {
      const fresh = await api.clusters.list();
      localOverride = fresh;
    } catch {
      toast.error("Couldn't refresh clusters.");
    }
  }

  async function handleTest(c: Cluster) {
    testingId = c.id;
    try {
      const res = await api.clusters.testExisting({ id: c.id });
      if (res.ok) {
        rowStatus = { ...rowStatus, [c.id]: 'ok' };
        rowLabel = {
          ...rowLabel,
          [c.id]: res.version ? `Connection OK (${res.version})` : 'Connection OK'
        };
        toast.success(`${c.name} is reachable.`);
      } else {
        rowStatus = { ...rowStatus, [c.id]: 'failed' };
        rowLabel = { ...rowLabel, [c.id]: undefined };
        toast.error(`${c.name}: ${res.error ?? "Couldn't connect."}`);
      }
    } catch {
      rowStatus = { ...rowStatus, [c.id]: 'failed' };
      rowLabel = { ...rowLabel, [c.id]: undefined };
      toast.error("Couldn't reach that cluster.");
    } finally {
      testingId = null;
    }
  }

  // ---- Delete (typed-name confirm — destructive) ----
  let deleteOpen = $state(false);
  let deleteTarget = $state<Cluster | null>(null);

  function openDelete(c: Cluster) {
    deleteTarget = c;
    deleteOpen = true;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await api.clusters.del({ id: target.id });
      localOverride = clusters.filter((c) => c.id !== target.id);
      toast.success(`${target.name} was deleted.`);
      await invalidateAll();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // D-04 option-a: cluster bound to one or more teams.
        const detail = String((err.body as { detail?: unknown } | null)?.detail ?? '');
        toast.error(detail || "Couldn't delete: cluster has active team bindings.");
      } else {
        toast.error("Couldn't delete that cluster.");
      }
    } finally {
      deleteTarget = null;
    }
  }

  // ---- Helpers ----
  function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
  }

  function statusFor(c: Cluster): 'ok' | 'failed' | 'untested' {
    return rowStatus[c.id] ?? 'untested';
  }
</script>

<svelte:head>
  <title>Clusters — Proxmox GUI</title>
</svelte:head>

<div class="flex w-full flex-col gap-6">
  <header class="flex flex-row items-start justify-between gap-4">
    <div class="flex flex-col gap-2">
      <h1 class="text-[28px] font-semibold tracking-tight">Clusters</h1>
      <p class="text-muted-foreground text-sm">
        Proxmox VE clusters this installation can manage.
      </p>
    </div>
    <Button onclick={() => goto('/admin/clusters/new')}>
      <Plus class="size-4" aria-hidden="true" />
      Register cluster
    </Button>
  </header>

  {#if data.loadError}
    <div
      class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center"
    >
      <p class="text-sm font-medium">Couldn't load clusters.</p>
      <Button variant="outline" onclick={refreshList}>Try again</Button>
    </div>
  {:else if clusters.length === 0}
    <div
      class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-12 text-center"
    >
      <p class="text-sm font-medium">No clusters registered</p>
      <p class="text-muted-foreground text-[13px]">
        Register a Proxmox cluster to get started.
      </p>
      <Button onclick={() => goto('/admin/clusters/new')}>
        <Plus class="size-4" aria-hidden="true" />
        Register cluster
      </Button>
    </div>
  {:else}
    <div class="rounded-md border border-border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="text-[13px] font-medium">Name</Table.Head>
            <Table.Head class="text-[13px] font-medium">Host</Table.Head>
            <Table.Head
              class="text-[13px] font-medium"
              style="font-variant-numeric: tabular-nums;">Port</Table.Head
            >
            <Table.Head class="text-[13px] font-medium">Status</Table.Head>
            <Table.Head class="text-[13px] font-medium">TLS</Table.Head>
            <Table.Head
              class="text-[13px] font-medium"
              style="font-variant-numeric: tabular-nums;">Created</Table.Head
            >
            <Table.Head><span class="sr-only">Actions</span></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each clusters as c (c.id)}
            <Table.Row class="hover:bg-muted/50">
              <Table.Cell>
                <a
                  href="/admin/clusters/{c.id}"
                  class="text-foreground hover:text-primary text-sm font-medium underline-offset-4 hover:underline"
                  >{c.name}</a
                >
              </Table.Cell>
              <Table.Cell class="text-muted-foreground font-mono text-[13px]">{c.host}</Table.Cell>
              <Table.Cell class="text-sm" style="font-variant-numeric: tabular-nums;"
                >{c.port}</Table.Cell
              >
              <Table.Cell>
                <ClusterStatusPill status={statusFor(c)} label={rowLabel[c.id]} />
              </Table.Cell>
              <Table.Cell>
                {#if c.verify_ssl}
                  <Badge variant="outline">Verified</Badge>
                {:else if c.tls_fingerprint}
                  <Badge variant="outline">Pinned</Badge>
                {:else}
                  <Badge variant="secondary">Skipped</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell
                class="text-muted-foreground text-sm"
                style="font-variant-numeric: tabular-nums;">{relativeTime(c.created_at)}</Table.Cell
              >
              <Table.Cell class="text-right">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <button
                        {...props}
                        class="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-md transition-colors"
                        aria-label={`Actions for ${c.name}`}
                      >
                        <MoreHorizontal class="size-4" aria-hidden="true" />
                      </button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item onSelect={() => goto(`/admin/clusters/${c.id}`)}>
                      Edit
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleTest(c)}
                      disabled={testingId === c.id}
                    >
                      {testingId === c.id ? 'Testing...' : 'Test connection'}
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item
                      class="text-destructive focus:text-destructive"
                      onSelect={() => openDelete(c)}
                    >
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/if}
</div>

<!-- Delete confirmation (typed-name) -->
{#if deleteTarget}
  <ConfirmByNameDialog
    bind:open={deleteOpen}
    heading={`Delete ${deleteTarget.name}?`}
    body={`This GUI will stop managing this cluster. The Proxmox cluster itself is not affected. Encrypted tokens stored here are destroyed.`}
    targetName={deleteTarget.name}
    confirmLabel="Delete cluster"
    onConfirm={handleDelete}
  />
{/if}
