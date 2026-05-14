<script lang="ts">
  import { goto } from '$app/navigation';
  import { page as pageStore } from '$app/stores';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Popover from '$lib/components/ui/popover';
  import { Switch } from '$lib/components/ui/switch';
  import { Label } from '$lib/components/ui/label';
  import FilterChip from '$lib/components/inventory/FilterChip.svelte';
  import AuditTable from '$lib/components/audit/AuditTable.svelte';
  import CsvExportButton from '$lib/components/audit/CsvExportButton.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const filters = $derived(data.filters);
  const isAdmin = $derived(!!data.user?.is_admin);

  function setParam(k: string, v: string | null) {
    const u = new URL($pageStore.url);
    if (v === null || v === '') u.searchParams.delete(k);
    else u.searchParams.set(k, v);
    u.searchParams.delete('page'); // reset to page 1 on filter change
    goto(u.pathname + u.search, { keepFocus: true, replaceState: true });
  }

  function setRangePreset(days: number) {
    const to = new Date();
    const from = new Date(Date.now() - days * 86400_000);
    const u = new URL($pageStore.url);
    u.searchParams.set('from', from.toISOString());
    u.searchParams.set('to', to.toISOString());
    u.searchParams.delete('page');
    goto(u.pathname + u.search, { keepFocus: true, replaceState: true });
  }

  function changePage(p: number) {
    const u = new URL($pageStore.url);
    u.searchParams.set('page', String(p));
    goto(u.pathname + u.search, { keepFocus: false });
  }

  function clearAll() {
    goto('/audit', { keepFocus: false });
  }

  const actions = [
    'vm.create', 'vm.update', 'vm.delete', 'vm.tag.add', 'vm.tag.remove',
    'vm.tag.update', 'vm.notes.update', 'vm.power.start', 'vm.power.stop',
    'vm.power.reboot', 'quota.update', 'auth.login', 'auth.logout',
    'auth.password.change', 'auth.pat.mint', 'auth.pat.revoke',
    'auth.ssh-key.add', 'auth.ssh-key.remove', 'auth.session.revoke',
    'team.create', 'team.update', 'team.delete',
    'user.create', 'user.update', 'user.delete',
    'cluster.create', 'cluster.update', 'cluster.delete',
  ];
  const targetTypes = ['vm', 'lxc', 'user', 'team', 'cluster', 'quota'];

  const activeFilters = $derived(
    Object.entries({
      from: filters.from,
      to: filters.to,
      action: filters.action?.join(',') || undefined,
      type: filters.target_type?.join(',') || undefined,
      cluster_id: filters.cluster_id != null ? String(filters.cluster_id) : undefined,
      vmid: filters.vmid != null ? String(filters.vmid) : undefined,
      show_team_actions: filters.show_team_actions ? 'on' : undefined,
      user_id: filters.user_id != null ? String(filters.user_id) : undefined,
    }).filter(([, v]) => v !== undefined) as Array<[string, string]>
  );
</script>

<header class="mb-6">
  <h1 class="text-[28px] font-semibold tracking-tight">Audit log</h1>
  <p class="text-muted-foreground text-sm mt-1">Every privileged action recorded by the GUI.</p>
</header>

<div class="sticky top-14 bg-background border-b border-border py-4 -mx-6 px-6 mb-6 flex flex-col gap-3 z-10">
  <!-- Filter row -->
  <div class="flex flex-wrap items-center gap-3">
    <!-- Date range -->
    <Popover.Root>
      <Popover.Trigger>
        {#snippet child({ props })}
          <Button variant="outline" {...props}>Date range ▾</Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content class="p-4 w-[260px]">
        <div class="flex flex-col gap-2">
          <Button variant="ghost" size="sm" onclick={() => setRangePreset(1)}>Last 24 hours</Button>
          <Button variant="ghost" size="sm" onclick={() => setRangePreset(7)}>Last 7 days</Button>
          <Button variant="ghost" size="sm" onclick={() => setRangePreset(30)}>Last 30 days</Button>
          <div class="flex flex-col gap-1 mt-2">
            <Label>From</Label>
            <Input
              type="date"
              value={(filters.from ?? '').slice(0, 10)}
              oninput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                if (v) setParam('from', new Date(v).toISOString());
              }}
            />
            <Label class="mt-1">To</Label>
            <Input
              type="date"
              value={(filters.to ?? '').slice(0, 10)}
              oninput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                if (v) setParam('to', new Date(v).toISOString());
              }}
            />
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>

    <!-- Action dropdown -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="outline" {...props}>Action ▾</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="max-h-80 overflow-y-auto">
        {#each actions as a (a)}
          <DropdownMenu.Item onclick={() => setParam('action', a)}>{a}</DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <!-- Resource type dropdown -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="outline" {...props}>Type ▾</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {#each targetTypes as t (t)}
          <DropdownMenu.Item onclick={() => setParam('type', t)}>{t}</DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <!-- Show team actions toggle — non-admin only -->
    {#if !isAdmin}
      <label class="flex items-center gap-2 text-[14px]">
        <Switch
          checked={filters.show_team_actions ?? false}
          onCheckedChange={(v) => setParam('show_team_actions', v ? '1' : null)}
        />
        <span title="Include actions other team members took on resources you can see.">
          Show team actions
        </span>
      </label>
    {/if}
  </div>

  <!-- Active filter chips -->
  {#if activeFilters.length > 0}
    <div class="flex flex-wrap items-center gap-2">
      {#each activeFilters as [k, v] (k)}
        <FilterChip label={`${k}: ${v}`} onRemove={() => setParam(k === 'type' ? 'type' : k, null)} />
      {/each}
      <button
        type="button"
        class="text-[13px] text-primary underline-offset-4 hover:underline"
        onclick={clearAll}
      >Clear all</button>
    </div>
  {/if}

  <!-- Toolbar: count + export -->
  <div class="flex items-center justify-between">
    <span class="text-[14px] text-muted-foreground">Showing {data.page.total} entries</span>
    <CsvExportButton total={data.page.total} {filters} />
  </div>
</div>

<AuditTable
  rows={data.page.rows}
  total={data.page.total}
  page={data.page.page}
  pageSize={data.page.page_size}
  onPageChange={changePage}
  error={data.loadError ? "Couldn't load audit log." : null}
/>
