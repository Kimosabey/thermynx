"""
Energy forecaster — statistical, no external ML packages.

Method: hour-of-day profile
  1. Pull last 7 days of history (same equipment)
  2. Compute mean + std of each metric per hour-of-day (0-23)
  3. For the next 24 hours, project using that profile
  4. CI: mean ± 1 std (≈68% interval)

Works for HVAC because cooling load follows daily patterns strongly.
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict


@dataclass
class ForecastPoint:
    hour_label:   str       # "2026-05-10 14:00"
    hour_of_day:  int
    predicted:    float
    lower:        float
    upper:        float
    confidence:   str       # "high" | "medium" | "low" (based on sample count)


@dataclass
class ForecastResult:
    equipment_id:  str
    metric:        str
    horizon_hours: int
    generated_at:  str
    points:        list[ForecastPoint] = field(default_factory=list)
    note:          str = ""


def _mean(vals: list[float]) -> float:
    return sum(vals) / len(vals) if vals else 0.0


def _std(vals: list[float], mean: float) -> float:
    if len(vals) < 2:
        return 0.0
    return math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))


def forecast_metric(
    rows: list[dict],
    metric: str,
    horizon_hours: int = 24,
    equipment_id: str = "",
) -> ForecastResult:
    """
    Build a next-N-hours forecast for `metric` from historical `rows`.
    rows must have: slot_time (str/datetime), is_running, and the metric column.
    """
    # Build hour-of-day profile from history
    profile: dict[int, list[float]] = defaultdict(list)
    for row in rows:
        val = row.get(metric)
        if val is None or not row.get("is_running"):
            continue
        ts = row.get("slot_time")
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts)
            except ValueError:
                continue
        if isinstance(ts, datetime):
            profile[ts.hour].append(float(val))

    if not profile:
        return ForecastResult(
            equipment_id=equipment_id,
            metric=metric,
            horizon_hours=horizon_hours,
            generated_at=datetime.utcnow().isoformat(),
            note="Insufficient historical data to generate forecast.",
        )

    # Project next N hours
    now    = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    points = []
    for h in range(horizon_hours):
        future    = now + timedelta(hours=h + 1)
        hod       = future.hour
        hist_vals = profile.get(hod, [])

        if not hist_vals:
            # Interpolate from adjacent hours
            for delta in range(1, 4):
                hist_vals = profile.get((hod + delta) % 24, []) + profile.get((hod - delta) % 24, [])
                if hist_vals:
                    break

        if not hist_vals:
            continue

        mu  = _mean(hist_vals)
        sig = _std(hist_vals, mu)
        n   = len(hist_vals)

        confidence = "high" if n >= 10 else "medium" if n >= 4 else "low"

        points.append(ForecastPoint(
            hour_label   = future.strftime("%Y-%m-%d %H:00"),
            hour_of_day  = hod,
            predicted    = round(mu, 3),
            lower        = round(max(0, mu - sig), 3),
            upper        = round(mu + sig, 3),
            confidence   = confidence,
        ))

    return ForecastResult(
        equipment_id  = equipment_id,
        metric        = metric,
        horizon_hours = horizon_hours,
        generated_at  = datetime.utcnow().isoformat(),
        points        = points,
        note          = f"Hour-of-day profile built from {sum(len(v) for v in profile.values())} historical readings.",
    )


FORECAST_METRICS = {
    "chiller":       ["kw", "kw_per_tr", "chiller_load"],
    "cooling_tower": ["kw"],
    "pump":          ["kw"],
}
