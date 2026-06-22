# HANDOVER — Proxmox-GUI Head / Infra-LEAD ("Schraubi")

**Updated:** 2026-06-22 ~05:45Z (Respawn-Session). **Branch:** `fix/release-review-blockers` @ `b28256c` (pushed, clean tree, in sync).
**⚠️ Dieses Doc ist sekundär — die KANONISCHE Resume-Quelle ist `project-open-tasks.md` (oberster FORGEJO-Block, voll aktuell). Hier nur der Kurz-Stand.**
**Peer-IDs (2026-06-22):** Hub-Sub=`f73n74ge`, Schnüffi(Security)=`per6ezmd`, Bizzi(Compliance)=`lnfo8eyv`, Netzi(Netz/VLAN)=`fqj85asg`, Tapsi(Backup)=`eib2hvyt`, Sentinel=`hgm1sq49`, Brettli(dashboard)=`r3uw9iuv`, DVhub=`oqklpiue`. Hub-Key=`vm-deployment-gui`.

## 🔵 AKTUELLER STAND (2026-06-22 ~05:45Z)
**AKTIV — FORGEJO Secrets-Server SOPS-Modell:** Base steht (LXC 160 @ pz3, .59:3000). SOPS+age + Bootstrap-Cred-Modell designt → `.planning/FORGEJO-SECRETS-SOPS-MODEL.md` (commit b28256c). **Refute-R1 (R26 Claude-Lens) DURCH: 4 BLOCKER+5 HIGH+3 MED, alle gefoldet.** **Schnüffi-Lens-2 LÄUFT** (sie bestätigte 05:42Z, fährt GPT-codex-Lens, R22 Default=BLOCK). **Nächster autonomer Schritt = ihre Befunde folden (T-0244-Stil), dann Sign-off → Implementierungs-Artefakte + Härtung.** Details: `project-open-tasks.md` oberster Block.
**T-0244 AVV-Zone: STUFE 1 APPLIED + verifiziert** (commit 8a1ebf5). VM 159 läuft netz-los auf pz2, alle 18 Isolations-Artefakte via cicustom vendor= deployt, Serial-verifiziert (netns-Topologie läuft, 5 Seat-netns). Beide Isolations-Schichten waren nach 9+19 Cross-Lab-Refute-Runden R22-grün. **Stufe 2 = alles extern/gated** (Netzi VLAN50 + Provider-Pin V1 + Schnüffi-Broker + R3-Merkel + Christin-DSFA-GO-LIVE-STOP). KEIN Live-Touch ohne Go.
**Beim Neustart:** `project-open-tasks.md` oberster FORGEJO-Block lesen (kanonisch). Wenn Schnüffis Lens-2-Verdikt da ist → folden wie T-0244 R1-R9. Sonst extern-gated. Andere Stränge (unten) bleiben blockiert.

---

## 🔴 AKTIVE AUFGABE: T-0244 Kundendaten-Isolations-Design (Infra-LEAD-Teil)
**Ziel:** Technisches Host/Infra-Isolations-Design für EINE hart isolierte Kundendaten-Zone. **5 Claude-Teams-Seats (AVV, nicht Pro):** 4 autonom + 1 interaktiv, verarbeiten NUR Kunden-PII (Lizenzverwaltung, Shop/polar.sh, Kunden-Mail, Rechnungen, DVhub-Prod-Kundendaten). **Kernregel: kein Cross-Talk zum Fleet-Broker :7899.** Co-Owner: Schnüffi=Security/Synthesizer, Bizzi=Compliance, Tüftli=Continuity-Logik. **Design-only, KEIN Bau** (Nacht + gated).

**Stand:** Design-Workflow `wh4fcl216` (find→adversarial-refute Security/GDPR/Ops→synthesize) wurde bei der Flotten-Pause **GESTOPPT** (mitten in Refute/Synth, kein Output).
- **Resume-Option (Workflow):** `Workflow({scriptPath: "/mnt/claude-config/projects/-home-dev-vm-deployment-gui/a92b0ce4-db0f-49e6-a79e-5f2c590c98be/workflows/scripts/t0244-kundendaten-isolation-design-wf_dbb07cb2-b33.js", resumeFromRunId: "wf_dbb07cb2-b33"})` — fertige Agents kommen aus Cache.
- **EMPFOHLEN (sparsam):** Das Design ist fachlich BEREITS ENTSCHIEDEN (s.u.). Statt teuren Workflow-Resume reicht es, das Design-Doc **direkt selbst** zu schreiben (`.planning/T0244-ISOLATION-DESIGN.md`) mit dem Konsens unten, committen, an Hub + Schnüffi (`733y8dgt`) + Bizzi (`43sds8sq`) liefern. Niedriger Effort genügt — Inhalt steht.

**FACHLICHER KONSENS (steht, peer-bestätigt):**
- **VM, nicht LXC** (Shared-Kernel-LXC für PII unvertretbar). Mit Schnüffi entschieden.
- **Host-Boundary = Christin-MC (A vs B)**, Schnüffi bringt sie in seine Synthese:
  - **A** = sofort baubar: PII-VM auf proxmox/.240 (z.B. 8c/24G/150G in ~80G Headroom) + eigenes VLAN + default-deny-FW. **Caveat:** geteilte Cluster01-Management-Plane (corosync/`/etc/pve`/root@pam → Cluster-Admin-Compromise = realer Residual-Pfad) → dokumentpflichtig für Bizzis DSFA.
  - **B** = härteste Trennung (separate Management-Plane), **Christin-Procurement-Gate**: ~32GB-Mini-PC/NUC ODER disruptives Node-Repurpose+Migration. Kein sauberer in-Cluster-Pfad (pz1/2/3 zu klein+voll; .240/pve tragen kritische Guests).
  - Security-Default = B; Isolationsstärke vs. HW-Spend = bewusste Christin-Entscheidung.
- **Beide Varianten zwingend:** eigenes VLAN (Netzi) + default-deny-egress (nur Anthropic-API-Allowlist) + KEINE :7899/:7890-Erreichbarkeit.
- **Substrat (mein Unterbau-Teil):** eigener Spawner (NICHT fleet-registriert, kein claude-peers-MCP/Broker) · separater Credential-Store (Teams-API) · getrennte Datasets/Backups · KEIN PII-Ingest ins Fleet-Merkel (bei Vektorsuche: isolierte eigene Instanz). **Seat-Rotation-State** = persistenter, transaktionssicherer Store ON dem isolierten Host (Claim/Lease), **Epoch-Fencing-tauglich** (zurückkehrender erschöpfter Seat darf mit veralteter Epoch nicht weiterschreiben). Tüftli baut Continuity-Logik darauf (Zone-internes SQLite-Ledger + auth. Koord-Dienst = T-0214-Fix); ich liefere WO/WIE + Reboot/Backup-Resilienz + frugaler Idle + Erreichbarkeit des interaktiven Seats ohne Fleet-Broker.
- **GDPR-Traceability (Bizzi-Anker):** Art. 5 / 32 / 17+5(1e) (inkl. Anthropic-seitige Löschung + ZDR/Enterprise-Klärung) / 30+5(2) / 33-34.

---

## ✅ ERLEDIGT diese Session (2026-06-20 Abend, Flotten-Aktivierung)
- **Inventar-SSOT FERTIG** (commit `b5b4f20`, gepusht): `.planning/INFRA-INVENTORY-SSOT.md` (60 Guests/5 Nodes Cluster01) + `.planning/protectbridge/HANDOFF-158-VORBEREITUNG.md`. Merkel-Finding+Lesson ingested (id 430335fa…), Hub-Tätigkeitsbericht gepostet.
- **Trust-but-verify-Fix:** Recon-Agent klassifizierte LXC-privileged FALSCH (131+158) → cluster-weit gegen `/etc/pve` re-verifiziert. 6 priv-LXC: 131/109/154/110/158/145. (Lesson: security-kritische Booleans nie aus LLM-Recon, immer Ground-Truth.)

## Schlüssel-Infra-Fakten (verifiziert, read-only)
- **Cluster01:** proxmox/.240 (128G/32c, ~80G frei = EINZIGER Headroom-Node) · pve/.241 (63G/16c, überbucht) · pz1/.68 + pz2/.42 + pz3/.106 (je 16G, eng: 4.4/8.9/6.6G frei). `/etc/pve` cluster-geteilt (pmxcfs/corosync).
- **Mac:** Hub :7890 (node) + Broker :7899 (bun), beide 0.0.0.0. spawnerd :7901 (Tüftli). Spawner-Code `/home/dev/orchestrator/spawner`.
- **Merkel** = LXC146@pz2 (.81, :8000/:6333/:8080) = geteilte Fleet-Vektor-DB.
- **Zugang Nodes:** `ssh -i ~/.ssh/orchestrator_ed25519 root@<ip>` (read-only verifiziert; proxmox/.240 TABU außer read/stop). LXC-intern `pct exec <id>`.

## Andere offene Stränge — alle extern-blockiert (NICHT autonom, nicht nachts)
1. **T-0116/E2 Exec-Key** — Conditional-GO, G2(a) erledigt; Rest (G3 Canary-IP/.176, G5-Egress, G2 b-e) = **waches Fenster, NICHT nachts**. Semaphore live LXC150@pz3 (.176:3000). Peers: Schnüffi=069v6usj(alt)/733y8dgt, Frischi.
2. **T-0239 Debian-VM 151@pve** (.197) — gebaut+verifiziert, dann Hub-HOLD (blocked auf Christin: behalten/stoppen/wegwerfen). PW im cloud-init-Snippet auf pve.
3. **ProtectBridge LXC158@pz2** — Advisory raus; offen: DHCP-Res (Netzi), NetBoard-Eintrag (Patchi). Paket fertig in `.planning/protectbridge/HANDOFF-158-VORBEREITUNG.md`.
4. **T-0204 Cutover** — Owner-Impl (Broker/spawnerd/Brettli/Kuma) + Schnüffi + Netzi.
5. **Semaphore 157-DESTROY** (stopped, Rollback-Sicherung) — Christin Go/No-Go.
6. **Blocker-2 Quota-TOCTOU** — Produkt-Entscheid (`.planning/QUOTA-RESERVATION-DESIGN-PROPOSAL.md`).
7. **T-0187** — MaxMind GeoLite2-Key-Gate.

## Beim Neustart (SPARSAM, ~03:15)
1. Ledger (`GET/POST localhost:7890/api/agent-open-tasks`) + dieses Doc + `project-open-tasks.md` (oberster Block) lesen.
2. **T-0244 fortsetzen** (Priorität): Design-Doc direkt schreiben (Konsens steht) ODER Workflow-Resume → committen → an Hub + Schnüffi + Bizzi liefern. Niedriger Effort reicht.
3. Kein prod-/E2-Touch (Nacht/gated). Andere 7 Stränge bleiben blockiert.
- Ledger `POST localhost:7890/api/agent-open-tasks` · Tätigkeitsberichte `POST /api/activity-reports` · Merkel `POST http://192.168.20.81:8000/ingest`.
