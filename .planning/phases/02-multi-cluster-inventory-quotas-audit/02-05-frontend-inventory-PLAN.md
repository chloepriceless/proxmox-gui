---
phase: 02-multi-cluster-inventory-quotas-audit
plan: 05
type: execute
wave: 3
depends_on: [03]
files_modified:
  - frontend/package.json
  - frontend/src/lib/api/inventory.ts
  - frontend/src/lib/api/types.ts
  - frontend/src/lib/api/client.ts
  - frontend/src/lib/utils/markdown.ts
  - frontend/src/lib/utils/cluster_context.ts
  - frontend/src/lib/utils/tag_palette.ts
  - frontend/src/lib/components/inventory/ClusterContextPicker.svelte
  - frontend/src/lib/components/inventory/ClusterSection.svelte
  - frontend/src/lib/components/inventory/FilterChip.svelte
  - frontend/src/lib/components/inventory/TagPill.svelte
  - frontend/src/lib/components/inventory/TagInput.svelte
  - frontend/src/lib/components/inventory/MarkdownNotes.svelte
  - frontend/src/lib/components/inventory/Sparkline.svelte
  - frontend/src/lib/components/clusters/ClusterStatusPill.svelte
  - frontend/src/lib/components/layout/Sidebar.svelte
  - frontend/src/lib/components/layout/Topbar.svelte
  - frontend/src/routes/inventory/+page.server.ts
  - frontend/src/routes/inventory/+page.svelte
  - frontend/src/routes/inventory/[cluster]/[vmid]/+page.server.ts
  - frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte
  - frontend/src/routes/inventory/[cluster]/[vmid]/activity/+page.svelte
  - frontend/tests/components/markdown.test.ts
  - frontend/tests/components/tag-palette.test.ts
  - frontend/tests/components/cluster-context.test.ts
autonomous: true
requirements:
  - INV-01
  - INV-02
  - INV-03
  - INV-04
  - INV-05
  - INV-06
  - INV-07
  - INV-08
  - CLUST-02
  - CLUST-03
  - CLUST-04
user_setup: []

must_haves:
  truths:
    - "/inventory renders per-cluster collapsible Sections when ≥2 clusters; flat list when exactly 1 cluster (D-01)."
    - "ClusterContextPicker mounts in Topbar, replaces Phase-1 disabled <Select>, persists selection in localStorage key 'proxmox-gui:cluster-context' (D-02), feeds the cluster=… URL FilterChip."
    - "Filter state lives in URL params (?q=…&status=…&tag=…&cluster=…&sort=…) — browser back/forward + shareable links (D-04)."
    - "Unreachable cluster: red banner + per-row `Stale` badge (D-03). ClusterStatusPill has new `stale` state."
    - "VM detail page is tabbed (Overview | Activity | Snapshots disabled | Console disabled); tab state lives in URL hash; Snapshots+Console tabs render Lock icon + disabled tooltip (UI-SPEC §Tab strip)."
    - "Overview tab: Specs card + Network card + Metrics card (4 hand-rolled SVG sparklines) + Tags card + Notes card."
    - "Tag autocomplete via shadcn-svelte Command popover; client validates [a-z0-9_-]+ (D-14); optimistic mutate via $derived(localOverride ?? data.list); rollback on error."
    - "Markdown notes via marked v15 + DOMPurify v3 with strict allow-list (UI-SPEC §MarkdownNotes); XSS unit test verifies script/iframe stripped."
    - "Activity tab reuses AuditTable (from Plan 02-06) with lockedFilters={cluster_id, vmid}."
  artifacts:
    - path: "frontend/src/routes/inventory/+page.svelte"
      provides: "Multi-cluster inventory list with FilterChips, Sections, sort dropdown"
      contains: "FilterChip"
    - path: "frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte"
      provides: "VM detail with tabbed Overview"
      contains: "Tabs.Root"
    - path: "frontend/src/lib/components/inventory/TagInput.svelte"
      provides: "Command-popover autocomplete; client regex validation; optimistic mutate"
      contains: "Command.Root"
    - path: "frontend/src/lib/components/inventory/MarkdownNotes.svelte"
      provides: "marked + DOMPurify render; edit-mode textarea; 8000-char cap"
      contains: "DOMPurify.sanitize"
    - path: "frontend/src/lib/components/inventory/Sparkline.svelte"
      provides: "Hand-rolled SVG sparkline (no chart library)"
      contains: "<svg"
    - path: "frontend/src/lib/components/inventory/ClusterContextPicker.svelte"
      provides: "Popover+Command combobox; localStorage persistence"
      contains: "proxmox-gui:cluster-context"
  key_links:
    - from: "frontend/src/lib/components/layout/Topbar.svelte"
      to: "ClusterContextPicker"
      via: "<ClusterContextPicker /> mounts left of ThemeToggle"
      pattern: "ClusterContextPicker"
    - from: "frontend/src/routes/inventory/+page.svelte"
      to: "api.inventory.listAll"
      via: "data.inventory SSR seed; $derived(localOverride ?? data.inventory)"
      pattern: "api\\.inventory"
    - from: "frontend/src/lib/utils/markdown.ts"
      to: "DOMPurify"
      via: "DOMPurify.sanitize(marked.parse(raw, {breaks:true, gfm:true}))"
      pattern: "DOMPurify\\.sanitize"
---

<objective>
Ship the entire /inventory frontend surface: list page with FilterChips + collapsible per-cluster Sections + cluster-context picker, VM/LXC detail page with tabbed Overview (Specs/Network/Metrics/Tags/Notes) + Activity tab, and the sidebar "Resources" section.

Purpose: this is the user-facing half of Phase 2 Read layer (INV-01..08, CLUST-02..04). Frontend consumes Plan 02-03 backend endpoints. Plan 02-06 ships the AuditTable component that the Activity tab reuses with `lockedFilters` prop.

Output: every UI-SPEC §Surface Inventory route for inventory exists; sidebar gets the "Resources" section; Topbar's Phase-1 placeholder is replaced with ClusterContextPicker; AppShell remains compatible with Plan 02-06's later additions.
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
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-03-inventory-backend-PLAN.md
@frontend/src/routes/admin/clusters/+page.svelte
@frontend/src/routes/admin/clusters/+page.server.ts
@frontend/src/routes/admin/clusters/[id]/+page.svelte
@frontend/src/routes/profile/+page.svelte
@frontend/src/lib/api/clusters.ts
@frontend/src/lib/api/client.ts
@frontend/src/lib/api/types.ts
@frontend/src/lib/components/clusters/ClusterStatusPill.svelte
@frontend/src/lib/components/layout/AppShell.svelte
@frontend/src/lib/components/layout/Sidebar.svelte
@frontend/src/lib/components/layout/Topbar.svelte

<interfaces>
<!-- Backend types frontend will consume (mirror Plan 02-03 schemas exactly). -->

Inventory API surface (Plan 02-03):
```typescript
// GET /api/v1/me/inventory → ClusterInventory[]
// GET /api/v1/clusters/{id}/inventory → ClusterInventory
// GET /api/v1/clusters/{id}/vms/{vmid} → VMDetail
// GET /api/v1/clusters/{id}/lxcs/{vmid} → VMDetail
// GET /api/v1/clusters/{id}/vms/{vmid}/rrd?timeframe=…&cf=… → RRDSample[]
// PUT /api/v1/clusters/{id}/vms/{vmid}/tags    body { tags: string[] }   → VMDetail
// PUT /api/v1/clusters/{id}/vms/{vmid}/notes   body { notes: string }    → VMDetail
// (LXC mirrors: /clusters/{id}/lxcs/{vmid}/{rrd,tags,notes})

export interface VMInventoryItem {
  cluster_id: number;
  vmid: number;
  name: string | null;
  type: 'qemu' | 'lxc';
  node: string;
  status: 'running' | 'stopped' | 'paused' | 'unknown' | string;
  maxcpu: number;
  maxmem: number;    // bytes
  maxdisk: number;   // bytes
  tags: string[];
  pool: string | null;
  is_stale: boolean;
}

export interface ClusterInventory {
  cluster_id: number;
  cluster_name: string;
  cluster_status: 'ok' | 'failed' | 'untested' | string;
  is_stale: boolean;
  last_error: string | null;
  items: VMInventoryItem[];
}

export interface VMDetail {
  cluster_id: number;
  vmid: number;
  name: string | null;
  type: 'qemu' | 'lxc';
  node: string;
  status: string;
  uptime: number;
  cpu: number;
  mem: number;
  maxcpu: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  netin: number;
  netout: number;
  diskread: number;
  diskwrite: number;
  tags: string[];
  description: string | null;
  raw_config: Record<string, unknown>;
}

export interface RRDSample {
  time: number;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  netin: number;
  netout: number;
  diskread: number;
  diskwrite: number;
}
```

Phase 1 patterns (from analog reads):
- frontend/src/lib/api/clusters.ts — `withFetch` helper, MaybeFetch, ApiInit pattern.
- frontend/src/lib/api/client.ts lines 27-44 — `api.X = …` registration block; APPEND inventory module.
- frontend/src/lib/components/clusters/ClusterStatusPill.svelte — typed-props pill with $derived classes. EXTEND with new `'stale'` status.
- frontend/src/routes/admin/clusters/+page.svelte — list-page skeleton (header + filter row would-be + Table + empty state).
- frontend/src/routes/profile/+page.svelte — form-pattern with $state + validate + submit + mapError.
- frontend/src/lib/components/layout/Topbar.svelte (line ~67-88) — disabled `<Select>` placeholder is the drop-in target for ClusterContextPicker; line ~91 has `<ThemeToggle />` — insert `<QuotaIndicator />` slot (mounted in Plan 02-06).
- frontend/src/lib/components/layout/Sidebar.svelte — extend with "Resources" section (UI-SPEC §Sidebar nav additions).

shadcn-svelte blocks to add via CLI (UI-SPEC §Design System):
```bash
pnpm dlx shadcn-svelte@latest add scroll-area progress popover command accordion collapsible
```

New deps (UI-SPEC §Design System):
```bash
pnpm add marked dompurify
pnpm add -D @types/dompurify
```

Allowed Lucide icons added in Phase 2 (UI-SPEC §Icon allow-list):
CirclePlay, CircleStop, CirclePause, CircleAlert, Clock, ChevronsUpDown, Tag,
Pencil, TriangleAlert, Download, Filter, Lock, ListChecks, ShieldCheck, History,
Wallet.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: New deps + shadcn blocks + typed API client + utility modules (markdown, tag palette, cluster context); extend ClusterStatusPill with `stale` state; extend Topbar/Sidebar/client.ts wiring</name>
  <files>frontend/package.json, frontend/src/lib/api/types.ts, frontend/src/lib/api/inventory.ts, frontend/src/lib/api/client.ts, frontend/src/lib/utils/markdown.ts, frontend/src/lib/utils/tag_palette.ts, frontend/src/lib/utils/cluster_context.ts, frontend/src/lib/components/clusters/ClusterStatusPill.svelte, frontend/src/lib/components/layout/Sidebar.svelte, frontend/src/lib/components/layout/Topbar.svelte, frontend/src/lib/components/inventory/ClusterContextPicker.svelte, frontend/src/lib/components/inventory/FilterChip.svelte, frontend/src/lib/components/inventory/TagPill.svelte, frontend/src/lib/components/inventory/Sparkline.svelte, frontend/tests/components/markdown.test.ts, frontend/tests/components/tag-palette.test.ts, frontend/tests/components/cluster-context.test.ts</files>
  <read_first>
    - frontend/src/lib/api/clusters.ts (withFetch + MaybeFetch + ApiInit + method shape — copy verbatim into inventory.ts)
    - frontend/src/lib/api/client.ts (registration block lines 27-44 — APPEND, don't replace)
    - frontend/src/lib/api/types.ts (add new exported interfaces alongside existing types)
    - frontend/src/lib/components/clusters/ClusterStatusPill.svelte (full file — EXTEND props with status='stale' and add corresponding colorClasses branch)
    - frontend/src/lib/components/layout/Topbar.svelte (current disabled Select around lines 67-88; replace with `<ClusterContextPicker />`; reserve a slot for `<QuotaIndicator />` before `<ThemeToggle />` — Plan 02-06 mounts it)
    - frontend/src/lib/components/layout/Sidebar.svelte (existing sections; ADD "Resources" section ABOVE Account per UI-SPEC §Sidebar nav additions)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-UI-SPEC.md §Component Contracts §TagPill (palette buckets table — 12 entries) + §ClusterContextPicker + §FilterChip + §Sidebar nav additions
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md §Pattern 5 (renderMarkdown verbatim) + §"Common Operation 5" (optimistic tag add)
  </read_first>
  <behavior>
    - `pnpm add marked dompurify && pnpm add -D @types/dompurify` runs successfully; package.json reflects.
    - `pnpm dlx shadcn-svelte@latest add scroll-area progress popover command accordion collapsible` adds blocks under frontend/src/lib/components/ui/.
    - api.inventory module exposes: listAll(opts?), listForCluster({clusterId}, opts?), getDetail({clusterId, vmid, type:'vm'|'lxc'}, opts?), getRrd({clusterId, vmid, type, timeframe?, cf?}, opts?), setTags({clusterId, vmid, type, tags}, opts?), setNotes({clusterId, vmid, type, notes}, opts?).
    - Registered in api.inventory under client.ts.
    - markdown.ts exports renderMarkdown(raw: string): string — calls marked.parse + DOMPurify.sanitize with allow-list `['p','br','strong','em','h1','h2','h3','h4','ul','ol','li','code','pre','blockquote','a']` + allowed attr `['href','title']`.
    - tag_palette.ts exports paletteFor(tag: string): string — FNV-1a 32-bit hash, %12, returns one of the 12 Tailwind class strings from UI-SPEC.
    - cluster_context.ts exports getClusterContext(): string|number, setClusterContext(v: string|number) — localStorage key "proxmox-gui:cluster-context"; SSR-safe (returns "all" when typeof window === 'undefined').
    - ClusterStatusPill extended with 'stale' status: `bg-warning/10 border-warning/30 text-warning` + `Clock` icon + optional `since` prop showing "Stale (last seen 5m ago)".
    - FilterChip: bg-muted h-7 px-2 rounded-md border; remove-button with `aria-label="Remove filter ${label}"`; `locked` prop renders Lock icon + no click.
    - TagPill: h-6 px-2 with palette class; click prop optional; `aria-label="Tag ${tag}"`.
    - Sparkline: takes `points: number[]` + `max: number` + `class?: string`; renders an SVG with `<polyline>` path; 80px tall, full width; uses --primary stroke. NO chart library imported.
    - ClusterContextPicker: shadcn-svelte Popover + Command combobox; trigger h-9 220px with ChevronsUpDown; options "All clusters" + each cluster from data.clusters; selection writes to localStorage AND updates URL `?cluster=…` on the current page if it has a cluster filter slot.
    - Sidebar: adds new "Resources" section above "Account" with two items: "Inventory" → /inventory (ListChecks icon), "Audit log" → /audit (History icon).
    - Topbar: replaces Phase 1 disabled <Select> with <ClusterContextPicker />; inserts an empty named-slot or just a comment `<!-- QuotaIndicator mounts here in Plan 02-06 -->` before `<ThemeToggle />` so 02-06 has a clean drop-in.
  </behavior>
  <action>
Step 1 — Run `pnpm add marked dompurify && pnpm add -D @types/dompurify` from `frontend/`; commit package.json+pnpm-lock changes. Then run `pnpm dlx shadcn-svelte@latest add scroll-area progress popover command accordion collapsible`. (Verify the .svelte files appear under frontend/src/lib/components/ui/.)

Step 2 — `frontend/src/lib/api/types.ts`. APPEND (alongside existing types):
```typescript
// ---- Phase 2 Inventory types ----

export interface VMInventoryItem {
  cluster_id: number;
  vmid: number;
  name: string | null;
  type: 'qemu' | 'lxc';
  node: string;
  status: string;
  maxcpu: number;
  maxmem: number;
  maxdisk: number;
  tags: string[];
  pool: string | null;
  is_stale: boolean;
}

export interface ClusterInventory {
  cluster_id: number;
  cluster_name: string;
  cluster_status: string;
  is_stale: boolean;
  last_error: string | null;
  items: VMInventoryItem[];
}

export interface VMDetail {
  cluster_id: number;
  vmid: number;
  name: string | null;
  type: 'qemu' | 'lxc';
  node: string;
  status: string;
  uptime: number;
  cpu: number;
  mem: number;
  maxcpu: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  netin: number;
  netout: number;
  diskread: number;
  diskwrite: number;
  tags: string[];
  description: string | null;
  raw_config: Record<string, unknown>;
}

export interface RRDSample {
  time: number;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  netin: number;
  netout: number;
  diskread: number;
  diskwrite: number;
}

export type ResourceKind = 'vm' | 'lxc';
```

Step 3 — `frontend/src/lib/api/inventory.ts` (NEW). Follow `clusters.ts` shape verbatim:
```typescript
import { apiFetch, apiJson, type ApiInit } from '$lib/utils/api';
import type {
  ClusterInventory, RRDSample, ResourceKind, VMDetail,
} from './types';

type FetchLike = typeof fetch;
interface MaybeFetch { fetch?: FetchLike; }

function withFetch(opts: MaybeFetch | undefined, init: ApiInit): ApiInit {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch } as ApiInit;
}

function basePath(clusterId: number, kind: ResourceKind, vmid?: number): string {
  const seg = kind === 'lxc' ? 'lxcs' : 'vms';
  return vmid === undefined
    ? `/clusters/${clusterId}/${seg}`
    : `/clusters/${clusterId}/${seg}/${vmid}`;
}

export async function listAll(opts?: MaybeFetch): Promise<ClusterInventory[]> {
  return apiJson<ClusterInventory[]>('/me/inventory',
    withFetch(opts, { method: 'GET' }));
}

export async function listForCluster(
  args: { clusterId: number },
  opts?: MaybeFetch,
): Promise<ClusterInventory> {
  return apiJson<ClusterInventory>(`/clusters/${args.clusterId}/inventory`,
    withFetch(opts, { method: 'GET' }));
}

export async function getDetail(
  args: { clusterId: number; vmid: number; type: ResourceKind },
  opts?: MaybeFetch,
): Promise<VMDetail> {
  return apiJson<VMDetail>(basePath(args.clusterId, args.type, args.vmid),
    withFetch(opts, { method: 'GET' }));
}

export async function getRrd(
  args: { clusterId: number; vmid: number; type: ResourceKind;
          timeframe?: 'hour'|'day'|'week'|'month'|'year'; cf?: 'AVERAGE'|'MAX' },
  opts?: MaybeFetch,
): Promise<RRDSample[]> {
  const qs = new URLSearchParams();
  if (args.timeframe) qs.set('timeframe', args.timeframe);
  if (args.cf) qs.set('cf', args.cf);
  const tail = qs.toString() ? `?${qs}` : '';
  return apiJson<RRDSample[]>(
    `${basePath(args.clusterId, args.type, args.vmid)}/rrd${tail}`,
    withFetch(opts, { method: 'GET' }),
  );
}

export async function setTags(
  args: { clusterId: number; vmid: number; type: ResourceKind; tags: string[] },
  opts?: MaybeFetch,
): Promise<VMDetail> {
  return apiJson<VMDetail>(
    `${basePath(args.clusterId, args.type, args.vmid)}/tags`,
    withFetch(opts, { method: 'PUT', body: { tags: args.tags } }),
  );
}

export async function setNotes(
  args: { clusterId: number; vmid: number; type: ResourceKind; notes: string },
  opts?: MaybeFetch,
): Promise<VMDetail> {
  return apiJson<VMDetail>(
    `${basePath(args.clusterId, args.type, args.vmid)}/notes`,
    withFetch(opts, { method: 'PUT', body: { notes: args.notes } }),
  );
}
```

Step 4 — `frontend/src/lib/api/client.ts`. APPEND inventory module to the api export object (alongside existing modules — DO NOT remove or rename existing keys per Plan 01-09 SUMMARY locked decision):
```typescript
import * as inventoryModule from './inventory';
// ...
export const api = {
  // ... existing keys preserved verbatim
  inventory: inventoryModule,
} as const;
```

Step 5 — `frontend/src/lib/utils/markdown.ts` (NEW):
```typescript
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4',
                      'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'a'];
const ALLOWED_ATTR = ['href', 'title'];

export function renderMarkdown(raw: string): string {
  const html = marked.parse(raw, { breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
```

Step 6 — `frontend/src/lib/utils/tag_palette.ts` (NEW). PALETTE table verbatim from UI-SPEC §TagPill:
```typescript
const PALETTE = [
  'bg-primary/10 border-primary/30 text-primary',
  'bg-success/10 border-success/30 text-success',
  'bg-warning/10 border-warning/30 text-warning',
  'bg-destructive/10 border-destructive/30 text-destructive',
  'bg-muted border-border text-foreground',
  'bg-primary/5 border-primary/20 text-primary',
  'bg-success/5 border-success/20 text-success',
  'bg-warning/5 border-warning/20 text-warning',
  'bg-destructive/5 border-destructive/20 text-destructive',
  'bg-muted/80 border-border text-muted-foreground',
  'bg-primary/15 border-primary/40 text-primary',
  'bg-muted/60 border-border text-foreground',
];

export function paletteFor(tag: string): string {
  // FNV-1a 32-bit hash; stable across reloads.
  let h = 2166136261;
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

export const TAG_PALETTE_SIZE = PALETTE.length;
```

Step 7 — `frontend/src/lib/utils/cluster_context.ts` (NEW):
```typescript
const KEY = 'proxmox-gui:cluster-context';
export const ALL_CLUSTERS = 'all' as const;

export type ClusterContext = typeof ALL_CLUSTERS | number;

export function getClusterContext(): ClusterContext {
  if (typeof window === 'undefined') return ALL_CLUSTERS;  // SSR
  const raw = window.localStorage.getItem(KEY);
  if (raw === null || raw === ALL_CLUSTERS) return ALL_CLUSTERS;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : ALL_CLUSTERS;
}

export function setClusterContext(v: ClusterContext): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, v === ALL_CLUSTERS ? ALL_CLUSTERS : String(v));
}
```

Step 8 — `frontend/src/lib/components/clusters/ClusterStatusPill.svelte`. EXTEND Phase 1 file:
- Add `'stale'` to the `status` literal union type.
- Add `since?: string` optional prop (last_seen_healthy timestamp formatted).
- Extend `colorClasses` $derived branch: `status === 'stale' ? 'bg-warning/10 border-warning/30 text-warning' : <existing branches>`.
- Extend `defaultLabel` $derived: `status === 'stale' ? \`Stale (last seen \${since ?? 'unknown'})\` : <existing>`.
- Import `Clock` from `@lucide/svelte/icons/clock`; render Clock icon when status==='stale'.

Step 9 — `frontend/src/lib/components/inventory/FilterChip.svelte` (NEW). UI-SPEC §FilterChip contract:
```svelte
<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import Lock from '@lucide/svelte/icons/lock';

  type Props = {
    label: string;
    onRemove?: () => void;
    locked?: boolean;
    statusColor?: string;  // optional class for the dot prefix (status filters only)
    class?: string;
  };
  let { label, onRemove, locked = false, statusColor, class: className = '' }: Props = $props();
</script>

<span class="inline-flex items-center gap-2 h-7 px-2 rounded-md border border-border bg-muted text-foreground text-[13px] font-medium {className}">
  {#if statusColor}
    <span class="size-2 rounded-full {statusColor}" aria-hidden="true"></span>
  {/if}
  <span>{label}</span>
  {#if locked}
    <Lock class="size-3 text-muted-foreground" aria-hidden="true" />
  {:else if onRemove}
    <button type="button" onclick={onRemove}
            class="-mr-1 inline-flex size-4 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove filter ${label}`}>
      <X class="size-3" />
    </button>
  {/if}
</span>
```

Step 10 — `frontend/src/lib/components/inventory/TagPill.svelte` (NEW):
```svelte
<script lang="ts">
  import { paletteFor } from '$lib/utils/tag_palette';
  type Props = {
    tag: string;
    onClick?: () => void;
    class?: string;
  };
  let { tag, onClick, class: className = '' }: Props = $props();
  const palette = $derived(paletteFor(tag));
</script>

{#if onClick}
  <button type="button" onclick={onClick}
          class="inline-flex items-center h-6 px-2 rounded-md border text-[13px] font-medium {palette} {className}"
          aria-label={`Tag ${tag}`}>
    {tag}
  </button>
{:else}
  <span class="inline-flex items-center h-6 px-2 rounded-md border text-[13px] font-medium {palette} {className}"
        aria-label={`Tag ${tag}`}>
    {tag}
  </span>
{/if}
```

Step 11 — `frontend/src/lib/components/inventory/Sparkline.svelte` (NEW). Hand-rolled SVG:
```svelte
<script lang="ts">
  type Props = {
    points: number[];      // y-axis values
    max: number;           // y-axis max for normalisation (e.g. maxmem, maxcpu)
    height?: number;       // default 80
    class?: string;
    label?: string;        // aria-label
  };
  let { points, max, height = 80, class: className = '', label = 'sparkline' }: Props = $props();
  const W = 200;  // viewBox width — scales to 100% via CSS
  const H = $derived(height);
  const yMax = $derived(Math.max(max, 1));
  const polyline = $derived(
    points.length === 0 ? '' :
    points.map((v, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * W;
      const y = H - Math.max(0, Math.min(1, v / yMax)) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ')
  );
</script>

{#if points.length === 0}
  <div class="flex h-{height}px items-center justify-center text-muted-foreground text-[13px]">No data</div>
{:else}
  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
       role="img" aria-label={label}
       class="block w-full {className}" style={`height: ${H}px;`}>
    <polyline fill="none" stroke="currentColor" class="text-primary"
              stroke-width="1.5" points={polyline} />
  </svg>
{/if}
```

Step 12 — `frontend/src/lib/components/inventory/ClusterContextPicker.svelte` (NEW). Use shadcn-svelte Popover + Command:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
  import Check from '@lucide/svelte/icons/check';
  import * as Popover from '$lib/components/ui/popover';
  import * as Command from '$lib/components/ui/command';
  import { Button } from '$lib/components/ui/button';
  import {
    ALL_CLUSTERS, getClusterContext, setClusterContext, type ClusterContext,
  } from '$lib/utils/cluster_context';

  type Cluster = { id: number; name: string };
  type Props = { clusters: Cluster[]; class?: string };
  let { clusters, class: className = '' }: Props = $props();

  let open = $state(false);
  let value = $state<ClusterContext>(ALL_CLUSTERS);
  onMount(() => { value = getClusterContext(); });

  const label = $derived(
    value === ALL_CLUSTERS ? 'All clusters'
      : (clusters.find(c => c.id === value)?.name ?? `Cluster ${value}`)
  );

  function choose(v: ClusterContext) {
    value = v;
    setClusterContext(v);
    open = false;
    // Sync the URL filter chip on /inventory so the visible list reflows.
    const url = new URL($page.url);
    if (v === ALL_CLUSTERS) url.searchParams.delete('cluster');
    else url.searchParams.set('cluster', String(v));
    goto(url.pathname + url.search, { replaceState: true, keepFocus: true });
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button variant="outline" class="w-[220px] justify-between h-9 {className}" {...props}
              aria-label="Cluster context">
        <span class="truncate text-[14px]">{label}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" aria-hidden="true" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-[260px] p-0" align="start">
    <Command.Root>
      <Command.Input placeholder="Filter clusters…" />
      <Command.Empty>No clusters registered. Ask your administrator.</Command.Empty>
      <Command.Group>
        <Command.Item value={ALL_CLUSTERS} onSelect={() => choose(ALL_CLUSTERS)}>
          <Check class={`mr-2 size-4 ${value === ALL_CLUSTERS ? 'opacity-100' : 'opacity-0'}`} />
          All clusters
        </Command.Item>
        {#each clusters as c (c.id)}
          <Command.Item value={String(c.id)} onSelect={() => choose(c.id)}>
            <Check class={`mr-2 size-4 ${value === c.id ? 'opacity-100' : 'opacity-0'}`} />
            {c.name}
          </Command.Item>
        {/each}
      </Command.Group>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
```

Step 13 — `frontend/src/lib/components/layout/Topbar.svelte`. Replace the Phase-1 disabled `<Select>` block (lines ~67-88) with:
```svelte
<ClusterContextPicker clusters={(data?.clusters ?? []) as Array<{id:number;name:string}>} />
```
(Hydration: AppShell's existing layout-server-load passes a `clusters` summary down to Topbar. If it doesn't, ADD a fetch in `frontend/src/routes/+layout.server.ts` that calls `api.clusters.list({ fetch })` for admins, OR a new public-light endpoint that lists cluster id+name only for any authenticated user. Verify what already exists in +layout.server.ts before adding; if `data.clusters` is already present from Phase 1, reuse.)

ADD a slot comment before `<ThemeToggle />`:
```svelte
<!-- QuotaIndicator: mounted by Plan 02-06 -->
```

Step 14 — `frontend/src/lib/components/layout/Sidebar.svelte`. ADD a new section ABOVE the existing "Account" section:
```svelte
{#snippet resourcesItems()}
  <a href="/inventory" class="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-[14px]">
    <ListChecks class="size-4 text-muted-foreground" aria-hidden="true" />
    <span>Inventory</span>
  </a>
  <a href="/audit" class="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-[14px]">
    <History class="size-4 text-muted-foreground" aria-hidden="true" />
    <span>Audit log</span>
  </a>
{/snippet}

<!-- INSERT above existing Account section -->
<section class="flex flex-col gap-1">
  <h3 class="px-3 text-[13px] font-medium text-muted-foreground">Resources</h3>
  {@render resourcesItems()}
</section>
```
(Imports: add `import ListChecks from '@lucide/svelte/icons/list-checks';` and `import History from '@lucide/svelte/icons/history';`.)

Step 15 — Tests.

`frontend/tests/components/markdown.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '$lib/utils/markdown';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('**bold** _em_');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>em</em>');
  });

  it('strips <script>', () => {
    const html = renderMarkdown('hi <script>alert(1)</script>');
    expect(html.toLowerCase()).not.toContain('<script');
  });

  it('strips <iframe>', () => {
    const html = renderMarkdown('hi <iframe src="x"></iframe>');
    expect(html.toLowerCase()).not.toContain('<iframe');
  });

  it('strips on* handlers', () => {
    const html = renderMarkdown('<a href="x" onclick="evil()">link</a>');
    expect(html.toLowerCase()).not.toContain('onclick');
  });

  it('strips javascript: URLs', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });

  it('converts single newlines to <br> (gfm breaks)', () => {
    const html = renderMarkdown('line1\nline2');
    expect(html).toContain('<br');
  });
});
```

`frontend/tests/components/tag-palette.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { paletteFor, TAG_PALETTE_SIZE } from '$lib/utils/tag_palette';

describe('paletteFor', () => {
  it('returns the same class for the same tag across calls', () => {
    expect(paletteFor('prod')).toEqual(paletteFor('prod'));
  });

  it('always returns one of the 12 known palette entries', () => {
    const out = new Set<string>();
    for (const t of ['a','b','c','prod','db','web','infra','dev','x','y','z','q','r','s']) {
      out.add(paletteFor(t));
    }
    expect(out.size).toBeLessThanOrEqual(TAG_PALETTE_SIZE);
    for (const cls of out) {
      expect(cls).toMatch(/bg-(primary|success|warning|destructive|muted)/);
    }
  });
});
```

`frontend/tests/components/cluster-context.test.ts`:
```typescript
import { afterEach, describe, expect, it } from 'vitest';
import { ALL_CLUSTERS, getClusterContext, setClusterContext } from '$lib/utils/cluster_context';

describe('cluster_context localStorage', () => {
  afterEach(() => window.localStorage.clear());

  it('defaults to ALL_CLUSTERS when unset', () => {
    expect(getClusterContext()).toBe(ALL_CLUSTERS);
  });

  it('round-trips a numeric value', () => {
    setClusterContext(42);
    expect(getClusterContext()).toBe(42);
  });

  it('falls back to ALL_CLUSTERS on garbage', () => {
    window.localStorage.setItem('proxmox-gui:cluster-context', 'not-a-number');
    expect(getClusterContext()).toBe(ALL_CLUSTERS);
  });
});
```
  </action>
  <verify>
    <automated>cd frontend && pnpm install && pnpm test -- --run components/markdown.test.ts components/tag-palette.test.ts components/cluster-context.test.ts && pnpm run check</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE '"marked":|"dompurify":|"@types/dompurify":' frontend/package.json` returns 3 matches.
    - `ls frontend/src/lib/components/ui/popover frontend/src/lib/components/ui/command frontend/src/lib/components/ui/accordion frontend/src/lib/components/ui/collapsible frontend/src/lib/components/ui/scroll-area frontend/src/lib/components/ui/progress 2>&1 | grep -c index.ts` is at least 6 (each block added).
    - `grep -n "export const api" frontend/src/lib/api/client.ts | wc -l` returns 1 (single export); `grep -n "inventory: inventoryModule" frontend/src/lib/api/client.ts` returns 1 match.
    - `grep -nE "export async function (listAll|listForCluster|getDetail|getRrd|setTags|setNotes)" frontend/src/lib/api/inventory.ts` returns 6 matches.
    - `grep -n "DOMPurify.sanitize" frontend/src/lib/utils/markdown.ts` returns 1 match.
    - `grep -n "ALLOWED_TAGS" frontend/src/lib/utils/markdown.ts` returns 1 match.
    - `grep -nc "bg-" frontend/src/lib/utils/tag_palette.ts` is exactly 12 (12 palette entries — count `bg-` substring occurrences inside the PALETTE array).
    - `grep -n "proxmox-gui:cluster-context" frontend/src/lib/utils/cluster_context.ts` returns 1 match.
    - `grep -n "'stale'" frontend/src/lib/components/clusters/ClusterStatusPill.svelte` returns at least 1 match.
    - `grep -n "ClusterContextPicker" frontend/src/lib/components/layout/Topbar.svelte` returns 1 match.
    - `grep -n "QuotaIndicator: mounted by Plan 02-06" frontend/src/lib/components/layout/Topbar.svelte` returns 1 match.
    - `grep -nE "/inventory|/audit" frontend/src/lib/components/layout/Sidebar.svelte` returns at least 2 matches.
    - `cd frontend && pnpm test -- --run components/markdown.test.ts components/tag-palette.test.ts components/cluster-context.test.ts` exits 0.
    - `cd frontend && pnpm run check` exits 0.
  </acceptance_criteria>
  <done>
    - Deps + shadcn blocks added.
    - Inventory API client + types + utilities (markdown, tag palette, cluster context) shipped.
    - ClusterStatusPill extended with 'stale'.
    - FilterChip, TagPill, Sparkline, ClusterContextPicker components shipped.
    - Topbar + Sidebar wired.
    - XSS/sanitization regression tests + palette stability tests + cluster-context localStorage tests all green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: /inventory list page (Sections + FilterChips + sort) + /inventory/{cluster}/{vmid} detail page (tabs + Specs/Network/Metrics/Tags/Notes) + Activity tab placeholder; TagInput + MarkdownNotes + ClusterSection components</name>
  <files>frontend/src/lib/components/inventory/ClusterSection.svelte, frontend/src/lib/components/inventory/TagInput.svelte, frontend/src/lib/components/inventory/MarkdownNotes.svelte, frontend/src/routes/inventory/+page.server.ts, frontend/src/routes/inventory/+page.svelte, frontend/src/routes/inventory/[cluster]/[vmid]/+page.server.ts, frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte, frontend/src/routes/inventory/[cluster]/[vmid]/activity/+page.svelte</files>
  <read_first>
    - frontend/src/routes/admin/clusters/+page.svelte (full file — page-skeleton + Table + handleDelete optimistic pattern; the inventory list mirrors but with Accordion-wrapped Tables per cluster)
    - frontend/src/routes/admin/clusters/+page.server.ts (full file — defence-in-depth auth gate + load pattern; drop the is_admin guard for /inventory per UI-SPEC §SSR loader rules)
    - frontend/src/routes/admin/clusters/[id]/+page.svelte (untrack + form pattern — used for Notes edit-mode and Tags optimistic state)
    - frontend/src/lib/components/ui/tabs/index.ts (Tabs.Root + Trigger + Content; URL-hash binding pattern)
    - frontend/src/lib/components/ui/accordion/index.ts (Accordion.Root + Item + Trigger + Content)
    - frontend/src/lib/components/inventory/TagPill.svelte + FilterChip.svelte + Sparkline.svelte (Task 1 — consume here)
    - frontend/src/lib/utils/cluster_context.ts (Task 1)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-UI-SPEC.md §"/inventory (primary surface)" + §"/inventory/{cluster_id}/{vmid}" + §Component Contracts §ClusterSection + §TagInput + §MarkdownNotes
  </read_first>
  <behavior>
    - +page.server.ts on /inventory: requires `locals.user` (drop is_admin guard); reads URL params (q, status, tag, cluster, sort); calls `api.inventory.listAll({ fetch })`; returns { user, inventory, loadError }.
    - +page.svelte on /inventory: SSR-seeded; on `clusters.length === 1` renders flat list; on ≥2 renders Accordion with one ClusterSection per cluster. Filter row: search input + Sort dropdown + active FilterChips below + "Clear all" link. Sort dropdown options "Status (default)", "Name A→Z", "VMID", "Last changed"; selection NOT persisted (every page-load resets to "Status (default)").
    - FilterChips for active filters; clicking the chip's X removes from URL params + calls `goto` with new search.
    - Row click → goto `/inventory/${cluster_id}/${vmid}` (use ResourceKind from item.type to choose vms vs lxcs — actually the URL path always uses `vms/{vmid}` for VMs and `lxcs/{vmid}` for LXCs; for the detail page we always go via `/inventory/{cluster_id}/{vmid}` and the SSR loader picks the right backend endpoint based on item.type).
    - +page.server.ts on /inventory/[cluster]/[vmid]: reads `event.params.cluster` + `event.params.vmid`; first attempt `api.inventory.getDetail({type:'vm'})`; on 403 → fallback try `type:'lxc'`; if both 403 → throw 404. Returns `{ user, detail, loadError }`.
    - +page.svelte on detail: tabs via shadcn `Tabs.Root` with `value={$page.url.hash.slice(1) || 'overview'}`; `onValueChange = (v) => goto('#'+v, { replaceState: true })`. Triggers: Overview, Activity, Snapshots (disabled with Lock icon + tooltip "Snapshots ship in Phase 3"), Console (disabled with tooltip "Console ships in Phase 4").
    - Overview content: Specs card (vCPU, RAM bytes-to-GB display, Disk bytes-to-GB), Network card (placeholder from raw_config), Metrics card with 4 sparklines fed by `api.inventory.getRrd(...)`, Tags card (TagPill list + "+ Add tag" → TagInput popover), Notes card (MarkdownNotes — see below).
    - TagInput: opens shadcn Popover with Command input; client validates `^[a-z0-9_-]+$` per D-14; submit → optimistic add to `localOverride`, calls `api.inventory.setTags`, on error rollback + toast.
    - MarkdownNotes: render-mode shows renderMarkdown(detail.description ?? '') inside `.prose prose-sm dark:prose-invert max-w-none`; "Edit" button switches to textarea (240px tall, mono 13px); "Save notes" calls `api.inventory.setNotes`, char-count tooltip near 7800 cap. Validation: length ≤ 8000.
    - Activity tab: simple stub that renders `<div class="text-muted-foreground">Activity log integrates with /audit in the same phase — see Plan 02-06 for AuditTable mount.</div>` and a `View in global audit log →` link to `/audit?cluster_id={cluster_id}&vmid={vmid}`. Plan 02-06 replaces this stub by importing AuditTable with lockedFilters.
    - Empty state when items.length === 0 cluster-wide: copy verbatim from UI-SPEC §"Required loading/empty/error" — "No VMs or LXCs in your scope yet." (no CTA — provisioning is Phase 4).
  </behavior>
  <action>
Step 1 — `frontend/src/lib/components/inventory/ClusterSection.svelte` (NEW):
```svelte
<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import * as Accordion from '$lib/components/ui/accordion';
  import { Badge } from '$lib/components/ui/badge';
  import * as Alert from '$lib/components/ui/alert';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import ClusterStatusPill from '$lib/components/clusters/ClusterStatusPill.svelte';
  import type { Snippet } from 'svelte';

  type Props = {
    clusterId: number;
    clusterName: string;
    clusterStatus: 'ok'|'failed'|'untested'|'stale'|string;
    isStale: boolean;
    lastError: string | null;
    matched: number;
    total: number;
    filterActive: boolean;
    children: Snippet;
  };
  let { clusterId, clusterName, clusterStatus, isStale, lastError,
        matched, total, filterActive, children }: Props = $props();

  const counterLabel = $derived(
    filterActive ? `(${matched} / ${total})` : `(${total})`
  );
  const headerStatus = $derived(isStale ? 'stale' : clusterStatus);
</script>

<Accordion.Item value={`cluster-${clusterId}`}>
  <Accordion.Trigger class="bg-muted/40 h-12 px-6 hover:bg-muted/60 rounded-md w-full">
    <div class="flex items-center gap-3 flex-1">
      <ChevronDown class="size-4 text-muted-foreground transition-transform" aria-hidden="true" />
      <span class="text-[18px] font-semibold tracking-tight">{clusterName}</span>
      <ClusterStatusPill status={headerStatus} />
      <Badge variant="outline" class="text-[13px] font-medium text-muted-foreground">
        {counterLabel}
      </Badge>
    </div>
  </Accordion.Trigger>
  <Accordion.Content>
    {#if clusterStatus === 'failed'}
      <Alert.Root variant="destructive" class="mb-4">
        <ShieldAlert class="size-4" />
        <Alert.Title>Cluster {clusterName} unreachable</Alert.Title>
        <Alert.Description>
          {lastError ?? 'Showing last cached data. Actions are read-only until the cluster recovers.'}
        </Alert.Description>
      </Alert.Root>
    {/if}
    {@render children()}
  </Accordion.Content>
</Accordion.Item>
```

Step 2 — `frontend/src/lib/components/inventory/TagInput.svelte` (NEW):
```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import * as Command from '$lib/components/ui/command';
  import Plus from '@lucide/svelte/icons/plus';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import { ApiError } from '$lib/utils/api';

  type Props = {
    clusterId: number;
    vmid: number;
    type: 'vm' | 'lxc';
    currentTags: string[];
    suggestions?: string[];   // collected from sibling rows in the inventory cache
    onApplied?: (newTags: string[]) => void;
  };
  let { clusterId, vmid, type, currentTags, suggestions = [], onApplied }: Props = $props();

  let open = $state(false);
  let input = $state('');
  let submitting = $state(false);
  let inlineError = $state<string | null>(null);

  const TAG_RE = /^[a-z0-9_-]+$/;

  function validate(v: string): string | null {
    if (!v) return 'Type a tag.';
    if (!TAG_RE.test(v)) return 'Tags use lowercase letters, digits, hyphens, and underscores only.';
    if (currentTags.includes(v)) return `'${v}' is already applied.`;
    return null;
  }

  async function addTag(t: string) {
    const err = validate(t);
    if (err) { inlineError = err; return; }
    submitting = true;
    inlineError = null;
    const next = Array.from(new Set([...currentTags, t])).sort();
    try {
      await api.inventory.setTags({ clusterId, vmid, type, tags: next });
      onApplied?.(next);
      open = false;
      input = '';
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 422
        ? "Couldn't add tag — server rejected the format."
        : "Couldn't add tag. Try again.";
      toast.error(msg);
    } finally {
      submitting = false;
    }
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button variant="outline" size="sm" {...props}>
        <Plus class="size-4 mr-1" aria-hidden="true" /> Add tag
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-[280px] p-0" align="start">
    <Command.Root shouldFilter={true}>
      <Command.Input bind:value={input} placeholder="Type a tag…"
                     onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(input.trim()); } }} />
      {#if inlineError}
        <div role="alert" class="px-3 py-2 text-[13px] text-destructive">{inlineError}</div>
      {/if}
      <Command.List>
        <Command.Empty>No matches. Press Enter to create.</Command.Empty>
        <Command.Group heading="Existing tags">
          {#each suggestions.filter(s => !currentTags.includes(s)) as s (s)}
            <Command.Item value={s} onSelect={() => addTag(s)}>{s}</Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
```

Step 3 — `frontend/src/lib/components/inventory/MarkdownNotes.svelte` (NEW):
```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import Pencil from '@lucide/svelte/icons/pencil';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import { ApiError } from '$lib/utils/api';
  import { renderMarkdown } from '$lib/utils/markdown';

  type Props = {
    clusterId: number;
    vmid: number;
    type: 'vm' | 'lxc';
    notes: string;
    onApplied?: (notes: string) => void;
  };
  let { clusterId, vmid, type, notes, onApplied }: Props = $props();

  const MAX = 8000;
  let editing = $state(false);
  let draft = $state(notes);
  let saving = $state(false);
  let error = $state<string | null>(null);

  function startEdit() { draft = notes; editing = true; error = null; }
  function cancelEdit() { editing = false; error = null; }

  async function save() {
    if (draft.length > MAX) {
      error = `Notes are limited to ${MAX} characters. Trim ${draft.length - MAX} characters to save.`;
      return;
    }
    saving = true;
    error = null;
    try {
      await api.inventory.setNotes({ clusterId, vmid, type, notes: draft });
      onApplied?.(draft);
      editing = false;
    } catch (e) {
      error = e instanceof ApiError && e.status === 422
        ? "Notes exceeded server limit."
        : "Couldn't save notes. Try again.";
      toast.error(error);
    } finally {
      saving = false;
    }
  }

  const rendered = $derived(notes ? renderMarkdown(notes) : '');
  const remaining = $derived(MAX - draft.length);
</script>

{#if editing}
  <div class="flex flex-col gap-2">
    <label for="vm-notes" class="text-[13px] font-medium">Notes (Markdown supported)</label>
    <Textarea id="vm-notes" bind:value={draft} class="h-60 font-mono text-[13px]" />
    {#if error}<div role="alert" class="text-[13px] text-destructive">{error}</div>{/if}
    <div class="flex items-center justify-between text-[13px] text-muted-foreground">
      <span>{remaining < 200 ? `${remaining} chars left` : ''}</span>
      <div class="flex gap-2">
        <Button variant="ghost" onclick={cancelEdit}>Cancel</Button>
        <Button onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save notes'}</Button>
      </div>
    </div>
  </div>
{:else if notes}
  <div class="flex items-start justify-between gap-4">
    <div class="prose prose-sm dark:prose-invert max-w-none" role="article">
      {@html rendered}
    </div>
    <Button variant="ghost" size="sm" onclick={startEdit} aria-label="Edit notes">
      <Pencil class="size-4 mr-1" aria-hidden="true" /> Edit
    </Button>
  </div>
{:else}
  <div class="flex flex-col items-start gap-2">
    <p class="text-[14px] text-muted-foreground">No notes yet.</p>
    <Button variant="outline" onclick={startEdit}>+ Add notes</Button>
  </div>
{/if}
```

Step 4 — `frontend/src/routes/inventory/+page.server.ts` (NEW):
```typescript
import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const inventory = await api.inventory.listAll({ fetch });
    return { user: locals.user, inventory, loadError: false };
  } catch {
    return { user: locals.user, inventory: [], loadError: true };
  }
};
```

Step 5 — `frontend/src/routes/inventory/+page.svelte` (NEW). Structure:
- $state for localOverride (per-VM tag optimistic updates) and rowStatus map (not used in Plan 02-05).
- Filter state derived from $page.url.searchParams (q, status (csv), tag (csv), cluster, sort).
- For each ClusterInventory, build a filtered list view; track matched vs total counts.
- When `inventory.length === 1` AND no `cluster` URL filter, render flat Table; otherwise render `<Accordion.Root type="multiple" defaultValue={inventory.map(c => 'cluster-'+c.cluster_id)}>` with one ClusterSection per cluster.
- Row click navigates to `/inventory/${cluster_id}/${vmid}`.
- TagPill click adds `tag=${tag}` to URL.
- Status icon mapping per UI-SPEC §"Semantic color usage" (running/stopped/paused/error → CirclePlay/CircleStop/CirclePause/CircleAlert).
- Sort options NOT persisted; default "status priority (running → stopped → paused → error → unknown) + alphabetical name".

Implementation key snippets:
```svelte
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Table from '$lib/components/ui/table';
  import { toast } from 'svelte-sonner';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import CirclePlay from '@lucide/svelte/icons/circle-play';
  import CircleStop from '@lucide/svelte/icons/circle-stop';
  import CirclePause from '@lucide/svelte/icons/circle-pause';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Clock from '@lucide/svelte/icons/clock';
  import ClusterSection from '$lib/components/inventory/ClusterSection.svelte';
  import FilterChip from '$lib/components/inventory/FilterChip.svelte';
  import TagPill from '$lib/components/inventory/TagPill.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import type { ClusterInventory, VMInventoryItem } from '$lib/api/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const STATUS_ORDER: Record<string, number> = {
    running: 0, paused: 1, stopped: 2, error: 3, unknown: 4,
  };
  const STATUS_ICON = {
    running: CirclePlay, paused: CirclePause, stopped: CircleStop, error: CircleAlert,
  } as const;

  const params = $derived($page.url.searchParams);
  const q = $derived(params.get('q')?.toLowerCase() ?? '');
  const statusFilter = $derived(new Set((params.get('status') ?? '').split(',').filter(Boolean)));
  const tagFilter = $derived(new Set((params.get('tag') ?? '').split(',').filter(Boolean)));
  const clusterFilter = $derived(params.get('cluster') ? Number(params.get('cluster')) : null);
  const sort = $derived(params.get('sort') ?? 'status');
  const filterActive = $derived(q.length > 0 || statusFilter.size > 0 || tagFilter.size > 0 || clusterFilter !== null);

  function setParam(key: string, value: string | null) {
    const url = new URL($page.url);
    if (value === null || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    goto(url.pathname + url.search, { keepFocus: true, replaceState: true });
  }

  function clearAll() {
    goto($page.url.pathname, { keepFocus: false });
  }

  function matchesFilter(it: VMInventoryItem): boolean {
    if (q && !(it.name?.toLowerCase().includes(q) || String(it.vmid).includes(q) || it.tags.some(t => t.includes(q)))) return false;
    if (statusFilter.size > 0 && !statusFilter.has(it.status)) return false;
    if (tagFilter.size > 0 && !it.tags.some(t => tagFilter.has(t))) return false;
    return true;
  }

  function compareItems(a: VMInventoryItem, b: VMInventoryItem): number {
    if (sort === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
    if (sort === 'vmid') return a.vmid - b.vmid;
    if (sort === 'last_changed') return 0;  // backend doesn't expose; tracker for Phase 5 polish
    // default: status priority + alpha
    const sd = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (sd !== 0) return sd;
    return (a.name ?? '').localeCompare(b.name ?? '');
  }

  const clusters = $derived<ClusterInventory[]>(
    clusterFilter === null ? data.inventory : data.inventory.filter(c => c.cluster_id === clusterFilter)
  );

  // Aggregate ALL tags across the visible inventory for TagInput suggestions.
  const allTagsByCluster = $derived(Object.fromEntries(
    data.inventory.map(c => [c.cluster_id,
      Array.from(new Set(c.items.flatMap(i => i.tags))).sort()] as const)
  ) as Record<number, string[]>);
</script>

<header class="flex flex-row items-start justify-between gap-4 mb-6">
  <div class="flex flex-col gap-2">
    <h1 class="text-[28px] font-semibold tracking-tight">Inventory</h1>
    <p class="text-muted-foreground text-sm">Your VMs and LXCs across all clusters.</p>
  </div>
</header>

<div class="sticky top-14 bg-background border-b border-border py-4 -mx-6 px-6 mb-6 flex flex-col gap-3">
  <div class="flex items-center gap-3">
    <Input placeholder="Search by name, vmid, or tag…" value={params.get('q') ?? ''}
           oninput={(e) => setParam('q', (e.target as HTMLInputElement).value)} class="flex-1" />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>{#snippet child({props})}<Button variant="outline" {...props}>Sort ▾</Button>{/snippet}</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onclick={() => setParam('sort', null)}>Status (default)</DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => setParam('sort', 'name')}>Name A→Z</DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => setParam('sort', 'vmid')}>VMID</DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => setParam('sort', 'last_changed')}>Last changed</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
  {#if filterActive}
    <div class="flex flex-wrap items-center gap-2">
      {#if q}<FilterChip label={`search: ${q}`} onRemove={() => setParam('q', null)} />{/if}
      {#each Array.from(statusFilter) as s}
        <FilterChip label={`status: ${s}`} onRemove={() => {
          const next = Array.from(statusFilter).filter(v => v !== s).join(',');
          setParam('status', next || null);
        }} />
      {/each}
      {#each Array.from(tagFilter) as t}
        <FilterChip label={`tag: ${t}`} onRemove={() => {
          const next = Array.from(tagFilter).filter(v => v !== t).join(',');
          setParam('tag', next || null);
        }} />
      {/each}
      {#if clusterFilter !== null}
        <FilterChip label={`cluster: ${data.inventory.find(c => c.cluster_id === clusterFilter)?.cluster_name ?? clusterFilter}`}
                    onRemove={() => setParam('cluster', null)} />
      {/if}
      <button type="button" class="text-[13px] text-primary underline-offset-4 hover:underline" onclick={clearAll}>Clear all</button>
    </div>
  {/if}
</div>

{#if data.loadError}
  <div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center">
    <p class="text-sm font-medium">Couldn't load inventory.</p>
    <Button variant="outline" onclick={() => invalidateAll()}>Try again</Button>
  </div>
{:else if clusters.length === 0}
  <div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-16 text-center">
    <p class="text-sm font-medium">No VMs or LXCs in your scope yet.</p>
  </div>
{:else if clusters.length === 1 && clusterFilter === null}
  {@const c = clusters[0]}
  {@const filtered = c.items.filter(matchesFilter).sort(compareItems)}
  <!-- Flat list rendered directly when exactly 1 cluster + no cluster URL filter (D-01). -->
  <div class="rounded-md border border-border">
    <Table.Root>
      <Table.Body>
        {#each filtered as item (item.vmid)}
          <Table.Row class="hover:bg-muted/50 cursor-pointer" onclick={() => goto(`/inventory/${item.cluster_id}/${item.vmid}`)}>
            <Table.Cell><svelte:component this={STATUS_ICON[item.status] ?? CircleAlert} class="size-4" /> {item.status}</Table.Cell>
            <Table.Cell><div class="font-medium">{item.name ?? `VM ${item.vmid}`}</div><div class="font-mono text-[13px] text-muted-foreground">{item.vmid}</div></Table.Cell>
            <Table.Cell><div class="flex flex-wrap gap-1">{#each item.tags as t}<TagPill tag={t} onClick={() => setParam('tag', (Array.from(tagFilter).concat([t])).join(','))} />{/each}</div></Table.Cell>
            <Table.Cell class="text-muted-foreground">{item.node}</Table.Cell>
            <Table.Cell class="text-right"><ChevronRight class="size-4 text-muted-foreground" /></Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{:else}
  <Accordion.Root type="multiple" value={clusters.map(c => `cluster-${c.cluster_id}`)} class="flex flex-col gap-6">
    {#each clusters as c (c.cluster_id)}
      {@const filtered = c.items.filter(matchesFilter).sort(compareItems)}
      <ClusterSection clusterId={c.cluster_id} clusterName={c.cluster_name}
                      clusterStatus={c.cluster_status} isStale={c.is_stale}
                      lastError={c.last_error}
                      matched={filtered.length} total={c.items.length}
                      filterActive={filterActive}>
        {#if filtered.length === 0}
          <div class="px-6 py-6 text-muted-foreground text-[14px]">
            {filterActive ? 'No VMs match the current filter in this cluster.' : `No VMs in ${c.cluster_name}.`}
          </div>
        {:else}
          <div class="rounded-md border border-border">
            <Table.Root>
              <Table.Body>
                {#each filtered as item (item.vmid)}
                  <Table.Row class="hover:bg-muted/50 cursor-pointer h-14" onclick={() => goto(`/inventory/${item.cluster_id}/${item.vmid}`)}>
                    <Table.Cell class="w-[140px]">
                      {#if item.status === 'running'}<CirclePlay class="size-4 text-success inline mr-1" />{:else if item.status === 'paused'}<CirclePause class="size-4 text-warning inline mr-1" />{:else if item.status === 'stopped'}<CircleStop class="size-4 text-muted-foreground inline mr-1" />{:else}<CircleAlert class="size-4 text-destructive inline mr-1" />{/if}
                      <span class="text-[14px]">{item.status}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div class="font-medium text-[14px]">{item.name ?? `VM ${item.vmid}`}</div>
                      <div class="font-mono text-[13px] text-muted-foreground">{item.vmid}</div>
                    </Table.Cell>
                    <Table.Cell>
                      <div class="flex flex-wrap gap-1">
                        {#each item.tags.slice(0,3) as t}<TagPill tag={t} onClick={() => { const nxt = Array.from(new Set([...Array.from(tagFilter), t])).join(','); setParam('tag', nxt); }} />{/each}
                        {#if item.tags.length > 3}<Badge variant="outline">+{item.tags.length - 3}</Badge>{/if}
                      </div>
                    </Table.Cell>
                    <Table.Cell class="text-muted-foreground text-[14px]">{item.node}</Table.Cell>
                    <Table.Cell class="text-right w-[40px]">
                      {#if item.is_stale}<Clock class="size-4 text-warning inline mr-2" aria-label="Stale" />{/if}
                      <ChevronRight class="size-4 text-muted-foreground inline" />
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        {/if}
      </ClusterSection>
    {/each}
  </Accordion.Root>
{/if}
```

Step 6 — `frontend/src/routes/inventory/[cluster]/[vmid]/+page.server.ts` (NEW):
```typescript
import { error, redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import { ApiError } from '$lib/utils/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  const clusterId = Number(params.cluster);
  const vmid = Number(params.vmid);
  if (!Number.isInteger(clusterId) || !Number.isInteger(vmid)) {
    throw error(404, 'Not found');
  }
  // Try VM first; on 403, try LXC; on both-403, surface 404 (don't leak existence).
  try {
    const detail = await api.inventory.getDetail({ clusterId, vmid, type: 'vm', fetch });
    return { user: locals.user, detail, loadError: false };
  } catch (e1) {
    try {
      const detail = await api.inventory.getDetail({ clusterId, vmid, type: 'lxc', fetch });
      return { user: locals.user, detail, loadError: false };
    } catch (e2) {
      if (e2 instanceof ApiError && e2.status === 403) {
        throw error(404, 'Not found');
      }
      return { user: locals.user, detail: null, loadError: true };
    }
  }
};
```

Step 7 — `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` (NEW). Tab strip + Overview content:
```svelte
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import * as Tabs from '$lib/components/ui/tabs';
  import { Card } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { toast } from 'svelte-sonner';
  import Lock from '@lucide/svelte/icons/lock';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import TagPill from '$lib/components/inventory/TagPill.svelte';
  import TagInput from '$lib/components/inventory/TagInput.svelte';
  import MarkdownNotes from '$lib/components/inventory/MarkdownNotes.svelte';
  import Sparkline from '$lib/components/inventory/Sparkline.svelte';
  import { api } from '$lib/api/client';
  import type { PageData } from './$types';
  import type { RRDSample } from '$lib/api/types';

  let { data }: { data: PageData } = $props();
  const detail = $derived(data.detail);

  const tabFromHash = $derived(($page.url.hash.replace('#','')) || 'overview');
  function setTab(v: string) { goto('#'+v, { replaceState: true, keepFocus: true }); }

  let localTags = $state<string[] | null>(null);
  let localNotes = $state<string | null>(null);
  const tags = $derived(localTags ?? detail?.tags ?? []);
  const notes = $derived(localNotes ?? detail?.description ?? '');

  let rrd = $state<RRDSample[]>([]);
  let rrdError = $state<string | null>(null);
  $effect(() => {
    if (!detail) return;
    rrdError = null;
    api.inventory.getRrd({ clusterId: detail.cluster_id, vmid: detail.vmid, type: detail.type, timeframe: 'hour', cf: 'AVERAGE' })
      .then(s => rrd = s)
      .catch(() => { rrd = []; rrdError = "Couldn't load metrics."; });
  });

  async function removeTag(t: string) {
    if (!detail) return;
    const next = tags.filter(x => x !== t);
    localTags = next;
    try {
      await api.inventory.setTags({ clusterId: detail.cluster_id, vmid: detail.vmid, type: detail.type, tags: next });
      toast.success(`Tag '${t}' removed.`);
      await invalidateAll();
      localTags = null;
    } catch {
      localTags = null;
      toast.error("Couldn't remove tag. Try again.");
    }
  }

  const GB = 1024 ** 3;
  const ramGb = $derived(detail ? Math.round((detail.maxmem / GB) * 10) / 10 : 0);
  const diskGb = $derived(detail ? Math.round((detail.maxdisk / GB) * 10) / 10 : 0);
</script>

{#if !detail || data.loadError}
  <div class="rounded-md border border-dashed border-border bg-muted/30 p-10 text-center">
    <p class="text-sm font-medium">Couldn't load VM details.</p>
    <Button variant="outline" onclick={() => invalidateAll()}>Try again</Button>
  </div>
{:else}
  <nav class="text-[13px] text-muted-foreground mb-2"><a href="/inventory" class="hover:underline">Inventory</a> &gt; {detail.cluster_id} &gt; {detail.name ?? `VM ${detail.vmid}`}</nav>
  <header class="mb-6 flex flex-col gap-1">
    <h1 class="text-[28px] font-semibold tracking-tight">{detail.name ?? `VM ${detail.vmid}`}</h1>
    <p class="font-mono text-[13px] text-muted-foreground">{detail.vmid} · cluster {detail.cluster_id} · {detail.node}</p>
  </header>

  <Tabs.Root value={tabFromHash} onValueChange={setTab}>
    <Tabs.List class="h-9">
      <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
      <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
      <Tooltip.Root><Tooltip.Trigger>{#snippet child({props})}<Tabs.Trigger value="snapshots" disabled {...props}><Lock class="size-3 mr-1" aria-hidden="true" /> Snapshots</Tabs.Trigger>{/snippet}</Tooltip.Trigger><Tooltip.Content>Snapshots ship in Phase 3</Tooltip.Content></Tooltip.Root>
      <Tooltip.Root><Tooltip.Trigger>{#snippet child({props})}<Tabs.Trigger value="console" disabled {...props}><Lock class="size-3 mr-1" aria-hidden="true" /> Console</Tabs.Trigger>{/snippet}</Tooltip.Trigger><Tooltip.Content>Console ships in Phase 4</Tooltip.Content></Tooltip.Root>
    </Tabs.List>

    <Tabs.Content value="overview">
      <div class="grid gap-6 mt-6">
        <div class="grid grid-cols-2 gap-6">
          <Card class="p-6">
            <h3 class="text-[13px] font-medium text-muted-foreground mb-3">Specs</h3>
            <dl class="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
              <dt class="text-muted-foreground">Status</dt><dd class="font-mono">{detail.status}</dd>
              <dt class="text-muted-foreground">vCPU</dt><dd class="font-mono">{detail.maxcpu}</dd>
              <dt class="text-muted-foreground">RAM</dt><dd class="font-mono">{ramGb} GB</dd>
              <dt class="text-muted-foreground">Disk</dt><dd class="font-mono">{diskGb} GB</dd>
              <dt class="text-muted-foreground">Uptime</dt><dd class="font-mono">{detail.uptime}s</dd>
            </dl>
          </Card>
          <Card class="p-6">
            <h3 class="text-[13px] font-medium text-muted-foreground mb-3">Network</h3>
            <dl class="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
              <dt class="text-muted-foreground">Node</dt><dd class="font-mono">{detail.node}</dd>
              <dt class="text-muted-foreground">net0</dt><dd class="font-mono">{String(detail.raw_config?.net0 ?? '—')}</dd>
              <dt class="text-muted-foreground">net1</dt><dd class="font-mono">{String(detail.raw_config?.net1 ?? '—')}</dd>
            </dl>
          </Card>
        </div>

        <Card class="p-6">
          <h3 class="text-[13px] font-medium text-muted-foreground mb-3">Metrics (last hour)</h3>
          {#if rrdError}
            <p class="text-[13px] text-destructive">{rrdError}</p>
          {:else}
            <div class="grid grid-cols-2 gap-6">
              <div><p class="text-[13px] text-muted-foreground mb-1">CPU %</p><Sparkline points={rrd.map(s => s.cpu)} max={1} label="CPU usage over time" /></div>
              <div><p class="text-[13px] text-muted-foreground mb-1">RAM</p><Sparkline points={rrd.map(s => s.mem)} max={detail.maxmem || 1} label="RAM usage over time" /></div>
              <div><p class="text-[13px] text-muted-foreground mb-1">Disk I/O</p><Sparkline points={rrd.map(s => s.diskread + s.diskwrite)} max={Math.max(...rrd.map(s => s.diskread + s.diskwrite), 1)} label="Disk I/O" /></div>
              <div><p class="text-[13px] text-muted-foreground mb-1">Network</p><Sparkline points={rrd.map(s => s.netin + s.netout)} max={Math.max(...rrd.map(s => s.netin + s.netout), 1)} label="Network" /></div>
            </div>
          {/if}
        </Card>

        <Card class="p-6">
          <h3 class="text-[13px] font-medium text-muted-foreground mb-3">Tags</h3>
          <div class="flex flex-wrap items-center gap-2">
            {#each tags as t}
              <span class="inline-flex items-center gap-1">
                <TagPill tag={t} />
                <button type="button" class="text-muted-foreground hover:text-destructive text-[12px]" onclick={() => removeTag(t)} aria-label={`Remove tag ${t}`}>×</button>
              </span>
            {/each}
            <TagInput clusterId={detail.cluster_id} vmid={detail.vmid} type={detail.type}
                      currentTags={tags} suggestions={[]} onApplied={(next) => { localTags = next; invalidateAll(); }} />
          </div>
        </Card>

        <Card class="p-6">
          <h3 class="text-[13px] font-medium text-muted-foreground mb-3">Notes</h3>
          <MarkdownNotes clusterId={detail.cluster_id} vmid={detail.vmid} type={detail.type}
                         notes={notes}
                         onApplied={(n) => { localNotes = n; invalidateAll(); }} />
        </Card>
      </div>
    </Tabs.Content>

    <Tabs.Content value="activity">
      <div class="mt-6">
        <a href={`/audit?cluster_id=${detail.cluster_id}&vmid=${detail.vmid}`} class="text-primary hover:underline text-[14px]">View in global audit log →</a>
        <p class="mt-4 text-muted-foreground text-[14px]">Per-VM activity feed integrates with the audit log — Plan 02-06 mounts the AuditTable here with locked filters (cluster_id={detail.cluster_id}, vmid={detail.vmid}).</p>
      </div>
    </Tabs.Content>
  </Tabs.Root>
{/if}
```

Step 8 — `frontend/src/routes/inventory/[cluster]/[vmid]/activity/+page.svelte` (NEW — minimal route stub that redirects to the parent tab):
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  onMount(() => {
    const { cluster, vmid } = $page.params;
    goto(`/inventory/${cluster}/${vmid}#activity`, { replaceState: true });
  });
</script>
<p class="text-muted-foreground text-[14px]">Redirecting to Activity tab…</p>
```
  </action>
  <verify>
    <automated>cd frontend && pnpm install && pnpm run check && pnpm run build</automated>
  </verify>
  <acceptance_criteria>
    - `ls frontend/src/routes/inventory/+page.svelte frontend/src/routes/inventory/+page.server.ts frontend/src/routes/inventory/\[cluster\]/\[vmid\]/+page.svelte frontend/src/routes/inventory/\[cluster\]/\[vmid\]/+page.server.ts` shows all four files exist.
    - `grep -n "import ClusterSection" frontend/src/routes/inventory/+page.svelte` returns 1 match.
    - `grep -n "import FilterChip" frontend/src/routes/inventory/+page.svelte` returns 1 match.
    - `grep -n "import TagPill" frontend/src/routes/inventory/+page.svelte` returns 1 match.
    - `grep -nE "Accordion\\.Root|Accordion\\.Item|Accordion\\.Trigger|Accordion\\.Content" frontend/src/lib/components/inventory/ClusterSection.svelte` returns at least 4 matches.
    - `grep -nE 'STATUS_ORDER|STATUS_ICON' frontend/src/routes/inventory/+page.svelte` returns at least 2 matches (default sort + status icon).
    - `grep -n "Tabs.Root" frontend/src/routes/inventory/\[cluster\]/\[vmid\]/+page.svelte` returns 1 match.
    - `grep -n "MarkdownNotes" frontend/src/routes/inventory/\[cluster\]/\[vmid\]/+page.svelte` returns at least 1 match.
    - `grep -n "TagInput" frontend/src/routes/inventory/\[cluster\]/\[vmid\]/+page.svelte` returns at least 1 match.
    - `grep -n "Sparkline" frontend/src/routes/inventory/\[cluster\]/\[vmid\]/+page.svelte` returns at least 1 match (used 4 times in Metrics card).
    - `grep -n "DOMPurify.sanitize" frontend/src/lib/utils/markdown.ts` returns 1 match (carry-over from Task 1).
    - `grep -nE "renderMarkdown" frontend/src/lib/components/inventory/MarkdownNotes.svelte` returns at least 1 match.
    - `cd frontend && pnpm run check` exits 0 (no TypeScript errors).
    - `cd frontend && pnpm run build` exits 0.
  </acceptance_criteria>
  <done>
    - /inventory list page renders flat OR Accordion-sectioned based on cluster count.
    - Filter state lives in URL params; back/forward works.
    - Detail page tabbed with Overview (Specs/Network/Metrics/Tags/Notes) + Activity stub.
    - TagInput + MarkdownNotes optimistic mutate paths working; rollback on error verified visually (manual smoke at Plan 02-07).
    - All Phase 1 frontend tests + new component tests still green.
    - Production build clean.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → SvelteKit server → FastAPI | All UI fetches funnel via api.inventory; same-origin via Caddy. |
| Browser DOM ← markdown render | PVE description is user-controlled; rendered via DOMPurify allow-list. |
| Browser localStorage ← cluster context | Trusted-self storage; no cross-origin risk. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-05-01 | Tampering / XSS | Notes markdown executes script | mitigate | renderMarkdown uses marked + DOMPurify with strict allow-list `[p,br,strong,em,h1-h4,ul,ol,li,code,pre,blockquote,a]` and attr `[href,title]`; `ALLOW_DATA_ATTR: false`. Unit tests in `markdown.test.ts` cover `<script>`, `<iframe>`, `on*=` handlers, and `javascript:` URLs. |
| T-02-05-02 | Tampering | Tag input bypasses regex via paste | mitigate | TagInput.addTag re-validates with `/^[a-z0-9_-]+$/` on submit; server-side PVE_TAG_RE rejects anything that escapes. Inline error surfaces invalid input. |
| T-02-05-03 | Information Disclosure | localStorage cluster context leaks across users on shared machine | accept | localStorage scoped to origin; shared-machine threat is out of scope per CONTEXT (single-tenant operator). Users sharing a browser is documented project anti-pattern. |
| T-02-05-04 | DoS | RRD fetch loop on tab switch | mitigate | `$effect` triggers RRD fetch only when `detail` changes (effect-tracking dependency); subsequent tab switches don't re-fetch. Backend caches at 30s TTL (Plan 02-01). |
| T-02-05-05 | Tampering | Locked filter chip on Activity tab is bypassed via URL edit | mitigate | The lockedFilters prop drives UI display; the BACKEND audit list endpoint applies its own RBAC + filter — even if user edits URL, server returns only their-scope rows. Tag-input `locked` prop is UI-only; defense-in-depth is server-side (Plan 02-02). |
| T-02-05-06 | Information Disclosure | 404 detail leaks existence on cross-tenant resource | mitigate | +page.server.ts converts 403 → 404 so URL probing can't distinguish "doesn't exist" vs "forbidden" (T-02-03-01 carry-through). |
| T-02-05-07 | Tampering | Optimistic tag override persists when API failed | mitigate | catch-block sets `localOverride = null` (revert) AND surfaces toast.error; the SSR data.list is the authoritative seed (Plan 01-09 SUMMARY pattern). |

ASVS L1 satisfied; XSS mitigation verified by unit tests.
</threat_model>

<verification>
- Both tasks' automated checks pass; pnpm run check + pnpm run build both clean.
- markdown.test.ts XSS regression suite green.
- tag-palette.test.ts palette-stability test green.
- cluster-context.test.ts localStorage test green.
- /inventory loads with seeded data (manual smoke in Plan 02-07).
- /inventory/{cluster}/{vmid} renders tabs and Overview cards correctly (manual smoke).
- Cross-tenant URL probe returns 404 (manual smoke + 02-07).
</verification>

<success_criteria>
- Sidebar "Resources" section added with Inventory + Audit log links.
- Topbar ClusterContextPicker replaces Phase 1 disabled select; QuotaIndicator slot reserved.
- ClusterStatusPill has 'stale' state.
- /inventory list with FilterChips + Sections + flat-when-1-cluster + sort + URL-state filtering.
- /inventory/{cluster}/{vmid} detail with tabs, Overview cards, RRD sparklines (hand-rolled SVG), Tags (TagPill + TagInput with autocomplete), Notes (MarkdownNotes with marked+DOMPurify).
- All XSS, palette, and cluster-context tests green.
- Production build clean.
</success_criteria>

<output>
After completion, create `.planning/phases/02-multi-cluster-inventory-quotas-audit/02-05-frontend-inventory-SUMMARY.md`:
- Files added/modified + new test count (markdown.test.ts + tag-palette.test.ts + cluster-context.test.ts)
- Whether `data.clusters` was already present in `+layout.server.ts` from Phase 1 or had to be added (impacts ClusterContextPicker)
- The exact shape passed to ClusterSection's `children` snippet so Plan 02-06 can reuse the pattern in /audit
- Any UI-SPEC clarifications surfaced during build (e.g. exact h-{N} for cards)
- The TagInput's suggestions prop — Phase 2 ships it empty; Plan 02-06 will populate from a future tag-aggregation backend OR keep empty for v1
</output>
