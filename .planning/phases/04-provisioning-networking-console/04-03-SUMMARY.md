---
phase: 04-provisioning-networking-console
plan: 03
subsystem: research-spike
tags: [novnc, console, websocket, caddy, vncproxy, spike]
dependency_graph:
  requires:
    - "Phase 4 RESEARCH.md Assumptions A4/A8 + Open Question 4 (noVNC console flow)"
  provides:
    - "04-SPIKE-novnc.md — evidence-backed backend contract for console/proxy.py + console/routes.py"
    - "RELAY: upstream WS via the websockets library (already installed via uvicorn[standard]) — no new dependency"
    - "CADDY: a handle /api/v1/ws/console* block with flush_interval -1 is required (ships with 04-08)"
    - "vncticket single-encoding rule + measured ~30-45s ticket lifetime"
  affects:
    - "04-08 (console backend — vncproxy mint + reverse-proxied WebSocket relay)"
tech_stack:
  added: []
  patterns:
    - "Spike-gated plan: a research doc pins the relay design + Caddyfile delta a later implementation plan builds against"
key_files:
  created:
    - .planning/phases/04-provisioning-networking-console/04-SPIKE-novnc.md
  modified: []
decisions:
  - "RELAY: the upstream WebSocket leg uses the websockets library — already installed in the production venv (websockets==16.0, pulled in by uvicorn[standard]==0.46.0); 04-08 only promotes it to an explicit pyproject.toml pin. httpx cannot do WebSocket (confirmed live)"
  - "CADDY: a Caddyfile change IS required — a handle /api/v1/ws/console* block with reverse_proxy 127.0.0.1:8000 { flush_interval -1 }, placed before the generic /api/* block, to disable response buffering for the latency-sensitive VNC stream"
  - "ENCODING: the vncticket is URL-encoded exactly once, in the backend when building the upstream vncwebsocket URL — no relay hop double-encodes"
  - "SELF-SIGNED CERT: the relay's upstream WS leg reuses the per-cluster verify_ssl posture already stored on the clusters row; tls_fingerprint pinning is the intended hardening path"
  - "TICKET LIFETIME: measured live on PVE 9.1.2 — valid at t+30s, expired (401) by t+45s; mint-on-click + Reconnect button makes any lifetime safe"
patterns_established:
  - "The console WS reuses the jobs/ws.py auth-before-accept handshake (cookie-only, no PAT, close 1008 on failure)"
requirements-completed: []
metrics:
  duration: ~11 min
  completed: 2026-05-16
  tasks: 2
  files: 1
---

# Phase 4 Plan 03: noVNC Reverse-Proxy Spike Summary

**Pinned the embedded-noVNC backend contract for 04-08 against the live PVE 9.1.2 cluster — the upstream WS relay uses the already-installed `websockets` library (no new dependency), the vncticket is single-encoded in the backend, and a `handle /api/v1/ws/console*` Caddy block with `flush_interval -1` is required.**

## Performance

- **Duration:** ~11 min
- **Completed:** 2026-05-16
- **Tasks:** 2 (1 investigation + 1 human-verify checkpoint)
- **Files modified:** 1 (created)

## Accomplishments

- Produced `04-SPIKE-novnc.md` (373 lines) answering all 7 gating questions, each with a verdict line, backed by a live PVE 9.1.2 probe, the Proxmox API viewer, and the two cited forum threads. No claim is marked `[ASSUMED]` — the live cluster was reachable for every gating measurement.
- Resolved Research Assumptions A4, A8 and Open Question 4.
- Delivered a concrete backend contract for `connector.vncproxy`, `console/routes.py`, `console/proxy.py`, the iframe-src shape, and the Caddyfile delta.

## Task Commits

1. **Task 1: Investigate the noVNC console flow and produce the spike findings document** — `834c2c1` (docs)
2. **Task 2: Human-verify checkpoint** — approved by the user; no commit (verification gate)

**Worktree merge:** `16bd65b`

## Files Created/Modified

- `.planning/phases/04-provisioning-networking-console/04-SPIKE-novnc.md` — noVNC spike findings: the `vncproxy` mint shape, the `vncwebsocket` URL + single-encoding rule, the reverse-proxied WebSocket relay design, the Caddy WebSocket headers/buffering delta, self-signed-cert handling, the measured ticket lifetime, and the backend contract for 04-08.

## Decisions Made

- **`RELAY` — no new dependency.** The upstream WebSocket leg uses the `websockets` library, already installed in the production venv (`websockets==16.0`, pulled in by `uvicorn[standard]==0.46.0`). 04-08 only promotes it to an explicit `pyproject.toml` pin — no package is installed. `httpx` cannot do WebSocket (confirmed live: `httpx.Client` has no `connect_ws`), so `httpx-ws`/`aiohttp` were rejected.
- **`CADDY` — a Caddyfile change IS required.** A dedicated `handle /api/v1/ws/console*` block with `reverse_proxy 127.0.0.1:8000 { flush_interval -1 }`, placed before the generic `/api/*` block. `flush_interval -1` disables Caddy response buffering for the latency-sensitive VNC stream. Ships with 04-08.
- **`ENCODING`** — the `vncticket` is URL-encoded exactly once, in the backend when constructing the upstream `vncwebsocket` URL; no relay hop double-encodes (Pitfall 2/3).
- **`SELF-SIGNED CERT`** — the relay's upstream WS leg reuses the per-cluster `verify_ssl` posture already on the `clusters` row (the managed cluster `192.168.20.240` is registered `verify_ssl=False`); `tls_fingerprint` pinning is the intended hardening path.
- **`TICKET LIFETIME`** — measured live on PVE 9.1.2: valid at t+30s, expired (HTTP 401) by t+45s. Mint-on-click + a Reconnect button makes any lifetime safe.

## Deviations from Plan

None — plan executed as written. The plan's `<interfaces>` block sketched the `vncproxy`/`vncwebsocket` shapes; the spike confirmed them and pinned the relay library and Caddyfile delta, which is the spike's purpose.

## Issues Encountered

None. The live cluster was reachable for every gating measurement, including a real `vncproxy` ticket mint and lifetime measurement.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **04-08 (console backend)** now has a concrete contract: `connector.vncproxy`, the `console/routes.py` mint route (ownership-checked, mint-on-click), the `console/proxy.py` bidirectional relay (auth-before-accept, cookie-only), the iframe-src shape, and the exact Caddyfile `handle` block.
- Material change for 04-08 vs. the original plan: a Caddyfile change is required (the original plan left this open); `websockets` becomes an explicit pin.

---
*Phase: 04-provisioning-networking-console*
*Completed: 2026-05-16*
