# Phase 2: Multi-Cluster Inventory, Quotas & Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 02-multi-cluster-inventory-quotas-audit
**Areas discussed:** Inventory Dashboard Shape, Quota UI & Admission UX, Tagging + Notes System, Audit Log UX
**Resumed from:** `.planning/HANDOFF.md` (Phase 2 discuss was paused mid-Bereich-1 in prior session 2026-05-14)

---

## Bereich 1: Inventory Dashboard Shape

### Q1.1 — Layout über Cluster hinweg

| Option | Description | Selected |
|--------|-------------|----------|
| Unified flat list (empfohlen) | Eine paginierte Liste mit Spalte 'Cluster'. Hetzner-Style. | |
| Cluster-grouped sections | Pro Cluster collapsible Section. | ✓ |
| Context-switched | Header-Dropdown wählt aktiven Cluster, Liste zeigt nur den. | |

**User's choice:** Cluster-grouped sections (NICHT empfohlen — bewusste Wahl gegen flache Liste)
**Notes:** Die Wahl passt zu Q1.2 (All clusters default + filter): die Liste IST die gruppierte Ansicht, der Picker filtert auf eine Section. Triggert Sub-Decisions Q1.5 (Single-Cluster-Fall) und Q1.7 (leere Sections).

### Q1.2 — Cluster-Context-Picker im Header

| Option | Description | Selected |
|--------|-------------|----------|
| 'All clusters' default + filter (empfohlen) | Default 'Alle', persistiert pro Session in localStorage. | ✓ |
| Pro Page sticky | Auswahl persistiert pro Seite. | |
| Nur expliziter Switch | Default 'alle', kein localStorage. | |

**User's choice:** All clusters default + filter
**Notes:** Default-Empfehlung übernommen.

### Q1.3 — Unreachable Cluster Degradation

| Option | Description | Selected |
|--------|-------------|----------|
| Pro-Cluster Banner + stale cache (empfohlen) | Andere Cluster bleiben funktional. | ✓ |
| Cluster ausblenden | Verschwindet aus Liste mit Toast. | |
| Globaler Read-only Mode | Wenn EINER fällt, alles read-only. | |

**User's choice:** Pro-Cluster Banner + stale cache
**Notes:** Default-Empfehlung übernommen. Konsistent mit ROADMAP Phase 2 Note "Circuit-Breaker pro Connector".

### Q1.4 — Search & Filter UX

| Option | Description | Selected |
|--------|-------------|----------|
| Filter chips + URL params (empfohlen) | Shareable links, browser-back works. | ✓ |
| Left sidebar filters | Mehr Platzbedarf, Hetzner-Style. | |
| Toolbar dropdown + search box | Kompakter. | |

**User's choice:** Filter chips + URL params
**Notes:** Default-Empfehlung übernommen.

### Q1.5 — Single-Cluster-Fall: Section-Header zeigen?

| Option | Description | Selected |
|--------|-------------|----------|
| Header weglassen — flache Liste | Bei 1 Cluster: kein Section-Header. | ✓ |
| Header immer zeigen | Konsistenz über alle Zustände. | |
| Header collapsed-by-default bei 1 Cluster | Hybrid. | |

**User's choice:** Header weglassen wenn nur 1 Cluster
**Notes:** Auto-Switch zu Section-Mode sobald Cluster 2 hinzukommt.

### Q1.6 — Default-Sortierung innerhalb Section

| Option | Description | Selected |
|--------|-------------|----------|
| Status-priority (running → stopped → paused → error) | Hetzner-Pattern. | ✓ |
| Alphabetisch (Name A-Z) | Operator-Workflow. | |
| VMID aufsteigend | PVE-native. | |

**User's choice:** Status-priority
**Notes:** Sekundär alphabetisch.

### Q1.7 — Filter-Verhalten gegen leere Sections

| Option | Description | Selected |
|--------|-------------|----------|
| Sections ohne Treffer ausblenden | Liste verdichtet sich. | |
| Sections zeigen mit '0 results' Hint | Section-Header bleibt mit Counter. | |
| Counter-Badge im Section-Header, Body normal | Section bleibt voll sichtbar mit Badge. | ✓ |

**User's choice:** Counter-Badge im Section-Header, Body normal
**Notes:** Konservativste Option — User sieht jederzeit welche Cluster er hat.

---

## Bereich 2: Quota UI & Admission UX

### Q2.1 — Wo sieht User Quota im Alltag?

| Option | Description | Selected |
|--------|-------------|----------|
| Persistenter Indikator in Sidebar/Topbar (empfohlen) | Immer sichtbar. Hetzner-Style. | ✓ |
| Dedicated /quotas-Page, sonst nichts | Minimal-UI. | |
| Dashboard-Widget + Just-in-time bei Create | Sichtbar wenn relevant. | |

**User's choice:** Sidebar/Topbar Indikator
**Notes:** Default-Empfehlung übernommen.

### Q2.2 — Admission-Failure beim Create

| Option | Description | Selected |
|--------|-------------|----------|
| Live-Validation + disabled Submit (empfohlen) | Inline-Hint, kein wasted typing. | ✓ |
| Submit → Server-Validation → Field-Error | Einfacher, schlechtere UX. | |
| Create-Button vorab disabled | Klare Stop-Sign. | |

**User's choice:** Live-Validation + disabled Submit
**Notes:** Default-Empfehlung übernommen. Server-side defense-in-depth zwingend (DB row-lock).

### Q2.3 — Quota-Scope: per-cluster vs aggregate?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-Cluster Quota (empfohlen) | Mehrere Einträge, PVE-Pool-Realität. | |
| Aggregate über alle Cluster | Einfacheres Mental-Model. | |
| Beides — aggregate sichtbar, per-cluster enforced | Hybrid: aggregate für Display, per-cluster für Enforcement. | ✓ |

**User's choice:** Beides — aggregate sichtbar, per-cluster enforced (NICHT empfohlen — anspruchsvollere Wahl)
**Notes:** Triggert Sub-Decision Q2.5 (Wie wird aggregate definiert).

### Q2.4 — Quota-Warning-Thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| 80%/95% (empfohlen) | Warning bei 80%, Critical bei 95%, einmaliger Toast. | ✓ |
| Nur visueller Schwellwert | Kein Toast, weniger Spam. | |
| Stille bis 100% | Keine Warnung, hartes Block. | |

**User's choice:** 80% Warning + 95% Critical mit Toast bei 80%-Crossing
**Notes:** Default-Empfehlung übernommen.

### Q2.5 — Aggregate-Limit Definition

| Option | Description | Selected |
|--------|-------------|----------|
| Sum auto-berechnet (empfohlen) | Aggregate = Summe der per-cluster Limits. | ✓ |
| Separate aggregate zusätzlich | Aggregate kann niedriger sein als Sum. | |
| Nur aggregate, per-cluster auto-derived | Schlechter Fit für PVE-Pool-Realität. | |

**User's choice:** Sum der per-cluster Limits, auto-berechnet
**Notes:** Single source of truth — Admin setzt nur per-cluster.

### Q2.6 — Wer setzt Quotas, wo in der UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-only auf /admin/teams (empfohlen) | Integriert in bestehendes Team-Edit-Form. | ✓ |
| Admin-only /admin/quotas Page | Dedizierte Quota-Page. | |
| Admin + Team-Owner für eigenes Team | Self-Service-Sub-Allocation. | |

**User's choice:** Admin-only auf /admin/teams/{id}
**Notes:** Default-Empfehlung übernommen. Phase-1-konsistent.

### Q2.7 — Admin-Override / Burst-Quota

| Option | Description | Selected |
|--------|-------------|----------|
| Kein Override (empfohlen) | Quota muss erhöht werden. | ✓ |
| Per-Action Override mit Audit | Notfall-Flexibilität. | |
| Später entscheiden | Beobachten. | |

**User's choice:** Kein Override
**Notes:** Default-Empfehlung übernommen. Override → deferred.

---

## Bereich 3: Tagging + Notes System

### Q3.1 — Tag-Quelle

| Option | Description | Selected |
|--------|-------------|----------|
| Bidirektional sync mit PVE-Tags (empfohlen) | PVE = single source of truth. | ✓ |
| App-internal only, PVE-Tags getrennt | Zwei Tag-Orte. | |
| App-internal only, PVE-Tags ignorieren | App-Souveränität. | |

**User's choice:** Bidirektional PVE-Sync
**Notes:** PVE 7.4+ Feature; kein eigenes Schema; last-write-wins bei Konflikt.

### Q3.2 — Tag-Vocabulary

| Option | Description | Selected |
|--------|-------------|----------|
| Freeform mit Autocomplete (empfohlen) | Niedrige Friction. | ✓ |
| Admin-curated Vocabulary | Saubere Taxonomie, mehr Friction. | |
| Hybrid mit Blocklist | Komplexer als nötig. | |

**User's choice:** Freeform + Autocomplete aus Team-Scope
**Notes:** PVE-Format-Validation clientside (`[a-z0-9_-]+`).

### Q3.3 — Notes-Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Sync zu PVE-VM-description (empfohlen) | Single source of truth, im PVE-WebUI sichtbar. | ✓ |
| App-internal Notes, PVE separat | Doppeltes Notes-Konzept. | |
| App-internal Notes, PVE ignorieren | App-Souveränität. | |

**User's choice:** Sync zu PVE `description`
**Notes:** Markdown-Rendering bei uns, plain bei PVE.

### Q3.4 — Tag-/Notes-Editing-Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Jeder Team-Member mit Read-Access (empfohlen) | Niedrige Friction, Audit-Log fängt es. | ✓ |
| Nur VM-Owner oder Team-Admin | Owner-Property. | |
| Admin-only | Maximaler Schutz, kein Self-Service. | |

**User's choice:** Jeder Team-Member darf editieren
**Notes:** Default-Empfehlung übernommen.

---

## Bereich 4: Audit Log UX

### Q4.1 — Audit-Log-Sichtbarkeit für Non-Admin

| Option | Description | Selected |
|--------|-------------|----------|
| Eigene + Team-VM-Aktionen (empfohlen) | Hetzner-Style. | ✓ |
| Nur eigene Aktionen | Maximaler Privacy-Footprint. | |
| Kein User-Audit, nur Admin | Minimaler Scope. | |

**User's choice:** Eigene + Team-VM-Aktionen, Toggle für Team-Filter
**Notes:** Default-Empfehlung übernommen.

### Q4.2 — Per-VM Activity Log

| Option | Description | Selected |
|--------|-------------|----------|
| Eigener Tab auf VM-Detail-Page (empfohlen) | Lokaler Kontext. | ✓ |
| Globale /audit-Page mit VMID-Filter | Spart Tab, bricht Flow. | |
| Activity-Drawer | Side-by-side. | |

**User's choice:** VM-Detail-Tab + globale /audit-Page
**Notes:** VM-Detail-Page bekommt Tab-Layout (`Overview | Activity | Console | Snapshots | ...`).

### Q4.3 — CSV-Export-Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Aktuelle Filter + RBAC (empfohlen) | Erwartungsgemäß. | ✓ |
| Immer alle RBAC-Scope | Konsistenter Output, riesig. | |
| Explicit Zeitraum-Picker im Dialog | Mehr Friction. | |

**User's choice:** Aktuelle Filter werden angewendet, RBAC zusätzlich
**Notes:** Button-Label `Export filtered (X rows)`. Hard limit 50000 Rows.

### Q4.4 — Audit-Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Mutationen + Auth-Events (empfohlen) | PCI/SOC2-Pattern. | ✓ |
| Nur Mutationen | Bricht Forensik. | |
| Mutationen + Auth + ausgewählte Reads | Volume-Explosion. | |

**User's choice:** Mutationen + Auth-Events
**Notes:** Read-Operationen explizit nicht auditiert. Quota-Limit-Changes ZÄHLEN als Mutation (Admin-Property-Change).

---

## Claude's Discretion

- Skeleton-Loading-States für Sections
- Exakte Toast-Position für Quota-Warnings (sonner mountet schon — Position-Override falls UI-SPEC abweicht)
- Markdown-Library-Wahl (markdown-it / marked / minimal-subset selbstgebaut)
- CSV-Encoding (UTF-8 BOM für Excel-Kompatibilität ja/nein)
- Filter-Chip-Component-Design (neu, kein existierendes Pattern)
- Empty-State-Illustrations
- Tag-Color-Derivation (Hash → Hue, oder fixe shadcn-Palette)
- Exakte Stale-Cache-TTL für Inventory-Reads (ROADMAP nennt 30s)

## Deferred Ideas

- Admin-Override / Burst-Quota → Phase 5 oder v2 (D-12)
- Team-Owner kann eigene Quota-Verteilung anpassen → v2
- Read-Operation-Audit → v2 (Volume + Privacy)
- Bulk-Tag-Edit → Phase 3 oder v2
- Tag-Color-Customization → v2
- Markdown-Editor mit Live-Preview für Notes → v2
- Audit-Log-Retention/Rotation → Phase 5 (steht schon im Carryover)
