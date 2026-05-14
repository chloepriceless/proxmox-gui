"""Argon2id password hashing via ``pwdlib``.

We use :meth:`pwdlib.PasswordHash.recommended` which selects argon2id with
parameters the maintainers consider current. The hasher is instantiated once
at module import — the per-hash cost (≈50–100 ms on commodity hardware) is
the rate-limiter for credential-stuffing (T-01-01-05). API-side rate-limiting
lives in Plan 05's login route.

:data:`DUMMY_HASH` is a precomputed valid argon2id hash. The login route
verifies against it whenever the supplied username does not exist, so the
elapsed time is statistically indistinguishable from a hit-but-wrong-password
case — defeats user enumeration via timing.
"""

from __future__ import annotations

from pwdlib import PasswordHash

# Single hasher instance — argon2id with library-recommended parameters.
_hasher: PasswordHash = PasswordHash.recommended()

#: Precomputed hash used by the login flow to keep verify time constant on
#: cache-miss (unknown username). Value is irrelevant; presence + cost are.
DUMMY_HASH: str = _hasher.hash("dummy-for-constant-time-comparisons")


def hash_password(plaintext: str) -> str:
    """Hash a password with argon2id. Salt is random per call."""
    return _hasher.hash(plaintext)


def verify_password(plaintext: str, hash: str) -> bool:
    """Constant-time argon2id verify. Returns False on any failure mode."""
    try:
        return _hasher.verify(plaintext, hash)
    except Exception:
        # pwdlib raises on malformed hash strings; in API contexts those should
        # all collapse to "auth failed" with no leaked detail.
        return False
