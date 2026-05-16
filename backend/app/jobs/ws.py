"""Tasks-drawer WebSocket endpoint — ``/api/v1/ws/jobs`` (RESEARCH §Pattern 5).

The client-facing half of the job event pipeline. The *fan-out* half
(``jobs_event_pump`` + ``CONNECTION_MANAGER.broadcast``) was wired in Plan
03-01; this module only adds the endpoint a browser connects to.

Handshake:
  1. Authenticate BEFORE ``accept()`` — resolve the ``access_token`` session
     cookie the same way ``get_current_principal`` does (JWT decode →
     user row). On failure: ``close(code=1008)`` and return — the socket is
     never registered (T-03-02-05).
  2. Resolve the caller's team ids (D-01 — team-wide drawer scope).
  3. ``accept()``, then send a ``{"type":"backfill","jobs":[...]}`` snapshot
     of the recent team-scoped jobs so the drawer renders immediately on
     (re)connect — UI-SPEC §"WebSocket / reconnection contract".
  4. Register the socket with ``CONNECTION_MANAGER`` carrying its team_ids;
     authorization is re-filtered on every push (Pitfall 9 — already done in
     ``events.py``).
  5. Loop on ``receive_text()`` (client keepalive pings) until disconnect,
     then ``CONNECTION_MANAGER.remove`` in a ``finally``.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.jwt import decode_access_token
from app.inventory.access import _team_ids_for_user
from app.jobs import service
from app.jobs.events import CONNECTION_MANAGER
from app.jobs.schemas import serialize_job
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter()

#: WebSocket close code for a policy violation (unauthenticated handshake).
_WS_POLICY_VIOLATION = 1008


async def _resolve_ws_user(websocket: WebSocket, db) -> User | None:  # noqa: ANN001
    """Resolve the ``access_token`` session cookie on a WS upgrade to a User.

    Mirrors the cookie branch of ``app.auth.dependencies.get_current_principal``
    — the WS upgrade carries the session cookie same-origin (via Caddy). PAT
    Bearer auth is intentionally NOT supported on the WS handshake (the drawer
    is a browser-session feature).
    """
    token = websocket.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:  # noqa: BLE001 — any decode/shape error → unauthenticated
        return None
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return user


@router.websocket("/ws/jobs")
async def jobs_ws(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Authenticated, team-scoped job-event WebSocket with reconnect backfill.

    FastAPI resolves ``Depends(get_db)`` on WebSocket routes too, so the
    handshake's short-lived auth + backfill reads run on the same DB session
    factory the rest of the API uses (and the test override picks up).
    """
    user = await _resolve_ws_user(websocket, db)
    if user is None:
        # Never accept() an unauthenticated socket — T-03-02-05.
        await websocket.close(code=_WS_POLICY_VIOLATION)
        return
    team_ids = await _team_ids_for_user(db, user_id=user.id)
    recent = await service.list_recent_jobs(db, team_ids, limit=50)
    backfill = [serialize_job(j) for j in recent]

    await websocket.accept()
    await websocket.send_json({"type": "backfill", "jobs": backfill})

    # Register for the team-scoped fan-out — broadcast() re-filters per push.
    CONNECTION_MANAGER.add(websocket, team_ids)
    try:
        while True:
            # Client keepalive pings; the server never needs the payload.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001 — a dead socket must not propagate
        logger.debug("jobs WebSocket closed unexpectedly: %s", exc)
    finally:
        CONNECTION_MANAGER.remove(websocket)
