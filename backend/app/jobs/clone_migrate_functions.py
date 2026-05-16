"""arq job functions for clone / template-convert / migrate — LIFE-10, LIFE-11.

``run_clone`` / ``run_template_convert`` / ``run_migrate`` each mirror
``run_power_action`` from Plan 03-02: claim the job, acquire the per-team
privsep connector, dispatch the mutating PVE call through the UPID poller,
audit the outcome (D-20).

``run_clone`` adds a bounded retry on a PVE "already exists" error — the
app-level VMID reservation (``reserve_vmid``) makes a collision unlikely, but a
stale id from outside this app could still clash; the worker walks the next
ids up to 5 times as a backstop (Pitfall 1).

clone / migrate / restore / delete are non-idempotent (D-16) — ``max_tries=1``
means arq never silently re-runs them; the jobs API retry route (Plan 03-02)
already excludes these kinds.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable

from app.audit.writer import audit_write
from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
from app.jobs.functions import _fail_job
from app.jobs.poller import dispatch_and_poll
from app.jobs.service import get_job, update_job

logger = logging.getLogger(__name__)

# Bounded-retry ceiling for the clone "already exists" backstop.
_CLONE_MAX_TRIES = 5

# Substrings PVE uses for an id-collision error (case-insensitive).
_ALREADY_EXISTS_MARKERS = ("already exists", "config file already exists")


async def _claim(ctx: dict, job_id: int, *, fn_name: str):  # noqa: ANN202
    """Claim a job (pending → claimed). Returns the job row, or None to abort."""
    sessionmaker = ctx["sessionmaker"]
    async with sessionmaker() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("%s: job %s not found", fn_name, job_id)
            return None
        if job.state in {"succeeded", "failed", "needs_review"}:
            return None
        await update_job(db, job_id, state="claimed")
        await db.commit()
        return await get_job(db, job_id)


async def _audit_outcome(
    ctx: dict, job_id: int, *, action: str, target_type: str, target_id: str,
    actor_user_id: int | None, team_id: int | None, cluster_id: int | None,
) -> None:
    """Write the outcome audit row after the poller set the terminal state."""
    sessionmaker = ctx["sessionmaker"]
    async with sessionmaker() as db:
        final = await get_job(db, job_id)
        result = "success" if (final and final.state == "succeeded") else "failure"
        await audit_write(
            db,
            actor_user_id=actor_user_id,
            team_id=team_id,
            cluster_id=cluster_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            result=result,
            source_ip=None,
            error=(final.friendly_error or final.error) if final else None,
            payload_after={"job_id": job_id, "state": final.state if final else None},
        )
        await db.commit()


async def _run_polled_job(
    ctx: dict,
    job_id: int,
    *,
    fn_name: str,
    audit_action: str,
    build_dispatch: Callable[[object, dict], Callable[[], Awaitable[str]]],
    target_id_from_payload: Callable[[dict], str],
) -> None:
    """Shared body — claim, acquire connector, dispatch+poll, audit.

    ``build_dispatch`` is given the connector + the decoded payload and returns
    the zero-arg dispatch coroutine.
    """
    sessionmaker = ctx["sessionmaker"]
    registry = ctx["registry"]
    redis = ctx["redis"]

    job = await _claim(ctx, job_id, fn_name=fn_name)
    if job is None:
        return

    payload = json.loads(job.payload)
    is_lxc = bool(payload.get("is_lxc"))
    target_type = "lxc" if is_lxc else "vm"
    target_id = target_id_from_payload(payload)

    try:
        connector = await registry.get_for_team(
            cluster_id=job.cluster_id, team_id=job.team_id
        )
    except Exception as exc:  # noqa: BLE001 — connector unavailable.
        await _fail_job(
            sessionmaker, redis, job_id,
            raw=str(exc),
            friendly="Couldn't reach the cluster to run this operation.",
            audit_action=audit_action, target_type=target_type,
            vmid=int(target_id) if target_id.isdigit() else 0,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    dispatch = build_dispatch(connector, payload)

    try:
        await dispatch_and_poll(ctx, job, connector, dispatch)
    except (PVEUnreachable, PVEAPIError, PVEAuthError) as exc:
        from app.lifecycle.errors import map_pve_error

        await _fail_job(
            sessionmaker, redis, job_id,
            raw=str(exc),
            friendly=map_pve_error(str(exc), ""),
            audit_action=audit_action, target_type=target_type,
            vmid=int(target_id) if target_id.isdigit() else 0,
            actor_user_id=job.actor_user_id, team_id=job.team_id,
            cluster_id=job.cluster_id,
        )
        return

    await _audit_outcome(
        ctx, job_id, action=audit_action, target_type=target_type,
        target_id=target_id, actor_user_id=job.actor_user_id,
        team_id=job.team_id, cluster_id=job.cluster_id,
    )


async def run_clone(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.clone`` job — clone dispatch + poll + audit.

    The dispatch closure bounded-retries on a PVE "already exists" id collision
    (walks the next id, up to 5 tries) — a backstop for the app-level VMID
    reservation (Pitfall 1).
    """

    def _build(connector, payload):  # noqa: ANN001, ANN202
        node = payload["node"]
        vmid = int(payload["vmid"])
        is_lxc = bool(payload.get("is_lxc"))
        name = payload.get("name")
        full = bool(payload.get("full"))
        target = payload.get("target")
        storage = payload.get("storage")
        newid_start = int(payload["newid"])

        async def _dispatch() -> str:
            last_exc: Exception | None = None
            for attempt in range(_CLONE_MAX_TRIES):
                candidate = newid_start + attempt
                try:
                    return await connector.clone(
                        node=node, vmid=vmid, newid=candidate, name=name,
                        full=full, target=target, storage=storage,
                        is_lxc=is_lxc,
                    )
                except PVEAPIError as exc:
                    msg = str(exc).lower()
                    if any(m in msg for m in _ALREADY_EXISTS_MARKERS):
                        last_exc = exc
                        logger.warning(
                            "clone id %s already exists; retrying with next id",
                            candidate,
                        )
                        continue
                    raise
            # Exhausted the retry budget — surface the last collision error.
            raise last_exc if last_exc is not None else PVEAPIError(
                0, "clone failed: no available VMID after retries"
            )

        return _dispatch

    await _run_polled_job(
        ctx, job_id, fn_name="run_clone", audit_action="vm.clone",
        build_dispatch=_build,
        target_id_from_payload=lambda p: str(p["newid"]),
    )


async def run_template_convert(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.template`` job — convert a qemu VM to a template."""

    def _build(connector, payload):  # noqa: ANN001, ANN202
        node = payload["node"]
        vmid = int(payload["vmid"])

        async def _dispatch() -> str:
            return await connector.to_template(node=node, vmid=vmid)

        return _dispatch

    await _run_polled_job(
        ctx, job_id, fn_name="run_template_convert", audit_action="vm.template",
        build_dispatch=_build,
        target_id_from_payload=lambda p: str(p["vmid"]),
    )


async def run_migrate(ctx: dict, job_id: int) -> None:
    """Execute a ``vm.migrate`` job — migrate dispatch + poll + audit.

    ``bwlimit`` in the payload is already KiB/s (the migrate service converted
    it from the UI's MB/s — RESEARCH A8).
    """

    def _build(connector, payload):  # noqa: ANN001, ANN202
        node = payload["node"]
        vmid = int(payload["vmid"])
        is_lxc = bool(payload.get("is_lxc"))
        target = payload["target"]
        online = bool(payload.get("online"))
        bwlimit = payload.get("bwlimit")

        async def _dispatch() -> str:
            return await connector.migrate(
                node=node, vmid=vmid, is_lxc=is_lxc, target=target,
                online=online, bwlimit=bwlimit,
            )

        return _dispatch

    await _run_polled_job(
        ctx, job_id, fn_name="run_migrate", audit_action="vm.migrate",
        build_dispatch=_build,
        target_id_from_payload=lambda p: str(p["vmid"]),
    )
