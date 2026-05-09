# THERMYNX — Data Dictionary

Quick reference to the `unicharm` MySQL tables THERMYNX reads. **Read-only, no writes ever.**

> Full DDL is in [`../unicharm_db_ddl.md`](../unicharm_db_ddl.md). This file is the curated subset we actually use.

## Source

- **Server:** MySQL `unicharm:3307` (Tailscale-reachable)
- **Database:** `unicharm`
- **Connection:** `mysql+aiomysql://ro_user:<pw>@<host>:3307/unicharm`
- **Privilege:** `SELECT` only on the listed tables (read-only credential)

## Use the `*_normalized` tables — never the raw ones

All normalized tables share a common shape:

| Column | Type | Notes |
|--------|------|-------|
| `slot_time` | TIMESTAMP UTC | bucket-aligned (1-minute or coarser per source) |
| `is_running` | TINYINT(1) | gate filter — only count "on" rows |
| `kw` | FLOAT | electrical input |
| *(equipment-specific)* | … | see per-table sections below |

**Indexes — verify or add:**

```sql
CREATE INDEX idx_{table}_slot_time ON {table}(slot_time);
CREATE INDEX idx_{table}_running   ON {table}(is_running, slot_time);
```

## Tables we actually query

### `chiller_1_normalized` / `chiller_2_normalized`

Per-minute chiller metrics — the **richest analytics surface**.

| Column | Unit | Meaning |
|--------|------|---------|
| `slot_time` | UTC ts | bucket alignment |
| `is_running` | 0 / 1 | drives gating in queries |
| `kw` | kW | electrical input |
| `tr` | TR | cooling delivered |
| `kw_per_tr` | kW/TR | **efficiency — primary KPI** |
| `chw_supply_temp` | °C | chilled water supply (leaving evap) |
| `chw_return_temp` | °C | chilled water return (entering evap) |
| `chw_delta_t` | °C | return − supply; low ΔT signals problems |
| `cond_supply_temp` | °C | condenser water supply |
| `cond_return_temp` | °C | condenser water return |
| `chiller_load` | % | % of design capacity |

### `cooling_tower_1_normalized` / `cooling_tower_2_normalized`

Cooling tower fan metrics.

| Column | Unit | Meaning |
|--------|------|---------|
| `slot_time` | UTC ts | |
| `is_running` | 0 / 1 | fan on/off |
| `fan_kw` | kW | fan electrical input |
| `cell_count` | int | active cells |
| `wet_bulb_c` | °C | ambient wet-bulb (drives staging optimization) |

### `condenser_pump_0102_normalized` / `condenser_pump_03_normalized`

Pump metrics.

| Column | Unit | Meaning |
|--------|------|---------|
| `slot_time` | UTC ts | |
| `is_running` | 0 / 1 | pump on/off |
| `kw` | kW | pump electrical input |

### AHU / secondary pump tables

*Add columns as available.* Same `slot_time` + `is_running` + `kw` pattern.

## Tables to NEVER query

- `*_metric` — raw vendor exports (varying schemas, unstable)
- `*_om_p` — operations parameters (also raw)

These feed normalization upstream. THERMYNX uses **only** the normalized tables — anything else is a bug.

## Efficiency benchmarks (used in prompts)

| Band | kW/TR threshold | Colour |
|------|-----------------|--------|
| Good | < 0.65 | 🟢 |
| Acceptable | 0.65 – 0.85 | 🟡 |
| Poor | > 0.85 | 🔴 |

These are baked into `analyzer_v1` and `efficiency_v1` prompts (see [`PROMPTS.md`](./PROMPTS.md)).

## Common query patterns

### Last 24 h, 5-min resolution, only running periods

```sql
SELECT
  FROM_UNIXTIME(UNIX_TIMESTAMP(slot_time) - (UNIX_TIMESTAMP(slot_time) MOD 300)) AS bucket,
  AVG(kw) AS kw,
  AVG(kw_per_tr) AS kw_per_tr,
  AVG(chw_delta_t) AS chw_delta_t
FROM chiller_1_normalized
WHERE is_running = 1
  AND slot_time >= NOW() - INTERVAL 24 HOUR
GROUP BY bucket
ORDER BY bucket;
```

### Compare two chillers in same window

```sql
SELECT 'chiller_1' AS eq, slot_time, kw_per_tr
FROM chiller_1_normalized
WHERE slot_time BETWEEN ? AND ? AND is_running = 1
UNION ALL
SELECT 'chiller_2' AS eq, slot_time, kw_per_tr
FROM chiller_2_normalized
WHERE slot_time BETWEEN ? AND ? AND is_running = 1
ORDER BY slot_time, eq;
```

### Hourly stats for rollup job (Phase 2)

```sql
SELECT
  DATE_FORMAT(slot_time, '%Y-%m-%d %H:00:00') AS hour_bucket,
  AVG(kw) AS kw_avg,
  MAX(kw) AS kw_max,
  AVG(kw_per_tr) AS kw_per_tr_avg,
  SUM(is_running) AS run_minutes,
  AVG(chiller_load) AS load_avg
FROM chiller_1_normalized
WHERE slot_time >= NOW() - INTERVAL 1 HOUR
GROUP BY hour_bucket;
```

### Detect anomalies — z-score against hour-of-day baseline (Phase 2)

```python
# In Python, not SQL — domain logic in app/analytics/anomaly.py
recent = await fetch_window(eq, last_60min, res="1m")
baseline = await get_baseline(eq, metric="kw_per_tr", hour=now.hour)
z = (recent.mean() - baseline.mean) / baseline.stddev
if z > 3:
    persist_anomaly(...)
```

## Where THERMYNX writes

THERMYNX **never** writes back to `unicharm`. All writes go to the separate Postgres `thermynx_app` DB (audit, threads, anomalies, rollups, embeddings) — see [`ARCHITECTURE.md` §6](./ARCHITECTURE.md#6-database-erd--thermynx_app) for the ERD.
