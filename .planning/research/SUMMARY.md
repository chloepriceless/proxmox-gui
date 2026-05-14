# Project Research Summary

**Project:** Proxmox Self-Service GUI (vm-deployment-gui)
**Domain:** Self-hosted, multi-tenant, multi-cluster Proxmox VE/LXC self-service portal
**Researched:** 2026-05-14
**Confidence:** HIGH (core stack, Proxmox API patterns, pitfalls); MEDIUM (SDN integration, community-scripts execution mechanics)

## Executive Summary

This product is a Hetzner-Cloud-style self-service portal for Proxmox VE, packaged as a single LXC. The proven pattern for this class of product is a modular monolith: one Python process (FastAPI + arq worker) backed by SQLite in WAL mode, a SvelteKit SPA served from the same LXC, and Caddy as the TLS-terminating reverse proxy. The only mature Python client for the Proxmox API is `proxmoxer` 2.3.x, which makes Python the unambiguous backend choice. Every long-running Proxmox operation returns a UPID (Unique Process ID) rather than blocking — this single fact shapes the entire architecture. The job queue (arq + embedded Redis), WebSocket fan-out, and orphan-reaper-on-boot are not optional enhancements; they are load-bearing from the first provisioning operation.

The highest-value differentiators over existing Proxmox management tools are: (1) curated community-scripts integration with one-click LXC deploy, (2) a Cloud-Init editor that actually shows what gets injected rather than accepting a blind YAML blob, and (3) Hetzner-style multi-cluster switching and per-user quota visualization. These three features define the product's identity and should drive phase prioritization. The helper-script one-line installer and the REST API consumed directly by the UI are foundational to the deployment story and API-parity constraint.

The principal risks are: VMID race conditions during concurrent provisioning, vncticket short lifetime breaking the noVNC console, SDN pending-state/reload semantics that require a dedicated spike, and the community-scripts supply-chain trust model. Multi-tenancy must be designed into the data model from day one using Proxmox pools plus privilege-separated tokens — adding it later is close to a rewrite. The build order should deliver a thin, working vertical slice early (read-only multi-cluster dashboard) to validate the cluster connector and UI direction before committing to the full provisioning path.

---

## Key Findings

### Recommended Stack

The authoritative stack is **Python 3.12 + FastAPI 0.136.x** for the backend and **SvelteKit 2 + Svelte 5** for the frontend, with **SQLite (WAL mode)** as the sole database and **arq + embedded Redis** for the job queue. This combination satisfies the single-LXC constraint, uses the only production-ready Proxmox client library (`proxmoxer` 2.3.x), and provides a clear HA migration path (SQLite -> PostgreSQL, in-memory broadcaster -> Redis-backed broadcaster, single config change each).

> **Stack authority note for downstream phases:** The Architecture research file occasionally cites Go-ecosystem libraries (`sony/gobreaker`, `goqite`, `liteq`) as illustrative patterns. These are reference patterns only. The chosen stack is Python throughout. Translate them as follows: circuit breaker -> `pybreaker` or hand-rolled with the same three-state machine; SQLite job queue -> `arq` with embedded Redis; in-process pub/sub -> `broadcaster` library. Do not treat any Go library citation as an implementation directive.

**Core technologies:**

| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| Python | 3.12.x | Backend runtime | Only ecosystem with a mature, actively-maintained Proxmox client (`proxmoxer`). |
| FastAPI | 0.136.1 | REST API + WebSocket | Auto-generates OpenAPI 3.1, native async, dependency-injection auth, native WebSocket. |
| proxmoxer | 2.3.0 | Proxmox API client | The only mature option in any language with full PVE 8.x coverage. Active as of 2026-03-04. |
| SvelteKit 2 + Svelte 5 | 2.15 / 5.x | Frontend | Smallest JS payload, adapter-node runs in the LXC, fast wizard UIs. |
| Tailwind v4 + shadcn-svelte | latest | Styling | Expresses the Hetzner neutral-card aesthetic directly; accessible component primitives. |
| SQLAlchemy 2.0 async + aiosqlite | 2.0.36 / 0.20+ | ORM + async SQLite | Native async, Alembic migrations, `render_as_batch=True` required for SQLite. |
| Alembic | 1.13+ | Schema migrations | Required alongside SQLAlchemy; `render_as_batch=True` is mandatory for SQLite ALTER TABLE. |
| arq | 0.26.x | Background job queue | Async-native, designed for FastAPI, Redis-backed, crash-safe UPID polling. |
| Redis 7 (embedded in LXC) | 7.x | Job broker + WS pub/sub | Co-located, ~10 MB RAM; not a user-managed external service. |
| Caddy 2 | 2.8+ | Reverse proxy + TLS | Single binary, automatic Let's Encrypt, ~15-line config. |
| broadcaster | 0.3+ | WebSocket pub/sub | In-memory backend now, Redis backend flip for HA later. |
| pwdlib[argon2] | 0.3+ | Password hashing | Modern passlib replacement (passlib is broken on Python 3.13+). |
| PyJWT | 2.10+ | Access tokens | python-jose is unmaintained since 2023; avoid it. |
| structlog | 24+ | Structured logging | Audit log requires `correlation_id` tying UI action -> API call -> Proxmox UPID. |

**Key avoidances:** `passlib` (EOL), `python-jose` (unmaintained), Celery (no async/await in 2026), Docker/Compose inside the LXC (nested containerization fragility), PostgreSQL in v1 (violates single-LXC constraint), synchronous proxmoxer calls on the hot path (blocks FastAPI event loop -- must wrap in `asyncio.to_thread`).

---

### Expected Features

**Must have -- table stakes (users will consider the product broken without these):**
- Login/logout, session persistence (TS-1)
- VM/LXC list with status indicators and search/filter (TS-2, TS-3)
- Power actions: start/stop/reboot/shutdown with graceful vs hard-stop distinction (TS-4)
- Delete with typed-name confirmation (TS-5)
- VM/LXC detail page with metrics (TS-6, TS-7)
- VM creation wizard and LXC creation wizard, multi-step (TS-8, TS-9)
- OS image/template picker (TS-10)
- SSH key management (TS-11)
- Embedded noVNC console via iframe (TS-12)
- Status feedback for long-running tasks -- toast + task drawer (TS-13)
- Meaningful error messages surfacing Proxmox errors (TS-14)
- Confirmation dialogs on destructive actions (TS-15)
- Manual snapshots and backup jobs (TS-16, TS-17)
- Resize CPU/RAM/disk (TS-18)
- Tags/labels (TS-19)
- Real-time cluster/node reachability indicator with read-only banner (TS-21)
- Light/dark mode (TS-22)

**Should have -- differentiators (where this product wins vs. existing tools):**
- Curated community-scripts catalog with one-click LXC deploy (D-1) -- nobody else does this from a portal
- Cloud-Init editor with full visibility into resulting config, live YAML preview (D-2)
- Multi-cluster switcher with per-cluster health badges (D-3)
- Per-user quota visualization with live delta in the wizard (D-4, D-8)
- Audit log views: admin sees all, user sees own (D-5)
- SDN-aware network picker: Zones / VNets / Subnets (D-10)
- Helper-script one-line install (D-11) -- dogfoods the community-scripts pattern
- First-class REST API with OpenAPI spec generated from code; UI consumes the same API (D-12)
- Live + offline migration UI (D-7)
- Clone + convert-to-template (D-9)

**Defer to v1.x (after user feedback):**
- Pagination / virtualized list for >50 VMs (TS-24)
- In-app notifications panel (TS-26)
- Auto-retry failed tasks (D-13)
- Bulk power actions (D-14)
- Favorites / pinned VMs (D-15)
- In-wizard cluster/node fit hint (D-16)
- Markdown notes (D-17)
- ISO library browser + URL download (D-18)
- Quickstart deploy mode with single-click sane defaults (D-6)

**Defer to v2+:**
- OIDC/SSO (Keycloak, Authentik)
- Email/webhook notifications
- Firewall rule display (read-only)
- Cross-cluster live migration
- Plugin/extension system
- Billing/cost tracking

**Explicit anti-features (do not build):**
- Storage/ZFS/RAID management, cluster formation, multi-hypervisor abstraction, Kubernetes-style workload management, billing/invoicing, bulk delete, in-browser SSH terminal, built-in Prometheus alerting.

---

### Architecture Approach

The system is a **modular monolith** -- one LXC, one Python process, one SQLite database. The architecture is shaped entirely by two Proxmox-specific constraints: (1) every state-changing Proxmox call returns a UPID rather than a result, so the entire write path must be async with job persistence and orphan recovery; (2) multi-tenancy requires each cluster to have a dedicated per-tenant or per-GUI service API token (never a user ticket forwarded from the browser), and every read must be scoped to the user's owned resources.

**Major components:**

1. **HTTP Edge (FastAPI + Uvicorn)** -- TLS-terminated by Caddy, routes REST, WebSocket, and the noVNC reverse proxy; thin handlers that delegate to services.
2. **Application Services** -- AuthN/AuthZ (Argon2id + JWT + SQLite refresh tokens), User/Team/Quota, Provisioning, Lifecycle, Audit Log Writer, Catalog Service (community-scripts). Business logic and admission-control quota checks live here.
3. **Job Queue + Worker (arq)** -- All Proxmox mutations go through a persistent job (SQLite row enqueued, arq worker claims it, dispatches to Proxmox, polls UPID until terminal, emits events). Orphan reaper runs on every startup to re-attach in-flight UPIDs.
4. **Live State Hub (broadcaster)** -- In-process pub/sub. Worker emits events; WebSocket connections subscribe by userId/clusterId/jobId. No external broker at single-LXC scale.
5. **Cluster Connector Pool** -- One connector struct per Proxmox cluster: `proxmoxer` instance, circuit breaker (pybreaker or hand-rolled), TTL resource cache, health monitor. `registry.get(cluster_id)` is the only way to reach Proxmox. When the breaker is open: reads return cached data with `stale: true`; writes return `503 cluster_unreachable`.
6. **noVNC Reverse Proxy** -- `/console/{cluster}/{vmid}/ws`: checks session/RBAC, mints vncticket server-side via `POST /nodes/{node}/qemu/{vmid}/vncproxy`, bidirectionally proxies binary WebSocket frames to `wss://proxmox-node:8006/vncwebsocket`. This is the only path that works without cross-origin cookie issues.
7. **SQLite Persistence (WAL)** -- Users, teams, quotas, cluster configs (encrypted tokens), resource cache, job queue, job history, audit log, sessions. Single file, single writer. Alembic migrations with `render_as_batch=True`.

**Key data flows:**
- **Write path:** HTTP handler -> quota pre-flight -> `jobs.enqueue()` -> return 202 with `jobId` -> arq worker claims -> Proxmox call -> UPID polling loop -> event emission -> WebSocket push to browser.
- **Read path:** HTTP handler -> cluster connector -> Proxmox (or resource cache) -> filter to user's owned resources -> return.
- **Console path:** iframe load -> browser opens WSS to GUI -> GUI mints vncticket -> GUI opens WSS to Proxmox vncwebsocket -> bidirectional byte pipe.
- **Cluster URL structure:** `/api/v1/clusters/{clusterId}/vms/{vmid}` -- cluster ID in the path from day one, not retrofitted.

---

### Critical Pitfalls

**Top 5 risks with the highest impact + retirement strategy:**

1. **VMID race condition** -- `/cluster/nextid` does not atomically reserve an ID. Two concurrent provisions get the same VMID; one fails or both partially succeed. **Prevention:** application-level lock per cluster_id around `(nextid -> create)`; maintain a "reserved VMID" set in the DB valid for 60 s; allow admins to set per-cluster VMID ranges. Address in the first provisioning phase.

2. **UPID polling started after task already finished** -- Fast operations (start, stop, snapshot delete) complete before the first poll. Naive code that waits for a state transition never fires the completion callback. **Prevention:** treat the first status response as authoritative; use `/tasks/{upid}/status` not `/tasks/active`; persist UPID and exitstatus immediately. Address in the foundational API client phase, before any provisioning work.

3. **noVNC vncticket 30-second expiry** -- Ticket generated on page load expires before the user clicks "Open Console". Intermittent 401 with no reproducible pattern. **Prevention:** generate the ticket on demand at click time, never on page render; build a reconnect button that re-mints on demand; never cache the vncticket. Address in the dedicated console phase; requires load-testing for slow mobile connections.

4. **Multi-tenant ACL leaks** -- Using a single super-token and filtering in application code makes every list endpoint a potential data leak. A single missed filter exposes other tenants' VMIDs, IPs, and names. **Prevention:** map each tenant to a Proxmox pool; use privilege-separated per-GUI-user tokens so Proxmox enforces visibility natively; re-check authorization on every WebSocket push, not just on subscribe. This must be in the data model from Phase 1 -- it is not retrofittable.

5. **Community-scripts supply-chain trust** -- The canonical install pattern pipes unreviewed bash to root on the Proxmox host. The project has had governance changes and key maintainer departures. **Prevention:** pin to reviewed commit hashes; run scripts inside the freshly created LXC only (via `pct exec`), never on the Proxmox host; surface the commit hash and last-reviewed date in the UI; default to non-interactive mode; capture all output to the audit log. Address in the community-scripts integration phase.

**Additional pitfalls to carry into every phase:**
- Quota TOCTOU: wrap quota-check + enqueue in a single DB transaction with row-level lock; track "pending VMs" in the app DB, not just from `/cluster/resources`.
- Cloud-init snippet storage: validate that a `snippets`-enabled storage exists on the cluster at startup; refuse migration if the snippet storage is node-local.
- SDN pending state: always call `POST /cluster/sdn` (reload) after any SDN write; poll for `applied` state before considering the operation complete.
- Long-running task loss on restart: persist UPID to DB before issuing the Proxmox call; orphan reaper on every boot.
- Storage name collision across clusters: always key storage references as `(cluster_id, storage_id)`; never bare names.

---

## Implications for Roadmap

Research across all four files converged on the same build order: lay the foundation, validate the cluster connector with read-only inventory, then unlock the full write path before tackling the high-complexity features.

### Phase 1: Foundation -- Auth, DB, Skeleton
**Rationale:** Everything gates on auth and the database schema. Multi-tenancy (pools + per-tenant tokens) must be in the schema from row one -- the Pitfalls research is unambiguous that retrofitting it is near-rewrite territory. Auth (local users, Argon2id, JWT access tokens, SQLite refresh tokens) and the cluster onboarding flow (store encrypted API token per cluster) are prerequisites for every subsequent phase.
**Delivers:** Working login/logout, admin user bootstrap, cluster onboarding (add/test/store a Proxmox cluster), skeleton HTTP server + embedded SPA shell, SQLite with Alembic migrations.
**Addresses:** TS-1, TS-20, TS-28; cluster config model for D-3.
**Avoids:** Pitfall 5 (ACL leaks), Pitfall 9 (ticket expiry -- backend uses tokens from day one), Pitfall 15 (TFA bypass -- decision recorded as ADR).
**Research flag:** Standard patterns -- no dedicated phase research needed.

### Phase 2: Multi-Cluster Read-Only Inventory
**Rationale:** The thin vertical slice validates the cluster connector, circuit breaker, and resource-cache loop cheaply before any write path exists. It also forces the cluster-ID-in-URL routing decision (`/api/v1/clusters/{id}/vms`) before the URL structure is baked in. After this phase the product is genuinely useful as a read-only dashboard.
**Delivers:** VM/LXC list across all configured clusters, VM detail page, live status indicators, cluster reachability health probe with read-only banner, per-cluster circuit breaker, resource cache (30 s TTL), per-user visibility filtering.
**Addresses:** TS-2, TS-3, TS-6, TS-7, TS-21, D-3.
**Avoids:** Pitfall 7 (cluster vs. node endpoint routing -- build the healthy-node router here), Pitfall 11 (storage name collision -- namespace everything by cluster_id from the start).
**Research flag:** Standard patterns -- well-documented. No dedicated research phase needed.

### Phase 3: User Management + Quotas
**Rationale:** Quota enforcement must exist before the first provisioning operation -- post-hoc rollback of a Proxmox create is impossible. The TOCTOU pitfall requires DB-level locking primitives that are easier to add before the first `jobs.enqueue()` call than after.
**Delivers:** Admin creates/manages users, sets per-user CPU/RAM/storage caps; quota usage display (progress bars); per-user resource ownership table; quota admission-control primitive (DB transaction with row lock).
**Addresses:** D-4, D-8 (quota delta in wizard), multi-tenancy data model.
**Avoids:** Pitfall 6 (quota TOCTOU), Pitfall 5 (ACL leaks -- tenant mapping finalized here).
**Research flag:** Standard patterns -- SQLAlchemy SELECT FOR UPDATE with aiosqlite is well-documented.

### Phase 4: Job Queue + First Write Operations (Power Actions)
**Rationale:** The job queue (arq + Redis) and the UPID polling loop are the most load-bearing architectural primitives. Power actions (start/stop/reboot) are the simplest Proxmox writes -- they exercise the full job pipeline with minimum complexity, validating arq, UPID polling, WebSocket fan-out, audit log writes, and orphan reaper before any provisioning complexity is introduced.
**Delivers:** arq worker pool, SQLite job table, UPID polling loop (with "already-finished" handling from Pitfall 2), orphan reaper on boot, WebSocket gateway + Live State Hub, audit log writer, start/stop/reboot/shutdown power actions, live status pills in the UI updating without page refresh.
**Addresses:** TS-4, TS-13, TS-25, D-5 (audit log).
**Avoids:** Pitfall 2 (UPID polling race -- build the authoritative first-poll check here), Pitfall 12 (task state lost on restart -- DB persistence before dispatch).
**Research flag:** Standard patterns for arq + UPID. No dedicated research phase, but write integration tests for "task returns 'stopped' on first poll" and "kill-and-restart during an operation."

### Phase 5: LXC Provisioning + Community-Scripts Integration
**Rationale:** LXC provisioning is simpler than VM provisioning (no cloud-init, no ISO selection) and delivers the product's single biggest differentiator in one phase. The VMID race condition primitive must be built here. The community-scripts supply-chain decision (pin to commit hashes, run inside LXC via `pct exec`) is a security commitment that must be made before the first script ships.
**Delivers:** VMID atomic reservation (app-level lock + reserved-ID set), LXC creation wizard, community-scripts catalog ingest (hourly refresh from GitHub), curated + full-browse catalog UI with categories and defaults, one-click deploy from script (create LXC -> `pct exec` install script inside container -> stream output to task drawer), quota enforcement at admission, first end-to-end "click -> running LXC" flow -- MVP milestone.
**Addresses:** TS-9, D-1, D-11 (installer foundation).
**Avoids:** Pitfall 1 (VMID race), Pitfall 10 (community-scripts supply chain -- commit pinning locked in here).
**Research flag:** Community-scripts execution mechanics need a spike before this phase. Specifically: non-interactive invocation of scripts that use `whiptail`, metadata JSON format stability, and `pct exec` timeout/output capture behavior.

### Phase 6: VM Provisioning + Cloud-Init Editor
**Rationale:** VM provisioning is the most complex provisioning path (ISO picker, cloud-init, SDN picker, clone flows). Cloud-Init snippet storage requirements and the cicustom/ciuser mutual-exclusivity are pitfalls that need a pre-flight validation pass. SDN is blocked on a spike (see Research Flags).
**Delivers:** VM creation wizard (deploy from cloud-init image, from PVE template, from ISO, clone existing), OS image/template picker, SSH key management, Cloud-Init editor (two-pane form + live YAML preview), cicustom snippet upload with pre-flight storage validation, `qm cloudinit update` regeneration, SDN zone/VNet picker (pending SDN spike), quota enforcement.
**Addresses:** TS-8, TS-10, TS-11, D-2, D-6, D-9, D-10.
**Avoids:** Pitfall 4 (cloud-init snippet storage), Pitfall 14 (DNS not applied for DHCP), Pitfall 16 (storage content-type mismatch).
**Research flag:** SDN integration requires a dedicated spike phase before implementation. See Open Questions.

### Phase 7: Full Lifecycle -- Snapshots, Backups, Resize, Migration, Console
**Rationale:** With the job pipeline solid and provisioning validated, the remaining lifecycle features are relatively small additions. noVNC is architecturally independent but deferred here so the vncticket flow and WebSocket proxy can be built with full knowledge of the multi-cluster connector.
**Delivers:** Snapshots (create/list/restore/delete, RAM toggle), backup jobs (manual + scheduled vzdump, PBS target support), resize CPU/RAM/disk (with hotplug/restart awareness), live + offline migration (with snippet storage pre-flight), clone + convert-to-template, noVNC reverse proxy (vncticket minted on click, bidirectional WebSocket pipe, reconnect button), delete with typed confirmation.
**Addresses:** TS-5, TS-12, TS-16, TS-17, TS-18, D-7, D-9.
**Avoids:** Pitfall 3 (vncticket expiry -- generate on click, never on page load), Pitfall 13 (vzdump output parsing -- use exitstatus not log scraping), Pitfall 17 (skiplock root-only), Pitfall 20 (migration snippet pre-flight).
**Research flag:** noVNC proxy needs a short spike for WebSocket header forwarding requirements and vncticket double-encoding confirmation before this phase.

### Phase 8: Resilience + Operational Hardening
**Rationale:** Circuit breaker, retry backoff, quorum checks, and the self-backup endpoint are the difference between a demo and a production tool.
**Delivers:** Circuit breaker per cluster (three-state machine, health probe every 15 s), degraded read-only mode + UI banner, retry with exponential backoff, quorum pre-flight on writes, audit log retention + rotation, GUI self-backup (dump app DB to configurable destination), API key / PAT auth for users.
**Addresses:** TS-21 (hardened), D-12 (PAT auth), Pitfall 18 (quorum loss), Pitfall 21 (audit log growth), Pitfall 22 (GUI state backup).
**Research flag:** Standard patterns. No dedicated research phase.

### Phase 9: Public API Hardening + Helper-Script Installer
**Rationale:** Once the feature surface is stable, harden the REST API contract and produce the helper-script installer.
**Delivers:** OpenAPI 3.1 spec auto-generated and published, typed SvelteKit client regenerated from spec via `@hey-api/openapi-ts`, rate limiting, API token revocation UI, community-scripts-style `install.sh` (idempotent, self-updating), LXC template (Debian 12 base + packaged stack), update story.
**Addresses:** D-11, D-12, deployment constraint.
**Research flag:** Standard patterns.

### Phase Ordering Rationale

- Foundation before everything: auth and multi-tenancy schema cannot be retrofitted. Cluster connector validation (read-only) before write path is cheap and avoids discovering connector bugs mid-provisioning.
- Job queue before provisioning: the UPID polling loop is the single most load-bearing primitive. Power actions are the smallest Proxmox writes and the correct stress test for the queue before complex provisioning.
- LXC before VM provisioning: LXC has no cloud-init complexity and delivers the biggest differentiator (community-scripts) faster.
- Lifecycle deferred until provisioning is solid: migration, snapshots, and backups all depend on a reliable job pipeline; they are individually small once the pipeline exists.
- noVNC in Phase 7, not earlier: the vncticket architecture decision has multi-cluster implications; building it after the connector is mature avoids rework.
- Hardening last: resilience features layer onto a stable surface without architecture changes.

### Research Flags

**Phases requiring a dedicated research spike before implementation:**

- **Phase 5 -- Community-scripts execution mechanics:** Non-interactive script invocation (whiptail bypass), `pct exec` output capture and timeout behavior, metadata JSON format stability vs. upstream drift, attribution requirements. This is the highest-risk single feature.
- **Phase 6 -- SDN integration:** No Python SDK wraps the SDN endpoints. The SDN pending-state/reload workflow is partially undocumented. A spike is needed to map: create VNet -> attach -> reload -> poll for applied state -> start VM, through proxmoxer. Confidence is MEDIUM-LOW; do not commit to implementation without this spike.
- **Phase 7 -- noVNC WebSocket proxy:** vncticket double-encoding gotcha, reverse proxy header requirements (Upgrade/Connection/proxy_buffering), cert verification opt-out for self-signed Proxmox certs, multi-cluster cookie domain handling.

**Phases with standard, well-documented patterns (skip research phase):**

- **Phase 1 -- Foundation:** FastAPI + SQLAlchemy + Alembic is textbook.
- **Phase 2 -- Read-only inventory:** proxmoxer `GET /cluster/resources` is well-understood; pybreaker is standard.
- **Phase 3 -- Quotas:** SQLAlchemy SELECT FOR UPDATE with aiosqlite is documented.
- **Phase 4 -- Job queue:** arq is purpose-built for FastAPI; UPID polling is documented in proxmoxer's own task examples.
- **Phase 8 -- Resilience/hardening:** pybreaker, structlog, Alembic migrations -- all standard.
- **Phase 9 -- Installer:** community-scripts install.sh pattern is the reference implementation.

---

## Open Questions for Phase-Level Research

**SDN Integration (Phase 6 spike):**
- What is the exact sequence of API calls to create a VNet, apply it cluster-wide, and verify it is in `applied` state on all nodes, through proxmoxer's dynamic-attribute interface?
- Does `POST /cluster/sdn` (reload) block until complete or return immediately? How do you poll for completion?
- Which PVE version introduced stable SDN API endpoints? Is 8.0 the safe floor or should 8.1+ be required?
- How does SDN reload behave when one cluster node is offline?

**Community-Scripts Execution (Phase 5 spike):**
- How do you reliably invoke community-scripts in non-interactive mode? Which scripts use `whiptail` and how are they structured?
- What is the best mechanism for streaming `pct exec` output back to the GUI in real time?
- How stable is the `frontend/public/json/*.json` metadata format? Is there a versioning contract?
- What is the correct attribution format required by the community-scripts license?
- How do you handle script failure mid-install (partial state inside the LXC)?

**noVNC Proxy (Phase 7 spike):**
- Confirm: vncticket must be URL-encoded exactly once in the query parameter -- not double-encoded.
- What WebSocket headers must the proxy forward verbatim (Upgrade, Connection, proxy_buffering)?
- How do you handle certificate verification for self-signed Proxmox certs in the outbound WSS connection from Python?
- Multi-cluster: how do you scope the PVEAuthCookie to the correct Proxmox host when the GUI proxies for multiple clusters?

**Multi-tenancy (Phase 1 + Phase 2):**
- Confirmed decision needed before Phase 1 ships: single super-token + filter-in-app vs. per-tenant privilege-separated tokens. Research strongly recommends per-tenant tokens (Pitfall 5). The implementation complexity of maintaining N Proxmox tokens vs. one must be weighed against the security surface reduction. This is the most impactful architectural decision in the project.
- How does Proxmox pool membership interact with resource visibility for tokens with `PVEVMUser` on `/pool/tenant-X`?

**proxmoxer + asyncio (all phases):**
- proxmoxer 2.x uses `requests` (synchronous) by default. All calls must be wrapped in `asyncio.to_thread()` to avoid blocking the FastAPI event loop. Is there a stable async backend for proxmoxer, or is `asyncio.to_thread()` the canonical approach?
- Thread pool sizing: how many concurrent proxmoxer calls is safe before hitting Proxmox API rate limits?

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies verified on PyPI with active releases as of 2026-05. proxmoxer 2.3.0 confirmed 2026-03-04. FastAPI 0.136.1 confirmed 2026-04-23. |
| Features | HIGH | Cross-referenced against Hetzner, DigitalOcean, ProxmoxAAS, PDM, CloudMox, MultiPortal, and OpenNebula. Feature boundaries well-justified. |
| Architecture | HIGH (patterns) / MEDIUM (internal layering) | Proxmox API patterns (UPID, tokens, vncticket flow) confirmed by official docs + multiple community implementations. Internal layering is opinionated but well-supported by prior art. |
| Pitfalls | HIGH | Most pitfalls confirmed by official Proxmox docs + forum reports + library issue trackers. VMID race and vncticket expiry have multiple independent confirming sources. |
| SDN integration | MEDIUM-LOW | Endpoints exist and are reachable via proxmoxer's dynamic-attribute API. No Python library wraps them. Pending-state semantics documented in PVE docs but not in any ecosystem tooling. Spike required. |
| Community-scripts execution | MEDIUM | Script metadata format verified. `pct exec` invocation is standard. Non-interactive execution mechanics and output capture are not well-documented in context; need a spike. |

**Overall confidence:** HIGH for the stack and architecture decisions; MEDIUM for the two spiked areas (SDN, community-scripts execution). Both have clear mitigation paths (dedicated research phase before implementation).

### Gaps to Address

- **SDN spike (before Phase 6):** Entire SDN integration path -- reload semantics, applied-state polling, version floor -- needs hands-on validation against a real PVE 8.x cluster with SDN enabled. Do not estimate Phase 6 without this.
- **proxmoxer async strategy (Phase 1 ADR):** Confirm that `asyncio.to_thread()` wrapping is the accepted approach for proxmoxer 2.x. This affects thread pool sizing across all phases.
- **Multi-tenancy token model (Phase 1 decision):** Single super-token vs. per-tenant privilege-separated tokens must be decided before the cluster connector is built. The pitfall research strongly favors per-tenant tokens; the implementation complexity must be weighed.
- **Community-scripts non-interactive mode (Phase 5 spike):** Catalog ingest is straightforward; `pct exec` output-streaming and non-interactive invocation mechanics are not. Do not design the community-scripts UX until this spike is complete.
- **vncticket double-encoding (Phase 7 spike):** Forum reports confirm that double-encoding silently fails. Verify the exact encoding requirement against a live PVE 8.x instance before building the proxy.

---

## Sources

### Primary (HIGH confidence)
- [proxmoxer 2.3.0 on PyPI](https://pypi.org/project/proxmoxer/) -- version, Python compat, release date
- [proxmoxer/proxmoxer GitHub](https://github.com/proxmoxer/proxmoxer) -- release notes, task polling examples
- [FastAPI 0.136.1 on PyPI](https://pypi.org/project/fastapi/) -- version and release date
- [Proxmox VE API wiki](https://pve.proxmox.com/wiki/Proxmox_VE_API) -- ticket vs. token semantics, CSRF behavior, UPID format
- [Proxmox VE Administration Guide -- API Tokens](https://pve.proxmox.com/pve-docs/pveum-plain.html) -- token format and revocation
- [Proxmox Cloud-Init docs](https://pve.proxmox.com/wiki/Cloud-Init_Support) -- cicustom parameter, snippets storage requirement
- [Proxmox SDN docs](https://pve.proxmox.com/pve-docs/chapter-pvesdn.html) -- REST endpoints, pending-state semantics
- [Proxmox User Management wiki](https://pve.proxmox.com/wiki/User_Management) -- ACL/pools/tokens
- [community-scripts/ProxmoxVE](https://github.com/community-scripts/ProxmoxVE) -- catalog source, metadata format
- [SvelteKit adapter-node](https://svelte.dev/docs/kit/adapter-node) -- confirmed LXC-deployable

### Secondary (MEDIUM confidence)
- [Proxmox forum: noVNC over API -- PVEAuthCookie + VNC Ticket](https://forum.proxmox.com/threads/novnc-over-api-pveauthcookie-pve-ticket-and-tunnel-auth-vnc-ticket-how.129091/) -- vncticket flow, double-encoding gotcha
- [petarduss/proxmox-vnc](https://github.com/petarduss/proxmox-vnc) -- working reference implementation of noVNC reverse proxy with API token
- [Proxmox forum: VMID race condition](https://forum.proxmox.com/threads/is-there-an-atomic-way-to-get-the-next-free-vm_id-and-reserve-it.123984/) -- race condition confirmed
- [Proxmox forum: SDN apply pending](https://forum.proxmox.com/threads/sdn-apply-remains-pending.152551/) -- SDN pending state behavior
- [Proxmox forum: skiplock root-only](https://forum.proxmox.com/threads/proxmox-ve-uses-token-based-authentication-not-support-option-skiplock-only-root-may-use.111633/) -- privilege limitation confirmed
- [pwdlib introduction by F. Voron](https://www.fvoron.com/blog/introducing-pwdlib-a-modern-password-hash-helper-for-python/) -- passlib EOL rationale
- [arq vs Celery vs Dramatiq comparison](https://judoscale.com/blog/choose-python-task-queue) -- async-native task queue selection
- [XDA: community-scripts root execution risk](https://www.xda-developers.com/love-proxmox-community-scripts-one-commands-scripts-root/) -- supply chain risk

### Tertiary (inferred / absence-of-evidence)
- SDN Python client landscape -- based on absence of dedicated SDN wrappers across PyPI; confirmed by STACK.md "no SDK exists" finding. Needs hands-on validation.
- proxmoxer async backend -- based on review of proxmoxer 2.3.0 source and docs; async HTTP backend not confirmed as production-ready. Needs validation.

---
*Research completed: 2026-05-14*
*Ready for roadmap: yes*
