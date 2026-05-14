<script lang="ts">
  import * as Table from '$lib/components/ui/table';
  import * as Card from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import type { AuditEntry } from '$lib/api/types';

  type Props = {
    rows: AuditEntry[];
    total: number;
    page: number;
    pageSize: number;
    onPageChange?: (page: number) => void;
    lockedFilters?: { cluster_id?: number; vmid?: number };
    error?: string | null;
    loading?: boolean;
  };
  let { rows, total, page, pageSize,
        onPageChange, error = null, loading = false }: Props = $props();

  const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));

  let expanded = $state<Record<number, boolean>>({});
  function toggle(id: number) { expanded = { ...expanded, [id]: !expanded[id] }; }

  function actionBadge(action: string): string {
    if (action.startsWith('vm.create') || action.startsWith('team.create')
        || action.startsWith('user.create') || action.startsWith('cluster.create'))
      return 'bg-success/10 border-success/30 text-success';
    if (action.startsWith('vm.delete') || action.startsWith('team.delete')
        || action.startsWith('user.delete') || action.startsWith('cluster.delete'))
      return 'bg-destructive/10 border-destructive/30 text-destructive';
    if (action.startsWith('vm.power.'))
      return 'bg-warning/10 border-warning/30 text-warning';
    if (action.startsWith('auth.'))
      return 'bg-primary/10 border-primary/30 text-primary';
    return 'bg-muted border-border text-foreground';
  }

  function tryParse(s: string | null): unknown {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return s; }
  }
</script>

{#if loading}
  <div class="space-y-2">
    {#each Array(5) as _, i (i)}
      <div class="h-11 bg-muted animate-pulse rounded"></div>
    {/each}
  </div>
{:else if error}
  <div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center">
    <p class="text-sm font-medium">{error}</p>
  </div>
{:else if rows.length === 0}
  <div class="border-border bg-muted/30 rounded-md border border-dashed px-6 py-10 text-center">
    <p class="text-sm font-medium">No audit entries match the current filters.</p>
  </div>
{:else}
  <div class="rounded-md border border-border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="text-[13px] font-medium">Time</Table.Head>
          <Table.Head class="text-[13px] font-medium">Actor</Table.Head>
          <Table.Head class="text-[13px] font-medium">Action</Table.Head>
          <Table.Head class="text-[13px] font-medium">Target</Table.Head>
          <Table.Head class="text-[13px] font-medium">Result</Table.Head>
          <Table.Head class="text-[13px] font-medium">IP</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each rows as r (r.id)}
          <Table.Row
            class="min-h-11 hover:bg-muted/50 cursor-pointer"
            onclick={() => toggle(r.id)}
            aria-expanded={!!expanded[r.id]}
          >
            <Table.Cell class="font-mono text-[13px]" style="font-variant-numeric: tabular-nums;">{r.occurred_at}</Table.Cell>
            <Table.Cell class="text-[14px]">{r.actor_username ?? (r.actor_pat_prefix ? `pat:${r.actor_pat_prefix}` : 'system')}</Table.Cell>
            <Table.Cell>
              <Badge variant="outline" class={actionBadge(r.action)}>{r.action}</Badge>
            </Table.Cell>
            <Table.Cell
              class="font-mono text-[13px] truncate max-w-[200px]"
              title="{r.target_type}/{r.target_id ?? '-'}"
            >{r.target_type}/{r.target_id ?? '-'}</Table.Cell>
            <Table.Cell>
              <span class={r.result === 'success' ? 'text-success' : 'text-destructive'}>{r.result}</span>
            </Table.Cell>
            <Table.Cell class="font-mono text-[13px] text-muted-foreground">{r.source_ip ?? '-'}</Table.Cell>
          </Table.Row>
          {#if expanded[r.id]}
            <Table.Row class="bg-muted/40 border-l-2 border-l-primary">
              <Table.Cell colspan={6}>
                <div class="grid grid-cols-2 gap-4 p-4">
                  <Card.Root class="p-4">
                    <h4 class="text-[13px] font-medium mb-2">Before</h4>
                    <pre class="font-mono text-[13px] whitespace-pre-wrap text-foreground">{JSON.stringify(tryParse(r.payload_before), null, 2)}</pre>
                  </Card.Root>
                  <Card.Root class="p-4">
                    <h4 class="text-[13px] font-medium mb-2">After</h4>
                    <pre class="font-mono text-[13px] whitespace-pre-wrap text-foreground">{JSON.stringify(tryParse(r.payload_after), null, 2)}</pre>
                  </Card.Root>
                </div>
                {#if r.error}
                  <div class="p-4 border-t border-border text-[13px] text-destructive font-mono">Error: {r.error}</div>
                {/if}
              </Table.Cell>
            </Table.Row>
          {/if}
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <div class="flex items-center justify-between mt-3 text-[13px] text-muted-foreground">
    <span>Page {page} of {pages} ({total} total)</span>
    <div class="flex gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onclick={() => onPageChange?.(page - 1)}>Prev</Button>
      <Button variant="outline" size="sm" disabled={page >= pages} onclick={() => onPageChange?.(page + 1)}>Next</Button>
    </div>
  </div>
{/if}
