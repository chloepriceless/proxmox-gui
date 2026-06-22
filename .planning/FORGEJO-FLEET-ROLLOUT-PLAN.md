# Fleet-weiter Forgejo-Rollout — Plan v0 (Rollout-HEAD: Schraubi/vm-deployment-gui)

**Christin-Entscheid (2026-06-22 ~17:57Z, via Hub f73n74ge):** EIN interner Git.
- **Forgejo `.172`/LXC 153 (privat) = ALLES Interne:** `.planning/`, `.claude/`+CLAUDE.md, Claude-Kontext, interne Docs/Runbooks/Planung. Zugleich Backup (PBS). Nur private Repos.
- **GitHub (public) = NUR reiner öffentlicher Programm-Code + Public-Doku.** Sonst nichts.
- = meine Empfehlung **Option A scope-erweitert** (NICHT B/C). Cluster-Trust-Modell akzeptiert. `.59`/LXC 160 wird absorbiert/abgerissen.

Vorgänger-Docs (nicht duplizieren): `FORGEJO-CONSOLIDATION-RECOMMENDATION.md` (4d5abca) · `orchestrator-security/reviews/2026-06-22-secrets-forgejo-consolidation-R22-refute.md` (f46a52d) · `forgejo-secrets-artifacts/` (Hook/Watcher/Oracle/Canary-Runbook).

> **⚠️ v0 PENDING:** Tiering (s.u.) ist beim Hub zur Christin-Bestätigung. Bis dahin Plan-Struktur, kein Massen-Push.

---

## 1. Ziel-Zustand
| Daten | Zuhause | Schutz |
|---|---|---|
| Öffentlicher Programm-Code + Public-Doku | GitHub (public) | — |
| Interne Docs/Runbooks/Planung OHNE eingebettete Klartext-Secrets (**Tier-I**) | Forgejo .172, **privates Repo** | Privat + Zugriffskontrolle + Backup |
| `.planning`/`.claude`/CLAUDE.md/Repos MIT echten Secrets (**Tier-S**) | Forgejo .172, **privates Repo + SOPS** | SOPS+age (Keys off-host) + fail-closed-Hook + 5 Bedingungen |

## 2. Tiering (Kern — PENDING Christin-Bestätigung via Hub)
„Alles Interne" ist nicht homogen. Zwei Tiers, weil der schwere SOPS-/Hook-Gate nur dort nötig ist, wo echte Secrets liegen:
- **Tier-I (Masse):** kann SOFORT rollen — gating nur (a) Account/Repo-Provisioning, (b) Backup-Robustheit. KEIN SOPS-Gate.
- **Tier-S:** voller Gate (§4). Viele `.planning`/`.claude`-Inhalte sind Tier-S (z.B. API-Keys in CLAUDE.md) → pro Repo klassifizieren (Klartext-Secret-Scan beim Onboarding entscheidet Tier).
- **Klassifikations-Default bei Unsicherheit:** Tier-S (konservativ — lieber zu viel schützen).

## 3. Gate-Reihenfolge (was vor was)
```
[Provisioning-Standard] ──┐
                          ├─→ Tier-I Massen-Rollout (parallel, sobald Backup-Gate grün)
[Backup-Robustheit] ──────┘
[Tier-S-Gate: 5 Bedingungen + .172-Canary + Schnüffi-Sign-off] ─→ Tier-S-Rollout (nachgelagert)
```
- **Pre-Mass-Gate (gilt für ALLE Tiers):** Backup-Robustheit (§5(i)) — bevor .172 das einzige Zuhause ist.
- **Tier-S-Gate (nur Tier-S):** §4.

## 4. Tier-S-Gate — 5 Bedingungen (Schnüffi f46a52d) + Status
1. Alle Write-Pfade scanner-abgedeckt (canary-bewiesen) ODER hart aus: Web-Editor, Contents-API, Merge/Squash/Rebase, Actions-Commits, LFS, Mirrors, Uploads/Packages, Wiki. — **OFFEN** → `.172`-Write-Path-Canary.
2. Actions für Secret-Repos hart AUS ODER Runner unerreichbar (Actions=RCE). — **OFFEN**.
3. Kein CI-Token an Secret-Repos außer minimalem repo-Deploy-Key ohne Admin; breite PATs/Admin-Tokens inventarisieren. — **OFFEN**.
4. Scanner-Invariante = Push-Hook + periodischer **Full-Repo-Object-Scan** (reachable refs/tags/PR-refs/LFS/Wiki/Packages). — **TEILWEISE** (Push-Hook gebaut + Schnüffi-code-signed 127c653; periodischer Full-Scan noch zu bauen).
5. Decrypt-Surface separat modelliert (op-connect/Consumer/Backups/Logs/Memory/Swap/Runner-Artefakte) = §8. — **OFFEN** (Operator/proxmox).

**.172-Canary (bei Rollout):** mein `CANARY-RUNBOOK-LXC160.md` adaptiert direkt. Bei Entscheid A mergen die zwei Canary-Stränge zu EINEM .172-Canary (Schnüffi-gepinnt): (1) hook-integrity-watch-Arming-Evidenz (Dir-Immutabilität + receive-pack env/argv/cwd-Dump) + (2) Write-Path-Coverage. Schnüffis finaler Arming-Re-Sign-off gated auf BEIDE grün.

## 5. Blocker / Pre-Mass-Gates
- **(i) PBS-Backup-Robustheit [REAL, Pre-Mass-Gate]:** PBS-Host .240 crasht wiederholt (Tapsi: 3× im 02:00-Fenster). Wenn .172 das Backup-of-Record wird, muss das robust sein. Teil-mitigiert (Daten leben verteilt in Peer-Working-Copies + git-Historie = kein Single-Copy), aber nicht ausreichend für „einziges Zuhause". → **Owner Tapsi/proxmox-master** (.240-RCA läuft). Rollout-HEAD hängt es als Gate vor den Massen-Push.
- **(ii) Secrets-Arming [OFFEN, gated NUR Tier-S]:** hook-integrity-watch + .172-Write-Path-Canary, operator-gated (Live-Touch). Blockt NICHT den Tier-I-Massen-Rollout.
- **(iii) Privilegierter DinD-Runner LXC 154 [unabhängiger dominanter Fix]:** privileged+nesting+DinD = CI-Job kann auf pz2-Host-Root → Cluster-Root ausbrechen. Fleet-weites Risiko, egal welche Topologie. Rootless/unprivileged fixen. → **Schnüffi/proxmox-master** (eigener Task; kann CI brechen).

## 6. Koordination
- **Frischi (Provisioning):** Account/Token-Standard je Peer. Recipe steht (`forgejo admin user create` + `generate-access-token --scopes write:repository`); `voeltchen` angelegt. → Tier-I sofort onboardbar.
- **Schnüffi (Tier-S-Gate + Public-Scrub-Gate):** (1) Write-Path-Coverage-Verdikt + finaler Arming-Sign-off gg. .172-Canary-Evidenz; (2) Public-Scrub-Gate G0–G5 für P4 (Spec fcd375a). Sie braucht von mir zur Erdung (dann R22-Codex-Refute): **(I) Rollout-Mechanik** (wie wandert Internes — push zu neuem privaten Forgejo-Repo? .planning aus public-Repo + History-Scrub); **(II) Repo-Inventar** (welche Repos public + welche haben interne History = Scrub-Kandidaten); **(III) Secret-Rotation-Owner pro Typ**. Sequenz: erst Tier-S-Gate, dann Public-Scrub.
- **Tapsi/proxmox (Backup):** PBS/.240-Robustheit als Pre-Mass-Gate.
- **Hub f73n74ge:** Stufenmeldungen. Christin-Bestätigung der Tiering-Lesart.
- **Völtchen/DVhub:** NICHT antreiben (Christin führt DVhub selbst; bereits onboardet).

## 7. Phasen (v0)
- **P0 — jetzt:** dieser Plan + Christin-Tiering-Bestätigung + Frischi/Schnüffi/Tapsi-Sync.
- **P1 — Tier-I-Massen-Rollout** (nach Backup-Gate): Provisioning-Standard ausrollen, Peers onboarden, interne Nicht-Secret-Repos auf .172 (privat). Parallel.
- **P2 — Tier-S-Gate-Erfüllung:** .172-Write-Path-Canary + 5 Bedingungen + periodischer Full-Scan + Schnüffi-Sign-off.
- **P3 — Tier-S-Rollout + .59/LXC160-Abriss:** Secret-Repos mit SOPS auf .172, dann 160 abreißen (verlustfrei — kein Secret auf 160 gelandet).
- **P4 — GitHub-Bereinigung / Public-Scrub (Schnüffi-Gate G0–G5, Spec fcd375a):** public Repos auf reinen Programm-Code + Public-Doku reduzieren. **2 irreversible Leak-Richtungen (Schnüffi):** FORWARD (Internes neu nach GitHub) + **RESIDUAL** (Internes liegt SCHON in der GitHub-History → bloßes Löschen scrubbt NICHT, bleibt per-SHA/Forks/Cache). Pro Repo Gate G0–G5, Default=BLOCK: Klassifikation (positive Allowlist) · Secret-Scan Working-Tree + VOLL-History · Internal-Exclusion (.planning/.claude gitignore+untracked) · History-Scrub (filter-repo/Repo-Recreation; orphaned-SHA/Forks-Caveats; **geleaktes Secret IMMER rotieren — Scrub ≠ Rotation**) · Forgejo-Ziel absichern (kein Privat-Repo→GitHub-Mirror) · **Post-Verify von EXTERNER Vantage** (nicht Haus-IP = Blindspot). DVhub-Muster (Völtchen, gefilterter Public-Push v1.0-dev) als Referenz.

## 8. Offene Punkte / Entscheidungen
- [ ] Christin: Tiering-Lesart bestätigen (Tier-I sofort / Tier-S gated)?
- [ ] Granularität SOPS in Tier-S: ganzes Repo SOPS vs. nur secret-bewehrte Files? (→ Schnüffi/Design)
- [ ] Klassifikations-Mechanik Tier-I vs Tier-S beim Onboarding (Klartext-Secret-Scan).
- [ ] Backup-Robustheits-Kriterium konkret (was = „robust genug" für einziges Zuhause?) → Tapsi.

**Status:** v0, Hub-Antwort raus, Christin-Tiering-Bestätigung ausstehend. Kein Massen-Push vor Backup-Gate + Tiering-Confirm.
