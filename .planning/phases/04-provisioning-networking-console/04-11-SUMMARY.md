---
phase: 04-provisioning-networking-console
plan: 11
subsystem: frontend-lxc-wizard
tags: [frontend, wizard, lxc, community-scripts, svelte, provisioning]
requires:
  - "Plan 04-10: the /create wizard shell + the orchestration surface + the wizardDraft store + wizard-model.ts"
  - "Plan 04-09: the typed api.catalog + api.provisioning clients + the EmptyState / HelpTooltip primitives"
  - "Plan 04-06: the community-scripts catalog backend (GET /catalog, POST /catalog/sync)"
  - "Plan 04-04: the provisioning backend (POST .../provisioning/lxc, .../community-script)"
provides:
  - "CatalogBrowser.svelte — the community-scripts catalog browser (curated + full-search + category filters)"
  - "ScriptDetailPanel.svelte — the LXC-04 pre-deploy disclosure panel (source/commit/last-reviewed + attribution)"
  - "LxcTemplateStep.svelte — the plain-LXC Source step (vztmpl template picker)"
  - "LxcResourcesStep.svelte — the LXC Resources step (sizing + LXC-07 toggles + a NodeSelect/QuotaDeltaLine mount slot)"
  - "lxc-wizard.ts — the framework-free LXC wizard logic (catalog filtering, D-07 option parse, request builders, validation)"
  - "/admin landing page hosting the admin Sync-catalog control (D-05)"
  - "The two LXC wizard paths wired into /create — plain-LXC + community-script, submitting to 202 jobs"
affects:
  - "Plan 04-12 (VM wizard steps — owns the shared NodeSelect + QuotaDeltaLine that enrich LxcResourcesStep's marked mount slots; the Network step body)"
tech-stack:
  added: []
  patterns:
    - "LXC wizard logic lives in a framework-free lxc-wizard.ts so it is unit-testable in the node vitest env (the 04-10 wizard-model.ts discipline)"
    - "Wizard step components that need a list with no API yet take it as a prop with a free-text Input fallback — never hard-block the wizard"
    - "The LxcResourcesStep ships marked mount slots for Plan 04-12's NodeSelect / QuotaDeltaLine so 04-12 enriches it WITHOUT re-editing the file (no cross-wave file overlap)"
key-files:
  created:
    - frontend/src/lib/components/wizard/CatalogBrowser.svelte
    - frontend/src/lib/components/wizard/ScriptDetailPanel.svelte
    - frontend/src/lib/components/wizard/LxcTemplateStep.svelte
    - frontend/src/lib/components/wizard/LxcResourcesStep.svelte
    - frontend/src/lib/components/wizard/lxc-wizard.ts
    - frontend/src/routes/admin/+page.svelte
    - frontend/src/routes/admin/+page.server.ts
    - frontend/tests/lxc-wizard.test.ts
  modified:
    - frontend/src/routes/create/+page.svelte
decisions:
  - "The catalog browser uses the `command` primitive's Input as the search box with shouldFilter=false — the card-grid filtering is driven by lxc-wizard.ts's filterCatalog so the predicate is unit-testable and the catalog data is fetched once per view"
  - "LxcTemplateStep / LxcResourcesStep take their node/storage/template lists as props with a free-text Input fallback — no wizard-facing node/template/storage API exists in Phase 4, so the components ship working with a graceful degradation rather than hard-blocking"
  - "team_id is resolved in the /create route (defaults to the user's personal team); LxcResourcesStep shows an owning-team Select only when the user belongs to more than one team — team_id is a required create-body field with no UI in the plan's Resources contract (Rule 2)"
  - "The admin Sync-catalog control mounts on a NEW /admin landing page — the plan named `admin/+page.svelte` but the admin area had only sub-pages (users/teams/clusters) and no index; the new index is admin-gated and links to the sub-pages"
metrics:
  duration: ~11 min
  completed: 2026-05-16
  tasks: 2
  files: 9
  tests: "37 new (208 frontend total)"
---

# Phase 4 Plan 11: Frontend LXC Wizard Steps Summary

The two LXC wizard paths — plain LXC (from a vztmpl) and Community Script —
including the community-scripts catalog browser, the LXC-04 mandatory
pre-deploy disclosure panel, the LXC-07 container-option toggles, and the
admin Sync-catalog control. Both paths plug into the 04-10 wizard shell and
submit through the 04-06 catalog + 04-04 provisioning backends.

## What Shipped

**Task 1 — the catalog browser + the LXC-04 script-detail panel** (commit `6d3eb76`)
- `lxc-wizard.ts` — the framework-free heart of the LXC wizard, extracted so
  the logic is unit-testable in the `node` vitest env:
  - `lxcStepsForPath` — the path-conditional LXC step list (`Path → Source →
    Resources → Network → Review`; the Cloud-Init step is absent).
  - `curatedEntries` / `catalogCategories` / `filterCatalog` — the catalog
    browsing logic: the curated-shortlist split (LXC-01), the unique category
    set, and the case-insensitive name/description + category filter (LXC-02).
  - `scriptAttribution` — the LXC-04 disclosure block (`source_url` /
    `commit_sha` / `last_reviewed`).
  - `parseScriptOptions` — the D-07 configurable-option parser: it surfaces
    scalar tunables under any `options`/`config`/`params` bag on an
    `install_method`, and falls back to `parsed: false` (a defaults-only
    deploy) when no machine-readable options exist.
  - `LXC_RESOURCE_DEFAULTS` / `LXC_FEATURE_FLAGS` — the LXC-07 toggle defaults
    (unprivileged ON, nesting OFF, keyctl/fuse features).
  - `validateLxcStep` / `lxcStepValid`, `buildLxcRequest` /
    `buildCommunityScriptRequest`, and `mapLxcCreateError` (the 409-inline
    error mapper) — used by Task 2.
- `CatalogBrowser.svelte` — the community-scripts catalog browser. A
  "Curated / Full catalog" toggle: the curated view (default, LXC-01) renders
  the `featured` entries as a grid of 96px cards (Rocket icon + name Body
  14/600 + category `badge`s + a one-line description); the full view (LXC-02)
  adds a `command` search box and `Tag`-icon `badge` category filter chips.
  Calls `api.catalog.listCatalog` once per view, filters client-side via
  `filterCatalog`. A no-search-match renders the shared `EmptyState`. Clicking
  a card opens the `ScriptDetailPanel`.
- `ScriptDetailPanel.svelte` — the LXC-04 mandatory pre-deploy disclosure
  `dialog`. Shows the script source (`ExternalLink`-icon GitHub link), the
  pinned commit (Mono 13/400, `GitCommitHorizontal` icon), and the
  last-reviewed date (`CalendarCheck` icon) — all from the active catalog pin
  (refined by `api.catalog.getCatalogEntry`, falling back to the entry-level
  attribution on a fetch failure). A `bg-muted` attribution notice with the
  `ShieldQuestion` icon carries the verbatim Copywriting-Contract copy. When
  the D-07 parse succeeds it renders the configurable-option form fields; when
  it cannot it shows the `bg-warning/10` "options couldn't be read —
  defaults-only" notice (T-04-11-01).
- `/admin/+page.svelte` + `/admin/+page.server.ts` — a new admin landing page
  (the admin area previously had only sub-pages). It is admin-gated
  (defence-in-depth, T-04-11-02) and hosts the "Sync catalog" control — a
  `RefreshCw`-icon button calling `api.catalog.syncCatalog`, showing the
  `{added, updated, commit_sha}` re-pin summary. It also links to the existing
  Users / Teams / Clusters sub-pages.

**Task 2 — the plain-LXC wizard steps + the two LXC paths wired into /create** (commit `de41667`)
- `LxcTemplateStep.svelte` — the plain-LXC "Source" step (heading "Pick a
  container template"): a `Select` of the cluster's `content=vztmpl`
  templates, with a free-text `Input` fallback when no list is wired. `Next`
  is gated by `validateLxcStep('source', 'plain-lxc', …)`.
- `LxcResourcesStep.svelte` — the LXC "Resources" step (LXC-06/07): a
  target-node `Select`, a storage `Select`, and CPU-cores / Memory-MB /
  Disk-GB number inputs; the LXC-07 toggles — "Unprivileged container"
  (`Switch`, default **ON**), "Nesting" (`Switch`, default off), and a
  "Features" `Checkbox` group (keyctl, fuse). Every PVE-specific field carries
  a `HelpTooltip` (D-25). An owning-team `Select` appears only when the user
  belongs to more than one team. The file carries two clearly-marked mount
  slots for Plan 04-12's `NodeSelect` (node-fit) and `QuotaDeltaLine` (the
  live quota-delta line).
- `/create/+page.svelte` — wires the two LXC paths into the 04-10
  orchestration surface. The plain-LXC path mounts `LxcTemplateStep` →
  `LxcResourcesStep` → Network (placeholder, owned by 04-12) → Review; the
  community-script path mounts `CatalogBrowser`/`ScriptDetailPanel` as the
  Source step → `LxcResourcesStep` → Network → Review. The form bag is
  mirrored into typed locals and persisted via `wizardDraft.patchFormData`.
  The Review step is a read-only summary `dl` with an "Edit details" link; its
  terminal CTA ("Create container" / "Deploy script") calls
  `api.provisioning.createLxc` / `createCommunityScript`, and on the 202
  routes to `/inventory/{cluster}/{vmid}` (D-04) via `inventoryPathForJob` and
  fires the `sonner` toast. A 409/4xx surfaces inline through
  `mapLxcCreateError` without navigating away (T-04-11-03).
- `lxc-wizard.test.ts` — 37 logic tests: the catalog curated/full split, the
  search + category filter, the LXC-04 attribution block, the D-07
  option-parse + fallback, the path-conditional step list, the LXC-07 toggle
  defaults, `validateLxcStep`, `buildLxcRequest` / `buildCommunityScriptRequest`,
  and the 409-inline-error mapping.

## Verification

- `pnpm test -- --run lxc-wizard` — `tests/lxc-wizard.test.ts` 37/37 pass.
- `pnpm test` — 17 test files, 208 tests pass (+37 new vs the 171 04-10
  baseline; one pre-existing happy-dom iframe test logs an unrelated
  `ECONNREFUSED` to stderr but still passes).
- `pnpm exec svelte-check --threshold error` — 0 errors, 0 warnings (the
  project's authoritative type-check — all five new components, the helper
  module, the admin page + loader, and the wired `/create` route type-check
  cleanly).
- Icon allow-list: the new files use only `Rocket`, `Tag`, `SearchX`,
  `ExternalLink`, `GitCommitHorizontal`, `CalendarCheck`, `ShieldQuestion`,
  `TriangleAlert`, `RefreshCw`, `Users`, `UsersRound`, `Server`, `Boxes` —
  all within the cumulative Phase 1-4 allow-list (`SearchX`/`TriangleAlert`
  are standard lucide search/warning icons in the Phase-4 set).

Note on `tsc --noEmit`: as Plans 04-09/04-10 documented, raw `tsc` cannot
resolve `*.svelte` module types and emits exactly 10 pre-existing `TS2614`
errors against the shadcn-svelte UI primitive index files — these predate
this plan and are out of scope. There are **zero** non-`TS2614` `tsc` errors,
and none of the `TS2614` errors touch any file created or modified by this
plan. The project's real type-check is `svelte-check`, which is clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `ScriptDetailPanel`'s `attribution` `$state` captured only the initial `entry`**
- **Found during:** Task 1 (`svelte-check` flagged `state_referenced_locally`)
- **Issue:** `attribution` was seeded as `$state(scriptAttribution(entry))` —
  Svelte 5 only captures a prop's initial value, so re-rendering the panel
  with a different `entry` (a new card) would keep the stale attribution.
- **Fix:** Split it into a nullable `attributionOverride` `$state` (the
  detail-fetch refinement) and a `$derived` `attribution` that always reflects
  the current `entry` — so a card swap re-derives the LXC-04 fields and the
  fetch override is layered on top.
- **Files modified:** `frontend/src/lib/components/wizard/ScriptDetailPanel.svelte`
- **Commit:** `6d3eb76`

**2. [Rule 3 — Blocking] No wizard-facing API for node / storage / vztmpl-template lists**
- **Found during:** Task 2 (building `LxcTemplateStep` / `LxcResourcesStep`)
- **Issue:** The plan's Resources/Template steps need a node `Select`, a
  storage `Select`, and a vztmpl template `Select`, but Phase 4 ships no
  team-scoped API exposing those lists (`api.clusters.*` is admin-gated; the
  inventory only carries existing-resource node names).
- **Fix:** `LxcTemplateStep` and `LxcResourcesStep` take their option lists as
  props (`templates`, `nodes`, `storages`) and render a `Select` when the list
  is non-empty, falling back to a free-text `Input` when it is empty — so the
  wizard is never hard-blocked and the values are still validated server-side
  on create. Wiring a populated list is a clean follow-on once a team-scoped
  catalog endpoint exists.
- **Files modified:** `LxcTemplateStep.svelte`, `LxcResourcesStep.svelte`,
  `create/+page.svelte`
- **Commit:** `de41667`

**3. [Rule 2 — Missing critical functionality] `team_id` had no UI**
- **Found during:** Task 2 (`createLxc` / `createCommunityScript` require a
  `team_id` in the body)
- **Issue:** The plan's Resources-step contract names no team picker, but
  `team_id` is a required create-body field.
- **Fix:** The `/create` route resolves `team_id` from `data.user.teams`
  (defaulting to the user's personal team); `LxcResourcesStep` renders an
  owning-team `Select` only when the user belongs to more than one team.
- **Files modified:** `LxcResourcesStep.svelte`, `create/+page.svelte`
- **Commit:** `de41667`

### Interface adjustments (plan sketch vs. shipped reality)

- **The admin Sync-catalog control mounts on a NEW `/admin` landing page.**
  The plan's `files_modified` named `frontend/src/routes/admin/+page.svelte`
  as a modification, but the admin area had only sub-pages
  (`users`/`teams`/`clusters`) and no index route. The UI-SPEC explicitly
  allowed "an admin catalog page or the admin area" — a new admin-gated
  `/admin` landing page was created (plus its `+page.server.ts` loader) to
  host the control and link to the sub-pages. Net effect matches the plan.
- **The Network step body is a placeholder for the LXC paths.** The plan
  notes the Network step is owned by Plan 04-12 (the shared SDN-aware
  picker). This plan's LXC paths render an honest placeholder for the
  `network` step; the create body sends `network: null` so the backend
  applies the cluster default NIC. 04-12 plugs the real picker in.
- **Tests are logic-only, not component-render tests.** The plan's behavior
  blocks describe "component-render tests with mocked `api.catalog`". The
  established project pattern (the vitest env is `node` — `.svelte` files
  cannot be mounted; confirmed by Plans 04-09/04-10's test suites) is to test
  the extracted pure logic and let `svelte-check` exercise the rendered
  props/markup. `lxc-wizard.ts` holds every DOM-free decision, and the 37
  tests exercise it directly — this IS the rendered code's logic.

## Notes for Plan 04-12

- `LxcResourcesStep.svelte` carries two clearly-commented mount slots — one
  in the node-`Select` block for the shared `NodeSelect` (node-fit), one
  after the sizing grid for `QuotaDeltaLine`. Plan 04-12 should wire those
  WITHOUT re-editing `LxcResourcesStep.svelte` (it is in 04-11's
  `files_modified` only — no cross-wave file overlap). The cleanest path: a
  04-12 wrapper, or 04-12 owns upgrading the node picker — pick whichever the
  04-12 plan specifies; `LxcResourcesStep` already accepts `nodes` as a prop.
- The `/create` route's Network step renders a placeholder for the LXC paths
  — 04-12 should switch on `activeStepId === 'network'` and render the shared
  picker there.

## Self-Check: PASSED

- All 8 created files exist on disk (`CatalogBrowser.svelte`,
  `ScriptDetailPanel.svelte`, `LxcTemplateStep.svelte`,
  `LxcResourcesStep.svelte`, `lxc-wizard.ts`, `admin/+page.svelte`,
  `admin/+page.server.ts`, `lxc-wizard.test.ts`); `create/+page.svelte`
  modified.
- Both task commits present in `git log` (`6d3eb76`, `de41667`).
- Zero file deletions in either commit (`git diff --diff-filter=D` empty for
  both).
