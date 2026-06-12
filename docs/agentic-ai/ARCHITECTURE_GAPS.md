# Agentic AI — Architecture Gap Register

> Honest record of known gaps in the AI / agentic / RAG architecture, with status. Companion to
> [FRAMEWORK_REWRITE_PLAN.md](./FRAMEWORK_REWRITE_PLAN.md) + [FRAMEWORK_ARCHITECTURE.md](./FRAMEWORK_ARCHITECTURE.md).
> The core design (LangGraph spine, guards-as-nodes, per-task routing, schema-first I/O, DATA-wrapping,
> audit trail, fail-soft) is sound — these are the edges. Reviewed 2026-06-12.

## Status legend
✅ closed · 🔧 closed this pass · ⏳ deferred (hardware/soak) · 👤 decision/ownership · ℹ️ clarified (not a gap)

| # | Gap | Sev | Status | Action / owner |
|---|-----|-----|--------|----------------|
| 1 | **Eval gate bypassable** — pre-push hook skipped when `make` absent | High | 🔧 **fixed** | Hook now runs the golden suite directly via the venv python; skips only when the backend is down; `--no-verify` is the explicit override |
| 2 | **Cold-load empties** — graph `ChatOllama` set no `keep_alive` | Med | 🔧 **fixed (partial)** | `OLLAMA_KEEP_ALIVE` (default `30m`) keeps single-model paths warm. Orchestrate's multi-model swap still reloads on 20 GB — see #4 |
| 3 | **Grounding is a *signal*, not a *gate*** (`s2_grounded` off; DeepEval signal; RAGAS dropped) | Med-High | ⏳ **deferred (intentional)** | Flip `s2_grounded` to a hard gate **only after N consecutive green eval runs** prove the small judge is stable on real context (it over-flags interpretive phrasing). Don't flip blind |
| 4 | **Orchestrate VRAM ceiling + no load test + SPOF** (one shared 20 GB Ollama box) | High | ⏳ **deferred → 48/64 GB** | 3 models (~31 GB) can't co-reside in 20 GB → evict/cold-load on each role switch. Real fix = 48 GB box; then Locust load test. No failover (single box) — accepted for now |
| 5 | **Durable memory** — checkpointer is in-process `MemorySaver`, not the Postgres/Redis the arch doc describes | Med | ⏳ **deferred → 48/64 GB** | F1.11. Graph builders already accept `checkpointer=`, so it's a drop-in later. HITL works in-process today |
| 6 | **Thin RAG corpus + ingestion unbuilt** (~12 chunks; LlamaIndex/Docling re-platform deferred) | Med-High | 👤 **owner needed** | RAG = current `rag.py` + FlashRank rerank (works). **Assign a KB-curation owner + cadence**; use `scripts/ingest_docs.py` for now. LlamaIndex/Docling = heavy (torch), deferred |
| 7 | **Prompt management = hardcoded strings** (no versioned registry) | Med | 👤 **blocked / git-backed** | F1.12 registry needs the Langfuse server (off). For now prompts are versioned via git history. Revisit when/if Langfuse returns |
| 8 | **Live-data assumption** — `TELEMETRY_TIME_ANCHOR=latest_in_db` (latest DB snapshot, not real-time) | Med | 👤 **decision — documented** | Answers reason over the most recent DB slot, not a live feed. Switch to `wall_clock` if/when live ingestion is wired. Stakeholders should know |
| 9 | **No auth + no automated red-team** (Giskard F6.11 optional) | Low-Med | 👤 **by design** | Internal facility tool — no authN/Z on purpose. Injection covered by DATA-wrapping + equipment allow-list + SQL deny-list. Giskard scan optional/future |
| 10 | **Dual-path maintenance** — graph + inline fallback run in parallel (inline still serves `/orchestrate` when its flag is off) | Med | ⏳ **decommission post-soak** | Keep the inline fallback until the cutover soaks; then delete it. Until then, watch for graph↔inline behavior drift |
| — | **Embedding dim mismatch** | — | ℹ️ **not a gap** | pgvector `vector(768)` enforces dim at insert (hard error on mismatch). Embed model is locked to `nomic-embed-text`. Safe |

## What changed this pass (2026-06-12)
- **#1** `.githooks/pre-push` runs the golden gate directly (no `make` dependency) — regressions can no
  longer be pushed silently; still skips cleanly when the backend is down.
- **#2** `OLLAMA_KEEP_ALIVE` (default `30m`) added to the graph `ChatOllama` router — keeps single-model
  paths warm.
- **This register** created so the deferred / decision gaps (#3–#10) are visible and owned, not built
  prematurely.

## Deliberately NOT built now (would be over-engineering at 20 GB / pre-soak)
Grounding hard-gate flip (#3, needs stability data) · LlamaIndex + Docling ingestion (#6, heavy) ·
durable Postgres checkpointer (#5, 48 GB) · Locust load test (#4, 48 GB) · global concurrency cap
(premature for a low-concurrency internal tool) · prompt registry (#7, Langfuse-off) · embedding-dim
guard code (pgvector already enforces it).
