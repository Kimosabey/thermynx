"""Unit tests for the predictive degradation / drift detector.

Pure logic — no DB, no LLM. Pins the trend math that decides whether a PM work
order should be proposed before failure.
"""
from app.analytics.degradation import detect_drift, _slope_per_day

POOR = 0.85
H = 3600  # hourly buckets → 24 samples = 1 day, easy to reason about slope


def _linspace(a, b, n):
    return [a + (b - a) * i / (n - 1) for i in range(n)]


def test_flat_series_is_not_degrading():
    s = detect_drift("chiller_1", "Chiller 1", "kw_per_tr", [0.62] * 24, threshold=POOR, bucket_secs=H)
    assert s.degrading is False
    assert s.severity == "none"
    assert s.slope_per_day == 0.0 or abs(s.slope_per_day) < 1e-6


def test_rising_series_flags_warning_with_projection():
    # 0.60 → 0.80 over 24 hourly buckets (1 day) → ~0.20/day, crosses 0.85 soon.
    s = detect_drift("chiller_1", "Chiller 1", "kw_per_tr", _linspace(0.60, 0.80, 24), threshold=POOR, bucket_secs=H)
    assert s.degrading is True
    assert s.pct_change > 3.0
    assert s.slope_per_day > 0
    assert s.late_avg > s.early_avg
    assert s.projected_days_to_threshold is not None
    assert s.severity in ("warning", "watch")


def test_already_over_and_rising_is_critical():
    s = detect_drift("chiller_2", "Chiller 2", "kw_per_tr", _linspace(0.83, 0.95, 24), threshold=POOR, bucket_secs=H)
    assert s.late_avg >= POOR
    assert s.severity == "critical"
    assert s.degrading is True


def test_improving_series_is_not_degrading():
    # efficiency getting BETTER (falling kw/TR) must never flag degradation
    s = detect_drift("chiller_1", "Chiller 1", "kw_per_tr", _linspace(0.80, 0.60, 24), threshold=POOR, bucket_secs=H)
    assert s.degrading is False
    assert s.slope_per_day < 0


def test_insufficient_samples_returns_none():
    s = detect_drift("chiller_1", "Chiller 1", "kw_per_tr", [0.6, 0.7, 0.8], threshold=POOR, bucket_secs=H)
    assert s.severity == "none"
    assert s.degrading is False
    assert "enough" in s.summary.lower()


def test_slope_per_day_units():
    # +0.01 per hourly bucket → +0.24 per day
    vals = [0.5 + 0.01 * i for i in range(24)]
    assert _slope_per_day(vals, H) == round(0.24, 5) or abs(_slope_per_day(vals, H) - 0.24) < 1e-6
