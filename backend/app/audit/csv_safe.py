"""CSV-injection mitigation (02-RESEARCH §Security §CSV injection).

Excel auto-executes a cell starting with =, +, -, or @ as a formula. Prefix
any such value with a single quote to neutralize the formula interpretation.

Reference: OWASP CSV Injection prevention cheat sheet.
"""

from __future__ import annotations

_DANGEROUS_PREFIXES = ("=", "+", "-", "@")


def escape_cell(value: object) -> str:
    """Stringify + prefix-with-single-quote if the value's first non-whitespace
    char is one of =, +, -, @. Empty / None values pass through as empty string.

    Examples:
        escape_cell("=SUM(A1)") -> "'=SUM(A1)"
        escape_cell("normal")   -> "normal"
        escape_cell(None)       -> ""
        escape_cell("  =evil")  -> "'  =evil"
    """
    if value is None:
        return ""
    s = str(value)
    if s and s.lstrip().startswith(_DANGEROUS_PREFIXES):
        return "'" + s
    return s
