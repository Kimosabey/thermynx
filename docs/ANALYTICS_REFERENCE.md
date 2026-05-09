# THERMYNX — Analytics Reference

All analytics live in `backend/app/analytics/` as **pure functions** — no database calls, no side effects. This makes them trivially unit-testable and reusable from both API endpoints and the background anomaly scan job.

---

## 1. Efficiency Analysis

**File:** [`backend/app/analytics/efficiency.py`](../backend/app/analytics/efficiency.py)

### kW/TR — What It Is

**kW/TR** (kilowatts per ton of refrigeration) is the primary efficiency metric for chillers. Lower is better. It represents how much electrical power is consumed to deliver one ton of cooling.

```
kW/TR = Active Power (kW) / Cooling Output (TR)
```

A new, well-maintained chiller at full load typically achieves 0.55–0.65 kW/TR. Values above 0.85 indicate a significant problem.

---

### Efficiency Bands

| Band | kW/TR Range | Meaning |
|------|-------------|---------|
| `excellent` | < 0.55 | Operating better than design — unusual, may indicate low load |
| `good` | 0.55 – 0.65 | At or near design efficiency |
| `fair` | 0.65 – 0.75 | 10–15% above design — investigate loss drivers |
| `poor` | 0.75 – 0.85 | 15–30% above design — maintenance action needed |
| `critical` | ≥ 0.85 | >30% above design — urgent intervention required |

Thresholds are defined in `efficiency.py` constants and are configurable via `EFFICIENCY_THRESHOLDS` (future work — see `FLAWS_AND_IMPROVEMENT_PLAN.md` §P2-1).

---

### Delta vs Design

```
delta_vs_design_pct = ((kw_per_tr_actual - design_kw_per_tr) / design_kw_per_tr) × 100
```

A positive delta means the chiller is less efficient than its design point. Design point (`design_kw_per_tr`) comes from the equipment catalog in `equipment.py`.

---

### Loss Drivers

The efficiency module identifies likely causes when efficiency is above the `good` band:

| Loss Driver | Detection Logic |
|-------------|----------------|
| `high_approach_temp` | Cooling tower approach temp > 4°C (cond_entering_temp − ambient_temp is high) |
| `part_load_operation` | `chiller_load` < 40% — chillers are inefficient at low load |
| `low_delta_t` | `chw_delta_t` < 5°C — low chilled water temperature differential (distribution problem) |
| `high_condenser_temp` | `cond_entering_temp` > 32°C — hot condenser water entering the chiller |
| `degraded_refrigerant` | kW/TR trending up over 7+ days with no load change |

Multiple drivers can be active simultaneously.

---

## 2. Anomaly Detection

**File:** [`backend/app/analytics/anomaly.py`](../backend/app/analytics/anomaly.py)

### Z-Score Method

Anomalies are detected using a **z-score** against a 72-hour rolling baseline:

```
z = (current_value − baseline_mean) / baseline_std_dev
```

Where:
- `baseline_mean` = mean of the metric over the past 72 hours
- `baseline_std_dev` = standard deviation over the past 72 hours
- `current_value` = the most recent reading

---

### Thresholds

| Z-Score | Severity |
|---------|----------|
| z < 3.0 | Normal — no event |
| 3.0 ≤ z < 4.0 | `warning` |
| z ≥ 4.0 | `critical` |

Constants in `anomaly.py`:
```python
Z_THRESHOLD = 3.0    # minimum z-score to flag
MIN_SAMPLES = 10     # minimum baseline data points required
```

If `MIN_SAMPLES` is not met (equipment was off for most of the 72h window), no anomaly is raised for that metric.

---

### Monitored Metrics (per equipment type)

**Chillers:** `kw`, `kw_per_tr`, `chw_delta_t`, `cond_entering_temp`, `chiller_load`

**Cooling towers:** `kw`

**Pumps:** `kw`

---

### Background Scan

The anomaly scan job (`backend/app/jobs/anomaly_scan.py`) runs every 5 minutes via APScheduler:

1. Fetches the last 60 minutes of data for each equipment
2. Fetches the 72-hour baseline for each equipment
3. Runs `detect_anomalies()` for each
4. Persists new events to the `anomalies` table with `ON CONFLICT DO NOTHING` (deduplication by equipment + metric + time bucket)

---

## 3. Forecast

**File:** [`backend/app/analytics/forecast.py`](../backend/app/analytics/forecast.py)

### Current Method: Linear Trend Extrapolation

The forecast uses a **linear regression slope** over the historical window to project future values:

```
slope = (y[-1] - y[0]) / window_hours   # kW/TR per hour
forecast[t] = last_known_value + slope × t_hours_ahead
```

Confidence interval uses a fixed ±15% band around the projected value (placeholder — proper CI requires residual std from regression).

---

### Outputs

| Field | Description |
|-------|-------------|
| `trend` | `stable` / `improving` / `degrading` based on slope sign and magnitude |
| `slope_per_day` | Efficiency change per calendar day |
| `days_to_poor_band` | Projected time until kW/TR crosses 0.85 (null if not degrading) |
| `forecast_points` | Array of `{ts, value, ci_low, ci_high}` for the horizon |

---

### Limitations

- Linear extrapolation does not capture diurnal patterns (morning startup, afternoon peak, overnight standby)
- 30-day projections can be significantly wrong if load profile changes
- Seasonal effects (monsoon wet-bulb changes, summer ambient) are not modelled

See `FLAWS_AND_IMPROVEMENT_PLAN.md` §P2-2 for the planned upgrade to seasonal decomposition.

---

## 4. Cost Analysis

**File:** [`backend/app/analytics/cost.py`](../backend/app/analytics/cost.py)

### Calculation

```
energy_kwh = sum(kw_avg × bucket_duration_hours)   # summed over all time buckets
cost_inr   = energy_kwh × tariff_inr_per_kwh
```

Where:
- `kw_avg` is the average kW in each 15-minute bucket from the MySQL timeseries
- `tariff_inr_per_kwh` defaults to 8.5 from `TARIFF_INR_PER_KWH` env var, overridable per request

**Share percentage:**
```
share_pct = (equipment_kwh / total_kwh) × 100
```

---

### Limitation: Flat Tariff

The current model uses a single blended tariff for all hours. Indian commercial tariffs are time-of-use (ToU): peak hours (typically 18:00–22:00 IST) cost 2–3× off-peak. This means:

- Cost is **underestimated** for evening peak hours
- Cost is **overestimated** for off-peak hours
- Optimisation recommendations based on cost may be inaccurate

See `FLAWS_AND_IMPROVEMENT_PLAN.md` §P2-9 for the planned ToU tariff upgrade.

---

## 5. Maintenance Analysis

**File:** [`backend/app/analytics/maintenance.py`](../backend/app/analytics/maintenance.py)

### Run Hours

```
run_hours = sum(is_running × bucket_duration_hours)
```

### Cycles

A **cycle** is counted each time the equipment transitions from `is_running=0` to `is_running=1`. High cycle counts indicate start/stop behaviour that stresses compressors and motor starters.

### Wear Estimate

```
wear_pct = (run_hours / PM_INTERVAL_HOURS) × 100   # PM_INTERVAL_HOURS = 2000
```

Capped at 100%. When `wear_pct > 90`, the recommendation flags urgent maintenance.

### Health Score

A composite 0–100 score:
```
health_score = 100
             − (wear_pct × 0.4)           # run hours component
             − (cycles_penalty × 0.2)     # excessive cycling
             − (efficiency_delta × 0.4)   # kW/TR above design
```

Clamped to [0, 100]. Graded: A (≥80), B (60–79), C (40–59), D (<40).

---

## 6. Cooling Tower Optimisation

**File:** [`backend/app/analytics/tower_optimizer.py`](../backend/app/analytics/tower_optimizer.py)

### Approach Temperature

```
approach_temp = wet_bulb_temp − condenser_leaving_temp
```

Ideal approach temperature: ≤ 3°C. Values > 5°C indicate fouling or insufficient airflow.

> Note: `wet_bulb_temp` is not currently included in `COOLING_TOWER_COLS` in this deployment. The fouling detection falls back to estimating approach from condenser water temperatures only.

### Fouling Detection

Fouling is flagged when kW/TR is elevated and approach temperature is high simultaneously, suggesting reduced heat transfer in the tower fill.

### Setpoint Recommendation

The optimizer suggests a condenser water leaving temperature setpoint based on:
- Current wet-bulb temperature (or ambient proxy)
- Current load
- Number of cells operating

This is a read-only recommendation — THERMYNX does not write to any BMS or actuator.
