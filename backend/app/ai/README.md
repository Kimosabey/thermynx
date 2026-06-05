# `app.ai` — pipeline-organized AI facade

This is a **navigation facade** over the AI-related code in the backend.
The actual implementations still live in `services/`, `prompts/`, `llm/`,
`domain/`. This package re-exports them in pipeline-execution order so
engineers can read one file and see the whole flow.

## Quick read

Open [`pipeline.py`](./pipeline.py) and read top-to-bottom. The 6 stages
match the runtime flow for every AI request:

1. **Pre-flight** — `services/preflight.py` (regex gates)
2. **Context fetch** — `db/telemetry.py` + `domain/equipment.py`
3. **2b. RAG retrieval** — `services/rag.py` (optional)
4. **Prompt build** — `prompts/hvac_prompts.py`
5. **LLM call** — `llm/ollama.py` (circuit-breaker-guarded)
6. **4b. Tool execution** — `domain/tools.py` (agent only)
7. **Post-gen audit** — `services/postcheck.py`
8. **LLM critique** — `services/critique.py` (analyzer only)

## How to import

Both forms work — pick whichever reads better:

```python
# Pipeline-facade form (recommended for new code — self-documenting)
from app.ai.pipeline import (
    check_action_request,         # Stage 1
    fetch_all_hvac_context,       # Stage 2
    retrieve,                     # Stage 2b
    build_analyze_prompt,         # Stage 3
    stream_generate,              # Stage 4
    run_postcheck,                # Stage 5
    verify_answer,                # Stage 6
)

# Original form (still works — every existing import keeps functioning)
from app.ai.preflight import check_action_request
from app.db.telemetry import fetch_all_hvac_context
# ...
```

## When to refactor for real

This facade is Phase 1 (re-exports only). Phase 2 — moving files into
`backend/app/ai/{preflight,context,rag,prompts,llm,tools,postcheck,critique,surfaces}/`
— is documented in [`docs/planning/ai/AI_PIPELINE_REORG.md`](../../../docs/planning/ai/AI_PIPELINE_REORG.md).

Run that when:
- A dedicated session is available (3-4 hrs)
- No other AI work is in flight
- The 27-case eval suite has been pinned green as a baseline

## Pipeline diagram

See [`docs/planning/ai/AI_PIPELINE_REORG.md`](../../../docs/planning/ai/AI_PIPELINE_REORG.md)
for the full ASCII pipeline diagram including the optional 2b (RAG) and 4b (tools)
branches that fire for the analyzer + agent surfaces.

## Related docs

- [`docs/planning/ai/HALLUCINATION_DEFENSES.md`](../../../docs/planning/ai/HALLUCINATION_DEFENSES.md) — what each stage defends against
- [`docs/planning/ai/MODEL_SIZING_DECISION.md`](../../../docs/planning/ai/MODEL_SIZING_DECISION.md) — which model runs at each stage
- [`docs/planning/ai/PERFORMANCE_PLAN.md`](../../../docs/planning/ai/PERFORMANCE_PLAN.md) — where the latency goes
- [`backend/tests/eval/test_golden.py`](../../tests/eval/test_golden.py) — 27-case regression suite
