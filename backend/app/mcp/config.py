"""MCP server configuration — read from the environment (T-0032).

The MCP bridge is a *client* of the GUI's REST API, so all it needs is a base
URL and a PAT. Kept deliberately separate from ``app.config.Settings`` (which
configures the API server itself) — the MCP process and the API process are
independent.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


class MCPConfigError(RuntimeError):
    """Raised when required MCP configuration is missing/invalid."""


@dataclass(frozen=True)
class MCPConfig:
    """Resolved MCP bridge configuration."""

    api_base: str
    """Base URL of the Proxmox-GUI REST API, e.g. ``http://127.0.0.1:8000``.

    Defaults to the loopback API on the same host so no TLS/network exposure is
    added; the bridge talks to the FastAPI process directly, beneath Caddy.
    """

    pat: str
    """A Personal Access Token (``pat_…``) minted for the MCP service user.

    Sent as ``Authorization: Bearer <pat>``. Inherits that user's RBAC — the
    bridge can never exceed it. Never logged.
    """

    verify_tls: bool = True
    """Verify TLS when ``api_base`` is https. Irrelevant for the loopback http
    default; set false only if pointing at a self-signed https endpoint."""

    job_poll_timeout_s: float = 120.0
    """Upper bound for ``wait=true`` job polling before returning the last
    observed state. A poll loop never blocks a Proxmox call — it polls the
    GUI's own ``/jobs/{id}`` view of the queue."""

    request_timeout_s: float = 30.0


def load_config(env: dict[str, str] | None = None) -> MCPConfig:
    """Build :class:`MCPConfig` from ``env`` (defaults to ``os.environ``).

    Raises :class:`MCPConfigError` if the PAT is absent — the bridge is useless
    and must fail loudly rather than start unauthenticated.
    """
    e = os.environ if env is None else env
    pat = (e.get("PROXMOX_GUI_MCP_PAT") or "").strip()
    if not pat:
        raise MCPConfigError(
            "PROXMOX_GUI_MCP_PAT is required — mint a PAT under the GUI's "
            "Account → API tokens and export it. The MCP bridge authenticates "
            "as that token's user (it inherits that user's RBAC)."
        )
    api_base = (e.get("PROXMOX_GUI_MCP_API_BASE") or "http://127.0.0.1:8000").rstrip("/")
    verify_tls = (e.get("PROXMOX_GUI_MCP_VERIFY_TLS") or "true").strip().lower() not in {
        "0",
        "false",
        "no",
    }

    def _float(name: str, default: float) -> float:
        raw = (e.get(name) or "").strip()
        if not raw:
            return default
        try:
            v = float(raw)
        except ValueError:
            return default
        return v if v > 0 else default

    return MCPConfig(
        api_base=api_base,
        pat=pat,
        verify_tls=verify_tls,
        request_timeout_s=_float("PROXMOX_GUI_MCP_REQUEST_TIMEOUT_S", 30.0),
        job_poll_timeout_s=_float("PROXMOX_GUI_MCP_JOB_POLL_TIMEOUT_S", 120.0),
    )
