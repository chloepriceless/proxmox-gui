# Phase 4: Provisioning, Networking & Console - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 04-provisioning-networking-console
**Areas discussed:** Create-wizard architecture, Community-scripts integration, Cloud-Init editor, SDN network picker, ISO library, Notification bell, Node-fit + quota delta, Inline help + empty states

---

## Create-wizard architecture

### Q1 — How should the six provisioning paths be structured into wizards?

| Option | Description | Selected |
|--------|-------------|----------|
| Unified wizard, path-picker first | One `/create` route; 6-path card-grid as step 1, then branches | ✓ |
| Split: Create VM / Create LXC | Two separate wizards on distinct routes | |

**User's choice:** Unified wizard, path-picker first

### Q2 — Where is the 'Create' action launched from?

| Option | Description | Selected |
|--------|-------------|----------|
| Inventory button + empty-state CTAs | Primary Create button on /inventory; UI-04 empty states deep-link in | ✓ |
| Global topbar '+' button | Always-visible Create affordance in the topbar | |
| Both topbar and inventory | Create in both places | |

**User's choice:** Inventory button + empty-state CTAs

### Q3 — What layout should the wizard use?

| Option | Description | Selected |
|--------|-------------|----------|
| Stepped wizard, Back/Next + progress | Discrete steps; matches the Phase-1 setup wizard | ✓ |
| Single scrolling page, card sections | All fields on one page grouped into cards | |

**User's choice:** Stepped wizard, Back/Next + progress

### Q4 — After the user submits the wizard, where do they land?

| Option | Description | Selected |
|--------|-------------|----------|
| New resource's detail page + banner | Routes to /inventory/{cluster}/{vmid} with a live provisioning banner | ✓ |
| Back to inventory, row 'creating' | Returns to /inventory; new row in a 'creating' state | |
| Wizard success screen w/ progress | Stay in the wizard on a success screen with progress | |

**User's choice:** New resource's detail page + banner

**Notes:** Wizard form-state-on-refresh persistence and the per-step Review screen left to Claude's discretion during planning.

---

## Community-scripts integration

### Q1 — How should the community-scripts catalog metadata get into the GUI?

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled snapshot per GUI release | Catalog JSON vendored into the repo, pinned to a reviewed commit | partial |
| Fetched live from GitHub, cached | GUI periodically pulls the catalog and caches it | |
| Admin-synced on demand | Admin clicks Sync; GUI pulls + pins to that commit | partial |

**User's choice:** Combined — a bundled snapshot ships as the floor in each GUI release, PLUS an admin "Sync catalog" button to pull and re-pin a fresher upstream commit, so catalog freshness never requires a GUI release.

### Q2 — Who curates the curated shortlist?

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded shortlist in the GUI release | Opinionated default set baked into the release | |
| Admin-editable curated list | Admin page to pin which scripts appear in the curated view | partial |
| Upstream featured/popular flag | Use upstream featured/popularity metadata | partial (default) |

**User's choice:** Both option 2 and option 3 — upstream featured/popular flag as the default, with an admin-editable override.

### Q3 — How much of the script's interactive options should the wizard expose?

| Option | Description | Selected |
|--------|-------------|----------|
| Defaults-only, non-interactive (v1) | Run every script in its non-interactive default mode | |
| Parse metadata, expose script options | Read each script's options, render them as wizard fields | ✓ |

**User's choice:** Parse metadata, expose script options

**Notes:** The community-scripts spike must verify metadata-format stability (flagged MEDIUM confidence); a defaults-only fallback is required when a script's metadata cannot be parsed.

### Q4 — Where should the live install output be shown?

| Option | Description | Selected |
|--------|-------------|----------|
| Streamed into the Tasks drawer job detail | Reuses the Phase-3 WebSocket job-progress panel | ✓ |
| Dedicated live-log console view | A separate terminal-style live-log view for installs | |

**User's choice:** Streamed into the Tasks drawer job detail

---

## Cloud-Init editor

### Q1 — Should the YAML pane be editable?

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only preview, form is sole input | Form drives everything; YAML pane is a live read-only render | (Claude's pick) |
| Editable YAML → cicustom snippet mode | Editing the YAML writes a cicustom snippet; form detaches | |
| Explicit Form / Snippet mode toggle | User picks one mode per VM | |

**User's choice:** Deferred to Claude ("decide yourself, I don't know what's better"). Claude's recommendation for v1: read-only preview, form is the sole input — keeps one mode (Pitfall 4), avoids snippet-storage preflight / qm cloudinit update / migration pinning. Editable snippet mode recorded as a Deferred Idea.

### Q2 — How should the editor seed credentials?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fill SSH keys from user's store; password optional | Pre-select user's keys; cipassword optional | |
| Manual entry each time | Paste keys / type password on every create | |
| Pre-fill keys AND require a password | Pre-fill keys from the store + require a cipassword | ✓ |

**User's choice:** Pre-fill keys AND require a password

### Q3 — How strict should schema validation be (VM-07)?

| Option | Description | Selected |
|--------|-------------|----------|
| Block on hard errors, warn on soft | Hard errors disable submit; soft issues are non-blocking warnings | ✓ |
| Block submit on any issue | Anything flagged blocks submit | |
| Warn only, never block | Validator only warns; user can always submit | |

**User's choice:** Block on hard errors, warn on soft

### Q4 — Where do Cloud-Init base images come from (VM-01)?

| Option | Description | Selected |
|--------|-------------|----------|
| Curated cloud-image list w/ known URLs | Curated distro-image list with official URLs; download job on select | ✓ |
| User supplies an image URL each time | A URL field; GUI downloads whatever is pasted | |
| Only images already on storage | No download path; images must be pre-staged | |

**User's choice:** Curated cloud-image list with known URLs

### Q5 — Where should the Cloud-Init editor step appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Cloud-image always; clone paths if CI drive present | Conditional editor step on clone paths | |
| Cloud-image path only | Clones inherit their source's CI as-is | |
| Always offer it on every path | Editor appears on all four VM paths | ✓ |

**User's choice:** Always offer it on every path

### Q6 — Whose SSH keys should the multi-select offer?

| Option | Description | Selected |
|--------|-------------|----------|
| Own keys only | Only the creating user's stored keys | |
| Own + teammates' keys | Keys from all team members, grouped by owner | ✓ |

**User's choice:** Own + teammates' keys

### Q7 — Should the GUI track per-distro Cloud-Init compatibility?

| Option | Description | Selected |
|--------|-------------|----------|
| Compatibility notes on the curated image list | Per-image notes + editor warnings for quirky combos | |
| No matrix — best-effort | No tracking; surface errors after the fact | ✓ |

**User's choice:** No matrix — best-effort

### Q8 — How should PVE-injected defaults be shown in the YAML pane (VM-06)?

| Option | Description | Selected |
|--------|-------------|----------|
| Visually distinguished from user-set values | Injected lines dimmed + a 'PVE default' badge | ✓ |
| Shown the same, just rendered | Full effective config, no distinction | |

**User's choice:** Visually distinguished from user-set values

---

## SDN network picker

### Q1 — Where should an admin define which networks a team may use (NET-02)?

| Option | Description | Selected |
|--------|-------------|----------|
| Networks tab on /admin/teams/{id} | Per-team Networks tab, parallel to the Quotas tab | ✓ |
| Per-cluster network allowlist | Scoped at the cluster level, applies to all teams | |
| Both — per-cluster default + per-team override | Per-cluster default with per-team overrides | |

**User's choice:** Networks tab on /admin/teams/{id}

### Q2 — What should the picker show a team before any scoping is configured?

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing until admin grants (allowlist) | Secure-by-default; wizard blocks until granted | |
| Everything until admin restricts (denylist) | All networks visible by default | |
| Legacy bridges shown, SDN needs granting | Bridges default-visible; SDN needs explicit granting | ✓ |

**User's choice:** Legacy bridges shown, SDN needs granting

### Q3 — How should IPAM auto-pick-free-IP behave (NET-03)?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-pick when VNet has IPAM, editable | Pre-fill a free static IP; editable, can switch to DHCP | ✓ |
| Opt-in — user clicks 'Auto-pick IP' | Defaults to DHCP/manual; explicit button to auto-pick | |
| Always auto-pick, not editable | Auto-picked IP is locked | |

**User's choice:** Auto-pick when VNet has IPAM, editable

### Q4 — How should the picker present SDN vs legacy bridge (NET-04)?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect per cluster | Detect SDN-capable (PVE 8+) vs bridge-only per cluster | ✓ |
| Always show both, grouped | Always show SDN + bridge sections | |
| Admin sets per-cluster network mode | Admin marks each cluster SDN-mode or bridge-mode | |

**User's choice:** Auto-detect per cluster

---

## ISO library

### Q1 — Who should be allowed to trigger an ISO URL-download (VM-08)?

| Option | Description | Selected |
|--------|-------------|----------|
| Any user | Any user can URL-download an ISO to storage | ✓ |
| Admin-only downloads | Users pick existing ISOs; only admins add new ones | |

**User's choice:** Any user

### Q2 — Should the ISO library include a curated list?

| Option | Description | Selected |
|--------|-------------|----------|
| Curated ISO list + free URL field | Curated common ISOs + a free URL field | ✓ |
| Free URL field only | No curated list; user always supplies the URL | |

**User's choice:** Curated ISO list + free URL field

---

## Notification bell

### Q1 — What events should the bell surface (UI-07)?

| Option | Description | Selected |
|--------|-------------|----------|
| Task completions only (v1) | Job done/failed events only | ✓ |
| Tasks + quota + cluster events | Broader feed incl. quota + cluster-unreachable | |

**User's choice:** Task completions only (v1)

### Q2 — How should the bell persist its history?

| Option | Description | Selected |
|--------|-------------|----------|
| Derived from jobs table + last-seen | Reads recent jobs + a per-user last-seen timestamp | ✓ |
| Dedicated notifications table | New table with explicit read/unread state | |
| Session-only, ephemeral | Cleared on reload | |

**User's choice:** Derived from jobs table + last-seen

---

## Node-fit + quota delta

### Q1 — Block or warn when a node can't fit the VM (VM-10)?

| Option | Description | Selected |
|--------|-------------|----------|
| Warn only, never block | Unfit node stays selectable with a warning | |
| Block / disable unfit nodes | Unfit nodes are un-pickable in the selector | ✓ |

**User's choice:** Block / disable unfit nodes

### Q2 — What should node-fit be computed against?

| Option | Description | Selected |
|--------|-------------|----------|
| Live free resources | Compare against currently-free CPU/RAM | ✓ |
| Configured capacity / allocation | Compare against capacity minus committed allocations | |

**User's choice:** Live free resources

**Notes:** Disabled nodes must show the reason (e.g. "node-1: 2 GB free, needs 4 GB"); node-fit needs a fresh resource read when the picker renders. The quota-delta half of VM-10 is inherited from Phase-2 D-08.

---

## Inline help + empty states

### Q1 — What should '?' help icons show (UI-05)?

| Option | Description | Selected |
|--------|-------------|----------|
| In-app text + 'Learn more' doc link | Short in-app text + optional deep link to Proxmox docs | ✓ |
| Link out to Proxmox docs only | Pure link to official docs | |
| In-app text only, no external links | Tooltip text, no external links | |

**User's choice:** In-app text + 'Learn more' doc link

---

## Claude's Discretion

- YAML pane editability — user explicitly deferred; Claude recommends read-only form-driven preview for v1 (D-09).
- Empty states (UI-04) — shared `EmptyState` component, per-page copy + CTA deep-linking into the create wizard.
- Console reconnect-UX details; blank+ISO boot-order/disk defaults; the wizard Review-step contents; wizard form-state persistence on refresh; ISO/cloud-image storage selection within the wizard; the admin Sync-catalog button's diff/preview surface; the community-scripts attribution display format.
- arq provisioning job functions — follow the Phase-3 job patterns.

## Deferred Ideas

- Editable `cicustom` raw-snippet mode in the Cloud-Init editor — later phase / v2.
- Per-distro Cloud-Init compatibility matrix — declined for v1.
- Notification-bell broader scope (quota / cluster events) — later enhancement.
- Fully hand-curated editorial shortlist beyond the upstream-featured default.
- Bulk / templated multi-VM "stacks" — v2 (V2-04).
- Per-tenant private SDN zone provisioning — out of scope.
