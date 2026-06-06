"""Proxmox Self-Service GUI backend package."""

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version

try:
    # Single source of truth: the installed distribution metadata (pyproject
    # `version`). A per-release deploy reinstalls the package, so this reflects
    # the actually-deployed version. Editable dev installs freeze it at install
    # time — re-run `pip install -e backend` after a version bump to refresh.
    __version__ = _pkg_version("proxmox-gui")
except PackageNotFoundError:  # pragma: no cover - source checkout without install
    __version__ = "0.0.0+unknown"

__all__ = ["__version__"]
