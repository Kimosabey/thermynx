# model-eval — Real-Data LLM Model Evaluation (OMNYX decider)

> **What this is:** a separate, **read-only** harness that runs every candidate
> local LLM through every agentic mode **against this project's real Unicharm data
> and pgvector corpus**, scores each, and emits a shareable report.
>
> **Why it exists:** OMNYX (Graylinx v2) must pick the best-fit on-prem models for
> its agent roles. A synthetic-prompt screening (Rounds 1–2) recommended
> **gpt-oss:20b (Planner) + phi4 (Validator)** — but that was one hand-written
> prompt. This harness re-runs the decision on **real plant data + the real RAG
> corpus** so the choice is evidence-based, not guessed. It also re-validates the
> per-task model choices already locked in this project's
> [`docs/planning/ai/MODEL_SIZING_DECISION.md`](../docs/planning/ai/MODEL_SIZING_DECISION.md).

## Why here (not in OMNYX)
This project already holds what a realistic test needs:
- **MySQL `unicharm`** (127.0.0.1:3307) — real chiller/tower/pump telemetry, 1-min.
- **Postgres + pgvector** (localhost:5442, `thermynx_app`) — the real `embeddings`
  RAG corpus (5 HVAC docs: chiller efficiency, cooling tower, condenser pump,
  maintenance & anomaly playbooks).
- **Ollama** (Tailscale) with every candidate model pulled.
- Battle-tested plumbing we **reuse** instead of rebuilding (`app.db.session`,
  `app.db.telemetry`, `app.services.rag`, `app.services.nl_to_sql`, `app.llm.ollama`).

It is **self-contained** in this `model-eval/` folder and **changes nothing** in the
app — it only reads the databases and calls Ollama.

## What it tests (modes)
| Mode | Real-data input | Deterministic check | LLM-judge (1–5) |
|---|---|---|---|
| Planner | a real anomaly window (e.g. high `kw_per_tr`) → fault summary | valid JSON, tier 1–3, ≥1 step | plan soundness |
| Validator | a sound plan+exec AND a deliberately-wrong exec | verdict parses | catches the bad / approves the good |
| Executor | a real fault scenario + the app's **real tool registry** | ≥1 valid tool call (right name+args) → grounded `propose_work_order` | gathered right data + correct, grounded work order |
| NL→SQL | NL question + real `unicharm` schema | SELECT-only (reuses `nl_to_sql._validate`), executes, returns rows | answers the question |
| RAG-QA | question → real pgvector top-k chunks | ≥1 chunk over 0.55 | grounded + cited, no hallucination |
| Narration | a real telemetry window | non-empty, no fabricated numbers | clarity + numeric fidelity |
| Embeddings | corpus re-embedded **in memory** | — | nomic-768 vs mxbai-1024 hit@k / MRR |
All rows also record **latency** and success/error.

**Executor mechanism:** the executor mode reuses the app's real tool registry
(`app.domain.tools`: `compute_efficiency`, `detect_anomalies`, `search_knowledge_base`,
`propose_work_order`, …, all read-only — `propose_work_order` validates + echoes, never
persists). Each model first gets **native Ollama tool-calling** (`tools=[…]`); if it emits
no `tool_calls`, it **falls back to JSON-mode** tool selection so every candidate is still
ranked. The `detail` column records `mech=native|json` and `tools_native=true|false`.

## Models under test
- **Planner / Validator / Executor / RAG / Narration:** gpt-oss:20b, phi4, mistral-small3.2,
  qwen2.5:32b, qwen2.5:14b, deepseek-r1:32b, gemma3:27b, llama3.1:8b (baseline).
- **NL→SQL:** the above **+ qwen2.5-coder:32b**.
- **Embeddings:** nomic-embed-text (768) vs mxbai-embed-large (1024).
- **Judge:** held constant at **qwen2.5:32b** (excluded as a candidate in judged
  modes to avoid self-grading; flagged where unavoidable).

Scoring follows this project's [`docs/planning/ai/EVALUATION_PLAN.md`](../docs/planning/ai/EVALUATION_PLAN.md)
philosophy: deterministic checks first, LLM-as-judge for grounding/quality.

## Safety (read-only — non-negotiable)
- **MySQL:** model-generated SQL passes the existing `nl_to_sql._validate` guard
  (single SELECT, allow-listed tables, no DML/DDL/comments, LIMIT cap) and runs on
  the app's read pool. No writes, ever.
- **pgvector:** SELECT-only via the existing `rag.retrieve`. The embeddings
  comparison computes cosine **in memory** (numpy) — it does **not** write any table.
- Touches **no** app config, no containers, no OMNYX code.

## How to run
```bash
# from the project root, using the project venv
.venv\Scripts\python model-eval\_probe.py                 # connectivity check (read-only)
.venv\Scripts\python model-eval\run_eval.py --modes planner --models gpt-oss:20b,qwen2.5:14b --quick   # smoke
.venv\Scripts\python model-eval\run_eval.py                # full sweep -> reports/
```
Output: `model-eval/reports/REAL_DATA_MODEL_EVAL.md` (decider report) + `results.json`.

## Prerequisites
- **MySQL `unicharm`** up on :3307 ✅ (telemetry through ~2026-04).
- **Ollama** reachable ✅ (all candidates pulled).
- **Postgres pgvector** on :5442 — **required only for RAG-QA + Embeddings**. If it's
  down, start it (`docker compose up -d` in the project root); otherwise those two
  modes SKIP cleanly and the other four still run.

## Out of scope
- Final sign-off is a separate **Round-3 vLLM/FP8 on 48 GB** run (production hardware).
- This harness does not modify the app or its golden-test suite (`backend/tests/`).
