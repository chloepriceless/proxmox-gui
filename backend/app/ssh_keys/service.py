"""SSH public-key parsing + persistence (Plan 01-05 Task 2).

Parsing strategy (01-RESEARCH.md §SSH key parse with fingerprint):

1. Normalise line endings + strip a leading ``authorized_keys`` options
   prefix (``from="…"``, ``no-pty``, …) — see :func:`_strip_options_prefix`.
2. Strip the optional comment field (third whitespace token) when normalising.
3. Validate via :func:`cryptography.hazmat.primitives.serialization.load_ssh_public_key`
   — this proves the wire-format bytes parse as a real public key. No shell
   execution, no eval (T-01-05-09).
4. Compute the OpenSSH-style fingerprint: ``SHA256:<base64(no-padding)>`` over
   the raw blob (the base64-decoded second whitespace token). This matches
   what ``ssh-keygen -lf`` prints.

Backlog 999.1 fix: ``ssh-rsa`` keys were rejected because operators paste
keys copied straight out of an ``authorized_keys`` file, which carries an
options prefix (``from="10.0.0.0/8" ssh-rsa AAAA…``). The Phase-1 parser
tokenised on whitespace and treated the first token as the key type, so the
options token became a bogus "key type" and ``load_ssh_public_key`` rejected
it with "Unsupported key type". The cause was NOT ``cryptography``'s SHA-1
hardening — RSA itself parses fine; it was the options prefix.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SshKey, User

# The OpenSSH public-key type tokens this validator recognises. A pasted line
# whose first whitespace token is NOT one of these has a leading options
# prefix (or is junk) — :func:`_strip_options_prefix` handles the former.
_KNOWN_KEY_TYPES = frozenset(
    {
        "ssh-rsa",
        "ssh-ed25519",
        "ssh-dss",
        "ecdsa-sha2-nistp256",
        "ecdsa-sha2-nistp384",
        "ecdsa-sha2-nistp521",
        "sk-ssh-ed25519@openssh.com",
        "sk-ecdsa-sha2-nistp256@openssh.com",
    }
)


def _strip_options_prefix(parts: list[str]) -> list[str]:
    """Drop a leading ``authorized_keys`` options prefix, if present.

    An ``authorized_keys`` line may begin with a comma-separated options field
    — ``from="10.0.0.0/8"``, ``no-pty``, ``command="…"`` — before the key
    type. Operators frequently paste such a line. The options field is a
    single whitespace-delimited token UNLESS a quoted value contains a space
    (``command="do a thing"``), so this scans tokens from the left, skipping
    everything until the first recognised key-type token, while honouring
    double-quote boundaries so a space inside ``"…"`` does not end the field.

    Returns the token list starting at the key type. If no key-type token is
    found the original list is returned unchanged (the caller's
    ``load_ssh_public_key`` then produces the real error).
    """
    for i, token in enumerate(parts):
        if token in _KNOWN_KEY_TYPES:
            if i == 0:
                return parts  # no prefix — the common case
            # Everything before index i was the options field. But only treat
            # it as a prefix if the joined prefix has balanced quotes — an
            # unbalanced quote means a quoted value spanned a space and the
            # real type token sits further right.
            prefix = " ".join(parts[:i])
            if prefix.count('"') % 2 == 0:
                return parts[i:]
    return parts


def parse_ssh_pubkey(text: str) -> tuple[str, str]:
    """Return ``(normalized_openssh_text, "SHA256:<base64>")`` for a pubkey.

    Raises:
        ValueError: malformed input — wrong field count, non-base64 blob,
            or :mod:`cryptography` refusing the parse.
    """
    # Normalise CRLF / lone-CR line endings (a key pasted from a Windows
    # editor carries them) before tokenising — backlog 999.1 cause #3.
    raw = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        raise ValueError("Invalid SSH public key: empty")

    parts = raw.split()
    if len(parts) < 2:
        raise ValueError(
            "Invalid SSH public key: expected '<type> <base64> [comment]'"
        )

    # Backlog 999.1 cause #2: drop a leading authorized_keys options prefix
    # (``from="…" ssh-rsa AAAA…``) so the key type, not the options token,
    # is parsed. ``key_line`` is the options-free ``<type> <base64> [comment]``.
    parts = _strip_options_prefix(parts)
    if len(parts) < 2:
        raise ValueError(
            "Invalid SSH public key: expected '<type> <base64> [comment]'"
        )

    key_type, b64_blob = parts[0], parts[1]
    key_line = " ".join(parts)

    # Validate via cryptography — refuses garbage, wrong checksums, bad types.
    # Pass the options-stripped line: load_ssh_public_key cannot parse a line
    # that still carries an options prefix.
    try:
        _key = serialization.load_ssh_public_key(key_line.encode("utf-8"))
    except Exception as exc:  # noqa: BLE001 — cryptography raises a zoo
        raise ValueError(f"Invalid SSH public key: {exc}") from exc

    # Decode the wire blob for the fingerprint.
    try:
        blob = base64.b64decode(b64_blob, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Invalid SSH public key: malformed base64 — {exc}") from exc

    digest = hashlib.sha256(blob).digest()
    fp = base64.b64encode(digest).decode("ascii").rstrip("=")
    fingerprint = f"SHA256:{fp}"

    # Normalised form drops the optional comment so duplicates can be detected.
    # Comments are user-set labels; the cryptographic identity is type+blob.
    normalized = f"{key_type} {b64_blob}"
    return normalized, fingerprint


async def add_ssh_key(
    db: AsyncSession,
    *,
    user: User,
    name: str,
    public_key: str,
) -> SshKey:
    """Parse, fingerprint, and insert an SshKey row owned by ``user``.

    Duplicate ``(user_id, name)`` → 409.
    Malformed key → 422.
    Duplicate fingerprint for the same user is ALLOWED — a user may paste
    the same key twice with different labels, no semantic harm.
    """
    try:
        normalized, fingerprint = parse_ssh_pubkey(public_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    existing = (
        await db.execute(
            select(SshKey).where(SshKey.user_id == user.id, SshKey.name == name)
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A key with that name already exists",
        )

    row = SshKey(
        user_id=user.id,
        name=name,
        public_key=normalized,
        fingerprint=fingerprint,
    )
    db.add(row)
    await db.flush()
    return row


async def delete_ssh_key(
    db: AsyncSession,
    *,
    key_id: int,
    user_id: int,
) -> None:
    """Delete a key owned by ``user_id``.

    Returns silently on success. Raises ``HTTPException(404)`` if the row
    doesn't exist OR belongs to a different user — same response either way
    so attackers can't enumerate IDs across users (T-01-05-11).
    """
    result = await db.execute(
        delete(SshKey).where(SshKey.id == key_id, SshKey.user_id == user_id)
    )
    if (result.rowcount or 0) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSH key not found",
        )
    await db.flush()


async def list_ssh_keys(
    db: AsyncSession,
    *,
    user_id: int,
) -> list[SshKey]:
    """Return the SSH keys owned by ``user_id`` in creation order."""
    rows = (
        await db.execute(
            select(SshKey)
            .where(SshKey.user_id == user_id)
            .order_by(SshKey.created_at, SshKey.id)
        )
    ).scalars().all()
    return list(rows)


async def get_ssh_key(
    db: AsyncSession,
    *,
    key_id: int,
    user_id: int,
) -> SshKey:
    """Fetch a single SSH key owned by ``user_id`` or raise 404."""
    row = (
        await db.execute(
            select(SshKey).where(SshKey.id == key_id, SshKey.user_id == user_id)
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSH key not found",
        )
    return row
