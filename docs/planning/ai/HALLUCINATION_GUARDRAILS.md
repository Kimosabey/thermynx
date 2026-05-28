# AI hallucination guardrails — overview

**Audience:** Engineers working on Analyzer, Agent, NL-Query, RAG, or Vision paths.

**How to use this doc set**

| Use this doc for… | Use instead… |
|---|---|
| **Big picture + philosophy + status snapshot** | this file |
| **Every known failure mode + examples + severity** | [AI_HALLUCINATION_CASES.md](./HALLUCINATION_CASES.md) |
| **How each defense layer works + where it lives in code** | [AI_HALLUCINATION_DEFENSES.md](./HALLUCINATION_DEFENSES.md) |
| **Prioritized backlog + effort estimates + acceptance criteria** | [AI_HALLUCINATION_ROADMAP.md](./HALLUCINATION_ROADMAP.md) |
| **Observability dashboard for hallucinations after-the-fact** | [PHASE_10B_HALLUCINATION_DASHBOARD.md](../phases/PHASE_10B_HALLUCINATION_DASHBOARD.md) |

**Last updated:** 2026-05-28

---

## Philosophy

A local LLM that talks to operators about safety-critical equipment cannot be allowed to fabricate. We treat the LLM as **untrusted output** and wrap it with layered defenses so that anything fabricated is either:

1. **Refused before it reaches the model** (pre-flight validation),
2. **Made impossible by the prompt** (instruction hardening), or
3. **Caught after generation** (post-hoc audit + observability).

No single layer is sufficient. We use all three.

```
┌────────────────────────────────────────────────────────────────────┐
│  USER QUESTION                                                     │
│       │                                                            │
│       ▼                                                            │
│  ┌──────────────────────┐                                          │
│  │ 1. Pre-flight checks │  reject obvious bad input cheaply       │
│  │  (regex / catalog /  │  no LLM call needed                      │
│  │   length / topic)    │                                          │
│  └─────────┬────────────┘                                          │
│            ▼                                                       │
│  ┌──────────────────────┐                                          │
│  │ 2. Hard code guards  │  validate tool args, equipment IDs,     │
│  │  (tool exec layer)   │  SQL allow-list, payload bounds          │
│  └─────────┬────────────┘                                          │
│            ▼                                                       │
│  ┌──────────────────────┐                                          │
│  │ 3. Prompt hardening  │  explicit rules, allow-list injection,  │
│  │  (LLM instructions)  │  read-only assertion, refuse-on-unknown │
│  └─────────┬────────────┘                                          │
│            ▼                                                       │
│  ┌──────────────────────┐                                          │
│  │      LLM call        │                                          │
│  └─────────┬────────────┘                                          │
│            ▼                                                       │
│  ┌──────────────────────┐                                          │
│  │ 4. Post-gen audit    │  numeric extraction, citation check,    │
│  │  (background or sync)│  self-critique, equipment-mention audit  │
│  └─────────┬────────────┘                                          │
│            ▼                                                       │
│  RESPONSE TO USER + flags persisted to analysis_audit              │
└────────────────────────────────────────────────────────────────────┘
```

---

## Current status snapshot (2026-05-28)

| Layer | Coverage | Notes |
|---|---|---|
| Pre-flight | 🟡 Partial | Pydantic length checks done; equipment-name regex pre-flight not yet |
| Hard code guards | 🟢 Strong | Tool arg validation, SQL allow-list, payload bounds, equipment allow-list all done |
| Prompt hardening | 🟡 Partial | AVAILABLE EQUIPMENT injected + hard refuse rule done; read-only + injection-resistance still pending |
| Post-gen audit | 🟡 Partial | Self-critique exists (`/audit/critique-summary`); numeric/citation audit not yet automated |
| Observability | 🟢 Strong | Audit trail in Postgres; Phase 10B dashboard queued |

See [AI_HALLUCINATION_ROADMAP.md](./HALLUCINATION_ROADMAP.md) for the prioritized backlog of remaining work.

---

## Quick reference — files most relevant to hallucination control

| File | Layer | Purpose |
|---|---|---|
| [`backend/app/prompts/hvac_prompts.py`](../../../backend/app/prompts/hvac_prompts.py) | Prompt | Analyzer system prompt + AVAILABLE EQUIPMENT injection |
| [`backend/app/services/agent.py`](../../../backend/app/services/agent.py) | Prompt | Agent mode system prompts (investigator/optimizer/etc) |
| [`backend/app/services/nl_to_sql.py`](../../../backend/app/services/nl_to_sql.py) | Code | SQL allow-list, forbidden-token regex, LIMIT cap |
| [`backend/app/domain/tools.py`](../../../backend/app/domain/tools.py) | Code | Tool arg validation, equipment ID checks |
| [`backend/app/domain/equipment.py`](../../../backend/app/domain/equipment.py) | Code | EQUIPMENT_CATALOG — the single source of truth |
| [`backend/app/domain/agent_payload.py`](../../../backend/app/domain/agent_payload.py) | Code | Tool result truncation budget |
| [`backend/app/services/rag.py`](../../../backend/app/services/rag.py) | Code | RAG relevance threshold (0.55) |
| [`backend/app/api/v1/analyzer.py`](../../../backend/app/api/v1/analyzer.py) | Orchestration | Wires catalog into prompt builder, runs self-critique |
| [`backend/app/services/critique.py`](../../../backend/app/services/critique.py) | Post-gen | Self-critique pass after streaming |
| [`frontend/src/features/analyzer/CitationFootnotes.jsx`](../../../frontend/src/features/analyzer/CitationFootnotes.jsx) | Code | Drops citation markers that don't map to retrieved chunks |

---

## When to add a new defense

You should add a new entry to [AI_HALLUCINATION_CASES.md](./HALLUCINATION_CASES.md) whenever:

- An operator reports the AI saying something demonstrably false
- Code review finds a path where the LLM output is trusted without validation
- A new tool or endpoint is added that doesn't yet have a tool-arg validator
- A new equipment type or table is added (update `EQUIPMENT_CATALOG` AND check the prompt allow-list section)

Then plan the defense via [AI_HALLUCINATION_DEFENSES.md](./HALLUCINATION_DEFENSES.md) and schedule via [AI_HALLUCINATION_ROADMAP.md](./HALLUCINATION_ROADMAP.md).
