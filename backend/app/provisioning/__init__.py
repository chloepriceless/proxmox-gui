"""Provisioning module — LXC + VM create flows (LXC-05..07, VM-01..04).

Owns the 202-Accepted create API: ``POST /clusters/{id}/provisioning/lxc``
and ``.../provisioning/qemu``. The shape mirrors the Phase-3 clone path
(``app.lifecycle.clone``) — quota admission → VMID reservation → enqueue_job —
because Phase 4 adds no new architectural primitives here (04-RESEARCH).
"""
