"""Vendored curated cloud-image catalogue — D-15.

Static config data, no DB. ``CURATED_CLOUD_IMAGES`` is a module-level list of
dicts; the ISO routes expose it verbatim so the VM-creation wizard can offer a
one-click "deploy from an official cloud image" choice (VM-01) without the
user hunting for a download URL.

Each entry carries:
- ``id`` — a stable slug the wizard sends back on ``POST .../iso/download``.
- ``name`` — the human label for the picker.
- ``os_family`` — ubuntu / debian / rocky / ... (drives the distro icon).
- ``version`` — the release string.
- ``url`` — the official upstream download URL (``download-url`` fetches it on
  the PVE node — Pitfall 7, the GUI never proxies the bytes).

These are the genericcloud / cloud-image qcow2 builds — the variant intended
for cloud-init provisioning. Versions are pinned to current LTS / stable
releases; a later catalogue-refresh plan can bump them.
"""

from __future__ import annotations

#: The curated set of official cloud images offered in the VM wizard (D-15).
CURATED_CLOUD_IMAGES: list[dict[str, str]] = [
    {
        "id": "ubuntu-24.04",
        "name": "Ubuntu 24.04 LTS (Noble Numbat)",
        "os_family": "ubuntu",
        "version": "24.04",
        "url": (
            "https://cloud-images.ubuntu.com/noble/current/"
            "noble-server-cloudimg-amd64.img"
        ),
    },
    {
        "id": "ubuntu-22.04",
        "name": "Ubuntu 22.04 LTS (Jammy Jellyfish)",
        "os_family": "ubuntu",
        "version": "22.04",
        "url": (
            "https://cloud-images.ubuntu.com/jammy/current/"
            "jammy-server-cloudimg-amd64.img"
        ),
    },
    {
        "id": "debian-12",
        "name": "Debian 12 (Bookworm)",
        "os_family": "debian",
        "version": "12",
        "url": (
            "https://cloud.debian.org/images/cloud/bookworm/latest/"
            "debian-12-genericcloud-amd64.qcow2"
        ),
    },
    {
        "id": "debian-11",
        "name": "Debian 11 (Bullseye)",
        "os_family": "debian",
        "version": "11",
        "url": (
            "https://cloud.debian.org/images/cloud/bullseye/latest/"
            "debian-11-genericcloud-amd64.qcow2"
        ),
    },
    {
        "id": "rocky-9",
        "name": "Rocky Linux 9",
        "os_family": "rocky",
        "version": "9",
        "url": (
            "https://download.rockylinux.org/pub/rocky/9/images/x86_64/"
            "Rocky-9-GenericCloud-Base.latest.x86_64.qcow2"
        ),
    },
    {
        "id": "almalinux-9",
        "name": "AlmaLinux 9",
        "os_family": "almalinux",
        "version": "9",
        "url": (
            "https://repo.almalinux.org/almalinux/9/cloud/x86_64/images/"
            "AlmaLinux-9-GenericCloud-latest.x86_64.qcow2"
        ),
    },
    {
        "id": "fedora-40",
        "name": "Fedora Cloud 40",
        "os_family": "fedora",
        "version": "40",
        "url": (
            "https://download.fedoraproject.org/pub/fedora/linux/releases/40/"
            "Cloud/x86_64/images/"
            "Fedora-Cloud-Base-Generic.x86_64-40-1.14.qcow2"
        ),
    },
]
