"""Phase 4 Plan 04-05 Task 2 — the Cloud-Init render + validation module.

TDD: written BEFORE ``app.provisioning.cloudinit`` lands — expected to fail
(RED) until Task 2 is implemented.

``cloudinit.py`` is a pure stateless transform module (modelled on
``app.audit.csv``): no DB, no PVE connector. The tests are therefore pure
function tests — no fixtures, no mocks.

Covers:
- ``render_cloudinit_preview`` — an effective ``#cloud-config`` preview as a
  list of ``YamlLine(text, injected)`` (D-10 — the FE dims PVE-injected lines).
- ``validate_cloudinit_form`` — a hand-rolled field validator returning a
  ``CloudInitVerdict`` with ``hard_errors`` + ``soft_warnings`` (D-12 — block
  hard / warn soft); it RETURNS the verdict, never raises.
"""

from __future__ import annotations

import pytest

from app.provisioning.cloudinit import (
    CloudInitForm,
    render_cloudinit_preview,
    validate_cloudinit_form,
)
from tests.factories import login_as, make_user

# An RSA test public key (valid wire format — cryptography parses it).
_VALID_SSH_KEY = (
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIN7sQHkNbeVm5K8X6Z4qC1xLp2W3oR9t"
    "QvBnMzKwYaHe alice@host"
)


def _base_form(**overrides) -> CloudInitForm:
    """A valid, complete cloud-image cloud-init form."""
    defaults = dict(
        ciuser="ubuntu",
        cipassword="s3cret-pass",
        sshkeys=[_VALID_SSH_KEY],
        ip_mode="dhcp",
        ip_address=None,
        gateway=None,
        nameservers=[],
        source_kind="cloud-image",
    )
    defaults.update(overrides)
    return CloudInitForm(**defaults)


# ---------------------------------------------------------------------------
# render_cloudinit_preview
# ---------------------------------------------------------------------------


def test_render_returns_yaml_lines_with_text_and_injected() -> None:
    """render_cloudinit_preview returns objects carrying text + injected."""
    lines = render_cloudinit_preview(_base_form())
    assert lines
    for line in lines:
        assert hasattr(line, "text")
        assert hasattr(line, "injected")
        assert isinstance(line.text, str)
        assert isinstance(line.injected, bool)


def test_render_first_line_is_cloud_config_header() -> None:
    """The rendered document starts with the #cloud-config header (not injected)."""
    lines = render_cloudinit_preview(_base_form())
    assert lines[0].text.strip() == "#cloud-config"
    assert lines[0].injected is False


def test_render_user_set_fields_not_injected() -> None:
    """User-set fields (ciuser / sshkeys / ipconfig0) are injected=False."""
    lines = render_cloudinit_preview(_base_form(ciuser="alice"))
    user_lines = [ln for ln in lines if "alice" in ln.text]
    assert user_lines, "the ciuser value must appear in the rendered config"
    assert all(ln.injected is False for ln in user_lines)


def test_render_pve_injected_lines_are_marked() -> None:
    """PVE-injected lines (e.g. chpasswd expire) are injected=True (D-10)."""
    lines = render_cloudinit_preview(_base_form())
    injected = [ln for ln in lines if ln.injected]
    assert injected, "there must be at least one PVE-injected line"
    # The chpasswd expire default is a canonical PVE-injected line.
    joined = "\n".join(ln.text for ln in lines)
    assert "chpasswd" in joined


# ---------------------------------------------------------------------------
# validate_cloudinit_form — hard errors / soft warnings
# ---------------------------------------------------------------------------


def test_validate_returns_verdict_with_both_lists() -> None:
    """validate_cloudinit_form returns a verdict with hard_errors + soft_warnings."""
    verdict = validate_cloudinit_form(_base_form())
    assert hasattr(verdict, "hard_errors")
    assert hasattr(verdict, "soft_warnings")
    assert isinstance(verdict.hard_errors, list)
    assert isinstance(verdict.soft_warnings, list)


def test_validate_valid_form_has_no_hard_errors() -> None:
    """A valid, complete form produces an empty hard_errors list."""
    verdict = validate_cloudinit_form(_base_form())
    assert verdict.hard_errors == []


def test_validate_never_raises_on_malformed_form() -> None:
    """A malformed form yields a verdict (never an exception)."""
    # Invalid ciuser characters + an unparseable SSH key.
    form = _base_form(ciuser="Bad User!", sshkeys=["not-a-real-key"])
    verdict = validate_cloudinit_form(form)  # must NOT raise
    assert verdict.hard_errors, "a malformed form must produce hard errors"


def test_validate_bad_ciuser_names_the_field() -> None:
    """An invalid ciuser produces a hard error naming the offending field."""
    verdict = validate_cloudinit_form(_base_form(ciuser="Has Spaces"))
    fields = {e.field for e in verdict.hard_errors}
    assert "ciuser" in fields


def test_validate_bad_ssh_key_names_the_field() -> None:
    """An unparseable SSH key produces a hard error naming the sshkeys field."""
    verdict = validate_cloudinit_form(_base_form(sshkeys=["garbage key data"]))
    fields = {e.field for e in verdict.hard_errors}
    assert "sshkeys" in fields


def test_validate_missing_cipassword_is_hard_error() -> None:
    """A missing cipassword is a hard error (D-11 — cipassword required)."""
    verdict = validate_cloudinit_form(_base_form(cipassword=None))
    fields = {e.field for e in verdict.hard_errors}
    assert "cipassword" in fields


def test_validate_static_ip_missing_address_is_hard_error() -> None:
    """A static IP mode with no ip_address is a hard error."""
    verdict = validate_cloudinit_form(
        _base_form(ip_mode="static", ip_address=None, gateway=None)
    )
    fields = {e.field for e in verdict.hard_errors}
    assert "ip_address" in fields


def test_validate_static_ip_malformed_address_is_hard_error() -> None:
    """A static IP mode with a malformed ip_address is a hard error."""
    verdict = validate_cloudinit_form(
        _base_form(ip_mode="static", ip_address="not-an-ip", gateway=None)
    )
    fields = {e.field for e in verdict.hard_errors}
    assert "ip_address" in fields


def test_validate_static_ip_valid_address_passes() -> None:
    """A valid static IP (CIDR) + gateway produces no IP hard error."""
    verdict = validate_cloudinit_form(
        _base_form(
            ip_mode="static", ip_address="192.168.1.50/24",
            gateway="192.168.1.1",
        )
    )
    fields = {e.field for e in verdict.hard_errors}
    assert "ip_address" not in fields
    assert "gateway" not in fields


def test_validate_dns_on_dhcp_is_soft_warning_not_hard_error() -> None:
    """DNS on a DHCP NIC is a soft warning, NOT a hard error (Pitfall 14, D-12)."""
    verdict = validate_cloudinit_form(
        _base_form(ip_mode="dhcp", nameservers=["1.1.1.1"])
    )
    # No hard error for the nameservers field.
    fields = {e.field for e in verdict.hard_errors}
    assert "nameservers" not in fields
    # But a soft warning is surfaced.
    assert verdict.soft_warnings, "DHCP + DNS must surface a soft warning"
    assert any("dns" in w.lower() or "dhcp" in w.lower()
               for w in verdict.soft_warnings)


def test_validate_cloud_image_missing_ipconfig0_is_hard_error() -> None:
    """A cloud-image config that resolves to no ipconfig0 is a hard error (Pitfall 6)."""
    # ip_mode='none' (or any value that resolves to no network) on a
    # cloud-image source — a cloud-init NIC with no ipconfig0 boots offline.
    form = _base_form(source_kind="cloud-image", ip_mode="none")
    verdict = validate_cloudinit_form(form)
    fields = {e.field for e in verdict.hard_errors}
    assert "ipconfig0" in fields


# ---------------------------------------------------------------------------
# Module discipline — pure transform, no cloud-init CLI dependency
# ---------------------------------------------------------------------------


def test_module_is_a_pure_transform() -> None:
    """cloudinit.py imports no DB session, no PVE connector, no cloud-init CLI."""
    import inspect

    from app.provisioning import cloudinit

    src = inspect.getsource(cloudinit)
    # No DB session and no PVE connector import — a pure transform module.
    assert "AsyncSession" not in src
    assert "clusters.connector" not in src
    assert "from app.clusters" not in src
    # No cloud-init CLI dependency — the validator is hand-rolled (A5).
    # It must not shell out (subprocess / os.system) nor import a cloud-init lib.
    assert "subprocess" not in src
    assert "os.system" not in src
    assert "import cloudinit" not in src
    assert "from cloudinit" not in src


# ---------------------------------------------------------------------------
# POST /provisioning/cloudinit/preview — the route wrapping both functions
# ---------------------------------------------------------------------------


def test_provisioning_router_has_cloudinit_preview_route() -> None:
    """provisioning/routes.py mounts a cloudinit/preview operation."""
    from app.main import create_app

    app = create_app()
    op_ids = {
        route.operation_id
        for route in app.routes
        if getattr(route, "operation_id", None)
    }
    assert "provisioning_cloudinit_preview" in op_ids


@pytest.mark.asyncio
async def test_cloudinit_preview_route_returns_lines_and_verdict(
    client, session_factory
) -> None:
    """POST .../cloudinit/preview returns both the rendered lines + the verdict."""
    await make_user(session_factory, username="ciprev", is_admin=False)
    cookies = await login_as(client, username="ciprev",
                             password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    resp = await client.post(
        "/api/v1/clusters/1/provisioning/cloudinit/preview",
        json={
            "ciuser": "ubuntu",
            "cipassword": "s3cret-pass",
            "sshkeys": [_VALID_SSH_KEY],
            "ip_mode": "dhcp",
            "nameservers": ["1.1.1.1"],
            "source_kind": "cloud-image",
        },
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "lines" in body
    assert "verdict" in body
    assert body["lines"], "the rendered cloud-config must have lines"
    assert all("text" in ln and "injected" in ln for ln in body["lines"])
    assert "hard_errors" in body["verdict"]
    assert "soft_warnings" in body["verdict"]
    # DHCP + DNS — a soft warning, no hard error.
    assert body["verdict"]["soft_warnings"]
    assert body["verdict"]["hard_errors"] == []
