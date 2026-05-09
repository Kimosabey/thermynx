"""
Efficiency benchmarker — pure domain logic, no I/O.

Analyzes chiller kW/TR against design + industry benchmarks,
identifies performance bands, and attributes likely loss drivers.
"""
from dataclasses import dataclass, field
from typing import Any

# ── Benchmarks (industry standard water-cooled centrifugal chillers) ──────────
BENCHMARK_GOOD    = 0.55   # IPLV world-class
BENCHMARK_DESIGN  = 0.65   # Typical full-load design point
BENCHMARK_FAIR    = 0.75   # Acceptable degradation
BENCHMARK_POOR    = 0.85   # Investigation required

# Typical healthy chiller operating ranges
HEALTHY_DELTA_T_MIN  = 5.0   # °C  — below this: low ΔT syndrome
HEALTHY_DELTA_T_MAX  = 8.0   # °C  — above this: unusually high load
HEALTHY_LOAD_MIN     = 40.0  # %   — below: part-load inefficiency
APPROACH_WARN        = 2.5   # °C  — condenser approach above this = fouling


@dataclass
class EfficiencyResult:
    equipment_id:    str
    name:            str
    band:            str          # "excellent" | "good" | "fair" | "poor"
    band_color:      str          # "green" | "cyan" | "yellow" | "red"
    kw_per_tr_avg:   float | None
    kw_per_tr_best:  float | None
    kw_per_tr_worst: float | None
    benchmark_design: float = BENCHMARK_DESIGN
    delta_pct:       float | None = None   # vs design benchmark
    running_pct:     float | None = None
    avg_load:        float | None = None
    avg_delta_t:     float | None = None
    avg_approach:    float | None = None
    loss_drivers:    list[str] = field(default_factory=list)
    observations:    list[str] = field(default_factory=list)
    record_count:    int = 0


def _band(kw_per_tr: float | None) -> tuple[str, str]:
    if kw_per_tr is None:
        return "unknown", "gray"
    if kw_per_tr < BENCHMARK_GOOD:
        return "excellent", "green"
    if kw_per_tr < BENCHMARK_DESIGN:
        return "good", "cyan"
    if kw_per_tr < BENCHMARK_FAIR:
        return "fair", "yellow"
    if kw_per_tr < BENCHMARK_POOR:
        return "poor", "orange"
    return "critical", "red"


def _avg(rows: list[dict], key: str) -> float | None:
    vals = [float(r[key]) for r in rows if r.get(key) is not None]
    return round(sum(vals) / len(vals), 4) if vals else None


def _best(rows: list[dict], key: str) -> float | None:
    vals = [float(r[key]) for r in rows if r.get(key) is not None and r.get("is_running")]
    return round(min(vals), 4) if vals else None


def _worst(rows: list[dict], key: str) -> float | None:
    vals = [float(r[key]) for r in rows if r.get(key) is not None and r.get("is_running")]
    return round(max(vals), 4) if vals else None


def analyze_chiller_efficiency(
    equipment_id: str,
    name: str,
    rows: list[dict],
) -> EfficiencyResult:
    """
    Given a list of normalized chiller data rows, return a full
    EfficiencyResult with band, delta vs benchmark, and loss drivers.
    """
    running = [r for r in rows if r.get("is_running")]
    record_count = len(rows)

    if not running:
        return EfficiencyResult(
            equipment_id=equipment_id,
            name=name,
            band="unknown",
            band_color="gray",
            kw_per_tr_avg=None,
            kw_per_tr_best=None,
            kw_per_tr_worst=None,
            observations=["Equipment was not running in this window."],
            record_count=record_count,
        )

    kw_per_tr_avg   = _avg(running, "kw_per_tr")
    kw_per_tr_best  = _best(running, "kw_per_tr")
    kw_per_tr_worst = _worst(running, "kw_per_tr")
    avg_load        = _avg(running, "chiller_load")
    avg_delta_t     = _avg(running, "chw_delta_t")
    running_pct     = round(len(running) / record_count * 100, 1) if record_count else None

    # Condenser approach: cond_leaving - cond_entering
    approach_vals = [
        float(r["cond_leaving_temp"]) - float(r["cond_entering_temp"])
        for r in running
        if r.get("cond_leaving_temp") is not None and r.get("cond_entering_temp") is not None
    ]
    avg_approach = round(sum(approach_vals) / len(approach_vals), 2) if approach_vals else None

    band, band_color = _band(kw_per_tr_avg)
    delta_pct = (
        round((kw_per_tr_avg - BENCHMARK_DESIGN) / BENCHMARK_DESIGN * 100, 1)
        if kw_per_tr_avg is not None else None
    )

    loss_drivers:    list[str] = []
    observations:    list[str] = []

    # ── Loss driver analysis ──────────────────────────────────────────────────
    if kw_per_tr_avg is not None and kw_per_tr_avg >= BENCHMARK_DESIGN:
        observations.append(f"Avg kW/TR {kw_per_tr_avg:.3f} is {abs(delta_pct or 0):.1f}% above design benchmark ({BENCHMARK_DESIGN}).")

        if avg_delta_t is not None and avg_delta_t < HEALTHY_DELTA_T_MIN:
            loss_drivers.append(
                f"Low CHW ΔT ({avg_delta_t:.2f}°C < {HEALTHY_DELTA_T_MIN}°C) — "
                "suggests AHU bypass, poor coil performance, or high chilled-water flow rate"
            )

        if avg_load is not None and avg_load < HEALTHY_LOAD_MIN:
            loss_drivers.append(
                f"Part-load operation ({avg_load:.1f}% < {HEALTHY_LOAD_MIN}%) — "
                "chillers are inefficient at low load; consider staging or VFD optimization"
            )

        if avg_approach is not None and avg_approach > APPROACH_WARN:
            loss_drivers.append(
                f"High condenser approach ({avg_approach:.2f}°C > {APPROACH_WARN}°C) — "
                "likely condenser fouling or scaling; schedule chemical cleaning"
            )

        if kw_per_tr_worst is not None and kw_per_tr_avg is not None:
            spread = kw_per_tr_worst - kw_per_tr_best if kw_per_tr_best else None
            if spread and spread > 0.15:
                loss_drivers.append(
                    f"High kW/TR variance (best={kw_per_tr_best:.3f}, worst={kw_per_tr_worst:.3f}) — "
                    "intermittent performance degradation; review compressor unloading steps"
                )

        if not loss_drivers:
            loss_drivers.append("No specific loss driver identified — consider full refrigerant circuit inspection.")

    else:
        observations.append(
            f"Chiller operating efficiently: kW/TR {kw_per_tr_avg:.3f} "
            f"({'%.1f' % abs(delta_pct or 0)}% below design benchmark)."
        )
        if avg_load is not None:
            observations.append(f"Average load: {avg_load:.1f}%.")

    return EfficiencyResult(
        equipment_id=equipment_id,
        name=name,
        band=band,
        band_color=band_color,
        kw_per_tr_avg=kw_per_tr_avg,
        kw_per_tr_best=kw_per_tr_best,
        kw_per_tr_worst=kw_per_tr_worst,
        delta_pct=delta_pct,
        running_pct=running_pct,
        avg_load=avg_load,
        avg_delta_t=avg_delta_t,
        avg_approach=avg_approach,
        loss_drivers=loss_drivers,
        observations=observations,
        record_count=record_count,
    )
