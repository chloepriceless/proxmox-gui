---
phase: 03-job-queue-lifecycle
plan: 06
subsystem: ui
tags: [svelte, sveltekit, snapshots, resize, clone, migrate, lifecycle, bulk-actions, shadcn]

# Dependency graph
requires:
  - phase: 03-job-queue-lifecycle
    provides: snapshot/resize/clone/migrate/convert-template 202 backend routes (Plans 03-03/03-04), frontend job infra — api/lifecycle, jobs store, Tasks drawer, ActionToolbar, ConfirmByNameDialog, PowerConfirmDialog (Plan 03-05)
  - phase: 02-multi-cluster-inventory-quotas-audit
    provides: api client EXTENSION CONTRACT, inventory list + VM detail page + tab strip, ClusterSection, hand-rolled Sparkline precedent
  - phase: 01-foundation
    provides: apiJson/apiFetch CSRF-aware fetch wrapper, ConfirmByNameDialog, sonner Toaster, shadcn-svelte primitives, svelte-check pipeline
provides:
  - hand-rolled recursive SnapshotTree (no tree-view npm dependency) + a pure snapshot-tree builder module
  - Snapshots tab filling the formerly-disabled Phase 2 placeholder on the VM detail page
  - SnapshotCreateDialog + the snapshot restore/delete typed-name confirm wiring
  - ResizeDialog (hotplug reboot warnings + disk-shrink block), CloneDialog, MigrateDialog (bwlimit in an Advanced disclosure), ConvertTemplateDialog
  - ActionToolbar "More" menu wired to all five lifecycle dialogs (Convert disabled for LXC)
  - inventory list per-row power menu + bulk-select bar (Start/Stop/Reboot) fanning out one job per VM
affects: [03-07-backups-frontend, 04 provisioning lifecycle UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-rolled recursive tree: a {#snippet} that renders itself for each node's children — D-05, no tree-view library, mirrors the Phase 2 hand-rolled Sparkline"
    - "Extract-pure-logic-for-test: tree building lives in snapshot-tree.ts so it is unit-testable in the node vitest env without mounting the Svelte component"
    - "Form dialog convention: shadcn dialog + a busy $state guard + $effect reset-on-open + bindable open prop (matches Plan 05 PowerConfirmDialog)"
    - "Node list derived from inventory: with no dedicated node endpoint, Clone/Migrate derive the unique node set from the cluster inventory rows"
    - "Bulk-select via a shared row {#snippet}: one inventoryRow snippet feeds both the single-cluster and accordion views, with a checkbox column gated on bulkMode"

key-files:
  created:
    - frontend/src/lib/components/lifecycle/SnapshotTree.svelte
    - frontend/src/lib/components/lifecycle/snapshot-tree.ts
    - frontend/src/lib/components/lifecycle/SnapshotsTab.svelte
    - frontend/src/lib/components/lifecycle/SnapshotCreateDialog.svelte
    - frontend/src/lib/components/lifecycle/ResizeDialog.svelte
    - frontend/src/lib/components/lifecycle/CloneDialog.svelte
    - frontend/src/lib/components/lifecycle/MigrateDialog.svelte
    - frontend/src/lib/components/lifecycle/ConvertTemplateDialog.svelte
    - frontend/tests/snapshot-tree.test.ts
  modified:
    - frontend/src/lib/api/types.ts
    - frontend/src/lib/api/lifecycle.ts
    - frontend/src/lib/components/lifecycle/ActionToolbar.svelte
    - frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte
    - frontend/src/routes/inventory/+page.svelte

key-decisions:
  - "Tree-building logic extracted into snapshot-tree.ts (a pure module) so the parent-pointer → hierarchy transform is unit-testable in the node vitest environment — the component itself cannot be mounted (no DOM), the same constraint Plans 03-03/03-05 documented"
  - "The recursion is a self-rendering {#snippet} (treeNodes) inside SnapshotTree.svelte rather than recursive component instantiation — a snippet that calls itself is the cleaner Svelte 5 idiom and keeps roving-tabindex state in one component instance"
  - "Clone/Migrate node lists are derived from the cluster inventory (unique `node` values) — the frontend has no dedicated node-listing endpoint and Plan 04 added no nextid helper; the clone backend auto-assigns the VMID server-side when new_vmid is omitted, so the VMID field is left blank/optional"
  - "ActionToolbar's More menu now opens the real dialogs (Plan 05 shipped TODO markers + an onMoreAction callback) — the callback is kept as an optional observer hook; Convert-to-template is disabled with a tooltip for LXC since the backend rejects it 422"
  - "Convert-to-template uses the FileStack icon (UI-SPEC icon allow-list + the plan's Task 2 action) — the Plan 05 stub used BadgePlus; that import was removed"
  - "The inventory row markup is a shared {#snippet} (inventoryRow) so the per-row menu + the bulk checkbox column are defined once and reused by both the single-cluster flat table and the multi-cluster accordion"

patterns-established:
  - "Recursive {#snippet} tree rendering with a pure helper module behind it"
  - "Form dialogs: bindable open, busy guard, reset-on-open $effect"
  - "Bulk-select: a shared row snippet + a bulkMode-gated checkbox column + a sticky bulk-action bar + a single batch alert-dialog"

requirements-completed: [LIFE-03, LIFE-04, LIFE-08, LIFE-09, LIFE-10, LIFE-11]

# Metrics
duration: 9min
completed: 2026-05-16
---

# Phase 3 Plan 06: Snapshots, Resize/Clone/Migrate Dialogs & Inventory Bulk Actions Summary

**The lifecycle UI for snapshots and the resize/clone/migrate operation set — a hand-rolled recursive snapshot tree (no tree-view dependency) filling the formerly-disabled Snapshots tab, four form dialogs plus the emphatic convert-to-template confirm wired into the Plan 05 action toolbar, and an inventory per-row power menu + bulk-select bar that fans out one 202 job per VM.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-16T13:30:00Z
- **Completed:** 2026-05-16T13:39:22Z
- **Tasks:** 2
- **Files created:** 9, **Files modified:** 5

## Accomplishments

- **Hand-rolled recursive snapshot tree (D-05).** `SnapshotTree.svelte` builds
  the hierarchy from `parent` pointers via a self-rendering `{#snippet}` — no
  tree-view npm dependency, mirroring the Phase 2 `Sparkline.svelte`
  precedent. `role="tree"`/`treeitem`, `aria-expanded` on branch nodes, 24px
  indent guides drawn with 1px `--border` CSS rules, a roving tabindex with
  ArrowUp/ArrowDown navigation, the `current` node carrying a primary-outline
  badge (its Restore item disabled). The parent-pointer → hierarchy transform
  is extracted into a pure `snapshot-tree.ts` module so it is unit-testable in
  the `node` vitest environment.
- **Snapshots tab.** `SnapshotsTab.svelte` fills the formerly-disabled Phase 2
  placeholder — a single `Card` with loading skeletons, an empty state, an
  error+retry state, the tree, and the wiring: Create → `SnapshotCreateDialog`
  → `createSnapshot`; the tree's restore → `ConfirmByNameDialog` (typed-name)
  → `rollbackSnapshot`; delete → `ConfirmByNameDialog` (typed-name) →
  `deleteSnapshot`. The detail-page Snapshots tab trigger lost its `Lock`
  marker; the Console tab keeps its.
- **Resize / Clone / Migrate / Convert dialogs.** `ResizeDialog` shows
  hotplug-driven "Requires a reboot to take effect." warnings, enforces
  `min = current` on each disk, shows an inline error + a persistent
  `bg-destructive/10` shrink-blocked notice, and disables the CTA while any
  disk field is invalid — with no lock-override field. `MigrateDialog` keeps
  the bwlimit MB/s input inside an Advanced `collapsible` (collapsed by
  default, always present), and surfaces a 409 pre-flight failure inline.
  `CloneDialog` offers linked/full mode, target node/storage, and an
  overridable VMID labelled "Auto-assigned". `ConvertTemplateDialog` is an
  emphatic warning-tinted one-way `alert-dialog`.
- **ActionToolbar wiring.** The Plan 05 "More" menu — which shipped with
  `TODO(03-06)` markers and an `onMoreAction` callback — now opens all five
  dialogs directly. Convert-to-template is disabled with an explanatory
  tooltip for LXC (the backend rejects it 422) and its dialog renders only for
  qemu. The Convert icon moved from the Plan 05 stub's `BadgePlus` to the
  `FileStack` the UI-SPEC allow-list mandates.
- **Inventory per-row menu + bulk select (LIFE-03).** Each inventory row gains
  a `MoreHorizontal` ghost menu (context-aware Start/Stop/Reboot/Shutdown +
  "Open detail →", no Delete). A "Select" toggle reveals a 40px checkbox
  column + a header select-all (indeterminate on a subset); a sticky 56px
  `bg-muted` bulk-action bar slides in at ≥1 selected with Start/Stop/Reboot
  (no bulk Delete); a single batch `alert-dialog` confirms the whole selection
  and `bulkPower` fans out one job per VM — the targets carry their own
  `cluster_id` so a selection can cross clusters.

## Task Commits

1. **Task 1: snapshot tree, tab, dialogs + lifecycle API extensions** — `0e99bd0` (feat)
2. **Task 2: resize/clone/migrate/convert dialogs + inventory bulk select** — `b619d79` (feat)

## Files Created/Modified

**Created:**
- `frontend/src/lib/components/lifecycle/SnapshotTree.svelte` — hand-rolled recursive tree
- `frontend/src/lib/components/lifecycle/snapshot-tree.ts` — pure tree builder (testable)
- `frontend/src/lib/components/lifecycle/SnapshotsTab.svelte` — the Snapshots tab body
- `frontend/src/lib/components/lifecycle/SnapshotCreateDialog.svelte` — snapshot-create form
- `frontend/src/lib/components/lifecycle/ResizeDialog.svelte` — resize form (reboot warn + shrink block)
- `frontend/src/lib/components/lifecycle/CloneDialog.svelte` — clone form
- `frontend/src/lib/components/lifecycle/MigrateDialog.svelte` — migrate form (bwlimit in Advanced)
- `frontend/src/lib/components/lifecycle/ConvertTemplateDialog.svelte` — one-way convert confirm
- `frontend/tests/snapshot-tree.test.ts` — 10 tree-builder tests

**Modified:**
- `frontend/src/lib/api/types.ts` — added SnapshotItem/SnapshotListResponse + ResizeInfo/DiskInfo + ResizeRequest/CloneRequest/MigrateRequest
- `frontend/src/lib/api/lifecycle.ts` — added listSnapshots/createSnapshot/rollbackSnapshot/deleteSnapshot + getResizeInfo/resize + clone/convertTemplate/migrate
- `frontend/src/lib/components/lifecycle/ActionToolbar.svelte` — wired the More menu to the five dialogs; added the `node` prop; FileStack icon
- `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` — removed the Snapshots tab Lock; mounted SnapshotsTab; passed `node` to ActionToolbar
- `frontend/src/routes/inventory/+page.svelte` — per-row power menu + bulk-select mode + bulk-action bar + batch confirm dialog

## Decisions Made

- **Pure tree-builder module.** The `node` vitest environment cannot mount
  Svelte components (no DOM — the constraint Plans 03-03/03-05 document), so
  the parent-pointer → hierarchy transform is extracted into
  `snapshot-tree.ts` (`buildSnapshotTree`/`childrenOf`/`flattenSnapshotOrder`/
  `currentSnapshotName`). `SnapshotTree.svelte` imports the same helpers, so
  the tested logic is the rendered logic.
- **Recursion via a self-rendering `{#snippet}`.** `SnapshotTree.svelte`'s
  `treeNodes` snippet calls itself for each node's children — a snippet that
  recurses is the cleaner Svelte 5 idiom than recursive component
  instantiation and keeps the roving-tabindex `$state` in a single component
  instance.
- **Node list from the cluster inventory.** The frontend has no dedicated
  node-listing endpoint and Plan 04 added no `nextid` helper. Clone/Migrate
  derive the unique node set from `api.inventory.listForCluster` (each VM/LXC
  row carries `node`); the clone backend auto-assigns the VMID server-side
  when `new_vmid` is omitted, so the VMID field is blank/optional with the
  "Auto-assigned" helper.
- **More-menu callback kept as an observer hook.** Plan 05 shipped the More
  menu dispatching via `onMoreAction`. This plan opens the real dialogs
  directly and keeps `onMoreAction` as an optional callback (analytics /
  observers) — no behaviour change for callers that omit it.
- **Shared inventory row snippet.** The per-row menu and the bulk checkbox
  column are defined once in an `inventoryRow` `{#snippet}` reused by both the
  single-cluster flat table and the multi-cluster accordion — the row was
  previously duplicated verbatim across the two branches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Convert-to-template menu icon corrected to FileStack**
- **Found during:** Task 2 (ActionToolbar wiring)
- **Issue:** The Plan 05 stub menu used `BadgePlus` for the Convert-to-template
  item. Both the UI-SPEC icon allow-list and the plan's Task 2 action #6
  specify `FileStack` for that item — `BadgePlus` was the stub's placeholder.
- **Fix:** Swapped the import + the menu icon to `FileStack` and removed the
  now-unused `BadgePlus` import.
- **Files modified:** `frontend/src/lib/components/lifecycle/ActionToolbar.svelte`
- **Verification:** `pnpm run check` 0 errors; the icon-allow-list scan over
  `lifecycle/` shows only allow-list icons.
- **Committed in:** `b619d79` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The single fix aligns the Convert-to-template icon with
the UI-SPEC allow-list — the plan explicitly directed `FileStack`. No scope
change; every other surface shipped exactly as the plan specified.

## Issues Encountered

- **Comment greps tripped two strict acceptance criteria.** The acceptance
  criteria `grep -c 'skiplock' …` (must be 0) and `grep -ci 'bulk.*delete' …`
  (must show no bulk-delete) initially matched explanatory *comments* ("NO
  skiplock field anywhere", "NO bulk Delete"). The dialogs/bar genuinely
  contain no such field/action — only the documenting comments matched. Both
  comments were reworded ("NO lock-override field", "a batch destructive
  action is intentionally excluded") so the strict greps return 0. No
  functional change.

## Threat Surface

All six `<threat_model>` mitigations are in place — no new threat surface
beyond the plan's register:
- **T-03-06-01** (CSRF): every `api.lifecycle.*` mutation routes through
  `apiJson` → `apiFetch`, which attaches the double-submit `X-CSRF-Token`
  header; the Plan 03/04 backend enforces `csrf_protect` on each route.
- **T-03-06-02** (XSS): every PVE-derived string (snapshot name/description,
  migrate pre-flight error, VM names) is rendered via Svelte text
  interpolation — auto-escaped. No `{@html}` appears in `SnapshotTree`, the
  dialogs, or the inventory list.
- **T-03-06-03** (disk-shrink tampering): the `ResizeDialog` `min` + inline
  error is a UX affordance; the Plan 03 backend independently rejects a shrink
  422 — the UI guard reduces friction, the API guard is enforcement.
- **T-03-06-04** (`skiplock` smuggling): no dialog renders a lock-override
  field; the backend schemas are `extra="forbid"`. The acceptance grep returns
  0 occurrences in `ResizeDialog`.
- **T-03-06-05** (cross-tenant bulk): the bulk bar only offers VMs already
  visible in the user's team-scoped inventory list; the Plan 02/04 backend
  re-resolves `require_resource_access` per target and 403s a cross-tenant
  target.
- **T-03-06-06** (migrate pre-flight detail): `accept` — D-15, the friendly
  pre-flight message is the locked UI-SPEC copy shown to all users. Not a
  finding.

## Known Stubs

None — every dialog is wired to a real `api.lifecycle.*` 202 mutation, the
Snapshots tab fetches the real snapshot list, and the bulk bar fans out real
`bulkPower` jobs. The only intentional deferral is the "Back up now" More-menu
item, which stays a `TODO(03-07)` marker — the backup dialog is owned by
Plan 03-07, exactly as the plan scoped it.

## Next Phase Readiness

- The Snapshots tab + tree, the resize/clone/migrate/convert dialogs, and the
  inventory bulk-action surface are live. The remaining Phase-3 plan (03-07)
  adds the Backups tab, the global `/backups` page, and the admin
  backup-storage designation — it wires the one remaining `TODO(03-07)` marker
  in the ActionToolbar More menu ("Back up now") and adds the new Backups tab
  trigger between Snapshots and Console.
- A user can now create/restore/delete snapshots, resize a VM, clone it,
  migrate it, convert it to a template, and run bulk power actions across the
  inventory — every operation streaming live in the Plan 05 Tasks drawer.

## Self-Check: PASSED

- All 9 created key files exist on disk (verified — `SnapshotTree.svelte`,
  `snapshot-tree.ts`, `SnapshotsTab.svelte`, `SnapshotCreateDialog.svelte`,
  `ResizeDialog.svelte`, `CloneDialog.svelte`, `MigrateDialog.svelte`,
  `ConvertTemplateDialog.svelte`, `tests/snapshot-tree.test.ts`).
- Both task commits present in git history (`0e99bd0`, `b619d79`).
- Plan-level verification: `pnpm run check` reports 0 errors / 0 warnings;
  `pnpm vitest run` is green — 13 test files, 110 tests (10 new snapshot-tree
  tests); the icon-allow-list scan over `lifecycle/` + `inventory/+page.svelte`
  shows only cumulative Phase 1+2+3 allow-list icons; no tree-view npm
  dependency was added (D-05); no `frontend/build/` change was staged.
- All Task 1 + Task 2 acceptance-criteria greps pass.

---
*Phase: 03-job-queue-lifecycle*
*Completed: 2026-05-16*
