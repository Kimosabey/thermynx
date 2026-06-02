# AI code reorganization — pipeline view + reorg plan

**Audience:** Engineers maintaining the AI backend who keep saying "where does X live again?"
**Status:** PROPOSAL · not yet executed
**Last updated:** 2026-06-01

Sibling docs:
- [`../../architecture/AI_ARCHITECTURE_REFERENCE.md`](../../architecture/AI_ARCHITECTURE_REFERENCE.md) — describes the current state
- [HALLUCINATION_DEFENSES.md](./HALLUCINATION_DEFENSES.md) — the 4 defense layers, with file pointers
- [`backend/tests/eval/test_golden.py`](../../../backend/tests/eval/test_golden.py) — 27-case regression guard for any refactor

---

## Problem

To answer "what happens when a user submits a question to `/analyze`?" you have
to trace through **5 folders** today:

```
backend/app/
├── api/v1/analyzer.py              ← entry point
├── services/preflight.py           ← Layer 1 (action verb + equipment + topic check)
├── services/rag.py                 ← Layer 2 (RAG retrieval)
├── prompts/hvac_prompts.py         ← Layer 3 (system prompt)
├── llm/ollama.py                   ← Layer 4 (model call + circuit breaker)
├── services/postcheck.py           ← Layer 5 (numeric/equipment/citation/language audit)
└── services/critique.py            ← Layer 6 (LLM-as-judge self-critique)
```

These files execute **in pipeline order** but their folder structure is grouped
by Python module type (api/services/llm/prompts/domain), not by their role in
the pipeline. New engineers (and future-us) can't easily build a mental model
of "data flows from A → B → C".

20 AI-related files total — same problem on the agent path, NL-query path,
vision path, and orchestrator.

---

## The actual pipeline (every AI request)

Same shape across all 6 surfaces. The dotted-line stages are optional.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  USER QUESTION                                                       │
│       │                                                              │
│       ▼                                                              │
│  ┌──────────────────────────────────────┐                            │
│  │ 1. PREFLIGHT          services/preflight.py                       │
│  │    check_action_request                                           │
│  │    check_equipment_mentions                                       │
│  │    topic_gate                                                     │
│  └─┬────────────────────────────────────┘                            │
│    │ refusal? → return deterministic 422 / SSE refusal, EXIT         │
│    │ pass    ↓                                                       │
│  ┌──────────────────────────────────────┐                            │
│  │ 2. CONTEXT FETCH      db/telemetry.py + analytics/                │
│  │    fetch_all_hvac_context + per-equipment paths                   │
│  │    compute_summary (band, kW/TR, outlier filter)                  │
│  └─┬────────────────────────────────────┘                            │
│    │                                                                 │
│    │      ┄┄ if RAG-enabled ┄┄                                       │
│    │      ▼                                                          │
│    │   ┌──────────────────────────────────────┐                      │
│    │   │ 2b. RAG RETRIEVAL  services/rag.py                          │
│    │   │     embed_query (nomic-embed-text)                          │
│    │   │     retrieve (pgvector, threshold 0.55)                     │
│    │   └─┬────────────────────────────────────┘                      │
│    │     │ chunks (or empty)                                         │
│    │     ↓                                                           │
│  ┌──────────────────────────────────────┐                            │
│  │ 3. PROMPT BUILD       prompts/hvac_prompts.py                     │
│  │    SYSTEM_CONTEXT (English-only · read-only · refuse-unknown · …) │
│  │    build_analyze_prompt (context + summary + RAG + focus pin)     │
│  └─┬────────────────────────────────────┘                            │
│    │                                                                 │
│    ▼                                                                 │
│  ┌──────────────────────────────────────┐                            │
│  │ 4. LLM CALL           llm/ollama.py                               │
│  │    circuit_check → chat/stream → record_success/failure           │
│  │    model from config.py (TEXT / TOOL / SQL / PLANNER / AUDITOR)   │
│  └─┬────────────────────────────────────┘                            │
│    │ tokens stream                                                   │
│    ▼                                                                 │
│       ┄┄ agent only ┄┄                                               │
│      ▼                                                               │
│   ┌──────────────────────────────────────┐                           │
│   │ 4b. TOOL EXECUTION   domain/tools.py                             │
│   │     TOOL_SCHEMAS + execute_tool                                  │
│   │     compact_agent_tool_payload (12K cap)                         │
│   │     loop back to step 4 for next iteration                       │
│   └─┬────────────────────────────────────┘                           │
│     ▼                                                                │
│  ┌──────────────────────────────────────┐                            │
│  │ 5. POSTCHECK          services/postcheck.py                       │
│  │    audit_numeric_claims                                           │
│  │    audit_equipment_mentions                                       │
│  │    audit_citations                                                │
│  │    audit_language       ← new 2026-06-01                          │
│  └─┬────────────────────────────────────┘                            │
│    │ flags → SSE `audit` frame                                       │
│    ▼                                                                 │
│       ┄┄ analyzer only ┄┄                                            │
│      ▼                                                               │
│   ┌──────────────────────────────────────┐                           │
│   │ 6. CRITIQUE          services/critique.py                        │
│   │     LLM-as-judge (auditor model = llama3.2:latest)               │
│   │     verified / suspicious / unverified                           │
│   └─┬────────────────────────────────────┘                           │
│     │ verdict → SSE `verification` frame                             │
│     ▼                                                                │
│  RESPONSE TO USER + audit row in analysis_audit                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Current → Proposed file layout

### Option A — Re-exports only (zero-risk, ~30 min)

Create a new `backend/app/ai/` package that re-exports everything in pipeline
order. No file moves, no broken imports. New engineers can read `ai/__init__.py`
top-to-bottom and see the pipeline.

```
backend/app/
├── ai/                            # NEW — pipeline-organized facade
│   ├── __init__.py                # re-exports below for `from app.ai import ...`
│   ├── pipeline.py                # one symbol per stage, doc'd
│   ├── surfaces.py                # entry-point handlers grouped
│   └── README.md                  # this doc, condensed
│
├── api/v1/                        # unchanged — actual endpoints stay
├── services/                      # unchanged — actual implementations stay
├── llm/                           # unchanged
├── prompts/                       # unchanged
└── domain/                        # unchanged
```

`backend/app/ai/pipeline.py` looks like:

```python
"""Pipeline-ordered re-exports — read this to understand the AI flow.

Each stage points at the canonical implementation file. No code lives here;
this is a facade for navigation only.
"""

# Stage 1 — Pre-flight
from app.services.preflight import (
    check_action_request,
    check_equipment_mentions,
    topic_gate,
)

# Stage 2 — Context fetch
from app.db.telemetry import fetch_all_hvac_context, compute_summary

# Stage 2b — RAG retrieval (optional)
from app.services.rag import embed_query, retrieve, format_rag_context

# Stage 3 — Prompt build
from app.prompts.hvac_prompts import (
    SYSTEM_CONTEXT,
    build_analyze_prompt,
    REPORT_SUMMARY_SYSTEM,
)

# Stage 4 — LLM call
from app.llm.ollama import (
    chat,
    stream_chat_text,
    stream_generate,
    circuit_state,
)

# Stage 4b — Tool execution (agent only)
from app.domain.tools import TOOL_SCHEMAS, execute_tool
from app.domain.agent_payload import compact_agent_tool_payload

# Stage 5 — Post-gen audit
from app.services.postcheck import (
    run_postcheck,
    audit_numeric_claims,
    audit_equipment_mentions,
    audit_citations,
    audit_language,
)

# Stage 6 — LLM critique (analyzer only)
from app.services.critique import verify_answer
```

**Pros:**
- Zero risk to the 27/27 eval — no imports change
- Reversible — delete the folder if it doesn't help
- Doc-as-code — the file IS the pipeline overview

**Cons:**
- Doesn't actually move files; the original sprawl remains
- Two ways to import the same thing (could cause confusion)

### Option B — Real reorganization into `backend/app/ai/` (medium-risk, ~3-4 hrs)

Move all 20 AI-related files into a single `ai/` package, organized by
pipeline stage:

```
backend/app/
├── ai/
│   ├── __init__.py
│   ├── README.md
│   │
│   ├── preflight.py              ← was services/preflight.py
│   │
│   ├── context/                  ← was parts of analyzer + db/telemetry
│   │   ├── __init__.py
│   │   ├── fetch.py              ← fetch_all_hvac_context, fetch_chiller_data
│   │   └── summary.py            ← compute_summary
│   │
│   ├── rag/                      ← was services/rag.py + services/ingest.py
│   │   ├── __init__.py
│   │   ├── retrieve.py
│   │   └── ingest.py
│   │
│   ├── prompts/                  ← was prompts/hvac_prompts.py (split by surface)
│   │   ├── __init__.py
│   │   ├── analyzer.py           ← SYSTEM_CONTEXT + build_analyze_prompt
│   │   ├── agent.py              ← per-mode prompts (currently in services/agent.py)
│   │   ├── orchestrator.py       ← planner + synth prompts (currently in services/multi_agent.py)
│   │   ├── critique.py           ← was services/critique.py:_AUDITOR_SYSTEM
│   │   ├── report.py             ← REPORT_SUMMARY_SYSTEM
│   │   └── sql.py                ← was services/nl_to_sql.py:_SYSTEM_PROMPT
│   │
│   ├── llm/                      ← was llm/ollama.py
│   │   ├── __init__.py
│   │   ├── client.py             ← chat, stream_*, list_models
│   │   ├── circuit.py            ← circuit breaker
│   │   └── models.py             ← model selection helpers
│   │
│   ├── tools/                    ← was domain/tools.py + domain/equipment.py
│   │   ├── __init__.py
│   │   ├── registry.py           ← TOOL_SCHEMAS + execute_tool
│   │   ├── equipment.py          ← EQUIPMENT_CATALOG + get_by_id
│   │   └── payload.py            ← compact_agent_tool_payload
│   │
│   ├── postcheck.py              ← was services/postcheck.py
│   │
│   ├── critique.py               ← was services/critique.py (without the prompt)
│   │
│   └── surfaces/                 ← one orchestrator per entry point
│       ├── __init__.py
│       ├── analyzer.py           ← was services/<inline in api/v1/analyzer.py>
│       ├── agent.py              ← was services/agent.py
│       ├── orchestrator.py       ← was services/multi_agent.py
│       ├── nl_query.py           ← was services/nl_to_sql.py
│       └── vision.py             ← was services/vision.py
│
├── api/v1/                       ← endpoints stay (thin), now import from app.ai.surfaces
├── db/                           ← unchanged (DB session, models, raw queries)
├── analytics/                    ← unchanged (kept separate — analytics ≠ AI)
└── ...
```

**Pros:**
- One folder = the entire AI subsystem
- Pipeline structure visible in the filesystem
- Easier to ship/deprecate AI features as a unit
- Easier to write per-folder tests / linting / typing
- `from app.ai.tools.equipment import EQUIPMENT_CATALOG` is self-documenting

**Cons:**
- ~30+ import updates across the codebase
- Must update `tests/eval/test_golden.py` if any imports leak through
- Must update `docs/planning/ai/HALLUCINATION_DEFENSES.md` file pointers
- Must update the Tier 3 audit code that imports `EQUIPMENT_CATALOG`
- 1-2 hour merge tax on any in-flight branches

### Option C — Hybrid: Option A now + Option B later as a single-shot PR

1. **Now (this session):** ship Option A. New engineers get the pipeline view.
   Zero eval risk.
2. **Later (a dedicated session with no other in-flight work):** ship Option B
   as a single atomic refactor. Run the 27-case eval before + after to prove
   no regression. Update the docs in the same PR.

Recommended.

---

## Concrete file-move plan (for Option B)

Each row is one `git mv` + import update. Listed in dependency order so you
can execute and test incrementally.

| # | From | To | Importers to update |
|---|---|---|---|
| 1 | `services/preflight.py` | `ai/preflight.py` | `api/v1/{analyzer,agent,nl_query,slack}.py` |
| 2 | `domain/equipment.py` | `ai/tools/equipment.py` | `services/preflight.py`, `domain/tools.py`, `services/postcheck.py`, `api/v1/{analyzer,equipment,topology,maintenance,...}.py` |
| 3 | `domain/tools.py` | `ai/tools/registry.py` | `services/agent.py`, `api/v1/capabilities.py` |
| 4 | `domain/agent_payload.py` | `ai/tools/payload.py` | `services/agent.py` |
| 5 | `llm/ollama.py` | `ai/llm/client.py` + `ai/llm/circuit.py` (split) | `services/{agent,multi_agent,critique,nl_to_sql,vision}.py`, `api/v1/{analyzer,reports,slack,health}.py` |
| 6 | `prompts/hvac_prompts.py` | `ai/prompts/{analyzer,report}.py` (split) | `api/v1/{analyzer,reports,slack}.py` |
| 7 | `services/rag.py` | `ai/rag/retrieve.py` | `api/v1/{analyzer,rag,slack}.py`, `services/multi_agent.py` |
| 8 | `services/ingest.py` | `ai/rag/ingest.py` | `api/v1/rag.py`, `jobs/*.py` |
| 9 | `services/postcheck.py` | `ai/postcheck.py` | `api/v1/analyzer.py`, `api/v1/agent.py` (after Part B from AGENT_UX_AND_EVAL_LOCKIN.md) |
| 10 | `services/critique.py` | `ai/critique.py` (logic) + `ai/prompts/critique.py` (prompt) | `api/v1/analyzer.py` |
| 11 | `services/agent.py` | `ai/surfaces/agent.py` + `ai/prompts/agent.py` (system prompts split) | `api/v1/agent.py` |
| 12 | `services/multi_agent.py` | `ai/surfaces/orchestrator.py` + `ai/prompts/orchestrator.py` | `api/v1/agent.py` |
| 13 | `services/nl_to_sql.py` | `ai/surfaces/nl_query.py` + `ai/prompts/sql.py` | `api/v1/nl_query.py` |
| 14 | `services/vision.py` | `ai/surfaces/vision.py` + `ai/prompts/vision.py` | `api/v1/vision.py` |

**~30 unique importer files to update**, dominated by `api/v1/*.py` and a few
service-to-service imports.

### Migration safety rails

For Option B, before any move:

1. **Pin the green eval baseline.** Run `pytest tests/eval/test_golden.py` —
   must show 27 passed. Record exact timings.
2. **Branch.** Work on `chore/ai-pipeline-reorg` so master stays shippable.
3. **After each `git mv` + import update:** run `pytest tests/eval/test_golden.py -x`
   on the analyzer + agent subsets. If any fails, revert that one move.
4. **Final run before merge:** all 27 cases green + manual smoke against
   `/api/v1/analyze`, `/api/v1/agent/run`, `/api/v1/agent/orchestrate`,
   `/api/v1/nl-query`, `/api/v1/vision/describe`.
5. **Update docs in the same PR:** every file pointer in
   - `docs/planning/ai/HALLUCINATION_DEFENSES.md`
   - `docs/planning/ai/HALLUCINATION_GUARDRAILS.md`
   - `docs/planning/ai/PERFORMANCE_PLAN.md`
   - `docs/planning/ai/MODEL_SIZING_DECISION.md`
   - `docs/architecture/AI_ARCHITECTURE_REFERENCE.md`
   - `docs/operations/runbooks/AI_MANUAL_TEST_PLAN.md`

---

## Recommendation

Ship **Option A (re-exports)** in the next 30 minutes. It gives 80% of the
mental-model value at 0% of the refactor risk.

Defer **Option B (real move)** to a dedicated 3-4 hour session when:
- No other AI work is in flight
- The 27-case eval suite is the only blocker
- A clean branch is available

The reorg is good engineering hygiene but not blocking any feature.
Pipeline-walking via the new `ai/pipeline.py` re-export file is what new
engineers actually need TODAY.

---

## What this doc does NOT propose to change

These stay exactly where they are:

- `backend/app/api/v1/*.py` — FastAPI route handlers. Thin orchestrators.
- `backend/app/db/` — DB session, models, raw queries. Not AI-specific.
- `backend/app/analytics/` — pure math (efficiency, anomaly, forecast). The
  models in `ai/llm/` USE these but don't own them.
- `backend/app/observability/` — Prometheus + Loki wiring. Cross-cutting.
- `backend/app/config.py` — single source of truth for settings.
- `backend/app/jobs/`, `backend/app/limiter.py`, etc.

The reorg is strictly scoped to the AI inference pipeline.

---

## When to revisit

Re-open this proposal when any of these become true:

1. A second AI feature (e.g. predictive maintenance, fault detection ML) gets
   added — the sprawl will compound.
2. A new engineer joins and reports the pipeline took >1 hour to grok.
3. Test coverage expands past 50 cases and the per-folder test runs become
   slow because they hit unrelated code.
4. A different team forks this code and needs to swap the LLM layer — clean
   `ai/llm/` boundary makes that 10× faster.
