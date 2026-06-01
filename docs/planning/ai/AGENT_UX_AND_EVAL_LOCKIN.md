# Agent UX parity + eval lock-in — execution plan

**Audience:** Engineers picking up the next round of AI work after `59cd4b7`.

**Last updated:** 2026-06-01

Sibling docs:
- [README.md](./README.md) — master index
- [HALLUCINATION_ROADMAP.md](./HALLUCINATION_ROADMAP.md) — Tier 1/2/3 status
- [EVALUATION_PLAN.md](./EVALUATION_PLAN.md) — broader eval architecture (this doc is a focused subset)

---

## Why this exists

Two distinct gaps surfaced after this session's work landed (`75c51fd` → `59cd4b7`):

1. **Today's fixes aren't locked in.** We shipped: TR<10 outlier filter
   (`301e1ad`), tower/pump analyzer fix (`59cd4b7`), false-premise / T2-I rule
   (`0ea08ae`). Only chiller_1 has explicit eval coverage. The next prompt or
   analytics change could silently regress towers, pumps, no-selection mode,
   or the outlier filter without anyone noticing until an operator hits it.

2. **Agent UI has no transparency.** The Analyzer page got the full T3 audit
   panel + citations drawer + verification verdict (`4fc0242`). The Autonomous
   Agents page got none of that — operators see a wall of streamed text with
   no visibility into which tools fired, what they returned, or whether the
   answer was numerically grounded.

This plan ships both in one focused round (~4 hrs total).

---

## Part A — Lock today's fixes into the eval suite (~1 hr)

### Goal

Six new cases in `backend/tests/golden/cases.py` so that the work shipped in
`301e1ad`, `59cd4b7`, and `0ea08ae` cannot silently regress.

### Cases to add

Add these to the existing list in `cases.py`. All are SSE-style /analyze
cases unless noted.

| ID | Surface | What it locks in | New body | Key expects |
|---|---|---|---|---|
| `an_tower_1_happy` | `/analyze` | Tower selection must produce a real answer (was 500 "Telemetry unavailable" pre-`59cd4b7`) | `{"question":"Tell me about cooling tower 1","hours":24,"equipment_id":"cooling_tower_1","verify":false}` | `contains_any: ["cooling tower", "tower", "kW", "running"]`; `not_contains: ["Telemetry unavailable", "Telemetry database is unreachable"]`; `max_latency_ms: 45000` |
| `an_tower_2_happy` | `/analyze` | Same for cooling_tower_2 | swap equipment_id | same |
| `an_pump_1_happy` | `/analyze` | Same for condenser_pump_1 | swap equipment_id + question | same |
| `an_pump_3_happy` | `/analyze` | Same for condenser_pump_3 | swap equipment_id + question | same |
| `an_no_selection_happy` | `/analyze` | "All equipment" path that previously crashed on `_fmt_equipment_rows` over a string from `context["fetched_at"]` | `{"question":"Give me a plant-wide overview","hours":24,"verify":false}` (no `equipment_id`) | `contains_any: ["chiller", "tower", "pump", "Plant"]`; `not_contains: ["Telemetry unavailable", "AttributeError"]` |
| `an_chiller_2_must_be_excellent` | `/analyze` | TR<10 outlier filter must keep chiller_2 in good/excellent band | `{"question":"What efficiency band is chiller 2 in?","hours":24,"equipment_id":"chiller_2","verify":false}` | `contains_any: ["excellent", "good", "0.5"]`; `not_contains: ["critical", "poor", "4.5", "4.526", "596"]`; `max_latency_ms: 45000` |

### File diff sketch

```python
# tests/golden/cases.py — add after the existing ANALYZER_CASES list entries
{
    "id":       "an_tower_1_happy",
    "endpoint": "/api/v1/analyze",
    "category": "happy_path",
    "body":     {"question":"Tell me about cooling tower 1","hours":24,
                 "equipment_id":"cooling_tower_1","verify":False},
    "expect": {
        "status":         200,
        "contains_any":   ["cooling tower", "tower", "kW", "running"],
        "not_contains":   ["Telemetry unavailable",
                           "Telemetry database is unreachable",
                           "AttributeError"],
        "max_latency_ms": 45000,
    },
    "tags": ["happy_path", "non-chiller-equipment", "59cd4b7-lock"],
},
# ... 5 more
```

### Acceptance

- [ ] 6 cases added to `cases.py`
- [ ] `pytest backend/tests/eval/test_golden.py` → **25/25** pass (was 19/19)
- [ ] Manual smoke: kill the `_db: AsyncSession` rename → at least one new case fails (proves the lock is real)
- [ ] Total suite latency stays under 4 min (each new SSE case is ~15-18s)

### Effort: ~1 hr
- 30 min: write the 6 cases + iterate `contains_any` / `not_contains` lists until happy
- 15 min: run + tune
- 15 min: commit + push

---

## Part B — Agent UI parity with Analyzer (~3 hrs)

### Goal

Bring the Autonomous Agents page (`/ai?mode=agent`) up to feature-parity with
the Quick Ask / Analyzer page (`/ai`) for transparency. Operators should see:

1. **Tool trace inline** — each `tool_call` and `tool_result` SSE frame
   rendered as a step in the timeline so they can see what data the agent
   pulled.
2. **Post-gen audit panel** — same `AuditPanel` component the analyzer uses,
   below the agent's final answer. Numeric / equipment / citation flags
   visible.
3. **Verification verdict** — if `verify` was set on the run, render the
   critique pass results (verified / suspicious / unverified counts).

### Backend changes (~1 hr)

**File:** `backend/app/api/v1/agent.py`

Currently `_stream(...)` yields the `run_agent(...)` frames straight through.
After the final `done` frame (and before persisting the run row), run
postcheck and emit one `audit` frame:

```python
# After `final_tokens` is populated, just before run.merge:
if status == "ok" and final_tokens:
    try:
        from app.services.postcheck import run_postcheck
        from app.domain.equipment import EQUIPMENT_CATALOG
        response_text = "".join(final_tokens)
        # Agent doesn't have a pre-formed context/summary dict like analyzer,
        # but EQUIPMENT_CATALOG is enough for the equipment-mention audit.
        # Numeric + citation audits can run with empty context — they'll just
        # produce zero flags if no ground truth is available.
        audit = run_postcheck(
            response_text,
            equipment_catalog=EQUIPMENT_CATALOG,
            retrieved_chunks=None,   # agent doesn't surface RAG chunks today
        )
        yield f"data: {json.dumps({'type':'audit','audit':audit})}\n\n"
    except Exception:
        log.exception("agent_postcheck_failed run_id=%s", run_id)
```

**File:** `backend/app/api/v1/agent.py` for `/agent/orchestrate` too — same
pattern, but use `synth_tokens` instead of `final_tokens`.

### Frontend changes (~2 hrs)

**File:** `frontend/src/features/agent/useAgentStream.js`

The hook already handles `tool_call`, `tool_result`, `token` frames. Add
handling for the new `audit` frame:

```js
const [agentAudit, setAgentAudit] = useState(null);

// In the event loop:
} else if (t === "audit") {
    setAgentAudit(frame.audit || null);
}

// Reset on new run:
setAgentAudit(null);

// Export:
return { trace, output, running, done, meta, error,
         plan, delegations, synthesis,
         agentAudit,  // <-- new
         start, stop };
```

**File:** `frontend/src/features/agent/AgentRunner.jsx`

Currently shows only the streamed text and a basic trace list. Add:

1. **Improved trace rendering** — group consecutive `tool_call` + `tool_result`
   pairs visually. Show tool name, args summary, result preview, latency.
2. **Audit panel** — reuse the existing `AuditPanel` component below the
   markdown answer:

```jsx
import { AuditPanel } from "../analyzer/AuditPanel";

// At bottom of the answer card:
{!running && agentAudit && (
  <Box px={{ base: 4, md: 6 }} pt={2}>
    <AuditPanel audit={agentAudit} verification={null} />
  </Box>
)}
```

3. **Orchestrator parity** — same audit panel below the synthesizer answer in
   `MultiAgentRunner.jsx`, fed from a separate `orchAudit` state. The backend
   already emits `audit` for the synthesizer in Part B's backend change.

### Acceptance

- [ ] Run "Investigate chiller 1 efficiency" via Autonomous Agents tab — final
      answer shows below it a collapsible audit panel with the new chip
      "Fact-check clean" or "N flags"
- [ ] Run "Investigate chiller 4" (unknown) — preflight refusal still fires in
      <3s and no audit panel is rendered (no answer to audit)
- [ ] Run an orchestrator goal — audit panel appears below the synthesizer
      answer
- [ ] Trace shows each tool call inline with its result, not just streamed
      text
- [ ] No regression on the 25-case eval suite (after Part A)
- [ ] No regression on the manual test plan
  ([AI_MANUAL_TEST_PLAN.md](../../operations/runbooks/AI_MANUAL_TEST_PLAN.md))

### Effort: ~3 hrs
- 30 min: backend `/agent/run` postcheck wiring + test
- 30 min: backend `/agent/orchestrate` postcheck wiring + test
- 45 min: `useAgentStream` state + frame handler
- 45 min: `AgentRunner` trace polish + audit panel placement
- 30 min: `MultiAgentRunner` audit panel wiring

---

## Combined acceptance criteria

When both parts ship:

- [ ] `pytest backend/tests/eval/test_golden.py` → 25 passed
- [ ] Frontend: every agent run shows tool-trace + audit panel
- [ ] Frontend: every orchestrator run shows audit panel below synthesizer
- [ ] No regression on the manual test plan
- [ ] Doc updated: [HALLUCINATION_ROADMAP.md](./HALLUCINATION_ROADMAP.md)
      snapshot table shows the new "agent UI audit" row as 🟢 Done

---

## Out of scope (next round)

These would be natural follow-ons but aren't in this ~4-hour plan:

- **Confidence labels per numeric claim** — tag every kW/kWh value as
  `[from compute_efficiency]` or `[inferred]`. ~2 hrs.
- **Tool-result caching within a single run** — memoize
  `(tool_name, frozen_args)` for the lifetime of one ReAct loop. ~1 hr.
  Cuts agent latency 10-20% on questions that revisit the same tool.
- **Adaptive `max_steps`** — scale the budget with question complexity. ~1 hr.
- **Eval expansion to 50+ cases** — covered by [EVALUATION_PLAN.md](./EVALUATION_PLAN.md)
  Phase 2.
- **S2 LLM-as-judge** — covered by [EVALUATION_PLAN.md](./EVALUATION_PLAN.md)
  Phase 3.

---

## How to execute

```bash
# Pre-flight — confirm baseline is green
cd backend
../.venv/Scripts/python.exe -m pytest tests/eval/test_golden.py -q
# expect: 19 passed

# Part A — add eval cases, run until green
# (edit tests/golden/cases.py)
../.venv/Scripts/python.exe -m pytest tests/eval/test_golden.py -q
# expect: 25 passed

# Part B — backend wiring
# (edit app/api/v1/agent.py)
# Restart backend, hit /agent/run via the UI to confirm `audit` SSE frame appears
curl -s --max-time 60 -X POST http://localhost:8000/api/v1/agent/run \
  -H "Content-Type: application/json" \
  -d '{"mode":"investigator","goal":"Investigate chiller 1",
       "context":{"equipment_id":"chiller_1","hours":6}}' \
  | grep '"type":"audit"'
# expect: at least one matching line

# Part B — frontend wiring
# (edit features/agent/useAgentStream.js + AgentRunner.jsx)
cd ../frontend
npm run dev
# Open http://localhost:5173/ai?mode=agent, run "Investigate chiller 1 last 6 hours",
# confirm audit panel renders below the answer.

# Final regression
cd ../backend
../.venv/Scripts/python.exe -m pytest tests/eval/test_golden.py -q
# expect: 25 passed

# Commit & push
git add -A
git commit -m "feat(agent): UI parity with analyzer + eval lock-in for tower/pump/outlier fixes"
```
