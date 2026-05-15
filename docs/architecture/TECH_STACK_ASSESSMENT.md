# Graylinx — Tech Stack Assessment

> Honest end-to-end review of framework and architecture decisions.
> Written: 2026-05-09

---

## Backend — Strong

**FastAPI + asyncio** is the right call. SSE streaming, async DB calls, and concurrent Ollama requests all need async-native code — FastAPI handles this better than Django or Flask would.

**Dual-DB design** (MySQL read-only + Postgres app DB) is a mature architectural decision. Keeps Unicharm's facility data clean, enables pgvector without a 4th service, and the separation is enforced at the credential level — not just in code.

**Pure domain layer** (`analytics/`) — all formulas live as plain functions with no I/O. This is the right pattern. Easy to test, easy to swap out the LLM layer without touching the math.

**Ollama self-hosted** is correct for this use case. Facility operational data should never leave the plant network. Cost predictability is a real advantage vs API-billed models.

**pgvector over Chroma/Qdrant** — pragmatic. One less service to deploy, backup, and monitor. At the chunk volume this will ever reach for one facility, pgvector is more than adequate.

**Weak spots:**
- APScheduler in-process is the biggest structural risk — a crash loses job history silently
- Redis is wired but completely idle — caching infrastructure paying zero rent
- No circuit breaker on Ollama — one stuck request can cascade

---

## AI Stack — Functional but Has a Ceiling

**qwen2.5:14b** is a reasonable model for the hardware (20 GB VRAM) but tool-calling at 14B is inconsistent. The ReAct loop works in demos but in production you'll see the agent call the wrong tool, pass wrong args, or loop without converging. The 8-step safety cap is the right guard but the root cause is model capability, not loop design.

**nomic-embed-text** for RAG is solid — 768-dim, fast, good multilingual support.

**The ReAct loop itself** (no LangChain) is the right call for a POC. LangChain adds 3 abstraction layers and makes debugging harder. A simple Python loop is transparent and debuggable.

**The risk:** the whole product's intelligence quality depends on one self-hosted 14B model. If Unicharm asks "why did you recommend X?" and the model hallucinated context, you have no fallback. The audit trail (`analysis_audit`, `agent_runs`) helps but doesn't fix the underlying reliability.

---

## Frontend — Functional but Behind the Plan

This is the biggest gap. The BUILD_PLAN specified:

| Planned | Shipped | Gap |
|---------|---------|-----|
| TypeScript | Plain JavaScript | API shape changes break silently — no compile-time type checking |
| TanStack Query | Raw `fetch()` | No cache, no deduplication, every page re-fetches independently |
| Zustand shared state | `useState` per page | Selected equipment doesn't persist across navigation |
| Generated OpenAPI client | Hardcoded endpoint strings | Manual sync required when backend changes |

Each of these is acceptable individually for a POC. Together they mean:
- Adding a 12th page means copy-pasting the same `fetch/useEffect/isLoading` pattern again
- Equipment list is re-fetched on every page mount instead of being cached once
- No shared selection state across pages

Chakra UI + Recharts + Framer Motion are all fine choices. The UI looks polished. The **state management and data-fetching layer** is the weak part, not the UI library choices.

---

## Summary Table

| Layer | Rating | Reason |
|-------|--------|--------|
| Backend architecture | ✅ Strong | Clean layers, async-first, proper DB separation |
| AI / LLM integration | ⚠️ Good for POC | Tool-calling consistency at 14B is a production risk |
| RAG pipeline | ✅ Good | pgvector + nomic-embed-text is the right stack |
| Frontend architecture | ⚠️ Functional | Diverged from plan — no TS, no query cache, no shared state |
| Infrastructure | ⚠️ Partial | Redis idle, APScheduler fragile, no observability |
| Domain logic (analytics) | ✅ Strong | Pure functions, clean formulas, well-separated |

---

## Recommended Upgrades (priority order)

1. **arq** — replace APScheduler with Redis-backed job queue (job durability)
2. **Redis caching** — actually use what's already wired in (`/equipment/summary`, `/efficiency`, `/anomalies/live`)
3. **TanStack Query** — replace raw `fetch()` calls; gets you cache, retry, deduplication, and loading states for free
4. **Prometheus + Grafana** — minimum observability before any customer-facing deploy
5. **TypeScript** — migrate frontend; biggest maintenance payoff over time
6. **Zustand** — shared selected-equipment and time-range state across pages

> The product is well-architected at the backend but the frontend and infrastructure haven't been brought up to the same standard. For a single-facility internal tool at POC stage, it works. For a second customer site or a production SLA, these gaps hit hard. The Phase 5 sprint list in [`FLAWS_AND_IMPROVEMENT_PLAN.md`](./FLAWS_AND_IMPROVEMENT_PLAN.md) addresses them in the right priority order.
