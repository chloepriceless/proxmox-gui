"""Pure helpers for the self-update flow (DEPLOY-04, plan 05-04).

All orchestration lives in :mod:`app.jobs.selfupdate_functions` — this module
exports the small building blocks:

- :func:`fetch_release_manifest` — fetch the release manifest over HTTPS.
- :func:`download_tarball` — fetch the release tarball over HTTPS.
- :func:`verify_sha256` — compare the tarball's SHA-256 to the manifest entry.
- :func:`snapshot_db` — WAL-safe SQLite snapshot via the online-backup API.

A separate ``service.py`` lets the route validate inputs and the worker job
re-use the same primitives (no orchestration duplicated).
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import sqlite3
from typing import Any

logger = logging.getLogger(__name__)

#: Default release manifest URL. The GitHub Releases mechanism (D-10):
#: every tagged release ships a ``manifest.json`` alongside the tarball with
#: ``{version, tarball_url, sha256}``. Configurable for tests / private forks.
DEFAULT_MANIFEST_BASE = (
    "https://github.com/chloepriceless/proxmox-gui/releases"
)


# ---------------------------------------------------------------------------
# Release manifest fetch
# ---------------------------------------------------------------------------


async def fetch_release_manifest(
    version: str | None,
    *,
    base_url: str = DEFAULT_MANIFEST_BASE,
) -> dict[str, Any]:
    """Fetch the release ``manifest.json`` over HTTPS.

    For ``version=None`` we request the ``latest`` GitHub Releases manifest;
    otherwise we request the manifest for the named tag.

    Returns a dict with at minimum ``version``, ``tarball_url``, ``sha256``.
    Raises :class:`RuntimeError` on a network or HTTP error.

    The fetch is intentionally simple — ``urllib.request`` over HTTPS (TLS
    validated against the public CA set). The integrity backstop is the
    SHA-256 manifest check downstream; even a degraded transport cannot get a
    tampered tarball past :func:`verify_sha256` (Threat T-05-04-09 accepted).
    """
    import json
    import urllib.request

    if version:
        url = f"{base_url}/download/{version}/manifest.json"
    else:
        url = f"{base_url}/latest/download/manifest.json"

    def _fetch() -> dict[str, Any]:
        # urllib.request blocks; run it in a thread so the worker event loop
        # is not pinned for the duration of the download.
        with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310 — HTTPS only
            return json.loads(resp.read().decode("utf-8"))

    try:
        return await asyncio.to_thread(_fetch)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            f"Failed to fetch release manifest from {url}: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Tarball download
# ---------------------------------------------------------------------------


async def download_tarball(url: str, dst: str) -> None:
    """Download ``url`` to ``dst`` over HTTPS.

    Streams in 1 MiB chunks so a multi-MB release does not balloon RSS.
    """
    import urllib.request

    def _download() -> None:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with urllib.request.urlopen(url, timeout=120) as resp, open(  # noqa: S310 — HTTPS only
            dst, "wb"
        ) as out:
            while True:
                chunk = resp.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)

    try:
        await asyncio.to_thread(_download)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            f"Failed to download release tarball from {url}: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# SHA-256 verification (Threat T-05-04-01)
# ---------------------------------------------------------------------------


def verify_sha256(tarball_path: str, expected: str) -> bool:
    """Return True iff the SHA-256 of ``tarball_path`` matches ``expected``.

    Case-insensitive (some manifests uppercase the hex digest). Streams the
    file in 1 MiB chunks so a multi-MB tarball does not balloon RSS.

    A False return MUST abort the update — :func:`run_self_update` interprets
    that as a manifest mismatch (Threat T-05-04-01, closes carryover ME-03).
    """
    expected_lc = expected.lower().strip()
    h = hashlib.sha256()
    with open(tarball_path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    actual = h.hexdigest()
    return actual.lower() == expected_lc


# ---------------------------------------------------------------------------
# WAL-safe SQLite snapshot (Pitfall 1 / Threat T-05-04-04)
# ---------------------------------------------------------------------------


def snapshot_db(src_path: str, dst_path: str) -> None:
    """Snapshot a WAL-mode SQLite DB via the stdlib online-backup API.

    A naive byte-for-byte file copy would copy the main DB file while leaving
    the latest writes stranded in the ``-wal`` sidecar — the snapshot would be
    missing data committed since the last checkpoint (Pitfall 1 / Threat
    T-05-04-04). The sqlite3 ``Connection.backup()`` API folds the WAL into
    the destination atomically (page-level copy under a consistent snapshot)
    and is the ONLY correct way to back up a live WAL-mode database.

    NEVER replace this call with a plain stdlib file-copy primitive. The test
    ``test_snapshot_db_does_not_use_shutil_copy`` asserts as much.
    """
    # Connecting via the URI form would let us pass ``mode=ro`` for the
    # source, but for snapshot purposes the default RW connect is fine —
    # ``.backup()`` does not write to the source.
    with sqlite3.connect(src_path) as src, sqlite3.connect(dst_path) as dst:
        src.backup(dst)
