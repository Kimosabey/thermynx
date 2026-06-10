# Agentic AI — Full Framework Rewrite Plan

> **Decision:** rebuild the agentic AI on a standard open-source framework stack (full rewrite).
> Reverses [ADR-0001](../architecture/decisions/0001-no-ai-orchestration-framework.md); recorded as
> [ADR-0002](../architecture/decisions/0002-adopt-agentic-framework-stack.md).
> **Builds on:** [AI_FRAMEWORK_MIGRATION.md](../planning/ai/AI_FRAMEWORK_MIGRATION.md) (OSS-only, staged, eval-gated).
> **Constraints kept:** open-source only · on-prem · non-Chinese-origin models · zero data egress.

## "Use all frameworks" — what that actually means

You don't run four orchestrators at once. LangGraph, CrewAI, AutoGen and PydanticAI all *compete* for
the same job (agent control flow); stacking them = conflicting abstractions + dependency hell. The
**global-standard** pattern is **one orchestration spine + best-of-breed specialized frameworks
composed around it**. So we adopt a coherent maximal stack:

| Layer | Framework (OSS) | Role | Note |
|-------|-----------------|------|------|
| **Orchestration spine** | **LangGraph** (MIT) | ReAct + multi-agent graph, conditional branching, streaming, checkpoint memory | the one orchestrator |
| LLM interface | **langchain-ollama** `ChatOllama` | keep Ollama; one instance per task-model | per-task routing preserved |
| Structured output | **Pydantic** + `.with_structured_output()` | schema-constrained planner/critique/tool-args | replaces prose-parsing |
| RAG engine | **LlamaIndex** (MIT) | ingestion, indexing, retrieval, reranking | writes to the **same pgvector** |
| Document loaders | **LlamaIndex readers** + **Docling** | PDF/Word/tables/scanned manuals | |
| Tracing | **Langfuse** (self-hosted, MIT) | span-level traces per node/tool | **NOT** LangSmith (cloud/proprietary/egress) |
| Eval | **RAGAS** + **DeepEval** (Apache-2.0) | faithfulness/context/grounding metrics | gates each phase |
| Vector store | **pgvector** | unchanged | |
| Serving | **Ollama** (→ optional **vLLM** later) | unchanged | |

> **Orchestrator alternatives:** if you'd rather the multi-agent spine be **CrewAI** (role-based) or
> **AutoGen** (conversational) or **PydanticAI** (type-safe/lean), we swap *that one layer* — the rest
> of the stack is unchanged. LangGraph is the recommendation (most standard, explicit, on-prem-clean).

## Model routing (from `model-eval/`) — only what the agentic framework needs

The graph's nodes each call a model per task; these eval-backed picks are the model-eval input the
framework strictly needs. F1 wires them as `ChatOllama` instances.

| Role (graph node) | Model | Eval | Note |
|-------------------|-------|------|------|
| Planner | `gemma4:12b` | 4.0 | thinking model → **JSON path only** (blank in tight text); 12B beats 31B |
| Tool executor | `devstral` (24B) | 4.5 | best native tool-caller |
| NL→SQL | `codestral` (22B) | 3.2 | **guards/validator carry it**, not the model |
| Narration / critique / RAG / default | `mistral-small3.2` | 4.5–5.0 | substitute for phi4 (crashes Ollama 0.30.6) |
| Vision | `llama3.2-vision` (11B) | — | |
| Embeddings | `nomic-embed-text` | — | 768-dim, pgvector |

**Runtime constraints the framework must honor (F0/F1):**
- Run on **Ollama 0.30.6** (gemma4 needs it); **keep phi4 off it** → `mistral-small3.2` substitute.
- **gemma4 (planner) stays on the roomy JSON path only** — goes blank under tight word-limits (aligns with our Pydantic structured-output design).
- **Non-Chinese only** — `qwen`/`deepseek`/`qwq` excluded.

> **Not frozen:** the real-data run (`FOLLOWUP_NEW.md`) flags `command-r7b` (validator/narration) +
> `gemma3:12b` (RAG) as candidates the shipped config didn't adopt; **final sign-off is the pending
> Round-3 vLLM/FP8 run**. `ChatOllama` per-role makes any swap trivial — re-confirm before locking.

> **Out of agentic scope (referenced, not duplicated):** hardware/VRAM sizing, co-residency, and
> per-model latency live in `model-eval/reports/ONPREM_HARDWARE_SIZING.md` + `REAL_DATA_MODEL_EVAL.md`
> — an ops/deployment concern.

## Non-negotiable: the safety layer survives the rewrite

THERMYNX's value is that the LLM is guard-railed. The rewrite **keeps** these as **LangGraph nodes**,
not as things a framework hides:

- **Preflight** gates, **post-gen audits**, **self-critique** → graph nodes on every surface.
- **DATA_START/DATA_END** wrapping of tool/RAG content (prompt-injection defense).
- **Per-task model routing**, **non-Chinese-origin** models, **on-prem** inference.
- **Audit trail** tables (`analysis_audit`, `agent_runs`) and the **SSE frame contract** the UI depends on.

If a phase can't preserve these, it doesn't ship.

## Performance (must-hold — measured every phase)

**Reality (`PERFORMANCE_PLAN.md`):** ~80% of slow-path latency is **LLM token generation**, not
platform glue. LangGraph/LangChain add millisecond-level overhead — negligible vs 17–35s generation.
The rewrite's job: **preserve every existing optimization, add parallelism, never regress.**

**Targets (P50):** `/analyze` <15s · `/agent/run` <10s · `/nl-query` <2s · vision <8s. *(Today `/analyze` ~48s and `/agent` ~27s are over target — the rewrite must not worsen them and should help where it can.)*

**Must preserve (else it's a regression):** A1 per-task model right-sizing (the routing table) · A2 response token caps (`OLLAMA_MAX_TOKENS_*`) · A3 Redis answer cache (F1.13) · parallel DB fetches (`asyncio.gather`) + connection pools + tool-payload caps · preflight short-circuit (saves the 30–60s refusal tax).

**Framework adds (genuine wins):**
- **Parallel specialists** — LangGraph runs multi-agent specialists concurrently (vs today's sequential): the biggest latency win in the rewrite.
- **Parallel nodes** — context-fetch ∥ RAG-retrieve as concurrent edges.
- **Stream-first / TTFT** — `astream_events`; expensive context at prompt end (B3).
- **Cheap rerank** — reranker stays CPU-ms (FlashRank), never a new LLM hop.
- **Structured output** removes prose-parse retries (fewer wasted generations).

**Honest ceiling:** LangGraph does **not** speed up inference. Hitting the hard targets needs the
inference-side levers — token caps (done), right-sizing (done), and **vLLM** for throughput (deferred
until concurrency grows). Don't over-parallelize Ollama — it's GPU-bound (queues/OOM, not faster).

**Gate:** every phase measured via `analysis_audit.total_ms` + Prometheus histograms against the
targets; a phase that regresses P50 does not ship (F7 load test is the final check).

---

## Phased full rewrite (each phase eval-gated: 27/27 golden must stay green)

### F0 — Foundations (~2d)
- Add + pin deps: `langgraph`, `langchain-core`, `langchain-ollama`, `llama-index-core`, `llama-index-llms-ollama`, `llama-index-vector-stores-postgres`, `langfuse`, `ragas`, `deepeval`. Build an **offline install bundle** (air-gapped facilities).
- Stand up **Langfuse** self-hosted in `docker-compose` (obs profile).
- Branch + baseline: `pytest tests/eval` = 27/27.

### F1 — Model, structured-output, memory & prompt-registry adapter (~3.5d)
- Wrap each task model as a `ChatOllama` instance (text/tool/sql/planner/auditor) behind a small router — preserves per-task routing.
- Structured output via `.with_structured_output(PydanticSchema)` for planner + critique + tool-args. Retire `json_utils` prose-parsing to fallback-only.
- **Retry/backoff:** retry transient Ollama errors (5xx / timeout) with exponential backoff; treat permanent errors (404 model-missing) as fail-fast. Sits alongside the existing circuit breaker.
- **Memory:** wire a LangGraph **checkpointer** (Postgres/Redis) for durable per-thread state + resumability. **Decision:** thread-scoped memory now; **long-term cross-session memory** is served by the existing pgvector knowledge flywheel (no new store) and revisited only if operators need recall across threads.
- **Prompt versioning (OSS, self-hosted):** manage prompts in **Langfuse prompt registry** (self-hosted, MIT) — versioned, rollback by pin, A/B-capable. Git-tagged fallback if Langfuse is down. Replaces ad-hoc code strings.
- **Answer-cache continuity:** preserve the existing Redis answer cache (60s TTL) as a graph entry check — must not be lost in the rewrite.

### F2 — RAG on LlamaIndex (~3d)
- Reindex the existing `embeddings` (pgvector) through LlamaIndex `PGVectorStore`; ingestion via LlamaIndex readers + **Docling** for manuals; add a **reranker** node-postprocessor.
- **Embedding versioning + reindex procedure:** record the embedding model + dimension as metadata; document a one-command **full reindex** for when the embedding model changes (avoids silent mixed-vector corruption). Keep `nomic-embed-text` for now.
- Parity test: retrieval quality ≥ current on the golden RAG cases.

### F3 — Single-agent ReAct as a LangGraph StateGraph (~3d)
- Nodes: `preflight → context → rag → prompt → llm → tools → postcheck → critique`, conditional edges (e.g. anomaly → root_cause path).
- Map LangGraph streaming to the **existing SSE frame contract** (token / tool_call / tool_result / audit / done). Guards are nodes. Eval gate.

### F4 — Multi-agent as a LangGraph supervisor (~3d)
- Planner node (structured plan) → specialist subgraphs → **per-specialist audit** → synthesis (postchecked + critiqued). Shared state replaces the run-scoped tool cache. Eval gate.
- **Human-in-the-loop interrupts:** use LangGraph `interrupt()` to pause for operator confirmation on sensitive/ambiguous steps (generalizes the work-order approval gate). Operator approves/edits/rejects before the graph continues — a key safety win, near-free with LangGraph.

### F5 — Tools as LangChain tools (~2d)
- Port the 8 HVAC tools to LangChain `@tool`, **keeping** arg validation, equipment allow-list, payload cap, DB timeout, DATA-wrap, and the `propose_work_order` cite-a-number guard + work-order loop. Eval gate.

### F6 — Tracing, eval & live monitoring (~2–3d)
- Langfuse spans across every node/tool. Wire **RAGAS + DeepEval** metrics into the gate; expand golden suite to 50+ incl. agentic scenarios.
- **Automated eval gate (no CI needed):** a **git pre-push hook** runs `make eval` so a regression can't be pushed silently — keeps the no-CI rule while removing reliance on memory.
- **Live quality alerting:** Prometheus + Alertmanager rules on **hallucination-flag rate**, **tool-error rate**, and **refusal rate** (reuses the existing `obs` stack) so production drift pages someone, not just dev-time eval.

### F7 — Shadow, load-test, cutover, runbook & decommission (~4d)
- **Shadow / canary run:** before flipping, run the new LangGraph app **in shadow** alongside the current pipeline on live traffic; diff outputs + audit verdicts; promote only when they match. Stronger than offline parity alone.
- **Load test (OSS):** drive concurrent `/analyze` + `/agent/run` with **Locust** (MIT) — verify no pool exhaustion, stable latency, consistent rate limits before GA.
- Flip endpoints to the LangGraph app **behind the existing `pipeline.py` facade** (API contract unchanged). Run parity + full eval. Remove dead custom orchestration code only after parity holds. Tag release.
- **Operator runbook:** start/stop, reading a Langfuse trace, prompt rollback, audit-flag meanings.
- **Developer doc:** how the graph is structured + how to add a node/tool/specialist.

---

## Task breakdown & ETAs (smallest-task WBS)

Atomic, individually-verifiable tasks. ETAs are focused-engineering days for **one** engineer; with
two, F2–F6 parallelize to ~3 weeks. Every phase ends green on `pytest tests/eval` before the next.

### F0 — Foundations · **2d**
- F0.1 Create `rewrite/agentic-framework` git branch — 0.1d
- F0.2 Add + pin deps in `requirements.txt` (langgraph, langchain-core, langchain-ollama, llama-index-core, llama-index-llms-ollama, llama-index-vector-stores-postgres, langfuse) — 0.25d
- F0.3 Put eval-only deps in `requirements-dev.txt` (ragas, deepeval, giskard, locust) — 0.15d
- F0.4 Build offline wheel bundle + verify air-gapped install — 0.5d
- F0.5 Add Langfuse service to `docker-compose.yml` (obs profile) + env — 0.25d
- F0.6 Boot + reach Langfuse; create project keys — 0.1d
- F0.7 Baseline `pytest tests/eval` → record 27/27 — 0.25d
- F0.8 Confirm per-task models load on the Ollama host — **Ollama 0.30.6** running (gemma4 needs it; phi4 kept off it → mistral-small3.2); VRAM/co-residency sizing is ops (`ONPREM_HARDWARE_SIZING.md`) — 0.4d

### F1 — Model · structured output · memory · prompt registry · **3.5d**
- F1.1 `ChatOllama` factory keyed by task — 0.4d
- F1.2 Map `config.py` routing → instances (text/tool/sql/planner/auditor) — values + rationale come from the Model routing & hardware table (eval-backed); keep the phi4→mistral-small3.2 substitution — 0.25d
- F1.3 Pydantic schema: planner plan — `{rationale, subtasks:[{specialist∈(investigator/optimizer/root_cause/maintenance), goal}]}` (mirrors current `multi_agent.py`, ≤4 subtasks); **no explicit CoT block** (gemma4 thinks internally). *Typed remediation steps `{action,tool,expected_output,fallback}` are a future planner-quality idea (`PLANNER_IMPROVEMENT_PLAYBOOK.md`), not this decomposition schema.* — 0.2d
- F1.4 Pydantic schema: critique verdict — 0.2d
- F1.5 Pydantic schemas: tool-call args — 0.25d
- F1.6 `with_structured_output` for planner — 0.2d
- F1.7 `with_structured_output` for critique — 0.2d
- F1.8 Tool-arg one-shot repair on validation failure — 0.3d
- F1.9 Retry/backoff for transient Ollama errors; fail-fast on 404 — 0.25d
- F1.10 LangGraph checkpointer (Postgres/Redis) — 0.3d
- F1.11 Durable-state test: run resumes after restart — 0.2d
- F1.12 Langfuse prompt registry: migrate prompts + version pin + git fallback — 0.5d
- F1.13 Preserve Redis answer cache as graph entry check — 0.25d
- F1.14 Retire `json_utils` to fallback + unit tests — 0.25d

### F2 — RAG on LlamaIndex · **3d**
- F2.1 Configure `PGVectorStore` over existing `embeddings` table — 0.4d
- F2.2 Read-parity: retrieves same chunks as current `rag.py` — 0.3d
- F2.3 LlamaIndex ingestion pipeline (readers) — 0.4d
- F2.4 Integrate Docling (PDF/tables/scanned manuals) — 0.6d
- F2.5 Semantic chunking config — 0.25d
- F2.6 Reranker postprocessor (FlashRank/bge) — 0.3d
- F2.7 Tune relevance threshold post-rerank — 0.2d
- F2.8 Embedding model+dim metadata on rows — 0.15d
- F2.9 One-command full-reindex script + doc — 0.3d
- F2.10 Parity test: retrieval ≥ baseline on golden RAG cases — 0.1d

### F3 — Single-agent ReAct StateGraph · **3d**
- F3.1 Graph `State` schema — 0.4d
- F3.2 `preflight` node (wrap `preflight.py`) — 0.2d
- F3.3 `context` node (telemetry/analytics) — 0.3d
- F3.4 `rag` node (F2 retriever) — 0.2d
- F3.5 `prompt` node (grounded prompt build) — 0.3d
- F3.6 `llm` node (ChatOllama, structured) — 0.3d
- F3.7 `tools` node + ReAct edge back to `llm` — 0.3d
- F3.8 `postcheck` node (wrap `postcheck.py`) — 0.2d
- F3.9 `critique` node (wrap `critique.py`) — 0.2d
- F3.10 Conditional edges (e.g. anomaly → root_cause) — 0.2d
- F3.11 SSE adapter: stream events → token/tool_call/tool_result/audit/done — 0.3d
- F3.12 Loop robustness: step-limit→partial answer; repeat-call detection — 0.2d
- F3.13 Eval gate green — 0.1d

### F4 — Multi-agent supervisor · **3d**
- F4.1 `planner` node (`gemma4:12b`, **JSON path only** — goes blank in tight text; ~33s background-OK; fallback `mistral-small3.2`; tuning per `model-eval/.../PLANNER_IMPROVEMENT_PLAYBOOK.md`: few-shot + typed steps, no explicit CoT) — 0.4d
- F4.2 Plan validation/repair — 0.3d
- F4.3 Specialist subgraph template (reuse F3) — 0.4d
- F4.4 Supervisor routing to specialists — **run independent specialists in parallel (LangGraph fan-out)** = the main latency win — 0.4d
- F4.5 Shared-state tool-result cache — 0.3d
- F4.6 Per-specialist postcheck before synthesis — 0.3d
- F4.7 Failed-specialist "do not infer" marker — 0.2d
- F4.8 `synthesis` node (postcheck + critique) — 0.3d
- F4.9 HITL `interrupt()` on sensitive steps + resume — 0.3d
- F4.10 SSE re-tag frames with specialist envelope — 0.1d

### F5 — Tools as LangChain tools · **2d**
- F5.1 `@tool` wrappers for the 8 HVAC tools (schemas) — 0.5d
- F5.2 Port equipment allow-list validation — 0.2d
- F5.3 Port payload cap + DATA-wrap — 0.2d
- F5.4 Port DB-level timeout — 0.2d
- F5.5 Port `propose_work_order` cite-a-number guard — 0.2d
- F5.6 Work-order propose → approve (API) → persist — 0.3d
- F5.7 Resolution → `capture_resolution` re-ingest (+dedup) — 0.2d
- F5.8 Tool unit tests + eval gate — 0.2d

### F6 — Tracing · eval · live monitoring · **3d**
- F6.1 Langfuse callback on the graph — 0.3d
- F6.2 Verify spans per node + tool in Langfuse UI — 0.2d
- F6.3 Wire RAGAS metrics into eval runner — 0.3d
- F6.4 Wire DeepEval metrics — 0.25d
- F6.5 Wire S2 LLM-judge into runner (built-not-run today) — **judge runs on a LOCAL model** (on-prem rule; the Claude-Opus grading in `model-eval/` was a one-off offline campaign, not a runtime dep); pass threshold **≥4/5** + deterministic S1 checks — 0.3d
- F6.6 Author new agentic golden cases (27 → 50+) — 1d
- F6.7 `make eval` target (S1 + S2) — 0.15d
- F6.8 git pre-push hook running `make eval` — 0.1d
- F6.9 Prometheus rules: hallucination-flag / tool-error / refusal rate — 0.25d
- F6.10 Alertmanager routing to a real receiver — 0.15d
- F6.11 Giskard safety scan job (optional) — 0.5d

### F7 — Shadow · load-test · cutover · docs · decommission · **4d**
- F7.1 Shadow harness: new graph alongside current pipeline on live traffic — 0.6d
- F7.2 Output + audit diff logger; review mismatches — 0.4d
- F7.3 Locust scripts (`/analyze` + `/agent/run`) — 0.3d
- F7.4 Run load test; verify pool/latency/rate-limit against eval-run baselines (planner ~33s, executor ~72s, RAG ~11s, validator ~2s) and timeouts (`OLLAMA_CHAT_TIMEOUT_S`=60, `OLLAMA_STREAM_TIMEOUT_S`=120, `NL_QUERY_LLM_TIMEOUT_S`=40) — 0.2d
- F7.5 Flip endpoints behind `pipeline.py` facade (feature flag) — 0.4d
- F7.6 Full parity + eval run post-flip — 0.3d
- F7.7 Remove dead custom orchestration code (after parity) — 0.5d
- F7.8 Operator runbook — 0.5d
- F7.9 Developer doc (graph structure; add a node/tool/specialist) — 0.5d
- F7.10 Tag GA release — 0.3d

**Total: ~23.5 engineer-days ≈ 4.5–5 weeks solo / ~3 weeks with two engineers.** Each phase is
independently revertible behind the `pipeline.py` facade.

---

## Risks & mitigations (honest)

| Risk | Mitigation |
|------|------------|
| **LangChain API churn** (broke 4× in 18mo) | Pin exact versions; isolate behind a thin adapter; upgrade only on a branch with the eval gate |
| **Debugging indirection** (vs the print-debuggable 200-line loop) | Langfuse span traces per node/tool restore visibility |
| **Dependency bloat / air-gap installs** | Lockfile + pre-built offline wheel bundle; keep eval-only deps (RAGAS/DeepEval) in a `dev` extra |
| **Latency overhead** from framework layers | Measure each phase against `PERFORMANCE_PLAN.md`; reject regressions |
| **Losing the guard layer** | Guards are first-class graph nodes; phase doesn't ship without them |
| **Rewriting working code** | Parity tests + 27/27 eval gate before any custom code is deleted |

## What is explicitly still excluded (per OSS / on-prem rule)

- **LangSmith cloud**, OpenAI/Anthropic/Gemini APIs, Pinecone/Weaviate cloud — any proprietary or
  data-egress component. Tracing is Langfuse self-hosted only.

## Verification

- Every phase: `pytest tests/eval` 27/27 + manual smoke on `/analyze`, `/agent/run`, `/nl-query`.
- F6 onward: RAGAS/DeepEval metrics tracked; agentic golden ≥ baseline.
- F7: full parity vs current behavior before decommissioning custom code; Langfuse shows end-to-end spans.

---

## Capabilities & acceptance the rewrite must deliver (consolidated)

These are the behaviors the new graph must satisfy — carried over so nothing is lost from the earlier breakdown.

| # | Capability | Maps to phase | Acceptance |
|---|-----------|---------------|------------|
| 1 | Groundedness audit on **every** surface incl. multi-agent synthesis | F3, F4 | ungrounded number in any answer is flagged; audit SSE frame emitted uniformly |
| 2 | Schema-constrained planner / critique / tool-args | F1 | no prose-parse failures; malformed tool-args repaired once, run completes |
| 3 | Resilient loop — partial answer, no dead-ends | F3 | step-limit / repeat-loop returns best partial answer, never an error frame |
| 4 | Multi-agent quality — plan validation, per-specialist audit, shared cache | F4 | invalid plan repaired; specialists reuse cached tool results; failed specialist marked |
| 5 | Agentic RAG — rerank, structured ingest, citations, flywheel dedup | F2 | reranked retrieval ≥ baseline on golden cases; no duplicate incident chunks |
| 6 | Closed work-order loop (propose → approve → re-ingest) | F5 | approved WO persists; resolution retrievable next time; never auto-created |
| 7 | Agentic eval gate (golden + S2 judge + metrics) | F6 | `make eval` runs S1+S2; broken prompt fails the gate |
| 8 | Human-in-the-loop interrupts on sensitive steps | F4 | graph pauses; operator approves/edits/rejects before continuing |
| 9 | Durable memory + resumable runs | F1 | a run survives a restart; thread context persists |
| 10 | Live quality alerting (drift in prod) | F6 | hallucination-flag / tool-error / refusal-rate alerts fire via Alertmanager |

## Operations & ownership (process, not code)

- **Pre-push eval hook** — `make eval` runs on `git push`; red = blocked. (F6)
- **Knowledge-base curation** — owner + cadence for refreshing HVAC manuals and re-ingesting; the WO flywheel handles incident memory automatically. *(assign an owner)*
- **Golden-dataset curation** — owner adds a new eval case whenever a prompt/behavior changes or a real miss is found. *(assign an owner)*
- **Operator runbook** — write at **F7**: start/stop the agent, read a Langfuse trace, roll back a prompt, what each audit flag means.

## Governance & security

- **Threat model:** the agentic stack maps to [SECURITY_PLAN.md](../planning/ai/SECURITY_PLAN.md) (OWASP-LLM-Top-10); injection defended by DATA-wrapping + preflight, automated probing by **Giskard** (OSS).
- **Data handling:** operational telemetry only — **no PII**; nothing leaves the facility (on-prem, zero egress). Stated explicitly, not assumed.
- **Decisions:** governed by [ADR-0002](../architecture/decisions/0002-adopt-agentic-framework-stack.md) (supersedes ADR-0001).
- **Licensing (software only):** all *software* in the stack is OSI open-source — MIT/Apache/BSD (Langfuse **self-hosted only**; Redis → pin BSD-7.x or **Valkey**). **Model picks are settled per `model-eval/` and kept as-is** — model selection is out of scope for this rewrite.

## Spine decision

**Spine = LangGraph** (chosen). CrewAI / AutoGen / PydanticAI are swappable for that single layer only;
the rest of the stack is unchanged. Begin at **F0**.
