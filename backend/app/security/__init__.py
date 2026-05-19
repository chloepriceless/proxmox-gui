"""Cross-cutting security primitives.

Currently houses :mod:`app.security.rate_limit` — the Redis-backed per-IP
token-bucket rate limiter relocated from ``app.auth.rate_limit`` (carryover
ME-02). It lives here rather than under ``auth/`` because it is a generic
abuse-control primitive, not auth-specific.
"""

from __future__ import annotations
