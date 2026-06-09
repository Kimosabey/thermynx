# THERMYNX — Agentic AI Framework Rewrite

> **Direction:** rebuild the agentic AI on an open-source framework stack (full rewrite), governed by
> **[ADR-0002](../architecture/decisions/0002-adopt-agentic-framework-stack.md)** (supersedes ADR-0001).
> **Constraints:** open-source only · on-prem · non-Chinese-origin models · zero data egress.

## The stack (one orchestration spine + specialized frameworks)

| Layer | Framework | Role |
|-------|-----------|------|
| Orchestration | **LangGraph** | ReAct + multi-agent graph, streaming, memory |
| LLM interface | **langchain-ollama** | keep Ollama; per-task model routing |
| Structured output | **Pydantic** `with_structured_output` | planner / critique / tool-args |
| RAG | **LlamaIndex** + **Docling** | retrieve / rerank / ingest over pgvector |
| Tracing | **Langfuse** (self-hosted) | span per node + tool |
| Eval | **RAGAS + DeepEval** + golden suite | regression gate |

> "Use all frameworks" = this coherent stack. You do **not** stack four competing orchestrators —
> CrewAI / AutoGen / PydanticAI are swappable for the LangGraph spine only.

## Documents

| Doc | What it is |
|-----|------------|
| [FRAMEWORK_REWRITE_PLAN.md](./FRAMEWORK_REWRITE_PLAN.md) | **★ The plan** — stack, phases F0–F7, capabilities & acceptance, risks, verification. |
| [FRAMEWORK_ARCHITECTURE.md](./FRAMEWORK_ARCHITECTURE.md) | Target design — diagrams (single-agent, multi-agent, RAG) + component→file map. |
| [GAP_REAUDIT_2026-06-09.md](./GAP_REAUDIT_2026-06-09.md) | Code-health evidence — 28/30 prior gaps already fixed (the base we're rewriting from is sound). |

Related: [ADR-0002](../architecture/decisions/0002-adopt-agentic-framework-stack.md) ·
[AI_ARCHITECTURE_REFERENCE.md](../architecture/AI_ARCHITECTURE_REFERENCE.md) (current/pre-rewrite state) ·
[AI_FRAMEWORK_MIGRATION.md](../planning/ai/AI_FRAMEWORK_MIGRATION.md) (OSS-only migration analysis this builds on).

## Non-negotiable (survives the rewrite)

The safety layer — preflight gates, post-gen audits, self-critique, DATA-wrapping, per-task
non-Chinese models, on-prem/zero-egress, the SSE contract and audit tables — is **preserved as
LangGraph nodes**, not dropped. No cloud components (Langfuse self-hosted only; no LangSmith/OpenAI).
