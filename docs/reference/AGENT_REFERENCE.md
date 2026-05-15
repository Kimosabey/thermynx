# Graylinx — Agent & Tools Reference

The AI agent system uses a **ReAct (Reasoning + Acting)** loop: the LLM reasons about what to do, calls a tool, observes the result, reasons again, and so on until it can write a final answer.

Source files:
- Loop: [`backend/app/services/agent.py`](../backend/app/services/agent.py)
- Tools: [`backend/app/domain/tools.py`](../backend/app/domain/tools.py)
- Prompts: [`backend/app/prompts/hvac_prompts.py`](../backend/app/prompts/hvac_prompts.py)
- Endpoint: [`backend/app/api/v1/agent.py`](../backend/app/api/v1/agent.py)

---

## How the ReAct Loop Works

```
POST /agent/run
    │
    ├── Build system prompt (mode-specific)
    │
    └── Loop (max 8 steps):
          │
          ├── LLM call (Ollama chat with tool schemas)
          │     ├── Returns tool_call? → execute_tool() → inject result → loop again
          │     └── Returns text?      → stream tokens → emit "done" → exit
          │
          └── On timeout or step limit → emit "error" frame
```

Each step is emitted as an SSE frame so the frontend can show the live reasoning trace.

---

## 5 Agent Modes

### `investigator`
**Purpose:** Root cause investigation of an efficiency or anomaly event.

**Best for:** "Why did chiller 2 efficiency degrade after 3pm?" or "What caused the spike in kW/TR yesterday?"

**Behaviour:** Calls multiple tools sequentially — gets equipment list, fetches timeseries, computes efficiency, detects anomalies, then synthesises a root cause narrative.

**Output sections:** Findings → Investigation trail → Suggested next checks

---

### `optimizer`
**Purpose:** Identify operational improvements to reduce energy cost or improve efficiency.

**Best for:** "How can we reduce electricity cost this week?" or "Which chiller should run lead/lag?"

**Behaviour:** Compares efficiency across chillers, identifies loss drivers, checks cooling tower approach temp, calculates cost impact.

**Output sections:** Current state → Opportunity areas → Specific actions → Estimated savings

---

### `brief`
**Purpose:** One-paragraph plant status summary — suitable for a morning handover or shift briefing.

**Best for:** "Give me a quick overview of plant status" — runs in 1–2 tool calls.

**Behaviour:** Calls `get_equipment_list` + `compute_efficiency` only, then writes a concise paragraph.

**Output:** Single paragraph, no headers. ~100 words.

---

### `root_cause`
**Purpose:** Deep dive into a specific named anomaly or operational event.

**Best for:** "The chiller 1 kW/TR anomaly at 2am — what caused it?" with a specific event in mind.

**Behaviour:** Fetches anomaly history, pulls timeseries around the event window, correlates with ambient conditions and load changes.

**Output sections:** Event summary → Correlated factors → Most likely cause → Confidence assessment

---

### `maintenance`
**Purpose:** Assess maintenance priorities across all equipment based on run hours and wear indicators.

**Best for:** "What should the maintenance team focus on this week?"

**Behaviour:** Calls `get_equipment_list` → runs maintenance analysis per equipment → ranks by urgency.

**Output sections:** Priority list (ranked) → Per-equipment detail → Recommended actions

---

## 6 Tools

Tools are defined as JSON schemas (Ollama function calling format) in `tools.py`. The LLM decides which tools to call; execution happens in `agent.py`.

---

### `get_equipment_list`
Returns the full equipment catalog.

**Args:** none

**Returns:**
```json
[
  { "id": "chiller_1", "name": "Chiller 1", "type": "chiller", "design_capacity_tr": 500 },
  ...
]
```

**When used:** First tool called in most modes — grounds the LLM in what equipment exists.

---

### `compute_efficiency`
Computes kW/TR efficiency band and loss drivers for a chiller.

**Args:**
```json
{ "equipment_id": "chiller_1", "hours": 24 }
```

**Returns:**
```json
{
  "equipment_id": "chiller_1",
  "kw_per_tr_avg": 0.71,
  "band": "fair",
  "delta_vs_design_pct": 9.2,
  "loss_drivers": ["high_approach_temp", "part_load_operation"]
}
```

**Constraints:** `equipment_id` must be a chiller (`chiller_1` or `chiller_2`).

---

### `detect_anomalies`
Runs z-score anomaly detection on-demand.

**Args:**
```json
{ "equipment_id": "chiller_1", "hours": 1 }
```

**Returns:** Array of anomaly events (same shape as `GET /anomalies/live`).

---

### `get_timeseries_summary`
Returns statistical summary (min/max/avg/p95) of key metrics for an equipment window — not raw points.

**Args:**
```json
{ "equipment_id": "chiller_1", "hours": 24 }
```

**Returns:**
```json
{
  "equipment_id": "chiller_1",
  "metrics": {
    "kw": { "min": 180, "max": 390, "avg": 312, "p95": 378 },
    "kw_per_tr": { "min": 0.58, "max": 1.12, "avg": 0.71, "p95": 0.88 },
    ...
  }
}
```

**Note:** Returns a summary, not raw timeseries — keeps token count manageable.

---

### `compare_equipment`
Compares KPIs of two pieces of equipment side by side.

**Args:**
```json
{ "equipment_a": "chiller_1", "equipment_b": "chiller_2", "hours": 24 }
```

**Returns:** Same shape as `GET /compare`.

---

### `get_anomaly_history`
Fetches persisted anomalies from Postgres (background scan history).

**Args:**
```json
{ "equipment_id": "chiller_1", "limit": 10 }
```

**Returns:** Same shape as `GET /anomalies/history`.

---

## Step Limit & Safety

- **Max steps:** 8 per run. If the LLM hasn't produced a final answer after 8 tool calls, the loop exits and an `error` SSE frame is emitted.
- **No tool call = done:** If the LLM responds with plain text (no function call), the loop exits and that text is streamed as the final answer.
- **Error isolation:** If a tool call raises an exception, the error is returned as the tool result (not propagated) — the LLM can see the error and decide what to do next.

---

## How to Add a New Tool

1. **Define the schema** in `backend/app/domain/tools.py`:

```python
NEW_TOOL = {
    "type": "function",
    "function": {
        "name": "my_new_tool",
        "description": "One sentence — what this tool does and when to use it.",
        "parameters": {
            "type": "object",
            "properties": {
                "equipment_id": {"type": "string", "description": "Equipment to query"},
                "hours": {"type": "integer", "description": "Lookback window in hours"}
            },
            "required": ["equipment_id"]
        }
    }
}
```

2. **Register the schema** in the `ALL_TOOLS` list in `tools.py`.

3. **Implement execution** in `backend/app/services/agent.py` inside `execute_tool()`:

```python
elif tool_name == "my_new_tool":
    result = await some_service.do_thing(args["equipment_id"], args.get("hours", 24))
    return result
```

4. **Test it** — run an agent in `investigator` mode and ask a question that should trigger the new tool. Check the SSE trace for `tool_call` + `tool_result` frames.

---

## Prompt Versioning

System prompts are versioned in `backend/app/prompts/hvac_prompts.py`. Each agent mode has its own system prompt block. When you modify a prompt:

1. Increment the version comment in the file (`# v2`)
2. Note the change in `docs/PROMPTS.md`
3. The `agent_runs` table records `mode` so you can correlate output quality with prompt versions

---

## Agent Run History

Every completed agent run is persisted to the `agent_runs` Postgres table:

```sql
SELECT id, mode, goal, steps_taken, status, total_ms, created_at
FROM agent_runs
ORDER BY created_at DESC
LIMIT 20;
```

The `final_output` column holds the markdown response. `context_json` holds the serialised tool call/result chain for debugging.
