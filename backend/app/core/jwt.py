"""JWT access-token helpers (HS256).

Plan 01 ships short-lived (15-min default, configurable via
``settings.access_token_ttl_seconds``) access tokens. Refresh tokens are opaque
DB-stored values — they live in Plan 05 (auth-subsystem), not here.

Note on TTLs (Pitfall A10): the 15-minute access lifetime comes from
CONTEXT.md D-10 and is *internal to the GUI*. It has nothing to do with
Proxmox PVE ticket lifetimes (2h). We never use PVE tickets for backend auth
— only PVE API tokens (D-03).

Algorithm pinning (Threat T-01-01-02): :func:`decode_access_token` passes
``algorithms=[ALG]`` exclusively. PyJWT rejects ``alg=none`` and any algorithm
not in the allow-list, mitigating algorithm-confusion attacks (Pitfall A8 in
research; the JWT-specific variant of the same family).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt

from app.config import settings

#: Algorithm pinned at module level. Update with a security review.
ALG = "HS256"

#: Issuer claim — embedded in every token to make cross-system replay harder.
ISSUER = "proxmox-gui"


def issue_access_token(user_id: int, *, is_admin: bool) -> str:
    """Mint a short-lived HS256 access token.

    Claims:
        sub  — user id (string per RFC 7519)
        adm  — admin flag (bool)
        iat  — issued-at (unix epoch seconds)
        exp  — expiration (unix epoch seconds)
        jti  — random UUID4 (per-token unique id; supports future revocation chains)
        iss  — fixed string ``proxmox-gui``
    """
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "adm": bool(is_admin),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.access_token_ttl_seconds)).timestamp()),
        "jti": str(uuid4()),
        "iss": ISSUER,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALG)


def decode_access_token(token: str) -> dict:
    """Decode + validate a token. Raises on bad signature, expiry, or missing claims.

    Raises:
        jwt.ExpiredSignatureError: token's ``exp`` has passed.
        jwt.InvalidIssuerError: ``iss`` is not ``proxmox-gui``.
        jwt.MissingRequiredClaimError: any of ``exp``, ``sub``, ``iat`` is absent.
        jwt.InvalidTokenError: any other validation failure (bad signature, alg, ...).
    """
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[ALG],
        issuer=ISSUER,
        options={"require": ["exp", "sub", "iat"]},
    )
