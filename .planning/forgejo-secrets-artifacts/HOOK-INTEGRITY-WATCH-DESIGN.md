# hook-integrity-watch — Design-Position (Design-before-build, R22/R26)

**Zweck (§1.4-B4 + HIGH-5-Backstop):** sicherstellen, dass JEDES Secret-Repo dauerhaft den
`pre-receive`-Hook scharf hat — auch nach `forgejo admin regenerate hooks`, Upgrade, Repo-Rename,
Migration/Mirror-erzeugtem Repo, oder manueller Hook-Manipulation. Der `50-secrets`-Hook ist die
PRIMÄRkontrolle; dieser Watcher ist der BACKSTOP, der den abnormalen „Hook weg/gedriftet"-Zustand
fängt + fail-closed sperrt + alarmiert. **NICHT gebaut — wartet auf Schnüffi R22-Refute (Default=BLOCK).**

## Invarianten je Secret-Repo (alle müssen halten, sonst VIOLATION)
1. `hooks/pre-receive` (Forgejo-Dispatcher) existiert, exec, iteriert `pre-receive.d/*` (Pattern-Check).
2. `hooks/pre-receive.d/50-secrets` existiert, exec, **sha256 == golden** (`/etc/forgejo-secrets-policy/.golden-hook-sha256`).
3. `50-secrets` ist **root-owned + nicht group/other-writable** (git darf den Hook NICHT überschreiben können).
4. Repo-git-config: **`receive.procReceiveRefs` absent** (R6/R7-MED — agit-Bypass-Fläche zu).
5. `.allow`-Policy existiert + git-lesbar (sonst fail-closed-Reject ohnehin — als WARN flaggen, kein Lockdown-Trigger).

## Was ist ein „Secret-Repo"
Union aus: (a) alle Repos unter den Orgs in `/etc/forgejo-secrets-policy/secret-orgs` (eine Org/Zeile,
z.B. `dvhub`, `merkel-vault`); (b) jedes Repo mit existierender `.allow`. → Ein neues/migriertes Repo
in einer Secret-Org OHNE Hook = VIOLATION (HIGH-5). Enumeration rein FILESYSTEM-basiert (REPO_BASE/<org>/<repo>.git),
DB-unabhängig.

## Enforcement-Entscheidung (die load-bearing Wahl) — Optionen
- **(A) Forgejo-Archive via API** (`PATCH /repos/{o}/{r} {archived:true}`): sauberes Forgejo-read-only,
  ABER braucht Admin-Token IN der LXC → vergrößert Angriffsfläche (Token-at-rest). ❌
- **(B) deny-all-Hook injizieren** (`pre-receive.d/00-LOCKDOWN`, `exit 1`): token-FREI, fail-closed,
  sofort wirksam (Dispatcher failt bei jedem non-zero). ✅ GEWÄHLT.
- **(C) DB `is_archived=1`**: Forgejo cached → unzuverlässig bei laufendem Dienst. ❌
- **(D) Repo-Dir chmod/unexport**: zu grob, bricht auch Recovery-Lesen. ❌

**GEWÄHLT: (B) deny-all-Hook + Alarm.** Begründung: token-frei (kein Admin-Token in LXC = kleinere
Fläche, konsistent mit BUG-2-Lehre „weniger env/cred-Kopplung"), self-contained, fail-closed-default-deny.

## Alarm-Pfad
- **journald** (immer, strukturierte Zeile je VIOLATION, OHNE Secret-Wert) + Marker-Datei
  `/var/lib/forgejo-secrets/violations/<org>__<repo>.violation` (root-only).
- **Uptime-Kuma Push-Monitor** (uptime.bottom.zone, von LXC 160 erreichbar): healthy-Tick je Lauf
  (status=up) bzw. status=down+msg bei VIOLATION → Kuma alarmiert die Flotte. Monitor anlegen = Setup-Schritt.

## systemd
- `hook-integrity-watch.service` (Type=oneshot, läuft das Script) + `.timer` (OnBootSec=30s, OnUnitActiveSec=60s).
- **Beide `enabled`** (`WantedBy=timers.target`) → überlebt Backup-Stop-Reboot (Fleet-Policy).
- Nach `forgejo admin regenerate hooks`/Upgrade: 60s-Timer fängt Drift selbst; zusätzlich manueller Run im Upgrade-Runbook.

## Self-Refute (vor Schnüffi-Cross-Refute)
- **Race-Fenster Drift→Detektion ≤ Timer-Intervall (60s):** ein Angreifer könnte Hook entfernen UND
  innerhalb 60s pushen. Akzeptabel für einen BACKSTOP (Primärkontrolle = der Hook selbst im Normalzustand);
  Tightening via inotify-Watch (sofort statt 60s) = Enhancement, dokumentiert. **Frage an Schnüffi: reicht
  60s-Timer oder inotify-Pflicht?**
- **deny-all-Hook selbst entfernbar:** wer den hook-dir schreiben kann, kann auch 00-LOCKDOWN entfernen.
  Aber: (i) Hook-dir ist git-owned, der Push-User-Pfad geht über den Dispatcher (nicht beliebiges Schreiben);
  (ii) der „Hook fehlt"-Zustand triggert beim nächsten Tick erneut Lockdown + Alarm ist schon gefeuert.
  Backstop+Alarm, kein Mutex. Ehrlich so dokumentiert.
- **golden-hook-Kompromiss:** golden = sha256 der kanonischen lib (root-owned). Wenn root kompromittiert → game over
  ohnehin (gilt für die ganze Kette). Golden root-only + nur beim Deploy aktualisiert.
- **Watcher selbst gekillt:** systemd `Restart`/Timer + Kuma-„kein-Heartbeat"-Alarm fängt einen toten Watcher
  (Kuma push-monitor mit erwartetem Intervall → ausbleibender Tick = Alarm).
- **.allow git-lesbar (0644) = auch other-lesbar:** Inhalt = age-PUBLIC-keys (nicht geheim) → unkritisch.
- **False-Positive-Lockdown (legit Forgejo-regenerate setzt Hooks neu):** regenerate überschreibt NICHT
  `pre-receive.d/50-secrets` (Forgejo verwaltet nur seine eigenen `gitea`-Dateien) → kein False-Positive;
  ABER falls regenerate die ganze `.d` neu anlegt, fehlt 50-secrets → korrekt als VIOLATION erkannt → re-deploy nötig.
  Deploy-Schritt muss 50-secrets nach jedem regenerate re-installieren (Runbook).

## Akzeptanz-Oracle (nach Bau, vor Sign-off — gemessen, R31)
1. Repo mit korrektem Hook → kein Lockdown, Kuma=up. 2. 50-secrets gelöscht → 00-LOCKDOWN gesetzt + Push REJECT + Kuma=down.
3. 50-secrets-Byte geändert (sha-Drift) → Lockdown. 4. Hook group-writable gemacht → VIOLATION.
5. `git config receive.procReceiveRefs refs/for` gesetzt → VIOLATION. 6. neues Repo in Secret-Org ohne Hook → Lockdown.
7. Lockdown reversibel: golden-Hook re-deployed + 00-LOCKDOWN entfernt → Push wieder ACCEPT.

## Schnüffi R22-Design-Refute (29b6f40) + Canary-Verify des BLOCKERs (2026-06-22)
Schnüffi: Grundwahl SOUND, deny-all-Hook (B) ENDORSED, **1 BLOCKER**: Invariante #3 prüft die Hook-DATEI,
aber LÖSCHUNG hängt am VERZEICHNIS — git-writable `hooks/`bzw.`pre-receive.d/` ⇒ git kann root-owned
50-secrets (UND 00-LOCKDOWN) trotzdem löschen. → **am Canary verifiziert (nicht angenommen):**
- ✅ Hook-DIRS `root:root 0755` → **Push funktioniert weiter** (Forgejo braucht Dir-Write nicht für Push).
- ✅ git-User kann root-owned `50-secrets` **NICHT löschen** (rm exit≠0, Hook bleibt) und **keine Datei einschleusen**.
- ✅ Dispatcher **fail-fast bestätigt**: `00-LOCKDOWN(exit1)+99-noop(exit0)` → REJECT (deny-all wirkt, reihenfolge-egal).
- ⚠️ `forgejo admin regenerate hooks` als git in root-owned Dir = write-needing → Runbook: regenerate/Upgrade als
  ROOT (oder Dir temporär git-writable) + danach re-harden + 50-secrets re-deployen; integrity-watch erkennt Fehlen.

### NEUE Invariante (BLOCKER-Fold)
6. **Hook-DIRS `hooks/` + `hooks/pre-receive.d/` root-owned + nicht-git-writable (0755).** Verifiziert (s.o.):
   schließt die Dir-Level-Lösch/Inject-Attacke; macht 50-secrets + 00-LOCKDOWN git-immutabel.

### Antworten auf die 2 Design-Fragen (durch BLOCKER-Fold beantwortet)
- **Frage 1 (token-frei deny-all-Hook B):** Schnüffi ENDORSE — Admin-Token-at-rest = schlechtere Fläche.
- **Frage 2 (60s vs inotify):** **60s-Timer REICHT** — da der Hook (root-owned Dir) git-UNLÖSCHBAR ist, kann Drift
  nur durch root/admin/regenerate entstehen = KEIN Angreifer-Push-Race. inotify nicht nötig (nur optionales Enhancement).

## Codex-Fold R1 (gpt-5-codex, 2026-06-22 ~09:10Z) — GEBAUT + gefoldet
Voller R22-Refute des GEBAUTEN Watchers. Codex fand echte Bypass-Klassen, die der Design-Refute übersah:
- **BLOCKER core.hooksPath:** git-User kann in der git-writable Repo-Config `core.hooksPath` auf ein
  leeres Dir setzen → `git receive-pack` sucht den Hook woanders → weder Dispatcher noch 50-secrets
  noch Lockdown laufen, OHNE 50-secrets zu berühren. → **inv #7** core.hooksPath absent (repo-local
  + git-user-global, da `git config` als root `~git/.gitconfig` NICHT sieht) + beim Lockdown neutralisieren.
- **Authoritativer Lockdown:** ein `pre-receive.d/00-LOCKDOWN` ist wirkungslos, wenn der Dispatcher
  selbst gebrochen/umgangen ist → Lockdown ersetzt jetzt **top-level `hooks/pre-receive` selbst** durch
  einen root-owned deny-all + neutralisiert Redirect-Config.
- **inv #8** repo.git/config root-owned + nicht-git-writable. **ACL-aware** `runuser -u git test -w`
  (mode-check ist ACL-blind). **inv #1b** Dispatcher root-owned (git-owned Dispatcher = in-place-rewritebar).

## Codex-Fold R2 (gpt-5-codex, 2026-06-22 ~09:25Z) — Architektur-Fold
Mit Datei-Zugriff. Bash-Korrektheit BESTÄTIGT (nameref ok, kein exit-Masking, Arrays sauber). 4 tiefere BLOCKER:
- **BLOCKER#2 Directory-Entry-REPLACE-Race (Kern):** auch wenn jede DATEI root-owned ist, kann git im
  writable `repo.git/` Einträge UMBENENNEN: `mv config config.root; echo evil>config; push; restore`.
  Der 60s-Timer schließt den sub-60s-Race NICHT. → **Architektur-Konsequenz:** der Watcher ist ein
  **VERIFIER eines DEPLOY-erzwungenen Immutabilitäts-Baselines, nicht der Erzeuger** der Immutabilität.
  **inv #9:** integritätskritische Einträge (config, hooks/, pre-receive.d/, Dispatcher, 50-secrets)
  sind `chattr +i` (immutable) → git kann sie weder modifizieren noch umbenennen noch unlinken. Der
  Watcher VERIFIZIERT das (lsattr); der DEPLOY setzt es. Das macht den 60s-Timer erst sound.
- **BLOCKER#1** globaler core.hooksPath erkannt aber nicht neutralisiert → `neutralize_global()` entschärft
  die SOURCE vor LOCK-ALL. **BLOCKER#3** Lockdown-Erfolg nicht verifiziert → `verify_lockdown()` +
  exit4 `LOCKDOWN-FAILED` (Kuma "REPOS EVTL. OFFEN"). **BLOCKER#4** include-Bypass → `git config
  --includes --show-origin` + Origin-Integritäts-Prüfung. **HIGH** unsichere git-erreichbare Global-Config
  ohne aktiven Wert (Race-Enabler) → config_fail.

## Akzeptanz-Oracle — GEMESSEN 31/31 GRÜN (R31, lokal TEST_MODE)
`hook-integrity-watch-oracle.sh`: 7 Design-Fälle + V1a Dispatcher-fail-fast + V1b authoritativer deny-all
blockt + V1c/d + V2a-e Config-Integrität + V3 Kuma up/down + V5 kein-Secret-im-Marker + C1 core.hooksPath
+ C2 repo-config + C3 global-bypass+source-neutralize + C4/C5 include-bypass (repo+global) + LF1 exit4.
**Immutabilität (inv #9) + Root-Ownership + ACL = prod-only** (TEST_MODE skippt, da non-root) → separater
LIVE-Canary-Lauf als root auf LXC 160.

## 🔴 R22-ARM-GATE — Architektur-Entscheidung für Schnüffi (vor Scharf-Schalten)
1. **Enforcement-Modell** (load-bearing): **(A) chattr-Immutabilität** der per-repo-Einträge [GEWÄHLT,
   implementiert — least-invasive, per-Eintrag, Watcher verifiziert via lsattr] vs. **(B) git-Wrapper
   forced `-c core.hooksPath=<root-dir>`** (zentral, command-line schlägt jede config, aber Forgejo-
   Launch-Integration + upgrade-brittle). Schnüffis Call.
2. **Canary-Live-Verifikation (kann ich nicht autonom, gated):** verträgt Forgejo 15.0.3 immutable
   `repo.git/config` + `hooks/` (bleibt Push grün)? Unterstützt das LXC-FS `chattr +i`? regenerate/upgrade-
   Runbook mit `chattr -i` → re-harden. → Live als root auf LXC 160 (reversibel, Canary).
3. **Deploy-Runbook-Ergänzung:** chattr +i auf config/hooks/pre-receive/pre-receive.d/50-secrets;
   Dispatcher root-chown; git-user-global config root-owned/immutable; secret-orgs/golden/violations/
   .kuma-push-url root-owned; systemd .service/.timer enabled; Kuma-Push-Monitor anlegen.

## Status
- [x] Schnüffi R22-Design-Refute (29b6f40): Grundwahl sound, B endorsed, 1 BLOCKER → gefoldet (inv #6).
- [x] Watcher + systemd-Units + Oracle GEBAUT (`hook-integrity-watch.{sh,service,timer}` + `-oracle.sh`).
- [x] Codex R22-Refute R1 + R2 gefoldet; Oracle 31/31 grün; bash -n grün.
- [ ] Codex R22-Refute R3 (Konvergenz-Check) — läuft.
- [ ] **Schnüffi: R22-Arm-Gate-Entscheidung (Enforcement-Modell A/B) + Review der gefoldeten Watcher-Artefakte.**
- [ ] **LIVE-Canary-Verifikation als root auf LXC 160** (Forgejo-Immutabilitäts-Toleranz + Oracle inkl. inv #9).
- Entkoppelt vom Arm-Fix; beide vor erstem echten Secret.
