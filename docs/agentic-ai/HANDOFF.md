# Agentic Rewrite — Session Handoff (2026-06-10)

Continuation notes so a fresh chat can pick up without re-discovering anything.
**Branch:** `rewrite/agentic-framework` (all work here; `master` untouched).
**Authoritative plan + live status:** [FRAMEWORK_REWRITE_PLAN.md](./FRAMEWORK_REWRITE_PLAN.md)
(has a "Build status (live)" block). Architecture: [FRAMEWORK_ARCHITECTURE.md](./FRAMEWORK_ARCHITECTURE.md).
Decision: [ADR-0002](../architecture/decisions/0002-adopt-agentic-framework-stack.md) (supersedes ADR-0001).

## TL;DR — the rewrite is functionally COMPLETE and live-validated
LangGraph port of all surfaces, behind default-OFF flags, instantly reversible, safety layer preserved.
Commit range this session: `c0820a3` → `…` (see `git log rewrite/agentic-framework`). ~28 commits.

## Environment (all confirmed working this session)
- **Ollama 0.30.7** @ `http://100.125.103.28:11434` (Tailscale). All per-task models present:
  gemma4:12b, devstral, codestral, mistral-small3.2, llama3.2-vision, nomic-embed-text, phi4, llama3.1:8b.
- **MySQL** unicharm @ `127.0.0.1:3307` ✅ · **Postgres+pgvector** @ `localhost:5442` (`embeddings` table, **12 rows**, ivfflat cosine index `idx_embeddings_vec`) ✅.
- **Single `.venv`** (NOT a separate venv — the graph code imports `app.*` so it needs the backend deps + langchain together). Installed: `langgraph==1.2.4`, `langchain-core==1.4.3`, `langchain==1.3.6`, `langchain-ollama==1.1.0`, `flashrank==0.2.10`, `ragas==0.4.3` (BROKEN — see below), `deepeval==4.0.6` (imports OK). Core deps unchanged: httpx 0.28.1, pydantic 2.13.4.
- **`.env` routing (live):** TEXT/AUDITOR/RAG → **phi4**; TOOL → devstral; SQL → codestral; PLANNER → gemma4:12b. (config.py defaults still say mistral-small3.2; `.env` overrides to phi4.)

## The new code (all under `backend/app/ai/graph/`)
- `models.py` — per-task `ChatOllama` router (`chat_model(role)`, `structured_model`, `with_retries`). **Sets `num_ctx` via `app.llm.ollama._num_ctx_for`** (critical — see gotcha).
- `schemas.py` — Pydantic: `Plan`/`Subtask`, `CritiqueVerdict`, 8 tool-arg models + `TOOL_ARG_SCHEMAS`.
- `validation.py` — `validate_tool_args()` (one-shot tool-arg repair, F1.8).
- `tools_lc.py` — 8 HVAC tools as LangChain `StructuredTool`s (`LC_TOOLS`), execution still via guarded `execute_tool`.
- `state.py` — `AgentState` TypedDict.
- `single_agent.py` — grounded graph: preflight→context→rag→prompt→llm→postcheck→critique.
- `react_agent.py` — ReAct tool-loop graph (agent surface).
- `multi_agent_graph.py` — planner→specialists(parallel, reuse react)→synthesis→postcheck→critique.
- `sse.py` — `astream_sse(graph, inputs, config, done_extra)` → existing SSE frame contract; injects Langfuse callbacks.
- `rerank.py` — FlashRank cross-encoder rerank (F2), wired in `nodes.py rag_node` (retrieve-15→rerank→top-5).
- `tracing.py` — `graph_callbacks()` → langfuse `CallbackHandler` (no-op when off).
- `nodes.py` — grounded-path node fns.

## Endpoints
- **NEW parallel:** `POST /api/v1/agentic/{analyze,agent,orchestrate}` (`api/v1/agentic.py`) — always graph-served, for preview.
- **Live flip (default OFF):** `USE_GRAPH_ANALYZER` / `USE_GRAPH_AGENT` / `USE_GRAPH_ORCHESTRATE` in `config.py`.
  When true, `/analyze`, `/agent/run`, `/agent/orchestrate` route through the graphs (persistence preserved).
  To go live on a surface: set the env flag in `backend/.env`, restart. Revert = unset.

## DONE + validated (live, on the real box)
F0 deps · F1 router/schemas/structured-output/tool-repair · F3 grounded(phi4)+ReAct(devstral)+SSE+checkpointer ·
F4 multi-agent (115s e2e, audit+critique) · F5 typed tools · F6 eval gate (`make eval`/`eval-strict` + `.githooks/pre-push`)
+ Prometheus alerts (`HallucinationFlagsHigh`,`AgentErrorRate`) + **S2 judge exercised** (`an_happy_efficiency_s2`)
+ **per-node Langfuse tracing** · F7 parallel `/agentic/*` (HTTP-smoke 200) + **flip all 3 live surfaces** (TestClient-validated) ·
**F2 reranking** (FlashRank) · bug fix `_num_ctx_for`.

## WHAT'S LEFT (exact next steps)
1. **DeepEval metric (F6.4)** — imports OK (4.0.6). Wire ONE metric (e.g. `FaithfulnessMetric`) with a **local Ollama judge model** (DeepEval supports custom models via a `DeepEvalBaseLLM` wrapper). **Set `DEEPEVAL_TELEMETRY_OPT_OUT=YES`** (it bundles posthog/sentry — zero-egress rule). Validate on one golden answer.
2. **RAGAS (F6.3) — BLOCKED/incompatible:** `import ragas` fails (`langchain_community.chat_models.vertexai.ChatVertexAI` removed in langchain 1.x; RAGAS 0.4.3 hard-imports it). Fixing needs downgrading langchain-community below what langgraph 1.x needs → breaks the stack. **Recommendation: do NOT use RAGAS; the local S2 judge already provides a faithfulness/grounding metric framework-free.** Consider `pip uninstall ragas` to keep the env clean. (This is the ADR-0001 framework-churn risk, realized.)
3. **S2 hard-gate** — currently the judge uses a self-context proxy (`judge_answer(text, text[:1000])` in `tests/eval/runner.py`) so it's a recorded SIGNAL, not a gate. To make `s2_grounded` a real gate: thread the telemetry **summary** into the runner as the judge context (the SSE stream doesn't carry it today — would need the analyzer to emit a summary frame, or the case to embed expected context).
4. **Docling ingestion (F2 tail)** — better manual/table parsing. Heavy (pulls torch). Optional; only matters as the KB grows past 12 chunks. `pip install docling`, swap `scripts/ingest_docs.py` PDF reader.
5. **Decommission old pipeline** — **LAST, after prod soak.** Flip a surface on in prod, watch it, then delete the dead inline code in `analyzer.py`/`agent.py`/`multi_agent.py`. Do NOT delete before soak.

## GOTCHAS (will bite if forgotten)
- **`num_ctx`:** langchain `ChatOllama` defaults `num_ctx=2048` → truncates the ~3.5k-token analyzer prompt → **empty "**" answers**. The router sets it via `_num_ctx_for`. There was a latent bug there: `"3.2:latest"` over-matched `mistral-small3.2:latest` → 4096 → fixed to 8192 (commit in `06aaf78`). Keep `num_ctx` set on any new model construction.
- **Codestral cold-load timeout:** the lone golden fail (`nlq_happy_chiller_1_latest`, `/nl-query`) is a **transient codestral cold-load >35s** under VRAM thrash on the 20 GB box — passes warm (23.8s). Not a regression. Don't "fix" it in code.
- **VRAM co-residency (20 GB box):** gemma4(8)+devstral(14)+phi4(9) ≫ 20 GB → evict/cold-load (~10–20s) on cross-model switches. Multi-agent runs ~115s here. Resolves on the 48 GB prod box. Prefer sequential across roles; specialists share devstral so parallel-specialists is fine.
- **Telemetry/egress:** DeepEval (posthog/sentry) + RAGAS (analytics) phone home by default → set `DEEPEVAL_TELEMETRY_OPT_OUT=YES` / `RAGAS_DO_NOT_TRACK=true`. langfuse = self-hosted only (never LangSmith cloud).
- **Embeddings:** locked to `nomic-embed-text` 768d. NEVER mxbai-embed-large (1024d) → pgvector dim mismatch.
- **Validating a graph over HTTP:** the `:8000` backend must be restarted to expose `/agentic/*` + the flags. To test without that, build a minimal FastAPI app (set `app.state.limiter = limiter` + `RateLimitExceeded` handler) + `TestClient`, or invoke the graph directly via `build_*_graph().ainvoke(...)`.
- **CWD / Windows:** run python from `backend/` so `.env` loads; set `PYTHONIOENCODING=utf-8` (the system prompt has a `⚠` that crashes cp1252 prints); the `aiomysql "Event loop is closed"` traceback at exit is a harmless GC warning. LF→CRLF git warnings are benign.

## How to run / validate
```bash
# Eval gate (needs backend running on :8000):  make backend  (in one shell), then:
make eval                # golden suite (skips if backend down)
# Direct graph validation (no backend needed; from backend/, PYTHONIOENCODING=utf-8):
#   from app.ai.graph.single_agent import build_single_agent_graph
#   await build_single_agent_graph().ainvoke({"question":...,"equipment_id":"chiller_1","hours":6}, {"configurable":{"thread_id":"t"}})
# Flip a live surface: set USE_GRAPH_ANALYZER=true in backend/.env, restart.
```

## The commit discipline in force
One focused feature-commit per task; the plan doc's "Build status" block is updated **in the same commit**.
Co-author footer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
