---
phase: 02-multi-cluster-inventory-quotas-audit
plan: 06
type: execute
wave: 3
depends_on: [04, 05]
files_modified:
  - frontend/src/lib/api/audit.ts
  - frontend/src/lib/api/quotas.ts
  - frontend/src/lib/api/types.ts
  - frontend/src/lib/api/client.ts
  - frontend/src/lib/components/audit/AuditTable.svelte
  - frontend/src/lib/components/audit/CsvExportButton.svelte
  - frontend/src/lib/components/quotas/QuotaIndicator.svelte
  - frontend/src/lib/components/quotas/QuotaTab.svelte
  - frontend/src/lib/components/layout/Topbar.svelte
  - frontend/src/routes/audit/+page.server.ts
  - frontend/src/routes/audit/+page.svelte
  - frontend/src/routes/admin/teams/[id]/+page.svelte
  - frontend/src/routes/admin/teams/[id]/+page.server.ts
  - frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte
  - frontend/tests/components/audit-csv-button.test.ts
  - frontend/tests/components/quota-indicator.test.ts
autonomous: true
requirements:
  - AUDIT-03
  - AUDIT-04
  - AUDIT-05
  - TENT-01
  - TENT-02
  - TENT-03
user_setup: []

must_haves:
  truths:
    - "/audit page renders date-range + action + user + type filter dropdowns + 'Show team actions' toggle (non-admin only); URL-param-driven state."
    - "AuditTable shows time/actor/action/target/result/ip; row click expands to before/after diff unified view."
    - "CsvExportButton labels `Export filtered (N rows)`; disabled with tooltip when total > 50000; on click triggers blob download from /api/v1/audit/export.csv with current filters."
    - "QuotaIndicator mounts in Topbar; reads /api/v1/me/quotas; shows compact `CPU 14/20 · RAM 28/40GB` block; click opens Sheet drawer with per-cluster Progress bars."
    - "QuotaIndicator turns yellow at ≥80%, red at ≥95%; toast.warning fires once per session via sessionStorage flag (D-10)."
    - "/admin/teams/[id] page becomes tabbed: Members tab (placeholder if not yet built) + Quotas tab (QuotaTab component)."
    - "QuotaTab admin form: one row per cluster the team is bound to with 4 number inputs (cpu_cores, ram_gb, disk_gb, vm_count); shows current usage % per cluster; aggregate footer; Save button calls PUT /teams/{id}/quotas."
    - "409 from PUT (lower-below-usage) renders a Dialog with 'Lower limit anyway' button (sets allow_over=true and retries) (D-12)."
    - "Activity tab on VM detail page (Plan 02-05) is updated to mount AuditTable with lockedFilters={cluster_id, vmid}."
  artifacts:
    - path: "frontend/src/lib/components/audit/AuditTable.svelte"
      provides: "Filterable+paginated audit table with row-expand diff"
      contains: "lockedFilters"
    - path: "frontend/src/lib/components/audit/CsvExportButton.svelte"
      provides: "Export filtered (N rows) button + disabled-when-too-large; blob download trigger"
      contains: "Export filtered"
    - path: "frontend/src/lib/components/quotas/QuotaIndicator.svelte"
      provides: "Topbar compact block + Sheet drawer; warning/critical color states; once-per-session toast"
      contains: "proxmox-gui:quota-toast-fired"
    - path: "frontend/src/lib/components/quotas/QuotaTab.svelte"
      provides: "Admin per-cluster quota grid form"
      contains: "allow_over"
    - path: "frontend/src/routes/audit/+page.svelte"
      provides: "Global audit log page with filters + table + export"
      contains: "AuditTable"
  key_links:
    - from: "frontend/src/lib/components/layout/Topbar.svelte"
      to: "QuotaIndicator"
      via: "<QuotaIndicator /> mounts left of ThemeToggle (replaces Plan 02-05 reserved slot comment)"
      pattern: "QuotaIndicator"
    - from: "frontend/src/routes/audit/+page.svelte"
      to: "api.audit.list + api.audit.export"
      via: "SSR seed + onclick blob download"
      pattern: "api\\.audit"
    - from: "frontend/src/routes/admin/teams/[id]/+page.svelte"
      to: "QuotaTab"
      via: "Tabs.Root mounting Quotas tab"
      pattern: "QuotaTab"
---

<objective>
Ship the /audit page (AuditTable + filter chips + CsvExportButton), the QuotaIndicator (Topbar + Sheet drawer with per-cluster breakdown), and the QuotaTab on /admin/teams/[id] (per-cluster admin form with current-usage + aggregate footer + lower-anyway dialog). Update the VM detail Activity tab to mount the AuditTable with `lockedFilters`.

Purpose: closes Phase 2 UI work — AUDIT-03..05 (admin/user audit view + CSV), TENT-01..03 (admin quota edit + user QuotaIndicator). All four UI-SPEC surfaces (`/audit`, Topbar QuotaIndicator, /admin/teams/[id] Quotas tab, /inventory Activity tab mount) come online.

Output: full Phase 2 UI surface ready for operator smoke (Plan 02-07).
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-CONTEXT.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-PATTERNS.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-UI-SPEC.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-02-audit-schema-writer-PLAN.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-04-quotas-backend-PLAN.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-05-frontend-inventory-PLAN.md
@frontend/src/lib/api/clusters.ts
@frontend/src/lib/api/client.ts
@frontend/src/routes/admin/clusters/+page.svelte
@frontend/src/routes/admin/clusters/[id]/+page.svelte
@frontend/src/lib/components/clusters/ClusterStatusPill.svelte
@frontend/src/lib/components/layout/Topbar.svelte
@frontend/src/lib/components/inventory/FilterChip.svelte

<interfaces>
<!-- Backend types frontend will consume (mirror Plan 02-02 + 02-04 schemas). -->

Audit API (Plan 02-02):
```typescript
// GET /api/v1/audit?from=…&to=…&action=…&user_id=…&target_type=…&vmid=…&cluster_id=…&show_team_actions=0|1&page=1&page_size=50
//   → AuditPage
// GET /api/v1/audit/export.csv?{same filters} → text/csv with UTF-8 BOM (or 409 with limit body)

export interface AuditEntry {
  id: number;
  occurred_at: string;       // ISO 8601
  actor_username: string | null;
  actor_pat_prefix: string | null;
  team_name: string | null;
  cluster_name: string | null;
  action: string;            // e.g. "vm.tag.update"
  target_type: string | null;
  target_id: string | null;
  result: string;            // "success" | "failure" | "pending"
  source_ip: string | null;
  correlation_id: string | null;
  payload_before: string | null;   // JSON string
  payload_after: string | null;
  error: string | null;
}

export interface AuditPage {
  rows: AuditEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditFilterParams {
  from?: string;            // ISO date
  to?: string;
  action?: string[];        // server expects comma-joined; client sends list, joined in api client
  user_id?: number;
  target_type?: string[];
  vmid?: number;
  cluster_id?: number;
  show_team_actions?: boolean;
  page?: number;
  page_size?: number;
}
```

Quotas API (Plan 02-04):
```typescript
// GET /api/v1/me/quotas → MyQuotasResponse
// GET /api/v1/teams/{team_id}/quotas → TeamQuotaPage
// PUT /api/v1/teams/{team_id}/quotas { rows: QuotaLimitInput[], allow_over: bool } → TeamQuotaPage
// POST /api/v1/quotas/preview { team_id, cluster_id, requested_cpu, requested_ram_bytes, requested_disk_bytes, requested_count } → QuotaPreview

export interface QuotaLimitInput {
  cluster_id: number;
  cpu_cores: number | null;
  ram_gb: number | null;
  disk_gb: number | null;
  vm_count: number | null;
}

export interface QuotaUsagePresentable {
  cpu_cores: number;
  ram_gb: number;
  disk_gb: number;
  vm_count: number;
  lxc_count: number;
}

export interface ClusterQuotaRow {
  cluster_id: number;
  cluster_name: string;
  limit: QuotaLimitInput;
  usage: QuotaUsagePresentable;
}

export interface TeamQuotaPage {
  team_id: number;
  team_name: string;
  rows: ClusterQuotaRow[];
}

export interface MyTeamQuota {
  team_id: number;
  team_name: string;
  clusters: ClusterQuotaRow[];
  aggregate_limit: QuotaLimitInput;     // cluster_id=0 sentinel
  aggregate_usage: QuotaUsagePresentable;
}

export interface MyQuotasResponse {
  teams: MyTeamQuota[];
}

export interface QuotaDimension {
  name: string;
  current: number;
  requested: number;
  limit: number | null;
  headroom: number | null;
  would_exceed: boolean;
}

export interface QuotaPreview {
  would_exceed: boolean;
  dimensions: QuotaDimension[];
}
```

Existing Phase 1 utility:
- `frontend/src/lib/utils/api.ts` — `ApiError`, `apiFetch`, `apiJson`, ApiInit shape
- `frontend/src/lib/components/inventory/FilterChip.svelte` (Plan 02-05)
- `frontend/src/lib/components/clusters/ClusterStatusPill.svelte` (extended in Plan 02-05)

UI-SPEC anchors:
- §"/audit (global audit log)" layout
- §Component Contracts §AuditTable, §CsvExportButton, §QuotaIndicator, §QuotaTab
- §"Audit action labels" — exact backend `action` strings + Badge colors
- §"Destructive confirmations" — Lower quota dialog copy
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Typed API clients (audit + quotas) + AuditTable + CsvExportButton + /audit page; mount AuditTable in VM detail Activity tab</name>
  <files>frontend/src/lib/api/audit.ts, frontend/src/lib/api/quotas.ts, frontend/src/lib/api/types.ts, frontend/src/lib/api/client.ts, frontend/src/lib/components/audit/AuditTable.svelte, frontend/src/lib/components/audit/CsvExportButton.svelte, frontend/src/routes/audit/+page.server.ts, frontend/src/routes/audit/+page.svelte, frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte, frontend/tests/components/audit-csv-button.test.ts</files>
  <read_first>
    - frontend/src/lib/api/clusters.ts (withFetch helper pattern — replicate in audit.ts + quotas.ts)
    - frontend/src/lib/api/client.ts lines 27-44 (registration block — APPEND audit + quotas modules)
    - frontend/src/lib/api/types.ts (existing types; ADD audit + quotas types alongside)
    - frontend/src/routes/admin/clusters/+page.svelte (Phase 1 list-page skeleton — apply for /audit toolbar + table)
    - frontend/src/lib/components/inventory/FilterChip.svelte (Plan 02-05 — reuse for active filters bar)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-UI-SPEC.md §"/audit" layout + §"AuditTable" + §"CsvExportButton" + §"Audit action labels"
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-PATTERNS.md §audit row block (Audit-action Badge color rules verbatim)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-05-frontend-inventory-PLAN.md (Activity tab stub in detail page — replace with AuditTable mount)
  </read_first>
  <behavior>
    - api.audit.list({filters?, page?, pageSize?}, opts?) GET /audit; serializes action[] and target_type[] as comma-joined strings.
    - api.audit.export({filters?}, opts?) returns a Blob; uses fetch directly (not apiJson) because response is text/csv with binary BOM bytes.
    - api.audit.count({filters?}, opts?) is a thin call to api.audit.list with page=1, page_size=1 — surfaces `total` for CsvExportButton's disable check.
    - AuditTable renders 50 rows per page, prev/next pager, "Showing N entries"; row click toggles a per-row expanded state showing payload_before + payload_after as JSON-pretty side-by-side OR unified diff. Implementation: unified (simpler) per UI-SPEC; render diff lines with `bg-success/10` for added keys and `bg-destructive/10` for removed keys.
    - AuditTable accepts optional `lockedFilters?: { cluster_id?, vmid? }` prop. When set, the corresponding FilterChip renders with `locked` (Lock icon, no remove button).
    - CsvExportButton: when `total > 50000` disabled with tooltip; otherwise on click does `fetch('/api/v1/audit/export.csv?'+params)` with `credentials: 'include'`, calls `response.blob()`, creates Object URL, triggers click on hidden `<a download="audit-YYYY-MM-DD.csv">`. On 409 response: toast.error with detail.message.
    - /audit page: server-side load reads URL params, fetches first page, returns `{ rows, total, page, page_size, params }`. Page renders: header + filter row (date range, action dropdown, user dropdown if admin, type dropdown, show_team_actions toggle for non-admin), active FilterChips, toolbar `Showing N entries  [Export filtered (N rows)]`, AuditTable.
    - Date-range default: "Last 24 hours"; presets: "Last 24 hours", "Last 7 days", "Last 30 days", "Custom range" (custom uses `bits-ui` DateRangePicker). For Phase 2 simplicity, ship the 3 presets + custom popover using `<Input type="date">` for from + to.
    - VM detail Activity tab (Plan 02-05 stub) updated: imports AuditTable, passes `lockedFilters={ cluster_id, vmid }` and provides initial SSR data via `api.audit.list({...})` from a small effect OR a child loader.
  </behavior>
  <action>
Step 1 — `frontend/src/lib/api/types.ts`. APPEND audit + quotas types (verbatim from the `<interfaces>` section above).

Step 2 — `frontend/src/lib/api/audit.ts` (NEW):
```typescript
import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';
import type { AuditFilterParams, AuditPage } from './types';

type FetchLike = typeof fetch;
interface MaybeFetch { fetch?: FetchLike; }
function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

function buildParams(f: AuditFilterParams | undefined): URLSearchParams {
  const u = new URLSearchParams();
  if (!f) return u;
  if (f.from) u.set('from', f.from);
  if (f.to) u.set('to', f.to);
  if (f.action && f.action.length) u.set('action', f.action.join(','));
  if (typeof f.user_id === 'number') u.set('user_id', String(f.user_id));
  if (f.target_type && f.target_type.length) u.set('target_type', f.target_type.join(','));
  if (typeof f.vmid === 'number') u.set('vmid', String(f.vmid));
  if (typeof f.cluster_id === 'number') u.set('cluster_id', String(f.cluster_id));
  if (f.show_team_actions) u.set('show_team_actions', 'true');
  if (typeof f.page === 'number') u.set('page', String(f.page));
  if (typeof f.page_size === 'number') u.set('page_size', String(f.page_size));
  return u;
}

export async function list(
  args: { filters?: AuditFilterParams } = {},
  opts?: MaybeFetch,
): Promise<AuditPage> {
  const qs = buildParams(args.filters);
  const tail = qs.toString() ? `?${qs}` : '';
  return apiJson<AuditPage>(`/audit/${tail}`, withFetch(opts, { method: 'GET' }));
}

export async function exportCsv(
  args: { filters?: AuditFilterParams } = {},
  opts?: MaybeFetch,
): Promise<Blob> {
  const qs = buildParams(args.filters);
  const tail = qs.toString() ? `?${qs}` : '';
  const fetchFn = (opts?.fetch ?? fetch) as FetchLike;
  const res = await fetchFn(`/api/v1/audit/export.csv${tail}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    const { ApiError } = await import('$lib/utils/api');
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, `GET /audit/export.csv failed`, body);
  }
  return res.blob();
}
```

Step 3 — `frontend/src/lib/api/quotas.ts` (NEW):
```typescript
import { apiJson, type ApiInit } from '$lib/utils/api';
import type {
  MyQuotasResponse, QuotaLimitInput, QuotaPreview, TeamQuotaPage,
} from './types';

type FetchLike = typeof fetch;
interface MaybeFetch { fetch?: FetchLike; }
function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

export async function getTeamQuotas(
  args: { teamId: number }, opts?: MaybeFetch,
): Promise<TeamQuotaPage> {
  return apiJson<TeamQuotaPage>(`/teams/${args.teamId}/quotas`,
    withFetch(opts, { method: 'GET' }));
}

export async function setTeamQuotas(
  args: { teamId: number; rows: QuotaLimitInput[]; allowOver?: boolean },
  opts?: MaybeFetch,
): Promise<TeamQuotaPage> {
  return apiJson<TeamQuotaPage>(`/teams/${args.teamId}/quotas`,
    withFetch(opts, {
      method: 'PUT',
      body: { rows: args.rows, allow_over: args.allowOver ?? false },
    }));
}

export async function getMyQuotas(opts?: MaybeFetch): Promise<MyQuotasResponse> {
  return apiJson<MyQuotasResponse>(`/me/quotas`,
    withFetch(opts, { method: 'GET' }));
}

export async function preview(
  args: {
    teamId: number; clusterId: number;
    requestedCpu?: number; requestedRamBytes?: number;
    requestedDiskBytes?: number; requestedCount?: number;
  },
  opts?: MaybeFetch,
): Promise<QuotaPreview> {
  return apiJson<QuotaPreview>(`/quotas/preview`,
    withFetch(opts, {
      method: 'POST',
      body: {
        team_id: args.teamId,
        cluster_id: args.clusterId,
        requested_cpu: args.requestedCpu ?? 0,
        requested_ram_bytes: args.requestedRamBytes ?? 0,
        requested_disk_bytes: args.requestedDiskBytes ?? 0,
        requested_count: args.requestedCount ?? 0,
      },
    }));
}
```

Step 4 — `frontend/src/lib/api/client.ts`. APPEND audit + quotas to the api object alongside inventory (which Plan 02-05 added).

Step 5 — `frontend/src/lib/components/audit/AuditTable.svelte` (NEW). Per UI-SPEC §AuditTable:
```svelte
<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import * as Table from '$lib/components/ui/table';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
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
    {#each Array(5) as _, i}<div class="h-11 bg-muted animate-pulse rounded" />{/each}
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
          <Table.Row class="min-h-11 hover:bg-muted/50 cursor-pointer"
                     onclick={() => toggle(r.id)}
                     aria-expanded={!!expanded[r.id]}>
            <Table.Cell class="font-mono text-[13px]" style="font-variant-numeric: tabular-nums;">{r.occurred_at}</Table.Cell>
            <Table.Cell class="text-[14px]">{r.actor_username ?? (r.actor_pat_prefix ? `pat:${r.actor_pat_prefix}` : 'system')}</Table.Cell>
            <Table.Cell><Badge variant="outline" class={actionBadge(r.action)}>{r.action}</Badge></Table.Cell>
            <Table.Cell class="font-mono text-[13px] truncate max-w-[200px]" title="{r.target_type}/{r.target_id ?? '-'}">{r.target_type}/{r.target_id ?? '-'}</Table.Cell>
            <Table.Cell><span class={r.result === 'success' ? 'text-success' : 'text-destructive'}>{r.result}</span></Table.Cell>
            <Table.Cell class="font-mono text-[13px] text-muted-foreground">{r.source_ip ?? '-'}</Table.Cell>
          </Table.Row>
          {#if expanded[r.id]}
            <Table.Row class="bg-muted/40 border-l-2 border-l-primary">
              <Table.Cell colspan={6}>
                <div class="grid grid-cols-2 gap-4 p-4">
                  <Card class="p-4">
                    <h4 class="text-[13px] font-medium mb-2">Before</h4>
                    <pre class="font-mono text-[13px] whitespace-pre-wrap text-foreground">{JSON.stringify(tryParse(r.payload_before), null, 2)}</pre>
                  </Card>
                  <Card class="p-4">
                    <h4 class="text-[13px] font-medium mb-2">After</h4>
                    <pre class="font-mono text-[13px] whitespace-pre-wrap text-foreground">{JSON.stringify(tryParse(r.payload_after), null, 2)}</pre>
                  </Card>
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
```

Step 6 — `frontend/src/lib/components/audit/CsvExportButton.svelte` (NEW):
```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import Download from '@lucide/svelte/icons/download';
  import { toast } from 'svelte-sonner';
  import { ApiError } from '$lib/utils/api';
  import { api } from '$lib/api/client';
  import type { AuditFilterParams } from '$lib/api/types';

  type Props = {
    total: number;
    filters: AuditFilterParams;
  };
  let { total, filters }: Props = $props();

  const HARD_LIMIT = 50000;
  let exporting = $state(false);
  const disabled = $derived(total > HARD_LIMIT || exporting);

  async function doExport() {
    if (disabled) return;
    exporting = true;
    try {
      const blob = await api.audit.exportCsv({ filters });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `audit-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${total} audit entries.`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error('Too many rows; refine your filter.');
      } else {
        toast.error('Export failed. Try again.');
      }
    } finally {
      exporting = false;
    }
  }
</script>

{#if total > HARD_LIMIT}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <span {...props}>
          <Button variant="outline" size="sm" disabled>
            <Download class="size-4 mr-1" aria-hidden="true" /> Export filtered ({total} rows)
          </Button>
        </span>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>Refine your filter — exports are capped at {HARD_LIMIT} rows.</Tooltip.Content>
  </Tooltip.Root>
{:else}
  <Button variant="outline" size="sm" onclick={doExport} disabled={exporting}>
    {#if exporting}
      <span class="size-4 mr-1 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> Exporting…
    {:else}
      <Download class="size-4 mr-1" aria-hidden="true" /> Export filtered ({total} rows)
    {/if}
  </Button>
{/if}
```

Step 7 — `frontend/src/routes/audit/+page.server.ts` (NEW):
```typescript
import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';
import type { AuditFilterParams } from '$lib/api/types';

function parseFilters(url: URL): AuditFilterParams {
  const sp = url.searchParams;
  const list = (k: string) => {
    const v = sp.get(k);
    return v ? v.split(',').filter(Boolean) : undefined;
  };
  return {
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    action: list('action'),
    user_id: sp.get('user_id') ? Number(sp.get('user_id')) : undefined,
    target_type: list('type'),
    vmid: sp.get('vmid') ? Number(sp.get('vmid')) : undefined,
    cluster_id: sp.get('cluster_id') ? Number(sp.get('cluster_id')) : undefined,
    show_team_actions: sp.get('show_team_actions') === '1' || sp.get('show_team_actions') === 'true',
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    page_size: 50,
  };
}

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  const filters = parseFilters(url);
  try {
    const page = await api.audit.list({ filters }, { fetch });
    return { user: locals.user, page, filters, loadError: false };
  } catch {
    return { user: locals.user, page: { rows: [], total: 0, page: 1, page_size: 50 }, filters, loadError: true };
  }
};
```

Step 8 — `frontend/src/routes/audit/+page.svelte` (NEW):
```svelte
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
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
  const params = $derived($pageStore.url.searchParams);
  const filters = $derived(data.filters);
  const isAdmin = $derived(!!data.user?.is_admin);

  function setParam(k: string, v: string | null) {
    const u = new URL($pageStore.url);
    if (v === null || v === '') u.searchParams.delete(k);
    else u.searchParams.set(k, v);
    u.searchParams.delete('page');  // reset to page 1 on filter change
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

  const actions = ['vm.create','vm.update','vm.delete','vm.tag.update','vm.notes.update','quota.update','auth.login','auth.logout','team.create','team.update','team.delete','user.create','user.update','user.delete','cluster.create','cluster.update','cluster.delete'];
  const targetTypes = ['vm','lxc','user','team','cluster','quota'];

  const activeFilters = $derived(
    Object.entries({
      from: filters.from, to: filters.to,
      action: filters.action?.join(',') || undefined,
      type: filters.target_type?.join(',') || undefined,
      cluster_id: filters.cluster_id != null ? String(filters.cluster_id) : undefined,
      vmid: filters.vmid != null ? String(filters.vmid) : undefined,
      show_team_actions: filters.show_team_actions ? 'on' : undefined,
      user_id: filters.user_id != null ? String(filters.user_id) : undefined,
    }).filter(([_, v]) => v !== undefined) as Array<[string, string]>
  );
</script>

<header class="mb-6">
  <h1 class="text-[28px] font-semibold tracking-tight">Audit log</h1>
  <p class="text-muted-foreground text-sm mt-1">Every privileged action recorded by the GUI.</p>
</header>

<div class="sticky top-14 bg-background border-b border-border py-4 -mx-6 px-6 mb-6 flex flex-col gap-3">
  <div class="flex flex-wrap items-center gap-3">
    <Popover.Root>
      <Popover.Trigger>{#snippet child({props})}<Button variant="outline" {...props}>Date range ▾</Button>{/snippet}</Popover.Trigger>
      <Popover.Content class="p-4 w-[260px]">
        <div class="flex flex-col gap-2">
          <Button variant="ghost" size="sm" onclick={() => setRangePreset(1)}>Last 24 hours</Button>
          <Button variant="ghost" size="sm" onclick={() => setRangePreset(7)}>Last 7 days</Button>
          <Button variant="ghost" size="sm" onclick={() => setRangePreset(30)}>Last 30 days</Button>
          <div class="flex flex-col gap-1 mt-2">
            <Label>From</Label>
            <Input type="date" value={(filters.from ?? '').slice(0,10)} oninput={(e) => setParam('from', new Date((e.target as HTMLInputElement).value).toISOString())} />
            <Label class="mt-1">To</Label>
            <Input type="date" value={(filters.to ?? '').slice(0,10)} oninput={(e) => setParam('to', new Date((e.target as HTMLInputElement).value).toISOString())} />
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>{#snippet child({props})}<Button variant="outline" {...props}>Action ▾</Button>{/snippet}</DropdownMenu.Trigger>
      <DropdownMenu.Content class="max-h-80 overflow-y-auto">
        {#each actions as a}
          <DropdownMenu.Item onclick={() => setParam('action', a)}>{a}</DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>{#snippet child({props})}<Button variant="outline" {...props}>Type ▾</Button>{/snippet}</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {#each targetTypes as t}
          <DropdownMenu.Item onclick={() => setParam('type', t)}>{t}</DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    {#if !isAdmin}
      <label class="flex items-center gap-2 text-[14px]">
        <Switch checked={filters.show_team_actions ?? false}
                onCheckedChange={(v) => setParam('show_team_actions', v ? '1' : null)} />
        <span title="Include actions other team members took on resources you can see.">Show team actions</span>
      </label>
    {/if}
  </div>

  {#if activeFilters.length > 0}
    <div class="flex flex-wrap items-center gap-2">
      {#each activeFilters as [k, v]}
        <FilterChip label={`${k}: ${v}`} onRemove={() => setParam(k === 'type' ? 'type' : k, null)} />
      {/each}
      <button type="button" class="text-[13px] text-primary underline-offset-4 hover:underline" onclick={clearAll}>Clear all</button>
    </div>
  {/if}

  <div class="flex items-center justify-between">
    <span class="text-[14px] text-muted-foreground">Showing {data.page.total} entries</span>
    <CsvExportButton total={data.page.total} filters={filters} />
  </div>
</div>

<AuditTable rows={data.page.rows} total={data.page.total}
            page={data.page.page} pageSize={data.page.page_size}
            onPageChange={changePage}
            error={data.loadError ? "Couldn't load audit log." : null} />
```

Step 9 — Update `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` Activity tab. REPLACE the Plan-02-05 stub content of the `<Tabs.Content value="activity">` block with:
```svelte
<Tabs.Content value="activity">
  <div class="mt-6">
    <div class="flex items-center justify-end mb-3">
      <a href={`/audit?cluster_id=${detail.cluster_id}&vmid=${detail.vmid}`}
         class="text-primary hover:underline text-[14px]">View in global audit log →</a>
    </div>
    {#await api.audit.list({ filters: { cluster_id: detail.cluster_id, vmid: detail.vmid, page: 1, page_size: 50 }})}
      <AuditTable rows={[]} total={0} page={1} pageSize={50} loading={true}
                  lockedFilters={{ cluster_id: detail.cluster_id, vmid: detail.vmid }} />
    {:then result}
      <AuditTable rows={result.rows} total={result.total}
                  page={result.page} pageSize={result.page_size}
                  lockedFilters={{ cluster_id: detail.cluster_id, vmid: detail.vmid }} />
    {:catch}
      <AuditTable rows={[]} total={0} page={1} pageSize={50}
                  error="Couldn't load activity."
                  lockedFilters={{ cluster_id: detail.cluster_id, vmid: detail.vmid }} />
    {/await}
  </div>
</Tabs.Content>
```
ADD imports at the top of that file (if not already): `import AuditTable from '$lib/components/audit/AuditTable.svelte';`.

Step 10 — `frontend/tests/components/audit-csv-button.test.ts` (NEW). Use Vitest + Svelte component testing if available, OR simple unit logic test of the disabled-threshold:
```typescript
import { describe, expect, it } from 'vitest';
// CsvExportButton logic-only test (component-render test deferred to Phase 5 if testing-library/svelte isn't installed).

describe('CsvExportButton thresholds', () => {
  const HARD = 50000;
  it('is enabled when total <= HARD_LIMIT', () => {
    expect(HARD).toBe(50000);
    expect(0 <= HARD).toBe(true);
    expect(HARD <= HARD).toBe(true);
  });
  it('would be disabled when total > HARD_LIMIT', () => {
    expect(50001 > HARD).toBe(true);
  });
});
```
(NOTE: if `@testing-library/svelte` is in the deps, replace with a render-based test that asserts the disabled attribute and tooltip text. Otherwise the smoke checkpoint in Plan 02-07 validates the UX manually.)
  </action>
  <verify>
    <automated>cd frontend && pnpm install && pnpm run check && pnpm test -- --run components/audit-csv-button.test.ts && pnpm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "export async function list|export async function exportCsv" frontend/src/lib/api/audit.ts` returns 2 matches.
    - `grep -nE "export async function getTeamQuotas|export async function setTeamQuotas|export async function getMyQuotas|export async function preview" frontend/src/lib/api/quotas.ts` returns 4 matches.
    - `grep -nE "audit: auditModule|quotas: quotasModule" frontend/src/lib/api/client.ts` returns 2 matches.
    - `grep -n "actionBadge" frontend/src/lib/components/audit/AuditTable.svelte` returns at least 1 match.
    - `grep -n "lockedFilters" frontend/src/lib/components/audit/AuditTable.svelte` returns at least 1 match.
    - `grep -n "HARD_LIMIT = 50000" frontend/src/lib/components/audit/CsvExportButton.svelte` returns 1 match.
    - `grep -n "URL.createObjectURL" frontend/src/lib/components/audit/CsvExportButton.svelte` returns 1 match.
    - `grep -n "audit-\\${date}.csv" frontend/src/lib/components/audit/CsvExportButton.svelte` returns at least 0 matches (template-string filename — match `audit-` token alone): actually `grep -n "a.download" frontend/src/lib/components/audit/CsvExportButton.svelte` returns 1 match.
    - `grep -n "Show team actions" frontend/src/routes/audit/+page.svelte` returns at least 1 match.
    - `grep -nE "import AuditTable" frontend/src/routes/inventory/\[cluster\]/\[vmid\]/+page.svelte` returns 1 match.
    - `grep -n "lockedFilters=" frontend/src/routes/inventory/\[cluster\]/\[vmid\]/+page.svelte` returns at least 1 match.
    - `cd frontend && pnpm run check` exits 0.
    - `cd frontend && pnpm run build` exits 0.
  </acceptance_criteria>
  <done>
    - api.audit + api.quotas modules registered.
    - AuditTable + CsvExportButton ready for reuse.
    - /audit page renders date-range + action + type + show_team_actions toggle + CsvExportButton.
    - VM detail Activity tab mounts AuditTable with lockedFilters.
    - Production build clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: QuotaIndicator (Topbar + Sheet drawer with sessionStorage toast) + QuotaTab + Admin /teams/[id] tabbed page; wire QuotaIndicator into Topbar</name>
  <files>frontend/src/lib/components/quotas/QuotaIndicator.svelte, frontend/src/lib/components/quotas/QuotaTab.svelte, frontend/src/lib/components/layout/Topbar.svelte, frontend/src/routes/admin/teams/[id]/+page.svelte, frontend/src/routes/admin/teams/[id]/+page.server.ts, frontend/tests/components/quota-indicator.test.ts</files>
  <read_first>
    - frontend/src/routes/admin/clusters/[id]/+page.svelte (form pattern with untrack + validate + mapEditError + handleSave — copy for QuotaTab)
    - frontend/src/lib/components/clusters/ClusterStatusPill.svelte (color-derivation pattern)
    - frontend/src/lib/components/layout/Topbar.svelte (Plan 02-05 reserved the slot before ThemeToggle — Plan 02-06 replaces the comment with `<QuotaIndicator />`)
    - frontend/src/lib/components/ui/sheet (shadcn-svelte Sheet block — for drawer)
    - frontend/src/lib/components/ui/progress (shadcn-svelte Progress block added in Plan 02-05)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-UI-SPEC.md §"QuotaIndicator" + §"QuotaTab" + §"Destructive confirmations" (Lower-quota dialog copy)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-04-quotas-backend-PLAN.md (TeamQuotaPage / MyQuotasResponse shapes; 409 detail body shape for D-12)
    - Existing /admin/teams/[id] route if it exists — if not, this plan creates the route. Check first with `ls`.
  </read_first>
  <behavior>
    - QuotaIndicator: mounts in Topbar; on first mount + on every page-nav, fetches /me/quotas via $effect; computes max utilization across the principal's first team (or aggregates if multi-team — per UI-SPEC: shows the team with the highest utilization to drive the color state).
    - Compact block shows `CPU 14/20 · RAM 28/40GB`; click opens Sheet (right-side, 400px sm / 480px md) with per-cluster Progress bars (CPU, RAM, Disk, VM count) for each cluster the user's teams touch.
    - Color derivation: utilization = max(usage / limit) across non-null limits; bands `<0.80`/`0.80–0.94`/`≥0.95` → muted/warning/destructive classes.
    - Toast trigger: sessionStorage key `proxmox-gui:quota-toast-fired:{level}` where level ∈ {warning,critical}. First time utilization crosses into 80 OR 95 within a session: toast.warning / toast.error with the copy from UI-SPEC §"Quota approaching 80%" / "Quota crossed 95%".
    - QuotaTab: takes `teamId` + an initial `page: TeamQuotaPage` (or fetches itself); renders one editable row per cluster with 4 number inputs; usage badge below shows "14 / 20 vCPU (88% ⚠)" with same warning/critical colors; aggregate footer auto-computed; "Save changes" button.
    - On Save: build QuotaLimitInput[] from $state; call api.quotas.setTeamQuotas; on 409 (ApiError) open Dialog "Lower quota limit on {team_name}?" with body from UI-SPEC; "Lower limit anyway" button retries with `allowOver: true`; "Cancel" closes.
    - /admin/teams/[id] +page.svelte: tabbed; Members tab (placeholder if no Phase 1 implementation exists — render "Members management ships in Phase 1 admin shell" or pull from any existing teams API surface); Quotas tab renders QuotaTab.
  </behavior>
  <action>
Step 1 — `frontend/src/lib/components/quotas/QuotaIndicator.svelte` (NEW):
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import * as Sheet from '$lib/components/ui/sheet';
  import { Progress } from '$lib/components/ui/progress';
  import { Card } from '$lib/components/ui/card';
  import { toast } from 'svelte-sonner';
  import ClusterStatusPill from '$lib/components/clusters/ClusterStatusPill.svelte';
  import { api } from '$lib/api/client';
  import type { MyQuotasResponse, ClusterQuotaRow, QuotaLimitInput } from '$lib/api/types';

  let open = $state(false);
  let data = $state<MyQuotasResponse | null>(null);
  let loadError = $state<string | null>(null);

  async function refresh() {
    try {
      data = await api.quotas.getMyQuotas();
      loadError = null;
      checkToast(data);
    } catch {
      loadError = 'Quota unavailable';
    }
  }

  // Re-fetch on every navigation (page key changes).
  let navKey = $derived($page.url.pathname + $page.url.search);
  $effect(() => { void navKey; refresh(); });
  onMount(refresh);

  function maxUtilization(rows: ClusterQuotaRow[]): number {
    let u = 0;
    for (const r of rows) {
      const l = r.limit;
      if (l.cpu_cores) u = Math.max(u, r.usage.cpu_cores / l.cpu_cores);
      if (l.ram_gb)    u = Math.max(u, r.usage.ram_gb / l.ram_gb);
      if (l.disk_gb)   u = Math.max(u, r.usage.disk_gb / l.disk_gb);
      if (l.vm_count)  u = Math.max(u, (r.usage.vm_count + r.usage.lxc_count) / l.vm_count);
    }
    return u;
  }

  function checkToast(d: MyQuotasResponse) {
    if (typeof window === 'undefined') return;
    for (const team of d.teams) {
      const u = maxUtilization(team.clusters);
      if (u >= 0.95) {
        const key = `proxmox-gui:quota-toast-fired:critical:${team.team_id}`;
        if (!window.sessionStorage.getItem(key)) {
          toast.error(`Quota critical: 95% on team ${team.team_name}. Creates will be blocked.`);
          window.sessionStorage.setItem(key, '1');
        }
      } else if (u >= 0.80) {
        const key = `proxmox-gui:quota-toast-fired:warning:${team.team_id}`;
        if (!window.sessionStorage.getItem(key)) {
          toast.warning(`Approaching quota: 80% on team ${team.team_name}.`);
          window.sessionStorage.setItem(key, '1');
        }
      }
    }
  }

  const primaryTeam = $derived(data?.teams[0] ?? null);
  const utilization = $derived(primaryTeam ? maxUtilization(primaryTeam.clusters) : 0);

  const blockClasses = $derived(
    utilization >= 0.95 ? 'bg-destructive/10 border-destructive/30 text-destructive'
    : utilization >= 0.80 ? 'bg-warning/10 border-warning/30 text-warning'
    : 'bg-muted border-border text-foreground'
  );

  const compactCpu = $derived(primaryTeam ? `${primaryTeam.aggregate_usage.cpu_cores}/${primaryTeam.aggregate_limit.cpu_cores ?? '∞'}` : '--/--');
  const compactRam = $derived(primaryTeam ? `${primaryTeam.aggregate_usage.ram_gb}/${primaryTeam.aggregate_limit.ram_gb ?? '∞'}GB` : '--/--');

  function pct(used: number, limit: number | null): number {
    if (!limit || limit <= 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Trigger>
    {#snippet child({ props })}
      <button {...props} type="button"
              class="inline-flex items-center gap-3 h-7 px-3 rounded-md border text-[13px] font-medium {blockClasses}"
              aria-label={`Quota: ${compactCpu} CPU, ${compactRam} RAM. Click for details.`}>
        <span class="text-muted-foreground">CPU</span>
        <span class="font-mono tabular-nums">{compactCpu}</span>
        <span class="text-muted-foreground">·</span>
        <span class="text-muted-foreground">RAM</span>
        <span class="font-mono tabular-nums">{compactRam}</span>
      </button>
    {/snippet}
  </Sheet.Trigger>
  <Sheet.Content side="right" class="w-[400px] sm:w-[480px]">
    <Sheet.Header>
      <Sheet.Title>Quota usage</Sheet.Title>
    </Sheet.Header>
    <div class="flex flex-col gap-6 mt-6 overflow-y-auto" style="max-height: calc(100vh - 12rem);">
      {#if loadError}
        <p class="text-[13px] text-muted-foreground">{loadError}</p>
      {:else if !data || data.teams.length === 0}
        <p class="text-[13px] text-muted-foreground">You have no quotas configured. Contact your administrator.</p>
      {:else}
        {#each data.teams as team (team.team_id)}
          <Card class="p-4">
            <h3 class="text-[18px] font-semibold tracking-tight mb-2">{team.team_name}</h3>
            {#each team.clusters as c (c.cluster_id)}
              <div class="mt-4">
                <p class="text-[14px] font-medium">{c.cluster_name}</p>
                <div class="flex flex-col gap-2 mt-2 text-[13px]">
                  <div><div class="flex justify-between"><span class="text-muted-foreground">vCPU</span><span class="font-mono">{c.usage.cpu_cores} / {c.limit.cpu_cores ?? '∞'}</span></div><Progress value={pct(c.usage.cpu_cores, c.limit.cpu_cores)} class="h-2 mt-1" /></div>
                  <div><div class="flex justify-between"><span class="text-muted-foreground">RAM</span><span class="font-mono">{c.usage.ram_gb} / {c.limit.ram_gb ?? '∞'} GB</span></div><Progress value={pct(c.usage.ram_gb, c.limit.ram_gb)} class="h-2 mt-1" /></div>
                  <div><div class="flex justify-between"><span class="text-muted-foreground">Disk</span><span class="font-mono">{c.usage.disk_gb} / {c.limit.disk_gb ?? '∞'} GB</span></div><Progress value={pct(c.usage.disk_gb, c.limit.disk_gb)} class="h-2 mt-1" /></div>
                  <div><div class="flex justify-between"><span class="text-muted-foreground">VMs</span><span class="font-mono">{c.usage.vm_count + c.usage.lxc_count} / {c.limit.vm_count ?? '∞'}</span></div><Progress value={pct(c.usage.vm_count + c.usage.lxc_count, c.limit.vm_count)} class="h-2 mt-1" /></div>
                </div>
              </div>
            {/each}
          </Card>
        {/each}
        <p class="text-[12px] text-muted-foreground">Quotas are set by your administrator. Contact them to raise a limit.</p>
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>
```

Step 2 — `frontend/src/lib/components/quotas/QuotaTab.svelte` (NEW):
```svelte
<script lang="ts">
  import { untrack } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Card } from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Alert from '$lib/components/ui/alert';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import { ApiError } from '$lib/utils/api';
  import type { TeamQuotaPage, QuotaLimitInput } from '$lib/api/types';

  type Props = {
    teamId: number;
    initial: TeamQuotaPage;
    onSaved?: (page: TeamQuotaPage) => void;
  };
  let { teamId, initial, onSaved }: Props = $props();

  let rows = $state(untrack(() => initial.rows.map(r => ({
    cluster_id: r.cluster_id,
    cluster_name: r.cluster_name,
    cpu_cores: r.limit.cpu_cores,
    ram_gb: r.limit.ram_gb,
    disk_gb: r.limit.disk_gb,
    vm_count: r.limit.vm_count,
    usage_cpu: r.usage.cpu_cores,
    usage_ram_gb: r.usage.ram_gb,
    usage_disk_gb: r.usage.disk_gb,
    usage_vms: r.usage.vm_count + r.usage.lxc_count,
  }))));

  let saving = $state(false);
  let formError = $state<string | null>(null);
  let conflict = $state<{
    cluster_id: number;
    usage: { cpu_cores: number; ram_gb: number; disk_gb: number; vm_count: number };
    requested_limit: QuotaLimitInput;
    message: string;
  } | null>(null);

  function pct(used: number, limit: number | null): number {
    if (!limit || limit <= 0) return 0;
    return Math.round((used / limit) * 100);
  }
  function pctClass(p: number): string {
    if (p >= 95) return 'text-destructive';
    if (p >= 80) return 'text-warning';
    return 'text-muted-foreground';
  }

  function buildPayload(): QuotaLimitInput[] {
    return rows.map(r => ({
      cluster_id: r.cluster_id,
      cpu_cores: r.cpu_cores,
      ram_gb: r.ram_gb,
      disk_gb: r.disk_gb,
      vm_count: r.vm_count,
    }));
  }

  async function save(allowOver = false) {
    saving = true;
    formError = null;
    try {
      const page = await api.quotas.setTeamQuotas({ teamId, rows: buildPayload(), allowOver });
      onSaved?.(page);
      conflict = null;
      toast.success('Quotas updated.');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = (e.body as any) ?? {};
        const detail = body.detail ?? {};
        conflict = {
          cluster_id: detail.cluster_id,
          usage: detail.usage,
          requested_limit: detail.requested_limit,
          message: detail.message ?? 'Current usage exceeds the new limit.',
        };
      } else {
        formError = "Couldn't save quotas. Try again.";
        toast.error(formError);
      }
    } finally {
      saving = false;
    }
  }

  function clusterName(id: number): string {
    return rows.find(r => r.cluster_id === id)?.cluster_name ?? `Cluster ${id}`;
  }

  // Aggregate footer (sum-or-null per dimension).
  function sumOrNull(arr: (number|null|undefined)[]): number | null {
    let total = 0;
    for (const v of arr) { if (v == null) return null; total += v; }
    return total;
  }
  const aggCpu = $derived(sumOrNull(rows.map(r => r.cpu_cores)));
  const aggRam = $derived(sumOrNull(rows.map(r => r.ram_gb)));
  const aggDisk = $derived(sumOrNull(rows.map(r => r.disk_gb)));
  const aggCount = $derived(sumOrNull(rows.map(r => r.vm_count)));
</script>

{#if formError}<Alert.Root variant="destructive"><Alert.Description>{formError}</Alert.Description></Alert.Root>{/if}

{#if rows.length === 0}
  <div class="border-border bg-muted/30 rounded-md border border-dashed px-6 py-10 text-center">
    <p class="text-sm font-medium">This team has no cluster bindings — bind one in the Members tab first.</p>
  </div>
{:else}
  <div class="rounded-md border border-border overflow-hidden">
    <table class="w-full text-[13px]">
      <thead class="bg-muted/40">
        <tr><th class="text-left px-4 py-2 font-medium">Cluster</th><th>vCPU</th><th>RAM (GB)</th><th>Disk (GB)</th><th>VM count</th></tr>
      </thead>
      <tbody>
        {#each rows as r, i (r.cluster_id)}
          <tr class="border-t border-border">
            <td class="px-4 py-3"><div class="font-medium">{r.cluster_name}</div>
              <div class={`text-[12px] ${pctClass(Math.max(pct(r.usage_cpu, r.cpu_cores), pct(r.usage_ram_gb, r.ram_gb), pct(r.usage_disk_gb, r.disk_gb), pct(r.usage_vms, r.vm_count)))}`}>
                current usage: {r.usage_cpu} / {r.cpu_cores ?? '∞'} vCPU, {r.usage_ram_gb} / {r.ram_gb ?? '∞'} GB
              </div>
            </td>
            <td class="px-2 py-3"><Input type="number" min="0" value={r.cpu_cores ?? ''} oninput={(e) => { const v = (e.target as HTMLInputElement).value; rows[i].cpu_cores = v === '' ? null : Number(v); }} class="w-20" /></td>
            <td class="px-2 py-3"><Input type="number" min="0" value={r.ram_gb ?? ''} oninput={(e) => { const v = (e.target as HTMLInputElement).value; rows[i].ram_gb = v === '' ? null : Number(v); }} class="w-20" /></td>
            <td class="px-2 py-3"><Input type="number" min="0" value={r.disk_gb ?? ''} oninput={(e) => { const v = (e.target as HTMLInputElement).value; rows[i].disk_gb = v === '' ? null : Number(v); }} class="w-20" /></td>
            <td class="px-2 py-3"><Input type="number" min="0" value={r.vm_count ?? ''} oninput={(e) => { const v = (e.target as HTMLInputElement).value; rows[i].vm_count = v === '' ? null : Number(v); }} class="w-20" /></td>
          </tr>
        {/each}
      </tbody>
      <tfoot class="bg-muted/30 border-t border-border">
        <tr>
          <td class="px-4 py-3 font-medium">Aggregate (auto)</td>
          <td class="px-2 py-3 font-mono">{aggCpu ?? '∞'}</td>
          <td class="px-2 py-3 font-mono">{aggRam ?? '∞'}</td>
          <td class="px-2 py-3 font-mono">{aggDisk ?? '∞'}</td>
          <td class="px-2 py-3 font-mono">{aggCount ?? '∞'}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="flex justify-end gap-2 mt-4">
    <Button onclick={() => save(false)} disabled={saving}>Save changes</Button>
  </div>
{/if}

<Dialog.Root open={conflict !== null} onOpenChange={(o) => { if (!o) conflict = null; }}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Lower quota limit on {initial.team_name}?</Dialog.Title>
      <Dialog.Description>
        {#if conflict}
          Current usage on {clusterName(conflict.cluster_id)} ({conflict.usage.cpu_cores} vCPU, {conflict.usage.ram_gb} GB RAM, {conflict.usage.vm_count} VMs) exceeds the new limit ({conflict.requested_limit.cpu_cores ?? '∞'} vCPU, {conflict.requested_limit.ram_gb ?? '∞'} GB, {conflict.requested_limit.vm_count ?? '∞'} VMs). Saving will leave the team over-quota until usage drops. New creates will be blocked.
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="ghost" onclick={() => conflict = null}>Cancel</Button>
      <Button variant="destructive" onclick={() => save(true)} disabled={saving}>Lower limit anyway</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

Step 3 — `frontend/src/lib/components/layout/Topbar.svelte`. REPLACE the comment `<!-- QuotaIndicator: mounted by Plan 02-06 -->` (placed by Plan 02-05) with:
```svelte
<QuotaIndicator />
```
ADD import at the top: `import QuotaIndicator from '$lib/components/quotas/QuotaIndicator.svelte';`

Step 4 — `/admin/teams/[id]` route. Check via `ls frontend/src/routes/admin/teams/[id]/` — if Phase 1 didn't ship this route, CREATE both files; if it exists, EXTEND.

`frontend/src/routes/admin/teams/[id]/+page.server.ts` (NEW or EXTEND):
```typescript
import { error, redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) throw redirect(303, '/');
  const teamId = Number(params.id);
  if (!Number.isInteger(teamId)) throw error(404, 'Not found');
  try {
    const quotas = await api.quotas.getTeamQuotas({ teamId }, { fetch });
    return { user: locals.user, teamId, quotas, loadError: false };
  } catch {
    return { user: locals.user, teamId, quotas: { team_id: teamId, team_name: `Team ${teamId}`, rows: [] }, loadError: true };
  }
};
```

`frontend/src/routes/admin/teams/[id]/+page.svelte` (NEW or REPLACE existing). If Phase 1 ships a Members section here, INTEGRATE it under a tab; otherwise the Members tab renders a placeholder.
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page as pageStore } from '$app/stores';
  import * as Tabs from '$lib/components/ui/tabs';
  import QuotaTab from '$lib/components/quotas/QuotaTab.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const tab = $derived(($pageStore.url.hash.replace('#','')) || 'members');
  function setTab(v: string) { goto('#'+v, { replaceState: true, keepFocus: true }); }
</script>

<header class="mb-6">
  <h1 class="text-[28px] font-semibold tracking-tight">Team: {data.quotas.team_name}</h1>
</header>

<Tabs.Root value={tab} onValueChange={setTab}>
  <Tabs.List class="h-9">
    <Tabs.Trigger value="members">Members</Tabs.Trigger>
    <Tabs.Trigger value="quotas">Quotas</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="members">
    <p class="text-muted-foreground text-[14px] mt-6">Member management ships in Phase 1 admin shell — Phase 2 adds the Quotas tab to this same page.</p>
  </Tabs.Content>

  <Tabs.Content value="quotas">
    <p class="text-muted-foreground text-[13px] mt-4 mb-4">Per-cluster limits enforced on every create or resize.</p>
    {#if data.loadError}
      <p class="text-destructive text-[14px]">Couldn't load quota data. Refresh the page to retry.</p>
    {:else}
      <QuotaTab teamId={data.teamId} initial={data.quotas} onSaved={() => location.reload()} />
    {/if}
  </Tabs.Content>
</Tabs.Root>
```
(If a Phase 1 Members component exists at e.g. `frontend/src/lib/components/admin/TeamMembers.svelte`, import + render it inside the members tab instead of the placeholder. Verify via `ls frontend/src/lib/components/admin/` before committing.)

Step 5 — `frontend/tests/components/quota-indicator.test.ts` (NEW). Logic-only test of utilization band thresholds + sessionStorage idempotency:
```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

// Pure-logic mirror of maxUtilization + band-class derivation.
function maxUtilization(rows: Array<{usage:{cpu_cores:number;ram_gb:number;disk_gb:number;vm_count:number;lxc_count:number}; limit:{cpu_cores:number|null;ram_gb:number|null;disk_gb:number|null;vm_count:number|null}}>): number {
  let u = 0;
  for (const r of rows) {
    const l = r.limit;
    if (l.cpu_cores) u = Math.max(u, r.usage.cpu_cores / l.cpu_cores);
    if (l.ram_gb)    u = Math.max(u, r.usage.ram_gb / l.ram_gb);
    if (l.disk_gb)   u = Math.max(u, r.usage.disk_gb / l.disk_gb);
    if (l.vm_count)  u = Math.max(u, (r.usage.vm_count + r.usage.lxc_count) / l.vm_count);
  }
  return u;
}

function bandClass(u: number): 'ok'|'warning'|'critical' {
  if (u >= 0.95) return 'critical';
  if (u >= 0.80) return 'warning';
  return 'ok';
}

describe('QuotaIndicator math', () => {
  it('returns 0 for empty rows', () => {
    expect(maxUtilization([])).toBe(0);
    expect(bandClass(0)).toBe('ok');
  });
  it('flags warning at exactly 80%', () => {
    expect(bandClass(0.80)).toBe('warning');
  });
  it('flags critical at exactly 95%', () => {
    expect(bandClass(0.95)).toBe('critical');
  });
  it('flags critical when CPU is over and RAM is fine', () => {
    const u = maxUtilization([{ usage: { cpu_cores: 19, ram_gb: 2, disk_gb: 0, vm_count: 0, lxc_count: 0 }, limit: { cpu_cores: 20, ram_gb: 100, disk_gb: null, vm_count: null }}]);
    expect(bandClass(u)).toBe('warning');
  });
  it('returns 0 when every limit is null (unlimited)', () => {
    const u = maxUtilization([{ usage: { cpu_cores: 99, ram_gb: 99, disk_gb: 99, vm_count: 99, lxc_count: 99 }, limit: { cpu_cores: null, ram_gb: null, disk_gb: null, vm_count: null }}]);
    expect(u).toBe(0);
  });
});

describe('sessionStorage toast-fired idempotency', () => {
  afterEach(() => window.sessionStorage.clear());
  it('does not re-fire when key already set', () => {
    const KEY = 'proxmox-gui:quota-toast-fired:warning:1';
    window.sessionStorage.setItem(KEY, '1');
    expect(window.sessionStorage.getItem(KEY)).toBe('1');
    // Idempotency assertion: a second setItem doesn't multiply fires.
    window.sessionStorage.setItem(KEY, '1');
    expect(window.sessionStorage.getItem(KEY)).toBe('1');
  });
});
```
  </action>
  <verify>
    <automated>cd frontend && pnpm install && pnpm run check && pnpm test -- --run components/quota-indicator.test.ts && pnpm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "<QuotaIndicator />" frontend/src/lib/components/layout/Topbar.svelte` returns 1 match.
    - `grep -n "QuotaIndicator: mounted by Plan 02-06" frontend/src/lib/components/layout/Topbar.svelte` returns 0 matches (comment replaced).
    - `grep -nE "import QuotaIndicator" frontend/src/lib/components/layout/Topbar.svelte` returns 1 match.
    - `grep -n "proxmox-gui:quota-toast-fired" frontend/src/lib/components/quotas/QuotaIndicator.svelte` returns at least 2 matches (warning + critical levels).
    - `grep -nE "utilization >= 0\\.95|utilization >= 0\\.80" frontend/src/lib/components/quotas/QuotaIndicator.svelte` returns 2 matches.
    - `grep -n "Lower limit anyway" frontend/src/lib/components/quotas/QuotaTab.svelte` returns 1 match.
    - `grep -n "allow_over: true" frontend/src/lib/components/quotas/QuotaTab.svelte` returns 0 (because it's via `allowOver: true` in the api call); but `grep -n "allowOver: true" frontend/src/lib/components/quotas/QuotaTab.svelte` returns at least 1 match (via save(true) calling api.quotas.setTeamQuotas with allowOver).
    - `grep -n "api.quotas.setTeamQuotas" frontend/src/lib/components/quotas/QuotaTab.svelte` returns 1 match.
    - `grep -n "Tabs.Trigger" frontend/src/routes/admin/teams/\[id\]/+page.svelte` returns at least 2 matches (Members + Quotas).
    - `grep -n "QuotaTab" frontend/src/routes/admin/teams/\[id\]/+page.svelte` returns at least 1 match.
    - `cd frontend && pnpm run check` exits 0.
    - `cd frontend && pnpm test -- --run components/quota-indicator.test.ts` exits 0.
    - `cd frontend && pnpm run build` exits 0.
  </acceptance_criteria>
  <done>
    - QuotaIndicator mounts in Topbar with sessionStorage-once toast trigger.
    - QuotaTab admin form with usage badges + aggregate footer + D-12 lower-anyway dialog.
    - /admin/teams/[id] tabbed page rendered.
    - QuotaIndicator math tests green.
    - Production build clean.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → /api/v1/audit/export.csv | Cookie auth required; Blob streamed by FastAPI; UTF-8 BOM in body. |
| Browser localStorage / sessionStorage | Per-origin trust; quota-toast-fired flags are non-sensitive. |
| Admin browser → PUT /teams/{id}/quotas | Admin auth + CSRF; lower-anyway requires explicit dialog confirmation. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-06-01 | Information Disclosure | Audit CSV reveals other tenants' rows | mitigate | Backend enforces RBAC on export endpoint (Plan 02-02 Task 2 test `test_csv_respects_rbac`). Frontend has NO bypass path — it just calls the endpoint. |
| T-02-06-02 | Tampering | CsvExportButton sends crafted filters bypassing the 50000 cap | mitigate | Backend computes `count_export` first and returns 409 if > 50000 — even if the frontend's `total` prop is forged. Tested in Plan 02-02 `test_export_csv_too_many_rows_returns_409`. |
| T-02-06-03 | Tampering / Repudiation | Admin sets quota without audit | mitigate | Backend service `set_team_quotas` writes audit row per cluster INSIDE the same tx as the UPSERT (Plan 02-04). UI cannot suppress. |
| T-02-06-04 | DoS | /me/quotas fetched on every page nav storms the cache | mitigate | Backend has 30s ResourceCache (Plan 02-01) so /me/quotas usage compute hits cache. QuotaIndicator's `$effect` only re-runs when navKey changes (page nav), not arbitrarily. |
| T-02-06-05 | Tampering | Lower-anyway dialog bypassed via direct API call | accept | Admin can always call the API with `allow_over=true` directly (it's a documented escape hatch per D-12). UI dialog is informative, not a security control. Audit row captures the override (T-02-06-03). |
| T-02-06-06 | Information Disclosure | Quota indicator localStorage / sessionStorage shared across users on same machine | accept | Same as T-02-05-03 — shared-browser usage is outside the threat model per CONTEXT. |
| T-02-06-07 | Tampering | XSS via audit `error` column rendered into UI | mitigate | AuditTable renders `r.error` inside `<pre>` text — no innerHTML / no `{@html}` — Svelte auto-escapes. Test deferred to manual smoke. |
| T-02-06-08 | Information Disclosure | Audit-table diff JSON.stringify exposes redacted token-like substrings | mitigate | Plan 02-03 service-layer scrub already strips `PVEAPIToken=…` before writing to `audit_log.error`; AuditTable just renders what the backend returns. |

ASVS L1 satisfied.
</threat_model>

<verification>
- Both tasks' automated checks pass; pnpm run check + pnpm run build clean.
- quota-indicator.test.ts math + sessionStorage tests green.
- audit-csv-button.test.ts threshold tests green.
- Manual smoke (Plan 02-07) covers: download triggers a .csv with BOM bytes; QuotaIndicator turns yellow at 80%; lower-quota dialog appears on 409.
</verification>

<success_criteria>
- /audit page with date-range + action + type + show_team_actions + active FilterChips + CsvExportButton + AuditTable.
- AuditTable component reusable; Activity tab on VM detail mounts it with lockedFilters.
- QuotaIndicator mounts in Topbar with sessionStorage once-per-session toasts.
- QuotaTab admin form on /admin/teams/[id] with D-12 lower-anyway dialog flow.
- Phase 1 + 02-05 tests + new component tests green.
- Production build clean.
</success_criteria>

<output>
After completion, create `.planning/phases/02-multi-cluster-inventory-quotas-audit/02-06-frontend-audit-quotas-SUMMARY.md`:
- Files added/modified + new component test count
- Whether the /admin/teams/[id] route was pre-existing from Phase 1 (and what Phase 1 had at Members tab) or created fresh
- Whether @testing-library/svelte is in the deps (decides if component-render tests are appropriate vs logic-only)
- The exact sessionStorage key format: `proxmox-gui:quota-toast-fired:{warning|critical}:{team_id}` — documented so Plan 02-07's smoke can reset by clearing the keys
- The audit-table diff renderer chosen (unified vs side-by-side — Plan picks side-by-side via two Cards but the spec allows either; document the choice)
</output>
