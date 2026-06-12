# E1 ring_rest Key-Rollout — Per-Host-Verify-Log (Schnüffi-Auflagen)

**Datum:** 2026-06-12 ~14:25 · **Ausführung:** ansible-control-155 (.174), fleet-ansible @693adcd
**GO-Basis:** Schnüffi Conditional GO 2026-06-12 14:01 (Per-Host-Oracles + IPv6-Check + Hardening post-verify + 134/142/125 raus)
**Mechanik:** Wegwerf-Foothold via `pct exec` in root authorized_keys → `bootstrap.yml -l ring_rest -e @vars.json` → Wegwerf-Key von allen 7 Hosts + Control-Node ENTFERNT (verifiziert: grep=0 überall).

## Ergebnis: 7/7 bootstrapped, 28/28 Kern-Oracles PASS

| Host | VMID@Node | IP | O1 login-pong | O2 sudo-apt | O3 reboot/systemctl denied | O4 exclusive+from=.174 | v6-SSH-Listener | routable v6 |
|---|---|---|---|---|---|---|---|---|
| radarr | 123@pve | 192.168.20.129 | PASS | PASS | PASS | PASS (1 key) | dual-stack `*:22` | JA (2003:…) |
| sabnzbd | 121@pve | 192.168.30.135 | PASS | PASS | PASS | PASS (1 key) | dual-stack `*:22` | **nein** |
| unpoller | 148@pz1 | 192.168.20.148 | PASS | PASS | PASS | PASS (1 key) | dual-stack `*:22` | JA (2003:…) |
| fileflows | 113@pve | 192.168.20.76 | PASS | PASS | PASS | PASS (1 key) | dual-stack `*:22` | JA (2003:…) |
| checkmk | 149@pz2 | 192.168.20.169 | PASS | PASS | PASS | PASS (1 key) | dual-stack `*:22` | JA (2003:…) |
| caddy-proxy | 200@pz1 | 192.168.20.200 | PASS | PASS | PASS | PASS (1 key) | dual-stack `*:22` | JA (2003:…) |
| tapsi | 145@pve | 192.168.20.168 | PASS | PASS | PASS | PASS (1 key) | dual-stack `*:22` | JA (2003:…) |

**Oracle-Methoden (unabhängige Signale):**
- O1: `ansible <host> -m ping` als `ansible`-User mit ansible_ed25519 (key-only) → pong.
- O2: `sudo -n apt-get -q -s upgrade` (Simulation) → rc=0.
- O3: `sudo -n /usr/sbin/reboot` UND `sudo -n systemctl status ssh` → beide „password is required" (denied-count=2).
- O4: `~/.ssh/authorized_keys` des ansible-Users = exakt 1 Zeile, beginnt mit `from="192.168.20.174"`.
- v6: roher `ss -tln`-Output (`*:22` = dual-stack v6-Socket) + `ip -6 addr show scope global`.

## IPv6-Befund (Schnüffi-Auflage 2) — Übergabe an Hardening-Play
- **7/7 sshd dual-stack** (`*:22`), **6/7 mit globaler routebarer v6** (Telekom 2003::/19-Prefix, SLAAC) — nur sabnzbd ohne.
- Der `from="192.168.20.174"`-Pin (IPv4) blockt den **ansible-Key** auch über v6 (Quelladresse matcht nie) — aber andere AuthN-Pfade (root-Login/Passwort, andere Keys) wären über v6 NICHT durch den Pin gedeckt.
- → **`AddressFamily inet` für alle 7 nötig**, kommt per ssh-hardening.yml (fleet-ansible, schon drin seit fbdad59) als Post-Verify-Schritt mit Rollback (Sentinel-Arm-vor-Drop-in-Fix @693adcd). KEIN neuer E1-Blocker (Auflage 3).
- Erster O5-Lauf meldete fälschlich „kein v6-Listener" (grep-Pattern matchte `*:22` nicht) — durch Roh-Output-Nachmessung korrigiert. Tabelle oben = korrigierter Stand.

## Abweichungen / Findings während des Rollouts
1. **Rollen-Lücke bootstrap:** 4/7 LXCs (caddy-proxy, checkmk, tapsi, unpoller) hatten KEIN `sudo`-Paket → „Destination directory /etc/sudoers.d does not exist". Fix: sudo nachinstalliert (ad-hoc als root), Play erneut. → Frischi: Task `apt: name=sudo state=present` vor dem sudoers-Write in die Rolle.
2. **Quoting-Falle:** Pubkey inline durch mehrere Shell-Ebenen (`-e var="$(cat …)"` via ssh+pct exec) zerlegt den Key an den Spaces → `authorized_key` IndexError auf allen Hosts. Fix: Extra-Vars als JSON-Datei auf dem Control-Node (`-e @/tmp/vars.json`).
3. **unpoller apt kaputt (Drittanbieter):** `pkg.unpoller.com` löst auf die HAUS-WAN-IP 87.139.158.187 auf → Cert-Verify-Fail → `update_cache` bricht. Workaround: sudo direkt installiert + `install_qemu_guest_agent=false`. **Owner/Netzi sollte das Repo-File prüfen** (vermutlich totes/umgezogenes Repo oder DNS-Rewrite auf der UDM).
4. **qemu-guest-agent auf LXC:** Rolle installiert ihn default auch auf LXCs (no-op, kein virtio). Kosmetisch — Frischi: `when: ansible_virtualization_type != "lxc"` o.ä.

## Status
- **E1 ring_rest: KOMPLETT** (Canary sonarr-anime war schon am 12.06. ~01:10 verifiziert → 8/8 patchable_yes-Hosts haben den Key).
- Ausgenommen wie beauflagt: LXC 134 dvhub-prod, VM 142 Coder/wa-bridge, LXC 125 npm (held).
- Nächste Stufe: Schnüffi-Final-Stempel → Frischi fährt ssh-hardening (Canary zuerst, dry→scharf) → E2-Semaphore-Key (separater Key from=.176, Codex-Refute vor Deploy).
