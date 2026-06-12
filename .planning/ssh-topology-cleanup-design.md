# SSH-Topologie-Cleanup — Design-Position (R26 deliberate, R22 vor Live-Touch)

## ✅ AUSGEFÜHRT + VERIFIZIERT (2026-06-12 ~15:50) — 7/7 Hosts Single-Mode
**Frischi parkte sein Play → Concurrency-Blocker weg → ausgeführt.** Prozedur pro Host: `disable --now ssh.socket` + `mask ssh.socket` + `enable ssh.service` + `mkdir -p /run/sshd` + `restart ssh.service`. Control-Channel = `pct exec` (von Host-SSH unabhängig → kein Lockout-Risiko).

| Host (distro) | Listener==MainPID | systemd-fd | ssh.socket | sshd -t | ext. SSH von .174 |
|---|---|---|---|---|---|
| sonarr-anime (trixie, Canary) | ✓ 7049 | 0 | masked | clean | landet ✓ |
| radarr (trixie) | ✓ 3432 | 0 | masked | clean | landet ✓ |
| sabnzbd (trixie) | ✓ 1369 | 0 | masked | clean | landet ✓ |
| fileflows (bookworm) | ✓ 127906 | 0 | masked | clean | landet ✓ |
| tapsi (trixie) | ✓ 119697 | 0 | masked | clean | landet ✓ |
| caddy-proxy (trixie) | ✓ 1405470 | 0 | masked | clean | landet ✓ |
| checkmk (bookworm) | ✓ 1899804 | 0 | masked | clean | landet ✓ |

**Reboot-Probe (Boot-Persistenz, der Race war ein Boot-Problem):** radarr (trixie) + checkmk (bookworm) rebooted → nach Boot je nur 1 standalone-sshd-Listener (==MainPID), `systemd-fd=0`, `ssh.socket` weiter masked, frische ext. SSH landet. **Single-Mode überlebt Reboot auf BEIDEN Distros.**

**Ziel-Zustand erreicht:** genau 1 SSH-Modus pro Host (klassischer always-on `ssh.service`), `ssh.socket` masked → Frischis `reload ssh.service` + `AddressFamily inet`-v6-Härtung greifen jetzt als Standard. **unpoller (148) gestoppt → N/A** (bei Reaktivierung gleich behandeln). **Rollback** pro Host: `systemctl unmask ssh.socket && systemctl disable ssh.service && systemctl enable --now ssh.socket`.

---



**Problem (Frischi-Fund, von mir verifiziert):** Die Fleet-LXCs haben `ssh.service` UND `ssh.socket` **beide enabled**, meist beide active → Doppel-Bind/Race um :22 beim Boot. Symptome: `systemctl reload ssh` failt, `restart ssh.socket` refused ("ssh.service already active"), und ein per-Host-`AddressFamily inet` schließt den v6-Listener nicht (Socket bindet ihn, nicht sshd).

## Gemessener Ist-Zustand (pct exec, 2026-06-12)
| Host | ssh.service | ssh.socket | :22-Binder | codename |
|---|---|---|---|---|
| sonarr-anime (122) | enabled/active | enabled/**inactive** | nur sshd(pid) | trixie |
| radarr (123) | enabled/active | enabled/active | **sshd + systemd (Doppel!)** | trixie |
| sabnzbd (121) | enabled/active | enabled/active | (Doppel erwartet) | trixie |
| fileflows (113) | enabled/active | enabled/active | (Doppel erwartet) | **bookworm** |
| tapsi (145) | enabled/active | enabled/active | (Doppel erwartet) | trixie |
| caddy-proxy (200) | enabled/active | enabled/active | (Doppel erwartet) | trixie |
| checkmk (149) | enabled/active | enabled/active | **sshd + systemd (Doppel!)** | **bookworm** |

**Schlüssel-Messung:** Auf allen geprüften Hosts hält der **standalone `ssh.service`-sshd `:22` eigenständig** (MainPID-sshd im `ss`-Output). Wo die Socket zusätzlich active ist, hat sie einen 2. Listener-fd auf :22 (Doppel-Bind). `ssh.socket Accept=no`. Heterogen: Mix Debian 12 (bookworm) + 13 (trixie).

## Entscheidung: Option A — `ssh.socket` disablen, klassischen `ssh.service` behalten
**Begründung (objektiv besser, keine reine Präferenz):**
1. **Konsistent über die Heterogenität:** klassischer always-on sshd verhält sich identisch auf bookworm UND trixie. Socket-only (Option B) wäre auf bookworm divergent/mehr Aufwand (dort war Socket-Activation nie Default).
2. **Macht Schnüffis v6-Härtung zum Standard:** `AddressFamily inet` in `sshd_config` greift dann normal → kein per-Host Socket-`ListenStream`-Override nötig. Frischis Phase-2-v6-Schließung wird trivial.
3. **Vorhersagbar + race-frei:** ein Listener, ein Modus, jeder Admin kennt ihn.
4. RAM-Kosten always-on sshd vernachlässigbar.

**Verworfen — Option B (Socket-only, ssh.service disable):** distro-default auf trixie, spart minimal RAM, ABER divergiert auf bookworm + zwingt die v6-Härtung in Socket-Overrides. Nicht den Mehraufwand wert für ein homogenes Fleet-Verhalten.

## Prozedur (pro Host, canary-first)
**Safety-Net:** Alle Targets sind LXCs → `pct exec <id>` über den Node ist immer da. **Kein echter Lockout möglich** (SSH-Bruch via pct exec reparierbar). Trotzdem unterbrechungsfrei geplant.
1. Pre-Check: `ss -tlnp | grep :22` → standalone sshd hält :22 (verifiziert).
2. `systemctl disable --now ssh.socket` (sshd behält :22, da standalone aktiv → **kein Drop**).
3. `systemctl enable ssh.service` (sicherstellen, dass es boot-persistent ist).
4. Verify-Oracle: (a) `ss -tlnp | grep :22` zeigt NUR sshd, kein systemd-fd; (b) `ssh.socket` = disabled/inactive; (c) `ssh.service` = enabled/active; (d) **frische SSH-Connection von außen (.174) klappt**; (e) `sshd -t` clean.
5. **Canary = sonarr-anime** (Socket eh inactive = risikoärmster Fall) ZUERST → 1 Host verifizieren → dann der Rest. Ein Host failt → Host raus, Rest weiter.
6. Reboot-Probe auf 1 Host (race war ein BOOT-Problem) → nach Reboot nur 1 Listener.

## Rollback
`systemctl enable --now ssh.socket` (Sekunden, reversibel). Pro-Host atomar.

## Verzahnung
Mein Single-Mode-Cleanup → DANN Frischis v6-Listener-Schließung (jetzt per `AddressFamily inet`, kein Socket-Override) → Schnüffi-Review. Template-Ursache: an Patchi/Frischi (LXC-Template setzt beide enabled) für künftige Provisionierung.

## Gates
R22 (Multi-Host-SSH = prozess-/infra-kritisch) → **Codex-Refute auf diese Position VOR Live-Touch**. Canary-first + pct-exec-Safety + Reversibilität als Leitplanken.

## ⚠️ AUSFÜHRUNG GEPARKT (2026-06-12 ~15:35) — Concurrency-Blocker + korrigierte Topologie
**Codex-Refute + Frisch-Messung haben einen Outage verhindert.** Beim PRE-Gate auf dem Canary zeigte sich: der Ist-Zustand **flappt aktiv** — sonarr-anime ging binnen Minuten `ss:sshd(5944)` → `ssh.service inactive/MainPID=0, :22 hält systemd(socket)` → `sshd(6846)+systemd beide active`. svc-MainPID wandert (5944→6846) = **ssh.service wird gerade RESTARTET**. Ursache: **Frischis Hardening-Play läuft AKTIV auf genau diesen ring_rest-Hosts** und zyklt deren ssh-State.
**Korrigierte Topologie-Erkenntnis:** Die Hosts sind in Wahrheit **socket-aktiviert** (`ssh.socket` Accept=no, `Triggers=ssh.service`; die laufende `ssh.service` ist die getriggerte persistente Instanz, die den Socket-fd erbt — `ss` zeigt darum sshd UND systemd auf demselben *:22-fd, KEIN echter Doppel-Bind). `ssh.service` ist ZUSÄTZLICH enabled → würde beim Boot standalone starten = der Race. `/run/sshd` fehlt wenn ssh.service inactive (RuntimeDirectory) → `sshd -t` schlägt dann fehl.
**Konsequenz für Option A:** `disable --now ssh.socket` allein reicht NICHT — der laufende sshd erbte den Socket-fd; sauber ist **`disable --now ssh.socket && systemctl restart ssh.service`** (sshd bindet :22 dann selbst, eigener fd, /run/sshd via RuntimeDirectory). Pro Host PRE-Gate frisch + sofort verify + pct-exec-Safety.
**🔴 BLOCKER (extern):** Cleanup NICHT ausführbar, solange Frischis Play ssh auf denselben Hosts zyklt (Race → No-Listener-Risiko). **Wartet auf:** (a) Frischis Play quiesced auf allen ring_rest, ODER (b) wir falten die Single-Mode-Enforcement in SEIN Play (sonst macht jeder Restart das Dual-Mode neu auf). Mit Frischi abgestimmt. Re-Messung frisch pro Host unmittelbar vor jedem disable (Pflicht — Readings veralten in Minuten).

## Codex-Refute-Ergebnis (2026-06-12, R22) — Plan gehärtet, GO
Codex-Kurzurteil: „nicht blind gefährlich wegen Lockout (pct exec = echtes LXC-Safety-Net); die gefährliche Stelle ist die **Fehlklassifikation des Live-Listeners aus `ss`**." Übernommene Schärfungen:
1. **Pro-Host PRE-Klassifikation als HARTES Gate (vor jedem disable):** beweise dass der `:22`-Listener-sshd == `ssh.service` MainPID ist (nicht socket-gespawnte `ssh@.service`/`sshd -i`) UND keine Kopplung `PartOf=`/`BindsTo=`/`Conflicts=` den sshd mitreißt. Erst wenn `ss`-Listener-PID == `MainPID(ssh.service)` UND `sshd -t` clean → disable. Sonst Host SKIP + melden.
2. **Reboot-Probe auf je 1 bookworm (checkmk/fileflows) UND 1 trixie (radarr/sonarr-anime)** — Canary beweist nur seinen eigenen Unit-Graphen, nicht den heterogenen Fleet.
3. **Boot-Persistenz:** `disable` (nicht `mask`) — Admin-State wird von dpkg/needrestart/unattended-upgrades respektiert; nach Reboot verifizieren dass nur 1 Listener. (`mask` wäre stärker, aber schwerer reversibel — nur falls Reboot-Probe ein Re-Enable zeigt.)
Bestätigt: in-flight Sessions reißen NICHT ab (hängen an akzeptierten Childs); neue Connects bedient der standalone sshd. Option A als robustere Wahl bestätigt.
