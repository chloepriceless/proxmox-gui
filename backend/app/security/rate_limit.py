"""Redis-backed per-IP sliding-window rate limiter (carryover ME-02).

Relocated from ``app.auth.rate_limit`` and re-implemented on Redis. The Phase-1
limiter held its state in a module-level ``dict``, which is process-local: under
a multi-worker uvicorn each worker had its own bucket, so the effective budget
was ``N × limit`` per IP — a brute-force blind spot (01-REVIEW ME-02). Redis is
a hard dependency since Phase 3 (arq job queue + embedded Redis in the LXC), so
the bucket state now lives there and is shared across every worker process.

Public contract — UNCHANGED from the Phase-1 module so call sites do not move:

- :func:`check_rate(key, *, limit, window)` → ``bool``
- :func:`check_login_rate(ip, *, limit, window)` → ``bool``

Implementation — a sliding-window counter via a Redis **sorted set** keyed by
the rate-limit key, scoring each attempt by its timestamp:

1. ``ZREMRANGEBYSCORE`` evicts entries older than ``window``.
2. ``ZCARD`` counts the survivors.
3. If under ``limit``: ``ZADD`` the current attempt and ``EXPIRE`` the key.

Redis-unavailable fallback (CONTEXT D-19 "acceptable fallback"): when no Redis
is reachable the limiter transparently falls back to a process-local
in-memory sliding window — exactly the Phase-1 behaviour. This keeps the
limiter *functional* (not fail-open) in single-process deployments and tests;
the Redis path is what makes it correct under a multi-worker uvicorn.

Threat mitigations:
- T-01-05-08: brute-force login. 10/60s default per IP, enforced cluster-wide
  via Redis when available, process-locally otherwise.
"""

from __future__ import annotations

import logging
import time
import uuid

logger = logging.getLogger(__name__)

# Key namespace inside Redis so rate-limit keys never collide with arq's.
_KEY_PREFIX = "ratelimit:"

# Lazily-created module-level sync Redis client. Sync (not async) because
# ``check_rate`` is a synchronous function called from synchronous code paths.
# ``False`` is the "tried and failed — use the in-memory fallback" marker so a
# down Redis is probed only once, not on every request.
_client: object | None | bool = None

# In-memory fallback: process-local sliding-window buckets, keyed by rate-limit
# key. Used only when Redis is unreachable. This IS the Phase-1 ``_buckets``
# dict, retained so single-process deployments + tests have a working limiter.
_buckets: dict[str, list[float]] = {}


def _get_client() -> object | None:
    """Return a cached sync Redis client, or ``None`` to use the in-memory
    fallback.

    The client is created lazily so importing this module never forces a Redis
    connection (tests, ``--collect-only``, the worker bootstrap). A connection
    that fails its initial ``ping`` is recorded as unavailable and the limiter
    uses the in-memory fallback from then on.
    """
    global _client
    if _client is False:
        return None
    if _client is not None:
        return _client
    try:
        import redis  # local import — keep module import side-effect-free

        client = redis.Redis(
            host="127.0.0.1",
            port=6379,
            db=0,
            socket_connect_timeout=1,
            socket_timeout=1,
            decode_responses=True,
        )
        client.ping()  # probe once — confirms Redis is actually reachable
        _client = client
        return client
    except Exception as exc:  # noqa: BLE001 — any redis import/connect failure
        logger.warning(
            "rate limiter: Redis unavailable — using process-local fallback "
            "(%s). Multi-worker uvicorn would weaken the limit; the LXC ships "
            "single-worker.",
            exc,
        )
        _client = False
        return None


def _check_rate_memory(key: str, *, limit: int, window: float) -> bool:
    """Process-local sliding-window check (Redis-unavailable fallback)."""
    now = time.monotonic()
    cutoff = now - window
    bucket = _buckets.setdefault(key, [])
    bucket[:] = [t for t in bucket if t >= cutoff]
    if len(bucket) >= limit:
        return False
    bucket.append(now)
    return True


def check_rate(
    key: str,
    *,
    limit: int,
    window: float,
) -> bool:
    """Return ``True`` if a new attempt is allowed, ``False`` if rate-limited.

    Side-effect: when allowed, the attempt is recorded; when denied, nothing is
    recorded (no penalty escalation in v1).
    """
    client = _get_client()
    if client is None:
        return _check_rate_memory(key, limit=limit, window=window)

    now = time.time()
    cutoff = now - window
    redis_key = f"{_KEY_PREFIX}{key}"

    try:
        # Evict stale entries, then count what survives — pipelined so the
        # count reflects this caller's view.
        pipe = client.pipeline()  # type: ignore[attr-defined]
        pipe.zremrangebyscore(redis_key, "-inf", cutoff)
        pipe.zcard(redis_key)
        _, current = pipe.execute()

        if int(current) >= limit:
            return False

        # Record this attempt. The member is a unique token so two attempts in
        # the same microsecond are both counted (a plain timestamp member would
        # collide and silently under-count).
        member = f"{now:.6f}:{uuid.uuid4().hex}"
        add_pipe = client.pipeline()  # type: ignore[attr-defined]
        add_pipe.zadd(redis_key, {member: now})
        # TTL slightly beyond the window so an idle key self-cleans.
        add_pipe.expire(redis_key, int(window) + 1)
        add_pipe.execute()
        return True
    except Exception as exc:  # noqa: BLE001 — redis runtime errors
        # A mid-flight Redis failure: fall back to the in-memory bucket so the
        # limiter keeps working rather than silently disabling itself.
        logger.warning(
            "rate limiter: Redis operation failed, using in-memory fallback — %s",
            exc,
        )
        return _check_rate_memory(key, limit=limit, window=window)


def check_login_rate(ip: str, *, limit: int = 10, window: float = 60.0) -> bool:
    """Return ``True`` if this IP is allowed another login attempt.

    Default budget: 10 attempts per 60-second sliding window per IP. Mirrors
    Auth0's documented per-IP login limit; safe v1 default.
    """
    return check_rate(f"login:{ip}", limit=limit, window=window)


def _reset_for_tests() -> None:
    """Clear every rate-limit bucket — used by the autouse test fixture.

    Resets both the in-memory fallback dict and (best-effort) the Redis keys,
    so one test's attempts never leak into the next regardless of which path
    is live.
    """
    _buckets.clear()
    client = _get_client()
    if client is None:
        return
    try:
        keys = list(client.scan_iter(match=f"{_KEY_PREFIX}*"))  # type: ignore[attr-defined]
        if keys:
            client.delete(*keys)  # type: ignore[attr-defined]
    except Exception as exc:  # noqa: BLE001
        logger.debug("rate limiter: test reset skipped — %s", exc)
