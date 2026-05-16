"""arq job functions — the per-kind coroutines the worker dispatches.

Plan 03-01 ships only ``noop_job`` so ``worker.py``'s ``functions`` list has a
valid entry. Plans 02/03/04 add the real ``run_*`` job functions here
(``run_power_action``, ``run_snapshot_create``, ``run_clone``, …), each of
which acquires the per-team connector from the job row's ``cluster_id`` +
``team_id`` and drives ``poller.dispatch_and_poll``.

Every job function is structurally a service function: open work, call the
connector, audit, persist state — and it catches its own PVE exceptions so
arq never sees one (``max_tries=1`` — RESEARCH §Pattern 1).
"""

from __future__ import annotations


async def noop_job(ctx: dict) -> None:
    """Internal no-op — keeps the worker's ``functions`` list non-empty.

    Downstream plans replace this with real ``run_*`` job functions; the
    worker can already start and accept jobs with just this stub registered.
    """
    return None
