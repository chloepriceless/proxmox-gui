"""Pydantic request/response schemas for the provisioning create API.

Modelled on ``app.lifecycle.schemas`` — every model uses
``ConfigDict(extra="forbid")`` (the project convention) so unknown body fields
are rejected 422 and the root-only Proxmox lock-override parameter can never
be smuggled through.

The per-path request models each expose a ``to_pve_config(pool=...)`` method
that translates wizard input into the proxmoxer kwargs dict the connector's
``create_qemu`` / ``create_lxc`` consume. Every translated config carries
``pool=<team_pool>`` (Pitfall 5/7, CLAUDE.md #7) — PVE creates the resource
directly inside the team's pool.

``ProvisioningJobAcceptedResponse`` subclasses the Phase-3
``JobAcceptedResponse`` and adds ``vmid: int`` — the wizard routes to
``/inventory/{cluster}/{vmid}`` immediately on the 202 (D-04), so the reserved
VMID MUST be in the response body.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.lifecycle.schemas import JobAcceptedResponse

# ---------------------------------------------------------------------------
# Shared network sub-model
# ---------------------------------------------------------------------------


class NetworkConfig(BaseModel):
    """One NIC's network config — an SDN VNet or a legacy bridge + IP mode.

    ``kind`` selects between an SDN VNet and a legacy bridge; ``id`` is the
    VNet/bridge name. ``ip_mode`` is ``dhcp`` (default) or ``static`` — a
    static address must supply ``ip_cidr`` (and optionally ``gateway``).
    """

    model_config = ConfigDict(extra="forbid")
    kind: Literal["sdn-vnet", "bridge"] = "bridge"
    id: str = Field(..., min_length=1, max_length=64)
    ip_mode: Literal["dhcp", "static"] = "dhcp"
    ip_cidr: str | None = Field(default=None, max_length=64)
    gateway: str | None = Field(default=None, max_length=64)
    vlan_tag: int | None = Field(default=None, ge=1, le=4094)

    @model_validator(mode="after")
    def _static_requires_cidr(self) -> NetworkConfig:
        if self.ip_mode == "static" and not self.ip_cidr:
            raise ValueError(
                "A static network needs an IP address in CIDR form (ip_cidr)."
            )
        return self

    def to_net0(self, *, is_lxc: bool) -> str:
        """Render the PVE ``net0`` config string for this NIC."""
        model = "veth" if is_lxc else "virtio"
        parts = [model, f"bridge={self.id}"]
        if self.vlan_tag is not None:
            parts.append(f"tag={self.vlan_tag}")
        return ",".join(parts)

    def ipconfig0(self) -> str:
        """Render the PVE ``ipconfig0`` cloud-init string (Pitfall 6).

        A missing ``ipconfig0`` on a cloud-init VM silently breaks networking
        — every VM create therefore sets it (``ip=dhcp`` when not static).
        """
        if self.ip_mode == "static" and self.ip_cidr:
            cfg = f"ip={self.ip_cidr}"
            if self.gateway:
                cfg += f",gw={self.gateway}"
            return cfg
        return "ip=dhcp"

    def lxc_net0(self) -> str:
        """Render the PVE ``net0`` string for an LXC (carries the IP inline)."""
        parts = ["name=eth0", f"bridge={self.id}"]
        if self.vlan_tag is not None:
            parts.append(f"tag={self.vlan_tag}")
        if self.ip_mode == "static" and self.ip_cidr:
            parts.append(f"ip={self.ip_cidr}")
            if self.gateway:
                parts.append(f"gw={self.gateway}")
        else:
            parts.append("ip=dhcp")
        return ",".join(parts)


# ---------------------------------------------------------------------------
# LXC create (LXC-05/06/07)
# ---------------------------------------------------------------------------


class CreateLxcRequest(BaseModel):
    """Body of ``POST /clusters/{id}/provisioning/lxc`` — a plain LXC create.

    ``team_id`` names the owning team (provisioning creates a NEW resource so
    there is no existing resource to resolve the team from). ``features`` is
    the LXC-07 feature list (e.g. ``keyctl``/``fuse``); ``nesting`` is a
    separate toggle folded into the PVE ``features`` string.
    """

    model_config = ConfigDict(extra="forbid")
    team_id: int = Field(..., ge=1)
    node: str = Field(..., min_length=1, max_length=64)
    storage: str = Field(..., min_length=1, max_length=128)
    ostemplate: str = Field(..., min_length=1, max_length=256)
    hostname: str = Field(..., min_length=1, max_length=64)
    cpu_cores: int = Field(..., ge=1, le=512)
    memory_mb: int = Field(..., ge=16)
    disk_gb: int = Field(..., ge=1)
    network: NetworkConfig | None = None
    unprivileged: bool = True
    nesting: bool = False
    features: list[str] = Field(default_factory=list)
    ssh_public_keys: str | None = Field(default=None, max_length=8192)
    password: str | None = Field(default=None, max_length=128)
    start_after_create: bool = False

    @property
    def requested_ram_bytes(self) -> int:
        return self.memory_mb * 1024 * 1024

    @property
    def requested_disk_bytes(self) -> int:
        return self.disk_gb * 1024 * 1024 * 1024

    def to_pve_config(self, *, pool: str) -> dict[str, Any]:
        """Translate the wizard input into proxmoxer kwargs for ``create_lxc``.

        ``ostemplate`` is passed separately to ``connector.create_lxc`` — it is
        therefore not part of this dict. ``pool`` is always carried so PVE
        creates the container inside the team pool (Pitfall 5/7).
        """
        config: dict[str, Any] = {
            "hostname": self.hostname,
            "cores": self.cpu_cores,
            "memory": self.memory_mb,
            "rootfs": f"{self.storage}:{self.disk_gb}",
            "unprivileged": 1 if self.unprivileged else 0,
            "pool": pool,
            "ostemplate": self.ostemplate,
        }
        net = self.network or NetworkConfig(id="vmbr0")
        config["net0"] = net.lxc_net0()
        # LXC-07: nesting + the explicit feature list fold into one features=
        # string (PVE expects "nesting=1,keyctl=1,...").
        feature_tokens: list[str] = []
        if self.nesting:
            feature_tokens.append("nesting=1")
        for feat in self.features:
            token = feat if "=" in feat else f"{feat}=1"
            feature_tokens.append(token)
        if feature_tokens:
            config["features"] = ",".join(feature_tokens)
        if self.ssh_public_keys:
            config["ssh-public-keys"] = self.ssh_public_keys
        if self.password:
            config["password"] = self.password
        if self.start_after_create:
            config["start"] = 1
        return config


# ---------------------------------------------------------------------------
# VM create (VM-01 cloud-image / VM-02 template-clone / VM-03 blank+ISO /
# VM-04 vm-clone)
# ---------------------------------------------------------------------------


class CreateQemuRequest(BaseModel):
    """Body of ``POST /clusters/{id}/provisioning/qemu``.

    A discriminated model over ``source_kind``:
    - ``cloud-image`` — boot a cloud-init image (VM-01): ``image_id`` + the
      optional cloud-init form fields.
    - ``blank-iso`` — a blank VM with a mounted ISO (VM-03): ``iso_volid``.
    - ``template-clone`` — clone a PVE template (VM-02): ``source_vmid`` +
      ``clone_mode``. The route delegates to the Phase-3 clone path.
    - ``vm-clone`` — clone an existing VM (VM-04): same fields as
      ``template-clone``.

    For the clone source kinds the sizing/network/cloud-init fields are
    ignored — the clone copies the source's config.
    """

    model_config = ConfigDict(extra="forbid")
    team_id: int = Field(..., ge=1)
    source_kind: Literal["cloud-image", "blank-iso", "template-clone", "vm-clone"]
    node: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=128)
    storage: str | None = Field(default=None, max_length=128)
    cpu_cores: int | None = Field(default=None, ge=1, le=512)
    memory_mb: int | None = Field(default=None, ge=16)
    disk_gb: int | None = Field(default=None, ge=1)
    network: NetworkConfig | None = None

    # cloud-image (VM-01)
    image_id: str | None = Field(default=None, max_length=256)
    ci_user: str | None = Field(default=None, max_length=64)
    ci_password: str | None = Field(default=None, max_length=128)
    ssh_public_keys: str | None = Field(default=None, max_length=8192)

    # blank-iso (VM-03)
    iso_volid: str | None = Field(default=None, max_length=256)

    # template-clone / vm-clone (VM-02 / VM-04)
    source_vmid: int | None = Field(default=None, ge=1)
    clone_mode: Literal["linked", "full"] = "full"

    @model_validator(mode="after")
    def _kind_requires_fields(self) -> CreateQemuRequest:
        if self.source_kind == "cloud-image" and not self.image_id:
            raise ValueError("A cloud-image VM needs an image_id.")
        if self.source_kind == "blank-iso" and not self.iso_volid:
            raise ValueError("A blank+ISO VM needs an iso_volid.")
        if self.source_kind in ("template-clone", "vm-clone") and (
            self.source_vmid is None
        ):
            raise ValueError("A clone source needs a source_vmid.")
        # The non-clone paths need sizing.
        if self.source_kind in ("cloud-image", "blank-iso"):
            if self.cpu_cores is None or self.memory_mb is None or (
                self.disk_gb is None
            ):
                raise ValueError(
                    "A VM create needs cpu_cores, memory_mb and disk_gb."
                )
            if not self.storage:
                raise ValueError("A VM create needs a target storage.")
        return self

    @property
    def is_clone(self) -> bool:
        return self.source_kind in ("template-clone", "vm-clone")

    @property
    def requested_ram_bytes(self) -> int:
        return (self.memory_mb or 0) * 1024 * 1024

    @property
    def requested_disk_bytes(self) -> int:
        return (self.disk_gb or 0) * 1024 * 1024 * 1024

    def to_pve_config(self, *, pool: str) -> dict[str, Any]:
        """Translate the wizard input into proxmoxer kwargs for ``create_qemu``.

        Only valid for the non-clone source kinds (``cloud-image`` /
        ``blank-iso``) — the clone kinds route through ``clone.enqueue_clone``
        and never call this. ``pool`` is always carried (Pitfall 5/7).
        """
        if self.is_clone:
            raise ValueError(
                "to_pve_config is only valid for non-clone source kinds; "
                "clone kinds route through the clone path."
            )
        config: dict[str, Any] = {
            "name": self.name,
            "cores": self.cpu_cores,
            "memory": self.memory_mb,
            "pool": pool,
            "scsihw": "virtio-scsi-single",
        }
        net = self.network or NetworkConfig(id="vmbr0")
        config["net0"] = net.to_net0(is_lxc=False)

        if self.source_kind == "cloud-image":
            # The cloud image becomes the boot disk on the target storage.
            config["scsi0"] = f"{self.storage}:{self.disk_gb},import-from={self.image_id}"
            # Cloud-init drive (Pitfall 6 — ide2 + ipconfig0 are mandatory).
            config["ide2"] = f"{self.storage}:cloudinit"
            config["ipconfig0"] = net.ipconfig0()
            config["boot"] = "order=scsi0"
            if self.ci_user:
                config["ciuser"] = self.ci_user
            if self.ci_password:
                config["cipassword"] = self.ci_password
            if self.ssh_public_keys:
                config["sshkeys"] = self.ssh_public_keys
        else:  # blank-iso
            # An empty boot disk + the ISO mounted on ide2.
            config["scsi0"] = f"{self.storage}:{self.disk_gb}"
            config["ide2"] = f"{self.iso_volid},media=cdrom"
            config["boot"] = "order=ide2;scsi0"
        return config


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------


class ProvisioningJobAcceptedResponse(JobAcceptedResponse):
    """The ``202 Accepted`` body for a provisioning create.

    Subclasses the Phase-3 ``JobAcceptedResponse`` (``{job_id, state, kind}``)
    and adds ``vmid`` — the app-reserved VMID. D-04: the wizard routes to
    ``/inventory/{cluster}/{vmid}`` immediately on the 202, so the reserved
    VMID MUST be in the response body.
    """

    vmid: int
