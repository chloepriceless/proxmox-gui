---
phase: 04-provisioning-networking-console
plan: 08
subsystem: api
tags: [novnc, websocket, reverse-proxy, vncproxy, proxmox, caddy, console]

# Dependency graph
requires:
  - phase: 03-job-queue-lifecycle
    provides: the connector _call_with_breaker convention + the jobs/ws.py auth-before-accept WebSocket handshake the relay reuses verbatim
  - phase: 04-provisioning-networking-console (plan 04-03 spike)
    provides: 04-SPIKE-novnc.md — the live-verified vncproxy/vncwebsocket contract, the single-encoding rule, the websockets-library verdict, the Caddyfile delta, the per-cluster verify_ssl posture, the ~30-40s ticket lifetime
provides:
  - the connector.vncproxy console-ticket mint method (qemu + lxc paths)
  - explicit connector.host/port/verify_ssl/tls_fingerprint attributes for the relay's upstream leg
  - POST .../{vms|lxcs}/{vmid}/console/vncproxy — the on-click mint route behind an ownership check
  - the /api/v1/ws/console/{cluster}/{kind}/{vmid} reverse-proxied bidirectional WebSocket relay
  - the Caddyfile handle /api/v1/ws/console* block with flush_interval -1
affects: [04-13-frontend-console, phase-05-polish]

# Tech tracking
tech-stack:
  added: ["websockets==16.0 (explicit pin — already in venv via uvicorn[standard])"]
  patterns:
    - "Reverse-proxied bidirectional WebSocket relay — two FIRST_COMPLETED pump tasks, the upstream leg never reaches the browser"
    - "Auth-before-accept WebSocket handshake reused from jobs/ws.py — cookie-only, close(1008) on failure"
    - "Single URL-encode hop — quote(ticket, safe='') in exactly one place; every other hop carries the raw ticket"

key-files:
  created:
    - backend/app/console/__init__.py
    - backend/app/console/schemas.py
    - backend/app/console/routes.py
    - backend/app/console/proxy.py
    - backend/tests/test_console.py
  modified:
    - backend/app/clusters/connector.py
    - backend/app/main.py
    - backend/pyproject.toml
    - deploy/caddy/Caddyfile.template

key-decisions:
  - "The relay mints its OWN fresh vncproxy ticket just-in-time (spike §3 shape a) — the browser never holds a Proxmox ticket; the mint route exists only for the early ownership check + handing the frontend the GUI relay URL"
  - "connector gains explicit host/port/verify_ssl/tls_fingerprint instance attributes — proxmoxer's ProxmoxAPI consumes and discards them, and the relay's upstream wss leg needs them as a stable contract"
  - "The vncticket is URL-encoded exactly once via quote(ticket, safe='') in console/proxy.py; safe='' is load-bearing — Python's quote leaves '/' raw by default and the base64 ticket body contains '/'"
  - "The relay's ownership-check failure (resolve_resource raising HTTPException 403) is translated to a WebSocket close(1008) — a WS handshake cannot return an HTTP status"
  - "The console WS path /api/v1/ws/console* gets its own Caddy handle block with flush_interval -1 (nginx proxy_buffering off equivalent), placed before the generic /api/* block"

patterns-established:
  - "Console relay: auth → kind-guard → ownership check → just-in-time mint → single-encode upstream URL → per-cluster TLS ctx → two-pump relay loop — all the gating runs BEFORE websocket.accept()"
  - "WebSocket relay test double: a fake websockets.connect CM (_FakeConnectCM) recording the URL + ssl arg, plus a _FakeUpstream async-iterator with an optional wait-for-send Event for deterministic bidirectional ordering"

requirements-completed: [CON-01, CON-02, CON-03]

# Metrics
duration: ~38min
completed: 2026-05-16
---

# Phase 4 Plan 08: Console Backend Summary

**The embedded-noVNC console backend — a server-side vncproxy ticket mint and a reverse-proxied bidirectional WebSocket relay that keeps the Proxmox host:8006 URL and the vncticket entirely out of the browser, implemented against the live-verified spike 04-03 contract.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-05-16T20:30Z (approx)
- **Completed:** 2026-05-16T21:08Z (approx)
- **Tasks:** 2 of 2
- **Files modified/created:** 9 (5 created, 4 modified)

## Accomplishments

- **CON-02 — on-click ticket mint:** `connector.vncproxy` issues the spike-confirmed `POST /nodes/{node}/{qemu|lxc}/{vmid}/vncproxy` with `websocket=1` through `_call_with_breaker`; `POST .../{vms|lxcs}/{vmid}/console/vncproxy` mints the ticket on the click that hits the route — never on page load (the ticket lives ~30-40s, measured live in the spike).
- **CON-01 — ownership-gated console:** both the mint route (`require_resource_access`) and the relay endpoint (`resolve_resource`) run a team-scoped ownership check before proceeding; a console for a resource the principal does not own → 403 / WS close.
- **CON-03 — reverse-proxied WebSocket:** `console/proxy.py` runs a FastAPI WebSocket relay on the GUI's own origin; the browser's iframe connects to `/api/v1/ws/console/...`, the relay holds the `wss://pve-host:8006/.../vncwebsocket` leg. The Proxmox host URL and the vncticket never reach the browser.
- **Pitfall 2 — single encoding:** the `vncticket` is URL-encoded exactly once via `urllib.parse.quote(ticket, safe="")` in `console/proxy.py` when the upstream URL is built; a unit test round-trips the encoded ticket back to the raw value to prove a single quote layer (no `%25` double-encoding).
- **Caddy delta:** `deploy/caddy/Caddyfile.template` gains a `handle /api/v1/ws/console*` block with `flush_interval -1` (disables Caddy response buffering for the latency-sensitive VNC stream), placed before the generic `/api/*` block per the spike's `CADDY:` verdict.
- 462 → **477 backend tests green** (15 new console tests; no existing test broken).

## Task Commits

Each task was committed atomically (TDD — RED test + GREEN implementation in one commit per task, plus a dependency-pin chore):

1. **Task 1: vncproxy connector mint + console mint route** — `909b34f` (feat)
2. **Task 2: reverse-proxied console WS relay + Caddyfile delta** — `7e25d13` (feat)
3. **websockets explicit pyproject.toml pin** — `87fd7e3` (chore)

## Files Created/Modified

**Created:**
- `backend/app/console/__init__.py` — console package marker.
- `backend/app/console/schemas.py` — `VncProxyResponse` (`ticket`, `port`, `relay_url`); `relay_url` is the GUI-origin path, never the Proxmox host URL.
- `backend/app/console/routes.py` — the `POST .../{vms|lxcs}/{vmid}/console/vncproxy` mint routes, CSRF-protected, behind `require_resource_access`; also `include_router`s the relay.
- `backend/app/console/proxy.py` — the reverse-proxied bidirectional WebSocket relay: auth-before-accept, ownership check, just-in-time mint, single-encode upstream URL, per-cluster TLS context, two-pump relay loop.
- `backend/tests/test_console.py` — 15 tests (7 mint/connector, 8 relay).

**Modified:**
- `backend/app/clusters/connector.py` — added `vncproxy` (the dual-type qemu/lxc mint method) + explicit `host`/`port`/`verify_ssl`/`tls_fingerprint` instance attributes for the relay's upstream leg (APPEND-ONLY — no existing content reordered).
- `backend/app/main.py` — `console_router` import + `include_router` (APPEND-ONLY).
- `backend/pyproject.toml` — explicit `websockets==16.0` pin (a contractual pin; the package was already in the venv via `uvicorn[standard]`).
- `deploy/caddy/Caddyfile.template` — the `handle /api/v1/ws/console*` block with `flush_interval -1`.

## Spike Compliance (04-03 — APPROVED)

The plan was spike-gated; every spike verdict was honoured:

| Spike verdict | Implementation |
|---------------|----------------|
| `VNCPROXY MINT` — `POST .../{qemu|lxc}/{vmid}/vncproxy`, `websocket=1` | `connector.vncproxy` issues exactly this through `_call_with_breaker`. |
| `ENCODING` — encoded once in `console/proxy.py` via `quote(ticket, safe="")` | `_build_vncwebsocket_url` is the single encode hop; a test round-trips to prove it. |
| `RELAY` — the `websockets` library, no new dependency | `websockets.asyncio.client.connect`; pinned explicitly in `pyproject.toml` (it was already in the venv). |
| `CADDY` — a `handle /api/v1/ws/console*` block with `flush_interval -1`, before `/api/*` | Added verbatim, placed before the generic `/api/*` block. |
| `SELF-SIGNED CERT` — the upstream leg reuses the per-cluster `verify_ssl` posture | `_upstream_ssl_context` builds an `ssl.SSLContext` from `connector.verify_ssl` (`CERT_NONE` + `check_hostname=False` when `verify_ssl=False`). |
| `TICKET LIFETIME` — mint on click only | The mint route mints on the click; the relay re-mints just-in-time before the upstream connect. |
| `AUTH` — reuse `jobs/ws.py` auth-before-accept, cookie-only, `close(1008)` | `proxy.py` calls `jobs.ws._resolve_ws_user` verbatim; both the mint route and the relay run an ownership check. |

## Deviations from Plan

**None** — the plan executed exactly as written, against the spike contract.

One narrow auto-decision (within Rule 3, blocking-issue scope): the connector did not previously expose `host`/`port`/`verify_ssl` as instance attributes (proxmoxer's `ProxmoxAPI` consumes them in its constructor and discards them). The relay's upstream `wss://` leg needs them, so four explicit, append-only instance attributes were added to `connector.__init__` and the spike's "keep the relay's TLS decision reading off the cluster row" guidance was satisfied via `connector.verify_ssl`. This was anticipated by the plan ("the connector exposes the per-cluster host + the verify_ssl TLS posture the relay's upstream leg reuses") so it is not a true deviation.

## Threat Model Coverage

All six STRIDE register entries from the plan's `<threat_model>` are mitigated:

- **T-04-08-01** (vncticket / host exposure) — the mint response carries only the GUI relay URL; a test asserts the body has no `8006` substring and no raw `vncwebsocket` URL. The relay holds the ticket only on the upstream leg.
- **T-04-08-02** (unauthenticated WS handshake) — `_resolve_ws_user` validates the `access_token` cookie before `accept()`; `close(1008)` on failure; a test asserts a cookie-less connect closes 1008.
- **T-04-08-03** (cross-tenant console access) — both the mint route and the relay resolve ownership; tests assert 403 (mint) and a 1008 close (relay) for a cross-tenant resource.
- **T-04-08-04** (double-encoded ticket) — a single `quote(ticket, safe="")` hop; a test asserts `%25` is absent and the encoded ticket round-trips to the raw value.
- **T-04-08-05** (replayed/stale ticket) — the relay mints a fresh ticket per connection just-in-time; the ticket is never cached, persisted, or logged.
- **T-04-08-06** (upstream MITM) — the upstream leg reuses the per-cluster `verify_ssl` posture; a test asserts a `verify_ssl=False` cluster yields a `CERT_NONE` context (it does not silently disable verification beyond the configured posture).

## Known Stubs

**None.** The console backend is fully wired — the connector mints, the route returns a real relay URL, and the relay relays real bytes. The noVNC *frontend* (the iframe, the Console tab, the Reconnect button) is plan **04-13**'s scope, as designed — the relay endpoint and the mint route are the complete backend contract 04-13 consumes.

## Notes for Plan 04-13 (Console Frontend)

- The mint route is `POST /api/v1/clusters/{id}/{vms|lxcs}/{vmid}/console/vncproxy`; it returns `{ticket, port, relay_url}`. The frontend points the iframe's noVNC client at `relay_url` (`/api/v1/ws/console/{id}/{kind}/{vmid}`) — **never** at the Proxmox host.
- A non-clean WebSocket close from the relay means the upstream session ended (ticket expiry / guest stop / drop) — the frontend surfaces the `bg-warning/10` "Console session ended." strip with the Reconnect button.
- Reconnect re-calls the mint route (fresh ownership check + fresh relay URL) and rebuilds the iframe.

## Self-Check: PASSED

- All 5 created files exist on disk.
- All 4 modified files contain the documented changes.
- All 3 task commits (`909b34f`, `7e25d13`, `87fd7e3`) exist in `git log`.
- 477 backend tests pass; `ruff check app/console app/clusters/connector.py app/main.py` clean; the app boots with the console router + relay registered.
