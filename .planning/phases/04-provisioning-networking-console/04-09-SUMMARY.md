---
phase: 04-provisioning-networking-console
plan: 09
subsystem: frontend-api-foundation
tags: [frontend, api-client, shared-components, typescript, svelte]
requires:
  - "Wave-2 backend routes (Plans 04-04..08): provisioning, catalog, networks, iso, console"
  - "frontend/src/lib/api/client.ts api namespace (Plan 01-08+)"
  - "frontend/src/lib/api/lifecycle.ts module template (Plan 03-05/06/07)"
provides:
  - "Five typed Phase-4 API client modules (provisioning, catalog, networks, iso, console)"
  - "ProvisioningJobAccepted type carrying the reserved vmid (D-04)"
  - "EmptyState shared primitive (UI-04)"
  - "HelpTooltip shared primitive (UI-05)"
  - "frontend/src/lib/api/index.ts api namespace re-export"
  - "/inventory Create button + zero-resources empty state"
affects:
  - "Plan 04-10 wizard shell (builds against the typed clients + EmptyState)"
  - "Plans 04-11/12/13 wizard steps (build against the typed clients + HelpTooltip)"
  - "Plan 04-14 (console/networks UI consume the console/networks clients)"
tech-stack:
  added: []
  patterns:
    - "Phase-4 API modules mirror lifecycle.ts verbatim (withFetch helper, MaybeFetch opts, apiJson<T>, per-fn JSDoc)"
    - "List-wrapper endpoints (iso) unwrap {isos:[...]} / {images:[...]} in the client so callers get a flat array"
    - "Shared primitives live under frontend/src/lib/components/shared/"
key-files:
  created:
    - frontend/src/lib/api/provisioning.ts
    - frontend/src/lib/api/catalog.ts
    - frontend/src/lib/api/networks.ts
    - frontend/src/lib/api/iso.ts
    - frontend/src/lib/api/console.ts
    - frontend/src/lib/api/index.ts
    - frontend/src/lib/components/shared/EmptyState.svelte
    - frontend/src/lib/components/shared/HelpTooltip.svelte
    - frontend/tests/empty-state.test.ts
  modified:
    - frontend/src/lib/api/types.ts
    - frontend/src/lib/api/client.ts
    - frontend/src/routes/inventory/+page.svelte
decisions:
  - "index.ts re-exports the api namespace + the five modules, while client.ts stays the canonical import surface — both ship so the plan's index.ts artifact requirement and the existing client.ts contract are satisfied"
  - "iso.listIsos / listCloudImages unwrap the backend {isos}/{images} envelope in the client so callers consume a flat array (matches the IsoItem[]/CloudImage[] plan signatures)"
  - "EmptyState gained a fullPage prop for the 3xl (64px) top margin the UI-SPEC pins for a fully-empty full-page list"
  - "HelpTooltip uses a popover (not a tooltip) when learnMoreHref is set — tooltip content is not reliably interactive, the Learn-more link must be clickable + tab-reachable"
metrics:
  duration: ~6 min
  completed: 2026-05-16
  tasks: 2
  files: 12
  tests: "18 new (157 frontend total)"
---

# Phase 4 Plan 09: Frontend API Foundation & Shared Primitives Summary

Five typed Phase-4 API client modules (provisioning, catalog, networks, iso, console) wired into the `api` namespace, plus the `EmptyState` (UI-04) and `HelpTooltip` (UI-05) shared primitives and the `/inventory` Create button + zero-resources empty state.

## What Shipped

**Task 1 — five typed API client modules + the appended Phase-4 types** (commit `5df1efc`)
- Appended the Phase-4 request/response types to `api/types.ts`, mirroring the shipped Wave-2 backend Pydantic schemas field-for-field: `NetworkConfigInput`, `CreateLxcRequest`, `CreateQemuRequest` (the discriminated `source_kind` union), `CommunityScriptRequest`, `ProvisioningJobAccepted`, `YamlLine`, `CloudInitFieldError`, `CloudInitVerdict`, `CloudInitForm`, `CloudInitPreviewResponse`, `CatalogEntry`, `CatalogListResponse`, `CatalogEntryResponse`, `CatalogSyncResponse`, `NetworkOption`, `NetworkPickerResponse`, `NetworkScopeResponse`, `NetworkScopeUpdate`, `IsoItem`, `CloudImage`, `IsoDownloadRequest`, `VncProxyResponse`.
- `ProvisioningJobAccepted extends JobAccepted` with `vmid: number` — matches the backend `ProvisioningJobAcceptedResponse`; the wizard routes to `/inventory/{cluster}/{vmid}` via `.vmid` (D-04).
- `api/provisioning.ts` — `createLxc` / `createQemu` / `createCommunityScript` (all → `ProvisioningJobAccepted`, 202) + `cloudinitPreview` (→ `CloudInitPreviewResponse`).
- `api/catalog.ts` — `listCatalog` (curated/full + `q`/`category` query) / `getCatalogEntry` / `syncCatalog`.
- `api/networks.ts` — `listNetworks` / `getTeamNetworkScope` / `setTeamNetworkScope`.
- `api/iso.ts` — `listIsos` / `listCloudImages` (both unwrap the backend envelope to a flat array) / `downloadIso` (→ 202 `JobAccepted`).
- `api/console.ts` — `mintVncProxy` (VM + LXC, picks the `vms`/`lxcs` segment from `kind`).
- `api/index.ts` re-exports the `api` namespace + the five modules; `api/client.ts` wires the five modules into the `api` namespace (`api.provisioning`, etc.).

**Task 2 — EmptyState + HelpTooltip primitives + /inventory Create entry** (commit `651e487`)
- `EmptyState.svelte` (UI-04): a centered, card-less block — 24px muted icon + Heading 18/600 + Body 14/400 muted + an optional primary CTA. The CTA renders only when both `ctaLabel` and `ctaHref` are present, and is a primary `Button` rendered as an `<a href>`. A `fullPage` prop adds the 3xl (64px) top margin.
- `HelpTooltip.svelte` (UI-05, D-25): a 14px `HelpCircle` icon inside a real focusable `<button type="button">` with an `aria-label` of `Help: <label>`. A plain tooltip for short text; a popover (with a clickable "Learn more" `ExternalLink` link, `variant="link"`, new tab) when `learnMoreHref` is set. The displayed content carries `role="tooltip"`. Keyboard-reachable.
- `/inventory/+page.svelte`: a primary "Create" button (`Plus` icon) right-aligned in the page header → `/create` (D-02 — no global topbar "+"); the zero-resources list renders the `EmptyState` with the pinned copy ("You have no VMs yet" / "Create your first VM or container to get started." / "Create one" → `/create`).
- `tests/empty-state.test.ts`: the EmptyState CTA-visibility contract, the HelpTooltip aria-label + tooltip-vs-popover variant-selection contract, and the Phase-4 API-module smoke test (every module imports, is reachable from the `api` namespace + `api/index`, and exports the expected typed function names).

## Verification

- `pnpm exec vitest run tests/empty-state.test.ts` — 18/18 pass.
- `pnpm test` — 15 test files, 139 tests pass (+18 new = 157 total; one pre-existing happy-dom iframe test logs an unrelated `ECONNREFUSED` to stderr but still passes).
- `pnpm exec svelte-check --threshold error` — 0 errors, 0 warnings (the five new API modules + the appended types + both primitives + the modified inventory page type-check cleanly against the shipped backend schemas).
- Icon allow-list: the new files use only `Plus`, `Boxes`, `HelpCircle`, `ExternalLink` — all within the cumulative Phase 1-4 allow-list.

Note on `tsc --noEmit`: the plan's verify command included `pnpm exec tsc --noEmit`. Raw `tsc` cannot resolve `*.svelte` module types and emits ~10 pre-existing `TS2614` errors against shadcn-svelte UI primitives (`alert`, `badge`, `button`, `tabs` index files) — these predate this plan and are out of scope. The project's real type-check is `svelte-check` (the `pnpm check` script), which understands `.svelte` files and is **clean**. None of the `tsc` errors touch any file created or modified by this plan (confirmed by grep).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] HelpTooltip `triggerClass` captured only the initial `className` prop value**
- **Found during:** Task 2 (`svelte-check` flagged `state_referenced_locally`)
- **Issue:** `triggerClass` was a plain `const` string-concatenating the `className` prop — Svelte 5 only captures the prop's initial value, so a later `class` prop change would not update the trigger styling.
- **Fix:** split the static base into `triggerBase` and made `triggerClass` a `$derived(`${triggerBase} ${className}`)`.
- **Files modified:** `frontend/src/lib/components/shared/HelpTooltip.svelte`
- **Commit:** `651e487`

### Interface adjustments (plan sketch vs. shipped backend)

- The plan sketched `index.ts` as "the api namespace" re-exporting the five modules. The actual canonical import surface is `client.ts` (every page uses `import { api } from '$lib/api/client'`). To satisfy both the plan's explicit `index.ts` artifact requirement **and** keep `client.ts` working, `index.ts` ships re-exporting the `api` namespace + the five modules, and `client.ts` was extended to wire the five modules into `api`. Not a behavior deviation — both files ship, both contracts hold.
- `iso.listIsos` / `listCloudImages` were typed in the plan as `→ IsoItem[]` / `→ CloudImage[]`, but the backend wraps them in `{isos: [...]}` / `{images: [...]}` envelopes. The client unwraps the envelope so callers get the flat array the plan specified.

## Self-Check: PASSED

- All 9 created files exist on disk; all 3 modified files updated.
- Both task commits present in `git log` (`5df1efc`, `651e487`).
- Zero file deletions in either commit.
