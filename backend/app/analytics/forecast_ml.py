"""ML-backed energy forecaster (Holt-Winters triple exponential smoothing).

A real time-series model — not the hour-of-day heuristic in `forecast.py`.
It captures:
  * level   (current value)
  * trend   (drift over the window)
  * seasonality (period=24h — matches the dominant HVAC cycle)

When the series is too short / too constant for HW to fit (statsmodels
raises), we degrade gracefully to the heuristic so the endpoint is
never down.

Why Holt-Winters (and not Chronos / Prophet)
--------------------------------------------
Holt-Winters fits in milliseconds on a 7-day hourly window, ships in
statsmodels (already ~30 MB total with scipy / pandas), and produces
proper analytical prediction intervals. Chronos / TimesFM would do
better at long horizons but cost a 150–500 MB model download. This is
the right v0 ML; foundation models stay queued.
"""
from __future__ import annotations

import logging
import warnings
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from app.analytics.forecast import (
    FORECAST_METRICS,  # noqa: F401 — re-exported for callers
    ForecastPoint,
    ForecastResult,
    forecast_metric as _forecast_heuristic,
)

log = logging.getLogger("analytics.forecast_ml")

_MIN_HISTORY_POINTS = 48        # ~2 days at 1h resolution; below this HW won't converge
_SEASONAL_PERIODS   = 24        # daily seasonality


def _to_hourly_series(rows: list[dict], metric: str) -> list[tuple[datetime, float]]:
    """Compact rows into one (timestamp, value) per hour, keeping only running points."""
    by_hour: dict[datetime, list[float]] = defaultdict(list)
    for row in rows:
        val = row.get(metric)
        if val is None:
            continue
        # Treat is_running absence as "include" so this works for towers/pumps
        if "is_running" in row and row["is_running"] is not None and not row["is_running"]:
            continue
        ts = row.get("slot_time")
        if isinstance(ts, str):
            try:    ts = datetime.fromisoformat(ts)
            except ValueError: continue
        if not isinstance(ts, datetime):
            continue
        hour = ts.replace(minute=0, second=0, microsecond=0)
        by_hour[hour].append(float(val))
    # Average within each hour
    pts = sorted([(h, sum(v) / len(v)) for h, v in by_hour.items()])
    return pts


def _fit_holt_winters(values, periods: int):
    """Fit Holt-Winters and return (forecast_array, lower, upper, label).

    Falls back through three strategies in order of "fits the data best":
      1. additive trend + additive seasonal
      2. additive trend, no seasonal
      3. simple exponential smoothing
    Returns None when even the simplest model can't fit."""
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    import numpy as np

    n = len(values)
    seasonal_periods = _SEASONAL_PERIODS if n >= _SEASONAL_PERIODS * 2 else None

    # Use DAMPED trend so the model doesn't extrapolate forever.
    # Without damping HW will project the early-window trend forever,
    # producing predictions far outside the historical range over a
    # 24-hour horizon.
    candidates = []
    if seasonal_periods:
        candidates.append({
            "label": "HW additive (damped trend + seasonal-24h)",
            "kwargs": dict(trend="add", seasonal="add", seasonal_periods=seasonal_periods, damped_trend=True),
        })
    candidates.append({"label": "Holt linear (damped trend, no seasonal)",
                       "kwargs": dict(trend="add", seasonal=None, damped_trend=True)})
    candidates.append({"label": "Simple exponential smoothing",
                       "kwargs": dict(trend=None, seasonal=None)})

    last_exc: Exception | None = None
    for cand in candidates:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = ExponentialSmoothing(values, **cand["kwargs"], initialization_method="estimated")
                fit = model.fit(optimized=True)
            forecast = fit.forecast(periods)
            # Residual-based ±1 σ band (~68% CI). statsmodels returns
            # one-step-ahead residuals via fit.resid.
            try:
                resid_std = float(np.nanstd(np.asarray(fit.resid)))
            except Exception:
                resid_std = float(np.nanstd(values)) * 0.25
            if not np.isfinite(resid_std) or resid_std == 0:
                resid_std = float(np.nanstd(values)) * 0.15 or 0.05
            return np.asarray(forecast), resid_std, cand["label"]
        except Exception as exc:
            last_exc = exc
            continue
    log.warning("forecast_ml_all_models_failed err=%s", last_exc)
    return None


def forecast_metric_ml(
    rows: list[dict],
    metric: str,
    horizon_hours: int = 24,
    equipment_id: str = "",
) -> ForecastResult:
    """ML-backed forecast. On failure, returns the heuristic forecast."""
    series = _to_hourly_series(rows, metric)
    if len(series) < _MIN_HISTORY_POINTS:
        # Not enough history for HW — fall back transparently
        result = _forecast_heuristic(rows, metric, horizon_hours=horizon_hours, equipment_id=equipment_id)
        if result.note:
            result.note = "Backend: heuristic (insufficient history for ML). " + result.note
        else:
            result.note = "Backend: heuristic (insufficient history for ML)."
        return result

    raw_values = [v for _, v in series]
    last_ts    = series[-1][0]

    # Robust outlier handling — telemetry has chiller-startup transients
    # (e.g. kw_per_tr briefly spikes to >100 because tr is near zero while
    # kw ramps). Clamp the training series to the 2nd–98th percentile
    # *of the running values*, and base the prediction-clip range on the
    # 5th–95th percentile (with a ±25% buffer). This stops HW from being
    # thrown by transient spikes without losing real operational range.
    import statistics
    sorted_vals = sorted(raw_values)
    def _pct(p): return sorted_vals[max(0, min(len(sorted_vals) - 1, int(len(sorted_vals) * p)))]
    p2, p98 = _pct(0.02), _pct(0.98)
    p5, p95 = _pct(0.05), _pct(0.95)

    values = [min(max(v, p2), p98) for v in raw_values]

    spread  = max(p95 - p5, abs(p95) * 0.1, 1e-6)
    clip_lo = p5  - 0.25 * spread
    clip_hi = p95 + 0.25 * spread

    fitted = _fit_holt_winters(values, horizon_hours)
    if fitted is None:
        result = _forecast_heuristic(rows, metric, horizon_hours=horizon_hours, equipment_id=equipment_id)
        result.note = ("Backend: heuristic (Holt-Winters fit failed). " + result.note).strip()
        return result

    forecast, resid_std, label = fitted
    # Cap residual stdev to historical spread so the CI band stays believable.
    if resid_std > spread:
        resid_std = spread * 0.5
    points: list[ForecastPoint] = []
    for h in range(horizon_hours):
        future = last_ts + timedelta(hours=h + 1)
        mu = float(forecast[h])
        # Clip to the sane range
        mu = min(max(mu, clip_lo), clip_hi)
        # Widen band modestly with horizon (sqrt(h))
        scale = (1.0 + (h + 1) ** 0.5 / 8.0)
        sigma = resid_std * scale
        # Confidence: high for the first 12h, medium 12-24, low beyond
        confidence = "high" if h < 12 else "medium" if h < 24 else "low"
        points.append(ForecastPoint(
            hour_label  = future.strftime("%Y-%m-%d %H:00"),
            hour_of_day = future.hour,
            predicted   = round(mu, 3),
            lower       = round(max(clip_lo, mu - sigma), 3),
            upper       = round(min(clip_hi, mu + sigma), 3),
            confidence  = confidence,
        ))

    return ForecastResult(
        equipment_id  = equipment_id,
        metric        = metric,
        horizon_hours = horizon_hours,
        generated_at  = datetime.utcnow().isoformat(),
        points        = points,
        note          = f"Backend: {label}. Fit on {len(values)} hourly observations.",
    )


# ── Expanded metric allowlist for the ML backend ─────────────────────────────
# The heuristic allowed only a few. With HW we can forecast any numeric series
# that exists in the schema.
ML_FORECAST_METRICS: dict[str, list[str]] = {
    "chiller": [
        "kw_per_tr", "kw", "tr", "chiller_load",
        "evap_entering_temp", "evap_leaving_temp", "chw_delta_t",
        "cond_entering_temp", "cond_leaving_temp", "ambient_temp",
        "kwh", "trh",
    ],
    "cooling_tower": ["kw", "kwh", "cumulative_kwh", "run_hours"],
    "pump":          ["kw", "kwh", "cumulative_kwh", "run_hours"],
}
