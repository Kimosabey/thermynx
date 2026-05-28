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
| 🧠 Truthfulness | 🟡 Partial | Code guards strong; prompt hardening Tier 1 still pending |
| ⚡ Performance | 🟡 Partial | Already-shipped wins: parallel DB fetch, pool sizing, token batching. Pending: model right-sizing, response caching |
| 🛡️ Reliability | 🟡 Partial | Ollama unreachable handled; circuit breaker + Ollama health-based degradation pending |
| 🔐 Security | 🟡 Partial | Read-only by design; API key gate + OWASP mapping pending |
| 📊 Evaluation | 🔴 Open | Self-critique pass exists; golden dataset + regression suite not yet built |
| 🔭 Observability | 🟢 Strong | Prometheus + Loki + Grafana stack live; analyzer/agent audit trail in Postgres |

---

## How to use these docs

- **Implementing a feature?** Read the dimension docs relevant to your scope. Each has a backlog with effort estimates and acceptance criteria.
- **Operating in prod?** Start with the Phase 10B dashboard + OBSERVABILITY.md, escalate via [RELIABILITY_PLAN.md](./RELIABILITY_PLAN.md).
- **Audit / compliance prep?** Walk through [SECURITY_PLAN.md](./SECURITY_PLAN.md) OWASP mapping + ISO 42001 cross-reference in [EVALUATION_PLAN.md](./EVALUATION_PLAN.md).
- **Adding a new AI surface (new endpoint, new tool, new prompt)?** Run through the per-dimension checklists in each doc before merging.

---

## Top-of-funnel summary — what's open this week

Pulled forward from the per-doc roadmaps for quick scan:

| Tier 1 (~6–8 hrs total) | Doc | Why |
|---|---|---|
| Read-only assertion in all prompts | [HALLUCINATION_ROADMAP.md#t1-a](./HALLUCINATION_ROADMAP.md) | Closes "shut down chiller — done" critical hallucination |
| Injection-resistance rule | [HALLUCINATION_ROADMAP.md#t1-b](./HALLUCINATION_ROADMAP.md) | Resists "ignore previous instructions" attacks |
| RAG content-as-data wrapper | [HALLUCINATION_ROADMAP.md#t1-c](./HALLUCINATION_ROADMAP.md) | Stops RAG documents from acting as instructions |
| Pre-flight equipment regex | [HALLUCINATION_ROADMAP.md#t1-d](./HALLUCINATION_ROADMAP.md) | Catches chiller_3 type cases in <100ms with no LLM cost |
| Right-size model per task | [PERFORMANCE_PLAN.md#a1](./PERFORMANCE_PLAN.md) | 2–3× speedup on agent + analyzer |
| Cap response length | [PERFORMANCE_PLAN.md#a2](./PERFORMANCE_PLAN.md) | ~30% speedup on analyzer |
| Ollama circuit breaker | [RELIABILITY_PLAN.md#r1](./RELIABILITY_PLAN.md) | Prevents pile-up during outages |
