# AI framework migration plan — DIY → LangChain / LangGraph / LangSmith

**Status:** Deferred — POC is working, migration triggers not yet met
**Audience:** Engineers evaluating whether to adopt AI frameworks
**Last updated:** 2026-06-02

Sibling docs:
- [AI_PIPELINE_REORG.md](./AI_PIPELINE_REORG.md) — current pipeline structure (the facade that makes this migration incremental)
- [MODEL_SIZING_DECISION.md](./MODEL_SIZING_DECISION.md) — model-per-task rationale
- [PERFORMANCE_PLAN.md](./PERFORMANCE_PLAN.md) — latency targets the migration must preserve
- [EVALUATION_PLAN.md](./EVALUATION_PLAN.md) — 27-case eval suite that gates every migration stage

---

## Why we didn't use frameworks for the POC

### Short answer
We built custom before we knew what we needed. That's correct for a POC — frameworks add constraints and versioning surface before the requirements are stable.

### Honest comparison

| Framework feature | Our equivalent | Gap |
|---|---|---|
| Agent loop (ReAct) | `services/agent.py` 200-line loop | Flat loop only; no conditional graph branches |
| Tool registry | `domain/tools.py` typed schemas | None — we have validated args + allow-list |
| Prompt templates | `prompts/hvac_prompts.py` | No version pinning or A/B rollback |
| Streaming | `llm/ollama.py` direct httpx | None — we own every byte |
| Memory / threads | Postgres Thread + Message tables | None — fully persistent |
| Observability | Prometheus + Loki + audit trail | No span-level traces per tool call |
| Evaluation | `tests/eval/test_golden.py` 27 cases | No LLM-as-judge (S2) yet |
| Document loaders | Manual ingest only | 50+ loaders in LangChain we don't have |

### Where the frameworks would actively hurt (on-prem context)

- **LangChain broke its API 4× in 18 months** (`0.0.x` → `0.1.x` → `0.2.x` → `0.3.x`). Each upgrade broke prompt construction, chain composition, or memory interfaces. For a facility deployed at a remote plant, silent breakage on update is unacceptable.
- **LangSmith is cloud-hosted tracing.** Every trace ships to LangChain Inc's servers. On-prem HVAC data (kW/TR, setpoints, anomaly logs) cannot leave the building under typical facility SLAs.
- **Framework debugging is a layer indirection.** "Why did the agent call that tool?" is harder when the call is inside LangGraph's executor vs our 200-line loop where every step is print-debuggable.
- **Vendor lock-in at the AI layer.** If LangChain pivots or goes paid, replacing it mid-deployment is expensive.

---

## On-prem vs Cloud — global standard comparison

### Current stack (fully on-prem, Tailscale-connected)

```
┌─────────────────────── FACILITY LAN ──────────────────────────┐
│                                                               │
│  HVAC plant → MySQL (unicharm)                                │
│  Backend (FastAPI) → Docker stack (Postgres, Redis, Grafana)  │
│  Frontend (Vite/React) → operators                            │
│                                                               │
│  ←── Tailscale VPN ──→  Ollama GPU server (on-prem or LAN)   │
│        │                models: qwen2.5:14b, llama3.1:8b,    │
│        │                        nomic-embed-text, vision      │
└─────────────────────────────────────────────────────────────-─┘
         │
         No data leaves the building
```

**Strengths of this model:**
- Zero data egress — compliant with facility NDA / OT security policies
- No per-token API cost — GPU box amortizes over 2-3 years
- No internet dependency — works during WAN outage
- Full model control — can pin exact model digest, test before updating
- Latency is predictable — Tailscale RTT is stable, not cloud-variable

**Weaknesses:**
- GPU hardware capex (~$5-15K for an A4000/4090)
- Model updates are manual (pull + test vs cloud auto-upgrade)
- Limited model selection vs cloud frontier models (GPT-4o, Claude Opus, etc.)
- No multi-tenant isolation out of the box

### Global standard: what enterprise AI platforms do

Three dominant patterns across production AI deployments:

#### Pattern 1 — Hybrid: on-prem inference + cloud orchestration
```
Facility LAN: raw telemetry
  ↓ (aggregated, anonymized)
Cloud orchestration: LangChain + LangSmith tracing
  ↓
On-prem LLM (vLLM / Ollama / TGI) or cloud LLM (Azure OpenAI Private Endpoint)
  ↓
Response back to facility
```
Used by: Siemens Energy AI, Honeywell Forge, ABB AbilityTM
Pros: frontier model access, managed observability, centralized prompt management
Cons: data leaves facility (needs Azure Private Link or equivalent), cloud dependency

#### Pattern 2 — Fully on-prem, vLLM-based
```
Facility LAN: telemetry + GPU server
  vLLM (OpenAI-compatible API) serving fine-tuned model
  LangChain (local) for orchestration
  Self-hosted Grafana + Prometheus for observability
```
Used by: defense, energy, banking
Pros: no data egress, production-grade serving (vLLM is faster than Ollama for concurrent requests), OpenAI-compatible API means drop-in tooling
Cons: higher ops complexity (vLLM cluster vs simple Ollama), model serving infra team needed

#### Pattern 3 — Fully cloud, Private Link
```
Facility → Azure IoT Hub → Azure OpenAI (Private Endpoint)
                         → LangChain on Azure Functions
                         → LangSmith (cloud tracing)
                         → Postgres on Azure
```
Used by: large manufacturing, utilities
Pros: no on-prem GPU, Microsoft manages everything, compliance certifications (ISO 27001, SOC2)
Cons: most expensive, full cloud dependency, data-residency constraints need careful config

### Where we sit vs the global standard

| Dimension | Global standard | Our current | Gap |
|---|---|---|---|
| Inference serving | vLLM or Azure OpenAI Private Endpoint | Ollama | Ollama is fine for POC; vLLM for scale |
| Orchestration | LangChain / LangGraph | Custom Python | Works; less tooling |
| Tracing | LangSmith / Langfuse (self-hosted) | Prometheus + Loki | No span-level traces |
| Prompt management | LangSmith Hub / Humanloop | Python strings | No version rollback |
| Eval | RAGAS / TruLens / custom | 27-case pytest suite | S1 only; no S2/S3 |
| Data residency | Private Link / on-prem | Fully on-prem ✅ | None |
| Model pinning | Digest-locked in Modelfile | Model name only | Upgrade not locked |
| Concurrent throughput | vLLM (thousands req/s) | Ollama (~2-4 parallel) | Scale ceiling |

---

## Migration decision tree

```
Should we migrate to LangChain / LangGraph / LangSmith?

Is data allowed to leave the facility?
  YES → LangSmith cloud tracing is OK → consider full LangChain stack
  NO  → must use self-hosted tools only (Langfuse, Weights & Biases local)
        → LangGraph local is fine; LangSmith cloud is NOT fine

Are we at v1.0 POC stage?
  YES → don't migrate. Current stack is tested (27/27 eval), stable, owned.
  NO (production, multi-facility) → proceed to next question

Are we hitting a specific wall?
  - Need conditional agent graphs (if-else branching, parallel sub-agents)?
    → LangGraph (can run fully on-prem)
  - Need 10+ document source types (PDF, Word, Confluence, SharePoint)?
    → LangChain document loaders
  - Need span-level debugging per tool call?
    → Langfuse (self-hosted, MIT license, no cloud required)
  - Need prompt version management across facilities?
    → Langfuse prompt hub OR Humanloop (on-prem tier)
  - Need 10× inference throughput for many concurrent operators?
    → Replace Ollama with vLLM (OpenAI-compatible, same model weights)
  - Need frontier model quality (GPT-4o, Claude Opus)?
    → Azure OpenAI Private Endpoint (data stays in your Azure tenant)

Is an engineer joining who knows LangChain?
  YES → migrate in their first sprint; onboarding cost otherwise
  NO  → not worth the churn yet

Have we hit the eval ceiling (S1 deterministic only, need semantic grounding)?
  YES → RAGAS or custom LLM-as-judge; these work with or without LangChain
```

---

## Recommended migration path (when triggered)

5 stages. Each is independently testable with the 27-case eval suite as the gate.

### Stage 1 — Replace Ollama with vLLM (~2 days)
**Trigger:** >10 concurrent operators or latency SLA tightens below 5s for agents

```
Current:  Ollama serve + httpx client
Replace:  vLLM serve --model qwen/qwen2.5-14b-instruct --port 11434
          vLLM exposes OpenAI-compatible /v1/chat/completions
          backend/app/llm/ollama.py → backend/app/llm/openai_compat.py
```

- No framework change — just swap the HTTP backend
- vLLM serves 10-100× more concurrent requests than Ollama
- Same models, same VRAM, lower latency per request under load
- **Still fully on-prem** — vLLM runs in your Docker stack or LAN GPU box
- Eval gate: 27/27 must pass after swap

### Stage 2 — Add Langfuse for span tracing (~1 day)
**Trigger:** Need per-tool-call latency breakdown, or debugging becomes painful

```
self-hosted Langfuse (Docker Compose service, MIT license)
  → backend/app/llm/ollama.py wraps each call with span context
  → Grafana dashboard gains a "Traces" tab pointing at Langfuse
```

- Langfuse is self-hosted, MIT licensed — zero data egress
- Works alongside existing Prometheus + Loki (additive, not replacement)
- Gives span-level: prompt → LLM call → tool execution → postcheck
- **Still fully on-prem**

### Stage 3 — Replace agent loop with LangGraph (~2 days)
**Trigger:** Need conditional branching (e.g. "if anomaly found → root_cause path, else → brief path")

```
Current:  services/agent.py flat for-loop
Replace:  ai/surfaces/agent.py as LangGraph StateGraph
          nodes: preflight → context_fetch → rag → prompt → llm → tools → postcheck
          edges: conditional on tool results, anomaly severity, etc.
```

- LangGraph runs **fully local** — pip install langchain-core langGraph, no cloud calls
- The `app/ai/pipeline.py` facade means existing API endpoints don't change
- Eval gate: 27/27 must pass after swap
- Benefit: explicit graph edges replace implicit "call the next thing" code

### Stage 4 — Replace ingest with LangChain loaders (~1 day)
**Trigger:** Need to ingest PDF, Word, Excel, SharePoint, Confluence alongside markdown

```
Current:  services/ingest.py manual markdown chunker
Replace:  ai/rag/ingest.py using LangChain document loaders
          → PyPDFLoader, UnstructuredWordDocumentLoader, etc.
          → Still writes to the same pgvector embeddings table
```

- LangChain loaders run locally — no cloud dependency
- The embedding model (nomic-embed-text via Ollama/vLLM) stays the same
- Same retrieval pipeline, same postcheck

### Stage 5 — Add prompt version management (~half day)
**Trigger:** Multiple facilities need different prompt variants, or a prompt regression is hard to roll back

```
Option A (self-hosted): Langfuse prompt hub
  → Prompts stored in Langfuse DB (self-hosted)
  → backend pulls prompt by name + version at startup
  → rollback = change version pin in .env

Option B (file-based): git tags + config.py PROMPT_VERSION env var
  → prompts/hvac_prompts_v1.py, v2.py ...
  → select at runtime via settings.PROMPT_VERSION
  → no new infrastructure, works today
```

Option B is simpler and already possible with our current stack. Option A gives a UI for non-engineers to edit prompts.

---

## What stays on-prem no matter what

These components should **never** move to cloud for this deployment type:

| Component | Reason |
|---|---|
| LLM inference (Ollama / vLLM) | Plant telemetry passes through prompts — no egress |
| pgvector embeddings | Contains HVAC knowledge base + query history |
| MySQL telemetry | Raw plant data — OT security boundary |
| Audit logs (analysis_audit) | Operator Q&A history — facility data |
| Redis cache | Session data |

These **can** move to cloud with appropriate controls:

| Component | Condition |
|---|---|
| Langfuse tracing | Self-host first; cloud tier only if Azure Private Link + DPA in place |
| Grafana dashboards | Grafana Cloud with IP allowlist is common |
| Postgres (app data, not telemetry) | Azure / AWS with Private Endpoint + encryption at rest |
| Frontend static assets | CDN delivery is fine (no sensitive data in JS bundles) |

---

## vLLM vs Ollama — head-to-head

For planning the Stage 1 upgrade:

| | Ollama | vLLM |
|---|---|---|
| **Setup** | Single binary, trivial | Docker + Python, moderate |
| **Concurrent requests** | 2-4 (OLLAMA_NUM_PARALLEL) | 100+ (continuous batching) |
| **Latency (single req)** | ~30 tok/s on RTX 4080 | ~40-60 tok/s on same GPU |
| **Model support** | GGUF quantized only | GGUF + bfloat16 + AWQ + GPTQ |
| **API** | Custom Ollama API | OpenAI-compatible (/v1/chat) |
| **Memory management** | Manual keep-alive | Automatic PagedAttention |
| **Production grade** | POC / small teams | Enterprises, high concurrency |
| **On-prem** | Yes | Yes |
| **Windows** | Yes (binary) | Linux only (Docker on Windows) |

**Recommendation:** stay on Ollama until >10 concurrent operators or <5s latency SLA is required. Then stage 1.

---

## Summary table — what to adopt, when, and why

| Tool | When | Why | On-prem? | Effort |
|---|---|---|---|---|
| **vLLM** | >10 concurrent users OR <5s SLA | 10× throughput, OpenAI-compat API | ✅ | 2d |
| **Langfuse** (self-hosted) | Need span traces / prompt management | MIT license, zero egress, great UI | ✅ | 1d |
| **LangGraph** | Need conditional agent branches | Local Python lib, no cloud | ✅ | 2d |
| **LangChain loaders** | Need multi-format document ingest | Local lib, 50+ loaders | ✅ | 1d |
| **LangSmith** (cloud) | Only if data-residency allows | Best-in-class tracing UI | ❌ (cloud) | 1d |
| **RAGAS** | Need semantic eval (S2) | Local Python eval framework | ✅ | 1d |
| **Azure OpenAI Private Endpoint** | Need GPT-4o / Claude quality | Frontier models, data stays in tenant | ✅ (Private Link) | 3d |
| **Fine-tune (LoRA)** | 6mo+ of labeled operator data | Custom HVAC reasoning | ✅ | 1-2wk |

---

## When NOT to migrate

- **POC is still proving value** — don't migrate. Every migration is a regression risk.
- **Single facility, <10 operators** — current stack is over-engineered for this scale already.
- **No one has complained about the agent or RAG quality** — frameworks don't improve quality, only toolability.
- **Team < 3 engineers** — framework onboarding cost exceeds benefits at small team size.
- **The 27-case eval doesn't pass** — fix regressions before adding framework complexity.

---

## Acceptance criteria for "migration ready"

Before starting any stage:

- [ ] `pytest backend/tests/eval/test_golden.py` → 27 passed (current baseline)
- [ ] No in-flight AI feature work on main branch
- [ ] A dedicated migration branch exists
- [ ] The specific trigger condition (listed per stage) is confirmed true
- [ ] Post-migration: 27/27 eval still green + manual smoke on `/analyze`, `/agent/run`, `/nl-query`
- [ ] Docs updated: file pointers in `HALLUCINATION_DEFENSES.md` + `AI_PIPELINE_REORG.md`
