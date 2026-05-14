"""Per-cluster background health probe (Pattern 2 in 02-RESEARCH.md).

Polls GET /version every ``interval`` seconds and updates the connector's
``last_seen_healthy`` / ``last_error`` / ``status`` fields. Owned by the
registry; the registry's ``start_probe`` / ``stop_probe`` / ``stop_all_probes``
manage task lifecycle.
"""

from __future__ import annotations

import asyncio
import time

from app.clusters.connector import PVEConnector
from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable


async def health_probe_loop(
    connector: PVEConnector,
    *,
    interval: float = 15.0,
) -> None:
    """Forever loop — cancellation via ``task.cancel()`` is the only exit path.

    Updates ``connector.status``, ``connector.last_seen_healthy``, and
    ``connector.last_error`` after every probe attempt. A cancelled probe
    re-raises ``asyncio.CancelledError`` so the task completes cleanly.
    """
    while True:
        try:
            await connector.version()
            connector.last_seen_healthy = time.monotonic()
            connector.last_error = None
            connector.status = "ok"
        except (PVEUnreachable, PVEAuthError, PVEAPIError) as exc:
            connector.last_error = str(exc)
            connector.status = "failed"
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 — defensive; never let probe die silently
            connector.last_error = f"probe error: {exc}"
            connector.status = "failed"
        await asyncio.sleep(interval)
