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

import json
import logging
import secrets

from app.jobs.clone_migrate_functions import _run_polled_job

logger = logging.getLogger(__name__)

__all__ = [
    "run_create_qemu",
    "run_create_lxc",
    "run_download",
    "run_community_script",
]

#: The community-scripts repo the install stage is fetched from. The install
#: script is ALWAYS fetched at the job's pinned commit SHA — never ``main``
#: (Pitfall 10 / threat T-04-06-02).
_SCRIPTS_REPO_RAW = "https://raw.githubusercontent.com/community-scripts/ProxmoxVE"


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


# ---------------------------------------------------------------------------
# Community-script two-stage job (LXC-03 — Plan 04-06, spike-gated)
#
# This is the ONE provisioning job that is NOT a plain ``_run_polled_job``
# (04-PATTERNS.md §provisioning_functions.py). It has two stages:
#
#   Stage 1 — create the empty LXC via ``connector.create_lxc`` and UPID-poll
#             it to completion (Pitfall 12 — UPID persisted before polling).
#   Stage 2 — run ONLY the upstream install stage INSIDE the running container
#             via ``connector.lxc_exec`` (= SSH ``pct exec``), with the
#             ``build.func`` env block reproduced and affirmative stdin (the
#             whiptail-bypass) — exactly the 04-SPIKE stage-2 contract. The
#             install stage is fetched at the job's pinned commit SHA.
#
# A stage-2 failure marks the job ``failed`` but issues NO LXC delete
# (Pitfall 8 / threat T-04-06-05 — the user keeps the created-but-install-
# failed container). The full install output is captured to the audit log
# (CLAUDE.md #8 / threat T-04-06's audit requirement).
# ---------------------------------------------------------------------------


def _build_install_command(*, slug: str, commit_sha: str) -> list[str]:
    """Build the in-container install command — the 04-SPIKE stage-2 mechanism.

    The install stage is NOT standalone (spike §1), so the GUI mirrors what
    upstream's own ``build.func`` does (spike §2): fetch ``install/<slug>-
    install.sh`` at the PINNED commit and run it inside the container. The
    command is a list — no shell string is interpolated on the GUI side
    (threat T-04-06-01). ``yes y |`` feeds affirmative stdin to the few
    interactive ``read`` confirms (spike §2.2).
    """
    script_url = f"{_SCRIPTS_REPO_RAW}/{commit_sha}/install/{slug}-install.sh"
    # bash -c "$(curl -fsSL <pinned-url>)" — exactly upstream build.func:4526,
    # but rewritten to the pinned SHA (never main). The whole pipeline runs
    # inside the container via the connector's pct-exec transport.
    remote = f'yes y | bash -c "$(curl -fsSL {script_url})"'
    return ["bash", "-c", remote]


def _build_install_env(payload: dict) -> dict[str, str]:
    """Reproduce the ``build.func`` env block the install stage reads (spike §2.1).

    Minimum viable set the install stage + ``customize()`` actually read:
    ``CTID`` / ``PCT_OSTYPE`` / ``PCT_OSVERSION`` / ``APPLICATION`` / ``app`` /
    ``PASSWORD`` (empty → autologin; the GUI sets the password itself) /
    ``VERBOSE=yes`` (so output is not suppressed — D-08 needs the stream) /
    ``DIAGNOSTICS=no`` (no upstream telemetry — Pitfall 10) / ``SESSION_ID`` /
    ``INSTALL_LOG``.
    """
    config = payload.get("config", {})
    rootfs = str(config.get("rootfs", ""))  # "<storage>:<gb>"
    # PCT_OSTYPE / PCT_OSVERSION are best-effort from the resolved ostemplate.
    ostemplate = str(config.get("ostemplate", ""))
    os_type, os_version = "debian", "12"
    tail = ostemplate.rsplit("/", 1)[-1] if ostemplate else ""
    parts = tail.split("-")
    if len(parts) >= 2:
        os_type = parts[0] or os_type
        os_version = parts[1] or os_version
    session_id = secrets.token_hex(4)
    return {
        "CTID": str(payload.get("vmid", "")),
        "PCT_OSTYPE": os_type,
        "PCT_OSVERSION": os_version,
        "APPLICATION": str(payload.get("application", payload.get("script_slug", ""))),
        "app": str(payload.get("script_slug", "")),
        "PASSWORD": "",
        "VERBOSE": "yes",
        "DIAGNOSTICS": "no",
        "SESSION_ID": session_id,
        "INSTALL_LOG": f"/root/.install-{session_id}.log",
        "tz": "UTC",
        # The unused rootfs string is referenced so a future maintainer sees
        # it is intentionally not part of the env block.
        "_GUI_ROOTFS": rootfs,
    }


async def run_community_script(ctx: dict, job_id: int) -> None:
    """Execute an ``lxc.community-script`` job — the two-stage create + install.

    Stage 1 creates the empty LXC (UPID-polled). Stage 2 starts it and runs the
    upstream install stage inside it via ``lxc_exec`` (SSH ``pct exec`` — spike
    04-01), streaming output to the Tasks drawer. A stage-2 failure marks the
    job failed but NEVER deletes the LXC (Pitfall 8).
    """
    from app.audit.writer import audit_write
    from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
    from app.jobs.clone_migrate_functions import _claim
    from app.jobs.events import publish_event
    from app.jobs.functions import _fail_job
    from app.jobs.poller import dispatch_and_poll
    from app.jobs.service import finish_job, get_job, update_job

    sessionmaker = ctx["sessionmaker"]
    registry = ctx["registry"]
    redis = ctx["redis"]

    job = await _claim(ctx, job_id, fn_name="run_community_script")
    if job is None:
        return

    payload = json.loads(job.payload)
    node = payload["node"]
    vmid = int(payload["vmid"])
    config = dict(payload["config"])
    ostemplate = config.pop("ostemplate")
    slug = payload["script_slug"]
    commit_sha = payload["commit_sha"]
    actor_user_id = job.actor_user_id
    team_id = job.team_id
    cluster_id = job.cluster_id

    # ---- Connector --------------------------------------------------------
    try:
        connector = await registry.get_for_team(
            cluster_id=cluster_id, team_id=team_id
        )
    except Exception as exc:  # noqa: BLE001 — connector unavailable.
        await _fail_job(
            sessionmaker, redis, job_id,
            raw=str(exc),
            friendly="Couldn't reach the cluster to run this operation.",
            audit_action="lxc.community-script", target_type="lxc",
            vmid=vmid, actor_user_id=actor_user_id, team_id=team_id,
            cluster_id=cluster_id,
        )
        return

    # ---- Stage 1 — create the empty LXC (UPID-polled) ---------------------
    async def _dispatch_create() -> str:
        return await connector.create_lxc(
            node=node, vmid=vmid, ostemplate=ostemplate, **config
        )

    try:
        await dispatch_and_poll(ctx, job, connector, _dispatch_create)
    except (PVEUnreachable, PVEAPIError, PVEAuthError) as exc:
        from app.lifecycle.errors import map_pve_error

        await _fail_job(
            sessionmaker, redis, job_id,
            raw=str(exc),
            friendly=map_pve_error(str(exc), ""),
            audit_action="lxc.community-script", target_type="lxc",
            vmid=vmid, actor_user_id=actor_user_id, team_id=team_id,
            cluster_id=cluster_id,
        )
        return

    # If stage 1 did not succeed, dispatch_and_poll already marked the job
    # terminal — stop here. No LXC was created, so nothing to clean up.
    async with sessionmaker() as db:
        after_stage1 = await get_job(db, job_id)
        if after_stage1 is None or after_stage1.state != "succeeded":
            await audit_write(
                db,
                actor_user_id=actor_user_id, team_id=team_id,
                cluster_id=cluster_id, action="lxc.community-script",
                target_type="lxc", target_id=str(vmid), result="failure",
                source_ip=None,
                error="stage 1 (LXC create) did not succeed",
                payload_after={"job_id": job_id, "stage": "create"},
            )
            await db.commit()
            return
        # Stage 1 succeeded — re-open the job for stage 2 (the install run).
        await update_job(db, job_id, state="running")
        await db.commit()

    # ---- Stage 2 — run the install stage INSIDE the running container -----
    install_command = _build_install_command(slug=slug, commit_sha=commit_sha)
    install_env = _build_install_env(payload)
    output_chunks: list[str] = []

    def _on_output(chunk: str) -> None:
        """Forward each install-output chunk to the Tasks drawer (D-08)."""
        output_chunks.append(chunk)

    try:
        # Start the container before the install stage (pct create leaves it
        # stopped); best-effort — a container already running is fine.
        try:
            await connector.vm_power(
                node=node, vmid=vmid, is_lxc=True, action="start"
            )
        except (PVEUnreachable, PVEAPIError, PVEAuthError) as exc:
            logger.warning("community-script: LXC start returned %s", exc)

        exec_result = await connector.lxc_exec(
            node=node, vmid=vmid, command=install_command,
            stdin_data="y\n" * 50, env=install_env, on_output=_on_output,
        )
    except (PVEUnreachable, PVEAPIError, PVEAuthError) as exc:
        # Stage-2 failure — mark failed, audit the captured output, but issue
        # NO LXC delete (Pitfall 8 / threat T-04-06-05).
        captured = "".join(output_chunks) or str(exc)
        async with sessionmaker() as db:
            await finish_job(
                db, job_id, state="failed", error=str(exc),
                friendly="The community-script install stage failed.",
                log=captured,
            )
            await audit_write(
                db,
                actor_user_id=actor_user_id, team_id=team_id,
                cluster_id=cluster_id, action="lxc.community-script",
                target_type="lxc", target_id=str(vmid), result="failure",
                source_ip=None, error=str(exc),
                payload_after={
                    "job_id": job_id, "stage": "install", "vmid": vmid,
                    "output": captured[-4000:],
                },
            )
            await db.commit()
            done = await get_job(db, job_id)
            if done is not None:
                await publish_event(redis, "job.completed", done)
        return

    # ---- Stage 2 result ---------------------------------------------------
    captured = "".join(output_chunks)
    exit_code = int(exec_result.get("exit_code", 0))
    install_failed = exit_code != 0

    async with sessionmaker() as db:
        if install_failed:
            # The install stage ran but exited non-zero — job failed, LXC
            # KEPT (Pitfall 8 — no delete call is issued anywhere here).
            await finish_job(
                db, job_id, state="failed",
                error=f"install exit code {exit_code}",
                friendly=(
                    "The community-script install stage exited with an "
                    f"error (code {exit_code}). The container was created "
                    "and left for inspection."
                ),
                log=captured,
            )
            result = "failure"
        else:
            await finish_job(
                db, job_id, state="succeeded", friendly=None, log=captured,
            )
            result = "success"
        # The full install output is captured to the audit log (CLAUDE.md #8).
        await audit_write(
            db,
            actor_user_id=actor_user_id, team_id=team_id,
            cluster_id=cluster_id, action="lxc.community-script",
            target_type="lxc", target_id=str(vmid), result=result,
            source_ip=None,
            error=None if not install_failed else f"install exit {exit_code}",
            payload_after={
                "job_id": job_id, "stage": "install", "vmid": vmid,
                "script_slug": slug, "commit_sha": commit_sha,
                "exit_code": exit_code, "output": captured[-4000:],
            },
        )
        await db.commit()
        done = await get_job(db, job_id)
        if done is not None:
            await publish_event(redis, "job.completed", done)
