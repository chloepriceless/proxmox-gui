"""Tests for :mod:`app.core.cipher` and :class:`EncryptedSecret`."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from sqlalchemy import Integer
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import Mapped, mapped_column

from app.core.cipher import SecretCipher
from app.models._types import EncryptedSecret
from app.models._types_init import install_cipher
from app.models.base import Base

# ---------------------------------------------------------------------------
# SecretCipher unit tests
# ---------------------------------------------------------------------------

def test_round_trip_preserves_string() -> None:
    cipher = SecretCipher(b"\x01" * 32)
    encrypted = cipher.encrypt("hello, multi-cluster Proxmox")
    assert isinstance(encrypted, bytes)
    assert cipher.decrypt(encrypted) == "hello, multi-cluster Proxmox"


def test_round_trip_unicode() -> None:
    cipher = SecretCipher(b"\x02" * 32)
    plaintext = "𝕡𝕣𝕠𝕩𝕞𝕠𝕩 — gui ❤️"
    assert cipher.decrypt(cipher.encrypt(plaintext)) == plaintext


def test_wrong_length_key_raises() -> None:
    with pytest.raises(ValueError, match="exactly 32 bytes"):
        SecretCipher(b"too-short")
    with pytest.raises(ValueError):
        SecretCipher(b"\x00" * 33)
    with pytest.raises(ValueError):
        SecretCipher(b"")


def test_non_bytes_key_raises() -> None:
    with pytest.raises(TypeError):
        SecretCipher("not-bytes")  # type: ignore[arg-type]


def test_decrypt_with_wrong_key_fails() -> None:
    from cryptography.fernet import InvalidToken

    a = SecretCipher(b"\x01" * 32)
    b = SecretCipher(b"\x02" * 32)
    blob = a.encrypt("secret")
    with pytest.raises(InvalidToken):
        b.decrypt(blob)


def test_encrypt_non_str_raises() -> None:
    cipher = SecretCipher(b"\x03" * 32)
    with pytest.raises(TypeError):
        cipher.encrypt(b"already-bytes")  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# from_file: permission + length checks
# ---------------------------------------------------------------------------

def test_from_file_rejects_wrong_length(tmp_path: Path) -> None:
    key_file = tmp_path / "master.key"
    key_file.write_bytes(b"only-fifteen!!")  # 14 bytes
    os.chmod(key_file, 0o400)
    with pytest.raises(ValueError, match="exactly 32 bytes"):
        SecretCipher.from_file(key_file)


def test_from_file_loads_valid_key(tmp_path: Path) -> None:
    key_file = tmp_path / "master.key"
    key_file.write_bytes(b"\xAB" * 32)
    os.chmod(key_file, 0o400)
    cipher = SecretCipher.from_file(key_file)
    # The file path was valid; cipher can roundtrip.
    assert cipher.decrypt(cipher.encrypt("ok")) == "ok"


def test_from_file_rejects_world_readable_when_cookie_secure_true(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """T-01-01-01 / Pitfall A6: refuse to start in prod if master.key is loose."""
    from app.config import settings

    key_file = tmp_path / "master.key"
    key_file.write_bytes(b"\xCC" * 32)
    # World-readable: bit 0o004 set → fails the `mode & 0o077 == 0` check.
    os.chmod(key_file, 0o444)

    monkeypatch.setattr(settings, "cookie_secure", True)
    with pytest.raises(RuntimeError, match="must not be readable"):
        SecretCipher.from_file(key_file)


def test_from_file_skips_perm_check_in_dev_mode(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Dev mode (cookie_secure=False) skips the strict perm check."""
    from app.config import settings

    key_file = tmp_path / "master.key"
    key_file.write_bytes(b"\xCC" * 32)
    os.chmod(key_file, 0o644)  # group/other readable

    monkeypatch.setattr(settings, "cookie_secure", False)
    # No exception expected.
    cipher = SecretCipher.from_file(key_file)
    assert cipher.decrypt(cipher.encrypt("dev")) == "dev"


# ---------------------------------------------------------------------------
# EncryptedSecret TypeDecorator round-trip through SQLite
# ---------------------------------------------------------------------------

class _SecretRow(Base):
    """Test-only model exercising EncryptedSecret."""

    __tablename__ = "_test_secret_row"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    secret: Mapped[str | None] = mapped_column(EncryptedSecret, nullable=True)


async def test_encrypted_secret_round_trips_through_sqlalchemy() -> None:
    """install_cipher + EncryptedSecret + in-memory SQLite end-to-end."""
    # Force a known cipher so we can manually inspect bytes if needed.
    install_cipher(SecretCipher(b"\x10" * 32))

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    try:
        async with eng.begin() as conn:
            # Create only our test table — Base may carry other tables in
            # later plans, but for now it only has this one anyway.
            await conn.run_sync(Base.metadata.create_all)

        sm = async_sessionmaker(eng, expire_on_commit=False)
        async with sm() as session:
            row = _SecretRow(id=1, secret="PVEAPIToken=root@pam!gui=very-secret-uuid")
            session.add(row)
            await session.commit()

        async with sm() as session:
            fetched = await session.get(_SecretRow, 1)
            assert fetched is not None
            assert fetched.secret == "PVEAPIToken=root@pam!gui=very-secret-uuid"

        # NULL passthrough
        async with sm() as session:
            row = _SecretRow(id=2, secret=None)
            session.add(row)
            await session.commit()
            fetched = await session.get(_SecretRow, 2)
            assert fetched is not None
            assert fetched.secret is None
    finally:
        await eng.dispose()


async def test_encrypted_secret_raises_without_installed_cipher(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """T-01-01-06: TypeDecorator raises a clear error if startup ordering is wrong.

    SQLAlchemy wraps the RuntimeError in a StatementError; we assert on the chained
    cause so we get the exact message back regardless of the wrapper.
    """
    from sqlalchemy.exc import StatementError

    import app.models._types_init as init_module

    monkeypatch.setattr(init_module, "_cipher", None)

    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    try:
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        sm = async_sessionmaker(eng, expire_on_commit=False)
        async with sm() as session:
            row = _SecretRow(id=99, secret="will-not-encrypt")
            session.add(row)
            with pytest.raises(StatementError) as exc_info:
                await session.commit()
            # The original RuntimeError is chained via __cause__.
            assert isinstance(exc_info.value.__cause__, RuntimeError)
            assert "cipher not installed" in str(exc_info.value.__cause__)
    finally:
        await eng.dispose()
