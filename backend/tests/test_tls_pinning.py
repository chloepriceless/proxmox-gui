"""TLS fingerprint pinning tests (D-20 — carryover TLS-pinning item).

Pitfall 4: a pin that cannot fail is not a pin. The headline test is the
NEGATIVE one — :func:`test_wrong_fingerprint_is_refused` — which asserts that
a connection whose leaf cert does NOT match the pinned SHA-256 is refused.

The tests stand up a real local HTTPS server with a freshly-generated
self-signed certificate, so the pinning path is exercised end-to-end against
a genuine TLS handshake (not a mock).
"""

from __future__ import annotations

import datetime
import http.server
import socket
import ssl
import tempfile
import threading
from pathlib import Path

import pytest
import requests

from app.clusters.pinning import (
    FingerprintPinningAdapter,
    capture_fingerprint,
)


def _make_self_signed_cert(tmp: Path) -> tuple[Path, Path]:
    """Generate a self-signed cert + key into ``tmp``; return (cert, key)."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.datetime.now(datetime.UTC)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=365))
        .add_extension(
            x509.SubjectAlternativeName([x509.DNSName("localhost")]),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    cert_path = tmp / "cert.pem"
    key_path = tmp / "key.pem"
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        )
    )
    return cert_path, key_path


class _HTTPSServer:
    """A throwaway local HTTPS server backed by a self-signed cert."""

    def __init__(self, cert: Path, key: Path) -> None:
        handler = http.server.BaseHTTPRequestHandler

        class _Quiet(handler):  # type: ignore[misc, valid-type]
            def do_GET(self) -> None:  # noqa: N802
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"ok")

            def log_message(self, *_args: object) -> None:  # noqa: D102
                pass

        self._srv = http.server.HTTPServer(("127.0.0.1", 0), _Quiet)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(certfile=str(cert), keyfile=str(key))
        self._srv.socket = ctx.wrap_socket(self._srv.socket, server_side=True)
        self.port = self._srv.server_address[1]
        self._thread = threading.Thread(target=self._srv.serve_forever, daemon=True)

    def __enter__(self) -> _HTTPSServer:
        self._thread.start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self._srv.shutdown()
        self._srv.server_close()
        self._thread.join(timeout=5)


@pytest.fixture
def https_server():
    """Yield a running local HTTPS server with a self-signed cert."""
    with tempfile.TemporaryDirectory() as d:
        cert, key = _make_self_signed_cert(Path(d))
        with _HTTPSServer(cert, key) as srv:
            yield srv


def test_capture_fingerprint_returns_sha256_hex(https_server):
    """capture_fingerprint fetches the leaf cert and returns lowercase hex."""
    fp = capture_fingerprint("127.0.0.1", https_server.port)
    assert isinstance(fp, str)
    assert len(fp) == 64  # SHA-256 hex
    assert fp == fp.lower()
    assert all(c in "0123456789abcdef" for c in fp)


def test_correct_fingerprint_is_accepted(https_server):
    """A connection pinned to the server's own fingerprint succeeds."""
    fp = capture_fingerprint("127.0.0.1", https_server.port)
    session = requests.Session()
    session.mount("https://", FingerprintPinningAdapter(fp))
    resp = session.get(
        f"https://127.0.0.1:{https_server.port}/", verify=False, timeout=5,
    )
    assert resp.status_code == 200
    assert resp.content == b"ok"


def test_wrong_fingerprint_is_refused(https_server):
    """NEGATIVE TEST (Pitfall 4): a mismatched pin refuses the connection.

    A pin that cannot fail is not a pin. Point the adapter at a fingerprint
    that does NOT match the server's cert and assert the connection is
    refused with a TLS error.
    """
    wrong_fp = "00" * 32  # 64 hex chars, definitely not the server's cert
    session = requests.Session()
    session.mount("https://", FingerprintPinningAdapter(wrong_fp))
    with pytest.raises(requests.exceptions.SSLError):
        session.get(
            f"https://127.0.0.1:{https_server.port}/", verify=False, timeout=5,
        )


def test_fingerprint_normalised_colons_and_case(https_server):
    """A colon-grouped uppercase fingerprint pins identically to bare hex."""
    fp = capture_fingerprint("127.0.0.1", https_server.port)
    # Re-shape into ssh-keygen-style AB:CD:EF... uppercase.
    grouped = ":".join(fp[i : i + 2] for i in range(0, len(fp), 2)).upper()
    session = requests.Session()
    session.mount("https://", FingerprintPinningAdapter(grouped))
    resp = session.get(
        f"https://127.0.0.1:{https_server.port}/", verify=False, timeout=5,
    )
    assert resp.status_code == 200


def test_capture_fingerprint_unreachable_host_raises():
    """An unreachable host surfaces an OSError the caller maps to a friendly
    error — capture must not silently return a bogus value."""
    # Reserve a port then close it so the connection is refused.
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    closed_port = sock.getsockname()[1]
    sock.close()
    with pytest.raises(OSError):
        capture_fingerprint("127.0.0.1", closed_port)


def test_connector_mounts_pinning_adapter_when_fingerprint_set():
    """PVEConnector mounts the pinning adapter on proxmoxer's session when a
    tls_fingerprint is supplied with verify_ssl=False — and the Phase-1
    NotImplementedError guard is gone."""
    from app.clusters.connector import PVEConnector
    from app.clusters.pinning import FingerprintPinningAdapter

    fp = "ab" * 32
    conn = PVEConnector(
        host="pve.example.invalid",
        port=8006,
        token_user="root@pam",
        token_name="gui",
        token_value="00000000-0000-0000-0000-000000000000",
        verify_ssl=False,
        tls_fingerprint=fp,
    )
    # The proxmoxer session must carry our adapter for https://.
    session = conn._client._store["session"]
    adapter = session.get_adapter("https://pve.example.invalid:8006/")
    assert isinstance(adapter, FingerprintPinningAdapter)
    assert adapter._fingerprint == fp  # already colon-free lowercase


def test_connector_no_pinning_when_verify_ssl_true():
    """With verify_ssl=True the cluster has a CA-trusted cert — no pin mounted,
    and the constructor must not raise (Phase-1 guard removed)."""
    from app.clusters.connector import PVEConnector
    from app.clusters.pinning import FingerprintPinningAdapter

    conn = PVEConnector(
        host="pve.example.invalid",
        port=8006,
        token_user="root@pam",
        token_name="gui",
        token_value="00000000-0000-0000-0000-000000000000",
        verify_ssl=True,
        tls_fingerprint="ab" * 32,
    )
    session = conn._client._store["session"]
    adapter = session.get_adapter("https://pve.example.invalid:8006/")
    assert not isinstance(adapter, FingerprintPinningAdapter)
