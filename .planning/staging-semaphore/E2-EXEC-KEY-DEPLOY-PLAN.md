# T-0116/E2 — Semaphore Exec-Key Deploy-Plan (Design-vor-Build, R22/R26)

**Owner: Schraubi (Semaphore/Infra) + Frischi (fleet-ansible-Repo) + Schnüffi (Security-Gate).**
**Status:** Prep-unblockiert (Frischis SSH-Hardening T-0116 durch). **Deploy bleibt gated:** Codex-Refute auf
diesen Plan/Diff + Schnüffi-Review + from=.176-Pin-Verifikation. **Nichts hiervon ist live ausgeführt.**

## Ausgangslage (live gemessen 2026-06-13 ~08:01, Dry-Check task id=3)
Semaphore-Wiring funktioniert: git-SCM-Clone (svc-ansible-Token), 3 Templates (patch-dry-check/stufe1-canary/
stufe2-rest, alle git=Repo1), Inventory-Resolution (7 ring_rest-Hosts adressiert) — **alles grün.** Einziger
Fehler: **kein Exec-Key.** Konkret: ansible suchte `/home/semaphore/.ssh/ansible_ed25519` → `No such file` →
`ansible@host: Permission denied (publickey)` → alle 7 UNREACHABLE. Templates haben `ssh_key_id=None`, d.h.
ansible fiel auf den in `fleet-ansible/ansible.cfg` (bzw. Inventory) **gebackten Pfad** `/home/semaphore/.ssh/
ansible_ed25519` zurück — der im Container nicht existiert.

## Design-Position (gewählt): dediziertes E2-Keypair + Semaphore-Key-Store-Injection (NICHT gebackter Pfad)
| Punkt | Entscheidung | Begründung / verworfene Alternative |
|---|---|---|
| Key-Identität | **Dediziertes E2-Keypair** `ansible-e2` — NICHT der E1-Key (`ansible_ed25519`, lebt auf 155, from=.174-Pin) | least-privilege + getrennte Widerrufbarkeit: Semaphore (.176) und ansible-control-155 (.174) sind unterschiedliche Caller mit unterschiedlichem Blast-Radius. Reuse des E1-Keys verwischt from=-Pin + Audit. |
| Key-Injektion | **Semaphore-Key-Store-Entry** `ansible-e2-exec` (type ssh) → `ssh_key_id` an alle 3 Templates | Semaphore-nativ: injiziert den Key pro Run in ein temp-File + setzt `--private-key`, überschreibt den gebackten Pfad. Verworfen: Key fest nach `/home/semaphore/.ssh/ansible_ed25519` legen (Option a) — umgeht den Key-Store (kein zentrales Rotieren/Audit, Key liegt unverschlüsselt im Container statt ACCESS_KEY_ENCRYPTION-verschlüsselt). |
| ansible.cfg | **`private_key_file`-Pin in fleet-ansible entfernen ODER auf Key-Store-Injektion verlassen** (Frischi-Repo-Edit) | Der gebackte Pfad ist der Grund, dass key=None auf genau diese Datei fiel. Mit Key-Store-`ssh_key_id` überschreibt Semaphore `--private-key` → der Pin wird obsolet/störend. Frischi entscheidet: entfernen vs. auf .176-Pfad zeigen lassen. |
| Host-Autorisierung | **2. `authorized_key`-Zeile** für `ansible`-User, **`from="192.168.20.176"`-Pin** (Semaphore-IP), via bootstrap-Template | additiv zur E1-Zeile (from=.174). Gleiche minimal-sudoers (apt-get/apt/dpkg/needrestart) — KEINE neue sudoers-Zeile, nur ein 2. Key. (Frischi-Repo-Edit in der bootstrap-Rolle.) |
| Key-Minting | **Erst beim Deploy** (`ssh-keygen -t ed25519 -C ansible-e2@semaphore -f -N ''`), Private NUR in Key-Store + NetBoard-Backup, NIE auf Disk/Git/Chat | Credential-Hygiene: kein vorzeitiges Verstreuen eines Prod-Keys. Public wird Frischi geliefert (für die authorized_key-Zeile im Repo). |
| Scope/Exklusionen | ring_canary (sonarr-anime) + ring_rest (7). **RAUS: LXC 134 dvhub-prod (C1), VM 142 wa-bridge (C5), LXC 125 npm (held)** | Identisch zum E1-Scope; prod-/DMZ-Hosts brauchen Owner/Christin-Entscheid. |

## Der E2-Diff (was sich WO ändert)
1. **fleet-ansible (Frischi-Repo, Forgejo `frischi/fleet-ansible`) — Frischi committet:**
   (a) bootstrap-Rolle: 2. `authorized_key` für `ansible`-User mit `key="<E2-pub>"` + `from="192.168.20.176"`-Pin
       (Options `no-port-forwarding,no-agent-forwarding,no-X11-forwarding` wie E1).
   (b) `ansible.cfg`/Inventory: `private_key_file`-Pin auf `/home/semaphore/.ssh/ansible_ed25519` entfernen
       (Key-Store-Injektion via `ssh_key_id` übernimmt) — ODER bewusst belassen + Key dorthin mounten (Frischi-Call).
2. **Semaphore (LXC 157, Schraubi):** Key-Store-Entry `ansible-e2-exec` (private key) anlegen + `ssh_key_id` an
   patch-dry-check/stufe1-canary/stufe2-rest binden. Private-Key-Backup → NetBoard (`semaphore-e2-exec-key`).
3. **Hosts (via bootstrap-Run, gated):** die 2. authorized_key-Zeile wird ausgerollt — **das ist der prod-
   reichende, Schnüffi-gated Schritt.**

## Deploy-Sequenz (erst nach Gates)
1. Codex-Refute auf diesen Plan/Diff (R22) — Findings einarbeiten. **(dieser Schritt: s.u.)**
2. Schnüffi-Review (sein eigenes Gate; E1-GO deckt E2 NICHT) → GO.
3. Keypair minten, Private in Key-Store + NetBoard, Public an Frischi.
4. Frischi committet die bootstrap-/ansible.cfg-Änderung (1a+1b).
5. **Canary zuerst:** bootstrap-Run NUR `-l ring_canary` (sonarr-anime) → 2. Key landet → Semaphore
   patch-dry-check gegen Canary muss jetzt `ping: pong` + Connect über den E2-Key liefern.
6. Bei Canary-PASS: bootstrap-Run `-l ring_rest` (restliche 6).
7. Templates `ssh_key_id` setzen → ein Semaphore-Lauf (dry, dann stufe1-canary) end-to-end.

## Akzeptanzkriterium (R31, messbar — Oracle VOR dem Test)
- **(1) Connect:** Semaphore patch-dry-check gegen sonarr-anime → `ok=N unreachable=0` (vorher: unreachable=1).
- **(2) From-Pin:** ein SSH-Connect-Versuch mit dem E2-Key von einem Nicht-.176-Host → **denied** (Pin greift;
  gemessen, nicht angenommen).
- **(3) Least-privilege:** der ansible-User kann via E2-Key nur die minimal-sudoers-Befehle (apt-get etc.),
  `reboot`/`systemctl` bleiben denied (1 Negativ-Probe).
- **(4) Kein Prod-Leak:** 134/142/125 sind im Inventory NICHT in den Ziel-Gruppen (grep).

## Rollback
`authorized_key state=absent` für die 2. Zeile (bootstrap) + Key-Store-Entry löschen + `ssh_key_id` zurück auf
None. Reversibel, kein Host-State außer dem authorized_keys-Eintrag.

## Offene Fragen (Codex/Schnüffi/Frischi)
- ansible.cfg-Pin entfernen vs. Key dorthin mounten — welcher Weg ist für Frischis Runner-Setup (155 nutzt den
  Pfad ggf. auch!) konsistent, ohne den E1-Pfad auf 155 zu brechen?
- Schreibt der Semaphore-Key-Store den Key pro Run in ein temp-File mit 600 + räumt ihn ab (Leak-Fläche)?

---

## 🔴 STATUS: BLOCKED — NICHT deploy-fertig (cross-lab Codex-Refute 2026-06-13)
Der erste Entwurf behandelte E2 als „2. Key + Pin". Der cross-lab Codex-Refute (gpt-5-codex) + ein Code-Read von
Frischis bootstrap-Rolle zeigen: **E2 grants effektiv root auf 7 Hosts an Semaphore UND jeden, der ins fleet-
ansible-Repo pushen kann.** Deploy erst nach E2-A1..A11 + Schnüffi-GO (+ ggf. Christin: root-reichender Prod-
Zugang ist eine echte Entscheidung). Roh-Evidenz: `E2-EXEC-KEY-CODEX-REFUTE.md`.

### Amendments E2-A1..A11
**E2-A1 [CRITICAL] „minimal-sudoers" ist root-äquivalent.** `apt-get/apt/dpkg/needrestart` via sudo = root-CodeExec:
`dpkg -i` crafted `.deb` (maintainer-scripts als root), apt `Dpkg::Pre-/Post-Invoke`-Hooks, needrestart-CVEs. Der
Pin/Key bounded den Blast-Radius NICHT. → Als root-reichend behandeln. Bevorzugt **enge root-owned Wrapper-Commands**
mit fixen Args + Audit; bei direktem sudo: Args hart constrainen, `NOEXEC`, `env_reset`, `dpkg` möglichst raus.
**Betrifft AUCH das bereits deployte E1 (gleiche sudoers)** → Schnüffi + Frischi (Patch-Automation-Design).
**E2-A2 [CRITICAL] Repo-Push = Host-Root + Key-Exfil.** Semaphore materialisiert den Key zur Laufzeit als Klartext;
ein bösartiges Playbook/Commit in `frischi/fleet-ansible` kann ihn exfiltrieren ODER (mit E2-A1) direkt root-Code
fahren. → **protected branches + Review-Pflicht für bootstrap/sudoers/inventory + signierte Commits + Semaphore nur
auf approved tags/immutable refs + Trigger-Permissions + Runner-Egress-Allowlist.** „Repo-Write = Host-Root, bis das
Gegenteil bewiesen ist."
**E2-A3 [HIGH→teilverifiziert] from=.176-Pin — Mechanismus bestätigt, target-side-Capture bleibt PRE-STEP.**
ansible läuft im semaphore-Container IN der LXC → Sorge: Ziel-Hosts sehen evtl. eine Docker-Bridge/SNAT-Adresse
statt .176. **Gemessen 2026-06-13 ~08:14 (Schraubi):** semaphore-Container = 172.18.0.2 (compose-bridge); LXC-NAT
hat `-A POSTROUTING -s 172.18.0.0/16 ! -o <bridge> -j MASQUERADE`; LXC-Route zu LAN `192.168.20.x dev eth0 src
192.168.20.176`. ⇒ Container-Traffic wird auf **.176 maskiert, der Ziel-Host sieht .176** → der Pin ist tragfähig,
KEIN Reschreiben auf eine Bridge-IP. **Verbleibender Gold-Standard-PRE-STEP vor Deploy:** literaler target-side-
Capture (sshd-Log/tcpdump auf dem Canary beim echten Connect) zur finalen Bestätigung; bei Abweichung Networking
fixen, NICHT den Pin aufweichen.
**E2-A4 [HIGH] geteilte ansible.cfg `private_key_file = ~/.ssh/ansible_ed25519`** → `~` löst pro Caller anders auf
(155=/root=E1-Key, semaphore=/home/semaphore=fehlt → genau der Dry-Check-Fehler). Ändern/Entfernen kann E1 brechen.
→ **caller-spezifische Key-Wahl per Semaphore-`ssh_key_id`**; den geteilten cfg-Pin NICHT so anfassen, dass 155
bricht; E2-Key NIE auf den E1-Pfad legen. E1 nach der Änderung testen.
**E2-A5 [HIGH] bootstrap-authorized_key ist `exclusive: true`** (Code-Read `roles/ansible_bootstrap/tasks/main.yml:23-28`,
einzelnes `ansible_bootstrap_pubkey`). Ein 2.-Key-Run **WIPED den E1-Key.** → kein 1-Zeilen-Add: **Refactor auf eine
LISTE** `[{pubkey, from_cidr}]` (erster exclusive, Rest appended exclusive:false) ODER eine exclusive-Task mit
**multi-line Key-Block** (beide Keys). **Frischi-Repo-Refactor.**
**E2-A6 [HIGH] grep-Exklusion zu schwach.** 134/142/125 könnten via Inventory-Change/Alias/`children`/`--limit`-Fehler
doch erreicht werden. → `ansible-inventory --graph` aus dem Template-Kontext + **out-of-repo-Deny** (kein authorized_key
auf 134/142/125, FW) + CI-Check, der failt wenn die Namen/IPs im effektiven Inventory auftauchen.
**E2-A7 [MED] Canary-Dry-Check ≠ realer Patch-Pfad.** → zusätzlicher bounded **realer** Canary-Patch-Run + sudo-Deny-Proben.
**E2-A8 [MED] Rollback ≠ Incident-Response.** → Revocation/Compromise-Prozedur (Key rotieren, Hosts auf neue
Keys/sudoers/Pakete/Units prüfen, Semaphore/Forgejo/apt-Logs reviewen).
**E2-A9 [MED] NetBoard-Key-Backup vergrößert Leak-Fläche.** → besser regenerieren-statt-backupen; falls Backup,
Custody+Rotation dokumentieren.
**E2-A10 [MED] .176-Compromise-Blast-Radius.** → Runner härten (Egress-Allowlist, minimale Mounts, kein docker.sock,
Monitoring auf unerwarteten SSH-Fan-out).
**E2-A11 [MED] authorized_key-Options unvollständig.** → `restrict` ergänzen / forced-command-Wrapper erwägen.

### Revidierte Deploy-Sequenz (Gates zuerst)
1. **E2-A3 PRE-STEP:** Quell-IP-Verifikation aus dem Semaphore-Container. 2. **E2-A1-Entscheid:** root-äquivalenz —
Wrapper-Commands vs. akzeptierter Root-Reach (Schnüffi, ggf. Christin). 3. **E2-A5-Refactor** in fleet-ansible (Frischi)
+ **E2-A2** Repo-Branch-Protection. 4. **Schnüffi-Review** (sein Gate). 5. dann erst Keypair/Canary/Rest wie oben.
