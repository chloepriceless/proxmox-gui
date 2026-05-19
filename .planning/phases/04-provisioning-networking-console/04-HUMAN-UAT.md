---
status: partial
phase: 04-provisioning-networking-console
source: [04-VERIFICATION.md]
started: 2026-05-16T23:55:00.000Z
updated: 2026-05-17T22:10:00.000Z
---

## Current Test

[1a passed; 1b + 1c deferred — see results below]

## Tests

### 1. Embedded noVNC console renders end-to-end (CON-01)
expected: Navigate to an existing VM's Console tab and click "Open console". The iframe loads the `/console/embed` SvelteKit page; the vendored noVNC RFB client instantiates and renders the VM's screen (the overlay transitions from "Connecting..." to the framebuffer). The `<iframe>` carries `sandbox="allow-scripts allow-same-origin"`. The relay WebSocket URL in DevTools uses `window.location.host`, not a `:8006` host.
result: [pass] 2026-05-17 — console renders end-to-end. Root cause: PVE's VNC server requires VNC auth (security type 2 — confirmed by a live RFB-handshake probe; spike 04-03 never rendered a framebuffer and missed this), but the embed page passed no `credentials.password` so the handshake stalled on "Connecting…". Fix (commit d591fe5): the vncticket is threaded to noVNC's `credentials.password`; the relay no longer mints a second vncproxy session (single mint). Relay log shows clean `connecting upstream → established`.

### 2. Community-script deploy end-to-end (LXC-01..04)
expected: On a freshly-provisioned GUI LXC (after Phase 5 installer provisions SSH key trust), trigger a community-script deploy from the wizard. The LXC is created (stage 1); stage 2 runs the install script inside it via `pct exec` over SSH; install output streams to the Tasks drawer.
result: [deferred] Blocked on Phase 5 — needs first-run SSH key trust from the installer. Retest as a Phase-05 UAT item once the installer provisions key trust.

### 3. Node-fit disabled-node UX (VM-10)
expected: In the Create wizard, select a cluster and request RAM exceeding what one node has free. That node is disabled in the NodeSelect component with a label like "node-X — Y GB free, needs Z GB"; nodes with sufficient capacity remain selectable.
result: [deferred] 2026-05-19 — visual UAT postponed by user. The node-fit logic is covered by 15 passing unit tests (`frontend/tests/node-fit.test.ts`). Retest on request or during Phase 5 polish.

## Summary

total: 3
passed: 1
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps
