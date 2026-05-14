---
phase: 01-foundation
plan: 08
type: execute
wave: 5
depends_on:
  - 03
  - 05
  - 07
files_modified:
  - frontend/src/lib/api/generated/.gitkeep
  - frontend/src/lib/api/client.ts
  - frontend/src/lib/api/types.ts
  - frontend/src/lib/api/auth.ts
  - frontend/src/lib/api/me.ts
  - frontend/src/lib/api/setup.ts
  - frontend/src/lib/components/forms/ConfirmByNameDialog.svelte
  - frontend/src/lib/components/forms/PasswordInput.svelte
  - frontend/src/lib/components/forms/SecretRevealDialog.svelte
  - frontend/src/lib/components/forms/FormSummaryAlert.svelte
  - frontend/src/routes/+layout.server.ts
  - frontend/src/routes/+layout.svelte
  - frontend/src/routes/+page.svelte
  - frontend/src/routes/+page.server.ts
  - frontend/src/routes/login/+page.svelte
  - frontend/src/routes/login/+page.server.ts
  - frontend/src/routes/setup/+layout.svelte
  - frontend/src/routes/setup/+page.svelte
  - frontend/src/routes/setup/+page.server.ts
  - frontend/src/hooks.server.ts
  - frontend/tests/e2e/auth.test.ts
  - frontend/tests/components/ConfirmByNameDialog.test.ts
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - UI-01
  - UI-02
  - DEPLOY-05
user_setup: []
tags:
  - frontend
  - sveltekit
  - svelte5
  - ui-spec-compliance
  - auth-shell
  - setup-wizard
must_haves:
  truths:
    - "Unauthenticated browser visiting `/` is redirected to `/login` (or `/setup` when no_admin_yet)"
    - "First-run wizard at `/setup` is a 4-step stepper (Welcome → Create admin → Register first cluster (skippable) → Done) per UI-SPEC §First-run wizard and D-19"
    - "Login form submits to /api/v1/auth/login; success persists across page refresh (cookies survive); failure shows inline error 'Wrong username or password.' from UI-SPEC §Error state copy"
    - "App shell renders sidebar + topbar per UI-SPEC §Layout Contracts for every authenticated route"
    - "Theme toggle (Sun/Moon/Monitor tri-state) toggles `<html class=dark>` and persists to localStorage; no FOUC on reload"
    - "ConfirmByNameDialog component implements UI-SPEC §Destructive confirmations exactly (typed-name match, ENTER does not submit)"
    - "SecretRevealDialog component implements UI-SPEC §Token / secret display exactly (non-dismissable by ESC/click-outside, copy-to-clipboard, clears on dismiss)"
    - "PasswordInput component has Eye/EyeOff visibility toggle per UI-SPEC §Login + §Form Patterns"
    - "FormSummaryAlert component renders 'Please fix the following:' + clickable field links per UI-SPEC §Form Patterns"
    - "Every UI string in scope is the EXACT verbatim copy from UI-SPEC §Copywriting Contract"
  artifacts:
    - path: "frontend/src/routes/setup/+page.svelte"
      provides: "4-step first-run wizard stepper (D-19; UI-SPEC §First-run wizard)"
      contains: "stepper"
    - path: "frontend/src/routes/login/+page.svelte"
      provides: "Login form with visibility toggle"
      contains: "Sign in"
    - path: "frontend/src/lib/components/forms/ConfirmByNameDialog.svelte"
      provides: "Typed-name confirmation dialog (UI-SPEC §Destructive confirmations)"
      exports: ["ConfirmByNameDialog"]
    - path: "frontend/src/lib/components/forms/SecretRevealDialog.svelte"
      provides: "Show-once secret reveal dialog (UI-SPEC §Token / secret display)"
      exports: ["SecretRevealDialog"]
    - path: "frontend/src/lib/components/forms/PasswordInput.svelte"
      provides: "Reusable password input with Eye/EyeOff toggle"
      exports: ["PasswordInput"]
    - path: "frontend/src/lib/components/forms/FormSummaryAlert.svelte"
      provides: "Form-level error summary alert"
      exports: ["FormSummaryAlert"]
    - path: "frontend/src/lib/api/client.ts"
      provides: "Typed API client with CSRF + auth"
      exports: ["api"]
  key_links:
    - from: "frontend/src/routes/+layout.server.ts"
      to: "backend /api/v1/me + /api/v1/setup/status"
      via: "SSR load probes both endpoints; redirects to /login or /setup as appropriate"
      pattern: "setup/status"
    - from: "frontend/src/routes/setup/+page.svelte"
      to: "backend /api/v1/setup/admin + /api/v1/auth/login + /api/v1/clusters"
      via: "step 2 creates admin, then logs in, then step 3 registers optional cluster as authenticated"
      pattern: "/setup/admin"
---

<objective>
Land the authenticated app shell, the unauthenticated entry points (login + first-run setup wizard per D-19), and the four cross-cutting form components UI-SPEC mandates. This is the foundation Plans 09 (account pages) and 10 (admin pages) build on. The 4-step setup wizard (Welcome → Create admin → Register first cluster (skippable) → Done) creates the admin (mandatory per D-18), optionally registers a cluster (skippable per D-18), and lands the operator at `/login`.

Purpose: Plan 04's helper-script + Plan 07's setup gate + this plan's wizard = an operator can go from `curl|bash` to logged-in admin, end-to-end. Plans 09 and 10 then add account self-service and admin pages inside the shell built here.

Output: Login + setup wizard + app shell renders correctly; the 4 shared form components (ConfirmByNameDialog, SecretRevealDialog, PasswordInput, FormSummaryAlert) are consumable by Plans 09 + 10; copy verbatim from UI-SPEC; ui-checker passes.
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-UI-SPEC.md
@.planning/phases/01-foundation/01-RESEARCH.md
@CLAUDE.md
@.planning/phases/01-foundation/01-03-SUMMARY.md
@.planning/phases/01-foundation/01-05-SUMMARY.md
@.planning/phases/01-foundation/01-07-SUMMARY.md

<interfaces>
<!-- The backend contracts this plan consumes (already shipped in Plans 05/07). -->

Backend routes available:
- `POST /api/v1/auth/login` → 200 + cookies
- `POST /api/v1/auth/logout` → 200
- `POST /api/v1/auth/refresh` → 200 + new cookies
- `GET /api/v1/setup/status` → `{no_admin_yet, cluster_count}`
- `POST /api/v1/setup/admin` → 201 `{user_id, personal_team_id, username}`
- `GET /api/v1/me` → user + teams
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Typed API client (core), route layout/auth gate, login page, shared form components</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-UI-SPEC.md (entire file — copy is verbatim; layouts are exact)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (Pattern 10 SvelteKit AppShell, Pitfall A7 SSR fetch cookies)
    - /home/dev/vm-deployment-gui/frontend/src/lib/components/layout/AppShell.svelte (Plan 03)
    - /home/dev/vm-deployment-gui/frontend/src/lib/utils/api.ts (Plan 03)
  </read_first>
  <files>
    frontend/src/lib/api/client.ts,
    frontend/src/lib/api/types.ts,
    frontend/src/lib/api/auth.ts,
    frontend/src/lib/api/me.ts,
    frontend/src/lib/api/setup.ts,
    frontend/src/lib/api/generated/.gitkeep,
    frontend/src/lib/components/forms/ConfirmByNameDialog.svelte,
    frontend/src/lib/components/forms/PasswordInput.svelte,
    frontend/src/lib/components/forms/SecretRevealDialog.svelte,
    frontend/src/lib/components/forms/FormSummaryAlert.svelte,
    frontend/src/routes/+layout.server.ts,
    frontend/src/routes/+layout.svelte,
    frontend/src/routes/+page.svelte,
    frontend/src/routes/+page.server.ts,
    frontend/src/routes/login/+page.svelte,
    frontend/src/routes/login/+page.server.ts,
    frontend/src/hooks.server.ts,
    frontend/tests/components/ConfirmByNameDialog.test.ts,
    frontend/tests/e2e/auth.test.ts
  </files>
  <action>
    **api/types.ts** — Hand-write TypeScript types matching the backend pydantic schemas in scope for this plan:
    ```ts
    export interface User { id: number; username: string; email: string; is_admin: boolean; is_active: boolean; created_at: string; teams: TeamSummary[]; }
    export interface TeamSummary { id: number; name: string; personal: boolean; }
    export interface SetupStatus { no_admin_yet: boolean; cluster_count: number; }
    export interface SetupAdminResponse { user_id: number; personal_team_id: number; username: string; }
    export class ApiError extends Error { status: number; body: unknown; }
    ```
    Note: Plans 09/10 will extend `types.ts` with PAT, SshKey, Cluster, Team, etc. — this plan declares only what login + setup + shell need.

    **api/client.ts** — Build on Plan 03's `apiFetch`/`apiJson`. Export a typed `api` object covering auth + me + setup ONLY for this plan:
    ```ts
    export const api = {
      auth: { login, logout, refresh },
      me: { get },
      setup: { status, createAdmin }
    };
    ```
    Each method takes parameters as a typed object and uses `apiFetch` to call the backend. Server-side calls use the `event.fetch` injected by SvelteKit (Pitfall A7); browser-side calls use the global `fetch`. Accept an optional `fetch` parameter on each method:
    ```ts
    async function get(opts?: { fetch?: typeof fetch }): Promise<User> { ... }
    ```
    Plans 09 + 10 will add `api.users`, `api.teams`, `api.clusters`, `api.me.{listSshKeys, listTokens, ...}` to this object. Document the extension contract in `client.ts` module docstring: "Add new domain methods as separate const merged into `api` via Object.assign() or by re-export from `./client.ts` — never break the existing surface."

    **api/auth.ts, api/me.ts, api/setup.ts** — Per-domain method implementations imported into `client.ts`.

    **forms/PasswordInput.svelte** — Reusable input with Eye/EyeOff visibility toggle (UI-SPEC §Login + §Form patterns). Wraps shadcn `Input`. Props: `value` (bindable), `name`, `placeholder`, `disabled`, `id`. Component-local `revealed: boolean = $state(false)`. Toggle button positioned absolute right inside the input.

    **forms/ConfirmByNameDialog.svelte** — Implement UI-SPEC §Destructive confirmations EXACTLY:
    - Props: `open` (bindable), `heading`, `body`, `targetName`, `confirmLabel`, `onConfirm` (callback), `destructive: boolean = true`.
    - Body of dialog: heading, body copy, label "Type `{targetName}` to confirm", input field (autofocus on open), inline hint "Doesn't match — type the name exactly." when input non-empty and != targetName, footer with Cancel (ghost) + confirm button (destructive variant, disabled until input matches exactly).
    - ENTER inside the input does NOT submit (per UI-SPEC).
    - Uses shadcn `AlertDialog`.
    - Comparison: `input.trim() === targetName.trim()`, case-sensitive.

    **forms/SecretRevealDialog.svelte** — UI-SPEC §Token / secret display:
    - Props: `open` (bindable), `secret` (string), `label` (e.g. "Save this token now."), `body` (e.g. "You won't see it again."), `onDismissed` (callback).
    - Banner: warning-palette (`bg-warning/10 border-warning/30 text-warning`), AlertTriangle icon, heading + body.
    - Token displayed in monospace inside `<code>` element with `bg-muted px-3 py-2 rounded`, copy-to-clipboard button on the right (uses `navigator.clipboard.writeText`).
    - Copy button: Copy icon → on click, copies + shows Check icon for 2 seconds then reverts. Uses `setTimeout` cleanup in `$effect`.
    - Primary button "I've saved it" — only way to dismiss.
    - Dialog is NON-DISMISSABLE by ESC or click-outside: `closeOnEscape={false} closeOnOutsideClick={false}` (bits-ui supports both).
    - On dismiss: clears the secret from the bound prop (sets to empty string) AND calls onDismissed.

    **forms/FormSummaryAlert.svelte** — UI-SPEC §Form Patterns §Inline + summary validation:
    - Props: `errors: Record<string, string>` (field name → message).
    - Renders `Alert variant="destructive"` with AlertTriangle icon, heading "Please fix the following:", followed by `<ul>` of error items.
    - Each item is a link that on click focuses the offending field (uses `document.getElementById(fieldName)`).
    - Renders nothing when errors is empty.

    **hooks.server.ts** — SvelteKit `handle` that injects auth-aware state into `event.locals` for SSR:
    ```ts
    export const handle: Handle = async ({ event, resolve }) => {
      try {
        const res = await event.fetch('/api/v1/me');
        if (res.ok) event.locals.user = await res.json();
        else event.locals.user = null;
      } catch {
        event.locals.user = null;
      }
      return resolve(event);
    };
    ```
    Note Pitfall A7: `event.fetch` forwards cookies automatically on same-origin.

    **routes/+layout.server.ts** — Top-level layout load (replaces Plan 03's stub):
    1. Call `api.setup.status({fetch: event.fetch})` → if `no_admin_yet`:
       - If pathname is NOT `/setup`, redirect to `/setup`.
       - Return `{ user: null, setupNeeded: true }`.
    2. If `event.locals.user` is null:
       - If pathname is NOT `/login` AND NOT `/setup`, redirect to `/login`.
       - Return `{ user: null, setupNeeded: false }`.
    3. Return `{ user: event.locals.user, setupNeeded: false }`.

    **routes/+layout.svelte** — Imports `'../app.css'`, calls `theme.init()` in `onMount`. Render `<AppShell user={data.user}>` only when `data.user != null`; otherwise render `{@render children()}` bare (login + setup screens have their own minimal chrome).

    **routes/+page.svelte (dashboard)** — Minimal placeholder. Centered card: heading "Dashboard" (Display 28/600), body "VM and LXC inventory lands in Phase 2." Per UI-SPEC, this is the only auth'd page in Phase 1 that doesn't have specific content — it just demonstrates the shell renders.

    **routes/login/+page.svelte** — UI-SPEC §Login EXACTLY:
    - Centered card on `bg-muted` page background, `max-w-sm` (400px).
    - Logo + product name above card (Hetzner-style).
    - Card: heading "Sign in", body "Enter your credentials to continue.".
    - Form: Username field, Password (PasswordInput component with Eye/EyeOff). Required validation min-length 1.
    - Primary button "Sign in" full-width, with Loader2 + "Signing in..." while submitting.
    - Below card: "Need help? Contact your administrator." (muted text).
    - Session-expired state: if `$page.url.searchParams.has('expired')`, show `Alert variant="warning"` above card: "Your session expired. Please sign in again."
    - On submit: `api.auth.login({username, password})`; on success `goto('/')`; on 401 show inline error "Wrong username or password."; on 403 (account disabled) show "This account is disabled. Contact your administrator."; on 429 show "Too many sign-in attempts. Try again in a minute."

    **routes/login/+page.server.ts** — Empty load that just returns `{}` (no auth-gated data needed; +layout.server.ts already redirects if logged in).

    **Tests:**
    - tests/e2e/auth.test.ts (vitest): mount login form; submit with mock fetch returning 401 → inline error appears; submit with 200 → `goto` called with '/'.
    - tests/components/ConfirmByNameDialog.test.ts: mount the dialog, type wrong name → confirm button disabled; type correct name → confirm button enabled; click confirm → onConfirm called.
  </action>
  <verify>
    <automated>cd frontend && pnpm run check && pnpm run test 2>&1 | tail -10 && pnpm run build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `test -f frontend/src/routes/login/+page.svelte && grep -q 'Sign in' frontend/src/routes/login/+page.svelte`
    - `grep -q 'Wrong username or password' frontend/src/routes/login/+page.svelte` (UI-SPEC verbatim)
    - `grep -q 'won.t see it again\|saved it' frontend/src/lib/components/forms/SecretRevealDialog.svelte`
    - `grep -q 'Type.*targetName\|Type.*to confirm' frontend/src/lib/components/forms/ConfirmByNameDialog.svelte`
    - `grep -q 'Please fix the following' frontend/src/lib/components/forms/FormSummaryAlert.svelte`
    - `grep -q 'EyeOff\|Eye' frontend/src/lib/components/forms/PasswordInput.svelte`
    - `grep -q 'closeOnEscape={false}\|closeOnEscape=false\|closeOnOutsideClick=false' frontend/src/lib/components/forms/SecretRevealDialog.svelte`
    - `grep -q 'setup/status' frontend/src/routes/+layout.server.ts` (real probe replaces Plan 03 stub)
    - `grep -q 'no_admin_yet' frontend/src/routes/+layout.server.ts`
    - `cd frontend && pnpm run check` exits 0
    - `cd frontend && pnpm run build` exits 0
  </acceptance_criteria>
  <done>API client (auth+me+setup), real auth gate replacing Plan 03 stub, login screen, 4 shared form components ship; copy verbatim from UI-SPEC; checks + build green.</done>
</task>

<task type="auto">
  <name>Task 2: 4-step first-run setup wizard</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-UI-SPEC.md (§First-run wizard, §Copywriting Contract for setup steps, §Layout Contracts)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-CONTEXT.md (D-18, D-19)
    - /home/dev/vm-deployment-gui/frontend/src/lib/api/client.ts (Task 1)
    - /home/dev/vm-deployment-gui/frontend/src/lib/components/forms/PasswordInput.svelte (Task 1)
    - /home/dev/vm-deployment-gui/frontend/src/lib/components/forms/FormSummaryAlert.svelte (Task 1)
  </read_first>
  <files>
    frontend/src/routes/setup/+layout.svelte,
    frontend/src/routes/setup/+page.svelte,
    frontend/src/routes/setup/+page.server.ts
  </files>
  <action>
    **routes/setup/+layout.svelte** — Setup-only wrapper. Renders without AppShell. Centered single column on neutral `bg-muted` background.

    **routes/setup/+page.svelte** — UI-SPEC §First-run wizard EXACTLY: 4-step stepper per D-19. Local state `step: 1 | 2 | 3 | 4 = $state(1)`. State for collected fields. Renders:
    - Horizontal stepper above the active card: 4 pips (`Welcome`, `Create admin`, `Register cluster`, `Done`). Each pip: 28x28 circle (number for upcoming, Check for completed, filled `bg-primary` for active). 2px line connecting pips, `bg-primary` for completed segments, `bg-border` for upcoming.
    - Card: `bg-card border rounded-lg p-12 max-w-[35rem]` (UI-SPEC: padding 2xl = 48px). Shadow-sm.
    - **Step 1 (Welcome):** Heading "Welcome to Proxmox GUI" (Display 28/600), body "Let's set up your installation. This takes about a minute.", primary CTA "Get started" → advance to step 2.
    - **Step 2 (Create admin):** Heading "Create the first admin", body "This user has full access and can create more users later.", form with Username, Email, Password (PasswordInput), Confirm password. Validation: username regex `^[a-zA-Z0-9_.-]{3,64}$`, email valid, password >= 12 chars, confirm matches. On submit: `api.setup.createAdmin({username, email, password})` then `api.auth.login(...)` (auto-login), then advance to step 3. Show inline errors per field + FormSummaryAlert. Errors: duplicate username → "A user with that username already exists." (UI-SPEC §Error state copy). Primary CTA "Create admin"; Back button hidden on step 2 (admin creation is not reversible).
    - **Step 3 (Register cluster, OPTIONAL per D-18):** Heading "Register your first Proxmox cluster", body "Optional. You can add clusters later from the admin area.", form with Name, URL (host:port shape), API token ID, API token secret (PasswordInput), TLS fingerprint (optional). **Two buttons (per UI-SPEC §Required cluster registration form):**
      - "Test connection" (variant="secondary") — calls `api.clusters.test({...form values})` (the WARNING 4 fix dry-run endpoint added to Plan 06). On `{ok: true, version}` → show inline ClusterStatusPill "Connection OK" (use UI-SPEC §Color §Semantic color usage tokens; pill component lives in Plan 10 — for this plan, inline the markup). On `{ok: false, error}` → show inline `Alert variant="destructive"` with the mapped copy.
      - "Register cluster" (primary) — calls `api.clusters.create({...form values})` and on 201 advances to step 4. Does NOT require Test first (UI-SPEC allows bypass).
      - "Skip for now" link (variant="link") → advances to step 4 without registering anything (D-18 lenient).
      Back button visible (returns to step 2's success state; admin already created, so navigation is harmless).
      NOTE: `api.clusters.test` and `api.clusters.create` ARE NOT YET in `client.ts` after Task 1 — extend `client.ts` inline in this task with these two methods, importing the Cluster type shape (hand-write the minimal types needed: `ClusterCreateRequest`, `ClusterTestResponse`). Plan 10 will add the rest of the cluster surface.
    - **Step 4 (Done):** Heading "You're all set", body "Sign in to start managing your clusters.", primary CTA "Sign in" → `goto('/login')`.
    - Footer: Back (hidden on step 1+2; visible on step 3) + Primary CTA + "Skip for now" link (step 3 only).

    **routes/setup/+page.server.ts** — Load that checks `api.setup.status({fetch: event.fetch})`; if NOT `no_admin_yet`, redirect to `/login`. (Defense-in-depth on top of the +layout.server.ts redirect.)
  </action>
  <verify>
    <automated>cd frontend && pnpm run check && pnpm run build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q 'Welcome to Proxmox GUI' frontend/src/routes/setup/+page.svelte` (verbatim copy from UI-SPEC)
    - `grep -q 'Create the first admin' frontend/src/routes/setup/+page.svelte` (verbatim step 2 heading)
    - `grep -q "You're all set\|You.re all set" frontend/src/routes/setup/+page.svelte` (verbatim step 4 heading)
    - `grep -q 'Skip for now' frontend/src/routes/setup/+page.svelte` (D-18 skippable cluster step)
    - `grep -q 'Test connection' frontend/src/routes/setup/+page.svelte` (UI-SPEC §Required cluster registration form)
    - `grep -q 'step.*1.*2.*3.*4\|step === 1\|step === 4' frontend/src/routes/setup/+page.svelte` (4-step stepper state)
    - `cd frontend && pnpm run check` exits 0
    - `cd frontend && pnpm run build` exits 0
  </acceptance_criteria>
  <done>4-step setup wizard ships per D-19; admin creation mandatory + cluster optional per D-18; copy verbatim; auto-login after admin step; checks + build green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → API | All requests go through Caddy → FastAPI; same-origin; CSRF via JS-readable cookie + header |
| SSR fetch → API | `event.fetch` forwards cookies; Pitfall A7 honored |
| First-run wizard public surface | `/api/v1/setup/*` is unauth-gated solely by `no_admin_yet` predicate |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-08-01 | Spoofing | Setup endpoint reached after admin exists via race | mitigate | Backend gate (Plan 07): no_admin_yet predicate inside the same transaction. UI's +layout.server.ts probes /setup/status and redirects, but the authoritative check is server-side. |
| T-01-08-02 | Information disclosure | User enumeration via login error messages | mitigate | UI-SPEC §Error state copy: "Wrong username or password." is the unified message for both wrong-user and wrong-password. Server-side returns same 401 (Plan 05). |
| T-01-08-03 | Tampering | Theme toggle XSS via localStorage | mitigate | theme.svelte.ts only accepts 'light'|'dark'|'system' (TypeScript narrowing + runtime guard). FOUC script only adds the `dark` class (no arbitrary attribute injection). |
| T-01-08-04 | Information disclosure | SecretRevealDialog state persisted accidentally | mitigate | Component clears the bound prop on dismiss; component state lifetime ends; never written to localStorage. PAT plaintext only lives in memory of the active dialog. |
| T-01-08-05 | Tampering | SecretRevealDialog dismissed by ESC | mitigate | `closeOnEscape={false} closeOnOutsideClick={false}` props on bits-ui Dialog. |
| T-01-08-06 | Information disclosure | First-run wizard completes without HTTPS | accept | Caddy `tls internal` ensures HTTPS even on LAN (Plan 04). Browser shows cert warning the operator accepts once. Documented. |
| T-01-08-07 | Spoofing | Click-jacking on login form via iframe | mitigate | X-Frame-Options: SAMEORIGIN set by Caddy (Plan 04). |
| T-01-08-08 | Information disclosure | Plaintext API token typed into setup wizard step 3 displayed via DOM inspector | accept | PasswordInput component starts masked; user explicitly reveals. Same surface as Proxmox's own UI. |

ASVS L1 mappings:
- V3.7 (CSRF) → all state-changing requests pass `X-CSRF-Token` from the JS-readable cookie (Plan 03's apiFetch + here's api.client.ts use it)
- V4.1 (user-facing auth flows) → login behavior per UI-SPEC §Login
- V8.1 (sensitive UI state) → secrets only in memory; never localStorage
- V14.3 (UX security) → password visibility toggle (no auto-paste vulnerabilities); session-expired user feedback
</threat_model>

<verification>
- Task 1 + Task 2 acceptance criteria pass (`pnpm run check`, `pnpm run build`)
- Plan 09 + Plan 10 can import the four form components without changes
- The 4-step setup wizard flow can be exercised manually against a running backend
</verification>

<success_criteria>
A new operator can:
1. Run the install command (Plan 04).
2. Reach `/setup`, see the 4-step stepper, create the initial admin (Plan 07 backend + this plan's wizard).
3. Optionally register a cluster (Plan 06 + this plan).
4. Land on `/login`, sign in, see the app shell render with sidebar + topbar + theme toggle.

The four shared form components (ConfirmByNameDialog, SecretRevealDialog, PasswordInput, FormSummaryAlert) are available for Plans 09 + 10 to consume.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-08-SUMMARY.md` documenting:
- Routes implemented (login, setup, dashboard placeholder, root layout)
- Components built (ConfirmByNameDialog, SecretRevealDialog, PasswordInput, FormSummaryAlert)
- API client surface delivered (auth + me + setup methods; clusters.test + clusters.create added inline for the wizard)
- UI-SPEC compliance audit for the surfaces in scope (any deviations from §Spacing Scale, §Typography, §Color, §Copywriting Contract — none expected)
- Inter Variable woff2 final source (rsms.me direct, vendored at <path>, size)
- Setup wizard flow walkthrough notes (Plan 09 + Plan 10 + Plan 10's checkpoint exercise the full operator experience)
</output>
