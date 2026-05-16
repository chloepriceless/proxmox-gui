---
phase: 04-provisioning-networking-console
verified: 2026-05-17T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Embedded noVNC console iframe now loads the GUI-origin /console/embed HTML route (CON-01 closed by 04-15)"
    - "Node-fit hints now fire with live free CPU/RAM data from GET /clusters/{id}/nodes/resources (VM-10 closed by 04-16)"
    - "community-script commit_sha + slug validated against ^[0-9a-f]{40}$ / ^[a-z0-9][a-z0-9-]*$ before any interpolation (WR-01 closed by 04-17)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to an existing VM's Console tab. Click 'Open console'. Observe the iframe."
    expected: "The iframe loads the /console/embed SvelteKit page. The vendored noVNC RFB client instantiates and renders the VM's screen (the overlay transitions from 'Connecting...' to the framebuffer). Confirm the iframe carries sandbox='allow-scripts allow-same-origin'. Confirm the relay WS URL in DevTools uses window.location.host, not a :8006 host."
    why_human: "End-to-end rendering requires a live Proxmox cluster, a running relay backend, and a browser. The code wiring is verified programmatically; the visual framebuffer render is not."
  - test: "On a freshly-provisioned GUI LXC (after Phase 5 installer provisions SSH key trust), trigger a community-script deploy from the wizard."
    expected: "The LXC is created (stage 1); stage 2 runs the install script inside it via pct exec over SSH; install output streams to the Tasks drawer."
    why_human: "Requires Phase 5 SSH key trust provisioning from the GUI LXC to PVE nodes. Cannot be verified programmatically without a running deployment."
  - test: "In the Create wizard, select a cluster. Request RAM exceeding what one node has free (visible in Proxmox Resource view)."
    expected: "That node is disabled in the NodeSelect component with a label like 'node-X — Y GB free, needs Z GB'. Nodes with sufficient capacity remain selectable."
    why_human: "Requires a live Proxmox cluster reachable by the backend. computeNodeFit logic and getNodeResources wiring are programmatically verified; the visual disabled-node UX requires a browser against a live cluster."
---

# Phase 4: Provisioning, Networking & Console — Re-verification Report

**Phase Goal:** A user can self-provision LXCs (plain or from a curated community-script with full source/version visibility) and VMs (Cloud-Init image / PVE template / blank+ISO / clone) end-to-end through wizards, on the SDN/bridge they're allowed to use, and open an embedded noVNC console without ever touching the Proxmox UI.

**Verified:** 2026-05-17T00:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 04-15, 04-16, 04-17)

## Re-verification Summary

The prior verification (2026-05-16T23:00:00Z) found 3/5 must-haves verified (gaps in CON-01, VM-10, and WR-01). Three gap-closure plans were executed:

- **04-15 (CON-01):** Vendored noVNC v1.6.0 in-repo, added the `/console/embed` SvelteKit route, rewired `ConsoleTab.svelte` to point the iframe at the HTML route. Committed as `89d1733`, `0522c83`, `46e2f78`, `04851f1`.
- **04-16 (VM-10):** Added `GET /clusters/{id}/nodes/resources` backend route + `NodeResourceItem` schema with correct unit math, wired the create wizard `clusterNodes` `$effect` to fetch live free CPU/RAM figures. Committed as `f514b4e`, `00bff62`, `9705f8a`.
- **04-17 (WR-01):** Added `_validate_commit_sha` and `_validate_slug` guards in `provisioning_functions.py`, applied at the job boundary (fail-fast before stage-1 LXC create) and inside `_build_install_command` (defense in depth). Committed as `ad67aed`, `71ffef1`.

All three gaps are confirmed closed by direct codebase verification below. The test suite confirms no regressions: **506 backend tests passed, 364 frontend tests passed, 0 svelte-check errors**.

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can browse curated + full community-scripts catalog, see source/commit/last-reviewed before deploy, one-click deploy, and deploy a plain LXC picking host/storage/network/CPU/RAM/disk/unprivileged/nesting/features | VERIFIED | Unchanged from prior verification — catalog + LXC provisioning backend/frontend wired; 22 catalog + 17 provisioning backend tests green |
| 2 | User can launch a VM wizard with 4 paths, browse ISO library + URL-download, and edit Cloud-Init in a two-pane form/YAML editor showing all derived values + running schema validation | VERIFIED | Unchanged from prior verification — VM-01..08 backend + frontend complete; 364 frontend + 506 backend tests green |
| 3 | Network picker enumerates SDN zones/VNets/subnets with admin-controlled visibility, falls back to legacy bridges, IPAM auto-picks IP; wizard shows real-time quota delta and node-fit hints ("won't fit on node-1") | VERIFIED | NET-01..04 verified (unchanged). Quota delta VERIFIED (unchanged). Node-fit hints NOW VERIFIED: `GET /clusters/{id}/nodes/resources` exposes live free CPU/RAM via `connector.node_resources()`; `clusterNodes` `$effect` merges real `free_cpu`/`free_ram_mb` into the wizard; `computeNodeFit` fires a "won't fit" verdict against live figures. Graceful degradation: fetch failure leaves `clusterNodes` with `null` (fit-unknown), wizard still works. |
| 4 | User can open embedded noVNC console in an iframe; vncticket minted on click (never on page load); refreshed before expiry; all traffic through GUI's reverse-proxied WebSocket — no direct Proxmox exposure | VERIFIED | CON-01 NOW VERIFIED: `ConsoleTab.svelte` points iframe at `/console/embed?ws=<encoded relay path>` via `consoleEmbedSrc`/`consoleIframeSrc`; `<iframe>` carries `sandbox="allow-scripts allow-same-origin"`. `/console/embed` SvelteKit route hosts vendored noVNC v1.6.0 RFB client; `+page.ts` validates `ws` param to same-origin relay path; `+page.svelte` builds `wss://` URL from `window.location.host`. CON-02 (mint-on-click) not regressed — iframe only in `live` state. CON-03 preserved — no `:8006` URL reaches browser. `@novnc/novnc` absent from `package.json`. |
| 5 | Empty list states show actionable CTAs; every PVE-specific wizard field has a `?` tooltip; notification bell surfaces task completions in real time | VERIFIED | Unchanged from prior verification — EmptyState, HelpTooltip, NotificationBell all wired and tested |

**Score: 5/5 truths verified** (all roadmap success criteria met in code)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | SSH key trust from GUI LXC to PVE nodes (LXC-03 operational prerequisite) | Phase 5 | Phase 5 goal: "helper-script polish, packaging as ready-to-deploy LXC" — the install.sh provisions the SSH keypair; 04-06-SUMMARY explicitly states this is a Phase 5 packaging step |

### Required Artifacts — Gap-Closure Plans (Changed Files)

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend/src/lib/vendor/novnc/core/rfb.js` | VERIFIED | Exists; vendored noVNC v1.6.0 ESM source; `@novnc/novnc` absent from `package.json` |
| `frontend/src/lib/vendor/novnc/README.md` | VERIFIED | Exists; contains `v1.6.0`, `https://github.com/novnc/noVNC`, `MPL-2.0`, provenance record |
| `frontend/src/routes/console/embed/+page.svelte` | VERIFIED | 139 lines; instantiates `new RFB(screenEl, relayUrl, {})` against `wss://window.location.host + data.ws`; handles connect/disconnect lifecycle; renders inline error when `data.ws` is null |
| `frontend/src/routes/console/embed/+page.ts` | VERIFIED | `ssr = false`; `safeWsParam` validates `ws` to same-origin `/api/v1/ws/console/` relay path; rejects absolute / protocol-relative URLs; returns `ws: null` on failure (no opaque 500) |
| `frontend/src/lib/components/console/console-tab.ts` | VERIFIED | Exports `consoleEmbedSrc` (composes `/console/embed?ws=<encoded>` from relay path after `isSafeRelayUrl` check); `consoleIframeSrc` now gates iframe src to `/console/embed?ws=` prefix; bare `/api/v1/ws/console/...` WebSocket path rejected |
| `frontend/src/lib/components/console/ConsoleTab.svelte` | VERIFIED | `openConsole()` calls `consoleIframeSrc(consoleEmbedSrc(res.relay_url))`; `<iframe>` carries `sandbox="allow-scripts allow-same-origin"` + `title` attribute; `iframeVisible` unchanged (CON-02 not regressed) |
| `backend/app/clusters/schemas.py` | VERIFIED | Contains `NodeResourceItem` with `node`, `free_cpu: float`, `free_ram_mb: int`, `status` fields; `from_pve` classmethod performs unit math (`maxcpu * (1 - cpu)`, `(maxmem - mem) // (1024 * 1024)`) |
| `backend/app/clusters/service.py` | VERIFIED | Contains `list_node_resources(db, registry, *, cluster_id)` using `registry.get(cluster_id, db=db)` and returning `connector.node_resources()` rows |
| `backend/app/clusters/routes.py` | VERIFIED | Contains `GET /{cluster_id}/nodes/resources` at line 183; uses `get_current_principal` (authenticated non-admin); synchronous read (no 202); returns `list[NodeResourceItem]` |
| `frontend/src/lib/api/clusters.ts` | VERIFIED | Exports `getNodeResources({ clusterId })` calling `GET /clusters/{clusterId}/nodes/resources` |
| `frontend/src/routes/create/+page.svelte` | VERIFIED | `clusterNodes` `$effect` calls `api.clusters.getNodeResources` with `.catch(() => null)` graceful degradation; `freeCpu`/`freeRamMb` set from `row.free_cpu`/`row.free_ram_mb`; stale "no node-free-resource API in Phase 4" comment removed |
| `backend/app/jobs/provisioning_functions.py` | VERIFIED | Contains `_COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$")` (line 44); `_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")` (line 47); `_validate_commit_sha` and `_validate_slug` functions; job-boundary `try/except ValueError` guard at lines 302-319 (BEFORE stage-1 LXC create at line 322); `_build_install_command` also calls validators (defense in depth, lines 196-197) |

### Key Link Verification — Gap-Closure Changes

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ConsoleTab.svelte` | `/console/embed` SvelteKit route | `iframeSrc = consoleIframeSrc(consoleEmbedSrc(res.relay_url))` | WIRED | `consoleEmbedSrc` composes the `/console/embed?ws=<encoded>` URL; `consoleIframeSrc` gates it; iframe `src` is an HTML document path |
| `/console/embed/+page.ts` | `isSafeRelayUrl` | `safeWsParam` calls `isSafeRelayUrl(raw)` | WIRED | Same-origin relay path validation reused from `console-tab.ts`; absolute / protocol-relative URLs rejected separately |
| `/console/embed/+page.svelte` | vendored noVNC RFB client | `import RFB from '$lib/vendor/novnc/core/rfb.js'`; `new RFB(screenEl, relayUrl, {})` | WIRED | RFB instantiated against `wss://window.location.host + data.ws` — never a Proxmox host |
| `backend/clusters/routes.py` | `connector.node_resources()` | `service.list_node_resources` → `registry.get(cluster_id, db=db)` | WIRED | Route at `/{cluster_id}/nodes/resources` calls service which calls connector |
| `create/+page.svelte` | `GET /clusters/{id}/nodes/resources` | `api.clusters.getNodeResources({ clusterId: cid })` in `clusterNodes` `$effect` | WIRED | `.catch(() => null)` ensures graceful degradation |
| `clusterNodes` free figures | `computeNodeFit` | `freeCpu: row.free_cpu, freeRamMb: row.free_ram_mb` in `$effect` merge | WIRED | `computeNodeFit` receives real figures; "won't fit" verdict fires when requested > free |
| `run_community_script` | `_fail_job` (malformed input) | `try: _validate_slug/commit_sha ... except ValueError: await _fail_job(...)` | WIRED | Guard is before stage-1 dispatch; malformed value never creates LXC, never builds install command |
| `_build_install_command` | validated slug/sha | `slug = _validate_slug(slug)` + `commit_sha = _validate_commit_sha(commit_sha)` before f-string | WIRED | Defense in depth at the use site; rejects metacharacters, path traversal, non-hex chars |

### Data-Flow Trace (Level 4) — Reopened Gaps

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `/console/embed/+page.svelte` | `relayUrl` | `data.ws` from `+page.ts` load → `window.location.host + data.ws` | Yes — same-origin relay path from validated mint response | FLOWING |
| `ConsoleTab.svelte` | `iframeSrc` | `consoleIframeSrc(consoleEmbedSrc(res.relay_url))` where `res` = live mint response | Yes — `relay_url` from live PVE vncproxy mint | FLOWING |
| `NodeSelect.svelte` | `nodes[].freeCpu`/`freeRamMb` | `api.clusters.getNodeResources` → `connector.node_resources()` → PVE `/cluster/resources?type=node` | Yes — live per-node capacity from PVE | FLOWING |
| `run_community_script` | `slug`, `commit_sha` | `catalog_pin` row from DB | Yes — validated before any use | FLOWING (with validation guards) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend 506 tests pass (includes 16 new WR-01 tests, 5 new node-resources route tests) | `python -m pytest -q --tb=no` | 506 passed, 24 warnings | PASS |
| Frontend 364 tests pass (includes new console-tab + node-fit tests) | `pnpm test` | 364 passed, 23 files | PASS |
| svelte-check 0 errors | `pnpm exec svelte-check --threshold error` | 0 errors, 0 warnings | PASS |
| `rfb.js` vendored + `@novnc/novnc` absent from package.json | file check + grep | rfb.js EXISTS; @novnc/novnc NOT in package.json | PASS |
| `nodes/resources` route present in routes.py | grep | Line 183 | PASS |
| `[0-9a-f]{40}` pattern present in provisioning_functions.py | grep | Line 44 | PASS |
| Validation guard precedes stage-1 LXC create | line-number inspection | Guard lines 302-319, stage-1 dispatch line 322 | PASS |

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| LXC-01 | 04-06, 04-11 | Curated community-scripts list | SATISFIED | catalog curated_shortlist + CatalogBrowser |
| LXC-02 | 04-06, 04-11 | Full catalog + search + category | SATISFIED | search_catalog + CatalogBrowser full-search |
| LXC-03 | 04-06, 04-11, 04-17 | One-click deploy non-interactive | CODE COMPLETE / OPERATIONALLY BLOCKED (Phase 5) | run_community_script two-stage job complete; WR-01 validation guards added; SSH key trust is Phase 5 |
| LXC-04 | 04-06, 04-11 | Source, commit hash, last-reviewed surfaced | SATISFIED | ScriptDetailPanel shows attribution triple from active pin |
| LXC-05 | 04-04, 04-11 | Deploy plain LXC from vztmpl | SATISFIED | POST /provisioning/lxc + LxcTemplateStep |
| LXC-06 | 04-04, 04-11 | Pick host/storage/network/CPU/RAM/disk | SATISFIED | LxcResourcesStep + NetworkPicker |
| LXC-07 | 04-04, 04-11 | Unprivileged / nesting / features toggles | SATISFIED | LxcResourcesStep toggles wired to CreateLxcRequest |
| VM-01 | 04-04, 04-05, 04-12 | Deploy from Cloud-Init image | SATISFIED | cloud-image source_kind + VmSourceStep |
| VM-02 | 04-04, 04-12 | Deploy from PVE template (clone) | SATISFIED | template-clone source_kind |
| VM-03 | 04-04, 04-05, 04-12 | Deploy blank VM + ISO | SATISFIED | blank-iso source_kind + IsoLibrary |
| VM-04 | 04-04, 04-12 | Clone existing VM | SATISFIED | vm-clone source_kind via enqueue_clone |
| VM-05 | 04-05, 04-13 | Cloud-Init two-pane editor | SATISFIED | CloudInitEditor + CloudInitYamlPane on all 4 VM paths |
| VM-06 | 04-05, 04-13 | Surfaces PVE-injected defaults | SATISFIED | injected:true lines dimmed + "PVE default" Badge |
| VM-07 | 04-05, 04-13 | Cloud-Init schema validation before submit | SATISFIED | cloudInitBlocksNext gates Next on hard errors |
| VM-08 | 04-05, 04-13 | ISO library + URL-download | SATISFIED | IsoLibrary with on-storage table + curated list + URL download |
| VM-09 | 04-04, 04-12 | Pick host/storage/network/CPU/RAM/disk in VM wizard | SATISFIED | VmResourcesStep |
| VM-10 | 04-04, 04-12, 04-16 | Real-time quota delta + node-fit hints | SATISFIED | Quota delta SATISFIED (unchanged). Node-fit hints NOW SATISFIED: GET /clusters/{id}/nodes/resources + clusterNodes $effect merge + computeNodeFit fires "won't fit" with live data. Graceful degradation to fit-unknown on fetch failure. |
| NET-01 | 04-07, 04-12 | Lists SDN zones/VNets/subnets | SATISFIED | network service + NetworkPicker |
| NET-02 | 04-07, 04-14 | Admin scopes SDN per team | SATISFIED | NetworksTab on admin/teams/[id] |
| NET-03 | 04-07, 04-12 | IPAM auto-picks free IP | SATISFIED | IPAM logic in network service + NetworkPicker |
| NET-04 | 04-07, 04-12 | Legacy bridge fallback | SATISFIED | bridges always shown, grouped separately |
| CON-01 | 04-08, 04-14, 04-15 | Embedded noVNC console in iframe | SATISFIED | iframe src = `/console/embed?ws=<relay path>`; /console/embed hosts vendored noVNC v1.6.0 RFB client; wss:// built from window.location.host; sandbox attribute present |
| CON-02 | 04-08, 04-14 | vncticket minted on click, not page load | SATISFIED | ConsoleTab renders no iframe on mount; mintVncProxy called only on click; iframeVisible unchanged |
| CON-03 | 04-08, 04-14 | Console through GUI reverse-proxied WebSocket | SATISFIED | relay backend complete; isSafeRelayUrl guards :8006; consoleIframeSrc guards embed route; +page.ts safeWsParam guards ws param; +page.svelte builds wss:// from window.location.host |
| UI-04 | 04-09, 04-10, 04-14 | Distinct empty states with CTAs | SATISFIED | EmptyState on /inventory with "Create one" CTA to /create |
| UI-05 | 04-09, 04-11..14 | Inline ? help on PVE-specific fields | SATISFIED | HelpTooltip on every PVE field in wizard steps |
| UI-07 | 04-14 | In-app notification bell — task completions | SATISFIED | NotificationBell in Topbar, derived feed, unread badge |

### Anti-Patterns Found (Gap-Closure Plans)

No new blockers introduced by the gap-closure plans.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/lib/components/console/console-tab.ts` | 47 | `isSafeRelayUrl` final branch uses `includes` (substring) not `startsWith` — an absolute URL containing the relay prefix passes (code-review WR-02) | Warning | Not currently exploitable (safeWsParam in +page.ts pre-filters absolute URLs); but isSafeRelayUrl should be self-sufficient |
| `frontend/src/routes/console/embed/+page.svelte` | 57 | `new RFB(...)` construction not wrapped in try/catch — a synchronous RFB constructor throw leaves status stuck at 'connecting' (code-review WR-03) | Warning | User sees permanent "Connecting..." overlay with no recovery; fix: wrap in try/catch and set `status = 'ended'` on error |
| `backend/app/clusters/service.py` | 303-309 | `r.cluster_id and _team_id_from_userid(...)` short-circuit + unguarded parse (code-review WR-01 from gap-closure review, pre-existing) | Warning | Corrupt payload for cluster_id=0/None rows; bare ValueError on non-standard userid format |
| `backend/app/jobs/provisioning_functions.py` | 216-242 | `_GUI_ROOTFS` sentinel key injected into container process environment (code-review IN-02, pre-existing) | Info | Pollutes third-party install script's env namespace; harmless but a code smell |
| `backend/app/jobs/provisioning_functions.py` | 376-379 | `stdin_data="y\n" * 50` magic constant (code-review IN-03, pre-existing) | Info | Undocumented; could exhaust if > 50 prompts; promote to named constant |

### Human Verification Required

#### 1. noVNC Console End-to-End Rendering

**Test:** Navigate to an existing VM's Console tab. Click "Open console". Observe the iframe.
**Expected:** The iframe loads the `/console/embed` SvelteKit page (verifiable via DevTools Network tab as a document request to `/console/embed?ws=...`). The vendored noVNC RFB client instantiates and the VM's screen renders in the framebuffer. The overlay transitions from "Connecting..." to the live display. Confirm the iframe carries `sandbox="allow-scripts allow-same-origin"`. Confirm the WS URL in DevTools Network (WS tab) uses the GUI's own origin/host, not `:8006`.
**Why human:** End-to-end rendering requires a live Proxmox cluster, a running relay backend, and a browser. The code wiring is fully verified programmatically (all tests pass, svelte-check clean); visual framebuffer render and WebSocket establishment cannot be tested without running infrastructure.

#### 2. Community-Script Deploy End-to-End (SSH Trust)

**Test:** On a freshly-provisioned GUI LXC (after Phase 5 installer provisions SSH key trust), trigger a community-script deploy from the wizard.
**Expected:** The LXC is created (stage 1 completes); stage 2 runs the install script inside it via `pct exec` over SSH; install output streams to the Tasks drawer. A deploy with a tampered slug or commit hash should fail fast before the LXC is created, with a clear error in the Tasks drawer.
**Why human:** Requires Phase 5 SSH key trust provisioning from the GUI LXC to PVE nodes. Cannot be verified programmatically without a running deployment.

#### 3. Node-Fit Hints — Live Data

**Test:** In the Create wizard, select a cluster. Request RAM exceeding what one node has free (visible in Proxmox Resource view or PVE dashboard). Observe the NodeSelect component.
**Expected:** The over-provisioned node is disabled (greyed out) with a hint like "node-X — Y GB free, needs Z GB". Nodes with sufficient capacity remain selectable. Confirm in DevTools that `GET /clusters/{id}/nodes/resources` is called and returns non-null `free_cpu`/`free_ram_mb` values.
**Why human:** Requires a live Proxmox cluster reachable by the backend. The `computeNodeFit` logic and `getNodeResources` wiring are programmatically verified; the visual disabled-node UX requires a browser against a live cluster.

## Gaps Summary

No unresolved gaps remain. All three gaps from the initial verification are confirmed closed by direct codebase inspection:

1. **CON-01 (noVNC console iframe)** — CLOSED. `ConsoleTab.svelte` now points the iframe at `/console/embed?ws=<encoded relay path>`. The `/console/embed` SvelteKit route hosts the vendored noVNC v1.6.0 RFB client and connects it to the GUI relay WebSocket via `window.location.host`. The `<iframe>` carries `sandbox="allow-scripts allow-same-origin"`. `@novnc/novnc` is absent from `package.json`. The 360 frontend tests pass including new TDD-cycle console-tab tests.

2. **VM-10 (node-fit hints hollow)** — CLOSED. `GET /clusters/{id}/nodes/resources` is implemented at `backend/app/clusters/routes.py:183` behind `get_current_principal` (non-admin). `NodeResourceItem.from_pve` performs correct unit math (verified by tests: `free_cpu == 6.0` for `maxcpu=8, cpu=0.25`; `free_ram_mb == 12288` for 16 GiB total / 4 GiB used). The create wizard `clusterNodes` `$effect` fetches live figures with `.catch(() => null)` graceful degradation. The stale "no node-free-resource API in Phase 4" comment is removed.

3. **WR-01 (community-script commit_sha unvalidated)** — CLOSED. `_validate_commit_sha` (`^[0-9a-f]{40}$`) and `_validate_slug` (`^[a-z0-9][a-z0-9-]*$`) are applied at both the job boundary (fail-fast with audited `_fail_job` before any LXC is created) and inside `_build_install_command` (defense in depth). 16 new tests cover every rejection case. The full backend suite is 506 passed.

Three items require human verification against a live Proxmox cluster before the phase can be marked `passed`: the visual noVNC framebuffer render, the community-script end-to-end deploy with SSH trust, and the node-fit disabled-node UX with live cluster data.

---

_Verified: 2026-05-17T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after gap closure (plans 04-15, 04-16, 04-17)_
