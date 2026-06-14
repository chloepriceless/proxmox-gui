"""Tests for the MCP bridge (T-0032).

Covers config loading, the REST client (URL/method/body/headers/error-scrubbing/
job-polling via respx), and the FastMCP tool surface end-to-end against a fake
client.
"""

from __future__ import annotations

import httpx
import pytest
import respx

# The MCP bridge lives in the optional ``[mcp]`` extra (pyproject), not in the
# dev dependency group. Skip this whole module (instead of breaking the entire
# suite at collection time) when ``mcp`` is absent — e.g. a bare dev install.
# CI installs ``.[mcp]`` so this still runs there.
pytest.importorskip("mcp")

from app.mcp.client import MCPClientError, ProxmoxGuiClient
from app.mcp.config import MCPConfig, MCPConfigError, load_config
from app.mcp.server import build_server

BASE = "http://127.0.0.1:8000"
PAT = "pat_secrettoken123"


def _cfg(**kw) -> MCPConfig:
    return MCPConfig(api_base=BASE, pat=PAT, **kw)


# ---------------------------------------------------------------------------
# config
# ---------------------------------------------------------------------------
class TestConfig:
    def test_missing_pat_raises(self):
        with pytest.raises(MCPConfigError):
            load_config(env={})

    def test_defaults(self):
        c = load_config(env={"PROXMOX_GUI_MCP_PAT": "pat_x"})
        assert c.pat == "pat_x"
        assert c.api_base == "http://127.0.0.1:8000"
        assert c.verify_tls is True

    def test_base_trailing_slash_stripped_and_verify_off(self):
        c = load_config(env={
            "PROXMOX_GUI_MCP_PAT": "pat_x",
            "PROXMOX_GUI_MCP_API_BASE": "https://gui.example/",
            "PROXMOX_GUI_MCP_VERIFY_TLS": "false",
        })
        assert c.api_base == "https://gui.example"
        assert c.verify_tls is False


# ---------------------------------------------------------------------------
# client (respx)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestClient:
    async def test_list_inventory_all_and_per_cluster(self):
        async with ProxmoxGuiClient(_cfg()) as client:
            with respx.mock(base_url=BASE) as mock:
                mock.get("/api/v1/me/inventory").mock(
                    return_value=httpx.Response(200, json=[{"cluster_id": 1, "items": []}])
                )
                mock.get("/api/v1/clusters/3/inventory").mock(
                    return_value=httpx.Response(200, json={"cluster_id": 3, "items": []})
                )
                allinv = await client.list_inventory()
                one = await client.list_inventory(3)
        assert allinv[0]["cluster_id"] == 1
        assert one["cluster_id"] == 3

    async def test_auth_header_present(self):
        async with ProxmoxGuiClient(_cfg()) as client:
            with respx.mock(base_url=BASE) as mock:
                route = mock.get("/api/v1/me/inventory").mock(
                    return_value=httpx.Response(200, json=[])
                )
                await client.list_inventory()
        assert route.calls.last.request.headers["Authorization"] == f"Bearer {PAT}"

    async def test_create_lxc_posts_body(self):
        body = {"team_id": 1, "node": "pve-01", "hostname": "c1"}
        async with ProxmoxGuiClient(_cfg()) as client:
            with respx.mock(base_url=BASE) as mock:
                route = mock.post("/api/v1/clusters/2/provisioning/lxc").mock(
                    return_value=httpx.Response(202, json={"job_id": 9, "state": "queued", "vmid": 123})
                )
                r = await client.create_lxc(2, body)
        import json as _j
        assert _j.loads(route.calls.last.request.content)["hostname"] == "c1"
        assert r["job_id"] == 9 and r["vmid"] == 123

    async def test_power_vm_vs_lxc_path(self):
        async with ProxmoxGuiClient(_cfg()) as client:
            with respx.mock(base_url=BASE) as mock:
                vm = mock.post("/api/v1/clusters/1/vms/100/power").mock(
                    return_value=httpx.Response(202, json={"job_id": 1, "state": "queued"})
                )
                lxc = mock.post("/api/v1/clusters/1/lxcs/200/power").mock(
                    return_value=httpx.Response(202, json={"job_id": 2, "state": "queued"})
                )
                await client.power(1, 100, is_lxc=False, action="start")
                await client.power(1, 200, is_lxc=True, action="stop")
        import json as _j
        assert _j.loads(vm.calls.last.request.content)["action"] == "start"
        assert _j.loads(lxc.calls.last.request.content)["action"] == "stop"

    async def test_delete_path(self):
        async with ProxmoxGuiClient(_cfg()) as client:
            with respx.mock(base_url=BASE) as mock:
                route = mock.delete("/api/v1/clusters/1/vms/100").mock(
                    return_value=httpx.Response(202, json={"job_id": 5, "state": "queued"})
                )
                r = await client.delete(1, 100, is_lxc=False)
        assert route.called and r["job_id"] == 5

    async def test_error_maps_and_scrubs_pat(self):
        async with ProxmoxGuiClient(_cfg()) as client:
            with respx.mock(base_url=BASE) as mock:
                # Echo the PAT into the error body to prove it gets scrubbed.
                mock.get("/api/v1/me/inventory").mock(
                    return_value=httpx.Response(403, json={"detail": f"denied {PAT}"})
                )
                with pytest.raises(MCPClientError) as ei:
                    await client.list_inventory()
        msg = str(ei.value)
        assert "403" in msg and PAT not in msg and "pat_***" in msg

    async def test_wait_for_job_polls_until_terminal(self):
        async with ProxmoxGuiClient(_cfg(job_poll_timeout_s=10)) as client:
            with respx.mock(base_url=BASE) as mock:
                mock.get("/api/v1/jobs/7").mock(side_effect=[
                    httpx.Response(200, json={"id": 7, "state": "queued"}),
                    httpx.Response(200, json={"id": 7, "state": "running"}),
                    httpx.Response(200, json={"id": 7, "state": "succeeded"}),
                ])
                job = await client.wait_for_job(7, interval_s=0)
        assert job["state"] == "succeeded"

    async def test_needs_review_is_terminal(self):
        # An orphan-reaper "needs_review" job must STOP polling (one GET only).
        async with ProxmoxGuiClient(_cfg(job_poll_timeout_s=10)) as client:
            with respx.mock(base_url=BASE) as mock:
                route = mock.get("/api/v1/jobs/8").mock(
                    return_value=httpx.Response(200, json={"id": 8, "state": "needs_review"})
                )
                job = await client.wait_for_job(8, interval_s=0)
        assert job["state"] == "needs_review"
        assert route.call_count == 1  # did not keep polling

    async def test_orphaned_keeps_polling_until_resolved(self):
        # "orphaned" is transient — the reaper re-resolves it; keep polling.
        async with ProxmoxGuiClient(_cfg(job_poll_timeout_s=10)) as client:
            with respx.mock(base_url=BASE) as mock:
                mock.get("/api/v1/jobs/9").mock(side_effect=[
                    httpx.Response(200, json={"id": 9, "state": "orphaned"}),
                    httpx.Response(200, json={"id": 9, "state": "orphaned"}),
                    httpx.Response(200, json={"id": 9, "state": "failed"}),
                ])
                job = await client.wait_for_job(9, interval_s=0)
        assert job["state"] == "failed"


# ---------------------------------------------------------------------------
# server (FastMCP end-to-end against a fake client)
# ---------------------------------------------------------------------------
class FakeClient:
    def __init__(self):
        self.calls: list[tuple] = []

    async def list_inventory(self, cluster_id=None):
        self.calls.append(("list", cluster_id))
        return [{"cluster_id": 1, "items": [{"vmid": 100, "name": "x"}]}]

    async def create_lxc(self, cluster_id, body):
        self.calls.append(("create_lxc", cluster_id, body))
        return {"job_id": 11, "state": "queued", "vmid": 555}

    async def create_qemu(self, cluster_id, body):
        self.calls.append(("create_qemu", cluster_id, body))
        return {"job_id": 12, "state": "queued", "vmid": 556}

    async def power(self, cluster_id, vmid, *, is_lxc, action):
        self.calls.append(("power", cluster_id, vmid, is_lxc, action))
        return {"job_id": 13, "state": "queued"}

    async def delete(self, cluster_id, vmid, *, is_lxc):
        self.calls.append(("delete", cluster_id, vmid, is_lxc))
        return {"job_id": 14, "state": "queued"}

    job_result_state = "succeeded"

    async def wait_for_job(self, job_id, **kw):
        self.calls.append(("wait", job_id))
        return {"id": job_id, "state": self.job_result_state,
                "friendly_error": "boom" if self.job_result_state == "failed" else None}


@pytest.mark.asyncio
class TestServer:
    async def test_tool_surface(self):
        srv = build_server(FakeClient())
        tools = {t.name for t in await srv.list_tools()}
        assert tools == {
            "list_resources", "create_lxc", "create_vm",
            "power_action", "delete_resource",
        }

    async def test_list_resources(self):
        fake = FakeClient()
        srv = build_server(fake)
        await srv.call_tool("list_resources", {})
        assert ("list", None) in fake.calls

    async def test_power_action_no_wait(self):
        fake = FakeClient()
        srv = build_server(fake)
        await srv.call_tool("power_action", {"cluster_id": 1, "vmid": 100, "kind": "vm", "action": "start"})
        assert ("power", 1, 100, False, "start") in fake.calls
        assert ("wait", 13) not in fake.calls  # wait defaults false

    async def test_power_action_lxc_with_wait(self):
        fake = FakeClient()
        srv = build_server(fake)
        await srv.call_tool(
            "power_action",
            {"cluster_id": 1, "vmid": 200, "kind": "lxc", "action": "stop", "wait": True},
        )
        assert ("power", 1, 200, True, "stop") in fake.calls
        assert ("wait", 13) in fake.calls

    async def test_delete_resource(self):
        fake = FakeClient()
        srv = build_server(fake)
        await srv.call_tool("delete_resource", {"cluster_id": 1, "vmid": 100, "kind": "vm"})
        assert ("delete", 1, 100, False) in fake.calls

    async def test_create_lxc_drops_none_optionals(self):
        fake = FakeClient()
        srv = build_server(fake)
        await srv.call_tool("create_lxc", {
            "cluster_id": 2, "team_id": 1, "node": "pve-01", "storage": "local-lvm",
            "ostemplate": "local:vztmpl/debian.tar.zst", "hostname": "c1",
            "cpu_cores": 2, "memory_mb": 1024, "disk_gb": 8,
        })
        _, cid, body = next(c for c in fake.calls if c[0] == "create_lxc")
        assert cid == 2 and body["hostname"] == "c1"
        assert "ssh_public_keys" not in body  # None dropped
        assert "password" not in body


@pytest.mark.asyncio
class TestEnqueueRendering:
    """_enqueue_result rendering — the wait=true result string per job state."""

    async def test_needs_review_surfaced_distinctly(self):
        from app.mcp.server import _enqueue_result

        fake = FakeClient()
        fake.job_result_state = "needs_review"
        out = await _enqueue_result(
            fake, {"job_id": 13, "state": "queued"}, wait=True, what="delete vm 1"
        )
        assert "NEEDS REVIEW" in out
        assert "still running" not in out  # the bug this fixes

    async def test_failed_surfaces_error(self):
        from app.mcp.server import _enqueue_result

        fake = FakeClient()
        fake.job_result_state = "failed"
        out = await _enqueue_result(
            fake, {"job_id": 13, "state": "queued"}, wait=True, what="start vm 1"
        )
        assert "FAILED" in out and "boom" in out

    async def test_malformed_job_id_does_not_raise(self):
        from app.mcp.server import _enqueue_result

        fake = FakeClient()
        out = await _enqueue_result(
            fake, {"job_id": "not-an-int", "state": "queued"}, wait=True, what="x"
        )
        assert "not pollable" in out
        assert ("wait", "not-an-int") not in fake.calls  # never tried to poll


class TestConfigTimeouts:
    def test_timeout_env_override(self):
        c = load_config(env={
            "PROXMOX_GUI_MCP_PAT": "pat_x",
            "PROXMOX_GUI_MCP_REQUEST_TIMEOUT_S": "5",
            "PROXMOX_GUI_MCP_JOB_POLL_TIMEOUT_S": "45",
        })
        assert c.request_timeout_s == 5.0
        assert c.job_poll_timeout_s == 45.0

    def test_bad_timeout_falls_back(self):
        c = load_config(env={
            "PROXMOX_GUI_MCP_PAT": "pat_x",
            "PROXMOX_GUI_MCP_REQUEST_TIMEOUT_S": "nonsense",
        })
        assert c.request_timeout_s == 30.0
