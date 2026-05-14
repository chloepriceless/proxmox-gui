"""Tests for :mod:`app.core.passwords`."""

from __future__ import annotations

from app.core.passwords import DUMMY_HASH, hash_password, verify_password


def test_hash_then_verify_returns_true() -> None:
    h = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", h) is True


def test_verify_wrong_password_returns_false() -> None:
    h = hash_password("the right one")
    assert verify_password("the wrong one", h) is False


def test_same_password_hashed_twice_differs() -> None:
    """Salt randomness: identical plaintext → different hash strings."""
    h1 = hash_password("same-input")
    h2 = hash_password("same-input")
    assert h1 != h2
    assert verify_password("same-input", h1)
    assert verify_password("same-input", h2)


def test_verify_against_dummy_hash_does_not_raise() -> None:
    """Login-time enumeration defense: verifying any plaintext against DUMMY_HASH is safe."""
    # Should not raise and should return False (the dummy plaintext isn't 'admin').
    assert verify_password("admin", DUMMY_HASH) is False
    assert verify_password("", DUMMY_HASH) is False


def test_dummy_hash_is_argon2id() -> None:
    """Sanity: DUMMY_HASH is a recognizable argon2id string."""
    assert DUMMY_HASH.startswith("$argon2id$")


def test_verify_malformed_hash_returns_false() -> None:
    """A garbage hash should not crash the caller — login flows rely on this."""
    assert verify_password("anything", "not-a-real-hash") is False


def test_verify_empty_password_with_empty_hash_returns_false() -> None:
    assert verify_password("", "") is False
