# Graylinx — API Reference

Base URL: `http://localhost:8000/api/v1`
OpenAPI UI: `http://localhost:8000/docs`

All responses are JSON unless noted as SSE (Server-Sent Events).
All timestamps are ISO 8601 UTC.

---

## Table of Contents

1. [Health](#1-health)
2. [Equipment](#2-equipment)
3. [Timeseries](#3-timeseries)
4. [Analyzer (SSE)](#4-analyzer-sse)
5. [Efficiency](#5-efficiency)
6. [Anomalies](#6-anomalies)
7. [Compare](#7-compare)
8. [Forecast](#8-forecast)
9. [Cost](#9-cost)
10. [Maintenance](#10-maintenance)
11. [Cooling Tower](#11-cooling-tower)
12. [Reports](#12-reports)
13. [Threads](#13-threads)
14. [Agent (SSE)](#14-agent-sse)
15. [RAG](#15-rag)
16. [SSE Frame Format](#16-sse-frame-format)

---

## 1. Health

### `GET /healthz`
Minimal liveness probe.

**Response:**
```json
{ "status": "ok" }
```

---

### `GET /health`
Deep health check — verifies MySQL and Ollama reachability.

**Response:**
```json
{
  "status": "ok",
  "db": { "connected": true, "latency_ms": 12 },
  "ollama": { "connected": true, "default_model": "qwen2.5:14b", "latency_ms": 45 }
}
```

**Error (partial):**
```json
{
  "status": "degraded",
  "db": { "connected": false, "error": "Connection refused" },
  "ollama": { "connected": true }
}
```

---

## 2. Equipment

### `GET /equipment`
Full equipment catalog.

**Response:**
```json
[
  {
    "id": "chiller_1",
    "name": "Chiller 1",
    "type": "chiller",
    "design_capacity_tr": 500,
    "design_kw_per_tr": 0.65
  },
  ...
]
```

Equipment IDs: `chiller_1`, `chiller_2`, `cooling_tower_1`, `cooling_tower_2`, `condenser_pump_1`, `condenser_pump_3`

---

### `GET /equipment/summary`
Aggregated live KPIs for all equipment.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `hours` | int | `24` | Lookback window |

**Response:**
```json
[
  {
    "equipment_id": "chiller_1",
    "name": "Chiller 1",
    "type": "chiller",
    "is_running": true,
    "kw_avg": 312.4,
    "tr_avg": 468.1,
    "kw_per_tr_avg": 0.668,
    "load_pct_avg": 93.6,
    "run_hours": 22.3,
    "data_points": 89
  }
]
```

---

## 3. Timeseries

### `GET /equipment/{equipment_id}/timeseries`
Raw bucketed timeseries for a single piece of equipment.

**Path params:** `equipment_id` — one of the 6 equipment IDs

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `hours` | int | `24` | Lookback window (max 8760) |
| `resolution` | string | `15m` | Bucket size: `5m`, `15m`, `1h`, `6h`, `1d` |

**Response:**
```json
{
  "equipment_id": "chiller_1",
  "resolution": "15m",
  "hours": 24,
  "points": [
    {
      "ts": "2026-05-08T10:00:00Z",
      "kw": 315.2,
      "tr": 471.0,
      "kw_per_tr": 0.669,
      "chiller_load": 94.2,
      "chw_delta_t": 8.1,
      "cond_entering_temp": 29.4,
      "is_running": 1
    }
  ]
}
```

**Errors:**
- `404` — unknown equipment_id

---

### `GET /timeseries/compare`
Side-by-side timeseries for two equipment (aligned timestamps).

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `a` | string | yes | First equipment ID |
| `b` | string | yes | Second equipment ID |
| `hours` | int | no (24) | Lookback window |
| `resolution` | string | no (15m) | Bucket size |

**Response:**
```json
{
  "a": { "equipment_id": "chiller_1", "points": [...] },
  "b": { "equipment_id": "chiller_2", "points": [...] }
}
```

---

## 4. Analyzer (SSE)

### `POST /analyze`
AI analysis of equipment data. Returns a **Server-Sent Events** stream.

**Request body:**
```json
{
  "equipment_id": "chiller_1",
  "hours": 24,
  "question": "Why is efficiency dropping in the afternoon?",
  "thread_id": "optional-uuid"
}
```

**SSE stream** (see [§16](#16-sse-frame-format) for frame format):

```
data: {"type":"token","content":"Based"}
data: {"type":"token","content":" on"}
...
data: {"type":"done","elapsed_ms":4821}
```

**Curl example:**
```bash
curl -N -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"equipment_id":"chiller_1","hours":24,"question":"Explain the efficiency trend"}'
```

**Notes:**
- Each audit record is written to `analysis_audit` on stream completion
- If `thread_id` is provided, the Q+A is appended to that thread's messages
- Response is Markdown; parse with `react-markdown` or render raw

---

## 5. Efficiency

### `GET /efficiency`
Efficiency analysis for all chillers.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `hours` | int | `24` | Lookback window |

**Response:**
```json
[
  {
    "equipment_id": "chiller_1",
    "kw_per_tr_avg": 0.71,
    "band": "fair",
    "delta_vs_design_pct": 9.2,
    "loss_drivers": ["high_approach_temp", "part_load_operation"],
    "design_kw_per_tr": 0.65
  }
]
```

**Band values:** `excellent` (<0.55) | `good` (<0.65) | `fair` (<0.75) | `poor` (<0.85) | `critical` (≥0.85)

---

### `GET /efficiency/{equipment_id}`
Efficiency analysis for one chiller.

**Path params:** `equipment_id` — chillers only (`chiller_1`, `chiller_2`)

**Response:** Single object (same shape as array item above, plus hourly trend points)

**Errors:**
- `400` — equipment is not a chiller
- `404` — unknown equipment_id

---

## 6. Anomalies

### `GET /anomalies/live`
On-demand z-score anomaly detection (not persisted).

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `hours` | int | `1` | Window to scan for anomalies |

**Response:**
```json
{
  "scanned_at": "2026-05-09T10:31:00Z",
  "anomalies": [
    {
      "equipment_id": "chiller_1",
      "metric": "kw_per_tr",
      "value": 1.12,
      "z_score": 4.3,
      "severity": "critical",
      "description": "chiller_1 kW/TR spiked to 1.12 (z=4.3) — possible refrigerant issue"
    }
  ]
}
```

**Severity values:** `warning` (z≥3) | `critical` (z≥4)

---

### `GET /anomalies/history`
Persisted anomalies from the background scan job.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | `50` | Max results returned |
| `equipment_id` | string | (all) | Filter by equipment |

**Response:**
```json
{
  "total": 12,
  "anomalies": [
    {
      "id": "uuid",
      "equipment_id": "chiller_2",
      "metric": "chw_delta_t",
      "z_score": 3.8,
      "severity": "warning",
      "narrative": "...",
      "created_at": "2026-05-09T10:05:00Z"
    }
  ]
}
```

---

## 7. Compare

### `GET /compare`
Side-by-side KPI and efficiency comparison of two equipment.

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `a` | string | yes | First equipment ID |
| `b` | string | yes | Second equipment ID |
| `hours` | int | no (24) | Lookback window |

**Response:**
```json
{
  "a": {
    "equipment_id": "chiller_1",
    "kw_per_tr_avg": 0.71,
    "band": "fair",
    "kw_avg": 312.4,
    "tr_avg": 468.1,
    "run_hours": 22.3
  },
  "b": {
    "equipment_id": "chiller_2",
    "kw_per_tr_avg": 0.63,
    "band": "good",
    ...
  },
  "winner": "chiller_2",
  "delta_pct": 11.3
}
```

---

## 8. Forecast

### `GET /forecast/{equipment_id}`
Trend-based efficiency forecast.

**Path params:** `equipment_id` — chillers only

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `metric` | string | `kw_per_tr` | Metric to forecast |
| `horizon` | int | `24` | Forecast horizon in hours |

**Response:**
```json
{
  "equipment_id": "chiller_1",
  "metric": "kw_per_tr",
  "trend": "degrading",
  "slope_per_day": 0.008,
  "current_value": 0.71,
  "forecast_points": [
    { "ts": "2026-05-10T00:00:00Z", "value": 0.718, "ci_low": 0.69, "ci_high": 0.75 }
  ],
  "days_to_poor_band": 18
}
```

---

## 9. Cost

### `GET /cost`
Energy cost breakdown across all equipment.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `hours` | int | `24` | Lookback window |
| `tariff_inr_per_kwh` | float | `8.5` | Electricity tariff (INR/kWh) |

**Response:**
```json
{
  "hours": 24,
  "tariff_inr_per_kwh": 8.5,
  "total_kwh": 8214.3,
  "total_inr": 69821.6,
  "equipment": [
    {
      "equipment_id": "chiller_1",
      "kwh": 3842.1,
      "inr": 32658.1,
      "share_pct": 46.8
    }
  ]
}
```

---

## 10. Maintenance

### `GET /maintenance/{equipment_id}`
Maintenance state for one piece of equipment.

**Response:**
```json
{
  "equipment_id": "chiller_1",
  "run_hours_total": 4821,
  "cycles": 312,
  "wear_estimate_pct": 48.2,
  "health_score": 72,
  "health_grade": "B",
  "next_pm_due_hours": 179,
  "recommendations": [
    "Schedule condenser tube cleaning within 180 run hours",
    "Inspect refrigerant charge — kW/TR trending up"
  ]
}
```

---

### `GET /maintenance`
Maintenance summary for all equipment.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `hours` | int | `168` | Lookback window (default 7 days) |

**Response:** Array of the single-equipment shape above.

---

## 11. Cooling Tower

### `GET /cooling-tower/{equipment_id}/optimize`
Cooling tower KPIs and setpoint recommendation.

**Path params:** `equipment_id` — `cooling_tower_1` or `cooling_tower_2`

**Query params:** `hours` (default 24)

**Response:**
```json
{
  "equipment_id": "cooling_tower_1",
  "approach_temp_c": 3.2,
  "fouling_detected": false,
  "kw_avg": 45.2,
  "staging_hint": "Both cells optimal at current load",
  "setpoint_recommendation_c": 28.5
}
```

---

## 12. Reports

### `POST /reports/daily`
Generate an AI-written daily operations report. Returns **SSE stream**.

**Request body:**
```json
{
  "hours": 24,
  "include_anomalies": true,
  "include_efficiency": true
}
```

**SSE stream:** Same token/done format as `/analyze`. Final output is Markdown.

**Report sections:**
1. Executive summary (AI-generated)
2. KPI table (all equipment)
3. Efficiency highlights
4. Anomaly events
5. Maintenance flags
6. Recommendations

**Curl example:**
```bash
curl -N -X POST http://localhost:8000/api/v1/reports/daily \
  -H "Content-Type: application/json" \
  -d '{"hours":24}'
```

---

## 13. Threads

Conversation persistence for the AI Analyzer.

### `POST /threads`
Create a new conversation thread.

**Request body (optional):**
```json
{ "title": "Chiller 1 afternoon investigation" }
```

**Response:**
```json
{ "id": "uuid", "title": "Chiller 1 afternoon investigation", "created_at": "..." }
```

---

### `GET /threads`
List all threads (most recent first).

**Response:**
```json
[
  { "id": "uuid", "title": "...", "message_count": 4, "created_at": "..." }
]
```

---

### `GET /threads/{thread_id}`
Get a thread with all its messages.

**Response:**
```json
{
  "id": "uuid",
  "title": "...",
  "created_at": "...",
  "messages": [
    { "id": "uuid", "role": "user", "content": "Why is efficiency dropping?", "created_at": "..." },
    { "id": "uuid", "role": "assistant", "content": "Based on the data...", "created_at": "..." }
  ]
}
```

---

### `DELETE /threads/{thread_id}`
Delete a thread and all its messages.

**Response:** `204 No Content`

---

## 14. Agent (SSE)

### `POST /agent/run`
Run a ReAct agent. Returns **SSE stream** with reasoning trace.

**Request body:**
```json
{
  "mode": "investigator",
  "goal": "Investigate why chiller_1 efficiency dropped after 14:00 yesterday",
  "equipment_id": "chiller_1",
  "hours": 24
}
```

**Mode values:**

| Mode | Purpose |
|------|---------|
| `investigator` | Root cause investigation with tool calls |
| `optimizer` | Identify efficiency improvement opportunities |
| `brief` | One-paragraph plant status summary |
| `root_cause` | Deep dive into a specific anomaly or event |
| `maintenance` | Assess maintenance priorities across all equipment |

**SSE stream includes reasoning trace:**
```
data: {"type":"thought","content":"I should first get the equipment list..."}
data: {"type":"tool_call","tool":"get_equipment_list","args":{}}
data: {"type":"tool_result","tool":"get_equipment_list","result":[...]}
data: {"type":"thought","content":"Now I'll compute efficiency for chiller_1..."}
data: {"type":"tool_call","tool":"compute_efficiency","args":{"equipment_id":"chiller_1","hours":24}}
data: {"type":"tool_result","tool":"compute_efficiency","result":{...}}
data: {"type":"token","content":"## Investigation\n\n"}
data: {"type":"token","content":"Based on the data..."}
data: {"type":"done","steps_taken":4,"total_ms":12400}
```

**Max steps:** 8 (prevents infinite loops)

**Agent history:** `GET /agent/history` returns recent runs from `agent_runs` table.

---

## 15. RAG

### `GET /rag/status`
Check whether the knowledge corpus is populated.

**Response:**
```json
{
  "ready": true,
  "total_chunks": 142,
  "sources": ["Chiller_1_Manual.pdf", "Maintenance_Guide.pdf"]
}
```

---

### `GET /rag/search`
Semantic search over ingested documents.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | required | Natural language query |
| `top_k` | int | `5` | Number of results |

**Response:**
```json
{
  "query": "condenser tube cleaning interval",
  "total": 3,
  "results": [
    {
      "chunk_id": "uuid",
      "source_id": "Chiller_1_Manual.pdf",
      "section": "§4.2 Maintenance Schedule",
      "content": "Condenser tubes should be cleaned every 2000 run hours...",
      "score": 0.91
    }
  ]
}
```

---

## 16. SSE Frame Format

All streaming endpoints (`/analyze`, `/agent/run`, `/reports/daily`) emit newline-delimited `data:` lines.

**Frame types:**

| Type | Fields | When |
|------|--------|------|
| `token` | `content: string` | Each LLM output token |
| `thought` | `content: string` | Agent ReAct reasoning step (agent only) |
| `tool_call` | `tool: string`, `args: object` | Before a tool is executed (agent only) |
| `tool_result` | `tool: string`, `result: any` | After tool execution (agent only) |
| `done` | `elapsed_ms: int`, `steps_taken?: int` | Stream complete |
| `error` | `detail: string` | Stream failed |

**Parsing example (JavaScript):**
```javascript
const es = new EventSource('/api/v1/analyze', { method: 'POST', ... });
es.onmessage = (e) => {
  const frame = JSON.parse(e.data);
  if (frame.type === 'token') output += frame.content;
  if (frame.type === 'done') es.close();
  if (frame.type === 'error') handleError(frame.detail);
};
```

---

## Error Responses

All non-streaming endpoints return standard FastAPI error shapes:

```json
{ "detail": "Unknown equipment: chiller_99" }
```

| HTTP Status | Meaning |
|-------------|---------|
| `200` | Success |
| `400` | Bad request (e.g., wrong equipment type for an endpoint) |
| `404` | Resource not found (unknown equipment, thread, etc.) |
| `422` | Validation error (Pydantic — missing or invalid field) |
| `500` | Internal server error |

For streaming endpoints, errors are emitted as an `error` SSE frame — the HTTP status is always `200` once the stream begins.
