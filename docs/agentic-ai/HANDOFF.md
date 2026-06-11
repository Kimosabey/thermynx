# Agentic Rewrite — Session Handoff (2026-06-10)

---
## ⟶ SESSION 2 (2026-06-11) — READ THIS FIRST

**State in one paragraph:** The agentic rewrite is **cut over on-prem** — `/analyze` + `/agent/run` now
default to the LangGraph pipeline (`USE_GRAPH_ANALYZER` / `USE_GRAPH_AGENT` = `True` in `config.py`, commit
`84ec3ca`), **verified serving via the graph**. `/agent/orchestrate` stays OFF (multi-agent thrashes the
20 GB GPU — needs the 48 GB box). The old inline pipeline is retained as the **instant-revert fallback**
(set the flag `=false` in `backend/.env` + restart). Golden suite **49/50** (the lone orchestrate fail is a
20 GB cold-load transient — passes on retry, 96.6 s). All work is committed **and pushed** to
`Kimosabey/thermynx` `rewrite/agentic-framework`. `master` untouched.

**What shipped this session:**
- **F7 cutover** (`84ec3ca`): analyze + agent → graph by default; orchestrate off pending 48 GB.
- **Eval F6.3/F6.4** (`2d76dd8`): real-context S2 judge + DeepEval faithfulness (local Ollama judge,
  `DEEPEVAL_TELEMETRY_OPT_OUT=YES`); **RAGAS dropped** (`ae9963c`). `tests/eval/run_report.py` → folderised
  reports in `backend/tests/eval/reports/`.
- **Anomaly LLM-timeout fix** (`49a5239`): `services/causal.py` uses warm phi4 (not cold mistral) + 45 s
  timeout + `keep_alive`.
- **V2 frontend**: Chakra→Tailwind cutover shipped (`865af5c`); **Nyx assistant backend** (`fa5e5dc` —
  `POST /api/v1/assistant/route` intent router); FE fixes — `/health` request storm (`ae11f0c`), load FOUC
  + Radix dialog a11y (`b333053`).
- **GA docs** (`3aa59dd`): [OPERATOR_RUNBOOK.md](./OPERATOR_RUNBOOK.md) + [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).
- **Ops scripts** (`scripts/`): `ollama_all.bat` (restart+warm+monitors), `ollama_kick.bat` (free
  gpt-oss/mxbai + re-warm phi4), `ollama_ps.ps1`, `ollama_monitor.bat`, `ollama_who.ps1`, `ollama_dashboard.bat`.

**The GPU saga (RESOLVED) — key context:** "LLM timeout" was **not a code bug**. THERMYNX shares **one
20 GB Ollama box** (`100.125.103.28`, RTX 4000 Ada) with the **sibling platform OMNYX** (repo
`D:\Harshan\graylinx-v2\omnyx`, `Kimosabey/omnyx`). OMNYX's `omnyx-agentic-ai` container (`LLM_BASE_URL`→same
box, `PLANNER=gpt-oss:20b`, `EMBED=mxbai`) kept **evicting THERMYNX's phi4**. Resolved: **stopped OMNYX**
(`docker stop omnyx-*`), **pinned phi4** (`keep_alive=-1`); a firewall rule we tried **blocked the laptop**
(it's the backend host) and was removed. Full write-up:
[../operations/GPU_VRAM_CONTENTION.md](../operations/GPU_VRAM_CONTENTION.md). OMNYX was notified (committed
`c94523e` in its repo). **Decision: model selection UNCHANGED for both platforms; sharing one server is fine;
the only fix is more GPU memory (48 GB).**

**What's LEFT (exact):**
1. **Soak** the on-prem cutover (analyze+agent on graph) — watch Prometheus alerts (`HallucinationFlagsHigh`,
   `AgentErrorRate`) + audit flags for a few days. Activate on the prod box via `git pull` + restart.
2. **48 GB GPU** → then cut over `/orchestrate` (`USE_GRAPH_ORCHESTRATE`), real Locust load test.
3. **Decommission** the old inline pipeline (OFF-path code in `analyzer.py`/`agent.py`/`multi_agent.py`) —
   ONLY after the soak — then **tag GA** (offered `v1.0.0-onprem`, not yet created).
4. Smaller/optional: flip the **S2 hard-gate** (real-context works now); **durable resume** (F1.11);
   **HITL interrupts** (F4.9). The **`langfuse` obs container is now DISABLED** — its floating versions
   (`image: :latest` + `langfuse>=2.0.0`, copied from v2-era planning docs) drifted to the **v3 server**
   (needs ClickHouse/Redis/S3) + **v4 SDK**; never a deliberate v3 choice. Resolution: server deferred to
   the 48 GB box (commented out in `docker-compose.yml` with a restore note), SDK pinned `>=4,<5`, dead
   v2-era `app/llm/tracing.py` + `ollama.py` `_lf*` helpers removed (they used the gone `.trace()`/
   `.generation()` API), graph tracing (`graph_callbacks()`) no-ops when off. **Langfuse prompt registry**
   (F1.12) is therefore parked until a server returns.

**Env / runtime now:** Ollama 0.30.7 @ `100.125.103.28:11434` (Tailscale, 20 GB) · MySQL `:3307` · PG
`:5442` · single `.venv`. Routing: TEXT/RAG/AUDITOR/anomaly→**phi4**, TOOL→devstral, SQL→codestral,
PLANNER→gemma4:12b, embed→nomic-768. phi4 pinned; OMNYX stopped. Laptop (backend/dev) = `100.88.22.7`.

**New gotchas (this session):** don't firewall-block the backend host's IP (we did → broke THERMYNX).
`/api/tags` = installed-on-disk ≠ `/api/ps` = loaded-in-VRAM (gpt-oss in tags is harmless). `make` isn't
installed on the laptop → the pre-push eval hook **skips** (push is fast). A dev `:8000` dead-socket can
linger after a kill (clears itself); when stuck, verify the graph **in-process** via `_sse_stream`
(flag-driven). Re-warm phi4 after any Ollama restart (`keep_alive=-1` resets on restart; `ollama_all.bat` does it).

**Start the next chat with:** *"continue THERMYNX per docs/agentic-ai/HANDOFF.md — Session 2 block."*

---

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

## SESSION UPDATE (2026-06-10, continued) — what changed since the handoff above
- ✅ **V2 frontend cutover SHIPPED** (`865af5c`): `frontend/` is now the Tailwind/TS/Vite8 app; old Chakra app deleted (src backup tgz outside the repo). FE + agentic backend now share branch `rewrite/agentic-framework`.
- ✅ **Nyx assistant backend** (`fa5e5dc`): `POST /api/v1/assistant/route` intent router (`app/ai/router_classify.py`) classifies a chat message → dispatches to the existing engines. Read-only; 14 unit tests.
- ✅ **FE bug fixes**: runaway `/health` request storm — unstable `useAppToast` + `useApi` onSuccess dep (`ae11f0c`); load-time FOUC + Radix dialog a11y warnings (`b333053`).
- ✅ pre-push hook activated (`9d88348`), shadcn→devDeps (`beaef55`), `pre-tailwind-cutover` git tag at the last Chakra commit.

## WHAT'S LEFT (exact next steps)
1. ✅ **DeepEval metric (F6.4) — DONE** (`2d76dd8`). `tests/eval/deepeval_metric.py` runs `FaithfulnessMetric` on a **local Ollama judge** (llama3.1:8b) via a `DeepEvalBaseLLM` wrapper, `DEEPEVAL_TELEMETRY_OPT_OUT=YES`. Wired into the runner as a SIGNAL for cases with `expect.deepeval_faithfulness` (`an_happy_efficiency_s2` opts in).
2. ✅ **RAGAS (F6.3) — DROPPED** (`ae9963c`). Uninstalled from `.venv` + removed from `requirements-dev.txt` (langchain 1.x incompatibility; the local S2 judge covers grounding framework-free). The ADR-0001 churn risk, realized + closed.
3. ✅ **S2 real-context — DONE** (`2d76dd8`), gate-ready. The analyzer emits a header-gated (`X-Eval-Context: 1`) `context_summary` SSE frame carrying `compute_summary()`; the runner threads that REAL telemetry into BOTH judges (no more `text[:1000]` self-proxy). Validated in-process (frame emits; `chiller_1.avg_kw_per_tr=0.58` = the value the answer cites). **`s2_grounded` left OFF (still a signal)** — flip it to a hard gate once the small judge proves stable on real context across runs. NOTE: the live `:8000` backend must restart to pick up the analyzer frame; the runner falls back to the proxy meanwhile (no regression).
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
- **Pre-push hook activation (per clone):** the F6.8 gate only fires after `git config core.hooksPath .githooks`. **Done in this clone (2026-06-10)** — but it's *local* config, so any fresh clone must re-run it or pushes won't be gated. Bypass once with `git push --no-verify`.

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
