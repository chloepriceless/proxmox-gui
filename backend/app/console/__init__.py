"""Embedded-noVNC console backend — the spike-gated console domain (plan 04-08).

Two surfaces, both pinned by spike 04-03 (``04-SPIKE-novnc.md``):

- ``routes.py`` — ``POST .../console/vncproxy`` mints a ``vncticket`` on the
  user's "Open console" click (CON-02 — never on page load) behind an
  ownership check (CON-01); the response carries the GUI's own relay URL,
  never the Proxmox-host:8006 URL or the ticket (CON-03, T-04-08-01).
- ``proxy.py`` — the reverse-proxied bidirectional WebSocket relay (CON-03):
  auth-before-``accept()``, ownership-checked, the ``vncticket`` URL-encoded
  exactly once on the upstream leg (Pitfall 2).
"""
