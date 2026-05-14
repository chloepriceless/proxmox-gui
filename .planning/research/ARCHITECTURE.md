# Architecture Research

**Domain:** Self-hosted Proxmox VE multi-cluster self-service GUI (single-LXC deployment)
**Researched:** 2026-05-14
**Confidence:** HIGH for Proxmox/UPID/noVNC patterns (Proxmox docs + multiple community implementations confirm); MEDIUM for internal layering choices (opinionated, but well-supported by prior art)

## Standard Architecture

This is a **modular monolith** running in one LXC. Resist the urge to split into microservices — a single Go (or Node/Python) binary plus an embedded SPA, a SQLite database, and an in-process job worker is the proven pattern for self-hosted single-LXC products (think Vaultwarden, Gitea, Uptime Kuma, Pi-hole, NetBird, Nginx Proxy Manager).

The hard part is **not** the box-and-line decomposition. The hard part is:

1. **Proxmox tasks are async via UPIDs** — every state-changing call returns a task ID that must be polled for completion. This shapes the whole job/worker layer.
2. **noVNC embedding requires forwarding two tickets** — a PVE auth cookie *and* a per-session VNC ticket, over a WebSocket that must be reverse-proxied so the iframe origin matches the GUI's origin (cross-origin cookies break the iframe pattern).
3. **Multi-cluster means N independent failure domains** — each cluster connection needs its own circuit breaker and degraded-read state.
4. **Quota enforcement must be admission-time** — once a Proxmox task is dispatched, you cannot cleanly roll it back, so reject *before* hitting Proxmox.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Browser (User)                                   │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │  SPA (React/Svelte) ─── fetch ──► REST API                       │   │
│   │       │                                                           │   │
│   │       ├── WebSocket (live status, task progress, audit stream)   │   │
│   │       └── <iframe src="/console/{cluster}/{vmid}"> noVNC client  │   │
│   └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────┬───────────────────────────────────┘
                                       │  HTTPS (single port, e.g. 8006/443)
┌──────────────────────────────────────▼───────────────────────────────────┐
│                LXC: vm-deployment-gui (single process / binary)           │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     HTTP Server (Edge)                              │ │
│  │  - serves SPA static assets                                         │ │
│  │  - /api/v1/*    → REST API handlers (auth, RBAC, validation)        │ │
│  │  - /ws          → WebSocket upgrade (push live state)               │ │
│  │  - /console/*   → noVNC reverse proxy (vncwebsocket + ticket inject)│ │
│  │  - /metrics     → Prometheus (optional)                             │ │
│  └────────────┬───────────────────────────┬───────────────────────────┘ │
│               │                           │                              │
│   ┌───────────▼──────────────┐  ┌─────────▼─────────────────────────┐   │
│   │  Application Services     │  │  Live State Hub                  │   │
│   │  ┌─────────────────────┐  │  │  - in-memory pub/sub             │   │
│   │  │ AuthN/AuthZ         │  │  │  - fan-out task progress         │   │
│   │  │ User/Team/Quota     │  │  │  - fan-out cluster status        │   │
│   │  │ Audit Log Writer    │  │  │  - WS subscriber registry        │   │
│   │  │ Provisioning Svc    │  │  └──────────▲───────────────────────┘   │
│   │  │ Lifecycle Svc       │  │             │ events                   │
│   │  │ Catalog Svc (CScr.) │  │             │                          │
│   │  └─────────┬───────────┘  │  ┌──────────┴───────────────────────┐   │
│   │            │              │  │  Job/Task Worker (in-process)    │   │
│   │            └──── enqueue ─┼──►  - claims jobs from SQLite       │   │
│   │                           │  │  - dispatches to Proxmox         │   │
│   └───────────────────────────┘  │  - polls UPID until terminal     │   │
│                                  │  - emits events; updates DB      │   │
│                                  │  - reaps orphans on boot         │   │
│                                  └──────────┬───────────────────────┘   │
│                                             │                           │
│   ┌─────────────────────────────────────────▼──────────────────────┐   │
│   │           Cluster Connector Pool (1 per cluster)                │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │   │
│   │  │ Cluster A│  │ Cluster B│  │ Cluster C│  (per-cluster:        │   │
│   │  │ client + │  │ client + │  │ client + │   - HTTP client       │   │
│   │  │ breaker  │  │ breaker  │  │ breaker  │   - circuit breaker   │   │
│   │  │ + cache  │  │ + cache  │  │ + cache  │   - resource cache    │   │
│   │  └────┬─────┘  └────┬─────┘  └────┬─────┘   - health monitor)   │   │
│   └───────┼─────────────┼─────────────┼───────────────────────────────┘ │
│           │             │             │                                 │
│   ┌───────▼─────────────▼─────────────▼─────────────────────────────┐  │
│   │                   Persistence (SQLite, WAL)                       │  │
│   │   users · teams · quotas · clusters · resources_cache             │  │
│   │   jobs (queue) · job_history · audit_log · sessions               │  │
│   └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│   Files on disk: /var/lib/vm-deployment-gui/{app.db, audit/, secrets/}   │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │ HTTPS (8006) — API token per cluster
        ┌────────────────┼────────────────┬───────────────────┐
        ▼                ▼                ▼                   ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  Proxmox      │ │  Proxmox      │ │  Proxmox      │ │  community-   │
│  Cluster A    │ │  Cluster B    │ │  Cluster C    │ │  scripts repo │
│  (1..N nodes) │ │  (1 node)     │ │  (1..N nodes) │ │  (HTTP/Git)   │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **SPA (frontend)** | Hetzner-style UI, wizards, live status | React or Svelte + Vite, served as static assets by the API binary |
| **HTTP Server (Edge)** | TLS termination, routing, static asset serving, WS upgrade, console proxy | Stdlib HTTP server (Go: `net/http`+`chi`; Node: Fastify; Python: FastAPI+Uvicorn) — *no* external reverse proxy needed |
| **AuthN/AuthZ** | Local user auth, sessions, RBAC, quota lookup | Argon2id passwords, JWT or signed-cookie sessions, RBAC table in SQLite |
| **Provisioning/Lifecycle Services** | Business logic, validation, quota check, job enqueue | Plain functions/handlers — no framework heroics |
| **Audit Log Writer** | Append-only "who/what/when" record | Separate SQLite table; rotated to compressed files monthly |
| **Catalog Service** | Mirror community-scripts metadata; cache | Periodic refresh (hourly) from `community-scripts/ProxmoxVE` repo `frontend/public/json/` |
| **Job Worker** | Async execution of Proxmox tasks, UPID polling, event emission | In-process goroutines/workers reading from SQLite queue (e.g. `goqite`, `liteq`, or hand-rolled) |
| **Live State Hub** | In-memory pub/sub from worker → WebSocket subscribers | Simple channel/event-emitter; no Redis required at this scale |
| **Cluster Connector** | Per-cluster Proxmox API client + circuit breaker + cached read state | One struct per cluster; `gobreaker` or equivalent; lock-protected health state |
| **noVNC Reverse Proxy** | Bridge browser ↔ Proxmox `vncwebsocket`, inject `vncticket` and PVEAuthCookie | WebSocket reverse proxy on `/console/*` — the GUI mints the vncticket on demand and forwards bytes |
| **Persistence** | All state (users, jobs, audit, cluster config, cached resources) | Single SQLite file in WAL mode |

## Recommended Project Structure

This is a **stack-agnostic** layout — adapt extensions for the chosen language. The structure is what matters.

```
vm-deployment-gui/
├── cmd/
│   └── server/                  # main entry point (binary)
├── internal/
│   ├── http/                    # HTTP edge: routing, middleware
│   │   ├── api/                 # REST handlers (one file per resource)
│   │   ├── ws/                  # WebSocket gateway + subscriber registry
│   │   └── console/             # noVNC reverse proxy
│   ├── auth/                    # login, sessions, JWT, RBAC, middleware
│   ├── users/                   # user/team/quota domain
│   ├── audit/                   # audit log writer + rotation
│   ├── clusters/                # Cluster domain object + registry
│   │   ├── connector/           # Per-cluster Proxmox client (HTTP, retries, breaker)
│   │   ├── registry.go          # Map of clusterID -> *Connector
│   │   └── health.go            # Health probe, degraded-mode flag
│   ├── proxmox/                 # Thin typed wrapper around PVE REST API
│   │   ├── client.go            # Low-level HTTP, token auth, CSRF if needed
│   │   ├── tasks.go             # UPID parsing, status polling
│   │   ├── nodes.go nodes_qemu.go nodes_lxc.go storage.go sdn.go
│   │   └── vncproxy.go          # vncproxy + vncwebsocket helpers
│   ├── provisioning/            # Higher-level orchestration (create VM/LXC)
│   ├── lifecycle/               # start/stop/migrate/snapshot/backup
│   ├── catalog/                 # community-scripts ingest + cache
│   ├── jobs/                    # job queue (SQLite-backed) + worker pool
│   │   ├── store.go             # enqueue, claim, complete, fail
│   │   ├── worker.go            # poll loop, UPID polling, event emission
│   │   └── reaper.go            # boot-time orphan recovery
│   ├── events/                  # in-memory pub/sub hub
│   ├── db/                      # SQLite open, migrations, query helpers
│   │   └── migrations/          # numbered SQL files (0001_init.sql, …)
│   └── config/                  # config loading, env, secrets
├── web/                         # SPA source (separate package.json)
│   ├── src/                     # React/Svelte components
│   └── dist/                    # built assets (embedded into binary)
├── deploy/
│   ├── install.sh               # community-scripts-style helper-script
│   ├── systemd/vm-deployment-gui.service
│   └── lxc-template-hook.sh     # for the LXC image build
├── docs/
└── .planning/                   # GSD workspace
```

### Structure Rationale

- **`internal/proxmox/`:** Thin, typed wrapper over the PVE REST API — every other layer talks to Proxmox *only* through this. Keeps UPID handling, CSRF rules, and pagination quirks in one place.
- **`internal/clusters/`:** The cluster is a first-class domain object. Connectors live behind a registry so you can `registry.Get(clusterID)` from any handler. This is what enables per-cluster degraded mode without spreading conditionals.
- **`internal/jobs/`:** Isolating the queue is non-negotiable because it must survive process restarts and reap orphans. SQLite-backed queue (proven by goqite, liteq, River) is sufficient at single-LXC scale and avoids a Redis dependency.
- **`internal/http/console/`:** noVNC proxy is intentionally separate from `internal/http/api/` — different protocol (WebSocket binary frames), different auth model (vncticket per session), different lifecycle (long-lived).
- **`web/dist/` embedded into the binary:** Single binary deploy. Use the language's embed feature (Go `embed.FS`, Node `pkg`/SEA, Python `importlib.resources`).

## Architectural Patterns

### Pattern 1: API Token per Cluster + Local Session for the User

**What:** The GUI authenticates each user *locally* (Argon2id + session cookie/JWT). Each Proxmox cluster is accessed using a **dedicated PVE API token** stored once by an admin during cluster onboarding — never a per-user ticket forwarded from the browser.

**When to use:** Always, for this product. The Proxmox docs explicitly recommend API tokens over tickets for automation use cases because tickets are ephemeral (2 hours), require CSRF tokens for writes, and are bound to the cluster-wide signing key.

**Trade-offs:**
- (+) Stateless, no ticket refresh loop, no CSRF dance, revocable per token.
- (+) The GUI can enforce its own RBAC/quotas independently — Proxmox doesn't need to know about the user.
- (−) The token must have broad permissions (`PVEVMAdmin` + `Datastore.AllocateSpace` + SDN read). All authorization decisions live in the GUI, so a bug = privilege escalation. Mitigation: aggressive audit logging, per-request RBAC middleware, integration tests on policy enforcement.

**Example:**
```text
On cluster onboarding (admin):
  - admin pastes API token: PVEAPIToken=root@pam!gui-token=<uuid>
  - GUI verifies token works, stores it encrypted (age/AES-GCM) in DB

On every Proxmox call:
  Authorization: PVEAPIToken=root@pam!gui-token=<uuid>
  (no CSRF header needed for token auth)
```

### Pattern 2: Job Queue + UPID Polling (the central pattern)

**What:** State-changing Proxmox operations are always async. Every write request creates a `job` row in SQLite, returns `202 Accepted` with a `jobId`, and a worker picks it up, calls Proxmox, gets a UPID, and polls until terminal.

**When to use:** For every POST/PUT/DELETE that touches Proxmox. Reads stay synchronous.

**Trade-offs:**
- (+) Crash-safe: jobs survive restart.
- (+) Long operations (migration, full clone, backup) don't block HTTP.
- (+) Single mechanism for progress streaming.
- (−) More moving parts. Every write is now two records (job + audit entry) before anything happens.

**Job lifecycle:**

```text
   pending ──► claimed ──► dispatching ──► running ──► succeeded
                                    │           │
                                    │           └──► failed (UPID exitstatus != OK)
                                    │
                                    └──► failed (Proxmox unreachable, breaker open)
```

**UPID polling loop (per-job, in worker):**

```text
upid = proxmox.POST(/nodes/{node}/qemu, params)         # returns UPID
db.update(job, state=running, upid=upid)
events.publish("job.started", jobId)

for {
    status = proxmox.GET(/nodes/{node}/tasks/{upid}/status)
    if status.status == "stopped" {
        if status.exitstatus == "OK" { mark succeeded }
        else                          { mark failed, attach log tail }
        events.publish("job.completed", jobId)
        break
    }
    events.publish("job.progress", jobId)               # for WS subscribers
    sleep(adaptive_interval)                            # 500ms → 2s → 5s
}
```

**Reference:** Proxmoxer's `blocking_status` and `go-proxmox`'s `WaitFor(ctx, seconds)` are the canonical implementations to model after. Default poll interval should start tight (200–500 ms) for snappy UX and back off after 5 s.

### Pattern 3: Orphan Reaper on Boot

**What:** On startup, the worker scans for jobs in non-terminal states (`claimed`, `dispatching`, `running`) that have a recorded UPID. For each, it re-attaches by polling Proxmox for current UPID status. If Proxmox reports the task already terminated, the job is resolved without re-dispatching. If the UPID is unknown to Proxmox, the job is marked `failed` with reason `orphaned`.

**When to use:** Every startup, no exceptions. This is what prevents a process crash mid-clone from leaving the UI showing "Provisioning…" forever.

**Trade-offs:**
- (+) Survives crashes, kernel panics, LXC restarts during updates.
- (+) Cheap — just one query + N Proxmox status calls on boot.
- (−) Jobs that crashed *before* dispatching a Proxmox call (i.e. state=`claimed` but no UPID) cannot be safely retried because we don't know if the side effect happened. Mark them `needs_review` and surface in admin UI.

### Pattern 4: noVNC Reverse Proxy with Per-Session Ticket Minting

**What:** The browser embeds `<iframe src="/console/{cluster}/{vmid}">`. The GUI serves a tiny noVNC HTML page that opens `wss://gui-host/console/{cluster}/{vmid}/ws`. The GUI server, on that WebSocket upgrade:

1. Checks the user's GUI session and RBAC for that VM.
2. Calls Proxmox `POST /nodes/{node}/qemu/{vmid}/vncproxy` (using the cluster's API token) to mint a `ticket` + `port`.
3. Opens an outbound WebSocket to `wss://proxmox-node:8006/api2/json/nodes/{node}/qemu/{vmid}/vncwebsocket?port={port}&vncticket={URL_ENCODED_ticket}`.
4. Pipes binary frames bidirectionally between the two WebSockets.

**When to use:** Always — this is the only path that works without serving the GUI from the same origin as every Proxmox node (which is impossible for multi-cluster).

**Trade-offs:**
- (+) Single-origin to the browser, no third-party cookie issues, no `X-Frame-Options` / CSP conflicts with Proxmox UI.
- (+) Works regardless of how Proxmox is exposed externally (the GUI is the only one that needs to reach it).
- (−) All console traffic flows through the GUI LXC — bandwidth-bound. Fine for keyboard/mouse, marginal for full-motion video. Not a real-world problem at home-lab scale.
- (−) Must support binary WebSocket framing and `wss://` upstream with cert verification (allow opt-out for self-signed Proxmox certs — this is the norm).

**Critical gotcha:** the `vncticket` must be URL-encoded *exactly once*. Forum reports show double-encoding silently fails. Do not double-encode.

### Pattern 5: Cluster Connector with Circuit Breaker

**What:** Each cluster has one connector struct: HTTP client (with timeouts), circuit breaker, last-known-good resource cache, health monitor. When the breaker is open, reads return cached data with a `stale: true` flag; writes are rejected with `503 cluster_unreachable`.

**When to use:** Always — required for the "degrades to read-only with banner" requirement in PROJECT.md.

**State machine:**

```text
   ┌────────────┐  N consecutive failures  ┌────────────┐
   │   CLOSED   │ ────────────────────────►│    OPEN    │
   │ (healthy)  │◄──── 1 successful probe ─│ (degraded) │
   └────────────┘                          └─────┬──────┘
         ▲                                       │ after cooldown
         │       1 success                       ▼
         └──────────────────────────────  ┌────────────┐
                                          │ HALF-OPEN  │
                                          │ (testing)  │
                                          └────────────┘
```

**Health probe:** A lightweight goroutine per cluster calls `GET /version` every 15 s and updates the connector's last-seen-healthy timestamp. UI shows a per-cluster status pill.

**Trade-offs:** `sony/gobreaker` for Go, `opossum` for Node, `pybreaker` for Python — all are mature and ~1 day of integration work.

### Pattern 6: Quota Admission Control (pre-flight)

**What:** Every provisioning/resize/clone endpoint computes the *post-action* resource footprint (CPU cores, RAM bytes, storage bytes) for the user/team. If it exceeds the quota, return `403 quota_exceeded` *before* enqueueing a job.

**When to use:** Always. Post-hoc enforcement is impossible because Proxmox cannot roll back a partial provision atomically.

**Trade-offs:**
- (+) Clean failure mode — the user gets an immediate, actionable error.
- (+) No half-created resources.
- (−) "Current usage" must be tracked accurately. Source of truth = Proxmox (`/cluster/resources` snapshot, refreshed every 30–60 s + after every successful job). Never trust local DB only.

**Algorithm:**
```text
on POST /vms:
  current = sum(user's running+stopped VM specs, from cluster resources cache)
  proposed = current + this_request_spec
  if proposed.cpu > quota.cpu || proposed.ram > quota.ram || proposed.storage > quota.storage:
     return 403 quota_exceeded {dimension, current, requested, limit}
  // also forecast: do we have free storage on target? free RAM on target node?
  enqueue(job)
```

### Pattern 7: Multi-Cluster Context Resolution

**What:** The cluster ID is part of the URL path, not the JWT, not a header. Every resource is namespaced: `/api/v1/clusters/{clusterId}/vms/{vmid}`.

**When to use:** From day one. Retrofitting cluster context into URLs after the fact is painful.

**Trade-offs:**
- (+) RESTful, cacheable, bookmarkable, copy-pasteable in support tickets.
- (+) Multi-cluster operations (cross-cluster migration, future) can use `/api/v1/migrations` with cluster IDs in body.
- (+) No "ambient context" bugs (the classic "user thinks they're on cluster A, action lands on B").
- (−) Slightly verbose URLs. Worth it.

**Listing endpoint:** `GET /api/v1/vms?cluster=A,B` for aggregation views. Default to all clusters the user has access to.

## Data Flow

### Request Flow — Create VM (the canonical write path)

```
[User clicks "Create" in wizard]
    ↓
[SPA] POST /api/v1/clusters/A/vms  { name, template, cpu, ram, storage, vlan, ... }
    ↓
[HTTP edge] → session middleware → RBAC middleware
    ↓
[Provisioning handler]
    ├─► validate input (schema)
    ├─► resolve target node (placement, or honour user choice)
    ├─► quota check ◄── reads cluster resource cache + user quota
    ├─► audit.write("vm.create.requested", user, params)
    ├─► jobs.enqueue("vm.create", params)
    └─► return 202 { jobId, statusUrl, wsUrl }
    ↓
[SPA] subscribes WS to job.{jobId} and navigates to detail page
                              │
                              │ meanwhile…
                              ▼
[Worker] claims job from SQLite
    ├─► connector = registry.Get("A"); if breaker open → fail
    ├─► upid = proxmox.POST(/nodes/{node}/qemu, body)
    ├─► db.update(job, state=running, upid=upid)
    ├─► events.publish("job.running", jobId)
    │
    ├─► poll loop:
    │     status = proxmox.GET(/nodes/{node}/tasks/{upid}/status)
    │     events.publish("job.progress", jobId, status)
    │     repeat until stopped
    │
    ├─► on OK:    db.update(job, state=succeeded)
    │             audit.write("vm.create.succeeded", user, vmid)
    │             events.publish("job.completed", jobId)
    │             refresh cluster resources cache
    │
    └─► on fail:  db.update(job, state=failed, error=tail)
                  audit.write("vm.create.failed", user, vmid, error)
                  events.publish("job.completed", jobId, error)
```

### State Management — Live UI updates

```
[Worker emits events]
        │
        ▼
[Live State Hub] (in-process channel/event emitter)
        │
        ├─► subscriber: WS connection for user X
        ├─► subscriber: WS connection for user Y
        └─► subscriber: WS connection for admin dashboard
                │
                ▼
[Browser SPA] updates view (job card progress, status pill, audit feed)
```

No external broker. The hub is just a `map[topic][]chan Event` guarded by a mutex. Subscribers filter by `userId` / `clusterId` / `jobId` before forwarding to the WebSocket.

### Auth Flow

```
[Browser]                       [GUI server]                    [Proxmox]
   │                                 │                              │
   │── POST /api/v1/auth/login ─────►│                              │
   │   {username, password}          │                              │
   │                                 │── Argon2id verify against DB │
   │                                 │── issue session cookie (HttpOnly, SameSite=Strict)
   │◄── 200 + Set-Cookie ────────────│                              │
   │                                 │                              │
   │── GET /api/v1/clusters/A/vms ──►│                              │
   │   Cookie: session=...           │                              │
   │                                 │── decode session, load user  │
   │                                 │── RBAC: user.can_read(cluster=A)
   │                                 │── connector = registry.Get(A)│
   │                                 │── GET /cluster/resources ───►│ (PVEAPIToken)
   │                                 │◄─── 200 JSON ────────────────│
   │◄─── 200 (filtered to user) ─────│                              │
```

### Console Flow (noVNC)

```
[Browser]                              [GUI server]                       [Proxmox]
   │                                        │                                  │
   │── iframe src=/console/A/100 ──────────►│ serve static noVNC HTML page    │
   │                                        │                                  │
   │── WSS /console/A/100/ws ──────────────►│ check session, RBAC             │
   │                                        │── POST /nodes/.../vncproxy ────►│ (PVEAPIToken)
   │                                        │◄── { ticket, port, user } ──────│
   │                                        │── WSS to proxmox vncwebsocket ─►│
   │                                        │   ?port=N&vncticket=URLENC(ticket)
   │                                        │◄── binary frames ───────────────│
   │◄── binary frames ──────────────────────│                                  │
   │── keyboard/mouse frames ──────────────►│── forward ─────────────────────►│
```

### Key Data Flows

1. **Cluster resource cache:** A background goroutine per cluster calls `GET /cluster/resources` every 30 s and writes the snapshot to SQLite. All read endpoints (`GET /vms`, dashboard) and quota checks use this cache. Per-resource detail views still hit Proxmox directly.

2. **Community-scripts catalog:** A scheduled task (every hour) fetches the JSON metadata files from `community-scripts/ProxmoxVE` (path `frontend/public/json/`) and stores them in SQLite. On deploy, the GUI generates the actual `bash -c "$(wget …)"` command from the metadata and executes it inside a freshly created LXC via `pct exec` (or, more cleanly, by passing it as the LXC's first-boot script).

3. **Audit log:** Every state-changing handler synchronously appends to the `audit_log` table *before* returning. A daily cron writes the prior day to a compressed file and trims the table to last 30 days (configurable).

4. **WebSocket subscriptions:** SPA opens one WS per page that filters server-side: `subscribe { jobs: [jobId, ...], clusters: ["A"], audit: true (admin only) }`. The hub honours subscriptions and pushes only relevant events.

## Build Order / Dependencies

This is the suggested vertical-slice ordering. Each step is a working, useful product.

```
Step 1: Skeleton (single binary serves "hello")
        └── HTTP server + embedded SPA shell + SQLite open + migrations runner

Step 2: Auth + admin user bootstrap
        └── login, session, password reset, first-run admin creation

Step 3: Cluster onboarding (admin only)
        └── add cluster (name, URL, API token), connection test, store, list
        ├── proxmox client (low-level, /version + /nodes only)
        └── cluster registry + connector struct (no breaker yet — add Step 8)

Step 4: Read-only inventory                                          ◄── THIN SLICE
        └── list VMs/LXCs across clusters, basic detail page
        └── cluster resource cache (background refresh)
        └── per-user visibility (each user sees nothing yet — admin sees all)

Step 5: User management + quotas
        └── create/manage users, set quotas (admin)
        └── per-user filtering in inventory
        └── quota usage display (no enforcement yet)

Step 6: Job queue + Worker + first write op
        └── SQLite-backed job table + worker pool
        └── UPID polling implementation
        └── orphan reaper on boot
        └── "Start VM" / "Stop VM" — simplest writes that exercise the full path
        └── audit log writer
        └── WebSocket gateway + Live State Hub
        └── SPA: live status pills update without refresh

Step 7: LXC provisioning (community-scripts integration)
        └── catalog ingest from community-scripts
        └── "deploy from script" wizard
        └── quota enforcement (admission)
        └── first end-to-end "click → running LXC" flow ← MVP MILESTONE

Step 8: Resilience
        └── circuit breaker per cluster
        └── degraded read-only mode + banner
        └── retry with backoff on transient Proxmox failures

Step 9: VM provisioning (Cloud-Init)
        └── ISO/template browsing
        └── Cloud-Init editor
        └── network picker (SDN zones/VNets)

Step 10: Lifecycle (snapshots, backups, resize, clone, migrate)
        └── one feature at a time, each is small once the job pipeline exists

Step 11: noVNC embed
        └── reverse-proxy WebSocket
        └── per-session vncticket mint
        └── noVNC client page

Step 12: Public REST API hardening
        └── API keys for users (in addition to sessions)
        └── OpenAPI spec generation
        └── rate limiting

Step 13: Helper-script installer + packaging
        └── community-scripts-style install.sh
        └── LXC template (Debian 12 / Ubuntu LTS minimum image + binary)
        └── update story (in-place binary swap + migration runner)
```

**The thin vertical slice** = Step 1 + 2 + 3 + 4. After Step 4 you have a polished read-only multi-cluster dashboard — already useful, validates auth + cluster connector + UI direction, and is *cheap* to build. Step 6 is where the real shape of the system emerges; Step 7 is MVP-feature-complete.

**Hard dependencies:**
- Steps 6 (job queue) and 4 (cluster connector) gate everything that mutates Proxmox.
- Step 11 (noVNC) depends on Step 3 (cluster connector) and Step 6 (auth) but is otherwise independent — can be sequenced anywhere from Step 7 onwards.
- Step 13 (installer) can be developed in parallel with anything after Step 1 — start a sketch early so you discover packaging issues before they bite at release.

## Scaling Considerations

This is a self-hosted single-LXC home-lab tool. "Scale" means "does it fall over on the day a 6-cluster, 200-VM, 20-user power user installs it?"

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 cluster, 5 users, 50 VMs | Defaults. SQLite WAL handles 1000s of writes/s easily. |
| 5 clusters, 20 users, 500 VMs | Add per-cluster cache TTL tuning (30 s → 60 s). Worker pool size 4–8. |
| 20 clusters, 100 users, 5000 VMs | Probably out of scope for "single LXC". If pushed there: switch to PostgreSQL (single config flag — abstract DB access from day one with sqlc-style typed queries), bump worker pool, consider Redis pub/sub if WS subscriber count > 200. |

### Scaling Priorities

1. **First bottleneck — `/cluster/resources` refresh:** A 200-VM cluster returns ~200 KB. Refreshing every 30 s × 5 clusters = manageable. If a cluster is big *and* slow, the refresh blocks. **Fix:** per-cluster goroutine + adaptive interval (backs off when cluster is loaded).
2. **Second bottleneck — WebSocket fan-out:** With N subscribers and M events/sec, naive O(N×M) push works until ~1000 subscribers. **Fix:** subscription filtering on the server side (you only push events the subscriber registered for) — already in the design.
3. **Third bottleneck — SQLite write contention:** WAL mode + single writer. If job throughput exceeds ~1000 jobs/sec (it won't), batch audit writes. Otherwise irrelevant.
4. **Fourth — console bandwidth:** Each noVNC session ~50–500 KB/s. The LXC's NIC is the cap. Not a software problem.

## Anti-Patterns

### Anti-Pattern 1: Forwarding the user's browser ticket to Proxmox

**What people do:** Ask the user to log in to Proxmox in another tab, scrape the `PVEAuthCookie`, forward it from the GUI server.
**Why it's wrong:** Tickets expire every 2 hours, require CSRF tokens on writes, are bound to the cluster signing key (which rotates daily), and tie the GUI's identity model 1:1 to Proxmox users — destroying the multi-tenant abstraction.
**Do this instead:** One **API token** per cluster, stored encrypted, used by the server. Local users in the GUI's own DB are decoupled from Proxmox users.

### Anti-Pattern 2: Synchronous Proxmox calls in HTTP handlers

**What people do:** Have `POST /vms` block while it calls Proxmox and polls the UPID until done.
**Why it's wrong:** Some Proxmox operations (full clone of a 100 GB disk, live migration) take 5–30 minutes. HTTP timeouts, retries, reverse-proxy gateway timeouts, browser disconnects — all break this. Worse, on disconnect the user has *no idea* if the action succeeded.
**Do this instead:** Enqueue a job, return `202 + jobId`, drive progress via WebSocket.

### Anti-Pattern 3: Embedding Proxmox's `/?console=...` URL directly in an iframe

**What people do:** Build the iframe `src` to point at the Proxmox node's own noVNC endpoint and hope cookies work.
**Why it's wrong:** Different origin → no cookies → no auth. Self-signed cert browser warnings. CSP / X-Frame-Options conflict with Proxmox's defaults. Breaks the multi-cluster model the moment a user has access to a second cluster on a different hostname.
**Do this instead:** Reverse-proxy the `vncwebsocket` through the GUI. Mint the `vncticket` server-side per session.

### Anti-Pattern 4: Storing quotas only locally

**What people do:** Track "user X uses Y CPU" in a local counter, increment on create, decrement on delete.
**Why it's wrong:** Counters drift. A failed-but-partially-created VM, a manual cleanup in Proxmox UI, a crashed worker mid-create — all desync the counter. Eventually the GUI says the user is over quota when they aren't, or vice versa.
**Do this instead:** Treat Proxmox `/cluster/resources` as source of truth. The local cache is updated from it. Quota check sums *actual* allocated resources from the cache, not a counter.

### Anti-Pattern 5: One generic "PVEClient" instance shared across clusters

**What people do:** One global `proxmox.Client` that takes a cluster URL on each call.
**Why it's wrong:** Connection pooling, circuit breaker state, cache state, health monitoring — all must be **per cluster**. A shared client either has none of these or implements them via a side-channel that's harder to reason about than a struct-per-cluster.
**Do this instead:** `connector := registry.Get(clusterId)` returns a struct that owns its own http.Client, breaker, cache, health timestamp.

### Anti-Pattern 6: Splitting into microservices

**What people do:** "Let's run the API, the worker, the WS gateway as separate processes."
**Why it's wrong:** Self-hosted single-LXC product. The deployment story is the product. Three processes mean three log streams, three systemd units, IPC, distributed failure modes — for zero benefit at the target scale.
**Do this instead:** One binary. Use goroutines / async workers / threads. Modular code, modular deploy = monolith.

### Anti-Pattern 7: Trusting the SDN list at provisioning time without re-fetch

**What people do:** Cache the SDN zones/VNets at app start, never refresh.
**Why it's wrong:** Admin adds a VNet in Proxmox → GUI doesn't know → user can't pick it. Or worse: admin deletes a VNet → GUI offers it → provisioning fails with a confusing error.
**Do this instead:** SDN list is part of the `/cluster/resources` refresh, TTL ≤ 60 s. Pre-flight check at job-claim time.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Proxmox VE REST API** | HTTPS to `:8006`, `PVEAPIToken` header | Self-signed certs are the norm — make verification opt-in per cluster. Pagination is absent on most endpoints. Errors return non-JSON HTML sometimes — detect and wrap. |
| **Proxmox `vncwebsocket`** | WSS to `:8006`, binary frames | Ticket URL-encoded *once*. Cert verification same as REST. |
| **community-scripts/ProxmoxVE** | HTTPS GET against `raw.githubusercontent.com` | No auth needed. Cache aggressively (1 h). Be polite — single fetch per cache refresh, not per user request. |
| **Cloud-Init images** | HTTPS download from official mirrors (Debian, Ubuntu, Rocky, etc.) | Admin configures sources; the GUI pulls images to Proxmox storage on first use. |
| **Proxmox Backup Server (PBS)** | Proxmox itself talks to PBS; the GUI just triggers vzdump with target storage. No direct PBS API. | |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **HTTP handler ↔ Service** | Direct function call | Services own validation and orchestration. Handlers are thin. |
| **Service ↔ Job queue** | `jobs.Enqueue(name, payload)` returns jobId | Payload is JSON blob. Job names map 1:1 to worker handlers. |
| **Worker ↔ Proxmox** | Only through `internal/proxmox/` and `internal/clusters/connector/` | No raw HTTP from worker — keeps UPID/retry/breaker logic centralised. |
| **Worker ↔ UI** | `events.Publish(topic, payload)` → in-memory hub → WS | Fire-and-forget; events are non-durable, the DB row is the source of truth. |
| **Cluster connector ↔ DB** | Resource cache writes only | Connector never reads users/quotas — separation of concerns. |
| **Audit writer ↔ Services** | Synchronous append before returning | Audit is part of the request's success criteria — if audit write fails, the request fails. |

## Sources

- [Proxmox VE API — official wiki](https://pve.proxmox.com/wiki/Proxmox_VE_API) — authoritative on auth, tickets, tokens, CSRF.
- [Proxmox VE Administration Guide — API Tokens](https://pve.proxmox.com/pve-docs/pveum-plain.html) — token format and revocation.
- [Proxmoxer Tasks Documentation](https://proxmoxer.github.io/docs/latest/tools/tasks/) — canonical UPID `blocking_status` polling implementation.
- [go-proxmox Task Management (DeepWiki)](https://deepwiki.com/luthermonson/go-proxmox/9-task-management) — `WaitFor(ctx, seconds)` and `Wait(ctx, interval, max)` patterns.
- [noVNC over API: PVEAuthCookie + VNC Ticket — Proxmox forum](https://forum.proxmox.com/threads/novnc-over-api-pveauthcookie-pve-ticket-and-tunnel-auth-vnc-ticket-how.129091/) — the canonical "how to embed noVNC" thread.
- [How to set up noVNC on a web application — Proxmox forum tutorial](https://forum.proxmox.com/threads/how-to-set-up-novnc-on-a-web-application.123701/) — vncwebsocket URL format, double-encoding gotcha.
- [petarduss/proxmox-vnc](https://github.com/petarduss/proxmox-vnc) — working reference implementation of noVNC reverse proxy with API token.
- [community-scripts/ProxmoxVE](https://github.com/community-scripts/ProxmoxVE) — successor to tteck/Proxmox; the catalog source.
- [Proxmox VE Helper-Scripts (community-scripts)](https://community-scripts.github.io/ProxmoxVE/) — public catalog UI, JSON metadata format.
- [goqite: SQLite-backed Go queue](https://github.com/maragudk/goqite) — reference for SQLite job-queue library design.
- [liteq: Persistent job queues backed by SQLite](https://github.com/khepin/liteq) — alternative with visibility timeouts.
- [A SQLite Background Job System (Jason Gorman)](https://jasongorman.uk/writing/sqlite-background-job-system/) — separate DB file to dodge lock contention, the pragmatic single-LXC pattern.
- [GoLang HTTP Client with Circuit Breaker and Retry Backoff (Medium)](https://medium.com/@diasnour0395/golang-http-client-with-circuit-breaker-and-retry-backoff-mechanism-d4def7029de8) — `sony/gobreaker` integration shape.
- [API Resilience: Circuit Breakers, Retries, Bulkheads — APIScout 2026](https://apiscout.dev/blog/api-resilience-circuit-breakers-retries-bulkheads-2026) — current best practice for retry/breaker pairing.
- [AWS Builders' Library — Fairness in multi-tenant systems](https://aws.amazon.com/builders-library/fairness-in-multi-tenant-systems/) — admission control vs rate limiting vocabulary.
- [WorkOS — Developer's guide to SaaS multi-tenant architecture](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) — tenant-scoped data and quota patterns.

---
*Architecture research for: Self-hosted Proxmox VE multi-cluster self-service GUI*
*Researched: 2026-05-14*
