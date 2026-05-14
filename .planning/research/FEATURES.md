# Feature Research

**Domain:** Self-hosted Proxmox VM/LXC self-service portal (Hetzner-Cloud-style UX for home-lab / small-team)
**Researched:** 2026-05-14
**Confidence:** HIGH (cross-referenced commercial cloud consoles, OSS Proxmox tooling, OpenNebula/CloudStack, and Proxmox API/SDN docs)

## Scope Note

The PROJECT.md `Active` list is the *intended* feature surface. This document categorizes those features (and a number of newly-discovered ones) by `Table Stakes` / `Differentiator` / `Anti-Feature`, attaches complexity and dependency information, and notes the Proxmox API surface each one touches. The downstream consumer of this file is the requirements/roadmap author — not the implementer.

## Feature Landscape

### Table Stakes (Users Expect These)

Users will judge the product "broken" or "amateur" if any of these are missing. None of these are differentiators on their own; they are the price of entry for a Hetzner-Cloud-style portal.

| # | Feature | Why Expected | Complexity | Proxmox API Touchpoints | Notes |
|---|---------|--------------|------------|-------------------------|-------|
| TS-1 | **Login / logout, session persistence** | Every multi-user portal has this | LOW | n/a (local DB) | Local user+password per PROJECT constraints. Argon2id, CSRF token, secure cookie. |
| TS-2 | **VM/LXC list with status indicators** | Hetzner, DO, Vultr, OpenNebula Sunstone, PVE all show a list-with-status as the home view | LOW-MED | `GET /cluster/resources?type=vm` | Status: running / stopped / paused / migrating / locked. Color-coded dots + textual status (a11y). |
| TS-3 | **Search / filter by name, tag, status, node** | PVE Datacenter Manager and PDM both ship this; users with >20 VMs will demand it | LOW | `GET /cluster/resources` then client-side or server-side filter | Free-text + faceted filters (status, node, OS, tag). |
| TS-4 | **Power actions: Start / Stop / Reboot / Shutdown** | Universal across every VM portal | LOW | `POST /nodes/{n}/qemu/{id}/status/{start,stop,reboot,shutdown}` and `/lxc/{id}/status/...` | Distinguish graceful shutdown vs hard stop in UI. |
| TS-5 | **Delete VM/LXC with confirmation dialog** | Destructive actions require confirmation in every modern UI | LOW | `DELETE /nodes/{n}/qemu/{id}`, `/lxc/{id}` | Type-the-name confirmation for delete (DigitalOcean pattern). Include "purge backups?" toggle. |
| TS-6 | **VM detail page (resources, IPs, uptime, OS)** | Every cloud console has a "server detail" page with status + metadata | LOW-MED | `GET /nodes/{n}/qemu/{id}/status/current`, `/agent/network-get-interfaces` (for IPs) | Show: status, vCPU, RAM, disk, IPs (v4/v6, public/private), uptime, OS guess, node, cluster, tags. |
| TS-7 | **Live metrics: CPU, RAM, disk I/O, network** | Hetzner shows usage graphs prominently; users expect at-a-glance health | MED | `GET /nodes/{n}/qemu/{id}/rrddata?timeframe={hour,day,week,month,year}` | Use Proxmox's built-in RRD data; no need to ship Prometheus in v1. |
| TS-8 | **VM creation wizard (multi-step)** | Hetzner, DO, Linode, Vultr, OpenNebula, AWS all use a wizard pattern | MED-HIGH | `POST /nodes/{n}/qemu`, `/lxc` | Steps: location/cluster -> template/OS -> size -> networking -> auth (SSH/cloud-init) -> review. Real-time pricing/quota deduction visible at every step. |
| TS-9 | **LXC creation wizard (separate from VM)** | LXC vs VM is a meaningful distinction in Proxmox; two flows reduces cognitive load | MED | `POST /nodes/{n}/lxc` | Same wizard pattern as VM. Surfaces unprivileged toggle, nesting, features. |
| TS-10 | **OS image / template picker with logos** | Hetzner shows distro logos; users scan visually | LOW | `GET /nodes/{n}/storage/{s}/content` (filter type=iso/vztmpl), `GET /pools` for templates | Curate: show distro logos, friendly names, version, "official"/"community" badge. Hide raw filenames. |
| TS-11 | **SSH key management** | Universal — every cloud portal has an SSH key store | LOW-MED | n/a (local DB) -> injected into cloud-init/lxc setup | Per-user key store + ability to pick stored key during create. Validate public key format. |
| TS-12 | **Embedded noVNC console (iframe)** | Browser-based console is standard since DO/Linode/Hetzner all ship it | MED | `POST /nodes/{n}/qemu/{id}/vncproxy` -> ticket -> `wss://...vncwebsocket?port=...&vncticket=...` | Proxmox tickets must be set as `PVEAuthCookie` on the iframe domain. Re-auth flow when ticket expires (~2h). Twice-encode VNC ticket. |
| TS-13 | **Status feedback for long-running tasks** | Cloning, backups, migrations take minutes; silent "spinning forever" is unacceptable | MED | `GET /nodes/{n}/tasks/{upid}/status`, `/log` | Toast for kick-off + dedicated "Tasks" drawer/panel. Poll task status every 1-2s. Surface stderr from PVE. |
| TS-14 | **Error messages that mean something** | "Something went wrong" infuriates users; surface API errors meaningfully | LOW | All endpoints return structured errors | Map common PVE errors (e.g., `storage 'X' does not exist`, `VMID 100 already used`) to human messages. |
| TS-15 | **Confirmation dialogs on destructive actions** | Delete, restore-snapshot, restore-backup, force-stop all need confirms | LOW | n/a (UI layer) | Pattern: typing-VM-name for delete, simple OK/Cancel for others. |
| TS-16 | **Manual snapshots (create, list, restore, delete)** | Vultr, Linode, Hetzner all have snapshots; PVE has them natively | LOW-MED | `POST /nodes/{n}/qemu/{id}/snapshot`, `GET /snapshot`, `POST /rollback`, `DELETE /snapshot/{name}` | Include "snapshot RAM" toggle for VMs. Show snapshot tree (PVE supports nesting). |
| TS-17 | **Backups (manual + scheduled, view, restore)** | Hetzner sells weekly backups as standard; users expect at minimum manual backup | MED | `POST /nodes/{n}/vzdump`, `GET /cluster/backup`, `POST /cluster/backup` | Support PVE-local storage AND PBS as targets. Schedule via systemd-calendar format (PVE-native). Show retention. |
| TS-18 | **Resize (CPU / RAM / Disk)** | Hetzner has an explicit Rescale button; standard cloud feature | MED | `PUT /nodes/{n}/qemu/{id}/config`, `/lxc/{id}/config`, disk: `PUT /nodes/{n}/qemu/{id}/resize` | Disk grow is online; shrink is unsupported (warn the user). RAM/CPU change may require restart depending on hotplug config. |
| TS-19 | **Tags / labels on VMs/LXCs** | PVE itself supports tags; filtering by tag is a baseline organization feature | LOW | Read/write `tags` field in VM/LXC config | Multi-tag, color-coded. Display in VM list. Allow filter-by-tag. |
| TS-20 | **Profile / settings page (password change, SSH keys)** | Self-explanatory | LOW | n/a | Argon2id rehash on password change. |
| TS-21 | **Real-time cluster/node reachability indicator** | When a cluster goes offline the user must immediately understand "not my VM's fault" | LOW-MED | `GET /version` (cheap ping per cluster every N s) | Per PROJECT constraint: degrade to read-only + banner. Don't hard-fail. |
| TS-22 | **Light + dark mode** | 2026 baseline; users will complain about its absence | LOW | n/a | CSS variables + system preference detection. |
| TS-23 | **Mobile-responsive UI (minimum: read-only check)** | Users want to glance at their fleet from a phone | MED | n/a | Wizards can be desktop-only; the list, detail, console should reflow. |
| TS-24 | **Pagination / virtualized list for large fleets** | Users with 50+ VMs expect a list that doesn't lag | LOW-MED | `GET /cluster/resources` (returns all; paginate client-side) | Either pagination or virtualized scrolling. |
| TS-25 | **Activity / task log (per-VM)** | "What happened to my VM yesterday?" is a common question | LOW | `GET /nodes/{n}/tasks?vmid={id}` | Per-VM tab showing recent PVE tasks (start, stop, backup, snapshot, migrate, edit). |
| TS-26 | **Notifications (in-app)** | When a backup completes 20 min after kicking it off, the user wants to know | LOW-MED | Driven from task polling | In-app bell + optional email (deferred). Per-event read/unread state. |
| TS-27 | **Help / docs link inline with controls** | "What does 'unprivileged container' mean?" — tooltip + docs link | LOW | n/a | Inline `?`-icons for every PVE-jargon field. |
| TS-28 | **Logout / session timeout** | Security baseline | LOW | n/a | Idle timeout configurable. |
| TS-29 | **Empty states with CTAs** | "You have no VMs yet" + Create button is the modern empty-state pattern | LOW | n/a | First-run experience, especially for new users with quota=0 (block creation + show admin contact). |

### Differentiators (Competitive Advantage)

These features go beyond the table stakes and are where this product wins vs. raw Proxmox UI, ProxmoxAAS, CloudMox, MultiPortal, and PDM. Most align directly with the PROJECT.md `Active` list.

| # | Feature | Value Proposition | Complexity | Proxmox API Touchpoints | Notes |
|---|---------|-------------------|------------|-------------------------|-------|
| D-1 | **Curated community-scripts catalog with one-click LXC deploy** | The single biggest UX win over raw PVE; nothing else in the market does this in a portal | HIGH | `POST /nodes/{n}/lxc` + script execution inside container post-create | Mirror the `community-scripts/ProxmoxVE` metadata.json catalog. Show categories (Home Auto, Media, Networking, DB, Monitoring), distro/RAM/CPU defaults, popularity. Run the install script via `pct exec` after LXC is created. Curated "featured" subset vs full browse. |
| D-2 | **Cloud-Init editor with full visibility into resulting config** | Existing portals (DO, Hetzner) accept a YAML blob; users have no idea what gets injected. This product shows it. | HIGH | `GET/PUT /nodes/{n}/qemu/{id}/config` (ciuser, cipassword, sshkeys, ipconfig, nameserver, searchdomain), `/cloudinit` dump endpoint | Two-pane: form (user, keys, packages, runcmd, write_files) on left, live YAML preview on right. Validate via `cloud-init schema`. Show *all* derived values (PVE auto-injects some) — including the network config Proxmox generates from `ipconfig0`. |
| D-3 | **Multi-cluster switcher (Hetzner-project-style)** | The home-lab user with multiple PVE installs gets a single pane of glass; PDM does this but is admin-oriented, not self-service | MED-HIGH | Per-cluster auth tokens + `GET /cluster/status`, `/cluster/resources` | Header dropdown to switch cluster context. "All clusters" view for power users. Per-cluster connection health badge. Read-only banner on unreachable cluster. |
| D-4 | **Per-user/team quota visualization** | ProxmoxAAS exists but is admin-oriented; this surfaces quota usage *to the user* before they hit a limit | MED | Sum of `GET /cluster/resources` filtered by owner (local DB owner mapping) | Progress bars in header + on the create wizard: "Using 6 of 16 vCPUs", "Using 18 of 64 GB RAM", "Using 250 of 500 GB". Yellow at 80%, red at 95%. Block creation when over. Admin sees same view per-user/team. |
| D-5 | **Audit log views (admin + user-scoped)** | Most portals only show this to admins. Users seeing their own action history is reassuring. | MED | Written to local DB at every API mutation | Schema: timestamp, actor, action, target (VM/LXC/cluster/user), result, before/after diff for config changes, IP. Admin: full log. User: their own actions. Filter by date range, action type, target. CSV export. |
| D-6 | **One-flow "from template" deploy with sensible defaults** | Hetzner's wizard pre-selects sane defaults so a user can click `Create` immediately. This product applies that to PVE template deploys. | MED | `POST /nodes/{n}/qemu/{id}/clone` (linked clone for templates) | "Quickstart" mode: pick template -> name -> click create. Advanced mode: tweak any field. |
| D-7 | **Live + offline migration UI** | PVE supports it; doing it from a portal with progress + node-pick is unusual outside enterprise | MED | `POST /nodes/{n}/qemu/{id}/migrate` (online=1 for live), `/lxc/{id}/migrate` (restart-on-migrate for LXC) | Show source node, pick target node (with resource-fit hint), preview type (live vs offline). Surface bwlimit option. |
| D-8 | **Real-time pricing/quota delta in the wizard** | Hetzner shows "this will cost €X.XX/mo" live; we substitute *quota delta* for cost (since self-hosted) | LOW-MED | n/a (local calc) | As user adjusts CPU/RAM/disk in wizard, show "Will use: +2 vCPU, +4 GB RAM, +20 GB disk" + projected new totals + green/red against quota. |
| D-9 | **Clone + convert-to-template UI** | PVE supports both natively; surfacing them clearly is rare | LOW-MED | `POST /clone`, `POST /template` | Two distinct actions in the VM detail page. Clone: linked vs full, target name, target node. |
| D-10 | **SDN-aware network picker (Zones / VNets / Subnets)** | Most portals only expose flat bridges. PVE SDN is a key user requirement. | MED-HIGH | `GET /cluster/sdn/zones`, `/vnets`, `/subnets`, `/ipams` | Show: zone (with type badge: simple/VLAN/QinQ/VXLAN/EVPN), VNet, subnet. Admin scopes which zones/VNets are visible per team. Auto-pick free IP from IPAM where available. |
| D-11 | **Helper-script one-line install** | Dogfoods the same UX as the LXCs the tool provisions; PROJECT.md explicit requirement | MED | n/a (install-side) | `bash -c "$(curl -fsSL .../install.sh)"`. Idempotent. Self-update path. Installs the GUI's own LXC and stores config inside it. |
| D-12 | **First-class REST API (UI consumes it)** | Per PROJECT constraint; enables Terraform/Ansible from day 1; rare for a "GUI tool" to make this a primary contract | MED-HIGH | Proxies to Proxmox where it makes sense; owns user/quota/audit endpoints | OpenAPI spec generated from code. Token-based auth (per-user PATs). |
| D-13 | **Auto-detect & re-attempt of failed long tasks** | Improves trust in long-running migrations/backups | MED | Task watcher service + retry policy | Surface "task failed, retry" affordance with one click; preserve user-friendly error context. |
| D-14 | **Bulk power actions** | "Stop all my dev VMs" is a real homelab need | LOW-MED | Iterate `/status/...` calls; show aggregate task panel | Multi-select in list view -> bulk Start/Stop/Reboot. Refuse Delete-bulk in v1 (anti-feature; see below). |
| D-15 | **Favorites / pinned VMs** | PDM has it; helps users with 30+ VMs | LOW | Local DB | Star icon on list rows, "Favorites" filter chip. |
| D-16 | **In-wizard cluster + node fit hint** | "This template won't fit on node-1 (full); will deploy to node-2" — saves frustrating failures | LOW-MED | `GET /nodes` (capacity) + simple bin-fit heuristic | Show greyed-out nodes with reason ("not enough RAM", "no access"). |
| D-17 | **VM/LXC notes (markdown)** | PVE has Notes natively; rendering as markdown beats plain text | LOW | PVE config `description` field | Markdown preview/edit, hyperlinks safe. |
| D-18 | **ISO library browser** | Listing+previewing ISOs across storage targets, with upload from the portal | MED | `GET /nodes/{n}/storage/{s}/content?content=iso`, `POST .../upload` | URL-download (PVE supports `download-url`) for big ISOs. |
| D-19 | **PVE template library view** | Templates currently buried in the PVE UI; surface them like Hetzner "snapshots" | LOW | `GET /cluster/resources?type=vm` filtered by `template=1` | Sortable, with "Use as base" CTA -> wizard pre-fill. |

### Anti-Features (Deliberately NOT Built)

These exist in either Proxmox or competing portals. Each is deliberately excluded with a documented reason. The PROJECT.md "Out of Scope" list is the source of truth; this expands and operationalizes it.

| # | Anti-Feature | Why Requested / Surface Appeal | Why Problematic for This Product | Alternative |
|---|--------------|--------------------------------|----------------------------------|-------------|
| AF-1 | **Storage pool / ZFS / LVM management** | Power users want one tool for everything | These are admin tasks; require root, are dangerous, and Proxmox UI already does this well. Replicating it = 6x scope. | Direct users to PVE UI; surface storage *capacity* read-only in the portal. (PROJECT.md Out of Scope.) |
| AF-2 | **Cluster formation / node join** | "Provision Proxmox from scratch" sounds like a complete experience | Out-of-scope per PROJECT.md. Cluster formation is a one-time admin operation done over SSH/PVE shell; building UI for it is enormous and rarely used. | Document "bring your own Proxmox cluster". |
| AF-3 | **ZFS pool / RAID / disk-level operations** | Homelabbers care about disks | Same as AF-1: PVE does this; doing it wrong destroys data. | Out of scope; PVE UI. |
| AF-4 | **Firewall rule management** | Hetzner has it; users will ask | PVE has a *very* expressive cluster/host/VM firewall — building a "good enough" UI risks getting it wrong and creating a security hole. Reuse PVE firewall config; surface read-only. | Read-only show of attached firewall, link to PVE UI. (Could become a v2 feature after validation.) |
| AF-5 | **Per-tenant private SDN zone provisioning** | Multi-tenant means each team gets its own VXLAN, etc. | Per PROJECT.md Out of Scope. SDN topology is admin-defined in PVE; the portal consumes it. Building dynamic zone-creation logic is highly invasive. | Admin pre-creates zones in PVE; portal exposes a subset per team. |
| AF-6 | **Multi-hypervisor support (VMware, XCP-ng, Hyper-V, KVM-direct)** | "Why not abstract more?" | PROJECT.md: Proxmox-only by design. Each hypervisor has its own API quirks; abstraction is the rabbit hole that killed countless similar projects (e.g., OpenStack's complexity). | Stay focused: Proxmox is enough. |
| AF-7 | **OIDC/SSO (Keycloak, Authentik) in v1** | "We use Authentik for everything!" | Per PROJECT.md, deferred to v2. Adds external IdP dependency, changes auth model significantly, and is not blocking for the home-lab use case. | Local users v1; v2 backlog item. |
| AF-8 | **Kubernetes / container-orchestration abstraction** | "Why not make LXCs feel like Pods?" | PROJECT.md Out of Scope. This product is about pets, not cattle. Treating LXCs as ephemeral workloads contradicts the model. | k3s/Talos-on-VMs lives elsewhere. |
| AF-9 | **Billing / invoicing / cost tracking** | CloudMox does it; users hosting friends might want it | Out of scope — this is a self-host tool, not a hosting business panel. Adds significant tax/currency/PDF complexity. | Quota visualization is the substitute; cost tracking is a v2+ idea if a clear user emerges. |
| AF-10 | **Bulk Delete** | "If I can bulk-Start, why not bulk-Delete?" | Catastrophic error surface area; one misclick destroys an entire fleet. Mismatched with "polished self-service" feel. | Force one-at-a-time deletes with typed confirmation. Power users can use the REST API. |
| AF-11 | **In-browser SSH terminal** | "noVNC is slow; give me SSH" | Significant security surface (key handling, MITM proxy, audit). noVNC console covers the rescue case; users with SSH access don't need it in the portal. | Document `ssh user@vm` is the right tool. Maybe v2. |
| AF-12 | **Built-in monitoring / alerting (Prometheus, alerting rules)** | Pulse, Zabbix, etc. do this | Out of scope. PVE provides RRD data; the portal shows it. Real monitoring is a different product. | Show PVE's built-in RRD graphs; document Pulse/Prometheus integration. |
| AF-13 | **Plugin / extension system** | "Let users add features" | Premature for v1. API surface contracts are unstable; plugin systems harden requirements that aren't yet validated. | Defer to v2; first prove the core. |
| AF-14 | **Multi-region replication / disaster recovery orchestration** | Enterprise-y; sounds impressive | Out of scope for home-lab/small-team. PVE has remote-migration; PBS has cross-site sync. Building DR orchestration is a separate product. | PBS handles backup replication; users orchestrate via cron / Ansible. |
| AF-15 | **Live-edit of running VM hardware beyond what PVE supports** | "Add a NIC while running" — PVE limits this depending on hotplug | Don't fight the platform: if PVE requires a reboot, ask the user before applying. | Show "requires reboot" warning + checkbox; apply cleanly. |
| AF-16 | **Templated "stacks" (multi-VM apps with deps, like CloudFormation)** | Powerful, but enormous scope | Out of scope for v1. Terraform via the REST API covers this for power users. | Document Terraform recipe; v2+ feature. |
| AF-17 | **Built-in image building (Packer-like)** | "Make a golden image from this VM" | Convert-to-template (D-9) covers 80%; full Packer-style workflow is its own product. | Convert-to-template is enough for v1. |

## Feature Dependencies

```
[TS-1 Login]
    └──required-by──> ALL features

[TS-21 Cluster reachability]
    └──required-by──> [D-3 Multi-cluster switcher]
                          └──required-by──> [TS-2 VM list (multi-cluster)]

[TS-6 VM detail page]
    └──required-by──> [TS-7 Live metrics]
                  └──> [TS-12 noVNC console]
                  └──> [TS-16 Snapshots]
                  └──> [TS-17 Backups]
                  └──> [TS-18 Resize]
                  └──> [D-7 Migration]
                  └──> [D-9 Clone / Template]
                  └──> [D-17 Notes]
                  └──> [TS-25 Per-VM activity]

[TS-8 VM creation wizard]
    └──requires──> [TS-10 OS image picker]
              └──> [TS-11 SSH key mgmt]
              └──> [D-2 Cloud-Init editor]
              └──> [D-10 SDN picker]
              └──> [D-4 Quota visualization]  // for the live delta in D-8
              └──> [D-16 Cluster/node fit hint]

[TS-9 LXC creation wizard]
    └──requires──> [TS-10 OS image picker]  (vztmpl variant)
              └──> [D-10 SDN picker]
              └──> [D-4 Quota visualization]
              └──> [D-1 community-scripts catalog]  (when "from script" path chosen)

[D-1 community-scripts catalog]
    └──requires──> [TS-9 LXC creation wizard]
              └──> Script-execution mechanism inside container (pct exec)

[D-4 Quota visualization]
    └──requires──> User->VM ownership tracking in local DB
              └──> Multi-tenancy data model

[D-5 Audit log]
    └──requires──> All mutating endpoints write audit entries
              └──> User->VM ownership tracking

[TS-17 Backups]
    └──enhances──> [TS-16 Snapshots]  (different mechanisms, often confused; UI must distinguish)
    └──requires──> PVE storage with backup capability OR PBS remote configured in PVE

[D-12 REST API]
    └──enables──> Everything else (UI is just a client)
    └──requires──> Auth model that supports both session cookies AND PATs

[TS-12 noVNC console]
    └──conflicts──> Cross-origin cookie restrictions in modern browsers
                  (must run on a domain/subdomain that can share cookies with PVE or use proxy)
```

### Dependency Notes

- **D-3 Multi-cluster requires careful design of TS-21:** Cluster health checks must be cheap and concurrent. A naive serial loop over 5 clusters at 5s timeout each = 25s page load. Use parallel health probes with circuit breakers.
- **D-2 Cloud-Init editor depends on understanding what PVE auto-injects:** PVE generates portions of cloud-config from the `cipassword`, `ciuser`, `sshkeys`, `ipconfig0`, `searchdomain`, `nameserver` config fields. The editor must merge user-authored YAML with PVE-derived values so the preview is truthful.
- **D-1 community-scripts integration is the highest-risk single feature:** Catalog format may change; script execution semantics (one-line install vs interactive) must be tamed. See PITFALLS.md.
- **TS-12 noVNC depends on a same-origin or proxied setup:** Either the portal proxies the websocket itself (cleaner) or it forwards the user to a *.pve.local subdomain that shares the auth cookie (fragile). See ARCHITECTURE.md.
- **D-5 Audit log requires every mutating API endpoint to write an entry:** Easiest to enforce via middleware on the REST API layer, not at controller level. Skipping this is the most common cause of audit gaps in similar products.
- **TS-17 backup UI must not pretend to be a backup *engine*:** Configuration of where backups go (PBS remote, NFS, local) is admin-level work done in PVE. The portal schedules and triggers; it does not configure storage targets.

## MVP Definition

### Launch With (v1)

The minimum viable product validates: *can a non-admin user log in, pick a template, fill out a short wizard, and get a running VM/LXC?* (PROJECT.md core value statement.) Anything not required to validate that hypothesis is *not* MVP.

**Authentication / Multi-tenant:**
- [ ] TS-1 Login / logout / session
- [ ] TS-20 Profile (password, SSH keys)
- [ ] TS-28 Logout / session timeout
- [ ] Admin role + regular user role
- [ ] D-4 Quota visualization (basic: CPU/RAM/disk caps per user)

**Cluster connection:**
- [ ] D-3 Multi-cluster switcher (works with 1+ clusters)
- [ ] TS-21 Cluster reachability + read-only banner

**Discovery / list:**
- [ ] TS-2 VM/LXC list with status indicators
- [ ] TS-3 Search / filter
- [ ] TS-6 VM/LXC detail page
- [ ] TS-7 Live metrics (CPU/RAM/disk/net via PVE RRD)
- [ ] TS-19 Tags

**Create flows (the core):**
- [ ] TS-8 VM creation wizard
- [ ] TS-9 LXC creation wizard
- [ ] TS-10 OS image / template picker
- [ ] TS-11 SSH key mgmt
- [ ] D-1 Curated community-scripts (curated subset + browse all)
- [ ] D-2 Cloud-Init editor with preview
- [ ] D-10 SDN-aware network picker
- [ ] D-8 Live quota delta in wizard

**Lifecycle:**
- [ ] TS-4 Power actions
- [ ] TS-5 Delete with confirm
- [ ] TS-15 Confirmation dialogs
- [ ] TS-12 noVNC console embed
- [ ] TS-16 Snapshots (create/list/restore/delete)
- [ ] TS-17 Backups (manual + scheduled, vzdump + PBS targets)
- [ ] TS-18 Resize CPU/RAM/disk
- [ ] D-7 Live + offline migration
- [ ] D-9 Clone + convert-to-template

**UI quality / trust:**
- [ ] TS-13 Status feedback for long-running tasks (toast + task panel)
- [ ] TS-14 Real error messages
- [ ] TS-22 Light/dark mode
- [ ] TS-23 Mobile-responsive (read-only acceptable)
- [ ] TS-25 Per-VM activity log
- [ ] TS-27 Inline help / docs links
- [ ] TS-29 Empty states with CTAs

**Audit / admin:**
- [ ] D-5 Audit log views (admin sees all, user sees own)

**API / Integration:**
- [ ] D-12 REST API (UI consumes it; PAT-based auth)

**Deployment:**
- [ ] D-11 Helper-script one-line install

### Add After Validation (v1.x)

Features that improve the experience but aren't required to validate the core hypothesis. Add once installs are real and feedback is in.

- [ ] TS-24 Pagination/virtualized list — *trigger:* user reports lag with >50 VMs
- [ ] TS-26 In-app notifications panel — *trigger:* users miss task completions
- [ ] D-13 Auto-retry failed tasks — *trigger:* migration-flake reports
- [ ] D-14 Bulk power actions — *trigger:* users say "I have to click 12 times"
- [ ] D-15 Favorites / pinned VMs — *trigger:* user reports list scrolling fatigue
- [ ] D-16 In-wizard cluster/node fit hint — *trigger:* deploy-failures from "node full"
- [ ] D-17 Markdown notes — *trigger:* notes-as-docs requests
- [ ] D-18 ISO library + URL download — *trigger:* users uploading via PVE UI to work around
- [ ] D-19 PVE template library view — *trigger:* template discoverability complaints
- [ ] D-6 "Quickstart" deploy mode (sane defaults, one click) — *trigger:* wizard fatigue feedback

### Future Consideration (v2+)

Genuine v2 features — significant additions that change the product's surface.

- [ ] OIDC/SSO (Keycloak, Authentik) — *defer:* local auth is enough for v1; adds external IdP dependency
- [ ] Email/webhook/Matrix notifications — *defer:* in-app notifications first
- [ ] Custom dashboards / widgets — *defer:* see what users actually pin
- [ ] Read-only firewall display — *defer:* PVE UI is fine for v1
- [ ] Image building (golden images, packer-like) — *defer:* convert-to-template covers most cases
- [ ] Cost / power consumption tracking — *defer:* see if any user actually asks
- [ ] Plugin system — *defer:* API surface must stabilize first
- [ ] Cross-cluster live migration (PDM-style) — *defer:* PDM does this; revisit once API stable
- [ ] Team/group entity (vs flat user list) — *defer:* see if shared-team quota becomes a real ask

## Feature Prioritization Matrix

Top features by value vs. cost. P1 = MVP-blocking, P2 = post-launch, P3 = v2+.

| Feature | User Value | Impl. Cost | Priority |
|---------|------------|------------|----------|
| D-1 community-scripts catalog + one-click | HIGH | HIGH | P1 |
| D-2 Cloud-Init editor with preview | HIGH | HIGH | P1 |
| D-3 Multi-cluster switcher | HIGH | MED | P1 |
| D-4 Quota visualization | HIGH | MED | P1 |
| D-5 Audit log views | MED | MED | P1 |
| D-10 SDN-aware network picker | HIGH | MED | P1 |
| D-11 Helper-script install | HIGH | MED | P1 |
| D-12 REST API | HIGH | MED | P1 |
| TS-8/TS-9 Create wizards | HIGH | HIGH | P1 |
| TS-12 noVNC console | HIGH | MED | P1 |
| TS-16/TS-17 Snapshots + backups | HIGH | MED | P1 |
| TS-18 Resize | HIGH | MED | P1 |
| D-7 Migration | MED | MED | P1 |
| D-9 Clone / template | MED | LOW | P1 |
| D-14 Bulk power actions | MED | LOW | P2 |
| D-15 Favorites | LOW | LOW | P2 |
| D-16 Cluster/node fit hint | MED | LOW | P2 |
| D-17 Markdown notes | LOW | LOW | P2 |
| D-18 ISO library | MED | MED | P2 |
| D-19 Template library view | MED | LOW | P2 |
| OIDC/SSO | MED | HIGH | P3 |
| Firewall read-only | LOW | MED | P3 |
| Cross-cluster live migration | LOW | HIGH | P3 |

## Competitor Feature Analysis

A side-by-side of how this product compares on the key dimensions. "Native" means built into the underlying product; "—" means absent.

| Feature | Proxmox VE UI | PDM (Datacenter Mgr) | ProxmoxAAS | CloudMox | MultiPortal | Hetzner Cloud | This Product |
|---------|---------------|----------------------|------------|----------|-------------|---------------|--------------|
| Self-service for non-admins | Limited (PVE permissions UX is painful) | Read-only admin views | Yes | Yes (SaaS) | Yes | Yes | Yes — first-class |
| Multi-cluster | — (per-cluster only) | Yes | — | Yes | Yes | n/a (single provider) | Yes (v1) |
| Quota visualization for users | — (PVE has quotas but no UI) | — | Yes (basic) | Yes | Yes | Implicit (billing) | Yes — Hetzner-style |
| Cloud-Init editor with preview | Raw YAML field | Raw YAML | Limited | ? | ? | Raw YAML | **Yes — visual + preview (differentiator)** |
| community-scripts one-click | — | — | — | — | — | n/a | **Yes — featured (differentiator)** |
| Embedded noVNC | Native | Native | Yes | Yes | Yes | Yes | Yes (iframe) |
| Snapshots UI | Native | Native (cross-cluster) | Yes | Yes | Yes | Yes | Yes |
| Backups UI (vzdump + PBS) | Native | Native | Limited | Yes | Yes | Native | Yes |
| SDN-aware networking | Native (raw) | Yes | — | ? | Yes | n/a (firewall + VPC) | **Yes — user-friendly picker** |
| Audit log | Limited (cluster log) | Limited | — | ? | Yes | Yes | Yes |
| Helper-script install | n/a | apt/iso | manual multi-component | SaaS only | SaaS | n/a | **Yes (differentiator)** |
| REST API (UI uses same one) | Yes (PVE API) | Yes | Yes | API exists | Yes | Yes | Yes |
| OIDC/SSO | Yes (PAM/LDAP/OIDC) | Yes | Yes | ? | Yes | Yes | **Deferred to v2** |
| Firewall config | Native | — | — | ? | Yes | Yes | **Out of scope (anti-feature)** |
| Cluster formation | Native | — | — | — | — | n/a | **Out of scope (anti-feature)** |
| Storage pool / ZFS mgmt | Native | — | — | — | Limited | n/a | **Out of scope (anti-feature)** |
| Billing | — | — | — | Yes | Yes | Yes | **Out of scope (anti-feature)** |

**Where this product wins:**
1. Curated community-scripts integration (nobody else does this from a portal).
2. Cloud-Init editor that *shows* what gets applied (cargo-cult-killer).
3. Single-LXC helper-script install (dogfoods the script pattern users already trust).
4. Hetzner-Cloud-style polish targeted at home-lab/small-team, not enterprise.
5. SDN-as-a-picker (not a raw bridge dropdown).

**Where this product deliberately *doesn't* compete:**
1. Storage/ZFS/cluster admin (PVE owns it).
2. Multi-hypervisor / VMware/Hyper-V/XCP-ng abstraction.
3. Billing / commercial reseller features (CloudMox owns that niche).
4. Enterprise DR / multi-region orchestration.

## Addressing User-Specified Must-Haves (Explicit)

The question called these out specifically. Each is mapped to its feature row(s) above with explicit detail.

**1. Community-scripts integration (curated + browse all)** → **D-1**
- Curated set: maintain a `featured.json` in this product's repo, sourced from the community-scripts catalog metadata, hand-picked for "homelab essentials" (Home Assistant, Adguard, Pi-hole, Plex/Jellyfin, Nextcloud, Vaultwarden, Uptime Kuma, Grafana, Portainer, etc.).
- Full browse: mirror the catalog (`community-scripts/ProxmoxVE/json/*.json`) or proxy live; faceted filter by category, popularity, distro requirement.
- One-click deploy: kick off LXC create with the script's default config (CPU/RAM/disk/distro from metadata), then `pct exec` the install script inside. Surface output line-by-line in the task drawer.
- Risk: script metadata changes upstream; script behavior is non-deterministic. (See PITFALLS.md.)

**2. Cloud-Init editor with visibility into all set values** → **D-2**
- Two-pane editor: form (left) + live YAML preview (right).
- Form covers: user, password (hashed), SSH keys (pulled from user keystore), packages, write_files, runcmd, bootcmd, hostname, timezone, locale, network (DHCP / static / DHCP+static-DNS).
- Preview shows the *merged* config: user-supplied YAML + PVE auto-derived parts. Annotate which keys are PVE-derived (greyed background) vs user-set.
- Validate via `cloud-init schema --config-file` shelling out, or port the validator to the API.
- Save as snippet: store templates per user; reuse on next create.

**3. noVNC console embed** → **TS-12**
- Use Proxmox's native `vncproxy` ticket flow: `POST /nodes/{n}/qemu/{id}/vncproxy` returns a one-time VNC ticket; the iframe URL takes a `vncticket` param and `PVEAuthCookie` for the user.
- Key constraint: the cookie must be visible to the iframe origin. Two options:
  - **Proxy approach (recommended):** the portal owns the websocket; reverse-proxy the PVE noVNC traffic through the portal's domain. Cleaner cookie domain story; one TLS endpoint to manage.
  - **Subdomain approach:** portal at `gui.lab.local`, PVE at `pve.lab.local`, share `*.lab.local` cookie. Fragile if either domain changes; requires admin DNS work.
- Ticket renewal: every ~2h. Detect 401 from VNC ws and silently re-mint a ticket.
- See PITFALLS.md for browser SameSite / cookie warnings.

**4. Quota visualization per user/team** → **D-4 + D-8**
- Stored in local DB: `quota_cpu`, `quota_ram_mb`, `quota_disk_gb`, `quota_max_instances` (and `quota_max_snapshots`, `quota_max_backups_gb` as v1.x).
- Compute usage from `GET /cluster/resources` filtered by owner (owner mapping: `vm_owner` table joining VMID+cluster -> user).
- UI surfaces:
  - Header progress bars (always visible).
  - Wizard live-delta indicator ("This deploy will use +2 vCPU, +4 GB").
  - Hard block at quota; soft warn at 80% / 95%.
- Admin view: per-user table with bars + edit buttons to change caps.

**5. Multi-cluster switcher** → **D-3**
- Header dropdown (Hetzner "project" selector pattern).
- Per-cluster connection state badge (green/yellow/red).
- "All clusters" union view for power users — VM list spans clusters; group-by-cluster collapsible.
- Cluster config in local DB: hostname, port, token-id, token-secret (encrypted), tls-fingerprint.

**6. Audit log views** → **D-5**
- Schema: `(id, ts, actor_user_id, actor_ip, cluster_id, target_type, target_id, action, params_json, result, before_json, after_json)`.
- Writes happen in REST API middleware — every mutating endpoint.
- User view (`/audit`): filter to `actor_user_id = current` OR `target_owner = current`.
- Admin view (`/admin/audit`): unrestricted. Filters: date range, actor, target, action, cluster. CSV export of filtered view.
- Retention: configurable, default 365 days. Auto-prune.

## Sources

- [Hetzner Cloud Review 2026 - Better Stack Community](https://betterstack.com/community/guides/web-servers/hetzner-cloud-review/)
- [Hetzner Cloud Docs - Creating a Server](https://docs.hetzner.com/cloud/servers/getting-started/creating-a-server/)
- [Hetzner Cloud Basic Cloud Config Tutorial](https://community.hetzner.com/tutorials/basic-cloud-config/)
- [Hetzner Cloud Console](https://console.hetzner.com/)
- [DigitalOcean Droplet Creation Docs](https://docs.digitalocean.com/products/droplets/how-to/create/)
- [DigitalOcean cloud-init / user-data docs](https://docs.digitalocean.com/products/droplets/how-to/provide-user-data/)
- [Vultr Snapshot Docs](https://docs.vultr.com/products/compute/optimized-cloud-compute/features/snapshots)
- [Vultr Clone Compute Instance](https://docs.vultr.com/cloning-a-virtual-server-with-vultr)
- [community-scripts/ProxmoxVE GitHub](https://github.com/community-scripts/ProxmoxVE)
- [community-scripts/ProxmoxVE catalog](https://community-scripts.org/scripts)
- [community-scripts ProxmoxVE-Local (local browser tool)](https://github.com/community-scripts/ProxmoxVE-Local)
- [ProxmoxAAS-Dashboard GitHub](https://github.com/tronnet-gh/ProxmoxAAS-Dashboard)
- [ComputerScienceHouse/proxstar (self-service VM tool)](https://github.com/ComputerScienceHouse/proxstar)
- [MultiPortal - Cloud Infrastructure Management for Proxmox](https://multiportal.io/)
- [CloudMox - Multitenant Control Panel for Proxmox](https://www.cloudmox.eu/)
- [Proxmox Datacenter Manager overview](https://www.proxmox.com/en/products/proxmox-datacenter-manager/overview)
- [Proxmox Datacenter Manager Web UI Docs](https://pdm.proxmox.com/docs/web-ui.html)
- [Proxmox SDN Integration in PDM](https://pdm.proxmox.com/docs/sdn-integration.html)
- [Proxmox VE API documentation](https://pve.proxmox.com/wiki/Proxmox_VE_API)
- [Proxmox Software-Defined Network Docs](https://pve.proxmox.com/pve-docs/chapter-pvesdn.html)
- [Proxmox Backup and Restore Docs](https://pve.proxmox.com/pve-docs/chapter-vzdump.html)
- [Proxmox noVNC iframe embedding (petarduss/proxmox-vnc)](https://github.com/petarduss/proxmox-vnc)
- [Proxmox noVNC API ticket flow (forum)](https://forum.proxmox.com/threads/novnc-over-api-pveauthcookie-pve-ticket-and-tunnel-auth-vnc-ticket-how.129091/)
- [OpenNebula Self-service Cloud View Docs](https://docs.opennebula.io/6.4/management_and_operations/end-user_web_interfaces/overview.html)
- [OpenNebula as a Cloud Service Provider blog](https://opennebula.io/blog/experiences/using-opennebula-as-a-cloud-service-provider/)
- [Cloud-Init Generator (samuelcaldas)](https://github.com/samuelcaldas/Cloud-Init_Generator)
- [cloud-init validation docs](https://cloudinit.readthedocs.io/en/latest/howto/debug_user_data.html)
- [PatternFly Bulk Selection Pattern](https://www.patternfly.org/patterns/bulk-selection/)
- [Bulk action UX guidelines - Eleken](https://www.eleken.co/blog-posts/bulk-actions-ux)

---
*Feature research for: self-hosted Proxmox VM/LXC self-service portal*
*Researched: 2026-05-14*
