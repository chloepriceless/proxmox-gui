---
phase: 01-foundation
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/package.json
  - frontend/pnpm-lock.yaml
  - frontend/svelte.config.js
  - frontend/vite.config.ts
  - frontend/tsconfig.json
  - frontend/tailwind.config.ts
  - frontend/postcss.config.js
  - frontend/components.json
  - frontend/.eslintrc.json
  - frontend/.prettierrc
  - frontend/src/app.html
  - frontend/src/app.css
  - frontend/src/app.d.ts
  - frontend/src/lib/components/ui/.gitkeep
  - frontend/src/lib/components/layout/AppShell.svelte
  - frontend/src/lib/components/layout/Sidebar.svelte
  - frontend/src/lib/components/layout/Topbar.svelte
  - frontend/src/lib/components/layout/ThemeToggle.svelte
  - frontend/src/lib/stores/theme.svelte.ts
  - frontend/src/lib/stores/user.svelte.ts
  - frontend/src/lib/utils/cn.ts
  - frontend/src/lib/utils/csrf.ts
  - frontend/src/lib/utils/api.ts
  - frontend/src/lib/assets/fonts/.gitkeep
  - frontend/src/routes/+layout.svelte
  - frontend/src/routes/+layout.server.ts
  - frontend/src/routes/+page.svelte
  - frontend/src/routes/+page.server.ts
  - frontend/src/hooks.server.ts
  - frontend/.env.example
  - frontend/.gitignore
  - frontend/tests/sanity.test.ts
autonomous: true
requirements:
  - UI-01
  - UI-02
  - API-01
  - API-03
user_setup: []
tags:
  - frontend
  - sveltekit
  - tailwind
  - shadcn-svelte
must_haves:
  truths:
    - "SvelteKit dev server starts via `pnpm dev` and serves the root route"
    - "shadcn-svelte components are initialized in `src/lib/components/ui/` with base color slate"
    - "Tailwind v4 is configured with `class` strategy on `<html>` for dark mode"
    - "Light/dark theme toggles via `theme.svelte.ts` store, persists to localStorage, hydrates without FOUC"
    - "Inter Variable font is self-hosted, no external CDN fetch on page load"
    - "App shell (sidebar + topbar) renders at `/` with the layout dimensions from UI-SPEC"
    - "`pnpm build` produces a production bundle to `build/`"
  artifacts:
    - path: "frontend/package.json"
      provides: "SvelteKit 2 + Svelte 5 + Tailwind v4 + shadcn-svelte deps"
      contains: '"@sveltejs/kit"'
    - path: "frontend/src/app.html"
      provides: "HTML shell with FOUC-mitigation theme script"
      contains: "localStorage.getItem('theme')"
    - path: "frontend/src/app.css"
      provides: "Tailwind v4 @import + CSS custom-properties for slate theme + @font-face Inter"
      contains: "@import 'tailwindcss'"
    - path: "frontend/src/lib/components/layout/AppShell.svelte"
      provides: "Sidebar + Topbar + content outlet"
      contains: "Sidebar"
    - path: "frontend/src/lib/stores/theme.svelte.ts"
      provides: "Theme store using $state rune"
      exports: ["theme"]
    - path: "frontend/components.json"
      provides: "shadcn-svelte config"
      contains: "slate"
  key_links:
    - from: "frontend/src/routes/+layout.svelte"
      to: "frontend/src/lib/components/layout/AppShell.svelte"
      via: "wraps {@render children()} in AppShell"
      pattern: "AppShell"
    - from: "frontend/src/app.html"
      to: "browser localStorage"
      via: "inline theme script before stylesheet to prevent FOUC"
      pattern: "localStorage"
    - from: "frontend/src/lib/utils/api.ts"
      to: "backend FastAPI"
      via: "fetch wrapper that injects X-CSRF-Token from cookie"
      pattern: "X-CSRF-Token"
---

<objective>
Initialize the SvelteKit 2 + Svelte 5 + Tailwind v4 + shadcn-svelte frontend with the exact configuration from UI-SPEC.md, the Hetzner-style app shell skeleton (sidebar + topbar + content outlet), the theme store implementing the tri-state Light/Dark/System contract, the CSRF + auth fetch wrapper, the root layout's auth gate (placeholder — Plan 08 wires real auth probe), and the slate theme color tokens. Inter Variable self-hosted. shadcn-svelte init with the locked CLI invocation. The blocks list from UI-SPEC.md added.

Purpose: Plan 08 will implement every Phase 1 screen (login, setup, profile, admin) by composing components from `$lib/components/ui/` and pages inside the shell built here. Every UI-SPEC dimension lock (spacing scale, typography, color, layout) is encoded here so Plan 08 only writes feature code.

Output: `pnpm dev` shows the empty app shell at `/`; theme toggle works; UI-SPEC's slate palette renders correctly in both light and dark modes.
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-RESEARCH.md
@.planning/phases/01-foundation/01-UI-SPEC.md
@.planning/research/STACK.md
@CLAUDE.md

<interfaces>
<!-- The shape Plan 08 (frontend UI implementation) will consume. -->

```typescript
// frontend/src/lib/stores/theme.svelte.ts
type ThemeMode = 'light' | 'dark' | 'system';
class ThemeStore {
  mode: ThemeMode = $state('system');
  effective: 'light' | 'dark' = $derived(...);  // resolves "system" via matchMedia
  init(): void;        // called once in +layout.svelte onMount
  setMode(m: ThemeMode): void;  // persists to localStorage and toggles <html class>
}
export const theme: ThemeStore;
```

```typescript
// frontend/src/lib/stores/user.svelte.ts
// Placeholder shape — Plan 08 wires the actual /api/v1/me probe
type CurrentUser = { id: number; username: string; email: string; is_admin: boolean; } | null;
class UserStore {
  current: CurrentUser = $state(null);
  set(u: CurrentUser): void;
}
export const user: UserStore;
```

```typescript
// frontend/src/lib/utils/api.ts
// Single fetch wrapper that:
//   - prefixes /api/v1 to relative paths
//   - reads csrf_token cookie and sends X-CSRF-Token header on state-changing methods
//   - throws on 4xx/5xx with parsed JSON error
export async function apiFetch(path: string, init?: RequestInit): Promise<Response>;
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T>;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Initialize SvelteKit + Tailwind v4 + shadcn-svelte project, add UI blocks</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-UI-SPEC.md (entire file — design system, spacing, typography, color contract)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (§Frontend stack, §Pattern 10)
  </read_first>
  <files>
    frontend/package.json,
    frontend/pnpm-lock.yaml,
    frontend/svelte.config.js,
    frontend/vite.config.ts,
    frontend/tsconfig.json,
    frontend/tailwind.config.ts,
    frontend/postcss.config.js,
    frontend/components.json,
    frontend/.eslintrc.json,
    frontend/.prettierrc,
    frontend/.gitignore,
    frontend/.env.example,
    frontend/src/app.html,
    frontend/src/app.css,
    frontend/src/app.d.ts,
    frontend/src/lib/components/ui/.gitkeep,
    frontend/src/lib/assets/fonts/.gitkeep
  </files>
  <action>
    1. **Scaffold SvelteKit:** Run `pnpm dlx sv create frontend --template skeleton --types ts --no-add-ons` (or equivalent non-interactive form). If `sv create` insists on interactive prompts, hand-author the skeleton: `frontend/package.json`, `frontend/svelte.config.js`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/src/app.html`, `frontend/src/app.d.ts`, `frontend/src/routes/+page.svelte` minimal stubs.

    2. **package.json:** Set `"name": "proxmox-gui-frontend"`, `"version": "0.1.0"`, `"private": true`, `"type": "module"`. Dependencies per 01-RESEARCH.md §Frontend (pinned): `@sveltejs/kit ^2.59.1`, `@sveltejs/adapter-node ^5.5.4`, `svelte ^5.55.5`, `@tanstack/svelte-query ^6.1.29`, `bits-ui ^2.18.1`, `lucide-svelte ^1.0.1`, `tailwindcss ^4.3.0`, `zod ^4.4.3`, `clsx ^2.1.1`, `tailwind-merge ^2.5.4`. devDependencies: `@hey-api/openapi-ts ^0.97.1`, `vitest ^2.1.0`, `@types/node`, `typescript ^5.6.0`, `prettier ^3.4.0`, `prettier-plugin-svelte ^3.3.0`, `eslint ^9.16.0`, `eslint-plugin-svelte`. Scripts: `dev = "vite dev"`, `build = "vite build"`, `preview = "vite preview"`, `check = "svelte-check --tsconfig ./tsconfig.json"`, `test = "vitest run"`, `format = "prettier --write ."`, `lint = "eslint ."`.

    3. **svelte.config.js:** Use `@sveltejs/adapter-node`. Set `kit.alias = { '$lib': './src/lib' }`. Enable `kit.csrf = { checkOrigin: false }` because Caddy is the trust boundary; we use a custom CSRF cookie pattern (D-13). Document in a comment that the API-side CSRF check is authoritative.

    4. **vite.config.ts:** Standard SvelteKit + Tailwind v4 vite plugin (`@tailwindcss/vite`). Add dev server proxy: `server.proxy = { '/api': 'http://127.0.0.1:8000' }` so `pnpm dev` against a running backend (Plan 01) works without CORS.

    5. **tsconfig.json:** Standard SvelteKit-generated with `"strict": true`, `"moduleResolution": "bundler"`, `"target": "ES2022"`.

    6. **tailwind.config.ts:** Tailwind v4 uses CSS-first config; minimal `tailwind.config.ts` only sets `darkMode: 'class'` and `content: ['./src/**/*.{html,svelte,ts}']`. Most config lives in `app.css` via `@theme` directive.

    7. **postcss.config.js:** Empty (Tailwind v4 + vite plugin handle PostCSS).

    8. **Initialize shadcn-svelte:** Create `components.json` with the exact config from UI-SPEC.md §Design System:
       ```json
       {
         "$schema": "https://shadcn-svelte.com/schema.json",
         "style": "default",
         "tailwind": {
           "config": "tailwind.config.ts",
           "css": "src/app.css",
           "baseColor": "slate"
         },
         "aliases": {
           "components": "$lib/components",
           "utils": "$lib/utils",
           "ui": "$lib/components/ui",
           "lib": "$lib"
         },
         "typescript": true,
         "registry": "https://shadcn-svelte.com/registry"
       }
       ```

    9. **Add UI components** per UI-SPEC.md "Blocks/components to add in Phase 1": run
       ```
       cd frontend && pnpm dlx shadcn-svelte@latest add \
         button input label textarea checkbox switch select \
         card separator badge alert \
         dialog alert-dialog dropdown-menu sheet \
         form sonner table data-table tabs tooltip
       ```
       Components copied to `src/lib/components/ui/`. Commit them as part of this plan.

    10. **app.html:** Per UI-SPEC §Theme Toggle Contract. Include the inline FOUC-mitigation `<script>` BEFORE the stylesheet link:
        ```html
        <!DOCTYPE html>
        <html lang="en" %sveltekit.theme%>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="%sveltekit.assets%/favicon.svg" />
            <script>
              (function () {
                var t = localStorage.getItem('theme');
                var d = t === 'dark' || ((!t || t === 'system') &&
                  window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (d) document.documentElement.classList.add('dark');
              })();
            </script>
            %sveltekit.head%
          </head>
          <body data-sveltekit-preload-data="hover">
            <div style="display: contents">%sveltekit.body%</div>
          </body>
        </html>
        ```

    11. **app.css:** Tailwind v4 CSS-first config + Inter Variable @font-face + the slate theme tokens from UI-SPEC §Color (light + dark mode). Use `@theme` block to declare `--font-sans`, `--font-mono`, custom color tokens. Use `@layer base` for `:root` + `.dark` selectors carrying `--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--destructive`, `--success`, `--warning`, plus their `-foreground` siblings — EXACT HSL values from UI-SPEC tables. Add `@import 'tailwindcss';` at the top. Add `@font-face` block pointing at `/src/lib/assets/fonts/Inter-Variable.woff2` (the actual woff2 file is sourced in Task 2; here we just write the @font-face). Apply `font-family: var(--font-sans)` to `html` in `@layer base`.

    12. **app.d.ts:** Standard SvelteKit App namespace. Add `interface Locals { user: { id: number; username: string; is_admin: boolean } | null }` for the auth gate Plan 08 wires.

    13. **.eslintrc.json + .prettierrc:** Standard configs for Svelte+TS. Prettier config: `singleQuote: true`, `trailingComma: 'none'`, `printWidth: 100`, `plugins: ['prettier-plugin-svelte']`.

    14. **.gitignore:** node_modules, .svelte-kit/, build/, .env, .DS_Store.

    15. **.env.example:** `# PUBLIC_API_BASE not needed — single origin; reverse proxy routes /api/* to FastAPI`.

    Use **pnpm** as the package manager (locked here to satisfy `pnpm-lock.yaml`).
  </action>
  <verify>
    <automated>cd frontend && pnpm install --frozen-lockfile && pnpm run check 2>&1 | tail -20 && test -d src/lib/components/ui && ls src/lib/components/ui | head && grep -q '"baseColor": "slate"' components.json && grep -q "@import 'tailwindcss'" src/app.css</automated>
  </verify>
  <acceptance_criteria>
    - `test -f frontend/package.json && test -f frontend/svelte.config.js && test -f frontend/components.json`
    - `grep -q '"@sveltejs/kit"' frontend/package.json`
    - `grep -q '"tailwindcss": "\^4' frontend/package.json`
    - `grep -q '"baseColor": "slate"' frontend/components.json`
    - `test -d frontend/src/lib/components/ui && test "$(ls frontend/src/lib/components/ui | wc -l)" -ge 15` (at least 15 component dirs/files from the add command)
    - `grep -q "localStorage.getItem('theme')" frontend/src/app.html`
    - `grep -q '@font-face' frontend/src/app.css`
    - `grep -q '\--primary: 217 91% 60%' frontend/src/app.css` (light mode primary HSL from UI-SPEC)
    - `grep -q '\--primary: 217 91% 65%' frontend/src/app.css` (dark mode primary HSL)
    - `cd frontend && pnpm run check` exits 0
  </acceptance_criteria>
  <done>SvelteKit + Tailwind v4 + shadcn-svelte project initialized; component library copied in; Inter Variable @font-face declared; light/dark slate tokens in app.css matching UI-SPEC exactly.</done>
</task>

<task type="auto">
  <name>Task 2: App shell, theme store, layout components, root layout, utility helpers, sanity tests</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-UI-SPEC.md (§Layout Contracts, §Theme Toggle Contract, §Sidebar contract, §Topbar contract)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (§Pattern 10)
    - /home/dev/vm-deployment-gui/frontend/components.json (created in Task 1)
  </read_first>
  <files>
    frontend/src/lib/stores/theme.svelte.ts,
    frontend/src/lib/stores/user.svelte.ts,
    frontend/src/lib/utils/cn.ts,
    frontend/src/lib/utils/csrf.ts,
    frontend/src/lib/utils/api.ts,
    frontend/src/lib/components/layout/AppShell.svelte,
    frontend/src/lib/components/layout/Sidebar.svelte,
    frontend/src/lib/components/layout/Topbar.svelte,
    frontend/src/lib/components/layout/ThemeToggle.svelte,
    frontend/src/routes/+layout.svelte,
    frontend/src/routes/+layout.server.ts,
    frontend/src/routes/+page.svelte,
    frontend/src/routes/+page.server.ts,
    frontend/src/hooks.server.ts,
    frontend/tests/sanity.test.ts
  </files>
  <action>
    **theme.svelte.ts:** Implement Svelte 5 class using runes per the interface above. `mode: ThemeMode = $state('system')` (localStorage value or default). `effective = $derived(this.mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : this.mode)`. `init()` reads localStorage and sets mode (no-op on server — guard with `typeof window === 'undefined'`). `setMode(m)` updates `this.mode`, writes localStorage (`'system'` deletes the key per UI-SPEC), and applies/removes `dark` class on `document.documentElement`. Export `theme = new ThemeStore()`.

    **user.svelte.ts:** Minimal `$state` store carrying `current: CurrentUser`. Methods `set(u)` and `clear()`. Plan 08 hydrates from `/api/v1/me` via `+layout.server.ts`.

    **cn.ts:** `export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }` — standard shadcn pattern using `clsx` + `tailwind-merge`.

    **csrf.ts:** `export function readCsrfCookie(): string | null` that parses `document.cookie` and returns the value of the `csrf_token` cookie (or `null` on server / cookie absent).

    **api.ts:** Implement `apiFetch(path, init)` that:
    - Prefixes `/api/v1` to `path` if it starts with `/` and doesn't already start with `/api`.
    - For state-changing methods (POST/PUT/PATCH/DELETE), reads `csrf_token` cookie and sets `X-CSRF-Token` header.
    - Sets `Content-Type: application/json` only when `init.body` is a string.
    - Sets `credentials: 'same-origin'` (cookies forwarded on same-origin requests by default in modern browsers; explicit is safer).
    - Does NOT throw on non-2xx — returns the Response. (Plan 08's `apiJson` wrapper handles error parsing.)
    Also `apiJson<T>(path, init)` that calls `apiFetch`, throws an `ApiError` on non-2xx with the parsed JSON body, and returns `await res.json()` on success.

    **Sidebar.svelte:** Per UI-SPEC §Sidebar contract. Two sections:
    - "Account" (visible always): items — Profile (`/profile`), SSH keys (`/profile/ssh-keys`), API tokens (`/profile/tokens`), then a separator and a link to "API docs" with `ExternalLink` icon → `/api/docs` (target=_blank).
    - "Admin" (visible only when `user?.is_admin`): items — Users (`/admin/users`), Clusters (`/admin/clusters`).
    Section headers: 11px / 600 / `text-muted-foreground` / uppercase / `tracking-wider`. Nav item: `h-9 px-3 gap-2 flex items-center text-[13px] font-medium`. Active item: `bg-muted` + 3px left-edge `bg-primary` bar + primary-colored icon. Use `$page.url.pathname.startsWith(item.href)` for active detection. Width: `w-60` (240px) expanded; collapses to `w-14` at `<lg` (1024px) viewport via Tailwind `lg:w-60` responsive variant. Use lucide icons from the UI-SPEC allow-list: `User`, `KeyRound`, `Key`, `ExternalLink`, `Users`, `Server`. Accepts `user` prop (the `CurrentUser` object from `+layout.server.ts`).

    **Topbar.svelte:** Per UI-SPEC §Topbar contract. `h-14` (56px). Left: 24×24 SVG logo placeholder (inline `<svg viewBox="0 0 24 24">` with a simple geometric mark — Claude's discretion) + "Proxmox GUI" `text-lg font-semibold`. Center: disabled `<Select>` with placeholder "All clusters" and `Tooltip` "Switch clusters in Phase 2" — use shadcn `select` + `tooltip` components. Right: `ThemeToggle` + `UserMenu` (dropdown). The `UserMenu` is a `DropdownMenu` triggered by a 28×28 circle with the user's initials (or "?" when `user` is null). Items: "Profile", "SSH keys", "API tokens", separator, "Log out". "Log out" calls `apiFetch('/auth/logout', { method: 'POST' })` then `goto('/login')` — Plan 08 wires the actual endpoint; in this plan it's a stub. Bottom border: `border-b border-border`.

    **ThemeToggle.svelte:** Per UI-SPEC. `DropdownMenu` with three items: Light (`Sun` icon), Dark (`Moon` icon), System (`Monitor` icon). Each item calls `theme.setMode('light' | 'dark' | 'system')`. Trigger button: `h-9 w-9` showing whichever icon matches `theme.mode` (or `Monitor` for system).

    **AppShell.svelte:** Per UI-SPEC §App shell layout. Vertical structure: Topbar (56px) + horizontal flex with Sidebar (240px / 56px collapsed) + main content area. Main: `max-w-screen-xl mx-auto px-6 py-8` (UI-SPEC: page padding `lg` left/right = 24px, `xl` vertical = 32px). Accepts `user` prop and passes it to Sidebar + Topbar. Renders `{@render children()}` inside the main content area.

    **routes/+layout.svelte:** Imports `'../app.css'`, calls `theme.init()` in `onMount`, wraps `{@render children()}` in `<AppShell {user}>` where `user` comes from `data` prop. For unauth routes (`/login`, `/setup`), Plan 08 will conditionally render WITHOUT the AppShell — here, render the AppShell only when `data.user != null`; otherwise render `{@render children()}` bare.

    **routes/+layout.server.ts:** Placeholder loader returning `{ user: null, setupNeeded: false }`. Plan 08 implements the real `/api/v1/me` + `/api/v1/setup/status` calls. For now, attempt `event.fetch('/api/v1/health')` and if it returns 200, return `{ user: null, setupNeeded: false, apiReachable: true }`; else `{ user: null, setupNeeded: false, apiReachable: false }`. Tolerate the absence of the backend in pure-frontend dev. **STUB NOTE:** `frontend/src/routes/+layout.server.ts: ships placeholder load() returning { user: null, setupNeeded: false, apiReachable: bool } — Plan 08 (frontend-auth-shell) replaces with real /api/v1/me probe + /api/v1/setup/status redirect`. Add an inline TODO comment in the file: `// TODO(01-08): replace with real auth probe`.

    **routes/+page.svelte:** Empty dashboard placeholder. Heading "Dashboard" (Display 28/600 per UI-SPEC) + Body 14/400 muted text "VM and LXC inventory lands in Phase 2." Centered inside the content outlet. This is the only route this plan implements; Plan 08 adds the rest.

    **routes/+page.server.ts:** Empty `load` function (or omit if not needed).

    **hooks.server.ts:** Empty `handle` for now — Plan 08 may add auth gating here. Include a stub with `export const handle: Handle = async ({ event, resolve }) => resolve(event);`.

    **tests/sanity.test.ts:** Vitest test importing `cn` from `$lib/utils/cn.ts` and asserting `cn('foo', { bar: true }) === 'foo bar'`. Smoke test only — confirms test runner works.
  </action>
  <verify>
    <automated>cd frontend && pnpm run check && pnpm run test 2>&1 | tail -10 && pnpm run build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `test -f frontend/src/lib/components/layout/AppShell.svelte`
    - `test -f frontend/src/lib/components/layout/Sidebar.svelte`
    - `test -f frontend/src/lib/components/layout/Topbar.svelte`
    - `test -f frontend/src/lib/components/layout/ThemeToggle.svelte`
    - `test -f frontend/src/lib/stores/theme.svelte.ts`
    - `grep -q "\$state\(" frontend/src/lib/stores/theme.svelte.ts` (Svelte 5 runes)
    - `grep -q 'X-CSRF-Token' frontend/src/lib/utils/api.ts`
    - `grep -q 'classList.toggle' frontend/src/lib/stores/theme.svelte.ts`
    - `cd frontend && pnpm run check` exits 0
    - `cd frontend && pnpm run build` exits 0 (produces `build/` directory)
    - `cd frontend && pnpm run test` exits 0 (sanity test green)
  </acceptance_criteria>
  <done>App shell renders, theme toggle works in both modes, build succeeds, sanity tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → API | Cookies attached automatically; `X-CSRF-Token` must come from JS-readable cookie (D-13) |
| SvelteKit SSR → API | `event.fetch` forwards cookies on same-origin |
| Browser localStorage | Theme preference only; no secrets stored client-side |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-03-01 | Information disclosure | localStorage holding auth token | mitigate | D-09 forbids it; only `theme` key is allowed. `user.svelte.ts` keeps state in memory, never localStorage. Code review enforces. |
| T-01-03-02 | Tampering | CSRF token bypass via JS-readable cookie | accept (design) | D-13: double-submit pattern. Cookie is JS-readable BY DESIGN (the SvelteKit code reads it and echoes it). Authority is server-side comparison; an attacker without `same-origin` JS cannot forge the cookie due to browser cookie isolation. |
| T-01-03-03 | Spoofing | XSS injects `X-CSRF-Token` for impersonation | mitigate | Mitigation lives in Phase 5 + ongoing: Content-Security-Policy via Caddy (Plan 04); httpOnly access JWT means stolen XSS cannot exfiltrate session; CSRF still requires same-origin browsing context. |
| T-01-03-04 | Information disclosure | Inline `<script>` in app.html (CSP issue) | accept (FOUC tradeoff) | UI-SPEC explicitly allows this one inline script to prevent FOUC on dark mode. Caddy CSP (Plan 04) will allow inline scripts ONLY via nonce or `unsafe-inline` strictly scoped. Documented as a known exception. |
| T-01-03-05 | Tampering | Theme store applies arbitrary class | mitigate | `setMode` only accepts `'light' | 'dark' | 'system'`; TypeScript narrows; runtime guard rejects others. |
| T-01-03-06 | Information disclosure | Inter Variable fetched from CDN leaks IP | mitigate | UI-SPEC mandates self-hosted woff2 under `src/lib/assets/fonts/`. @font-face points at the bundled file, not Google Fonts. The actual woff2 binary fetch is documented as a Task 1 follow-up (executor downloads from rsms.me/inter/files/Inter-roman.var.woff2 and commits it). |
| T-01-03-07 | Denial of service | Long-running SSR fetch on `/api/v1/health` | accept | 1 lightweight call; backend route returns immediately. Plan 08 may add a timeout. |

**ASVS L1 mappings:**
- V14.4 (HTTP security headers) → Set in Caddy (Plan 04) — `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (allowed since iframe-noVNC is Phase 4 and same-origin).
- V14.5 (CSP) → Plan 04 / Phase 5 polish. Phase 1 ships without CSP; documented gap.
- V13.3 (REST input validation) → zod schemas in form components — defaults locked in Plan 08.
</threat_model>

<verification>
- `cd frontend && pnpm run check` exits 0 (svelte-check + tsc strict mode)
- `cd frontend && pnpm run build` exits 0 (adapter-node produces a `build/` directory)
- `cd frontend && pnpm run test` exits 0
- Manual eyeball after wave: visit `/` with backend running, see "Dashboard" heading inside the sidebar + topbar shell, toggle theme works.
</verification>

<success_criteria>
A Plan 08 executor can `import { Button } from '$lib/components/ui/button'`, `import { theme } from '$lib/stores/theme.svelte'`, `import { apiJson } from '$lib/utils/api'`, `import AppShell from '$lib/components/layout/AppShell.svelte'` and compose new pages without touching configuration. The slate theme + Inter Variable + Tailwind v4 + shadcn-svelte stack is locked exactly to UI-SPEC. Light/dark toggling works.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-03-SUMMARY.md` listing:
- shadcn-svelte components actually added
- Any deviations from UI-SPEC (none expected — flag if any)
- Inter Variable acquisition method (downloaded / vendored from rsms.me)
- Build size + bundle stats from `pnpm run build`
- Outstanding TODOs that Plan 08 will resolve (the auth-probe in +layout.server.ts is the main one)
</output>
