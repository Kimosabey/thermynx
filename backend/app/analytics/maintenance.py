"""
Predictive maintenance — light POC: run-hours from telemetry buckets,
efficiency-based degradation flag, composite health 0–100.
"""
from dataclasses import dataclass, field

from app.analytics.efficiency import (
    BENCHMARK_DESIGN,
    BENCHMARK_POOR,
    HEALTHY_DELTA_T_MIN,
)


@dataclass
class MaintenanceAssetResult:
    equipment_id: str
    name: str
    type: str
    run_hours: float | None
    bucket_hours: float | None
    degradation_flag: bool
    health_score: int
    degradation_reasons: list[str] = field(default_factory=list)
    avg_kw_per_tr: float | None = None
    avg_chw_delta_t: float | None = None
    avg_kw: float | None = None
    wet_bulb_avg_c: float | None = None
    cell_count_latest: float | None = None
    record_count: int = 0


def _avg(points: list[dict], key: str) -> float | None:
    vals = [float(p[key]) for p in points if p.get(key) is not None]
    return round(sum(vals) / len(vals), 4) if vals else None


def _avg_wet_bulb(points: list[dict]) -> float | None:
    vals: list[float] = []
    for p in points:
        for k in ("wet_bulb_c", "wet_bulb_temp"):
            if p.get(k) is not None:
                vals.append(float(p[k]))
                break
    return round(sum(vals) / len(vals), 4) if vals else None


def _running_weighted_kw(points: list[dict], bucket_h: float) -> tuple[float, float]:
    """Returns (run_hours, kwh_rectangular) using bucket duration."""
    if not points or bucket_h <= 0:
        return 0.0, 0.0
    rh = 0.0
    kwh = 0.0
    for p in points:
        run = bool(p.get("is_running"))
        kw = float(p["kw"]) if p.get("kw") is not None else 0.0
        if run:
            rh += bucket_h
            kwh += kw * bucket_h
    return round(rh, 3), round(kwh, 3)


def analyze_asset_maintenance(
    equipment_id: str,
    name: str,
    eq_type: str,
    points: list[dict],
    bucket_secs: int = 900,
) -> MaintenanceAssetResult:
    """
    points: chronological aggregated buckets (e.g. 15m), each with is_running, kw, type-specific fields.
    """
    bucket_h = bucket_secs / 3600.0
    n = len(points)
    reasons: list[str] = []

    run_hours, _ = _running_weighted_kw(points, bucket_h)
    window_hours = n * bucket_h if n else None

    avg_kw = _avg(points, "kw")
    avg_kw_per_tr = _avg(points, "kw_per_tr") if eq_type == "chiller" else None
    avg_dt = _avg(points, "chw_delta_t") if eq_type == "chiller" else None
    wb = _avg_wet_bulb(points) if eq_type == "cooling_tower" else None

    cell_latest = None
    if eq_type == "cooling_tower" and points:
        for p in reversed(points):
            if p.get("cell_count") is not None:
                cell_latest = float(p["cell_count"])
                break

    degraded = False
    health = 100

    if eq_type == "chiller":
        if avg_kw_per_tr is not None:
            if avg_kw_per_tr >= BENCHMARK_POOR:
                degraded = True
                reasons.append(f"Avg kW/TR {avg_kw_per_tr:.3f} ≥ poor threshold ({BENCHMARK_POOR})")
                health -= 35
            elif avg_kw_per_tr >= BENCHMARK_DESIGN + 0.08:
                degraded = True
                reasons.append(f"Avg kW/TR {avg_kw_per_tr:.3f} meaningfully above design ({BENCHMARK_DESIGN})")
                health -= 22
            elif avg_kw_per_tr >= BENCHMARK_DESIGN:
                health -= 10

        if avg_dt is not None and avg_dt < HEALTHY_DELTA_T_MIN:
            degraded = True
            reasons.append(f"Low CHW ΔT ({avg_dt:.2f}°C) — possible low-ΔT syndrome / fouling signal")
            health -= 18

    if not points:
        health = 0

    health = max(0, min(100, health))

    return MaintenanceAssetResult(
        equipment_id=equipment_id,
        name=name,
        type=eq_type,
        run_hours=run_hours if n else None,
        bucket_hours=round(window_hours, 4) if window_hours else None,
        degradation_flag=degraded,
        degradation_reasons=reasons,
        health_score=health,
        avg_kw_per_tr=avg_kw_per_tr,
        avg_chw_delta_t=avg_dt,
        avg_kw=avg_kw,
        wet_bulb_avg_c=wb,
        cell_count_latest=cell_latest,
        record_count=n,
    )
