# THERMYNX — Prompt Catalogue

All system + user prompts THERMYNX uses, **versioned**. Never edit a prompt in place — bump the version and reference it via `prompt_version_id` in `analysis_audit`, so we can correlate output quality with prompt changes.

> Source of truth: `backend/app/prompts/` (Python module). This file mirrors what's there and explains the *why*.

## Conventions

- **File naming:** `{name}_v{N}.md` (e.g. `analyzer_v1.md`)
- **Required sections:** `# SYSTEM`, `# CONTEXT`, `# USER`, `# OUTPUT`
- **Variables:** `{{ var_name }}` placeholders
- **Frozen on release:** once a prompt ships, the file is immutable; changes require a new version

## Active prompts

### `analyzer_v1` — UC1 default analysis
**Purpose:** Used by `POST /api/v1/analyze` for general HVAC narrative analysis.

**Variables:**
- `equipment_id`, `equipment_type`, `design_capacity_tr`
- `time_range_from`, `time_range_to`
- `metric_summary` — table of min / max / avg / p95 per metric
- `last_50_points` — compact CSV of recent samples
- `user_question`

**Output contract:** Markdown with three sections — **Findings**, **Likely causes**, **Recommendations**. Bullet points. Cite specific timestamps when referencing data.

**Changelog:**
- v1 (2026-05-08) — initial POC version

---

### `efficiency_v1` — Phase 2 efficiency band rationale
**Purpose:** When `/api/v1/efficiency/{id}` returns the "poor" band, generate the human-readable explanation.

**Variables:** `equipment_id`, `kw_per_tr_actual`, `kw_per_tr_design`, `delta_pct`, `top_drivers` (list)

**Output contract:** One paragraph in plain operator language. No headers.

---

### `anomaly_narrate_v1` — Phase 2 anomaly summary
**Purpose:** Called by the `anomaly_scan` job when `z_score > 3`. Uses small fast model (`phi:latest`).

**Variables:** `equipment_id`, `metric`, `value`, `baseline_mean`, `baseline_stddev`, `timestamp`, `z_score`

**Output contract:** Single sentence (≤ 25 words), starting with the equipment ID, naming the metric and the likely cause.

---

### `agent_react_v1` — Phase 3 Agentic Investigator system prompt
**Purpose:** ReAct-style system prompt for `POST /api/v1/agent/investigate`.

**Variables:** `tool_schemas` (JSON), `goal`, `equipment_id`, `time_range`

**Output contract:** Tool-calling format (Ollama-compatible function calls). Final response in markdown with sections — **Findings**, **Investigation trail**, **Suggested next checks**.

**Changelog:**
- v1 (2026-05-08) — initial POC version with 6 tools

---

### `report_summary_v1` — Phase 3 Report Builder exec summary
**Purpose:** Called by Report Builder to write the executive summary at the top of daily / weekly reports.

**Variables:** `period_from`, `period_to`, `kpi_table`, `top_anomalies`, `total_kwh`

**Output contract:** ≤ 200 words, three short paragraphs — **What happened · What it cost · What to act on**.

---

## Token budget guard

All prompts must fit in **6k tokens** (`qwen2.5:14b` context). Truncation strategy when over budget:

1. Drop oldest thread messages first (if any)
2. Truncate `last_50_points` to last 25 points
3. Summarise `metric_summary` to top-5 metrics by relevance to the question

## Output discipline

- Always request **markdown** for user-facing output — we render it
- For tool-calling, the LLM emits JSON; the wrapper parses it
- Reject empty responses → retry once with same prompt → on second failure emit a static fallback ("I couldn't analyze this period")

## Adding a new prompt

1. Create `backend/app/prompts/{name}_v1.md` (or bump existing version)
2. Add to `PromptVersionRegistry` in `backend/app/prompts/__init__.py`
3. Insert row into `prompt_versions` table via Alembic data migration
4. Add an entry in this file
5. Run the eval set (`tests/eval/`) — must not regress on the 30 canonical questions

## Picking the LLM model

Default: `qwen2.5:14b` (only model that fits in 20 GB VRAM with headroom on the Ollama box).

| Use case | Model |
|----------|-------|
| Default analyzer + agent | `qwen2.5:14b` |
| Fast narration (anomaly one-liners) | `phi:latest` |
| Embeddings (Phase 4 RAG) | `nomic-embed-text` *(needs `ollama pull`)* |

`gpt-oss:120b` is installed but **does not fit on this hardware** — never route prompts to it. See [`../BUILD_PLAN.md` §9.1](../BUILD_PLAN.md) for the model rationale.

## Eval set

Located at `backend/tests/eval/` — 30 canonical HVAC questions with reference answers. Run before every prompt-version bump:

```bash
docker compose exec api pytest tests/eval/ -v
```

A regression here blocks the version bump.
