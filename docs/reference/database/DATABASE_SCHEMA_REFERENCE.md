# Graylinx — Database schema reference

Single FYI document for **where data lives**, **what columns exist**, and **how the backend uses them**. Regenerate column lists after major DDL changes using the commands at the end.

---

## 1. Two databases

| Database | Engine | Role | Graylinx access |
|----------|--------|------|-----------------|
| **`unicharm`** | MySQL 8 | Facility telemetry (normalized HVAC series + vendor tables) | **Read-only** (`SELECT`). Connection: `mysql+aiomysql://…` via [`backend/app/db/session.py`](../../backend/app/db/session.py). |
| **`thermynx_app`** | PostgreSQL 16 | App state (audit, anomalies, agents, threads) | **Read/write**. Connection: `POSTGRES_URL` in `.env`. Tables created by SQLAlchemy `Base.metadata.create_all` at startup. |

> Credentials live in `backend/.env` — never commit real passwords. See [`.env.example`](../../.env.example).

---

## 2. MySQL `unicharm` — tables Graylinx queries

### 2.1 Equipment catalog → normalized table map

Defined in [`backend/app/domain/equipment.py`](../../backend/app/domain/equipment.py):

| Equipment ID | Logical name | MySQL table |
|--------------|--------------|-------------|
| `chiller_1` | Chiller 1 | `chiller_1_normalized` |
| `chiller_2` | Chiller 2 | `chiller_2_normalized` |
| `cooling_tower_1` | Cooling Tower 1 | `cooling_tower_1_normalized` |
| `cooling_tower_2` | Cooling Tower 2 | `cooling_tower_2_normalized` |
| `condenser_pump_1` | Condenser Pump 1-2 | `condenser_pump_0102_normalized` |
| `condenser_pump_3` | Condenser Pump 3 | `condenser_pump_03_normalized` |

### 2.2 Column subsets used in code ([`telemetry.py`](../../backend/app/db/telemetry.py))

These are the **`SELECT` lists** the API uses (not every physical column):

**Chillers — `CHILLER_COLS`**

`slot_time`, `is_running`, `kw`, `tr`, `kw_per_tr`, `evap_entering_temp`, `evap_leaving_temp`, `chw_delta_t`, `cond_entering_temp`, `cond_leaving_temp`, `ambient_temp`, `chiller_load`, `kwh`, `trh`

**Cooling towers — `COOLING_TOWER_COLS`**

`slot_time`, `is_running`, `kw`, `kwh`, `cumulative_kwh`, `run_hours`

> Normalized **tower** tables do **not** include ambient wet-bulb or cell-count columns in this deployment. Wet-bulb on **chillers** exists as `wet_bulb_temp` (see §2.3) but is **not** yet in `CHILLER_COLS`.

**Pumps — `PUMP_COLS`**

`slot_time`, `is_running`, `kw`, `kwh`, `cumulative_kwh`, `run_hours`

Aggregated timeseries / maintenance / cost use **`fetch_bucket_series()`** with the same underlying columns plus SQL `AVG(...)`, `MAX(is_running)` per time bucket.

---

## 3. MySQL `unicharm` — full column layouts (verified)

Introspection snapshot from:

`mysql -h <host> -P 3307 -u <user> -p -D unicharm`

*(Replace host/user/password with `backend/.env`.)*

### 3.1 `chiller_1_normalized` / `chiller_2_normalized`

Same schema for both.

| Column | Type | Null | Key | Notes |
|--------|------|------|-----|--------|
| `id` | bigint unsigned | NO | PRI | auto_increment |
| `ss_id` | varchar(36) | NO | | Device UUID |
| `slot_time` | datetime | NO | UNI | Bucket end time |
| `is_running` | tinyint(1) | NO | | 1 = running |
| `kw` | decimal(10,4) | YES | | Electrical input |
| `evap_entering_temp` | decimal(10,4) | YES | | |
| `evap_leaving_temp` | decimal(10,4) | YES | | |
| `evap_flow` | decimal(10,4) | YES | | |
| `run_hours` | decimal(10,4) | YES | | |
| `cond_entering_temp` | decimal(10,4) | YES | | |
| `cond_leaving_temp` | decimal(10,4) | YES | | |
| `cond_flow` | decimal(10,4) | YES | | |
| `ambient_temp` | decimal(10,4) | YES | | |
| `humidity_monitoring` | decimal(10,4) | YES | | |
| `btu_inlet_temp` | decimal(10,4) | YES | | |
| `btu_outlet_temp` | decimal(10,4) | YES | | |
| `chw_delta_t` | decimal(10,4) | YES | | CHW ΔT |
| `tr` | decimal(10,4) | YES | | Cooling load (TR) |
| `kwh` | decimal(10,4) | YES | | Interval energy |
| `trh` | decimal(10,4) | YES | | TR·h |
| `cumulative_kwh` | decimal(20,4) | YES | | |
| `cumulative_trh` | decimal(20,4) | YES | | |
| `kw_per_tr` | decimal(10,4) | YES | | Efficiency KPI |
| `btu_delta_t` | decimal(10,4) | YES | | |
| **`wet_bulb_temp`** | decimal(10,4) | YES | | Present on **chiller** rows; optional future SELECT |
| `chiller_load` | decimal(10,4) | YES | | % load |
| `created_at` | datetime | NO | | DEFAULT CURRENT_TIMESTAMP |

### 3.2 `cooling_tower_1_normalized` / `cooling_tower_2_normalized`

Same schema for both. **No** `wet_bulb_c` / `wet_bulb_temp` / `cell_count`.

| Column | Type | Null | Key |
|--------|------|------|-----|
| `id` | bigint unsigned | NO | PRI |
| `ss_id` | varchar(36) | NO | |
| `slot_time` | datetime | NO | UNI |
| `is_running` | tinyint(1) | NO | |
| `fan1_kw` | decimal(10,4) | YES | |
| `fan2_kw` | decimal(10,4) | YES | |
| `fan3_kw` | decimal(10,4) | YES | |
| `F1_run_hours` | decimal(10,4) | YES | |
| `F2_run_hours` | decimal(10,4) | YES | |
| `F3_run_hours` | decimal(10,4) | YES | |
| **`kw`** | decimal(10,4) | YES | | Sum of fan powers |
| `fan1_kwh` | decimal(10,4) | YES | |
| `fan2_kwh` | decimal(10,4) | YES | |
| `fan3_kwh` | decimal(10,4) | YES | |
| **`kwh`** | decimal(10,4) | YES | |
| **`cumulative_kwh`** | decimal(20,4) | YES | |
| `cumulative_fan1_kwh` | decimal(20,4) | YES | |
| `cumulative_fan2_kwh` | decimal(20,4) | YES | |
| `cumulative_fan3_kwh` | decimal(20,4) | YES | |
| **`run_hours`** | decimal(10,4) | YES | |
| `created_at` | datetime | NO | |

### 3.3 `condenser_pump_0102_normalized` / `condenser_pump_03_normalized`

| Column | Type | Null | Key |
|--------|------|------|-----|
| `id` | bigint unsigned | NO | PRI |
| `ss_id` | varchar(36) | NO | |
| `slot_time` | datetime | NO | UNI |
| `is_running` | tinyint(1) | NO | |
| `kw` | decimal(10,4) | YES | |
| `kwh` | decimal(10,4) | YES | |
| `cumulative_kwh` | decimal(20,4) | YES | |
| `run_hours` | decimal(10,4) | YES | |
| `created_at` | datetime | NO | |

### 3.4 Other normalized tables (exist in DB; **not** in Graylinx catalog yet)

**`plant_normalized`** — plant-level rollup row per bucket.

| Column | Type |
|--------|------|
| `id` | bigint unsigned PRI |
| `slot_time` | datetime UNI |
| `total_kw`, `total_kwh`, `cumulative_kwh`, `total_tr`, `total_trh`, `cumulative_trh`, `aux_kw`, `aux_kwh` | decimal |
| `created_at` | datetime |

**`primary_pump_1_normalized`**, **`primary_pump_2_normalized`**, **`primary_pump_3_normalized`** — same shape as each other:

| Column | Type |
|--------|------|
| `id`, `ss_id`, `slot_time` (UNI), `is_running`, `kw`, `run_hours`, `kwh`, `cumulative_kwh`, `created_at` | |

---

## 4. MySQL `unicharm` — tables Graylinx does **not** query

Per product rules, Graylinx uses **only** `*_normalized` telemetry surfaces for HVAC analytics — **not** raw vendor exports:

- **Avoid:** `*_metric`, `*_om_p` (variable schemas; normalization upstream).
- **Avoid:** IBMS / user / schedule / GL-* operational tables unless a future feature explicitly scopes read-only access.

The database also contains many facility tables (`building`, `floor`, `zone`, `device`, analytics aggregates, etc.). They are **out of scope** for the current POC unless documented in a new integration story.

---

## 5. PostgreSQL `thermynx_app` — application tables

Created/managed by [`backend/app/db/models.py`](../../backend/app/db/models.py). Verified layout (`psql \d`):

### 5.1 `analysis_audit`

| Column | Type | Nullable |
|--------|------|----------|
| `id` | varchar | NO |
| `equipment_id` | varchar(64) | YES |
| `time_range_hours` | integer | YES |
| `question` | text | NO |
| `prompt_hash` | varchar(64) | YES |
| `response_hash` | varchar(64) | YES |
| `model` | varchar(64) | NO |
| `tokens_estimated` | integer | YES |
| `total_ms` | integer | YES |
| `status` | varchar(20) | NO |
| `request_id` | varchar(64) | YES |
| `created_at` | timestamp | NO (default now) |

**Purpose:** One row per `POST /api/v1/analyze` (streaming lifecycle).

### 5.2 `anomalies`

| Column | Type |
|--------|------|
| `id`, `equipment_id`, `metric`, `started_at`, `severity` | varchar |
| `value`, `baseline_mean`, `baseline_std`, `z_score` | float |
| `description`, `narrative` | text |
| `created_at` | timestamp |

**Purpose:** Persisted z-score events from the APScheduler anomaly job.

### 5.3 `agent_runs`

| Column | Type |
|--------|------|
| `id`, `mode`, `status`, `model`, `request_id` | varchar |
| `goal`, `context_json`, `final_output` | text |
| `steps_taken`, `total_ms` | integer |
| `created_at` | timestamp |

**Purpose:** AI Agent hub runs (`POST /api/v1/agent/...`).

### 5.4 `threads`

| Column | Type |
|--------|------|
| `id` | varchar (PK) |
| `title` | varchar(512) |
| `created_at`, `updated_at` | timestamp |

### 5.5 `messages`

| Column | Type |
|--------|------|
| `id` | varchar (PK) |
| `thread_id` | varchar (indexed; FK to `threads.id` in ORM) |
| `role` | varchar(16) (`user` / `assistant`) |
| `content` | text |
| `created_at` | timestamp |

**Purpose:** Conversational memory for the analyzer when `thread_id` is sent.

---

## 6. Operational checks

### Data freshness (MySQL)

```sql
SELECT COUNT(*) AS n, MIN(slot_time), MAX(slot_time)
FROM chiller_1_normalized;
```

If `MAX(slot_time)` is far behind wall-clock, dashboards and “last 24h” queries will look empty — fix **upstream ETL** into `*_normalized`.

### Postgres connectivity

```bash
docker compose exec postgres psql -U thermynx -d thermynx_app -c "\dt"
```

---

## 7. Related docs

| Doc | Purpose |
|-----|---------|
| [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md) | Curated metric meanings & SQL patterns |
| [`RUNBOOK.md`](../operations/RUNBOOK.md) | Ops commands, logs, reset |
| [`../../unicharm_db_ddl.md`](../../unicharm_db_ddl.md) | Full MySQL DDL export (large) |

---

## 8. Re-introspect MySQL (copy-paste)

```bash
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" --protocol=tcp -D unicharm -e "
SHOW TABLES;
DESCRIBE chiller_1_normalized;
DESCRIBE cooling_tower_1_normalized;
DESCRIBE condenser_pump_0102_normalized;
DESCRIBE plant_normalized;
DESCRIBE primary_pump_1_normalized;
"
```

*Document generated for Graylinx POC — align with live `DESCRIBE` after any DDL migration.*
