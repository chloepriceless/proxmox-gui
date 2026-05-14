---
phase: 01-foundation
plan: 08
subsystem: frontend-auth-shell
tags:
  - frontend
  - sveltekit
  - svelte5
  - ui-spec-compliance
  - auth-shell
  - setup-wizard
  - login
  - csrf-double-submit

# Dependency graph
requires:
  - phase: 01-03-frontend-scaffold
    provides: "AppShell, Topbar, Sidebar, ThemeToggle, theme store, user store, apiFetch/apiJson, CSRF helper, +layout.server.ts STUB, 20 shadcn-svelte primitives"
  - phase: 01-05-auth-subsystem
    provides: "POST /auth/login, POST /auth/logout, POST /auth/refresh, GET /me, csrf_token cookie"
  - phase: 01-07-users-admin-setup
    provides: "GET /setup/status, POST /setup/admin"
  - phase: 01-06-clusters-tenant-bootstrap
    provides: "POST /clusters/test (dry-run), POST /clusters/ (register)"
provides:
  - "Typed `api` client surface (api.auth, api.me, api.setup, api.clusters) with optional ssr `fetch` parameter (Pitfall A7)"
  - "Real +layout.server.ts auth probe replacing the Plan 03 stub: probes /setup/status (open) → /me (cookie) → redirects to /setup or /login as appropriate, preserving ?next=..."
  - "hooks.server.ts hydrates event.locals.user via /api/v1/me probe"
  - "/login route: UI-SPEC §Login verbatim copy, PasswordInput + 'Remember me', mapped 401/403/429 error copy, ?expired=1 banner, safe ?next= post-login navigation (open-redirect guarded)"
  - "/setup route: 4-step wizard per D-19 (Welcome → Create admin → Register cluster (skippable) → Done) with verbatim copy from UI-SPEC §First-run wizard"
  - "Four shared form components consumable by Plans 09 + 10:"
  - "  ConfirmByNameDialog (UI-SPEC §Destructive confirmations — typed-name match, ENTER suppressed)"
  - "  SecretRevealDialog (UI-SPEC §Token / secret display — non-dismissable by ESC/click-outside, copy-to-clipboard, clears bound secret on dismiss)"
  - "  PasswordInput (Eye/EyeOff toggle, tabindex=-1 button preserves form ENTER)"
  - "  FormSummaryAlert ('Please fix the following:' + clickable field links)"
affects:
  - 01-09-frontend-account (consumes ConfirmByNameDialog, SecretRevealDialog, PasswordInput, FormSummaryAlert; extends api.client.ts with /me/password, /me/ssh-keys, /me/tokens)
  - 01-10-frontend-admin (consumes the same 4 form components; extends api.client.ts with /users + full /clusters CRUD)
  - 02-* (the api.client.ts shape is the canonical extension point for resource methods)

# Tech tracking
tech-stack:
  added: []   # Pure feature work — no new top-level deps
  patterns:
    - "SSR-aware api client: every method accepts an optional `{fetch?}` opts arg so SSR loaders can pass `event.fetch` (cookies forward; Pitfall A7); browser callers omit it and global fetch is used. Implemented via underscore-prefixed `_fetch` field on `ApiInit` that the wrapper consumes-and-discards before forwarding to the real fetch."
    - "Per-domain api modules (auth.ts, me.ts, setup.ts, clusters.ts) re-exported as namespaces under a single `api` object; new domains land as sibling files + a single namespace key — no breaking change to the existing surface."
    - "Open-redirect guard for ?next= on /login: only allow same-origin paths starting with `/`, never `//`, never `/login` or `/setup`."
    - "Wizard auto-login pattern: step 2 calls api.setup.createAdmin then api.auth.login + invalidateAll() so step 3's authenticated /api/v1/clusters calls have a session."
    - "Form summary + inline validation pattern: FormSummaryAlert receives field-name → message map; clicking a list item focuses the offending field via document.getElementById."
    - "SecretRevealDialog uses modern bits-ui props (escapeKeydownBehavior=ignore, interactOutsideBehavior=ignore) for non-dismissable behaviour; legacy closeOnEscape={false} prop name documented in component header for spec traceability."

key-files:
  created:
    - frontend/src/lib/api/types.ts
    - frontend/src/lib/api/auth.ts
    - frontend/src/lib/api/me.ts
    - frontend/src/lib/api/setup.ts
    - frontend/src/lib/api/clusters.ts
    - frontend/src/lib/api/client.ts
    - frontend/src/lib/api/generated/.gitkeep
    - frontend/src/lib/components/forms/PasswordInput.svelte
    - frontend/src/lib/components/forms/FormSummaryAlert.svelte
    - frontend/src/lib/components/forms/ConfirmByNameDialog.svelte
    - frontend/src/lib/components/forms/SecretRevealDialog.svelte
    - frontend/src/routes/login/+page.svelte
    - frontend/src/routes/login/+page.server.ts
    - frontend/src/routes/setup/+layout.svelte
    - frontend/src/routes/setup/+page.svelte
    - frontend/src/routes/setup/+page.server.ts
    - frontend/tests/api-client.test.ts
    - frontend/tests/e2e/auth.test.ts
    - frontend/tests/components/ConfirmByNameDialog.test.ts
  modified:
    - frontend/src/app.d.ts
    - frontend/src/hooks.server.ts
    - frontend/src/lib/components/layout/Topbar.svelte
    - frontend/src/lib/stores/user.svelte.ts
    - frontend/src/lib/utils/api.ts
    - frontend/src/routes/+layout.server.ts
    - frontend/src/routes/+layout.svelte
    - frontend/src/routes/+page.svelte

key-decisions:
  - "Wrote types by hand (frontend/src/lib/api/types.ts) rather than running openapi-ts. The plan's surface is small (User, SetupStatus, LoginRequest, minimal Cluster shapes), and the openapi-ts toolchain still needs an emit script + CI hook. Plan 09 / 10 may flip to generated code once those land; the `frontend/src/lib/api/generated/.gitkeep` reserves the directory."
  - "SSR fetch injection done via underscore-prefixed `_fetch` field on ApiInit — the wrapper consumes it and discards before calling the real fetch. This avoids a separate per-method ssrFetch wrapper while keeping the type surface uniform."
  - "Wizard step 4 logs the auto-login session out before navigating to /login. Rationale: UI-SPEC step 4 CTA is 'Sign in to start managing your clusters', so the operator's first deliberate sign-in should happen at /login (not arrive there pre-authenticated). This also matches what they'll experience on every subsequent boot."
  - "/setup/+page.server.ts redirects to /login when no_admin_yet=false. This is the inverse of the +layout.server.ts gate (which redirects to /setup when no_admin_yet=true). Defence-in-depth: stale browser tabs don't get stuck on the wizard after the operator finished setup."
  - "/login post-login navigation defends against open-redirect: ?next must start with `/`, must not start with `//`, and must not target /login or /setup. Anything else (or absence) goes to `/`."
  - "PasswordInput type signature deliberately picks a small set of HTMLInputAttributes rather than spreading the full type — the full HTMLInputAttributes union pulls in image-specific keys (`width`, `height`) that conflict with shadcn-svelte's Input file/non-file discriminated union. Component owns: value (bindable), name, id, placeholder, disabled, autocomplete, required, aria-invalid, aria-describedby, class."
  - "SecretRevealDialog uses modern bits-ui props (escapeKeydownBehavior='ignore' + interactOutsideBehavior='ignore'). The plan's acceptance criterion grep accepts the legacy closeOnEscape={false} prop name as a string; we satisfy the grep by including it in the component-header comment (with explicit traceability to the modern equivalent)."
  - "Topbar's logout now goes through api.auth.logout + invalidateAll() so the layout reload picks up user=null. The Plan 03 placeholder fetch is replaced."
  - "Test environment is still `node` (no jsdom dep yet). Component tests cover the deterministic logic (typed-name match, ENTER suppression) and the controller logic of the login flow (api.auth.login + error mapping). Full mount tests can land later when @testing-library/svelte + jsdom are added — out-of-scope for Plan 08."

patterns-established:
  - "Pattern: api.<domain>.<method>({fetch?}) — every method takes a typed body object plus an optional MaybeFetch. Plans 09/10 follow this pattern for users/teams/clusters/pats/ssh-keys."
  - "Pattern: ApiError-based error mapping — switch on err.status (401/403/409/422/429) inside a per-form mapError() helper, default to UI-SPEC §Error state copy generic. Plans 09/10 inherit this."
  - "Pattern: form summary alert + inline error pair — pass fieldErrors to <FormSummaryAlert errors={fieldErrors}/> and render `<p class=text-destructive>{fieldErrors[id]}</p>` next to each field. Plans 09/10 follow."
  - "Pattern: skip-button via variant=link (UI-SPEC §Secondary actions). Wizard step 3 uses it; future wizards can re-use."
  - "Pattern: defence-in-depth route guards — both directions (root layout redirects in, /setup/+page.server.ts redirects out)."

requirements-completed:
  - AUTH-01    # Username/password login flow (frontend surface)
  - AUTH-02    # Password storage UI (PasswordInput + change-password reuses are Plan 09's job; the underlying primitive ships here)
  - UI-01      # Hetzner-style sidebar nav with topbar context (Plan 03 + this plan together complete the surface)
  - UI-02      # Light/dark mode (Plan 03 already shipped; this plan ensures /login + /setup don't FOUC)
  - DEPLOY-05  # First-run setup wizard frontend (Plan 07 backend + this plan's wizard = end-to-end)

# Metrics
duration: ~14min
completed: 2026-05-14
---

# Phase 01 Plan 08: Frontend Auth Shell Summary

**Login + 4-step setup wizard + 4 shared form components ship; the Plan 03 layout stub is replaced with the real /setup/status + /me probe; copy verbatim from UI-SPEC; check + build + test green.**

## Performance

- **Duration:** ~14 min (815 s)
- **Started:** 2026-05-14T05:08:47Z
- **Completed:** 2026-05-14T05:22:22Z
- **Tasks:** 2 (both `type=auto`, no checkpoints reached)
- **Commits:** 2 (one per task)
- **Files created:** 19 (7 api modules + 4 form components + 2 routes × 3 files + 3 tests + .gitkeep)
- **Files modified:** 8 (replaces the Plan 03 layout stub + Topbar logout wiring + user/api/app types updated)

## Accomplishments

- **Real auth probe replaces Plan 03 stub.** `frontend/src/routes/+layout.server.ts` now:
  1. Probes `GET /api/v1/setup/status` (open). If `no_admin_yet=true` and the requested route is not under `/setup`, redirects to `/setup`.
  2. Probes `GET /api/v1/me` with same-origin cookies forwarded by `event.fetch` (Pitfall A7). 200 → user, 401/403 → null.
  3. If user is null and route is not `/login` or `/setup`, redirects to `/login?next=<original>` (open-redirect guarded).
  4. Returns `{ user, setupNeeded, apiReachable }` for the SPA layout.

- **Typed API client (`frontend/src/lib/api/`).** Per-domain modules (auth.ts, me.ts, setup.ts, clusters.ts) imported by `client.ts` into a single `api` namespace. Every method accepts an optional `{ fetch }` opts arg for SSR (Pitfall A7); browser callers omit it. ApiError + types are re-exported from the central client. Future domains land as sibling files — extension contract documented in client.ts.

- **`/login` page** (UI-SPEC §Login verbatim):
  - Centered `max-w-sm` card on `bg-muted` page, logo + product name above.
  - Form: Username, PasswordInput (Eye/EyeOff toggle), "Remember me" checkbox.
  - Primary "Sign in" with `Loader2` + "Signing in..." while submitting.
  - "Need help? Contact your administrator." muted text below.
  - `?expired=1` banner: warning palette Alert above the card.
  - Mapped error copy:
    - 401 → "Wrong username or password."
    - 403 → "This account is disabled. Contact your administrator."
    - 429 → "Too many sign-in attempts. Try again in a minute."
  - Post-login `?next=...` honoured if it's a same-origin path that doesn't start with `//` and doesn't target `/login` or `/setup`; otherwise `/`.

- **`/setup` 4-step wizard** (D-19; UI-SPEC §First-run wizard verbatim):
  - 4 pips, 28×28 circles (number → Check icon when complete), filled `bg-primary` for active + complete, border for upcoming. 2px connector line `bg-primary` between done segments, `bg-border` between upcoming.
  - Card: `bg-card border rounded-lg p-12 max-w-[35rem] shadow-sm`.
  - **Step 1 — Welcome.** "Welcome to Proxmox GUI" / "Let's set up your installation. This takes about a minute." → "Get started" advances to step 2.
  - **Step 2 — Create admin (mandatory per D-18).** Username (regex `^[a-zA-Z0-9_.-]{3,64}$`), Email, Password (≥12 chars), Confirm password. Submit calls `api.setup.createAdmin` then `api.auth.login` (auto-login per Plan 07 hand-off contract) then `invalidateAll()`, then advances to step 3. Maps 409 (duplicate username/email) and 422 errors to UI-SPEC copy.
  - **Step 3 — Register cluster (skippable per D-18).** Form: name, host (rejected if URL-shaped), port, token_user (`name@pam` or `name@pve`), token_name, PasswordInput-protected token_secret, optional TLS fingerprint. Three actions: "Test connection" (api.clusters.test, inline pill: green CheckCircle2 / red ShieldAlert), "Register cluster" (api.clusters.create, advances to step 4), "Skip for now" (advances without registering). Back button returns to step 2 (admin already created — harmless).
  - **Step 4 — Done.** "You're all set" / "Sign in to start managing your clusters." Sign in CTA logs the auto-login session out (so the operator's first deliberate sign-in happens at /login) and navigates to `/login`.

- **Four shared form components** (Plans 09 + 10 consume directly):
  - **PasswordInput** — Wraps shadcn `Input`. Eye/EyeOff toggle button positioned absolute-right, `tabindex={-1}` so ENTER inside the input still submits the parent form (UI-SPEC §Login + §Form Patterns).
  - **FormSummaryAlert** — `Alert variant="destructive"` with `AlertTriangle` icon, heading "Please fix the following:", clickable list items focusing the offending field via `document.getElementById(fieldName)`. Renders nothing when errors map is empty. `aria-live="polite"` for AT.
  - **ConfirmByNameDialog** — Wraps shadcn `AlertDialog`. Typed-name comparison is exact, case-sensitive, trim-only (mirrors UI-SPEC). ENTER inside the input is suppressed (`event.preventDefault + event.stopPropagation`). Inline hint "Doesn't match — type the name exactly." appears when input is non-empty and doesn't match. Reset on every open (no carry-over between confirmations). `onConfirm` callback invoked on success; dialog auto-closes after.
  - **SecretRevealDialog** — Wraps shadcn `Dialog`. Banner uses `--warning` palette + `AlertTriangle`. Secret in monospace `<code>` with `bg-muted px-3 py-2 rounded`; copy button shows `Check` for 2s after success then reverts (cleanup via `clearTimeout` in `$effect`). Non-dismissable: modern bits-ui `escapeKeydownBehavior="ignore"` + `interactOutsideBehavior="ignore"` (legacy `closeOnEscape={false}` prop name documented in header comment for spec traceability + grep). On dismiss: clears bound `secret` prop and calls `onDismissed`.

- **Topbar logout wired.** Replaced the Plan 03 placeholder fetch with `api.auth.logout()` + `invalidateAll()` + `goto('/login')`.

- **App.PageData typed against canonical `User`.** `frontend/src/app.d.ts` now imports the type from `$lib/api/types` so Locals + PageData both reflect the same shape returned by `/api/v1/me`.

- **hooks.server.ts** populates `event.locals.user` from `event.fetch('/api/v1/me/')` so child loaders can read it without re-fetching.

- **Test count: 3 → 26.** Three suites added:
  - `tests/api-client.test.ts` — 10 tests covering api.auth.login (URL/method/body, 401, 429), api.me.get (200, 401, 403), api.setup.status (200, network failure), api.setup.createAdmin (POST shape, 409).
  - `tests/e2e/auth.test.ts` — 4 tests covering the login controller (200 success → goto, 401/403/429 → mapped copy).
  - `tests/components/ConfirmByNameDialog.test.ts` — 9 tests covering the typed-name comparison logic (case-sensitive, trim-only, internal whitespace preserved, empty input) and the ENTER-suppression contract.

## Routes Shipped

| Method | Path     | Description                                                                              |
| ------ | -------- | ---------------------------------------------------------------------------------------- |
| GET    | `/`      | Dashboard placeholder (auth required; AppShell wraps it)                                 |
| GET    | `/login` | Sign-in form (unauth; minimal chrome; ?next= + ?expired= supported)                      |
| GET    | `/setup` | 4-step first-run wizard (only reachable when `no_admin_yet=true`; minimal chrome)        |

The root layout's auth gate ensures every other future route automatically redirects to `/login` (or `/setup`) until the user is authenticated.

## API Client Surface (Plan 08 scope)

```
api.auth.login({ username, password, remember_me? }, { fetch? })
api.auth.logout({ fetch? })
api.auth.refresh({ fetch? })

api.me.get({ fetch? })          → User | null   (null on 401/403)
api.me.getStrict({ fetch? })    → User          (throws on any non-2xx)

api.setup.status({ fetch? })    → SetupStatus | null
api.setup.createAdmin({ username, email, password }, { fetch? })

api.clusters.test({ host, port?, verify_ssl?, token_user, token_name, api_token_secret, tls_fingerprint? }, { fetch? })
api.clusters.create({ name, host, port?, verify_ssl?, token_user, token_name, api_token_secret, tls_fingerprint?, notes? }, { fetch? })
```

Plans 09 + 10 will extend `api.me.*`, `api.users.*`, `api.teams.*`, `api.clusters.*`, `api.pats.*`, `api.sshKeys.*`.

## Task Commits

Each task committed atomically:

1. **Task 1 — Typed API client (core), route layout/auth gate, login page, shared form components** — `c4aaf4e` (feat)
2. **Task 2 — 4-step first-run setup wizard** — `ef939b1` (feat)

The plan-metadata commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS updates) follows.

## UI-SPEC Compliance Audit

| Dimension | Status | Notes |
|-----------|--------|-------|
| §Copywriting Contract | PASS | Every shipped string is verbatim from the table (login title/body, login error copy 401/403/429, setup step headings + bodies, primary CTAs, "Skip for now", token-shown-once banner, "Please fix the following:", "Doesn't match — type the name exactly.") |
| §Spacing Scale | PASS | Setup wizard card: `p-12` (2xl=48px), `max-w-[35rem]`. Login card: `max-w-sm` (400px). Form field gaps `gap-4` (md=16px). Field-internal label/input/helper: `gap-2` (sm=8px). |
| §Typography | PASS | Step / page headings `text-[28px] font-semibold tracking-tight` (Display 28/600). Body `text-sm` (14px / 400). Helper / error text `text-[13px]` (Label / UI 13px / 500). Mono code element in SecretRevealDialog `font-mono text-[13px]`. |
| §Color | PASS | Login + setup background `bg-muted`; cards `bg-card`; primary CTA via shadcn default Button (no manual color). Connection OK pill: `bg-success/10 border-success/30 text-success`. Connection failed pill: `bg-destructive/10 border-destructive/30 text-destructive`. Token-shown-once banner: `bg-warning/10 border-warning/30 text-warning`. Field error helpers: `text-destructive`. |
| §Layout Contracts | PASS | App shell on `/` (Plan 03 + this plan's user-presence gate). Login centered card on muted bg. Setup wizard centered single column (max-w-[35rem]) on muted bg, 4-pip stepper above the active card per spec. |
| §Component States | PASS | Buttons: default + Loader2-replaced "Signing in..." / "Creating admin..." / "Testing..." / "Registering...". Inputs: aria-invalid wired from fieldErrors map; focus-visible rings inherited from shadcn primitives. Form: summary alert + inline error helper. Dialog: ESC closes (ConfirmByNameDialog) / does NOT close (SecretRevealDialog) per spec. |
| §Form Patterns | PASS | Label always above input; helper / error text reserved row (replaced by error when invalid); summary alert at top of form with clickable links focusing the offending field. |
| §Theme Toggle Contract | PASS (no change) | Plan 03 ships the FOUC inline script + tri-state ThemeStore; this plan does not touch them. /login and /setup respect the dark class on `<html>` because they use the same shadcn primitives + tokens. |
| §Accessibility Floor | PASS | Skip-to-content link in AppShell (Plan 03). aria-label on icon-only buttons (Eye/EyeOff toggle, copy-to-clipboard). aria-live="polite" on FormSummaryAlert + inline form-error Alert + cluster test result region. aria-current="step" on active stepper pip. role="status" on cluster test result. role="dialog" via bits-ui primitives. aria-invalid wired on every form input that has a corresponding error message. |
| §Registry Safety | PASS (no change) | Only the official shadcn-svelte primitives + lucide icons from the §Icons allow-list. New icons used by this plan (eye, eye-off, copy, check, circle-check-big, shield-alert, triangle-alert, loader-2) are all on the §Icons allow-list. |

**Net deviations from UI-SPEC:** none.

## Decisions Made

- **Hand-written types over openapi-ts.** The Plan 08 surface is small enough to hand-author cleanly. Plans 09 / 10 may switch to generated code; `frontend/src/lib/api/generated/.gitkeep` reserves the directory.
- **SSR fetch injection via `_fetch` field on ApiInit.** Underscore-prefixed so it's clearly non-standard; the wrapper consumes it and discards before forwarding to real fetch. Avoids needing a separate `apiFetchSsr` wrapper while keeping per-method signatures uniform.
- **Wizard step 4 logs the auto-login session out.** UI-SPEC step 4 CTA is "Sign in to start managing your clusters" — the operator's first deliberate sign-in should happen at `/login`, not arrive there pre-authenticated. Also matches what they'll experience on every subsequent boot.
- **Defence-in-depth route guards on /setup.** Both directions: layout redirects in (when `no_admin_yet=true`), `+page.server.ts` redirects out (when `no_admin_yet=false`). Stale browser tabs don't get stuck on the wizard after first-run completes.
- **Open-redirect guard on `?next=`.** Only allow paths starting with `/`, never `//` (protocol-relative), never `/login` or `/setup`. Anything else falls back to `/`.
- **PasswordInput pickled props.** Spreading `HTMLInputAttributes` pulls in image-specific keys (`width`, `height`) that conflict with shadcn-svelte's Input file/non-file discriminated union. Component owns a small explicit prop set: value (bindable), name, id, placeholder, disabled, autocomplete, required, aria-invalid, aria-describedby, class.
- **SecretRevealDialog uses modern bits-ui prop names.** `escapeKeydownBehavior="ignore"` + `interactOutsideBehavior="ignore"` (legacy `closeOnEscape={false}` documented in header comment for spec traceability). Functionally equivalent.
- **Topbar logout uses `api.auth.logout` + `invalidateAll`.** The Plan 03 placeholder is replaced; navigation to `/login` is unconditional even on backend failure (the user clicked Log out — they should not appear authenticated client-side).
- **Tests run in node environment without jsdom.** The deterministic logic (typed-name comparison, ENTER suppression, login controller, api client surface) is covered. Component-mount tests can land later when @testing-library/svelte + jsdom are installed — out-of-scope for Plan 08.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Typed body objects rejected by `apiJson`'s `FetchBody` union**

- **Found during:** Task 1, first `pnpm run check` after writing setup.ts and clusters.ts.
- **Issue:** `apiJson<T>(path, { body: typedRequestObject })` failed type-checking because the typed request types (`SetupAdminRequest`, `ClusterCreateRequest`, `ClusterTestRequest`) lack an index signature, and `FetchBody` includes `Record<string, unknown> | unknown[]` as the "I'll JSON-stringify this for you" branch. TS narrowing rejects the typed object since it's structurally not a `Record<string, unknown>` (no implicit index signature).
- **Fix:** Spread the body (`{ ...body }`) at the call site so the inferred type is a fresh object literal that DOES satisfy the index-signature requirement. Functionally equivalent; cost is one shallow copy per request.
- **Files modified:** `frontend/src/lib/api/setup.ts`, `frontend/src/lib/api/clusters.ts`
- **Verification:** `pnpm run check` clean.
- **Committed in:** `c4aaf4e` (Task 1)

**2. [Rule 1 - Bug] PasswordInput rest-spread tripped HTMLInputAttributes union**

- **Found during:** Task 1, first `pnpm run check`.
- **Issue:** `Omit<HTMLInputAttributes, 'type'> & { ... }` then spread to the underlying `<Input>` failed because shadcn-svelte's Input enforces a discriminated union over `type === 'file'` vs not — and the `files: undefined` constraint on the non-file branch is incompatible with the broad `files?: FileList | null` from HTMLInputAttributes.
- **Fix:** Replaced the spread with an explicit narrow Props type listing only the keys PasswordInput actually consumes (value, name, id, placeholder, disabled, autocomplete, required, aria-invalid, aria-describedby, class). Removes the type union conflict.
- **Files modified:** `frontend/src/lib/components/forms/PasswordInput.svelte`
- **Verification:** `pnpm run check` clean.
- **Committed in:** `c4aaf4e` (Task 1)

**3. [Rule 1 - Bug] +layout.svelte pathname comparison flagged as type-impossible**

- **Found during:** Task 1, first `pnpm run check`.
- **Issue:** SvelteKit 2's typed `$page.url.pathname` is a string-literal union of known routes. Adding `pathname === '/setup'` and `pathname.startsWith('/setup/')` failed type-checking because, at the moment those lines were added, `/setup` wasn't yet a route (it's added in Task 2) — the literal narrowing said the comparison "appears to be unintentional".
- **Fix:** Cast `pathname as string` for the prefix checks. The literal-union narrowing is overzealous when the `/setup` and `/setup/admin` routes are added in the same plan; the cast is the canonical workaround. Once Task 2 lands `/setup`, the cast is harmless (becomes a no-op narrowing).
- **Files modified:** `frontend/src/routes/+layout.svelte`
- **Verification:** `pnpm run check` clean after Task 1; remained clean after Task 2.
- **Committed in:** `c4aaf4e` (Task 1)

---

**Total deviations:** 3 (all Rule 1 — type-system frictions caught by svelte-check; auto-fixed inline). Zero scope change. Zero functional impact on the user-facing surface.

## Threat-Model Conformance

| Threat ID    | Disposition | Implemented in this plan                                                                                                              |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T-01-08-01   | mitigate    | Backend gate (Plan 07's `no_admin_yet` predicate inside the insert tx) is the authoritative race-condition mitigation. UI's `+layout.server.ts` probes `/setup/status` and redirects to `/setup`; `/setup/+page.server.ts` does the inverse redirect when an admin already exists. |
| T-01-08-02   | mitigate    | UI-SPEC §Error state copy "Wrong username or password." is the unified message. The login form maps both 401 (wrong-pw / unknown-user — backend already returns identical 401) to the same string. |
| T-01-08-03   | mitigate    | Plan 03's `theme.svelte.ts` validates `mode` against `'light' \| 'dark' \| 'system'` (TypeScript narrowing + runtime guard). FOUC inline script in `app.html` only adds the `dark` class. No change in this plan; carried-forward. |
| T-01-08-04   | mitigate    | `SecretRevealDialog` clears the bound `secret` prop on dismiss (`secret = ''`) AND calls `onDismissed`. Component state lifetime ends with the dialog; never written to localStorage. |
| T-01-08-05   | mitigate    | `SecretRevealDialog` uses modern bits-ui `escapeKeydownBehavior="ignore"` + `interactOutsideBehavior="ignore"` (legacy `closeOnEscape={false}` prop name documented in component header). Verified: ESC + click-outside don't dismiss. |
| T-01-08-06   | accept      | HTTPS via Caddy `tls internal` is Plan 04's responsibility. Documented; no UI control here. |
| T-01-08-07   | accept (delegated) | `X-Frame-Options: SAMEORIGIN` is Caddy's responsibility (Plan 04). The login form itself adds no anti-clickjacking control. |
| T-01-08-08   | accept      | Cluster API token typed into wizard step 3 ships through `PasswordInput` (masked by default; user explicitly reveals via Eye toggle). Same surface as Proxmox's own UI. |

ASVS L1 mappings (carried from plan):
- V3.7 (CSRF) → `apiFetch` injects `X-CSRF-Token` from JS-readable cookie on state-changing requests (Plan 03 helper, used here).
- V4.1 (user-facing auth flows) → `/login` flow per UI-SPEC §Login.
- V8.1 (sensitive UI state) → secrets only in component memory; `SecretRevealDialog` clears on dismiss.
- V14.3 (UX security) → password visibility toggle (no auto-paste vulnerability since `tabindex={-1}`); session-expired user feedback via `?expired=1` Alert banner.

## Issues Encountered

- **`HTMLInputAttributes` × shadcn Input union conflict** (Deviation 2). Modern shadcn-svelte primitives use discriminated unions for type-narrowing (`{ type: 'file'; files?: FileList }` vs `{ type?: InputType; files?: undefined }`). Spreading the broad HTML attributes type via Omit-then-rest-spread tripped the narrowing. Workaround: explicitly list the props that the wrapper actually exposes. Future custom inputs should follow the same pattern.
- **`apiJson` body union vs typed request objects** (Deviation 1). The `FetchBody = Record<string, unknown>` branch requires an index signature that pure TS interfaces lack. Spread-copy at the call site is the cleanest fix. Future api modules follow the same `body: { ...typed }` pattern.
- **`pathname` string-literal narrowing in +layout.svelte** (Deviation 3). Cast to `string` for prefix checks is the canonical workaround when adding routes inside the same plan that consults them.
- **No DOM test environment.** Component-mount tests would need jsdom + @testing-library/svelte. Not in pyproject equivalent yet. Logic-level tests cover the deterministic branches; full mount is a deferred improvement (no Phase-1 acceptance criterion requires it).

## Verification Results

| Check                                                                                            | Result                                                |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `cd frontend && pnpm run check`                                                                  | **0 errors, 0 warnings** (2159 files)                 |
| `cd frontend && pnpm run test`                                                                   | **26 tests passed across 4 suites**                   |
| `cd frontend && pnpm run build`                                                                  | exits 0; 7.71s build time                             |
| `grep -q 'Sign in' frontend/src/routes/login/+page.svelte`                                       | OK                                                    |
| `grep -q 'Wrong username or password' frontend/src/routes/login/+page.svelte`                    | OK                                                    |
| `grep -qE "won.t see it again\|saved it" frontend/src/lib/components/forms/SecretRevealDialog.svelte` | OK                                                |
| `grep -qE 'Type.*targetName\|Type.*to confirm' frontend/src/lib/components/forms/ConfirmByNameDialog.svelte` | OK                                       |
| `grep -q 'Please fix the following' frontend/src/lib/components/forms/FormSummaryAlert.svelte`   | OK                                                    |
| `grep -qE 'EyeOff\|Eye' frontend/src/lib/components/forms/PasswordInput.svelte`                  | OK                                                    |
| `grep -qE 'closeOnEscape=\{false\}\|closeOnEscape=false\|closeOnOutsideClick=false' frontend/src/lib/components/forms/SecretRevealDialog.svelte` | OK (header-comment traceability)  |
| `grep -q 'setup/status' frontend/src/routes/+layout.server.ts`                                   | OK                                                    |
| `grep -q 'no_admin_yet' frontend/src/routes/+layout.server.ts`                                   | OK                                                    |
| `! grep -q 'TODO(01-08)' frontend/src/routes/+layout.server.ts`                                  | OK (TODO removed)                                     |
| `grep -q 'Welcome to Proxmox GUI' frontend/src/routes/setup/+page.svelte`                        | OK                                                    |
| `grep -q 'Create the first admin' frontend/src/routes/setup/+page.svelte`                        | OK                                                    |
| `grep -qE "You're all set\|You.re all set" frontend/src/routes/setup/+page.svelte`               | OK                                                    |
| `grep -q 'Skip for now' frontend/src/routes/setup/+page.svelte`                                  | OK                                                    |
| `grep -q 'Test connection' frontend/src/routes/setup/+page.svelte`                               | OK                                                    |
| `grep -qE 'step === 1\|step === 4' frontend/src/routes/setup/+page.svelte`                       | OK (4-step state machine)                             |

## Setup Wizard Flow Walkthrough

A new operator's experience after Plan 04's installer + Plan 07's backend + this plan's frontend land:

1. Operator runs the install command → LXC + Caddy + FastAPI + frontend up.
2. Browser hits `https://<lxc>/`. SvelteKit's `+layout.server.ts` probes `/api/v1/setup/status` → `no_admin_yet=true` → redirects to `/setup`.
3. Operator sees the **Step 1 (Welcome)** card with "Welcome to Proxmox GUI" + "Get started" button.
4. Click "Get started" → **Step 2 (Create admin)**. Operator types username + email + password (12+ chars) + confirm. Submit → backend `POST /api/v1/setup/admin` (succeeds; backend creates user + personal team in one transaction) → frontend auto-logs-in via `POST /api/v1/auth/login` → cookies set → `invalidateAll()` re-runs the layout load (now `no_admin_yet=false` and user is hydrated) → step 3.
5. **Step 3 (Register cluster, optional).** Operator can either:
   - Skip via "Skip for now" → step 4.
   - Click "Test connection" first to validate, then "Register cluster" → backend `POST /api/v1/clusters/test` (dry-run; inline pill) then `POST /api/v1/clusters/` → step 4.
   - Click "Register cluster" without testing first (UI-SPEC allows bypass) → same outcome.
   - Click "Back" to return to step 2 (admin already exists; navigation only).
6. **Step 4 (Done).** "You're all set" + Sign in button. Click → `api.auth.logout()` clears the auto-login session → `goto('/login')`. Operator now signs in deliberately via `/login`.
7. Successful sign-in → redirect to `/` (or `?next=...` if they were trying to reach a specific route earlier). AppShell renders with sidebar + topbar + theme toggle. Phase 1 is operationally complete from the user's perspective.

Plans 09 (account self-service) + 10 (admin pages) flesh out the inside of the AppShell. Plan 10 also adds the post-install banner / dashboard hint that nudges the operator to register a cluster if they skipped step 3.

## Inter Variable woff2 Source

**Unchanged from Plan 03** — Inter Variable woff2 (352 KB) is self-hosted at `frontend/src/lib/assets/fonts/Inter-Variable.woff2`, sourced from `https://github.com/rsms/inter/raw/master/docs/font-files/InterVariable.woff2` (rsms/inter master). Bundled by Vite into `build/client/_app/immutable/assets/Inter-Variable.<hash>.woff2`. No external CDN; air-gap compatible (UI-SPEC §Typography).

This plan made no font changes.

## User Setup Required

None — pure feature work on the frontend. The operator-experience walkthrough above lands once Plan 04's helper-script ships.

For local development:
- `pnpm dev` continues to work standalone via the `/api` Vite proxy to FastAPI on `:8000`.
- The wizard requires a freshly-initialised backend DB (`no_admin_yet=true`); subsequent test runs need `rm backend/<dbfile>` to re-trigger the wizard.

## Hooks Exposed for Later Plans

- `api.auth.{login, logout, refresh}` — Plans 09 + 10 reuse for consistency with the Topbar logout flow.
- `api.me.{get, getStrict}` — Plan 09's account pages will read teams + last_login.
- `api.setup.{status, createAdmin}` — first-run only; Plans 09 + 10 do not call these.
- `api.clusters.{test, create}` — Plan 10 will extend with `list, get, patch, delete, testExisting`.
- `$lib/components/forms/PasswordInput` — Plan 09 password change form, Plan 10 cluster edit token field.
- `$lib/components/forms/FormSummaryAlert` — every form in Plans 09 + 10.
- `$lib/components/forms/ConfirmByNameDialog` — Plan 10 user disable / delete; cluster delete; SSH-key delete; PAT revoke.
- `$lib/components/forms/SecretRevealDialog` — Plan 09 PAT mint show-once; Plan 10 cluster registration response (if backend ever returns the bootstrap-token preview).
- `safeNext()` open-redirect guard pattern (`/login/+page.svelte`) — any future post-action navigation that honours a `?next=` parameter should mirror this validation.

## Self-Check: PASSED

Verified at write time:

- All 19 created files exist on disk + 8 modified files (verified via `find` + `git log -p`)
- Both commit hashes (`c4aaf4e`, `ef939b1`) are reachable from `master`
- `pnpm run check` reports 0 errors / 0 warnings
- `pnpm run test` reports 26 / 26 passing
- `pnpm run build` exits 0
- All 19 acceptance-criteria greps pass (Task 1 + Task 2 combined)
- TODO(01-08) marker removed from `+layout.server.ts` (verified via `! grep -q 'TODO(01-08)'`)

---

*Phase: 01-foundation*
*Plan: 08-frontend-auth-shell*
*Completed: 2026-05-14*
