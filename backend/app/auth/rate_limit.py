"""In-memory per-IP token-bucket rate limiter for the auth router.

Per CONTEXT.md "Claude's discretion → login rate-limiting / lockout policy
(in-memory bucketed limiter for v1)". The limiter is best-effort within a
single process lifetime: state is held in a module-level dict and reset on
restart. Phase 5 can harden this to redis-backed leaky-bucket if abuse is
observed in production.

Threat mitigations:
- T-01-05-08: brute-force login. 10/60s default per IP. Returns 429 to
  legitimate-looking attempts as well; acceptable for v1 because the cost
  is one extra retry from a real user, but credential stuffing across 1k
  usernames from the same IP gets blocked after 10 attempts.

The bucket is keyed by ``(route, ip)`` so login + refresh can have separate
budgets. Window is a sliding 60s.
"""

from __future__ import annotations

import time

# Module-level state — process-local, lost on restart. Documented limitation
# (T-01-05-14, disposition "accept").
_buckets: dict[str, list[float]] = {}


def check_rate(
    key: str,
    *,
    limit: int,
    window: float,
) -> bool:
    """Return ``True`` if a new attempt is allowed, ``False`` if rate-limited.

    Side-effect: when allowed, the current timestamp is appended to the bucket;
    when denied, the bucket is left as-is (no penalty escalation in v1).

    Cleans entries older than ``window`` on every call.
    """
    now = time.monotonic()
    cutoff = now - window
    bucket = _buckets.setdefault(key, [])
    # In-place compaction (avoids a fresh list allocation per call).
    bucket[:] = [t for t in bucket if t >= cutoff]

    if len(bucket) >= limit:
        return False

    bucket.append(now)
    return True


def check_login_rate(ip: str, *, limit: int = 10, window: float = 60.0) -> bool:
    """Return ``True`` if this IP is allowed another login attempt.

    Default budget: 10 attempts per 60-second sliding window per IP. Mirrors
    Auth0's documented per-IP login limit; safe v1 default.
    """
    return check_rate(f"login:{ip}", limit=limit, window=window)
