# Post-v1.0 plan — 4 feature areas

**Status:** In execution · 2026-06-05
**Commit when complete:** single PR covers all 4 areas

Each item is ordered by implementation simplicity (lowest-risk first).
The `app/ai/pipeline.py` facade means most changes are one-file additions.

---

## 1. Redis response cache (~4h)

**Goal:** Repeated identical questions return in <100ms instead of 20-50s.

**Cache key:** `sha256(question + equipment_id + str(hours) + window_end)`
**TTL:** 60 seconds (short enough to not serve stale telemetry).
**Cache miss:** normal LLM path.
**Cache hit:** replay the cached answer as a streamed SSE token sequence so the
UI gets the same rendering experience.

### Files
- `backend/app/services/answer_cache.py` (NEW) — get/set helpers on top of Redis
- `backend/app/api/v1/analyzer.py` — check cache before LLM, write after stream
- `backend/app/config.py` — `ANALYZER_CACHE_TTL_S: int = 60`

### How it works
```
Request → preflight → context fetch → build cache key
  ├── cache HIT  → stream cached answer as tokens → done frame
  └── cache MISS → build prompt → LLM → stream → write cache → done frame
```

### Acceptance
- [ ] Second identical question returns in <500ms
- [ ] Cache entries expire after TTL (test with `ANALYZER_CACHE_TTL_S=5`)
- [ ] Cache miss still works normally
- [ ] 34-case eval still passes (eval never sends duplicate questions in sequence)

---

## 2. Operator feedback loop — 👍/👎 (~5h)

**Goal:** Operators rate answers; poor answers become new eval cases over time.

### Backend changes
- `backend/app/db/models.py` — add `operator_verdict: str | None` to AnalysisAudit
- `backend/alembic/versions/` — new migration adding the column
- `backend/app/api/v1/audit.py` — `POST /audit/{audit_id}/verdict` endpoint
- `backend/app/observability/metrics.py` — `graylinx_operator_feedback_total{verdict}`

### Frontend changes
- `frontend/src/features/analyzer/index.jsx` — render `FeedbackBar` below AuditPanel
- `frontend/src/features/analyzer/FeedbackBar.jsx` (NEW) — 👍/👎 + optional text
  - Shows after `streamDone` and `auditId` is available
  - POST to `/api/v1/audit/{audit_id}/verdict`
  - Dismisses itself after submission

### Acceptance
- [ ] Thumbs appear below analyzer answer after streaming completes
- [ ] Click 👍 → POST verdict=positive, bar shows "Thanks" + dismisses
- [ ] Click 👎 → POST verdict=negative, Prometheus counter increments
- [ ] `analysis_audit.operator_verdict` populated in DB
- [ ] 34-case eval still passes

---

## 3. Eval Phase 2 — 50+ cases + S2 LLM-as-judge (~1d)

### Phase 2: Expand to 50+ deterministic cases

Add to `backend/tests/golden/cases.py`:

| Area | New cases | Notes |
|---|---|---|
| Paraphrase variants | 6 | "chiller 3 data" / "info on chiller 3" — same refusal |
| Multi-clause questions | 4 | "How efficient is chiller 1 AND what anomalies are there?" |
| Root cause mode | 3 | root_cause happy paths (chiller_2, anomaly focus) |
| Maintenance mode | 2 | maintenance with non-chiller equipment |
| Vision surface | 3 | describe + compare (mock — check endpoint exists, 200) |
| NL-query complex | 4 | aggregate queries, window functions |
| Boundary: empty | 2 | empty question, single char |
| Language variants | 3 | Hindi / Chinese attempts → English-only refusal |

Target: **27 existing + 34 new = 61 cases total**

### S2: LLM-as-judge (semantic grounding check)

Uses `llama3.1:8b` as the judge model — different from answer model to avoid confirmation bias.

**Judge prompt:** "Given this CONTEXT and this ANSWER, do all numeric claims in
the answer appear in the context within 5%? Reply JSON: {grounded: bool, issues: [str]}"

```python
# backend/tests/eval/judge.py (NEW)
async def llm_judge(answer: str, context_summary: str) -> dict:
    """S2 semantic judge via local Ollama — open source, no cloud."""
    prompt = _JUDGE_PROMPT.format(context=context_summary, answer=answer)
    # Uses llama3.1:8b at temp=0.0 for determinism
    ...

# Cases opt-in to S2 by adding:
"expect": {"s2_judge": True, "s2_grounded": True}
```

**Runner integration:** `runner.py:run_case()` — after S1 checks, if `s2_judge`
is set, call `judge.llm_judge()` and add to `CaseResult.s2_verdict`.

**Acceptance**
- [ ] 61 cases total, 61/61 S1 passing
- [ ] 5 cases have `s2_judge=True` and all return `grounded=True`
- [ ] S2 fails appropriately when answer contains a made-up number (manual test)

---

## 4. Langfuse self-hosted span tracing (~1d)

**Goal:** Per-request traces showing every LLM call, every tool call, every
postcheck — operator can drill into "why did this answer say 0.72 kW/TR?"

**Open-source:** Langfuse MIT license. Self-hosted in Docker. Zero data egress.

### Docker changes
```yaml
# docker-compose.yml — new service
langfuse:
  image: langfuse/langfuse:latest
  ports: ["3200:3000"]
  environment:
    DATABASE_URL: postgresql://thermynx:dev@postgres:5432/thermynx_app
    NEXTAUTH_SECRET: changeme-langfuse
    SALT: changeme-salt
    LANGFUSE_INIT_PROJECT_NAME: thermynx
    LANGFUSE_INIT_PROJECT_PUBLIC_KEY: pk-lf-thermynx
    LANGFUSE_INIT_PROJECT_SECRET_KEY: sk-lf-thermynx
  depends_on:
    postgres:
      condition: service_healthy
```

### Backend instrumentation
```
backend/requirements.txt      — add langfuse>=2.0.0
backend/app/config.py         — LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY
backend/app/llm/tracing.py    — NEW: trace_context() context manager
backend/app/llm/ollama.py     — wrap chat/stream with trace_context span
backend/app/domain/tools.py   — wrap execute_tool() with tool span
backend/app/api/v1/analyzer.py— top-level trace per /analyze request
backend/app/api/v1/agent.py   — top-level trace per /agent/run request
```

### Tracing structure per request
```
Trace: analyze (question, equipment_id, hours)
  ├── span: preflight          [<1ms]
  ├── span: context_fetch      [5-25ms DB]
  ├── span: rag_retrieval      [20-50ms embed+vector]
  ├── span: prompt_build       [<1ms]
  ├── span: llm_call           [15-45s]   model, tokens, latency
  ├── span: postcheck          [<50ms]    flag_count
  └── span: critique           [1-3s]     verdict
```

### Acceptance
- [ ] Docker `docker compose up -d` brings Langfuse up on http://localhost:3200
- [ ] After one `/analyze` call, a trace appears in Langfuse UI
- [ ] Trace shows all spans with correct latencies
- [ ] 34-case eval still passes (tracing is additive, never blocks)
- [ ] Langfuse env vars are documented in `docs/operations/runbooks/OLLAMA_SERVER_TUNING.md`

---

## Execution order

1. **Redis cache** (1h code, no infra change) — fastest user-felt win
2. **Feedback loop** (2h backend + 1.5h frontend) — starts data flywheel
3. **Eval Phase 2** (4h cases + 2h S2 judge) — quality confidence
4. **Langfuse** (1h docker + 3h instrumentation) — observability

Total estimate: **~14.5h**

---

## Acceptance criteria for "all 4 done"

- [ ] `pytest backend/tests/eval/test_golden.py` → 61+ passed
- [ ] Second identical analyzer question → <500ms response
- [ ] 👍/👎 button visible and functional in analyzer UI
- [ ] `docker compose up -d` brings Langfuse on :3200
- [ ] One analyzer call produces a visible trace in Langfuse
- [ ] All services healthy (8+1 containers)
