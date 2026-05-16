---
phase: 03-job-queue-lifecycle
plan: 07
subsystem: ui
tags: [svelte, sveltekit, backups, restore, schedule, shadcn, lifecycle]

# Dependency graph
requires:
  - phase: 03-job-queue-lifecycle
    provides: backup/restore/schedule 202 routes + GET /backups/schedules + GET /clusters/{id}/backup-storages + clusters.backup_storage (Plan 03-04); api/lifecycle.ts, ActionToolbar More menu, Tasks drawer (Plan 03-05); VM-detail tab strip, SnapshotsTab (Plan 03-06)
  - phase: 02-multi-cluster-inventory-quotas-audit
    provides: audit page SSR-loader analog (auth gate + event.fetch), shadcn table, VM detail page + tab strip, admin cluster edit form, Sidebar Resources section
  - phase: 01-foundation
    provides: apiJson CSRF-aware fetch wrapper, ConfirmByNameDialog, sonner Toaster, shadcn-svelte primitives, svelte-check pipeline
provides:
  - per-VM Backups tab — backup-file list + Back-up-now + schedule card + no-storage banner
  - RestoreDialog — in-place overwrite (typed-name confirm) vs restore-as-new (D-07)
  - BackupScheduleCard — Switch + Daily/Weekly + keep-last-N retention (D-08)
  - global /backups page — team-scoped scheduled-backup overview table + sidebar nav item
  - admin per-cluster backup-storage designation on the cluster edit form
  - api/lifecycle.ts backup functions + api/clusters.ts listBackupStorages
affects: [04-provisioning-networking-console]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Best-effort SSR probe of an admin-only resource — the detail-page loader fetches the cluster for backup_storage and falls back to optimistic-true for non-admins; the backend 409 is the real D-08 enforcement"
    - "Sentinel Select value — the admin backup-storage Select binds a __none__ string mapping to backup_storage: null, distinguishing the explicit None choice from a real storage name"
    - "Nullable GET contract — getSchedule returns BackupSchedule | null; the card handles the no-schedule null without an error path"

key-files:
  created:
    - frontend/src/lib/components/lifecycle/RestoreDialog.svelte
    - frontend/src/lib/components/lifecycle/BackupScheduleCard.svelte
    - frontend/src/lib/components/lifecycle/BackupsTab.svelte
    - frontend/src/routes/backups/+page.server.ts
    - frontend/src/routes/backups/+page.svelte
    - frontend/tests/backups-page.test.ts
  modified:
    - frontend/src/lib/api/types.ts
    - frontend/src/lib/api/lifecycle.ts
    - frontend/src/lib/api/clusters.ts
    - frontend/src/lib/components/lifecycle/ActionToolbar.svelte
    - frontend/src/lib/components/layout/Sidebar.svelte
    - frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte
    - frontend/src/routes/inventory/[cluster]/[vmid]/+page.server.ts
    - frontend/src/routes/admin/clusters/[id]/+page.svelte

key-decisions:
  - "ScheduledBackupRow is a type alias of BackupSchedule — the GET /backups/schedules backend route returns BackupScheduleResponse rows (cluster_id/vmid/is_lxc/node/frequency/keep_last/last_run_*), NOT the cluster_name/vm_name shape the plan's interface block sketched; the /backups table renders the real contract"
  - "getSchedule typed Promise<BackupSchedule | null> — the GET .../backup-schedule route returns null (not 404) for a VM with no schedule; the card handles null inline"
  - "Restore-as-new requires new_vmid in the dialog — the backend RestoreRequest model validator rejects mode='new' without new_vmid 422, so the field is required (not auto-assignable) and the CTA gates on it"
  - "The VM-detail loader best-effort fetches the cluster for backup_storage — GET /clusters/{id} is admin-only, so non-admins get backupStorageConfigured: true and the backend 409 enforces D-08"
  - "The admin backup-storage Select uses a __none__ sentinel — a Select value must be a string; __none__ maps to backup_storage: null on PATCH (the 'None — backups disabled' choice)"

patterns-established:
  - "Best-effort SSR probe with optimistic fallback for admin-gated resources read by non-admin pages"
  - "Sentinel Select value mapping to an explicit-null PATCH field"
  - "Nullable GET contract handled inline (no separate 404/empty branch)"

requirements-completed: [LIFE-05, LIFE-06, LIFE-07]

# Metrics
duration: 18min
completed: 2026-05-16
---

# Phase 3 Plan 07: Backups Frontend Summary

**The Phase 3 backup UI — a per-VM Backups tab (file list + Back-up-now + a Daily/Weekly keep-last-N schedule card with the D-08 no-storage banner), the Restore-from-backup dialog defaulting to in-place overwrite behind a typed-name confirm with a restore-as-new alternative, the global team-scoped `/backups` overview page with a CalendarClock sidebar nav item, and the admin per-cluster backup-storage Select wired into the cluster edit form.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-16T13:48:00Z
- **Completed:** 2026-05-16T14:06:00Z
- **Tasks:** 2
- **Files created:** 6, **Files modified:** 8

## Accomplishments

- **Per-VM Backups tab (LIFE-05/06/07).** A new `Backups` tab on the VM
  detail page (between Snapshots and Console) mounting `BackupsTab.svelte` —
  a `BackupScheduleCard` on top, then a backup-files `Card` with a "Back up
  now" primary button (`Database` icon) and a 48px-row file list (filename
  Mono 13/400 truncate, size tabular-nums, timestamp, a `MoreHorizontal` menu
  → Restore / Delete). Loading = 3 skeleton rows, empty = `Database` icon +
  copy, error = "Couldn't load backups." + retry.
- **Restore-from-backup dialog (D-07).** `RestoreDialog.svelte` — a radio
  group defaulting to "Overwrite this VM (in-place)" which reveals a
  `bg-destructive/10` data-loss warning (UI-SPEC verbatim) + a typed-name
  confirm field (the `ConfirmByNameDialog` pattern, composed inline; ENTER
  does not submit) with the CTA "Restore (overwrite)" disabled until the name
  matches — and "Restore as a new VM" which reveals New VMID + New name with
  the CTA swapping to "Restore as new VM".
- **Backup schedule card (D-08).** `BackupScheduleCard.svelte` — a `Switch`
  "Scheduled backup"; when on, reveals a Frequency `Select` (Daily / Weekly)
  + a "Keep last" number input + the "Save schedule" CTA. The whole card is
  disabled when the cluster has no designated backup storage.
- **No-backup-storage state (D-08).** When `backupStorageConfigured` is
  false, the "Back up now" button + the schedule card are disabled and a
  `bg-warning/10` banner (`TriangleAlert` icon) renders the UI-SPEC verbatim
  copy; the `ActionToolbar` "Back up now" More-menu item is disabled with a
  tooltip.
- **Global `/backups` page (LIFE-06, D-06).** `/backups/+page.{svelte,server.ts}`
  copies the audit-page analog — an auth-gated SSR loader (`redirect(303,
  '/login?next=...')` + `event.fetch` injection) pre-fetching the team-scoped
  scheduled-backup list, rendered as a shadcn `table` (Resource link, Cluster,
  Frequency, Keep-last, Last run with an `ok`/`fail` icon, Next run). A
  "Backups" (`CalendarClock`) sidebar nav item under Resources links to it.
- **Admin backup-storage designation (D-08).** The `/admin/clusters/{id}`
  edit form gains a "Backup storage" `Select` populated from
  `GET /clusters/{id}/backup-storages` plus an explicit "None — backups
  disabled" option; it saves with the existing "Save changes" CTA via the
  `backup_storage` PATCH field.

## Task Commits

Each task was committed atomically:

1. **Task 1: per-VM Backups tab — file list, schedule, restore dialog** — `e8e48d0` (feat)
2. **Task 2: global /backups page, sidebar nav, admin backup-storage** — `3c72e22` (feat)

## Files Created/Modified

**Created:**
- `frontend/src/lib/components/lifecycle/RestoreDialog.svelte` — in-place vs restore-as-new (D-07)
- `frontend/src/lib/components/lifecycle/BackupScheduleCard.svelte` — Switch + Daily/Weekly + keep-last-N
- `frontend/src/lib/components/lifecycle/BackupsTab.svelte` — the Backups tab body
- `frontend/src/routes/backups/+page.server.ts` — auth-gated SSR loader
- `frontend/src/routes/backups/+page.svelte` — global scheduled-backup table
- `frontend/tests/backups-page.test.ts` — 11 backup/restore/schedule/storage API tests

**Modified:**
- `frontend/src/lib/api/types.ts` — BackupFile/BackupListResponse/BackupSchedule/ScheduledBackupRow + backup_storage on Cluster/ClusterUpdateRequest
- `frontend/src/lib/api/lifecycle.ts` — backupNow/listBackups/restore/getSchedule/saveSchedule/deleteBackupFile/listScheduledBackups
- `frontend/src/lib/api/clusters.ts` — listBackupStorages + BackupStorageItem
- `frontend/src/lib/components/lifecycle/ActionToolbar.svelte` — wired the "Back up now" More-menu item (+ backupStorageConfigured prop)
- `frontend/src/lib/components/layout/Sidebar.svelte` — "Backups" Resources nav item
- `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` — the Backups tab trigger + panel
- `frontend/src/routes/inventory/[cluster]/[vmid]/+page.server.ts` — best-effort backup-storage probe
- `frontend/src/routes/admin/clusters/[id]/+page.svelte` — the Backup storage Select field group

## Decisions Made

- **`ScheduledBackupRow` aliases `BackupSchedule`.** The plan's `<interfaces>`
  block sketched a `cluster_name`/`vm_name`/`type` shape for the global-page
  rows, but the live backend `GET /backups/schedules` route returns
  `BackupScheduleResponse` rows (`id`, `cluster_id`, `vmid`, `is_lxc`, `node`,
  `enabled`, `frequency`, `keep_last`, `last_run_at`, `last_run_state`). The
  TS type was aligned to the real contract and the `/backups` table renders
  what the backend actually provides — the Resource column links via
  `cluster_id`/`vmid`, with `is_lxc` distinguishing `CT`/`VM`.
- **`getSchedule` returns `BackupSchedule | null`.** The
  `GET .../backup-schedule` route returns `null` (not 404) when a VM has no
  schedule yet. The typed wrapper reflects that and `BackupScheduleCard`
  handles the null inline (defaults to off / daily / keep-7).
- **Restore-as-new requires `new_vmid`.** The backend `RestoreRequest` model
  validator rejects `mode='new'` without `new_vmid` (422), so the dialog's
  New VMID field is required and the CTA gates on it — it is not
  auto-assignable from the dialog.
- **Best-effort cluster probe for `backup_storage`.** `GET /clusters/{id}` is
  admin-gated; the VM-detail SSR loader fetches it best-effort so admins see
  the real D-08 state and non-admins fall back to `backupStorageConfigured:
  true` — the backend `POST .../backup` 409 guard remains the authoritative
  enforcement.
- **`__none__` sentinel for the admin Select.** A shadcn `Select` value must
  be a string; the "None — backups disabled" option binds `__none__` which
  maps to `backup_storage: null` on the PATCH payload (the backend's
  `_UNSET`-sentinel field distinguishes absent / null / set).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aligned the global-page row type to the real backend contract**
- **Found during:** Task 2 (the `/backups` page)
- **Issue:** The plan's `<interfaces>` block described `ScheduledBackupRow`
  with `cluster_name`, `vm_name`, and a `type: 'vm'|'lxc'` string. The actual
  Plan 03-04 backend route `GET /backups/schedules` returns
  `list[BackupScheduleResponse]` — which has `cluster_id`, `vmid`, `is_lxc`,
  `node` instead. Rendering `row.cluster_name` would print `undefined`.
- **Fix:** Made `ScheduledBackupRow` a type alias of the corrected
  `BackupSchedule` interface (mirroring `BackupScheduleResponse` exactly); the
  `/backups` table renders `cluster_id` for the Cluster column and links the
  Resource column via `cluster_id`/`vmid` with `is_lxc` selecting the `CT`/`VM`
  prefix.
- **Files modified:** `frontend/src/lib/api/types.ts`, `frontend/src/routes/backups/+page.svelte`
- **Verification:** `pnpm run check` 0 errors; `tests/backups-page.test.ts`
  `listScheduledBackups` test asserts the real shape.
- **Committed in:** `3c72e22` (Task 2 commit)

**2. [Rule 1 - Bug] getSchedule handles the null no-schedule response**
- **Found during:** Task 1 (BackupScheduleCard)
- **Issue:** The plan typed `getSchedule` as `Promise<BackupSchedule>`, but
  the backend `GET .../backup-schedule` route's `response_model` is
  `BackupScheduleResponse | None` — it returns `null` for a VM with no
  schedule. `BackupScheduleCard.load()` reading `s.enabled` on `null` would
  throw a TypeError.
- **Fix:** Typed `getSchedule` as `Promise<BackupSchedule | null>` and made
  the card branch on the null (falls back to the off / daily / keep-7
  defaults).
- **Files modified:** `frontend/src/lib/api/lifecycle.ts`, `frontend/src/lib/components/lifecycle/BackupScheduleCard.svelte`
- **Verification:** `pnpm run check` 0 errors; `tests/backups-page.test.ts`
  `getSchedule` test asserts the null is tolerated.
- **Committed in:** `e8e48d0` (Task 1 commit)

**3. [Rule 1 - Bug] Restore-as-new requires a target VMID**
- **Found during:** Task 1 (RestoreDialog)
- **Issue:** The plan described the restore-as-new New VMID as
  "auto-filled/overridable", but the backend `RestoreRequest` model validator
  raises `ValueError` (→ 422) when `mode='new'` and `new_vmid` is `None`. An
  auto-assignable / blank VMID would always be rejected.
- **Fix:** Made the New VMID field required in restore-as-new mode — the CTA
  is disabled until both a valid VMID and a name are entered; the placeholder
  reads "e.g. 110" rather than "Auto-assigned".
- **Files modified:** `frontend/src/lib/components/lifecycle/RestoreDialog.svelte`
- **Verification:** `pnpm run check` 0 errors; `tests/backups-page.test.ts`
  `restore` test sends `new_vmid` for the `new` mode.
- **Committed in:** `e8e48d0` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 bug fixes).
**Impact on plan:** All three corrected the plan's `<interfaces>` sketch to
the live Plan 03-04 backend contracts — the global-page row shape, the
nullable schedule GET, and the required restore-as-new VMID. Without them the
UI would render `undefined`, crash on a no-schedule VM, or always 422 on
restore-as-new. No scope change — every surface (Backups tab, RestoreDialog,
schedule card, `/backups` page, admin Select) shipped as the plan specified.

## Issues Encountered

- **`GET /clusters/{id}` is admin-only.** The plan's `<interfaces>` block said
  "the detail page knows the cluster", but the VM-detail SSR loader does not
  fetch the cluster and the cluster GET route is `require_admin`-gated.
  Resolved by a best-effort probe in the loader (see Decisions) — admins get
  the real `backup_storage` flag, non-admins fall back to optimistic-true with
  the backend 409 still enforcing D-08. No new endpoint was added (a
  non-admin-readable cluster endpoint would be a backend-scope change).

## Threat Surface

All seven `<threat_model>` mitigations are in place — no new threat surface
beyond the plan's register:
- **T-03-07-01** (unauthenticated `/backups` access): `+page.server.ts`
  re-checks `locals.user` and `throw redirect(303, '/login?next=...')` —
  defence-in-depth, copied verbatim from the audit page.
- **T-03-07-02** (CSRF on backup/restore/schedule mutations): every
  `api.lifecycle.*` mutation routes through `apiJson` → `apiFetch`, which
  attaches the double-submit `X-CSRF-Token` header; the Plan 03-04 backend
  enforces `csrf_protect`.
- **T-03-07-03** (non-admin setting backup storage): the backup-storage
  `Select` lives on the already-admin-gated `/admin/clusters/{id}` page; the
  backend `PATCH /clusters/{id}` and `GET /clusters/{id}/backup-storages` are
  `require_admin`.
- **T-03-07-04** (cross-team schedule leak): `GET /backups/schedules` is
  team-scoped server-side (Plan 03-04 `_team_ids_for_user`); the `/backups`
  page renders only what the SSR loader returns.
- **T-03-07-05** (restore-as-new quota bypass): the dialog submits the
  request; the Plan 03-04 backend runs quota admission on restore-as-new
  before enqueue. The UI shows an informational "counts against quota" line
  only.
- **T-03-07-06** (XSS in backup filename / cluster name): every PVE-derived
  string in `BackupsTab`, `RestoreDialog`, and `/backups/+page.svelte` is
  rendered via Svelte text interpolation (auto-escaped); no `{@html}`.
- **T-03-07-07** (in-place restore destroying data without intent): the
  Restore dialog defaults to in-place but gates the destructive CTA behind a
  typed-name confirm (the `ConfirmByNameDialog` pattern, ENTER does not
  submit); the backend still authorizes via `require_resource_access`.

## Known Stubs

None — the Backups tab fetches the real backup-file list, the schedule card
reads/writes the real schedule, "Back up now" enqueues a real `vm.backup`
job, the Restore dialog issues a real `vm.restore`, the `/backups` page
renders the real team-scoped schedule list, and the admin Select reads the
real `content=backup` storage enumeration and PATCHes `backup_storage`. The
no-backup-storage state is a real D-08 surface, not a placeholder.

## Next Phase Readiness

- All Phase 3 lifecycle UI is complete — power, snapshots, resize, clone,
  migrate (Plans 03-05/03-06), and now backups + restore + the global
  `/backups` page + the admin backup-storage designation. The last
  `TODO(03-07)` marker in the `ActionToolbar` More menu is wired.
- A user can now run a manual backup, set a Daily/Weekly keep-last-N
  schedule, browse backup files, restore in-place or as a new VM, and see
  every team's scheduled backups on `/backups`; an admin designates the
  per-cluster backup storage on the cluster edit page.
- **Phase 4 follow-up:** the admin backup-storage helper line is plain text;
  the UI-SPEC defers the `?` tooltip to Phase 4. The VM-detail loader's
  best-effort cluster probe means non-admins do not see the D-08 banner
  upfront — if a non-admin-readable cluster summary endpoint lands, the probe
  can become authoritative for all users.

## Self-Check: PASSED

- All 6 created key files exist on disk (`RestoreDialog.svelte`,
  `BackupScheduleCard.svelte`, `BackupsTab.svelte`, `backups/+page.server.ts`,
  `backups/+page.svelte`, `tests/backups-page.test.ts`).
- Both task commits present in git history (`e8e48d0`, `3c72e22`).
- Plan-level verification: `pnpm run check` reports 0 errors / 0 warnings;
  `pnpm vitest run` is green — 14 test files, 121 tests (11 new in
  `backups-page.test.ts`); the icon-allow-list scan over every Plan 03-07 file
  shows only cumulative Phase 1+2+3 allow-list icons; no new shadcn-svelte
  block was added; no `frontend/build/` change was staged.
- All Task 1 + Task 2 acceptance-criteria greps pass.

---
*Phase: 03-job-queue-lifecycle*
*Completed: 2026-05-16*
