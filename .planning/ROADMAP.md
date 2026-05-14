# Roadmap: Proxmox Self-Service GUI

**Created:** 2026-05-14
**Granularity:** coarse (5 phases)
**Mode:** yolo (no approval gates between phases)
**Coverage:** 89/89 v1 requirements mapped

## Core Value

Users can self-provision and manage VMs/LXCs on Proxmox through a polished, opinionated UI — without ever needing to open the Proxmox web interface.

## Phases

- [ ] **Phase 1: Foundation** — Project scaffold, multi-tenant SQLite schema, local auth, per-cluster encrypted token storage, OpenAPI-backed REST shell, SvelteKit UI skeleton, first-run installer + admin/cluster setup wizard.
- [ ] **Phase 2: Multi-Cluster Inventory, Quotas & Audit** — Cluster connector with circuit breaker, multi-cluster switcher, VM/LXC list/search/detail/RRD metrics, tags + notes + per-VM activity log, per-user/team quotas with admission control, audit log writer + admin/user views with CSV export.
- [ ] **Phase 3: Job Queue & Lifecycle** — arq + Redis queue, UPID polling worker, orphan reaper on boot, Tasks drawer with WebSocket progress, power actions (single + bulk), snapshots, backups (manual + scheduled + restore), resize, clone, migrate, retry-failed, PVE-error-to-human mapping.
- [ ] **Phase 4: Provisioning, Networking & Console** — LXC wizard (plain + curated/community-scripts catalog with commit pinning), VM wizard (Cloud-Init / PVE template / blank+ISO / clone), Cloud-Init two-pane editor, ISO library, SDN-aware network picker (after SDN spike), node-fit hints, embedded noVNC reverse-proxy + iframe (after vncticket spike), notification bell, empty states, inline help.
- [ ] **Phase 5: Polish & Operational Hardening** — Mobile responsiveness audit, accessibility pass, idle session timeout, audit log retention/rotation, in-app self-update path, helper-script v1 polish, packaging as ready-to-deploy LXC.

## Phase Details

### Phase 1: Foundation
**Goal**: A non-admin user can log in to a freshly installed GUI that holds securely-stored connections to one or more Proxmox clusters; admin can manage user accounts and SSH keys; everything operates on a multi-tenant schema that will not need retrofitting.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-07, AUTH-08, CLUST-01, CLUST-05, CLUST-06, API-01, API-02, API-03, UI-01, UI-02, DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-05
**Success Criteria** (what must be TRUE):
  1. A new operator can run a one-line helper-script and reach a first-run wizard that creates the initial admin user and the first cluster connection.
  2. Any user can log in with username + password (Argon2id), see a Hetzner-style shell with light/dark mode, change their own password, manage their SSH keys, and log out — and the session survives a browser refresh.
  3. An admin can create, edit, disable, and delete users, and assign them to teams.
  4. An admin can register one or more Proxmox clusters (standalone or clustered, PVE 8.x) with URL + per-cluster API token; tokens are stored encrypted; cluster-context appears in every resource URL.
  5. The REST API exposes every shipped capability with auto-generated OpenAPI 3.1 served at a documented path, with Personal Access Token auth working alongside session cookies; the SvelteKit UI consumes the same API.
**Plans**: 10 plans
- [x] 01-01-backend-scaffold-PLAN.md — FastAPI app factory, core primitives (cipher/JWT/passwords/CSRF/db), pyproject, tests *(completed 2026-05-14, 25 files, 33 tests green; SUMMARY: .planning/phases/01-foundation/01-01-backend-scaffold-SUMMARY.md)*
- [x] 01-02-db-schema-PLAN.md — SQLAlchemy 2.0 ORM models for 11 tables + Alembic 0001_initial + schema invariants *(completed 2026-05-14, 19 files, 56 tests green; SUMMARY: .planning/phases/01-foundation/01-02-db-schema-SUMMARY.md)*
- [x] 01-03-frontend-scaffold-PLAN.md — SvelteKit 2 + Svelte 5 + Tailwind v4 + shadcn-svelte init + app shell skeleton + theme store *(completed 2026-05-14, 162 files, 3 tests green; SUMMARY: .planning/phases/01-foundation/01-03-frontend-scaffold-SUMMARY.md)*
- [x] 01-04-deployment-skeleton-PLAN.md — install.sh + bootstrap.sh + systemd units + Caddyfile + key generators (master.key 0400) *(completed 2026-05-14, 10 files, shellcheck-clean + caddy validate ok; SUMMARY: .planning/phases/01-foundation/01-04-deployment-skeleton-SUMMARY.md)*
- [x] 01-05-auth-subsystem-PLAN.md — Login/refresh-rotation/logout/password change/CSRF/PATs/SSH keys (Argon2id + JWT + dual-mode auth) *(completed 2026-05-14, 25 files, 90 tests green; AUTH-01..05 + API-01..03 shipped; SUMMARY: .planning/phases/01-foundation/01-05-auth-subsystem-SUMMARY.md)*
- [x] 01-06-clusters-tenant-bootstrap-PLAN.md — PVE connector + cluster CRUD (incl. POST /clusters/test dry-run) + D-02 transactional tenant bootstrap + team CRUD (DELETE returns 409 when bindings exist per D-04) *(completed 2026-05-14, 19 files, 132 tests green; CLUST-01 + CLUST-05 + CLUST-06 + AUTH-08 shipped; SUMMARY: .planning/phases/01-foundation/01-06-clusters-tenant-bootstrap-SUMMARY.md)*
- [x] 01-07-users-admin-setup-PLAN.md — Admin user CRUD with self-guard + disable revocation + first-run setup wizard backend (D-18 lenient first-run) *(completed 2026-05-14, 13 files, 166 tests green; AUTH-07 + AUTH-08 + DEPLOY-05 shipped; SUMMARY: .planning/phases/01-foundation/01-07-users-admin-setup-SUMMARY.md)*
- [ ] 01-08-frontend-auth-shell-PLAN.md — Auth shell: API client core, route auth gate, login page, 4-step setup wizard (D-19), shared form components (ConfirmByNameDialog, SecretRevealDialog, PasswordInput, FormSummaryAlert)
- [ ] 01-09-frontend-account-PLAN.md — Account self-service: profile (change password + appearance), SSH keys, Personal Access Tokens (show-once dialog)
- [ ] 01-10-frontend-admin-PLAN.md — Admin pages: Users (CRUD + team assignment), Clusters (registration with SEPARATE Test + Register buttons), ClusterStatusPill component + end-to-end operator smoke checkpoint
**UI hint**: yes
**Notes**: Multi-tenancy data model (users, teams, quotas FK columns, per-cluster API token storage) must be in the schema from row one — Pitfall 5 says retrofitting is near-rewrite territory. Decide token-per-cluster vs. per-tenant-token approach via ADR before shipping. Helper-script + LXC template can be a skeleton here; full polish lands in Phase 5.

### Phase 2: Multi-Cluster Inventory, Quotas & Audit
**Goal**: Any logged-in user can browse, search, tag, and annotate the VMs and LXCs they own across all configured clusters; admins see everything; quotas are visible and admission-controlled; every privileged action is auditable.
**Depends on**: Phase 1
**Requirements**: TENT-01, TENT-02, TENT-03, TENT-04, TENT-05, TENT-06, CLUST-02, CLUST-03, CLUST-04, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05, API-05
**Success Criteria** (what must be TRUE):
  1. A user lands on a dashboard showing only their own (and their team's) VMs/LXCs across all clusters, with searchable/sortable list, status indicators, tags, and a detail page showing live CPU/RAM/disk/network metrics from PVE RRD data.
  2. A user can switch the active cluster context from a header dropdown, see a per-cluster reachability pill, and when a cluster goes unreachable the UI degrades to read-only with a clear banner instead of hard-failing.
  3. An admin can set per-user and per-team CPU/RAM/storage/count quotas; the user sees live usage as progress bars in the header and the upcoming create wizard shows the live quota delta.
  4. An admin can view the full audit log with date-range and filter controls and export to CSV; a regular user can view only their own audit entries; every API mutation (including config changes with before/after diffs) is recorded with timestamp, actor, tenant, action, target, result, and source IP.
  5. The REST API enforces the same quota and tenancy rules as the UI — token-based clients cannot bypass admission control or see resources outside their tenant.
**Plans**: TBD
**UI hint**: yes
**Notes**: Builds the cluster connector (proxmoxer + circuit breaker + 30s resource cache + health probe), the cluster registry, and the per-cluster ACL/visibility model that the rest of the project depends on. Quota admission must use DB-level row locking (SELECT FOR UPDATE on aiosqlite) per Pitfall 6 — primitive must exist before any provisioning. Storage and SDN references must be namespaced by cluster_id from the start (Pitfall 11). Audit writer is synchronous-before-return.

### Phase 3: Job Queue & Lifecycle
**Goal**: Users can perform every lifecycle operation on existing VMs/LXCs (power, snapshot, backup, resize, clone, migrate) with live progress, crash-safe task tracking, and human-readable error messages.
**Depends on**: Phase 2
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, LIFE-07, LIFE-08, LIFE-09, LIFE-10, LIFE-11, LIFE-12, LIFE-13, LIFE-14, API-04, UI-06
**Success Criteria** (what must be TRUE):
  1. A user can Start, Stop (graceful), Reboot, Shutdown (hard), and Delete a VM/LXC — with destructive Delete requiring typed-name confirmation and Force-Stop requiring OK/Cancel; bulk Start/Stop/Reboot work from the list (bulk Delete deliberately excluded).
  2. A user can create/restore/delete manual snapshots and see a snapshot tree; create manual + scheduled backups (vzdump or PBS target) with retention; restore a VM/LXC from a backup.
  3. A user can resize CPU and RAM (with reboot-required warnings based on hotplug), grow disk online (with shrink explicitly blocked + explanatory message), clone a VM (linked or full) to any node, convert a VM to a template, and migrate live or offline between cluster nodes with a visible bwlimit control.
  4. Every mutation returns 202 Accepted with a job ID; the Tasks drawer shows live progress streamed via WebSocket from the UPID polling worker; failed tasks expose stderr and offer one-click retry where safe; an app restart mid-task does not lose the operation — the orphan reaper re-attaches it on boot.
  5. When a Proxmox operation fails, the user sees a human-readable explanation (e.g. "VM is locked — unlock from detail page") instead of a raw "operation failed" — error mapping covers the common PVE error surface.
**Plans**: TBD
**UI hint**: yes
**Notes**: arq + embedded Redis (or SQLite-queue fallback if Redis is dropped late). UPID polling must treat the first status response as authoritative (Pitfall 2 — fast operations finish before the first poll). UPID must be persisted to DB before the Proxmox call is issued (Pitfall 12 — task state lost on restart). Migration pre-flight must refuse if a referenced cloud-init snippet lives on node-local storage (Pitfall 20) — this hook lives here even though snippets are written in Phase 4. `skiplock` deliberately not exposed in UI (Pitfall 17). Power actions are intentionally the first writes that exercise the full pipeline (per research SUMMARY.md).

### Phase 4: Provisioning, Networking & Console
**Goal**: A user can self-provision LXCs (plain or from a curated community-script with full source/version visibility) and VMs (Cloud-Init image / PVE template / blank+ISO / clone) end-to-end through wizards, on the SDN/bridge they're allowed to use, and open an embedded noVNC console without ever touching the Proxmox UI.
**Depends on**: Phase 3
**Requirements**: LXC-01, LXC-02, LXC-03, LXC-04, LXC-05, LXC-06, LXC-07, VM-01, VM-02, VM-03, VM-04, VM-05, VM-06, VM-07, VM-08, VM-09, VM-10, NET-01, NET-02, NET-03, NET-04, CON-01, CON-02, CON-03, UI-04, UI-05, UI-07
**Success Criteria** (what must be TRUE):
  1. A user can browse a curated list and full searchable catalog of community-scripts, see the script source + commit hash + last-reviewed date before deploy, one-click deploy a non-interactive install, and also deploy a plain LXC from a vztmpl template — picking host, storage, network, CPU/RAM/disk, unprivileged/nesting/features.
  2. A user can launch a VM creation wizard with four paths (Cloud-Init image, PVE template clone, blank+mounted ISO, existing-VM clone), browse an ISO library across storages with URL-download for new ISOs, and edit Cloud-Init in a two-pane form/live-YAML editor that shows every derived value (including PVE-injected defaults) and runs schema validation before submit.
  3. The network picker enumerates SDN zones/VNets/subnets the team is scoped for (with admin-controlled visibility), falls back to legacy bridges for non-SDN clusters, and can auto-pick a free IP from IPAM where available — and the wizard shows real-time quota delta and node-fit hints (e.g. "won't fit on node-1").
  4. A user can open an embedded noVNC console in an iframe for any VM/LXC they own; the vncticket is minted server-side on click (never on page load), refreshed before expiry, and all console traffic flows through the GUI's reverse-proxied WebSocket — no direct Proxmox exposure to the browser is required.
  5. Empty list states show actionable CTAs ("You have no VMs yet — Create one"), every PVE-specific wizard field has a `?` tooltip linking to docs, and a notification bell surfaces task completions in real time.
**Plans**: TBD
**UI hint**: yes
**Notes**: **SDN integration has MEDIUM-LOW research confidence (research SUMMARY.md Open Questions)** — a dedicated SDN spike must precede implementation, covering reload/applied-state polling, version floor, and partial-node-offline behavior. **noVNC needs a dedicated spike** for vncticket exact-encoding (must be URL-encoded exactly once — Pitfall 3 + double-encoding gotcha), reverse-proxy WebSocket header forwarding (Upgrade/Connection/proxy_buffering), and self-signed-cert handling. **Community-scripts integration needs its own spike** for non-interactive invocation (whiptail bypass), `pct exec` output streaming, metadata JSON stability, attribution, and commit pinning policy. VMID race must be addressed here via app-level per-cluster lock + reserved-VMID set (Pitfall 1). Cloud-Init must validate that a `content=snippets`-enabled storage exists at cluster onboarding time (Pitfall 4) and call `qm cloudinit update` after every snippet write.

### Phase 5: Polish & Operational Hardening
**Goal**: The product is mobile-usable, secure-by-default for long-lived deployments, self-updating, and packaged for one-line install into a single production-ready LXC.
**Depends on**: Phase 4
**Requirements**: UI-03, AUTH-06, AUDIT-06, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. The list, detail, and console views reflow on mobile (wizards may remain desktop-only) and pass an accessibility check against shadcn-svelte defaults.
  2. User sessions expire after a configurable idle timeout, and the user is shown a clean re-auth flow rather than a 401 wall.
  3. The audit log retention/rotation policy is configurable (default 1 year) and old entries are rolled to compressed files without manual intervention.
  4. An operator can self-update the GUI from inside the app (or via the helper-script flag) without manual file edits, and the helper-script install produces a clean, ready-to-deploy LXC on first run and every subsequent run (idempotent).
**Plans**: TBD
**Notes**: This phase is intentionally small under coarse granularity — it absorbs the last loose UX/operational requirements and lets earlier phases ship without polish overhead. If feedback from earlier phases adds requirements, they land here.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/10 | Executing | - |
| 2. Multi-Cluster Inventory, Quotas & Audit | 0/TBD | Not started | - |
| 3. Job Queue & Lifecycle | 0/TBD | Not started | - |
| 4. Provisioning, Networking & Console | 0/TBD | Not started | - |
| 5. Polish & Operational Hardening | 0/TBD | Not started | - |

## Cross-Cutting Concerns

These themes recur across phases and should be honored by every plan:

- **Multi-tenancy:** Schema-level from Phase 1; ACL enforcement at the connector layer in Phase 2; re-verified on every WebSocket push.
- **Crash-safe async:** UPID persistence + orphan reaper from Phase 3; no in-memory-only operation state.
- **Audit-everything:** Audit writer goes live in Phase 2 and remains a synchronous pre-return step for every mutation in subsequent phases.
- **Degrade-don't-fail:** Circuit breaker per cluster from Phase 2; read-only banner replaces hard errors throughout.
- **API parity:** UI consumes the same REST API as automation clients in every phase — no UI-only backdoors.

## Research Spikes (Block Phase 4)

Three sub-phase research spikes are required before Phase 4 implementation:

1. **SDN spike** — Exact API call sequence for create-VNet → apply → poll-applied through proxmoxer; reload behavior with one node offline; PVE version floor.
2. **noVNC proxy spike** — vncticket single-encoding verification on a live PVE 8.x cluster; required WebSocket headers; self-signed cert handling in Python.
3. **Community-scripts execution spike** — Non-interactive invocation of whiptail-using scripts; `pct exec` output streaming; metadata format stability; attribution format.

These should be planned at the start of Phase 4 (or earlier as discrete plans) and gate the implementation work.

---
*Roadmap created: 2026-05-14*
