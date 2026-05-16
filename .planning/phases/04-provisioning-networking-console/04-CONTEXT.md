# Phase 4: Provisioning, Networking & Console - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers the **end-to-end self-provisioning loop** — the milestone where
"click → running VM/LXC" finally lands:

1. **LXC provisioning** — a plain LXC from a vztmpl template, and a curated +
   full-catalog community-scripts deploy (commit-pinned, run inside the fresh
   LXC). Pick host / storage / network / CPU / RAM / disk, toggle
   unprivileged / nesting / features.
2. **VM provisioning** — a unified wizard with four paths (Cloud-Init image,
   PVE template clone, blank + mounted ISO, existing-VM clone), an ISO library
   with URL-download, and a two-pane Cloud-Init editor.
3. **Networking** — an SDN-aware network picker (zones / VNets / subnets) with
   admin-scoped team visibility, legacy-bridge fallback, and IPAM auto-pick.
4. **Console** — an embedded noVNC console in the VM-detail Console tab, served
   through the GUI's reverse-proxied WebSocket.
5. **UX glue** — node-fit hints, live quota delta, an in-app notification bell,
   distinct empty states, and inline `?` help.

27 requirements: LXC-01..07, VM-01..10, NET-01..04, CON-01..03, UI-04/05/07.

**What this phase does NOT deliver:**
- Lifecycle ops on existing VMs/LXCs (power, snapshot, backup, resize, clone,
  migrate) — shipped in Phase 3.
- Per-tenant private SDN **zone provisioning** — out of scope (the GUI consumes
  SDN an admin defined in Proxmox; PROJECT.md / REQUIREMENTS.md).
- Idle timeout, audit retention, self-update, mobile audit, accessibility pass
  — Phase 5.
- Editable raw Cloud-Init snippets, bulk/templated multi-VM "stacks" — deferred
  (see Deferred Ideas).

**ROADMAP-mandated:** three research spikes **gate** implementation and must be
sequenced first (SDN reload/applied semantics, noVNC vncticket single-encoding +
reverse-proxy headers, community-scripts non-interactive execution + metadata
stability) — see ROADMAP.md §"Research Spikes (Block Phase 4)".

</domain>

<decisions>
## Implementation Decisions

### Create Wizard

- **D-01:** **Unified wizard.** A single `/create` route. Step 1 is a card-grid
  picker of all six provisioning paths (LXC: plain vztmpl, community-script;
  VM: Cloud-Init image, PVE template clone, blank + ISO, existing-VM clone);
  the wizard then branches into path-specific steps. One wizard chrome.
- **D-02:** **Entry point = inventory + empty states.** A primary "Create"
  button on `/inventory`; UI-04 empty-state CTAs ("You have no VMs yet —
  Create one") deep-link into the wizard. No global topbar "+".
- **D-03:** **Stepped wizard.** Discrete steps with Back/Next and a progress
  indicator (Path → Source/Template → Resources → Network → Cloud-Init →
  Review), consistent with the Phase-1 four-step first-run setup wizard.
- **D-04:** **Post-submit landing.** Provisioning is async (202 + arq job). On
  submit the wizard closes and routes to the new resource's detail page
  (`/inventory/{cluster}/{vmid}` — the VMID is reserved pre-create) with a live
  "provisioning" banner; the Tasks drawer also carries the job.

### Community-Scripts (curated LXC catalog)

- **D-05:** **Catalog sourcing = bundled floor + admin sync.** A catalog
  snapshot is vendored into every GUI release as the floor; an admin "Sync
  catalog" button pulls a fresher upstream commit and re-pins. Catalog
  freshness never requires a GUI release. Whole-catalog single-commit pin
  (Pitfall 10 — pin to reviewed commits).
- **D-06:** **Curated shortlist.** LXC-01's curated shortlist is driven by the
  upstream featured/popular metadata flag by default, with an admin-editable
  override. LXC-02's full searchable catalog is the unfiltered view.
- **D-07:** **Execution surface = parse + expose options.** The wizard parses
  each script's metadata and exposes its configurable options as form fields.
  A defaults-only non-interactive fallback is required when a script's metadata
  cannot be parsed — the community-scripts spike must validate metadata-format
  stability (flagged MEDIUM confidence).
- **D-08:** **Install output = Tasks drawer.** Live `pct exec` stdout/stderr
  from a community-script deploy streams into the existing Phase-3 Tasks drawer
  job-detail panel over the same WebSocket.
- **Execution model (locked by Pitfall 10 — not re-decided):** the GUI creates
  the empty LXC via its own `pct create` API path; the upstream script runs
  **inside** that LXC via `pct exec`, never on the host; all output is captured
  to the audit log. LXC-04's source + commit hash + last-reviewed date are
  shown before deploy, derived from the active catalog pin.

### Cloud-Init Editor

- **D-09:** **Form-driven, read-only YAML preview.** The two-pane editor's form
  (left) is the sole input; the YAML pane (right) is a live **read-only**
  render of the effective config. No raw `cicustom` snippet path in v1 — keeps
  the editor in one mode (Pitfall 4) and avoids the `content=snippets` storage
  preflight, `qm cloudinit update`, and migration node-local pinning. *(The
  user deferred this decision to Claude; editable snippet mode → Deferred.)*
- **D-10:** **PVE-injected defaults visually distinguished.** In the YAML
  preview, PVE-injected lines are dimmed and badged "PVE default" so the user
  sees set-vs-injected values — satisfies VM-06.
- **D-11:** **Credentials.** The wizard pre-fills SSH public keys from the
  stored key set of **all team members** (multi-select, grouped by owner,
  deselectable) **and** requires a `cipassword`.
- **D-12:** **Validation (VM-07) = block-hard / warn-soft.** Schema validation
  runs before submit: hard errors (malformed YAML, invalid keys) disable submit
  with inline messages; soft issues (e.g. DNS set on a DHCP NIC — Pitfall 14)
  are non-blocking warnings. Mirrors the Phase-2 D-08 admission pattern.
- **D-13:** **Editor on every VM path.** The Cloud-Init editor step appears on
  all four VM paths (cloud-image, template clone, VM clone, blank + ISO) — the
  user can attach/edit a Cloud-Init drive on any VM.
- **D-14:** **No per-distro compatibility matrix.** Best-effort; PVE/cloud-init
  errors surface after the fact (Pitfall 14 declined for v1).
- **D-15:** **Cloud-image source.** VM-01 base images come from a curated
  cloud-image list with official download URLs (Ubuntu, Debian, Rocky, …);
  selecting an image triggers a download job to storage if not already present.

### ISO Library

- **D-16:** **ISO library (VM-08).** A curated list of common OS install ISOs
  with known URLs, plus a free URL field for anything else; ISOs already on
  storage are browsable across `content=iso`-capable storages (dropdowns
  filtered by content type — Pitfall 16).
- **D-17:** **ISO downloads open to any user.** Any user may trigger an ISO
  URL-download (runs as a job); not admin-gated.

### SDN / Networking

- **D-18:** **NET-02 admin scoping = per-team Networks tab.** A "Networks" tab
  on `/admin/teams/{id}`, parallel to the Phase-2 Quotas tab — the admin picks
  allowed SDN zones/VNets + legacy bridges, per cluster, per team.
- **D-19:** **Default before scoping.** Until an admin scopes a team, legacy
  bridges are visible by default; SDN zones/VNets stay hidden until explicitly
  granted on the Networks tab.
- **D-20:** **NET-03 IPAM.** When the selected VNet/subnet has an IPAM, the
  picker auto-picks a free static IP, editable (the user can change it or
  switch to DHCP). VNets/bridges without IPAM default to DHCP.
- **D-21:** **NET-04 picker = auto-detect per cluster.** SDN VNets are shown
  where SDN is configured and the cluster is PVE 8+ (Pitfall 8); legacy bridges
  otherwise; a cluster with both shows both, grouped.

### Console (noVNC) — locked, not discussed

- Embedded noVNC via iframe in the VM-detail **Console tab** (Phase-2 D-18 tab
  layout `Overview | Activity | Console | Snapshots | Backups`); `vncticket`
  minted server-side **on click**, not on page load (Pitfall 3, ~30s
  lifetime), with a reconnect button; all console traffic flows through the
  GUI's reverse-proxied WebSocket (CON-01/02/03). The noVNC spike covers
  single-encoding, reverse-proxy WebSocket headers, and self-signed-cert
  handling.

### Notification Bell

- **D-22:** **Bell scope = task completions only (v1).** UI-07 surfaces job
  done/failed events only — Phase-3 toasts already cover live feedback.
- **D-23:** **Bell history = derived, no new storage.** The bell reads recent
  rows from the existing Phase-3 `jobs` table and tracks a per-user "last seen"
  timestamp for the unread count. No new notification table.

### Node-Fit Hints

- **D-24:** **Node-fit (VM-10) = block unfit nodes.** Nodes that cannot fit the
  requested VM/LXC are disabled (un-pickable) in the node selector, computed
  against **live free** node resources (current free CPU/RAM). A disabled node
  must show the reason (e.g. "node-1: 2 GB free, needs 4 GB"); node-fit reads
  fresh resource data when the picker renders.
- The live **quota delta** half of VM-10 is inherited from Phase-2 D-08 (live
  validation during sizing input, inline over-quota hint, submit disabled with
  tooltip) — not re-decided here.

### Inline Help

- **D-25:** **UI-05 `?` help.** Each `?` icon shows short in-app explanatory
  text plus an optional "Learn more" deep link to the official Proxmox docs.

### Claude's Discretion

- **YAML pane editability** — the user explicitly deferred this ("decide
  yourself"); D-09 (read-only form-driven preview) is Claude's v1
  recommendation. Editable raw-snippet mode is a clean follow-up if needed.
- **Empty states (UI-04)** — a shared `EmptyState` component, per-page copy +
  CTA deep-linking into the create wizard; which pages/lists get bespoke
  empty states.
- Console reconnect-UX details; blank+ISO boot-order / disk defaults; the
  wizard Review-step contents; wizard form-state persistence on refresh;
  ISO / cloud-image storage selection within the wizard; the admin
  Sync-catalog button's diff/preview surface; the community-scripts
  attribution display format.
- arq job functions for provisioning (qemu create, lxc/`pct` create,
  `pct exec` script run, ISO/cloud-image download) — follow the Phase-3 job
  patterns; provisioning ops are non-idempotent (Phase-3 D-16 — excluded from
  one-click retry).

### Folded Todos

None — `todo.match-phase 4` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 scope, success criteria & mandated spikes
- `.planning/ROADMAP.md` §"Phase 4: Provisioning, Networking & Console" — goal,
  5 success criteria, locked notes (VMID race → app-level per-cluster lock +
  reserved-VMID set; Cloud-Init `content=snippets` storage validation at
  cluster onboarding; `qm cloudinit update` after every snippet write)
- `.planning/ROADMAP.md` §"Research Spikes (Block Phase 4)" — the three
  implementation-gating spikes (SDN, noVNC, community-scripts)
- `.planning/REQUIREMENTS.md` — LXC-01..07, VM-01..10, NET-01..04, CON-01..03,
  UI-04/05/07 (the 27 requirements this phase ships)
- `CLAUDE.md` §"Proxmox-Specific Constraints" — every mutation → 202 + worker
  poll; persist UPID before polling; API tokens for backend→PVE auth;
  vncticket ~30–40s lifetime + encode-exactly-once; `cicustom` snippets storage
  preflight; VMID race app-level locking; per-tenant pools + privsep tokens;
  community-scripts via `pct exec` inside the fresh LXC, commit-pinned

### Architecture & research
- `.planning/research/ARCHITECTURE.md` — modular monolith, per-cluster
  connector, job-queue + UPID-polling pattern, multi-tenant URL shape
  `/clusters/{id}/...`
- `.planning/research/FEATURES.md` — feature research, including the
  community-scripts catalog integration
- `.planning/research/STACK.md` — proxmoxer 2.3.x, FastAPI, SvelteKit + Svelte 5
- `.planning/research/SUMMARY.md` — cross-cutting research; Open Questions (SDN
  MEDIUM-LOW confidence, noVNC vncticket, community-scripts execution mechanics)

### Pitfalls (Phase 4-relevant)
- `.planning/research/PITFALLS.md` §Pitfall 1 — VMID race (`/cluster/nextid` not
  atomic → reuse `reserve_vmid` from `backend/app/lifecycle/clone.py`)
- §Pitfall 3 — vncticket ~30s expiry (mint on click; noVNC spike)
- §Pitfall 4 — Cloud-Init snippet storage requirements; `cicustom` vs
  PVE-managed `ciuser/sshkeys` are mutually exclusive (→ D-09 picks the
  PVE-managed lane); `qm cloudinit update` after writes
- §Pitfall 8 — SDN `pending`/`applied` state + reload semantics (SDN spike;
  → D-21 PVE-8+ detection)
- §Pitfall 10 — helper-script supply chain: pin commits, run inside the fresh
  LXC via `pct exec`, capture output, surface attribution (→ D-05/D-07)
- §Pitfall 14 — Cloud-Init DNS not applied for DHCP networks (→ D-12 soft
  warning)
- §Pitfall 16 — storage content-type mismatch (filter ISO/snippet/image
  dropdowns by the target node's content type → D-16)
- §Pitfall 19 — unprivileged LXC for the GUI itself (community-scripts
  `pct exec` implications)
- §Pitfall 20 — migration breaks node-local snippet references (D-09's
  read-only form-driven editor avoids this for v1)
- §"Integration Gotchas" — noVNC reverse-proxy WebSocket headers, Cloud-Init
  mode exclusivity + drive regeneration, community-scripts whiptail/
  non-interactive, SDN reload-after-write

### Prior-phase locked decisions (carry forward — do NOT re-decide)
- `.planning/phases/01-foundation/01-CONTEXT.md` — per-tenant
  privilege-separated PVE tokens (provisioning calls execute as the team
  token, never the bootstrap admin token); pool-per-tenant — every new VM/LXC
  joins the team's PVE pool at creation (Pitfall 5)
- `.planning/phases/02-multi-cluster-inventory-quotas-audit/02-CONTEXT.md` —
  D-18 VM-detail tab layout (`Overview | Activity | Console | Snapshots |
  Backups`; Phase 4 fills the Console tab); D-08 live quota-delta validation
  during sizing input (VM-10's quota-delta half inherits this); D-11 admin
  config surfaces live on `/admin/teams/{id}` (the Networks tab follows the
  Quotas-tab pattern)
- `.planning/phases/03-job-queue-lifecycle/03-CONTEXT.md` — job queue + Tasks
  drawer + WebSocket progress; D-13 curated PVE-error map + raw fallback;
  D-16 retry only for idempotent ops (provisioning/create is non-idempotent);
  `reserve_vmid` (per-cluster `asyncio.Lock` + 60s reserved set) and
  `run_quota_admission` already shipped in `backend/app/lifecycle/clone.py`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/lifecycle/clone.py` — `reserve_vmid` (per-cluster
  `asyncio.Lock` + 60s in-process reserved set, Pitfall 1) and
  `run_quota_admission`; Phase 4 VM/LXC create reuses **both** directly.
- `backend/app/clusters/connector.py` + `registry.py` — `PVEConnector` wraps
  proxmoxer with `asyncio.to_thread` + circuit breaker + 30s cache; already has
  `create_pool` / `create_user` / `create_token` / `clone`. Phase 4 extends it
  with qemu create, LXC (`pct`) create, `pct exec`, `vncproxy`, SDN reads,
  storage / ISO / cloud-image ops, and `/cluster/nextid`.
- `backend/app/jobs/` — arq worker, enqueue helper (202 + job id), UPID poller,
  orphan reaper, Redis pub/sub. Phase 4 adds provisioning job functions.
- `backend/app/lifecycle/` — existing lifecycle routes/services pattern; Phase 4
  adds provisioning routes alongside.
- `backend/app/ssh_keys/` + `frontend` profile/ssh-keys — the per-user SSH key
  store feeds the Cloud-Init editor's key multi-select (D-11).
- `frontend/src/lib/components/jobs/` — Tasks drawer + JobRow + JobErrorDetail;
  community-script install output (D-08) streams here.
- `frontend/src/lib/components/forms/` — ConfirmByNameDialog, SecretRevealDialog,
  PasswordInput, FormSummaryAlert; the wizard reuses these primitives.
- `frontend/src/routes/inventory/[cluster]/[vmid]/` — VM detail page with a
  disabled Console tab; Phase 4 fills it with the noVNC iframe and the wizard
  routes here post-submit (D-04).
- `frontend/src/lib/components/quotas/` (QuotaIndicator) — live quota; the
  wizard quota-delta (VM-10) ties in.
- `frontend/src/routes/admin/teams/[id]/` — Phase-2 tabbed team-edit page
  (Quotas tab); Phase 4 adds the Networks tab (D-18).
- sonner Toaster (AppShell) — wizard validation + provisioning toasts.

### Established Patterns
- URL shape `/api/v1/clusters/{cluster_id}/...` — provisioning endpoints follow.
- Every mutating endpoint → `202 Accepted` + job id; the worker polls the UPID;
  the request never blocks (CLAUDE.md).
- Provisioning calls execute as the per-tenant team token; every new VM/LXC is
  added to the team's PVE pool at creation (Pitfall 5).
- `asyncio.to_thread` for all proxmoxer I/O.
- Service-layer commit-before-raising-`HTTPException`.
- Defense-in-depth auth gates: layout + page + service.
- Hand-written, explicitly-named Alembic migrations.
- The stepped-wizard component pattern from the Phase-1 four-step setup wizard.

### Integration Points
- **Backend new modules:** `backend/app/provisioning/` (qemu/LXC create routes +
  services + wizard schemas); a community-scripts catalog module; an SDN /
  network read module; an ISO / cloud-image library module; a noVNC proxy
  (reverse-proxied WebSocket endpoint).
- **New arq job functions:** VM create (per path), LXC create, community-script
  `pct exec` run, ISO / cloud-image download.
- **Migration:** catalog pin + curated-list overrides, per-team network
  scoping, notification last-seen timestamp — planner decides the schema.
- **New admin surface:** the Networks tab on `/admin/teams/{id}`; the admin
  Sync-catalog button.
- **Frontend new:** the unified `/create` wizard + per-path step components; a
  community-scripts catalog browser; the Cloud-Init two-pane editor; an ISO
  library browser; the SDN/network picker; the noVNC console (Console tab); a
  notification bell in the Topbar; `EmptyState` usage; a `?` HelpTooltip
  component.
- **New API modules:** `api/provisioning.ts`, `api/catalog.ts`,
  `api/networks.ts`, `api/iso.ts`, `api/console.ts`.

</code_context>

<specifics>
## Specific Ideas

- **"Hetzner-style"** remains the visual north star: the unified Create wizard
  mirrors Hetzner Cloud's "create server" flow — pick a type, configure it in
  steps, create.
- The **three ROADMAP-mandated spikes** gate implementation — the planner
  should sequence them first (as plans 04-01..03 or discrete `/gsd-spike`
  runs): SDN reload/applied semantics + PVE version floor; noVNC `vncticket`
  single-encoding + reverse-proxy WebSocket headers + self-signed-cert
  handling; community-scripts non-interactive (whiptail-bypass) execution +
  `pct exec` output streaming + metadata-format stability + attribution.
- **Community-scripts:** the GUI builds the empty LXC itself via the Proxmox
  API; only the in-container install stage runs upstream code, via `pct exec`,
  never on the host (Pitfall 10). The catalog is commit-pinned; attribution is
  surfaced before deploy.
- **Cloud-Init editor:** form-driven for v1 — the YAML pane is transparency,
  not raw editing. VM-06 ("surface every derived value, including PVE-injected
  defaults") is met by the read-only preview with injected lines badged.
- This phase delivers the project's headline milestone: the first end-to-end
  **"click → running VM/LXC"** (STATE.md §"Next milestone").

</specifics>

<deferred>
## Deferred Ideas

- **Editable `cicustom` raw-snippet mode** in the Cloud-Init editor — v1 ships
  the read-only, form-driven preview (D-09). Raw-snippet editing (with the
  `content=snippets` storage preflight, `qm cloudinit update`, and migration
  node-local pre-flight) is a later phase / v2.
- **Per-distro Cloud-Init compatibility matrix** (D-14 declined for v1) — add
  later if support pain emerges from new-distro renderer changes.
- **Notification-bell broader scope** — v1 is task-completions-only (D-22); a
  broader feed (quota-threshold warnings, cluster-unreachable events) is a
  later enhancement.
- **Fully hand-curated editorial shortlist** — D-06 ships the upstream
  featured-flag default + an admin override; a richer hand-curated catalog
  view is a possible enhancement.
- **Bulk / templated multi-VM "stacks"** (CloudFormation-style) — explicitly v2
  (REQUIREMENTS.md V2-04).
- **Per-tenant private SDN zone provisioning** — explicitly out of scope
  (PROJECT.md / REQUIREMENTS.md); the GUI consumes admin-defined SDN.

### Reviewed Todos (not folded)

None — the todos directory is empty.

</deferred>

---

*Phase: 04-provisioning-networking-console*
*Context gathered: 2026-05-16*
