# Phase 4: Provisioning, Networking & Console - Research

**Researched:** 2026-05-16
**Domain:** Proxmox VE provisioning (LXC + VM creation), SDN networking, embedded noVNC console, community-scripts catalog
**Confidence:** MEDIUM-HIGH — core provisioning/cloud-init/console are HIGH; SDN and community-scripts execution mechanics are MEDIUM-LOW and **gated behind three mandatory spikes** (consistent with ROADMAP).

## Summary

Phase 4 is the project's headline milestone: the first end-to-end "click → running VM/LXC". It extends a mature, well-patterned codebase — Phases 1-3 shipped 24 plans, 24/24 complete, with the connector, job queue, UPID poller, `reserve_vmid`, quota admission, audit pipeline, Tasks-drawer WebSocket, and the per-team privsep-token model all in place. Phase 4 adds **no new architectural primitives** for provisioning; it adds new `PVEConnector` methods (`create_qemu`, `create_lxc`, `lxc_exec`, `vncproxy`, SDN reads, storage/ISO ops, download), new arq job functions following the established `_run_polled_job` shape, a `backend/app/provisioning/` module, a community-scripts catalog module, an SDN read module, an ISO/cloud-image module, and a noVNC reverse-proxy WebSocket endpoint. The frontend adds the unified `/create` wizard, the Cloud-Init two-pane editor, the SDN picker, the noVNC Console tab, the notification bell, and the `EmptyState`/`HelpTooltip` shared components.

Three sub-domains carry real risk and **must be de-risked by spikes before implementation** (ROADMAP-mandated, re-confirmed by this research): (1) **community-scripts non-interactive execution** — the upstream `build.func` orchestrator is built around interactive `whiptail` prompts; non-interactive invocation works via `var_*` environment variables but the GUI's own "create empty LXC then `pct exec` the install stage" model (Pitfall 10) means the GUI does NOT run `build.func` at all — it runs only the per-app `*-install.sh` stage inside the container, which is a different and less-validated path; (2) **SDN reload/applied semantics** — SDN has a two-state model (pending vs applied), no documented "next-free-IP" REST endpoint, and IPAM is still partially tech-preview even in PVE 8.1+; (3) **noVNC `vncticket`** — confirmed ~10-40s lifetime, confirmed that the ticket must be URL-encoded **exactly once** (`encodeURIComponent`), and the GUI must reverse-proxy the WebSocket through Caddy with the correct `Upgrade`/`Connection` headers.

**Primary recommendation:** Sequence the three spikes first (plans 04-01..03 or `/gsd-spike` runs). Build provisioning as new `PVEConnector` methods + arq job functions strictly following the Phase-3 `clone_migrate_functions._run_polled_job` pattern. Reuse `reserve_vmid` and `run_quota_admission` verbatim. Treat the community-scripts install stage as the single highest-risk task — ship a defaults-only fallback (D-07) and pin to a reviewed commit hash (Pitfall 10). For noVNC, mint the ticket on click, reverse-proxy through a FastAPI WebSocket endpoint, and add the WebSocket-upgrade headers to the Caddyfile.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| VM/LXC creation (qemu/pct create) | API / Backend (arq worker) | Proxmox | Mutating PVE call → 202 + job + UPID poll (CLAUDE.md constraint 1) |
| Community-script install (`pct exec`) | API / Backend (arq worker) | Proxmox host | Runs inside the fresh LXC, never on host (Pitfall 10); output streams to Tasks drawer |
| VMID reservation | API / Backend | — | App-level per-cluster lock + reserved set — already shipped (`clone.py`) |
| Cloud-Init YAML generation + schema validation | API / Backend | Frontend Server (SSR) | Backend owns the effective-config render + PVE-injected defaults; FE shows it read-only |
| SDN zone/VNet/subnet enumeration | API / Backend | Proxmox | Cluster-scoped reads; backend caches; FE consumes a flat list |
| Per-team network scoping | API / Backend (DB) | — | New DB table; admin writes on `/admin/teams/{id}#networks` |
| IPAM free-IP pick | API / Backend | Proxmox | Backend calls SDN/IPAM; spike must confirm the exact endpoint |
| noVNC ticket mint | API / Backend | Proxmox | `vncproxy` POST; ticket never reaches the browser before the click |
| noVNC console WebSocket | API / Backend (proxy) + CDN/proxy (Caddy) | Browser (iframe) | GUI reverse-proxies the WS — no direct Proxmox exposure (CON-03) |
| ISO / cloud-image download | API / Backend (arq worker) | Proxmox storage | URL-download via PVE's storage download-url endpoint; runs as a job |
| Node-fit computation | API / Backend | Proxmox | Live free-resource read at picker render; FE disables unfit options |
| Notification bell feed | Frontend Server (SSR) + API | DB (`jobs` table) | Derived from existing `jobs` rows + per-user last-seen — no new table |
| Wizard form state | Browser (sessionStorage) | — | Draft persistence is client-side only (UI-SPEC §Form-state persistence) |

## Standard Stack

Phase 4 introduces **no new backend libraries** and **two official shadcn-svelte blocks** on the frontend. The stack is fully inherited from `.planning/research/STACK.md` and the Phase 1-3 implementations.

### Core (all already installed — verified against `backend/pyproject.toml` references and STACK.md)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| proxmoxer | 2.3.0 | Proxmox API client — all new create/SDN/console calls | `[VERIFIED: PyPI]` 2.3.0 released 2026-03-04, supports Python 3.10-3.14, PVE 7/8/9; the only mature Python client |
| FastAPI | 0.136.x | New `/provisioning`, `/catalog`, `/networks`, `/iso`, `/console` routes + the noVNC WS endpoint | `[CITED: STACK.md]` already the project's framework |
| arq | 0.26.x | New provisioning job functions (qemu create, lxc create, `pct exec`, ISO download) | `[CITED: STACK.md]` Phase-3 job-queue infrastructure already wired |
| SQLAlchemy 2.0 + aiosqlite + Alembic | 2.0.x / 0.20+ / 1.14 | New tables: network scoping, catalog pin, notification last-seen | `[CITED: STACK.md]` hand-written migrations (project convention) |
| PyYAML | 6.0+ | Cloud-Init `#cloud-config` user-data render for the read-only preview | `[CITED: STACK.md]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `radio-group` (shadcn-svelte block) | official registry | Wizard path-picker card-grid, Cloud-Init seeding choices, DHCP/static IP toggle | `[CITED: 04-UI-SPEC.md]` `pnpm dlx shadcn-svelte@latest add radio-group` |
| `stepper` (shadcn-svelte block) | official registry | Wizard progress indicator | `[CITED: 04-UI-SPEC.md]` if unavailable, hand-roll from the Phase-1 setup-wizard stepper — no third-party npm dep |
| `httpx` | 0.28.x | Fetching the community-scripts catalog snapshot / commit metadata from GitHub | Already a dependency; use `httpx.AsyncClient` for the admin "Sync catalog" pull |

### Cloud-Init schema validation (VM-07) — investigate during planning

| Option | Approach | Tradeoff |
|--------|----------|----------|
| Shell-out to `cloud-init schema` | Run the `cloud-init` CLI's schema validator | `[ASSUMED]` requires `cloud-init` installed in the GUI's own LXC; STACK.md calls this "optional" |
| Pydantic / hand-rolled validator | Validate the small set of fields the form actually emits (ciuser, cipassword, sshkeys, ipconfig, packages, runcmd) | Recommended for v1 — the form is the sole input (D-09), so the validatable surface is small and known; no external dependency |

**Recommendation:** Because the Cloud-Init editor is **form-driven** (D-09) — the user never types raw YAML — the "schema" to validate against is the GUI's own form-field set, not arbitrary cloud-config. A hand-rolled validator (or Pydantic model) covering the emitted fields is sufficient for VM-07's "hard error / soft warning" split (D-12) and avoids a `cloud-init` runtime dependency in the GUI's LXC. `[ASSUMED]` — confirm with the user that "schema validation" need not run the full upstream `cloud-init schema`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@novnc/novnc` bundled in the frontend | Iframe the Proxmox-hosted noVNC | `[CITED: STACK.md + 04-UI-SPEC.md]` PVE patches upstream noVNC; bundling = maintenance treadmill. UI-SPEC explicitly forbids `@novnc/novnc` as a frontend dep — the noVNC client is served by Proxmox inside the iframe. |
| Monaco / CodeMirror for the YAML pane | Hand-rolled `<pre>` with badge spans | `[CITED: 04-UI-SPEC.md]` read-only preview doesn't justify ~2 MB; checker forbids `monaco-editor`/`codemirror`/`prismjs`/`shiki` |
| GitHub API live-fetch of the catalog | Bundled snapshot + admin "Sync" pull | `[CITED: 04-CONTEXT.md D-05]` bundled floor + admin-synced commit pin — freshness without a GUI release; supply-chain pinning (Pitfall 10) |

**Installation:**
```bash
# Frontend — two official shadcn-svelte blocks
cd frontend && pnpm dlx shadcn-svelte@latest add radio-group stepper
```
No backend `pip install` is required — every backend capability uses already-installed libraries.

**Version verification:** `proxmoxer 2.3.0` confirmed current `[VERIFIED: PyPI, 2026-05-16 — released 2026-03-04]`. No new backend packages, so no further registry checks needed.

## Architecture Patterns

### System Architecture Diagram

```
                  ┌─────────────────────────────────────────────────┐
  Browser         │  /create wizard (SvelteKit)                     │
  ───────►        │   Step 1 path-pick → branching steps → Review   │
                  │   sessionStorage draft  │  Cloud-Init editor    │
                  └──────────┬──────────────────────────────────────┘
                             │ POST /api/v1/clusters/{id}/provisioning/...
                             ▼
        ┌────────────────────────────────────────────────────┐
        │ FastAPI provisioning route                         │
        │  1. resolve team + privsep connector               │
        │  2. run_quota_admission (row-locked, BEGIN IMMEDIATE)│  ──reject 409
        │  3. reserve_vmid (per-cluster lock + reserved set)  │
        │  4. enqueue_job → 202 {job_id, vmid}                │
        └──────────┬─────────────────────────────────────────┘
                   │ arq enqueue (Redis)
                   ▼
        ┌────────────────────────────────────────────────────┐
        │ arq worker — run_create_qemu / run_create_lxc /    │
        │              run_community_script / run_download   │
        │  claim → connector → dispatch (PVE create) → UPID  │
        │  persist UPID BEFORE poll → poll to terminal       │
        │  (community-script: + pct exec, stream stdout)     │
        │  audit outcome → publish job.completed             │
        └──────────┬─────────────────────────────────────────┘
                   │ proxmoxer (asyncio.to_thread + circuit breaker)
                   ▼
            ┌──────────────┐         ┌─────────────────────────┐
            │  Proxmox VE  │◄────────┤ noVNC: vncproxy mint     │
            │  cluster     │         │ + reverse-proxied WS      │
            └──────────────┘         │ FastAPI WS ── Caddy ── browser iframe │
                                     └─────────────────────────┘
       job.completed event ──► Redis pub/sub ──► /ws/jobs ──► Tasks drawer
                                                          └─► Notification bell
```

A reader can trace the primary use case: wizard submit → quota check → VMID reserve → 202 → arq worker creates on PVE → UPID poll → audit → WebSocket event → Tasks drawer + notification bell + provisioning banner self-dismisses.

### Recommended Project Structure

```
backend/app/
├── provisioning/          # NEW — qemu + LXC create routes, services, wizard schemas
│   ├── routes.py          #   POST .../provisioning/qemu, .../lxc (202 + job)
│   ├── service.py         #   enqueue_create_* — reserve_vmid + run_quota_admission + enqueue
│   ├── cloudinit.py       #   #cloud-config render + VM-07 schema validation
│   └── schemas.py         #   per-path wizard request models (Pydantic)
├── catalog/               # NEW — community-scripts catalog
│   ├── snapshot.json      #   bundled catalog floor (vendored, commit-pinned)
│   ├── routes.py          #   GET catalog (curated/full), admin POST sync
│   └── service.py         #   parse metadata, expose script options (D-07)
├── networks/              # NEW — SDN reads + per-team scoping
│   ├── routes.py          #   GET .../networks (auto-detect SDN vs bridge)
│   ├── service.py         #   SDN zone/vnet/subnet enumeration + IPAM free-IP
│   └── scoping.py         #   per-team network grant CRUD
├── iso/                   # NEW — ISO + cloud-image library
│   └── routes.py          #   GET storage ISOs, POST url-download (job)
├── console/               # NEW — noVNC
│   ├── routes.py          #   POST .../console/vncproxy (mint ticket on click)
│   └── proxy.py           #   reverse-proxied WebSocket endpoint
├── jobs/
│   └── provisioning_functions.py  # NEW — run_create_qemu/lxc, run_community_script, run_download
└── clusters/connector.py  # EXTEND — create_qemu, create_lxc, lxc_exec, vncproxy, sdn_*, storage_*

frontend/src/
├── routes/create/         # NEW — the unified wizard route
├── lib/components/wizard/ # NEW — path-picker, step components, Cloud-Init editor, SDN picker
├── lib/components/console/# NEW — Console tab + iframe container
├── lib/components/notifications/ # NEW — notification bell + panel
├── lib/components/shared/ # NEW — EmptyState, HelpTooltip
└── lib/api/               # NEW — provisioning.ts, catalog.ts, networks.ts, iso.ts, console.ts
```

### Pattern 1: New connector methods follow the existing `_call_with_breaker` shape

**What:** Every new mutating PVE call goes through `_call_with_breaker` and returns a UPID; every read goes through it too. The `fn = (... lxc ... if is_lxc else ... qemu ...)` branch pattern is the project convention.
**When to use:** All Phase-4 connector additions.
**Example:**
```python
# Source: pattern extrapolated from backend/app/clusters/connector.py (vm_power, clone)
async def create_qemu(self, *, node: str, vmid: int, **config: Any) -> str:
    """POST /nodes/{node}/qemu — create a VM, returns a UPID."""
    fn = self._client.nodes(node).qemu.post
    upid = await self._call_with_breaker(fn, vmid=vmid, **config)
    self._resource_cache.snapshot = None
    return upid

async def create_lxc(self, *, node: str, vmid: int, ostemplate: str, **config: Any) -> str:
    """POST /nodes/{node}/lxc — create a container, returns a UPID."""
    fn = self._client.nodes(node).lxc.post
    upid = await self._call_with_breaker(fn, vmid=vmid, ostemplate=ostemplate, **config)
    self._resource_cache.snapshot = None
    return upid

async def lxc_exec(self, *, node: str, vmid: int, command: list[str]) -> Any:
    """POST /nodes/{node}/lxc/{vmid}/status/exec — run a command inside the LXC.

    NOTE: the exact endpoint + streaming behaviour MUST be confirmed by the
    community-scripts spike; some PVE versions expose exec only over the agent
    or require `pct exec` shell-out rather than a REST endpoint.
    """
    ...
```

### Pattern 2: Provisioning job functions reuse `_run_polled_job`

**What:** `clone_migrate_functions._run_polled_job` is a shared body — claim, acquire connector, `dispatch_and_poll`, audit. Provisioning create jobs are structurally identical to `run_clone`.
**When to use:** `run_create_qemu`, `run_create_lxc`, `run_download`. Register in `worker.py` with `max_tries=1` (non-idempotent, D-16) and a generous timeout (clone uses 14400s).
**Example:** model `run_create_qemu` directly on `run_clone` — the only difference is the dispatch closure calls `connector.create_qemu(...)` and `target_id_from_payload` returns the reserved VMID.

### Pattern 3: Community-script job is two-stage and the riskiest

**What:** A community-script deploy is NOT a single PVE call. Stage 1: `create_lxc` (the GUI's own code, UPID-polled). Stage 2: after the LXC is running, `lxc_exec` the per-app install script *inside* the container (Pitfall 10), streaming stdout/stderr to the Tasks drawer.
**When to use:** `run_community_script`.
**Anti-pattern:** Running `build.func` on the host, or piping `wget | bash` anywhere. The GUI builds the empty LXC itself; only the in-container `*-install.sh` stage runs upstream code. `[CITED: PITFALLS.md §Pitfall 10]`

### Pattern 4: noVNC reverse-proxy WebSocket

**What:** `vncproxy` mints `{ticket, port}`. The GUI does NOT hand the Proxmox host:8006 URL to the browser (CON-03). Instead a FastAPI WebSocket endpoint relays bytes between the browser iframe and `wss://pve-host:8006/.../vncwebsocket?port=...&vncticket=...`. The browser iframe points at the GUI's own origin.
**When to use:** `console/proxy.py`.
**Example (the load-bearing encoding rule):**
```javascript
// Source: [VERIFIED: Proxmox forum — multiple threads, see Sources]
// The vncticket must be URL-encoded EXACTLY ONCE. Double-encoding silently fails.
const url = `wss://.../vncwebsocket?port=${port}&vncticket=${encodeURIComponent(ticket)}`;
```

### Anti-Patterns to Avoid

- **Blocking the HTTP request on a create UPID** — wizard submit must return 202 in <500ms (CLAUDE.md constraint 1). The detail-page provisioning banner reflects progress.
- **Minting the vncticket on page load** — ~10-40s lifetime; mint only on the "Open console" click (Pitfall 3, CON-02).
- **Single super-token for provisioning** — every create runs as the per-tenant privsep team token; every new VM/LXC joins the team's PVE pool at creation (Pitfall 5/7, CLAUDE.md constraint 7).
- **Treating `/cluster/nextid` as atomic** — always go through `reserve_vmid` (Pitfall 1).
- **Mixing `cicustom=` and PVE-managed `ciuser`/`cipassword`/`sshkeys`** — they are mutually exclusive (Pitfall 4); D-09 picks the PVE-managed lane, so the GUI sets `ciuser`/`cipassword`/`sshkeys`/`ipconfig0` directly and never writes a `cicustom` snippet in v1.
- **Offering a storage in a dropdown without content-type filtering** — filter by `content=iso` / `content=vztmpl` / `content=images` / `content=rootdir` per the target node's view (Pitfall 16).
- **Running a community-script's `build.func`** — that orchestrator is interactive (`whiptail`); the GUI runs only the per-app install stage inside the container.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VMID allocation under concurrency | A new locking scheme | `reserve_vmid` from `backend/app/lifecycle/clone.py` | Already solves Pitfall 1 — per-cluster `asyncio.Lock` + 60s reserved set; clone reuses it |
| Quota check before create | A fresh quota query | `run_quota_admission` from `clone.py` | Row-locked `BEGIN IMMEDIATE` admission — solves the TOCTOU (Pitfall 6); clone/restore already reuse it |
| UPID polling for create jobs | A new poll loop | `dispatch_and_poll` + `_run_polled_job` | Phase-3 poller persists the UPID before polling (Pitfall 2/12); crash-safe |
| Job → Tasks-drawer streaming | A new WebSocket | The Phase-3 `/ws/jobs` + `publish_event` pipeline | Community-script `pct exec` output (D-08) and provisioning progress stream over the existing socket |
| Job error → friendly message | New error strings | `map_pve_error` (Phase-3 D-13 curated map) | Provisioning failures reuse the curated PVE-error map |
| Notification persistence | A `notifications` table | The existing `jobs` table + per-user last-seen timestamp (D-23) | The bell is a derived view — task completions only (D-22) |
| noVNC client | A VNC viewer | The Proxmox-hosted noVNC inside an iframe | PVE patches upstream noVNC; bundling diverges (STACK.md) |
| YAML syntax highlighting | A code editor | Hand-rolled `<pre>` + badge spans | Read-only preview; UI-SPEC forbids editor libs |
| Cloud-Init drive regeneration handling | Manual snippet management | PVE-managed `ciuser`/`cipassword`/`sshkeys` fields (D-09) | Avoids the `content=snippets` preflight, `qm cloudinit update`, and migration node-local pinning (Pitfalls 4/20) |

**Key insight:** Phase 4 is mostly an *integration* phase. The hard concurrency/durability problems (VMID race, quota TOCTOU, UPID crash-safety, job streaming) were already solved in Phases 1-3. The genuinely new and risky work is the three spike domains — community-scripts execution, SDN, and noVNC — where the ecosystem provides no library and the Proxmox behaviour is version-sensitive.

## Common Pitfalls

### Pitfall 1: Community-script non-interactive execution is not the documented path

**What goes wrong:** The community-scripts canonical UX is `bash -c "$(wget -qO - .../ct/jellyfin.sh)"`, which sources `build.func` — an orchestrator full of interactive `whiptail` dialogs (storage pick, SSH-access prompt, diagnostics opt-in). Running that through an API hangs on the first prompt.
**Why it happens:** `build.func` is designed for a human at a terminal. Non-interactive use is supported via `var_*` environment variables (`var_cpu`, `var_ram`, `var_disk`, `var_unprivileged`, `var_os`, `var_version`, `var_tags`) with precedence `ENV var_* > default.vars > built-ins` `[VERIFIED: community-scripts wiki + build.func]`, but that still drives `build.func`'s own LXC creation — which Pitfall 10 forbids the GUI from using.
**How to avoid:** The GUI's model (D-08, Pitfall 10) is: GUI creates the empty LXC via its own `create_lxc` call; only the per-app `*-install.sh` stage runs inside the container via `lxc_exec`. **The spike must determine** whether each app's install stage can be invoked standalone (it normally expects `build.func` to have exported helper functions and `$STD`/`$SILENT` wrappers). If not, the fallback is to run the full `ct/<app>.sh` *inside* the already-created container with all `var_*` set and `whiptail` either stubbed or the script patched. `[ASSUMED]` — exact mechanism is a spike deliverable; D-07 mandates a defaults-only fallback.
**Warning signs:** Install job hangs with no output; `whiptail` "command not found" or a TTY error; the script tries to `pct create` a *second* container.

### Pitfall 2: noVNC `vncticket` double-encoding silently fails

**What goes wrong:** The `vncticket` returned by `vncproxy` contains characters (`:`, `/`, `+`, `=`) that must be percent-encoded for the WebSocket query string. Encoding it twice (e.g. the backend encodes it, then the frontend encodes again, or a reverse proxy re-encodes the query) produces `%253A` instead of `%3A` — Proxmox rejects it as an invalid ticket with no useful error.
**Why it happens:** The ticket travels backend → frontend → WebSocket URL → reverse proxy; every hop is a chance to re-encode.
**How to avoid:** Encode **exactly once** with `encodeURIComponent` at the point the WebSocket URL is built; pass the raw ticket as JSON everywhere else. `[VERIFIED: Proxmox forum threads]` The spike confirms the single-encoding rule end-to-end through Caddy.
**Warning signs:** `401 invalid PVEVNC ticket`; the console works in a direct test but fails through the GUI's proxy.

### Pitfall 3: Caddy does not forward WebSocket upgrade headers by default for the console

**What goes wrong:** The existing Caddyfile reverse-proxies `/api/*` to FastAPI, and `/ws/jobs` works — but the noVNC WebSocket may need explicit `Upgrade`/`Connection` handling, and `proxy_buffering` must be off or the VNC stream stalls.
**Why it happens:** Caddy's `reverse_proxy` auto-handles WebSocket upgrades in modern versions, but the noVNC stream is latency-sensitive; buffering or a too-short timeout breaks it. `[ASSUMED]` — the existing `/ws/jobs` works through Caddy, so basic WS upgrade is already fine; the console-specific concern is timeout/buffering.
**How to avoid:** The noVNC spike must verify the console WebSocket survives through Caddy → FastAPI proxy → Proxmox. If a Caddyfile change is needed (a dedicated `handle` block for the console path with `flush_interval -1`), the spike documents it.
**Warning signs:** Console connects then freezes; partial framebuffer; works on localhost but not through Caddy.

### Pitfall 4: SDN changes show as `pending` and never apply

**What goes wrong:** Phase 4 *reads* SDN (the GUI consumes admin-defined SDN — it does not provision zones, per CONTEXT). But if an admin defines a VNet in Proxmox and forgets to click "Apply", the VNet exists in `/cluster/sdn/vnets` config but the bridge does not exist on the nodes — a VM attached to it fails to start with "no such bridge".
**Why it happens:** SDN has a two-state model — configured (`/etc/pve/sdn/`) vs applied (`/etc/network/interfaces.d/`); `.running-config` / `.version` files track applied state. `[VERIFIED: pve.proxmox.com/wiki/Software-Defined_Network]`
**How to avoid:** The SDN spike must determine how to read **applied** state via the API (the zones/vnets endpoints carry a `state`/`pending` indicator). The picker should prefer applied VNets and either hide or clearly badge pending ones (UI-SPEC's network picker can show a pending state). Restrict SDN to PVE 8.1+ (D-21, Pitfall 8) — SDN went stable in PVE 8.0-8.1; IPAM/routing remained partly tech-preview.
**Warning signs:** A VNet the GUI shows as available causes `qm start` to fail with a bridge error.

### Pitfall 5: No documented "next-free-IP" REST endpoint for IPAM (NET-03)

**What goes wrong:** D-20 requires auto-picking a free static IP from IPAM. The SDN wiki describes IPAM allocating IPs for DHCP but does **not** document a clean REST endpoint that returns "the next free IP for subnet X" `[VERIFIED: pve.proxmox.com/wiki/Software-Defined_Network — "does not specify an explicit API method"]`.
**Why it happens:** IPAM's free-IP logic is internal to the DHCP allocation path; the PVE IPAM plugin's `add_range_next_freeip`-style function is not surfaced as a documented public REST call.
**How to avoid:** The SDN spike must determine the actual mechanism. Options the spike must evaluate: (a) `/cluster/sdn/vnets/{vnet}/ips` POST to allocate an IP and read it back; (b) reading the subnet's IPAM range + the VNet's currently-allocated IPs and computing the next free one app-side; (c) accepting DHCP-only for v1 if no clean path exists. D-20 already allows the user to switch to DHCP — so a graceful degrade to "DHCP, IP field disabled" is an acceptable fallback if the spike finds no reliable free-IP API.
**Warning signs:** The picker offers an IP that's already taken; IPAM conflicts on VM start.

### Pitfall 6: Cloud-Init drive must be regenerated; missing `ipconfig0` breaks networking

**What goes wrong:** Setting `ciuser`/`cipassword`/`sshkeys` on a VM config without setting `ipconfig0` leaves the cloud-init NIC unconfigured; the VM boots with no network. Or: the cloud-init drive (`ide2: <storage>:cloudinit`) is never attached, so none of the settings apply.
**Why it happens:** PVE-managed cloud-init requires (1) a cloud-init drive disk attached, (2) the `ci*` config keys, and (3) `ipconfig0` for the NIC. The cloud-image path also needs the disk imported and the boot order set.
**How to avoid:** The qemu-create payload for the cloud-image and template-clone paths must explicitly attach a cloud-init drive and set `ipconfig0` (`ip=dhcp` or `ip=<addr>/<cidr>,gw=<gw>`). For template clones, the source template may already have a cloud-init drive — detect and reuse. `[CITED: PITFALLS.md §Pitfall 14 — DNS on DHCP]` Soft-warn (D-12) when DNS is set on a DHCP NIC.
**Warning signs:** VM boots but has no IP / no SSH; cloud-init "did nothing".

### Pitfall 7: ISO/cloud-image download via the GUI process OOMs on large files

**What goes wrong:** Downloading a 4 GB ISO by streaming it through the FastAPI process buffers it in memory.
**Why it happens:** Naive `httpx` download into a variable.
**How to avoid:** Use Proxmox's own storage **download-url** endpoint (`POST /nodes/{node}/storage/{storage}/download-url`) — PVE downloads the ISO directly to its storage and returns a UPID. The GUI never touches the bytes; it just polls the UPID like any other job. `[CITED: PITFALLS.md §Performance Traps — "ISO/template download via the GUI process"]` This is the correct pattern for both VM-08 ISO downloads and D-15 cloud-image downloads.
**Warning signs:** Worker memory spike; OOM kill during a download job.

### Pitfall 8: A failed provisioning leaves an orphan or a half-created resource

**What goes wrong:** `create_qemu` succeeds (VM config written) but a follow-up step (cloud-init disk attach, pool join) fails — leaving a partial VM. Or the reserved VMID is consumed but the job fails before PVE creates anything.
**Why it happens:** Provisioning is multi-step and non-idempotent (D-16). The Phase-3 reaper handles *orphaned polling*, not *partial creates*.
**How to avoid:** Keep the create as close to a single PVE call as possible — pass the full config (including `pool`, cloud-init keys, NIC) in the one `create_qemu`/`create_lxc` call so PVE creates it atomically. The community-script two-stage flow is the exception; if stage 2 (`pct exec`) fails, the LXC still exists — surface it as "created but install failed", do NOT auto-delete. The provisioning banner shows the failure; the user decides (UI-SPEC: failed provisioning shows no Retry — re-run the wizard). Reserved VMIDs auto-expire after 60s (`_RESERVATION_TTL`).
**Warning signs:** VMs in the inventory the user didn't intend; quota drift.

## Code Examples

### Wizard submit → 202 (provisioning route)
```python
# Source: pattern from backend/app/lifecycle/clone.py (enqueue_clone)
async def enqueue_create_qemu(db, arq_pool, *, principal, cluster, team_id,
                              request, registry, source_ip) -> Job:
    connector = await registry.get_for_team(cluster_id=cluster.id, team_id=team_id)
    # Quota admission BEFORE reserving — row-locked, rejects 409 (Pitfall 6).
    await run_quota_admission_for_request(db, registry, team_id=team_id,
                                          cluster_id=cluster.id, request=request)
    vmid = await reserve_vmid(cluster_id=cluster.id, connector=connector)  # Pitfall 1
    payload = {"node": request.node, "vmid": vmid, "config": request.to_pve_config()}
    job = await enqueue_job(db, arq_pool, kind="vm.create.qemu",
                            cluster_id=cluster.id, team_id=team_id,
                            actor_user_id=principal.user.id, payload=payload)
    await audit_write(db, ..., action="vm.create", result="pending", ...)
    await db.commit()
    return job  # route returns 202 {job_id: job.id, vmid: vmid}
```

### Community-script two-stage job
```python
# Source: pattern from clone_migrate_functions._run_polled_job (Phase 3)
async def run_community_script(ctx, job_id) -> None:
    # Stage 1: create the empty LXC (UPID-polled, like run_create_lxc).
    #   connector.create_lxc(node=..., vmid=..., ostemplate=..., pool=team_pool, ...)
    # Stage 2: AFTER the LXC is running, run the install stage INSIDE it.
    #   connector.lxc_exec(node=..., vmid=..., command=[...])  <- SPIKE confirms shape
    #   stream stdout/stderr to the Tasks drawer via publish_event (D-08)
    # If stage 2 fails: mark the job failed, but the LXC EXISTS — do not delete.
    ...
```

### Cloud-Init effective config with PVE-injected defaults (VM-06)
```python
# The form emits a small known set; the YAML preview shows user-set + PVE-injected.
# user-set: ciuser, cipassword, sshkeys, ipconfig0
# PVE-injected (badged "PVE default" in the YAML pane — D-10):
#   chpasswd.expire: false, the auto-generated meta-data, default package list
def render_cloudinit_preview(form: CloudInitForm) -> list[YamlLine]:
    lines = []
    lines.append(YamlLine(text="#cloud-config", injected=False))
    lines.append(YamlLine(text=f"  - name: {form.ciuser}", injected=False))
    lines.append(YamlLine(text="chpasswd:", injected=True))      # PVE default badge
    lines.append(YamlLine(text="  expire: false", injected=True))
    return lines
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tteck/Proxmox` helper scripts | `community-scripts/ProxmoxVE` (community org) | 2024 — original maintainer died, project transferred | Catalog moved; governance instability → pin to reviewed commits (D-05, Pitfall 10) |
| SDN as a PVE tech preview | SDN core stable in PVE 8.0-8.1 | PVE 8.0 (2023) / 8.1 | D-21 sets a PVE 8+ floor; IPAM/routing still partly preview — informs the SDN spike |
| `cicustom` snippet for all custom cloud-init | PVE-managed `ciuser`/`cipassword`/`sshkeys` keys | stable for years | D-09 picks the PVE-managed lane — avoids the snippets-storage preflight entirely for v1 |
| Manual ISO upload through the app | PVE storage `download-url` endpoint | PVE 7+ | The GUI never proxies ISO bytes (Pitfall 7) |
| `community-scripts.github.io` | redirects to `community-scripts.org` | recent | The website API at `/api/categories` is the JSON catalog source if live-syncing; the bundled snapshot (D-05) is the floor |

**Deprecated/outdated:**
- `tteck/Proxmox` repo — archived; do not source scripts from it.
- Embedding the Proxmox host noVNC URL directly in the iframe — CON-03 forbids direct browser→Proxmox exposure; the GUI reverse-proxies.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The community-script per-app install stage can be invoked standalone inside an already-created LXC (not requiring `build.func`'s exported environment) | Pitfall 1, Pattern 3 | HIGH — if false, the GUI must run the full `ct/<app>.sh` inside the container with `whiptail` stubbed; the **spike must resolve this** before LXC-03 is planned |
| A2 | `lxc_exec` is reachable as a REST endpoint or via a `pct exec` shell-out the connector can wrap | Pattern 1, Pattern 3 | MEDIUM — the exact exec mechanism + output streaming is a **spike deliverable** |
| A3 | A reliable IPAM "next free IP" path exists (endpoint or app-side computation); if not, DHCP-only is an acceptable v1 degrade | Pitfall 5, NET-03 | MEDIUM — D-20 already lets the user switch to DHCP, so degrade is graceful; **spike confirms** |
| A4 | The existing Caddy `reverse_proxy` handles the noVNC WebSocket upgrade; only buffering/timeout tuning may be needed | Pitfall 3 | LOW-MEDIUM — `/ws/jobs` already works through Caddy; **noVNC spike verifies** the console stream specifically |
| A5 | VM-07 "schema validation" need not run the full upstream `cloud-init schema` CLI — validating the form's known field set is sufficient | Standard Stack (Cloud-Init validation) | LOW — D-09's form-driven editor makes the validatable surface small; **confirm with user** |
| A6 | `POST /nodes/{node}/storage/{storage}/download-url` is the ISO/cloud-image download mechanism and returns a UPID | Pitfall 7, Pattern for VM-08/D-15 | LOW — well-established PVE endpoint; verify the exact path/params during planning |
| A7 | The community-scripts website `/api/categories` JSON (or the `frontend/public/json/*.json` per-script files) is the catalog metadata source, with fields: name, slug, categories, type, updateable, privileged, interface_port, install_methods (type/script/resources cpu·ram·hdd·os·version), default_credentials, notes | Catalog module | LOW-MEDIUM — field set is from the wiki/search; **spike confirms format stability** (D-07 mandates a defaults-only fallback for unparseable metadata) |
| A8 | `vncproxy` ticket lifetime is ~10-40s; sources cite both ~10s and ~30-40s | Pitfall 2, CON-02 | LOW — mint-on-click + reconnect button handles either; **spike measures the real value** |

## Open Questions (spike-gated — resolved by spikes 04-01 / 04-02 / 04-03, not in this document)

1. **Community-script install-stage invocation (the single biggest risk)**
   - What we know: the GUI must create the LXC itself and run only the install stage inside it (Pitfall 10, D-08).
   - What's unclear: whether the per-app `*-install.sh` runs standalone, or whether the full `ct/<app>.sh` (which sources `build.func`) must run inside the container with `var_*` set and `whiptail` stubbed.
   - Recommendation: this is spike 3's primary deliverable. Plan LXC-03 only after the spike. D-07's defaults-only fallback is the safety net.

2. **IPAM next-free-IP mechanism (NET-03)**
   - What we know: no documented public REST endpoint returns "next free IP for subnet X".
   - What's unclear: whether to allocate-then-read via `/cluster/sdn/vnets/{vnet}/ips`, compute app-side from the subnet range, or degrade to DHCP-only.
   - Recommendation: SDN spike deliverable; DHCP-only is an acceptable v1 fallback (D-20 already supports the switch).

3. **SDN applied-vs-pending read path (NET-01, NET-04)**
   - What we know: SDN has a two-state model; applied state lives in `.running-config`/`.version`.
   - What's unclear: how the zones/vnets API surfaces per-node applied state vs cluster-config state.
   - Recommendation: SDN spike deliverable; the picker should prefer applied VNets and badge/hide pending ones.

4. **Console WebSocket through Caddy**
   - What we know: `/ws/jobs` works through Caddy today.
   - What's unclear: whether the noVNC stream needs a dedicated Caddyfile `handle` block (buffering/timeout) or works on the existing `/api/*` proxy.
   - Recommendation: noVNC spike deliverable; if a Caddyfile change is needed it must ship with the console plan.

5. **Cloud-init schema validation depth**
   - What we know: D-09 makes the editor form-driven; the validatable surface is the form's field set.
   - What's unclear: whether the user expects the full upstream `cloud-init schema` validator (a runtime dependency) or a hand-rolled field validator.
   - Recommendation: confirm during discuss/planning; the hand-rolled validator is the lower-risk v1 default.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| proxmoxer | All PVE provisioning calls | ✓ | 2.3.0 | — (already a project dep) |
| arq + Redis | Provisioning job functions | ✓ | 0.26.x / 7.x | — (Phase-3 infrastructure) |
| Caddy | noVNC WebSocket reverse-proxy | ✓ | 2.8+ | — (already fronts the app) |
| A reachable Proxmox cluster with SDN configured | NET-01..04 testing | ✗ (cannot verify from this environment) | — | Spike must run against a real PVE 8.1+ cluster; legacy-bridge path (D-19/D-21) is the non-SDN fallback |
| A community-scripts-compatible LXC template + the catalog repo | LXC-01..04 testing | ✗ | — | Bundled catalog snapshot (D-05) is the floor; defaults-only deploy (D-07) is the metadata-unparseable fallback |
| `cloud-init schema` CLI (in the GUI's own LXC) | VM-07 (only if the full validator is chosen) | ✗ (not confirmed) | — | Hand-rolled field validator — recommended, no dependency |

**Missing dependencies with no fallback:** None that block planning — the three "✗" rows are exactly the three spike domains; the spikes run against real infrastructure the operator provides.

**Missing dependencies with fallback:** SDN (→ legacy bridges), community-scripts metadata (→ defaults-only deploy), cloud-init schema CLI (→ hand-rolled validator) — all have graceful, already-decided v1 degrades.

## Security Domain

`security_enforcement` is not `false` in `config.json` → this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Inherited — provisioning routes use the Phase-1 cookie/PAT principal; noVNC WS handshake authenticates the `access_token` cookie BEFORE `accept()` (mirror `jobs/ws.py`) |
| V3 Session Management | yes | The reverse-proxied console WS is a browser-session feature — cookie-only auth, no PAT (mirror `jobs/ws.py` `_resolve_ws_user`) |
| V4 Access Control | yes | Every provisioning/console/network call is team-scoped via `get_for_team`; resolve resource ownership before minting a vncticket (CON-01 — "any VM/LXC the user owns"); cross-tenant → 403 (Phase-2 `resolve_resource` pattern) |
| V5 Input Validation | yes | Pydantic models for every wizard path; the Cloud-Init form-field validator (VM-07); ISO/cloud-image URL validation before a download job |
| V6 Cryptography | yes (inherited) | No new crypto — team tokens stay Fernet-encrypted via `EncryptedSecret`; the vncticket is short-lived and never persisted |
| V12 Files & Resources | yes | ISO URL-download must use PVE's `download-url` (PVE fetches; the GUI never proxies arbitrary bytes — Pitfall 7); reject non-http(s) URLs |
| V14 Configuration | yes | The noVNC iframe is same-origin — the existing `X-Frame-Options: SAMEORIGIN` is compatible (Caddyfile already notes this) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Community-script supply-chain compromise (upstream code as container-root) | Tampering / Elevation | Pin the catalog to a reviewed commit hash (D-05, Pitfall 10); run only inside the fresh LXC via `pct exec`, never on the host; surface attribution + commit hash before deploy (LXC-04); capture all output to the audit log |
| User-supplied Cloud-Init pre-seeding root SSH access | Elevation | D-09 form-driven editor restricts the field surface; VMs land in the team's PVE pool; `cipassword` required (D-11) — no anonymous access |
| vncticket leakage / replay | Spoofing / Information disclosure | Mint on click only (CON-02); ~10-40s lifetime; never logged; the GUI proxies the WS so the Proxmox host:8006 is never exposed to the browser (CON-03) |
| Cross-tenant VM provisioning / console access | Elevation / Information disclosure | Provisioning runs as the privsep team token; new resources auto-join the team pool (Pitfall 5); console mint resolves ownership first (cross-tenant → 403) |
| ISO URL-download as SSRF | Information disclosure | Validate the URL scheme (http/https only); PVE's `download-url` runs the fetch on the PVE node — document that this is an authenticated-user capability (D-17 opens it to any user) |
| WebSocket auth-check only on connect | Elevation | The console WS authenticates before `accept()`; the relayed Proxmox connection is bounded by the ~30s ticket — a stale connection cannot outlive the ticket |
| Reserved-VMID exhaustion / squatting | Denial of service | `reserve_vmid`'s 60s TTL auto-expires reservations; bounded clone-style retry on collision |

## Project Constraints (from CLAUDE.md)

The planner must verify every plan against these — they have the authority of locked decisions:

1. **Every mutating Proxmox call → 202 + worker poll.** Wizard submit returns 202 + job id; no HTTP request blocks on a create UPID.
2. **Persist the UPID before polling.** Reuse the Phase-3 `dispatch_and_poll` (already does this).
3. **API tokens for backend→PVE auth; tickets only for noVNC.** The vncticket is the *only* ticket Phase 4 mints, and only for the iframe.
4. **vncticket ~30-40s; mint on click; URL-encode exactly once.** Pitfall 2 above.
5. **`cicustom` snippets require snippets-enabled storage — preflight mandatory.** D-09 sidesteps this: v1 uses PVE-managed cloud-init keys, no `cicustom` → no preflight needed. If a future phase adds editable snippets, the preflight returns.
6. **VMID race → app-level locking.** Reuse `reserve_vmid`.
7. **Multi-tenancy via Proxmox pools + privsep tokens.** Every create runs as the team token; every new VM/LXC joins the team pool at creation.
8. **Community-scripts run via `pct exec` inside the fresh LXC, never on the host. Pin to commit hashes. Surface attribution.** D-05/D-07/D-08 + Pitfall 1 above.
9. **Atomic commits per task; conventional commit messages.** (Workflow rule.)
10. **`tenant_id` on every relevant row.** New tables (network scoping, catalog pin, notification last-seen) — apply the schema-invariant ALLOWLIST rationale (Phase-1 pattern); network scoping is team-scoped by nature.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LXC-01 | Browse a curated list of community-scripts | Catalog module; curated = upstream featured/popular flag + admin override (D-06); bundled snapshot floor (D-05) |
| LXC-02 | Browse the full catalog with search + category filters | Full catalog view from the same metadata; `command`-search FE |
| LXC-03 | One-click non-interactive deploy from a community-script | `run_community_script` two-stage job (Pattern 3); **spike 3 gates this** (Pitfall 1, A1/A2) |
| LXC-04 | Show source + commit hash + last-reviewed date before deploy | Derived from the active catalog pin (D-05); script-detail panel (UI-SPEC) |
| LXC-05 | Deploy a plain LXC from a vztmpl template | `create_lxc` connector method + `run_create_lxc` job; `ostemplate` param |
| LXC-06 | Pick host/storage/network/CPU/RAM/disk in the LXC wizard | Resources step; storage content-type filtered (Pitfall 16); node-fit selector |
| LXC-07 | Toggle unprivileged / nesting / features | `create_lxc` config: `unprivileged`, `features=nesting=1,keyctl=1,fuse=1` |
| VM-01 | Deploy a VM from a Cloud-Init image | Curated cloud-image list (D-15) + `download-url` job (Pitfall 7) + `create_qemu` with imported disk + cloud-init drive |
| VM-02 | Deploy from a PVE template (linked/full clone) | Reuse the Phase-3 `connector.clone` + `run_clone`; wizard wraps it |
| VM-03 | Deploy a blank VM with a mounted ISO | `create_qemu` with `ide2=<storage>:iso/<file>,media=cdrom`; ISO library (D-16) |
| VM-04 | Clone an existing VM (linked/full) | Reuse the Phase-3 clone path entirely |
| VM-05 | Two-pane Cloud-Init editor (form + live YAML) | `provisioning/cloudinit.py` render + hand-rolled `<pre>` FE pane (D-09) |
| VM-06 | Surface all derived values incl. PVE-injected | `render_cloudinit_preview` marks injected lines; FE dims + badges them (D-10) |
| VM-07 | Cloud-Init schema validation before submit | Hand-rolled field validator (recommended) — block-hard/warn-soft (D-12); A5 |
| VM-08 | Browse ISO library across storages + URL-download | `storage_content`/`node_storages` content-filtered reads + `download-url` job (D-16/D-17) |
| VM-09 | Pick host/storage/network/CPU/RAM/disk in the VM wizard | Same Resources step as LXC-06 |
| VM-10 | Real-time quota delta + node-fit hints | Quota delta inherits Phase-2 D-08; node-fit reads live free node resources (D-24) |
| NET-01 | List SDN zones/VNets/subnets in the picker | `networks/service.py` SDN reads; **spike 1 gates** (Pitfall 4) |
| NET-02 | Admin scopes which SDN networks a team can use | New per-team network-scoping table; Networks tab on `/admin/teams/{id}` (D-18) |
| NET-03 | Auto-pick a free IP from IPAM | **Spike 1 deliverable** — no documented free-IP endpoint (Pitfall 5, A3); DHCP-only fallback |
| NET-04 | Legacy-bridge fallback for non-SDN clusters | Auto-detect per cluster (D-21); legacy bridges default-visible (D-19) |
| CON-01 | Embedded noVNC console for any VM/LXC the user owns | `console/routes.py` mint + iframe; ownership resolved before mint (V4) |
| CON-02 | vncticket minted on click, refreshed before expiry | Mint-on-click + Reconnect button (Pitfall 2/3); **spike 2 gates** |
| CON-03 | Console via the GUI's reverse-proxied WebSocket | `console/proxy.py` FastAPI WS relay + Caddy (Pitfall 3) |
| UI-04 | Distinct empty states with CTAs | Shared `EmptyState` component (UI-SPEC); `/inventory` deep-links to `/create` |
| UI-05 | Inline `?` help for every PVE-specific field | Shared `HelpTooltip` component (D-25, UI-SPEC) |
| UI-07 | In-app notification bell shows task completions | Derived from the `jobs` table + per-user last-seen (D-22/D-23) — no new table |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- `.planning/research/PITFALLS.md` — Pitfalls 1-20 + Integration Gotchas (VMID race, UPID polling, vncticket, cloud-init snippets, SDN pending, helper-script trust, content-type filtering)
- `.planning/research/STACK.md` — proxmoxer 2.3.x, FastAPI, SvelteKit; noVNC iframe rationale; SDN/community-scripts gaps
- `.planning/phases/04-provisioning-networking-console/04-CONTEXT.md` — 25 locked decisions D-01..D-25
- `.planning/phases/04-provisioning-networking-console/04-UI-SPEC.md` — the approved UI design contract
- `backend/app/clusters/connector.py`, `registry.py`, `lifecycle/clone.py`, `jobs/clone_migrate_functions.py`, `jobs/functions.py`, `jobs/worker.py`, `jobs/ws.py` — the existing patterns Phase 4 extends
- [proxmoxer on PyPI](https://pypi.org/project/proxmoxer/) — `[VERIFIED: 2026-05-16]` 2.3.0, released 2026-03-04, Python 3.10-3.14
- [Proxmox SDN wiki](https://pve.proxmox.com/wiki/Software-Defined_Network) — pending/applied two-state model, IPAM, PVE 8.0-8.1 stability

### Secondary (MEDIUM confidence)
- [Proxmox forum — noVNC over API (vncproxy/vncwebsocket, ticket lifetime, single-encoding)](https://forum.proxmox.com/threads/novnc-over-api-pveauthcookie-pve-ticket-and-tunnel-auth-vnc-ticket-how.129091/) — `encodeURIComponent` exactly once; ~10-40s ticket lifetime
- [Proxmox forum — Nginx reverse proxy noVNC WebSocket headers](https://forum.proxmox.com/threads/nginx-reverse-proxy-proxmox-web-ui-cant-access-novnc-and-shell-consoles-2023.130476/) — `Upgrade`/`Connection`/`proxy_buffering off`
- [community-scripts/ProxmoxVE](https://github.com/community-scripts/ProxmoxVE) — repo structure (`ct/`, `vm/`, `install/`, `misc/build.func`, `frontend/public/json/`)
- [community-scripts build.func + non-interactive var_* docs](https://community-scripts.org/docs/ct/detailed_guide) — `var_cpu`/`var_ram`/`var_disk`/`var_unprivileged`; precedence `ENV var_* > default.vars > built-ins`
- [community-scripts JSON metadata structure](https://community-scripts.org/) — fields: name, slug, categories, type, updateable, privileged, interface_port, install_methods, default_credentials, notes

### Tertiary (LOW confidence — flagged for spike validation)
- The exact `lxc_exec` / `pct exec` REST shape and output-streaming behaviour — community-scripts spike
- The IPAM next-free-IP mechanism — SDN spike
- The SDN applied-vs-pending API field — SDN spike
- The community-script install-stage standalone-invocability — community-scripts spike

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new backend libraries; proxmoxer version verified; two official shadcn blocks
- Architecture: HIGH — Phase 4 reuses the Phase-1..3 primitives (connector, job queue, poller, reserve_vmid, quota admission, WS pipeline); no new architectural risk
- VM provisioning (cloud-image/clone/blank+ISO): MEDIUM-HIGH — clone reuses Phase 3 verbatim; cloud-init drive attachment is a known PVE pattern but needs care (Pitfall 6)
- Community-scripts execution: MEDIUM-LOW — `build.func` is interactive; the GUI's "install stage only" model is the riskiest path — **spike 3 gates LXC-03** (A1/A2)
- SDN: MEDIUM-LOW — no SDN client library; no documented free-IP endpoint; pending/applied semantics version-sensitive — **spike 1 gates NET-01/03/04** (A3)
- noVNC console: MEDIUM — iframe-embed is well-trodden; single-encoding + reverse-proxy headers are known gotchas — **spike 2 gates CON-02/03** (A4/A8)
- Pitfalls: HIGH — drawn from the project's own verified PITFALLS.md plus cross-verified forum sources

**Research date:** 2026-05-16
**Valid until:** 2026-06-15 for the stable core (proxmoxer, FastAPI, the existing codebase patterns); 2026-05-30 for the community-scripts catalog (the upstream repo and its metadata format change frequently — re-verify at spike time).
