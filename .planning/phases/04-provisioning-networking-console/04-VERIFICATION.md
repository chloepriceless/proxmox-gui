---
phase: 04-provisioning-networking-console
verified: 2026-05-16T23:00:00Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A user can open an embedded noVNC console in an iframe for any VM/LXC they own; the vncticket is minted server-side on click (never on page load), refreshed before expiry, and all console traffic flows through the GUI's reverse-proxied WebSocket — no direct Proxmox exposure to the browser is required."
    status: failed
    reason: "The ConsoleTab.svelte iframe src is set to the relay WebSocket path '/api/v1/ws/console/{id}/{kind}/{vmid}'. A WebSocket URL is not an HTML document — an iframe cannot load it. The spike §7 contract specifies the iframe must load 'a GUI-served noVNC client page' (e.g. src='/console/embed?ws=/api/v1/ws/console/...'). No such HTML noVNC client page exists anywhere in the project (no static noVNC assets, no /console/embed route). The relay backend (proxy.py) is correctly implemented; the vncticket mint and single-encoding are correct; but the final wiring step — loading an actual noVNC client in the iframe — is missing. The console tab renders a placeholder, calls mintVncProxy, gets a relay_url, passes consoleIframeSrc validation, sets iframe src to the WebSocket path, and the iframe loads nothing. CON-01 is not functional end-to-end."
    artifacts:
      - path: "frontend/src/lib/components/console/ConsoleTab.svelte"
        issue: "iframe src is set to the WebSocket relay path (relay_url = '/api/v1/ws/console/...') — not an HTML document"
      - path: "frontend/src/lib/components/console/console-tab.ts"
        issue: "consoleIframeSrc passes WebSocket paths — correctly rejects ':8006' but does not require an HTML document path"
    missing:
      - "A GUI-served noVNC client page (e.g. frontend/static/novnc/index.html or a SvelteKit route at /console/embed) that opens the relay WebSocket — the spike §7 contract specifies this"
      - "The mint response relay_url should be the console-client HTML page URL with the WS relay path as a parameter, OR the ConsoleTab should embed the noVNC JS library directly and open the WS relay itself"
      - "sandbox attribute on the iframe (WR-02, security)"

  - truth: "Wizard shows real-time quota delta and node-fit hints (e.g. 'won't fit on node-1')"
    status: partial
    reason: "Quota delta is data-connected and functional (reads api.quotas.getMyQuotas, populates QuotaDeltaLine). Node-fit hints are architecturally complete (node-fit.ts, NodeSelect.svelte, computeNodeFit, allBlocked all exist and are tested) but data-disconnected: connector.node_resources() exists but is not exposed via any HTTP route. The wizard derives the node list from inventory (names only, freeCpu: null / freeRamMb: null). computeNodeFit treats null free figures as fit-unknown and keeps nodes pickable — so 'won't fit on node-1' never fires. The roadmap success criterion 3 explicitly names 'node-fit hints (e.g. won't fit on node-1)' as a required truth."
    artifacts:
      - path: "frontend/src/routes/create/+page.svelte"
        issue: "clusterNodes populated from inventory with freeCpu: null / freeRamMb: null — live free-resource figures never available"
      - path: "backend/app/clusters/connector.py"
        issue: "connector.node_resources() method exists but is not exposed via any HTTP route (no GET /clusters/{id}/node-resources endpoint)"
    missing:
      - "A backend HTTP route exposing GET /clusters/{id}/node-resources (or similar) that returns per-node free CPU/RAM"
      - "Frontend API call in the wizard to populate clusterNodes with real freeCpu/freeRamMb values"

  - truth: "User can one-click deploy from a community-script (non-interactive mode) — LXC-03"
    status: partial
    reason: "The community-script two-stage job (run_community_script) is correctly implemented: stage 1 creates the LXC via dispatch_and_poll, stage 2 runs the install script via lxc_exec (SSH pct exec). All code is in place and tested. However, lxc_exec requires SSH key trust from the GUI LXC to each PVE node (root@<node>, port 22, BatchMode=yes). This key trust does not exist at deploy time — it is documented in 04-06-SUMMARY.md as a Phase 5 installer step. Until that SSH trust is provisioned by the installer, stage 2 will always fail at SSH connect and mark the job failed (the LXC is kept, the designed failure mode). This is an acknowledged operational dependency, not a code bug. Assessed per the verification prompt: LXC-03 is functionally complete in code; operationally blocked by a Phase 5 deployment prerequisite."
    artifacts:
      - path: "backend/app/clusters/connector.py"
        issue: "_ssh_pct_exec uses BatchMode=yes — requires pre-provisioned SSH key from the GUI LXC to each PVE node"
    missing:
      - "Phase 5 installer step: provision the GUI LXC SSH key into PVE node authorized_keys for root@<node>"
      - "This is a DEPLOYMENT gap, not a code gap — the code is complete; the operational prerequisite is Phase 5"
---

# Phase 4: Provisioning, Networking & Console — Verification Report

**Phase Goal:** A user can self-provision LXCs (plain or from a curated community-script with full source/version visibility) and VMs (Cloud-Init image / PVE template / blank+ISO / clone) end-to-end through wizards, on the SDN/bridge they're allowed to use, and open an embedded noVNC console without ever touching the Proxmox UI.

**Verified:** 2026-05-16T23:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | User can browse curated + full community-scripts catalog, see source/commit/last-reviewed before deploy, one-click deploy, and deploy a plain LXC picking host/storage/network/CPU/RAM/disk/unprivileged/nesting/features | ✓ VERIFIED | `backend/app/catalog/` + `backend/app/provisioning/` fully wired; LXC-01..07 backend + frontend complete; tests: 22 catalog + 17 provisioning test green; code review found no blocking issues |
| 2  | User can launch a VM wizard with 4 paths, browse ISO library + URL-download, and edit Cloud-Init in a two-pane form/YAML editor showing all derived values + running schema validation | ✓ VERIFIED | VM-01..08 backend (provisioning + cloudinit + iso modules) + frontend (wizard, CloudInitEditor, IsoLibrary) fully wired; 354 frontend + 485 backend tests green |
| 3  | Network picker enumerates SDN zones/VNets/subnets with admin-controlled visibility, falls back to legacy bridges, IPAM auto-picks IP; wizard shows real-time quota delta and node-fit hints ("won't fit on node-1") | ✗ PARTIAL — node-fit hints hollow | NET-01..04 backend + frontend verified. Quota delta VERIFIED (api.quotas.getMyQuotas → QuotaDeltaLine wired). Node-fit hints HOLLOW: connector.node_resources() not exposed via any route; wizard always uses freeCpu:null/freeRamMb:null → computeNodeFit always returns fit-unknown. "Won't fit on node-1" never fires. |
| 4  | User can open embedded noVNC console in an iframe; vncticket minted on click (never on page load); refreshed before expiry; all traffic through GUI's reverse-proxied WebSocket — no direct Proxmox exposure | ✗ FAILED | CON-02 and CON-03 (relay, mint-on-click, single-encoding, Caddy config) are VERIFIED. CON-01 FAILS: ConsoleTab.svelte sets iframe src to the WebSocket relay path '/api/v1/ws/console/...' — a WebSocket URL is not an HTML document and cannot render in an iframe. No noVNC client page (HTML/JS) exists anywhere in the project. The console tab displays a placeholder, calls mintVncProxy, sets iframe src, and the iframe loads nothing. |
| 5  | Empty list states show actionable CTAs; every PVE-specific wizard field has a `?` tooltip; notification bell surfaces task completions in real time | ✓ VERIFIED | EmptyState.svelte + HelpTooltip.svelte wired; inventory empty state CTAs to /create; HelpTooltip on every PVE-specific field in LxcResourcesStep + VmResourcesStep; NotificationBell in Topbar with derived feed from jobs table; tests green |

**Score: 3/5 truths fully verified** (SC-1, SC-2, SC-5 verified; SC-3 partial; SC-4 failed)

### Deferred Items

No items were deferred — Phase 5 does not cover CON-01 (noVNC client page) or VM-10 (node-resources API route). Phase 5 covers SSH key trust provisioning (the LXC-03 operational dependency), so LXC-03 is partially deferred.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | SSH key trust from GUI LXC to PVE nodes (LXC-03 operational prerequisite) | Phase 5 | "helper-script v1 polish, packaging as ready-to-deploy LXC" — the install.sh provisions the SSH keypair; 04-06-SUMMARY explicitly states "provisioning the SSH key onto the GUI LXC and the node authorized_keys is a deployment step for Phase 5 packaging" |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `backend/app/provisioning/routes.py` | ✓ VERIFIED | POST /lxc + /qemu + /community-script + /cloudinit/preview — all present and substantive |
| `backend/app/provisioning/service.py` | ✓ VERIFIED | enqueue_create_lxc, enqueue_create_qemu, enqueue_community_script all present |
| `backend/app/provisioning/schemas.py` | ✓ VERIFIED | CreateLxcRequest, CreateQemuRequest (discriminated union), CommunityScriptRequest, ProvisioningJobAcceptedResponse |
| `backend/app/jobs/provisioning_functions.py` | ✓ VERIFIED | run_create_qemu, run_create_lxc, run_community_script, run_download — all present |
| `backend/alembic/versions/0006_phase4.py` | ✓ VERIFIED | network_scope, catalog_pin, notification_seen tables created |
| `backend/app/catalog/routes.py` | ✓ VERIFIED | GET /clusters/{id}/catalog, GET /clusters/{id}/catalog/{slug}, POST /catalog/sync |
| `backend/app/catalog/service.py` | ✓ VERIFIED | load_catalog, curated_shortlist, search_catalog, sync_catalog |
| `backend/app/catalog/snapshot.json` | ✓ VERIFIED | 12-entry vendored floor at pinned commit 369f9013 |
| `backend/app/networks/routes.py` | ✓ VERIFIED | GET /clusters/{id}/networks, GET + PUT /admin/teams/{tid}/clusters/{cid}/networks |
| `backend/app/networks/service.py` | ✓ VERIFIED | list_networks_for_team, list_cluster_network_inventory |
| `backend/app/networks/scoping.py` | ✓ VERIFIED | get_team_network_scope, set_team_network_scope |
| `backend/app/console/routes.py` | ✓ VERIFIED | POST /vms/{vmid}/console/vncproxy + POST /lxcs/{vmid}/console/vncproxy |
| `backend/app/console/proxy.py` | ✓ VERIFIED | Bidirectional WS relay, auth-before-accept, single-encode, just-in-time mint |
| `backend/app/notifications/routes.py` | ✓ VERIFIED | GET /notifications + POST /notifications/seen |
| `frontend/src/lib/components/wizard/` | ✓ VERIFIED | All 15 wizard components/helpers present (CatalogBrowser, CloudInitEditor, CloudInitYamlPane, IsoLibrary, LxcResourcesStep, LxcTemplateStep, NetworkPicker, NodeSelect, PathPicker, QuotaDeltaLine, ReviewStep, ScriptDetailPanel, VmResourcesStep, VmSourceStep, WizardChrome) |
| `frontend/src/lib/components/console/ConsoleTab.svelte` | ⚠️ HOLLOW | Exists, substantive, wired — but iframe src points at WebSocket path, not HTML document. No noVNC client page exists. |
| `frontend/src/lib/components/notifications/NotificationBell.svelte` | ✓ VERIFIED | In Topbar, feeds from derived notifications backend, unread badge |
| `frontend/src/lib/components/networks/NetworksTab.svelte` | ✓ VERIFIED | In admin/teams/[id] with SDN/bridge scoping |
| `frontend/src/lib/components/shared/EmptyState.svelte` | ✓ VERIFIED | In use on /inventory with CTA to /create |
| `frontend/src/lib/components/shared/HelpTooltip.svelte` | ✓ VERIFIED | Used in LxcResourcesStep, VmResourcesStep, and wizard steps |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ConsoleTab.svelte | console relay WebSocket | iframeSrc = relay_url | ✗ NOT_WIRED | relay_url is a WebSocket path ('/api/v1/ws/console/...') not an HTML document — iframe cannot load WS URLs |
| ConsoleTab.svelte | api.console.mintVncProxy | openConsole() → api.console.mintVncProxy | ✓ WIRED | Mint-on-click correctly implemented |
| console/proxy.py | PVE vncwebsocket | websockets_connect(upstream_url) | ✓ WIRED | Single-encode, per-cluster TLS, bidirectional relay |
| provisioning/routes.py | provisioning/service.py | service.enqueue_create_* | ✓ WIRED | All 3 create paths delegate to service |
| provisioning/service.py | lifecycle/clone.py | reserve_vmid, run_quota_admission | ✓ WIRED | Reused verbatim, quota runs before VMID reservation |
| jobs/worker.py | provisioning_functions.py | run_create_qemu/lxc/community-script registered | ✓ WIRED | All 3 job functions registered in worker |
| catalog/routes.py | catalog/service.py | load_catalog, curated_shortlist, sync_catalog | ✓ WIRED | All routes delegate to service |
| connector.lxc_exec | PVE nodes via SSH | _ssh_pct_exec (OS ssh binary subprocess) | ✓ WIRED (operationally blocked) | Code correct; requires Phase 5 SSH key trust provisioning |
| create/+page.svelte | api.quotas.getMyQuotas | quotaBudget $effect | ✓ WIRED | Quota budget populated, QuotaDeltaLine receives real data |
| create/+page.svelte | node-fit hints | clusterNodes from inventory, freeCpu: null | ✗ NOT_WIRED | node_resources not exposed via HTTP; wizard always uses null free-resource figures |
| NotificationBell.svelte | api.notifications.listNotifications | notification-feed.ts | ✓ WIRED | Derived feed from jobs table, per-user cursor |
| NetworkPicker.svelte | api.networks | networks/routes.py GET /networks | ✓ WIRED | SDN/bridge picker backed by real network service |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ConsoleTab.svelte | iframeSrc | api.console.mintVncProxy → relay_url | No — WS path not renderable | ✗ HOLLOW — wired but iframe cannot load WebSocket URL |
| QuotaDeltaLine.svelte | budget | api.quotas.getMyQuotas | Yes — real quota rows from DB | ✓ FLOWING |
| NodeSelect.svelte | nodes | clusterNodes from inventory (freeCpu: null) | No — free-resource figures always null | ⚠️ STATIC — node names present, live fit figures absent |
| CatalogBrowser.svelte | catalog | api.catalog.listCatalog → backend snapshot.json | Yes — real catalog entries | ✓ FLOWING |
| NotificationBell.svelte | feed | api.notifications.listNotifications | Yes — derived from real jobs table rows | ✓ FLOWING |
| NetworkPicker.svelte | groups | api.networks.getNetworks | Yes — real SDN/bridge inventory from PVE | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b is SKIPPED for UI-rendering paths (requires browser). Backend runnable checks:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend 485 tests pass | venv pytest --tb=no -q | 485 passed, 24 warnings | ✓ PASS |
| Frontend 354 tests pass | pnpm test | 354 passed, 23 files | ✓ PASS |
| svelte-check 0 errors | pnpm exec svelte-check --threshold error | 0 errors, 0 warnings | ✓ PASS |

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| LXC-01 | 04-06, 04-11 | Curated community-scripts list | ✓ SATISFIED | catalog curated_shortlist + CatalogBrowser |
| LXC-02 | 04-06, 04-11 | Full catalog + search + category | ✓ SATISFIED | search_catalog + CatalogBrowser full-search |
| LXC-03 | 04-06, 04-11 | One-click deploy non-interactive | ✓ CODE COMPLETE / ⚠️ OPERATIONALLY BLOCKED | run_community_script two-stage job complete; SSH key trust is Phase 5 |
| LXC-04 | 04-06, 04-11 | Source, commit hash, last-reviewed surfaced | ✓ SATISFIED | ScriptDetailPanel shows attribution triple from active pin |
| LXC-05 | 04-04, 04-11 | Deploy plain LXC from vztmpl | ✓ SATISFIED | POST /provisioning/lxc + LxcTemplateStep |
| LXC-06 | 04-04, 04-11 | Pick host/storage/network/CPU/RAM/disk | ✓ SATISFIED | LxcResourcesStep + NetworkPicker |
| LXC-07 | 04-04, 04-11 | Unprivileged / nesting / features toggles | ✓ SATISFIED | LxcResourcesStep toggles wired to CreateLxcRequest |
| VM-01 | 04-04, 04-05, 04-12 | Deploy from Cloud-Init image | ✓ SATISFIED | cloud-image source_kind + VmSourceStep |
| VM-02 | 04-04, 04-12 | Deploy from PVE template (clone) | ✓ SATISFIED | template-clone source_kind |
| VM-03 | 04-04, 04-05, 04-12 | Deploy blank VM + ISO | ✓ SATISFIED | blank-iso source_kind + IsoLibrary |
| VM-04 | 04-04, 04-12 | Clone existing VM | ✓ SATISFIED | vm-clone source_kind via enqueue_clone |
| VM-05 | 04-05, 04-13 | Cloud-Init two-pane editor | ✓ SATISFIED | CloudInitEditor + CloudInitYamlPane on all 4 VM paths |
| VM-06 | 04-05, 04-13 | Surfaces PVE-injected defaults | ✓ SATISFIED | injected:true lines dimmed + "PVE default" Badge |
| VM-07 | 04-05, 04-13 | Cloud-Init schema validation before submit | ✓ SATISFIED | cloudInitBlocksNext gates Next on hard errors |
| VM-08 | 04-05, 04-13 | ISO library + URL-download | ✓ SATISFIED | IsoLibrary with on-storage table + curated list + URL download |
| VM-09 | 04-04, 04-12 | Pick host/storage/network/CPU/RAM/disk in VM wizard | ✓ SATISFIED | VmResourcesStep |
| VM-10 | 04-04, 04-12 | Real-time quota delta + node-fit hints | ✗ PARTIAL | Quota delta SATISFIED. Node-fit hints NOT SATISFIED: connector.node_resources not exposed via HTTP; wizard always has null free-resource figures; computeNodeFit never fires "won't fit" |
| NET-01 | 04-07, 04-12 | Lists SDN zones/VNets/subnets | ✓ SATISFIED | network service + NetworkPicker |
| NET-02 | 04-07, 04-14 | Admin scopes SDN per team | ✓ SATISFIED | NetworksTab on admin/teams/[id] |
| NET-03 | 04-07, 04-12 | IPAM auto-picks free IP | ✓ SATISFIED | IPAM logic in network service + NetworkPicker |
| NET-04 | 04-07, 04-12 | Legacy bridge fallback | ✓ SATISFIED | bridges always shown (D-19), grouped separately |
| CON-01 | 04-08, 04-14 | Embedded noVNC console in iframe | ✗ BLOCKED | iframe src is WebSocket path, not HTML document; no noVNC client page exists |
| CON-02 | 04-08, 04-14 | vncticket minted on click, not page load | ✓ SATISFIED | ConsoleTab renders no iframe on mount; mintVncProxy called only on click |
| CON-03 | 04-08, 04-14 | Console through GUI reverse-proxied WebSocket | ✓ SATISFIED | relay backend complete; consoleIframeSrc guards :8006; Caddy flush_interval -1 block |
| UI-04 | 04-09, 04-10, 04-14 | Distinct empty states with CTAs | ✓ SATISFIED | EmptyState on /inventory with "Create one" CTA to /create; provisioning banner |
| UI-05 | 04-09, 04-11..14 | Inline ? help on PVE-specific fields | ✓ SATISFIED | HelpTooltip on every PVE field in wizard steps |
| UI-07 | 04-14 | In-app notification bell — task completions | ✓ SATISFIED | NotificationBell in Topbar, derived feed, unread badge |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/catalog/service.py` | 295, 302 | `datetime.utcnow()` deprecated — naive datetime | ⚠️ Warning | Inconsistent with tz-aware codebase; ISO string missing offset; may cause tz-aware comparison crash (WR-03) |
| `backend/app/catalog/service.py` | 65-66, 132-137 | `_SNAPSHOT_CACHE` module-global lazy-fill without asyncio lock | ⚠️ Warning | Thundering-herd race on first concurrent request (WR-04) |
| `backend/app/jobs/provisioning_functions.py` | 145-160 | `commit_sha` from `catalog_pin` interpolated into shell command URL without 40-char hex validation | ⚠️ Warning | Supply-chain surface — WR-01; CLAUDE.md constraint #8 ("Pin to commit hashes") not fully closed |
| `frontend/src/lib/components/console/ConsoleTab.svelte` | 158-163 | iframe `src` is WebSocket relay path (not HTML doc); no `sandbox` attribute | 🛑 Blocker | CON-01 broken — iframe cannot load a WebSocket URL; no noVNC client rendered |
| `backend/app/networks/routes.py` | 94-99 | `tokens[0].team_id` picks first team non-deterministically for multi-team users | ⚠️ Warning | Picker shows wrong team's grants for multi-team users (WR-05) |
| `backend/app/provisioning/service.py` | 371-386 | `_resolve_ostemplate` fabricates volid without verifying template is present on storage | ⚠️ Warning | community-script stage 1 fails opaquely on missing template (WR-06) |
| `backend/app/iso/service.py` | 108-169 | `filename` and `storage` passed to PVE download-url without path-traversal validation | ⚠️ Warning | Defense-in-depth gap (WR-07) |

### Human Verification Required

#### 1. noVNC Console End-to-End Rendering

**Test:** Navigate to an existing VM's Console tab. Click "Open console". Observe the iframe.
**Expected:** A noVNC VNC client loads in the iframe and renders the VM's screen.
**Why human:** The iframe src wiring gap (ConsoleTab sets src to WebSocket relay path) means the console cannot render. This requires a fix decision: (a) embed noVNC JS library in the iframe `<script>` pointing at the relay WS, (b) serve a static noVNC HTML page from the backend, or (c) use a different console approach. The decision affects the architecture.

#### 2. Community-Script Deploy End-to-End (SSH Trust)

**Test:** On a freshly-provisioned GUI LXC (Phase 5 installer), trigger a community-script deploy from the wizard.
**Expected:** The LXC is created; stage 2 runs the install script inside it via pct exec over SSH; install output streams to the Tasks drawer.
**Why human:** Requires Phase 5 SSH key trust provisioning from the GUI LXC to PVE nodes. Cannot be verified programmatically without a running deployment.

#### 3. Node-Fit Hints — Live Data

**Test:** In the Create wizard, select a cluster with a loaded node (PVE Resource view). Request RAM/CPU exceeding what one node has free.
**Expected:** That node is disabled in the NodeSelect with "node-X — Y GB free, needs Z GB".
**Why human:** connector.node_resources() exists in the connector but no HTTP route exposes it. The wizard always passes freeCpu: null / freeRamMb: null. Need to verify whether node-fit is expected to work end-to-end in Phase 4 or whether the null graceful-degradation was the intended v1 behaviour.

---

## Gaps Summary

**Two blocking gaps and one partial gap prevent the phase goal from being fully achieved.**

### Gap 1 — CON-01: noVNC console iframe cannot render (blocker)

The most critical gap. `ConsoleTab.svelte` sets the iframe `src` to the relay WebSocket path (`/api/v1/ws/console/{id}/{kind}/{vmid}`). Browsers cannot load WebSocket URLs in iframes — the iframe displays nothing. The spike §7 contract was clear: the iframe loads "a GUI-served noVNC client page" (e.g. `src="/console/embed?ws=/api/v1/ws/console/..."` or equivalent). That HTML client page was never created. The backend relay, the mint route, the Caddy config, the CON-02/CON-03 invariants are all correctly implemented — only the final "noVNC client in iframe" step is missing.

This is NOT a minor wiring oversight — without a noVNC client page, the console feature is entirely non-functional for the user. CON-01 requires either: (a) a backend-served static noVNC HTML page that connects to the relay WS, (b) an SvelteKit `/console/embed` route that loads the noVNC JS client, or (c) embedding the noVNC RFB client JS directly in ConsoleTab.svelte. Option (c) contradicts the UI-SPEC note about not bundling `@novnc/novnc` as an npm dependency, so options (a) or (b) are the intended path.

### Gap 2 — VM-10 node-fit hints: data disconnected (partial)

The node-fit architecture is complete and tested. `computeNodeFit`, `allBlocked`, `NodeSelect.svelte` are all correct. But `connector.node_resources()` has no HTTP route, so the wizard always uses `freeCpu: null / freeRamMb: null`. The "won't fit on node-1" user experience never materialises. The quota-delta half of VM-10 is fully functional.

Fix: add `GET /api/v1/clusters/{cluster_id}/nodes/resources` exposing the `connector.node_resources()` data, and wire a matching API call in the wizard's `$effect` that populates `clusterNodes` with real free figures.

### Gap 3 — LXC-03: SSH key trust (operational dependency, Phase 5)

`run_community_script` stage 2 requires SSH key trust from the GUI LXC to PVE nodes. The 04-06-SUMMARY explicitly documents this as a Phase 5 installer step. The code is complete and correct. This gap is partially deferred to Phase 5, but means LXC-03 cannot be demonstrated on a fresh install until Phase 5 packaging ships the SSH keypair provisioning.

### Notable Warnings (non-blocking)

- **WR-01:** `commit_sha` from `catalog_pin` is interpolated into shell commands without 40-char hex validation — the supply-chain hardening CLAUDE.md constraint #8 specifies is not fully closed.
- **WR-03:** `datetime.utcnow()` in `catalog/service.py` — deprecated, produces naive datetimes inconsistent with the tz-aware codebase.
- **WR-05:** `tokens[0].team_id` — non-deterministic team resolution for multi-team users in the network picker.
- **WR-06:** `_resolve_ostemplate` fabricates a template volid without verifying it exists on storage.

---

_Verified: 2026-05-16T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
