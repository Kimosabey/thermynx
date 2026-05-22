# Data Grounding 01 — Knowledge corpus ingest

**Status:** in progress · **ETA:** today (starter pack) · **Owner:** this session

## The honest current state

`SELECT COUNT(*) FROM embeddings;` returns **0**. The Knowledge page is
functional but has nothing to retrieve from, and `[source: …]`
citations in the Analyzer never fire because no RAG context is ever
returned. This means:

- `/rag/search` always returns 0 hits.
- The Analyzer prompt template includes a "## RELEVANT DOCUMENTATION"
  block — currently empty.
- The Citation footnote infrastructure (shipped this week) renders
  correctly but has no chunks to attach to.

## Goal

Get the RAG layer from "scaffolded but empty" → "queries return real
HVAC-domain answers" without inventing facts or scraping copyrighted
manuals.

## Two-step approach

### Step A — Starter reference pack (today)
A handful of operator-facing HVAC reference markdowns written from
public domain knowledge. These are not equipment-specific manuals —
they're industry standard playbooks that any senior HVAC engineer
would expect to reference. Sources to write:

| Doc | Purpose | Equipment tags |
|---|---|---|
| `HVAC_CHILLER_EFFICIENCY.md` | kW/TR bands, design benchmarks, loss drivers | chiller_1, chiller_2 |
| `HVAC_COOLING_TOWER.md` | Approach, range, wet-bulb, cell staging logic | cooling_tower_1, cooling_tower_2 |
| `HVAC_CONDENSER_PUMP.md` | Pump curves, VFD strategies, NPSH | condenser_pump_1, condenser_pump_3 |
| `HVAC_MAINTENANCE_PLAYBOOK.md` | Annual / quarterly / monthly task list | (untagged — global) |
| `HVAC_ANOMALY_PLAYBOOK.md` | Common faults (low ΔT, fouled tubes, surge) | (untagged — global) |

Total: ~5 docs, ~3000-5000 words each → ~50-80 chunks at the
400-word chunk size. Cheap to embed; covers ~80% of analyzer questions.

### Step B — Plant-specific docs (future)
Real Unicharm SOPs, vendor manuals (York / Carrier / Trane chiller
manuals), commissioning reports. These come from the customer and
are not in scope today.

## Ingest path

```
POST /api/v1/rag/ingest   (multipart)
  file:           <markdown file>
  equipment_tags: "chiller_1,chiller_2"     (optional)
  replace_existing: true
→ { chunks_stored, source_id, equipment_tags }
```

Implementation runs `services/ingest.py`:
  1. Parse text (PDF via pypdf, MD as UTF-8)
  2. Chunk to ~400 words, 80-word overlap
  3. Embed each chunk via `nomic-embed-text` on Ollama
  4. INSERT into `embeddings` (pgvector)

## Tasks

- [ ] Write 5 starter docs under `docs/knowledge_base/`
- [ ] curl-loop them through `/api/v1/rag/ingest` with proper tags
- [ ] Verify `GET /api/v1/rag/status` shows non-zero `total_chunks`
- [ ] Try `GET /api/v1/rag/search?q=...` for each doc's topic — confirm
      top hits land in the right doc
- [ ] Run a real Analyzer question against the Analyzer UI and check
      that the `[source: …]` markers appear in the answer and the
      "Sources cited" panel populates

## Acceptance

- `total_chunks ≥ 50`
- A query like "what is a good kW/TR for a centrifugal chiller?"
  returns the chiller-efficiency doc as top hit.
- An Analyzer question referencing a benchmark cites at least one
  chunk in the final answer.
