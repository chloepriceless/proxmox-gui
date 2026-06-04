"""Thin async REST client for the Proxmox-GUI API — the MCP bridge's transport.

Every method maps to one GUI REST endpoint and carries the PAT. No business
logic lives here: RBAC, quotas, the job queue and the audit log are all the
API's job (that is the whole point of the bridge — see ``DESIGN.md``).

Security: the ``Authorization`` header is never logged and is scrubbed from
every error surface (:func:`_scrub`).
"""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from app.mcp.config import MCPConfig

#: Terminal job states — states the worker will not progress further, so
#: ``wait_for_job`` must stop polling on them (``app/models/job.py`` +
#: ``app/jobs/reaper.py``):
#:   - ``succeeded`` / ``failed`` — normal terminal outcomes.
#:   - ``needs_review`` — the orphan reaper could not determine the outcome;
#:     an admin must check. The worker never advances it, so it IS terminal
#:     for polling purposes (surfaced distinctly from a clean failure).
#: ``orphaned`` is deliberately EXCLUDED: it is a transient boot-reaper marker
#: that gets re-resolved to succeeded/failed/needs_review, so we keep polling.
#: ``pending``/``claimed``/``running`` are in-flight.
TERMINAL_JOB_STATES = frozenset({"succeeded", "failed", "needs_review"})


class MCPClientError(RuntimeError):
    """A REST call failed. Message is safe to surface to the MCP client —
    it never contains the PAT."""


def _scrub(text: str, pat: str) -> str:
    """Defence in depth: strip the PAT from any string before it leaves."""
    if pat and pat in text:
        text = text.replace(pat, "pat_***")
    return text


class ProxmoxGuiClient:
    """Authenticated async client for the Proxmox-GUI REST API.

    Use as an async context manager so the underlying ``httpx.AsyncClient`` is
    closed deterministically::

        async with ProxmoxGuiClient(cfg) as client:
            await client.list_inventory()
    """

    def __init__(self, config: MCPConfig, *, http: httpx.AsyncClient | None = None) -> None:
        self._cfg = config
        self._owns_http = http is None
        self._http = http or httpx.AsyncClient(
            base_url=config.api_base,
            headers={
                "Authorization": f"Bearer {config.pat}",
                "Accept": "application/json",
            },
            verify=config.verify_tls,
            timeout=config.request_timeout_s,
        )

    async def __aenter__(self) -> ProxmoxGuiClient:
        return self

    async def __aexit__(self, *_exc: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_http:
            await self._http.aclose()

    # ---- core request helper -------------------------------------------------
    async def _request(self, method: str, path: str, *, json: Any | None = None) -> Any:
        try:
            resp = await self._http.request(method, path, json=json)
        except httpx.HTTPError as exc:  # connect/timeout/transport
            raise MCPClientError(
                _scrub(f"cannot reach the Proxmox-GUI API at "
                       f"{self._cfg.api_base}{path}: {exc}", self._cfg.pat)
            ) from exc
        if resp.status_code >= 400:
            detail: str
            try:
                body = resp.json()
                detail = str(body.get("detail", body)) if isinstance(body, dict) else str(body)
            except Exception:  # noqa: BLE001 — non-JSON error body
                detail = resp.text[:500]
            raise MCPClientError(
                _scrub(f"API {method} {path} → {resp.status_code}: {detail}", self._cfg.pat)
            )
        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()

    # ---- read ---------------------------------------------------------------
    async def list_inventory(self, cluster_id: int | None = None) -> Any:
        """List VMs/LXCs. Aggregated across clusters, or one cluster."""
        if cluster_id is None:
            return await self._request("GET", "/api/v1/me/inventory")
        return await self._request("GET", f"/api/v1/clusters/{cluster_id}/inventory")

    # ---- create (202 + job_id + vmid) ---------------------------------------
    async def create_lxc(self, cluster_id: int, body: dict[str, Any]) -> Any:
        return await self._request(
            "POST", f"/api/v1/clusters/{cluster_id}/provisioning/lxc", json=body
        )

    async def create_qemu(self, cluster_id: int, body: dict[str, Any]) -> Any:
        return await self._request(
            "POST", f"/api/v1/clusters/{cluster_id}/provisioning/qemu", json=body
        )

    # ---- power (202 + job_id) -----------------------------------------------
    async def power(self, cluster_id: int, vmid: int, *, is_lxc: bool, action: str) -> Any:
        kind = "lxcs" if is_lxc else "vms"
        return await self._request(
            "POST",
            f"/api/v1/clusters/{cluster_id}/{kind}/{vmid}/power",
            json={"action": action},
        )

    # ---- delete (202 + job_id) ----------------------------------------------
    async def delete(self, cluster_id: int, vmid: int, *, is_lxc: bool) -> Any:
        kind = "lxcs" if is_lxc else "vms"
        return await self._request(
            "DELETE", f"/api/v1/clusters/{cluster_id}/{kind}/{vmid}"
        )

    # ---- job polling --------------------------------------------------------
    async def get_job(self, job_id: int) -> Any:
        return await self._request("GET", f"/api/v1/jobs/{job_id}")

    async def wait_for_job(
        self, job_id: int, *, timeout_s: float | None = None, interval_s: float = 1.5
    ) -> Any:
        """Poll ``GET /jobs/{id}`` until the job is terminal or ``timeout_s``.

        Returns the final (or last-observed) job dict. Never raises on a
        ``failed`` job — the caller inspects ``state``/``friendly_error`` — but
        does raise :class:`MCPClientError` if the job view itself is
        unreachable.
        """
        budget = self._cfg.job_poll_timeout_s if timeout_s is None else timeout_s
        elapsed = 0.0
        job = await self.get_job(job_id)
        while isinstance(job, dict) and job.get("state") not in TERMINAL_JOB_STATES:
            if elapsed >= budget:
                break
            await asyncio.sleep(interval_s)
            elapsed += interval_s
            job = await self.get_job(job_id)
        return job
