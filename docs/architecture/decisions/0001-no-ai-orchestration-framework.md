# 0001 — No AI orchestration framework

> ⚠️ **Superseded by [ADR-0002](./0002-adopt-agentic-framework-stack.md)** (2026-06). The reasoning
> below remains the rationale for the POC and the *constraints* (deterministic guards, on-prem,
> non-Chinese models, zero egress) are carried forward into ADR-0002 — only the
> build-vs-framework decision changed for GA.

- **Status:** Superseded by ADR-0002
- **Date:** 2026-06
- **Deciders:** Graylinx AI (THERMYNX backend)
- **Context doc:** [AI Architecture Reference](../AI_ARCHITECTURE_REFERENCE.md) ·
  [AI Framework Migration analysis](../../planning/ai/AI_FRAMEWORK_MIGRATION.md)

## Context

THERMYNX is a narrow, safety-critical, on-premise HVAC operations assistant. It serves a single
chiller-plant facility, must never actuate equipment, and must not hallucinate numbers or equipment.
The natural question for any LLM application is whether to build on a general orchestration framework
— LangChain, LlamaIndex, AutoGen, or CrewAI.

Those frameworks are optimized for **generality and developer velocity**: build an agent that can do
anything, swap vector stores and model providers freely, and lean on a large tool/plugin ecosystem.
They implicitly treat the LLM as the trusted center of the system.

THERMYNX's requirements point the other way. The LLM is the **least-trusted** component, wrapped in
deterministic guardrails; correctness and auditability of the orchestration itself matter more than
breadth; and the deployment is a fixed on-prem stack (Ollama + Postgres/pgvector + Redis + MySQL).

## Decision

Build a **lean, custom pipeline** on direct `httpx` calls to the Ollama REST API, with no
general-purpose orchestration framework. The whole AI subsystem is a single ordered pipeline
(`app/ai/pipeline.py`) that every surface walks, plus hand-written ReAct, RAG, and JSON-extraction
modules.

The five forces behind this:

1. **Safety must be mandatory and deterministic, not an optional callback.** Two of the pipeline's
   stages — preflight (regex gates, before the LLM) and post-gen audits (regex, after) — are non-LLM
   layers that sandwich the model. Frameworks have no equivalent built-in shape; they assume the
   model's output is the answer.
2. **Per-task model routing.** Different right-sized models for narration, tool-calling, SQL,
   planning, and audit — backed by an explicit model eval. Frameworks center on a single configured
   LLM; per-task routing would mean working around the abstraction.
3. **Raw `httpx` → Ollama gives the control we need.** A hand-rolled circuit breaker (3 fails/30s),
   per-model-tier context-window sizing for a VRAM-constrained box, and separate stream/non-stream
   timeouts — exactly the knobs a framework's LLM wrapper hides.
4. **End-to-end SSE streaming.** Token / tool_call / tool_result frames stream live so the UI shows
   per-step reasoning. Framework agent loops default to block-until-done; streaming intermediate tool
   steps is friction.
5. **Small enough to audit.** The agent loop (~240 LOC), multi-agent (~300), and RAG (~150) can be
   read top-to-bottom. For a tool that drafts maintenance work orders in a live facility, a
   10k-line dependency you don't control is a liability when an operator asks "why did it say that?"

## Consequences

**Positive**

- Full control over latency, context windows, timeouts, and payloads.
- Safety/grounding is a first-class, deterministic layer rather than a bolt-on.
- The orchestration is transparent and auditable end-to-end.
- Minimal dependency surface — only standard HTTP and DB libraries; no churn from framework breaking
  changes.

**Negative / costs**

- We maintain our own ReAct loop, multi-agent orchestration, RAG retrieval, and lenient
  JSON-from-prose parser.
- No built-in conversation-memory store, no swappable vector-store abstraction, no large
  tool/plugin ecosystem.

**Revisit when** the scope broadens beyond a single narrow domain — e.g. a general-purpose agent
needing arbitrary external tools, multiple swappable vector stores, or a broad plugin ecosystem. At
that point a framework's generality could outweigh the control we'd give up.

## Alternatives considered

- **LangChain / LlamaIndex** — rich RAG/agent abstractions, but heavy dependency surface, frequent
  breaking changes, and abstractions that hide the exact knobs (timeouts, `num_ctx`, breaker) we
  needed. The deterministic guard layers would have to be bolted on anyway.
- **AutoGen / CrewAI** — multi-agent orchestration out of the box, but oriented toward open-ended
  agent collaboration rather than a fixed, audited, safety-gated pipeline over a single on-prem model
  host.
