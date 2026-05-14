"""Double-submit CSRF helpers (D-13).

The pattern: a JS-readable cookie holds a random token; SvelteKit echoes it via
``X-CSRF-Token`` on state-changing requests. Server checks the two are equal
using :func:`secrets.compare_digest` (constant time).

PAT (Bearer) requests bypass CSRF entirely — they don't carry the cookie, so
there's nothing to forge. That gate is enforced by the auth dependency, not
here.
"""

from __future__ import annotations

import secrets


def mint_csrf_token() -> str:
    """Return a URL-safe random token (default: 32 bytes → 43-char base64)."""
    return secrets.token_urlsafe(32)


def verify_csrf(cookie_value: str | None, header_value: str | None) -> bool:
    """Return True iff both values are non-empty and equal (constant-time)."""
    if not cookie_value or not header_value:
        return False
    return secrets.compare_digest(cookie_value, header_value)
