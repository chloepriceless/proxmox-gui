"""Module-level cipher accessor for the :class:`EncryptedSecret` TypeDecorator.

SQLAlchemy's ``TypeDecorator`` is invoked outside FastAPI's request context, so
``request.app.state.cipher`` is not reachable from ``process_bind_param`` /
``process_result_value``. We solve this with a module-level singleton installed
at lifespan startup (see :mod:`app.main`).

Threat T-01-01-06: if a session opens before the lifespan installs the cipher,
:func:`_get_cipher` raises :class:`RuntimeError` rather than encrypting with
``None`` or silently degrading. Lifespan order ensures this never happens in
production; tests install a deterministic cipher via the ``install_test_cipher``
autouse fixture.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.cipher import SecretCipher

_cipher: SecretCipher | None = None


def install_cipher(cipher: SecretCipher) -> None:
    """Install (or replace) the process-wide cipher singleton.

    Idempotent — calling multiple times silently replaces. Tests rely on this
    to swap a deterministic key in/out.
    """
    global _cipher
    _cipher = cipher


def _get_cipher() -> SecretCipher:
    """Return the installed cipher. Raises if startup ordering is wrong."""
    if _cipher is None:
        raise RuntimeError(
            "cipher not installed: call install_cipher() from app lifespan startup"
        )
    return _cipher
