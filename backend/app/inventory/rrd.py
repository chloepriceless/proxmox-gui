"""RRD response normalization (02-RESEARCH §Common Operation 2)."""

from __future__ import annotations

from app.inventory.schemas import RRDSample


def normalize_rrd_samples(rows: list[dict] | None) -> list[RRDSample]:
    """Coerce PVE RRD response rows into typed samples.

    PVE returns rows with possibly-missing keys for stopped guests (Pitfall 4
    in 02-RESEARCH.md). Missing fields default to 0; we never fail validation
    on a stopped-VM RRD row.
    """
    out: list[RRDSample] = []
    for r in rows or []:
        out.append(
            RRDSample(
                time=int(r.get("time") or 0),
                cpu=float(r.get("cpu") or 0.0),
                mem=int(r.get("mem") or 0),
                maxmem=int(r.get("maxmem") or 0),
                disk=int(r.get("disk") or 0),
                maxdisk=int(r.get("maxdisk") or 0),
                netin=int(r.get("netin") or 0),
                netout=int(r.get("netout") or 0),
                diskread=int(r.get("diskread") or 0),
                diskwrite=int(r.get("diskwrite") or 0),
            )
        )
    return out
