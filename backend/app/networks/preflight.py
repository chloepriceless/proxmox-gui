"""SSH ``pct exec`` preflight (Plan 05-06, D-23).

A community-script deploy runs INSIDE the freshly-created LXC via ``pct exec``
over SSH from the GUI to the hosting node (Phase 4 spike §3 / Pitfall 8). That
path only works if the GUI can SSH into the node as root — i.e. the GUI's
``gui_ed25519`` public key is trusted in the node's ``authorized_keys`` (laid
down idempotently by ``install.sh``, Plan 05-04 / D-21/D-22).

This module preflights that trust so the wizard can gate ONLY the
community-script path with a guided fix when SSH is not set up. Plain-LXC and
VM provisioning need no SSH and are never gated.

The probe runs a trivial node-side command (``pct list``) over the same
``ssh -o BatchMode=yes`` transport the deploy uses. ``BatchMode=yes`` forbids
any interactive/password prompt, so an untrusted key fails fast instead of
hanging. The preflight NEVER raises — a failure returns ``{ok: False, detail}``.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

SSH_PREFLIGHT_TIMEOUT_S = 10.0
_OK_MARKER = "PREFLIGHT_OK"


async def _run_ssh_probe(
    node: str, remote_cmd: str, timeout: float  # noqa: ASYNC109 — `timeout` is the SSH ConnectTimeout value, not an async-cancellation budget
) -> tuple[int, str]:
    """Run ``ssh -o BatchMode=yes root@<node> <remote_cmd>``; return (rc, output).

    Isolated in its own function so tests monkeypatch it without a real node.
    ``BatchMode=yes`` means a missing/untrusted key fails fast (non-zero rc)
    rather than blocking on a password prompt.
    """
    proc = await asyncio.create_subprocess_exec(
        "ssh",
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", f"ConnectTimeout={int(timeout)}",
        f"root@{node}",
        remote_cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout + 5)
    except TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        return 255, "ssh preflight timed out"
    return proc.returncode or 0, out.decode("utf-8", "replace")


async def ssh_pct_exec_preflight(
    connector: Any, node: str, *, timeout: float = SSH_PREFLIGHT_TIMEOUT_S  # noqa: ASYNC109 — `timeout` is the SSH ConnectTimeout value, not an async-cancellation budget
) -> dict[str, Any]:
    """Probe whether the GUI can ``pct exec`` on ``node`` over SSH (D-23).

    ``connector`` identifies the cluster; SSH authenticates with the GUI's own
    ``gui_ed25519`` key (NOT a cluster API token), so the probe shells out to
    the node directly. Running ``pct list`` confirms BOTH SSH trust AND that
    ``pct`` is available. Returns ``{ok: bool, detail: str}``; never raises.
    """
    # `connector` is reserved for future per-cluster SSH config; today SSH trust
    # is established with the GUI's own key against the node, so it is unused.
    remote_cmd = f"pct list >/dev/null 2>&1 && echo {_OK_MARKER}"
    try:
        rc, output = await _run_ssh_probe(node, remote_cmd, timeout)
    except Exception as exc:  # noqa: BLE001 — any failure means "not reachable"
        logger.warning("ssh preflight error for node=%s: %s", node, exc)
        return {"ok": False, "detail": f"SSH preflight error: {exc}"}

    if rc == 0 and _OK_MARKER in output:
        return {
            "ok": True,
            "detail": "SSH trust OK — pct exec is reachable on this node.",
        }

    tail = output.strip()[-300:] if output.strip() else f"ssh exited {rc}"
    return {"ok": False, "detail": f"pct exec not reachable over SSH: {tail}"}
