"""
Anomaly detector — z-score based, pure domain logic.

Compares recent metric values against hour-of-day baselines.
A z-score > threshold is flagged as an anomaly.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Any
import math

Z_THRESHOLD = 3.0   # standard deviations
MIN_SAMPLES  = 10   # minimum rows needed to compute a meaningful baseline


@dataclass
class AnomalyEvent:
    equipment_id:   str
    metric:         str
    timestamp:      str
    value:          float
    baseline_mean:  float
    baseline_std:   float
    z_score:        float
    severity:       str    # "warning" | "critical"
    description:    str


@dataclass
class BaselineStats:
    mean: float
    std:  float
    count: int


def compute_baseline(rows: list[dict], metric: str) -> BaselineStats | None:
    """Compute mean + std for a metric from a list of rows."""
    vals = [float(r[metric]) for r in rows if r.get(metric) is not None]
    if len(vals) < MIN_SAMPLES:
        return None
    n    = len(vals)
    mean = sum(vals) / n
    std  = math.sqrt(sum((v - mean) ** 2 for v in vals) / n)
    return BaselineStats(mean=round(mean, 4), std=round(std, 4), count=n)


def detect_anomalies(
    equipment_id: str,
    rows: list[dict],
    metrics: list[str],
    baseline_rows: list[dict] | None = None,
) -> list[AnomalyEvent]:
    """
    Detect anomalies in `rows` for each metric.

    If `baseline_rows` is provided (e.g. historical data for the same
    hour-of-day), use those to build the baseline; otherwise fall back
    to computing the baseline from `rows` itself (less accurate but works
    for POC without historical storage).
    """
    base_source = baseline_rows if baseline_rows else rows
    events: list[AnomalyEvent] = []

    for metric in metrics:
        baseline = compute_baseline(base_source, metric)
        if baseline is None or baseline.std < 1e-6:
            continue  # not enough data or no variance

        for row in rows:
            val = row.get(metric)
            if val is None:
                continue
            val = float(val)
            z = (val - baseline.mean) / baseline.std

            if abs(z) >= Z_THRESHOLD:
                severity = "critical" if abs(z) >= Z_THRESHOLD * 1.5 else "warning"
                ts = str(row.get("slot_time", ""))

                description = (
                    f"{metric.replace('_', ' ')} = {val:.3f} "
                    f"({'%.1f' % abs(z)}σ {'above' if z > 0 else 'below'} baseline "
                    f"mean={baseline.mean:.3f})"
                )

                events.append(AnomalyEvent(
                    equipment_id=equipment_id,
                    metric=metric,
                    timestamp=ts,
                    value=round(val, 4),
                    baseline_mean=baseline.mean,
                    baseline_std=baseline.std,
                    z_score=round(z, 2),
                    severity=severity,
                    description=description,
                ))

    # Deduplicate — keep only the most extreme z per (metric, hour)
    seen: dict[str, AnomalyEvent] = {}
    for ev in events:
        hour = ev.timestamp[:13]  # group by hour
        key  = f"{ev.metric}_{hour}"
        if key not in seen or abs(ev.z_score) > abs(seen[key].z_score):
            seen[key] = ev

    return sorted(seen.values(), key=lambda e: abs(e.z_score), reverse=True)


CHILLER_METRICS = [
    "kw_per_tr",
    "chw_delta_t",
    "chiller_load",
    "evap_leaving_temp",
    "cond_leaving_temp",
]

TOWER_PUMP_METRICS = ["kw"]
