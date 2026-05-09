"""Cost rollup — integrate kW over bucketed telemetry × flat tariff (₹/kWh)."""
from dataclasses import dataclass, field


@dataclass
class EquipmentCostRow:
    equipment_id: str
    name: str
    type: str
    kwh: float
    cost_inr: float
    run_hours: float | None
    avg_kw: float | None = None
    total_trh: float | None = None
    inr_per_tr_hr: float | None = None


@dataclass
class PlantCostSummary:
    hours_window: int
    tariff_inr_per_kwh: float
    total_kwh: float
    total_cost_inr: float
    equipment: list[EquipmentCostRow] = field(default_factory=list)


def integrate_kwh_from_buckets(points: list[dict], bucket_secs: int = 900) -> tuple[float, float, float | None]:
    """
    Rectangular integration: each bucket contributes kw_avg * bucket_hours when is_running.
    Returns (kwh, run_hours, avg_kw_when_running).
    """
    bucket_h = bucket_secs / 3600.0
    kwh = 0.0
    rh = 0.0
    kw_sum = 0.0
    kw_n = 0
    for p in points:
        if not p.get("is_running"):
            continue
        kw = float(p["kw"]) if p.get("kw") is not None else 0.0
        rh += bucket_h
        kwh += kw * bucket_h
        kw_sum += kw
        kw_n += 1
    avg_kw = round(kw_sum / kw_n, 4) if kw_n else None
    return round(kwh, 4), round(rh, 4), avg_kw


def integrate_trh_from_buckets(points: list[dict], bucket_secs: int = 900) -> float | None:
    """Chiller-only: approximate TR·h as avg(TR) * run_hours in bucket."""
    bucket_h = bucket_secs / 3600.0
    trh = 0.0
    for p in points:
        if not p.get("is_running"):
            continue
        tr = p.get("tr")
        if tr is None:
            continue
        trh += float(tr) * bucket_h
    return round(trh, 4) if trh > 0 else None


def build_plant_cost(
    datasets: list[tuple[str, str, str, list[dict]]],
    hours_window: int,
    tariff_inr_per_kwh: float,
    bucket_secs: int = 900,
) -> PlantCostSummary:
    """
    datasets: list of (equipment_id, name, type, bucket_points)
    """
    rows: list[EquipmentCostRow] = []
    total_kwh = 0.0
    total_inr = 0.0

    for eq_id, name, eq_type, pts in datasets:
        kwh, rh, avg_kw = integrate_kwh_from_buckets(pts, bucket_secs)
        total_trh = integrate_trh_from_buckets(pts, bucket_secs) if eq_type == "chiller" else None
        cost = round(kwh * tariff_inr_per_kwh, 2)
        inr_per_tr_h = round(cost / total_trh, 4) if total_trh and total_trh > 0 else None

        rows.append(
            EquipmentCostRow(
                equipment_id=eq_id,
                name=name,
                type=eq_type,
                kwh=kwh,
                cost_inr=cost,
                run_hours=rh if rh > 0 else None,
                avg_kw=avg_kw,
                total_trh=total_trh,
                inr_per_tr_hr=inr_per_tr_h,
            )
        )
        total_kwh += kwh
        total_inr += cost

    return PlantCostSummary(
        hours_window=hours_window,
        tariff_inr_per_kwh=tariff_inr_per_kwh,
        total_kwh=round(total_kwh, 4),
        total_cost_inr=round(total_inr, 2),
        equipment=rows,
    )
