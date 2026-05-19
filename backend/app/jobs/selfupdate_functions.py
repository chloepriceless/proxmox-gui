"""arq job function for self-update (DEPLOY-04) — placeholder.

This module is created by plan 05-01 ONLY so that ``worker.py`` can register
the ``admin.self-update`` job entry point now, keeping plan 05-01
independently verifiable. The real orchestration body — manifest fetch +
SHA-256 verify, WAL-safe DB snapshot, atomic symlink swap, health check,
auto-rollback — is implemented by plan 05-04 (RESEARCH §Pattern 5).

# TODO(05-04): replace the NotImplementedError body with the real
# run_self_update orchestration. Keep the signature stable — worker.py's
# func() registration depends on it.
"""

from __future__ import annotations


async def run_self_update(ctx: dict, job_id: int) -> None:
    """Self-update orchestration entry point — implemented in plan 05-04."""
    raise NotImplementedError("implemented in 05-04")
