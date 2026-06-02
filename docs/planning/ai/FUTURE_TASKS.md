# Future tasks — AI platform backlog

**Status:** Living document — add items here when they're real but not yet scheduled.
**Rule:** Every item must have a trigger condition (why now?), an effort estimate, and a link to the relevant plan doc.
**Open-source constraint:** All tools and libraries must be MIT / Apache-2.0 / BSD. See [AI_FRAMEWORK_MIGRATION.md](./AI_FRAMEWORK_MIGRATION.md).
**Last updated:** 2026-06-02 · **Eval baseline:** 27/27 cases passing · **Latest commit:** `105990a`

### Quick-pick for next session
Start here — top item from the highest priority group:
> **🔴 #1 — Typo-tolerant equipment matching** (1h) — biggest safety gap, cheapest fix.
> After that: **🟡 #5 — Agent UI audit panel** (3h) — most demo-visible gap remaining.

---

## How to use this doc

- Items are grouped by area, ordered by impact within each group.
- Pick the top item from the highest-priority area when starting a new session.
- When you start an item, move it to "In progress" and link the branch/commit.
- When done, move to "Completed" at the bottom with the commit hash.
- Add new items at the top of the relevant group — don't append to the bottom.

---

## 🔴 Must-do (high blast-radius if skipped)

### AI guardrails
- [ ] **T1-D: pre-flight equipment regex hardening** — fuzzy match for typo'd equipment names (e.g. "chillor 1" → "chiller_1") using `difflib.get_close_matches(cutoff=0.82)`. 1h. [HALLUCINATION_ROADMAP.md §T3-G](./HALLUCINATION_ROADMAP.md)
- [ ] **T1-E: NL-SQL column validator** — reject SELECT statements referencing unknown columns (power_factor, voltage, etc.) at the validator level, not just in the prompt. 1h. Uses `sqlparse`. [HALLUCINATION_ROADMAP.md §T2-E](./HALLUCINATION_ROADMAP.md)

### Eval suite
- [ ] **Eval Phase 2: expand from 27 → 50+ cases** — add paraphrase variants, multi-clause questions, all 6 equipment types in agent mode, all 5 agent modes in happy-path. 1d. [EVALUATION_PLAN.md](./EVALUATION_PLAN.md)
- [ ] **Pre-commit hook: run fast eval subset on prompt/agent file changes** — block commit if `prompts/hvac_prompts.py` or `services/agent.py:_COMMON_RULES` changes fail the 10 refusal cases. 1h. [EVALUATION_PLAN.md](./EVALUATION_PLAN.md)

---

## 🟡 Agent UX parity (next planned session)

These are from [AGENT_UX_AND_EVAL_LOCKIN.md Part B](./AGENT_UX_AND_EVAL_LOCKIN.md):

- [ ] **Agent UI audit panel** — emit SSE `audit` frame from `/agent/run` and `/agent/orchestrate` (same `run_postcheck()` the analyzer uses). Wire `AuditPanel` component below agent answer and orchestrator synthesizer. ~3h total.
  - Backend: `api/v1/agent.py` — add postcheck after final tokens collected
  - Frontend: `useAgentStream.js` — capture `audit` frame into `agentAudit` state
  - Frontend: `AgentRunner.jsx` + `MultiAgentRunner.jsx` — render `<AuditPanel>`
- [ ] **Human-in-loop approve UI for work orders** — `propose_work_order` tool returns a draft; UI doesn't show an approve/reject button yet. ~2h. Wire into `AgentRunner.jsx` — when trace contains a `propose_work_order` result with `status: "proposed"`, show a card with "Approve → create WO" and "Dismiss" buttons calling `/api/v1/work-orders`.
- [ ] **Per-tool Prometheus metrics** — `agent_tool_calls_total{tool, status}` + `agent_tool_duration_seconds{tool}`. 1h. Add to `services/agent.py` around `execute_tool()`.

---

## 🟡 Framework migration (trigger-gated — open-source only)

See [AI_FRAMEWORK_MIGRATION.md](./AI_FRAMEWORK_MIGRATION.md) for the full plan and trigger conditions.

### Stage 1 — vLLM (trigger: >10 concurrent users OR <5s agent SLA)
- [ ] **Replace Ollama with vLLM** — Apache-2.0, OpenAI-compatible API, 10× throughput. `llm/ollama.py` → `llm/openai_compat.py`. Run 27-case eval before + after. 2d.
  - Linux Docker on the Ollama host: `docker run --gpus all vllm/vllm-openai:latest --model Qwen/Qwen2.5-14B-Instruct`
  - Same model weights, same on-prem, zero data egress

### Stage 2 — Langfuse self-hosted tracing (trigger: need per-tool-call debug)
- [ ] **Add Langfuse to docker-compose.yml** — MIT license, runs alongside Grafana/Prometheus. Add span wrappers in `llm/ollama.py` and `domain/tools.py`. 1d.
  - Self-hosted only — never use LangSmith cloud (proprietary, data egress)

### Stage 3 — LangGraph agent loop (trigger: need conditional branches)
- [ ] **Replace flat ReAct loop with LangGraph StateGraph** — MIT, local Python, no cloud. `services/agent.py` → `ai/surfaces/agent.py` as a StateGraph. 2d.
  - Enables: "if anomaly found → root_cause branch, else → brief branch"
  - The `app/ai/pipeline.py` facade means API endpoints don't change

### Stage 4 — LangChain document loaders (trigger: need PDF/Word/SharePoint ingest)
- [ ] **Replace manual `services/ingest.py` chunker with LangChain loaders** — MIT. `PyPDFLoader`, `UnstructuredWordDocumentLoader`, etc. 1d.
  - Same pgvector backend, same nomic-embed-text embedder, same retrieval

### Stage 5 — Langfuse prompt management (trigger: multi-facility deployment)
- [ ] **Migrate prompts to Langfuse prompt hub** (self-hosted, MIT) — version pinning, rollback, non-engineer UI. Already available if Stage 2 is done. 0.5d.
  - Alternative: git-based `prompts/hvac_prompts_v1.py` + `settings.PROMPT_VERSION` (no new infra)

---

## 🟡 Reliability

From [RELIABILITY_PLAN.md](./RELIABILITY_PLAN.md):

- [ ] **R2: Audit row buffering** — if Postgres unreachable during `/analyze`, buffer `analysis_audit` row to `logs/audit-buffer.ndjson`; drain on recovery. 4h.
- [ ] **R3: Smart Ollama retry** — on 500 "model is loading", wait 5s and retry once. On 503, wait 2s. Cap at 1 retry. 2h.
- [ ] **R5: SSE resume on reconnect** — track last token sequence number; on frontend reconnect, send `?resume_from=N` to replay from audit row. 4h.
- [ ] **Chaos test harness** — scripted tests for: Ollama down, MySQL down, Postgres down, mid-stream disconnect. 4h. Docs: [RELIABILITY_PLAN.md DR section](./RELIABILITY_PLAN.md)

---

## 🟡 Evaluation quality

From [EVALUATION_PLAN.md](./EVALUATION_PLAN.md):

- [ ] **Eval S2: LLM-as-judge** — second LLM call judges whether each claim in the answer is semantically grounded in the context. Use local `llama3.1:8b` as the judge (different from the answer model to avoid bias). Apache-2.0. 4h.
- [ ] **Eval S3: numeric reference comparison** — for "Is chiller 1 efficient?" cases, compute the answer in Python (`analytics/efficiency.py`) and compare the kW/TR the LLM cited against the ground truth. Flags any number >5% off. 6h.
- [ ] **Eval JSON run report + diff** — save each run as `tests/eval/runs/<timestamp>.json`; CLI to diff two runs and flag regressions. 3h.
- [ ] **Operator feedback loop** — 👍/👎 button in analyzer UI → `analysis_audit.operator_verdict` field → weekly review queue → failed answers become new eval cases. 4h frontend + 1h backend.

---

## 🟡 Security (deferred by user, not urgent for POC)

From [SECURITY_PLAN.md](./SECURITY_PLAN.md):

- [ ] **Startup secret validation** — refuse to boot if `DB_PASSWORD="changeme"` or `API_KEYS=""` outside `ENV=dev`. 1h.
- [ ] **`pip-audit` + `npm audit` in CI** — weekly automated scan for high/critical CVEs. 1h.
- [ ] **HTTPS termination** — nginx/Caddy reverse proxy with self-signed cert for on-prem. 2h.
- [ ] **Per-API-key rate limiting** — currently per-IP via slowapi. Move to per-API-key once auth lands. 1h.

---

## 🟢 Performance optimisations

From [PERFORMANCE_PLAN.md](./PERFORMANCE_PLAN.md):

- [ ] **A3: Redis response cache** — cache `(question, equipment_id, hours, window_end)` → answer for 60s TTL. Repeated identical questions become <100ms. 4h.
- [ ] **B2: Prompt compression** — drop equipment sections with no data; skip conversation history messages older than 4 turns. Reduces prompt-eval time ~20%. 2h.
- [ ] **B3: Stream-first prompt design** — move large context (RAG chunks, equipment tables) to end of prompt. Improves TTFT (time to first token). 1h.

---

## 🟢 Observability

- [ ] **Grafana panel for `hallucination_flags_total`** — time-series of numeric/equipment/citation/language flags per hour. Wire into Phase 10B dashboard. 2h. [PHASE_10B_HALLUCINATION_DASHBOARD.md](../phases/PHASE_10B_HALLUCINATION_DASHBOARD.md)
- [ ] **Agent step latency breakdown** — `agent_tool_duration_seconds{tool}` histogram in Grafana. Shows which tools are slow (which aids vLLM migration decision). 1h.
- [ ] **Model usage tracking** — `ollama_model_calls_total{model, task}` counter so we can verify the right model fires for each task. 1h.

---

## 🌱 Longer-horizon (post multi-facility)

- [ ] **LoRA fine-tune on operator-labeled data** — once 6+ months of 👍/👎 feedback is collected, fine-tune `llama3.1:8b` on HVAC Q&A. Tooling: `unsloth` (Apache-2.0) or `axolotl` (Apache-2.0). 1-2wk. [AI_FRAMEWORK_MIGRATION.md](./AI_FRAMEWORK_MIGRATION.md)
- [ ] **RAG embedding fine-tune** — fine-tune `nomic-embed-text` on HVAC corpus + retrieval logs. Better retrieval quality without touching the answer model. 6-12h GPU. [AI_FRAMEWORK_MIGRATION.md](./AI_FRAMEWORK_MIGRATION.md)
- [ ] **Multi-tenant prompt + tool partitioning** — when deploying to a second facility (e.g. Varanasi Airport), EQUIPMENT_CATALOG, system prompts, and knowledge base must be per-tenant. 1-2d. [SECURITY_PLAN.md](./SECURITY_PLAN.md)
- [ ] **Real file reorg into `app/ai/`** — Option B from [AI_PIPELINE_REORG.md](./AI_PIPELINE_REORG.md). Moves 20 files into pipeline-structured subfolders. 3-4h. Gate: 27-case eval green before + after.
- [ ] **Canary prompt deploys** — shadow-run new prompts on 10% of traffic, compare audit-flag rates, auto-promote if clean for 24h. ~1wk. Needs multi-instance deployment.
- [ ] **OpenTelemetry spans** — full distributed tracing via Grafana Tempo (Apache-2.0, self-hosted). Per-step: prompt-build → LLM call → tool execution → postcheck. 0.5d.

---

## ✅ Completed (with commit)

### Session 2 — 2026-06-02 (this session)

| Item | Commit | What it does |
|---|---|---|
| Analytics TR<10 outlier filter | `301e1ad` | chiller_2 kW/TR fixed 4.526 → 0.541 (excellent). All 6 agentic surfaces correct now. |
| Analyzer tower/pump/no-selection regression fix | `59cd4b7` | Was 500 "Telemetry unavailable" — SQLAlchemy concurrent-session bug. Fixed with per-task sessions in `asyncio.gather`. |
| T2-I premise verification | `0ea08ae` | Agent refuses to generate diagnoses for events the data doesn't confirm (Thai spike case). |
| Eval Part A lock-in — 6 new cases | `5b87232` | Tower/pump/no-selection/outlier-filter all pinned. Rate limit bumped 10→30/min. |
| English-only output hardened — Thai bug fixed | `3d9decc` | English-only rule promoted to first block of all prompts. `audit_language()` postcheck added. 27/27. |
| Per-equipment + per-mode chip templates | `0650483` | Chips switch based on equipment dropdown + agent mode. New `frontend/src/shared/ai/promptTemplates.js`. |
| Model right-sizing defaults | `5f8b38e` | `OLLAMA_MODEL_TOOL=llama3.1:8b`, `OLLAMA_MODEL_SQL=llama3.1:8b`, `OLLAMA_AUDITOR_MODEL=llama3.2:latest`. |
| Ollama MAX_LOADED_MODELS=3 + pre-warm | `0eb5702` | 3 models hot: qwen2.5:14b + llama3.1:8b + llama3.2:latest. Pre-warm step in restart script. |
| AI pipeline facade | `d337558` | `backend/app/ai/pipeline.py` — re-exports all AI symbols in execution order. Navigation-as-code. |
| Model sizing ADR | `331a4c2` | Locked the qwen2.5:14b + llama3.1:8b + llama3.2:latest decision with alternatives + trigger conditions. |
| Framework migration plan | `e5b1736` | 5-stage open-source-only plan: vLLM → Langfuse → LangGraph → loaders → prompt mgmt. |
| Open-source mandate locked in | `107f993` | Added ⚠️ OSS-only constraint to AI README + full exclusions list to migration plan. |
| Future tasks master backlog | `105990a` | This doc — all 36 pending tasks in one place with effort estimates. |
| Demo script | `61c7a4c` | 12-min live demo with pre-flight checklist, 12-question Q&A cheat sheet, failure recovery. |
| AI manual test plan | `38aaf43` | 80+ UI test cases across Analyzer, Agent, Orchestrator, NL Query, Vision, Frontend. |

### Session 1 — 2026-05-28

| Item | Commit | What it does |
|---|---|---|
| Tier 1 hallucination guardrails (T1-A → T1-E) | `75c51fd` + `5d2762b` | Read-only, injection-resist, RAG-as-data, preflight regex, fixed benchmarks. All 6 surfaces. |
| Tier 2 prompt pins (T2-A → T2-H) | `4c38d1a` | Data-window pin, current-focus pin, no-cross-type, no-recompute, column allow-list, action-verb, wall-of-text, force English. |
| Tier 3 post-gen audits (numeric + equipment + citation) | `4c38d1a` | `services/postcheck.py` + Prometheus `hallucination_flags_total`. |
| Analyzer UI audit panel + citation drawer | `4fc0242` | `AuditPanel.jsx` below every analyzer answer. Collapsible, opens on flags. |
| Reliability R1 — Ollama circuit breaker | `4fc0242` | 3 failures / 30s → open for 60s. `circuit_state()` in `/health`. |
| Reliability R4 — health-degraded UI banner | `4fc0242` | Red/amber banner on `/ai`, `/nl-query`, `/vision` when Ollama down or breaker open. |
| Performance T1 — model right-sizing scaffolding | `4d2b0c9` | Config settings + `num_predict` plumbed through all Ollama call sites. |
| Eval harness Phase 1 | `48e7b8c` | pytest parametrized, S1 deterministic, skip-on-unreachable. 17 initial cases. |
| Action-verb regex tolerates articles | `7daf008` | "create **a** work order" now caught. `_FW` filler-word group. |
| AI doc set reorganized into `planning/ai/` | `26ef57a` + `1f23e45` | 9 docs: GUARDRAILS, CASES, DEFENSES, ROADMAP, PERFORMANCE, RELIABILITY, SECURITY, EVALUATION, README. All cross-linked. Tier 1/2/3 marked 🟢. |
