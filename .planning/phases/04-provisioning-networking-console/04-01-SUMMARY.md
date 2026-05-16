---
phase: 04-provisioning-networking-console
plan: 01
subsystem: research-spike
tags: [community-scripts, lxc, pct-exec, spike, provisioning]
dependency_graph:
  requires:
    - "Phase 4 RESEARCH.md Assumptions A1/A2/A7 (community-scripts non-interactive execution)"
  provides:
    - "04-SPIKE-community-scripts.md — evidence-backed execution contract for the run_community_script job"
    - "Verdict: GO for LXC-03 — non-interactive deploy path confirmed (not a degraded floor)"
    - "EXEC MECHANISM: pct exec over SSH (the proxmoxer REST /status/exec endpoint returns 501 on PVE 9.1.2)"
    - "Pinned catalog floor commit 369f9013088f19771a1b95c40ee252fd4c16f91b"
  affects:
    - "04-06 (community-scripts catalog backend + two-stage run_community_script job)"
tech_stack:
  added: []
  patterns:
    - "Spike-gated plan: a research doc pins the contract a later implementation plan builds against"
key_files:
  created:
    - .planning/phases/04-provisioning-networking-console/04-SPIKE-community-scripts.md
  modified: []
decisions:
  - "STANDALONE INVOCABLE: no — install/<app>-install.sh scripts source build.func-exported symbols and carry interactive read prompts; the deploy runs the script via lxc-attach inside the new CT with the env block reproduced + affirmative stdin (mirrors upstream build.func)"
  - "EXEC MECHANISM: pct exec over SSH — POST /nodes/{node}/lxc/{vmid}/status/exec returns 501 Not Implemented on PVE 9.1.2 (live-probed); the planned proxmoxer-REST lxc_exec does not exist and must be a shell-out over SSH"
  - "Catalog metadata source moved: community-scripts/ProxmoxVE-Local at scripts/json/<slug>.json (the ProxmoxVE frontend was archived)"
  - "Bundled-catalog floor pinned to commit 369f9013088f19771a1b95c40ee252fd4c16f91b (2026-05-16)"
patterns_established:
  - "Spike findings doc as the implementation contract — 04-06 implements against this, not against the original plan assumptions"
requirements-completed: []
metrics:
  duration: ~7 min
  completed: 2026-05-16
  tasks: 2
  files: 1
---

# Phase 4 Plan 01: Community-Scripts Execution Spike Summary

**Confirmed GO for LXC-03 — community-script install stages are not standalone-invocable, so deploys run the full script via `lxc-attach`/`pct exec` over SSH with a reproduced env block; the proxmoxer-REST `/status/exec` endpoint returns 501 on PVE 9.1.2.**

## Performance

- **Duration:** ~7 min
- **Completed:** 2026-05-16
- **Tasks:** 2 (1 investigation + 1 human-verify checkpoint)
- **Files modified:** 1 (created)

## Accomplishments

- Produced `04-SPIKE-community-scripts.md` (234 lines) answering all 7 gating questions, each with a verdict line and evidence drawn from the live upstream repo and live probes of the project's real PVE 9.1.2 cluster + GUI LXC.
- Resolved Research Assumptions A1, A2, A7.
- Pinned the bundled-catalog floor commit `369f9013088f19771a1b95c40ee252fd4c16f91b`.
- Delivered a concrete stage-2 contract for `run_community_script` (the two-stage job 04-06 implements).

## Task Commits

1. **Task 1: Investigate community-scripts execution mechanics and produce the spike findings document** — `ac8f969` (docs)
2. **Task 2: Human-verify checkpoint** — approved by the user; no commit (verification gate)

**Worktree merge:** `7f25d8d`

## Files Created/Modified

- `.planning/phases/04-provisioning-networking-console/04-SPIKE-community-scripts.md` — community-scripts execution spike findings: install-stage standalone invocability (no), the `pct exec` over SSH mechanism, the metadata JSON field set, the pinned commit, the attribution format, and the go/no-go decision.

## Decisions Made

- **STANDALONE INVOCABLE: no** — `install/<app>-install.sh` scripts depend on `build.func`-exported symbols (`$STD`, `msg_info`, etc.) and `$FUNCTIONS_FILE_PATH`; pihole/nextcloudpi additionally have interactive `read` confirm prompts. The GUI runs the install stage the same way upstream's `build.func` does: `lxc-attach` inside the freshly-created CT with the env block reproduced host-side and affirmative stdin.
- **EXEC MECHANISM: `pct exec` over SSH — chunked output** — `POST /nodes/{node}/lxc/{vmid}/status/exec` returns **501 Not Implemented** on PVE 9.1.2 (live-probed); the LXC subtree exposes no `exec` and no `agent`. The proxmoxer-REST `lxc_exec` sketched in the plan does not exist — 04-06 must shell out via `pct exec` over SSH (GUI LXC → PVE host port 22, confirmed reachable).
- **Catalog metadata source moved** — per-app JSON is now in `community-scripts/ProxmoxVE-Local` at `scripts/json/<slug>.json` (the `ProxmoxVE` frontend was archived).
- **Pinned floor commit** `369f9013088f19771a1b95c40ee252fd4c16f91b` (2026-05-16) as the bundled-catalog snapshot floor.

## Deviations from Plan

None — plan executed as written. The plan's `<interfaces>` block sketched a proxmoxer-REST `lxc_exec`; the spike's purpose was precisely to confirm or correct that shape, and it documented the correction (SSH `pct exec`). This is a spike finding, not a plan deviation.

## Issues Encountered

None. Network egress and live-cluster SSH were both available, so every gating question is evidence-backed with no `[ASSUMED]` markers.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **04-06 (community-scripts catalog backend)** now has a concrete, evidence-backed contract: a two-stage `run_community_script` job whose stage 2 runs the full `ct/<app>.sh` (or install stage) inside the created LXC via `pct exec` over SSH with the `var_*` env block.
- Material change for 04-06 vs. the original plan: the connector method is an SSH shell-out, not a proxmoxer REST call. The catalog module pulls JSON from `ProxmoxVE-Local` at the pinned commit.

---
*Phase: 04-provisioning-networking-console*
*Completed: 2026-05-16*
