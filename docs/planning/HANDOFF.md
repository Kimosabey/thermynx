# Session handoff — THERMYNX HVAC AI Platform

**Date:** 2026-06-05  
**Git branch:** master  
**Latest commit:** `ec3cff5`  
**Eval baseline:** 49/49 cases passing  
**Services:** 8 Docker containers + backend on :8000 + frontend on :5173

Pick up exactly where this session left off.

---

## Product in one paragraph

**THERMYNX** is an on-prem AI operations intelligence platform for the Unicharm HVAC facility. Operators ask questions in natural language; the system queries MySQL telemetry, runs agentic analysis (5 specialist modes + multi-agent orchestrator), surfaces anomalies, proposes maintenance, and shows fact-checked answers — all without any data leaving the building. Stack: FastAPI + React + Ollama + pgvector + Prometheus/Grafana/Loki.

---

## Current system state

### Services
| Service | URL | Status |
|---|---|---|
| Backend (FastAPI) | http://localhost:8000 | Start: `cd backend && ../.venv/Scripts/uvicorn main:app --port 8000` |
| Frontend (Vite) | http://localhost:5173 | Start: `cd frontend && npm run dev` |
| Grafana | http://localhost:3030 | Docker — `docker compose --profile obs up -d` |
| Prometheus | http://localhost:9292 | Docker |
| Loki | http://localhost:3100 | Docker |
| Langfuse (tracing) | http://localhost:3200 | Docker — `docker compose --profile obs up -d` (new this session) |
| Postgres | :5442 (Docker) | `docker compose up -d` |
| Redis | :6380 (Docker) | `docker compose up -d` |
| MySQL (telemetry) | :3307 (host) | Always running |
| Ollama (Tailscale) | http://100.125.103.28:11434 | Run `scripts/ollama_restart_tuned.bat` on the GPU server |

### Models loaded on Ollama
| Task | Model | Why |
|---|---|---|
| Final answer narration | qwen2.5:14b | Quality |
| Agent tool selection, NL→SQL, planner | llama3.1:8b | Speed (2-3× faster) |
| Self-critique auditor | llama3.2:latest (3B) | Fastest |
| Vision | llama3.2-vision | Only vision-capable |
| Embeddings (RAG) | nomic-embed-text | Purpose-built |

### Key config (backend/app/config.py)
```
OLLAMA_HOST            = http://100.125.103.28:11434
OLLAMA_DEFAULT_MODEL   = qwen2.5:14b
OLLAMA_MODEL_TOOL      = llama3.1:8b
OLLAMA_MODEL_SQL       = llama3.1:8b
OLLAMA_MODEL_PLANNER   = llama3.1:8b
OLLAMA_AUDITOR_MODEL   = llama3.2:latest
OLLAMA_MAX_TOKENS_ANALYZE = 400
OLLAMA_MAX_TOKENS_AGENT   = 300
ANALYZER_CACHE_TTL_S   = 60
LANGFUSE_HOST          = ""  (set to http://localhost:3200 to enable tracing)
```

---

## What was built this session (all committed, all passing)

### Commits this session (newest first)

| Commit | What |
|---|---|
| `ec3cff5` | **Post-v1: Redis cache + 👍/👎 feedback + Eval Phase 2 (49 cases) + Langfuse** |
| `b03af59` | 100% completion pass — all gaps closed, eval 34→49 |
| `4ce44c0` | 7 fastest-wins from gap audit |
| `7d32952` | H6+H7+H8 — forecast backend, agent history, is_running cast |
| `2d4402d` | Work-order approve/dismiss card in agent trace UI |
| `715153e` | Critical fixes: circuit breaker thread safety, tool injection, connection leak, message race |
| `d5c77d7` | Rate limit alignment, z-threshold doc, dead alias removed |
| `43dd897` | Codebase gap audit doc (30 gaps identified) |
| `3d9decc` | English-only output hardened (Thai bug fixed) |
| `5b87232` | Eval lock-in for tower/pump/no-selection/outlier fixes |
| `5f8b38e` | Right-size models per task |
| `0650483` | Per-equipment + per-mode chip templates |

### Four post-v1 features just shipped (ec3cff5)

**1. Redis response cache**
- File: `backend/app/services/answer_cache.py`
- Key = SHA-256(question + equipment_id + hours + window_end)
- Cache hit replays answer as token SSE frames in <100ms
- Config: `ANALYZER_CACHE_TTL_S=60` (set to 0 to disable)

**2. Operator 👍/👎 feedback loop**
- DB: `analysis_audit.operator_verdict` + `.operator_note` columns
- API: `POST /api/v1/audit/{audit_id}/verdict` with `{"verdict": "positive"|"negative"}`
- Metrics: `graylinx_operator_feedback_total{verdict}`
- UI: `FeedbackBar.jsx` — thumbs below every analyzer answer

**3. Eval Phase 2 — 49 cases**
- File: `backend/tests/golden/cases.py`
- +15 new cases: paraphrases, multi-clause, Hindi language, boundary, complex SQL, orchestrator multi-equip, root_cause mode
- **S2 LLM-as-judge** in `backend/tests/eval/judge.py` — uses llama3.1:8b locally; opt-in per case with `s2_judge=True`

**4. Langfuse self-hosted span tracing**
- Docker: `docker compose --profile obs up -d` → http://localhost:3200
- Config: set `LANGFUSE_HOST=http://localhost:3200` + keys in `.env` to enable
- File: `backend/app/llm/tracing.py` — no-op when not configured
- Status: Docker service added, Langfuse package installed, client lazy-loaded

---

## Architecture overview

```
Browser ──→ React/Vite :5173
              ↓ API calls
         FastAPI :8000
              │
    ┌─────────┼──────────────────────┐
    │         │                      │
MySQL:3307  Postgres:5442          Redis:6380
(telemetry) (app data +           (cache +
             pgvector RAG)         sessions)
    │
    └── Ollama Tailscale :11434
        (qwen2.5:14b + llama3.1:8b + llama3.2 + vision + embed)
```

### AI request pipeline (every /analyze call)
```
Stage 1: Preflight      (preflight.py)    — equipment, action-verb, topic, typo
Stage 2: Context fetch  (db/telemetry.py) — parallel asyncio.gather 6 equipment
Stage 2b: RAG           (services/rag.py) — nomic-embed-text + pgvector, threshold 0.55
Stage 3: Prompt build   (prompts/hvac_prompts.py) — HARD RULES + data window + focus pin
Stage 4: LLM call       (llm/ollama.py)   — circuit-breaker-guarded
Stage 5: Post-gen audit (services/postcheck.py) — numeric/equipment/citation/language
Stage 6: Critique       (services/critique.py) — LLM-as-judge (llama3.2:latest)
```

### Key files by area
```
backend/
  app/
    ai/pipeline.py          ← navigation facade: read this to understand the full flow
    services/preflight.py   ← Layer 1: regex gates (action-verb, equipment, typo, topic)
    services/agent.py       ← ReAct loop (5 modes, tool execution, SSE streaming)
    services/multi_agent.py ← Orchestrator (planner + sub-agents + synthesizer)
    services/nl_to_sql.py   ← NL→SQL with column deny-list + table allow-list
    services/rag.py         ← RAG retrieval (relevance threshold 0.55, DATA markers)
    services/postcheck.py   ← Post-gen audit (numeric/equipment/citation/language)
    services/answer_cache.py← Redis response cache (new)
    services/critique.py    ← LLM self-critique (verify_answer)
    prompts/hvac_prompts.py ← SYSTEM_CONTEXT (English-only + read-only + premise-verify)
    llm/ollama.py           ← Ollama HTTP client + circuit breaker
    llm/tracing.py          ← Langfuse optional tracing (new)
    domain/tools.py         ← Tool registry + execute_tool + per-tool metrics
    analytics/efficiency.py ← kW/TR bands, outlier filter (TR<10 dropped)
    api/v1/analyzer.py      ← /analyze SSE endpoint
    api/v1/agent.py         ← /agent/run + /agent/orchestrate SSE endpoints
    api/v1/audit.py         ← Audit log + verdict endpoint (new)
    api/v1/health.py        ← Health check + circuit state + digest warnings
  tests/
    golden/cases.py         ← 49 eval cases (golden dataset)
    eval/runner.py          ← S1 deterministic checks
    eval/judge.py           ← S2 LLM-as-judge (new)
    eval/test_golden.py     ← pytest parametrized runner

frontend/
  src/features/
    ai/index.jsx            ← Unified AI page (/ai, /ai?mode=agent)
    analyzer/index.jsx      ← Quick Ask analyzer
    analyzer/AuditPanel.jsx ← Fact-check panel (numeric/equipment/citation/language)
    analyzer/FeedbackBar.jsx← 👍/👎 rating bar (new)
    analyzer/CitationFootnotes.jsx ← RAG citation drawer
    agent/index.jsx         ← Autonomous Agents hub
    agent/AgentRunner.jsx   ← ReAct trace + WO approval card + audit panel
    agent/useAgentStream.js ← SSE stream state (agentAudit, token batching)
    shared/ai/promptTemplates.js ← Per-equipment + per-mode chip templates
```

---

## Hallucination defense layers (all active)

| Layer | File | What it does |
|---|---|---|
| 1 — Pre-flight | `preflight.py` | Action-verb gate, equipment allow-list, typo-match, topic gate |
| 2 — Code guards | `nl_to_sql.py`, `domain/tools.py` | SQL column deny-list, table allow-list, tool arg validation |
| 3 — Prompt | `hvac_prompts.py`, `agent.py` | Read-only, injection-resist, English-only, premise-verify, data-window pin, benchmarks fixed |
| 4 — Post-gen | `postcheck.py`, `critique.py` | Numeric/equipment/citation/language flags + LLM self-critique |

---

## Eval harness

```bash
# Run all 49 cases (requires backend on :8000)
cd backend
../.venv/Scripts/pytest tests/eval/test_golden.py -v

# Fast subset (refusals only — no LLM call)
../.venv/Scripts/pytest tests/eval/test_golden.py -k "refusal or claim or topic"

# Single case
../.venv/Scripts/pytest tests/eval/test_golden.py -k nlq_unknown_chiller
```

**Expected output:** `49 passed in ~700-900s`

---

## Open tasks — pick up from here

Taken from `docs/planning/ai/FUTURE_TASKS.md`:

### Immediate (1-2h each)
- [ ] **Restart backend cleanly** and re-run full eval to confirm 49/49 on fresh process
- [ ] **Eval S2 on more cases** — add `s2_judge: True` to 5+ happy-path analyzer cases, verify `grounded=True`
- [ ] **Pre-commit hook** — auto-run 10 refusal cases when `prompts/hvac_prompts.py` or `services/agent.py` changes

### Next sprint
- [ ] **Eval Phase 3 (S3)** — numeric reference compare: compute expected values in Python (`analytics/efficiency.py`) and compare against LLM-cited numbers
- [ ] **Reliability R3** — smart Ollama retry (model loading → wait 5s, retry once)
- [ ] **Reliability R5** — SSE resume on reconnect (replay from audit row)
- [ ] **Chaos tests** — scripted Ollama-down / MySQL-down / mid-stream disconnect

### When second facility deploys
- [ ] Multi-tenant `EQUIPMENT_CATALOG` + knowledge base partitioning
- [ ] Canary prompt deploys (shadow 10% traffic, compare audit-flag rates)
- [ ] LoRA fine-tune (need 6+ months of 👍/👎 data first)

### Framework migration (trigger-gated)
See `docs/planning/ai/AI_FRAMEWORK_MIGRATION.md`:
- vLLM (trigger: >10 concurrent users) — 2d
- Langfuse fully wired (trigger: need per-tool-call debug) — 1d
- LangGraph (trigger: need conditional branches) — 2d

---

## Important decisions (don't re-litigate)

| Decision | Outcome | Doc |
|---|---|---|
| LLM per-task right-sizing | qwen2.5:14b narration, llama3.1:8b tool/SQL/planner, llama3.2 auditor | `MODEL_SIZING_DECISION.md` |
| NL-SQL model flaky on complex agg | Keep llama3.1:8b — validator catches bad SQL, 30% flake rate acceptable | same doc |
| No fine-tuning yet | Need 6+ months labeled data first | `AI_FRAMEWORK_MIGRATION.md` |
| Open-source only | MIT/Apache-2.0/BSD only. No OpenAI API, no LangSmith cloud | `AI_FRAMEWORK_MIGRATION.md` |
| Eval S1 only for golden cases | S2 judge available but opt-in — too slow for all 49 | `EVALUATION_PLAN.md` |

---

## Quick reference — start a session

```powershell
# 1. Start Docker stack
cd "d:/Harshan/HVAC AI Operations Intelligence Platform"
docker compose up -d

# 2. Start backend
cd backend
../.venv/Scripts/uvicorn main:app --port 8000

# 3. Start frontend (new terminal)
cd frontend
npm run dev

# 4. Health check
curl http://localhost:8000/api/v1/health

# 5. Run eval (verify nothing regressed)
cd backend
../.venv/Scripts/pytest tests/eval/test_golden.py -q
# Expected: 49 passed

# 6. Open browser
start http://localhost:5173
```

---

## Facility context

- **Facility:** Unicharm factory (single tenant, POC)
- **Equipment:** chiller_1, chiller_2, cooling_tower_1, cooling_tower_2, condenser_pump_1, condenser_pump_3
- **Telemetry:** MySQL `unicharm` database, latest slot: `2026-04-22T17:55:00` (historical dump)
- **Backend port:** 8000 (Windows TCP zombies can block this — try 8003 if stuck)
- **No authentication** — internal facility tool; API_KEYS empty by design for POC
- **No data egress** — Ollama on Tailscale LAN, pgvector on local Postgres, no cloud APIs

---

## Useful docs (all in repo)

| Doc | Path |
|---|---|
| AI master index | `docs/planning/ai/README.md` |
| All pending tasks | `docs/planning/ai/FUTURE_TASKS.md` |
| Hallucination cases catalog | `docs/planning/ai/HALLUCINATION_CASES.md` |
| Hallucination defenses | `docs/planning/ai/HALLUCINATION_DEFENSES.md` |
| Performance plan | `docs/planning/ai/PERFORMANCE_PLAN.md` |
| Reliability plan | `docs/planning/ai/RELIABILITY_PLAN.md` |
| Security plan | `docs/planning/ai/SECURITY_PLAN.md` |
| Evaluation plan | `docs/planning/ai/EVALUATION_PLAN.md` |
| Framework migration (OSS only) | `docs/planning/ai/AI_FRAMEWORK_MIGRATION.md` |
| Model sizing ADR | `docs/planning/ai/MODEL_SIZING_DECISION.md` |
| Pipeline reorg plan | `docs/planning/ai/AI_PIPELINE_REORG.md` |
| Post-v1 plan | `docs/planning/ai/POST_V1_PLAN.md` |
| Agent UX + eval lock-in plan | `docs/planning/ai/AGENT_UX_AND_EVAL_LOCKIN.md` |
| Demo script (12-min) | `docs/operations/runbooks/DEMO_SCRIPT.md` |
| Manual test plan (80+ cases) | `docs/operations/runbooks/AI_MANUAL_TEST_PLAN.md` |
| Ollama server tuning | `docs/operations/runbooks/OLLAMA_SERVER_TUNING.md` |
| Codebase gap audit | `docs/planning/ai/CODEBASE_GAPS_2026-06-02.md` |
