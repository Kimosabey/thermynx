"""Degradation / drift detector — pure deterministic logic (no I/O, no LLM).

Snapshot maintenance (analytics/maintenance.py) answers "is it bad NOW?".
This answers the predictive question: "is it getting WORSE, and when will it
cross the poor line?" — by fitting a trend over a multi-day window and
projecting time-to-threshold. That lets a PM work order be proposed *before*
failure, not after the average already breached the benchmark.

The math is plain least-squares + half-window comparison so it is auditable and
unit-testable; the LLM only narrates the resulting signal, it never produces it.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.analytics.efficiency import BENCHMARK_POOR, APPROACH_WARN

_MIN_VALID_TR = 10.0
_MIN_SAMPLES = 12          # need a meaningful series to trust a slope
_MIN_PCT_CHANGE = 3.0      # late vs early must rise at least this % to call it drift
_PROJECT_WARN_DAYS = 21    # crossing the poor line within this horizon → warning


@dataclass
class DriftSignal:
    equipment_id: str
    name:         str
    metric:       str         # e.g. "kw_per_tr"
    samples:      int
    early_avg:    float | None
    late_avg:     float | None       # ~current
    pct_change:   float | None       # late vs early
    slope_per_day: float | None
    threshold:    float | None
    projected_days_to_threshold: float | None  # None = not heading there / already over
    degrading:    bool
    severity:     str         # "none" | "watch" | "warning" | "critical"
    summary:      str


def _slope_per_day(values: list[float], bucket_secs: int) -> float | None:
    """Least-squares slope in units/day, using bucket index as the x-axis
    (buckets are uniformly spaced by construction)."""
    n = len(values)
    if n < 2:
        return None
    xs = list(range(n))
    mx = sum(xs) / n
    my = sum(values) / n
    denom = sum((x - mx) ** 2 for x in xs)
    if denom == 0:
        return None
    slope_per_bucket = sum((x - mx) * (y - my) for x, y in zip(xs, values)) / denom
    buckets_per_day = 86400.0 / bucket_secs
    return slope_per_bucket * buckets_per_day


def detect_drift(
    equipment_id: str,
    name: str,
    metric: str,
    values: list[float],
    *,
    threshold: float,
    bucket_secs: int = 900,
) -> DriftSignal:
    """Detect a worsening (rising) trend in `values` (chronological).

    `threshold` is the 'poor' level for the metric (higher = worse)."""
    n = len(values)
    if n < _MIN_SAMPLES:
        return DriftSignal(
            equipment_id, name, metric, n, None, None, None, None, threshold,
            None, False, "none", "Not enough running data to assess a trend.",
        )

    half = n // 2
    early = values[:half]
    late = values[half:]
    early_avg = round(sum(early) / len(early), 4)
    late_avg = round(sum(late) / len(late), 4)
    pct_change = round((late_avg - early_avg) / early_avg * 100, 1) if early_avg else None
    slope = _slope_per_day(values, bucket_secs)
    slope = round(slope, 5) if slope is not None else None

    rising = (slope is not None and slope > 0) and (pct_change is not None and pct_change >= _MIN_PCT_CHANGE)

    projected = None
    if rising and slope and late_avg < threshold:
        projected = round((threshold - late_avg) / slope, 1)
        if projected < 0:
            projected = None

    # Severity
    if late_avg >= threshold and rising:
        severity = "critical"   # already past the poor line AND still climbing
    elif rising and projected is not None and projected <= _PROJECT_WARN_DAYS:
        severity = "warning"    # not over yet, but on track to cross soon
    elif rising:
        severity = "watch"      # worsening but distant
    else:
        severity = "none"

    degrading = severity in ("watch", "warning", "critical")

    if not degrading:
        summary = f"{metric} stable ({late_avg} vs {early_avg} earlier)."
    else:
        proj_txt = (
            f"on track to cross {threshold} in ~{projected:g} days"
            if projected is not None else
            (f"already above the {threshold} poor line and still rising" if late_avg >= threshold
             else "rising")
        )
        summary = (
            f"{metric} rose {pct_change}% ({early_avg} → {late_avg}), "
            f"+{slope}/day — {proj_txt}."
        )

    return DriftSignal(
        equipment_id, name, metric, n, early_avg, late_avg, pct_change, slope,
        threshold, projected, degrading, severity, summary,
    )


def _clean_chiller_kw_per_tr(points: list[dict]) -> list[float]:
    out: list[float] = []
    for p in points:
        if not p.get("is_running"):
            continue
        tr, kp = p.get("tr"), p.get("kw_per_tr")
        if tr is None or kp is None:
            continue
        try:
            if float(tr) >= _MIN_VALID_TR:
                out.append(float(kp))
        except (TypeError, ValueError):
            continue
    return out


def _clean_chiller_approach(points: list[dict]) -> list[float]:
    out: list[float] = []
    for p in points:
        if not p.get("is_running"):
            continue
        cl, ce = p.get("cond_leaving_temp"), p.get("cond_entering_temp")
        if cl is None or ce is None:
            continue
        try:
            out.append(float(cl) - float(ce))
        except (TypeError, ValueError):
            continue
    return out


def analyze_chiller_degradation(
    equipment_id: str,
    name: str,
    points: list[dict],
    bucket_secs: int = 900,
) -> list[DriftSignal]:
    """Run drift detection on a chiller's efficiency and condenser-approach trends.

    `points` are chronological aggregated buckets (oldest → newest)."""
    signals = [
        detect_drift(
            equipment_id, name, "kw_per_tr",
            _clean_chiller_kw_per_tr(points),
            threshold=BENCHMARK_POOR, bucket_secs=bucket_secs,
        ),
        detect_drift(
            equipment_id, name, "condenser_approach",
            _clean_chiller_approach(points),
            threshold=APPROACH_WARN, bucket_secs=bucket_secs,
        ),
    ]
    return signals
