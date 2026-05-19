"""Backward-compatible re-export shim — the rate limiter moved (ME-02).

The per-IP token-bucket rate limiter was relocated to
:mod:`app.security.rate_limit` and re-implemented on Redis so its state is
shared across uvicorn workers (01-REVIEW ME-02). It is a generic abuse-control
primitive, not auth-specific, hence the new home under ``app/security/``.

This module re-exports the public names so any straggler import still resolves.
New code MUST import from ``app.security.rate_limit`` directly.
"""

from __future__ import annotations

from app.security.rate_limit import (  # noqa: F401
    _buckets,
    check_login_rate,
    check_rate,
)

__all__ = ["check_login_rate", "check_rate"]
