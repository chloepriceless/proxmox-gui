<!--
  /admin/teams — Admin team list.

  Plan 01-10 (frontend-admin) team-management surface. Added during the
  Phase 2 operator smoke test: no team list/create UI existed — only the
  /admin/teams/[id] detail page (Plan 02-06), unreachable without knowing
  the id.

    - Page title "Teams" + description.
    - Primary CTA: "New team" -> /admin/teams/new.
    - Columns: Name (links to detail), Members, Status, Created.
    - Personal teams are badged "Personal" — they carry no quotas (D-11);
      shared teams are the ones operators provision and quota.
    - Error state: "Couldn't load teams. Try again." with a retry button.
-->
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Table from '$lib/components/ui/table';
  import Plus from '@lucide/svelte/icons/plus';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const teams = $derived(data.teams);

  onMount(() => {
    if (data.loadError) toast.error("Couldn't load teams. Try again.");
  });

  function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - then);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    return `${Math.floor(months / 12)} year${Math.floor(months / 12) === 1 ? '' : 's'} ago`;
  }
</script>

<svelte:head>
  <title>Teams — Proxmox GUI</title>
</svelte:head>

<div class="flex w-full flex-col gap-6">
  <header class="flex flex-row items-start justify-between gap-4">
    <div class="flex flex-col gap-2">
      <h1 class="text-[28px] font-semibold tracking-tight">Teams</h1>
      <p class="text-muted-foreground text-sm">
        Shared teams group users and own a Proxmox pool, quota and token on every cluster.
      </p>
    </div>
    <Button onclick={() => goto('/admin/teams/new')}>
      <Plus class="size-4" aria-hidden="true" />
      New team
    </Button>
  </header>

  {#if data.loadError}
    <div
      class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center"
    >
      <p class="text-sm font-medium">Couldn't load teams. Try again.</p>
      <Button variant="outline" onclick={() => invalidateAll()}>Try again</Button>
    </div>
  {:else if teams.length === 0}
    <div
      class="border-border bg-muted/30 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-10 text-center"
    >
      <p class="text-sm font-medium">No teams yet</p>
      <p class="text-muted-foreground text-[13px]">Click 'New team' to create the first one.</p>
    </div>
  {:else}
    <div class="rounded-md border border-border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="text-[13px] font-medium">Name</Table.Head>
            <Table.Head class="text-[13px] font-medium" style="font-variant-numeric: tabular-nums;"
              >Members</Table.Head
            >
            <Table.Head class="text-[13px] font-medium">Status</Table.Head>
            <Table.Head class="text-[13px] font-medium" style="font-variant-numeric: tabular-nums;"
              >Created</Table.Head
            >
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each teams as t (t.id)}
            <Table.Row class="hover:bg-muted/50">
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <a
                    href="/admin/teams/{t.id}"
                    class="text-foreground hover:text-primary text-sm font-medium underline-offset-4 hover:underline"
                    >{t.name}</a
                  >
                  {#if t.personal}
                    <Badge variant="secondary">Personal</Badge>
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell class="text-sm" style="font-variant-numeric: tabular-nums;"
                >{t.member_count}</Table.Cell
              >
              <Table.Cell>
                {#if t.is_active}
                  <Badge variant="outline">Active</Badge>
                {:else}
                  <Badge variant="secondary">Disabled</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell
                class="text-muted-foreground text-sm"
                style="font-variant-numeric: tabular-nums;">{relativeTime(t.created_at)}</Table.Cell
              >
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/if}
</div>
