---
phase: 04-provisioning-networking-console
plan: 10
subsystem: frontend-wizard-shell
tags: [frontend, wizard, svelte, sveltekit, sessionstorage, provisioning]
requires:
  - "Plan 04-09: the five typed Phase-4 API client modules + the EmptyState shared primitive"
  - "frontend/src/routes/setup/+page.svelte — the Phase-1 stepped-wizard analog (the Step machine + pip stepper rail)"
  - "frontend/src/lib/stores/jobs.svelte.ts — the Svelte-5 rune-store analog"
provides:
  - "The /create wizard route — chrome + Step 1 path picker + the step-orchestration surface"
  - "WizardChrome.svelte — the reusable wizard chrome (header, stepper rail, 64px footer)"
  - "PathPicker.svelte — Step 1, the six-card radio-group path picker"
  - "wizardDraft.svelte.ts — the sessionStorage-backed wizard draft store"
  - "wizard-model.ts — the path-conditional step model + the D-04 routing helper + PATH_CARDS"
affects:
  - "Plan 04-11 (LXC wizard steps — plugs the Source/Resources/Network step bodies into the shell)"
  - "Plan 04-12 (VM wizard steps — plugs the Source/Resources/Network step bodies into the shell)"
  - "Plan 04-13 (Cloud-Init step — plugs the Cloud-Init + Review step bodies into the shell)"
tech-stack:
  added:
    - "shadcn-svelte radio-group primitive (one-time install — the Step-1 path-picker grid)"
  patterns:
    - "Wizard logic lives in a framework-free wizard-model.ts so it is unit-testable in the node vitest env (the Phase-3 snapshot-tree.ts discipline)"
    - "The wizardDraft rune store takes an injectable StorageLike so it is testable without a browser sessionStorage"
    - "The route exposes a single `orchestration` object (next/back/goToStep/completeWithJob) the sibling step plans plug into"
key-files:
  created:
    - frontend/src/lib/components/wizard/wizard-model.ts
    - frontend/src/lib/stores/wizardDraft.svelte.ts
    - frontend/src/lib/components/wizard/WizardChrome.svelte
    - frontend/src/lib/components/wizard/PathPicker.svelte
    - frontend/src/routes/create/+page.server.ts
    - frontend/src/routes/create/+page.svelte
    - frontend/tests/wizard-draft.test.ts
    - frontend/src/lib/components/ui/radio-group/index.ts
    - frontend/src/lib/components/ui/radio-group/radio-group.svelte
    - frontend/src/lib/components/ui/radio-group/radio-group-item.svelte
  modified:
    - frontend/package.json
    - frontend/pnpm-lock.yaml
decisions:
  - "Wizard logic (step model, path cards, routing helper, discard gate) lives in a framework-free wizard-model.ts — the vitest env is `node` so .svelte files cannot be mounted; extracting the logic makes the tested code the rendered code"
  - "The wizardDraft store accepts an injectable StorageLike; in a browser it binds sessionStorage, in the node test env it runs against an in-memory map — the same injectable-dependency discipline as the Phase-3 jobs-store WsFactory"
  - "The /create cluster context comes from api.inventory.listAll (team-scoped), NOT api.clusters.list (admin-gated) — the wizard is open to any authenticated team member"
  - "A rehydrated draft with an unknown `path` value discards the WHOLE draft (not just the path field) — a forged path marks the blob as untrusted, so step/formData are not partially rehydrated either (T-04-10-03)"
metrics:
  duration: ~8 min
  completed: 2026-05-16
  tasks: 2
  files: 12
  tests: "32 new (171 frontend total)"
---

# Phase 4 Plan 10: Frontend Wizard Shell Summary

The `/create` unified provisioning-wizard shell: the wizard chrome (header, path-conditional stepper rail, 64px footer), Step 1 (the six-card PathPicker), the `sessionStorage`-backed draft store, and the step-orchestration surface the three sibling wizard-step plans (04-11/12/13) plug their per-path step bodies into.

## What Shipped

**Task 1 — the wizardDraft store + the WizardChrome and PathPicker components** (commit `a7a1eb3`)
- `wizard-model.ts` — the framework-free heart of the wizard, extracted so the logic is unit-testable in the `node` vitest env:
  - `WizardPath` — the six provisioning-path ids; `WizardStepId` — the six step ids; `WIZARD_STEP_LABEL` — the stepper-rail labels.
  - `stepsForPath(path)` — the path-conditional step model (UI-SPEC step-model table, D-03): every path is `Path → Source → Resources → Network → [Cloud-Init] → Review`; the Cloud-Init step is present on all four VM paths and **absent** from both LXC paths; `null` (no path chosen) yields just the Path step.
  - `PATH_CARDS` — the six path-picker cards (path, icon name, title, description, kind) pinned **verbatim** from the Copywriting Contract; `KNOWN_PATHS` for draft validation; `FINAL_CTA_LABEL` — the path-specific terminal CTA ("Create container" / "Deploy script" / "Create VM" / "Clone VM").
  - `canAdvanceFromPathStep` — the Step-1 Next gate; `shouldPromptDiscard` — the close-wizard discard gate (added in Task 2); `inventoryPathForJob` — the D-04 `/inventory/{cluster}/{vmid}` routing helper that reads the reserved `vmid` off the `ProvisioningJobAccepted` body.
- `wizardDraft.svelte.ts` — a Svelte-5 rune store (modelled on `jobs.svelte.ts`) holding `path` / `step` / `formData`. It is `sessionStorage`-backed via an injectable `StorageLike`: persists on every mutation under one draft key, rehydrates on construction, `clear()` removes the draft. `cipassword` / `ci_password` / `password` are stripped from the **serialised** draft (`SECRET_KEYS`) so no secret ever reaches sessionStorage (T-04-10-02); a corrupt blob, an unknown path, or an out-of-range step all fall back to a fresh empty draft (T-04-10-03).
- `WizardChrome.svelte` — the reusable chrome: a "Create" header (Heading 18/600) + an icon-only `X` close button carrying `aria-label="Close wizard"`; the pip + connecting-line stepper rail reusing the Phase-1 `setup/+page.svelte` markup (active `bg-primary`, completed `bg-success` + `Check`, future `bg-muted`); a 64px (`h-16`) sticky footer with `[Back]` left (`variant="ghost"`, hidden on Step 1) and `[Next]`/final-CTA right; the step body injected via a `body` snippet, `max-w-[45rem]` centered unless `wide` (the Cloud-Init step).
- `PathPicker.svelte` — Step 1: the six cards in a responsive grid (3-up ≥1024px, 2-up ≥640px, 1-up below), 160px tall, min 240px wide, as a `bits-ui` `radio-group` (`role="radiogroup"` + per-card `role="radio"` for arrow-key navigation + `aria-checked`); the chosen card gets a `border-primary` ring + a `text-primary` `Check` top-right; uses only the six pinned icons (`Container`, `Rocket`, `Disc`, `Boxes`, `Image`, `Copy`).
- The shadcn-svelte `radio-group` primitive was installed once (`pnpm dlx shadcn-svelte@latest add radio-group`) — the `stepper` primitive was not needed; the Phase-1 hand-rolled pip stepper covers the rail.

**Task 2 — the /create wizard route** (commit `1323c69`)
- `create/+page.server.ts` — an auth-gated SSR loader (modelled on `admin/teams/[id]/+page.server.ts`): re-checks `locals.user` and redirects an unauthenticated user to `/login?next=…` (T-04-10-01, defence-in-depth past the layout gate); pre-fetches the team-scoped cluster context via `api.inventory.listAll` (a clusters list the wizard's later steps consume), degrading to `loadError=true` + an empty cluster list on any API error so the wizard still renders Step 1.
- `create/+page.svelte` — the wizard route: it derives the path-conditional step model from `wizardDraft.path` (so a mid-wizard reload restores both path and step from `sessionStorage`), renders `WizardChrome` with the stepper rail, mounts `PathPicker` as Step 1, and exposes the `orchestration` surface — `next` / `back` / `goToStep` + `completeWithJob` + getters for `path` / `activeStepId` / `clusters` + `setStepValid` — that the sibling step plans (04-11/12/13) plug their per-path step bodies into. Steps 2..N render a clearly-marked, honest placeholder (path-aware) until those plans land. Closing mid-wizard opens an `alert-dialog` ("Discard this draft?" / "Discard draft") — confirming clears the draft and routes to `/inventory`. `completeWithJob` is the D-04 post-submit helper — it clears the draft, fires the `sonner` "Creating {name}…" toast, and routes to `/inventory/{cluster}/{vmid}` off `response.vmid`.
- `wizard-draft.test.ts` — 32 tests across the suite: the draft-store persist/rehydrate/clear cycle (run against the real `WizardDraftStore` class with an in-memory storage double), the secret-exclusion contract, the corrupt/forged-blob fallback, the `stepsForPath` path-conditional model, the Step-1 Next gate, the six pinned PathPicker cards, the `inventoryPathForJob` D-04 helper, the `shouldPromptDiscard` close gate, and the SSR-loader auth-redirect + authenticated cases.

## Verification

- `pnpm test -- --run wizard-draft` — 32/32 pass.
- `pnpm test` — 16 test files, 171 tests pass (+32 new vs the 139 `pnpm test` baseline; one pre-existing happy-dom iframe test logs an unrelated `ECONNREFUSED` to stderr but still passes).
- `pnpm exec svelte-check --threshold error` — 0 errors, 0 warnings (the project's authoritative type-check; the wizard-model, the draft store, both wizard components, the route + loader, and the radio-group primitive all type-check cleanly).
- Icon allow-list: the new files use only `Container`, `Rocket`, `Disc`, `Boxes`, `Image`, `Copy`, `Check`, `X` — all within the cumulative Phase 1-4 allow-list (`Container`/`Rocket`/`Disc`/`Boxes`/`Image` are the Phase-4 additions; `Copy`/`Check`/`X` are foundational Phase 1-3 icons).
- `aria-label="Close wizard"` present in `WizardChrome.svelte`; `wizardDraft.svelte.ts` reads + writes `sessionStorage` and exposes `clear()`.

Note on `tsc --noEmit`: the plan's verify command included `pnpm exec tsc --noEmit`. As Plan 04-09 documented, raw `tsc` cannot resolve `*.svelte` module types and emits exactly 10 pre-existing `TS2614` errors against the shadcn-svelte UI primitives (`alert`, `badge`, `button`, `tabs` index files) — these predate this plan and are out of scope. There are **zero** non-`TS2614` `tsc` errors, and none of the `TS2614` errors touch any file created or modified by this plan (confirmed by grep). The project's real type-check is `svelte-check`, which understands `.svelte` files and is clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] A forged-path rehydrated draft only nulled the path, keeping the tampered step**
- **Found during:** Task 1 (the `wizard-draft.test.ts` RED run — the "unknown path value" case failed)
- **Issue:** The first `#rehydrate()` implementation validated `path` and `step` independently — a tampered blob with an unknown `path` (e.g. `"evil-path"`) plus an out-of-model `step` of 9 left `path` correctly nulled but rehydrated `step` to 9, leaving the wizard in an impossible state.
- **Fix:** A `path` value that is neither `null` nor one of the six `KNOWN_PATHS` now marks the **whole** blob as forged/corrupt — `#rehydrate()` returns early, so `step` and `formData` are not partially rehydrated from an untrusted draft (T-04-10-03 — a forged draft cannot leave the wizard in a bad state).
- **Files modified:** `frontend/src/lib/stores/wizardDraft.svelte.ts`
- **Commit:** `a7a1eb3`

### Interface adjustments (plan sketch vs. shipped reality)

- **Cluster context source.** The plan's loader sketch said "pre-fetch the active cluster context (the cluster list / the current cluster)". `api.clusters.list` is **admin-gated** (it returns `api_token_secret`-free admin cluster rows), so it cannot be used by a non-admin wizard user. The loader instead uses `api.inventory.listAll` (`GET /api/v1/me/inventory`) — the team-scoped list of clusters the current user can provision into. Same intent (the wizard gets its cluster list), correct authorisation surface.
- **`stepper` primitive not installed.** The plan said to run `pnpm dlx shadcn-svelte@latest add radio-group stepper`, hand-rolling the stepper if unavailable. The Phase-1 `setup/+page.svelte` already ships a proven hand-rolled pip + connecting-line stepper, and the UI-SPEC explicitly names it as the analog — `WizardChrome` reuses that markup directly, so no `stepper` primitive (third-party or shadcn) was added. Only `radio-group` was installed. This is the plan's stated fallback path, chosen because the in-repo analog is the better fit.
- **A shared `wizard-model.ts` module.** The plan's artifact list named the store + the two components + the route. Because the vitest env is `node` (no DOM — `.svelte` files cannot be mounted), the wizard's pure logic (the step model, the path cards, the routing helper, the discard gate) was extracted into a framework-free `wizard-model.ts` so the tested code is the rendered code — the same discipline as Phase 3's `snapshot-tree.ts` and the jobs-store injectable factory. Not a behavior deviation; it is the only way to give the orchestration contract real unit coverage in this test environment.

## Notes for the sibling step plans (04-11 / 04-12 / 04-13)

- The route's step body is a `{#snippet body()}` with an `{#if activeStepId === 'path'}` / `{:else}` switch. The `{:else}` branch is the **mount point** — switch on `activeStepId` + `wizardDraft.path` and render the per-path step component there.
- Drive navigation through the `orchestration` object: `next()` / `back()` / `goToStep(n)`. Call `setStepValid(boolean)` to gate the footer `Next` button on a step's own per-step validation (the shell's `stepValid` defaults `true` so an unwired later step is permissive, never hard-blocked).
- On a successful create 202, call `completeWithJob(clusterId, job, resourceName)` — it clears the draft, fires the toast, and does the D-04 route. Do **not** re-implement the routing rule.
- Persist per-step form fields via `wizardDraft.patchFormData({...})`. Never put a secret (`cipassword`) through a key the store would persist — `SECRET_KEYS` strips `cipassword` / `ci_password` / `password` on write, but keep new secret-bearing keys in that set if you add any.

## Self-Check: PASSED

- All 7 created source/test files exist on disk (`wizard-model.ts`, `wizardDraft.svelte.ts`, `WizardChrome.svelte`, `PathPicker.svelte`, `create/+page.server.ts`, `create/+page.svelte`, `wizard-draft.test.ts`); the 3 radio-group primitive files + the 2 modified config files updated.
- Both task commits present in `git log` (`a7a1eb3`, `1323c69`).
- Zero file deletions in either commit (`git diff --diff-filter=D` empty for both).
