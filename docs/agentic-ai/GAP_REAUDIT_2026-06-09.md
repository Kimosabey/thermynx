# Gap Re-Audit — 2026-06-09

Re-audit of every item in [CODEBASE_GAPS_2026-06-02.md](../planning/ai/CODEBASE_GAPS_2026-06-02.md)
against **current** code. The original audit predates the pipeline reorg (code moved from
`app/services/`, `app/prompts/`, some `app/domain/` → `app/ai/`), so paths were remapped and every
item re-verified.

**Result: 28 / 30 FIXED. 0 Critical / 0 High / 0 Medium open. 2 Low open (L2, L7).**

The four Critical fixes were independently spot-verified (not taken on the audit's word):
- **C1** [ollama.py:62-105](../../backend/app/llm/ollama.py#L62-L105) — `_cb_lock` guards all breaker state. ✓
- **C2** [efficiency.py:42-53](../../backend/app/analytics/efficiency.py#L42-L53) — `_band()` returns all 5 bands; "good" (0.55–0.65) reachable. ✓
- **C3** [analyzer.py:343-361](../../backend/app/api/v1/analyzer.py#L343-L361) — user+assistant persisted together post-stream; skipped on cancel. ✓
- **C4** [rag.py:90](../../backend/app/ai/rag.py#L90) — `%`/`_` escaped before `ILIKE`. ✓

## Critical (C1–C4) — all FIXED

| ID | Status | Current location | Evidence |
|----|--------|------------------|----------|
| C1 | FIXED | `app/llm/ollama.py:83-105` | breaker mutations wrapped in `with _cb_lock:` |
| C2 | FIXED | `app/analytics/efficiency.py:42-53` | 5-band `_band()`; `good` reachable |
| C3 | FIXED | `app/api/v1/analyzer.py:343-361` | persist after stream, skip on cancel |
| C4 | FIXED | `app/ai/rag.py:90` | wildcard escape on `equipment_id` |

## High (H1–H8) — all FIXED

| ID | Status | Current location | Evidence |
|----|--------|------------------|----------|
| H1 | FIXED | `app/ai/agent.py:180-192` | tool results wrapped in `<<< TOOL RESULT START/END >>>` |
| H2 | FIXED | `app/ai/tools.py:428-453` | inner `asyncio.wait_for` (28s) on executors → no pool leak |
| H3 | FIXED | `app/api/v1/work_orders.py:48-72` | `/work-orders` POST endpoint exists |
| H4 | FIXED | `app/analytics/anomaly.py:12` + `app/ai/tools.py:76-78` | z-threshold code & description both 2.5σ |
| H5 | FIXED | `app/api/v1/analyzer.py:365` + `agent.py:179` | both 20/min |
| H6 | FIXED | `app/analytics/forecast*.py` | `backend` + `fallback_reason` in result |
| H7 | FIXED | `app/api/v1/agent.py:30,49-71` | agent accepts `thread_id`, loads history |
| H8 | FIXED | `app/analytics/efficiency.py:106` | `bool(r.get("is_running"))` cast |

## Medium (M1–M8) — all FIXED

| ID | Status | Current location | Evidence |
|----|--------|------------------|----------|
| M1 | FIXED | `app/ai/prompts/agent_prompts.py:39-45` | premise-verification rules added |
| M2 | FIXED | `app/ai/multi_agent.py:257-263` | sub-task failure → explicit error marker |
| M3 | FIXED | `app/ai/tools.py:412` | `retrieve_manual` alias removed |
| M4 | FIXED | cost/optimizer/reports/energy/digest | `TARIFF_INR_PER_KWH` now wired in |
| M5 | FIXED | `app/ai/postcheck.py:198-244` | flags retrieved-but-uncited chunks |
| M6 | FIXED | `app/ai/prompts/hvac_prompts.py:202-223` | data-window shortfall warning |
| M7 | FIXED | `app/ai/postcheck.py:146-147` | adaptive tolerance (15% for %/σ) |
| M8 | FIXED | `app/api/v1/analyzer.py:70` | audit frame on preflight refusal |

## Low (L1–L10) — 8 FIXED, 2 OPEN

| ID | Status | Current location | Notes |
|----|--------|------------------|-------|
| L1 | FIXED | `app/ai/agent.py:234` | `max_steps` in done frame |
| **L2** | **OPEN** | `app/analytics/efficiency.py:48` | "good" band color `cyan` not in frontend palette → swap to standard token or extend palette |
| L3 | FIXED | `frontend/.../analyzer/index.jsx:230` | SSE parse error logged |
| L4 | FIXED | `app/llm/ollama.py:108-124` | per-tier `num_ctx` |
| L5 | FIXED | `app/ai/json_utils.py:14-53` | json fast-path + brace fallback |
| L6 | FIXED | `app/db/telemetry.py:227` | `float()` cast on aggregates |
| **L7** | **OPEN** | `app/config.py:28` | no startup validation of `OLLAMA_HOST` reachability → add startup ping to `/api/tags` |
| L8 | FIXED | `frontend/.../agent/index.jsx:369` | dynamic-preset fallback correct |
| L9 | FIXED | `frontend/.../analyzer/index.jsx:50` | monospace table font |
| L10 | FIXED | `app/ai/postcheck.py:43-46` | regex matches standalone `%` |

## Carryover not in the numbered list

- **Postcheck wiring** — confirm whether `run_postcheck` executes on the **agent** and
  **multi-agent** surfaces or only the analyzer (FUTURE_TASKS #5 implied analyzer-only). Treated as
  OPEN until verified; tracked in the plan's Phase 1.
