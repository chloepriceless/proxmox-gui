# Blocker 1 (job.reattach) — Cross-Lab Codex-Refute (Roh-Evidenz)

**Tool:** codex exec · gpt-5-codex · 2026-06-14 · R22 (Job-Engine).
**Ergebnis:** 8 Findings → 5 Härtungen eingearbeitet: (1) orphaned in Reaper-Scan-Set [CRIT durability], (2) _job_id-Dedup auf reattach-enqueue, (3) Terminal-Guard vor needs_review-Write, (4) task_log best-effort in poll_to_terminal, (5) upid_node-Fallback via Tasks.decode_upid.

---

**Findings**

**Critical: `orphaned` is not recoverable after a lost/cancelled reattach job.**  
Scenario: reaper marks job `orphaned`, enqueues `job.reattach`, then the worker crashes after dequeue, Redis drops/expires the queued job, or arq cancels it at the 4h timeout. On next boot, the reaper scans only `pending`/`claimed`/`running`, so the already-`orphaned` row is skipped forever.  
Why diff does not cover it: registering `job.reattach` only fixes the unknown-function discard path. It does not make `orphaned` a durable retryable state.  
Fix direction: include `orphaned` in the reaper reconciliation set, or make `orphaned` a short-lived state with a durable reattach lease/job id that is re-enqueued if missing/stale.

**Critical: duplicate reattach pollers can overwrite a correct terminal result.**  
Scenario: two `job.reattach` jobs are enqueued for the same row. Poller A sees `stopped`/OK and calls `finish_job(..., succeeded)`. Poller B later hits a transient `task_log` or `task_status` error and `run_reattach` unconditionally calls `update_job(..., needs_review)`. A successful completed job can be downgraded to `needs_review`. The same race exists with duplicate normal dispatch/poll workers if a stale queue item still exists.  
Why diff does not cover it: `run_reattach` only checks terminal state once at startup. There is no compare-and-set ownership, no terminal-state guard before writing `needs_review`, and no `_job_id` dedupe on enqueue.  
Fix direction: acquire a per-job lease/CAS before polling; dedupe enqueue with stable `_job_id`; make `finish_job`/`update_job` terminal-state preserving, especially for exception cleanup paths.

**High: `task_log` failure after terminal status turns a known outcome into `needs_review`.**  
Scenario: `task_status` returns `status="stopped", exitstatus="OK"`, then `task_log` returns 404/timeout. `poll_to_terminal` raises before `finish_job`, and `run_reattach` marks `needs_review`. The task outcome was known, but the job is left ambiguous because log retrieval failed. Same for a known non-OK exitstatus: a failed PVE task may become `needs_review`.  
Why diff does not cover it: the exception boundary wraps status polling and terminal log collection together.  
Fix direction: once `stopped` is observed, treat `exitstatus` as authoritative. Fetch logs best-effort; if log fetch fails, finish from `exitstatus` with a log-fetch warning.

**High: arq timeout/cancellation leaves the row stranded.**  
Scenario: reattached task reports `running` forever or longer than 14400s. arq cancels the coroutine at timeout. `run_reattach` catches PVE exceptions only, not cancellation/timeout, so the DB row remains `orphaned`. Because `orphaned` is skipped by later reaper scans, this becomes permanent.  
Why diff does not cover it: `poll_to_terminal` is `while True` with no internal deadline and no state update on cancellation. The 4h arq timeout is not a recovery policy.  
Fix direction: add an explicit poll deadline below arq timeout and transition to `needs_review` or a retryable stale state; make the reaper pick up stale `orphaned` jobs.

**Medium: duplicate enqueue is not harmless without idempotent DB transitions.**  
Scenario: two worker boots enqueue two `job.reattach` jobs for the same `job.id` because no `_job_id` is used. Even though both poll the same UPID and do not re-dispatch Proxmox, they race on job state and event publication. Users can receive duplicate progress/completed events, or a later exception path can overwrite terminal state.  
Why diff does not cover it: it assumes double-polling is harmless, but the side effects are DB writes and events, not only PVE reads.  
Fix direction: enqueue with `_job_id=f"job-reattach-{job.id}"` or equivalent, and enforce terminal-state monotonicity in DB writes.

**Medium: `run_reattach` accepts `claimed`/`running` without ownership checks.**  
Scenario: a normal job function is still alive or was re-enqueued and is polling the same job while `run_reattach` starts. Both can publish progress and race terminal writes. If the normal path is not truly guarded, a stale normal function could also re-dispatch the mutating operation.  
Why diff does not cover it: the only guard is “not terminal and has UPID.” It does not verify the job is specifically `orphaned`, claim the job, or check a worker lease.  
Fix direction: only reattach from `orphaned` or a stale lease state using an atomic transition like `orphaned -> running`; reject active `claimed`/`running` rows unless the owning lease is expired.

**Medium: missing `upid_node` fallback can strand valid UPIDs.**  
Scenario: row has `upid` but `upid_node` is null or stale due to an older write path/migration/partial persistence. `run_reattach` passes `node=None` into `task_status`, then marks `needs_review`, even though the UPID itself encodes the node.  
Why diff does not cover it: it checks only `job.upid`, not whether `job.upid_node` is present and valid.  
Fix direction: decode node from the UPID when `upid_node` is absent, or validate and repair the row before polling.

**Medium: extraction is mostly behavior-preserving, but it widened the shared failure semantics.**  
`job.id -> job_id`, `sessionmaker`, `redis`, `node`, and `upid` appear mechanically preserved for `dispatch_and_poll`. The risk is not the variable substitution itself; it is that `poll_to_terminal` now serves two callers with different failure requirements. Dispatch may tolerate exceptions surfacing to arq; reattach must convert unknowns without clobbering known terminal states. The shared helper currently has no mode-specific handling for those cases.

**Most Severe Weakness**

The most severe weakness is the non-durable `orphaned` state: once `job.reattach` is lost, cancelled, timed out, or races into a bad write, the next reaper pass skips `orphaned` jobs and the system has no guaranteed recovery path. The diff registers the missing function, but it does not make reattachment durable or idempotent.
