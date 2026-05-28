# Honest data audit — what's real, what's seeded, what's hardcoded

**Snapshot:** 2026-05-22 · **Use:** share this when discussing the product
with stakeholders / customers / auditors. Every claim below is verified
against the running system (MySQL `unicharm` at `localhost:3307`,
Postgres `thermynx_app` at `localhost:5442`, Ollama at
`100.125.103.28:11434`).

The intent of this document is honesty: nothing here is marketing
copy. If a number on screen comes from a real telemetry row, this
doc says so. If it comes from a seeded demo row, this doc says so too.

---

## TL;DR

| Category | Status |
|---|---|
| Telemetry analytics (Dashboard, Efficiency, Anomalies, Forecast, Compare, Cost, Reports, AI Analyzer, NL Query, Maintenance, Topology readings) | ✅ **Real** — every value comes from `unicharm` MySQL |
| Agent + Causal + Critique LLM outputs | ✅ **Real** — generated live against real telemetry / real RAG chunks |
| Vision describe/compare | ✅ **Real** — operator-uploaded images → on-prem `llama3.2-vision` |
| Knowledge base (RAG) | 🟡 **Real but generic** — 5 docs of public-domain HVAC reference content, not Unicharm SOPs |
| Work-order *equipment* + lifecycle | ✅ **Real / functional** — every WO references a real asset; every state transition is logged |
| Work-order **technicians** | 🟥 **Seeded demo data** — 4 placeholder names |
| Work-order **PM templates** | 🟥 **Seeded demo data** — 8 industry-standard intervals |
| Work-order **auto-created PM WOs** | 🟡 **Real equipment × seeded templates** — the WOs exist, they reference real assets, but the templates that generated them are seeded |
| **Topology edges** | 🟥 **Hardcoded** in source — canonical chiller-plant layout, not learned from the DB |
| **EQUIPMENT_CATALOG** (asset list) | 🟡 **Hardcoded mapping** — names like "chiller_1_normalized" correspond to real MySQL tables, but the 6-item list itself lives in source code |
| **Cost tariff** | 🟡 **Env-configurable** — `TARIFF_INR_PER_KWH=8.5` default; kWh side is real |
| **Telemetry freshness** | 🟥 **30 days stale** — dataset's MAX(slot_time)=2026-04-22; backend in `latest_in_db` mode anchors "live" to that snapshot |

Total surfaces: 17 menu items. **Of those, 14 surface only real data; 3 mix real data with seeded scaffolding (Work Orders, Topology edges, Vision is fully independent).**

---

## 1. Surfaces that pull only real data

### 1.1 Dashboard ([dashboard](../../frontend/src/features/dashboard/))
- Source: `GET /api/v1/equipment`, `/api/v1/efficiency`, `/api/v1/anomalies/live`
- Every reading is from `chiller_*_normalized`, `cooling_tower_*_normalized`, `condenser_pump_*_normalized` MySQL tables.
- Verified: chiller_1 has 1722 rows, 1485 with `is_running=1`.

### 1.2 AI Analyzer ([analyzer](../../frontend/src/features/analyzer/))
- Telemetry context built from `fetch_all_hvac_context()` over real MySQL tables.
- RAG context from `embeddings` table (10 chunks; see §3.1 for content disclosure).
- LLM (`qwen2.5:14b` on Ollama) generates the answer live each time.
- Citations come from the actual retrieved chunks — clicking opens the real chunk content.

### 1.3 NL Query ([nl_query](../../frontend/src/features/nl_query/))
- Examples on the page are now generated from `/api/v1/equipment` — they name the actual 6 assets.
- The LLM-generated SQL is validated against a strict allowlist (SELECT only, 6 normalized tables only) before MySQL sees it.
- Returned rows are real query results.

### 1.4 Efficiency / Anomalies / Forecast / Compare / Cost / Reports / Maintenance
- All read MySQL directly. No mock layer.
- Forecast now uses Holt-Winters (real ML, statsmodels) — see §4.

### 1.5 Anomalies "Explain why" + Causal endpoint
- `/api/v1/causal/explain` packages real telemetry context + the anomaly fields and asks the LLM for a ranked-cause JSON.
- No fallback "stock" causes — if the LLM fails, the panel says "skipped".

### 1.6 Alarms
- `/api/v1/alarms` synthesises from two real sources:
  - Live anomaly detection over real telemetry
  - Maintenance health degradations from real telemetry
- No mock alarms ever inserted.

### 1.7 Audit Log + Quality tab
- Reads `analysis_audit` and `agent_runs` populated by actual usage.
- Empty when nobody has used the analyzer / agent yet — never seeded.

### 1.8 Topology — *node states only*
- Each node's `kw`, `kw_per_tr`, `running`, `band` is the latest reading from MySQL.
- **Edges are hardcoded** — see §3.3.

### 1.9 Vision
- Independent of all DBs. Operator uploads image → on-prem `llama3.2-vision` → structured verdict.
- No Unicharm linkage, by design.

### 1.10 System page
- Static directory of running services. No data on it — it's an admin tool.

---

## 2. AI / ML model usage (all on-prem)

All inference runs through the customer-owned Ollama server at
`100.125.103.28:11434`. **No cloud APIs anywhere in the call graph.**

| Capability | Model | What it does |
|---|---|---|
| Analyzer answers, brief, agent reasoning | `qwen2.5:14b` (Ollama) | Tool-calling ReAct |
| Self-critique fact-check | `qwen2.5:14b` (Ollama, JSON mode, temp 0) | Verifies numeric claims |
| NL → SQL | `qwen2.5:14b` (Ollama) | Generates SELECT, then validator gate |
| Causal explanations | `qwen2.5:14b` (Ollama, JSON mode) | Ranks likely causes |
| Vision | `llama3.2-vision` (Ollama) | Image describe / compare |
| Embeddings (RAG) | `nomic-embed-text` (Ollama, 768d) | Document chunk vectors |
| Forecast | **statsmodels Holt-Winters** (CPU, no LLM) | Real time-series ML — damped trend + 24h seasonality |
| Anomaly detection | **Z-score** (analytics, no LLM) | 72h baseline per metric |
| Maintenance health score | **Composite analytics** (no LLM) | 0-100 score with reasons |

---

## 3. Seeded / hardcoded items — disclose before go-live

### 3.1 Knowledge base content (`embeddings` table, 10 chunks)

| File | Source | Real? |
|---|---|---|
| HVAC_CHILLER_EFFICIENCY.md | Written by me from public-domain HVAC engineering knowledge | Industry-standard; not Unicharm-specific |
| HVAC_COOLING_TOWER.md | Same | Same |
| HVAC_CONDENSER_PUMP.md | Same | Same |
| HVAC_MAINTENANCE_PLAYBOOK.md | Same | Same |
| HVAC_ANOMALY_PLAYBOOK.md | Same | Same |

**Status:** Real domain content, not invented. They serve as a starter
corpus so the Analyzer can cite something while real Unicharm SOPs are
collected. Should be replaced (or supplemented) with the customer's
actual manuals when available.

### 3.2 Technicians table (`technicians`, 4 rows)

Seeded in alembic migration `0004_work_orders.py`:

| Name | Email | Skills | Location |
|---|---|---|---|
| Ravi Kumar | ravi@example.com | chiller, vibration, refrigerant | Plant Room A |
| Suresh Iyer | suresh@example.com | tower, pump, water_chemistry | Plant Room B |
| Anita Sharma | anita@example.com | vfd, electrical, controls | Control Room |
| Priya Nair | priya@example.com | chiller, pm, inspection | Plant Room A |

**Status:** Demo data, not real Unicharm staff. The assignment dropdown
populates these so the WO drawer isn't empty on a fresh install.
**Must be replaced before deploying to a real plant.**

### 3.3 Preventive-maintenance templates (`pm_templates`, 8 rows)

Seeded in the same alembic migration; intervals derived from
HVAC_MAINTENANCE_PLAYBOOK.md:

| Name | Equipment type | Interval (days) | Priority |
|---|---|---|---|
| Daily operator round | all | 1 | low |
| Weekly tower fill inspection | cooling_tower | 7 | normal |
| Weekly pump strainer check | pump | 7 | low |
| Monthly chiller charge check | chiller | 30 | normal |
| Quarterly vibration survey | all | 90 | normal |
| Annual eddy-current tube test | chiller | 365 | high |
| Annual tower fill cleaning | cooling_tower | 365 | normal |
| Annual pump bearing inspection | pump | 365 | high |

**Status:** Industry-standard intervals — sensible defaults that any
HVAC ops team would recognise. Not pulled from Unicharm's CMMS or
their actual PM schedule. Customer should review and adjust.

### 3.4 Auto-created PM work orders (`work_orders` rows from PM cron)

At backend startup the PM scheduler runs and creates one WO per
(equipment × due template). With the 8 seeded templates and 6 real
assets, this produces ~16 WOs on a fresh install.

**Status:** Real equipment references, real timestamps, real
state-machine. But the **templates that generated them are seeded
demos** (§3.3). Once real templates replace the seeds, the WOs
become production-grade.

### 3.5 Topology edges ([topology.py](../../backend/app/api/v1/topology.py))

```python
_PLANT_EDGES = [
    ("condenser_pump_1",  "cooling_tower_1", "condenser_water"),
    ("condenser_pump_3",  "cooling_tower_2", "condenser_water"),
    ("cooling_tower_1",   "chiller_1",       "condenser_water"),
    ("cooling_tower_2",   "chiller_2",       "condenser_water"),
    ("condenser_pump_1",  "chiller_1",       "condenser_water"),
    ("condenser_pump_3",  "chiller_2",       "condenser_water"),
]
```

**Status:** Hardcoded canonical chiller-plant topology. The *nodes*
are real (they come from `EQUIPMENT_CATALOG`), but the *edges* are
author opinion. Should be moved to a YAML / DB table per deployment —
see `DATA_03_TOPOLOGY_FROM_DATA.md`.

### 3.6 EQUIPMENT_CATALOG ([equipment.py](../../backend/app/domain/equipment.py))

```python
EQUIPMENT_CATALOG = [
    {"id": "chiller_1",        "type": "chiller",       "table": "chiller_1_normalized"},
    {"id": "chiller_2",        "type": "chiller",       "table": "chiller_2_normalized"},
    {"id": "cooling_tower_1",  "type": "cooling_tower", "table": "cooling_tower_1_normalized"},
    {"id": "cooling_tower_2",  "type": "cooling_tower", "table": "cooling_tower_2_normalized"},
    {"id": "condenser_pump_1", "type": "pump",          "table": "condenser_pump_0102_normalized"},
    {"id": "condenser_pump_3", "type": "pump",          "table": "condenser_pump_03_normalized"},
]
```

**Status:** The asset IDs and the table mappings are real (those tables
exist in `unicharm`). What's hardcoded is the *list* — when Unicharm
adds another chiller, we have to add a row to this constant.

### 3.7 Cost tariff (`TARIFF_INR_PER_KWH` env var)

Default value: `8.5` INR/kWh. The kWh side comes from real telemetry;
the multiplier is operator-configurable. **Real customers set their
actual tariff.**

---

## 4. Forecast model — honest description

| Property | Value |
|---|---|
| Model | statsmodels `ExponentialSmoothing` (Holt-Winters) |
| Components | level + damped trend + additive seasonal (period=24h) |
| Training data | Real hourly compaction of `chiller_*_normalized` etc. |
| Outlier handling | Training series clipped to 2nd-98th percentile (filters chiller-startup transients) |
| Output clipping | Predictions bounded to ±25% of historical 5th-95th percentile |
| Fallback model 1 | Holt linear (damped trend, no seasonal) — used when <48 hourly observations |
| Fallback model 2 | Simple exponential smoothing — last-resort |
| Heuristic fallback | Hour-of-day mean ± 1σ — when even SES fails |
| Confidence labelling | high (≤12h), medium (12-24h), low (>24h) |

**It is real ML.** Predictions track level + trend + daily seasonality,
not a static profile. Verified on chiller_1 kw_per_tr: 12h forecast
ranged 0.57-0.66 (correctly inside the "good" efficiency band) with
visible morning ramp.

The model is *not* Chronos / TimesFM. Those would be more accurate at
long horizons but require a 150-500 MB model download. Holt-Winters
is the appropriate v0 trade-off; the Chronos swap-in is queued.

---

## 5. Telemetry freshness — major caveat

```
MAX(slot_time) across the 6 telemetry tables = 2026-04-22T17:55
```

The dataset is ~30 days stale at the time of writing. The backend
runs in `TELEMETRY_TIME_ANCHOR=latest_in_db` mode, which means every
"last 24 hours" / "live" view anchors to the dataset's max slot, not
to wall-clock time. Operators see relative timestamps that are correct
*to the dataset*, not to today.

**This is not hidden** — the design choice is documented and the
freshness check passes only in `wall_clock` mode. For a real
production pilot:

- Option A: ship a yellow "Demo data · last update Apr 22 2026" banner
- Option B: time-shift the dataset so timestamps slide to "now"
- Option C: wire to the real BMS / SCADA / OPC-UA

See `DATA_02_TELEMETRY_FRESHNESS.md` for the full discussion.

---

## 6. What's verifiable right now (commands)

```bash
# Count of real Unicharm rows
docker exec -it <unicharm-mysql> mysql -uroot -proot123 unicharm \
  -e "SELECT 'chiller_1' t, COUNT(*) FROM chiller_1_normalized
      UNION SELECT 'chiller_2', COUNT(*) FROM chiller_2_normalized
      UNION SELECT 'cooling_tower_1', COUNT(*) FROM cooling_tower_1_normalized;"

# Knowledge corpus chunks (should be 10)
curl http://localhost:8000/api/v1/rag/status

# Seeded technicians (should be 4)
curl http://localhost:8000/api/v1/technicians

# Seeded PM templates (visible indirectly through generated WOs)
curl 'http://localhost:8000/api/v1/work-orders?source=pm&limit=20'

# Auto-created PM WOs at startup (will be ~16 on first boot)
curl http://localhost:8000/api/v1/work-orders/stats

# Forecast — confirm "Backend: HW additive ..." appears in note
curl 'http://localhost:8000/api/v1/forecast/chiller_1?metric=kw_per_tr&horizon=12'

# Live audit log (will be small/empty before usage)
curl http://localhost:8000/api/v1/audit/stats
```

---

## 7. Going-live checklist

Before deploying to a real customer, these items must be addressed:

- [ ] **Technicians:** replace the 4 demo rows with real Unicharm staff
      (or wire to customer HR system).
- [ ] **PM templates:** review the 8 seeded intervals against
      Unicharm's actual PM schedule.
- [ ] **Telemetry source:** switch to live BMS ingest, or knowingly
      pilot on the snapshot with a banner.
- [ ] **Topology edges:** verify the 6 hardcoded edges match the
      real plant, or move to a deployment-editable YAML.
- [ ] **Cost tariff:** set `TARIFF_INR_PER_KWH` to the customer's
      actual blended rate.
- [ ] **Knowledge base:** decide whether to keep the generic HVAC
      reference docs and/or ingest the customer's SOPs.
- [ ] **Slack integration:** set `SLACK_BOT_TOKEN` and
      `SLACK_ALARM_CHANNEL` if outbound alarm forwarding is wanted.
- [ ] **Branding:** review the "Graylinx" wordmark, logo, and color
      palette against final customer branding.

---

## 8. Things the platform does NOT do (yet)

So nothing is silently missing:

- No CMMS integration (Maximo, ServiceNow, UpKeep) — planned, not built.
- No parts inventory link — planned, not built.
- No RUL / digital-twin failure prediction — heuristic health score
  only; planned Phase 8.
- No mobile-optimised UI — the WO drawer is responsive but not
  tablet-tuned.
- No voice console (push-to-talk) — planned Phase 7.
- No PII redaction filter on LLM inputs / outputs — planned Phase 10.
- No prompt versioning — planned Phase 10.
- No auth / SSO model — the UI assumes a trusted operator; works for
  a POC, not for multi-tenant SaaS.
