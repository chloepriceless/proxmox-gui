# Phase 2: Multi-Cluster Inventory, Quotas & Audit - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Liefert die **read-Schicht über alle registrierten Cluster** plus die **Quota- und Audit-Schicht** die ab hier jede mutative Action durchquert:

- Logged-in User browst, sucht, taggt und annotiert die VMs und LXCs, die ihm (oder seinem Team) gehören, über alle konfigurierten Cluster.
- Admins sehen alles, inklusive cross-tenant Sicht.
- Pro-Team Quotas werden in der UI permanent sichtbar gemacht und in jeder mutativen Action admission-controlled.
- Jede privileged Mutation wird auditiert; User sehen ihren Team-Scope, Admin sieht Plattform-weit; CSV-Export funktioniert.

**Out of scope (Phase 2):** Lifecycle-Actions (Power, Snapshot, Backup, Clone, Migrate) — alles in Phase 3. Provisioning / Create-Wizards — Phase 4. Noch keine Job-Queue; reine Read-Pfade plus rein-validative Admission-Gates die auf Resource-Counts in der DB rechnen (eigentliche Mutationen kommen ab Phase 3 via arq).

</domain>

<decisions>
## Implementation Decisions

### Inventory Dashboard Shape

- **D-01:** Liste ist **per-Cluster gruppiert in collapsible Sections** (nicht flach). Eine Section pro Cluster, default expanded. Bei nur 1 registriertem Cluster: **kein Section-Header, flache Liste** — UI switcht automatisch in den Section-Mode sobald ein zweiter Cluster hinzukommt.
- **D-02:** Header-weiter **Cluster-Context-Picker** mit Default `All clusters`. Auswahl persistiert **pro Session in `localStorage`** (Key `proxmox-gui:cluster-context`). Picker filtert die Liste auf eine Section (oder zeigt alle). State NICHT in URL (URL ist für Filter-Chips reserviert, siehe D-04).
- **D-03:** **Unreachable Cluster** → roter **Pro-Cluster Banner** über der betroffenen Section ("Cluster-A unreachable since 14:23"), Section zeigt **letzten cached Stand mit `stale` Badge** an jeder Row. Andere Cluster bleiben voll funktional. (Circuit-Breaker auf dem PVE-Connector schaltet das durch — Pattern aus ROADMAP Phase 2 Notes.)
- **D-04:** **Filter-UX** = horizontale removable **Filter-Chips über der Liste** (oberhalb der Sections). State zwingend in URL params (`?status=running&tag=prod&cluster=cluster-a`). Browser-back/forward muss funktionieren; Links sind shareable + bookmarkbar.
- **D-05:** **Default-Sortierung innerhalb einer Section:** Status-priority (`running → stopped → paused → error`), sekundär alphabetisch nach Name. User kann per Header-Click anders sortieren (alphabetic, vmid, last-changed); diese Wahl persistiert NICHT (jeder Page-Load resettet auf Status-priority).
- **D-06:** **Filter gegen Sections:** Wenn ein Filter eine Section auf 0 Treffer reduziert, **bleibt die Section sichtbar** mit Counter-Badge im Header (`Cluster-A (0 / 12)`); Body kollabiert NICHT automatisch. User sieht jederzeit welche Cluster er hat.

### Quota UI & Admission UX

- **D-07:** **Persistenter Quota-Indikator** in der Sidebar/Topbar — kompakter Block `CPU 14/20 · RAM 28/40GB`, immer sichtbar. Click → Details-Drawer mit per-cluster Breakdown. Hetzner-Style.
- **D-08:** **Admission-Failure beim Create:** **Live-Validation während Sizing-Eingabe**. Beim Eintippen von CPU/RAM/Disk: inline-Hint wenn das aktuelle Sizing die Team-Quota überschreiten würde (`Bei 8 cores würde Team-Quota um 2 überschritten`). Submit-Button **disabled** mit Tooltip-Begründung. Server validiert **defense-in-depth nochmal** (DB-Level Row-Lock per ROADMAP Phase 2 Notes — auch wenn Frontend defekt ist, kann keine Over-Quota durchrutschen).
- **D-09:** **Quota-Scope = Beides:** Aggregate (über alle Cluster) wird im Sidebar-Indikator sichtbar gemacht; **Enforcement passiert per-cluster** (PVE Pool ist per-cluster nativ). Der aggregate Wert ist die **automatisch berechnete Summe** der per-cluster Limits — Admin setzt nur per-cluster, keine separate aggregate-Cap. Single source of truth.
- **D-10:** **Quota-Warnings:** Sidebar-Indikator wechselt bei **80% Utilization auf gelb** (Warning) und **95% auf rot** (Critical). Bei Übergang von <80% → ≥80% wird **einmalig pro Session ein In-App-Toast** ausgelöst ("Team-X nähert sich Quota-Limit (80% CPU verbraucht)"). Kein Spam wenn der User die Schwelle mehrfach überschreitet.
- **D-11:** **Quota-Admin-UX:** Admin-only, integriert ins bestehende **`/admin/teams/{id}` Edit-Form** als neuer Tab/Section "Quotas". Pro Team eine Tabelle: Zeile pro Cluster, Spalten für `CPU cores`, `RAM GB`, `Disk GB`, `VM count`. Phase-1-konsistent (`/admin/users`, `/admin/clusters` existieren; Quotas leben auf `/admin/teams`).
- **D-12:** **Kein Admin-Override / Burst** in Phase 2. Quota ist hard. Wenn ein User mehr braucht, **muss Admin permanent das Limit anheben** (anschließend retried User). Audit-Log fängt die Limit-Change. Bewusste Entscheidung gegen "Override Quota"-Checkbox-Surface — vermeidet einen permanenten Workaround-Vektor.

### Tagging + Notes System

- **D-13:** **Tag-Quelle = Bidirektional PVE-Sync.** Unser Tag-Feld schreibt direkt das PVE `tags` Property (PVE 7.4+); PVE-WebUI-Tags erscheinen in unserer UI. **PVE ist single source of truth.** Kein separates `app_tags`-Schema. Bei PVE-Tag-Konflikt (User taggt in beiden UIs gleichzeitig) → last-write-wins; nächster Read der unsere View aktualisiert (kein Merge-Algorithmus).
- **D-14:** **Tag-Vocabulary = Freeform mit Autocomplete.** User tippt frei (PVE-konformes Format: `[a-z0-9_-]+`, lowercase, kein Whitespace — wir validieren clientseitig und blockieren Submit bei Invalid-Tag mit Inline-Error). Autocomplete-Dropdown zeigt **bestehende Tags aus dem aktuellen Team-Scope** (über alle eigenen VMs hinweg). Keine kuratierte Vocabulary-Liste, kein Blocklist-Pattern.
- **D-15:** **Notes-Storage = Sync zu PVE `description`.** Unser Notes-Feld schreibt das eingebaute `description` Property der VM. Unsere UI **rendert das als Markdown** (PVE rendert plain). Notes sind dadurch auch im PVE-WebUI sichtbar. Kein separates `app_notes`-Schema. Max-Länge folgt PVE-Limits (8000 chars laut Proxmox-Doku).
- **D-16:** **Tag-/Notes-Editing-Auth:** **Jeder User mit Read-Access** auf die VM (Team-Mitglied) darf Tags + Notes editieren. Friction-minimal, Audit-Log fängt wer was geändert hat. Nicht Admin-only, nicht Owner-only.

### Audit Log UX

- **D-17:** **Audit-Log-Sichtbarkeit:** Non-Admin User sieht **eigene Aktionen + Aktionen anderer Team-Mitglieder auf VMs/LXCs seiner Teams**. Cross-Tenant Aktionen + Plattform-Aktionen (User-Mgmt, Cluster-Mgmt) **nur für Admin**. Default-View: nur eigene Aktionen, Team-Aktionen mit Toggle "Show team actions".
- **D-18:** **Per-VM Activity Log = eigener Tab auf der VM-Detail-Page** (`/inventory/{cluster_id}/{vmid}/activity`). VM-Detail-Page bekommt ein Tab-Layout: `Overview | Activity | Console (Phase 4) | Snapshots (Phase 3) | ...`. Activity-Tab ist vorgefilterte Sicht auf den globalen Audit-Log (`vmid=X` URL-Param). Plus eigenständige globale `/audit`-Page für Cross-VM-Sicht.
- **D-19:** **CSV-Export-Scope:** Aktuelle UI-Filter werden auf den Export angewendet (Zeitraum, Action-Type, User, VM); zusätzlich greift **RBAC** (User exportiert nur was er sehen darf — kein RBAC-Bypass via Export). Export-Button heißt explizit `Export filtered (X rows)` mit der Match-Count, kein Surprise bei großen Exports. Hard limit 50000 Rows pro Export — darüber Hinweis "refine your filter".
- **D-20:** **Audit-Scope = Mutationen + Auth-Events.** Auditiert: jede Create/Update/Delete/Power-Action, plus Logins, Logouts, Password-Changes, PAT-Mints+Revokes, SSH-Key-Adds+Removes, Session-Revokes, Quota-Limit-Changes. **NICHT auditiert:** Reads, Inventory-Browsing, Quota-View, Audit-View. Phase-1-konsistent (`revoke_user_sessions` ist schon ein Audit-Material-Event).

### Claude's Discretion

- Exakte Filter-Chip-Component (Reuse vs neu bauen — wahrscheinlich neu, kein bestehendes Pattern)
- Skeleton-Loading-States während Section-Fetch
- Genaue Toast-Position für Quota-Warnings (sonner mountet schon, Position folgt UI-SPEC §Toaster)
- VM-Detail-Tab-Component (Reuse oder Tabs-Primitive aus shadcn-svelte)
- CSV-Encoding (UTF-8 BOM für Excel-Kompatibilität, oder reines UTF-8)
- Empty-State-Illustrations für leeres Inventory / leerer Audit-Log
- Markdown-Renderer für Notes (welche Library — markdown-it, marked, oder selbstgebaut für minimal-subset?)
- Exakte Stale-Cache-TTL (ROADMAP nennt 30s; Connector-Implementation-Detail)

### Folded Todos

Keine offenen `pending`-Todos waren relevant für Phase 2 (Verzeichnis ist leer).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked decisions from Phase 1 (carry forward — do NOT re-decide)

- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 D-01..D-19 (Team = primary tenant, Quota-Math XOR per-team/per-user, ClusterStatusPill exists, ConnectorRegistry with `asyncio.to_thread`, per-tenant PVE tokens, `Settings.__repr__` redaction, etc.)
- `.planning/phases/01-foundation/01-VERIFICATION.md` — Phase 1 verification report incl. 2 deferred manual items (A6 cluster-token permissions, ssh-rsa key acceptance)
- `.planning/phases/01-foundation/01-REVIEW-FIX.md` — Auto-fixed BLOCKERs/HIGHs from code review (X-Forwarded-For trust list, TOCTOU partial index, delete_user transaction atomicity)
- `.planning/HANDOFF.md` — Discussion-resume bridge from paused Phase 2 discuss (will be deleted post-CONTEXT.md write)

### Project-level requirements + architecture

- `.planning/PROJECT.md` — Vision, core value, locked decisions at project level (multi-tenant + quotas v1, multi-cluster v1, local-auth v1)
- `.planning/REQUIREMENTS.md` — 89 v1 requirements; relevant for this phase: **TENT-01..06, CLUST-02..04, INV-01..08, AUDIT-01..05, API-05**
- `.planning/ROADMAP.md` §"Phase 2: Multi-Cluster Inventory, Quotas & Audit" — phase goal, success criteria, technical-locked notes (30s cache + circuit-breaker, sync audit-writer, DB row-lock for admission, storage/SDN refs namespaced by cluster_id)
- `.planning/research/ARCHITECTURE.md` — modular monolith, per-cluster connector pattern, multi-tenant URL-shape `/clusters/{id}/...`
- `.planning/research/PITFALLS.md` — Proxmox-specific gotchas; relevant ones: **#9 (per-cluster API tokens), #10 (`/cluster/nextid` race — N/A this phase), #11 (multi-tenancy via Proxmox pools), Pitfall A3 (thread-pool sizing for `asyncio.to_thread`)**

### Existing code references downstream agents must respect

- `backend/app/clusters/connector.py` + `backend/app/clusters/registry.py` — Plan 01-06 PVEConnector with `asyncio.to_thread`; Phase 2 extends with 30s cache + circuit-breaker
- `backend/app/models/audit_log.py` — Phase 1 schema (table exists with `team_id`); Phase 2 lights up the writer + views
- `backend/app/models/quota.py` — Phase 1 schema; Phase 2 extends with per-cluster columns + DB-level row-lock for admission
- `backend/app/teams/bootstrap.py` — D-02 transactional tenant bootstrap (Plan 01-06); Phase 2 quota-config must integrate with this
- `frontend/src/lib/components/layout/AppShell.svelte` + `Sidebar.svelte` + `Topbar.svelte` — Phase 1 (Plan 01-03+01-08); Phase 2 mounts Quota-Indicator into Sidebar/Topbar
- `frontend/src/routes/admin/teams/+page.svelte` + `frontend/src/routes/admin/teams/[id]/+page.svelte` — Phase 1 (Plan 01-06); Phase 2 adds Quota-Tab/Section
- `frontend/src/lib/components/ClusterStatusPill.svelte` — exists per HANDOFF.md, reusable in Inventory Section-Headers
- `frontend/src/lib/api/me.ts`, `frontend/src/lib/api/clusters.ts`, `frontend/src/lib/api/teams.ts` — typed API client pattern from Plan 01-08+01-09; Phase 2 adds `api.inventory`, `api.audit`, `api.quotas` modules

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **AppShell + Sidebar + Topbar** (Plan 01-03+01-08): Quota-Indicator wird hier reingehängt — geplanter Slot in Topbar oder Sidebar je nach UI-SPEC.
- **ClusterStatusPill** (existiert): wiederverwendbar in Inventory Section-Headers für Live-Status.
- **PVEConnector + Registry** (Plan 01-06, `backend/app/clusters/`): Phase 2 erweitert mit 30s in-memory Cache + Circuit-Breaker (`pybreaker` oder selbstgebaut — Researcher prüft). Bestehendes `asyncio.to_thread` Pattern bleibt.
- **shadcn-svelte primitives** (Card, Button, Input, Dialog, Toast, Tabs): Inventory-Sections + VM-Detail-Tabs + Quota-Drawer können auf vorhandenen Primitives aufbauen.
- **`cn()` helper** in `$lib/utils.ts`: für conditional Class-Names auf Filter-Chips + Stale-Row-Badges.
- **sonner Toast** in AppShell (Plan 01-09): Quota-Warning-Toasts reusen den existing Toaster (bottom-right, richColors).
- **`$derived(localOverride ?? data.list)` Pattern** (Plan 01-09 SUMMARY): wird wiederverwendet für Inventory-Liste bei optimistic Tag-/Notes-Mutates.
- **Per-page `+page.server.ts` defence-in-depth auth-gates** (Plan 01-09): jede neue Phase-2 Route folgt diesem Pattern.
- **ConfirmByNameDialog** (Plan 01-08): wird in Phase 3 für Delete/Destructive-Actions wichtig — Phase 2 nutzt es noch nicht direkt, aber bei Quota-Limit-Senkung könnte ein Confirm sinnvoll sein wenn aktuelle Usage > neues Limit.
- **`POST /api/v1/clusters/test` dry-run** (Plan 01-06): nicht direkt für Phase 2, aber Pattern (validate-before-persist) wiederholt sich für Quota-Edit.

### Established Patterns

- **URL-Shape:** `/api/v1/clusters/{cluster_id}/...` (Phase 1 CLUST-05 lock). Phase 2: `/api/v1/clusters/{id}/vms`, `/api/v1/clusters/{id}/lxcs`, `/api/v1/clusters/{id}/vms/{vmid}/tags`, etc.
- **Defense-in-depth auth:** Layout-level + page-level + service-level. Phase 2 hält das durch.
- **`event.locals.user` Hydration** über `/api/v1/me` Probe in `hooks.server.ts` (Plan 01-08).
- **Service-Layer commits BEFORE raising HTTPException** (Plan 01-05 SUMMARY): jede neue Service-Function in Phase 2 folgt dem Pattern.
- **PAT vs Session Coexistence:** Phase 1 `_PAT_BEARER_RE` regex blockiert JWT-via-Bearer. Phase 2 Inventory + Audit Endpoints akzeptieren beide Auth-Pfade.
- **`extra="forbid"` auf Pydantic Schemas** (Plan 01-06): neue Inventory-Filter-Schemas folgen.
- **Hand-written Alembic Migrations mit benannten Constraints** (Plan 01-02): Phase-2-Schema-Erweiterungen (Quota-per-cluster, neue Audit-Indices) folgen diesem Stil.

### Integration Points

- **Backend:**
  - Neue Module: `backend/app/inventory/` (routes + service + schemas), `backend/app/audit/` (writer + reader + CSV-exporter), `backend/app/quotas/` (admission + edit-routes).
  - Erweiterung: `backend/app/clusters/connector.py` um Cache + Circuit-Breaker.
  - Migration: `0003_phase2.py` — Quota per-cluster Spalten, Audit-Indices, evtl. Tags-Cache-Tabelle (entscheidet Researcher).
- **Frontend:**
  - Neue Routes: `/inventory`, `/inventory/{cluster_id}/{vmid}`, `/inventory/{cluster_id}/{vmid}/activity`, `/audit`.
  - Erweiterung: `/admin/teams/{id}` um Quota-Tab.
  - Neue Components: `QuotaIndicator.svelte` (Sidebar), `FilterChip.svelte` (Inventory), `ClusterSection.svelte` (Inventory), `AuditTable.svelte`, `CsvExportButton.svelte`.
  - Neue API-Module: `frontend/src/lib/api/inventory.ts`, `audit.ts`, `quotas.ts`.

</code_context>

<specifics>
## Specific Ideas

- **"Hetzner-Style"** kommt mehrfach als Referenz: Sidebar-Quota-Indikator, Filter-Chips über der Liste, Status-priority Sort, Audit-Log-Layout. Wenn unklar wie eine Komponente aussehen soll → Hetzner Cloud Console als visuelle Referenz prüfen.
- **PVE als single source of truth** ist ein wiederkehrendes Thema: Tags → PVE `tags`, Notes → PVE `description`. Keine Schatten-Datenbank, kein Drift-Risiko, parallel-PVE-WebUI-User sind nicht ausgeschlossen.
- **"Degrade don't fail" pro Cluster** ist ein architectural pattern (Phase-1-ROADMAP-Notes carryover): ein kaputter Cluster darf 9 andere nicht in Mitleidenschaft ziehen. Gilt für Inventory (D-03), Audit-Log (Audit-Writer ist sync aber liest), Quota (per-cluster enforcement bleibt aktiv).
- **Self-Service mit Transparenz:** User soll jederzeit sehen können wieviel Quota er noch hat (D-07), was sein Team gemacht hat (D-17), und nicht durch undokumentierte Limits überrascht werden (D-08+D-10).

</specifics>

<deferred>
## Deferred Ideas

- **Admin-Override / Burst-Quota:** explizit gegen entschieden für Phase 2 (D-12). Wenn User-Feedback "wir brauchen Burst" kommt: Phase 5 oder v2.
- **Team-Owner kann eigene Quota-Verteilung anpassen:** kommt nicht in Phase 2 — Quota-Admin bleibt Admin-only. Self-Service-Quota-Sub-Allocation ist v2.
- **Read-Operation-Audit:** explizit gegen entschieden (D-20). Audit-Volume + Privacy-Footprint zu groß für v1.
- **Bulk-Tag-Edit:** mehrere VMs selektieren und Tags in einem Rutsch ändern. Kann später in Phase 3 (wenn Bulk-Power-Actions kommen) oder v2.
- **Tag-Color-Customization:** Phase 2 nutzt auto-derived Farben (Hash → Hue) oder shadcn-Default-Palette. User-customisable Tag-Colors sind v2.
- **Markdown-Editor mit Live-Preview für Notes:** Phase 2 nutzt einfaches Textarea + post-save Markdown-Rendering. WYSIWYG / Live-Preview ist v2 falls überhaupt.
- **Audit-Log-Retention:** sitzt schon explizit in **Phase 5** (Carryover-Liste) — Retention/Rotation + Archive-Strategie. Phase 2 schreibt alles ungekürzt.

### Reviewed Todos (not folded)

Keine Todos waren in pending — Sektion nicht zutreffend.

</deferred>

---

*Phase: 02-multi-cluster-inventory-quotas-audit*
*Context gathered: 2026-05-14*
