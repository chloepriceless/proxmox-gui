#!/usr/bin/env python3
# SOPS-Envelope-Validator fuer den Forgejo-Secrets pre-receive-Hook.
# Quelle/Spec: .planning/FORGEJO-SECRETS-SOPS-MODEL.md §1.4 (R1-R7-gefoldet, Schnueffi-Sign-off R8 @ 48d16c7).
#
# Aufgabe: STRUKTURELL (ohne Decrypt-Key) beweisen, dass ein Blob ein gueltiger,
# vollverschluesselter, NUR-age SOPS-Envelope an die ERLAUBTEN Recipients ist.
# FAIL-CLOSED: jeder Zweifel -> exit != 0. Gibt NIE einen Secret-Wert aus (R2/HIGH-6).
#
# Nutzt einen STRIKTEN Parser (MED-7): yaml.safe_load mit Duplicate-Key-/Anchor-/Merge-
# Ablehnung bzw. json.loads; unsupported Konstrukte -> REJECT.
#
# Exit-Codes:  0 = gueltiger Envelope, Recipients konform.   1 = REJECT (Grund auf stderr, OHNE Secret).
# Aufruf:  sops-envelope-validate.py <allow_recipients_file>   (Blob-Inhalt via stdin)
#   <allow_recipients_file>: eine age1...-Recipient pro Zeile (admin out-of-band Policy, inkl. Recovery).

import sys
import json
import re
import os

ENC_PREFIX = "ENC[AES256_GCM,"
KNOWN_SOPS_FIELDS = {  # erlaubte Top-Level-Felder der sops-Stanza (rekursive Whitelist, R5/HIGH-1)
    "age", "lastmodified", "mac", "version", "unencrypted_suffix",
    "encrypted_suffix", "unencrypted_regex", "encrypted_regex", "mac_only_encrypted",
}
FORBIDDEN_BACKENDS = ("pgp", "kms", "gcp_kms", "azure_kv", "hc_vault")  # R2/B2 + R4/B3
KNOWN_AGE_FIELDS = {"recipient", "enc"}  # R5/HIGH-1: sops.age[]-Eintrag exakt {recipient, enc}
AGE_RE = re.compile(r"^age1[0-9a-z]{58}$")  # echte native-X25519-age-Recipient-Validierung (P0-5), nicht startswith
# Tier-A = default-encrypt-ALL: KEINE partial-encryption-Felder (P1-7) — present mit truthy Wert => REJECT
TIER_A_NO_PARTIAL = ("unencrypted_suffix", "encrypted_suffix", "unencrypted_regex",
                     "encrypted_regex", "mac_only_encrypted")


def reject(msg: str):
    # NIE den Secret-Wert echoen — nur die Regel-ID/Grund (R2/HIGH-6).
    sys.stderr.write("SOPS-REJECT: " + msg + "\n")
    sys.exit(1)


class StrictLoader:
    """Strikter YAML/JSON-Load: JSON zuerst; fuer YAML duplicate-keys/anchors/merge -> REJECT (MED-7)."""

    @staticmethod
    def load(raw: bytes):
        text = raw.decode("utf-8", errors="strict")
        s = text.lstrip()
        if not s:
            reject("leere Datei")
        # JSON-Pfad
        if s[0] in "{[":
            try:
                return json.loads(text)
            except Exception:
                reject("JSON nicht parsebar")
        # YAML-Pfad: strikt
        try:
            import yaml
        except Exception:
            reject("yaml-Modul fehlt — strikter Parser nicht verfuegbar (fail-closed)")

        class _Strict(yaml.SafeLoader):
            pass

        def _no_duplicates(loader, node, deep=False):
            mapping = {}
            for k_node, v_node in node.value:
                k = loader.construct_object(k_node, deep=deep)
                if k in mapping:
                    reject("duplicate YAML-Key")
                mapping[k] = loader.construct_object(v_node, deep=deep)
            return mapping

        _Strict.add_constructor(
            yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _no_duplicates
        )
        # Anchors/Aliases/Merge ablehnen: wir scannen das rohe Token-Stream.
        for marker in ("&", "<<:", "*"):
            pass  # tokenbasierte Pruefung unten
        if _has_yaml_anchor_or_merge(text):
            reject("YAML-Anchor/Alias/Merge nicht erlaubt")
        try:
            docs = list(yaml.load_all(text, Loader=_Strict))
        except SystemExit:
            raise
        except Exception:
            reject("YAML nicht parsebar (strikt)")
        if len(docs) != 1:
            reject("genau EIN YAML-Dokument erwartet")
        return docs[0]


def _has_yaml_anchor_or_merge(text: str) -> bool:
    try:
        import yaml
        for tok in yaml.scan(text, Loader=yaml.SafeLoader):
            name = type(tok).__name__
            if name in ("AnchorToken", "AliasToken"):
                return True
            if name == "ScalarToken" and tok.value == "<<":
                return True
    except Exception:
        return True  # im Zweifel REJECT (fail-closed)
    return False


def _iter_leaves(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _iter_leaves(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _iter_leaves(v)
    else:
        yield obj


def main():
    if len(sys.argv) != 2:
        reject("usage: sops-envelope-validate.py <allow_recipients_file>")
    allow_path = sys.argv[1]
    # SINGLE-PASS Policy-Parser (P0-1+P0-4, Schnueffi-Refute 544bba3): allowed UND recovery aus
    # EINEM Read, konsistent gestrippt + age-validiert. KEIN 2. Read (TOCTOU), KEIN skip-on-empty
    # (das war das fail-OPEN: leeres recovery-Set uebersprang die Break-Glass-Pflicht).
    # TOCTOU-fest (Schnueffi-RE-Review): O_NOFOLLOW (kein Symlink) + fstat auf DEMSELBEN fd, der
    # gelesen wird -> Ownership/Perm-Check und Read auf identischer Inode, kein stat->open-Fenster.
    _test_mode = os.environ.get("FORGEJO_SECRETS_TEST_MODE", "0") == "1"
    try:
        _fd = os.open(allow_path, os.O_RDONLY | os.O_NOFOLLOW)
    except Exception:
        reject("admin-Recipient-Policy nicht oeffenbar (Symlink/fehlt? fail-closed)")
    _st = os.fstat(_fd)
    if not _test_mode and _st.st_uid != 0:
        reject("admin-Recipient-Policy nicht root-owned (fail-closed)")
    if _st.st_mode & 0o022:
        reject("admin-Recipient-Policy group/other-writable (fail-closed)")
    try:
        with os.fdopen(_fd, "r", encoding="utf-8") as f:
            policy_lines = f.read().splitlines()
    except Exception:
        reject("admin-Recipient-Policy nicht lesbar (fail-closed)")
    allowed = set()
    recovery = set()
    for raw_ln in policy_lines:
        ln = raw_ln.strip()
        if not ln or ln.startswith("#"):
            continue
        is_recovery = False
        if ln.startswith("@recovery"):  # nach strip(): kein Indent-Bypass mehr (war BUG-1-Folgefehler)
            parts = ln.split(None, 1)
            if len(parts) != 2:
                reject("@recovery-Zeile ohne Recipient (fail-closed)")
            ln = parts[1].strip()
            is_recovery = True
        if not AGE_RE.match(ln):
            reject("Policy-Recipient kein valider age1-Recipient (fail-closed)")
        allowed.add(ln)
        if is_recovery:
            recovery.add(ln)
    if not allowed:
        reject("admin-Recipient-Policy leer (fail-closed)")
    if not recovery:
        # Break-Glass-Recovery ist PFLICHT je Datei (§1.6/M1) -> Policy OHNE @recovery = REJECT,
        # NICHT still ueberspringen (P0-1 fail-OPEN).
        reject("admin-Policy ohne @recovery-Recipient (Break-Glass Pflicht, fail-closed)")

    raw = sys.stdin.buffer.read()
    doc = StrictLoader.load(raw)
    if not isinstance(doc, dict):
        reject("Top-Level kein Mapping (top-level-Array/Skalar nicht erlaubt)")

    sops = doc.get("sops")
    if not isinstance(sops, dict):
        reject("kein gueltiger sops:-Block")

    # 1) Rekursive Schema-Whitelist der sops-Stanza (R5/HIGH-1)
    for k in sops:
        if k not in KNOWN_SOPS_FIELDS:
            reject("unbekanntes/verbotenes sops-Feld: " + str(k))
    for b in FORBIDDEN_BACKENDS:
        v = sops.get(b)
        if v not in (None, [], ""):  # nur absent/leer ok (R4/B3 praezise leer-Semantik)
            reject("Zusatz-Backend nicht erlaubt: " + b)
    # key_groups HART REJECT (R4/B3) — kann Backends verschachteln
    if "key_groups" in sops:
        reject("key_groups nicht erlaubt (HART REJECT)")
    st = sops.get("shamir_threshold")
    if st not in (None, 0):
        reject("shamir_threshold muss absent/0 sein")
    # Tier-A: keine partial-encryption-Ausnahmefelder (P1-7) — present mit truthy Wert => REJECT
    for fld in TIER_A_NO_PARTIAL:
        if fld in sops:  # PRAESENZ allein -> REJECT: leeres unencrypted_suffix:"" matcht ALLE Keys
            reject("Tier-A verbietet partial-encryption-Feld (present): " + fld)

    # 2) Pflichtfelder Envelope-Struktur
    for req in ("mac", "lastmodified"):
        if req not in sops:
            reject("Pflichtfeld fehlt: sops." + req)

    # 3) age-Recipients: rekursive Whitelist {recipient, enc}, nur age1...
    age = sops.get("age")
    if not isinstance(age, list) or not age:
        reject("sops.age fehlt/leer — nur native age erlaubt")
    recips = set()
    for entry in age:
        if not isinstance(entry, dict):
            reject("sops.age[]-Eintrag kein Mapping")
        for k in entry:
            if k not in KNOWN_AGE_FIELDS:
                reject("unbekanntes Feld in sops.age[]: " + str(k))  # R5/HIGH-1 nested
        rcpt = entry.get("recipient")
        if not isinstance(rcpt, str) or not AGE_RE.match(rcpt):
            reject("age-Recipient kein valider age1-Recipient (fail-closed)")
        recips.add(rcpt)

    # 4) Recipient-Containment gegen admin out-of-band Policy (R1/B3)
    if not recips.issubset(allowed):
        reject("Recipient nicht in admin-Policy (Containment verletzt)")
    # Recovery-Recipient MUSS im Envelope enthalten sein (recovery aus Single-Pass-Parser oben,
    # garantiert nicht-leer -> kein skip-on-empty fail-OPEN mehr, P0-1).
    if not (recovery & recips):
        reject("per-Tenant-Recovery-Recipient fehlt im Envelope (Break-Glass, fail-closed)")

    # 5) Vollverschluesselung (R1/B2): JEDER nicht-sops, nicht-allowlisted Leaf MUSS ENC[...] sein.
    #    Tier-A binary: data: "ENC[...]". Strukturierte Envelopes: jeder Daten-Leaf ENC[...].
    data_doc = {k: v for k, v in doc.items() if k != "sops"}
    leaves = list(_iter_leaves(data_doc))
    if not leaves:
        reject("kein verschluesselter Inhalt (nur sops-Block)")
    for leaf in leaves:
        if not (isinstance(leaf, str) and leaf.startswith(ENC_PREFIX)):
            reject("Klartext-Leaf gefunden — partial-encryption nicht erlaubt")

    sys.exit(0)


if __name__ == "__main__":
    main()
