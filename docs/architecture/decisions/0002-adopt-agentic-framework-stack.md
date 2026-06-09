# 0002 — Adopt an open-source agentic framework stack

- **Status:** Accepted — **supersedes [ADR-0001](./0001-no-ai-orchestration-framework.md)**
- **Date:** 2026-06
- **Deciders:** Graylinx AI (THERMYNX)
- **Plan:** [FRAMEWORK_REWRITE_PLAN.md](../../agentic-ai/FRAMEWORK_REWRITE_PLAN.md) ·
  builds on [AI_FRAMEWORK_MIGRATION.md](../../planning/ai/AI_FRAMEWORK_MIGRATION.md)

## Context

ADR-0001 chose a custom, framework-free pipeline — correct for the POC. THERMYNX is now targeted as a
finished, multi-facility on-prem product. For GA we are standardizing the agentic layer on an
open-source framework stack to gain ecosystem tooling (document loaders, retrieval, tracing, eval),
explicit graph-based agent control, and team/hiring familiarity with standard tools.

## Decision

Rewrite the agentic AI onto a **single orchestration spine plus best-of-breed specialized
frameworks**, all open-source and on-prem:

- **LangGraph** — agent orchestration spine (ReAct + multi-agent, conditional graphs, streaming).
- **langchain-ollama** — LLM interface; per-task model routing preserved.
- **LlamaIndex** — RAG ingestion/indexing/retrieval/reranking over the existing pgvector.
- **Pydantic** structured outputs via `with_structured_output`.
- **Langfuse** (self-hosted) — tracing. **DeepEval + RAGAS** — eval.

"Use all frameworks" is realized as this coherent stack, **not** four competing orchestrators at
once. CrewAI / AutoGen / PydanticAI are swappable alternatives for the spine only.

## Non-negotiables carried over from ADR-0001

The reasons ADR-0001 existed remain valid and are **preserved as first-class graph nodes**, not
discarded: deterministic preflight gates, post-gen audits, self-critique on every surface;
DATA-wrapping of tool/RAG content; per-task non-Chinese-origin models; on-prem inference with zero
egress; the SSE frame contract and audit-trail tables. **Cloud components remain excluded** —
Langfuse self-hosted only, never LangSmith cloud; no OpenAI/Anthropic/Gemini APIs.

## Consequences

**Positive:** standard tooling + ecosystem (loaders, retrievers, tracing, eval); explicit, inspectable
agent graphs; easier onboarding; multi-site consistency.

**Negative / costs:** ~3 weeks rewrite of working code; new dependency surface and version-churn risk
(esp. LangChain); added abstraction to debug (mitigated by Langfuse spans); larger install footprint
(mitigated by an offline bundle).

**Reversal trigger:** if framework churn or latency overhead proves unacceptable in production, the
`pipeline.py` facade + eval gate allow reverting a phase to the custom implementation.

## Alternatives considered

- **Stay custom (ADR-0001):** rejected for GA — wanted ecosystem/tooling/standardization across sites.
- **All four orchestrators simultaneously:** rejected — overlapping abstractions, dependency conflict.
- **Cloud stack (LangSmith/OpenAI):** rejected — violates the OSS + zero-egress constraint.
