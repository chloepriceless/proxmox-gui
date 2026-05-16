---
status: partial
phase: 04-provisioning-networking-console
source: [04-VERIFICATION.md]
started: 2026-05-16T23:55:00.000Z
updated: 2026-05-16T23:55:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Embedded noVNC console renders end-to-end (CON-01)
expected: Navigate to an existing VM's Console tab and click "Open console". The iframe loads the `/console/embed` SvelteKit page; the vendored noVNC RFB client instantiates and renders the VM's screen (the overlay transitions from "Connecting..." to the framebuffer). The `<iframe>` carries `sandbox="allow-scripts allow-same-origin"`. The relay WebSocket URL in DevTools uses `window.location.host`, not a `:8006` host.
result: [pending]

### 2. Community-script deploy end-to-end (LXC-01..04)
expected: On a freshly-provisioned GUI LXC (after Phase 5 installer provisions SSH key trust), trigger a community-script deploy from the wizard. The LXC is created (stage 1); stage 2 runs the install script inside it via `pct exec` over SSH; install output streams to the Tasks drawer.
result: [pending]

### 3. Node-fit disabled-node UX (VM-10)
expected: In the Create wizard, select a cluster and request RAM exceeding what one node has free. That node is disabled in the NodeSelect component with a label like "node-X — Y GB free, needs Z GB"; nodes with sufficient capacity remain selectable.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
