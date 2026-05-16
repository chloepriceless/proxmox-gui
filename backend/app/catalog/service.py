"""Community-scripts catalog service — LXC-01/02/04 (Plan 04-06).

Modelled on ``app.quotas.service`` (the service-layer read/write shape) +
``httpx.AsyncClient`` for the admin sync pull.

The catalog is served from a commit-pinned source:

- The vendored ``snapshot.json`` floor (D-05) ships with every GUI release.
- The ``catalog_pin`` row (one row, global config — Plan 04-04's ``CatalogPin``
  model) records the currently-pinned commit; an admin "Sync catalog" re-pins
  it to a fresher reviewed upstream commit.

``load_catalog`` reads the ``catalog_pin`` row to learn the active commit; the
entry list itself always comes from the vendored ``snapshot.json`` floor (the
floor is what the GUI ships and trusts — Pitfall 10 / threat T-04-06-02). A
``sync_catalog`` re-pins the commit SHA + records who synced it. The parsed
snapshot is cached in-process (it is static per release).

Every entry exposes ``source_url`` / ``commit_sha`` / ``last_reviewed``
(LXC-04) — ``commit_sha`` is the active pin's SHA, ``last_reviewed`` is the
pin's ``synced_at``.

The community-scripts repo is ``community-scripts/ProxmoxVE``; the install
scripts live at ``install/<slug>-install.sh`` and the entry scripts at
``ct/<slug>.sh``. The catalog JSON metadata source is the sibling
``community-scripts/ProxmoxVE-Local`` repo at ``scripts/json/<slug>.json``
(spike 04-01 question 4 — the repo path moved). ``sync_catalog`` resolves the
upstream default-branch commit via the GitHub API.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CatalogPin

__all__ = [
    "ScriptEntry",
    "CatalogData",
    "load_catalog",
    "curated_shortlist",
    "search_catalog",
    "attribution_for",
    "sync_catalog",
]

#: The vendored catalog floor (D-05) — ships with every GUI release.
_SNAPSHOT_PATH = Path(__file__).resolve().parent / "snapshot.json"

#: The upstream community-scripts repo (install / entry scripts live here).
_SCRIPTS_REPO = "community-scripts/ProxmoxVE"

#: The GitHub API endpoint that resolves the repo's default-branch HEAD commit.
_GITHUB_COMMITS_API = (
    f"https://api.github.com/repos/{_SCRIPTS_REPO}/commits/HEAD"
)

#: In-process cache of the parsed vendored snapshot (static per release).
_SNAPSHOT_CACHE: dict | None = None


class ScriptEntry:
    """One community-script catalog entry — a thin wrapper over the JSON dict.

    Carries the spike-confirmed metadata field set plus the LXC-04 attribution
    triple (``source_url`` / ``commit_sha`` / ``last_reviewed``) stamped from
    the active ``catalog_pin``.
    """

    def __init__(self, raw: dict, *, commit_sha: str, last_reviewed: str) -> None:
        self.slug: str = raw.get("slug", "")
        self.name: str = raw.get("name", "")
        self.description: str = raw.get("description", "")
        self.categories: list[str] = list(raw.get("categories", []))
        self.type: str = raw.get("type", "lxc")
        self.featured: bool = bool(raw.get("featured", False))
        self.privileged: bool = bool(raw.get("privileged", False))
        self.source_url: str = raw.get("source_url", "")
        self.install_methods: list[dict] = list(raw.get("install_methods", []))
        # Sometimes-missing / nullable fields (spike question 4).
        self.interface_port: int | None = raw.get("interface_port")
        self.default_credentials: dict | None = raw.get("default_credentials")
        self.notes: list[dict] = list(raw.get("notes", []))
        # LXC-04 attribution — stamped from the active pin.
        self.commit_sha: str = commit_sha
        self.last_reviewed: str = last_reviewed

    def to_dict(self) -> dict[str, Any]:
        """Serialise for the API response — carries the LXC-04 attribution."""
        return {
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "categories": self.categories,
            "type": self.type,
            "featured": self.featured,
            "privileged": self.privileged,
            "source_url": self.source_url,
            "install_methods": self.install_methods,
            "interface_port": self.interface_port,
            "default_credentials": self.default_credentials,
            "notes": self.notes,
            "commit_sha": self.commit_sha,
            "last_reviewed": self.last_reviewed,
        }


class CatalogData:
    """The parsed catalog — the entry list + the active pin metadata."""

    def __init__(
        self,
        *,
        entries: list[ScriptEntry],
        commit_sha: str,
        synced_at: str,
        curated_overrides: dict | None,
    ) -> None:
        self.entries = entries
        self.commit_sha = commit_sha
        self.synced_at = synced_at
        self.curated_overrides = curated_overrides or {}


def _load_snapshot() -> dict:
    """Return the parsed vendored ``snapshot.json`` — cached in-process."""
    global _SNAPSHOT_CACHE
    if _SNAPSHOT_CACHE is None:
        _SNAPSHOT_CACHE = json.loads(_SNAPSHOT_PATH.read_text())
    return _SNAPSHOT_CACHE


async def load_catalog(db: AsyncSession) -> CatalogData:
    """Read the active ``catalog_pin`` and build the parsed catalog.

    The entry list always comes from the vendored ``snapshot.json`` floor (the
    floor is the GUI's trusted, reviewed copy — Pitfall 10). When a
    ``catalog_pin`` row exists, the active ``commit_sha`` + ``synced_at`` come
    from it; otherwise they fall back to the snapshot's bundled commit (the
    snapshot floor before any admin sync).
    """
    snapshot = _load_snapshot()

    pin = (
        await db.execute(select(CatalogPin).order_by(CatalogPin.id.desc()))
    ).scalars().first()

    if pin is not None:
        commit_sha = pin.commit_sha
        synced_at = (
            pin.synced_at.isoformat()
            if isinstance(pin.synced_at, datetime)
            else str(pin.synced_at)
        )
        curated_overrides = (
            json.loads(pin.curated_overrides) if pin.curated_overrides else None
        )
    else:
        # No pin row — fall back to the vendored snapshot floor.
        commit_sha = snapshot["commit_sha"]
        synced_at = snapshot["synced_at"]
        curated_overrides = None

    entries = [
        ScriptEntry(raw, commit_sha=commit_sha, last_reviewed=synced_at)
        for raw in snapshot.get("scripts", [])
    ]
    return CatalogData(
        entries=entries,
        commit_sha=commit_sha,
        synced_at=synced_at,
        curated_overrides=curated_overrides,
    )


async def curated_shortlist(db: AsyncSession) -> list[ScriptEntry]:
    """Return the curated shortlist (LXC-01) — featured + admin overrides.

    The default shortlist is the upstream ``featured: true`` set (D-06). The
    admin ``curated_overrides`` from the ``catalog_pin`` row is additive /
    subtractive on that default:
    - ``curated_overrides["add"]`` — slugs to include even if not featured.
    - ``curated_overrides["remove"]`` — slugs to drop from the featured set.
    """
    catalog = await load_catalog(db)
    overrides = catalog.curated_overrides
    add = set(overrides.get("add", []))
    remove = set(overrides.get("remove", []))

    out: list[ScriptEntry] = []
    for entry in catalog.entries:
        included = entry.featured or entry.slug in add
        if entry.slug in remove:
            included = False
        if included:
            out.append(entry)
    return out


async def search_catalog(
    db: AsyncSession,
    *,
    q: str | None = None,
    category: str | None = None,
) -> list[ScriptEntry]:
    """Return the full catalog filtered by a search term + a category (LXC-02).

    ``q`` is a case-insensitive substring match on ``name`` / ``slug`` /
    ``description``. ``category`` is an exact (case-insensitive) membership
    match against the entry's ``categories`` list. An empty ``q`` + ``category``
    returns the unfiltered full catalog.
    """
    catalog = await load_catalog(db)
    needle = (q or "").strip().lower()
    cat = (category or "").strip().lower()

    out: list[ScriptEntry] = []
    for entry in catalog.entries:
        if needle:
            haystack = (
                f"{entry.name}\n{entry.slug}\n{entry.description}".lower()
            )
            if needle not in haystack:
                continue
        if cat:
            if cat not in {c.lower() for c in entry.categories}:
                continue
        out.append(entry)
    return out


async def attribution_for(slug: str, db: AsyncSession) -> dict | None:
    """Return the LXC-04 attribution block for a single script.

    ``{source_url, commit_sha, last_reviewed}`` — ``commit_sha`` is the active
    pin's SHA, ``last_reviewed`` is the pin's ``synced_at``. Returns ``None``
    if no catalog entry owns ``slug``.
    """
    catalog = await load_catalog(db)
    for entry in catalog.entries:
        if entry.slug == slug:
            return {
                "source_url": entry.source_url,
                "commit_sha": entry.commit_sha,
                "last_reviewed": entry.last_reviewed,
            }
    return None


async def get_entry(slug: str, db: AsyncSession) -> ScriptEntry | None:
    """Return the single catalog entry for ``slug`` (or ``None``)."""
    catalog = await load_catalog(db)
    for entry in catalog.entries:
        if entry.slug == slug:
            return entry
    return None


async def sync_catalog(db: AsyncSession, *, actor_user_id: int) -> dict:
    """Pull a fresher upstream commit and re-pin the ``catalog_pin`` row (D-05).

    Resolves the ``community-scripts/ProxmoxVE`` default-branch HEAD commit via
    the GitHub API, then upserts the single ``catalog_pin`` row with the new
    ``commit_sha`` + ``synced_at`` + ``synced_by_user_id``. The catalog content
    itself stays the vendored snapshot floor — D-05 pins to a deliberately
    reviewed commit, never an unreviewed one; the re-pin records WHICH commit
    the operator chose.

    Returns ``{added, updated, commit_sha}``. ``added`` / ``updated`` describe
    whether the pin row was inserted or updated. ``db.commit()`` is called.
    """
    async with httpx.AsyncClient(timeout=15.0) as http_client:
        resp = await http_client.get(
            _GITHUB_COMMITS_API,
            headers={"Accept": "application/vnd.github+json"},
        )
        resp.raise_for_status()
        commit_payload = resp.json()
    new_sha = commit_payload["sha"]

    pin = (
        await db.execute(select(CatalogPin).order_by(CatalogPin.id.desc()))
    ).scalars().first()

    if pin is None:
        pin = CatalogPin(
            commit_sha=new_sha,
            synced_at=datetime.utcnow(),
            synced_by_user_id=actor_user_id,
        )
        db.add(pin)
        added, updated = 1, 0
    else:
        pin.commit_sha = new_sha
        pin.synced_at = datetime.utcnow()
        pin.synced_by_user_id = actor_user_id
        added, updated = 0, 1

    await db.commit()
    return {"added": added, "updated": updated, "commit_sha": new_sha}
