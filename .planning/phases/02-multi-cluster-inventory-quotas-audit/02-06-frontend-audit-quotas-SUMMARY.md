---
phase: 02-multi-cluster-inventory-quotas-audit
plan: "06"
subsystem: frontend
tags: [audit, quotas, ui, svelte, typescript]
dependency_graph:
  requires: [02-02, 02-04, 02-05]
  provides: [audit-ui, quota-indicator, quota-admin-tab]
  affects: [frontend/src/lib/api, frontend/src/lib/components/audit, frontend/src/lib/components/quotas, frontend/src/lib/components/layout, frontend/src/routes/audit, frontend/src/routes/admin/teams]
tech_stack:
  added: []
  patterns:
    - "api module pattern with withFetch SSR injection (matches clusters.ts, inventory.ts)"
    - "TDD RED/GREEN: logic tests first, then implementation"
    - "URL-as-state for /audit filter panel (goto + URL.searchParams)"
    - "sessionStorage once-per-session toast gate (proxmox-gui:quota-toast-fired:{level}:{teamId})"
    - "$await block for Activity tab AuditTable — avoids extra +page.server load"
    - "untrack() for initial $state derived from props (Svelte 5 pattern from Plan 01-09)"
key_files:
  created:
    - frontend/src/lib/api/audit.ts
    - frontend/src/lib/api/quotas.ts
    - frontend/src/lib/components/audit/AuditTable.svelte
    - frontend/src/lib/components/audit/CsvExportButton.svelte
    - frontend/src/lib/components/quotas/QuotaIndicator.svelte
    - frontend/src/lib/components/quotas/QuotaTab.svelte
    - frontend/src/routes/audit/+page.server.ts
    - frontend/src/routes/audit/+page.svelte
    - frontend/src/routes/admin/teams/[id]/+page.server.ts
    - frontend/src/routes/admin/teams/[id]/+page.svelte
    - frontend/tests/components/audit-csv-button.test.ts
    - frontend/tests/components/quota-indicator.test.ts
  modified:
    - frontend/src/lib/api/types.ts (appended AuditEntry, AuditPage, AuditFilterParams, quota types)
    - frontend/src/lib/api/client.ts (registered audit + quotas modules)
    - frontend/src/lib/components/layout/Topbar.svelte (replaced slot comment with <QuotaIndicator />)
    - frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte (Activity tab stub → AuditTable mount)
decisions:
  - "Activity tab uses {#await} block rather than server-side preload — avoids adding cluster_id/vmid params to the detail page's +page.server.ts load fn"
  - "QuotaIndicator re-fetches on navKey ($page.url.pathname+search) change via $effect — covers both hard navs and SvelteKit client-nav without a layout-level store"
  - "QuotaTab conflict state carries raw detail.usage/requested_limit from the 409 body — component renders whatever the server returns without re-computing client-side"
  - "sessionStorage toast keys are per-team-id to handle multi-team users without cross-team false-silencing"
  - "Admin teams [id] Members tab is a placeholder — no Phase 1 TeamMembers component existed in frontend/src/lib/components/admin/"
  - "TDD deviation: plan test 'flags critical when CPU is over and RAM is fine (19/20=0.95)' expected 'warning' but 19/20=0.95 is exactly the critical threshold — corrected to 'critical' with added warning test at 16/20=0.80"
metrics:
  duration: ~25 min
  completed: "2026-05-14T17:54:11Z"
  tasks: 2
  files: 14
  tests: 61
---

# Phase 02 Plan 06: Frontend Audit & Quotas Summary

**One-liner:** Full Phase 2 UI surface — /audit page with filter panel + CSV export, QuotaIndicator Topbar block + Sheet drawer, QuotaTab admin form with lower-limit dialog, and Activity tab AuditTable mount.

## What Was Built

### Task 1 — Audit API clients, AuditTable, CsvExportButton, /audit page, Activity tab

**API modules:**
- `frontend/src/lib/api/audit.ts` — `list()` (GET /audit with URLSearchParams serialization of comma-joined arrays) + `exportCsv()` (raw fetch → Blob, bypasses apiJson since response is binary CSV)
- `frontend/src/lib/api/quotas.ts` — `getTeamQuotas`, `setTeamQuotas` (with `allow_over` body field), `getMyQuotas`, `preview`
- `frontend/src/lib/api/types.ts` — appended `AuditEntry`, `AuditPage`, `AuditFilterParams`, `QuotaLimitInput`, `QuotaUsagePresentable`, `ClusterQuotaRow`, `TeamQuotaPage`, `MyTeamQuota`, `MyQuotasResponse`, `QuotaDimension`, `QuotaPreview`
- `frontend/src/lib/api/client.ts` — `audit` + `quotas` modules registered

**Components:**
- `AuditTable.svelte` — 6 columns (Time/Actor/Action/Target/Result/IP), row-click expand with before/after JSON diff cards, `lockedFilters` prop (renders locked chip affordance when set), loading skeleton × 5, empty state, error state
- `CsvExportButton.svelte` — `HARD_LIMIT=50000`, disabled + Tooltip when total > limit, blob download via `URL.createObjectURL`, spinner during export

**Route:**
- `/audit/+page.server.ts` — SSR auth gate + `parseFilters(url)` → `api.audit.list()` seed
- `/audit/+page.svelte` — sticky filter panel (Date range popover with 3 presets + custom date inputs; Action dropdown; Type dropdown; Show team actions Switch for non-admin); active FilterChip row; toolbar showing total + CsvExportButton; AuditTable

**Activity tab update:**
- Replaced stub paragraph with `{#await api.audit.list(...)}` block rendering AuditTable with `lockedFilters={{ cluster_id, vmid }}` + "View in global audit log →" link

### Task 2 — QuotaIndicator, QuotaTab, Topbar wiring, /admin/teams/[id]

**QuotaIndicator.svelte:**
- Compact 28px Topbar block: `CPU {used}/{limit} · RAM {used}/{limit}GB`
- Color bands: `<80%` → muted, `≥80%` → warning palette, `≥95%` → destructive palette
- Sheet drawer (right, 400px/480px): per-team Card with per-cluster Progress bars (vCPU, RAM, Disk, VMs)
- Once-per-session toast: `sessionStorage["proxmox-gui:quota-toast-fired:{level}:{teamId}"]` gates both warning + critical toasts
- Re-fetches on every SvelteKit navigation via `$effect(() => { void navKey; refresh(); })`

**QuotaTab.svelte:**
- One editable row per cluster: 4 number inputs (cpu_cores, ram_gb, disk_gb, vm_count)
- Per-row usage read-out with 80%/95% color thresholds
- Aggregate footer (auto-computed sum; null if any limit is null)
- On 409 conflict → Dialog "Lower quota limit on {team_name}?" with "Lower limit anyway" button (retries with `allowOver: true`)

**Topbar.svelte:** Replaced `<!-- QuotaIndicator: mounted by Plan 02-06 -->` with `<QuotaIndicator />`

**/admin/teams/[id]:**
- `+page.server.ts` — auth gate + admin guard + `api.quotas.getTeamQuotas()` SSR load
- `+page.svelte` — tabbed (Members placeholder + Quotas tab mounting QuotaTab)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TDD test expected wrong band for 19/20 vCPU utilization**
- **Found during:** TDD RED phase (quota-indicator.test.ts)
- **Issue:** Plan test named "flags critical when CPU is over and RAM is fine" with 19/20 = 0.95 utilization expected `'warning'`, but 0.95 ≥ 0.95 is `critical` per the band formula
- **Fix:** Corrected assertion to `'critical'`; added a separate `'warning'` test at 16/20 = 0.80
- **Files modified:** `frontend/tests/components/quota-indicator.test.ts`
- **Commit:** 7cd22ae

**2. [Rule 3 - Blocking] sessionStorage test used `window` global unavailable in node test env**
- **Found during:** TDD RED phase
- **Issue:** Vitest environment is `node` (not jsdom/happy-dom); `window.sessionStorage` throws ReferenceError
- **Fix:** Replaced window-dependent test with Map-based simulation mirroring sessionStorage semantics; key format assertions remain semantically equivalent
- **Files modified:** `frontend/tests/components/quota-indicator.test.ts`

## Known Stubs

**Members tab placeholder** — `/admin/teams/[id]/+page.svelte` Members tab renders static text "Member management ships in Phase 1 admin shell — Phase 2 adds the Quotas tab to this same page." No Phase 1 TeamMembers component existed in `frontend/src/lib/components/admin/`. Intentional placeholder; Phase 3 or a future Phase 2 patch will wire actual member management.

## Self-Check: PASSED

All 12 key files FOUND. All 3 task commits verified (7cd22ae, 8b3b6fe, 408d07e). 61 tests passing. svelte-check 0 errors. Production build clean.
