"""SQLAlchemy custom column types.

:class:`EncryptedSecret` transparently encrypts a ``str`` column with the
process-wide :class:`~app.core.cipher.SecretCipher` (Fernet). Used by Plan 02
for: per-cluster API tokens, refresh-token rows, and any other at-rest secret.

Threat T-01-01-06 mitigation: bind/result hooks call
:func:`~app.models._types_init._get_cipher` which raises if the lifespan
hasn't installed a cipher yet.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.types import LargeBinary, TypeDecorator

from app.models._types_init import _get_cipher


class EncryptedSecret(TypeDecorator):
    """Stores a Python ``str`` as Fernet-encrypted bytes in a ``LargeBinary`` column.

    - ``process_bind_param`` runs on writes (Python value → DB bytes).
    - ``process_result_value`` runs on reads (DB bytes → Python value).
    - ``cache_ok = True`` permits SQLAlchemy to cache compiled statements that
      reference this type — it has no instance-level state that affects SQL.
    """

    impl = LargeBinary
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> bytes | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise TypeError(
                f"EncryptedSecret expects str, got {type(value).__name__}"
            )
        return _get_cipher().encrypt(value)

    def process_result_value(self, value: Any, dialect: Any) -> str | None:
        if value is None:
            return None
        return _get_cipher().decrypt(bytes(value))
