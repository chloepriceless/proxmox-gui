---
phase: 01-foundation
plan: 09
type: execute
wave: 6
depends_on:
  - 08
files_modified:
  - frontend/src/lib/api/me.ts
  - frontend/src/lib/api/ssh-keys.ts
  - frontend/src/lib/api/tokens.ts
  - frontend/src/lib/api/client.ts
  - frontend/src/lib/api/types.ts
  - frontend/src/routes/profile/+page.svelte
  - frontend/src/routes/profile/+page.server.ts
  - frontend/src/routes/profile/ssh-keys/+page.svelte
  - frontend/src/routes/profile/ssh-keys/+page.server.ts
  - frontend/src/routes/profile/tokens/+page.svelte
  - frontend/src/routes/profile/tokens/+page.server.ts
autonomous: true
requirements:
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - API-02
user_setup: []
tags:
  - frontend
  - sveltekit
  - svelte5
  - ui-spec-compliance
  - account
  - profile
must_haves:
  truths:
    - "Profile page (/profile) shows password change form (UI-SPEC §Form Patterns) and inline theme toggle"
    - "Password change submits to POST /api/v1/me/password; on success toast 'Password updated. Other sessions were signed out.'"
    - "SSH keys page (/profile/ssh-keys) lists keys with fingerprint and relative created_at; supports add (dialog) + delete (ConfirmByNameDialog typed-name confirm)"
    - "PAT tokens page (/profile/tokens) mints PAT via SecretRevealDialog show-once dialog; list shows prefix_preview only (never plaintext)"
    - "PAT creation success path: POST /api/v1/me/tokens → SecretRevealDialog opens with plaintext; non-dismissable by ESC/click-outside"
    - "Destructive actions (delete SSH key, revoke PAT) go through ConfirmByNameDialog (from Plan 08)"
    - "Every UI string is the EXACT verbatim copy from UI-SPEC §Copywriting Contract"
    - "Inline-per-field errors AND summary alert at top per UI-SPEC §Form Patterns"
  artifacts:
    - path: "frontend/src/routes/profile/+page.svelte"
      provides: "Profile page with change-password + appearance sections"
      contains: "Update password"
    - path: "frontend/src/routes/profile/ssh-keys/+page.svelte"
      provides: "SSH keys list/add/delete page"
      contains: "Add SSH key"
    - path: "frontend/src/routes/profile/tokens/+page.svelte"
      provides: "PAT list/create/revoke page"
      contains: "Create token"
  key_links:
    - from: "frontend/src/routes/profile/tokens/+page.svelte"
      to: "frontend/src/lib/components/forms/SecretRevealDialog.svelte (from Plan 08)"
      via: "PAT mint response.plaintext fed to SecretRevealDialog"
      pattern: "SecretRevealDialog"
    - from: "frontend/src/routes/profile/ssh-keys/+page.svelte"
      to: "frontend/src/lib/components/forms/ConfirmByNameDialog.svelte (from Plan 08)"
      via: "Delete button opens ConfirmByNameDialog targetName=key.name"
      pattern: "ConfirmByNameDialog"
---

<objective>
Land the three account self-service pages: profile (password change + appearance), SSH keys (list/add/delete), and PAT tokens (list/create/revoke). All three live inside the authenticated app shell built in Plan 08 and consume the shared form components (ConfirmByNameDialog, SecretRevealDialog, PasswordInput, FormSummaryAlert).

Purpose: Phase 1's user-visible self-service surface. Any logged-in user can manage their own password, SSH keys, and Personal Access Tokens without admin involvement (AUTH-03, AUTH-04, AUTH-05, API-02).

Output: Three new routes under /profile/*; the SecretRevealDialog show-once pattern is exercised end-to-end for PAT minting; the ConfirmByNameDialog typed-name pattern is exercised for SSH key delete + PAT revoke; copy verbatim from UI-SPEC; ui-checker passes.
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
@.planning/phases/01-foundation/01-05-SUMMARY.md
@.planning/phases/01-foundation/01-08-SUMMARY.md

<interfaces>
<!-- Backend routes available (Plan 05 implemented these). -->

- `POST /api/v1/me/password` → 200 (changes own password)
- `GET|POST|DELETE /api/v1/me/ssh-keys` + `/{id}`
- `GET|POST|DELETE /api/v1/me/tokens` + `/{id}` (POST returns PATMintResponse with `plaintext`)

<!-- Frontend components imported from Plan 08 -->
- `$lib/components/forms/ConfirmByNameDialog.svelte`
- `$lib/components/forms/SecretRevealDialog.svelte`
- `$lib/components/forms/PasswordInput.svelte`
- `$lib/components/forms/FormSummaryAlert.svelte`
- `$lib/api/client.ts` — extend with `api.me.{changePassword, listSshKeys, addSshKey, deleteSshKey, listTokens, mintToken, revokeToken}`

<!-- Types added by this plan to types.ts -->
```ts
export interface SshKey { id: number; name: string; fingerprint: string; created_at: string; }
export interface PATListItem { id: number; name: string; prefix_preview: string; expires_at: string | null; last_used_at: string | null; revoked_at: string | null; created_at: string; }
export interface PATMintResponse extends PATListItem { plaintext: string; }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Profile page (change password + appearance) + extend API client for me.* methods</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-UI-SPEC.md (§Profile pages, §Form Patterns, §Copywriting Contract /profile + change password)
    - /home/dev/vm-deployment-gui/frontend/src/lib/api/client.ts (Plan 08 — extend, do not break existing surface)
    - /home/dev/vm-deployment-gui/frontend/src/lib/components/forms/PasswordInput.svelte (Plan 08)
    - /home/dev/vm-deployment-gui/frontend/src/lib/components/forms/FormSummaryAlert.svelte (Plan 08)
    - /home/dev/vm-deployment-gui/frontend/src/lib/stores/theme.svelte.ts (Plan 03)
  </read_first>
  <files>
    frontend/src/lib/api/me.ts,
    frontend/src/lib/api/client.ts,
    frontend/src/lib/api/types.ts,
    frontend/src/routes/profile/+page.svelte,
    frontend/src/routes/profile/+page.server.ts
  </files>
  <action>
    **api/types.ts** — Extend with `SshKey`, `PATListItem`, `PATMintResponse` types listed in interfaces.

    **api/me.ts** — Extend Plan 08's me.ts with:
    ```ts
    export async function changePassword({current_password, new_password}, opts?) { ... }
    export async function listSshKeys(opts?): Promise<SshKey[]> { ... }
    export async function addSshKey({name, public_key}, opts?): Promise<SshKey> { ... }
    export async function deleteSshKey({id}, opts?): Promise<void> { ... }
    export async function listTokens(opts?): Promise<PATListItem[]> { ... }
    export async function mintToken({name, expires_at}, opts?): Promise<PATMintResponse> { ... }
    export async function revokeToken({id}, opts?): Promise<void> { ... }
    ```

    **api/client.ts** — Re-export the new me.* methods so `api.me.{...}` exposes them. Do NOT change the existing surface from Plan 08 — additive only.

    **routes/profile/+page.svelte** — UI-SPEC §Profile pages. Single column, 720px max content width inside the 1280px shell. Two sections as `<Card>`s:
    1. "Change password" — heading "Change password" (Heading 18/600), body description "Update the password you use to sign in." Form: Current password (PasswordInput), New password (PasswordInput min 12 chars + helper "At least 12 characters"), Confirm new (must match). Submit "Update password" → `api.me.changePassword`. On success: toast "Password updated. Other sessions were signed out." (UI-SPEC mapped via sonner). On 403 "current password incorrect" → inline error on Current password field.
    2. "Appearance" — heading "Appearance", body "Theme follows your system unless you set a preference.". Inline ThemeToggle (3-button group, not dropdown — for inline UX a `Tabs`-like row works: Light / Dark / System). Toggling calls `theme.setMode`.

    **routes/profile/+page.server.ts** — Load returns current user from `event.locals.user` (no extra fetch needed).
  </action>
  <verify>
    <automated>cd frontend && pnpm run check && pnpm run build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `test -f frontend/src/routes/profile/+page.svelte`
    - `grep -q 'Update password' frontend/src/routes/profile/+page.svelte`
    - `grep -q 'Password updated. Other sessions were signed out' frontend/src/routes/profile/+page.svelte` (UI-SPEC verbatim)
    - `grep -q 'Appearance' frontend/src/routes/profile/+page.svelte`
    - `grep -q 'changePassword' frontend/src/lib/api/me.ts`
    - `grep -q 'listSshKeys\|addSshKey\|deleteSshKey' frontend/src/lib/api/me.ts`
    - `grep -q 'listTokens\|mintToken\|revokeToken' frontend/src/lib/api/me.ts`
    - `grep -q 'PATMintResponse\|PATListItem\|SshKey' frontend/src/lib/api/types.ts`
    - `cd frontend && pnpm run check` exits 0
    - `cd frontend && pnpm run build` exits 0
  </acceptance_criteria>
  <done>Profile change-password + appearance page ships; API client extended additively; copy verbatim; checks + build green.</done>
</task>

<task type="auto">
  <name>Task 2: SSH keys + PAT tokens pages</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-UI-SPEC.md (§Profile pages SSH keys + Tokens sections, §Token / secret display, §Destructive confirmations, §Form Patterns)
    - /home/dev/vm-deployment-gui/frontend/src/lib/components/forms/ConfirmByNameDialog.svelte (Plan 08)
    - /home/dev/vm-deployment-gui/frontend/src/lib/components/forms/SecretRevealDialog.svelte (Plan 08)
    - /home/dev/vm-deployment-gui/frontend/src/lib/api/client.ts (extended in Task 1)
  </read_first>
  <files>
    frontend/src/lib/api/ssh-keys.ts,
    frontend/src/lib/api/tokens.ts,
    frontend/src/routes/profile/ssh-keys/+page.svelte,
    frontend/src/routes/profile/ssh-keys/+page.server.ts,
    frontend/src/routes/profile/tokens/+page.svelte,
    frontend/src/routes/profile/tokens/+page.server.ts
  </files>
  <action>
    **api/ssh-keys.ts + api/tokens.ts** — Optional thin re-exports of the me.* methods for callers that prefer domain-named modules. Not required; Plan 08's `api.me.{...}` is the canonical surface. If executor prefers, these can be one-line re-exports.

    **routes/profile/ssh-keys/+page.svelte** — UI-SPEC §Profile pages. Single Card "SSH keys" with body "Public keys you can attach when creating VMs and containers." (UI-SPEC copy). Content:
    - List of keys (`<ul>`): each row shows name (medium 500), monospace 13px fingerprint (`SHA256:...`), created_at relative ("3 days ago"), and a `MoreHorizontal` row-action dropdown → "Delete".
    - Empty state: "No SSH keys yet — Add a public key to enable per-VM SSH access (used in Phase 4)." (UI-SPEC copy verbatim).
    - "Add SSH key" button (top-right of the card) → opens `<Dialog>` with form: Name (required), Public key (textarea, parses on submit). On submit: `api.me.addSshKey`. On 422 inline error "That doesn't look like an SSH public key. Paste the contents of a `.pub` file." (UI-SPEC copy). On success: close dialog, refresh list, toast "Key added.".
    - Delete: open `ConfirmByNameDialog` (from Plan 08) with `targetName=key.name`, heading "Delete '{key.name}'?", body "This key is removed from your account. Existing VMs that already have this key keep it." (UI-SPEC copy), confirmLabel "Delete key", onConfirm calls `api.me.deleteSshKey({id})`.

    **routes/profile/ssh-keys/+page.server.ts** — `load`: `api.me.listSshKeys({fetch: event.fetch})` → `{ keys: SshKey[] }`.

    **routes/profile/tokens/+page.svelte** — UI-SPEC §Profile pages + §Token / secret display. Card "Personal Access Tokens" body "Authenticate the REST API with the same permissions as your account." (verbatim). Content:
    - List of tokens: name, prefix_preview (monospace), expires_at relative ("never" if null), last_used_at relative, status badge (active / revoked / expired). Row action dropdown → "Revoke".
    - Empty state: "No tokens yet — Create a Personal Access Token to use the REST API." (UI-SPEC).
    - "Create token" button → Dialog with form: Name, Expires at (date input, optional). Submit → `api.me.mintToken`. On success: receive `PATMintResponse` (with `plaintext`). Open the `SecretRevealDialog` (from Plan 08) bound to `plaintext` and `label="Save this token now." body="You won't see it again. Store it somewhere safe."` (verbatim copy). After dismissal, the form dialog closes too. Refresh list.
    - Revoke: open `ConfirmByNameDialog` (from Plan 08) with `targetName=token.name`, heading "Revoke '{token.name}'?", body "Any application using this token loses access immediately. This can't be undone." (UI-SPEC copy), confirmLabel "Revoke token", onConfirm calls `api.me.revokeToken({id})`.

    **routes/profile/tokens/+page.server.ts** — Load: `api.me.listTokens(...)`.

    **Cross-cutting UI consistency checks (executor must verify):**
    - Every page heading uses Display 28/600 per UI-SPEC §Typography.
    - Every Card heading uses Heading 18/600.
    - Body copy is 14/400.
    - No raw error messages — all map through UI-SPEC §Error state copy table.
    - Every destructive action goes through ConfirmByNameDialog.
    - PAT mint goes through SecretRevealDialog.
    - No inline hex colors — every color reference is via CSS variables.
    - Lucide icons are limited to the UI-SPEC allow-list.
  </action>
  <verify>
    <automated>cd frontend && pnpm run check && pnpm run build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `test -f frontend/src/routes/profile/ssh-keys/+page.svelte && test -f frontend/src/routes/profile/tokens/+page.svelte`
    - `grep -q 'Public keys you can attach when creating VMs and containers' frontend/src/routes/profile/ssh-keys/+page.svelte` (UI-SPEC verbatim)
    - `grep -q 'Authenticate the REST API with the same permissions as your account' frontend/src/routes/profile/tokens/+page.svelte` (UI-SPEC verbatim)
    - `grep -q "won.t see it again\|won't see it again" frontend/src/routes/profile/tokens/+page.svelte` (show-once verbatim)
    - `grep -q 'ConfirmByNameDialog' frontend/src/routes/profile/ssh-keys/+page.svelte`
    - `grep -q 'ConfirmByNameDialog' frontend/src/routes/profile/tokens/+page.svelte`
    - `grep -q 'SecretRevealDialog' frontend/src/routes/profile/tokens/+page.svelte`
    - `grep -q 'Add SSH key' frontend/src/routes/profile/ssh-keys/+page.svelte`
    - `grep -q 'Create token' frontend/src/routes/profile/tokens/+page.svelte`
    - `cd frontend && pnpm run check` exits 0
    - `cd frontend && pnpm run build` exits 0
  </acceptance_criteria>
  <done>SSH keys + PAT tokens pages ship; destructive + show-once patterns enforced via Plan 08 components; copy verbatim from UI-SPEC.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → API /me/* | Self-only routes; backend enforces principal == self (Plan 05) |
| PAT plaintext in dialog | Memory-only; cleared on dismiss; never localStorage |
| SSH public key paste | Treated as untrusted input; parsed on backend (Plan 05) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-09-01 | Information disclosure | PAT plaintext persisted accidentally | mitigate | SecretRevealDialog clears the bound prop on dismiss; never written to localStorage. List page shows prefix_preview only. Inherits Plan 08's threat T-01-08-04. |
| T-01-09-02 | Repudiation | User changes password but later denies it | mitigate | Backend audit log (Phase 2) records who-changed-what. Plan 05 already revokes other sessions on password change → on next access the user must re-authenticate (server-side enforcement; UI just surfaces the toast). |
| T-01-09-03 | Tampering | SSH public key XSS via raw render | mitigate | Public key rendered inside `<code>` with text content only (no innerHTML); Svelte escapes by default. Fingerprint comes from backend (parsed, not user-supplied). |
| T-01-09-04 | Repudiation | PAT revoked but stale local list shows it as active | mitigate | After revoke, refresh list (`api.me.listTokens`) before closing dialog; status badge reflects server-side `revoked_at`. Backend enforces revocation immediately (Plan 05). |
| T-01-09-05 | Tampering | Destructive delete-key without typed-name confirm | mitigate | All destructive actions route through ConfirmByNameDialog (Plan 08); typed-name comparison case-sensitive. |
| T-01-09-06 | Information disclosure | PAT plaintext copied to clipboard, clipboard persists | accept | OS-level clipboard behavior; documented in show-once banner copy. Browser clipboard isolation per-origin mitigates cross-site leak. |
| T-01-09-07 | Tampering | XSS-injected toast message via API error body | mitigate | Toast uses Svelte text interpolation (escaped). Error mapping table in UI-SPEC §Error state copy normalizes API errors to known strings before display. |

ASVS L1 mappings:
- V2.7 (password change requires current password) → form requires Current + New + Confirm; backend (Plan 05) verifies old password
- V3.5 (session termination on credential change) → backend (Plan 05) revokes other sessions; UI surfaces "Other sessions were signed out."
- V8.1 (sensitive UI state) → PAT plaintext memory-only; cleared on dismiss
- V14.3 (UX security) → typed-name destructive confirms; show-once secret reveal
</threat_model>

<verification>
- Task 1 + Task 2 acceptance criteria pass (`pnpm run check`, `pnpm run build`)
- Plan 10 can register a cluster + create a user without account pages blocking it
</verification>

<success_criteria>
A logged-in user can:
1. Visit /profile, change their password, see the toast confirming other sessions were signed out.
2. Visit /profile/ssh-keys, add an SSH public key (paste from `.pub` file), see fingerprint, delete with typed-name confirm.
3. Visit /profile/tokens, mint a Personal Access Token, see the show-once dialog with the plaintext, copy it to clipboard, dismiss; see only the prefix_preview in the list afterwards; revoke with typed-name confirm.

The three Plan 08 form components (ConfirmByNameDialog, SecretRevealDialog, PasswordInput, FormSummaryAlert) are exercised end-to-end.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-09-SUMMARY.md` documenting:
- Routes implemented (3: /profile, /profile/ssh-keys, /profile/tokens)
- API client extensions (changePassword, listSshKeys, addSshKey, deleteSshKey, listTokens, mintToken, revokeToken)
- UI-SPEC compliance audit for the surfaces in scope
- Any deviations from verbatim copy (none expected)
- Phase 2 follow-ups (last-login timestamp on PAT list; admin-side PAT visibility — currently self-only)
</output>
