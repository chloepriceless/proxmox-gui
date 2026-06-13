# INFLUX-Creds-Handoff für Brettli (agent-master) — T-0204, Schraubi

**Zweck:** Brettli baut den agent-master-Code (Usage/LLM/Matrix/Skills-Dashboard). Der Code-Teil
ist Brettlis — ich (Schraubi) liefere NUR die **INFLUX-Creds + Spec**, wie es Christin angeordnet
hat (agent-master-CODE nicht anfassen).

## Was das Dashboard braucht (aus meiner Live-Recon, SCHRAUBI-STATUS älter)
`/api/llm/stats` failt aktuell mit `influx query 404: bucket 'skills' not found`. Es fehlt:
- `INFLUX_TOKEN` — Schreib+Lese fürs agent-master-Bucket
- `INFLUX_URL` — z.B. `http://192.168.20.<x>:8086`
- `INFLUX_ORG`
- `INFLUX_BUCKET` — agent-master schreibt `llm_call` + skill-usage; **Bucket `skills`** muss evtl.
  erst angelegt werden (404 oben).

Ein Config-Fix (Token + Bucket) erhellt auf einen Schlag **/usage, /llm, /matrix, /skills**.

## Status der Beschaffung
- **NetBoard (.150) probed:** Creds dort liegen in **1Password** (`opItemId`, kein Token via API) →
  nicht self-serve. KEIN sichtbarer Influx-Eintrag in der NetBoard-Liste.
- **Netzi (orchestrator-network) angefragt** (2026-06-13, send_message) → liefert Token+URL/ORG/BUCKET.
- **→ TODO Schraubi:** sobald Netzi antwortet, hier eintragen UND an Brettli durchreichen
  (peer/notify), NICHT in git committen.

## Ablage (NICHT in git!)
Brettli legt die Werte in die EnvironmentFile, die `agent-master.service` optional lädt:
```
/home/dev/orchestrator/.secrets/influx.env       # mode 600, gitignored
  INFLUX_URL=http://192.168.20.<x>:8086
  INFLUX_TOKEN=<von Netzi>
  INFLUX_ORG=<von Netzi>
  INFLUX_BUCKET=skills
```
Die systemd-Unit referenziert sie schon: `EnvironmentFile=-/home/dev/orchestrator/.secrets/influx.env`
(`-` = optional, Server startet auch ohne; Dashboard-Usage-Teile bleiben dann nur leer).

## Übergabe-Hinweis an Brettli
- Falls `skills`-Bucket fehlt: `influx bucket create -n skills -o <org> -t <token>` (oder via UI).
- Token-Scope minimal: read+write nur auf das agent-master/skills-Bucket (kein Org-Admin-Token).
- **PLATZHALTER** — echte Werte folgen nach Netzi-Antwort.
