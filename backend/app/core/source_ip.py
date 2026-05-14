"""Source-IP extraction with X-Forwarded-For trust list.

Phase 1 review-fix carryover (ROADMAP Phase 5 carryover ME-04 + IN-01). Phase 2
needs this for AuditLog.source_ip; ships a minimal version here. Phase 5
(DEPLOY-04 polish) makes the trusted-proxy list configurable.

Note: X-Forwarded-For is honored ONLY when the direct client is a trusted proxy
(Caddy on localhost). Direct connections always use the real client IP.
Limitation: the trust list is hard-coded; it is NOT configurable in Phase 2.
Phase 5 (DEPLOY-04) will read the list from settings.trusted_proxies.
"""

from __future__ import annotations

from fastapi import Request

# Phase 2 hard-coded trust list -- Caddy reverse-proxy on localhost.
# Phase 5 (DEPLOY-04 polish) makes this configurable.
TRUSTED_PROXIES: frozenset[str] = frozenset({"127.0.0.1", "::1"})


def extract_source_ip(request: Request) -> str | None:
    """Return the client IP for AuditLog.source_ip.

    Honors X-Forwarded-For ONLY when request.client.host is in TRUSTED_PROXIES.
    Otherwise returns request.client.host as-is (or None when client is absent
    -- e.g. test client without a real socket).

    Uses the first (leftmost) IP from X-Forwarded-For, which is the
    rightmost-trusted value per the canonical convention when Caddy is the
    direct upstream (Caddy appends the real client IP to X-Forwarded-For).
    """
    direct = request.client.host if request.client else None
    if direct in TRUSTED_PROXIES:
        xff = request.headers.get("X-Forwarded-For")
        if xff:
            # Take the first entry (canonical: Caddy prepends real client IP).
            first = xff.split(",")[0].strip()
            if first:
                return first
    return direct
