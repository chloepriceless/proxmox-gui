"""Shared sentinel for the nullable-clearable PATCH-field pattern (ME-05).

A plain ``str | None = None`` Optional field on a PATCH body cannot tell
"absent from the request" (leave unchanged) apart from "explicitly set to
null" (clear the value) — both deserialise to ``None``. ``clusters/schemas.py``
already solved this for ``backup_storage`` with a private ``_UNSET`` sentinel
+ a ``backup_storage_set()`` predicate; 01-REVIEW ME-05 asks for that pattern
to be the project-wide convention so any future nullable-clearable PATCH field
adopts it consistently instead of re-inventing a local sentinel.

Usage::

    from app.core.patch import UNSET, is_set

    class FooUpdate(BaseModel):
        # absent → leave unchanged; null → clear; "x" → set
        note: str | None = Field(default=UNSET, max_length=128)

        def note_set(self) -> bool:
            return is_set(self.note)

The route applies the field only when its ``*_set()`` predicate is true; an
explicit ``null`` then clears it.
"""

from __future__ import annotations

from typing import Any

# A distinct sentinel object. Identity comparison (``is``) is what
# distinguishes it from a real ``None`` the client sent deliberately.
UNSET: Any = "__unset__"


def is_set(value: Any) -> bool:
    """True when a PATCH field carried a value (including an explicit null)."""
    return value is not UNSET and value != UNSET
