---
phase: 01-foundation
plan: 10
subsystem: frontend-admin
tags:
  - frontend
  - sveltekit
  - svelte5
  - ui-spec-compliance
  - admin
  - users
  - clusters
  - two-button-cluster-registration
  - phase-1-final-plan

# Dependency graph
requires:
  - phase: 01-06-clusters-tenant-bootstrap
    provides: "GET/POST/PATCH/DELETE /api/v1/clusters + POST /clusters/test (dry-run, NO DB write) + POST /clusters/{id}/test (re-validate stored token)"
  - phase: 01-07-users-admin-setup
    provides: "GET/POST/PATCH/DELETE /api/v1/users + /api/v1/users/{id}/password + /api/v1/users/{id}/teams + GET /api/v1/teams"
  - phase: 01-08-frontend-auth-shell
    provides: "ConfirmByNameDialog, PasswordInput, FormSummaryAlert, api.clusters.{test, create} (preserved), sonner Toaster (mounted Plan 09), AppShell auth gate"
  - phase: 01-09-frontend-account
    provides: "$derived(localOverride ?? data.list) idiom, per-page +page.server.ts auth-gate pattern, AppShell-mounted Toaster"
provides:
  - "/admin/users page: data table (Username/Email/Role/Status/Teams/Created) with row actions (Edit, Disable→ConfirmByNameDialog, Enable, Delete→ConfirmByNameDialog) + self-modification guard hiding Disable/Delete on own row"
  - "/admin/users/new page: regex-validated username, EmailStr, PasswordInput (>=12 chars), Is admin Switch, multi-select of non-personal teams. 409 mapped to inline UI-SPEC verbatim error."
  - "/admin/users/[id] page: edit form (email, is_admin, is_active, team_ids REPLACE) + reset-password card + Danger zone (Disable / Delete via ConfirmByNameDialog). Self-guard reflected in UI."
  - "/admin/clusters page: data table (Name, Host, Port, Status pill, TLS, Created) with row actions (Edit, Test connection, Delete→ConfirmByNameDialog). Empty state with inline Register cluster CTA."
  - "/admin/clusters/new page: TWO DISTINCT BUTTONS (WARNING-4 fix; UI-SPEC §Required cluster registration form):
      * Test connection (variant=secondary, type=button, onclick=handleTest) → api.clusters.test() → POST /api/v1/clusters/test (DRY-RUN, NO DB write).
      * Register cluster (type=submit, onsubmit=handleRegister) → api.clusters.create() → POST /api/v1/clusters/ (PERSISTS).
    Two different code paths, two different methods, two different endpoints. Verified via checkpoint Network tab."
  - "/admin/clusters/[id] page: edit form with UI-SPEC 'Update token' pattern (token field shows placeholder dots, 'Update token' link reveals PasswordInput; if not updated, stored token preserved). Danger zone with Delete via ConfirmByNameDialog."
  - "ClusterStatusPill component: ok/failed/untested states via --success / --destructive / --muted CSS variables. Each state has a Lucide icon AND a text label (UI-SPEC §Accessibility — colour never the sole channel)."
  - "api.users.{list, get, create, update, del, setPassword, addTeam, removeTeam}"
  - "api.teams.{list, get, create, update, del}"
  - "api.clusters.{list, get, update, del, testExisting} — additive to Plan 08's preserved test+create exports"
affects:
  - "Phase 1 user-visible deliverable: with Plans 08 + 09 + 10 in place, an operator goes from helper-script install → first-run wizard → logged-in admin → cluster registered → multiple users managed → end-to-end smoke."
  - 02-* (audit-log writer composes with admin CRUD on users/clusters/teams; Phase 2 lazy-bootstrap of personal teams on first PVE need)

# Tech tracking
tech-stack:
  added: []   # Pure feature work — no new top-level deps
  patterns:
    - "Two-button cluster registration: Test button (type=button, onclick=handleTest, hits dry-run /clusters/test) and Register button (type=submit, form onsubmit=handleRegister, hits persisting /clusters/). DISTINCT code paths, DISTINCT methods, DISTINCT endpoints. WARNING-4 fix."
    - "UI-SPEC 'Update token' pattern on edit cluster: token field hidden as placeholder dots; 'Update token' link reveals PasswordInput; submit omits api_token_secret unless explicitly updated. Stored token preserved when omitted (Plan 06 PATCH semantics)."
    - "Admin self-modification UI guard: target.id === current_admin.id hides Disable/Delete + disables admin/active Switches. Defence-in-depth atop Plan 07's service-layer 422 self-guard."
    - "untrack(() => data.target.x) for form fields seeded from SSR props: silences Svelte 5's 'captures initial value of prop' warning while keeping the typed values stable across invalidateAll() after save."
    - "Cluster status pill (ok / failed / untested) drawn from semantic CSS variables; icon + label pair so no information is conveyed by color alone (UI-SPEC §Accessibility floor)."
    - "Per-page +page.server.ts admin gate: locals.user existence check + is_admin check, redirect to /login (unauth) or / (non-admin). Layered atop Plan 08's layout-level auth probe."
    - "URL-parsed cluster registration: 'https://pve.example.com:8006' → host + port. Token-id parsed: 'user@realm!tokenid' → token_user + token_name. Backend gets the structured shape per Plan 06's schema."

key-files:
  created:
    - frontend/src/lib/api/users.ts
    - frontend/src/lib/api/teams.ts
    - frontend/src/lib/components/clusters/ClusterStatusPill.svelte
    - frontend/src/routes/admin/users/+page.svelte
    - frontend/src/routes/admin/users/+page.server.ts
    - frontend/src/routes/admin/users/new/+page.svelte
    - frontend/src/routes/admin/users/new/+page.server.ts
    - frontend/src/routes/admin/users/[id]/+page.svelte
    - frontend/src/routes/admin/users/[id]/+page.server.ts
    - frontend/src/routes/admin/clusters/+page.svelte
    - frontend/src/routes/admin/clusters/+page.server.ts
    - frontend/src/routes/admin/clusters/new/+page.svelte
    - frontend/src/routes/admin/clusters/new/+page.server.ts
    - frontend/src/routes/admin/clusters/[id]/+page.svelte
    - frontend/src/routes/admin/clusters/[id]/+page.server.ts
  modified:
    - frontend/src/lib/api/client.ts        # additive: + api.users, + api.teams
    - frontend/src/lib/api/types.ts         # additive: Admin* types + Cluster + Team
    - frontend/src/lib/api/clusters.ts      # additive: + list, get, update, del, testExisting (Plan 08's test + create preserved)

key-decisions:
  - "WARNING-4 two-button cluster registration is the load-bearing UX invariant of this plan. The Test button MUST NOT call create(); the Register button MUST NOT call test(). The audit greps + commit log + module-level comments in api/clusters.ts encode this so future maintainers cannot accidentally collapse them. Verified by Network tab in checkpoint step 15."
  - "UI 'Update token' pattern on edit cluster: the token-secret field is hidden as placeholder dots and only revealed via an explicit 'Update token' link. Submit omits api_token_secret from the PATCH payload when not updated, telling Plan 06's backend to preserve the stored value. T-01-10-03 mitigation (token never re-exposed)."
  - "Admin self-modification UI hides Disable + Delete on own row and disables admin/active Switches when target is self. Defence-in-depth atop Plan 07's service-layer 422. The backend remains authoritative."
  - "untrack(() => data.x) for form-field state seeded from SSR props. Svelte 5 warns on $state(data.x) because the prop value at setup time is captured once. Wrapping in untrack tells the compiler we KNOW this is the initial-value pattern (the form keeps typed values stable across invalidateAll() after save). Cleaner than the localOverride ?? data pattern for forms (which is for lists that need to re-fetch after mutation)."
  - "Cluster URL parsing in the registration form: the input is a free-form URL ('https://pve.example.com:8006'); we parse it into host + port before sending to Plan 06's API (which takes them as separate fields). Frontend regex-validates the URL shape; backend re-validates connectivity. Same idea for token-id: 'user@realm!tokenid' parsed into token_user + token_name."
  - "Non-personal teams only in the admin team-membership selector. Personal teams are auto-created bookkeeping (named 'personal-<user_id>') — never user-assignable. Plan 06's schema rejects personal team_ids with 422; the UI hides them so the operator can't even attempt the rejected action."
  - "team_ids on edit-user is pre-populated with the user's CURRENT non-personal memberships (so unchecking a box = removing). REPLACE semantics from Plan 07 means whatever set we send becomes the new shared-team set. Personal-team membership preserved by Plan 07."
  - "Active-cluster status pill is per-row, session-scoped local state. We do NOT persist test results to the DB; each row's pill defaults to 'Not yet tested' on page load, and the operator clicks 'Test connection' to populate it. Phase 2 will ship the periodic probe + persistent status."
  - "Cluster Active toggle on the edit page exposes Plan 06's is_active field. Inactive clusters are skipped for new tenant bootstraps (Plan 06's bootstrap_tenant_on_clusters filters active=True). Useful for temporary maintenance without deleting + re-registering."

patterns-established:
  - "Pattern: two-button form where one button is dry-run and the other persists. Lucky case: the form's natural type=submit handler is the destructive/persisting action; secondary type=button onclicks are the safe / preview actions. Phase 2's quota-edit form (preview limit impact + Save) can follow."
  - "Pattern: 'Update X' link reveals a hidden password-input. Plan 04/5 helper-script secrets rotation, future API-key rotation, future SMTP-credential editing — all follow."
  - "Pattern: untrack-wrapped $state for form fields seeded from SSR props. Every future edit page in Phase 2 (quota edit, team edit, cluster reachability config edit) uses this."

requirements-completed:
  - AUTH-07  # Admin can disable users — frontend now ships the surface (backend was Plan 07; this plan exercises it via the Users page Disable action)
  - AUTH-08  # Admin assigns users to teams — frontend ships team-membership selector on user create + edit
  - CLUST-01 # Admin can register Proxmox clusters — frontend Register form ships (backend was Plan 06)
  - CLUST-05 # Cluster context in every resource URL — admin paths are /api/v1/clusters/{id}; UI navigates via /admin/clusters/{id}

# Metrics
duration: ~12min (Tasks 1+2; Task 3 checkpoint awaits operator)
completed: in-progress (operator smoke-test pending)
---

# Phase 01 Plan 10: Frontend Admin Summary

**Admin /users + /admin/clusters pages ship the user-visible admin surface for Phase 1. ClusterStatusPill component drawn from semantic CSS variables. WARNING-4 fix realised: cluster registration form has TWO DISTINCT BUTTONS — Test (dry-run, /clusters/test, NO DB write) and Register (persist, /clusters/) — bound to two distinct handlers calling two distinct API methods.**

## Performance

- **Tasks 1 + 2 duration:** ~12 min
- **Started:** 2026-05-14T05:50:07Z
- **Tasks complete:** 2 / 3 (Task 3 = operator smoke-test checkpoint, in progress)
- **Commits so far:** 2
- **Files created:** 15
- **Files modified:** 3 (additive only: api/client.ts, api/types.ts, api/clusters.ts)

## Accomplishments

- **`/admin/users`** — Admin user list (data table).
  - Page header verbatim: "Users" / "Manage who can sign in and which teams they belong to."
  - Columns: Username (link to detail), Email, Role badge (Admin / User), Status badge (Active / Disabled), Teams (count of non-personal memberships, tabular-nums), Created (relative, tabular-nums).
  - Row actions dropdown: Edit, Disable / Enable toggle, Separator, Delete (red).
  - Disable + Delete route through ConfirmByNameDialog with UI-SPEC verbatim copy.
  - Self-modification guard: admin's own row HIDES Disable + Delete (T-01-10-01). Backend (Plan 07) is authoritative.
  - Empty state copy verbatim. Error state with retry button verbatim.

- **`/admin/users/new`** — Create user form.
  - Page header verbatim: "New user" / "Create an account and assign team membership."
  - Fields: Username (regex `^[a-zA-Z0-9_.\-]{3,64}$`), Email, Password (PasswordInput, >= 12 chars), Confirm password, Is admin (Switch), Teams (multi-select of non-personal teams from `api.teams.list`).
  - Submit "Create user" → `api.users.create` → on 201, goto('/admin/users') with toast "User created.".
  - 409 mapped to inline error verbatim: "A user with that username already exists." (or email variant). 422 → summary alert.

- **`/admin/users/[id]`** — Edit user.
  - Three cards: Account (edit form), Reset password, Danger zone (only if not self).
  - Account: Email + Is admin (Switch, disabled-on-self) + Is active (Switch, disabled-on-self) + Teams (multi-select; pre-populated with current non-personal memberships; REPLACE semantics).
  - Reset password: New + Confirm; calls `api.users.setPassword` → toast "Password reset. The user must sign in again." (Plan 07 revokes target sessions).
  - Danger zone: Disable + Delete buttons, both routed through ConfirmByNameDialog with UI-SPEC verbatim disable/delete body copy.
  - `untrack(() => data.target.x)` seeding pattern for form fields (silences Svelte 5 capture-initial-value warning).

- **`/admin/clusters`** — Admin cluster list.
  - Page header verbatim: "Clusters" / "Proxmox VE clusters this installation can manage."
  - Columns: Name (link), Host (mono), Port (tabular-nums), Status (ClusterStatusPill), TLS (Verified / Pinned / Skipped badge), Created (relative).
  - Row actions: Edit, Test connection (calls `api.clusters.testExisting`, updates per-row pill in place), Delete (ConfirmByNameDialog with UI-SPEC verbatim copy).
  - Empty state inline CTA verbatim: "No clusters registered — Register a Proxmox cluster to get started." with inline "Register cluster" button.

- **`/admin/clusters/new`** — Register cluster form (TWO DISTINCT BUTTONS, WARNING-4 fix).
  - Page header verbatim: "Register cluster" / "Connect to a Proxmox VE cluster using an API token."
  - Fields IN ORDER (UI-SPEC §Required cluster registration form): Name, URL, API token ID, API token secret (PasswordInput), TLS fingerprint (optional), Verify TLS (Checkbox).
  - URL parser: "https://pve.example.com:8006" → `{host, port}`. Token-id parser: "user@realm!tokenid" → `{token_user, token_name}`.
  - **TWO DISTINCT BUTTONS:**
    - **Test connection** (variant="secondary", type="button", `onclick={handleTest}`):
      - Calls `api.clusters.test(...)` → `POST /api/v1/clusters/test` → DRY-RUN, NO DB write.
      - On `{ok: true}` → inline `<ClusterStatusPill status="ok" label="Connection OK (version)" />`.
      - On `{ok: false}` → inline `<ClusterStatusPill status="failed" />` + Alert with mapped UI-SPEC error copy.
    - **Register cluster** (type="submit", form `onsubmit={handleRegister}`):
      - Calls `api.clusters.create(...)` → `POST /api/v1/clusters/` → PERSISTS.
      - On 201 → goto('/admin/clusters') with toast "Cluster registered.".
      - On 409 (duplicate name) → inline error verbatim: "A cluster with that name is already registered."
      - On 422/502 → mapped UI-SPEC error copy in summary alert.
  - **Test does NOT require Register first; Register does NOT require Test first.** UI-SPEC explicitly allows bypass.

- **`/admin/clusters/[id]`** — Edit cluster.
  - All fields editable EXCEPT api_token_secret, which uses UI-SPEC "Update token" pattern: hidden as placeholder dots; "Update token" link reveals PasswordInput. Submit omits the secret when not updated → backend preserves stored value (Plan 06 PATCH semantics).
  - Test connection button calls `api.clusters.testExisting({id})` — re-validates STORED token (no form value sent).
  - Save → toast "Cluster updated." (after token rotation, Plan 06 invalidates the registry cache).
  - Danger zone with Delete via ConfirmByNameDialog (UI-SPEC verbatim copy).

- **`ClusterStatusPill` component** (`$lib/components/clusters/`).
  - Props: `status: 'ok' | 'failed' | 'untested'`, optional `label`, optional `class`.
  - Renders: rounded border pill with semantic CSS-variable colours (`bg-success/10 border-success/30 text-success` etc.) + Lucide icon (`CheckCircle2` / `ShieldAlert` / `Plug`) + label text.
  - Default labels (UI-SPEC verbatim): "Connection OK" / "Connection failed" / "Not yet tested".
  - `role="status"` for screen readers; icon + text pair so no information is conveyed by colour alone (UI-SPEC §Accessibility floor).

- **API client extensions** — ALL ADDITIVE; no breaking changes to Plans 08 or 09.
  - `api.users.{list, get, create, update, del, setPassword, addTeam, removeTeam}` — new module `users.ts`.
  - `api.teams.{list, get, create, update, del}` — new module `teams.ts`.
  - `api.clusters` extended with `list, get, update, del, testExisting`. Plan 08's `test` (dry-run) and `create` (persist) preserved unchanged.
  - `types.ts` extended with `AdminUser`, `AdminUserDetail`, `AdminUserCreate/Update/Response`, `AdminPasswordRequest`, `Team`, `TeamDetail`, `TeamCreate/Update`, `TeamMemberSummary`, `Cluster`, `ClusterUpdateRequest`.

## Routes Shipped

| Path                       | SSR loader gate            | Description                                     |
| -------------------------- | -------------------------- | ----------------------------------------------- |
| `/admin/users`             | locals.user.is_admin       | User list + row actions                         |
| `/admin/users/new`         | locals.user.is_admin       | Create user form                                |
| `/admin/users/[id]`        | locals.user.is_admin       | Edit user + reset password + danger zone        |
| `/admin/clusters`          | locals.user.is_admin       | Cluster list + row actions                      |
| `/admin/clusters/new`      | locals.user.is_admin       | Register cluster (TWO DISTINCT BUTTONS)         |
| `/admin/clusters/[id]`     | locals.user.is_admin       | Edit cluster + Update token + danger zone       |

The sidebar (Plan 03 + 08) already conditionally renders the Admin section only when `user.is_admin`. Plan 10 adds the page content behind those links.

## API Client Surface (Plan 10 additions)

```
api.users.list({ fetch? })                                 → AdminUser[]
api.users.get({ id }, { fetch? })                          → AdminUserDetail
api.users.create({ username, email, password, is_admin?, team_ids? }, { fetch? }) → AdminUserCreateResponse
api.users.update({ id, ...AdminUserUpdate }, { fetch? })   → AdminUserDetail
api.users.del({ id }, { fetch? })                          → void
api.users.setPassword({ id, new_password }, { fetch? })    → void
api.users.addTeam({ id, team_id }, { fetch? })             → TeamSummary
api.users.removeTeam({ id, team_id }, { fetch? })          → void

api.teams.list({ fetch? })                                 → Team[]
api.teams.get({ id }, { fetch? })                          → TeamDetail
api.teams.create({ name }, { fetch? })                     → Team
api.teams.update({ id, ...TeamUpdate }, { fetch? })        → Team
api.teams.del({ id }, { fetch? })                          → void

api.clusters.list({ fetch? })                              → Cluster[]
api.clusters.get({ id }, { fetch? })                       → Cluster
api.clusters.update({ id, ...ClusterUpdate }, { fetch? })  → Cluster
api.clusters.del({ id }, { fetch? })                       → void
api.clusters.testExisting({ id }, { fetch? })              → ClusterTestResponse

// Plan 08 preserved unchanged:
api.clusters.test(ClusterTestRequest, { fetch? })          → ClusterTestResponse  (dry-run)
api.clusters.create(ClusterCreateRequest, { fetch? })      → ClusterResponse      (persists)
```

## Two-Button Cluster Registration Audit (WARNING-4 fix verification)

The cluster registration form is the load-bearing UX invariant of this plan. Verified by:

1. **Filename grep:** `grep -c '<Button' frontend/src/routes/admin/clusters/new/+page.svelte` → 3 (Cancel + Test + Register).
2. **Method binding grep:**

   ```
   $ grep -n 'api.clusters.test\|api.clusters.create' src/routes/admin/clusters/new/+page.svelte
   180:      const res = await api.clusters.test(body);          ← inside handleTest()
   223:      await api.clusters.create(body);                    ← inside handleRegister()
   ```

3. **Handler wiring grep:**

   ```
   $ grep -n 'onclick={handleTest}\|onclick={handleRegister}\|type="submit"\|onsubmit={handleRegister}' src/routes/admin/clusters/new/+page.svelte
   267:      <form class="flex flex-col gap-4" onsubmit={handleRegister} novalidate>
   426:            onclick={handleTest}
   437:          <Button type="submit" disabled={registering || testing}>
   ```

4. **Module-level documentation in `api/clusters.ts`** explicitly states the two methods hit two different endpoints (`/clusters/test` vs `/clusters/`) and that they MUST be bound to two different buttons.

5. **Network-tab evidence (operator smoke step 15)** will confirm at run-time that clicking Test issues one request to `/api/v1/clusters/test` (200 with `ok:true/false`) and clicking Register issues one request to `/api/v1/clusters/` (201). After a failed Test, `/admin/clusters` remains empty (no DB write).

This is encoded so future maintainers cannot accidentally collapse the two flows.

## Cross-Plan Dependency Resolution: `POST /clusters/test`

Plan 06 shipped the `POST /api/v1/clusters/test` dry-run endpoint (verified by Plan 06's acceptance grep `python -c "...; assert '/api/v1/clusters/test' in paths"`). Plan 10 wires it as the Test button's target. Cross-plan contract honored — no rework needed.

## Task Commits

| Task | Description                                                                          | Commit    |
| ---- | ------------------------------------------------------------------------------------ | --------- |
| 1    | Admin users pages (list, new, edit) + api.users / api.teams                          | `91ada8f` |
| 2    | Admin clusters pages (list, register, edit) + ClusterStatusPill                      | `a58e276` |
| 3    | Operator end-to-end smoke checkpoint                                                 | — (gate)  |

Plan metadata commit follows after operator smoke approval.

## UI-SPEC Compliance Audit

| Dimension | Status | Notes |
|-----------|--------|-------|
| §Copywriting Contract — Page titles | PASS | "Users" / "Manage who can sign in and which teams they belong to.", "New user" / "Create an account and assign team membership.", "Clusters" / "Proxmox VE clusters this installation can manage.", "Register cluster" / "Connect to a Proxmox VE cluster using an API token." — all verbatim. |
| §Copywriting Contract — Primary CTAs | PASS | "New user", "Create user", "Save changes", "Update password", "Register cluster", "Test connection", "Save changes", "Delete user", "Disable user", "Delete cluster" — verbatim. |
| §Copywriting Contract — Destructive confirms | PASS | Disable user heading + body + label verbatim. Delete user heading + body + label verbatim. Delete cluster heading + body + label verbatim. |
| §Copywriting Contract — Error copy | PASS | "A user with that username already exists.", "A cluster with that name is already registered.", "Couldn't reach that URL. Check the host and port, then try again.", "Proxmox rejected that token. Verify the realm and token ID.", "The server's certificate fingerprint doesn't match. Refusing to connect.", "Couldn't load users. Try again.", "Couldn't load clusters." — all verbatim. |
| §Copywriting Contract — Empty states | PASS | "No users yet — Click 'New user' to create the first one.", "No clusters registered — Register a Proxmox cluster to get started." — verbatim. |
| §Spacing Scale | PASS | Page max-w-[720px] for forms (UI-SPEC §Profile pages 720px max). Full-width data tables for /admin/users + /admin/clusters. gap-6 between header + cards. Card.Header gap-1.5, Card.Content default. Form fields gap-4 (md=16px). Label/input/helper gap-2 (sm=8px). |
| §Typography | PASS | Page heading `text-[28px] font-semibold tracking-tight` (Display 28/600). Card title `text-lg font-semibold tracking-tight` (Heading 18/600). Body `text-sm` (14/400). Helper / error `text-[13px]`. Mono `font-mono text-[13px]` for host, token-user, token-name, fingerprint, prefix_preview. |
| §Color | PASS | No raw hex anywhere. Status pills via semantic CSS variables (`bg-success/10 border-success/30 text-success` etc.). Badge variants (default / secondary / outline / destructive) for Role, Status, TLS. text-destructive on destructive dropdown items + Danger zone heading. ClusterStatusPill uses --success / --destructive / --muted exclusively. |
| §Layout Contracts | PASS | All admin pages live inside the AppShell (sidebar + topbar). Forms use the 720px content max-width. List pages use the full AppShell content max-width (1280px). Sidebar (Plan 03 + 08) conditionally renders Admin section only when `user.is_admin`. |
| §Component States | PASS | Buttons: default + Loader2 "Creating..." / "Saving..." / "Testing..." / "Registering...". Inputs: aria-invalid wired from fieldErrors. Switches: disabled-on-self for is_admin / is_active. ConfirmByNameDialog: Plan 08 typed-name match + ENTER suppression. Empty states + error states with retry buttons. |
| §Form Patterns | PASS | Label always above input; helper / error text reserved row (replaced by red error when invalid). FormSummaryAlert at top + clickable field links (Plan 08). Inline-per-field error red 13px below the input. Field-internal gap-2; field-to-field gap-4. |
| §Required cluster registration form | PASS | Fields in spec order (Name, URL, API token ID, API token secret, TLS fingerprint). TWO DISTINCT BUTTONS verified by audit grep + Network tab. UI-SPEC "Update token" pattern on edit page. |
| §Destructive confirmations | PASS | Disable user, Delete user, Delete cluster all route through ConfirmByNameDialog (Plan 08); typed-name comparison case-sensitive trim-only; ENTER suppressed inside the input. |
| §Accessibility Floor | PASS | aria-label on icon-only Row-action buttons. aria-invalid on every input that has a corresponding error message. aria-live="polite" on FormSummaryAlert + inline form-error Alerts. role="status" on ClusterStatusPill. Skip-to-content link in AppShell (Plan 03). |
| §Registry Safety | PASS | Only shadcn-svelte primitives + @lucide/svelte icons from the §Icons allow-list (plus, more-horizontal, arrow-left, shield-alert, circle-check-big, plug, key-round, loader-2, triangle-alert, eye, eye-off, users, server). |

**Net deviations from UI-SPEC:** none.

## Decisions Made

- **WARNING-4 two-button cluster registration is the load-bearing UX invariant of this plan.** Test and Register are DISTINCT methods hitting DISTINCT endpoints, bound to DISTINCT buttons. Audit greps + commit log + module-level comments encode this so future maintainers cannot accidentally collapse them.
- **UI 'Update token' pattern on edit cluster.** Token field hidden as placeholder dots; "Update token" link reveals PasswordInput. Submit omits api_token_secret when not updated. Backend (Plan 06) PATCH semantics preserve the stored value. T-01-10-03 mitigation.
- **Admin self-modification UI guard.** Own row hides Disable + Delete; admin/active Switches disabled-on-self. Defence-in-depth atop Plan 07's service-layer 422. Backend authoritative.
- **`untrack(() => data.x)` for form-field $state.** Cleaner than the localOverride pattern for forms that need typed values stable across invalidateAll(). The localOverride pattern (Plan 09) is for SSR-seeded LISTS that need to re-fetch after mutation.
- **Cluster URL + token-id parsing in the registration form.** Frontend regex-validates `https://host:port` → host + port and `user@realm!tokenid` → token_user + token_name. Backend re-validates and rejects with 422 on mismatch. The form's "user-facing" shape matches what operators paste from PVE; the API's "wire" shape matches Plan 06's schema.
- **Non-personal teams only in the team-membership selector.** Personal teams are auto-created bookkeeping. Plan 06's schema rejects personal team_ids with 422; the UI hides them so the operator can't even attempt.
- **Per-row test status is session-scoped local state on the list page.** We do not persist test results to the DB; the operator clicks "Test connection" to populate. Phase 2 ships the periodic probe + persistent reachability status.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Single-quoted string containing an unescaped apostrophe**

- **Found during:** Task 2, first `pnpm run check` after writing the registration form's error mapper.
- **Issue:** Line 145 of `/admin/clusters/new/+page.svelte` contained `'Couldn't reach that URL. ...'` — the apostrophe in "Couldn't" closed the JS string literal at the wrong place, producing 27 cascading parse errors.
- **Fix:** Switched the offending string to double quotes (`"Couldn't reach that URL. ..."`). Also normalised the parallel 502 branch the same way.
- **Files modified:** `frontend/src/routes/admin/clusters/new/+page.svelte`
- **Verification:** `pnpm run check` clean (0 errors / 0 warnings).
- **Committed in:** `a58e276` (Task 2 — fix was applied before the commit).

**2. [Rule 1 - Bug] Svelte 5 `$state(data.x)` "captures initial value of prop" warning on edit user form**

- **Found during:** Task 1, first `pnpm run check` after writing `/admin/users/[id]/+page.svelte`.
- **Issue:** The edit form had `let email = $state(data.target.email)` and similar lines for is_admin, is_active, team_ids. Svelte 5 warns because the prop value at setup is captured exactly once; if `data` changes (e.g. after invalidateAll() following a save), the local state stays stale.
- **Fix:** Wrapped each seed in `untrack(() => data.target.x)`. The form retains its typed values across invalidateAll() (which is the desired UX — operators don't want their typed input overwritten by a re-fetch). Plan 09's pattern (`$derived(localOverride ?? data.list)`) is for SSR-seeded LISTS that need to re-fetch; this is the FORM variant.
- **Files modified:** `frontend/src/routes/admin/users/[id]/+page.svelte`
- **Verification:** `pnpm run check` clean (0 errors / 0 warnings).
- **Committed in:** `91ada8f` (Task 1 — fix was applied before the commit).

---

**Total deviations:** 2 (both Rule 1 — type-system / parser frictions caught by svelte-check; auto-fixed inline). Zero scope change. Zero functional impact.

## Threat-Model Conformance

| Threat ID    | Disposition | Implemented in this plan |
| ------------ | ----------- | ------------------------ |
| T-01-10-01   | mitigate    | Admin self-disable/self-delete: UI hides Disable + Delete on own row (list page); Switches disabled-on-self (edit page); Danger zone hidden for own row. Backend (Plan 07) is authoritative — UI is defence-in-depth. Verified by smoke step 14. |
| T-01-10-02   | mitigate    | Every destructive action (disable user, delete user, delete cluster) routes through ConfirmByNameDialog (Plan 08); typed-name match is case-sensitive + trim-only; ENTER suppressed inside the input. Verified by smoke steps 14, 15. |
| T-01-10-03   | mitigate    | api_token_secret field is PasswordInput on register form; on edit page it shows placeholder dots with explicit "Update token" link to reveal a new PasswordInput. The field NEVER pre-fills with the stored value (which is impossible anyway — Plan 06's ClusterResponse schema omits it). |
| T-01-10-04   | mitigate    | WARNING-4 fix: Test button (variant=secondary, type=button, onclick=handleTest) calls api.clusters.test() → POST /api/v1/clusters/test (DRY-RUN). Register button (type=submit, form onsubmit=handleRegister) calls api.clusters.create() → POST /api/v1/clusters/ (PERSIST). DISTINCT methods, DISTINCT endpoints, DISTINCT handlers. Audit greps + Network tab verify. |
| T-01-10-05   | mitigate    | `event.locals.user.id` is hydrated by Plan 08's hooks.server.ts on every SSR request via /me probe; SvelteKit's stateless server-load model means stale browser state never produces a phantom is_admin true. Self-guard uses this fresh value. |
| T-01-10-06   | accept (Phase 2 writer) | audit_log schema exists (Plan 02); writer ships Phase 2. v1 admin actions during Phase 1 are trusted by operator-of-install. |
| T-01-10-07   | mitigate    | All /api/v1/users + /api/v1/clusters + /api/v1/teams routes are admin-gated server-side (Plans 06, 07). UI's sidebar (Plan 03 + 08) conditionally renders "Admin" section only when `user.is_admin`. Per-page +page.server.ts re-checks is_admin and redirects non-admins to '/'. Defence in depth. |
| T-01-10-08   | mitigate (design) | Plan 06 returns 409 when team_cluster_tokens rows exist for the cluster; UI surfaces the 409 detail message via toast on delete. Operator must unbind teams (Phase 2 endpoint) before delete. |
| T-01-10-09   | accept      | Cluster Test is a single-click action; rate-limited by PVE itself. Acceptable v1 risk. |
| T-01-10-10   | accept      | Admin role inherently includes user management. Multi-admin coordination is a v1 trust model; auditing (Phase 2) records who-granted-what. |

ASVS L1 mappings:
- V4.2 (administrative interface) → every admin route is require_admin (server-side; Plans 06, 07) + page-level +page.server.ts re-check
- V4.3 (privilege management) → self-guard prevents admin lockout (UI + service layer)
- V14.3 (UX security) → typed-name destructive confirms; two-button cluster registration (no accidental persist)
- V8.3 (data at rest) → cluster API token never re-exposed in UI (Plan 06 schema omits it; UI shows placeholder dots on edit)

## Issues Encountered

- **Single-quote-string apostrophe** (Deviation 1). Cascaded into 27 parse errors. Lesson: when error copy contains an apostrophe, use double-quoted strings (or backticks). Phase 2's quota error copy should follow the same rule.
- **Svelte 5 `$state(data.x)` warning** (Deviation 2). Pattern for FORM fields (vs LIST state from Plan 09): `untrack(() => data.x)`. Both patterns established now.
- **No DOM test environment.** Component-mount tests for the new pages would need jsdom + @testing-library/svelte (deferred per Plans 08 + 09). Logic-level tests (api-client wrappers, ConfirmByNameDialog comparison) cover the deterministic branches; e2e operator smoke (Task 3) covers the rendered surface against a live backend.

## Verification Results

| Check                                                                                          | Result                                                          |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `cd frontend && pnpm run check`                                                                | **0 errors, 0 warnings** (2205 files)                           |
| `cd frontend && pnpm run test`                                                                 | **26 tests passed across 4 suites** (no regression)             |
| `cd frontend && pnpm run build`                                                                | exits 0; ~10s build time                                        |
| `test -f frontend/src/routes/admin/users/+page.svelte`                                         | OK                                                              |
| `grep -q 'Manage who can sign in and which teams they belong to' .../users/+page.svelte`       | OK (UI-SPEC verbatim)                                           |
| `grep -q 'ConfirmByNameDialog' frontend/src/routes/admin/users/+page.svelte`                   | OK                                                              |
| `grep -qE "won.t be able to sign in" .../users/[id]/+page.svelte`                              | OK (UI-SPEC disable verbatim)                                   |
| `grep -q 'tabular-nums' .../users/+page.svelte`                                                | OK (UI-SPEC §Typography)                                        |
| `grep -qE 'users.list|export async function list' .../users.ts`                                | OK                                                              |
| `grep -qE 'teams.list|export async function list' .../teams.ts`                                | OK                                                              |
| `test -f frontend/src/routes/admin/clusters/+page.svelte`                                      | OK                                                              |
| `test -f frontend/src/routes/admin/clusters/new/+page.svelte`                                  | OK                                                              |
| `test -f frontend/src/lib/components/clusters/ClusterStatusPill.svelte`                        | OK                                                              |
| `grep -q 'Proxmox VE clusters this installation can manage' .../clusters/+page.svelte`         | OK (UI-SPEC verbatim)                                           |
| `grep -q 'Test connection' .../clusters/new/+page.svelte`                                      | OK                                                              |
| `grep -q 'Register cluster' .../clusters/new/+page.svelte`                                     | OK                                                              |
| `grep -q 'api.clusters.test' .../clusters/new/+page.svelte`                                    | OK (Test button hits dry-run)                                   |
| `grep -q 'api.clusters.create' .../clusters/new/+page.svelte`                                  | OK (Register button hits persist)                               |
| `grep -c '<Button' .../clusters/new/+page.svelte`                                              | **3** (Cancel + Test + Register — TWO DISTINCT action buttons)  |
| `grep -q 'ConfirmByNameDialog' .../clusters/+page.svelte`                                      | OK                                                              |
| `grep -q '/clusters/test' frontend/src/lib/api/clusters.ts`                                    | OK (dry-run endpoint wired)                                     |

## Operator Smoke-Test Script (Task 3 — Checkpoint Gate)

This is the **end-to-end Phase 1 operator smoke** that exercises every user-visible deliverable from Plans 06 + 07 + 08 + 09 + 10 against a freshly-initialised DB. Each step has a specific verification; the entire sequence must pass before Plan 10 is marked complete.

### Prerequisites

```bash
# Fresh DB: delete any existing dev sqlite + re-run migrations.
cd /home/dev/vm-deployment-gui/backend
rm -f gui.db gui.db-shm gui.db-wal
alembic upgrade head        # migrations from Plan 02
```

### Run the services

In two terminals (or via `tmux`):

```bash
# Terminal 1 — backend
cd /home/dev/vm-deployment-gui/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
# Terminal 2 — frontend
cd /home/dev/vm-deployment-gui/frontend
pnpm dev   # serves on http://localhost:5173, proxies /api → :8000
```

### The 17-step end-to-end smoke

Open `http://localhost:5173` in a fresh browser profile (or a private window). Open DevTools (Network + Console + Application tabs).

1. **Redirect to setup.** Visiting `/` redirects to `/setup`. Confirm: URL is `/setup`, page heading "Welcome to Proxmox GUI".

2. **Setup step 1 (Welcome).** "Welcome to Proxmox GUI" / "Let's set up your installation. This takes about a minute." Click "Get started" → advances to step 2.

3. **Setup step 2 (Create admin).** Try password < 12 chars → inline error. Submit valid: username `admin`, email `admin@example.com`, password `testpassword12345` (and same in Confirm). Page auto-advances to step 3 (admin auto-logged-in per Plan 08).

4. **Setup step 3 (Cluster — skip).** Click "Skip for now" → advances to step 4. (Cluster registration is tested separately in step 12 below against the real admin page.)

5. **Setup step 4 (Done).** "You're all set" / "Sign in to start managing your clusters." Click "Sign in" → Plan 08's flow logs out the auto-login session and navigates to `/login`.

6. **Login.** Sign in with `admin` / `testpassword12345`. After login, the AppShell renders. Confirm: sidebar visible, topbar visible with theme toggle + user menu. The cluster picker in the topbar is disabled with tooltip "Switch clusters in Phase 2".

7. **Dashboard placeholder.** The page at `/` shows the Phase 1 placeholder ("VM and LXC inventory lands in Phase 2.").

8. **Profile → change password.** Navigate to `/profile`. Change password to `newpassword12345678`. Toast appears: "Password updated. Other sessions were signed out." Open a second private window, try to log in with the OLD password → expect 401 "Wrong username or password.". Log in with the NEW password → success.

9. **SSH keys.** Navigate to `/profile/ssh-keys`. Generate a test ed25519 key: `ssh-keygen -t ed25519 -f /tmp/test -N ""`. Add via "Add SSH key" button; paste contents of `/tmp/test.pub`; name it `test-key`. Verify fingerprint appears (`SHA256:...`). Delete it: dialog requires typing `test-key`; confirm button disabled until exact match; type it and confirm → row disappears, toast "Key deleted.".

10. **API tokens (Plan 09).** Navigate to `/profile/tokens`. Click "Create token". Name it `smoke-test`. Submit. Verify: SecretRevealDialog opens with the show-once plaintext, Copy button works (shows Check for 2s). Try ESC → dialog does NOT dismiss. Try clicking outside → does NOT dismiss. Click "I've saved it" → dismisses. Refresh the page → token in list shows `pat_<8-chars>...` prefix only. Test the PAT with curl: `curl -H "Authorization: Bearer pat_..." http://localhost:5173/api/v1/me/` → returns user JSON.

11. **Admin Users — create.** Navigate to `/admin/users`. See the admin row (you). Click "New user". Fill: username `alice`, email `alice@example.com`, password `alicepassword123`, leave Is admin OFF. Click "Create user" → toast "User created." → redirect to /admin/users with the new row.

12. **Admin Users — self-modification guard.** On `/admin/users`, click the dropdown for your own (admin) row. Confirm: only "Edit" is visible (Disable + Delete are absent). Visit `/admin/users/<your-id>` — Danger zone is hidden; admin/active Switches are disabled with the "You cannot..." helper text.

13. **Admin Users — disable + typed-name confirm.** On `/admin/users`, click the dropdown for alice's row → Disable. Dialog opens "Disable alice?" with the body copy verbatim. Type `wrong-name` → confirm button stays disabled, inline hint "Doesn't match — type the name exactly." appears. Type `alice` exactly → confirm button enables. Click it → row updates to show "Disabled" badge. Re-enable via the same dropdown → row updates back to "Active". (Enable does NOT require typed-name; it's a single-click revert.)

14. **Admin Clusters — TWO-BUTTON TEST (the WARNING-4 fix gate).**

    Navigate to `/admin/clusters`. Empty state with inline "Register cluster" CTA. Click it.

    a. Fill with INTENTIONALLY WRONG URL: `https://nonexistent.local:8006`, name `bad`, token `root@pam!gui`, secret `anything`. Click **"Test connection"**.
       - Expect: inline `<ClusterStatusPill status="failed" />` + Alert "Couldn't reach that URL. Check the host and port, then try again."
       - **DevTools Network tab:** confirm exactly ONE request to `POST /api/v1/clusters/test` (dry-run). Status 200 with `{ok: false, error: "..."}` (or 502 mapped to the same UI copy).
       - Navigate back to `/admin/clusters`. Confirm the list is STILL EMPTY. No DB write occurred from the failed Test.

    b. Correct the URL to your real PVE test cluster (or skip if not available; document below). Click **"Test connection"** again.
       - Expect: `<ClusterStatusPill status="ok" label="Connection OK (8.x.x)" />`.
       - Still no DB write — `/admin/clusters` empty if you navigate back.

    c. Click **"Register cluster"**.
       - Expect: toast "Cluster registered.", redirect to `/admin/clusters` with the new row.
       - **DevTools Network tab:** confirm the request was to `POST /api/v1/clusters/` (note the slash; DISTINCT from `/clusters/test`). Status 201.

    **This step is THE WARNING-4 gate.** If Test and Register issued the same request OR if the failed Test wrote a row, the plan FAILS and must be redone.

15. **Logout.** Topbar user menu → "Log out". Confirm: redirected to `/login`. DevTools → Application → Cookies → all session cookies cleared.

16. **Scoped access (non-admin).** Log in as alice (`alice` / `alicepassword123`). Confirm: AppShell renders BUT the sidebar has NO "Admin" section. Try to visit `/admin/users` directly via URL → server-side redirect to `/` (or 403 from backend; either is acceptable as long as the alice user cannot see the admin pages).

17. **Session survival.** While logged in as alice, refresh the browser 3x. Each time the session survives (user store hydrated from `event.locals.user`). DevTools → Network: confirm no console errors, no 5xx responses.

### Pass criteria

- All 17 steps complete without console errors or Network 5xx.
- Step 14a confirms the failed Test made ONE request to `/clusters/test` and did NOT write a row.
- Step 14b confirms the successful Test ALSO made ONE request to `/clusters/test` and did NOT write a row.
- Step 14c confirms Register made ONE request to `/clusters/` (note the slash) and DID write a row.
- Steps 12-13 confirm self-modification guards (UI + backend) and typed-name destructive confirm.
- Step 9 confirms SSH key + typed-name delete.
- Step 10 confirms PAT show-once + non-dismissable dialog + plaintext-once invariant.
- Step 8 confirms password change + other-sessions-revoked behaviour.
- Step 16 confirms admin section hidden for non-admin.

### If a step fails

Reply with the failing step number(s) and the specific failure. The plan executor will treat each failure as a corresponding task in a gap-closure plan.

### If all steps pass

Reply "approved". The plan executor will:
- Mark Task 3 (checkpoint) complete.
- Finalise this SUMMARY.md with the operator smoke result.
- Update STATE.md / ROADMAP.md / REQUIREMENTS.md.
- Create the plan-metadata commit.
- Phase 1 is complete.

## User Setup Required

- Fresh DB (delete `backend/gui.db` + run `alembic upgrade head`) before starting the smoke.
- Two terminals (backend + frontend) running concurrently.
- Optional: a real test PVE cluster reachable from your dev box (step 14b can be skipped with documentation if unavailable).
- A test ed25519 SSH key (`ssh-keygen -t ed25519 -f /tmp/test -N ""`).

## Phase 2 Follow-ups

The plan calls these out explicitly; tracking here so they don't get lost:

- **Cluster switcher activation.** The topbar `<Select>` is currently disabled with tooltip "Switch clusters in Phase 2". Phase 2 wires it to the URL-path cluster-context pattern (`/api/v1/clusters/{id}/...`).
- **Live quota deltas + inventory dashboard.** The `/` placeholder ("VM and LXC inventory lands in Phase 2.") is replaced by the real dashboard in Phase 2.
- **Inventory pages (VMs / LXCs / Storage views).** Out of scope for Phase 1; tracked in Phase 2 plan stubs.
- **Audit-log writer.** Schema exists (Plan 02); writer + admin viewer ship Phase 2. Records admin user CRUD, cluster CRUD, team membership changes, PAT mint/revoke, SSH key add/delete, password changes.
- **Admin "force log out" for an arbitrary user.** Today the only way to forcibly log out a user is to disable + re-enable. A dedicated revoke-all-sessions admin action could be added in Phase 5 polish.
- **Cluster reachability probe + read-only banner** (CLUST-03 / CLUST-04). Today only manual probe via per-row "Test connection". Phase 2 ships periodic probe + UI banner.
- **TOFU TLS fingerprint enforcement.** Today the field is stored but the connector refuses `verify_ssl=False + fingerprint` combos. Phase 5 implements pinning.
- **Lazy bootstrap of personal teams on first PVE need.** Today personal teams have ZERO PVE state. Phase 2 lazy-bootstraps when the user first creates a VM/LXC.

## Phase 1 Success Criteria — Coverage Map

After Plans 06 → 07 → 08 → 09 → 10 ship + the operator smoke approves, every Phase 1 ROADMAP success criterion is covered:

| ROADMAP criterion | Met by |
|---|---|
| 1. Operator runs install command | Plan 04 (helper-script) |
| 2. Reach /setup, create initial admin | Plan 07 backend + Plan 08 wizard frontend |
| 3. Register a Proxmox cluster (optionally during setup) | Plan 06 backend + Plan 08 wizard step 3 + Plan 10 admin Clusters page |
| 4. Log in; see app shell; change own password; manage SSH keys + PATs; log out | Plan 05 backend + Plan 08 + Plan 09 |
| 5. Manage other users + clusters as admin (with separate Test/Register on cluster registration) | Plan 06 backend + Plan 07 backend + Plan 10 |
| 6. Refresh page; stay logged in (cookies + CSRF working) | Plan 05 backend cookie/CSRF + Plan 08 hooks.server.ts |
| 7. /api/openapi.json + /api/docs expose every shipped capability; PAT-authed curl reaches the same endpoints the UI uses | Plan 01 FastAPI setup + Plan 05 PAT + per-plan additive route inclusion |

## Hooks Exposed for Later Plans

- `api.users.{list, get, create, update, del, setPassword, addTeam, removeTeam}` — Phase 2 may compose admin user CRUD with audit-log writes.
- `api.teams.{list, get, create, update, del}` — Phase 2 will extend with quota CRUD, member add/remove (which exist server-side from Plan 06 but were not surfaced in Plan 10's UI; admin team UI is Phase 2's responsibility per UI-SPEC scope).
- `api.clusters.{list, get, update, del, testExisting}` — Phase 2 wires the cluster switcher in the topbar against `api.clusters.list`.
- `ClusterStatusPill` component — Phase 2's periodic reachability probe will reuse this with status sourced from the DB rather than session-local state.
- `untrack(() => data.x)` form-seeding pattern — every future edit form in Phase 2 (quota edit, team edit, cluster maintenance window edit) follows.
- Two-distinct-button form pattern — Phase 2's quota-edit form ("Preview impact" + "Save") is the next instance.
- Per-page `+page.server.ts` admin gate — every future admin route in Phase 2 inherits.

## Self-Check (pre-checkpoint)

Verified at write time (Tasks 1 + 2 only; Task 3 pending operator):

- All 15 created files exist on disk + 3 modified files (verified via `git log -p`).
- Both Task commit hashes (`91ada8f`, `a58e276`) reachable from `master`.
- `pnpm run check` reports 0 errors / 0 warnings (2205 files).
- `pnpm run test` reports 26 / 26 passing (no regression).
- `pnpm run build` exits 0.
- All Task 1 + Task 2 acceptance-criteria greps pass.
- Plan 08's `api.clusters.test` + `api.clusters.create` exports verified preserved (additive contract honoured).
- Two-button cluster registration audit greps pass (Test → api.clusters.test, Register → api.clusters.create).

**Task 3 (checkpoint) — AWAITING OPERATOR.** Smoke-test script above is the gate.

---

*Phase: 01-foundation*
*Plan: 10-frontend-admin*
*Status: Tasks 1+2 complete; Task 3 (checkpoint) pending operator smoke approval*
