#!/usr/bin/env bash
# T-0244 Build-Verify — Statische Checks VOR dem ersten Boot der Zone-VM
# Quelle: 06-build-verify-plan.md §2 (7 Checks)
# Ausführung: auf dem Build-Host oder in der frisch geclondeten Zone-VM (pre-boot).
# Stufe-2-abhängige Checks (Broker, Seat-Instanzen) sind mit [STUFE2] markiert
# und werden ÜBERSPRUNGEN (kein FAIL), damit der Stufe-1-Teil isoliert grün sein kann.
set -uo pipefail

PASS=0
FAIL=0
SKIP=0
ERRORS=()

# Verzeichnis, in dem die Unit-Dateien liegen (Standard: /etc/systemd/system/)
UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
ETC_ZONE="${ETC_ZONE:-/etc/zone}"
SBIN="${SBIN:-/usr/local/sbin}"

pass()  { echo "[PASS] $*"; PASS=$((PASS+1)); }
fail()  { echo "[FAIL] $*"; FAIL=$((FAIL+1)); ERRORS+=("$*"); }
skip()  { echo "[SKIP][STUFE2] $*"; SKIP=$((SKIP+1)); }
info()  { echo "[INFO] $*"; }

echo "======================================================================"
echo "T-0244 BUILD-VERIFY (06-build-verify-plan.md §2)"
echo "UNIT_DIR=${UNIT_DIR}  ETC_ZONE=${ETC_ZONE}  SBIN=${SBIN}"
echo "======================================================================"

# ── CHECK 1: systemd-Korrektheit ─────────────────────────────────────────────
# 06-plan §2.1: systemd-analyze verify aller zone-Units → 0 Fehler
echo ""
echo "── CHECK 1: systemd-analyze verify (Stufe-1-Units) ──"

STUFE1_UNITS=(
    "zone-root-nft.service"
    "zone-netns-setup.service"
    "zone-nft-seat@seat0.service"
    "zone-seat@seat0.service"
    "zone-selftest-net.service"
    "zone-selftest-hardening.service"
    "zone-spawner.service"
)
# zone-netns-setup.service: KEIN Unit in SSOT vorhanden — GAP, überspringen
STUFE1_UNITS_PRESENT=()
for u in "${STUFE1_UNITS[@]}"; do
    if [[ -f "${UNIT_DIR}/${u}" ]]; then
        STUFE1_UNITS_PRESENT+=("${UNIT_DIR}/${u}")
    else
        info "CHECK 1: ${u} nicht vorhanden (GAP-REPORT) — übersprungen"
    fi
done

if [[ ${#STUFE1_UNITS_PRESENT[@]} -gt 0 ]]; then
    out=$(systemd-analyze verify "${STUFE1_UNITS_PRESENT[@]}" 2>&1)
    rc=$?
    if [[ $rc -eq 0 && -z "$out" ]]; then
        pass "CHECK 1: systemd-analyze verify Stufe-1 (${#STUFE1_UNITS_PRESENT[@]} Units) — 0 Fehler"
    else
        fail "CHECK 1: systemd-analyze verify — rc=${rc}: ${out}"
    fi
else
    fail "CHECK 1: Keine Stufe-1-Unit-Dateien gefunden in ${UNIT_DIR}"
fi

# [STUFE2] Broker + Resolver
for u in zone-broker-llm.service zone-broker-merkel.service zone-resolver.service; do
    if [[ -f "${UNIT_DIR}/${u}" ]]; then
        out=$(systemd-analyze verify "${UNIT_DIR}/${u}" 2>&1)
        rc=$?
        if [[ $rc -eq 0 && -z "$out" ]]; then
            pass "CHECK 1 [STUFE2]: systemd-analyze verify ${u} — OK"
        else
            skip "CHECK 1 [STUFE2]: systemd-analyze verify ${u} rc=${rc}: ${out}"
        fi
    else
        skip "CHECK 1 [STUFE2]: ${u} nicht vorhanden"
    fi
done

# ── CHECK 2: CanReload=no ──────────────────────────────────────────────────
# 06-plan §2.2: zone-root-nft + alle zone-nft-seat@{seat0..seatI} → alle 'no'
echo ""
echo "── CHECK 2: CanReload=no ──"

check_canreload() {
    local u="$1"
    local f="${UNIT_DIR}/${u}"
    if [[ ! -f "$f" ]]; then
        info "CHECK 2: ${u} nicht vorhanden — übersprungen"
        return
    fi
    val=$(systemctl show -p CanReload "${u}" 2>/dev/null | cut -d= -f2)
    if [[ "$val" == "no" ]]; then
        pass "CHECK 2: CanReload=no für ${u}"
    else
        fail "CHECK 2: CanReload=${val} für ${u} (erwartet: no)"
    fi
}

check_canreload "zone-root-nft.service"
for seat in seat0 seat1 seat2 seat3 seatI; do
    check_canreload "zone-nft-seat@${seat}.service"
done

# ── CHECK 3: Self-Proof-Script-Integrität ─────────────────────────────────
# 06-plan §2.3: /usr/local/sbin/{zone-seat-probe.sh,seat-negative-oracle.sh}
#   root-owned, 0755, KEIN Symlink (readlink -e == self)
echo ""
echo "── CHECK 3: Safe-Canonical Skript-Integrität ──"

safe_canonical() {
    local p="$1"
    if [[ ! -e "$p" ]]; then
        fail "CHECK 3: ${p} existiert nicht"
        return
    fi
    # Kein Symlink woanders hin
    real=$(readlink -e "$p" 2>/dev/null)
    if [[ "$real" != "$p" ]]; then
        fail "CHECK 3: ${p} ist Symlink → ${real} (erwartet: readlink -e == self)"
        return
    fi
    # root-owned
    owner=$(stat -c '%U:%G' "$p" 2>/dev/null)
    if [[ "$owner" != "root:root" ]]; then
        fail "CHECK 3: ${p} owner=${owner} (erwartet: root:root)"
        return
    fi
    # Perms: kein group/world-write
    mode=$(stat -c '%a' "$p" 2>/dev/null)
    if [[ "${mode: -2:1}" =~ [2367] ]] || [[ "${mode: -1:1}" =~ [2367] ]]; then
        fail "CHECK 3: ${p} mode=${mode} — group/world-writable"
        return
    fi
    pass "CHECK 3: ${p} — root:root, mode=${mode}, kein Symlink"
}

safe_canonical "${SBIN}/zone-seat-probe.sh"
safe_canonical "${SBIN}/seat-negative-oracle.sh"
safe_canonical "${SBIN}/seat-hardening-oracle.sh"

# ── CHECK 4: nft-Syntax ───────────────────────────────────────────────────
# 06-plan §2.4: nft -c -f zone-root.nft + zone-seat.nft → 0 Fehler
echo ""
echo "── CHECK 4: nft-Syntax ──"

check_nft_syntax() {
    local f="$1"
    if [[ ! -f "$f" ]]; then
        fail "CHECK 4: ${f} nicht vorhanden"
        return
    fi
    out=$(nft -c -f "$f" 2>&1)
    rc=$?
    if [[ $rc -eq 0 ]]; then
        pass "CHECK 4: nft -c -f ${f} — OK"
    else
        fail "CHECK 4: nft -c -f ${f} — rc=${rc}: ${out}"
    fi
    # Prüfe meta nfproto ipv6 drop als erste Non-Kommentar-Regel in jeder chain
    # (06-plan §2.4: insb. meta nfproto ipv6 drop als 1. Regel jeder Chain)
    if grep -q "meta nfproto ipv6 drop" "$f"; then
        pass "CHECK 4: ${f} — meta nfproto ipv6 drop vorhanden"
    else
        fail "CHECK 4: ${f} — meta nfproto ipv6 drop FEHLT (R5-H1)"
    fi
}

check_nft_syntax "${ETC_ZONE}/zone-root.nft"
check_nft_syntax "${ETC_ZONE}/zone-seat.nft"

# ── CHECK 5: nft-Idempotenz (zone-seat.nft) ──────────────────────────────
# 06-plan §2.5: zone-seat.nft 2× nft -f → beide exit 0 + identisches Ruleset
# (nur ausführbar wenn nft auf dem System installiert; destroy-table-Idiom)
echo ""
echo "── CHECK 5: nft-Idempotenz (zone-seat.nft, destroy table) ──"

SEAT_NFT="${ETC_ZONE}/zone-seat.nft"
if [[ ! -f "$SEAT_NFT" ]]; then
    fail "CHECK 5: ${SEAT_NFT} nicht vorhanden"
elif ! command -v nft &>/dev/null; then
    skip "CHECK 5 [STUFE2]: nft nicht installiert — Idempotenz-Test übersprungen"
else
    # Erster Lauf
    out1=$(nft -f "$SEAT_NFT" 2>&1); rc1=$?
    # Zweiter Lauf
    out2=$(nft -f "$SEAT_NFT" 2>&1); rc2=$?
    if [[ $rc1 -eq 0 && $rc2 -eq 0 ]]; then
        pass "CHECK 5: nft -f zone-seat.nft 2× — beide exit 0 (destroy-table idempotent)"
    else
        fail "CHECK 5: nft -f 2×: rc1=${rc1} rc2=${rc2} / out1='${out1}' out2='${out2}'"
    fi
    # Ruleset nach zwei Läufen auslesen (strukturelle Gleichheit genügt hier)
    rs=$(nft list ruleset 2>&1)
    if echo "$rs" | grep -q "zone_seat"; then
        pass "CHECK 5: zone_seat Tabelle nach 2× Laden vorhanden"
    else
        fail "CHECK 5: zone_seat Tabelle FEHLT nach 2× Laden"
    fi
    # Aufräumen (kein Live-System!)
    nft delete table inet zone_seat 2>/dev/null || true
fi

# ── CHECK 6: Boot-Enable ──────────────────────────────────────────────────
# 06-plan §2.6: systemctl is-enabled für alle zone-Units → 'enabled'
echo ""
echo "── CHECK 6: Boot-Enable (systemctl is-enabled) ──"

ENABLED_UNITS=(
    "zone-root-nft.service"
    "zone-selftest-net.service"
    "zone-selftest-hardening.service"
)
# Stufe-1-Pflicht: zone-root-nft + beide selftest-Gates
for u in "${ENABLED_UNITS[@]}"; do
    if [[ ! -f "${UNIT_DIR}/${u}" ]]; then
        fail "CHECK 6: ${u} nicht vorhanden"
        continue
    fi
    st=$(systemctl is-enabled "$u" 2>/dev/null)
    if [[ "$st" == "enabled" ]]; then
        pass "CHECK 6: ${u} — enabled"
    else
        fail "CHECK 6: ${u} — is-enabled='${st}' (erwartet: enabled)"
    fi
done

# [STUFE2]: Broker + Seats + Spawner
ENABLED_STUFE2=(
    "zone-broker-llm.service"
    "zone-broker-merkel.service"
    "zone-resolver.service"
    "zone-spawner.service"
    "zone-seat@seat0.service"
    "zone-seat@seat1.service"
    "zone-seat@seat2.service"
    "zone-seat@seat3.service"
    "zone-seat@seatI.service"
    "zone-nft-seat@seat0.service"
    "zone-nft-seat@seat1.service"
    "zone-nft-seat@seat2.service"
    "zone-nft-seat@seat3.service"
    "zone-nft-seat@seatI.service"
)
for u in "${ENABLED_STUFE2[@]}"; do
    if [[ ! -f "${UNIT_DIR}/${u%%@*}@.service" ]] && [[ ! -f "${UNIT_DIR}/${u}" ]]; then
        skip "CHECK 6 [STUFE2]: ${u} nicht vorhanden"
        continue
    fi
    st=$(systemctl is-enabled "$u" 2>/dev/null)
    if [[ "$st" == "enabled" ]]; then
        pass "CHECK 6 [STUFE2]: ${u} — enabled"
    else
        skip "CHECK 6 [STUFE2]: ${u} — is-enabled='${st}'"
    fi
done

# ── CHECK 7: Broker↔root-nft-Kopplung ────────────────────────────────────
# 06-plan §2.7: systemctl show -p Requires,After zone-broker-{llm,merkel},zone-resolver
#               enthält je zone-root-nft.service
echo ""
echo "── CHECK 7: Broker↔root-nft-Kopplung (Requires/After) ──"

for u in zone-broker-llm.service zone-broker-merkel.service zone-resolver.service; do
    f="${UNIT_DIR}/${u}"
    if [[ ! -f "$f" ]]; then
        skip "CHECK 7 [STUFE2]: ${u} nicht vorhanden"
        continue
    fi
    props=$(systemctl show -p Requires,After "$u" 2>/dev/null)
    if echo "$props" | grep -q "zone-root-nft.service"; then
        pass "CHECK 7: ${u} Requires/After enthält zone-root-nft.service"
    else
        fail "CHECK 7 [STUFE2]: ${u} — zone-root-nft.service NICHT in Requires/After"
    fi
done

# ── ZUSAMMENFASSUNG ───────────────────────────────────────────────────────
echo ""
echo "======================================================================"
echo "ERGEBNIS: PASS=${PASS} FAIL=${FAIL} SKIP(STUFE2)=${SKIP}"
echo "======================================================================"

if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo ""
    echo "FEHLER:"
    for e in "${ERRORS[@]}"; do
        echo "  - ${e}"
    done
fi

if [[ $FAIL -eq 0 ]]; then
    echo ""
    echo "[OK] Alle Stufe-1-Checks PASS — kein Blocker für den ersten Boot-Versuch."
    exit 0
else
    echo ""
    echo "[BLOCK] ${FAIL} Check(s) FAILED — KEIN Boot-Versuch bevor alle FAIL behoben."
    exit 1
fi
