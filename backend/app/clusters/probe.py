"""Scheduled cluster health-probe arq cron (Phase-1 carryover) — placeholder.

This module is created by plan 05-01 ONLY so that ``worker.py`` can register
the ``probe_clusters`` cron entry point now, keeping plan 05-01 independently
verifiable. The real body — sweep every ``Cluster`` row, call
``connector.version()``, persist reachability — is implemented by plan 05-03
(the consolidated carryover plan; analog ``clusters/health.py`` +
``backups_cron.py``).

# TODO(05-03): replace the NotImplementedError body with the real
# probe_clusters cron implementation. Keep the signature stable — worker.py's
# cron() registration depends on it.
"""

from __future__ import annotations


async def probe_clusters(ctx: dict) -> None:
    """Scheduled cluster health-probe cron — implemented in plan 05-03."""
    raise NotImplementedError("implemented in 05-03")
