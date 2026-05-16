"""Redis pub/sub event channel for the Tasks drawer (RESEARCH §Pattern 5).

The worker and the API are separate processes (D-17). Redis is the only shared
channel. The worker ``publish_event``s a small JSON snapshot on every job-state
change; the API runs one ``jobs_event_pump`` subscriber that fans events out to
connected Tasks-drawer WebSockets via the module-level ``CONNECTION_MANAGER``.

Authorization is re-checked on EVERY push (Pitfall 9 / T-03-01-03):
``ConnectionManager.broadcast`` filters each event by the socket's current
``team_ids`` — a job for team B never reaches a socket subscribed for team A.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.jobs.schemas import serialize_job
from app.models import Job

logger = logging.getLogger(__name__)

#: The Redis pub/sub channel job events flow over.
JOBS_CHANNEL = "jobs:events"


async def publish_event(redis: Any, event_type: str, job: Job) -> None:
    """Publish a job-state-change event to the ``jobs:events`` channel.

    ``event_type`` ∈ {job.running, job.progress, job.completed,
    reaper.reattached, ...}. The payload carries a full job-row snapshot so
    the drawer can render without a follow-up fetch.
    """
    payload = json.dumps({"type": event_type, "job": serialize_job(job)})
    await redis.publish(JOBS_CHANNEL, payload)


async def publish_raw(redis: Any, event_type: str, data: dict) -> None:
    """Publish a non-job event (e.g. ``reaper.reattached`` with a job-id list)."""
    payload = json.dumps({"type": event_type, "data": data})
    await redis.publish(JOBS_CHANNEL, payload)


class ConnectionManager:
    """Tracks connected Tasks-drawer WebSockets + their team scope.

    The drawer is team-wide (D-01): a socket's ``team_ids`` is every team the
    authenticated user belongs to. ``broadcast`` re-filters each event by the
    job's ``team_id`` against that set on every push.
    """

    def __init__(self) -> None:
        # websocket -> set of team ids it is authorized for.
        self._sockets: dict[Any, set[int]] = {}

    def add(self, websocket: Any, team_ids: list[int]) -> None:
        """Register a connected socket with its authorized team set."""
        self._sockets[websocket] = set(team_ids)

    def remove(self, websocket: Any) -> None:
        """Drop a socket (no-op if absent)."""
        self._sockets.pop(websocket, None)

    @property
    def connection_count(self) -> int:
        return len(self._sockets)

    async def broadcast(self, event: dict) -> None:
        """Fan ``event`` out to every socket authorized for the job's team.

        T-03-01-03: the team filter is re-evaluated here, on every event —
        not just at subscribe time.
        """
        job = event.get("job") or {}
        job_team = job.get("team_id")
        # A team-less event (e.g. an internal job) goes to every socket.
        for websocket, team_ids in list(self._sockets.items()):
            if job_team is not None and job_team not in team_ids:
                continue
            try:
                await websocket.send_json(event)
            except Exception as exc:  # noqa: BLE001 — a dead socket must not
                # break the fan-out for the others.
                logger.debug("dropping dead Tasks-drawer socket: %s", exc)
                self._sockets.pop(websocket, None)


#: Process-wide singleton — the API lifespan's pump + the WS endpoint share it.
CONNECTION_MANAGER = ConnectionManager()


async def jobs_event_pump(app: Any) -> None:
    """API-side subscriber coroutine — listen on ``jobs:events`` and fan out.

    Started as a background task in the FastAPI lifespan. It subscribes to the
    Redis ``jobs:events`` channel and forwards every message to
    ``CONNECTION_MANAGER.broadcast``. Cancellation (lifespan shutdown) is the
    only exit path.
    """
    redis = getattr(app.state, "arq_pool", None)
    if redis is None:
        logger.warning("jobs_event_pump: no arq_pool on app.state — pump idle")
        return
    pubsub = redis.pubsub()
    await pubsub.subscribe(JOBS_CHANNEL)
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            try:
                event = json.loads(message["data"])
            except (ValueError, TypeError) as exc:
                logger.warning("jobs_event_pump: bad event payload: %s", exc)
                continue
            await CONNECTION_MANAGER.broadcast(event)
    finally:
        try:
            await pubsub.unsubscribe(JOBS_CHANNEL)
            await pubsub.aclose()
        except Exception:  # noqa: BLE001
            pass
