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

## Status dashboard (2026-06-02) — last updated this session

| Area | Maturity | Snapshot |
|---|---|---|
| 🧠 Truthfulness | 🟢 Strong | All T1/T2/T3 shipped · English-only hardened (Thai bug fixed) · premise verification added · 27-case pytest suite 27/27 |
| ⚡ Performance | 🟢 Strong | Parallel DB fetch · pool · token batching · **3-model right-sizing** (qwen2.5:14b / llama3.1:8b / llama3.2) · response caps · ADR locked |
| 🛡️ Reliability | 🟢 Strong | Circuit breaker · degraded-mode UI banner · graceful Ollama refusals · Postgres startup retry |
| 🔐 Security | 🟡 Partial | Read-only enforced (T1-A + T2-F) · OWASP mapped · **OSS-only mandate locked** · secret validation + pip-audit deferred |
| 📊 Evaluation | 🟡 Partial | **27 cases, 27/27 passing** · tower/pump/outlier/language cases added · S2 LLM-as-judge + S3 reference compare planned |
| 🔭 Observability | 🟢 Strong | Prometheus (`hallucination_flags_total` + `audit_runs_total`) · Loki · Grafana · audit trail · circuit state in `/health` |
| 🎨 UX | 🟢 Strong | **Per-equipment + per-mode chip templates** · audit panel on analyzer · citation drawer · health-degraded banners · demo script |
| 🤖 Agents | 🟡 Partial | 5 modes + orchestrator all passing eval · **no audit panel on agent UI yet** (next planned session) · work-order approve UI pending |
| 🔄 Architecture | 🟢 Strong | `app/ai/pipeline.py` facade · full pipeline ASCII diagram · 5-stage OSS migration plan · model sizing ADR |

---

## How to use these docs

- **Implementing a feature?** Read the dimension docs relevant to your scope. Each has a backlog with effort estimates and acceptance criteria.
- **Operating in prod?** Start with the Phase 10B dashboard + OBSERVABILITY.md, escalate via [RELIABILITY_PLAN.md](./RELIABILITY_PLAN.md).
- **Audit / compliance prep?** Walk through [SECURITY_PLAN.md](./SECURITY_PLAN.md) OWASP mapping + ISO 42001 cross-reference in [EVALUATION_PLAN.md](./EVALUATION_PLAN.md).
- **Adding a new AI surface (new endpoint, new tool, new prompt)?** Run through the per-dimension checklists in each doc before merging.

---

## Shipped (2026-05-28 → 2026-06-02) — full list in [FUTURE_TASKS.md](./FUTURE_TASKS.md)

**Session 1** (2026-05-28): Tier 1/2/3 guardrails · Perf T1 · R1/R4 reliability · Analyzer audit panel · Eval Phase 1 (17 cases)
**Session 2** (2026-06-01/02): Analytics outlier fix · Tower/pump regression fix · T2-I premise verification · T2-H English-only hardened (Thai bug) · Eval 27 cases · Per-equipment chip templates · 3-model right-sizing + Ollama pre-warm · AI pipeline facade · ADR + framework migration plan · OSS mandate · Demo script · Future tasks backlog

Eval baseline: **27/27 passing** · All services: **8/8 green**

## What's open — pick from [FUTURE_TASKS.md](./FUTURE_TASKS.md)

**Start next session here:**

| # | Item | Priority | Effort |
|---|---|---|---|
| 1 | Typo-tolerant equipment matching (`difflib` fuzzy match) | 🔴 Must-do | 1h |
| 2 | NL-SQL column validator at code level | 🔴 Must-do | 1h |
| 3 | **Agent UI audit panel** (Part B from AGENT_UX plan) | 🟡 Agent UX | 3h |
| 4 | Work-order approve/dismiss UI | 🟡 Agent UX | 2h |
| 5 | Per-tool Prometheus metrics | 🟡 Agent UX | 1h |
| 6 | Eval Phase 2: 27 → 50+ cases | 🟡 Eval | 1d |
| 7 | Operator 👍/👎 feedback loop | 🟡 Eval | 5h |
| 8 | Redis response cache (identical Q → <100ms) | 🟢 Perf | 4h |
| 9 | Grafana hallucination flags panel | 🟢 Observability | 2h |
| … | Full list | → | [FUTURE_TASKS.md](./FUTURE_TASKS.md) |
