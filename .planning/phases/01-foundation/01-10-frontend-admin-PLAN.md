---
phase: 01-foundation
plan: 10
type: execute
wave: 7
depends_on:
  - 08
  - 09
files_modified:
  - frontend/src/lib/api/users.ts
  - frontend/src/lib/api/teams.ts
  - frontend/src/lib/api/clusters.ts
  - frontend/src/lib/api/client.ts
  - frontend/src/lib/api/types.ts
  - frontend/src/lib/components/clusters/ClusterStatusPill.svelte
  - frontend/src/routes/admin/users/+page.svelte
  - frontend/src/routes/admin/users/+page.server.ts
  - frontend/src/routes/admin/users/new/+page.svelte
  - frontend/src/routes/admin/users/[id]/+page.svelte
  - frontend/src/routes/admin/users/[id]/+page.server.ts
  - frontend/src/routes/admin/clusters/+page.svelte
  - frontend/src/routes/admin/clusters/+page.server.ts
  - frontend/src/routes/admin/clusters/new/+page.svelte
  - frontend/src/routes/admin/clusters/[id]/+page.svelte
  - frontend/src/routes/admin/clusters/[id]/+page.server.ts
autonomous: false
requirements:
  - AUTH-07
  - AUTH-08
  - CLUST-01
  - CLUST-05
user_setup: []
cross_plan_dependency: "requires POST /api/v1/clusters/test dry-run endpoint — coordinate with 01-06 executor (Plan 06 Task 1 adds this per WARNING 4 fix). Plan 10's Admin Clusters page registration form depends on this endpoint to wire the 'Test' button as a true dry-run (no DB write)."
tags:
  - frontend
  - sveltekit
  - svelte5
  - ui-spec-compliance
  - admin
  - users
  - clusters
must_haves:
  truths:
    - "Admin /users page is a data table with row actions (Edit, Disable/Enable, Delete) per UI-SPEC §Admin pages"
    - "Admin /users supports CRUD + team assignment per AUTH-07, AUTH-08"
    - "Admin /clusters page registers cluster with SEPARATE 'Test connection' (dry-run; no DB write) and 'Register cluster' (persists) buttons per UI-SPEC §Required cluster registration form"
    - "Test connection calls POST /api/v1/clusters/test (Plan 06 dry-run; no DB write); Register cluster calls POST /api/v1/clusters/ (persists)"
    - "Destructive actions (disable user, delete user, delete cluster) require typed-name confirmation via ConfirmByNameDialog (Plan 08)"
    - "Self-modification guards: admin cannot disable/delete themselves (UI hides controls + backend enforces)"
    - "Every UI string is the EXACT verbatim copy from UI-SPEC §Copywriting Contract"
    - "End-to-end operator smoke checkpoint: login → admin → register cluster (Test then Register) → CRUD a user → change own password → logout → refresh confirms session cleared"
  artifacts:
    - path: "frontend/src/routes/admin/users/+page.svelte"
      provides: "Admin user list (data table with row actions)"
      contains: "Manage who can sign in"
    - path: "frontend/src/routes/admin/clusters/new/+page.svelte"
      provides: "Cluster registration form with separate Test + Register buttons"
      contains: "Test connection"
    - path: "frontend/src/lib/components/clusters/ClusterStatusPill.svelte"
      provides: "Cluster status pill (ok/failed/untested) per UI-SPEC §Color §Semantic color usage"
      exports: ["ClusterStatusPill"]
  key_links:
    - from: "frontend/src/routes/admin/clusters/new/+page.svelte"
      to: "backend POST /api/v1/clusters/test (Plan 06 dry-run) AND POST /api/v1/clusters (persists)"
      via: "Test button calls /test (no DB write); Register button calls / (persists). Two distinct buttons per UI-SPEC."
      pattern: "/clusters/test"
    - from: "frontend/src/routes/admin/users/[id]/+page.svelte"
      to: "frontend/src/lib/components/forms/ConfirmByNameDialog.svelte (from Plan 08)"
      via: "Disable + Delete buttons open ConfirmByNameDialog typed-name confirm"
      pattern: "ConfirmByNameDialog"
---

<objective>
Land the two admin pages — `/admin/users` (CRUD users + team membership) and `/admin/clusters` (register/edit/test/delete clusters) — and the end-to-end operator smoke checkpoint that exercises the full Phase 1 success criteria. The Cluster registration form implements Test and Register as DISTINCT buttons per UI-SPEC: Test calls Plan 06's dry-run `POST /api/v1/clusters/test` endpoint (NO DB write), Register calls the persisting `POST /api/v1/clusters/` endpoint.

Purpose: Phase 1's admin-visible deliverable. With Plans 08 + 09 + 10 in place, an operator goes from `curl|bash` → first-run wizard → logged-in admin → cluster registered → multiple users managed → end-to-end smoke passes. This plan finalizes Phase 1's user-visible Phase 1 success criteria from ROADMAP.md.

Output: Two admin route trees (5 routes), the ClusterStatusPill component, the cross-plan dependency on Plan 06's `/clusters/test` dry-run endpoint resolved, and the operator smoke checkpoint approved.
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-UI-SPEC.md
@CLAUDE.md
@.planning/phases/01-foundation/01-06-SUMMARY.md
@.planning/phases/01-foundation/01-07-SUMMARY.md
@.planning/phases/01-foundation/01-08-SUMMARY.md
@.planning/phases/01-foundation/01-09-SUMMARY.md

<interfaces>
<!-- Backend routes available (Plans 06 + 07). -->

- `GET|POST|PATCH|DELETE /api/v1/users` + `/{id}` + `/{id}/password` + `/{id}/teams` + `/{id}/teams/{team_id}`
- `GET|POST|PATCH|DELETE /api/v1/teams` + `/{id}` + `/{id}/members`
- `GET|POST|PATCH|DELETE /api/v1/clusters` + `/{id}`
- `POST /api/v1/clusters/test` — **dry-run** (Plan 06 WARNING 4 fix); body = ClusterTestRequest; returns `{ok, version, release, error}`; **NO DB write**
- `POST /api/v1/clusters/{id}/test` — re-validate stored token for an existing cluster; returns `{ok, version, error}`

<!-- Frontend components imported from Plan 08 -->
- `$lib/components/forms/ConfirmByNameDialog.svelte`
- `$lib/components/forms/PasswordInput.svelte`
- `$lib/components/forms/FormSummaryAlert.svelte`
- `$lib/api/client.ts` — extend with `api.users.{...}`, `api.teams.{...}`, `api.clusters.{list, get, create, update, delete, test}`

<!-- Types added by this plan to types.ts -->
```ts
export interface Cluster { id: number; name: string; host: string; port: number; verify_ssl: boolean; token_user: string; token_name: string; tls_fingerprint: string | null; is_active: boolean; notes: string | null; created_at: string; updated_at: string; }
export interface ClusterTestResponse { ok: boolean; version?: string; release?: string; error?: string; }
export interface ClusterCreateRequest { name: string; host: string; port: number; verify_ssl: boolean; token_user: string; token_name: string; api_token_secret: string; tls_fingerprint?: string | null; notes?: string | null; }
export interface Team { id: number; name: string; personal: boolean; is_active: boolean; member_count: number; created_at: string; }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Admin Users pages (list, new, edit) + extend API client for users/teams</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-UI-SPEC.md (§Admin pages, §Form Patterns, §Destructive confirmations, §Copywriting Contract)
    - /home/dev/vm-deployment-gui/frontend/src/lib/components/forms/ConfirmByNameDialog.svelte (Plan 08)
    - /home/dev/vm-deployment-gui/frontend/src/lib/api/client.ts (extended by Plan 09)
  </read_first>
  <files>
    frontend/src/lib/api/users.ts,
    frontend/src/lib/api/teams.ts,
    frontend/src/lib/api/client.ts,
    frontend/src/lib/api/types.ts,
    frontend/src/routes/admin/users/+page.svelte,
    frontend/src/routes/admin/users/+page.server.ts,
    frontend/src/routes/admin/users/new/+page.svelte,
    frontend/src/routes/admin/users/[id]/+page.svelte,
    frontend/src/routes/admin/users/[id]/+page.server.ts
  </files>
  <action>
    **api/users.ts + api/teams.ts** — Method implementations:
    ```ts
    // users.ts
    export async function list(opts?) { ... }
    export async function get({id}, opts?) { ... }
    export async function create({username, email, password, is_admin, team_ids}, opts?) { ... }
    export async function update({id, ...payload}, opts?) { ... }
    export async function del({id}, opts?) { ... }
    export async function setPassword({id, new_password}, opts?) { ... }
    export async function addTeam({id, team_id}, opts?) { ... }
    export async function removeTeam({id, team_id}, opts?) { ... }

    // teams.ts
    export async function list(opts?): Promise<Team[]> { ... }
    export async function get({id}, opts?) { ... }
    export async function create({name}, opts?) { ... }
    export async function update({id, ...payload}, opts?) { ... }
    export async function del({id}, opts?) { ... }
    ```

    **api/client.ts** — Extend with `api.users` and `api.teams` (additive — do not break Plans 08/09 surface).

    **api/types.ts** — Extend with `Team` (and refine `User` if needed; Plan 08 already declared the core User).

    **routes/admin/users/+page.svelte** — UI-SPEC §Admin pages. Page header: "Users" + description "Manage who can sign in and which teams they belong to." + right-aligned primary "New user" button → goto('/admin/users/new'). Data table columns:
    - Username (medium 500), Email, Role (`<Badge variant="primary" if is_admin else "outline">"Admin"|"User"</Badge>`), Status (`<Badge variant="outline" if is_active else "muted">"Active"|"Disabled"</Badge>`), Teams (count), Created (relative). Row actions dropdown (`MoreHorizontal`) → "Edit" (link to `/admin/users/[id]`), "Disable/Enable" (PATCH is_active toggle — opens ConfirmByNameDialog for disable since destructive; toggle to enable is just a button), Separator, "Delete" (red — opens ConfirmByNameDialog with targetName=username).
    - Self-modification guard (UI): row actions for the currently-logged-in admin's own row HIDE "Disable" and "Delete". Backend enforces (Plan 07); UI removes the controls so they don't even appear.
    - Empty state: "No users yet — Click 'New user' to create the first one." (UI-SPEC) — but in practice admin sees themselves so empty is unreachable; render anyway for safety.
    - Loading skeleton: 5 rows.
    - Error state: "Couldn't load users. Try again." with retry button (UI-SPEC).
    - Tabular numbers (`font-variant-numeric: tabular-nums`) on numeric columns (Teams, Created).

    **routes/admin/users/+page.server.ts** — Load: `api.users.list(...)`.

    **routes/admin/users/new/+page.svelte** — Form per UI-SPEC §Form Patterns. Fields: Username (regex validate, helper "Letters, numbers, dots, dashes, underscores."), Email (EmailStr), Password (PasswordInput, helper "At least 12 characters."), Confirm password (must match), Is admin (Switch), Teams (multi-select against teams API list — `api.teams.list`). Submit "Create user" → `api.users.create`. On 409 (duplicate username): inline error per UI-SPEC. On success: goto('/admin/users') with toast "User created.".

    **routes/admin/users/[id]/+page.svelte** — Edit user form. Loads via +page.server.ts. Fields: Email (editable), Is admin (Switch, disabled if id === current_admin_id — self-guard reflected in UI), Is active (Switch, same self-guard), Teams (multi-select replaces current). Submit "Save changes" → `api.users.update`. Disable button at bottom (only if not self): opens ConfirmByNameDialog targetName=username, heading per UI-SPEC §Destructive confirmations "Disable {username}?", body "{username} won't be able to sign in. Active sessions are revoked immediately. You can re-enable them later." (verbatim). Delete button (only if not self): opens ConfirmByNameDialog with heading "Delete {username}?", body "Their account is removed permanently. Their team memberships are dropped. VMs they created stay with the team. This can't be undone." (verbatim). Separate "Reset password" card below: admin-set password form → calls `api.users.setPassword`. On success: toast "Password reset. The user must sign in again.".

    **routes/admin/users/[id]/+page.server.ts** — Load: `api.users.get`, plus `api.teams.list` for the team selector.
  </action>
  <verify>
    <automated>cd frontend && pnpm run check && pnpm run build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `test -f frontend/src/routes/admin/users/+page.svelte`
    - `grep -q 'Manage who can sign in and which teams they belong to' frontend/src/routes/admin/users/+page.svelte` (UI-SPEC verbatim)
    - `grep -q 'ConfirmByNameDialog' frontend/src/routes/admin/users/+page.svelte` (destructive pattern)
    - `grep -q "won.t be able to sign in\|won't be able to sign in" frontend/src/routes/admin/users/\[id\]/+page.svelte` (UI-SPEC disable verbatim copy)
    - `grep -q 'tabular-nums' frontend/src/routes/admin/users/+page.svelte` (UI-SPEC table contract)
    - `grep -q 'api.users\|users.list\|users.create' frontend/src/lib/api/users.ts`
    - `grep -q 'api.teams\|teams.list' frontend/src/lib/api/teams.ts`
    - `cd frontend && pnpm run check` exits 0
    - `cd frontend && pnpm run build` exits 0
  </acceptance_criteria>
  <done>Admin Users list/new/edit pages ship; self-guard reflected in UI; destructive confirms enforced; API client extended; copy verbatim.</done>
</task>

<task type="auto">
  <name>Task 2: Admin Clusters pages (list, register with separate Test + Register, edit) + ClusterStatusPill</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-UI-SPEC.md (§Admin pages, §Required cluster registration form, §Color §Semantic color usage, §Destructive confirmations, §Copywriting Contract)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-06-SUMMARY.md (Plan 06 dry-run endpoint shape — verify POST /clusters/test landed)
    - /home/dev/vm-deployment-gui/frontend/src/lib/components/forms/ConfirmByNameDialog.svelte (Plan 08)
    - /home/dev/vm-deployment-gui/frontend/src/lib/components/forms/PasswordInput.svelte (Plan 08)
    - /home/dev/vm-deployment-gui/frontend/src/lib/api/client.ts (extended by Plans 08/09 + Task 1)
  </read_first>
  <files>
    frontend/src/lib/api/clusters.ts,
    frontend/src/lib/api/client.ts,
    frontend/src/lib/api/types.ts,
    frontend/src/lib/components/clusters/ClusterStatusPill.svelte,
    frontend/src/routes/admin/clusters/+page.svelte,
    frontend/src/routes/admin/clusters/+page.server.ts,
    frontend/src/routes/admin/clusters/new/+page.svelte,
    frontend/src/routes/admin/clusters/[id]/+page.svelte,
    frontend/src/routes/admin/clusters/[id]/+page.server.ts
  </files>
  <action>
    **api/clusters.ts** — Method implementations:
    ```ts
    export async function list(opts?): Promise<Cluster[]> { ... }
    export async function get({id}, opts?): Promise<Cluster> { ... }
    export async function create(payload: ClusterCreateRequest, opts?): Promise<Cluster> { ... }
    export async function update({id, ...payload}, opts?): Promise<Cluster> { ... }
    export async function del({id}, opts?): Promise<void> { ... }
    // WARNING 4 fix: dry-run vs persisting test
    export async function test(payload: ClusterCreateRequest, opts?): Promise<ClusterTestResponse> {
      // POST /api/v1/clusters/test — NO DB write (Plan 06)
    }
    export async function testExisting({id}, opts?): Promise<ClusterTestResponse> {
      // POST /api/v1/clusters/{id}/test — revalidate stored token
    }
    ```

    **api/client.ts** — Extend with `api.clusters` (additive). The setup wizard (Plan 08) used inline cluster methods; consolidate them here so `api.clusters` is canonical. Plan 08's setup wizard should import from `api.clusters` after this plan ships (executor verifies + adjusts the setup wizard import path if needed).

    **api/types.ts** — Extend with `Cluster`, `ClusterCreateRequest`, `ClusterTestResponse`.

    **components/clusters/ClusterStatusPill.svelte** — UI-SPEC §Color §Semantic color usage. Props: `status: 'ok' | 'failed' | 'untested'`. Renders pill with appropriate `bg-X/10 border-X/30 text-X` and icon (`CheckCircle2`/`ShieldAlert`/`Plug`). Optional `label?: string` prop overrides the default copy.

    **routes/admin/clusters/+page.svelte** — UI-SPEC §Admin pages. Page header: "Clusters" + "Proxmox VE clusters this installation can manage." + "Register cluster" button. Data table columns: Name, Host, Port, Status (ClusterStatusPill — initial state "Not yet tested"), TLS, Created. Row actions: "Edit", "Test connection" (calls `api.clusters.testExisting({id})`, updates pill), "Delete" (ConfirmByNameDialog targetName=cluster.name, heading "Delete {cluster_name}?", body "This GUI will stop managing this cluster. The Proxmox cluster itself is not affected. Encrypted tokens stored here are destroyed." — UI-SPEC copy). Empty state: "No clusters registered — Register a Proxmox cluster to get started." with inline "Register cluster" button (UI-SPEC).

    **routes/admin/clusters/new/+page.svelte** — UI-SPEC §Required cluster registration form. Fields IN ORDER:
    1. Name (slug-like input, helper "A short identifier you'll see in lists.")
    2. URL (helper "https://pve.example.com:8006 — the management URL of the Proxmox cluster.") → parse into host + port on submit.
    3. API token ID (helper "Format: user@realm!tokenid (e.g. root@pam!gui)") → split into token_user + token_name on submit.
    4. API token secret (PasswordInput) — helper "Paste the secret value PVE showed you when you created the token."
    5. TLS fingerprint (optional, helper "Required only for self-signed certificates.")

    **TWO DISTINCT BUTTONS** (per UI-SPEC §Required cluster registration form, WARNING 4 fix — NOT conflated):

    - **"Test connection"** button (variant="secondary", LEFT of the primary):
      - Calls `api.clusters.test({...form values})` — this hits `POST /api/v1/clusters/test` (Plan 06 dry-run; NO DB write).
      - On `{ok: true, version, release}` → show inline `<ClusterStatusPill status="ok" label="Connection OK ({version})" />` next to the button. State `tested: boolean = true`.
      - On `{ok: false, error}` → show inline `<ClusterStatusPill status="failed" />` + `<Alert variant="destructive">` with the error mapped via UI-SPEC §Error state copy:
        - "Couldn't reach that URL. Check the host and port, then try again."
        - "Proxmox rejected that token. Verify the realm and token ID."
        - "The server's certificate fingerprint doesn't match. Refusing to connect."

    - **"Register cluster"** button (variant="default", primary, RIGHT):
      - Calls `api.clusters.create({...form values})` — this hits `POST /api/v1/clusters/` (PERSISTS the cluster).
      - On 201 → goto('/admin/clusters') with toast "Cluster registered.".
      - On 409 (duplicate name) → inline error "A cluster with that name is already registered." (UI-SPEC verbatim).
      - On 422 (validation) → display the same Alert + per-field errors as the Test button surfaces.
      - **Does NOT require Test to have run first** — UI-SPEC explicitly allows bypass. There is also a "Register without testing" link variant that is just a visual cue this is acceptable; the primary button is the same regardless.

    - Inline summary alert on failure uses the same mapped copy.

    **CRITICAL: Test and Register MUST NOT be the same code path or button.** The Plan-08 setup wizard had a simplified UX that conflated them; THIS PLAN (10) implements them as distinct per UI-SPEC. Code review checks: the form must have TWO separate `<Button>` elements with different `onclick` handlers calling different `api.clusters.{test, create}` methods.

    **routes/admin/clusters/[id]/+page.svelte** — Edit form. Fields same as new, BUT: API token secret field uses the UI-SPEC §Required cluster registration form "Update token" pattern — initially shows placeholder dots, "Update token" link reveals an input. If left blank on submit, the existing token is preserved. "Test connection" calls `api.clusters.testExisting({id})` (re-validates the stored token, not the form value). Delete button per UI-SPEC.

    **routes/admin/clusters/[id]/+page.server.ts** — Load: `api.clusters.get`.

    **Cross-cutting UI consistency checks (executor must verify):**
    - Every page heading uses Display 28/600 per UI-SPEC §Typography.
    - Every Card heading uses Heading 18/600.
    - No raw error messages — all map through UI-SPEC §Error state copy table.
    - No inline hex colors — every color reference is via CSS variables.
    - Lucide icons are limited to the UI-SPEC allow-list.
    - ClusterStatusPill uses the semantic color tokens (--success, --destructive, --muted), never raw hex.
  </action>
  <verify>
    <automated>cd frontend && pnpm run check && pnpm run build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `test -f frontend/src/routes/admin/clusters/+page.svelte && test -f frontend/src/routes/admin/clusters/new/+page.svelte`
    - `test -f frontend/src/lib/components/clusters/ClusterStatusPill.svelte`
    - `grep -q 'Proxmox VE clusters this installation can manage' frontend/src/routes/admin/clusters/+page.svelte` (UI-SPEC verbatim)
    - `grep -q 'Test connection' frontend/src/routes/admin/clusters/new/+page.svelte`
    - `grep -q 'Register cluster' frontend/src/routes/admin/clusters/new/+page.svelte`
    - `grep -q 'api.clusters.test\|clusters.test(' frontend/src/routes/admin/clusters/new/+page.svelte` (Test button hits dry-run)
    - `grep -q 'api.clusters.create\|clusters.create(' frontend/src/routes/admin/clusters/new/+page.svelte` (Register button hits persist)
    - `grep -E 'Test connection.*Register cluster|button.*Test.*button.*Register' frontend/src/routes/admin/clusters/new/+page.svelte || grep -c '<Button' frontend/src/routes/admin/clusters/new/+page.svelte | awk '{exit ($1 >= 2) ? 0 : 1}'` (two distinct buttons; not conflated)
    - `grep -q 'ConfirmByNameDialog' frontend/src/routes/admin/clusters/+page.svelte` (destructive delete)
    - `grep -q '/clusters/test' frontend/src/lib/api/clusters.ts` (dry-run endpoint wired)
    - `cd frontend && pnpm run check` exits 0
    - `cd frontend && pnpm run build` exits 0
  </acceptance_criteria>
  <done>Admin Clusters list/register/edit pages ship; Test (dry-run) and Register (persist) implemented as DISTINCT buttons per UI-SPEC; ClusterStatusPill component built; copy verbatim.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: End-to-end operator smoke checkpoint</name>
  <what-built>
    Plans 01–07 build the backend; Plans 03 + 08 + 09 + 10 build the frontend. This checkpoint validates the user-visible Phase 1 success criteria from ROADMAP.md end-to-end.
  </what-built>
  <how-to-verify>
    1. Start backend locally: `cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`.
    2. Start frontend locally: `cd frontend && pnpm dev` (proxies /api/* to 127.0.0.1:8000).
    3. Open `http://localhost:5173`. Verify: redirect to `/setup`.
    4. **Setup Step 1 (Welcome):** Verify heading "Welcome to Proxmox GUI" + body copy verbatim. Click "Get started" → advances to step 2.
    5. **Setup Step 2 (Create admin):** Verify heading. Try password < 12 chars → inline error. Submit valid (admin, admin@example.com, "testpassword12345", same confirm). Should auto-advance to step 3 (admin auto-logged in).
    6. **Setup Step 3 (Register cluster):** Click "Skip for now" link → advances to step 4. (Cluster registration tested separately below.)
    7. **Setup Step 4 (Done):** Click "Sign in" → goto /login.
    8. **Login:** Sign in with admin credentials. Verify app shell renders (sidebar + topbar). The cluster picker in topbar is disabled with tooltip "Switch clusters in Phase 2".
    9. **Dashboard placeholder:** Verify dashboard appears: "VM and LXC inventory lands in Phase 2."
    10. **Theme toggle:** Click the topbar theme dropdown → select Dark → page re-renders dark (slate-900 background). Hard refresh → no FOUC, dark mode persists. Switch to Light → back to white. Switch to System → matches OS preference. Open DevTools, `localStorage.getItem('theme')` reflects the selection.
    11. **Profile → Change password:** Update password. Toast appears: "Password updated. Other sessions were signed out." Open a private window, try to log in with the OLD password → 401. Log in with NEW password → success.
    12. **SSH keys (Plan 09):** Add an ed25519 public key (generate via `ssh-keygen -t ed25519 -f /tmp/test -N ""`). Paste contents of `/tmp/test.pub`. Verify fingerprint appears (`SHA256:...`). Delete it: dialog requires typing the key's name; confirm button disabled until exact match.
    13. **API tokens (Plan 09):** Create a PAT named "test". Verify the show-once dialog appears with the plaintext + Copy button. Click Copy → button shows Check for 2s. Try to dismiss via ESC → does NOT dismiss. Click "I've saved it" → dismissed. Refresh page → token in list shows `prefix_preview` (8 chars), not full plaintext. Test the PAT with curl: `curl -H "Authorization: Bearer pat_..." http://localhost:5173/api/v1/me` → returns user JSON.
    14. **Admin Users (Plan 10):** Click sidebar → Admin → Users. See your admin row. Click "New user" → fill form for user "alice"/"alice@example.com"/12-char-password. Verify creation. Click on alice → try to disable yourself (you can't — admin self-guard; disable button on YOUR row is hidden / disabled). Click "Disable" on alice → confirm dialog requires typing "alice". Type wrong → button disabled. Type right → confirm. Alice's status pill shows "Disabled".
    15. **Admin Clusters (Plan 10) — TWO-BUTTON TEST:** Click sidebar → Admin → Clusters. Empty state with "Register cluster" CTA. Click → fill form with INTENTIONALLY WRONG URL (e.g. https://nonexistent.local:8006).
      - Click **"Test connection"** → error pill + alert "Couldn't reach that URL." Verify in DevTools Network tab: ONE request to `POST /api/v1/clusters/test` (dry-run; no DB write).
      - Verify list at `/admin/clusters` is STILL EMPTY (no cluster persisted from the failed Test).
      - Now correct the URL to the operator's REAL test PVE.
      - Click **"Test connection"** again → status pill shows "Connection OK ({version})". Still no DB write.
      - Click **"Register cluster"** → cluster persists. Verify in Network tab: request to `POST /api/v1/clusters/` (persists). Toast "Cluster registered." Redirects to /admin/clusters with the row.
      - This verifies WARNING 4 fix: Test and Register are DISTINCT endpoints + DISTINCT buttons.
    16. **Logout:** Topbar user menu → "Log out". Verify redirect to /login. Try to visit `/` → redirected to /login. Cookies cleared (DevTools → Application → Cookies).
    17. **Session survival:** Log in again. Refresh page 3x. Each time the session survives (UI loads with user). Wait 16 minutes (or fast-forward by deleting access_token cookie only). Make any state-changing request → backend issues refresh → new cookies set. Verify by hitting any admin endpoint after access expiry.
    18. **OpenAPI:** Visit /api/docs → Swagger UI loads. Verify the `auth`, `me`, `users`, `teams`, `clusters`, `setup`, `ssh-keys`, `tokens` tag sections are present and routes are documented. /api/openapi.json returns `"openapi": "3.1.0"`. Verify both `POST /api/v1/clusters/test` (dry-run) and `POST /api/v1/clusters/{cluster_id}/test` (re-validate) are present and distinct (WARNING 4 fix).
    19. **Mobile (rough check):** Resize browser to < 1024px. Sidebar collapses to icon-only (56px wide).

    Mark "approved" if 1-19 pass. List specific failures otherwise.
  </how-to-verify>
  <resume-signal>Type "approved" to mark Phase 1 frontend complete, or describe failures (each failure → corresponding task in the gap-closure plan).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Admin → users CRUD | require_admin enforced server-side (Plan 07); UI hides admin-only sections for non-admins |
| Admin → clusters CRUD | require_admin enforced server-side (Plan 06); cluster API tokens never leave server |
| Cluster registration form → /clusters/test dry-run | NO DB write; transient connector only; token never persisted on Test |
| Admin self-modification | UI hides Disable/Delete on own row; backend (Plan 07) is authoritative |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-10-01 | Elevation of privilege | Admin self-disable / self-delete locks out | mitigate | UI hides those controls on the current admin's own row + backend self-guard (Plan 07) is authoritative. Defense in depth. Verified by checkpoint step 14. |
| T-01-10-02 | Tampering | Destructive user/cluster action without typed-name confirm | mitigate | All destructive actions route through ConfirmByNameDialog (Plan 08); typed-name case-sensitive. Verified by checkpoint steps 14, 15. |
| T-01-10-03 | Information disclosure | Cluster API token leaked in browser DOM after registration | mitigate | api_token_secret field is `<input type="password">` (PasswordInput); not echoed back from backend (Plan 06 ClusterResponse schema omits it). On edit, field shows placeholder dots — never the real value. |
| T-01-10-04 | Tampering | Test button accidentally persists a cluster | mitigate | WARNING 4 fix: Test button calls `POST /clusters/test` (Plan 06 dry-run; explicitly NO DB write). Checkpoint step 15 verifies via empty list after failed Test. |
| T-01-10-05 | Spoofing | Admin actions performed as a different user via stale session | mitigate | Self-guard uses `event.locals.user.id` (refreshed every SSR request per Plan 08's hooks.server.ts probe); backend re-checks on every mutation. |
| T-01-10-06 | Repudiation | Admin disables user but no audit record | accept (Phase 2 writer) | audit_log schema exists; writer ships Phase 2. v1 admin actions are trusted by operator-of-install. |
| T-01-10-07 | Information disclosure | User enumeration via /admin/users visible to non-admin | mitigate | require_admin gate (Plan 07) at backend; UI's sidebar conditionally renders "Admin" section only when `user.is_admin`. Defense in depth. |
| T-01-10-08 | Tampering | Cluster delete cascades to teams' bootstrap state | mitigate (design) | Plan 06 returns 409 if team_cluster_tokens rows exist for the cluster (cluster delete blocked when bootstrapped). Admin must unbind teams from the cluster first (Phase 2 endpoint). |
| T-01-10-09 | Denial of service | Cluster Test floods PVE | accept | Single-click action; rate-limited by PVE itself. v1 acceptable. |
| T-01-10-10 | Elevation of privilege | Admin grants is_admin to a colluding user | accept | Admin role inherently includes user management. Multi-admin coordination is a v1 trust model; auditing (Phase 2) records who-granted-what. |

ASVS L1 mappings:
- V4.2 (administrative interface) → all admin routes require_admin (server-side)
- V4.3 (privilege management) → self-guard prevents admin lockout
- V14.3 (UX security) → typed-name destructive confirms; two-button cluster registration (no accidental persist)
- V8.3 (data at rest) → cluster API token never re-exposed in UI (Plan 06 schema omits it)
</threat_model>

<verification>
- Task 1 + Task 2 acceptance criteria pass (`pnpm run check`, `pnpm run build`)
- Task 3 (checkpoint) approved by operator
- The end-to-end smoke confirms ROADMAP Phase 1 success criteria 1–5
- Cross-plan dependency on Plan 06's `POST /clusters/test` dry-run endpoint verified working (checkpoint step 15)
</verification>

<success_criteria>
A new operator can complete the full Phase 1 user journey:
1. Run the install command (Plan 04).
2. Reach `/setup`, create the initial admin (Plan 07 + Plan 08).
3. Optionally register a cluster (Plan 06 + Plan 08 or Plan 10).
4. Log in, see the app shell (Plan 08), change their password (Plan 09), manage SSH keys and PATs (Plan 09), log out.
5. As admin, manage other users (Plan 10) and clusters (Plan 10) — with separate Test + Register buttons on cluster registration.
6. Refresh the page and stay logged in (cookies + CSRF working).
7. The API at /api/openapi.json + /api/docs exposes every shipped capability; a PAT-authed `curl` reaches the same endpoints the UI uses.

This is Phase 1 complete.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-10-SUMMARY.md` documenting:
- Routes implemented (5: /admin/users, /admin/users/new, /admin/users/[id], /admin/clusters, /admin/clusters/new, /admin/clusters/[id])
- ClusterStatusPill component
- API client extensions (api.users, api.teams, api.clusters)
- Two-button cluster registration audit: confirm Test and Register are DISTINCT (filename grep + Network tab evidence from checkpoint)
- Cross-plan dependency resolution: Plan 06's POST /clusters/test verified shipped
- Checkpoint result (approved / failures + remediation plan)
- Phase 2 follow-ups (cluster switcher activation, live quota deltas, inventory pages, audit writer)
- Phase 1 success criteria summary: which ROADMAP criteria are met by which plans
</output>
