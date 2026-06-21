# T-0244 — Kundendaten-Isolations-Architektur (Infra-LEAD-Teil)

**Autor:** Proxmox-GUI Head / Infra-LEAD („Schraubi", Hub-Key `vm-deployment-gui`)
**Stand:** 2026-06-21, fertig zur Synthese. **Status:** Design-only, KEIN Bau (gated).
**Co-Owner:** Schnüffi = Security/Synthesizer (`733y8dgt`) · Bizzi = Compliance/GDPR (`43sds8sq`) · Tüftli = Continuity-Logik (`6enyhavb`) · Netzi = Netz/VLAN (`o7a9xw7h`).
**Auftrag (Christin via Orchestrator):** EINE hart isolierte Umgebung NUR für Kundendaten, vollständig getrennt vom Peer-Netz/Rest der Flotte. 5 Claude-**Teams**-Seats (AVV/DPA, **nicht** Pro/Consumer): 4 autonome Kundendaten-Agents + 1 operator-gesteuerter Agent. Verarbeiten ausschließlich Kunden-PII (Lizenzverwaltung, Shop/polar.sh, Kunden-Mail, Rechnungen, DVhub-Prod-Kundendaten).

> **Dieses Dokument** liefert den **technischen Host-/Infra-/Substrat-Teil**. Die Security-Synthese (Schnüffi) konsolidiert daraus die EINE Christin-MC (A vs B); die GDPR-Map (Bizzi) hängt an den Traceability-Ankern unten; Tüftli baut die Continuity-Logik auf dem Substrat in §6.

---

## 0. KERNREGEL (nicht verhandelbar)
**KEIN Cross-Talk der Zone zum Fleet-Broker `:7899` (bun, 0.0.0.0 auf der Mac) / Hub `:7890` (node, 0.0.0.0 auf der Mac).** Die Zone darf diese Ports **nicht einmal routen können**. Kein claude-peers-MCP, keine Fleet-Registry, kein Merkel-Ingest, kein Spawner-Anschluss an die Fleet. Die Isolation ist **die** Anforderung — alles andere ordnet sich unter.

---

## 1. Entscheidung: VM, NICHT LXC (entschieden mit Schnüffi)
**Wahl: KVM-VM.** Begründung:
- LXC auf Proxmox teilt den **Host-Kernel**. Für PII ist ein Shared-Kernel-Container eine unvertretbare Blast-Radius: ein Kernel-Escape (oder bei privilegiertem LXC ein Container-Escape) landet **direkt auf dem Host**, der den Rest der Flotte mitträgt → PII-Exfiltration über die Host-Ebene.
- Eine VM hat hardware-virtualisierte Isolation (eigener Kernel, eigener Speicher, KVM-Boundary). Deutlich stärkere Trennung gegen Mit-Mieter auf demselben Blech.
- Mehrkosten (VM- vs LXC-Overhead) sind gegenüber dem PII-Risiko vernachlässigbar (R12: keine Aufwands-Disproportion).
- **Konsistent mit der Fleet-Lesson** aus dem Inventar-SSOT: 6 privilegierte LXC sind bereits als erhöhte Host-Escape-Fläche markiert; PII gehört nicht in dieselbe Klasse.

---

## 2. Entscheidung: Host-Boundary — A vs B = **Christin-MC** (Schnüffi trägt sie in die Synthese)
Die VM-Wahl steht; **wo** die VM lebt, ist die eine echte Christin-Entscheidung (HW-Spend vs. Isolationsstärke — irreversibel/teuer/Präferenz nach DRIVE-TO-GOAL).

### Variante A — In-Cluster-VM auf `proxmox`/.240 (sofort baubar)
- **Kapazität verifiziert (Inventar-SSOT, read-only):** `proxmox`/.240 = 128 GB / 32 Cores, **80.945 MB avail RAM**, `local-lvm` lvmthin **228,8 GB frei**, `Samsung_1TB` zfspool 2.828 GB frei. → PII-VM **8c / 24 GB / 150 GB** passt komfortabel in den Headroom (einziger Node mit echter Reserve).
- **Netz:** eigenes VLAN (Netzi) statt vmbr0-untagged-/24 + default-deny-FW (§3).
- **🔴 Residual-Risiko (dokumentpflichtig für Bizzis DSFA):** Die VM liegt **innerhalb Cluster01** → geteilte **Management-Plane**: corosync, `/etc/pve` (pmxcfs cluster-weit synchronisiert), `root@pam`. Ein **Cluster01-Admin-Compromise** ODER ein kompromittierter anderer Node (→ cluster-weites pmxcfs) ist ein **realer Residual-Pfad** zur PII-VM: `qm`-Zugriff, Konsole, Disk-Snapshot-Exfil, Live-Migration. Die Netz-Isolation schützt **nicht** gegen die Hypervisor-/Cluster-Admin-Ebene.
- **Fazit A:** stärkste *Netz-/Workload*-Isolation sofort verfügbar, aber **geteilte Vertrauensbasis auf Hypervisor-Ebene** bleibt.

### Variante B — Separater Host AUSSERHALB Cluster01 (härteste Trennung)
- **Eigene Management-Plane** → kein geteiltes pmxcfs/corosync/root@pam. Der Residual-Pfad aus A entfällt vollständig.
- **🔴 Christin-Procurement-Gate:** kein sauberer in-Cluster-Pfad zu einem dedizierten Host ohne neue HW oder Disruption — pz1/pz2/pz3 sind 16-GB-Nodes (4,4 / 8,9 / 6,6 GB frei, zu klein), `.240`/`pve` tragen kritische Guests. → braucht **~32 GB Mini-PC/NUC** ODER **disruptives Node-Repurpose + Migration** der dortigen Guests.
- **Fazit B:** maximale Isolation (auch gegen die Hypervisor-Admin-Ebene), Preis = HW-Beschaffung/Disruption.

### Empfehlung (Infra-LEAD)
- **Security-Default = B** (vollständige Trennung der Vertrauensbasis ist bei Kunden-PII der saubere Weg).
- **A ist die pragmatische Sofort-Option**, *falls* Christin den geteilten-Mgmt-Plane-Residual bewusst akzeptiert (dann zwingend in der DSFA als Restrisiko führen + Cluster01-Admin-Zugang härten/minimieren).
- **→ Schnüffi konsolidiert A vs B als die eine Christin-MC.** (Ich feuere selbst KEINE Christin-MC, um Doppel-Fragen zu vermeiden — Synthese-Owner ist Schnüffi.)

---

## 3. Netz-Design (zwingend für BEIDE Varianten) — Netzi provisioniert
- **Eigenes VLAN / dediziertes L2-Segment.** Kein Bridging auf die Fleet-`192.168.20.0/24` und auf KEINE der bestehenden VLANs (3/4/6/42…). Eigener Tag, eigenes Subnetz.
- **Default-deny INGRESS + EGRESS** an der Zone-Grenze.
- **Egress-Allowlist (Zweckbindung Art. 5 auf Netz-Ebene):**
  - Anthropic-API (`api.anthropic.com` + zugehörige Auth-/Telemetrie-Endpoints des Claude-Code/Teams-Clients) — **das ist der einzige „Internet"-Pfad**.
  - die **konkret benannten Kundendaten-Quellen**, die die Seats erreichen MÜSSEN (Shop/polar.sh-API, Kunden-Mailserver, Lizenz-/Rechnungssystem, DVhub-Prod-Kundendaten-Endpoint). **Enumeration mit Bizzi je Zweck** — nichts „auf Vorrat".
  - **sonst NICHTS.**
- **Kein Pfad zur Mac** `:7890`/`:7899` (kein Inter-VLAN-Routing zum Mac-Segment). Das ist die Netz-Durchsetzung der Kernregel §0.
- **Ingress: GENAU EINE kontrollierte Ausnahme** — der Erreichbarkeitspfad des interaktiven Seats (§7), auditiert. Sonst default-deny.
- **Verifikations-Oracle (vor GO):** aus der Zone heraus `curl`/`nc` auf `192.168.20.x:7890` und `:7899` → **muss timeouten/gedroppt** sein; `api.anthropic.com:443` → erreichbar; eine nicht-allowlisted externe IP → gedroppt. Egal welche Variante.

---

## 4. Substrat — eigener Spawner, KEIN Fleet-Anschluss (mein Kern-Teil)
- **Eigener Spawner-Daemon ON dem isolierten Host/der VM**, der die 4 autonomen Seats verwaltet (Start/Stop/Respawn) **vollständig zonen-intern**. Analog zur Fleet-`spawnerd`, aber **luftdicht von der Fleet getrennt**: kein claude-peers-MCP, keine Hub-Registry, kein Broker-Socket, kein `peer/notify`. Die Zone taucht in keinem Fleet-Dashboard auf.
- **Separater Credential-Store** für das/die Teams-API-Credential(s). **NICHT** das Fleet-1Password/op-connect (LXC 141 lebt auf der Fleet). Zonen-lokaler Secret-Store (verschlüsselte Datei / `age` / zonen-lokaler Vault), damit das Teams-Credential **nie die Fleet transitiert**.
- **Getrennte Datasets/Backups:** zonen-lokaler Storage; Backup auf **separates Ziel** (NICHT der geteilte Fleet-PBS) **ODER** separater PBS-Namespace/-Datastore mit **eigenem Verschlüsselungs-Key**. → hält das Art-17-Löschkonzept sauber und verhindert, dass PII in geteilte Fleet-Backups sickert. **Entscheidungspunkt:** dediziertes Backup-Ziel vs. separierter PBS-Namespace (beide haltbar; Default = separater Namespace mit eigenem Key, wenn PBS-Kapazität reicht).
- **KEIN PII-Ingest ins Fleet-Merkel** (LXC 146). Brauchen die Seats Vektorsuche → **isolierte eigene Instanz auf isoliertem Storage** in der Zone.

---

## 5. Reboot-/Backup-Resilienz + frugaler Idle (Infra-Härtung)
- **Alle Zone-Service-Units `enabled`** (`WantedBy=multi-user.target` + `systemctl enable`): Spawner, Koord-Dienst, Seat-Runner, ggf. lokale Vektor-Instanz. Sonst kommt die Zone nach einem stop-mode-Backup-Reboot nicht von selbst hoch (Fleet-Lesson POLICY-BACKUP-REBOOT-RESILIENT).
- **Stabile IP** in der Zone (keine DHCP-Lease, die über einen Reboot wandert — Fleet-Lesson aus merkel/.81 & protectbridge/.82).
- **Frugaler Idle:** die Seats dürfen im Leerlauf **nicht** das 5h-Rolling-Limit verbrennen (kein nutzloses Loop-Polling gegen die Anthropic-API). Idle = günstig schlafen, durch den Koord-Dienst (§6) geweckt, nicht durch Busy-Wait.
- **Variante A zusätzlich:** onboot=true setzen (im Gegensatz zu den Cold-Standby-Findings 151/147); die PII-VM muss bewusst nach Wartungs-Reboot zurückkommen.

---

## 6. Seat-Rotation-State — Epoch-Fencing (Substrat für Tüftlis Continuity)
**Problem:** 5 Seats teilen sich einen Teams-Plan mit begrenzter Parallelität / 5h-Rolling-Limit. Ein erschöpfter Seat muss an einen frischen übergeben; der **zurückkehrende erschöpfte Seat darf NICHT mit veraltetem Stand weiterschreiben** (Split-Brain / Doppelverarbeitung von Kundendatensätzen).

**Mein Substrat-Teil (WO/WIE):**
- **Persistenter, transaktionssicherer State-Store ON dem isolierten Host:** zonen-internes **SQLite-Ledger** (WAL) + **authoritativer Koordinations-Dienst** (= das T-0214-Fix-Muster). Single-Writer-Koordinator vor dem Ledger; die Seats reden NUR mit dem Koord-Dienst, nie direkt mit der DB-Datei nebenläufig.
- **Claim/Lease-Modell mit Epoch:** jedes Work-Item (Kundendatensatz/Aufgabe) wird unter einem **Lease mit monotoner Epoch** (Generations-Zähler) geclaimt. Erschöpft ein Seat und wird ersetzt, **bumpt der Koordinator die Epoch** und re-leased. Wacht der erschöpfte Seat später mit **alter Epoch** auf → seine Schreibversuche werden **gefenced** (Epoch-Mismatch → reject). Kein Doppel-Write, keine verlorene Übergabe.
- **Reboot-fest:** Ledger + Epoch überleben Reboot (durable auf zonen-lokalem Storage, kein in-memory-only State). Nach Reboot rekonstruiert der Koord-Dienst die offenen Leases + die höchste Epoch aus dem Ledger.
- **Erreichbarkeit OHNE Fleet-Broker:** der Koord-Dienst ist **zonen-intern** (kein :7899/:7890). Die Seats erreichen ihn über localhost/Zone-intern, nicht über die Fleet.

**Tüftli baut darauf:** die Continuity-Logik (genaue Claim/Lease/Fencing-Semantik, Übergabe-Protokoll, Retry/Backoff). Ich liefere das Substrat (Store-Ort, Transaktionssicherheit, Reboot-/Backup-Resilienz, frugaler Idle). **Schnittstelle an Tüftli:** Koord-Dienst-API (claim/renew/release/heartbeat) + Epoch-Contract — Detail-Abstimmung mit ihm.

---

## 7. Erreichbarkeit des interaktiven Seats — OHNE Fleet-Broker
Der 1 operator-gesteuerte Seat muss von Christin erreichbar sein, **ohne** über Hub/Broker zu gehen (das bräche die Isolation).
- **GENAU EINE kontrollierte Ingress-Ausnahme** zur default-deny-Grenze: ein **zonen-lokales Web-Terminal / SSH-Jump**, erreichbar nur von **Christins Workstation-IP** (FW-Pinhole Source-pinned), **TLS**, **vollständig auditiert** (Art. 30/32).
- **NICHT** über das Fleet-Hub-Dashboard, **NICHT** über den Broker. Eine eigene, minimale, authentifizierte Tür.
- Jede interaktive Session wird im Zone-Audit-Log (§ GDPR Art. 30) protokolliert.

---

## 8. GDPR-Traceability — je Design-Entscheidung gemappt (Bizzi-Anker)
| GDPR | Anforderung | Technische Durchsetzung in diesem Design |
|------|-------------|-------------------------------------------|
| **Art. 5 (Zweckbindung)** | Daten nur für benannte Zwecke | Egress-Allowlist (§3) erlaubt NUR die zweckgebundenen Quellen; Seats können physisch nichts anderes erreichen. Zone verarbeitet ausschließlich die 5 benannten PII-Kategorien. |
| **Art. 32 (Zugriffskontrolle / Need-to-know / Risikoreduktion)** | Stand der Technik, Zugriff minimiert | VM-HW-Isolation (§1) + eigenes VLAN + default-deny (§3) + separater Credential-Store (§4) + kein Fleet-Broker (§0). **Residual (Variante A):** geteilte Mgmt-Plane — dokumentiert (§2). |
| **Art. 17 + 5(1e) (Löschkonzept / Speicherbegrenzung)** | Löschbarkeit, inkl. Anthropic-seitig | Getrennte Datasets/Backups (§4) → PII als Einheit löschbar (Zone-Teardown / Dataset-Wipe), ohne geteilten Fleet-Storage zu durchkämmen. **Anthropic-Seite:** Teams/Enterprise-Tier (AVV) muss **Zero-Data-Retention / kein Training + Löschgarantie + Datenresidenz** bieten — **Bizzi+Christin klären den AVV/ZDR-/Enterprise-Stand mit Anthropic** (Ende-zu-Ende-Löschung). |
| **Art. 30 + 5(2) (Auditierbarkeit / Rechenschaft)** | Nachweisbarkeit | Zonen-lokales Audit-Log: SQLite-Ledger (§6) + Koord-Dienst-Log + FW-/Egress-Logs + interaktiver Ingress-Log (§7). **Getrennt** von Fleet-Logs. Jeder Kundendaten-Zugriff nachvollziehbar. |
| **Art. 33/34 (Datenpannen)** | Erkennung + Meldung | **Eigener Breach-Pfad für die Zone** (separat vom Fleet-Incident-Flow, da luftdicht): Detektion über Egress-Anomalien / FW-deny-Spikes / Auth-Fehler im Koord-Dienst; definierte Melde-Kette. **Owner-Klärung mit Bizzi:** wer überwacht die Zone, wie wird eine Panne erkannt/eskaliert. |

---

## 9. Konkreter baubarer Spec (Variante A, bei GO — als Referenz; B analog auf separatem Blech)
- **PII-VM auf `proxmox`/.240:** 8 vCPU · 24576 MB · 150 GB (`local-lvm`, 228,8 GB frei) · `cpu host` · Debian 13 Trixie (Fleet-Baseline).
- **Netz:** dediziertes VLAN (Netzi-Tag) statt vmbr0-untagged-/24; statische IP.
- **In der VM (systemd, alle `enabled`):** Zone-Spawner-Daemon · Koord-Dienst + SQLite-Ledger (WAL) · zonen-lokaler Credential-Store · 4 autonome Seat-Runner (Seat-Pool) · 1 interaktiver Seat hinter dem kontrollierten Ingress (§7) · optional isolierte Vektor-Instanz.
- **FW:** default-deny in+out; Egress-Allowlist = Anthropic-API + enumerierte Kundendaten-Quellen; Ingress = ein auditierter interaktiver Pfad; KEIN Route zu Mac `:7890`/`:7899`.
- **Backup:** separates Ziel / separater PBS-Namespace mit eigenem Key.

---

## 10. Offene Entscheidungen / Blocker (NICHT autonom)
1. **🔴 Host-Boundary A vs B** — Christin-MC, **Schnüffi trägt sie in die Synthese** (Security-Default B, pragmatisch A mit dokumentiertem Residual). Bis dahin **kein Bau**.
2. **Anthropic AVV / ZDR / Enterprise + Datenresidenz** — Bizzi+Christin klären den Vertrags-/Retention-Stand mit Anthropic (Art. 17/5(1e)-Ende-zu-Ende). Downstream, blockt das Design nicht.
3. **Egress-Allowlist-Enumeration** — exakte Endpoints der Kundendaten-Quellen, Zweck-gemappt mit Bizzi. Konkretisierung vor Bau.
4. **Backup-Variante** — dediziertes Ziel vs. separater PBS-Namespace (Infra-Detail, entscheide ich beim Bau nach PBS-Kapazität; Default = separater Namespace + eigener Key).
5. **Koord-Dienst-API-Contract** — Detail-Abstimmung mit Tüftli (claim/renew/release/heartbeat + Epoch-Semantik).

---

## 11. Handoff
- **Schnüffi (`733y8dgt`):** Security-Synthese — A-vs-B als EINE Christin-MC konsolidieren; Residual-Risiko Variante A (geteilte Mgmt-Plane) in die Bewertung; §1/§3/§4/§7 security-reviewen (R22-Refute willkommen).
- **Bizzi (`43sds8sq`):** GDPR-Map gegen §8 verifizieren; Anker Art. 5/32/17+5(1e)/30/33-34; Egress-Endpoint-Enumeration (Zweckbindung); Anthropic-AVV/ZDR-Klärung anstoßen.
- **Tüftli (`6enyhavb`):** Continuity-Logik auf dem Substrat §6 (Claim/Lease/Epoch-Fencing); Koord-Dienst-API-Contract mit mir abstimmen.
- **Netzi (`o7a9xw7h`):** VLAN-Provisionierung + default-deny-FW-Regelwerk (§3), wenn die Boundary entschieden ist.
- **Hub:** Doc-Stand melden; Tätigkeitsbericht.
