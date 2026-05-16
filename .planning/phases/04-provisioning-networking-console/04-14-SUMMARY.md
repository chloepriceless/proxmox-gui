---
phase: 04-provisioning-networking-console
plan: 14
subsystem: ui
tags: [novnc, console, notifications, sdn, networking, svelte, fastapi, jobs]

# Dependency graph
requires:
  - phase: 04-provisioning-networking-console (plan 04-04)
    provides: the NotificationSeen ORM model + the 0006_phase4 migration the notifications backend reuses
  - phase: 04-provisioning-networking-console (plan 04-08)
    provides: the console backend — the vncproxy mint route + the reverse-proxied WS relay the ConsoleTab embeds
  - phase: 04-provisioning-networking-console (plan 04-07)
    provides: the networks backend — the per-team network-scoping admin endpoints the NetworksTab calls
  - phase: 04-provisioning-networking-console (plan 04-09)
    provides: the typed api.console / api.networks client modules + the api namespace
  - phase: 03-job-queue-lifecycle
    provides: the jobs table + the jobsStore the notification feed + provisioning banner derive from
provides:
  - "the notifications/ backend module — a derived completions feed (GET /notifications) + a per-user last-seen cursor (POST /notifications/seen) over the jobs table (D-23)"
  - "api/notifications.ts — the typed listNotifications / markSeen client, re-exported on the api namespace"
  - "NotificationBell.svelte — the Topbar bell with an unread-count badge (UI-07)"
  - "ConsoleTab.svelte — the embedded noVNC console tab, mint-on-click iframe (CON-01/02/03)"
  - "NetworksTab.svelte — the per-team SDN/bridge-scoping admin tab parallel to Quotas (NET-02)"
  - "the VM-detail provisioning banner (D-04, UI-04)"
affects: [phase-05-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Notifications backend is a derived view — no new storage; list_notifications reads recent terminal jobs rows + the NotificationSeen cursor (D-23)"
    - "Component logic extracted to node-testable .ts modules (notification-feed.ts, console-tab.ts, networks-tab.ts, provisioning-banner.ts) — the same discipline as 04-11's lxc-wizard.ts; .svelte files import without the .ts extension"
    - "The console iframe src is validated through consoleIframeSrc — any :8006 / vncwebsocket URL throws rather than ever reaching the browser (CON-03)"

key-files:
  created:
    - backend/app/notifications/__init__.py
    - backend/app/notifications/service.py
    - backend/app/notifications/routes.py
    - backend/tests/test_notifications.py
    - frontend/src/lib/api/notifications.ts
    - frontend/src/lib/components/notifications/notification-feed.ts
    - frontend/src/lib/components/notifications/NotificationBell.svelte
    - frontend/src/lib/components/console/console-tab.ts
    - frontend/src/lib/components/console/ConsoleTab.svelte
    - frontend/src/lib/components/networks/networks-tab.ts
    - frontend/src/lib/components/networks/NetworksTab.svelte
    - frontend/src/lib/components/inventory/provisioning-banner.ts
    - frontend/tests/notification-bell.test.ts
    - frontend/tests/console-tab.test.ts
  modified:
    - backend/app/main.py
    - frontend/src/lib/api/types.ts
    - frontend/src/lib/api/client.ts
    - frontend/src/lib/api/index.ts
    - frontend/src/lib/components/layout/Topbar.svelte
    - frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte
    - frontend/src/routes/admin/teams/[id]/+page.svelte

key-decisions:
  - "POST /notifications/seen returns the refreshed NotificationFeed (not a bare 204) — the bell resets its badge in a single round-trip"
  - "list_notifications normalises naive SQLite timestamps to aware-UTC before the cursor comparison — a naive-vs-aware datetime compare would otherwise crash"
  - "The provisioning banner matches the create job by kind + cluster_id (the jobs table carries no vmid column) — it shows the newest create job for the cluster"
  - "The NetworksTab cluster set is derived from the team's quota rows (one row per bound cluster) — no extra server load was added to the team page"
  - "Component logic lives in node-testable .ts modules; the .svelte files are exercised by svelte-check — the vitest env is node-only (no DOM)"

patterns-established:
  - "Derived-feed backend: a read-only projection over an existing table + a tiny per-user cursor row — zero new domain storage (D-23)"
  - "Relay-URL safety gate: consoleIframeSrc is the single chokepoint that refuses a Proxmox-host URL — the iframe src is provably never :8006"

requirements-completed: [CON-01, CON-02, CON-03, NET-02, UI-04, UI-07]

# Metrics
duration: ~30 min
completed: 2026-05-16
---

# Phase 4 Plan 14: Console, Notification Bell, Networks Tab & Provisioning Banner Summary

**The last Phase-4 UX surfaces: an embedded noVNC console tab whose iframe is minted only on click and points only at the GUI's own reverse-proxied relay, a Topbar notification bell over a derived completions feed, a per-team SDN/bridge-scoping admin tab, and the post-submit provisioning banner — closing the Phase-4 provisioning/networking/console loop.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-05-16
- **Tasks:** 2 of 2
- **Files created/modified:** 21 (14 created, 7 modified)

## Accomplishments

**Task 1 — the notifications backend (derived feed + last-seen cursor)** — commit `7a47bee`

- `app/notifications/service.py` ships `list_notifications` and `mark_seen`. The feed is a *derived view* (D-23 — NO new storage): `list_notifications` resolves the caller's teams (`_team_ids_for_user`), reads recent rows from the existing `jobs` table via `jobs_service.list_recent_jobs`, keeps only the terminal (`succeeded` / `failed`) rows — completions only (D-22, in-flight excluded) — and computes `unread_count` as the number of feed rows newer than the caller's `NotificationSeen` cursor (all rows when no cursor row exists). `mark_seen` upserts the per-user `NotificationSeen` row to `utcnow()`.
- `app/notifications/routes.py` exposes `GET /notifications` (team-scoped) and the CSRF-protected `POST /notifications/seen` (`operation_id="notifications_mark_seen"`), the latter returning the refreshed feed so the bell resets its badge in one round-trip.
- `app/main.py` mounts the notifications router (append-only).
- `frontend/src/lib/api/notifications.ts` ships the typed `listNotifications` / `markSeen` client; `NotificationItem` / `NotificationFeed` types appended to `types.ts`; the module is re-exported on the `api` namespace (`client.ts`) and `api/index.ts`.
- `backend/tests/test_notifications.py` — 8 DB-backed tests (485 backend tests total pass, up from 477).

**Task 2 — the notification bell, the noVNC console tab, the Networks admin tab, the provisioning banner** — commit `6525abe`

- `NotificationBell.svelte` — a 36px ghost button left of the Tasks icon in `Topbar.svelte`, with a 20px unread badge (hidden at 0, `9+` overflow, `bg-primary` normally, `bg-destructive` when any unread item is a failed job). Click opens a 380px popover feed of recent completions reconciled from the REST feed + the live `jobsStore`; opening calls `api.notifications.markSeen` (open acknowledges). Empty state: `BellOff` + "No notifications".
- `ConsoleTab.svelte` — fills the formerly-disabled Console tab. On mount it renders ONLY a centered placeholder (`MonitorPlay`, "Console", "Open console" button) — NO `<iframe>` in the DOM (CON-02). On "Open console" it calls `api.console.mintVncProxy` and renders the iframe at the returned `relay_url`; `consoleIframeSrc` throws on any `:8006` / `vncwebsocket` URL so the Proxmox host can never reach the browser (CON-03). Reconnect re-mints; a dropped session shows a `bg-warning/10` strip; a `Maximize2` Fullscreen control carries both `aria-label` and `title`.
- `NetworksTab.svelte` — a third "Networks" tab on `admin/teams/[id]/+page.svelte`, parallel to Quotas (D-18). Per cluster, a card with an SDN-VNet checkbox group (unchecked until granted) + a legacy-bridge checkbox group (checked-by-default — D-19); saves through `api.networks.setTeamNetworkScope`.
- The VM-detail provisioning banner (`inventory/[cluster]/[vmid]/+page.svelte`) — a 48px strip below the header while a create job for the cluster is in flight (`bg-primary/10` + `Loader2`), switching to `bg-destructive/10` + the friendly PVE error + a "View in Tasks" link on failure (NO Retry — provisioning is non-idempotent, D-16), self-dismissing on success. The Console `Tabs.Trigger`'s `Lock` marker + "ships in Phase 4" tooltip were removed.
- `notification-bell.test.ts` + `console-tab.test.ts` — 43 logic tests over the four extracted `.ts` modules (251 frontend tests total pass, up from 208).

## Must-Haves Verification

- A user can open an embedded noVNC console; the iframe is rendered only on click — `console-tab.test.ts::"does NOT render the iframe in the placeholder state"` + `"the placeholder state is the on-mount default"`.
- Console traffic flows through the GUI's reverse-proxied URL; the browser never gets a Proxmox-host URL — `isSafeRelayUrl` / `consoleIframeSrc` reject `:8006` and `vncwebsocket`; `"the iframe src never contains the PVE web port"`.
- The notification bell shows an unread count derived from the jobs feed + a per-user cursor — `test_notifications_unread_count_uses_seen_cursor` + `notification-bell.test.ts` badge tests.
- An admin can scope per-cluster SDN VNets + legacy bridges on a Networks tab parallel to Quotas — `NetworksTab.svelte` + the new `Tabs.Trigger value="networks"`; `networks-tab.ts` enforces D-19.
- The VM detail page shows a provisioning banner while a create job is in flight — `console-tab.test.ts::"provisioning banner — state derivation"`.

## Verification

- `python -m pytest tests/test_notifications.py` — 8/8 pass; full backend suite **485 pass** (477 prior + 8 new).
- `python -c "from app.main import create_app; create_app()"` — the app boots with the notifications router.
- `ruff check app/notifications` — clean.
- `pnpm test` — 19 files, **251 tests pass** (208 prior + 43 new).
- `pnpm exec svelte-check --threshold error` — 0 errors, 0 warnings.
- `pnpm exec tsc --noEmit` — 10 errors, all the documented pre-existing `TS2614` shadcn-svelte primitive errors (`alert`/`badge`/`button`/`tabs` index files); **none touch any file created or modified by this plan** (confirmed by grep). The project's real type-check is `svelte-check`, which is clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.ts` import extensions broke `svelte-check`**
- **Found during:** Task 2
- **Issue:** the `.svelte` components initially imported their logic modules with an explicit `.ts` extension; `svelte-check` rejects this (`allowImportingTsExtensions` is off in the project's tsconfig).
- **Fix:** dropped the `.ts` extension from the four logic-module imports — matching the established `./lxc-wizard` import style.
- **Files modified:** `NotificationBell.svelte`, `ConsoleTab.svelte`, `NetworksTab.svelte`, `inventory/[cluster]/[vmid]/+page.svelte`
- **Commit:** `6525abe`

**2. [Rule 1 - Bug] `$state` variable named `state` shadowed the `$state` rune**
- **Found during:** Task 2
- **Issue:** `ConsoleTab.svelte` declared `let state = $state<ConsoleState>(...)`; naming the variable `state` made the compiler treat the rune as referenced-in-its-own-initializer (`'$state' used before its declaration`), cascading `Untyped function calls may not accept type arguments` onto the following `$state` calls.
- **Fix:** renamed the state variable to `phase` throughout the component.
- **Files modified:** `ConsoleTab.svelte`
- **Commit:** `6525abe`

Both were blocking compile issues caught by `svelte-check`; neither changed the planned behaviour.

### Interface adjustment (plan sketch vs. project reality)

- The plan listed `notification-bell.test.ts` / `console-tab.test.ts` as "component-render tests with mocked api … and a stubbed jobsStore". The project's vitest env is `node` (no DOM) and every Phase 1-4 component test is logic-only (see `lxc-wizard.test.ts`, `empty-state.test.ts`). Following that established discipline, the bell / console / networks / banner logic was extracted into node-testable `.ts` modules (`notification-feed.ts`, `console-tab.ts`, `networks-tab.ts`, `provisioning-banner.ts`) and the tests exercise those modules; the rendered Svelte markup is covered by `svelte-check`. Same coverage intent, project-correct mechanism — not a behaviour deviation.

## Threat Model Compliance

- **T-04-14-01** (Proxmox-host / vncticket exposure) — `consoleIframeSrc` is the single chokepoint for the iframe `src`; it throws on any `:8006` or `vncwebsocket` URL. `console-tab.test.ts` asserts the src never contains `:8006`.
- **T-04-14-02** (console minted on page load / without a click) — `ConsoleTab` renders no iframe and makes no `mintVncProxy` call until "Open console" is clicked; `iframeVisible('placeholder')` is `false`. The Plan-04-08 mint route re-checks ownership server-side.
- **T-04-14-03** (cross-tenant notification leakage) — `list_notifications` scopes the feed to the caller's own team ids; `test_notifications_feed_is_cross_tenant_scoped` proves another team's job is absent.
- **T-04-14-04** (network-scoping CRUD by a non-admin) — `NetworksTab` is rendered inside the already-admin-gated `/admin/teams/{id}` page; the real enforcement is `require_admin` on the Plan-04-07 `PUT .../networks` route (defense-in-depth).
- **T-04-14-05** (stale last-seen cursor) — accepted in the plan: the cursor only affects the unread *count*, never the feed contents; no security decision rides on it.

No new threat surface beyond the plan's `<threat_model>` was introduced.

## Known Stubs

**None.** Every surface is fully wired: the notifications backend serves a real derived feed, the bell reconciles real REST + live data, the console tab mints a real ticket and embeds the real relay URL, the Networks tab reads/writes real scope CRUD, and the provisioning banner reads the live `jobsStore`.

## Self-Check: PASSED

- All 14 created files exist on disk.
- All 2 task commits (`7a47bee`, `6525abe`) are in `git log`.
- Zero file deletions in either commit.
- 485 backend tests + 251 frontend tests pass; `svelte-check` clean; the app boots with the notifications router.
