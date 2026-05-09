"""
Rule-based cooling tower fan staging hints — POC advisory only.

Uses wet-bulb when present on bucket rows (`wet_bulb_c`). Unicharm normalized
tower tables typically omit wet-bulb; in that case hints fall back to fan kW +
duty fraction from `is_running` + `kw`.
"""
from dataclasses import dataclass


WB_LOW_STAGING_C = 22.0
WB_HIGH_STAGING_C = 28.0

# kW-only heuristics when wet-bulb is unavailable (tune per site)
KW_HEAVY_TOWER = 25.0
DUTY_FREQUENT = 0.35


@dataclass
class TowerOptimizeHint:
    equipment_id: str
    name: str
    wet_bulb_avg_c: float | None
    avg_fan_kw: float | None
    cell_count_latest: float | None
    staging_hint: str
    est_kwh_saved_per_day: float | None
    rationale: str


def tower_hint(
    equipment_id: str,
    name: str,
    points: list[dict],
    bucket_secs: int = 900,
) -> TowerOptimizeHint:
    bucket_h = bucket_secs / 3600.0

    def _avg_kw(rows: list[dict], running_only: bool) -> float | None:
        vals: list[float] = []
        for p in rows:
            if p.get("kw") is None:
                continue
            if running_only and not p.get("is_running"):
                continue
            vals.append(float(p["kw"]))
        return round(sum(vals) / len(vals), 3) if vals else None

    wb_vals = []
    for p in points:
        for key in ("wet_bulb_c", "wet_bulb_temp"):
            if p.get(key) is not None:
                wb_vals.append(float(p[key]))
                break
    wb_avg = round(sum(wb_vals) / len(wb_vals), 2) if wb_vals else None

    avg_fan_kw = _avg_kw(points, running_only=True)
    avg_kw_any = _avg_kw(points, running_only=False)

    cell_latest = None
    for p in reversed(points):
        if p.get("cell_count") is not None:
            cell_latest = float(p["cell_count"])
            break

    hours_on = sum(bucket_h for p in points if p.get("is_running"))
    duty_frac = (sum(1 for p in points if p.get("is_running")) / len(points)) if points else 0.0

    kw_signal = avg_fan_kw if avg_fan_kw is not None else avg_kw_any

    if not points:
        return TowerOptimizeHint(
            equipment_id=equipment_id,
            name=name,
            wet_bulb_avg_c=wb_avg,
            avg_fan_kw=kw_signal,
            cell_count_latest=cell_latest,
            staging_hint="No bucketed tower data in this window.",
            est_kwh_saved_per_day=None,
            rationale="Query returned zero aggregated points.",
        )

    if kw_signal is None:
        return TowerOptimizeHint(
            equipment_id=equipment_id,
            name=name,
            wet_bulb_avg_c=wb_avg,
            avg_fan_kw=None,
            cell_count_latest=cell_latest,
            staging_hint="Tower buckets lack kW readings — cannot advise on staging.",
            est_kwh_saved_per_day=None,
            rationale="Expected `kw` on aggregated cooling tower rows.",
        )

    # ── Wet-bulb path when telemetry includes it ─────────────────────────────
    if wb_avg is not None:
        saved: float | None = None
        if wb_avg < WB_LOW_STAGING_C and kw_signal > 5:
            hint = (
                "Wet-bulb is favorable — review staged fan sequencing; "
                "you may be able to shed one fan stage during low-WB periods without hurting approach."
            )
            if hours_on > 0:
                saved = round(kw_signal * min(hours_on * 0.2, 4.0), 2)
            rationale = (
                f"Avg wet-bulb {wb_avg}°C < {WB_LOW_STAGING_C}°C while drawing ~{kw_signal} kW — "
                "rule-of-thumb headroom for staging down ~20% of on-time during similar conditions."
            )
        elif wb_avg > WB_HIGH_STAGING_C:
            hint = (
                "Elevated wet-bulb — prioritize heat rejection; avoid aggressive fan reductions "
                "until condenser approach is verified stable."
            )
            rationale = (
                f"Avg wet-bulb {wb_avg}°C > {WB_HIGH_STAGING_C}°C — focus on capacity, not fan savings."
            )
        else:
            hint = (
                "Wet-bulb in mid band — maintain current staging; rebalance cells if fan kW is uneven."
            )
            rationale = (
                f"Avg wet-bulb {wb_avg}°C between advisory bands — no strong rule-based override."
            )
        return TowerOptimizeHint(
            equipment_id=equipment_id,
            name=name,
            wet_bulb_avg_c=wb_avg,
            avg_fan_kw=kw_signal,
            cell_count_latest=cell_latest,
            staging_hint=hint,
            est_kwh_saved_per_day=saved,
            rationale=rationale,
        )

    # ── Fallback: no wet-bulb on normalized feed (typical Unicharm schema) ───
    saved_kw: float | None = None
    if duty_frac >= DUTY_FREQUENT and kw_signal >= KW_HEAVY_TOWER:
        hint = (
            "Tower is often energized at elevated fan kW — review sequencing vs condenser approach "
            "and plant load; confirm you are not holding excess stages."
        )
        saved_kw = round(kw_signal * min(hours_on * 0.12, 6.0), 2)
        rationale = (
            f"No wet-bulb in normalized tower data — heuristic uses duty≈{duty_frac:.0%} "
            f"and avg fan kW≈{kw_signal}. Add wet-bulb to normalized tables for ambient-aware hints."
        )
    elif duty_frac < 0.12:
        hint = "Tower seldom energized in this window — no staging optimization suggested."
        rationale = (
            f"Low duty ({duty_frac:.0%} of buckets show running). "
            "Wet-bulb not available on this feed."
        )
    else:
        hint = (
            "Moderate tower operation — maintain routine checks. "
            "Wet-bulb-aware staging advice needs `wet_bulb_c` (or `wet_bulb_temp`) on normalized rows."
        )
        rationale = (
            f"Duty≈{duty_frac:.0%}, avg kW≈{kw_signal}. "
            "Rule-based savings estimate omitted until WB-backed model is available."
        )

    return TowerOptimizeHint(
        equipment_id=equipment_id,
        name=name,
        wet_bulb_avg_c=None,
        avg_fan_kw=kw_signal,
        cell_count_latest=cell_latest,
        staging_hint=hint,
        est_kwh_saved_per_day=saved_kw,
        rationale=rationale,
    )
