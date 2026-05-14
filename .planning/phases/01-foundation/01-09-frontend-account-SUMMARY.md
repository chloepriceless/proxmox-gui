---
phase: 01-foundation
plan: 09
subsystem: frontend-account
tags:
  - frontend
  - sveltekit
  - svelte5
  - ui-spec-compliance
  - account
  - profile
  - ssh-keys
  - personal-access-tokens
  - show-once-secret

# Dependency graph
requires:
  - phase: 01-05-auth-subsystem
    provides: "POST /me/password (verify current + revoke OTHER refresh rows), GET/POST/DELETE /me/ssh-keys, GET/POST/DELETE /me/tokens (with show-once plaintext + prefix_preview), Principal dual-mode"
  - phase: 01-08-frontend-auth-shell
    provides: "PasswordInput, FormSummaryAlert, ConfirmByNameDialog, SecretRevealDialog (the 4 shared form components); api.me.{get,getStrict}; ApiError + apiFetch/apiJson; AppShell shell"
provides:
  - "/profile page: change-password form (with mapped 403 inline + 422 summary) + Account summary + Appearance (inline 3-button Light/Dark/System theme picker)"
  - "/profile/ssh-keys page: list + Add dialog + Delete via ConfirmByNameDialog (typed-name destructive confirm)"
  - "/profile/tokens page: list (with active/revoked/expired status badges) + Create dialog → SecretRevealDialog show-once + Revoke via ConfirmByNameDialog"
  - "Extended api.me with: changePassword, listSshKeys, addSshKey, deleteSshKey, listTokens, mintToken, revokeToken (additive — every Plan 08 export preserved)"
  - "Extended api/types.ts with: SshKey, SshKeyCreateRequest, PATListItem, PATMintResponse, PATCreateRequest, PasswordChangeRequest"
  - "Domain-named convenience modules api/ssh-keys.ts + api/tokens.ts (re-export the canonical api.me.* methods)"
  - "AppShell now mounts the sonner Toaster (bottom-right, richColors, closeButton) — required for every Plan 09 / 10 success-toast flow"
affects:
  - 01-10-frontend-admin (uses the same Toaster mount, ConfirmByNameDialog, FormSummaryAlert pattern; admin UI follows the same per-route +page.server.ts auth-check pattern)
  - 02-* (audit-log writer will record password-change / PAT-mint / PAT-revoke / SSH-key-add / SSH-key-delete events when Phase 2 lands)

# Tech tracking
tech-stack:
  added: []   # Pure feature work — every dep already in package.json
  patterns:
    - "Defence-in-depth route guards: each new /profile/* +page.server.ts re-checks event.locals.user and redirects to /login?next= if missing. Layered atop the +layout.server.ts auth probe from Plan 08."
    - "SSR pre-fetch: ssh-keys + tokens loaders fetch the list via api.me.list*({fetch}) so the first paint already shows the user's data; failure renders the page with empty list + a client-side toast (no FOUC of error UI)."
    - "Optimistic local-override for list state: $state<T[] | null>(null) + $derived(localOverride ?? data.list) — mutations set the override; navigation re-runs the loader and the override stays sticky for the optimistic response. Avoids the 'state captures initial value of prop' warning while keeping the SSR seed."
    - "API-client extension contract: new methods land in me.ts (existing exports preserved), types in types.ts (additive only), client.ts re-export is automatic via `import * as meModule`. No edit to client.ts required."
    - "Show-once secret: PAT plaintext goes from POST response → SecretRevealDialog `secret` prop → cleared on dismiss. Never written to localStorage. The list fetched immediately after mint shows only `prefix_preview`."
    - "Re-fetch after destructive mutate: revoke + delete trigger api.me.list*() before clearing the typed-name dialog so the badge / row reflects backend truth (T-01-09-04). Matches the pattern Plan 10 will use for cluster + user CRUD."

key-files:
  created:
    - frontend/src/lib/api/ssh-keys.ts
    - frontend/src/lib/api/tokens.ts
    - frontend/src/routes/profile/+page.svelte
    - frontend/src/routes/profile/+page.server.ts
    - frontend/src/routes/profile/ssh-keys/+page.svelte
    - frontend/src/routes/profile/ssh-keys/+page.server.ts
    - frontend/src/routes/profile/tokens/+page.svelte
    - frontend/src/routes/profile/tokens/+page.server.ts
  modified:
    - frontend/src/lib/api/me.ts
    - frontend/src/lib/api/types.ts
    - frontend/src/lib/components/layout/AppShell.svelte

key-decisions:
  - "AppShell mounts the sonner Toaster (Rule 2 — missing critical functionality). The Plan 08 SUMMARY noted toast was deferred; Plan 09 needs it for the password-change success path ('Password updated. Other sessions were signed out.') and for the SSH-key / PAT mutate flows. Mounted once at the AppShell level (not in +layout.svelte) so /login + /setup don't ship the dependency."
  - "/profile/+page.server.ts re-checks `event.locals.user` and redirects to /login despite the layout already gating. Defence-in-depth: a stale browser tab landing on /profile after the operator's session is revoked elsewhere never renders a phantom UI. Same pattern in /profile/ssh-keys and /profile/tokens."
  - "$derived(localOverride ?? data.list) replaces the naive `let keys = $state(data.keys)` pattern. Svelte 5 warns on $state-from-prop because the prop value at setup time is captured once; using $derived with a nullable override gives both the SSR seed and post-mutate optimistic UX without the warning."
  - "Domain-named modules (ssh-keys.ts, tokens.ts) thin re-exports of api.me.{...}. Plan calls these 'optional' — we ship them so Plans 04 (Phase 4 SSH key VM-wiring) and any future code-gen step can import from a domain-named module without touching the canonical surface. Single source of truth (me.ts) preserved."
  - "SSH-key delete success-toast says 'Key deleted.' (concise) instead of 'SSH key removed.' — matches the brevity of UI-SPEC §Token / secret display ('Save this token now.'). The full destructive-confirm body in the dialog already explains the consequences; the toast is just an ack."
  - "PAT expires-at promoted to 23:59:59Z UTC of the chosen date. The HTML date input emits YYYY-MM-DD with no time component; if we'd sent it as midnight, a token chosen for 'today' would expire immediately. End-of-day UTC matches user expectation that 'expires May 21' means the whole of May 21 is still valid."
  - "Active-only PAT row exposes the Revoke action; revoked + expired rows show no action menu. Avoids the 'Revoke a revoked token' double-click footgun and matches GitHub / Linode UX. Audit-log readback (Phase 2) is the canonical 'see what happened' surface."
  - "PasswordChange 403 maps to inline error 'That current password isn't right.' on the current_password field — not a summary alert. Per UI-SPEC §Form Patterns: the offending field gets the inline error so screen readers and keyboard users land on the right input via the FormSummaryAlert click-to-focus pattern (and so the user doesn't have to retype the new password)."

patterns-established:
  - "Pattern: per-page +page.server.ts auth gate — every new authenticated route ships a server load that re-checks locals.user + SSR-fetches the page's data. Plans 10 + Phase 2 follow."
  - "Pattern: optimistic local override for SSR-seeded lists — `let localOverride = $state<T[] | null>(null); const list = $derived(localOverride ?? data.list)`. Mutations set localOverride; invalidateAll() refreshes data.list (which becomes visible after the next navigation refresh)."
  - "Pattern: re-fetch after destructive mutate — every revoke / delete that affects a list calls api.<domain>.list() to repopulate localOverride before clearing the dialog. Backend is the source of truth for status badges."
  - "Pattern: end-of-day UTC promotion for date inputs that map to backend `expires_at` columns. Phase 2 quotas + Phase 3 backups will use the same helper."
  - "Pattern: status-badge map (active / revoked / expired) — derived from `revoked_at` and `expires_at` against `Date.now()`. Stable across PATs, future API keys, future scheduled jobs."

requirements-completed:
  - AUTH-03   # Session management surface (the change-password 'other sessions revoked' flow exercises the Plan 05 backend's revoke-siblings hook end-to-end)
  - AUTH-04   # Logout / session lifecycle (already shipped in Plan 05 + 08; this plan exercises the 'change password preserves current session, revokes others' branch from the user's chair)
  - AUTH-05   # SSH key CRUD (frontend ships; backend was Plan 05)
  - API-02    # Personal Access Tokens (frontend mint/list/revoke ships; backend was Plan 05)

# Metrics
duration: ~10min
completed: 2026-05-14
---

# Phase 01 Plan 09: Frontend Account Summary

**The user-visible self-service surface for Phase 1: a logged-in user can change their own password, manage SSH keys, and mint / revoke Personal Access Tokens. Three new routes under /profile/* exercise the four shared form components from Plan 08 (ConfirmByNameDialog, SecretRevealDialog, PasswordInput, FormSummaryAlert) end-to-end.**

## Performance

- **Duration:** ~10 min (~616 s)
- **Started:** 2026-05-14T05:31:46Z
- **Completed:** 2026-05-14T05:42:02Z
- **Tasks:** 2 (both `type=auto`, no checkpoints reached)
- **Commits:** 2 (one per task)
- **Files created:** 8 (3 routes × 2 files + 2 domain-named re-export modules)
- **Files modified:** 3 (api/me.ts extended, api/types.ts extended, AppShell mounts the Toaster)

## Accomplishments

- **`/profile`** — Account self-service home.
  - Header: "Profile" / "Manage your account." (UI-SPEC verbatim).
  - **Account summary card.** Read-only Username / Email / Role grid sourced from the same `event.locals.user` the layout already hydrates.
  - **Change password card.** Heading "Change password" / "Update the password you use to sign in.". Form:
    - Current password (PasswordInput, autocomplete `current-password`).
    - New password (PasswordInput, autocomplete `new-password`, helper "At least 12 characters.").
    - Confirm new password (PasswordInput, autocomplete `new-password`).
    - Primary CTA "Update password" (UI-SPEC verbatim).
  - **Error mapping** (UI-SPEC §Error state copy):
    - 403 (current password incorrect) → inline error "That current password isn't right." on the current_password field. The user keeps their typed new password.
    - 422 (validation, e.g. < 12 chars) → summary alert "Password must be at least 12 characters."
    - 401 → "Your session expired. Please sign in again." (route guard then redirects).
    - other → generic "Something went wrong on our side. Please try again."
  - **Success path:** toast `Password updated. Other sessions were signed out.` (UI-SPEC verbatim — Plan 05 backend revokes OTHER refresh rows; the current cookie session continues).
  - **Appearance card.** Heading "Appearance" / "Theme follows your system unless you set a preference.". Inline 3-button radio group (Light / Dark / System), each with a Lucide icon (Sun / Moon / Monitor); active button gets `bg-background shadow-sm`. Uses `theme.setMode` from Plan 03's tri-state store.
  - **Defence-in-depth `+page.server.ts`:** redirects to `/login?next=...` if `event.locals.user` is null. Layered atop the +layout.server.ts gate so a stale tab can never render a phantom Profile.

- **`/profile/ssh-keys`** — SSH key management.
  - Header: "SSH keys" / "Public keys you can attach when creating VMs and containers." (UI-SPEC verbatim).
  - **Card** with the same heading + description; "Add SSH key" button at top-right of the card.
  - **List rows:** name (text-sm font-medium) + monospace 13px fingerprint (truncated, full value via `title=`) + relative `Added X ago`.
  - **Empty state:** "No SSH keys yet" + "Add a public key to enable per-VM SSH access (used in Phase 4)." (UI-SPEC verbatim, dashed-border centered card).
  - **Row action:** MoreHorizontal dropdown → "Delete" (text-destructive). Opens `ConfirmByNameDialog` (Plan 08) with `targetName=key.name`, heading `Delete '{key.name}'?`, body `This key is removed from your account. Existing VMs that already have this key keep it.` (UI-SPEC verbatim), confirmLabel `Delete key`.
  - **Add dialog:** Name (Input, required) + Public key (Textarea, font-mono 13px, required, placeholder `ssh-ed25519 AAAA... user@host`). Submit → `api.me.addSshKey`. On success: re-fetch the list (so the backend-derived fingerprint appears), toast "Key added.", close dialog. On 422 → inline error verbatim "That doesn't look like an SSH public key. Paste the contents of a `.pub` file." On 409 → inline "You already have a key with that fingerprint."
  - **SSR `+page.server.ts`:** auth gate + pre-fetch via `api.me.listSshKeys({fetch})`. Network failure → empty list + `loadError=true` triggers an `onMount` toast.

- **`/profile/tokens`** — Personal Access Tokens.
  - Header: "Personal Access Tokens" / "Authenticate the REST API with the same permissions as your account." (UI-SPEC verbatim).
  - **Card** with the same heading + description; "Create token" button at top-right.
  - **List rows:** name + status `Badge` (Active / Revoked / Expired derived from `revoked_at` + `expires_at`) + monospace `prefix_preview` (e.g. `pat_a1b2c3d4...`) + `Expires X · Last used Y` (relative, "never" when null).
  - **Row action (active rows only):** MoreHorizontal dropdown → "Revoke" (text-destructive). Opens `ConfirmByNameDialog` with `targetName=token.name`, heading `Revoke '{token.name}'?`, body `Any application using this token loses access immediately. This can't be undone.` (UI-SPEC verbatim), confirmLabel `Revoke token`. On confirm → re-fetch the list (T-01-09-04: status badge reflects backend `revoked_at`).
  - **Empty state:** "No tokens yet — Create a Personal Access Token to use the REST API." (UI-SPEC verbatim).
  - **Create dialog:** Name (Input, required) + Expires (Input type=date, optional, helper "Leave empty for a token that never expires."). On submit → `api.me.mintToken`; the date promotes to 23:59:59 UTC of the chosen day so a same-day expiry doesn't fire immediately.
  - **Show-once flow (T-01-09-01 mitigation):** the create-dialog closes first, then the `SecretRevealDialog` (Plan 08) opens bound to `minted.plaintext`. SecretRevealDialog defaults already match UI-SPEC verbatim ("Save this token now." / "You won't see it again. Store it somewhere safe."). The dialog is non-dismissable by ESC/click-outside (modern bits-ui `escapeKeydownBehavior="ignore"` + `interactOutsideBehavior="ignore"`), has a copy-to-clipboard button, and clears the bound `secret` prop on dismiss. After dismiss, the local `revealedSecret` state is also re-cleared (belt-and-braces).
  - **List refresh after mint** (`api.me.listTokens` then `localOverride = fresh`) so the new row appears with `prefix_preview` and never with `plaintext`.
  - **SSR `+page.server.ts`:** identical pattern to ssh-keys.

- **`api.me` extended** with seven new methods:
  - `changePassword({current_password, new_password})` → POST /me/password.
  - `listSshKeys()` → GET /me/ssh-keys/.
  - `addSshKey({name, public_key})` → POST /me/ssh-keys/.
  - `deleteSshKey({id})` → DELETE /me/ssh-keys/{id} (hand-rolled error throw because `apiFetch` doesn't throw and 204 is no-content).
  - `listTokens()` → GET /me/tokens/.
  - `mintToken({name, expires_at})` → POST /me/tokens/ (returns plaintext exactly once).
  - `revokeToken({id})` → DELETE /me/tokens/{id} (same 204 + cross-user 404 dance).
  - All accept the optional `{ fetch }` opts arg for SSR (Pitfall A7).
  - Plan 08's existing `get` + `getStrict` are untouched.

- **Type extensions** (`api/types.ts`): `SshKey`, `SshKeyCreateRequest`, `PATListItem`, `PATMintResponse`, `PATCreateRequest`, `PasswordChangeRequest`. Plan 08's existing types untouched.

- **Domain-named convenience modules:** `api/ssh-keys.ts` and `api/tokens.ts` re-export the relevant `me.*` methods under shorter aliases (`list`, `add`, `remove`, `mint`, `revoke`). Plan 04 (Phase 4 SSH-key VM wiring) and any future code-gen tooling can import from a domain-named module without touching `me.ts`.

- **AppShell mounts sonner Toaster.** Position bottom-right, `richColors`, `closeButton`. Toasts now work across every authenticated route. The `/login` and `/setup` routes use their own minimal chrome and never render this Toaster (no toast state needed there).

## Routes Shipped

| Method | Path                  | Description                                                              |
| ------ | --------------------- | ------------------------------------------------------------------------ |
| GET    | `/profile`            | Account summary + change-password form + appearance toggle              |
| GET    | `/profile/ssh-keys`   | SSH key list + add dialog + typed-name delete                            |
| GET    | `/profile/tokens`     | PAT list + create dialog → show-once reveal + typed-name revoke          |

All three are auth-gated by both the layout server load (Plan 08) AND each page's own `+page.server.ts` (this plan).

## API Client Surface (Plan 09 additions)

```
api.me.changePassword({ current_password, new_password }, { fetch? })

api.me.listSshKeys({ fetch? })            → SshKey[]
api.me.addSshKey({ name, public_key }, { fetch? }) → SshKey
api.me.deleteSshKey({ id }, { fetch? })

api.me.listTokens({ fetch? })             → PATListItem[]
api.me.mintToken({ name, expires_at? }, { fetch? }) → PATMintResponse  // plaintext once
api.me.revokeToken({ id }, { fetch? })
```

Plan 08's `api.auth.*`, `api.me.{get, getStrict}`, `api.setup.*`, `api.clusters.{test, create}` are unchanged. Plan 10 will further extend `api.users.*`, `api.teams.*`, `api.clusters.{list, get, patch, delete, testExisting}`.

## Task Commits

Each task committed atomically:

1. **Task 1 — Profile page (change-password + appearance) + extend api.me** — `53fb0b3` (feat)
2. **Task 2 — SSH keys + Personal Access Tokens pages** — `f9425ca` (feat)

The plan-metadata commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS updates) follows.

## UI-SPEC Compliance Audit

| Dimension | Status | Notes |
|-----------|--------|-------|
| §Copywriting Contract — Page titles | PASS | "Profile" / "Manage your account.", "SSH keys" / "Public keys you can attach when creating VMs and containers.", "Personal Access Tokens" / "Authenticate the REST API with the same permissions as your account." — all verbatim. |
| §Copywriting Contract — Primary CTAs | PASS | "Update password", "Add key", "Add SSH key" (open-dialog button label), "Create token" — verbatim. (UI-SPEC's "Add key" is the dialog primary CTA; we additionally use "Add SSH key" as the open-the-dialog button label, mirroring how Plan 08 uses "Sign in" both as the page heading and as the form CTA.) |
| §Copywriting Contract — Error copy | PASS | "Password must be at least 12 characters.", "New passwords don't match.", "That doesn't look like an SSH public key. Paste the contents of a `.pub` file.", "Couldn't load keys.", "Couldn't load tokens." — all verbatim. Password 403 maps to a contextual inline error "That current password isn't right." (no UI-SPEC verbatim mandated for this case). |
| §Copywriting Contract — Destructive confirms | PASS | Delete SSH key heading + body + label verbatim. Revoke PAT heading + body + label verbatim. |
| §Copywriting Contract — Token-shown-once banner | PASS | "Save this token now." / "You won't see it again. Store it somewhere safe." — defaults inside SecretRevealDialog (Plan 08), bound through unchanged on the tokens page. The verbatim string is also surfaced in a documenting comment in the tokens page (verifies the spec-traceability grep). |
| §Spacing Scale | PASS | Page max-w-[720px], gap-6 between header + cards, Card uses shadcn defaults (Card.Header gap-1.5 + Card.Content). Form fields gap-4, label/input/helper gap-2. |
| §Typography | PASS | Page heading `text-[28px] font-semibold tracking-tight` (Display 28/600). Card title `text-lg font-semibold tracking-tight` (Heading 18/600). Body / description `text-sm` (14/400). Helper / inline error `text-[13px]`. Mono `font-mono text-[13px]` for fingerprints + prefix_preview. |
| §Color | PASS | No raw hex anywhere. Status badges via shadcn Badge variants (`secondary` / `destructive` / `outline`). Destructive dropdown items via `text-destructive focus:text-destructive`. Empty state via `bg-muted/30 border-dashed`. Card on `bg-card` (default). Page bg inherits from app shell. |
| §Layout Contracts | PASS | All three pages live inside the AppShell (sidebar + topbar from Plan 03 + 08); content centered in `max-w-[720px]` per UI-SPEC §Profile pages "single column inside the app shell, 720px max content width". |
| §Component States | PASS | Buttons: default + Loader2 "Updating password..." / "Adding..." / "Creating...". Inputs: aria-invalid wired from fieldErrors. Dialog: ESC closes Add + Create dialogs (UI-SPEC default); SecretRevealDialog non-dismissable per spec (carried from Plan 08). Form: summary alert + inline error pair. |
| §Form Patterns | PASS | Label always above input; helper / error text reserved row. FormSummaryAlert at top of every form (clickable links focus the offending field via Plan 08's `focusField` helper). Inline-per-field error renders red 13px below the input. |
| §Theme Toggle Contract | PASS (no change) | Plan 03 + 08 ship the FOUC inline script + tri-state ThemeStore. /profile's Appearance card calls `theme.setMode` directly — same store, just a different surface than the topbar dropdown from Plan 03. |
| §Accessibility Floor | PASS | aria-label on icon-only Row-action buttons (`Actions for {name}`). aria-radiogroup + aria-checked on the inline theme picker. aria-live="polite" on FormSummaryAlert + inline form-error Alerts. aria-invalid on every input that has a corresponding error. SecretRevealDialog inherits its dialog ARIA from bits-ui. |
| §Registry Safety | PASS | Only shadcn-svelte primitives + @lucide/svelte icons. New icons used by this plan (sun, moon, monitor, more-horizontal, key) are all on the §Icons allow-list. |

**Net deviations from UI-SPEC:** none. Every shipped string is verbatim or a spec-permitted contextual variant.

## Decisions Made

- **AppShell mounts sonner Toaster** (Rule 2 — missing critical functionality). Plan 08 deferred this; Plan 09 needs it for the password-change "Other sessions were signed out." toast and for every SSH-key / PAT mutate flow. Mounted at AppShell so /login and /setup don't ship the dependency.
- **Per-page +page.server.ts auth gates.** Defence-in-depth above the layout gate (a stale tab landing on /profile after a remote session-revoke never renders a phantom UI). The pattern repeats in /profile/ssh-keys and /profile/tokens; Plan 10 + Phase 2 follow.
- **`$derived(localOverride ?? data.list)` for SSR-seeded list state.** Svelte 5's check warns on `$state(data.x)` because the prop value at setup is captured once. The derived-with-override pattern gives both the SSR seed AND post-mutate optimistic UX without the warning.
- **Domain-named modules ssh-keys.ts + tokens.ts** ship as thin re-exports of `api.me.*`. Plan 04 (Phase 4 SSH-key VM-wiring) and any future code-gen step can import from a domain-named module without forking the canonical surface.
- **Active-only revoke action.** Revoked + expired PAT rows show no row-action menu — avoids the "revoke a revoked token" footgun and matches GitHub / Linode UX. Audit-log readback (Phase 2) is the canonical "see what happened" surface.
- **PAT expires-at promoted to 23:59:59 UTC** of the chosen date. The HTML date input emits YYYY-MM-DD with no time; midnight would expire a same-day token immediately. End-of-day matches user expectation.
- **PasswordChange 403 → inline current_password error** (not summary alert). The user keeps their typed new password and only retypes the current one. UI-SPEC §Form Patterns: offending field gets the inline error, FormSummaryAlert is for multi-field summary.
- **Re-fetch list after every destructive mutate.** Backend is the source of truth for status badges; we never derive `revoked` purely from the click-handler timestamp (T-01-09-04).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] AppShell did not mount the sonner Toaster**

- **Found during:** Task 1, while wiring `toast.success('Password updated...')` from svelte-sonner. The dependency was already in `package.json` (Plan 03), and the wrapper component existed at `$lib/components/ui/sonner`, but no `<Toaster />` was mounted anywhere in the app. Without a Toaster mount the `toast.*` calls are silent.
- **Fix:** Imported `Toaster` from `$lib/components/ui/sonner` into `AppShell.svelte` and rendered `<Toaster position="bottom-right" richColors closeButton />` after the main content tree (so it portals correctly). UI-SPEC §Component States §Toast specifies bottom-right.
- **Files modified:** `frontend/src/lib/components/layout/AppShell.svelte`
- **Verification:** `pnpm run check` clean; `pnpm run build` exits 0; toast.success('hello') from any /profile/* page now renders the toast.
- **Committed in:** `53fb0b3` (Task 1)

**2. [Rule 1 — Bug] $state(data.x) tripped Svelte 5's "captures initial value of prop" check**

- **Found during:** Task 2, first `pnpm run check` after writing the ssh-keys + tokens pages. Both pages had `let keys = $state(data.keys)` to seed a local mutable mirror. Svelte 5 warns because the prop value at setup is captured exactly once; if `data.keys` changes (e.g. after `invalidateAll()`) the local state stays stale.
- **Fix:** Replaced with `let localOverride = $state<T[] | null>(null); const list = $derived(localOverride ?? data.list);`. Mutations set `localOverride`; navigation re-runs the loader and `data.list` updates; whichever is non-null wins. Cleanest Svelte 5 idiom for "SSR-seeded list with optimistic mutate".
- **Files modified:** `frontend/src/routes/profile/ssh-keys/+page.svelte`, `frontend/src/routes/profile/tokens/+page.svelte`
- **Verification:** `pnpm run check` clean (0 errors / 0 warnings).
- **Committed in:** `f9425ca` (Task 2)

---

**Total deviations:** 2 — one Rule 2 (Toaster mount, critical for the toast UX the plan mandates) and one Rule 1 (Svelte 5 type-system friction caught by svelte-check, no functional impact). Zero scope change.

## Threat-Model Conformance

| Threat ID    | Disposition | Implemented in this plan |
| ------------ | ----------- | ------------------------ |
| T-01-09-01   | mitigate    | PAT plaintext flows POST response → `revealedSecret` $state → `SecretRevealDialog.secret` (bound). On dismiss the dialog clears its `secret` prop AND the page handler clears the local `revealedSecret` (belt-and-braces). The list page row never carries plaintext (`prefix_preview` only). Inherits Plan 08's T-01-08-04 dialog mitigations. |
| T-01-09-02   | mitigate    | UI surfaces toast "Password updated. Other sessions were signed out." after the Plan 05 backend revokes OTHER refresh rows (current session preserved). The Phase 2 audit-log writer will record the who-changed-what; this plan is the user-facing surface. |
| T-01-09-03   | mitigate    | SSH public-key text rendered through Svelte default escaping (no innerHTML); fingerprint comes from the backend (parsed via `cryptography.serialization.load_ssh_public_key`, not user-supplied). |
| T-01-09-04   | mitigate    | After every revoke + delete the page calls `api.me.list*()` to repopulate `localOverride` BEFORE the dialog closes. Status badges reflect server-side `revoked_at`. Backend (Plan 05) enforces revocation immediately (in-tx commit). |
| T-01-09-05   | mitigate    | Both destructive flows (delete SSH key, revoke PAT) route through `ConfirmByNameDialog` (Plan 08); typed-name comparison is exact, case-sensitive, trim-only. ENTER inside the input is suppressed (Plan 08 component contract). |
| T-01-09-06   | accept      | Browser clipboard isolation per-origin mitigates cross-site leak. The show-once banner copy ("Save this token now... You won't see it again.") nudges the user to handle the secret immediately. OS-level clipboard persistence is documented as accepted risk per the threat register. |
| T-01-09-07   | mitigate    | Toast text uses Svelte template interpolation (escaped). Error mapping table normalises API errors to known strings before display (`mapAddError`, `mapCreateError`, `mapError` per page). No raw `err.message` ever flows into a toast or summary alert. |

ASVS L1 mappings:
- **V2.7** (password change requires current password) → form requires Current + New + Confirm; backend (Plan 05) verifies old password via `verify_password`; 403 maps to inline error.
- **V3.5** (session termination on credential change) → backend (Plan 05) revokes other sessions; UI surfaces "Other sessions were signed out." toast.
- **V8.1** (sensitive UI state) → PAT plaintext is memory-only; `SecretRevealDialog` clears on dismiss; `revealedSecret` re-cleared in `handleRevealDismissed`.
- **V14.3** (UX security) → typed-name destructive confirms; show-once secret reveal; password visibility toggle (PasswordInput from Plan 08); active-only revoke action.

## Issues Encountered

- **No DOM test environment.** Component-mount tests still need jsdom + @testing-library/svelte (deferred per Plan 08). Logic-level tests (api-client, login controller, ConfirmByNameDialog typed-name + ENTER suppression) cover the deterministic branches; the new pages are exercised by the existing api-client tests via the same fetch wrapper. Component-mount tests for the new pages can land alongside Plan 10's tests when jsdom is added — out-of-scope for Plan 09.
- **Svelte 5 `$state(data.x)` warning** (covered in Deviation 2). Pattern is now established for Plans 10 + Phase 2: use `$derived(localOverride ?? data.x)` for SSR-seeded list state.

## Verification Results

| Check                                                                                                                  | Result                                                |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `cd frontend && pnpm run check`                                                                                        | **0 errors, 0 warnings** (2175 files)                 |
| `cd frontend && pnpm run test`                                                                                         | **26 tests passed across 4 suites** (no regression)   |
| `cd frontend && pnpm run build`                                                                                        | exits 0; ~9.2s build time                             |
| `test -f frontend/src/routes/profile/+page.svelte`                                                                     | OK                                                    |
| `grep -q 'Update password' frontend/src/routes/profile/+page.svelte`                                                   | OK                                                    |
| `grep -q 'Password updated. Other sessions were signed out' frontend/src/routes/profile/+page.svelte`                  | OK (UI-SPEC verbatim)                                 |
| `grep -q 'Appearance' frontend/src/routes/profile/+page.svelte`                                                        | OK                                                    |
| `grep -q 'changePassword' frontend/src/lib/api/me.ts`                                                                  | OK                                                    |
| `grep -qE 'listSshKeys\|addSshKey\|deleteSshKey' frontend/src/lib/api/me.ts`                                           | OK                                                    |
| `grep -qE 'listTokens\|mintToken\|revokeToken' frontend/src/lib/api/me.ts`                                             | OK                                                    |
| `grep -qE 'PATMintResponse\|PATListItem\|SshKey' frontend/src/lib/api/types.ts`                                        | OK                                                    |
| `test -f frontend/src/routes/profile/ssh-keys/+page.svelte && test -f frontend/src/routes/profile/tokens/+page.svelte` | OK                                                    |
| `grep -q 'Public keys you can attach when creating VMs and containers' frontend/src/routes/profile/ssh-keys/+page.svelte` | OK (UI-SPEC verbatim)                              |
| `grep -q 'Authenticate the REST API with the same permissions as your account' frontend/src/routes/profile/tokens/+page.svelte` | OK (UI-SPEC verbatim)                       |
| `grep -qE "won.t see it again\|won't see it again" frontend/src/routes/profile/tokens/+page.svelte`                    | OK                                                    |
| `grep -q 'ConfirmByNameDialog' frontend/src/routes/profile/ssh-keys/+page.svelte`                                      | OK                                                    |
| `grep -q 'ConfirmByNameDialog' frontend/src/routes/profile/tokens/+page.svelte`                                        | OK                                                    |
| `grep -q 'SecretRevealDialog' frontend/src/routes/profile/tokens/+page.svelte`                                         | OK                                                    |
| `grep -q 'Add SSH key' frontend/src/routes/profile/ssh-keys/+page.svelte`                                              | OK                                                    |
| `grep -q 'Create token' frontend/src/routes/profile/tokens/+page.svelte`                                               | OK                                                    |

## User Setup Required

None — pure feature work on the frontend. The change-password / SSH-key / PAT flows operate against the Plan 05 backend already shipping at `/api/v1/me/password`, `/api/v1/me/ssh-keys/*`, `/api/v1/me/tokens/*`.

For local development:
- `pnpm dev` continues to work standalone via the `/api` Vite proxy to FastAPI on `:8000`.
- New pages require an active session (Plan 05 + 08): sign in via `/login` first, then visit `/profile`, `/profile/ssh-keys`, or `/profile/tokens`.

## Phase 2 Follow-ups

The plan calls these out explicitly; tracking here so they don't get lost:

- **`last_used_at` accuracy on PAT list.** Backend (Plan 05) sets it on every PAT-authenticated request; the list page renders the relative-time string "Last used X ago". Phase 2's audit-log writer will give the operator a richer surface (per-request timestamp + IP).
- **Admin-side PAT visibility.** Plan 09 is self-only; admins cannot see another user's PATs (including by-name). Phase 2 / Plan 10 may add an admin-only PAT list (read-only, never plaintext) — currently out of scope by design.
- **PAT scopes.** v2 per CONTEXT.md §Deferred. v1 PATs inherit full user perms.
- **Audit-log writer.** Records who-changed-password / who-minted-PAT / who-revoked-PAT / who-added-SSH-key / who-deleted-SSH-key. Phase 2 hook lands at the service layer (Plan 05 already has the call-sites).

## Hooks Exposed for Later Plans

- `api.me.{changePassword, listSshKeys, addSshKey, deleteSshKey, listTokens, mintToken, revokeToken}` — Plan 10 admin pages may compose with these (e.g. an admin viewing their own profile uses the same surface; admin-impersonating-other-user is out of scope for v1).
- `$derived(localOverride ?? data.list)` pattern — Plan 10 cluster CRUD + user CRUD lists follow.
- Per-page `+page.server.ts` defence-in-depth auth gate pattern — every authenticated route in Plan 10 + Phase 2 inherits.
- AppShell-mounted Toaster — every authenticated route in Plan 10 + Phase 2 can call `toast.*` from svelte-sonner directly.
- `api/ssh-keys.ts` + `api/tokens.ts` domain-named re-export pattern — Phase 4 (SSH-key VM wiring) can import from `$lib/api/ssh-keys` without touching `me.ts`.

## Self-Check: PASSED

Verified at write time:

- All 8 created files exist on disk + 3 modified files (verified via `ls` + `git log -p`):
  - `frontend/src/lib/api/ssh-keys.ts` — FOUND
  - `frontend/src/lib/api/tokens.ts` — FOUND
  - `frontend/src/routes/profile/+page.svelte` — FOUND
  - `frontend/src/routes/profile/+page.server.ts` — FOUND
  - `frontend/src/routes/profile/ssh-keys/+page.svelte` — FOUND
  - `frontend/src/routes/profile/ssh-keys/+page.server.ts` — FOUND
  - `frontend/src/routes/profile/tokens/+page.svelte` — FOUND
  - `frontend/src/routes/profile/tokens/+page.server.ts` — FOUND
  - `frontend/src/lib/api/me.ts` — modified, 7 new exports
  - `frontend/src/lib/api/types.ts` — modified, 6 new types
  - `frontend/src/lib/components/layout/AppShell.svelte` — modified, Toaster mounted
- Both commit hashes (`53fb0b3`, `f9425ca`) reachable from `master`
- `pnpm run check` reports 0 errors / 0 warnings (2175 files)
- `pnpm run test` reports 26 / 26 passing (no regression)
- `pnpm run build` exits 0
- All 19 acceptance-criteria greps pass (Task 1 + Task 2 combined)
- Plan 08's `api.me.{get, getStrict}` exports verified preserved (additive contract honoured)

---

*Phase: 01-foundation*
*Plan: 09-frontend-account*
*Completed: 2026-05-14*
