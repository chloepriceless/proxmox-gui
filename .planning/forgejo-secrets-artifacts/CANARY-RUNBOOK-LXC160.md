# LIVE-Canary-Runbook — hook-integrity-watch A-Modell auf LXC 160

**Status:** ⛔ GATED — erfordert **Operator-GO/NO-GO** (Live-Touch am Produktiv-Secrets-Forgejo).
**Reversibel:** ja (alle Schritte via `chattr -i` rücknehmbar; Canary-Repo wird gelöscht; `dvhub/planning` wird NICHT angefasst).
**Owner:** vm-deployment-gui (Schraubi) · **Re-Sign-off nach Evidenz:** Schnüffi (orchestrator-security).
**Vorgänger:** Schnüffi Code-Layer-Sign-off `127c653` (Oracle 40/40). Dieser Canary ist die Präventions-/Attestations-Schicht UNTER der reinen Detektion — Schnüffi will gemessene Evidenz VOR dem finalen Re-Sign-off.

Dieser Runbook konsolidiert die über `HOOK-INTEGRITY-WATCH-DESIGN.md` (§ R22-Arm-Gate Pkt. 2/3 + Status-Checkliste Z.210–214) verstreuten Canary-Anforderungen in eine **exakte, copy-paste-fähige Sequenz**. Ziel: sobald GO kommt, läuft der Canary ohne Re-Herleitung; jeder Befehl ist vorab reviewt; der Rollback-Pfad ist Teil des Runbooks.

---

## 0. Was der Canary BEWEISEN muss (Oracle zuerst, R31 — Zahlen VOR dem Lauf)

| # | Frage | Erfolgskriterium (gemessen) |
|---|---|---|
| C-A | Trägt das LXC-160-FS `chattr +i` überhaupt? | `chattr +i` setzt `i`-Flag, `lsattr` zeigt `----i`, `chattr -i` nimmt es weg — **3/3** auf Datei + Dir |
| C-B | Toleriert Forgejo 15.0.3 immutable `repo.git/config` + `hooks/` + `hooks/pre-receive` + `pre-receive.d/` + `50-secrets`? | normaler Push (loose-ref-Update) bleibt **grün** (exit 0, ref advanced) |
| C-C | Toleriert Forgejo immutable `repo.git/`-**Verzeichnis** (Schutz gg. commondir-Erzeugung)? | normaler Push bleibt grün; **packed-refs/`git gc`** Verhalten DOKUMENTIEREN (erwartet: gc/pack-refs schlägt fehl → Maintenance-Fenster via regenerate-Runbook) |
| C-D-ssh | receive-pack env+argv+cwd über **SSH** (:2222) | vollständiger Dump in Datei; enthält `GIT_QUARANTINE_PATH`, `GITEA_REPO_USER_NAME`, argv, cwd |
| C-D-http | receive-pack env+argv+cwd über **HTTP** (:3000) | vollständiger Dump; **Divergenz SSH↔HTTP** explizit gelistet (Basis für `.receive-pack-env`-Allowlist) |
| C-E | Watcher-Oracle live (inv #9 chattr/lsattr, positive resolve `rev-parse --git-path`, effective_forbidden runuser+GIT_DIR) | `hook-integrity-watch-oracle.sh` **40/40** auf der echten LXC-160-Umgebung |
| C-F | Reversibilität (regenerate/upgrade) | `chattr -i` → re-harden → `chattr +i` Sequenz läuft sauber; Push danach wieder grün |
| C-G | Sauberkeit | Canary-Repo gelöscht (HTTP 204), `dvhub/planning` byte-identisch unberührt, kein Secret-Echo in Logs |

**NO-GO-Signal:** wenn C-B ODER C-C den normalen Push **bricht** (Forgejo verträgt Immutabilität nicht) → A-Modell ist nicht live-tragfähig → STOP, an Schnüffi: Hybrid/B neu bewerten.

---

## 1. Zugang + Pre-Flight (read-only, reversibel)

```bash
# Von der dev-vm:
ssh -i ~/.ssh/orchestrator_ed25519 root@192.168.20.106    # pz3
pct exec 160 -- bash -l                                    # in den Container

# --- ab hier IN LXC 160, als root ---
export REPO_BASE="${FORGEJO_REPO_BASE:-/var/lib/forgejo/forgejo-repositories}"
TOKEN="$(cat /root/.forgejo160-admin-token)"               # admin-Token (root-only)
GIT_USER="$(stat -c %U "$REPO_BASE")"                       # erwartet: git / forgejo

# Pre-Flight-Asserts (KEIN Schreibzugriff):
which chattr lsattr || { echo "FAIL: e2fsprogs fehlt"; }    # chattr verfügbar?
stat -f -c %T "$REPO_BASE"                                  # FS-Typ (ext4/xfs? overlay = chattr fragil!)
ls -la /usr/local/lib/forgejo-secrets/                      # gestagte Artefakte da?
md5sum /usr/local/lib/forgejo-secrets/*.sh /usr/local/lib/forgejo-secrets/*.py
systemctl is-enabled hook-integrity-watch.service hook-integrity-watch.timer
```

> ⚠️ Ist `stat -f` = `overlayfs`/`overlay`: `chattr +i` ist auf Overlay **nicht zuverlässig** → A-Modell-Befund sofort an Schnüffi, BEVOR weitergemacht wird (das ist ein potenzieller A-Killer).

---

## 2. Canary-Repo anlegen (isoliert, NICHT `planning`)

```bash
# IN LXC 160:
curl -sf -X POST "http://fleetadmin:${TOKEN}@localhost:3000/api/v1/orgs/dvhub/repos" \
  -H 'Content-Type: application/json' \
  -d '{"name":"canary-hookwatch","private":true,"auto_init":true}' | head -c 400; echo

CANARY_GIT="$REPO_BASE/dvhub/canary-hookwatch.git"
test -d "$CANARY_GIT" && echo "OK on-disk: $CANARY_GIT" || echo "FAIL: repo-dir nicht gefunden"
```

Hook + .allow für den Canary scharf wiren (root-owned, fail-closed):
```bash
install -o root -g root -m 0755 /usr/local/lib/forgejo-secrets/pre-receive-secrets.sh \
  "$CANARY_GIT/hooks/pre-receive.d/50-secrets"
# (Dispatcher hooks/pre-receive: wie im Deploy-Runbook; falls Forgejo-Default-Hook → 50-secrets via pre-receive.d ketten)
mkdir -p /etc/forgejo-secrets-policy/dvhub
# Test-.allow mit einem age-Test-Recipient + @recovery (REINER Canary, KEIN echtes Secret):
printf 'age1qcanarytestrecipient000000000000000000000000000000000000\n@recovery age1qcanaryrecovery0000000000000000000000000000000000000000\n' \
  > /etc/forgejo-secrets-policy/dvhub/canary-hookwatch.allow
chmod 0644 /etc/forgejo-secrets-policy/dvhub/canary-hookwatch.allow
```

---

## 3. Phase C-D — receive-pack env/argv/cwd-Dump (SSH + HTTP getrennt)

**Mechanik:** temporär den Canary-Hook durch einen Dump-Wrapper ersetzen (NUR Canary-Repo), je einmal über SSH und HTTP pushen, exakt mitschneiden was Forgejos receive-pack an den Hook übergibt. Das ist die Attestationsquelle für `.receive-pack-env`.

```bash
cat > "$CANARY_GIT/hooks/pre-receive.d/00-dump" <<'EOF'
#!/bin/bash
DUMP="/root/canary-rpenv.$(date +%s).$$"
{ echo "=== ARGV ==="; printf '%q ' "$0" "$@"; echo
  echo "=== CWD ==="; pwd
  echo "=== ENV ==="; env | sort
  echo "=== STDIN(refs) ==="; cat
} >> "$DUMP" 2>&1
exit 0   # Dump-Wrapper lässt durch; 50-secrets bleibt für den eigentlichen Test
EOF
chmod 0755 "$CANARY_GIT/hooks/pre-receive.d/00-dump"
```

Dump über **SSH** (:2222) und **HTTP** (:3000) — von der dev-vm oder einem Clone in LXC 160 aus, je ein trivialer Commit-Push gegen `canary-hookwatch`. Danach:
```bash
# IN LXC 160: die zwei Dumps vergleichen → Divergenz = was transport-abhängig ist
ls -t /root/canary-rpenv.* | head -2
diff <(grep '^GIT\|^GITEA\|^PWD' /root/canary-rpenv.<ssh>)  <(grep '^GIT\|^GITEA\|^PWD' /root/canary-rpenv.<http>)
```
> Ergebnis → die **gemeinsame, immer-präsente** env-Var-Menge wird zur attestierten `.receive-pack-env`-Allowlist (root-owned, immutabel). Transport-divergente Vars NICHT in die fail-closed-Pflichtmenge.
> Danach `00-dump` wieder entfernen: `rm "$CANARY_GIT/hooks/pre-receive.d/00-dump"`.

---

## 4. Phase C-A/C-B/C-C — Immutabilität + Forgejo-Toleranz

```bash
# C-A: FS-Probe (Datei + Dir)
T=/tmp/cnry; mkdir -p $T; touch $T/f
chattr +i $T/f $T && lsattr -d $T && lsattr $T/f && chattr -i $T/f $T && echo "C-A OK 3/3"

# C-B: Datei-/Hook-Surface immutabel
chattr +i "$CANARY_GIT/config" \
          "$CANARY_GIT/hooks" \
          "$CANARY_GIT/hooks/pre-receive" \
          "$CANARY_GIT/hooks/pre-receive.d" \
          "$CANARY_GIT/hooks/pre-receive.d/50-secrets"
lsattr -d "$CANARY_GIT/config" "$CANARY_GIT/hooks/pre-receive.d/50-secrets"
# → jetzt EINEN gültigen SOPS-Canary-Push (siehe oracle.sh Fixture t1) → erwartet ACCEPT/grün
# → einen Plaintext-Push → erwartet REJECT (Hook lebt trotz Immutabilität)

# C-C: repo.git/-DIR-Ebene immutabel (Schutz gg. commondir/config.worktree-Erzeugung)
chattr +i "$CANARY_GIT"
lsattr -d "$CANARY_GIT"
# → normaler loose-ref-Push: erwartet grün (refs/heads/ ist separater inode)
# → 'git -C "$CANARY_GIT" gc' bzw. pack-refs als $GIT_USER: VERHALTEN DOKUMENTIEREN
sudo -u "$GIT_USER" git -C "$CANARY_GIT" pack-refs --all 2>&1 | tee /root/canary-packrefs.log
#   erwartet: schlägt fehl (kann packed-refs/.lock im immutablen Dir nicht anlegen)
#   → das ist KEIN Push-Breaker, sondern Maintenance-Einschränkung → regenerate-Runbook (§6)
```

**Befund-Matrix ausfüllen** (genau diese Zeilen an Schnüffi):
- C-B normaler Push: grün? ____  · Plaintext-Push REJECT? ____
- C-C loose-ref-Push: grün? ____  · pack-refs/gc: ____ (Fehlertext)
- commondir-Erzeugungsversuch im immutablen Dir geblockt? ____

---

## 5. Phase C-E — Watcher-Oracle live auf LXC 160

```bash
cd /usr/local/lib/forgejo-secrets/    # oder wo -oracle.sh + -watch.sh liegen
bash hook-integrity-watch-oracle.sh 2>&1 | tee /root/canary-watch-oracle.log
tail -3 /root/canary-watch-oracle.log     # erwartet: 40/40
# Real-Trigger gegen den scharf-gewireten Canary:
hook-integrity-watch.sh --once 2>&1 | tee /root/canary-watch-run.log  # erwartet: kein VIOLATION (Baseline clean)
```
> Falls der Oracle TEST_MODE braucht, der live nicht greift: dokumentieren, welche Fälle live vs. TEST_MODE liefen.

---

## 6. Phase C-F — Reversibilität (regenerate/upgrade-Sequenz)

```bash
# Diese Sequenz ist auch das Prod-Maintenance-Runbook (forgejo admin regenerate hooks / Upgrade):
chattr -i "$CANARY_GIT" \
          "$CANARY_GIT/config" \
          "$CANARY_GIT/hooks" \
          "$CANARY_GIT/hooks/pre-receive" \
          "$CANARY_GIT/hooks/pre-receive.d" \
          "$CANARY_GIT/hooks/pre-receive.d/50-secrets"
# → re-harden (Hook neu installieren, dann wieder +i) → Push danach erneut grün verifizieren
```

---

## 7. Cleanup (Pflicht — C-G)

```bash
# alle chattr -i (siehe §6), dann Canary-Repo löschen:
curl -sf -X DELETE "http://fleetadmin:${TOKEN}@localhost:3000/api/v1/repos/dvhub/canary-hookwatch" -w '%{http_code}\n'  # 204
rm -f /etc/forgejo-secrets-policy/dvhub/canary-hookwatch.allow
rm -f /root/canary-rpenv.* /root/canary-*.log
# Verify planning unberührt:
git -C "$REPO_BASE/dvhub/planning.git" rev-parse HEAD 2>/dev/null   # unverändert?
# Secret-Echo-Check: in keinem Log darf Klartext eines (Test-)Recipients/Secrets stehen
grep -ri 'age1q' /root/ /var/log/ 2>/dev/null && echo "WARN: prüfen" || echo "kein Echo"
```

---

## 8. Evidenz → Schnüffi (finaler Re-Sign-off)

Genau diese Zahlen/Artefakte sammeln und an Schnüffi (`cr811qsy`) liefern (R31 — rohe Evidenz, keine „ok"):
- C-A 3/3 · C-B (Push grün ja/nein + Plaintext-REJECT) · C-C (loose-Push + pack-refs-Verhalten + commondir geblockt) · C-D (SSH/HTTP env-Diff → finale `.receive-pack-env`-Liste) · C-E Oracle 40/40 live · C-F reversibel grün · C-G sauber.
- FS-Typ (`stat -f`) explizit nennen (overlay-Caveat).
- Bei **C-B/C-C NO-GO** (Forgejo bricht bei Immutabilität): A-Modell nicht live-tragfähig → Hybrid/B-Neubewertung mit Schnüffi.

**Erst nach Schnüffis finalem Re-Sign-off + grünem Canary** wird der Hook auf echten Secret-Repos scharf — und das ERSTE echte Secret bleibt weiter blockiert auf §7-Rest-Oracle + §8 (op-connect weg .240 + m-of-n Shamir, Operator/proxmox-master).
