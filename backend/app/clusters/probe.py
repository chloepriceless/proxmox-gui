"""Scheduled cluster health-probe arq cron (Phase-1 carryover CLUST-06, plan 05-03).

Replaces the 05-01 placeholder with the real cron body. ``health.py`` already
has an in-process ``health_probe_loop`` that runs inside the API process as
long as it is alive — the carryover item wants a SCHEDULED probe that also
runs from the worker process so reachability status is fresh even when no API
call has happened in a while.

Mechanism:
- Every 15 minutes (the cadence is registered in ``WorkerSettings.cron_jobs``
  by plan 05-01: ``cron(probe_clusters, minute=set(range(0, 60, 15)))``).
- Iterate every ``Cluster`` row.
- For each row, acquire the connector from the worker's registry and call
  ``connector.version()``, translating the same PVEUnreachable / PVEAuthError
  / PVEAPIError exceptions ``clusters/health.py`` does.
- Persist the result to the same in-memory connector fields the in-process
  probe updates (``status`` / ``last_seen_healthy`` / ``last_error``). The
  worker's registry (``ctx["registry"]``) is held for the worker process's
  lifetime — the same connector instance is reused on subsequent cron runs,
  so the status survives across runs without a DB schema change.

Per-cluster try/except so one bad cluster does NOT abort the sweep
(T-05-03-04). The whole body is additionally wrapped in a defensive
try/except so a registry-level failure logs cleanly rather than crashing the
worker.
"""

from __future__ import annotations

import logging
import time

from sqlalchemy import select

from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
from app.models import Cluster

logger = logging.getLogger(__name__)


async def probe_clusters(ctx: dict) -> None:
    """Scheduled cluster health-probe cron — implemented per plan 05-03."""
    sessionmaker = ctx["sessionmaker"]
    registry = ctx.get("registry")
    if registry is None:
        # The worker's on_startup builds the registry; absence means a
        # misconfigured test harness — log and bail.
        logger.warning("probe_clusters: no registry on ctx; skipping sweep")
        return

    try:
        async with sessionmaker() as db:
            cluster_ids = (
                await db.execute(select(Cluster.id).where(Cluster.is_active.is_(True)))
            ).scalars().all()

            for cluster_id in cluster_ids:
                # Per-cluster try/except — one bad cluster must not abort the
                # sweep (T-05-03-04). Mirrors backups_cron.py:113-119.
                try:
                    connector = await registry.get(cluster_id, db=db)
                    try:
                        await connector.version()
                        connector.last_seen_healthy = time.monotonic()
                        connector.last_error = None
                        connector.status = "ok"
                    except (PVEUnreachable, PVEAuthError, PVEAPIError) as exc:
                        connector.last_error = str(exc)
                        connector.status = "failed"
                except Exception as exc:  # noqa: BLE001 — never abort the sweep.
                    logger.warning(
                        "probe_clusters: cluster %s probe failed: %s",
                        cluster_id, exc,
                    )
                    continue
    except Exception as exc:  # noqa: BLE001 — defensive; logged not raised.
        logger.error("probe_clusters: sweep failed: %s", exc, exc_info=True)
