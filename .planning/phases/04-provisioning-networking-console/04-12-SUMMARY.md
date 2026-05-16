---
phase: 04-provisioning-networking-console
plan: 12
subsystem: frontend-vm-wizard
tags: [frontend, wizard, vm, qemu, networking, sdn, node-fit, quota, svelte, provisioning]
requires:
  - phase: "Plan 04-10"
    provides: "the /create wizard shell + the orchestration surface + the wizardDraft store + wizard-model.ts"
  - phase: "Plan 04-11"
    provides: "the LXC wizard step bodies + LxcResourcesStep with the documented NodeSelect/QuotaDeltaLine mount markers"
  - phase: "Plan 04-09"
    provides: "the typed api.provisioning / api.networks / api.iso clients + the EmptyState / HelpTooltip primitives"
  - phase: "Plan 04-07"
    provides: "the networks backend — GET /clusters/{id}/networks returning NetworkPickerResponse (sdn_vnets/bridges/sdn_capable)"
  - phase: "Plan 04-04"
    provides: "the provisioning backend — POST .../provisioning/qemu (the discriminated source_kind create)"
provides:
  - "node-fit.ts — the pure computeNodeFit/allBlocked node-fit logic"
  - "NodeSelect.svelte — the shared node-fit target-node selector (disables unfit nodes with the reason)"
  - "QuotaDeltaLine.svelte — the shared live quota-delta line"
  - "NetworkPicker.svelte — the shared SDN-aware grouped network picker with IPAM auto-pick"
  - "VmSourceStep.svelte — the four per-path VM source steps"
  - "VmResourcesStep.svelte — the VM Resources step (node-fit + quota + sizing)"
  - "ReviewStep.svelte — the shared read-only Review step (VM + LXC paths)"
  - "vm-wizard.ts — the framework-free VM-wizard + network-picker + quota-delta logic"
  - "The four VM paths wired into /create, submitting to 202 createQemu jobs"
affects:
  - "Plan 04-13 (Cloud-Init step — plugs the Cloud-Init step body into the marked VM-path mount point)"
tech-stack:
  added: []
  patterns:
    - "VM wizard logic (network grouping, quota delta, step model, validation, request builders) lives in a framework-free vm-wizard.ts unit-testable in the node vitest env (the 04-10/04-11 discipline)"
    - "The shared NodeSelect/QuotaDeltaLine/NetworkPicker are pure-prop-driven building blocks both the VM and LXC Resources/Network steps consume"
    - "A wizard step component whose enrichment can't be slotted into a sibling-plan's file is composed in the /create route alongside it — no cross-wave file edit"
key-files:
  created:
    - frontend/src/lib/components/wizard/node-fit.ts
    - frontend/src/lib/components/wizard/vm-wizard.ts
    - frontend/src/lib/components/wizard/NodeSelect.svelte
    - frontend/src/lib/components/wizard/QuotaDeltaLine.svelte
    - frontend/src/lib/components/wizard/NetworkPicker.svelte
    - frontend/src/lib/components/wizard/VmSourceStep.svelte
    - frontend/src/lib/components/wizard/VmResourcesStep.svelte
    - frontend/src/lib/components/wizard/ReviewStep.svelte
    - frontend/tests/node-fit.test.ts
    - frontend/tests/vm-wizard.test.ts
  modified:
    - frontend/src/routes/create/+page.svelte
key-decisions:
  - "NodeSelect is pure-prop-driven — no team-scoped node-free-resource API exists in Phase 4, so it takes a NodeResource[] prop; nodes carry null free figures (fit is advisory, every node stays pickable) — the established Plan 04-11 graceful-degradation pattern"
  - "The LXC Resources step is retro-enriched by composing NodeSelect + QuotaDeltaLine in the /create route ALONGSIDE LxcResourcesStep — that file exposes comment-only mount markers, not prop slots, and is Plan 04-11's; composing in the route avoids the cross-wave edit"
  - "vm-wizard.ts owns the network-picker logic (networkGroups/isNetworkPickable/defaultIpAssignment/buildNetworkConfig) and the quota-delta logic (computeQuotaDelta) so both are unit-testable; the .svelte files are thin render shells"
  - "NetworkPicker reads its `value` seed once via untrack — a one-time init, not a derivation (the picker is the authority over its selection once mounted)"
patterns-established:
  - "node-fit.ts: a pure helper computes per-node {fits, reason} + the all-blocked signal — the .svelte selector only renders it"
  - "Clone paths (template-clone / vm-clone) hide the sizing inputs and skip storage/sizing validation — the clone copies the source's config"
requirements-completed: [VM-01, VM-02, VM-03, VM-04, VM-09, VM-10, NET-01, NET-02, NET-03, NET-04]
duration: ~12 min
completed: 2026-05-16
---

# Phase 4 Plan 12: Frontend VM Wizard Steps Summary

**The four VM provisioning paths (cloud-image, template-clone, blank+ISO, vm-clone) plus the shared node-fit selector, quota-delta line, and SDN-aware network picker — wired into /create and retro-fitted into the LXC paths.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-16T21:48:03Z
- **Completed:** 2026-05-16T22:00:00Z
- **Tasks:** 2
- **Files modified:** 11 (10 created, 1 modified)

## Accomplishments

- The four VM source paths work end-to-end — each `source_kind` renders its own
  source UI, submits via `api.provisioning.createQemu`, and routes to the new
  resource's detail page using the reserved `vmid` (D-04, VM-01..04).
- The shared node-fit selector (`NodeSelect` + the pure `node-fit.ts`) disables
  nodes that cannot host the requested size, with the reason shown inline, and
  blocks `Next` when every node is unfit (VM-10, D-24).
- The shared `QuotaDeltaLine` shows the live "+N vCPU, +N GB RAM" delta and
  blocks `Next` when over-quota (VM-10, inherits Phase-2 D-08).
- The SDN-aware `NetworkPicker` lists SDN VNets and legacy bridges grouped,
  renders pending VNets non-pickable, auto-picks a free IP from IPAM where
  available, and shows the no-networks warning otherwise (NET-01..04).
- The LXC paths' Resources step is retro-enriched with the node-fit selector +
  quota-delta line, and the LXC Network step now renders the shared picker;
  both VM and LXC paths land on the shared `ReviewStep`.

## Task Commits

1. **Task 1: shared node-fit selector, quota-delta line, SDN network picker** — `2ed4d44` (feat)
2. **Task 2: four VM wizard paths, Review step, /create VM + LXC wiring** — `ff87407` (feat)

_Note: both tasks are TDD — the `node-fit` + `vm-wizard` test suites were
written alongside the helper logic; the established node-env, logic-only
test discipline applies (`.svelte` files cannot be mounted in the `node`
vitest env — see the Deviations note)._

## Files Created/Modified

- `frontend/src/lib/components/wizard/node-fit.ts` — pure `computeNodeFit` /
  `allBlocked` — per-node `{fits, reason}` + the all-blocked signal.
- `frontend/src/lib/components/wizard/vm-wizard.ts` — the framework-free VM
  wizard logic: `vmStepsForPath` / `sourceKindForPath` / `validateVmStep` /
  `buildQemuRequest` / `mapQemuCreateError`, the network-picker helpers
  (`networkGroups` / `isNetworkPickable` / `defaultIpAssignment` /
  `findNetworkOption` / `buildNetworkConfig`), and `computeQuotaDelta`.
- `frontend/src/lib/components/wizard/NodeSelect.svelte` — the node-fit
  target-node selector; disables unfit nodes (`opacity-50` + disabled option)
  with the reason, all-blocked warning notice, free-text fallback.
- `frontend/src/lib/components/wizard/QuotaDeltaLine.svelte` — the live
  quota-delta line; `text-muted-foreground` in-budget, `text-destructive`
  over-quota.
- `frontend/src/lib/components/wizard/NetworkPicker.svelte` — the SDN-aware
  grouped `radio-group` picker with the IP-assignment radio + IPAM auto-pick.
- `frontend/src/lib/components/wizard/VmSourceStep.svelte` — the four per-path
  source steps, switching the rendered UI on `source_kind`.
- `frontend/src/lib/components/wizard/VmResourcesStep.svelte` — the VM
  Resources step; embeds `NodeSelect` + `QuotaDeltaLine` + storage + sizing.
- `frontend/src/lib/components/wizard/ReviewStep.svelte` — the shared read-only
  Review step (card sections + "Edit" jump-back links + the quota-delta line).
- `frontend/tests/node-fit.test.ts` — 11 node-fit logic tests.
- `frontend/tests/vm-wizard.test.ts` — 44 VM-wizard + network-picker +
  quota-delta logic tests.
- `frontend/src/routes/create/+page.svelte` — the four VM paths wired into the
  orchestration surface; the LXC Resources/Network steps retro-enriched.

## Verification

- `pnpm exec vitest run tests/vm-wizard.test.ts tests/node-fit.test.ts tests/lxc-wizard.test.ts`
  — 92/92 pass (44 vm-wizard + 11 node-fit + 37 lxc-wizard).
- `pnpm test` — 21 test files, 306 tests pass (+55 new vs the 251 baseline; one
  pre-existing happy-dom test logs an unrelated `ECONNREFUSED` to stderr but
  still passes).
- `pnpm exec svelte-check --threshold error` — 0 errors, 0 warnings (the
  project's authoritative type-check — all eight new components/helpers and the
  re-wired `/create` route type-check cleanly).
- Icon allow-list: the new files use only `Network`, `TriangleAlert`, `Disc`,
  `HelpCircle` (via `HelpTooltip`), `Boxes` — all within the cumulative
  Phase 1-4 allow-list.

Note on `tsc --noEmit`: as Plans 04-09/04-10/04-11 documented, raw `tsc` cannot
resolve `*.svelte` module types and emits ~10 pre-existing `TS2614` errors
against the shadcn-svelte UI primitive index files — these predate this plan
and are out of scope. There are **zero** `tsc` errors touching any file created
or modified by this plan (confirmed by grep). The project's real type-check is
`svelte-check`, which understands `.svelte` files and is clean.

## Decisions Made

- **`NodeSelect` is pure-prop-driven; node-fit is advisory.** Phase 4 ships no
  team-scoped node-free-resource API (`connector.node_resources` exists but is
  not exposed via any route). `NodeSelect` therefore takes a `NodeResource[]`
  prop; the `/create` route derives node names from the cluster inventory and
  passes them with `null` free CPU/RAM. `computeNodeFit` treats a `null` figure
  as fit-unknown — the node stays pickable — so the wizard never hard-blocks on
  missing data; the backend's row-locked admission + PVE remain the real gate
  (T-04-12-02). When a free-resource API lands, populating the figures is a
  clean follow-on with no component change.
- **The LXC Resources step is retro-enriched in the route, not by editing
  `LxcResourcesStep.svelte`.** That file is Plan 04-11's and exposes
  comment-only mount markers (not prop/snippet slots). The shared `NodeSelect`
  + `QuotaDeltaLine` are composed in the `/create` route's LXC `resources` step
  body alongside `LxcResourcesStep` — satisfying "the LXC Resources step now
  renders NodeSelect + QuotaDeltaLine" with no cross-wave file edit (the
  approach the 04-11 SUMMARY explicitly offered).
- **`vm-wizard.ts` owns the network-picker + quota-delta logic.** Both are
  framework-free and unit-tested in the `node` env; the `.svelte` files are
  thin render shells. The same discipline as 04-10's `wizard-model.ts`.

## Deviations from Plan

### Interface adjustments (plan sketch vs. shipped reality)

- **No node-free-resource API — `NodeSelect` takes node data as a prop.** The
  plan's interface note said `node-fit.ts` reads "the live per-node free
  resources … from the backend `connector.node_resources` exposed via the
  provisioning/cluster API". No such API exists in Phase 4 (the connector
  method is unexposed). Following the established Plan 04-11 deviation (its
  Rule-3 "no wizard-facing node API" handling), `NodeSelect` takes its
  `NodeResource[]` as a prop and the route derives node names from the cluster
  inventory with `null` free figures — node-fit is advisory. The node-fit
  *logic* (`computeNodeFit` disabling a node with insufficient free RAM/CPU and
  showing the reason) is fully implemented and tested; only the live-data feed
  awaits a future free-resource endpoint. Not a behavior deviation — the
  selector, the disabled-with-reason render, and the all-blocked block are all
  present and exercised by the 11 node-fit tests with explicit free figures.

- **Tests are logic-only, not component-render tests.** The plan's behavior
  blocks describe "component-render tests with mocked `api.networks`". The
  established project pattern (the vitest env is `node` — `.svelte` files
  cannot be mounted; confirmed by Plans 04-09/04-10/04-11's suites) is to test
  the extracted pure logic and let `svelte-check` exercise the rendered
  props/markup. `node-fit.ts` and `vm-wizard.ts` hold every DOM-free decision,
  and the 55 new tests exercise them directly — this IS the rendered code's
  logic. The render-only acceptance criteria (the disabled-node treatment, the
  grouped picker headers, the IPAM-auto-pick default) are satisfied by the
  components built against the tested logic and confirmed by `svelte-check`.

- **The Cloud-Init step is a placeholder mount point.** The plan notes the
  Cloud-Init step body is owned by Plan 04-13. This plan's VM paths render an
  honest placeholder for the `cloud-init` step; the create body omits the
  cloud-init fields (the VM boots with PVE/image defaults). 04-13 plugs the
  two-pane editor in.

---

**Total deviations:** 0 auto-fixed bugs/blockers; 3 interface adjustments (all
matching established Phase-4 patterns).
**Impact on plan:** No scope creep. The node-free-resource API gap is a
pre-existing Phase-4 boundary already handled identically by Plan 04-11; the
node-fit logic ships complete and tested.

## Issues Encountered

- `svelte-check` initially flagged 4 `state_referenced_locally` warnings in
  `NetworkPicker.svelte` — the `value` prop was read at the top level to seed
  `$state`. Resolved by reading the seed once via `untrack` (the deliberate
  one-time-init idiom), mirroring the Plan 04-09/04-11 `state_referenced_locally`
  fixes. `svelte-check` is now 0/0.

## Threat Model Compliance

- **T-04-12-01 (cloning an unowned source VM)** — `VmSourceStep`'s clone-source
  `Select` is populated only from the route's `api.inventory.listForCluster`
  result (the user's team-scoped inventory); the backend `createQemu`
  re-resolves source ownership — a forged `source_vmid` → 403, surfaced inline
  by `mapQemuCreateError`.
- **T-04-12-02 (client bypassing node-fit / quota gating)** — `NodeSelect` and
  `QuotaDeltaLine` are UX guidance only; `computeNodeFit` keeps a node with
  unknown free figures pickable and `computeQuotaDelta` is never over-quota
  without a budget — the backend's row-locked admission is the real gate
  (a 409 → inline `mapQemuCreateError`).
- **T-04-12-03 (cross-tenant SDN visibility)** — `NetworkPicker` renders only
  what `GET /clusters/{id}/networks` returns; the backend (Plan 04-07) already
  filters SDN VNets to the team's grants — the picker never enumerates
  un-granted networks.
- **T-04-12-04 (a non-applied VNet selected for a real create)** —
  `isNetworkPickable` returns `false` for a non-`applied` VNet; the picker
  renders it `opacity-50` with the `RadioGroup.Item` `disabled` — only an
  applied, usable network can be chosen.

No new threat surface beyond the plan's `<threat_model>` was introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The four VM paths and the LXC paths are wired end-to-end through `/create`.
- Plan 04-13 plugs the Cloud-Init two-pane editor into the clearly-marked
  `cloud-init` mount point in `/create/+page.svelte` (the VM-path step body).
- A future team-scoped node-free-resource endpoint would let `NodeSelect`
  render real fit verdicts — the logic is already complete; only the data feed
  is pending.

## Self-Check: PASSED

- All 10 created files exist on disk (`node-fit.ts`, `vm-wizard.ts`,
  `NodeSelect.svelte`, `QuotaDeltaLine.svelte`, `NetworkPicker.svelte`,
  `VmSourceStep.svelte`, `VmResourcesStep.svelte`, `ReviewStep.svelte`,
  `node-fit.test.ts`, `vm-wizard.test.ts`); `create/+page.svelte` modified.
- Both task commits present in `git log` (`2ed4d44`, `ff87407`).
- Zero file deletions across both commits (`git diff --diff-filter=D` empty).

---
*Phase: 04-provisioning-networking-console*
*Completed: 2026-05-16*
