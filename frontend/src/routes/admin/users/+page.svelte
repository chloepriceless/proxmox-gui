<!--
  /admin/users — Admin user list.

  Per UI-SPEC §Admin pages + §Copywriting Contract:
    - Page title "Users" (verbatim) + description
      "Manage who can sign in and which teams they belong to." (verbatim).
    - Primary CTA: "New user" → /admin/users/new (verb + noun, UI-SPEC).
    - Data table columns: Username, Email, Role, Status, Teams, Created.
    - Row actions (MoreHorizontal dropdown): Edit, Disable/Enable (toggle),
      Delete (red, destructive — opens ConfirmByNameDialog).
    - Self-modification guard (UI): admin's own row hides Disable/Delete.
    - Empty state copy: UI-SPEC verbatim.
    - Error state copy: "Couldn't load users. Try again." with retry button (UI-SPEC).
    - Numeric columns use `font-variant-numeric: tabular-nums` (UI-SPEC §Typography).

  STRIDE:
    - T-01-10-01 (self-modification lockout): UI hides Disable/Delete for
      current admin's own row; backend (Plan 07) is authoritative.
    - T-01-10-02 (tampering via destructive action): Delete + Disable route
      through ConfirmByNameDialog (Plan 08, typed-name match).
    - T-01-10-07 (user enumeration): require_admin gate is server-side (Plan 07);
      this page never renders unless `event.locals.user.is_admin` (page.server.ts).
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
  import { api, ApiError } from '$lib/api/client';
  import type { AdminUser } from '$lib/api/types';
  import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
  import Plus from '@lucide/svelte/icons/plus';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Optimistic local override — set by mutations; falls through to data.users.
  let localOverride = $state<AdminUser[] | null>(null);
  const users = $derived<AdminUser[]>(localOverride ?? data.users);
  const currentUserId = $derived(data.user.id);

  onMount(() => {
    if (data.loadError) toast.error("Couldn't load users. Try again.");
  });

  async function refreshList() {
    try {
      const fresh = await api.users.list();
      localOverride = fresh;
    } catch {
      // Surface via toast; keep the previous state.
      toast.error("Couldn't refresh users.");
    }
  }

  // ---- Disable (typed-name confirm — destructive) ----
  let disableOpen = $state(false);
  let disableTarget = $state<AdminUser | null>(null);

  function openDisable(u: AdminUser) {
    disableTarget = u;
    disableOpen = true;
  }

  async function handleDisable() {
    if (!disableTarget) return;
    const target = disableTarget;
    try {
      await api.users.update({ id: target.id, is_active: false });
      await refreshList();
      toast.success(`${target.username} was disabled.`);
      await invalidateAll();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 422
          ? 'Cannot modify your own active state.'
          : "Couldn't disable that user.";
      toast.error(msg);
    } finally {
      disableTarget = null;
    }
  }

  // ---- Enable (non-destructive — single click, no typed confirm) ----
  async function handleEnable(u: AdminUser) {
    try {
      await api.users.update({ id: u.id, is_active: true });
      await refreshList();
      toast.success(`${u.username} was enabled.`);
      await invalidateAll();
    } catch {
      toast.error("Couldn't enable that user.");
    }
  }

  // ---- Delete (typed-name confirm — destructive) ----
  let deleteOpen = $state(false);
  let deleteTarget = $state<AdminUser | null>(null);

  function openDelete(u: AdminUser) {
    deleteTarget = u;
    deleteOpen = true;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await api.users.del({ id: target.id });
      localOverride = users.filter((u) => u.id !== target.id);
      toast.success(`${target.username} was deleted.`);
      await invalidateAll();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 422
          ? 'Cannot delete yourself.'
          : "Couldn't delete that user.";
      toast.error(msg);
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

  function nonPersonalTeamCount(u: AdminUser): number {
    // Personal team is bookkeeping; user-visible count is shared teams only.
    return u.teams.filter((t) => !t.personal).length;
  }
</script>

<svelte:head>
  <title>Users — Proxmox GUI</title>
</svelte:head>

<div class="flex w-full flex-col gap-6">
  <header class="flex flex-row items-start justify-between gap-4">
    <div class="flex flex-col gap-2">
      <h1 class="text-[28px] font-semibold tracking-tight">Users</h1>
      <p class="text-muted-foreground text-sm">
        Manage who can sign in and which teams they belong to.
      </p>
    </div>
    <Button onclick={() => goto('/admin/users/new')}>
      <Plus class="size-4" aria-hidden="true" />
      New user
    </Button>
  </header>

  {#if data.loadError}
    <div
      class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center"
    >
      <p class="text-sm font-medium">Couldn't load users. Try again.</p>
      <Button variant="outline" onclick={refreshList}>Try again</Button>
    </div>
  {:else if users.length === 0}
    <div
      class="border-border bg-muted/30 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-10 text-center"
    >
      <p class="text-sm font-medium">No users yet</p>
      <p class="text-muted-foreground text-[13px]">
        Click 'New user' to create the first one.
      </p>
    </div>
  {:else}
    <div class="rounded-md border border-border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="text-[13px] font-medium">Username</Table.Head>
            <Table.Head class="text-[13px] font-medium">Email</Table.Head>
            <Table.Head class="text-[13px] font-medium">Role</Table.Head>
            <Table.Head class="text-[13px] font-medium">Status</Table.Head>
            <Table.Head
              class="text-[13px] font-medium"
              style="font-variant-numeric: tabular-nums;">Teams</Table.Head
            >
            <Table.Head
              class="text-[13px] font-medium"
              style="font-variant-numeric: tabular-nums;">Created</Table.Head
            >
            <Table.Head><span class="sr-only">Actions</span></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each users as u (u.id)}
            {@const isSelf = u.id === currentUserId}
            <Table.Row class="hover:bg-muted/50">
              <Table.Cell>
                <a
                  href="/admin/users/{u.id}"
                  class="text-foreground hover:text-primary text-sm font-medium underline-offset-4 hover:underline"
                  >{u.username}</a
                >
              </Table.Cell>
              <Table.Cell class="text-muted-foreground text-sm">{u.email}</Table.Cell>
              <Table.Cell>
                {#if u.is_admin}
                  <Badge variant="default">Admin</Badge>
                {:else}
                  <Badge variant="outline">User</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell>
                {#if u.is_active}
                  <Badge variant="outline">Active</Badge>
                {:else}
                  <Badge variant="secondary">Disabled</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-sm" style="font-variant-numeric: tabular-nums;"
                >{nonPersonalTeamCount(u)}</Table.Cell
              >
              <Table.Cell
                class="text-muted-foreground text-sm"
                style="font-variant-numeric: tabular-nums;">{relativeTime(u.created_at)}</Table.Cell
              >
              <Table.Cell class="text-right">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <button
                        {...props}
                        class="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-md transition-colors"
                        aria-label={`Actions for ${u.username}`}
                      >
                        <MoreHorizontal class="size-4" aria-hidden="true" />
                      </button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item onSelect={() => goto(`/admin/users/${u.id}`)}>
                      Edit
                    </DropdownMenu.Item>
                    {#if !isSelf}
                      {#if u.is_active}
                        <DropdownMenu.Item onSelect={() => openDisable(u)}>Disable</DropdownMenu.Item>
                      {:else}
                        <DropdownMenu.Item onSelect={() => handleEnable(u)}>Enable</DropdownMenu.Item>
                      {/if}
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        class="text-destructive focus:text-destructive"
                        onSelect={() => openDelete(u)}
                      >
                        Delete
                      </DropdownMenu.Item>
                    {/if}
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

<!-- Disable confirmation (typed-name) -->
{#if disableTarget}
  <ConfirmByNameDialog
    bind:open={disableOpen}
    heading={`Disable ${disableTarget.username}?`}
    body={`${disableTarget.username} won't be able to sign in. Active sessions are revoked immediately. You can re-enable them later.`}
    targetName={disableTarget.username}
    confirmLabel="Disable user"
    onConfirm={handleDisable}
  />
{/if}

<!-- Delete confirmation (typed-name) -->
{#if deleteTarget}
  <ConfirmByNameDialog
    bind:open={deleteOpen}
    heading={`Delete ${deleteTarget.username}?`}
    body={`Their account is removed permanently. Their team memberships are dropped. VMs they created stay with the team. This can't be undone.`}
    targetName={deleteTarget.username}
    confirmLabel="Delete user"
    onConfirm={handleDelete}
  />
{/if}
