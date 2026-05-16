"""Phase 3 Plan 01 — curated PVE-error map (D-13, UI-06).

``map_pve_error`` maps a known PVE ``exitstatus`` substring to a locked
friendly message; an unknown error falls back to the raw text verbatim —
never the string "operation failed" (Pitfall 24 — errors are never swallowed).
"""

from __future__ import annotations

from app.lifecycle.errors import map_pve_error


def test_locked_vm_maps_to_friendly_message() -> None:
    msg = map_pve_error("can't lock file /var/lock/qemu-server/lock-100.conf", "")
    assert msg == "VM is locked — unlock it from the detail page, then retry."


def test_vm_is_locked_phrase_maps() -> None:
    msg = map_pve_error("VM is locked (backup)", "")
    assert msg == "VM is locked — unlock it from the detail page, then retry."


def test_matching_is_case_insensitive() -> None:
    msg = map_pve_error("VM IS LOCKED", "")
    assert msg == "VM is locked — unlock it from the detail page, then retry."


def test_unknown_error_returns_raw_verbatim() -> None:
    raw = "some totally novel pve error 0xdeadbeef"
    assert map_pve_error(raw, "") == raw


def test_unknown_error_never_returns_operation_failed() -> None:
    raw = "weird unmatched failure"
    result = map_pve_error(raw, "")
    assert result != "operation failed"
    assert result == raw


def test_empty_exitstatus_falls_back_to_log_tail() -> None:
    """When exitstatus is empty, the raw fallback uses the log tail."""
    log = "unrecognised novel failure in the task log"
    assert map_pve_error("", log) == log


def test_log_tail_is_searched_for_substrings() -> None:
    """A known substring in the log tail (not exitstatus) still maps."""
    msg = map_pve_error("", "task failed: no quorum on the cluster")
    assert msg == (
        "The Proxmox cluster has lost quorum — writes are paused "
        "until it recovers."
    )


def test_shrink_disk_maps() -> None:
    msg = map_pve_error("unable to shrink disk", "")
    assert msg == "Disks can only grow. Shrinking is not supported by Proxmox."


def test_no_redaction_raw_detail_preserved() -> None:
    """D-15: the raw fallback is the full raw text — no redaction."""
    raw = "error on node pve-01 storage local-zfs: detail visible to all"
    assert map_pve_error(raw, "") == raw
