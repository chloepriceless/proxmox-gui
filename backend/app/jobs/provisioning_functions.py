"""arq job functions for provisioning creates — LXC-05..07, VM-01..04.

``run_create_qemu`` / ``run_create_lxc`` / ``run_download`` each mirror
``run_clone`` from Plan 03-04: a ``_build`` closure returns the zero-arg
dispatch coroutine, fed into the shared ``_run_polled_job`` body (imported from
``clone_migrate_functions`` — claim → connector → ``dispatch_and_poll`` which
persists the UPID before polling, Pitfall 2/12 → ``map_pve_error`` → audit).

All three creates are non-idempotent (D-16) — ``max_tries=1`` in the worker.
A create that fails surfaces no Retry; the user re-runs the wizard
(threat T-04-04-06 — kept to a single atomic PVE call carrying the full
config, RESEARCH Pitfall 8).

``run_download`` dispatches ``connector.download_url`` — PVE fetches the ISO /
cloud image directly to its storage and returns a UPID (Pitfall 7 — the GUI
never proxies the bytes). Plan 04-05 enqueues ``storage.download`` jobs.
"""

from __future__ import annotations

import logging

from app.jobs.clone_migrate_functions import _run_polled_job

logger = logging.getLogger(__name__)

__all__ = ["run_create_qemu", "run_create_lxc", "run_download"]


async def run_create_qemu(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.create.qemu`` job — create dispatch + poll + audit.

    The payload carries ``{node, vmid, config}``; ``config`` is the proxmoxer
    kwargs dict the provisioning service built (it includes ``pool=``).
    """

    def _build(connector, payload):  # noqa: ANN001, ANN202
        node = payload["node"]
        vmid = int(payload["vmid"])
        config = dict(payload["config"])

        async def _dispatch() -> str:
            return await connector.create_qemu(node=node, vmid=vmid, **config)

        return _dispatch

    await _run_polled_job(
        ctx, job_id, fn_name="run_create_qemu", audit_action="vm.create",
        build_dispatch=_build,
        target_id_from_payload=lambda p: str(p["vmid"]),
    )


async def run_create_lxc(ctx: dict, job_id: int) -> None:
    """Execute an ``lxc.create`` job — create dispatch + poll + audit.

    ``config`` carries ``ostemplate`` (the connector takes it as a named arg)
    plus the remaining proxmoxer kwargs — it is split out here.
    """

    def _build(connector, payload):  # noqa: ANN001, ANN202
        node = payload["node"]
        vmid = int(payload["vmid"])
        config = dict(payload["config"])
        ostemplate = config.pop("ostemplate")

        async def _dispatch() -> str:
            return await connector.create_lxc(
                node=node, vmid=vmid, ostemplate=ostemplate, **config
            )

        return _dispatch

    await _run_polled_job(
        ctx, job_id, fn_name="run_create_lxc", audit_action="lxc.create",
        build_dispatch=_build,
        target_id_from_payload=lambda p: str(p["vmid"]),
    )


async def run_download(ctx: dict, job_id: int) -> None:
    """Execute a ``storage.download`` job — ISO / cloud-image download.

    Dispatches ``connector.download_url`` — PVE downloads the file directly to
    its storage and returns a UPID. Plan 04-05 enqueues these jobs; the
    function ships now so the worker registers all the provisioning kinds in
    one place (this plan owns ``worker.py``).
    """

    def _build(connector, payload):  # noqa: ANN001, ANN202
        node = payload["node"]
        storage = payload["storage"]
        content = payload["content"]
        url = payload["url"]
        filename = payload["filename"]

        async def _dispatch() -> str:
            return await connector.download_url(
                node=node, storage=storage, content=content,
                url=url, filename=filename,
            )

        return _dispatch

    await _run_polled_job(
        ctx, job_id, fn_name="run_download", audit_action="storage.download",
        build_dispatch=_build,
        target_id_from_payload=lambda p: str(p.get("filename", "")),
    )
