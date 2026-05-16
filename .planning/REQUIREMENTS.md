# Requirements: Proxmox Self-Service GUI

**Defined:** 2026-05-14
**Core Value:** Users can self-provision and manage VMs/LXCs on Proxmox through a polished, opinionated UI — without ever needing to open the Proxmox web interface.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases via the Traceability section.

### Authentication & Sessions

- [x] **AUTH-01
**: User can log in with username and password (Argon2id hashed)
- [x] **AUTH-02
**: User session persists across browser refresh (secure cookie)
- [x] **AUTH-03
**: User can log out from any page
- [x] **AUTH-04
**: User can change their own password from a profile page
- [x] **AUTH-05
**: User can manage their stored SSH public keys (add, view, delete)
- [ ] **AUTH-06**: Session expires after configurable idle timeout
- [x] **AUTH-07
**: Admin can create, edit, disable, and delete user accounts
- [x] **AUTH-08**: Admin can assign users to teams (group of users sharing quotas)

### Tenancy & Quotas

- [x] **TENT-01
**: Admin can set per-user quotas (CPU, RAM, disk, count of VMs/LXCs)
- [x] **TENT-02
**: Admin can set per-team quotas (shared across team members)
- [x] **TENT-03
**: User sees own quota usage as progress bars in app header
- [x] **TENT-04
**: User sees live quota delta in the create wizard (e.g., "+2 vCPU, +4 GB RAM")
- [x] **TENT-05
**: System blocks creation when it would exceed quota (admission control, not post-hoc)
- [x] **TENT-06
**: User sees only their own (and their team's) VMs/LXCs in the list; admin sees all

### Multi-Cluster Management

- [x] **CLUST-01**: Admin can register multiple Proxmox clusters (URL + API token per cluster)
- [x] **CLUST-02
**: User can switch the active cluster context from a header dropdown
- [x] **CLUST-03
**: Per-cluster reachability indicator visible at all times
- [x] **CLUST-04
**: When a cluster is unreachable, app degrades to read-only with a clear banner — no hard-fail
- [x] **CLUST-05**: Cluster context is part of every resource URL (e.g., `/clusters/{id}/vms/{vmid}`)
- [x] **CLUST-06**: Works against single-node and clustered Proxmox installations

### Inventory & Search

- [x] **INV-01
**: User sees a list of all their VMs and LXCs with status indicators
- [x] **INV-02
**: User can search/filter by name, tag, status, node
- [x] **INV-03
**: User can sort the list by name, status, node, created date
- [x] **INV-04
**: User can view a detail page per VM/LXC (status, vCPU, RAM, disk, IPs, uptime, OS, node, cluster, tags)
- [x] **INV-05
**: User sees live metrics (CPU, RAM, disk I/O, network) on the detail page using Proxmox RRD data
- [x] **INV-06
**: User can tag VMs/LXCs with multi-tag, color-coded labels
- [x] **INV-07
**: User can edit a markdown notes field on each VM/LXC (PVE `description`)
- [x] **INV-08
**: User can view a per-VM activity/task log (recent PVE tasks)

### LXC Provisioning

- [x] **LXC-01
**: User can browse a curated list of community-scripts (`community-scripts/ProxmoxVE`)
- [x] **LXC-02
**: User can browse the full community-scripts catalog with search and category filters
- [x] **LXC-03
**: User can one-click deploy from a community-script (non-interactive mode)
- [x] **LXC-04
**: Script source, version (commit hash), and last-reviewed-date are surfaced before deploy
- [x] **LXC-05**: User can deploy a plain LXC from a vztmpl template
- [x] **LXC-06**: User can pick target host, storage, network, CPU, RAM, disk in the LXC wizard
- [x] **LXC-07**: User can toggle unprivileged container / nesting / features

### VM Provisioning

- [x] **VM-01
**: User can deploy a VM from a Cloud-Init image (Ubuntu, Debian, Rocky, etc.)
- [x] **VM-02**: User can deploy a VM from an existing PVE template (linked or full clone)
- [x] **VM-03
**: User can deploy a blank VM with a mounted ISO
- [x] **VM-04**: User can clone an existing VM (linked or full)
- [x] **VM-05
**: User can edit Cloud-Init config in a two-pane editor (form + live YAML preview)
- [x] **VM-06
**: Cloud-Init editor surfaces all derived values (PVE-injected included) so user knows exactly what gets set
- [x] **VM-07
**: Cloud-Init schema validation runs before submit
- [x] **VM-08
**: User can browse an ISO library across storages (with URL-download for new ISOs)
- [x] **VM-09**: User can pick target host, storage, network, CPU, RAM, disk in the VM wizard
- [x] **VM-10**: Wizard shows real-time quota delta and node fit hints (e.g., "won't fit on node-1")

### Networking (SDN)

- [x] **NET-01
**: System lists Proxmox SDN zones, VNets, and subnets in the network picker
- [x] **NET-02
**: Admin can scope which SDN zones/VNets a team can see and use
- [x] **NET-03
**: Network picker auto-picks a free IP from IPAM where available
- [x] **NET-04
**: Fallback: legacy bridge selection still works for non-SDN setups

### Lifecycle Management

- [x] **LIFE-01**: User can Start, Stop (graceful), Reboot, Shutdown (hard), and Delete VMs and LXCs
- [x] **LIFE-02**: Destructive actions require typed-name confirmation (Delete) or OK/Cancel (Force-Stop)
- [x] **LIFE-03**: User can bulk Start/Stop/Reboot from list (bulk Delete deliberately excluded)
- [x] **LIFE-04
**: User can create, restore, and delete manual snapshots; snapshot tree visible
- [x] **LIFE-05
**: User can create a manual backup (vzdump or PBS target)
- [x] **LIFE-06
**: User can create scheduled backup jobs (systemd-calendar) and view retention
- [x] **LIFE-07
**: User can restore a VM/LXC from a backup
- [x] **LIFE-08
**: User can resize CPU and RAM (warn when reboot required based on hotplug)
- [x] **LIFE-09
**: User can grow disk online (shrink explicitly unsupported, warn user)
- [x] **LIFE-10
**: User can clone a VM (linked or full, pick target node) and convert a VM to template
- [x] **LIFE-11
**: User can migrate a VM between cluster nodes (live or offline, surface bwlimit)
- [x] **LIFE-12**: Long-running tasks show progress via a Tasks drawer (poll UPID, surface stderr)
- [x] **LIFE-13**: Failed tasks offer a one-click retry where safe
- [x] **LIFE-14**: Orphaned tasks (UPIDs from before a restart) are re-attached on app boot

### Console

- [x] **CON-01
**: User can open an embedded noVNC console in an iframe for any VM/LXC they own
- [x] **CON-02
**: vncticket is generated on user click (not page load) and refreshed before expiry
- [x] **CON-03
**: Console works through the GUI's reverse-proxied WebSocket (no direct Proxmox exposure required to the browser)

### REST API

- [x] **API-01**: REST API exposes every UI capability (UI consumes the same API — no UI-only backdoors)
- [x] **API-02**: API auth via per-user Personal Access Tokens
- [x] **API-03**: OpenAPI spec auto-generated from code and served at a documented path
- [x] **API-04**: Mutating endpoints return `202 Accepted` with a job ID; clients poll job status
- [x] **API-05**: API enforces the same quotas and tenancy as the UI

### Audit Log

- [x] **AUDIT-01
**: Every API mutation writes an audit entry (timestamp, actor, action, target, result, source IP)
- [x] **AUDIT-02
**: Config changes record a before/after diff in the audit log
- [x] **AUDIT-03
**: Admin can view the full audit log with date-range and filter controls
- [x] **AUDIT-04
**: User can view their own audit entries
- [x] **AUDIT-05
**: Audit log supports CSV export
- [ ] **AUDIT-06**: Audit log has retention/rotation policy (configurable, default 1 year)

### UI/UX Baseline

- [x] **UI-01
**: Modern Hetzner-Cloud-style aesthetic (clean, whitespace, cards, wizard flows)
- [x] **UI-02
**: Light + dark mode with system preference detection
- [ ] **UI-03**: Mobile-responsive (list, detail, and console reflow; wizards may be desktop-only)
- [x] **UI-04**: Distinct empty states with CTAs (e.g., "You have no VMs yet — Create one")
- [x] **UI-05**: Inline help (`?` icons) for every PVE-specific field with link to docs
- [x] **UI-06
**: Error messages map PVE errors to human-readable text (no raw "operation failed")
- [x] **UI-07**: In-app notification bell shows task completions

### Deployment

- [x] **DEPLOY-01
**: One-line helper-script install: `bash -c "$(curl -fsSL …/install.sh)"`
- [x] **DEPLOY-02
**: Installer is idempotent (re-running it does not corrupt state)
- [x] **DEPLOY-03
**: Helper-script provisions a single LXC running the full stack (backend, frontend, DB, job worker)
- [ ] **DEPLOY-04**: Self-update path from inside the app (or via helper-script flag)
- [x] **DEPLOY-05
**: First-run wizard collects the first admin user and the first cluster connection

## v2 Requirements

Deferred to a future release. Tracked but not in current roadmap.

### Authentication

- **AUTH2-01**: OIDC/SSO login (Authentik, Keycloak, Google)
- **AUTH2-02**: 2FA / WebAuthn for local users

### Features

- **V2-01**: Firewall rule management (currently read-only via Proxmox UI)
- **V2-02**: Billing / cost tracking (currently substituted by quota visualization)
- **V2-03**: Custom console implementation (WebSocket + xterm.js) replacing iframe noVNC
- **V2-04**: Templated multi-VM "stacks" (CloudFormation-style)
- **V2-05**: In-browser SSH terminal
- **V2-06**: Built-in monitoring / alerting rules
- **V2-07**: Plugin / extension system
- **V2-08**: Multi-region replication / disaster recovery orchestration
- **V2-09**: Built-in image building (Packer-like)
- **V2-10**: Email notifications

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Storage pool / ZFS / LVM management | Admin-level, dangerous, Proxmox UI handles it well |
| Cluster formation / node join | Proxmox cluster setup is one-time admin work — out of scope |
| ZFS pool / RAID / disk-level operations | Same as storage management — PVE UI |
| Per-tenant private SDN zone provisioning | SDN topology is admin-defined in PVE; portal consumes it |
| Multi-hypervisor support (VMware, XCP-ng, Hyper-V) | Proxmox-only by design — abstraction is the rabbit hole |
| Kubernetes / container-orchestration abstraction | Pets, not cattle — different product |
| Provisioning new Proxmox nodes | The GUI consumes a cluster, it doesn't build one |
| Bulk Delete | Catastrophic error surface; one misclick destroys a fleet |
| Live-edit of VM hardware beyond PVE's support | Don't fight the platform; surface reboot requirement instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete (01-05) |
| AUTH-02 | Phase 1 | Complete (01-05) |
| AUTH-03 | Phase 1 | Complete (01-05) |
| AUTH-04 | Phase 1 | Complete (01-05) |
| AUTH-05 | Phase 1 | Complete (01-05) |
| AUTH-06 | Phase 5 | Pending |
| AUTH-07 | Phase 1 | Complete (01-07) |
| AUTH-08 | Phase 1 | Complete (01-06, 01-07) |
| TENT-01 | Phase 2 | Pending |
| TENT-02 | Phase 2 | Pending |
| TENT-03 | Phase 2 | Pending |
| TENT-04 | Phase 2 | Pending |
| TENT-05 | Phase 2 | Pending |
| TENT-06 | Phase 2 | Pending |
| CLUST-01 | Phase 1 | Complete (01-06) |
| CLUST-02 | Phase 2 | Pending |
| CLUST-03 | Phase 2 | Pending |
| CLUST-04 | Phase 2 | Pending |
| CLUST-05 | Phase 1 | Complete (01-06) |
| CLUST-06 | Phase 1 | Complete (01-06) |
| INV-01 | Phase 2 | Pending |
| INV-02 | Phase 2 | Pending |
| INV-03 | Phase 2 | Pending |
| INV-04 | Phase 2 | Pending |
| INV-05 | Phase 2 | Pending |
| INV-06 | Phase 2 | Pending |
| INV-07 | Phase 2 | Pending |
| INV-08 | Phase 2 | Pending |
| LXC-01 | Phase 4 | Pending |
| LXC-02 | Phase 4 | Pending |
| LXC-03 | Phase 4 | Pending |
| LXC-04 | Phase 4 | Pending |
| LXC-05 | Phase 4 | Pending |
| LXC-06 | Phase 4 | Pending |
| LXC-07 | Phase 4 | Pending |
| VM-01 | Phase 4 | Complete (Plan 04-05 backend + 04-12 cloud-image wizard path) |
| VM-02 | Phase 4 | Complete (Plan 04-12 template-clone wizard path) |
| VM-03 | Phase 4 | Complete (Plan 04-05 backend + 04-12 blank-iso wizard path) |
| VM-04 | Phase 4 | Complete (Plan 04-12 vm-clone wizard path) |
| VM-05 | Phase 4 | Pending |
| VM-06 | Phase 4 | Pending |
| VM-07 | Phase 4 | Pending |
| VM-08 | Phase 4 | Pending |
| VM-09 | Phase 4 | Complete (Plan 04-12 VM Resources step) |
| VM-10 | Phase 4 | Complete (Plan 04-12 node-fit selector + quota-delta line) |
| NET-01 | Phase 4 | Complete (Plan 04-07 backend + 04-12 SDN network picker) |
| NET-02 | Phase 4 | Complete (Plan 04-07 backend + 04-14 Networks admin tab) |
| NET-03 | Phase 4 | Complete (Plan 04-07 backend + 04-12 IPAM auto-pick in the picker) |
| NET-04 | Phase 4 | Complete (Plan 04-07 backend + 04-12 legacy-bridge fallback in the picker) |
| LIFE-01 | Phase 3 | Complete (Plan 03-02) |
| LIFE-02 | Phase 3 | Complete (Plan 03-02) |
| LIFE-03 | Phase 3 | Complete (Plan 03-02 + 03-06 frontend) |
| LIFE-04 | Phase 3 | Complete (Plan 03-03 + 03-06 frontend) |
| LIFE-05 | Phase 3 | Complete (Plan 03-04) |
| LIFE-06 | Phase 3 | Complete (Plan 03-04) |
| LIFE-07 | Phase 3 | Complete (Plan 03-04) |
| LIFE-08 | Phase 3 | Complete (Plan 03-03 + 03-06 frontend) |
| LIFE-09 | Phase 3 | Complete (Plan 03-03 + 03-06 frontend) |
| LIFE-10 | Phase 3 | Complete (Plan 03-04 + 03-06 frontend) |
| LIFE-11 | Phase 3 | Complete (Plan 03-04 + 03-06 frontend) |
| LIFE-12 | Phase 3 | Complete (Plan 03-02) |
| LIFE-13 | Phase 3 | Complete (Plan 03-02) |
| LIFE-14 | Phase 3 | Complete (Plan 03-01) |
| CON-01 | Phase 4 | Complete (Plan 04-08 backend + 04-14 ConsoleTab) |
| CON-02 | Phase 4 | Complete (Plan 04-08 backend + 04-14 mint-on-click iframe) |
| CON-03 | Phase 4 | Complete (Plan 04-08 relay + 04-14 relay-URL-only iframe) |
| API-01 | Phase 1 | Complete (01-05) |
| API-02 | Phase 1 | Complete (01-05) |
| API-03 | Phase 1 | Complete (01-05) |
| API-04 | Phase 3 | Complete (Plan 03-02) |
| API-05 | Phase 2 | Complete (Plan 02-03) |
| AUDIT-01 | Phase 2 | Pending |
| AUDIT-02 | Phase 2 | Pending |
| AUDIT-03 | Phase 2 | Pending |
| AUDIT-04 | Phase 2 | Pending |
| AUDIT-05 | Phase 2 | Pending |
| AUDIT-06 | Phase 5 | Pending |
| UI-01 | Phase 1 | Complete (Plan 01-03 shell + Plan 01-08 auth gate / login / setup wizard) |
| UI-02 | Phase 1 | Complete (Plan 01-03 theme tokens + Plan 01-08 unauth chrome respects theme) |
| UI-03 | Phase 5 | Pending |
| UI-04 | Phase 4 | Complete (Plan 04-09 EmptyState + /inventory empty state; Plan 04-14 provisioning banner) |
| UI-05 | Phase 4 | Done (Plan 04-09 — HelpTooltip primitive; wizard plans 04-11..13 wire it per field) |
| UI-06 | Phase 3 | Complete (Plan 03-01) |
| UI-07 | Phase 4 | Complete (Plan 04-14 — notification bell + derived completions feed) |
| DEPLOY-01 | Phase 1 | Complete (Plan 01-04) |
| DEPLOY-02 | Phase 1 | Complete (Plan 01-04) |
| DEPLOY-03 | Phase 1 | Complete (Plan 01-04) |
| DEPLOY-04 | Phase 5 | Pending |
| DEPLOY-05 | Phase 1 | Complete (Plan 01-04 helper-script skeleton, Plan 01-07 setup wizard backend, Plan 01-08 4-step setup wizard frontend) |

**Coverage:**
- v1 requirements: 89 total
- Mapped to phases: 89
- Unmapped: 0

**Per-phase totals:**
- Phase 1 (Foundation): 19
- Phase 2 (Multi-Cluster Inventory, Quotas & Audit): 23
- Phase 3 (Job Queue & Lifecycle): 16
- Phase 4 (Provisioning, Networking & Console): 27
- Phase 5 (Polish & Operational Hardening): 4

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 — roadmap traceability mapped (5 phases, 100% coverage)*
