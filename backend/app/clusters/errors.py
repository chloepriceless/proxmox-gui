"""Cluster / connector exception hierarchy.

These exceptions are raised by :class:`~app.clusters.connector.PVEConnector`
and translated to HTTP responses by exception handlers registered in
:mod:`app.main`:

- :class:`PVEUnreachable` → 502 "Couldn't reach that Proxmox URL."
- :class:`PVEAuthError`   → 422 "Proxmox rejected that token."
- :class:`PVEAPIError`    → 502 "Proxmox returned an unexpected error."

The service-layer dry-run (``test_cluster``) catches them locally to produce
the structured ``{ok: False, error: ...}`` response instead.
"""

from __future__ import annotations


class PVEUnreachable(Exception):
    """The Proxmox API host is unreachable (DNS / TCP / TLS handshake)."""


class PVEAuthError(Exception):
    """Proxmox rejected the API token (401 / 403 from /version)."""


class PVEAPIError(Exception):
    """Proxmox returned an unexpected error (non-401, non-network)."""

    def __init__(self, status_code: int, body: str = "") -> None:
        super().__init__(f"{status_code}: {body}")
        self.status_code = status_code
        self.body = body
