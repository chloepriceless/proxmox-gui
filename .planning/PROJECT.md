# Proxmox Self-Service GUI

## What This Is

A self-hosted Web-GUI for Proxmox in the spirit of Hetzner Cloud — a user-friendly self-service portal where users (not just admins) can provision and manage VMs and LXC containers without ever touching the underlying Proxmox UI. The GUI runs as a standalone LXC container and manages one or multiple Proxmox clusters (standalone or clustered) from a single pane of glass. It's aimed at home-lab and small-team Proxmox operators who want the polish of a cloud provider's self-service portal on their own hardware.

## Core Value

**Users can self-provision and manage VMs/LXCs on Proxmox through a polished, opinionated UI — without ever needing to open the Proxmox web interface.**

If everything else fails, this must work: a non-admin user logs in, picks a template, fills out a short wizard, and gets a running VM/LXC — all without touching Proxmox directly.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. All hypotheses until shipped. -->

**Authentication & Tenancy**
- [ ] Local user accounts (username + password) with admin and regular roles
- [ ] Per-user/team quotas: max CPUs, RAM, storage
- [ ] User sees only own VMs/LXCs; admin sees everything
- [ ] Audit log of all actions (who, what, when) — admin view

**Multi-Cluster Management**
- [ ] Connect to multiple Proxmox instances (standalone or clustered)
- [ ] Cluster switcher in the UI
- [ ] Read-only mode + banner when a cluster is unreachable

**LXC Provisioning**
- [ ] Browse curated list of community-scripts templates (Proxmox VE Helper-Scripts)
- [ ] Browse full community-scripts catalog with search
- [ ] One-click deploy from a community-script with sensible defaults
- [ ] Pick target host, storage, network (VLAN/SDN), CPU/RAM/disk

**VM Provisioning**
- [ ] Deploy from Cloud-Init images (Ubuntu, Debian, Rocky, etc.)
- [ ] Deploy from existing PVE templates
- [ ] Deploy as blank VM with mounted ISO
- [ ] Clone existing VMs (linked or full)
- [ ] Custom Cloud-Init editor with full visibility into what gets set (user, SSH keys, network, custom snippets)
- [ ] Pick target host, storage, network (SDN zone/VNet), CPU/RAM/disk

**Lifecycle Management**
- [ ] Start / Stop / Reboot / Delete VMs and LXCs
- [ ] Manual snapshots: create, restore, delete
- [ ] Backup jobs: manual + scheduled (vzdump / PBS integration)
- [ ] Resize CPU / RAM / Disk on existing instances
- [ ] Clone VM / convert VM to template
- [ ] Live + offline migration between cluster nodes
- [ ] Embedded noVNC console (iframe)

**Networking**
- [ ] Full Proxmox SDN integration (Zones, VNets, Subnets)
- [ ] Admin defines which SDN zones/VNets are available per team/user

**API & Integration**
- [ ] REST API for automation (Terraform, Ansible, scripts)
- [ ] UI uses the same API (no privileged backdoors)

**Deployment**
- [ ] Helper-script install in the style of community-scripts (one-line install)
- [ ] Distributed as a standalone LXC running the full stack

**UI/UX**
- [ ] Modern, Hetzner-Cloud-style aesthetic (clean, whitespace, cards, wizards)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **OIDC/SSO (Authentik, Keycloak, etc.) in v1** — local users sufficient for v1, can add later
- **Full Proxmox UI replacement** — power-user features (storage management, ZFS pools, cluster setup, firewall rules) stay in Proxmox UI
- **Provisioning new Proxmox nodes / cluster formation** — the GUI consumes a Proxmox cluster, it doesn't build one
- **Multi-hypervisor support (VMware, XCP-ng, etc.)** — Proxmox-only by design
- **Per-tenant private SDN zone provisioning** — admin configures SDN in Proxmox, GUI consumes it
- **Container orchestration (Kubernetes-style)** — this manages individual VMs/LXCs, not workloads

## Context

**Operating environment:**
- Targets home-lab and small-team Proxmox installations (Proxmox VE 8.x+)
- Universal across standalone and clustered Proxmox
- Self-hosted, single LXC, owner controls everything

**Domain ecosystem:**
- Proxmox community scripts (formerly `tteck/Proxmox`, now `community-scripts/ProxmoxVE`) are the de-facto LXC template catalog — they will be a first-class integration
- Hetzner Cloud, Vultr, and DigitalOcean self-service flows are the design inspiration
- Existing "Proxmox Manager" extensions have to be installed per-host; this one is cluster-wide and lives outside Proxmox

**Why this exists:**
- The user has a small Proxmox installation and wants the polished self-service experience of large hosters on their own hardware
- Proxmox UI is powerful but admin-oriented; non-admin users find it intimidating
- Existing per-host manager extensions don't fit a cluster mental model

## Constraints

- **Tech stack**: To be selected during research — favor a stack that produces a single, easy-to-package LXC artifact. Rationale: the deployment story (helper-script install) demands minimal install complexity.
- **Compatibility**: Proxmox VE 8.x + Proxmox API v2 (and forward-compatible with 9.x). Rationale: targeting current Proxmox.
- **Deployment surface**: Must run inside a single LXC container with no external dependencies (DB co-located). Rationale: the user wants a true "one container, drop-in" experience.
- **Auth in v1**: Local user/password DB — no external IdP required. Rationale: minimize moving parts for v1; SSO is a deliberate v2.
- **API parity**: UI consumes the same REST API as automation clients — no UI-only backdoors. Rationale: prevents drift between automation and UI capabilities.
- **Networking**: Must work with Proxmox SDN (not just legacy bridges). Rationale: user already uses SDN and wants first-class support.
- **Resilience**: When a managed cluster is unreachable, the GUI degrades to read-only with a clear banner — it must not hard-fail. Rationale: better UX than blank error screens.

## Key Decisions

<!-- Decisions made during initial questioning. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-tenant with quotas in v1 (not just visibility) | User wants Hetzner-style self-service from the start | — Pending |
| Multi-cluster from v1 (not v2) | User has the need now; architecture impact is too large to retrofit | — Pending |
| Full lifecycle (snapshots, backups, migration, resize) in v1 | User wants the UI to be a complete replacement, not just a creator | — Pending |
| Local auth in v1; OIDC deferred | Faster to ship, OIDC adds a non-trivial dependency on an external IdP | — Pending |
| Embedded noVNC via iframe (not custom console) | Fastest path to working console; custom impl deferred | — Pending |
| REST API as the primary contract, UI consumes it | Forces parity, enables Terraform/Ansible from day one | — Pending |
| Helper-script install (dogfooding community-scripts pattern) | Same install UX as the LXCs the tool itself provisions | — Pending |
| Tech stack: TBD via research | User explicitly asked for a recommendation based on current best practices | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-14 after initialization*
