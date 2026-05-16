---
phase: 04-provisioning-networking-console
plan: 15
subsystem: ui
tags: [novnc, console, vnc, svelte, iframe, websocket, vendored-dependency]

# Dependency graph
requires:
  - phase: 04-provisioning-networking-console (Plan 04-08)
    provides: "console mint route + the /api/v1/ws/console relay WebSocket (VncProxyResponse.relay_url)"
  - phase: 04-provisioning-networking-console (Plan 04-14)
    provides: "the ConsoleTab component + console-tab.ts state machine / relay-URL guard"
provides:
  - "A vendored noVNC v1.6.0 RFB client in-repo (frontend/src/lib/vendor/novnc/)"
  - "A GUI-origin /console/embed SvelteKit route that hosts the RFB client against the relay WebSocket"
  - "consoleEmbedSrc() composing /console/embed?ws=... + a tightened consoleIframeSrc() iframe-src guard"
  - "ConsoleTab iframe now loads an actual HTML noVNC client page with a sandbox attribute"
affects: [phase-05-polish, console]

# Tech tracking
tech-stack:
  added: [noVNC v1.6.0 (vendored in-repo ESM source, NOT an npm dependency)]
  patterns:
    - "Vendored third-party ESM source under src/lib/vendor/ with a provenance README + ignore/exclude wiring"
    - "Project-authored .d.ts type shim so checkJs/svelte-check resolves a vendored client without traversing its .js tree"
    - "Iframe loads a GUI-origin /console/embed HTML route; the WS target is a same-origin relay path"

key-files:
  created:
    - frontend/src/lib/vendor/novnc/ (core/ ESM tree + vendor/pako, README.md, LICENSE.txt, core/rfb.d.ts)
    - frontend/src/routes/console/embed/+page.svelte
    - frontend/src/routes/console/embed/+page.ts
    - frontend/.eslintignore
    - frontend/.prettierignore
  modified:
    - frontend/src/lib/components/console/console-tab.ts
    - frontend/src/lib/components/console/ConsoleTab.svelte
    - frontend/tests/console-tab.test.ts
    - frontend/tsconfig.json

key-decisions:
  - "Vendored noVNC from the GitHub v1.6.0 source archive (pure-ESM core/), not the npm package (Babel-transpiled CommonJS lib/) — the source archive imports cleanly under Vite/SvelteKit"
  - "Composed the /console/embed?ws=... URL client-side in ConsoleTab from the existing relay_url — backend mint contract unchanged"
  - "Excluded src/lib/vendor from tsconfig + added a rfb.d.ts type shim rather than touching third-party files"

patterns-established:
  - "Vendored-dependency pattern: in-repo ESM under src/lib/vendor/ + provenance README + .eslintignore/.prettierignore + tsconfig exclude + a .d.ts shim for the public surface"
  - "Iframe-as-HTML-document pattern: an embedded WS client is hosted by a GUI-origin route, the iframe never points at a raw WS path"

requirements-completed: [CON-01]

# Metrics
duration: ~20min
completed: 2026-05-16
---

# Phase 4 Plan 15: Embedded noVNC Console (GAP 1, CON-01) Summary

**Closed the CON-01 blocker — the Console tab iframe now loads a real GUI-origin `/console/embed` HTML page that runs a vendored noVNC RFB client against the GUI relay WebSocket, instead of pointing the iframe at a raw WebSocket path (which loads nothing).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-16T23:00:00Z
- **Completed:** 2026-05-16T23:10:00Z
- **Tasks:** 3 completed
- **Files modified:** 9 created/modified (plus the 54-file vendored noVNC tree)

## Accomplishments

### Task 1 — Vendored the noVNC RFB client (`89d1733`)

- Vendored **noVNC v1.6.0** into `frontend/src/lib/vendor/novnc/` as in-repo ESM
  source — **not** a `package.json` dependency (UI-SPEC §704 / the plan-checker
  forbid `@novnc/novnc` as a bundled npm dependency).
- Source: the **GitHub v1.6.0 release archive**, which ships the pure-ESM
  `core/` tree. The npm package `@novnc/novnc` ships only a Babel-transpiled
  CommonJS `lib/` tree — it does not contain `core/` at all, so the plan's
  GitHub-archive fallback route was the correct (and only) acquisition path.
- Vendored `core/` plus its `../vendor/pako` zlib dependency (which
  `core/inflator.js` + `core/deflator.js` import via a relative path), the
  upstream `LICENSE.txt` (MPL-2.0, headers intact), and a provenance
  `README.md` recording version, upstream URL, license, date, and refresh
  steps.
- Excluded `src/lib/vendor` from `tsconfig.json`, added `.eslintignore` and
  `.prettierignore` — third-party source is not linted / formatted.

### Task 2 — `/console/embed` SvelteKit route (`0522c83`)

- New route `frontend/src/routes/console/embed/` — a GUI-origin HTML document
  loaded inside the ConsoleTab iframe. `ssr = false` (the RFB client is
  browser-only).
- `+page.ts` validates the `ws` query param to a same-origin
  `/api/v1/ws/console/` relay path via `isSafeRelayUrl` plus an explicit
  absolute-URL / protocol-relative rejection (threat **T-04-15-01**). A missing
  or hostile `ws` param yields `ws: null` and the page renders an inline error
  state — it never throws an opaque 500 inside the iframe.
- `+page.svelte` instantiates the vendored `RFB` client, builds the **absolute
  `wss://` URL from `window.location`** + the validated relay path (it never
  connects to a Proxmox host — CON-03), fits the framebuffer
  (`scaleViewport`), and surfaces `connect` / `disconnect` lifecycle.
- Added a project-authored `core/rfb.d.ts` type shim so `svelte-check`
  resolves the vendored client's public surface without traversing the
  third-party `.js` tree (`checkJs` would otherwise flood 1100+ implicit-any
  errors on code we do not own — see Deviations).

### Task 3 — Rewired ConsoleTab + console-tab.ts (TDD: `46e2f78` RED, `04851f1` GREEN)

- `console-tab.ts`: added `consoleEmbedSrc(relayUrl)` — runs the relay path
  through `isSafeRelayUrl` (CON-03 guard preserved), then composes
  `/console/embed?ws=<encoded relay path>` (single URL-encoding).
- `console-tab.ts`: tightened `consoleIframeSrc` — it now gates the iframe
  *src HTML route* (must start `/console/embed?ws=`, no `:8006`). A bare
  `/api/v1/ws/console/...` WebSocket path is no longer a valid iframe `src`.
- `ConsoleTab.svelte`: `openConsole()` composes the src via
  `consoleIframeSrc(consoleEmbedSrc(res.relay_url))`; the `<iframe>` now
  carries `sandbox="allow-scripts allow-same-origin"` (WR-02) — the minimum
  the RFB client needs — alongside the existing `title`.
- CON-02 not regressed — `iframeVisible` is unchanged; the iframe is still
  rendered only in the `live` state, after the "Open console" click.

## TDD Gate Compliance

Task 3 followed the RED/GREEN cycle:

- **RED** (`46e2f78`, `test(...)`) — 5 new tests added (`consoleEmbedSrc` not a
  function; the tightened `consoleIframeSrc` assertions) — verified failing.
- **GREEN** (`04851f1`, `feat(...)`) — `consoleEmbedSrc` implemented +
  `consoleIframeSrc` tightened; all 360 frontend tests pass.
- **REFACTOR** — not needed; the implementation was clean as written.

## Verification

| Check | Result |
|-------|--------|
| `frontend/src/lib/vendor/novnc/core/rfb.js` exists | PASS |
| `README.md` contains `v1.6.0` + the noVNC GitHub URL | PASS |
| `grep '@novnc/novnc' frontend/package.json` returns nothing | PASS (absent) |
| No tarball / `node_modules` left under `src/lib/vendor/` | PASS |
| `/console/embed/+page.svelte` + `+page.ts` exist | PASS |
| `+page.svelte` contains `new RFB`, imports `$lib/vendor/novnc`, builds `wss://` from `window.location` | PASS |
| `console-tab.ts` exports `consoleEmbedSrc`; `/console/embed` present | PASS |
| `ConsoleTab.svelte` iframe carries `sandbox="allow-scripts allow-same-origin"` + `title` | PASS |
| `consoleIframeSrc` rejects a bare `/api/v1/ws/console/...` path (test) | PASS |
| `cd frontend && pnpm test` | PASS — 23 files, 360 tests, 0 failures |
| `cd frontend && pnpm exec svelte-check --threshold error` | PASS — 0 errors, 0 warnings |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vendored noVNC `.js` tree flooded `svelte-check` under `checkJs`**

- **Found during:** Task 2 (the embed page imports `rfb.js`, so `svelte-check`
  followed the import into the third-party tree).
- **Issue:** `tsconfig.json` sets `checkJs: true`. The vendored noVNC `.js`
  modules are not authored for TypeScript checking — `svelte-check` reported
  **1145 implicit-any errors** in `src/lib/vendor/novnc/core/`. A `tsconfig`
  `exclude` alone was insufficient: `exclude` drops *root* files but TS still
  type-checks files reached by a *follows-the-import* path from a checked file.
- **Fix:** (a) `exclude: ["src/lib/vendor"]` in `tsconfig.json`; (b) added a
  project-authored `core/rfb.d.ts` type shim — TS resolves the imported
  module's types from the `.d.ts` and stops traversing into the `.js` source.
  The plan explicitly anticipated and authorised the ignore/exclude wiring
  ("if the project's eslint/prettier would touch them, add `src/lib/vendor/` to
  `.eslintignore` and `.prettierignore`"); the `.d.ts` shim is the minimal
  additional step to satisfy "svelte-check / tsc must still not error on the
  project's own files" without editing any third-party file.
- **Files modified:** `frontend/tsconfig.json`,
  `frontend/src/lib/vendor/novnc/core/rfb.d.ts` (new).
- **Commits:** `89d1733` (tsconfig exclude + ignore files), `0522c83`
  (`rfb.d.ts` shim).

**2. [Rule 2 - Missing critical functionality] noVNC `core/` depends on `vendor/pako`**

- **Found during:** Task 1.
- **Issue:** `core/inflator.js` + `core/deflator.js` import
  `../vendor/pako/lib/zlib/...` — the zlib codec lives in a sibling `vendor/`
  tree, not inside `core/`. Vendoring only `core/` would leave an unresolved
  import and the embed page would fail to build (Task 2 acceptance criterion:
  "no unresolved import when the embed page builds").
- **Fix:** Also vendored the noVNC source archive's `vendor/pako` tree as
  `src/lib/vendor/novnc/vendor/pako`, preserving the `../vendor/pako` relative
  path layout so the imports resolve.
- **Files modified:** `frontend/src/lib/vendor/novnc/vendor/pako/**` (new).
- **Commit:** `89d1733`.

## Known Stubs

None. The `/console/embed` page wires the real vendored RFB client to the real
relay WebSocket; `ConsoleTab` composes the real iframe src from the live mint
response. No placeholder data paths were introduced.

## Threat Flags

None. The plan's `<threat_model>` (T-04-15-01..05) covers all security-relevant
surface introduced — the `ws`-param validation, the iframe `sandbox`, the
`consoleIframeSrc`/`consoleEmbedSrc` guards, and the vendored-source supply
chain. No new endpoint, auth path, or trust boundary beyond that register.

## Self-Check: PASSED

- `frontend/src/lib/vendor/novnc/core/rfb.js` — FOUND
- `frontend/src/lib/vendor/novnc/README.md` — FOUND
- `frontend/src/routes/console/embed/+page.svelte` — FOUND
- `frontend/src/routes/console/embed/+page.ts` — FOUND
- `frontend/src/lib/vendor/novnc/core/rfb.d.ts` — FOUND
- Commit `89d1733` — FOUND
- Commit `0522c83` — FOUND
- Commit `46e2f78` — FOUND
- Commit `04851f1` — FOUND
