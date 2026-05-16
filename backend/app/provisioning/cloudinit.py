"""Cloud-Init effective-config render + form validation — VM-05/06/07.

A pure stateless transform module — modelled on ``app.audit.csv``: it touches
no database and makes no Proxmox API call. It is the backend half of the
two-pane Cloud-Init editor (Plan 04-13's frontend) — the live YAML pane and
the block-hard / warn-soft verdict are both produced here.

Two public functions:

- :func:`render_cloudinit_preview` — renders the effective ``#cloud-config``
  user-data as a list of :class:`YamlLine` ``(text, injected)``. User-set
  fields (``ciuser`` / ``cipassword`` / ``sshkeys`` / the ``ipconfig0``-derived
  NIC config) are ``injected=False``; the lines PVE adds for the user that the
  user did NOT set (``chpasswd: {expire: false}``, the package-handling
  defaults) are ``injected=True`` — the frontend dims them and badges
  "PVE default" (D-10, satisfying VM-06).

- :func:`validate_cloudinit_form` — a HAND-ROLLED field validator (RESEARCH
  A5 + the Standard Stack recommendation — no ``cloud-init`` CLI dependency,
  the form-driven editor has a small known field set). Returns a
  :class:`CloudInitVerdict` with ``hard_errors`` (block submit — D-12) +
  ``soft_warnings`` (non-blocking advisory — D-12). It RETURNS the verdict; it
  never raises (mirrors the Phase-2 quota-admission verdict shape).
"""

from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass, field

__all__ = [
    "CloudInitForm",
    "YamlLine",
    "FieldError",
    "CloudInitVerdict",
    "render_cloudinit_preview",
    "validate_cloudinit_form",
]

# A valid Linux username: starts with a lowercase letter or underscore, then
# lowercase letters / digits / underscore / hyphen (the conservative
# useradd NAME_REGEX). PVE rejects anything else for ``ciuser``.
_LINUX_USERNAME_RE = re.compile(r"^[a-z_][a-z0-9_-]*$")

#: The kinds whose VM boots a cloud-init drive — these MUST resolve an
#: ``ipconfig0`` (Pitfall 6 — a cloud-init NIC with no ipconfig0 boots offline).
_CLOUDINIT_BOOTING_KINDS = {"cloud-image", "template-clone", "vm-clone", "blank-iso"}


# ---------------------------------------------------------------------------
# Form + result shapes
# ---------------------------------------------------------------------------


@dataclass
class CloudInitForm:
    """The Cloud-Init form fields the two-pane editor collects.

    ``ip_mode`` is ``auto`` / ``dhcp`` / ``static`` (and ``none`` — an
    explicit "no network" that the validator hard-rejects for a cloud-init
    booting VM, Pitfall 6). A ``static`` mode supplies ``ip_address`` (CIDR)
    and optionally ``gateway``.
    """

    ciuser: str | None = None
    cipassword: str | None = None
    sshkeys: list[str] = field(default_factory=list)
    ip_mode: str = "dhcp"
    ip_address: str | None = None
    gateway: str | None = None
    nameservers: list[str] = field(default_factory=list)
    packages: list[str] = field(default_factory=list)
    runcmd: list[str] = field(default_factory=list)
    #: Drives the Pitfall-6 ipconfig0 hard-error — only the cloud-init-booting
    #: kinds require an ipconfig0.
    source_kind: str = "cloud-image"


@dataclass
class YamlLine:
    """One line of the rendered ``#cloud-config`` preview.

    ``injected=True`` marks a line PVE adds on the user's behalf that the user
    did NOT set — the frontend dims it and badges "PVE default" (D-10).
    """

    text: str
    injected: bool


@dataclass
class FieldError:
    """One hard validation error — carries the offending field name.

    The frontend attaches ``message`` as the inline error on the named
    ``field`` (UI-SPEC §Cloud-Init editor — the offending field gets the
    inline message).
    """

    field: str
    message: str


@dataclass
class CloudInitVerdict:
    """The block-hard / warn-soft validation verdict (D-12).

    ``hard_errors`` block submit; ``soft_warnings`` are non-blocking advisory
    strings. ``ok`` is a convenience — ``True`` when there are no hard errors.
    """

    hard_errors: list[FieldError] = field(default_factory=list)
    soft_warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.hard_errors


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _ssh_key_parses(text: str) -> bool:
    """Return True if ``text`` is a parseable SSH public key.

    Reuses the Phase-1 ``parse_ssh_pubkey`` helper (cryptography-backed) — a
    ``ValueError`` means the key is malformed. The import is local so the
    module stays free of any package-level dependency cycle.
    """
    try:
        from app.ssh_keys.service import parse_ssh_pubkey

        parse_ssh_pubkey(text)
        return True
    except Exception:  # noqa: BLE001 — any failure means "does not parse"
        return False


def _resolved_ipconfig0(form: CloudInitForm) -> str | None:
    """Return the effective ``ipconfig0`` string, or ``None`` if there is none.

    ``dhcp`` / ``auto`` → ``ip=dhcp``; ``static`` with a valid address →
    ``ip=<cidr>[,gw=<gw>]``; anything else (``none`` or a malformed static
    address) → ``None`` (the Pitfall-6 hard-error trigger).
    """
    mode = (form.ip_mode or "").lower()
    if mode in ("dhcp", "auto"):
        return "ip=dhcp"
    if mode == "static" and form.ip_address:
        try:
            ipaddress.ip_interface(form.ip_address)
        except ValueError:
            return None
        cfg = f"ip={form.ip_address}"
        if form.gateway:
            cfg += f",gw={form.gateway}"
        return cfg
    return None


# ---------------------------------------------------------------------------
# render_cloudinit_preview
# ---------------------------------------------------------------------------


def render_cloudinit_preview(form: CloudInitForm) -> list[YamlLine]:
    """Render the effective ``#cloud-config`` user-data as YAML lines.

    The first line is the mandatory ``#cloud-config`` header. User-set fields
    are ``injected=False``; the PVE-default lines the user did not set are
    ``injected=True`` (D-10).
    """
    lines: list[YamlLine] = []

    def _user(text: str) -> None:
        lines.append(YamlLine(text=text, injected=False))

    def _pve(text: str) -> None:
        lines.append(YamlLine(text=text, injected=True))

    # The mandatory header (a user-visible, not-injected line).
    _user("#cloud-config")

    # ---- users / credentials --------------------------------------------
    if form.ciuser:
        _user("users:")
        _user(f"  - name: {form.ciuser}")
        _user("    sudo: ALL=(ALL) NOPASSWD:ALL")
        if form.sshkeys:
            _user("    ssh_authorized_keys:")
            for key in form.sshkeys:
                _user(f"      - {key}")
        # lock_passwd is a PVE default the user does not set explicitly.
        _pve("    lock_passwd: false")

    if form.cipassword:
        # The password itself is user-set; chpasswd-expire is a PVE default.
        _user("password: (set via cipassword — not shown)")
        _pve("chpasswd:")
        _pve("  expire: false")

    # ---- network ---------------------------------------------------------
    ipcfg = _resolved_ipconfig0(form)
    if ipcfg is not None:
        # The NIC config is user-driven (ip mode / address are user input).
        _user(f"# network: ipconfig0={ipcfg}")
    if form.nameservers:
        _user("# nameservers: " + ", ".join(form.nameservers))

    # ---- packages / runcmd ----------------------------------------------
    if form.packages:
        _user("packages:")
        for pkg in form.packages:
            _user(f"  - {pkg}")
    else:
        # PVE/cloud-init applies default package handling the user did not set.
        _pve("package_upgrade: false")

    if form.runcmd:
        _user("runcmd:")
        for cmd in form.runcmd:
            _user(f"  - {cmd}")

    return lines


# ---------------------------------------------------------------------------
# validate_cloudinit_form
# ---------------------------------------------------------------------------


def validate_cloudinit_form(form: CloudInitForm) -> CloudInitVerdict:
    """Validate the Cloud-Init form — returns a block-hard / warn-soft verdict.

    NEVER raises. Hard errors block submit (D-12); soft warnings are advisory.
    """
    hard: list[FieldError] = []
    soft: list[str] = []

    # ---- cipassword required (D-11) -------------------------------------
    if not form.cipassword:
        hard.append(FieldError(
            field="cipassword",
            message="A cloud-init password is required.",
        ))

    # ---- ciuser must be a valid Linux username --------------------------
    if form.ciuser is not None and form.ciuser != "":
        if not _LINUX_USERNAME_RE.match(form.ciuser):
            hard.append(FieldError(
                field="ciuser",
                message=(
                    "The username must start with a lowercase letter or "
                    "underscore and contain only lowercase letters, digits, "
                    "'-' and '_'."
                ),
            ))

    # ---- SSH keys must parse --------------------------------------------
    for key in form.sshkeys:
        if not _ssh_key_parses(key):
            hard.append(FieldError(
                field="sshkeys",
                message=(
                    "One of the SSH public keys is not a valid key — "
                    "expected '<type> <base64> [comment]'."
                ),
            ))
            break  # one error for the field is enough

    # ---- static IP must have a valid address + gateway ------------------
    mode = (form.ip_mode or "").lower()
    if mode == "static":
        if not form.ip_address:
            hard.append(FieldError(
                field="ip_address",
                message="A static network needs an IP address in CIDR form.",
            ))
        else:
            try:
                ipaddress.ip_interface(form.ip_address)
            except ValueError:
                hard.append(FieldError(
                    field="ip_address",
                    message=(
                        "The IP address is not valid CIDR (e.g. "
                        "192.168.1.50/24)."
                    ),
                ))
        if form.gateway:
            try:
                ipaddress.ip_address(form.gateway)
            except ValueError:
                hard.append(FieldError(
                    field="gateway",
                    message="The gateway is not a valid IP address.",
                ))

    # ---- a cloud-init-booting VM must resolve an ipconfig0 (Pitfall 6) --
    if form.source_kind in _CLOUDINIT_BOOTING_KINDS:
        if _resolved_ipconfig0(form) is None:
            hard.append(FieldError(
                field="ipconfig0",
                message=(
                    "This VM boots a cloud-init drive and must have a "
                    "network configuration — pick DHCP or a valid static "
                    "address, otherwise the VM boots with no network."
                ),
            ))

    # ---- soft warnings ---------------------------------------------------
    # DNS / nameservers set on a DHCP NIC — DHCP supplies DNS; the guest may
    # ignore the cloud-init nameservers (Pitfall 14, D-12 — warn, don't block).
    if mode in ("dhcp", "auto") and form.nameservers:
        soft.append(
            "DNS servers are set but the network uses DHCP — DHCP already "
            "supplies DNS and the guest may ignore the cloud-init DNS "
            "settings."
        )

    return CloudInitVerdict(hard_errors=hard, soft_warnings=soft)
