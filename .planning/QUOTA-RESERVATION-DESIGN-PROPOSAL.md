# Blocker 2 (HIGH) — Quota-Reservation: Design-Proposal (braucht Christin-GO)

**Datum:** 2026-06-14 · **Owner:** Schraubi · **Status:** NICHT autonom gefixt — Design-Entscheid + Migration
+ Hot-Path-Änderung → Go/No-Go an Christin. Die anderen 4 Blocker sind auf `fix/release-review-blockers` gefixt.

## Befund (am Code bestätigt)
`backend/app/quotas/admission.py:46` `check_and_preview` ist **read-only** (Docstring 1-6/52-56: „no reservation
row is inserted in Phase 2"). Es öffnet `BEGIN IMMEDIATE`, liest die Quota-Zeile + die **Live-PVE-Nutzung**
(`compute_team_usage`), vergleicht, committet OHNE Schreiben. Die Konsumenten — `clone.run_quota_admission`
(`clone.py:120`), `provisioning.run_quota_admission_for_request` (`service.py:140`), `backups.py:234` — rufen ALLE
`check_and_preview`. Das im Docstring versprochene `check_and_reserve` existiert nirgends (grep-verifiziert).
**Folge (TOCTOU):** N nebenläufige Creates lesen alle dieselbe Vor-Create-Nutzung (PVE kennt die noch nicht
gestarteten Creates nicht) → alle sehen Headroom → alle passieren → Quota wird überschritten. Single-LXC/
single-API-Worker macht das seltener, aber zwei Browser-Tabs / ein Script reichen.

## Warum NICHT autonom gefixt (GO-gated)
1. **Migration nötig:** eine neue `quota_reservations`-Tabelle (Alembic-Revision auf head).
2. **Hot-Path-Änderung:** der Create-Pfad (clone/provisioning/backup-restore) muss reserve→commit→release fahren —
   Fehler hier brechen ALLE Creates oder leaken Reservierungen (Quota wächst künstlich, Creates werden fälschlich
   abgelehnt).
3. **Produkt-Entscheid (überlappt mit dem separaten `lxc_count`-Finding):** combined vs. getrennte VM/LXC-Count-
   Limits — die Reservation-Dimension hängt davon ab. Das ist eine Produkt-Semantik-Frage, nicht rein technisch.
→ R22 (Datenmodell/Quota = architektur-/prozesskritisch): Default BLOCK, erst GO.

## Proposed Design (zur Freigabe)
**`quota_reservations`-Tabelle** (team_id, cluster_id, job_id FK, cpu_cores, ram_bytes, disk_bytes, count, created_at,
state). **`check_and_reserve(db, registry, *, request, job_id)`** innerhalb des bestehenden `BEGIN IMMEDIATE`
(admission.py:58): (a) Live-PVE-Usage + **Summe der offenen Reservierungen** (state='open') = effektive Nutzung; (b)
gegen Limit prüfen; (c) bei Pass eine Reservierungs-Zeile INSERTen, COMMIT (der Write-Lock serialisiert konkurrierende
Reserves → genau einer gewinnt am Limit); (d) bei Fail 4xx, kein Insert. **Release:** in `finish_job` (terminaler
Zustand succeeded/failed/needs_review) ODER beim Job-Abbruch die Reservierung auf state='released' setzen/löschen —
sobald PVE die neue VM kennt, zählt sie in `compute_team_usage`, die Reservierung wird redundant. **Idempotenz:**
Reservierung an `job_id` koppeln (re-reserve desselben Jobs = no-op). **Stale-Cleanup:** ein Reaper-/Cron-Schritt
löscht Reservierungen ohne lebenden Job (Worker-Crash zwischen reserve und Job-Start) — TTL z.B. 1h.

**Akzeptanz (R31, Concurrency-Test):** N parallele Creates bei Limit=1 → genau 1 passiert, N-1 bekommen 4xx; nach
Job-Terminal ist die Reservierung weg und PVE-Usage trägt die Zählung.

## Offene Entscheidungen für Christin (MC)
1. **Count-Limit-Semantik:** (a) EIN combined `count` (VM+LXC zusammen, heutiges De-facto-Verhalten ehrlich benannt)
   ODER (b) getrennte `vm_count` + `lxc_count` (dann `lxc_count` in service.py/schemas.py setzbar machen + als eigene
   Reservation-Dimension). Das deckt zugleich den separaten `lxc_count`-tote-Spalte-Befund ab.
2. **Reservierungs-TTL/Cleanup:** akzeptabel als Cron im Worker (z.B. stündlich) ODER strikt an Job-Lifecycle?
3. **Scope jetzt:** als eigener Folge-Branch nach GO (geschätzt 1 Migration + ~3 Dateien + Concurrency-Test), separat
   reviewbar/Codex-refutebar VOR Merge.

**Empfehlung:** (1b) getrennte Limits (sauberere Semantik + schließt den lxc_count-Befund), (2) Job-Lifecycle-Release
+ stündlicher Stale-Cron als Backstop. Auf GO setze ich es als eigenen Branch um (Migration + Concurrency-Test + Codex).
