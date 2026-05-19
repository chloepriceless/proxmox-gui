"""Audit-log archive writer + listing + path-safe download (AUDIT-06, D-08).

The retention cron (``app.jobs.retention_cron.roll_audit_log``) writes one
``audit-<from>-<to>.csv.gz`` archive per run into :data:`ARCHIVE_DIR` and then
deletes the rolled rows from ``audit_log`` (write-then-delete ordering —
T-05-03-03).

Admin Audit page consumes this module via:
- :func:`list_archives`        — backs ``GET /api/v1/audit/archives``
- :func:`resolve_archive_path` — guards the path component of the download
  route ``GET /api/v1/audit/archives/{name}`` against path-traversal
  (Pitfall 5 / T-05-03-01).

RESEARCH Open Question 3: archives are intentionally NOT auto-pruned in v1 —
they are the compliance artifact (T-05-03-05 accept). An operator can
``rm`` the directory manually; a future v2 enhancement may add a size cap.
"""

from __future__ import annotations

import csv
import gzip
import io
from collections.abc import Sequence
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

from app.audit.csv import _BOM, audit_header_row, audit_row

# Filesystem location for the .csv.gz archive files. Lives under
# /var/lib/proxmox-gui (Pitfall 7: persistent state outside /opt so self-update
# does not clobber it). Tests monkeypatch this attribute to point at tmp_path.
ARCHIVE_DIR = Path("/var/lib/proxmox-gui/audit-archives")


def write_audit_archive(
    rows: Sequence[Any],
    *,
    from_dt: datetime,
    to_dt: datetime,
) -> Path:
    """Write ``rows`` to a ``.csv.gz`` archive and return the file path.

    ``rows`` carries the same tuple shape ``audit_csv_stream`` produces:
    ``(occurred_at, action, target_type, target_id, result, source_ip,
    correlation_id, error, actor_username, team_name, cluster_name)``.
    The shared :func:`app.audit.csv.audit_header_row` /
    :func:`app.audit.csv.audit_row` helpers format both the header and each
    row so the archive layout matches the user-facing export exactly.

    The function blocks until the gzip file handle is closed — every byte is
    durable in the kernel page cache by the time it returns. The caller
    (``roll_audit_log``) MUST NOT delete the underlying audit rows until this
    function has returned successfully (T-05-03-03 write-then-delete).
    """
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    fname = f"audit-{from_dt:%Y%m%d}-{to_dt:%Y%m%d}.csv.gz"
    path = ARCHIVE_DIR / fname

    # Buffer the CSV in memory (audit rows are small; the retention cron caps
    # the row count via the cutoff query) so csv.writer can stream into a
    # gzip-text wrapper without partial-write races.
    buf = io.StringIO()
    buf.write(_BOM)
    writer = csv.writer(buf)
    writer.writerow(audit_header_row())
    for row in rows:
        writer.writerow(audit_row(row))

    with gzip.open(path, "wt", encoding="utf-8") as fh:
        fh.write(buf.getvalue())
    return path


def list_archives() -> list[dict]:
    """List ``.csv.gz`` files in :data:`ARCHIVE_DIR`.

    Returns a list of ``{name, size_bytes, ctime}`` dicts (newest first).
    Returns ``[]`` when the directory does not yet exist (no rollovers have
    run on this LXC yet).
    """
    if not ARCHIVE_DIR.exists():
        return []
    items: list[dict] = []
    for child in ARCHIVE_DIR.iterdir():
        if not child.is_file() or not child.name.endswith(".csv.gz"):
            continue
        st = child.stat()
        items.append(
            {
                "name": child.name,
                "size_bytes": st.st_size,
                "ctime": datetime.fromtimestamp(st.st_ctime).isoformat(),
            }
        )
    items.sort(key=lambda d: d["ctime"], reverse=True)
    return items


def resolve_archive_path(name: str) -> Path:
    """Return :data:`ARCHIVE_DIR` joined with a path-traversal-guarded ``name``.

    Threat T-05-03-01 / Pitfall 5: a malicious ``{name}`` like
    ``../../etc/proxmox-gui/master.key`` would leak persistent secrets if joined
    naively. We reject any name containing ``/``, ``\\``, or ``..``; resolve
    the candidate path; and assert it is rooted inside ``ARCHIVE_DIR.resolve()``.
    Anything else raises a 400.

    Note: the path does NOT have to exist — the route layer is responsible for
    surfacing "not found" via ``FileResponse``. This function only validates
    that the name cannot escape the archive directory.
    """
    if not name or "/" in name or "\\" in name or ".." in name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid archive name",
        )

    base = ARCHIVE_DIR.resolve()
    candidate = (ARCHIVE_DIR / name).resolve()
    try:
        is_inside = candidate.is_relative_to(base)
    except AttributeError:  # pragma: no cover — Python <3.9
        is_inside = str(candidate).startswith(str(base) + "/")
    if not is_inside:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid archive name",
        )
    return candidate
