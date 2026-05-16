"""Curated PVE-error → friendly-message map (D-13, UI-06).

PVE error strings are not perfectly stable across 7.x/8.x/9.x, so matching is
**substring, case-insensitive** against ``exitstatus`` + the task-log tail.

D-13 — *errors are never swallowed* (Pitfall 24): on a known pattern we return
the locked friendly copy; on no match we return the **raw** ``exitstatus``
(or the log tail if ``exitstatus`` is empty) **verbatim**. A vague generic
placeholder is never produced — that opaque failure mode is the exact thing
this map exists to prevent.

D-15 — *no redaction*: all users see the full raw technical detail. The map
only ADDS a friendly prefix; it never hides node/storage names or the raw
PVE text. This is a conscious accepted deviation from Pitfall 24's redaction
advice (CONTEXT D-15), suited to the small-team home-lab audience — do not add
redaction here.

The friendly copy below is reproduced VERBATIM from UI-SPEC §"Error
Presentation Contract" — those strings are locked.
"""

from __future__ import annotations

# A "matcher" is either:
#   - a str  → matches if that substring is present, OR
#   - a tuple → matches if EVERY substring in it is present (AND).
# A rule matches when ANY of its matchers matches. Rules are tried in order;
# the FIRST matching rule wins, so more specific rules precede broader ones.
_Matcher = str | tuple[str, ...]
_ERROR_RULES: list[tuple[tuple[_Matcher, ...], str]] = [
    (
        ("can't lock file", "vm is locked", "ct is locked", "unable to acquire lock"),
        "VM is locked — unlock it from the detail page, then retry.",
    ),
    (
        ("not enough memory", "would exceed", "insufficient", "no space left on device"),
        "The target node doesn't have enough free CPU or memory. Pick another node.",
    ),
    # cicustom/snippet precedes the broad storage rule so a migrate-time
    # "volume '...' does not exist" maps to the node-local-file message
    # rather than the generic storage message.
    (
        ("cicustom", "snippet", ("volume", "does not exist")),
        "This VM references a file that only exists on its current node. "
        "It can't be migrated until that's resolved.",
    ),
    (
        ("does not exist", "is not online", "unable to activate storage", "storage is disabled"),
        "The storage for this operation isn't available right now. "
        "Check the cluster, then retry.",
    ),
    (
        ("cluster not ready", "no quorum", "quorum"),
        "The Proxmox cluster has lost quorum — writes are paused "
        "until it recovers.",
    ),
    (
        ("storage full", "not enough free space"),
        "The backup storage is out of space. Free up space or reduce retention.",
    ),
    (
        ("unable to shrink", "shrink", "can't shrink disk"),
        "Disks can only grow. Shrinking is not supported by Proxmox.",
    ),
    (
        ("timeout", "got timeout", "connection timed out"),
        "Couldn't reach the Proxmox node in time. "
        "It may be busy — try again shortly.",
    ),
    (
        ("permission check failed", "no permission", "only root"),
        "Your team's token can't perform this action on this resource. "
        "Contact an administrator.",
    ),
]


def _matcher_hits(matcher: _Matcher, haystack: str) -> bool:
    """True if ``matcher`` (str = substring, tuple = all-of) is in ``haystack``."""
    if isinstance(matcher, tuple):
        return all(s in haystack for s in matcher)
    return matcher in haystack


def map_pve_error(exitstatus: str | None, log_tail: str = "") -> str:
    """Map a PVE failure to a friendly message, raw-fallback otherwise.

    Args:
        exitstatus: The PVE task ``exitstatus`` string (or ``None``).
        log_tail: The tail of the PVE task log (extra matching surface).

    Returns:
        The locked friendly message for the first matching rule, or — when
        no rule matches — the raw ``exitstatus`` verbatim (the ``log_tail``
        if ``exitstatus`` is empty). Never a vague generic placeholder.
    """
    exitstatus = exitstatus or ""
    haystack = f"{exitstatus} {log_tail}".lower()
    for matchers, friendly in _ERROR_RULES:
        if any(_matcher_hits(m, haystack) for m in matchers):
            return friendly
    # No match — surface the raw detail verbatim (D-13, never swallowed).
    raw = exitstatus.strip() or log_tail.strip()
    return raw
