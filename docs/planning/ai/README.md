# AI platform excellence — master index

**Audience:** Engineers, ops, and product folks working on Analyzer, Agent, NL-Query, RAG, Vision, and supporting infra.

**Last updated:** 2026-05-28

This is the index for the **AI platform excellence** doc set under [`docs/planning/ai/`](.) — a structured library covering every dimension of operating an LLM-powered system in production beyond just "does it work."

---

## Doc map (this folder)

| Dimension | Doc | What it covers |
|---|---|---|
| 🧠 **Truthfulness** | [HALLUCINATION_GUARDRAILS.md](./HALLUCINATION_GUARDRAILS.md) + 3 siblings below | Cases, defenses, roadmap for fabrication/injection |
| 🧠 ↳ Cases | [HALLUCINATION_CASES.md](./HALLUCINATION_CASES.md) | 40+ enumerated failure modes |
| 🧠 ↳ Defenses | [HALLUCINATION_DEFENSES.md](./HALLUCINATION_DEFENSES.md) | 4-layer architecture with code pointers |
| 🧠 ↳ Roadmap | [HALLUCINATION_ROADMAP.md](./HALLUCINATION_ROADMAP.md) | Tier 1/2/3 backlog with effort + acceptance |
| ⚡ **Performance** | [PERFORMANCE_PLAN.md](./PERFORMANCE_PLAN.md) | Latency targets, profiling, model right-sizing, caching |
| 🛡️ **Reliability** | [RELIABILITY_PLAN.md](./RELIABILITY_PLAN.md) | Failure modes, retries, circuit breakers, DR runbook |
| 🔐 **Security** | [SECURITY_PLAN.md](./SECURITY_PLAN.md) | OWASP LLM Top 10 mapping, auth, secrets, supply chain |
| 📊 **Evaluation** | [EVALUATION_PLAN.md](./EVALUATION_PLAN.md) | Quality framework, golden datasets, regression suite |
| 🎯 **Next round** | [AGENT_UX_AND_EVAL_LOCKIN.md](./AGENT_UX_AND_EVAL_LOCKIN.md) | Focused ~4hr plan: lock today's fixes into eval + Agent UI parity (audit panel + tool trace) |
| 📐 **Decision records** | [MODEL_SIZING_DECISION.md](./MODEL_SIZING_DECISION.md) | ADR: why we picked qwen2.5:14b + llama3.1:8b + llama3.2:3b instead of a single model or coder:32b for SQL |
| 🔄 **Framework migration** | [AI_FRAMEWORK_MIGRATION.md](./AI_FRAMEWORK_MIGRATION.md) | When + how to move from DIY to LangChain/LangGraph/LangSmith/vLLM; on-prem vs cloud patterns; 5-stage plan |
| 📋 **Future tasks** | [FUTURE_TASKS.md](./FUTURE_TASKS.md) | Master backlog — all AI work not yet started, grouped by priority, with effort estimates + commit history |

## Related docs (outside this folder)

| Where | What |
|---|---|
| [`../phases/PHASE_10B_HALLUCINATION_DASHBOARD.md`](../phases/PHASE_10B_HALLUCINATION_DASHBOARD.md) | Observability dashboard for hallucinations |
| [`../AI_ROADMAP_AND_BACKLOG.md`](../AI_ROADMAP_AND_BACKLOG.md) | Broader AI feature roadmap (analyzer, agent, RAG) |
| [`../../operations/OBSERVABILITY.md`](../../operations/OBSERVABILITY.md) | Platform-wide metrics, Loki, Grafana setup |
| [`../../operations/RUNBOOK.md`](../../operations/RUNBOOK.md) | Ops runbook (Ollama, backend, MySQL) |
| [`../../architecture/`](../../architecture/) | Architecture references for AI subsystems |

Each doc is self-contained but cross-links liberally. Reading order if new: this doc → hallucination set → performance → reliability → security → evaluation.

---

## Standards landscape

We cross-reference these frameworks throughout the doc set so the controls map cleanly to compliance/audit conversations later.

| Framework | Scope | How we use it |
|---|---|---|
| **OWASP LLM Top 10 (2025)** | LLM application security | Primary mapping in [SECURITY_PLAN.md](./SECURITY_PLAN.md); each of the 10 risks has a tracked control |
| **NIST AI RMF** (Risk Management Framework) | Govern / Map / Measure / Manage | High-level governance vocabulary; informs [EVALUATION_PLAN.md](./EVALUATION_PLAN.md) + [RELIABILITY_PLAN.md](./RELIABILITY_PLAN.md) |
| **ISO/IEC 42001** | AI management system | Aspirational — referenced for audit prep, not POC-blocking |
| **Google MLOps Lifecycle** | Model deployment + monitoring | Informs canary/rollback patterns (deferred to post-POC) |
| **Anthropic / OpenAI eval patterns** | LLM evaluation methodology | Informs [EVALUATION_PLAN.md](./EVALUATION_PLAN.md) golden-dataset structure |

---

## ⚠️ Non-negotiable constraint: Open Source Only

Every model, framework, library, and tool in the AI stack must be open-source
licensed (MIT / Apache-2.0 / BSD). No proprietary APIs, no cloud-only services,
no vendor lock-in. This is an architectural mandate, not a guideline.

See [AI_FRAMEWORK_MIGRATION.md](./AI_FRAMEWORK_MIGRATION.md) for the full rationale,
what's excluded, and the complete open-source alternative stack.

Current status: **✅ 100% open-source** — every dependency audited 2026-06-02.

---

## Cross-cutting principles

Six principles applied across every AI feature in this platform.

### 1. Treat the LLM as untrusted

Every byte the LLM produces is suspect until validated by a code-side guard or a post-gen check. We never inject LLM output into another LLM call, into SQL, into shell commands, or into UI without explicit handling. See [HALLUCINATION_GUARDRAILS.md](./HALLUCINATION_GUARDRAILS.md).

### 2. Fail loudly, refuse gracefully

Every failure mode (Ollama down, tool error, validator reject, timeout) surfaces a **specific HTTP status** and a **user-readable message**. The bare 500 "Internal server error" is a bug, not a state. See [RELIABILITY_PLAN.md](./RELIABILITY_PLAN.md).

### 3. Right-size the model

Don't use a 14B model for a job a 7B can do. SQL generation, NL classification, and tool selection are simpler than open-domain reasoning. See [PERFORMANCE_PLAN.md](./PERFORMANCE_PLAN.md).

### 4. Ground every claim

Numbers come from SUMMARY blocks, not LLM arithmetic. Bands come from analytics modules, not LLM classification. Documentation citations come from `[source: …]` markers tied to retrieved chunks. See [EVALUATION_PLAN.md](./EVALUATION_PLAN.md).

### 5. Observable by default

Every AI call writes a structured audit row to Postgres + a metric to Prometheus. No dark traffic. See [`../phases/PHASE_10B_HALLUCINATION_DASHBOARD.md`](../phases/PHASE_10B_HALLUCINATION_DASHBOARD.md) and [`../../operations/OBSERVABILITY.md`](../../operations/OBSERVABILITY.md).

### 6. Read-only on safety-critical paths

The platform never controls the plant — only reads telemetry and produces advice. No tool, no prompt, no API endpoint exists that could cause physical action. This is enforced at the model layer (system prompts), the tool layer (no actuator tools), and the network layer (no outbound to plant SCADA). See [SECURITY_PLAN.md](./SECURITY_PLAN.md).

---

## Status dashboard (2026-05-28)

| Area | Maturity | Snapshot |
|---|---|---|
| 🧠 Truthfulness | 🟢 Strong | All 3 hallucination tiers shipped: code guards (T1), prompt pins (T2), post-gen audits (T3) — 17-case pytest suite at 17/17 |
| ⚡ Performance | 🟢 Strong | Parallel DB fetch · connection pool · token batching · model right-sizing per task · response-length caps |
| 🛡️ Reliability | 🟢 Strong | Ollama circuit breaker (3 fails / 30s → 60s open) · health-degraded UI banner · graceful Ollama-unavailable refusals |
| 🔐 Security | 🟡 Partial | Read-only by design (T1-A + T2-F enforced) · OWASP LLM Top 10 mapped · API key gate + startup secret validation deferred |
| 📊 Evaluation | 🟡 Partial | Phase 1 harness shipped (S1 deterministic, 17 cases, 17/17 passing) · Phase 2 expansion (150 cases) + S2/S3 still planned |
| 🔭 Observability | 🟢 Strong | Prometheus (incl. new `hallucination_flags_total`) + Loki + Grafana · analyzer/agent audit trail in Postgres · circuit state in `/health` |

---

## How to use these docs

- **Implementing a feature?** Read the dimension docs relevant to your scope. Each has a backlog with effort estimates and acceptance criteria.
- **Operating in prod?** Start with the Phase 10B dashboard + OBSERVABILITY.md, escalate via [RELIABILITY_PLAN.md](./RELIABILITY_PLAN.md).
- **Audit / compliance prep?** Walk through [SECURITY_PLAN.md](./SECURITY_PLAN.md) OWASP mapping + ISO 42001 cross-reference in [EVALUATION_PLAN.md](./EVALUATION_PLAN.md).
- **Adding a new AI surface (new endpoint, new tool, new prompt)?** Run through the per-dimension checklists in each doc before merging.

---

## Shipped this week

All Tier 1 items below are now live in production. Verified by the 17-case
eval suite (`backend/tests/eval/test_golden.py`) — 17/17 passing.

| Item | Doc | Commit |
|---|---|---|
| ✅ Read-only assertion in all prompts | [HALLUCINATION_ROADMAP.md#t1-a](./HALLUCINATION_ROADMAP.md) | `75c51fd` |
| ✅ Injection-resistance rule | [HALLUCINATION_ROADMAP.md#t1-b](./HALLUCINATION_ROADMAP.md) | `75c51fd` |
| ✅ RAG content-as-data wrapper | [HALLUCINATION_ROADMAP.md#t1-c](./HALLUCINATION_ROADMAP.md) | `75c51fd` |
| ✅ Pre-flight equipment regex | [HALLUCINATION_ROADMAP.md#t1-d](./HALLUCINATION_ROADMAP.md) | `75c51fd` |
| ✅ Action-verb preflight (T2-F) | [HALLUCINATION_ROADMAP.md#t2-f](./HALLUCINATION_ROADMAP.md) | `4c38d1a` + `7daf008` |
| ✅ Right-size model per task | [PERFORMANCE_PLAN.md#a1](./PERFORMANCE_PLAN.md) | `4d2b0c9` |
| ✅ Cap response length | [PERFORMANCE_PLAN.md#a2](./PERFORMANCE_PLAN.md) | `4d2b0c9` |
| ✅ Ollama circuit breaker | [RELIABILITY_PLAN.md#r1](./RELIABILITY_PLAN.md) | `4fc0242` |
| ✅ Health-degraded UI banner | [RELIABILITY_PLAN.md#r4](./RELIABILITY_PLAN.md) | `4fc0242` |
| ✅ Post-gen audit (numeric/equipment/citation) | [HALLUCINATION_ROADMAP.md#t3](./HALLUCINATION_ROADMAP.md) | `4c38d1a` |
| ✅ Eval harness Phase 1 | [EVALUATION_PLAN.md](./EVALUATION_PLAN.md) | `48e7b8c` |

## What's open next

| Item | Doc | Effort |
|---|---|---|
| Security T1 (startup secret validation, pip-audit, API_KEYS required outside dev) | [SECURITY_PLAN.md](./SECURITY_PLAN.md) | 2h — **deferred for now** |
| Reliability R2 (audit row buffering when Postgres unreachable) | [RELIABILITY_PLAN.md#r2](./RELIABILITY_PLAN.md) | 4h |
| Eval Phase 2 — expand 17 → 150 cases | [EVALUATION_PLAN.md](./EVALUATION_PLAN.md) | 1d |
| Eval Phase 3 — S2 LLM-as-judge + S3 numeric reference compare | [EVALUATION_PLAN.md](./EVALUATION_PLAN.md) | 1d |
| Pre-commit hook running fast eval subset on prompt-file changes | [EVALUATION_PLAN.md](./EVALUATION_PLAN.md) | 1h |
| Grafana panel for `hallucination_flags_total` | [phases/PHASE_10B_HALLUCINATION_DASHBOARD.md](../phases/PHASE_10B_HALLUCINATION_DASHBOARD.md) | 2h |
