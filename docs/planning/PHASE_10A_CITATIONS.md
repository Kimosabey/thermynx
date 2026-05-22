# Phase 10A — Citation linking

**Status:** in progress · **Owner:** this session · **ETA:** today

## Goal

Make every numeric / factual claim in an analyzer or agent answer
traceable to a source — either a telemetry row (number cited) or a
RAG chunk (knowledge cited). Operators see clickable footnotes
inline, click to inspect the underlying evidence.

## Scope

| In | Out (later) |
|---|---|
| RAG chunks already returned by `/analyze` made clickable | New ranking of RAG chunks |
| Persist `cited_chunk_ids` on `analysis_audit` | Inline citations inside agent multi-step traces |
| Footnote rendering in markdown (`[1]`, `[2]`, …) + side panel preview | Cross-thread citation reuse |
| `GET /api/v1/citations/{audit_id}` to retrieve cited chunks for a past answer | Auto-citation of telemetry numbers (later phase) |

## Acceptance criteria

1. When the analyzer answers a knowledge-style question, the SSE stream
   emits a `citations` frame listing `[{id, source, snippet, score}, …]`.
2. The frontend renders `[1]`, `[2]` markers in the answer text where
   the LLM referenced a chunk; clicking a marker reveals the chunk in a
   side panel with title, source filename, and the relevant snippet.
3. `analysis_audit` rows persist a `cited_chunk_ids` text column so the
   Audit Log page can show "5 sources cited" per row later.
4. Plain-text answers (no citations) render unchanged.

## Design

### Backend
- `services/rag.py` already returns `chunks` from retrieval. Pass them
  through to `services/analyzer.py` so it can emit a `citations` SSE
  frame after the answer stream finishes.
- Add column `cited_chunk_ids` (Text) on `analysis_audit` (alembic
  migration). Store comma-joined chunk UUIDs.
- New endpoint `GET /api/v1/citations/{audit_id}` returns the chunks for
  a past audit row.

### Frontend
- Extend the analyzer SSE handler (`features/analyzer/`) to capture
  `citations` frames and pass to `<CitationPanel />`.
- Custom react-markdown component for `[N]`-style footnote tokens —
  on click, open a Drawer / popover with the chunk metadata.
- Reusable `<CitationsList />` rendered below the answer.

### Out of scope
- Citation generation prompt-engineering tweaks (the model already
  surfaces `[N]` markers when given chunks).
- Per-paragraph citation grouping.

## Tasks
- [ ] Alembic migration: add `cited_chunk_ids` to `analysis_audit`
- [ ] `services/analyzer.py`: emit `citations` SSE frame post-stream
- [ ] `services/analyzer.py`: persist `cited_chunk_ids` on audit row
- [ ] `api/v1/citations.py`: GET endpoint + register router
- [ ] Frontend: `CitationFootnote` markdown component
- [ ] Frontend: `CitationPanel` drawer/popover
- [ ] Smoke-test on a RAG-backed analyzer question
