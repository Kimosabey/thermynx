# AI roadmap and backlog — Graylinx

**Audience:** Developers prioritizing Analyzer, Agents, RAG, and LLM infra before broader platform polish.

**How to use this doc**

| Use this doc for… | Use instead… |
|-------------------|----------------|
| **What to do next on AI features** — ordered backlog | Everything else is secondary until you carve time |
| **What we recently shipped on AI paths** — quick recap | Deep design: [AI_ARCHITECTURE_REFERENCE.md](../architecture/AI_ARCHITECTURE_REFERENCE.md), [AGENT_REFERENCE.md](../reference/AGENT_REFERENCE.md) |
| **Deferring platform non-AI work** — reminders | Severity-ranked full list: [FLAWS_AND_IMPROVEMENT_PLAN.md](./FLAWS_AND_IMPROVEMENT_PLAN.md) (especially §1A reconciliation vs open items) |

**Last updated:** 2026-05-14 — refresh after each AI-focused sprint.

---

## 1. Recently completed (AI-related)

Approximate chronological cluster from the “Phase A/B/C platform upgrade” work and earlier fixes:

- **Operations Dashboard empty state (Strict Mode)** — [`frontend/src/shared/hooks/useApi.js`](../../frontend/src/shared/hooks/useApi.js) generation counter so aborted fetches cannot permanently skip loads; Vitest regression in [`frontend/src/shared/hooks/useApi.test.jsx`](../../frontend/src/shared/hooks/useApi.test.jsx).
- **Agent ReAct robustness**
  - **Multiple `tool_calls` per LLM turn** executed in one iteration; single assistant message retains full `tool_calls` list before appending parallel `tool` results — [`backend/app/services/agent.py`](../../backend/app/services/agent.py).
  - **Bounded tool payloads** injected into conversation history — [`backend/app/domain/agent_payload.py`](../../backend/app/domain/agent_payload.py) (`compact_agent_tool_payload`), wired in [`backend/app/services/agent.py`](../../backend/app/services/agent.py); tests stub in [`backend/tests/test_agent_payload.py`](../../backend/tests/test_agent_payload.py).
  - **RAG-style tool surfaced as `search_knowledge_base`** (executor alias **`retrieve_manual`** retained for older model/tool names) — [`backend/app/domain/tools.py`](../../backend/app/domain/tools.py).
  - **`ToolContext`** on `execute_tool(..., ctx=...)` reserved for pooled DB / tenancy — [`backend/app/domain/tools.py`](../../backend/app/domain/tools.py).
  - **30 s per-tool timeouts** unchanged; **Ollama down** surfaced as SSE error via **`OllamaUnavailableError`** from chat/stream paths — [`backend/app/llm/ollama.py`](../../backend/app/llm/ollama.py), [`backend/app/services/agent.py`](../../backend/app/services/agent.py).
  - **`AppError`** path on [`backend/app/api/v1/agent.py`](../../backend/app/api/v1/agent.py) SSE stream failures (when raised through the iterator).
  - Frontend trace labels **`search_knowledge_base`** (+ legacy **`retrieve_manual`**) — [`frontend/src/features/agent/AgentRunner.jsx`](../../frontend/src/features/agent/AgentRunner.jsx), [`frontend/src/shared/ui/TraceStep.jsx`](../../frontend/src/shared/ui/TraceStep.jsx).
- **Analyzer**
  - **MySQL / telemetry unavailable** yields **`TelemetryUnavailableError`** detail via SSE and **stops before** prompting the LLM; audit row closed with error — [`backend/app/api/v1/analyzer.py`](../../backend/app/api/v1/analyzer.py).
  - **Ollama unavailable** distinct user-facing SSE path — same file + [`backend/app/llm/ollama.py`](../../backend/app/llm/ollama.py).
  - **Persist user message before streaming** and **assistant after stream** when `thread_id` is present — unchanged pattern, still the contract for threaded conversations.
- **Optional API gate** — **`API_KEYS`** + middleware in [`backend/main.py`](../../backend/main.py); browser **`X-API-Key`** via **`VITE_API_KEY`** — [`frontend/src/shared/api/client.js`](../../frontend/src/shared/api/client.js), **`useApi`** uses **`apiFetch`**.

---

## 2. AI — do next (prioritized)

Tackle roughly in order; each bullet can be its own PR.

### 2.1 Reliability and parity

| Priority | Item | Notes |
|---------|------|--------|
| P1 | **Broader `AppError` adoption** beyond analyzer/agent hot paths | Map MySQL/Ollama/Redis failures consistently in routers; avoid generic 500 where a typed [`backend/app/errors.py`](../../backend/app/errors.py) message helps UI and ops |
| P1 | **SSE error shape parity** (`type: error`) | Ensure `detail` and `request_id` always mirror JSON error conventions from [`backend/main.py`](../../backend/main.py) `AppError` handler where applicable |
| P2 | **Long-stream behaviour** | Optional capped wall-clock cancellation for `/analyze` and `/agent/run` when Ollama streams hang without `done`; document limits in RUNBOOK |

### 2.2 Answer quality / context

| Priority | Item | Notes |
|---------|------|--------|
| P1 | **Per-tool compaction** (“smart shrink”) | Reduce raw JSON inside tools (e.g. hourly rollup for **`get_timeseries_summary`**) in [`backend/app/domain/tools.py`](../../backend/app/domain/tools.py) rather than relying only on global compaction after execution |
| P2 | **Second-pass summarize** | Optional bounded LLM summarization step for unusually large tool results (explicit opt-in flag or heuristic) |

### 2.3 RAG

| Priority | Item | Notes |
|---------|------|--------|
| P1 | **Relevance tuning** — threshold in [`backend/app/services/rag.py`](../../backend/app/services/rag.py), chunk size in ingest pipeline / [`backend/app/services/rag.py`](../../backend/app/services/rag.py) callers | Today empty-or-low-score behaviour is heuristic; tune with real corpuses |
| P2 | **Ingest QA** — filename dedup, OCR PDFs vs text PDFs | Usually runs via API + CLI; operational checklist in RUNBOOK § RAG |

### 2.4 Analyzer UX

| Priority | Item | Notes |
|---------|------|--------|
| P2 | **`thread_id` missing** | Either enforce “create/select thread first” client-side or **auto-create thread** on first `/analyze` to match persistence story |
| P2 | **Surface SSE `detail` in UI** | [`frontend/src/features/analyzer/`](../../frontend/src/features/analyzer/) — show `TelemetryUnavailableError` / `OllamaUnavailableError` text from stream frames |

### 2.5 Evaluation and ops hygiene

| Priority | Item | Notes |
|---------|------|--------|
| P2 | **Golden question set + script** | Small repo of fixed prompts vs expected artefacts (latency, citations, tool sequence) runnable in CI nightly |
| P3 | **Correlation docs** — `audit_id`, `agent_runs.id`, `request_id` | Short “how to grep logs” appendix in RUNBOOK or here |

---

## 3. AI — later / bigger (after current tranche)

- **Proper auth around LLM endpoints** — JWT/session or SSO; per-user quotas; **distinct from shared `API_KEYS`**.
- **Queue / worker offload** for **`/analyze`** and **`/agent/run`** — protect Ollama GPU from bursts.
- **Multi-model routing / fallbacks** — config-driven model per route or tier.
- **Prompt versioning CI** — link [`PROMPTS.md`](../reference/PROMPTS.md) bumps to changelog and optional contract tests.

---

## 4. Platform backlog (non-AI — defer deliberately)

Explicitly **not** in the AI-first queue unless blocking AI work:

- **Schema lifecycle** — long-term dominance of Alembic over `create_all` in [`backend/main.py`](../../backend/main.py) lifespan vs fresh-dev ergonomics (*see RUNBOOK migrations*).
- **Observability stack** — Grafana/Loki dashboards on top of existing `/metrics`; alert rules (*FLAWS §P2-7 partial*).
- **Pagination breadth** — list endpoints as tables grow (*FLAWS P2-4 patterns*).
- **Forecast realism** — seasonal methods beyond linear extrapolation (*FLAWS P2-2*).
- **Cost ToU tariff** (*FLAWS P2-9*).
- **Frontend TypeScript + typed API contracts** (*FLAWS P3-1*).
- **PDF export for reports** (*FLAWS P3-4*).
- **Multi-tenancy / facility schema mapping** (*BUILD_PLAN Phase 6* / *FLAWS P3-3*).

---

## 5. References (code & docs)

| Area | Path |
|------|------|
| Agent loop | [`backend/app/services/agent.py`](../../backend/app/services/agent.py) |
| Tools + schemas + **`ToolContext`** | [`backend/app/domain/tools.py`](../../backend/app/domain/tools.py) |
| Tool payload cap helper | [`backend/app/domain/agent_payload.py`](../../backend/app/domain/agent_payload.py) |
| Ollama client + errors | [`backend/app/llm/ollama.py`](../../backend/app/llm/ollama.py) |
| Analyzer SSE | [`backend/app/api/v1/analyzer.py`](../../backend/app/api/v1/analyzer.py) |
| Agent HTTP + history | [`backend/app/api/v1/agent.py`](../../backend/app/api/v1/agent.py) |
| RAG retrieve | [`backend/app/services/rag.py`](../../backend/app/services/rag.py) |
| Typed HTTP errors | [`backend/app/errors.py`](../../backend/app/errors.py) |
| Optional API key gate | [`backend/main.py`](../../backend/main.py) |
| Frontend fetch wrapper | [`frontend/src/shared/api/client.js`](../../frontend/src/shared/api/client.js) |
| Agent UX | [`frontend/src/features/agent/AgentRunner.jsx`](../../frontend/src/features/agent/AgentRunner.jsx), [`frontend/src/shared/ui/TraceStep.jsx`](../../frontend/src/shared/ui/TraceStep.jsx) |
| Full backlog & severity | [`docs/planning/FLAWS_AND_IMPROVEMENT_PLAN.md`](./FLAWS_AND_IMPROVEMENT_PLAN.md) |
| Agent design reference | [`docs/reference/AGENT_REFERENCE.md`](../reference/AGENT_REFERENCE.md) |
| Prompt catalogue | [`docs/reference/PROMPTS.md`](../reference/PROMPTS.md) |
| AI stack narrative | [`docs/architecture/AI_ARCHITECTURE_REFERENCE.md`](../architecture/AI_ARCHITECTURE_REFERENCE.md) |

---

## 6. Changelog snippet (maintenance)

After each sprint, append one line:

| Date | AI changes shipped |
|------|---------------------|
| 2026-05-14 | Initial doc; reflects Phase-style agent/analyzer/API-key work through that date |
