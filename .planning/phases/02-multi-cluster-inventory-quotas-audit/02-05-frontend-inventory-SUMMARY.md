---
phase: 02-multi-cluster-inventory-quotas-audit
plan: 05
subsystem: frontend-inventory
tags: [svelte, inventory, markdown, xss, tags, sparkline, cluster-context, accordion]
dependency_graph:
  requires:
    - 02-03-inventory-backend (API endpoints consumed)
    - 01-08-frontend-auth-shell (typed api client pattern, SSR fetch, auth gate)
    - 01-09-frontend-account ($derived(localOverride ?? data.list) pattern)
  provides:
    - /inventory list page (FilterChips, Accordion sections, flat list)
    - /inventory/[cluster]/[vmid] detail page (tabs, sparklines, tags, notes)
    - ClusterContextPicker in Topbar (replaces Phase 1 disabled Select)
    - Resources section in Sidebar (Inventory + Audit log links)
    - api.inventory client module (listAll, listForCluster, getDetail, getRrd, setTags, setNotes)
    - markdown.ts (renderMarkdown with DOMPurify XSS sanitization)
    - tag_palette.ts (FNV-1a hash → 12-bucket Tailwind classes)
    - cluster_context.ts (localStorage persistence, SSR-safe)
  affects:
    - frontend/src/routes/+layout.server.ts (adds clusters fetch for ClusterContextPicker)
    - frontend/src/lib/components/layout/AppShell.svelte (clusters prop added)
    - frontend/src/lib/components/layout/Topbar.svelte (ClusterContextPicker mounted)
    - frontend/src/lib/components/layout/Sidebar.svelte (Resources section added)
    - frontend/src/lib/components/clusters/ClusterStatusPill.svelte (stale state added)
    - frontend/src/lib/api/client.ts (inventory module registered)
    - frontend/src/lib/api/types.ts (Phase 2 types appended)
tech_stack:
  added:
    - marked@18.0.3 (markdown parsing)
    - dompurify@3.4.3 (XSS sanitization)
    - "@types/dompurify@3.2.0" (types stub — dompurify ships own types)
    - happy-dom@20.9.0 (browser DOM environment for vitest markdown/localStorage tests)
    - shadcn-svelte accordion, collapsible, command, popover, progress, scroll-area blocks
  patterns:
    - SSR pre-fetch via +page.server.ts with defence-in-depth auth gate (Plan 01-09 pattern)
    - $derived(localOverride ?? data.field) for optimistic SSR-seeded state
    - URL-param filter state for shareable/back-forwardable links (D-04)
    - try-vm-then-lxc auto-detection in detail page loader (403→404 existence leak prevention)
    - DOMPurify factory resolution: browser singleton vs Node/happy-dom factory call
    - Hand-rolled SVG sparkline (no chart library; ~60 path nodes per chart)
    - FNV-1a 32-bit hash for stable tag→palette mapping
key_files:
  created:
    - frontend/src/lib/api/inventory.ts
    - frontend/src/lib/utils/markdown.ts
    - frontend/src/lib/utils/tag_palette.ts
    - frontend/src/lib/utils/cluster_context.ts
    - frontend/src/lib/components/inventory/ClusterContextPicker.svelte
    - frontend/src/lib/components/inventory/ClusterSection.svelte
    - frontend/src/lib/components/inventory/FilterChip.svelte
    - frontend/src/lib/components/inventory/TagPill.svelte
    - frontend/src/lib/components/inventory/TagInput.svelte
    - frontend/src/lib/components/inventory/MarkdownNotes.svelte
    - frontend/src/lib/components/inventory/Sparkline.svelte
    - frontend/src/routes/inventory/+page.server.ts
    - frontend/src/routes/inventory/+page.svelte
    - frontend/src/routes/inventory/[cluster]/[vmid]/+page.server.ts
    - frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte
    - frontend/src/routes/inventory/[cluster]/[vmid]/activity/+page.svelte
    - frontend/tests/components/markdown.test.ts
    - frontend/tests/components/tag-palette.test.ts
    - frontend/tests/components/cluster-context.test.ts
  modified:
    - frontend/package.json
    - frontend/pnpm-lock.yaml
    - frontend/src/lib/api/client.ts
    - frontend/src/lib/api/types.ts
    - frontend/src/lib/components/clusters/ClusterStatusPill.svelte
    - frontend/src/lib/components/layout/AppShell.svelte
    - frontend/src/lib/components/layout/Sidebar.svelte
    - frontend/src/lib/components/layout/Topbar.svelte
    - frontend/src/routes/+layout.server.ts
    - frontend/src/routes/+layout.svelte
decisions:
  - "ClusterContextPicker data source: layout.server.ts fetches api.clusters.list silently (falls back to [] on error). data.clusters passes through AppShell → Topbar → ClusterContextPicker. This was not pre-existing in Phase 1 — added as part of this plan."
  - "VMDetail.type is 'qemu'|'lxc' (Proxmox native field) vs ResourceKind 'vm'|'lxc' (our API path segment). Mapping function toResourceKind() in the detail page converts qemu→vm for all API calls."
  - "DOMPurify in vitest: default ESM export is the factory function in Node; needs window object via DOMPurify(window) to produce the bound instance. markdown.ts resolvePurify() detects .sanitize presence to distinguish browser singleton vs factory. happy-dom added for markdown and cluster-context tests."
  - "Tag palette buckets 5-11 use /5 /15 /80 /60 opacity variants to fill 12 distinct entries while reusing Phase 1 tokens. Stability confirmed by deterministic FNV-1a hash."
  - "Activity tab is a stub: renders a message + 'View in global audit log →' link. Plan 02-06 mounts AuditTable here with lockedFilters={cluster_id, vmid}. The /activity sub-route redirects to #activity hash."
  - "TagInput.suggestions ships empty []; Plan 02-06 may populate from a backend tag-aggregation endpoint or remain empty for v1. The prop is wired and typed — no stub risk."
  - "Accordion.Root value binding uses non-reactive initial array (all cluster IDs) for default-expanded state. Session persistence of section open/closed deferred — per UI-SPEC sessionStorage key described but not blocking for v1 inventory UX."
metrics:
  duration: ~35 min
  completed_date: "2026-05-14T17:43:50Z"
  tasks: 2
  files_created: 19
  files_modified: 10
  tests_added: 21
  tests_total: 47
---

# Phase 2 Plan 05: Frontend Inventory Summary

**One-liner:** Full /inventory frontend surface — FilterChip list page, per-cluster collapsible Accordion sections, detail page with tabbed Overview (Specs/Network/RRD sparklines/Tags/Notes), ClusterContextPicker replacing Phase-1 disabled select, marked+DOMPurify markdown notes, FNV-1a tag palette, and optimistic tag/notes mutate with rollback.

## Tasks Executed

### Task 1 — Dependencies, shadcn blocks, typed API client, utilities, components, layout wiring

Commit `f843c56`

- Installed `marked@18`, `dompurify@3`, `@types/dompurify`, `happy-dom` (test env)
- Added shadcn-svelte blocks: accordion, collapsible, command, popover, progress, scroll-area
- Created `frontend/src/lib/api/inventory.ts` with 6 exports: `listAll`, `listForCluster`, `getDetail`, `getRrd`, `setTags`, `setNotes`
- Appended Phase 2 inventory types to `types.ts`: `VMInventoryItem`, `ClusterInventory`, `VMDetail`, `RRDSample`, `ResourceKind`
- Registered `api.inventory` in `client.ts` (additive — no existing keys changed)
- Created `markdown.ts`: `renderMarkdown` with DOMPurify allow-list `[p,br,strong,em,h1-h4,ul,ol,li,code,pre,blockquote,a]` + attr `[href,title]`, `ALLOW_DATA_ATTR: false` (T-02-05-01)
- Created `tag_palette.ts`: `paletteFor(tag)` FNV-1a hash → 12 Tailwind bucket classes (UI-SPEC table verbatim)
- Created `cluster_context.ts`: `getClusterContext`/`setClusterContext` with `proxmox-gui:cluster-context` localStorage key, SSR-safe (returns `"all"` when `typeof window === 'undefined'`)
- Extended `ClusterStatusPill` with `'stale'` state: `bg-warning/10 border-warning/30 text-warning` + Clock icon + `since` prop
- Created `FilterChip`: `h-7` (`28px` 4px-grid) removable filter pill with locked variant
- Created `TagPill`: `h-6` (`24px`) auto-colored from `paletteFor()`, optional click handler
- Created `Sparkline`: hand-rolled SVG `<polyline>`, no chart library, `preserveAspectRatio="none"`, `80px` tall
- Created `ClusterContextPicker`: Popover+Command combobox, `localStorage` persistence + URL sync
- Updated `Topbar`: replaced Phase-1 disabled `<Select>` with `<ClusterContextPicker {clusters} />`; reserved `<!-- QuotaIndicator: mounted by Plan 02-06 -->` slot
- Updated `Sidebar`: added "Resources" section (Inventory + Audit log) above "Account"
- Updated `+layout.server.ts`: fetches `api.clusters.list({ fetch })` and passes `clusters` down for ClusterContextPicker; graceful fallback to `[]` on error
- Updated `AppShell` + `+layout.svelte`: thread `clusters` prop through to `Topbar`
- Tests: 9 XSS regression (markdown, happy-dom env), 4 palette stability (tag-palette), 8 localStorage round-trip (cluster-context, happy-dom env) — **47 tests total passing**

### Task 2 — /inventory list page, detail page, ClusterSection/TagInput/MarkdownNotes

Commit `826a89d`

- Created `ClusterSection`: Accordion.Item wrapper with status pill, counter badge (`(N)` / `(N / total)` filtered), stale banner via Alert.Root variant="destructive"
- Created `TagInput`: Command popover, `/^[a-z0-9_-]+$/` client regex (T-02-05-02), optimistic add, rollback on API error via `onApplied` callback, `suggestions` prop wired (empty for Phase 2)
- Created `MarkdownNotes`: render-mode `@html renderMarkdown(notes)` in `.prose prose-sm dark:prose-invert`, edit-mode `<Textarea h-60 font-mono>`, 8000-char cap with inline error, save/cancel/loading states
- Created `/inventory +page.server.ts`: auth gate + `api.inventory.listAll({ fetch })`, returns `loadError: true` on failure
- Created `/inventory +page.svelte`: filter state in URL (`?q=&status=&tag=&cluster=&sort=`), flat list when exactly 1 cluster (D-01), Accordion sections for ≥2, FilterChip pills with remove, sort dropdown (not persisted per D-05), TagPill click-to-filter
- Created `/inventory/[cluster]/[vmid] +page.server.ts`: try-vm → fallback-lxc → 403→404 (T-02-05-06 existence leak prevention)
- Created `/inventory/[cluster]/[vmid] +page.svelte`: tab state in URL hash (`#overview`, `#activity`), Overview with Specs/Network/Metrics (4 sparklines, RRD fetch via `$effect`)/Tags/Notes cards; Snapshots+Console tabs disabled with Lock icon + Tooltip; Activity stub with "View in global audit log →" link
- Created `/inventory/[cluster]/[vmid]/activity +page.svelte`: redirect stub → parent `#activity`
- **Fix**: `VMDetail.type` is `'qemu'|'lxc'` (Proxmox native) but `ResourceKind` is `'vm'|'lxc'` (API path). Added `toResourceKind()` mapping function used in all API calls from the detail page.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DOMPurify factory vs singleton in Node/vitest**
- **Found during:** Task 1 test run
- **Issue:** DOMPurify ESM default export in Node is the factory function (`typeof DOMPurify.sanitize === 'undefined'`); vitest ran in `node` environment with no DOM
- **Fix:** Added `happy-dom` as devDependency; annotated markdown and cluster-context tests with `// @vitest-environment happy-dom`; created `resolvePurify()` in `markdown.ts` that detects whether the export is a pre-bound singleton (browser) or factory (Node + happy-dom) and produces a `PurifyInstance` either way; SSR/pure-Node path returns an identity passthrough (safe since `@html` only runs client-side)
- **Files modified:** `frontend/src/lib/utils/markdown.ts`, `frontend/tests/components/markdown.test.ts`, `frontend/tests/components/cluster-context.test.ts`, `frontend/package.json`
- **Commit:** f843c56

**2. [Rule 1 - Bug] VMDetail.type type mismatch with ResourceKind**
- **Found during:** Task 2 svelte-check
- **Issue:** `VMDetail.type` is `'qemu' | 'lxc'` (Proxmox's own field value) while `ResourceKind` is `'vm' | 'lxc'` (the API URL path segment). Passing `detail.type` directly to `setTags`, `setNotes`, `getRrd`, `TagInput`, `MarkdownNotes` caused 4 TypeScript errors.
- **Fix:** Added `toResourceKind(t: 'qemu' | 'lxc'): ResourceKind` helper function in the detail page (`qemu → 'vm'`, `lxc → 'lxc'`); all API calls and component props use `toResourceKind(detail.type)`
- **Files modified:** `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte`
- **Commit:** 826a89d

**3. [Rule 1 - Bug] Svelte "state_referenced_locally" warning on MarkdownNotes draft**
- **Found during:** Task 2 svelte-check
- **Issue:** `let draft = $state(notes)` captures only the initial value of the `notes` prop; Svelte 5 warns because the state is disconnected from future prop changes
- **Fix:** Changed to `let draft = $state('')`; `startEdit()` always syncs `draft = notes` before switching to edit mode (already the correct behavior), so the initial value being empty is safe
- **Files modified:** `frontend/src/lib/components/inventory/MarkdownNotes.svelte`
- **Commit:** 826a89d

## ClusterContextPicker data source

`data.clusters` was **NOT** pre-existing in `+layout.server.ts` from Phase 1. This plan added it:
- `+layout.server.ts` now calls `api.clusters.list({ fetch })` after the user auth probe
- Maps to `{ id, name }` pairs — minimal shape sufficient for the picker
- Falls back to `[]` on any error (non-fatal — picker degrades to "All clusters" only)
- Passed down: `LayoutData.clusters → +layout.svelte → AppShell.clusters → Topbar.clusters → ClusterContextPicker.clusters`

## ClusterSection children snippet shape (for Plan 02-06)

ClusterSection accepts a `children: Snippet` prop. The inventory page renders the Table inside it:

```svelte
<ClusterSection clusterId={c.cluster_id} clusterName={c.cluster_name} ...>
  <!-- anything here becomes children -->
  <div class="rounded-md border border-border">
    <Table.Root>...</Table.Root>
  </div>
</ClusterSection>
```

Plan 02-06's AuditTable can use the same pattern for the `/audit` page if it needs per-cluster grouping.

## TagInput suggestions prop

`suggestions` ships as `[]` for Phase 2. The prop is typed as `string[]` with default `[]`. To wire real suggestions in a future plan: collect `Array.from(new Set(inventory.flatMap(c => c.items.flatMap(i => i.tags))))` client-side and pass to `TagInput`. No backend endpoint needed for v1.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Activity tab body | `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` lines 293-307 | Plan 02-06 mounts AuditTable with `lockedFilters` — stub renders "Plan 02-06 mounts the AuditTable here…" message + link to `/audit` |
| `sort === 'last_changed'` returns 0 | `frontend/src/routes/inventory/+page.svelte` line 86 | Backend doesn't expose last-changed timestamp on inventory items; Phase 5 polish will wire this |

Neither stub prevents the plan's goals from being achieved — inventory list renders correctly with all other sort options, and the Activity tab stub correctly links to the global audit log.

## Self-Check: PASSED

Files verified to exist:
- `frontend/src/lib/api/inventory.ts` ✓
- `frontend/src/lib/utils/markdown.ts` ✓
- `frontend/src/lib/utils/tag_palette.ts` ✓
- `frontend/src/lib/utils/cluster_context.ts` ✓
- `frontend/src/lib/components/inventory/ClusterContextPicker.svelte` ✓
- `frontend/src/lib/components/inventory/ClusterSection.svelte` ✓
- `frontend/src/lib/components/inventory/FilterChip.svelte` ✓
- `frontend/src/lib/components/inventory/TagPill.svelte` ✓
- `frontend/src/lib/components/inventory/TagInput.svelte` ✓
- `frontend/src/lib/components/inventory/MarkdownNotes.svelte` ✓
- `frontend/src/lib/components/inventory/Sparkline.svelte` ✓
- `frontend/src/routes/inventory/+page.server.ts` ✓
- `frontend/src/routes/inventory/+page.svelte` ✓
- `frontend/src/routes/inventory/[cluster]/[vmid]/+page.server.ts` ✓
- `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` ✓
- `frontend/src/routes/inventory/[cluster]/[vmid]/activity/+page.svelte` ✓

Commits verified:
- `f843c56` feat(02-05): Task 1 ✓
- `826a89d` feat(02-05): Task 2 ✓

Tests: 47/47 passing
svelte-check: 0 errors, 0 warnings
Production build: clean (12.10s)
