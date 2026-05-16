"""Reverse-proxied bidirectional console WebSocket relay (CON-03, plan 04-08).

Filled in by Task 2 — Task 1 ships only the ``router`` object so
``console/routes.py`` can ``include_router`` it from the start.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()
