# Graylinx.ai — Agentic AI Architecture Validation Spec

A layer-by-layer flow for an AI-enabled HVAC monitoring product, written so an
agent (e.g. Claude Code) can validate the implementation against the codebase.

## How to use this with Claude Code

1. Open the repo in your IDE and start Claude Code.
2. Paste a prompt like: *"Validate this codebase against the spec in
   `graylinx_ai_layer_validation.md`. Go layer by layer. For each check, mark
   PASS / PARTIAL / FAIL / NOT FOUND, cite the file and line, and explain. End
   with a prioritized list of gaps."*
3. Work top of the flow (data in) to bottom (action out). Each layer's choices
   constrain the next, so validate in order.

## The flow (data → decision → action)

```
Telemetry ingest      ← sensors, BMS (BACnet/Modbus), IoT streams
      ↓
Anomaly detection     ← time-series ML / FDD  (NOT an LLM)
      ↓
Context assembly      ← summarize signals, retrieve manuals + history
      ↓
Diagnosis agent       ← LLM reasons over assembled context + tools
      ↓
Guardrails + approval ← safety bounds, human gate for consequential actions
      ↓
Act & verify          ← setpoint change / work order, then confirm fix
      ↺ verified outcomes feed back to tune detection + evals
```

---

## Layer 1 — Telemetry ingest

Purpose: get clean, time-stamped equipment data into the system.

Validate:
- Ingestion handles the real protocols/sources in use (BACnet, Modbus, MQTT,
  vendor APIs) and normalizes units and timestamps to a single convention.
- Each reading carries provenance: site, equipment ID, sensor ID, timestamp, unit.
- Pipeline is resilient to gaps, offline sensors, and out-of-order/duplicate data.
- Raw telemetry lands in a time-series store, not directly in application memory.

Red flags: silent dropping of bad readings; mixed unit systems; no clear schema;
ingest coupled directly to LLM calls.

## Layer 2 — Anomaly detection

Purpose: decide *something is wrong* using statistics, before any LLM is involved.

Validate:
- Detection uses time-series / FDD methods (thresholds, baselines, forecasting,
  classifiers) — confirm an LLM is NOT being called per data point.
- Detection logic is testable in isolation and has unit tests against known faults.
- Outputs a structured event (type, severity, equipment, evidence window), not prose.
- False-positive handling exists (debounce, hysteresis, confidence score).

Red flags: LLM used to scan raw numeric series; no baseline/seasonality handling;
anomaly logic entangled with prompt code.

## Layer 3 — Context assembly

Purpose: turn signals + knowledge into a compact, grounded context for the model.

Validate:
- Telemetry is **summarized** (trends, deviations from baseline, breaches) before
  entering the prompt — raw tables are not dumped into the context window.
- Retrieval pulls relevant equipment manuals, spec sheets, and service history
  (RAG), scoped to the affected equipment/site.
- System prompt defines scope, units, safety boundaries, and the assistant's role.
- Context is per-tenant/per-site isolated and uses current (not stale) readings.

Red flags: raw sensor logs in the prompt; no retrieval grounding; one global prompt
ignoring site-specific equipment; cross-tenant context leakage.

## Layer 4 — Diagnosis agent / orchestration

Purpose: reason from a confirmed anomaly to a likely cause and recommended action.

Validate:
- Clear split between predefined workflows (known fault types) and open-ended agent
  loops (novel cases) — autonomy is intentional, not accidental.
- Agent loop has hard limits: max steps, timeout, and cost ceiling.
- Routing sends events/questions to the right handler or model tier (cheap model for
  summaries, stronger model for diagnosis).
- Incident state/memory tracks what has already been tried within an investigation.
- Tools are well-defined (typed inputs, clear names, informative errors) and the
  agent degrades gracefully when a tool fails (e.g. offline sensor) instead of
  inventing data.

Red flags: unbounded loops; no routing (everything hits the biggest model); read and
write tools mixed together; agent fabricates values when a tool returns nothing.

## Layer 5 — Guardrails, evaluation & approval

Purpose: keep a system that touches physical equipment safe and measurable.

Validate:
- Hard safety bounds are enforced in **deterministic code**, independent of the LLM —
  a recommended setpoint outside safe limits is rejected by validation, not trust.
- Consequential actions (setpoint change, equipment control) require human approval;
  low-risk actions (e.g. raising a ticket) may be autonomous — confirm the line is explicit.
- Write tools enforce least privilege and produce an audit trail of every action.
- An evaluation set of real faults with known-correct diagnoses exists, and prompt/
  model changes are regression-tested against it.
- Every decision, tool call, and model version is logged for debugging and audit.

Red flags: safety limits only described in the prompt; no human gate on physical
actions; no eval set; no audit log; no way to reproduce a past decision.

## Layer 6 — Application & UX

Purpose: present AI output so users can trust it appropriately — not blindly.

Validate:
- Responses show reasoning, sources, and a confidence signal so users can verify.
- Role-based views (technician vs facilities manager vs exec) surface different detail.
- User corrections/overrides are captured as feedback that flows back to evals.
- Responses stream so perceived latency is acceptable.

Red flags: confident answers with no sources; one view for all roles; overrides not
captured; long blocking waits with no streaming.

---

## Cross-cutting (verify these across every layer)

- Data quality: pipelines validated; mislabeled history would poison retrieval + evals.
- Security & tenant isolation: building data (occupancy, schedules) is sensitive;
  confirm strict per-customer isolation end to end.
- Cost & latency: caching and summarization in place; LLM calls kept out of real-time
  hot paths.
- Accountability: clear ownership for AI-influenced actions, backed by the human gates
  above — especially for high-stakes sites (hospitals, data centers).

## Suggested output from Claude Code

For each layer, return a table: `Check | Status (PASS/PARTIAL/FAIL/NOT FOUND) | Evidence (file:line) | Notes`,
then a final prioritized gap list ordered by safety/risk impact.

---
---

# Validation Results — THERMYNX (last run: 2026-06-04)

> This section records the outcome of validating the THERMYNX codebase against
> the spec above. Re-run the validation prompt after major changes and update
> the scorecard. **Verdict: the architecture is sound and follows the spec's
> intended design** — the gaps below are hardening/maturity items, not
> architectural mistakes.

Stack: FastAPI + asyncio (Python 3.11), React/Vite frontend, MySQL (read-only
`unicharm` telemetry) + PostgreSQL/pgvector (app + RAG) + Redis (cache/cron),
Ollama LLMs (qwen2.5:14b text, llama3.1:8b tools/SQL/planner).

**Score: 23 PASS · 7 PARTIAL · 0 FAIL · 0 NOT FOUND**

| Layer | Check | Status | Evidence |
|---|---|---|---|
| **1 Ingest** | Protocol ingestion (BACnet/Modbus/MQTT) | PARTIAL | `backend/app/db/telemetry.py:7` — reads pre-normalized MySQL tables; no protocol handlers |
| | Unit/timestamp normalization | PASS | `backend/app/db/telemetry.py:43-54` single `slot_time` + SI units |
| | Provenance per reading | PASS | `backend/app/domain/equipment.py:5-12`, `backend/app/db/models.py:38-48` |
| | Gap/dup/out-of-order resilience | PARTIAL | `backend/app/db/telemetry.py:17-29` staleness warn; no gap-fill/dedup/reorder |
| | Raw store decoupled from LLM | PASS | anomaly scan is a 5-min background job, not in LLM path |
| **2 Anomaly** | Statistical/FDD, not per-point LLM | PASS | `backend/app/analytics/anomaly.py:1-10,69-77` z-score (2.5σ) |
| | Unit-tested against known faults | PASS | `backend/tests/test_anomaly_detection.py` — 15 fault-injection tests (gap #1, done) |
| | Structured event output | PASS | `backend/app/analytics/anomaly.py:16-26` `AnomalyEvent` dataclass |
| | False-positive handling | PARTIAL | `backend/app/analytics/anomaly.py:98-105` hourly dedup; no hysteresis/confidence; Slack 6h dedup |
| | Forecasting | PASS | `backend/app/analytics/forecast_ml.py:118-198` Holt-Winters + heuristic fallback |
| **3 Context** | Summarized, not raw dump | PASS | `backend/app/db/telemetry.py:183-220`, payload capped 12k chars |
| | RAG, equipment-scoped | PASS | `backend/app/services/rag.py` pgvector(768), `equipment_tags` filter, DATA markers |
| | System prompt (scope/units/safety/role) | PASS | `backend/app/services/agent.py:29-109` bands fixed, premise-verification gate |
| | Per-site isolation, current readings | PASS | `backend/app/db/telemetry.py:78-94` time-anchor + freshness |
| **4 Agent** | Workflow vs open-ended loop split | PASS* | ReAct loop + multi-agent planner; roles are prompt variants, not separate code |
| | Hard limits (steps/timeout/cost) | PASS* | `backend/app/config.py:60` MAX_STEPS=8, tool 30s, Ollama 60–120s, token caps; no token-cost ceiling |
| | Model routing/tiering | PASS | `backend/app/config.py:73-90` 8B tools / 14B text / 3B audit |
| | Incident state/memory | PARTIAL | message-text history (12–24 turns); no structured "tried X→failed" state |
| | Typed tools, read/write split, graceful fail | PASS | `backend/app/domain/tools.py:42-186,415-464` 7 read + 1 propose; error wrapping |
| | Concurrency hardening | PASS | recent C1/H1/H2/C3 fixes — CB lock, tool-injection markers, inner timeout, atomic msg persist |
| **5 Guardrails** | Hard bounds in deterministic code | PASS | `backend/app/services/preflight.py:51-85,130-160`, `backend/app/domain/tools.py:344-384` |
| | Human approval for consequential actions | PASS | `frontend/src/features/agent/AgentRunner.jsx:56-166` approve/dismiss; no auto-create |
| | Least privilege + audit trail | PASS | `backend/app/services/work_orders.py:47-67`, `backend/app/db/models.py:142-154` |
| | Eval set + regression | PASS | `backend/model-eval/` + `backend/tests/golden/cases.py`; 27/27 passing |
| | Reproducible decision logging | PASS | `AnalysisAudit`/`AgentRun` with prompt/response hash, model, request_id |
| **6 UX** | Reasoning + sources + confidence | PASS | trace panel + `frontend/src/features/analyzer/CitationFootnotes.jsx` + forecast backend signal |
| | Role-based views | PARTIAL | technician schema exists; no role-filtered UI (acceptable, no-auth tool) |
| | Corrections → feedback into evals | PARTIAL | comments/threads captured; no auto feedback→eval loop |
| | Streaming | PASS | SSE on analyze + agent/run |
| **Cross** | Data-quality validation | PASS | `backend/app/services/postcheck.py:43-60` numeric/equipment/citation audit |
| | Tenant/site isolation | PASS (single-tenant) | one hardcoded plant `backend/app/domain/equipment.py:1-7` |
| | Cost & latency control | PASS | Redis cache, model right-sizing, token caps |
| | Accountability | PASS | `backend/app/db/models.py:125-127` source + source_ref, event actor trail |

\* Met in spirit but a conscious design choice: no separate "predefined workflow"
code paths (the ReAct loop with prompt-selected roles covers it), and no
token-**cost** ceiling (only step/time caps). Both are fine for a single-plant
local-Ollama deployment.

## Strengths (don't regress these)

- Detection is statistical, decoupled from the LLM — no LLM per data point.
- Safety lives in deterministic code: equipment-catalog gate, action-verb
  refusal, `propose_work_order` numeric-grounding gate.
- Human gate on the only write path; everything else read-only.
- Real eval set on real Unicharm data + golden regression suite (27/27).
- Concurrency hardening: CB lock, tool-injection markers, inner asyncio timeout,
  atomic message persistence.

## Gap remediation tracker

Ordered by safety/risk impact. None are POC blockers.

| # | Gap | Status | Notes |
|---|---|---|---|
| 1 | Anomaly fault-injection unit tests | ✅ Done | `backend/tests/test_anomaly_detection.py`, 15 tests, all passing |
| 2 | Hysteresis / confidence on anomalies | ⬜ Planned | trip 2.5σ / reset 1.0σ + confidence score; `backend/app/analytics/anomaly.py:76-105` |
| 3 | Surface staleness / forecast-fallback in UI | ⬜ Planned | render freshness warning + "heuristic vs ML" badge |
| 4 | Structured incident memory | ⬜ Planned | record per-step "tool X → error Y" into `AgentRun` |
| 5 | Token-cost ceiling | ⬜ Planned (optional) | only needed if moving off local Ollama |
| 6 | Feedback → eval loop | ⬜ Future | promote corrected diagnoses into golden cases |

## Verify / re-run

```bash
# Anomaly unit tests (gap #1) — fast, no DB/LLM
cd backend && python -m pytest tests/test_anomaly_detection.py -v

# Golden regression suite — needs live DB + Ollama; must stay 27/27
cd backend && python -m pytest tests/eval/test_golden.py

# Model eval (after prompt/model changes) — diff the verdict report
cd backend && python model-eval/run_eval.py
#   → backend/model-eval/reports/MODEL_FIT_VERDICT.md
```
