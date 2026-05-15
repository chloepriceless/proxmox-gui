---
phase: 02-multi-cluster-inventory-quotas-audit
plan: "07"
subsystem: operator-smoke-test
tags: [smoke-test, multi-tenant, privsep, quotas, audit, inventory]
dependency_graph:
  requires: ["05", "06"]
  provides: [phase-2-verified]
  affects: []
result: "PASS with findings — Checkpoints 1-5 verified against a real PVE 9.1 cluster; 4 bugs found and fixed, UX/design findings logged for follow-up"
---

# Plan 02-07 — Operator Smoke Test — SUMMARY

Operator smoke test of the full Phase 2 stack against the user's real
Proxmox VE **9.1** cluster (`192.168.20.240`), GUI running in an LXC at
`192.168.20.171`. Run conversationally (not via `gsd-execute-phase`).

## Checkpoint results

| # | Checkpoint | Verdict | Notes |
|---|---|---|---|
| 1 | Boot stack + first page render | **PASS** | api/frontend/caddy all active; login + shell render OK. |
| 2 | Inventory list + detail + tags/notes/metrics | **PASS** | VMs list correctly; tag + notes round-trip works; detail metrics polished mid-test (see findings). |
| 3 | Audit log + filters + CSV export + cluster degradation | **PASS** | Audit entries, filters, CSV all OK. Cluster-unreachable degradation + recovery verified by blackhole-routing the PVE API from the LXC. |
| 4 | Quota admin flow (limits / aggregate / audit row) | **PASS** | Quotas tab, save, aggregate footer, `quota.update` audit row all OK. |
| 4b | QuotaIndicator yellow/red + D-12 lower-anyway dialog | **NOT EXERCISED** | Needs a non-admin member with real usage in a team pool — deferred. |
| 5 | Cross-tenant isolation | **PASS** | Verified at two layers: each privsep team token sees *exactly* its own pool (token-level introspection), and `alice` (team Friends) saw only her VM in the UI, not the other tenant's. |
| 5 | API-403 / PAT-equivalence sub-steps | **NOT EXERCISED** | Isolation proven by the above; explicit 403/PAT curl checks deferred. |

## Assumptions

- **A2 (PVE `config.put` for tags/description returns synchronously, no
  UPID):** **CONFIRMED.** Tag and notes writes in Checkpoint 2 applied
  instantly with no job/UPID — no Plan 03 rework needed.
- **Pitfall 8 (personal-team token availability):** **FINDING.** The
  cluster-add path (`bootstrap_all_teams_on_cluster`) bootstraps personal
  teams too, so the first admin's `personal-1` got a token. But
  `create_user` creates each new user's personal team with
  `auto_bootstrap=False` and nothing re-bootstraps it — a user created
  *after* a cluster is registered, who has *only* a personal team, gets no
  `team_cluster_tokens` row at all. Not hit in this run (`alice`/`bob` are
  also in shared teams). Plan 01-06 follow-up.

## Bugs found and fixed during the smoke test

All committed + pushed + redeployed to the live LXC.

| Commit | Bug |
|---|---|
| `5ed4cca` | PVE role `PVEVMUser`→`PVEVMAdmin` — PVE 9 narrowed `PVEVMUser` to read+power; tenants need `VM.Config.*`. |
| `a0338b3` | `register_cluster` never started a health probe — clusters registered after app boot were stuck on status `untested` forever. |
| `fd26061` | **Privsep ACL** — `set_pool_acl` granted the pool role only to the token. A privsep token's effective rights are `intersection(user, token)`; with a permission-less user that is empty, so the team token saw **0 VMs**. Now grants user + token. Same commit: idempotent bootstrap (adopt pre-existing PVE pool/user, recreate token) so reinstalls onto a dirty Proxmox host succeed. |
| `9a06a94` | No team-management UI existed (only `/admin/teams/[id]` detail) — built `/admin/teams` list + `/admin/teams/new` + sidebar link (Plan 01-10 gap). |
| `4b0222e` + `307c21b` | Detail-view metrics polish (readable uptime/bytes, sparkline tooltips + max-label); `/` now redirects to `/inventory` instead of the Phase-1 placeholder. |

## Open findings (for gap-closure / later phases)

- **Plan 01-10 frontend-admin** was never executed. Team list + create are
  now built, but team **delete/disable** from the UI and the **member
  list** on `/admin/teams/[id]` are still missing.
- **Design question — admin visibility.** Inventory is team-membership-
  scoped for *everyone*, admin included; `is_admin` only unlocks
  `/admin/*`. Checkpoint 5 step 7 wrongly assumed the admin has membership
  in the test teams. Decide: accept (admin = team-scoped) or add an admin
  "all resources" overview (the backend already holds the cluster admin
  token). Note: ~37 host VMs in no `gui-team-*` pool are invisible to the
  GUI regardless — that is the pool model working as designed.
- **Pitfall 8** — see Assumptions above.
- **Test debt** — 3 prior-session hotfix commits (`46a104c`, `14940f2`,
  `77f0f55` — `pool:null` / connector routing) shipped without unit tests;
  the smoke test exercised them empirically. Add coverage.
- **Backlog idea (user):** make the hardcoded `gui-team-` PVE object
  prefix configurable so multiple GUI installs (test/prod) can share one
  Proxmox host.

## Phase 5 carryover recommendations

- Rate-limit `/inventory/*` per-Principal (carried from the plan).
- Consider an admin overview / all-resources view.
- A real dashboard at `/` (currently a redirect to `/inventory`).
- ProxMenux Monitor (`:8008`, public OSS) as a design reference for
  detail-card / metrics polish.

## Verdict

Phase 2 is **functionally verified end-to-end against a real PVE 9.1
cluster**: a non-admin team member can log in, see only their team's VMs,
round-trip tags/notes, see quotas, and the cluster degrades + recovers
cleanly. The smoke test did its job — it surfaced four real bugs that would
have hit every deployment. Checkpoint 4b and the explicit Checkpoint 5
API/PAT sub-steps were not exercised; tenant isolation (the security-
critical property) was proven independently at the token level.
