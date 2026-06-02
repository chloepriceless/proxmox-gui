---
phase: 05-polish-operational-hardening
plan: 05
subsystem: frontend
tags: [mobile, responsive, a11y, axe-core, sheet, reflow, ui-03]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: AppShell + Sidebar + Topbar, shadcn-svelte Sheet/Card primitives, vitest+happy-dom
  - phase: 02-multi-cluster-inventory-quotas-audit
    provides: inventory table + per-row DropdownMenu power menu
  - phase: 04-provisioning-networking-console
    provides: console embed RFB client (already sets scaleViewport), /create wizard
provides:
  - "$lib/nav.ts shared nav definitions (one source for Sidebar + MobileNav)"
  - "MobileNav.svelte — <lg hamburger Sheet drawer (D-13)"
  - "inventory card-stack reflow at <md with accessible stretched-link cards (D-14)"
  - "create/+layout.svelte small-screen wizard gate (D-16)"
  - "automated axe-core WCAG A/AA audit (D-17)"
affects: [05-06-frontend, 05-07-operator-uat]

# Tech tracking
tech-stack:
  added:
    - "axe-core 4.11.4 (frontend dev dependency)"
  patterns:
    - "Stretched-link card (after:inset-0 overlay) — whole card navigates while the action menu stays a sibling, avoiding nested-interactive a11y violations"
    - "Shared nav module consumed by both the static rail and the hamburger drawer"
    - "Per-file happy-dom env via // @vitest-environment docblock (global env is node)"

key-files:
  created:
    - frontend/src/lib/nav.ts
    - frontend/src/lib/components/layout/MobileNav.svelte
    - frontend/src/routes/create/+layout.svelte
    - frontend/src/lib/components/a11y/axe.test.ts
  modified:
    - frontend/src/lib/components/layout/Sidebar.svelte
    - frontend/src/lib/components/layout/Topbar.svelte
    - frontend/src/routes/inventory/+page.svelte
    - frontend/vite.config.ts
    - frontend/package.json
    - frontend/build (production artifact, restaged)

key-decisions:
  - "Console scale-to-fit (D-15) was already shipped in Plan 04-15 (rfb.scaleViewport=true + the inset-0 .screen div); the acceptance grep already passes. Left untouched to avoid regressing the hard-won live console."
  - "The inventory card uses a stretched-link (name <a> + after:inset-0) instead of a role=button div. The original role=button design nested the action-menu button inside an interactive element — a real axe nested-interactive violation the D-17 audit caught; the stretched-link makes the link and menu siblings."
  - "vite.config test.include extended to src/** so the co-located axe test runs (the plan's acceptance command runs it from its src path; the prior include only covered tests/**)."
  - "The axe audit runs against faithfully-mirrored rendered structures, not mounted +page.svelte pages — the real pages are coupled to the SvelteKit runtime ($app/stores, load data, live stores) and don't mount in bare happy-dom (RESEARCH A2). color-contrast is deferred to the manual Task 3 check (no real paint in happy-dom)."

requirements-completed: [UI-03 (code; manual a11y checkpoint pending)]

# Metrics
duration: ~45min
completed: 2026-06-02 (code; Task 3 human checkpoint pending)
---

# Phase 5 Plan 05: Mobile Reflow & Accessibility (UI-03) Summary

**The product reflows on small viewports — the sidebar collapses to a hamburger Sheet drawer below lg, the inventory list becomes a stack of accessible tappable cards below md, the console already scales to fit, and the /create wizard shows a graceful small-screen notice — plus an automated axe-core WCAG A/AA audit that already caught and drove a fix for a real nested-interactive bug in the card reflow.**

## Status

**Code-complete + all automated gates green.** The single remaining item is
**Task 3 — the blocking manual accessibility checkpoint** (keyboard sweep,
real screen-reader smoke test, visual contrast), which requires an operator at
a browser. It is bundled with the Plan 05-07 operator UAT as a single
human-verification ask. UI-03 is code-satisfied; the manual sign-off closes it.

## Accomplishments

- **D-13 hamburger drawer:** `MobileNav.svelte` — a `lg:hidden` hamburger
  Button opening a left-side shadcn-svelte `Sheet` (vendored bits-ui — focus
  trap, scroll-lock, Escape, dialog ARIA for free). Renders the shared nav
  arrays and closes after navigation (`afterNavigate`). Mounted in `Topbar`.
- **One nav definition:** `$lib/nav.ts` holds `resourceItems` / `accountItems`
  / `adminItems` / `docsItem` / `isActive`, consumed by BOTH `Sidebar` (the
  static `lg+` rail) and `MobileNav` — no route can drift between them.
- **D-14 card-stack reflow:** `inventory/+page.svelte` renders the data table
  at `md+` (`hidden md:table` inside a `hidden md:block` wrapper) and a parallel
  `md:hidden` stack of tappable cards below `md`. Both render sites (single-
  cluster + per-accordion-section) call one shared `resourceBlock` snippet, so
  the reflow lives in exactly one place. The card reuses the EXACT per-row
  power `DropdownMenu`.
- **D-15 console scale-to-fit:** already shipped in Plan 04-15
  (`rfb.scaleViewport = true`); left untouched.
- **D-16 wizard gate:** `create/+layout.svelte` shows a "best on a larger
  screen" notice below `md` and renders the wizard at `md+`.
- **D-17 automated axe audit:** `axe.test.ts` runs axe-core over the app's
  a11y-critical rendered structures. **It caught a real bug** — the first card
  design nested the action button inside a `role="button"` card
  (`nested-interactive`, serious). Fixed via the stretched-link pattern; the
  test now encodes that invariant.

## Task Commits

1. `f3b4fd8` feat(05-05): mobile reflow — hamburger drawer + inventory card stack + wizard gate (UI-03)
2. `121e6c6` test(05-05): axe-core a11y audit + production build (D-17)

## Deviations from Plan

- **vite.config.ts edited (not in the plan's files_modified).** The plan's
  acceptance command runs the axe test from `src/...`, but the vitest `include`
  only covered `tests/**`, so the co-located test was silently skipped.
  Extended `include` to also cover `src/**`. Documented + minimal.
- **Console embed left untouched.** D-15's `scaleViewport` already shipped in
  04-15; modifying the working console carried regression risk for zero gain.
- **axe audits rendered structures, not mounted pages.** Per RESEARCH A2 — the
  real pages don't mount in bare happy-dom. The manual Task 3 checkpoint is the
  authoritative full-page + screen-reader verification.

## Verification Results

- `pnpm exec svelte-check --threshold error` — **0 errors, 0 warnings** (2909 files).
- `pnpm test -- --run` — **382 passed** (24 prior files + the new axe file with 7 cases).
- `pnpm run build` — **✓ built in ~13s**; `frontend/build/node_modules`
  restored (1548 files) and `frontend/build` restaged (frontend-build trap).

## Acceptance Criteria

- [x] `src/lib/nav.ts` exists with `isActive`/`resourceItems`
- [x] Sidebar + MobileNav both import from `nav`
- [x] MobileNav has `lg:hidden` + a Sheet
- [x] inventory has `md:hidden` + `hidden md:table`
- [x] console embed has `scaleViewport`
- [x] create/+layout.svelte has "larger screen"
- [x] svelte-check exits 0
- [x] `axe-core` in package.json; axe.test.ts exists + runs with 0 violations
- [x] `pnpm run build` exits 0; `frontend/build/node_modules` clean; `frontend/build` staged
- [ ] **Task 3 — manual accessibility audit (blocking human checkpoint; bundled with 05-07)**

## Next Phase Readiness

- 05-06 (frontend idle re-auth / settings / self-update UI / audit archives /
  SSH-trust UI) is unblocked and is the next autonomous work.
- The manual a11y checkpoint + the 05-07 operator UAT are the two human gates;
  they will be raised together to the operator via the Hub channel.

---

_Phase: 05-polish-operational-hardening_
_Completed: 2026-06-02 (code; manual a11y checkpoint pending)_
