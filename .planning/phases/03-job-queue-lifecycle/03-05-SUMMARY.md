---
phase: 03-job-queue-lifecycle
plan: 05
subsystem: ui
tags: [svelte, sveltekit, websocket, tasks-drawer, lifecycle, power-actions, shadcn]

# Dependency graph
requires:
  - phase: 03-job-queue-lifecycle
    provides: jobs API (GET /jobs, GET /jobs/{id}, POST /jobs/{id}/retry), /api/v1/ws/jobs WebSocket, 202 power/delete/bulk-power routes
  - phase: 02-multi-cluster-inventory-quotas-audit
    provides: api client EXTENSION CONTRACT, QuotaIndicator right-side Sheet, VM detail page, AppShell + Topbar chrome
  - phase: 01-foundation
    provides: apiJson/apiFetch CSRF-aware fetch wrapper, ConfirmByNameDialog, sonner Toaster, svelte-check pipeline
provides:
  - api/jobs.ts + api/lifecycle.ts clients registered in the api namespace
  - utils/elapsed.ts — no-date-library elapsed-time formatter
  - stores/jobs.svelte.ts — WebSocket-backed jobs store (backfill reconcile, backoff reconnect, derived counts)
  - Tasks drawer (Sheet) with live job feed, batch grouping, error detail, idempotent-only Retry
  - Topbar Tasks icon + live count badge (red on unacknowledged failure)
  - VM-detail ActionToolbar (Start/Stop/Reboot/Shutdown + More + Delete) with power confirm dialogs
affects: [03-06-snapshots-resize-frontend, 03-07-backups-clone-migrate-frontend, 04 provisioning lifecycle UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WebSocket rune-store: a .svelte.ts class holding $state, an injectable WsFactory for testability, backfill reconcile-by-id, exponential backoff reconnect"
    - "Live-feed component: TasksDrawer owns a 1s setInterval $state(nowMs) tick that JobRow consumes so elapsed timers move even while disconnected"
    - "Mutually-exclusive right-side Sheets: AppShell coordinates Quota vs Tasks drawer open-state via a last-opened-wins $effect"
    - "Plan-stub menu: ActionToolbar's More menu ships the structure now, dispatches via an onMoreAction prop callback with TODO(03-06/07) markers for the dialogs Plans 06/07 wire"

key-files:
  created:
    - frontend/src/lib/api/jobs.ts
    - frontend/src/lib/api/lifecycle.ts
    - frontend/src/lib/utils/elapsed.ts
    - frontend/src/lib/stores/jobs.svelte.ts
    - frontend/src/lib/components/jobs/JobErrorDetail.svelte
    - frontend/src/lib/components/jobs/JobRow.svelte
    - frontend/src/lib/components/jobs/TasksDrawer.svelte
    - frontend/src/lib/components/lifecycle/PowerConfirmDialog.svelte
    - frontend/src/lib/components/lifecycle/ActionToolbar.svelte
    - frontend/tests/elapsed.test.ts
    - frontend/tests/jobs-store.test.ts
  modified:
    - frontend/src/lib/api/types.ts
    - frontend/src/lib/api/client.ts
    - frontend/src/lib/components/layout/AppShell.svelte
    - frontend/src/lib/components/layout/Topbar.svelte
    - frontend/src/lib/components/quotas/QuotaIndicator.svelte
    - frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte

key-decisions:
  - "The jobs store accepts an injectable WsFactory + a `silent` flag so the reconnect/backfill/upsert logic is unit-testable in the `node` vitest environment without a real socket or sonner toasts"
  - "QuotaIndicator's `open` lifted from internal $state to a $bindable prop so AppShell can keep the two right-side Sheets mutually exclusive (UI-SPEC Implementation Note 3)"
  - "ActionToolbar's More menu ships the full structure now and dispatches via an onMoreAction prop callback — the Resize/Clone/Migrate/Snapshot/Backup dialogs land in Plans 06/07; TODO(03-06/07) markers flag each"
  - "The disconnected strip is a hand-rolled bg-warning/10 div, not `Alert variant=warning` — the installed shadcn alert block only ships default/destructive variants"

patterns-established:
  - "WebSocket rune-store with injectable factory for node-env testability"
  - "Live-feed ticking nowMs owned by the container component, passed down to rows"
  - "Plan-stub menu items with prop-callback dispatch + dated TODO markers"

requirements-completed: [LIFE-01, LIFE-02, LIFE-12, LIFE-13, UI-06]

# Metrics
duration: 8min
completed: 2026-05-16
---

# Phase 3 Plan 05: Frontend Job Infrastructure + Power-Action Lifecycle Slice Summary

**The frontend half of the power-action vertical slice — a WebSocket-backed jobs store, the Tasks drawer with live job feed/batch grouping/error-detail/retry, the Topbar Tasks badge, and the VM-detail action toolbar with power confirm dialogs and a typed-name Delete — all wired to the Plan 03-02 jobs API + `/ws/jobs` WebSocket.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-16T13:15:30Z
- **Completed:** 2026-05-16T13:23:40Z
- **Tasks:** 2
- **Files created:** 11, **Files modified:** 6

## Accomplishments

- **Frontend job surfaces.** `api/jobs.ts` (listJobs/getJob/retryJob) and
  `api/lifecycle.ts` (power/del/bulkPower) mirror `inventory.ts` and register
  cleanly under the `api` namespace via the EXTENSION CONTRACT. The
  WebSocket-backed `stores/jobs.svelte.ts` rune-store holds the live job list
  (newest-first, trimmed to 50), reconciles a `backfill` frame by `id` on
  reconnect (no duplicate rows), reconnects with exponential backoff, and
  exposes derived running/pending/failed/in-flight counts.
- **Tasks drawer.** A 420px right-side `Sheet` streaming the live WebSocket
  job feed — state-tinted `JobRow`s with a 3px left-edge bar, an icon **and** a
  state word (a11y floor), a ticking elapsed timer, batch grouping under a
  collapsible header (D-11), a `bg-warning/10` "Reconnecting…" strip, and the
  empty state. Failed rows render `JobErrorDetail` (friendly message first +
  "Show technical details" collapsible — D-13/14/15) and an idempotent-only
  Retry button (D-16).
- **Topbar Tasks badge.** A `ListChecks` icon button left of the
  QuotaIndicator with an overlapping 18px count badge — primary while running,
  `bg-destructive` on an unacknowledged failure, `9+` overflow, hidden at 0.
  Clicking opens the drawer (which acknowledges failures).
- **VM-detail action toolbar.** `ActionToolbar` runs Start (immediate),
  Stop/Reboot/Shutdown (OK/Cancel `PowerConfirmDialog` with verbatim UI-SPEC
  copy + a "Force-stop instead" escalation), and a far-right typed-name Delete
  (`ConfirmByNameDialog` reused verbatim). Context-aware enable/disable, a
  job-in-flight guard, and a degrade-don't-fail unreachable-cluster tooltip.

## Task Commits

1. **Task 1: jobs/lifecycle API clients, elapsed formatter, WebSocket jobs store** — `b2fd956` (feat)
2. **Task 2: Tasks drawer, JobRow, error detail, Topbar badge, action toolbar** — `5507e36` (feat)

## Files Created/Modified

**Created:**
- `frontend/src/lib/api/jobs.ts` — jobs API (list/get/retry)
- `frontend/src/lib/api/lifecycle.ts` — power/delete/bulk-power 202 mutations
- `frontend/src/lib/utils/elapsed.ts` — no-date-library `formatElapsed`
- `frontend/src/lib/stores/jobs.svelte.ts` — WebSocket jobs rune-store
- `frontend/src/lib/components/jobs/JobErrorDetail.svelte` — friendly error + technical-detail collapsible
- `frontend/src/lib/components/jobs/JobRow.svelte` — one live job row
- `frontend/src/lib/components/jobs/TasksDrawer.svelte` — the Tasks drawer Sheet
- `frontend/src/lib/components/lifecycle/PowerConfirmDialog.svelte` — OK/Cancel power confirm
- `frontend/src/lib/components/lifecycle/ActionToolbar.svelte` — VM-detail action toolbar
- `frontend/tests/elapsed.test.ts` — 12 elapsed-formatter tests
- `frontend/tests/jobs-store.test.ts` — 14 jobs-store tests

**Modified:**
- `frontend/src/lib/api/types.ts` — added Job/JobState/JobListResponse/JobAccepted/BulkJobAccepted/PowerActionName
- `frontend/src/lib/api/client.ts` — registered `jobs` + `lifecycle` namespaces
- `frontend/src/lib/components/layout/AppShell.svelte` — mounts TasksDrawer, connects the WebSocket, mutual-exclusivity coordination
- `frontend/src/lib/components/layout/Topbar.svelte` — Tasks icon + count badge
- `frontend/src/lib/components/quotas/QuotaIndicator.svelte` — `open` lifted to a bindable prop
- `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` — mounts ActionToolbar between header and tab strip

## Decisions Made

- **Injectable WebSocket factory.** `stores/jobs.svelte.ts` takes an optional
  `wsFactory` + `wsUrl` + `silent` flag. The vitest environment is `node` (no
  jsdom/WebSocket), so the store accepts a fake socket and skips sonner toasts
  under `silent` — the reconnect/backfill/upsert logic gets full unit coverage
  without a real socket. The exported `jobsStore` singleton uses the real
  `WebSocket` and the default same-origin `ws://`/`wss://` URL.
- **QuotaIndicator `open` lifted to a bindable prop.** UI-SPEC Implementation
  Note 3 requires the Quota and Tasks drawers (both right-side `Sheet`s) to be
  mutually exclusive. QuotaIndicator previously owned `open` as private
  `$state`; it is now `$bindable` so AppShell can coordinate via a
  last-opened-wins `$effect`. Callers that don't need coordination simply omit
  the prop (default `false`).
- **More-menu plan stub.** The Resize/Clone/Migrate/Snapshot/Backup dialogs
  land in Plans 06/07. ActionToolbar ships the full "More" `DropdownMenu`
  structure now and dispatches each item via an `onMoreAction` prop callback,
  with a dated `TODO(03-06)`/`TODO(03-07)` marker on each item. The menu
  structure is real; only the dialogs are deferred to the plans that own them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No `Alert variant="warning"` in the installed shadcn block**
- **Found during:** Task 2 (TasksDrawer)
- **Issue:** The plan and UI-SPEC call for an `Alert variant="warning"` strip
  for the WebSocket-disconnected state, but the installed `alert` block only
  ships `default` and `destructive` variants — `variant="warning"` would not
  type-check.
- **Fix:** Rendered the disconnected strip as a hand-rolled
  `bg-warning/10 border-warning/30 text-warning` div with `role="status"` and
  a `Loader2` spinner. This uses only existing `--warning` tokens (no new
  token) and matches the QuotaIndicator precedent of composing warning surfaces
  from raw classes. Visually and semantically identical to the spec intent.
- **Files modified:** `frontend/src/lib/components/jobs/TasksDrawer.svelte`
- **Verification:** `pnpm run check` reports 0 errors; the strip renders with
  the warning palette per UI-SPEC §Color.
- **Committed in:** `5507e36` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The single fix was a faithful substitution for an
unavailable shadcn variant — no scope change, no new tokens, identical
appearance. Every other surface (store, drawer, JobRow, error detail, Topbar
badge, toolbar, power dialogs) shipped exactly as the plan specified.

## Issues Encountered

- **vitest environment is `node`, not jsdom.** `.svelte` component mounting is
  not available in the test environment, so component coverage stays at the
  store + formatter layer (the same constraint `api-client.test.ts` documents).
  Resolved by designing the jobs store with an injectable WebSocket factory so
  its full logic is unit-tested without a DOM. The components themselves are
  covered by `pnpm run check` (0 errors) and the icon-allow-list scan.

## Threat Surface

All six `<threat_model>` mitigations are in place — no new threat surface
beyond the plan's register:
- **T-03-05-01** (cross-team rows): the drawer renders only what the WebSocket
  delivers; the store performs no team filtering of its own (the Plan 02
  server scopes the socket).
- **T-03-05-02** (XSS in error text): `JobErrorDetail` and `JobRow` render
  every value (`friendly_error`, `error`, `upid`) as Svelte text
  interpolation — auto-escaped. No `{@html}` appears in either component (the
  mono block is `whitespace-pre-wrap` text).
- **T-03-05-03** (CSRF): `api.lifecycle.*` calls route through `apiJson` →
  `apiFetch`, which attaches the double-submit `X-CSRF-Token` header on
  POST/DELETE.
- **T-03-05-04** (non-idempotent retry): `JobRow` renders the Retry button
  only for `IDEMPOTENT` kinds (`vm.power`/`vm.snapshot.delete`/`vm.resize`/
  `vm.backup`); the Plan 02 retry route rejects the rest 409 as defence-in-depth.
- **T-03-05-05** (reconnect storm): the store reconnects on a `BACKOFF_MS`
  schedule (1s→30s), not a tight loop; the job list is client-trimmed to 50
  rows so memory stays bounded.
- **T-03-05-06** (raw paths shown): `accept` — D-15, no redaction; the UI adds
  none. Not a finding.

## Next Phase Readiness

- The shared frontend job surfaces (jobs store, Tasks drawer, `JobRow`,
  `JobErrorDetail`, `ActionToolbar`, `PowerConfirmDialog`) are in place. Plans
  03-06 (snapshots/resize) and 03-07 (backups/clone/migrate) build their
  dialogs on top: the `ActionToolbar` "More" menu already dispatches
  `snapshot`/`backup`/`resize`/`clone`/`migrate`/`template` intents via
  `onMoreAction` — Plans 06/07 swap the `TODO(03-06/07)` markers for real
  dialog mounts.
- A user can now click Start/Stop/Reboot/Shutdown/Delete on the VM detail page
  and watch the job stream live in the Tasks drawer — the power-action
  vertical slice is end-to-end.
- The `Lock` removal on the Snapshots tab trigger and the new Backups tab are
  deliberately left for Plans 06/07 (the plan scoped them out of 03-05).

## Self-Check: PASSED

- All 11 created key files exist on disk (verified — `api/jobs.ts`,
  `api/lifecycle.ts`, `utils/elapsed.ts`, `stores/jobs.svelte.ts`,
  `jobs/JobErrorDetail.svelte`, `jobs/JobRow.svelte`, `jobs/TasksDrawer.svelte`,
  `lifecycle/PowerConfirmDialog.svelte`, `lifecycle/ActionToolbar.svelte`,
  `tests/elapsed.test.ts`, `tests/jobs-store.test.ts`).
- Both task commits present in git history (`b2fd956`, `5507e36`).
- Plan-level verification: `pnpm run check` reports 0 errors / 0 warnings;
  `pnpm vitest run` is green — 12 test files, 100 tests (26 new); the
  icon-allow-list scan over `jobs/` + `lifecycle/` shows only cumulative
  Phase 1+2+3 allow-list icons; no `frontend/build/` change was staged.
- All Task 1 + Task 2 acceptance-criteria greps pass.

---
*Phase: 03-job-queue-lifecycle*
*Completed: 2026-05-16*
