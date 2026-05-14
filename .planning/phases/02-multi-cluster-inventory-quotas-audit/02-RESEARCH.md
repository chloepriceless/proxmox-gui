# Phase 2: Multi-Cluster Inventory, Quotas & Audit — Research

**Researched:** 2026-05-14
**Domain:** Proxmox read-layer (cluster connector + RRD), multi-tenant ACL enforcement via per-team privsep tokens, SQLite-based quota admission control, synchronous audit-log writer with CSV export, Svelte 5 inventory UI with tags/notes.
**Confidence:** HIGH (proxmoxer + Proxmox API + SvelteKit/shadcn-svelte stack); MEDIUM (circuit breaker library choice — multiple viable options, no clear winner); HIGH (SQLite WAL locking primitives).

---

## Summary

Phase 2 is the **read-layer plus admission gate** for the whole product: every mutative path from Phase 3 onward depends on (a) the per-cluster connector that this phase ships with cache + circuit-breaker, and (b) the quota admission primitive and the audit writer that this phase lands. There is no job queue yet (Phase 3) so the "admission" surface here is the **validation gate** — we reserve quota counters in DB, but the only "mutations" we ship are tag/notes/quota edits, which are direct PVE calls (no UPID polling needed for `PUT /nodes/.../config` for tags+description — these are sync-ish PVE writes that return immediately).

**Primary recommendation:** Use **`pybreaker` 1.4+** for the circuit breaker (mature, supports the synchronous proxmoxer call path through `asyncio.to_thread`, no async-native breaker needed because the breaker wraps the thread-pool boundary, not the awaitable). Use **`BEGIN IMMEDIATE` transactions** as the quota-admission lock primitive (SQLite WAL's only available row-level write primitive — `SELECT FOR UPDATE` does not exist in SQLite). Use **`marked` v15 + `DOMPurify` v3** for Markdown notes rendering. Use **`StreamingResponse`** + an async generator for CSV export. Cache `/cluster/resources` per-cluster with **30s TTL** in a process-local dict (no Redis needed for single-LXC scale). Build **tag and notes as PVE writes only** — no shadow DB — and pull tag autocomplete from a cached set scanned out of the resource cache.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Inventory Dashboard Shape:**
- **D-01:** List ist **per-Cluster gruppiert in collapsible Sections** (nicht flach). Eine Section pro Cluster, default expanded. Bei nur 1 registriertem Cluster: **kein Section-Header, flache Liste** — UI switcht automatisch in den Section-Mode sobald ein zweiter Cluster hinzukommt.
- **D-02:** Header-weiter **Cluster-Context-Picker** mit Default `All clusters`. Auswahl persistiert **pro Session in `localStorage`** (Key `proxmox-gui:cluster-context`). Picker filtert die Liste auf eine Section (oder zeigt alle). State NICHT in URL (URL ist für Filter-Chips reserviert, siehe D-04).
- **D-03:** **Unreachable Cluster** → roter **Pro-Cluster Banner** über der betroffenen Section ("Cluster-A unreachable since 14:23"), Section zeigt **letzten cached Stand mit `stale` Badge** an jeder Row. Andere Cluster bleiben voll funktional.
- **D-04:** **Filter-UX** = horizontale removable **Filter-Chips über der Liste** (oberhalb der Sections). State zwingend in URL params (`?status=running&tag=prod&cluster=cluster-a`). Browser-back/forward muss funktionieren; Links sind shareable + bookmarkbar.
- **D-05:** **Default-Sortierung innerhalb einer Section:** Status-priority (`running → stopped → paused → error`), sekundär alphabetisch nach Name. User-Sort persistiert NICHT.
- **D-06:** **Filter gegen Sections:** Wenn ein Filter eine Section auf 0 Treffer reduziert, **bleibt die Section sichtbar** mit Counter-Badge im Header (`Cluster-A (0 / 12)`); Body kollabiert NICHT automatisch.

**Quota UI & Admission UX:**
- **D-07:** **Persistenter Quota-Indikator** in der Sidebar/Topbar — kompakter Block `CPU 14/20 · RAM 28/40GB`, immer sichtbar. Click → Details-Drawer mit per-cluster Breakdown.
- **D-08:** **Admission-Failure beim Create:** **Live-Validation während Sizing-Eingabe**. Submit-Button **disabled** mit Tooltip-Begründung. Server validiert **defense-in-depth nochmal** (DB-Level Row-Lock per ROADMAP Phase 2 Notes).
- **D-09:** **Quota-Scope = Beides:** Aggregate (über alle Cluster) wird im Sidebar-Indikator sichtbar gemacht; **Enforcement passiert per-cluster** (PVE Pool ist per-cluster nativ). Der aggregate Wert ist die **automatisch berechnete Summe** der per-cluster Limits — Admin setzt nur per-cluster, keine separate aggregate-Cap.
- **D-10:** **Quota-Warnings:** 80% → gelb (Warning), 95% → rot (Critical). Übergang von <80% → ≥80% triggert **einmalig pro Session ein In-App-Toast**. Kein Spam.
- **D-11:** **Quota-Admin-UX:** Admin-only, integriert ins bestehende **`/admin/teams/{id}` Edit-Form** als neuer Tab/Section "Quotas". Pro Team eine Tabelle: Zeile pro Cluster, Spalten für `CPU cores`, `RAM GB`, `Disk GB`, `VM count`.
- **D-12:** **Kein Admin-Override / Burst** in Phase 2. Quota ist hard.

**Tagging + Notes System:**
- **D-13:** **Tag-Quelle = Bidirektional PVE-Sync.** Unser Tag-Feld schreibt direkt das PVE `tags` Property; PVE-WebUI-Tags erscheinen in unserer UI. **PVE ist single source of truth.** Kein separates `app_tags`-Schema. Last-write-wins.
- **D-14:** **Tag-Vocabulary = Freeform mit Autocomplete.** Freie Eingabe (PVE-konformes Format: `[a-z0-9_-]+`, lowercase, kein Whitespace — clientseitig validieren, Submit blocken bei Invalid-Tag). Autocomplete-Dropdown zeigt **bestehende Tags aus dem aktuellen Team-Scope**.
- **D-15:** **Notes-Storage = Sync zu PVE `description`.** UI rendert das als Markdown. Notes sind auch im PVE-WebUI sichtbar. Kein separates `app_notes`-Schema. Max-Länge folgt PVE-Limits (8000 chars).
- **D-16:** **Tag-/Notes-Editing-Auth:** **Jeder User mit Read-Access** auf die VM (Team-Mitglied) darf Tags + Notes editieren.

**Audit Log UX:**
- **D-17:** **Audit-Log-Sichtbarkeit:** Non-Admin User sieht **eigene Aktionen + Aktionen anderer Team-Mitglieder auf VMs/LXCs seiner Teams**. Cross-Tenant + Plattform-Aktionen **nur für Admin**. Default-View: nur eigene Aktionen, Team-Aktionen mit Toggle "Show team actions".
- **D-18:** **Per-VM Activity Log = eigener Tab auf der VM-Detail-Page** (`/inventory/{cluster_id}/{vmid}/activity`). VM-Detail-Page bekommt ein Tab-Layout. Plus eigenständige globale `/audit`-Page.
- **D-19:** **CSV-Export-Scope:** Aktuelle UI-Filter werden auf den Export angewendet; zusätzlich greift **RBAC**. Button heißt `Export filtered (X rows)`. Hard limit 50000 Rows.
- **D-20:** **Audit-Scope = Mutationen + Auth-Events.** Auditiert: jede Create/Update/Delete/Power-Action, plus Logins, Logouts, Password-Changes, PAT-Mints+Revokes, SSH-Key-Adds+Removes, Session-Revokes, Quota-Limit-Changes. **NICHT auditiert:** Reads.

### Claude's Discretion

- Exakte Filter-Chip-Component (Reuse vs neu bauen — wahrscheinlich neu).
- Skeleton-Loading-States während Section-Fetch.
- Genaue Toast-Position für Quota-Warnings (sonner mountet schon, Position folgt UI-SPEC §Toaster).
- VM-Detail-Tab-Component (Reuse oder Tabs-Primitive aus shadcn-svelte).
- CSV-Encoding (UTF-8 BOM für Excel-Kompatibilität, oder reines UTF-8). [UI-SPEC fixed this to **UTF-8 with BOM** — researcher confirms.]
- Empty-State-Illustrations für leeres Inventory / leerer Audit-Log.
- Markdown-Renderer für Notes (welche Library — markdown-it, marked, oder selbstgebaut?). [UI-SPEC fixed: **marked v15 + DOMPurify v3**.]
- Exakte Stale-Cache-TTL (ROADMAP nennt 30s; Connector-Implementation-Detail).

### Deferred Ideas (OUT OF SCOPE)

- **Admin-Override / Burst-Quota** — Phase 5 oder v2.
- **Team-Owner kann eigene Quota-Verteilung anpassen** — v2.
- **Read-Operation-Audit** — Audit-Volume + Privacy-Footprint zu groß für v1.
- **Bulk-Tag-Edit** — Phase 3 (wenn Bulk-Power-Actions kommen) oder v2.
- **Tag-Color-Customization** — v2.
- **Markdown-Editor mit Live-Preview** — v2.
- **Audit-Log-Retention** — sitzt schon in **Phase 5** (`AUDIT-06`).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TENT-01 | Admin can set per-user quotas | Phase 1 Quota model ships XOR (team_id, user_id); Phase 2 adds per-cluster columns. Admission gate (this phase) consumes them. |
| TENT-02 | Admin can set per-team quotas | Same Quota model; D-11 UI on `/admin/teams/{id}` Quotas tab. |
| TENT-03 | User sees own quota usage as progress bars in app header | D-07 QuotaIndicator component spec'd in UI-SPEC; backend exposes `GET /api/v1/me/quotas` aggregating per-cluster usage from resource cache. |
| TENT-04 | User sees live quota delta in the create wizard | Defer create-wizard UI to Phase 4; in Phase 2 expose the `POST /api/v1/quotas/preview` endpoint that returns `{would_exceed, dimensions[], current, requested, limit}` so Phase 4 can wire it. Or land the endpoint only and skip the wizard. **Recommendation: ship the endpoint, defer the UI to Phase 4.** |
| TENT-05 | System blocks creation when it would exceed quota | DB-level `BEGIN IMMEDIATE` + counter check in the admission service; admission gate is reachable from Phase 3+ create flows. In Phase 2 the gate exists and is exercised only by `POST /api/v1/quotas/preview` (no actual creates yet). |
| TENT-06 | User sees only own + team's VMs; admin sees all | RBAC at API layer (`require_resource_access(cluster_id, vmid)` dep), backed by per-team privsep token from Phase 1 + pool filter in `/cluster/resources` query. |
| CLUST-02 | Cluster-context switcher | D-02 ClusterContextPicker in Topbar; client-side `localStorage`; URL params unaffected (D-04). |
| CLUST-03 | Per-cluster reachability indicator | ClusterStatusPill (Phase 1, reused) + per-cluster health probe (this phase). |
| CLUST-04 | Unreachable → degraded read-only with banner | Circuit breaker (`pybreaker`) per connector; stale-cache fallback; D-03 banner over Section. |
| INV-01 | List of all VMs + LXCs with status indicators | `GET /api/v1/clusters/{id}/inventory` (per-cluster), aggregated client-side. Reads from resource cache. |
| INV-02 | Search/filter by name, tag, status, node | D-04 URL-param FilterChips; client-side filter on already-loaded data (cached `/cluster/resources` is < 200 KB per cluster). |
| INV-03 | Sort by name, status, node, created date | D-05 default sort `status → name`; user-sort options not persisted. |
| INV-04 | VM/LXC detail page with full info | `/inventory/{cluster_id}/{vmid}` (D-18 tabs); reads `GET /api/v1/clusters/{id}/vms/{vmid}` which hits `/nodes/{node}/qemu/{vmid}/status/current` + `/config`. |
| INV-05 | Live metrics from PVE RRD | RRDdata endpoint research below (§Standard Stack §PVE RRD Endpoints). Sparkline = hand-rolled SVG. |
| INV-06 | Multi-tag color-coded labels | D-13 PVE-native tags; D-14 freeform + autocomplete; hash-to-hue palette in UI-SPEC §TagPill. |
| INV-07 | Markdown notes field | D-15 PVE `description` sync; `marked` + `DOMPurify`. |
| INV-08 | Per-VM activity log | D-18 Activity tab is filtered AuditTable; URL-locked filter (vmid + cluster_id). |
| AUDIT-01 | Every API mutation writes audit entry | Sync writer in service layer; pattern: `await audit.write(...)` BEFORE `await db.commit()` or — when raising HTTPException — commit audit then raise (Phase 1 pattern). |
| AUDIT-02 | Config changes record before/after diff | `payload_before` + `payload_after` columns exist on `audit_log` (Phase 1 schema); writer captures JSON-serialized snapshot via Pydantic `.model_dump_json()`. |
| AUDIT-03 | Admin views full audit log with date-range + filters | `/audit` page (UI-SPEC); `GET /api/v1/audit?from=…&to=…&action=…&user=…&type=…`. |
| AUDIT-04 | User views own audit entries | Same endpoint with RBAC; non-admin scope = `actor_user_id = me OR (team_id IN my_teams AND show_team_actions=1)`. |
| AUDIT-05 | CSV export | `GET /api/v1/audit/export.csv` — `StreamingResponse`, UTF-8 + BOM, 50000-row hard limit (D-19). |
| API-05 | API enforces same quotas + tenancy as UI | Shared FastAPI dependencies: `require_admission_for_create(...)` + `require_resource_access(...)` are the same code path the UI's REST calls hit; PAT-authenticated requests get the same Principal object, same checks. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Every mutating Proxmox call returns a UPID; backend must enqueue a job, return `202`, let worker poll.** *Phase 2 carveout:* tag/notes/description writes via `PUT /nodes/{node}/qemu/{vmid}/config` return immediately (no UPID for config writes that don't restart the VM — verified against PVE API docs); these are the ONLY direct-write paths in Phase 2. Quota-limit edits write to local DB only. Everything else is read-only.
- **API tokens for backend↔PVE auth; tickets only for noVNC.** Confirmed — Phase 2 uses the **per-team privsep tokens** minted in Phase 1 (`team_cluster_tokens`), not the bootstrap token.
- **Multi-tenancy via Proxmox pools + privsep tokens, NEVER app-level filtering.** Confirmed — every read in this phase uses the team's privsep token, which is ACL-scoped to that team's pool. PVE enforces visibility; we don't filter in Python.
- **Storage/SDN references namespaced by cluster_id from row 1.** Confirmed — Phase 1 already namespaces. Phase 2 must continue: every API path is `/api/v1/clusters/{cluster_id}/...`, no bare storage IDs.
- **VMID race: not in Phase 2.** Read-only over the ID space; flag for Phase 3.
- **Audit writer is synchronous-before-return** — sync = inside the same transaction as the action; failure to write audit = failure of the request.
- **DB row-lock for admission** (`BEGIN IMMEDIATE` per SQLite semantics).
- **30s resource cache + circuit-breaker** per cluster.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Inventory list (cross-cluster) | **API / Backend** | Frontend Server (SSR initial load) | Backend owns the per-tenant pool-filtered fetch + cache; SvelteKit `+page.server.ts` pre-fetches for SSR seed. |
| VM detail page | **API / Backend** | Frontend Server (SSR) | Backend reads `/status/current` + `/config` + `/rrddata` per-cluster; SSR seeds initial render. |
| RRD metrics (sparklines) | **API / Backend** | Browser (rendering only) | Backend fetches PVE RRD; browser renders hand-rolled SVG sparklines (no chart library). |
| Tags read/write | **API / Backend** | Browser (optimistic UI) | Backend proxies to PVE `config` endpoint; browser does optimistic update with `$derived(localOverride ?? data.list)` from Phase 1. |
| Markdown notes | **Browser** (render + sanitize) | API / Backend (PVE proxy) | Markdown rendering is a UI-tier concern (marked + DOMPurify run client-side). PVE stores raw markdown; we don't pre-render. |
| Tag autocomplete | **API / Backend** | Browser (combobox) | Backend exposes `GET /api/v1/teams/{id}/tags` aggregated from resource cache; browser filters as user types. |
| Quota usage display | **API / Backend** | Browser (progress bars) | Backend computes `current` from per-cluster resource cache + per-team token's pool; browser renders QuotaIndicator + drawer. |
| Quota limit edit | **API / Backend** | Browser (form) | Edit on `/admin/teams/{id}/quotas`; backend validates "new limit ≥ current usage" or surfaces D-12 dialog. |
| Quota admission gate (preview) | **API / Backend** | — | Server-side `BEGIN IMMEDIATE` transaction; UI calls `POST /quotas/preview`. |
| Audit writer | **API / Backend** | — | Sync write in service layer before commit; no UI tier. |
| Audit reader (`/audit` page) | **API / Backend** | Frontend Server (SSR) | Backend applies RBAC + filters in SQL; SSR seeds first page. |
| Audit CSV export | **API / Backend** | — | `StreamingResponse` from FastAPI; browser triggers download. |
| Cluster context picker | **Browser** | — | Pure client-side state in `localStorage`; no backend involvement. |
| Circuit breaker per cluster | **API / Backend** | — | In-process state on `PVEConnectorRegistry`. |
| Cluster health probe | **API / Backend** | — | Background `asyncio.Task` per cluster polling `/version`. |

**Why this matters here:** Tags and notes look like they could be browser-only ("just submit a form to PVE"), but they MUST flow through our backend because (a) RBAC must verify the caller has access to that vmid in their team's pool, and (b) every tag/notes change is auditable (AUDIT-01). The browser never holds a PVE token. Same for RRD: the browser must not contact PVE directly — single-origin enforced.

---

## Standard Stack

### Core (additions for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pybreaker` | 1.4.1 | Circuit breaker per-cluster | [VERIFIED: pypi.org/project/pybreaker] Mature (>10 years), works with the synchronous proxmoxer call path. We wrap the proxmoxer call inside `asyncio.to_thread(breaker.call, fn, ...)` — the breaker is the boundary between our async layer and the thread pool. `aiobreaker` and `purgatory` are async-native but designed for awaitable functions; proxmoxer is sync, so async-native gives us no win here and adds a dep. |
| `marked` | ^15.0.0 | Markdown renderer (frontend) | [CITED: marked.js.org] Lightweight (~30KB), CommonMark + GFM, no plugins required for the allow-list we need (D-15). |
| `dompurify` | ^3.2.0 | HTML sanitizer wrapping `marked.parse()` output | [VERIFIED: npmjs.com/package/dompurify] Battle-tested XSS-safe sanitizer. Required because `marked.parse()` output is rendered via Svelte `{@html}` which inserts raw HTML. |

### Already in deps (Phase 1) — Phase 2 just uses

| Library | Version | Phase 2 Usage |
|---------|---------|---------------|
| `proxmoxer` | 2.3.0 | All PVE reads. Already wrapped in `PVEConnector.{version,...}` via `asyncio.to_thread` per Pitfall A3. |
| `sqlalchemy[asyncio]` | 2.0.49 | Quota admission transactions; audit-log writer; inventory metadata cache (if we decide to land one — see Decisions below). |
| `aiosqlite` | 0.22.1 | Same. WAL mode + `BEGIN IMMEDIATE` is the lock primitive. |
| `httpx` | 0.28.1 | Not needed in Phase 2 (proxmoxer covers all PVE calls). Reserved for Phase 4 spike work. |
| `pydantic` | 2.13.4 | All request/response schemas; `extra="forbid"` per Phase 1 pattern. |
| `structlog` | 25.5.0 | Audit log correlation_id propagation (already wired in Phase 1). |
| `@tanstack/svelte-query` | ^6.1.29 | Server-state cache for inventory (resource cache + per-detail page); auto-refetch on focus, stale-while-revalidate. |
| `bits-ui` + shadcn-svelte | 2.18.1 | `accordion`, `popover`, `command`, `progress`, `scroll-area`, `collapsible`, `tabs`, `data-table` blocks (UI-SPEC adds: scroll-area, progress, popover, command, accordion, collapsible). |
| `sonner` | (via svelte-sonner 1.0.5) | Quota warning toasts (D-10). Already mounted in Phase 1 AppShell. |
| `tailwindcss` | ^4.3.0 | Styling (Phase 1 tokens reused; no new tokens in Phase 2 per UI-SPEC). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new beyond above) | — | — | Phase 2 is a pure data-layer + UI extension; no new infra. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pybreaker` 1.4 (sync, thread-safe) | `aiobreaker` 1.1 (async-native) | `aiobreaker` is a fork of pybreaker for asyncio. Cleaner if our breaker wraps async code. **Reject:** proxmoxer is sync; the breaker can sit OUTSIDE `asyncio.to_thread` perfectly fine; pybreaker is older and has more battle-test mileage. |
| `pybreaker` | `purgatory` | More modern, supports Redis-backed shared state. **Reject:** Redis not in Phase 2 (arrives in Phase 3); single-LXC in-process state is fine. Re-evaluate if we ever need multi-worker breaker state. |
| `pybreaker` | hand-rolled state machine | ~80 LOC; full control. **Reject:** breaker semantics (half-open probe-success → close, cooldown timers, thread-safe state transitions) are subtly wrong in 4 out of 5 hand-rolls; we already use a known-good library elsewhere in the stack. |
| `marked` v15 + DOMPurify | `markdown-it` + DOMPurify | More plugin ecosystem; slightly larger bundle. **Reject:** we need a strict subset (D-15: `p, br, strong, em, h1-h4, ul, ol, li, code, pre, blockquote, a`); `marked` is leaner. |
| `marked` v15 + DOMPurify | `svelte-markdown` (component) | Svelte-native, no `{@html}`. **Reject:** runs `marked` internally anyway, doesn't sanitize; we still need DOMPurify on top; net loss. |
| `marked` v15 + DOMPurify | hand-rolled minimal-subset parser | Fewest deps. **Reject:** PVE description supports CommonMark; users writing notes in PVE WebUI expect tables, lists, code blocks; hand-rolling = inconsistency with PVE WebUI. |
| StreamingResponse | One-shot `Response(csv_bytes, …)` | Simpler code. **Reject:** D-19 hard-limit 50000 rows × ~200 bytes per row = 10MB+ in RAM; streaming is the safe default. |
| In-process resource cache (dict + lock) | `aiocache` | Adds a layer. **Reject:** overkill — a per-cluster `dict[int, ResourceCache]` with `(snapshot, fetched_at, lock)` fields and a single TTL check on read is < 50 LOC. aiocache shines when you want Redis/memcached backends; we don't. |
| Per-team privsep token (from Phase 1) | Bootstrap (root@pam) token + app-side filter | Less ACL surface. **Reject:** Pitfall 5 + Pitfall 7 — the bootstrap token has Datacenter-wide read; any bug in app-side filter = cross-tenant leak. Phase 1 already laid the privsep tokens; we must use them. |
| SQLAlchemy `BEGIN IMMEDIATE` per-quota-row | Application-level `asyncio.Lock` per `(team_id, cluster_id)` | Simpler in-Python state. **Reject:** the lock is process-local. If we ever multi-worker the API server, asyncio.Lock breaks. SQLite `BEGIN IMMEDIATE` is the durable + correct primitive that survives worker scale-out. |

**Installation:**

```bash
# Backend
cd backend
uv add pybreaker==1.4.1

# Frontend
cd frontend
pnpm add marked dompurify
pnpm add -D @types/dompurify

# shadcn-svelte block additions (per UI-SPEC §Design System)
pnpm dlx shadcn-svelte@latest add scroll-area progress popover command accordion collapsible
```

**Version verification:**

- `pybreaker` 1.4.1 — [VERIFIED: pypi.org/project/pybreaker] last release 2024-02; mature, stable; supports Python 3.8+. *Note: low release cadence is acceptable here — circuit breakers don't need monthly updates.*
- `marked` ^15.0.0 — [CITED: marked.js.org] v15 released 2024; current as of 2026-05.
- `dompurify` ^3.2.0 — [CITED: github.com/cure53/DOMPurify] v3 line is the active stable line in 2026.

---

## Architecture Patterns

### System Architecture Diagram

```
                       ┌──────────────────────────────────┐
                       │           Browser                │
                       │   SvelteKit SPA + sonner Toaster │
                       └─────────────┬────────────────────┘
                                     │ HTTPS
                       ┌─────────────▼────────────────────┐
                       │       SvelteKit Server (SSR)     │
                       │   +page.server.ts → /api/v1/*    │
                       └─────────────┬────────────────────┘
                                     │ same-origin via Caddy
                       ┌─────────────▼────────────────────┐
                       │  FastAPI app (single worker)     │
                       │                                  │
                       │  ┌────────────────────────────┐  │
                       │  │  Routes (this phase adds)  │  │
                       │  │  /inventory                │  │
                       │  │  /audit                    │  │
                       │  │  /quotas                   │  │
                       │  │  /me/quotas                │  │
                       │  │  /me/inventory (aggregated)│  │
                       │  └─────────┬──────────────────┘  │
                       │            │ depends on          │
                       │  ┌─────────▼──────────────────┐  │
                       │  │ FastAPI Dependencies       │  │
                       │  │ - require_user             │  │
                       │  │ - require_resource_access  │  │
                       │  │ - require_admission        │  │
                       │  │ - audit_writer (Depends())│  │
                       │  └─────────┬──────────────────┘  │
                       │            │                     │
                       │  ┌─────────▼──────────────────┐  │
                       │  │  Services                  │  │
                       │  │  - inventory.service       │  │
                       │  │  - audit.service           │  │
                       │  │  - quotas.service          │  │
                       │  └─────────┬──────────────────┘  │
                       │            │                     │
                       │  ┌─────────▼──────────────────┐  │
                       │  │ PVEConnectorRegistry       │  │
                       │  │ (per-cluster, lazy)        │  │
                       │  │ ┌─────────────────────┐    │  │
                       │  │ │ PVEConnector × N    │    │  │
                       │  │ │ - proxmoxer client  │    │  │
                       │  │ │ - circuit breaker   │    │  │
                       │  │ │ - 30s resource cache│    │  │
                       │  │ │ - health probe task │    │  │
                       │  │ └────┬────────────────┘    │  │
                       │  └──────┼─────────────────────┘  │
                       │         │                        │
                       │  ┌──────▼──────────┐  ┌────────┐ │
                       │  │ asyncio.to_thread│  │ SQLite │ │
                       │  │  └─►proxmoxer    │  │ (WAL)  │ │
                       │  └──────┬──────────┘  └────┬───┘ │
                       └─────────┼──────────────────┼─────┘
                                 │                  │
                                 ▼                  ▼
                  ┌──────────────────────┐  ┌──────────────┐
                  │ Proxmox VE clusters  │  │ App DB:      │
                  │ (per-team privsep    │  │ - quotas     │
                  │  token per cluster)  │  │ - audit_log  │
                  │ /cluster/resources   │  │ - clusters   │
                  │ /nodes/.../rrddata   │  │ - teams      │
                  │ /nodes/.../config    │  │ - users      │
                  │ /pools/{poolid}      │  └──────────────┘
                  └──────────────────────┘
```

### Recommended Project Structure

```
backend/app/
├── inventory/           # NEW — Phase 2
│   ├── __init__.py
│   ├── routes.py        # /api/v1/clusters/{id}/vms, /vms/{vmid}, /tags
│   ├── service.py       # list_vms, get_vm_detail, set_tags, set_notes
│   ├── schemas.py       # VMInventoryItem, VMDetail, TagsUpdate, NotesUpdate
│   └── rrd.py           # RRD timeframe constants + response normalization
├── audit/               # NEW — Phase 2
│   ├── __init__.py
│   ├── writer.py        # audit_write(...) — sync-before-return primitive
│   ├── reader.py        # list, filter, RBAC predicate
│   ├── csv.py           # StreamingResponse generator
│   ├── routes.py        # /api/v1/audit, /audit/export.csv
│   └── schemas.py       # AuditEntry, AuditFilter, AuditExport
├── quotas/              # NEW — Phase 2
│   ├── __init__.py
│   ├── admission.py     # BEGIN IMMEDIATE + check + reserve (Phase 3 will use)
│   ├── service.py       # get_team_quotas, update_team_quotas, get_my_usage
│   ├── routes.py        # /api/v1/teams/{id}/quotas, /me/quotas, /quotas/preview
│   └── schemas.py       # QuotaLimit, QuotaUsage, QuotaPreview
├── clusters/            # EXTENDED — connector gets cache + breaker
│   ├── connector.py     # ADD: list_resources(), get_vm_status(), get_vm_config(),
│   │                    #      set_vm_config(), rrddata(), pool_members()
│   │                    # ADD: pybreaker integration on every call
│   │                    # ADD: ResourceCache 30s TTL state on each connector instance
│   ├── health.py        # NEW — background task per cluster, polls /version
│   └── registry.py      # ADD: per-team-token connector resolution (was bootstrap-only)
└── core/
    └── csv.py           # NEW — small helper: csv.writer wrapping StringIO with BOM

frontend/src/
├── routes/
│   ├── inventory/                       # NEW
│   │   ├── +page.svelte                 # main list page
│   │   ├── +page.server.ts              # SSR pre-fetch
│   │   └── [cluster]/[vmid]/
│   │       ├── +page.svelte             # detail tabs container
│   │       ├── +page.server.ts
│   │       ├── overview/+page.svelte    # tab content (or use route hash)
│   │       └── activity/+page.svelte    # activity tab (filtered AuditTable)
│   ├── audit/                           # NEW
│   │   ├── +page.svelte
│   │   └── +page.server.ts
│   └── admin/teams/[id]/                # EXTENDED — adds Quotas tab
│       └── +page.svelte                 # adds tab strip + Quotas section
└── lib/
    ├── api/
    │   ├── inventory.ts                 # NEW typed client
    │   ├── audit.ts                     # NEW typed client
    │   └── quotas.ts                    # NEW typed client
    └── components/
        ├── inventory/
        │   ├── ClusterSection.svelte
        │   ├── FilterChip.svelte
        │   ├── TagPill.svelte
        │   ├── TagInput.svelte
        │   ├── MarkdownNotes.svelte
        │   ├── Sparkline.svelte         # hand-rolled SVG (UI-SPEC §Overview tab)
        │   └── ClusterContextPicker.svelte
        ├── audit/
        │   ├── AuditTable.svelte
        │   └── CsvExportButton.svelte
        └── quotas/
            ├── QuotaIndicator.svelte
            └── QuotaTab.svelte
```

### Pattern 1: Per-cluster connector with cache + circuit breaker

**What:** Each `PVEConnector` instance gets a `pybreaker.CircuitBreaker` and a `ResourceCache` (snapshot + fetched_at + lock). All read calls go through the breaker; on success, populate cache. On open-breaker, return stale cache with `stale=True` flag.

**When to use:** Every PVE call from this phase onward.

**Example:**
```python
# Source: pybreaker docs + Phase 1 connector.py
# backend/app/clusters/connector.py (extended)

import asyncio
import time
import pybreaker
from dataclasses import dataclass, field
from typing import Any

@dataclass
class ResourceCache:
    snapshot: list[dict] | None = None
    fetched_at: float = 0.0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    ttl: float = 30.0

    @property
    def is_fresh(self) -> bool:
        return self.snapshot is not None and (time.monotonic() - self.fetched_at) < self.ttl

    @property
    def is_stale(self) -> bool:
        return self.snapshot is not None and not self.is_fresh

class PVEConnector:
    def __init__(self, ...):
        # ... existing init ...
        self._breaker = pybreaker.CircuitBreaker(
            fail_max=3,              # 3 consecutive failures → open
            reset_timeout=30,        # 30s cooldown before half-open probe
            exclude=[PVEAuthError],  # auth errors aren't "transient" — don't trip
            name=f"pve-{host}",
        )
        self._resource_cache = ResourceCache()

    async def _call_with_breaker(self, fn, *args, **kwargs):
        # The breaker wraps the sync call; we sit OUTSIDE asyncio.to_thread.
        # pybreaker.call is sync — it raises CircuitBreakerError when open.
        def _invoke():
            return self._breaker.call(fn, *args, **kwargs)
        try:
            return await asyncio.to_thread(_invoke)
        except pybreaker.CircuitBreakerError:
            raise PVEUnreachable("breaker open") from None

    async def list_resources(self, *, force_refresh: bool = False) -> tuple[list[dict], bool]:
        """Returns (snapshot, is_stale). Uses 30s cache; on breaker-open returns stale."""
        cache = self._resource_cache
        async with cache.lock:
            if cache.is_fresh and not force_refresh:
                return cache.snapshot, False
            try:
                snap = await self._call_with_breaker(
                    self._client.cluster.resources.get, type="vm"
                )
                # also fetch lxc
                lxcs = await self._call_with_breaker(
                    self._client.cluster.resources.get, type="lxc"
                )
                cache.snapshot = snap + lxcs
                cache.fetched_at = time.monotonic()
                return cache.snapshot, False
            except PVEUnreachable:
                if cache.snapshot is not None:
                    return cache.snapshot, True  # degraded read
                raise  # never-seen cluster + unreachable → hard fail
```

**Notes:**
- `exclude=[PVEAuthError]` is critical — a bad token must NOT trip the breaker; that's a config issue, not a transient failure.
- `asyncio.Lock` on cache prevents N concurrent requests all triggering N PVE fetches; only one fetch per refresh window.
- `force_refresh=True` is used by the post-write invalidation path (after we set tags/notes, refresh that cluster's cache).

### Pattern 2: Per-cluster health probe

**What:** On `Registry.get()` first call for a cluster, spawn a background `asyncio.Task` that polls `GET /version` every 15s and updates `connector.last_seen_healthy`. UI surfaces this via `ClusterStatusPill`.

**When to use:** Always, for D-03 unreachable-cluster banner timing ("unreachable since 14:23").

**Example:**
```python
# Source: ARCHITECTURE.md Pattern 5
# backend/app/clusters/health.py

import asyncio
import time
from app.clusters.connector import PVEConnector
from app.clusters.errors import PVEUnreachable, PVEAuthError

async def health_probe_loop(connector: PVEConnector, *, interval: float = 15.0) -> None:
    while True:
        try:
            await connector.version()
            connector.last_seen_healthy = time.monotonic()
            connector.last_error = None
        except (PVEUnreachable, PVEAuthError) as exc:
            connector.last_error = str(exc)
        await asyncio.sleep(interval)
```

The probe is fire-and-forget; the registry owns the Task handle and cancels on `clear_all()` / app shutdown.

### Pattern 3: Quota admission with BEGIN IMMEDIATE

**What:** SQLite WAL has NO `SELECT FOR UPDATE`. The only available primitive is `BEGIN IMMEDIATE` which acquires the database-wide write lock immediately (not per-row, but for the duration of the transaction the writer is exclusive). Combined with `PRAGMA busy_timeout=5000` (set in Phase 1), this gives us TOCTOU-safe admission.

**When to use:** Every create-resource path (lands in full force in Phase 3). Phase 2 lands the primitive + uses it for `POST /api/v1/quotas/preview`.

**Example:**
```python
# Source: sqlite.org/forum + SQLAlchemy 2.0 docs
# backend/app/quotas/admission.py

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

async def check_and_reserve(
    db: AsyncSession,
    *,
    team_id: int,
    cluster_id: int,
    requested: ResourceFootprint,  # cpu, ram_bytes, disk_bytes, count
) -> AdmissionResult:
    """Atomic check + reserve under BEGIN IMMEDIATE.

    SQLite WAL has no row-level locks. BEGIN IMMEDIATE acquires the database
    write lock for the duration; concurrent quota checks queue behind it
    (busy_timeout=5s from Phase 1).
    """
    # SQLAlchemy 2.0 async: open the transaction with isolation level
    # The connect-time event listener (Phase 1) issues BEGIN IMMEDIATE for
    # write transactions; we explicitly mark this one as write by issuing
    # the lock-acquiring statement first.
    await db.execute(text("BEGIN IMMEDIATE"))
    try:
        # 1. SELECT current quota row for (team_id, cluster_id)
        # 2. SELECT current usage from local cache (or PVE pool resources)
        # 3. Compute proposed = current + requested
        # 4. If proposed > limit on any dimension → return Denied
        # 5. Else (Phase 3 only): INSERT into reservations table consuming counter
        # ... business logic ...
        await db.commit()
        return AdmissionResult.granted()
    except Exception:
        await db.rollback()
        raise
```

**SQLAlchemy 2.0 wiring:** Phase 1's `db.py` should already have `PRAGMA busy_timeout=5000` set per-connection via a `connect` event listener; if not, add it in this phase.

```python
# In backend/app/core/db.py (verify exists; if not, add)
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_sqlite_pragmas(dbapi_conn, connection_record):
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()
```

### Pattern 4: Synchronous audit writer (Phase 1 pattern continued)

**What:** Audit writes happen INSIDE the request transaction, BEFORE returning. If audit fails, the request fails. This matches Phase 1's `revoke_user_sessions` pattern.

**When to use:** Every mutating endpoint (D-20 scope).

**Example:**
```python
# Source: Phase 1 patterns (01-05 auth-subsystem-SUMMARY.md)
# backend/app/audit/writer.py

async def audit_write(
    db: AsyncSession,
    *,
    actor_user_id: int | None,
    actor_pat_id: int | None = None,
    team_id: int | None,
    cluster_id: int | None,
    action: str,                # "vm.tag.add" | "auth.login" | ...
    target_type: str | None,    # "vm" | "lxc" | "team" | ...
    target_id: str | None,
    result: str,                # "success" | "failure"
    source_ip: str | None,
    correlation_id: str | None,
    payload_before: dict | None = None,
    payload_after: dict | None = None,
    error: str | None = None,
) -> None:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        actor_pat_id=actor_pat_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result,
        source_ip=source_ip,
        correlation_id=correlation_id,
        payload_before=json.dumps(payload_before) if payload_before else None,
        payload_after=json.dumps(payload_after) if payload_after else None,
        error=error,
    )
    db.add(entry)
    await db.flush()  # NOT commit — caller owns the tx
```

**FastAPI integration:** the dependency that resolves the audit-writer also injects `source_ip` from `request.client.host` (X-Forwarded-For trust list applied in Phase 1 review-fix).

### Pattern 5: PVE description as Markdown notes (D-15)

**What:** Notes are stored in PVE's `description` property. We render via `marked.parse` + `DOMPurify.sanitize`. Storage path: `PUT /nodes/{node}/qemu/{vmid}/config` with `description=...`.

**When to use:** INV-07 / Notes card on VM detail page.

**Example (frontend):**
```typescript
// Source: marked.js.org + DOMPurify docs
// frontend/src/lib/utils/markdown.ts

import { marked } from 'marked';
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4',
                     'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'a'];
const ALLOWED_ATTR = ['href', 'title'];

export function renderMarkdown(raw: string): string {
  const html = marked.parse(raw, { breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
```

**Backend write:**
```python
# Source: PVE API forum verified
# backend/app/inventory/service.py

async def set_notes(
    db: AsyncSession,
    connector: PVEConnector,
    *,
    node: str,
    vmid: int,
    description: str,
    is_lxc: bool,
) -> None:
    if len(description) > 8000:  # D-15 cap
        raise HTTPException(422, "description max 8000 chars")
    fn = (connector._client.nodes(node).lxc(vmid).config.put if is_lxc
          else connector._client.nodes(node).qemu(vmid).config.put)
    await connector._call_with_breaker(fn, description=description)
    # invalidate the resource cache for this cluster so next read shows new state
    connector._resource_cache.snapshot = None
```

### Pattern 6: Tags as PVE-native semicolon-separated string (D-13)

**What:** PVE stores tags as a single string with `;` separator (also accepts `,` or space on write). We parse into list client-side, write joined-by-semicolon server-side.

**When to use:** INV-06 tags.

**Example:**
```python
# backend/app/inventory/service.py

PVE_TAG_RE = re.compile(r"^[a-z0-9_][a-z0-9_\-+.]*$")  # PVE's regex (per JSONSchema.pm)

async def set_tags(
    db: AsyncSession,
    connector: PVEConnector,
    *,
    node: str,
    vmid: int,
    tags: list[str],
    is_lxc: bool,
) -> None:
    # Defense-in-depth: validate every tag matches PVE's regex.
    # Frontend already validates (D-14), but never trust the client.
    for tag in tags:
        if not PVE_TAG_RE.match(tag):
            raise HTTPException(422, f"invalid tag format: {tag!r}")
    joined = ";".join(sorted(set(tags)))  # dedup + stable order
    fn = (connector._client.nodes(node).lxc(vmid).config.put if is_lxc
          else connector._client.nodes(node).qemu(vmid).config.put)
    await connector._call_with_breaker(fn, tags=joined)
```

### Pattern 7: CSV export via StreamingResponse

**What:** Generator emits CSV row-by-row; FastAPI `StreamingResponse` flushes to client.

**When to use:** `/audit/export.csv` only (50000-row hard cap).

**Example:**
```python
# Source: medium.com/@connect.hashblock + FastAPI docs
# backend/app/audit/csv.py

import csv
import io
from typing import AsyncIterator

EXPORT_LIMIT = 50000
BOM = "\ufeff"  # UTF-8 BOM for Excel (the actual U+FEFF byte sequence)

async def audit_csv_stream(
    db: AsyncSession,
    filters: AuditFilter,
    *,
    principal: Principal,
) -> AsyncIterator[bytes]:
    yield BOM.encode("utf-8")
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["timestamp", "actor", "team", "cluster", "action",
                     "target", "result", "source_ip"])
    yield buf.getvalue().encode("utf-8")
    buf.seek(0); buf.truncate()
    # Stream rows. SQLAlchemy 2.0 async streaming requires .stream() or
    # cursor-batched fetches. Use yield_per(500) equivalent.
    query = build_audit_query(filters, principal).limit(EXPORT_LIMIT)
    async for row in db.stream_scalars(query):
        writer.writerow([row.occurred_at.isoformat(), row.actor_username,
                         row.team_name, row.cluster_name, row.action,
                         f"{row.target_type}/{row.target_id}", row.result,
                         row.source_ip])
        yield buf.getvalue().encode("utf-8")
        buf.seek(0); buf.truncate()

# In routes:
@router.get("/audit/export.csv")
async def export_csv(...):
    return StreamingResponse(
        audit_csv_stream(db, filters, principal=principal),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="audit-{date.today().isoformat()}.csv"',
        },
    )
```

### Pattern 8: TanStack Query in SvelteKit for inventory (server cache)

**What:** Use `@tanstack/svelte-query` (already in deps) with `initialData` seeded by `+page.server.ts` for SSR + SWR refetch.

**When to use:** Every list/detail page in Phase 2.

**Example:**
```typescript
// Source: tanstack.com/query/v4/docs/svelte/ssr (current pattern)
// frontend/src/routes/inventory/+page.svelte
import { createQuery } from '@tanstack/svelte-query';
import { api } from '$lib/api';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const inventoryQuery = createQuery({
  queryKey: ['inventory', 'all'],
  queryFn: () => api.inventory.listAll(),
  initialData: data.inventory,
  staleTime: 30_000, // matches backend cache TTL
  refetchOnWindowFocus: true,
});
```

### Anti-Patterns to Avoid

- **Filter-in-Python for tenancy.** [Pitfall 5] Use the per-team privsep token; PVE enforces. Never `for vm in all_vms: if vm.pool == team: ...`.
- **In-memory quota counters.** [Pitfall 6] Counters drift on partial failures. Always recompute from resource cache (which is sourced from PVE).
- **Hand-rolled circuit breaker.** State machine bugs (half-open success counter, cooldown race) are subtle; use `pybreaker`.
- **`SELECT FOR UPDATE` in SQLite.** Does not exist. Use `BEGIN IMMEDIATE`.
- **Polling PVE on every UI render.** Use the 30s cache; if the user clicks "Refresh", call with `force_refresh=True`.
- **Cross-origin direct PVE fetches from browser.** Browser never knows PVE token; everything goes through our `/api/v1/*`.
- **Long-lived `dict` of all VMs across all clusters.** Keep cache PER-cluster; aggregate only on read. Otherwise cluster-A unreachable evicts cluster-B's data.
- **Audit writes via `BackgroundTasks`.** AUDIT-01 requires synchronous-before-return. Background tasks can fail silently after response.
- **`marked.parse` without DOMPurify.** XSS. `{@html}` in Svelte does no sanitization.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circuit breaker state machine | Hand-rolled fail-counter + open/half-open/closed transitions | `pybreaker` | Subtle bugs in half-open probe success counting; thread-safe state transitions; not worth re-doing. |
| Markdown rendering | Custom CommonMark parser | `marked` | CommonMark spec is 80 pages of edge cases. |
| HTML sanitization | String-replace `<script>` etc. | `DOMPurify` | XSS bypasses for hand-rolled sanitizers are a cottage industry. |
| CSV writer | f-string formatting | `csv.writer` (stdlib) | Quoting + escaping (commas/quotes/newlines in values) bites every hand-roll. |
| Tag-string parsing | `split(";")` only | Accept `;`/`,`/space (PVE behavior) on READ; write canonical `;` | PVE accepts multiple separators; we should too. |
| Resource cache | Global module dict + manual TTL | Per-connector `ResourceCache` dataclass with `asyncio.Lock` | Multi-cluster needs per-cluster scoping; manual locks have race traps. |
| Quota race protection | App-level `asyncio.Lock` per team | SQLite `BEGIN IMMEDIATE` | App locks die with the worker; SQLite locks survive scale-out. |
| RRD time-series aggregation | Average multiple rows in Python | PVE's `cf=AVERAGE` server-side parameter | PVE already aggregates; we just pick a timeframe. |
| Audit-log filtering UI | Multiple per-filter components | shadcn-svelte `data-table` + URL-param FilterChips | Phase 1 contract; reuse. |
| Markdown editor | Live-preview WYSIWYG | Plain `<Textarea>` + post-save render | D-15 deferred; v2. |

**Key insight:** Phase 2 is **glue code** between (a) PVE's read API, (b) our existing Phase 1 ORM, and (c) shadcn-svelte primitives. The interesting custom work is the connector's cache/breaker integration and the audit writer's RBAC predicate. Everything else is well-trodden ground; resist the urge to "improve" the standard library choices.

---

## Common Pitfalls

### Pitfall 1: Cluster vs node endpoint mismatch (PITFALLS.md #7)

**What goes wrong:** `GET /nodes/{wrong-node}/qemu/{vmid}/status/current` for a VM that's on a different node. PVE proxies to the right node — but if the entry node is down, the request fails even though the VM is fine.

**Why it happens:** `/cluster/resources` returns each VM with a `node` field; that's the authoritative location. Code that hard-codes a node or picks the entry node from the cluster URL gets this wrong.

**How to avoid:**
1. The resource cache's snapshot is the source of truth for `vmid → node` mapping. Every detail-page fetch must `(vmid, node) = lookup_from_cache(cluster_id, vmid)` first.
2. If the cache is missing the vmid (just-created elsewhere), fall back to `GET /cluster/resources?type=vm` once, then retry.
3. Phase 2 has no migrations; the mapping is stable per refresh.

**Warning signs:** Detail page works in single-node dev, fails on a clustered PVE.

### Pitfall 2: PVE `tags` write replaces, doesn't append

**What goes wrong:** User adds a tag "prod" via our UI; PVE-WebUI user adds "db" in parallel. Our write sends `tags=prod`; PVE drops "db". Last-write-wins, but the loser is invisible.

**Why it happens:** `PUT /config` replaces; there's no `tags+=` operation.

**How to avoid:**
1. D-13 already accepts last-write-wins explicitly.
2. UI flow: on edit-open, ALWAYS re-fetch the latest tags from PVE (`/config` direct, bypassing cache). On submit, send the union of current + user's intent. On read-back, refresh.
3. Race window is unavoidable but small (~ user thinking time); accept it.

### Pitfall 3: PVE tag regex includes characters our UI rejects

**What goes wrong:** [VERIFIED: github.com/proxmox/pve-common JSONSchema.pm line 1619] PVE allows `[a-z0-9_\-+.]` (lowercase + digits + underscore + hyphen + PLUS + PERIOD), but D-14 restricts to `[a-z0-9_-]`. A PVE-WebUI-created tag like `pve-8.1` or `c++` would fail our edit-form validation.

**Why it happens:** D-14's regex is a deliberate subset (UX simplicity); PVE's regex is broader.

**How to avoid:**
1. **Display:** show any PVE tag as-is (our reader does NOT filter).
2. **Edit:** D-14's stricter regex applies only to NEW user input. Existing tags are shown in TagInput but **only validated against PVE's regex** on edit; the displayed value is what the user must type.
3. Document this in the TagInput component: "Tags can contain a-z, 0-9, hyphen, underscore. Existing tags from PVE may include period or plus."
4. **Alternative:** Loosen D-14 to match PVE's regex exactly. This is a CONTEXT-level decision; flag for discuss-phase if disagree.

**Warning signs:** Tag created in PVE shows in our UI but is "invalid" on re-edit.

### Pitfall 4: `/cluster/resources` returns null/missing fields for stopped VMs

**What goes wrong:** Cards on the detail page show `--` for CPU/RAM usage because PVE returns `cpu=0`, `mem=0`, `netin/netout=missing` for stopped guests.

**Why it happens:** RRD data only exists when the guest has been running; status fields are zero for stopped.

**How to avoid:**
1. Detect status === 'stopped' on read; suppress numeric usage panels, show "Not running" badge in their place.
2. For sparklines: if RRD response has all-zero or all-NaN values, render "No data" empty state (UI-SPEC §Metrics card has this).

### Pitfall 5: SQLite `BEGIN IMMEDIATE` can still return `database is locked` despite `busy_timeout`

**What goes wrong:** [CITED: sqlite.org/forum/info/f75c87afed] Under extreme contention or interleaved tx, `BEGIN IMMEDIATE` returns SQLITE_BUSY even with timeout set.

**Why it happens:** WAL has no EXCLUSIVE lock state; IMMEDIATE waits for the existing writer to commit. If a long write tx exists and busy_timeout fires before it commits, we get the error.

**How to avoid:**
1. Keep write transactions SHORT (< 100ms). Quota admission is just a SELECT + math + COMMIT.
2. Catch `OperationalError` with `database is locked`; map to 503 with "transient — retry"; the client retries once.
3. Phase 2 single worker (uvicorn) + Phase 1's busy_timeout=5s is enough for v1; doc the multi-worker reconsideration in Phase 5.

### Pitfall 6: Audit writer fails silently if caller forgets to flush

**What goes wrong:** Service function calls `audit_write(...)` but raises before `db.commit()`. The audit entry is rolled back along with the action.

**Why it happens:** Phase 1's `audit_write` adds to session but doesn't commit (committer = caller).

**How to avoid:**
1. **Pattern (Phase 1 carryover):** if the request must fail BUT keep the audit record (e.g. failed login attempt), commit the audit row BEFORE raising. Phase 1 already does this for `consume_refresh` chain-revoke.
2. Document the pattern in the audit module docstring with a sample.
3. Mutating service tests must assert `audit_log` row exists after both success AND failure paths.

### Pitfall 7: TanStack Query auto-refetch on focus thrashes a 30s cache

**What goes wrong:** User clicks away and back; SvelteKit Query refetches; backend serves cached data; user sees "instant" but actually got stale data they didn't ask for.

**Why it happens:** Default `refetchOnWindowFocus: true`.

**How to avoid:**
1. Set `staleTime: 30_000` on inventory queries to match backend TTL — Query trusts the data is fresh, no refetch on focus.
2. For RRD: `staleTime: 60_000` (slower-changing).
3. Provide a manual "Refresh" button that calls `queryClient.invalidateQueries(['inventory'])` + backend `force_refresh=True`.

### Pitfall 8: `team_cluster_tokens` exists for personal-team-only users — what's the privsep token for them?

**What goes wrong:** Phase 1 mints a personal team per user. Phase 1 `bootstrap_tenant_on_clusters` is called on team-create AND on cluster-add. But: does the personal team get a privsep token on every cluster? If not, the user with no shared-team membership has no pool to filter against.

**Why it happens:** Phase 1's tenant-bootstrap covers any team; personal team is just a team with `personal=True`. Verify this is happening.

**How to avoid:**
1. **VERIFY at plan-start:** read `backend/app/teams/bootstrap.py` (Plan 01-06) — confirm `auto_bootstrap=True` is invoked for personal teams when admin adds a cluster. If not, this is a Phase 2 blocker.
2. If personal teams don't get tokens by default: the connector resolution path `for_team(team_id, cluster_id)` must fall back to admin-only access OR auto-mint on first use.
3. Document the decision in CONTEXT for the planner.

### Pitfall 9: PAT-authenticated requests skip session middleware but must still get the same `Principal` for ACL

**What goes wrong:** Two auth paths (cookie session, PAT bearer) resolve differently; one of them forgets to load team memberships → ACL check skips → cross-tenant access.

**How to avoid:**
1. `require_user` dependency must always return a `Principal` with `.team_ids` populated, regardless of auth path. Phase 1's `get_current_principal` should already do this — verify.
2. ACL helpers (`require_resource_access`) MUST operate on `Principal`, never on raw cookie or token.
3. Integration test: every new Phase 2 endpoint must have both cookie-auth AND PAT-auth tests asserting same RBAC outcome.

### Pitfall 10: `marked` rendering newlines vs. CommonMark hard-breaks

**What goes wrong:** User writes notes with single line-breaks (no double-newline); CommonMark renders them as continuation of the same paragraph. Looks "broken".

**How to avoid:**
1. `marked.parse(raw, { breaks: true })` — turns single `\n` into `<br>`. Matches user expectation in a Notes-like field.
2. `gfm: true` — tables and task-lists, common in markdown notes.
3. DOMPurify config does NOT allow `<table>` per UI-SPEC's allow-list. Decision: tables strip silently. Surface in UI tooltip on render-mode: "Tables and other formatting not supported."

### Pitfall 11: Audit RBAC predicate has 3 nested cases and one is easy to forget

**What goes wrong:** D-17 says non-admin sees own + team's actions. Implementing as `actor_user_id = me OR team_id IN my_teams` is wrong: the latter clause leaks any team-scoped action even if the actor is OUTSIDE the team (e.g. admin acted on a team's VM).

**How to avoid:**
1. Predicate: `(actor_user_id = me) OR (team_id IN my_teams AND result IN ('success','failure'))` — actor doesn't matter as long as the action was on the user's team scope.
2. Show-team-actions toggle (D-17) gates the second clause; default OFF.
3. Admin: no predicate.
4. Unit test: 4 fixtures (me, my-team-member, other-team-member, admin) acting on 3 targets (my VM, my-team VM, other-team VM) = 12 cases; assert visibility matrix.

### Pitfall 12: Quota-on-disable race

**What goes wrong:** Admin lowers RAM limit from 64 to 32 GB; team currently at 28 GB usage. Save succeeds. Then a tag-edit pushes a config update that PVE associates with the team's pool, triggering a recompute — and a partially-completed-mid-edit creates a phantom "over quota" state for the user.

**How to avoid:**
1. Quota write is a single DB transaction; no PVE round-trip on quota-edit.
2. "Over-quota" state is a derived view, not a persisted flag. Display is `current > limit`.
3. D-12 (no override): lowering below current usage triggers the warning dialog with no override; admin can still "Lower limit anyway" (UI-SPEC) — that's intentional: blocks new creates, leaves existing alone.

---

## Runtime State Inventory

*Skipped — Phase 2 is greenfield (adds new code), not a rename/refactor/migration.*

---

## Code Examples

### Common Operation 1: List inventory across all clusters for a user

```python
# Source: hand-written for this phase; pattern aligns with ARCHITECTURE.md Pattern 5+7
# backend/app/inventory/service.py

async def list_inventory_for_principal(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    principal: Principal,
) -> list[ClusterInventory]:
    """Returns per-cluster inventory with per-cluster freshness flag.

    For each cluster the principal has access to:
    - Acquire the per-team privsep connector (NOT bootstrap).
    - Call list_resources() — hits 30s cache, falls back to stale on breaker-open.
    - Filter by the team's pool membership (PVE already filters via the
      token's ACL, but defense-in-depth in case Phase 1 mints the token
      with broader-than-pool perms).
    """
    teams = principal.team_ids
    clusters = await get_clusters_for_teams(db, team_ids=teams)
    results = []
    for cluster in clusters:
        connector = await registry.get_for_team(
            cluster_id=cluster.id,
            team_id=principal.primary_team_id,  # or whichever team owns the view
            db=db,
        )
        snapshot, is_stale = await connector.list_resources()
        results.append(ClusterInventory(
            cluster_id=cluster.id,
            cluster_name=cluster.name,
            cluster_status=connector.status,  # 'ok' | 'stale' | 'failed'
            is_stale=is_stale,
            items=[VMInventoryItem.from_pve(item) for item in snapshot],
        ))
    return results
```

### Common Operation 2: Fetch RRD metrics for a VM

```python
# Source: pve.proxmox.com/pve-docs/api-viewer (verified by Proxmox API)
# backend/app/inventory/rrd.py

VALID_TIMEFRAMES = {"hour", "day", "week", "month", "year"}
VALID_CF = {"AVERAGE", "MAX"}

async def get_rrd_metrics(
    connector: PVEConnector,
    *,
    node: str,
    vmid: int,
    is_lxc: bool,
    timeframe: str = "hour",
    cf: str = "AVERAGE",
) -> list[RRDSample]:
    if timeframe not in VALID_TIMEFRAMES:
        raise HTTPException(422, f"timeframe must be one of {VALID_TIMEFRAMES}")
    if cf not in VALID_CF:
        raise HTTPException(422, f"cf must be one of {VALID_CF}")
    fn = (connector._client.nodes(node).lxc(vmid).rrddata.get if is_lxc
          else connector._client.nodes(node).qemu(vmid).rrddata.get)
    raw = await connector._call_with_breaker(fn, timeframe=timeframe, cf=cf)
    # raw is a list of dicts; each has 'time' (unix epoch) + metric fields
    # (cpu, mem, maxmem, disk, maxdisk, netin, netout, diskread, diskwrite)
    return [RRDSample.from_pve(row) for row in raw]
```

### Common Operation 3: Audit-write inside a service function

```python
# Source: Phase 1 patterns + new Phase 2 audit module
# backend/app/inventory/service.py

async def update_vm_tags(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    principal: Principal,
    cluster_id: int,
    vmid: int,
    new_tags: list[str],
    source_ip: str | None,
    correlation_id: str | None,
) -> None:
    # 1. RBAC + lookup
    vm, team_id, connector = await resolve_vm_for_principal(
        db, registry, principal=principal, cluster_id=cluster_id, vmid=vmid,
    )
    old_tags = parse_pve_tags(vm.config.get("tags", ""))

    # 2. Validate
    for tag in new_tags:
        if not PVE_TAG_RE.match(tag):
            raise HTTPException(422, detail=f"invalid tag: {tag!r}")

    # 3. PVE write
    try:
        await set_vm_tags_via_pve(connector, vm.node, vmid, new_tags, is_lxc=vm.is_lxc)
    except PVEUnreachable as exc:
        await audit_write(
            db, actor_user_id=principal.user_id, actor_pat_id=principal.pat_id,
            team_id=team_id, cluster_id=cluster_id,
            action="vm.tag.update", target_type="vm" if not vm.is_lxc else "lxc",
            target_id=str(vmid), result="failure", source_ip=source_ip,
            correlation_id=correlation_id, payload_before={"tags": old_tags},
            payload_after={"tags": new_tags}, error=str(exc),
        )
        await db.commit()
        raise HTTPException(503, "cluster unreachable") from exc

    # 4. Audit (success)
    await audit_write(
        db, actor_user_id=principal.user_id, actor_pat_id=principal.pat_id,
        team_id=team_id, cluster_id=cluster_id,
        action="vm.tag.update", target_type="vm" if not vm.is_lxc else "lxc",
        target_id=str(vmid), result="success", source_ip=source_ip,
        correlation_id=correlation_id, payload_before={"tags": old_tags},
        payload_after={"tags": new_tags},
    )

    # 5. Commit audit + invalidate cache
    await db.commit()
    connector._resource_cache.snapshot = None
```

### Common Operation 4: Quota usage view

```python
# Source: hand-written for this phase
# backend/app/quotas/service.py

async def get_team_usage(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    team_id: int,
    cluster_id: int,
) -> QuotaUsage:
    """Compute current usage by querying the team's pool members.

    The privsep token's ACL ensures we only see pool members.
    """
    connector = await registry.get_for_team(
        cluster_id=cluster_id, team_id=team_id, db=db,
    )
    snapshot, _ = await connector.list_resources()
    # snapshot is already filtered to the team's pool by token ACL
    usage = QuotaUsage(cpu=0, ram_bytes=0, disk_bytes=0, vm_count=0, lxc_count=0)
    for item in snapshot:
        usage.cpu += item.get("maxcpu", 0)
        usage.ram_bytes += item.get("maxmem", 0)
        usage.disk_bytes += item.get("maxdisk", 0)
        if item["type"] == "qemu":
            usage.vm_count += 1
        elif item["type"] == "lxc":
            usage.lxc_count += 1
    return usage
```

### Common Operation 5: Frontend optimistic tag-add

```svelte
<!-- Source: Phase 1 SUMMARY pattern (Plan 01-09 $derived(localOverride)) -->
<!-- frontend/src/lib/components/inventory/TagInput.svelte -->
<script lang="ts">
  import { invalidate } from '$app/navigation';
  import { api } from '$lib/api';
  import { toast } from 'svelte-sonner';

  let { vmid, clusterId, currentTags } = $props<{
    vmid: number; clusterId: number; currentTags: string[];
  }>();
  let localOverride = $state<string[] | null>(null);
  let displayTags = $derived(localOverride ?? currentTags);

  async function addTag(newTag: string) {
    if (!/^[a-z0-9_-]+$/.test(newTag)) {
      toast.error("Tags use lowercase letters, digits, hyphens, and underscores only.");
      return;
    }
    const next = [...displayTags, newTag];
    localOverride = next; // optimistic
    try {
      await api.inventory.setTags(clusterId, vmid, next);
      await invalidate(`/api/v1/clusters/${clusterId}/vms/${vmid}`);
      localOverride = null; // server is now authoritative
    } catch (err) {
      localOverride = null; // rollback
      toast.error("Couldn't add tag. Try again.");
    }
  }
</script>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `BackgroundTasks` for audit writes | Synchronous-before-return audit write | n/a (we never adopted) | Audit is part of request success criteria. |
| Per-app super-token + filter-in-Python | Per-team privsep tokens per cluster | Phase 1 (locked in 01-06) | Multi-tenant safety. |
| `SELECT FOR UPDATE` | `BEGIN IMMEDIATE` (SQLite) | SQLite docs (always was this way) | We just need to spell the primitive correctly. |
| Markdown editor with live-preview | Edit-mode textarea + render-mode display | D-15 deferred WYSIWYG | Simpler; v2 polish if asked. |
| Chart library (recharts/uplot) | Hand-rolled SVG sparkline | UI-SPEC §Metrics card | Bundle weight; ~60 path nodes per sparkline is trivial. |

**Deprecated/outdated:**

- `python-jose`: don't use for any token work (already covered Phase 1; mentioned here for Phase 2 audit signing if we ever sign audit rows — we don't).
- `passlib`: same — Phase 1 chose `pwdlib`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Personal teams get privsep tokens on every cluster via Phase 1 auto-bootstrap | Pitfall 8 | Inventory shows nothing for users with no shared team. **Mitigation:** verify in plan-start; fall back to bootstrap-token only if missing. |
| A2 | `PUT /nodes/{node}/qemu/{vmid}/config` with `tags=` or `description=` returns synchronously (no UPID) | Project Constraints | If wrong, tag/notes edits must enqueue jobs (Phase 3-style). **Mitigation:** verify with a smoke test before final plan — quick `proxmoxer` call against the test cluster. |
| A3 | `pybreaker` 1.4 is thread-safe for the `asyncio.to_thread` boundary we use | Standard Stack | Race-conditioned breaker state → false-open or never-open. **Mitigation:** pybreaker docs claim thread-safety; unit test concurrent calls. |
| A4 | The 30s resource cache TTL is appropriate (not 5s, not 60s) | Architecture | Too short → PVE load; too long → user perceives staleness. **Mitigation:** ROADMAP says 30s; UI offers manual refresh button. |
| A5 | PVE `description` field accepts CommonMark/GFM markdown that PVE WebUI renders | Pattern 5 | PVE WebUI may use a stricter renderer; what we render in our UI may not match. **Mitigation:** D-15 accepts inconsistency; verify with a hello-world note. |
| A6 | 50000-row CSV export limit fits in memory of a generator (StreamingResponse) | Pattern 7 | Memory blowup if rows are unexpectedly large. **Mitigation:** D-19 + StreamingResponse + chunked yields keep peak RAM bounded. |
| A7 | The audit-log table will not need partitioning at v1 scale | Performance Traps | Slow page on large logs. **Mitigation:** Phase 1 already has `(team_id, occurred_at)` + `(actor_user_id, occurred_at)` indexes. Phase 5 owns retention. |
| A8 | `result` enum in audit_log accepts `"success"`, `"failure"`, `"pending"` and Phase 2 only writes the first two | Audit writer | n/a — schema says String(32), no enum constraint. |
| A9 | `team_cluster_tokens.userid` ACL `PVEVMUser` is sufficient for read-only inventory + tag-write + description-write | Multi-tenancy | If `PVEVMUser` lacks `VM.Config.Description` or `VM.Config.Misc`, tag/notes writes 403. **Mitigation:** verify against PVE 8.x ACL matrix; document the role and what it grants. (Per pveum docs: `PVEVMUser` grants `VM.Audit, VM.Config.{CDROM,Cloudinit,CPU,Disk,HWType,Memory,Network,Options}, VM.Console, VM.Backup, VM.PowerMgmt, Permissions.Modify` — `VM.Config.Options` covers tags + description.) [VERIFIED: pve.proxmox.com/pve-docs/pveum.1.html role table] |
| A10 | `marked` v15 + DOMPurify v3 combo has no known incompatibility | Stack | Sanitization bypass or rendering bug. **Mitigation:** widely deployed combo across the JS ecosystem; XSS-test fixtures in `frontend/tests/markdown.spec.ts`. |

**If empty:** N/A — 10 assumptions are documented. A1, A2, A9 are the highest-risk and should be smoke-tested at plan-start.

---

## Open Questions

1. **Where does the user's "primary team" live for the QuotaIndicator (D-07)?**
   - What we know: Phase 1 user → many teams (including personal). QuotaIndicator shows `CPU 14/20 · RAM 28/40GB` — a single aggregate.
   - What's unclear: When user is on multiple shared teams, which is the "default" for the indicator? Sum across all? Show selected via dropdown? Show only personal?
   - Recommendation: D-09 says "aggregate is sum across clusters" — extend: "aggregate is also sum across the user's teams". QuotaIndicator drawer breaks down per-team-per-cluster. Document for planner.

2. **`team_cluster_tokens` exists for personal teams from Phase 1 bootstrap?**
   - See Pitfall 8 + Assumption A1.
   - Recommendation: smoke-test or read 01-06 SUMMARY.md and 01-07 SUMMARY.md verbatim before plan-start.

3. **Tag-write authorization: PVEVMUser role gives `VM.Config.Options`?**
   - See Assumption A9 — verified from pveum docs. [VERIFIED: pve.proxmox.com/pve-docs/pveum.1.html]
   - If the team-cluster-token was minted with a stricter role, edits will 403. Phase 1 mints with `PVEVMUser` per 01-06 SUMMARY decision; this is fine.

4. **PVE 7.x vs 8.x compat for tags and description?**
   - What we know: Tags shipped in PVE 7.4; description is PVE-pre-history.
   - What's unclear: Are there 8.x-only fields we depend on?
   - Recommendation: Document "PVE 8.x" as the v1 floor (matches Phase 1 CLUST-06 — already locked).

5. **What's the audit-log "result=pending" use case in Phase 2?**
   - What we know: Audit writer schema includes `pending`.
   - What's unclear: Phase 2 has no long-running ops; all audit writes are success/failure at write-time.
   - Recommendation: Don't use `pending` in Phase 2. Reserved for Phase 3 (job-enqueue audit row written at enqueue-time before UPID resolution).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12 | Backend | ✓ (Phase 1 verified) | 3.12.x | — |
| Node.js 22 LTS / pnpm 11 | Frontend | ✓ (Phase 1 verified) | — | — |
| Proxmox VE 8.x test cluster | Smoke tests on `/cluster/resources`, RRD, tags, description | ✗ in CI | — | Mock with FakeProxmox (Phase 1 pattern) for unit tests; manual operator-smoke checkpoint at phase end |
| SQLite 3.40+ with WAL | DB + admission lock | ✓ (Phase 1 verified) | — | — |
| `pybreaker` 1.4.1 (new dep) | Circuit breaker | ✗ not installed yet | — | `uv add pybreaker==1.4.1` — installation step in Plan 02-01 |
| `marked`, `dompurify` (new frontend deps) | Markdown notes | ✗ not installed yet | — | `pnpm add` — installation step in Plan 02-FE-01 |
| shadcn-svelte blocks: `scroll-area`, `progress`, `popover`, `command`, `accordion`, `collapsible` | UI components | ✓ shadcn-svelte initialized; ✗ blocks not yet added | — | `pnpm dlx shadcn-svelte@latest add ...` — installation step in Plan 02-FE-01 |
| `respx` (test mock) | Phase 1 dep | ✓ already in `[dependency-groups].dev` | — | — |

**Missing dependencies with no fallback:** none — every missing piece is a normal install step.

**Missing dependencies with fallback:**
- PVE 8.x test cluster: FakeProxmox class (Phase 1 pattern, see Plan 01-06 SUMMARY) covers unit tests; manual operator-smoke at end of phase covers real cluster.

---

## Validation Architecture

*Skipped — `workflow.nyquist_validation = false` in `.planning/config.json`.*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Inherited (Phase 1) | pwdlib + JWT + PAT (already shipped) |
| V3 Session Management | Inherited (Phase 1) | 3-cookie + CSRF (already shipped) |
| V4 Access Control | yes | Per-team privsep token at PVE layer + `require_resource_access` FastAPI dep |
| V5 Input Validation | yes | Pydantic `extra="forbid"` on every new schema; PVE_TAG_RE server-side validation; 8000-char description cap |
| V6 Cryptography | inherited | EncryptedSecret (Fernet) for `team_cluster_tokens.token_secret` — never hand-roll |
| V7 Error Handling | yes | Map PVE 401 → our 503 (degraded cluster); never echo raw PVE error to non-admin |
| V8 Data Protection | yes | Audit log includes IP + correlation_id; SQLite WAL persistence |
| V9 Communications | inherited | Caddy auto-TLS termination (Phase 1) |
| V14 Configuration | yes | `extra="forbid"` on every Pydantic input; CSP/HSTS Phase 5 |

### Known Threat Patterns for FastAPI + SvelteKit + proxmoxer + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant inventory leak via raw PVE-token forwarding | Information Disclosure | Per-team privsep token at PVE layer; ACL enforced by PVE, not by us. |
| Cross-tenant audit-log leak via missing predicate | Information Disclosure | RBAC predicate test matrix (Pitfall 11). Default predicate is most-restrictive (own actions only). |
| XSS via markdown notes | Tampering / Elevation | `marked` + `DOMPurify` + strict allow-list of tags; unit test feeds XSS payload, asserts strip. |
| Tag-string injection (semicolon-bomb crashing the parser) | DoS | Server-side `PVE_TAG_RE` per-tag + max-count (PVE has no documented limit but our UI caps at e.g. 50 tags/VM). |
| CSV injection (`=cmd(…)` in audit fields executes in Excel) | Tampering | Prefix any cell value starting with `=`, `+`, `-`, `@` with a single quote `'` (Excel-safe escape). Industry-standard control. |
| Quota TOCTOU | Tampering / DoS | `BEGIN IMMEDIATE` transaction (Pitfall 5 in this doc + PITFALLS.md #6). |
| Stale-data leak after team-membership revocation | Information Disclosure | Resource cache is per-cluster, not per-user; auth check happens BEFORE cache lookup. Memberships change → next read re-evaluates predicate. |
| Audit-log enumeration via export bypassing RBAC | Information Disclosure | D-19 requires RBAC on export endpoint; share the predicate code with list endpoint, no separate "dump" path. |
| Brute-force tag/notes scraping via PAT | Information Disclosure | PAT carries same RBAC as cookie; rate-limit on `/inventory/*` endpoints (Phase 1 has a limiter for `/login` only — Phase 2 may want per-Principal limits, defer to Phase 5). |

**Specific Phase 2 hardening checklist:**
- [ ] Audit-writer fail-closed: if `audit_write()` raises, the request returns 500 (no partial success).
- [ ] Cluster-unreachable errors carry no PVE host/IP detail in user-facing message (admin sees full detail).
- [ ] PVE-API errors that include the bootstrap token in their string representation are scrubbed before being put into `audit_log.error` column.
- [ ] CSV export: escape leading `=`, `+`, `-`, `@` per CSV-injection guideline.
- [ ] Tag/notes endpoint: rate-limit per Principal (10 req/min) to make scraping noisy (Phase 5 polish acceptable).
- [ ] Markdown XSS unit tests: `<script>`, `<iframe>`, `<img onerror=>`, `javascript:` URLs all stripped.

---

## Sources

### Primary (HIGH confidence)

- [Context7: purgatory docs](https://mardiros.github.io/purgatory/) — circuit breaker pattern (referenced; pybreaker chosen instead — see Stack)
- [pypi.org/project/pybreaker](https://pypi.org/project/pybreaker/) — version 1.4.1, mature, thread-safe
- [pypi.org/project/aiobreaker](https://pypi.org/project/aiobreaker/) — async-native alternative (rejected)
- [proxmoxer.github.io/docs/latest/](https://proxmoxer.github.io/docs/latest/) — proxmoxer 2.x reference
- [pve.proxmox.com/pve-docs/pveum.1.html](https://pve.proxmox.com/pve-docs/pveum.1.html) — ACL roles incl. `PVEVMUser` grants `VM.Config.Options` (covers tags + description) [VERIFIED]
- [github.com/proxmox/pve-common JSONSchema.pm](https://github.com/proxmox/pve-common/blob/master/src/PVE/JSONSchema.pm) — PVE_TAG_RE regex `[a-z0-9_][a-z0-9_\-\+\.]*` [VERIFIED]
- [marked.js.org](https://marked.js.org/) — Markdown renderer
- [npmjs.com/package/dompurify](https://www.npmjs.com/package/dompurify) — sanitizer v3.2.x
- [Phase 1 ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) — connector + breaker pattern, quota admission pattern
- [Phase 1 PITFALLS.md](.planning/research/PITFALLS.md) — VMID race (#1), UPID polling (#2), tenant ACL leak (#5), quota TOCTOU (#6), cluster vs node mismatch (#7)
- [Phase 1 STACK.md](.planning/research/STACK.md) — locked stack

### Secondary (MEDIUM confidence)

- [forum.proxmox.com — rrddata unit of measurement](https://forum.proxmox.com/threads/rrddata-unit-of-measurement.110606/) — timeframes (hour/day/week/month/year) + cf (AVERAGE/MAX)
- [forum.proxmox.com — VM Notes maximum 8192](https://forum.proxmox.com/threads/vm-notes-maximum-length-for-this-field-is-8192.120234/) — D-15 cap (UI-SPEC uses 8000 as safety margin)
- [forum.proxmox.com — Small tags inconsistency](https://forum.proxmox.com/threads/small-tags-inconsistency.151335/) — tag separator behavior (`;`, `,`, space accepted on write)
- [sqlite.org/forum — BEGIN IMMEDIATE can return database is locked](https://sqlite.org/forum/info/f75c87afed27840adf594a5ae1b09dacbf190139bd99e45ceac4037ec778a5ec) — busy_timeout edge case (Pitfall 5)
- [docs.sqlalchemy.org SQLite dialect](https://docs.sqlalchemy.org/en/20/dialects/sqlite.html) — aiosqlite + WAL + busy_timeout
- [tanstack.com/query/v4/docs/svelte/ssr](https://tanstack.com/query/v4/docs/svelte/ssr) — SvelteKit SSR pre-fetch + Query
- [medium.com — Serving 1M+ CSV with FastAPI](https://medium.com/@connect.hashblock/serving-1m-csv-exports-with-fastapi-and-streaming-responses-without-memory-bloat-32405f42cff5) — StreamingResponse + generator pattern
- [github.com/cure53/DOMPurify](https://github.com/cure53/DOMPurify) — sanitizer config

### Tertiary (LOW confidence — flag for validation)

- [dev.to — Building Resilient Database Operations with aiobreaker](https://dev.to/akarshan/building-resilient-database-operations-with-aiobreaker-async-sqlalchemy-fastapi-23dl) — pattern reference for aiobreaker; we chose pybreaker
- [forum.proxmox.com — Resource Pool VM list via API](https://forum.proxmox.com/threads/list-all-vms-in-specific-pool-with-pvesh.103690/) — pool filtering examples

---

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every dep verified on PyPI / npm; versions current as of 2026-05; `pybreaker` choice is documented vs. alternatives.
- Architecture: **HIGH** — patterns match Phase 1 architecture + ARCHITECTURE.md; connector/cache/breaker pattern is ARCHITECTURE.md Pattern 5 ditto.
- Pitfalls: **HIGH** — most pitfalls inherited from PITFALLS.md and verified against PVE forum + SQLite forum threads. Pitfall 8 (personal-team-token availability) marked as needing plan-start verification.
- Security: **HIGH** — ASVS V4/V5/V8 mapped; CSV-injection control surfaced; XSS allow-list documented.
- Validation: n/a — `nyquist_validation = false`.

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (30 days — stable stack; refresh only if Proxmox releases major PVE version changing tags/description schema, or if pybreaker / marked / dompurify push major versions).

---

*Phase 2 RESEARCH.md*
*Generated 2026-05-14*
