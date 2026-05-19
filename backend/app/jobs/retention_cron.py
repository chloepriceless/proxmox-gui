"""Audit-log retention/rotation arq cron (AUDIT-06) — placeholder.

This module is created by plan 05-01 ONLY so that ``worker.py`` can register
the ``roll_audit_log`` cron entry point now, keeping plan 05-01 independently
verifiable. The real body — read ``audit_retention_days`` from the settings
table, archive rows past the cutoff into a ``.csv.gz``, then delete the rolled
rows (write-then-delete ordering) — is implemented by plan 05-03
(RESEARCH §Pattern 4).

# TODO(05-03): replace the NotImplementedError body with the real
# roll_audit_log cron implementation. Keep the signature stable — worker.py's
# cron() registration depends on it.
"""

from __future__ import annotations


async def roll_audit_log(ctx: dict) -> None:
    """Audit-retention cron entry point — implemented in plan 05-03."""
    raise NotImplementedError("implemented in 05-03")
