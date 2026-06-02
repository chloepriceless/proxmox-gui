"""SSH pct-exec preflight tests (Plan 05-06, Task 3, D-23).

The community-script deploy path runs inside the freshly-created LXC via
``pct exec`` over SSH from the GUI to the hosting node. Before offering that
path the wizard preflights SSH trust. These tests pin the preflight's contract:

1. A successful probe (rc=0 + the OK marker) → ``{ok: True}``.
2. A failed probe (non-zero rc / no marker) → ``{ok: False}`` with the output
   tail in ``detail`` — NEVER raises.
3. A probe that raises (ssh binary missing, OSError) → ``{ok: False}`` — the
   preflight degrades to "not reachable", it does not propagate the exception.
"""

from __future__ import annotations

import pytest

from app.networks import preflight


@pytest.mark.asyncio
async def test_preflight_ok_when_probe_succeeds(monkeypatch):
    async def fake_probe(node, remote_cmd, timeout):
        assert "pct list" in remote_cmd
        return 0, "PREFLIGHT_OK\n"

    monkeypatch.setattr(preflight, "_run_ssh_probe", fake_probe)

    result = await preflight.ssh_pct_exec_preflight(object(), "pve-1")
    assert result["ok"] is True
    assert "detail" in result


@pytest.mark.asyncio
async def test_preflight_fails_on_nonzero_rc(monkeypatch):
    async def fake_probe(node, remote_cmd, timeout):
        return 255, "Permission denied (publickey).\n"

    monkeypatch.setattr(preflight, "_run_ssh_probe", fake_probe)

    result = await preflight.ssh_pct_exec_preflight(object(), "pve-1")
    assert result["ok"] is False
    assert "publickey" in result["detail"]


@pytest.mark.asyncio
async def test_preflight_fails_when_marker_absent(monkeypatch):
    """rc=0 but the OK marker missing (e.g. pct not installed) → not ok."""
    async def fake_probe(node, remote_cmd, timeout):
        return 0, "bash: pct: command not found\n"

    monkeypatch.setattr(preflight, "_run_ssh_probe", fake_probe)

    result = await preflight.ssh_pct_exec_preflight(object(), "pve-1")
    assert result["ok"] is False


@pytest.mark.asyncio
async def test_preflight_never_raises_on_probe_error(monkeypatch):
    async def boom(node, remote_cmd, timeout):
        raise OSError("ssh: executable not found")

    monkeypatch.setattr(preflight, "_run_ssh_probe", boom)

    result = await preflight.ssh_pct_exec_preflight(object(), "pve-1")
    assert result["ok"] is False
    assert "detail" in result
