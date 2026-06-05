"""
Fault-injection unit tests for the z-score anomaly detector.

These exercise `compute_baseline` and `detect_anomalies` in isolation — no DB,
no LLM, no network. They pin the one piece of logic that decides "something is
wrong": given a known baseline and an injected fault, the detector must flag it
with the right severity, and must stay silent on clean / sparse data.

Baseline construction trick: five 9s + five 11s gives mean=10.0, std=1.0
exactly, so injected values map to predictable z-scores (z = value - 10).
"""
import pytest

from app.analytics.anomaly import (
    Z_THRESHOLD,
    MIN_SAMPLES,
    AnomalyEvent,
    compute_baseline,
    detect_anomalies,
)

METRIC = "kw_per_tr"


def _baseline_rows(metric: str = METRIC) -> list[dict]:
    """10 rows → mean=10.0, std=1.0 for `metric`."""
    vals = [9, 11] * 5
    return [{"slot_time": f"2026-06-04T00:{i:02d}:00", metric: v} for i, v in enumerate(vals)]


def _row(value, hour=14, minute=0, metric: str = METRIC) -> dict:
    return {"slot_time": f"2026-06-04T{hour:02d}:{minute:02d}:00", metric: value}


# --------------------------------------------------------------------------- #
# compute_baseline
# --------------------------------------------------------------------------- #

def test_baseline_mean_and_std_are_correct():
    base = compute_baseline(_baseline_rows(), METRIC)
    assert base is not None
    assert base.mean == 10.0
    assert base.std == 1.0
    assert base.count == 10


def test_baseline_skips_none_values():
    rows = _baseline_rows() + [{"slot_time": "x", METRIC: None}] * 3
    base = compute_baseline(rows, METRIC)
    assert base is not None
    assert base.count == 10  # the 3 None rows are excluded


def test_baseline_returns_none_below_min_samples():
    rows = _baseline_rows()[: MIN_SAMPLES - 1]
    assert compute_baseline(rows, METRIC) is None


# --------------------------------------------------------------------------- #
# detect_anomalies — positive faults
# --------------------------------------------------------------------------- #

def test_spike_50pct_above_baseline_is_critical():
    """kw_per_tr jumps ~50% above a baseline mean of 10 → z=5 → critical."""
    events = detect_anomalies(
        "chiller_1", rows=[_row(15.0)], metrics=[METRIC], baseline_rows=_baseline_rows()
    )
    assert len(events) == 1
    ev = events[0]
    assert isinstance(ev, AnomalyEvent)
    assert ev.equipment_id == "chiller_1"
    assert ev.metric == METRIC
    assert ev.z_score == pytest.approx(5.0)
    assert ev.severity == "critical"          # z >= 2.5 * 1.5 = 3.75
    assert "above" in ev.description


def test_moderate_breach_is_warning_not_critical():
    """z = 3.0 clears the 2.5 trip line but stays under the 3.75 critical line."""
    events = detect_anomalies(
        "chiller_1", rows=[_row(13.0)], metrics=[METRIC], baseline_rows=_baseline_rows()
    )
    assert len(events) == 1
    assert events[0].z_score == pytest.approx(3.0)
    assert events[0].severity == "warning"


def test_drop_below_baseline_is_flagged_as_below():
    """Negative deviations are anomalies too."""
    events = detect_anomalies(
        "chiller_1", rows=[_row(5.0)], metrics=[METRIC], baseline_rows=_baseline_rows()
    )
    assert len(events) == 1
    assert events[0].z_score == pytest.approx(-5.0)
    assert events[0].severity == "critical"
    assert "below" in events[0].description


def test_value_just_below_threshold_is_not_flagged():
    """z = 2.4 sits under the 2.5σ trip line → silent."""
    events = detect_anomalies(
        "chiller_1", rows=[_row(12.4)], metrics=[METRIC], baseline_rows=_baseline_rows()
    )
    assert events == []


# --------------------------------------------------------------------------- #
# detect_anomalies — clean / degenerate data (no false positives)
# --------------------------------------------------------------------------- #

def test_flat_series_produces_no_events():
    """Zero-variance baseline (std < 1e-6) must be skipped, not divide-by-zero."""
    flat = [_row(10.0, minute=i) for i in range(MIN_SAMPLES + 2)]
    events = detect_anomalies("chiller_1", rows=flat, metrics=[METRIC])
    assert events == []


def test_sparse_data_without_baseline_produces_no_events():
    """Fewer than MIN_SAMPLES and no historical baseline → cannot judge → silent."""
    rows = [_row(15.0, minute=i) for i in range(MIN_SAMPLES - 1)]
    events = detect_anomalies("chiller_1", rows=rows, metrics=[METRIC])
    assert events == []


def test_none_value_in_detection_rows_is_skipped():
    rows = [_row(None), _row(15.0, minute=30)]
    events = detect_anomalies(
        "chiller_1", rows=rows, metrics=[METRIC], baseline_rows=_baseline_rows()
    )
    assert len(events) == 1
    assert events[0].value == pytest.approx(15.0)


def test_clean_value_within_baseline_is_silent():
    events = detect_anomalies(
        "chiller_1", rows=[_row(10.5)], metrics=[METRIC], baseline_rows=_baseline_rows()
    )
    assert events == []


# --------------------------------------------------------------------------- #
# detect_anomalies — dedup & ordering
# --------------------------------------------------------------------------- #

def test_dedup_keeps_most_extreme_per_metric_hour():
    """Two breaches in the same hour for one metric collapse to the worst one."""
    rows = [_row(13.0, hour=14, minute=0), _row(15.0, hour=14, minute=30)]
    events = detect_anomalies(
        "chiller_1", rows=rows, metrics=[METRIC], baseline_rows=_baseline_rows()
    )
    assert len(events) == 1
    assert events[0].value == pytest.approx(15.0)   # z=5 beats z=3
    assert events[0].z_score == pytest.approx(5.0)


def test_breaches_in_different_hours_are_kept_separately():
    rows = [_row(13.0, hour=14), _row(15.0, hour=15)]
    events = detect_anomalies(
        "chiller_1", rows=rows, metrics=[METRIC], baseline_rows=_baseline_rows()
    )
    assert len(events) == 2


def test_events_sorted_by_abs_z_descending():
    rows = [_row(13.0, hour=14), _row(16.0, hour=15), _row(14.0, hour=16)]
    events = detect_anomalies(
        "chiller_1", rows=rows, metrics=[METRIC], baseline_rows=_baseline_rows()
    )
    zs = [abs(e.z_score) for e in events]
    assert zs == sorted(zs, reverse=True)
    assert events[0].value == pytest.approx(16.0)


def test_threshold_constant_unchanged():
    """Guard against silent threshold drift — detection severity depends on it."""
    assert Z_THRESHOLD == 2.5
    assert MIN_SAMPLES == 10
