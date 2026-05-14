---
phase: 01-foundation
plan: 03
subsystem: ui
tags:
  - sveltekit
  - svelte5
  - tailwind-v4
  - shadcn-svelte
  - bits-ui
  - lucide
  - inter-variable
  - csrf-double-submit
  - theme-store
requires:
  - phase: 01-foundation
    provides: "Plan 01-01 OpenAPI shell at /api/v1/* (the /api/v1/health endpoint is what +layout.server.ts probes for apiReachable; the future /api/v1/me + /api/v1/setup/status endpoints are where Plan 08 lands the real load function)"
provides:
  - "Frontend project tree under frontend/ with SvelteKit 2 + Svelte 5 + Tailwind v4 + shadcn-svelte primitives copied in"
  - "Hetzner-style app shell (Topbar 56px + Sidebar 240/56px + main outlet) wired to the slate palette tokens from UI-SPEC"
  - "ThemeStore (tri-state Light/Dark/System) with SSR-safe init, localStorage persistence, and inline FOUC script in app.html"
  - "apiFetch + apiJson with double-submit CSRF (D-13) header injection on state-changing methods"
  - "+layout.server.ts STUB returning { user, setupNeeded, apiReachable } with an explicit TODO(01-08) comment marking the replacement point"
  - "Inter Variable self-hosted woff2 (352KB) bundled into the production output — air-gap compatible"
  - "$lib/components/ui/ populated with 20 shadcn-svelte primitives compiling clean under svelte-check strict"
affects:
  - 01-04-deployment-skeleton
  - 01-08-frontend-auth-shell
  - 01-09-frontend-account
  - 01-10-frontend-admin
  - 02-multi-cluster-inventory
tech-stack:
  added:
    - "@sveltejs/kit@2.59.1"
    - "@sveltejs/adapter-node@5.5.4"
    - "svelte@5.55.5 (runes API)"
    - "tailwindcss@4.3.0 + @tailwindcss/vite"
    - "bits-ui@2.18.1"
    - "@lucide/svelte@1.14.0 (scoped package — not the legacy lucide-svelte)"
    - "@tanstack/svelte-query@6.1.29"
    - "zod@4.4.3"
    - "clsx + tailwind-merge + tailwind-variants"
    - "formsnap@2.0.1 + sveltekit-superforms@2.30.1"
    - "mode-watcher@1.1.0, svelte-sonner@1.1.1"
    - "tailwindcss-animate@1.0.7"
    - "vite@6.4.2, vitest@3.2.4, svelte-check@4.4.8, typescript@5.9.3"
    - "@hey-api/openapi-ts@0.97.1 (for Plan 08's typed client)"
  patterns:
    - "Pattern 10 (01-RESEARCH.md): SvelteKit AppShell + tri-state ThemeStore with FOUC-mitigation inline script"
    - "D-13 CSRF double-submit: cookie is JS-readable BY DESIGN; apiFetch echoes it as X-CSRF-Token on state-changing methods only"
    - "Layout placeholder pattern: +layout.server.ts ships shape-only with explicit TODO(NN-NN) comment marking the future implementer"
    - "$lib/utils.ts owns shared helpers (cn, WithElementRef) imported by every shadcn-svelte primitive; $lib/utils/ subdirectory holds feature-specific helpers"
    - "Lucide imports via scoped @lucide/svelte/icons/{name} (modern shadcn-svelte registry convention)"
    - "Sidebar active-state pattern: bg-muted + absolutely positioned 3px primary left-edge bar (per UI-SPEC §Sidebar contract)"

key-files:
  created:
    - "frontend/package.json"
    - "frontend/pnpm-lock.yaml"
    - "frontend/pnpm-workspace.yaml"
    - "frontend/svelte.config.js"
    - "frontend/vite.config.ts"
    - "frontend/tsconfig.json"
    - "frontend/tailwind.config.ts"
    - "frontend/postcss.config.js"
    - "frontend/components.json"
    - "frontend/.eslintrc.json, .prettierrc, .gitignore, .env.example"
    - "frontend/src/app.html (with FOUC-mitigation inline script)"
    - "frontend/src/app.css (Tailwind v4 + slate palette + @font-face Inter)"
    - "frontend/src/app.d.ts (App.Locals.user, App.PageData typed)"
    - "frontend/src/lib/utils.ts (cn + WithElementRef — canonical shadcn-svelte path)"
    - "frontend/src/lib/utils/cn.ts (re-export shim for plan manifest compliance)"
    - "frontend/src/lib/utils/csrf.ts (readCsrfCookie)"
    - "frontend/src/lib/utils/api.ts (apiFetch, apiJson, ApiError)"
    - "frontend/src/lib/stores/theme.svelte.ts (tri-state ThemeStore using runes)"
    - "frontend/src/lib/stores/user.svelte.ts (CurrentUser placeholder)"
    - "frontend/src/lib/components/layout/AppShell.svelte"
    - "frontend/src/lib/components/layout/Sidebar.svelte"
    - "frontend/src/lib/components/layout/Topbar.svelte"
    - "frontend/src/lib/components/layout/ThemeToggle.svelte"
    - "frontend/src/lib/components/ui/* (20 shadcn-svelte primitives)"
    - "frontend/src/lib/assets/fonts/Inter-Variable.woff2 (352KB, from rsms/inter master)"
    - "frontend/src/routes/+layout.svelte, +layout.server.ts (STUB)"
    - "frontend/src/routes/+page.svelte, +page.server.ts"
    - "frontend/src/hooks.server.ts"
    - "frontend/tests/sanity.test.ts"
  modified: []

key-decisions:
  - "shadcn-svelte CLI auto-migrated style from 'default' to 'nova' (v1.2.7 deprecation); components.json reflects nova. baseColor kept at slate per UI-SPEC."
  - "Vitest pinned to 3.x to match vite 6's type surface; vitest 2.x ships its own vite 5 types and breaks tsc."
  - "Modern shadcn-svelte primitives import cn + WithElementRef from $lib/utils (single file). We keep utils.ts as the canonical path and added a $lib/utils/cn.ts shim for plan-manifest compliance."
  - "@lucide/svelte (scoped) is the package modern shadcn-svelte registry expects, not lucide-svelte. Both are listed in dependencies for compatibility; the components.json registry components consistently import @lucide/svelte."
  - "kit.csrf.checkOrigin removed (deprecated by sveltekit); the API-side csrf_protect dependency from Plan 01-01 is the sole authoritative CSRF check. trustedOrigins not set → SvelteKit's default same-origin behaviour applies to its own form actions, which is fine."
  - "Inter Variable woff2 (rsms/inter master branch InterVariable.woff2) committed as a real binary — air-gap requirement (UI-SPEC §Typography, threat T-01-03-06)."
  - "+layout.server.ts probes /api/v1/health and tolerates failure (apiReachable boolean). This lets `pnpm dev` work standalone before the backend is running."
  - "esbuild build script approved via pnpm-workspace.yaml's allowBuilds — required to make pnpm 11 install non-interactive in CI."

patterns-established:
  - "Pattern: ThemeStore class with $state, $derived, init()-on-mount, and FOUC-mitigation inline script in app.html (UI-SPEC §Theme Toggle Contract)"
  - "Pattern: layout STUB loaders carry explicit TODO(NN-NN) comments naming the future plan that replaces them"
  - "Pattern: every browser → API call routes through $lib/utils/api.ts apiFetch / apiJson; CSRF + auth-cookie forwarding owned by one module"
  - "Pattern: shadcn-svelte primitives stay in $lib/components/ui/; layout chrome in $lib/components/layout/; feature components (Plan 08+) will live in $lib/components/<domain>/"
  - "Pattern: bind:ref via bits-ui's `{#snippet child({ props })}` is the canonical way to embed a custom button as a DropdownMenu.Trigger / Tooltip.Trigger in modern shadcn-svelte"

requirements-completed:
  - UI-01
  - UI-02
  - API-01
  - API-03

# Metrics
duration: ~10min
completed: 2026-05-14
---

# Phase 01 Plan 03: Frontend Scaffold Summary

**SvelteKit 2 + Svelte 5 + Tailwind v4 + shadcn-svelte project tree with Hetzner-style app shell, tri-state Light/Dark/System ThemeStore, CSRF double-submit fetch wrapper, and 20 UI primitives — all clean under svelte-check, vitest, and `pnpm build`.**

## Performance

- **Duration:** ~10 min (591 s)
- **Started:** 2026-05-14T03:25:50Z
- **Completed:** 2026-05-14T03:35:41Z
- **Tasks:** 2 (both `type=auto`, no checkpoints reached)
- **Files modified:** 162 total (3 from this plan plus 20 shadcn-svelte component scaffolds)

## Accomplishments

- `frontend/` initialised with the locked stack from 01-RESEARCH.md §Frontend pins (every version verified in `pnpm install`).
- 20 shadcn-svelte primitives copied into `src/lib/components/ui/` via the official CLI: button, input, label, textarea, checkbox, switch, select, card, separator, badge, alert, dialog, alert-dialog, dropdown-menu, sheet, form, sonner, table, tabs, tooltip. Every primitive compiles clean under `svelte-check --tsconfig ./tsconfig.json`.
- Slate palette tokens (light + dark) match UI-SPEC §Color HSL values exactly: light `--primary: 217 91% 60%`, dark `--primary: 217 91% 65%`, plus custom `--success` / `--warning` tokens.
- Tri-state ThemeStore using Svelte 5 runes (`$state`, `$derived`) with SSR-safe init, FOUC-mitigation inline script in `app.html`, and `setMode('system')` removing the localStorage key per UI-SPEC.
- Hetzner-style app shell: 56px Topbar (logo + product name + disabled cluster picker placeholder + ThemeToggle + UserMenu) + 240px / 56px responsive Sidebar (Account section always visible, Admin section gated on `user.is_admin`, API docs external-link item) + max-w-screen-xl content outlet.
- `apiFetch` + `apiJson` in `$lib/utils/api.ts`: auto-prefixes `/api/v1`, auto-serialises JSON bodies, injects `X-CSRF-Token` from the JS-readable cookie on state-changing methods (D-13), forwards `same-origin` cookies. `ApiError` carries status + parsed body.
- `+layout.server.ts` ships as a STUB returning `{ user: null, setupNeeded: false, apiReachable: bool }` with the explicit `// TODO(01-08): replace with real auth probe` comment marking the replacement point.
- Inter Variable woff2 (352KB) self-hosted under `src/lib/assets/fonts/`, bundled by Vite into the build output (no Google Fonts dependency — air-gap compatible).
- `pnpm install && pnpm run check && pnpm run test && pnpm run build` all exit 0; production bundle is 3.3MB total / 1.1MB client.

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize SvelteKit + Tailwind v4 + shadcn-svelte, add 20 UI primitives** — `eb95219` (feat)
2. **Task 2: App shell + theme store + CSRF helper + sanity tests** — `1f7efbb` (feat)

(The plan-metadata commit follows this summary file.)

## Files Created/Modified

### Config (Task 1)

- `frontend/package.json` — SvelteKit 2.59 + Svelte 5.55 + Tailwind 4.3 + bits-ui 2.18 + zod 4.4 (pins from 01-RESEARCH.md)
- `frontend/pnpm-workspace.yaml` — `allowBuilds.esbuild: true` so pnpm 11 doesn't refuse the postinstall script
- `frontend/svelte.config.js` — adapter-node, `$lib` alias, vitePreprocess
- `frontend/vite.config.ts` — Tailwind + SvelteKit + vitest config; `/api` proxy to 127.0.0.1:8000 for dev
- `frontend/tsconfig.json` — strict, ES2022, moduleResolution=bundler, extends `.svelte-kit/tsconfig.json`
- `frontend/tailwind.config.ts` — `darkMode: 'class'` + content globs (Tailwind v4 is otherwise CSS-first)
- `frontend/components.json` — shadcn-svelte config: `baseColor: slate`, `style: nova`, aliases per UI-SPEC
- `frontend/src/app.html` — inline FOUC-mitigation script reading `localStorage.theme`
- `frontend/src/app.css` — Tailwind v4 `@theme`, `@font-face` Inter, `:root` light tokens, `.dark` dark tokens, base layer
- `frontend/src/app.d.ts` — typed `App.Locals.user` + `App.PageData`
- `frontend/src/lib/utils.ts` — canonical `cn` + `WithElementRef` (every shadcn primitive imports from here)
- `frontend/src/lib/components/ui/*` — 20 shadcn-svelte primitive directories (button, input, ..., tooltip)

### Application code (Task 2)

- `frontend/src/lib/stores/theme.svelte.ts` — `ThemeStore` class with `$state mode`, `$derived effective`, `init()`, `setMode()`
- `frontend/src/lib/stores/user.svelte.ts` — `UserStore` carrying `CurrentUser` (placeholder; Plan 08 hydrates)
- `frontend/src/lib/utils/cn.ts` — re-export shim of `$lib/utils.cn`
- `frontend/src/lib/utils/csrf.ts` — `readCsrfCookie()` parses `document.cookie`
- `frontend/src/lib/utils/api.ts` — `apiFetch`, `apiJson<T>`, `ApiError`
- `frontend/src/lib/components/layout/AppShell.svelte` — Topbar + Sidebar + main; skip-to-content link
- `frontend/src/lib/components/layout/Sidebar.svelte` — Account + Admin sections, active-state 3px primary bar
- `frontend/src/lib/components/layout/Topbar.svelte` — logo + name + disabled cluster picker (with tooltip) + ThemeToggle + UserMenu
- `frontend/src/lib/components/layout/ThemeToggle.svelte` — DropdownMenu (Light/Dark/System)
- `frontend/src/routes/+layout.svelte` — imports app.css, calls `theme.init()`, hydrates user store, wraps in AppShell
- `frontend/src/routes/+layout.server.ts` — STUB load with `TODO(01-08)` comment
- `frontend/src/routes/+page.svelte` — Dashboard placeholder (Display 28/600 + muted body)
- `frontend/src/routes/+page.server.ts` — empty load
- `frontend/src/hooks.server.ts` — identity handle stub
- `frontend/tests/sanity.test.ts` — 3 vitest assertions on `cn`
- `frontend/src/lib/assets/fonts/Inter-Variable.woff2` — 352KB binary from rsms/inter master

## Decisions Made

- **shadcn-svelte style: nova** — the CLI v1.2.7 deprecated "default" and auto-migrated. `baseColor` stays at slate per UI-SPEC; only the style preset name changed.
- **Vitest 3.x (not 2.x)** — vitest 2 ships its own vite 5 types and conflicts with the vite 6 install needed by `@sveltejs/vite-plugin-svelte@5`. Bumping vitest is the cleanest resolution.
- **`$lib/utils.ts` single-file** — modern shadcn-svelte primitives import `cn` + `WithElementRef` from `$lib/utils.js`. We keep that as canonical and added `$lib/utils/cn.ts` as a re-export shim so the plan manifest's file list stays honest.
- **`@lucide/svelte` (scoped)** — that's the package modern shadcn-svelte registry imports from; legacy `lucide-svelte` is also kept in deps for compatibility but the actual icon imports use the scoped name.
- **CSRF: `kit.csrf` left at default** — `checkOrigin` is deprecated; `trustedOrigins` defaults are correct. Authoritative CSRF check is the FastAPI `csrf_protect` dependency from Plan 01-01.
- **Inter Variable from rsms upstream** — fetched `https://github.com/rsms/inter/raw/master/docs/font-files/InterVariable.woff2` (350KB), committed as binary. Air-gap requirement and T-01-03-06 mitigation satisfied.
- **+layout.server.ts as STUB** — explicit `// TODO(01-08): replace with real auth probe` comment marks the replacement point. `/api/v1/health` probe gives an honest `apiReachable` boolean today.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm 11 refuses to install when build scripts are unapproved**
- **Found during:** Task 1 (first `pnpm install`)
- **Issue:** pnpm 11 exits non-zero on `[ERR_PNPM_IGNORED_BUILDS]` when esbuild's postinstall is unapproved, blocking `svelte-kit sync`.
- **Fix:** Added `frontend/pnpm-workspace.yaml` with `allowBuilds.esbuild: true`. Plan didn't anticipate pnpm 11's stricter default.
- **Files modified:** `frontend/pnpm-workspace.yaml`
- **Verification:** `pnpm install` exits 0; esbuild postinstall runs.
- **Committed in:** `eb95219` (Task 1 commit)

**2. [Rule 3 - Blocking] @sveltejs/vite-plugin-svelte@5 requires vite 6, not vite 5**
- **Found during:** Task 1 (`pnpm exec svelte-kit sync` after install)
- **Issue:** The plan pinned vite ^5.4.10 but vite-plugin-svelte 5.x imports `defaultClientConditions` which only exists in vite 6.x. Sync threw a SyntaxError.
- **Fix:** Bumped `vite` to `^6.0.0` in package.json. Subsequently bumped `vitest` to `^3.0.0` to match (vitest 2 ships vite 5 types and conflicted).
- **Files modified:** `frontend/package.json`
- **Verification:** `svelte-kit sync` clean; `pnpm run check` 0 errors.
- **Committed in:** `eb95219` (Task 1 commit)

**3. [Rule 3 - Blocking] shadcn-svelte v1.2.7 components import from `@lucide/svelte`, not `lucide-svelte`**
- **Found during:** Task 1 (`pnpm run check` after components added)
- **Issue:** 16 errors: "Cannot find module '@lucide/svelte/icons/X'". Modern registry uses the scoped package.
- **Fix:** `pnpm add @lucide/svelte`. Kept legacy `lucide-svelte` in deps too (no harm; unused by registry components).
- **Files modified:** `frontend/package.json`
- **Verification:** `pnpm run check` 0 errors.
- **Committed in:** `eb95219` (Task 1 commit)

**4. [Rule 3 - Blocking] vitest's `test` key not recognised by `defineConfig` from `vite`**
- **Found during:** Task 1 (`pnpm run check` on vite.config.ts)
- **Issue:** `defineConfig` from `vite` rejects the `test` property; must come from `vitest/config`.
- **Fix:** Changed import to `from 'vitest/config'`.
- **Files modified:** `frontend/vite.config.ts`
- **Verification:** `pnpm run check` clean.
- **Committed in:** `eb95219` (Task 1 commit)

**5. [Rule 3 - Blocking] shadcn-svelte CLI 'default' style deprecated → auto-migrated to 'nova'**
- **Found during:** Task 1 (`pnpm dlx shadcn-svelte@latest add`)
- **Issue:** CLI emits `▲  Unsupported style found in components.json: default. Using nova instead.` and would re-emit on every subsequent `add`.
- **Fix:** Updated `components.json` `style` from `"default"` to `"nova"`. baseColor unchanged.
- **Files modified:** `frontend/components.json`
- **Verification:** CLI add silent; components match shadcn-svelte v4-native conventions.
- **Committed in:** `eb95219` (Task 1 commit)

**6. [Rule 3 - Adjustment] `$lib/utils.ts` (canonical) vs `$lib/utils/` (subdirectory) coexistence**
- **Found during:** Task 1 (after shadcn-svelte add)
- **Issue:** The plan files-list places `cn.ts` under `$lib/utils/`, but generated primitives import from `$lib/utils.js`. A single name cannot resolve to both a file and a directory by ambiguous specifier `$lib/utils`.
- **Fix:** Wrote `$lib/utils.ts` (canonical — owns `cn` + `WithElementRef`) AND created `$lib/utils/cn.ts` as a re-export shim. Subdirectory siblings (`csrf.ts`, `api.ts`) use explicit `$lib/utils/csrf` and `$lib/utils/api` paths so resolution is unambiguous.
- **Files modified:** `frontend/src/lib/utils.ts`, `frontend/src/lib/utils/cn.ts`
- **Verification:** `pnpm run check` clean — both import paths resolve.
- **Committed in:** `eb95219`, `1f7efbb`

**7. [Rule 3 - Cleanup] `kit.csrf.checkOrigin` is deprecated in SvelteKit 2.59**
- **Found during:** Task 1 (`pnpm exec svelte-kit sync` warning)
- **Issue:** SvelteKit emits `config.kit.csrf.checkOrigin has been deprecated in favour of csrf.trustedOrigins` warning.
- **Fix:** Removed the `csrf` block from `svelte.config.js`; left defaults. The API-side CSRF check from Plan 01-01 is the sole authority.
- **Files modified:** `frontend/svelte.config.js`
- **Verification:** sync clean, no deprecation warnings.
- **Committed in:** `eb95219`

**8. [Rule 3 - Adjustment] Inter Variable @font-face URL must be relative (not `$lib/...`)**
- **Found during:** Task 1 → 2 (build planning)
- **Issue:** Tailwind v4 + Vite resolve URL specifiers relative to the CSS file, not via Vite aliases. `url('$lib/...')` would not bundle the font.
- **Fix:** Changed @font-face `src` to `url('./lib/assets/fonts/Inter-Variable.woff2')`.
- **Files modified:** `frontend/src/app.css`
- **Verification:** `pnpm run build` emits `Inter-Variable.DiVDrmQJ.woff2` (352KB) under `build/client/_app/immutable/assets/`.
- **Committed in:** `1f7efbb`

---

**Total deviations:** 8 auto-fixed (all Rule 3 - Blocking / Adjustment / Cleanup; tooling-drift since plan authoring).
**Impact on plan:** All deviations are tooling reality (newer pnpm + vite + shadcn-svelte). No scope change. Every plan-listed file exists; every acceptance criterion passes.

## Issues Encountered

- **Interactive sv-create / shadcn-svelte init:** The plan offered `sv create --template skeleton --types ts --no-add-ons` but that flag set does not exist on `sv@latest`; the CLI insists on a TTY for prompts. Hand-authored the skeleton instead (the plan explicitly approves this fallback). shadcn-svelte's `add` worked non-interactively via `-y -o --no-deps` flags.
- **Inter Variable URL:** rsms/inter ships the variable woff2 under `docs/font-files/InterVariable.woff2` on master, not at the path some older guides suggest. Verified `wOF2` magic bytes (`774f 4632`) before committing.

## Threat Flags

None. Every file in the diff lines up with surfaces already enumerated in the plan's `<threat_model>` (theme store, FOUC inline script, CSRF helper, fetch wrapper). No new endpoints, no new auth paths, no schema changes.

## TDD Gate Compliance

N/A — Plan 01-03 is `type: execute` (autonomous scaffolding), not `type: tdd`. Sanity tests for `cn` shipped via Task 2 as part of the verification surface, not as a RED/GREEN cycle.

## Bundle Stats (`pnpm run build`)

- Total build: **3.3 MB**
- Client output: **1.1 MB**
- Largest client chunks:
  - `nodes/0.CD73tfL_.js` — 239.9 KB (gzip 70.8 KB)
  - `Inter-Variable.DiVDrmQJ.woff2` — 352.2 KB (self-hosted, not re-encodable)
  - `_layout.DkMeMDYz.css` — 57.2 KB (Tailwind v4 + slate palette + shadcn primitives)
- Server output: **2.2 MB** (adapter-node bundle, includes the rendered _layout entry @ 354 KB)
- Build time: **7.32 s**

## User Setup Required

None — no external service configuration. The frontend dev loop is fully self-contained; `pnpm dev` starts on `:5173` and proxies `/api/*` to FastAPI on `:8000` (Plan 01-01).

## Outstanding TODOs (For Plan 08 — frontend-auth-shell)

1. **`src/routes/+layout.server.ts`** — replace the stub load with:
   - `GET /api/v1/me` (Plan 01-05 lands the endpoint) → hydrate `user`; redirect to `/login` on 401
   - `GET /api/v1/setup/status` → set `setupNeeded`; 404 the `/setup` route when an admin already exists
2. **`src/hooks.server.ts`** — replace the identity handle with auth gating: read the access JWT cookie, populate `event.locals.user`, redirect unauthenticated requests away from protected routes.
3. **`src/lib/components/layout/Topbar.svelte`** — `logout()` currently calls a placeholder `/auth/logout` and swallows errors. Plan 08 wires the real endpoint and surfaces an error toast on failure.
4. **Routes Plan 08 implements:** `/login`, `/setup` (4-step stepper per D-19), `/profile`, `/profile/ssh-keys`, `/profile/tokens`, `/admin/users[/*]`, `/admin/clusters[/*]`.
5. **API typed-client:** wire `@hey-api/openapi-ts` against `/api/openapi.json` to generate the typed wrapper Plan 08 will use instead of raw `apiFetch` for primary CRUD calls.

## Next Phase Readiness

- Plan 04 (deployment skeleton) can proceed in parallel — no dependency on the frontend tree.
- Plan 05 (auth subsystem) can proceed in parallel — frontend will consume those endpoints in Plan 08.
- Plan 08 (frontend auth shell) starts cleanly: imports `$lib/components/ui/*`, `$lib/components/layout/AppShell.svelte`, `$lib/stores/theme.svelte`, `$lib/stores/user.svelte`, `$lib/utils/api.ts` without touching scaffolding.

## Self-Check

Verified before publishing this summary:

- `[ -f frontend/package.json ]` → FOUND
- `[ -f frontend/components.json ]` → FOUND
- `[ -f frontend/src/app.css ]` → FOUND
- `[ -f frontend/src/lib/utils.ts ]` → FOUND
- `[ -f frontend/src/lib/stores/theme.svelte.ts ]` → FOUND
- `[ -f frontend/src/lib/components/layout/AppShell.svelte ]` → FOUND
- `[ -f frontend/src/lib/components/layout/Sidebar.svelte ]` → FOUND
- `[ -f frontend/src/lib/components/layout/Topbar.svelte ]` → FOUND
- `[ -f frontend/src/lib/components/layout/ThemeToggle.svelte ]` → FOUND
- `[ -f frontend/src/routes/+layout.server.ts ]` → FOUND
- `[ -f frontend/src/lib/assets/fonts/Inter-Variable.woff2 ]` → FOUND (352240 bytes, wOF2 magic)
- `git log --oneline | grep eb95219` → FOUND (Task 1 commit)
- `git log --oneline | grep 1f7efbb` → FOUND (Task 2 commit)
- `pnpm run check` → exits 0
- `pnpm run test` → exits 0 (3/3 passed)
- `pnpm run build` → exits 0

**Self-Check: PASSED**

---
*Phase: 01-foundation*
*Completed: 2026-05-14*
