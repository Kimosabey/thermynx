# AI reliability plan

**Audience:** Engineers + ops responsible for keeping the AI surfaces working.

Sibling docs: [AI_PLATFORM_EXCELLENCE.md](./README.md) · [AI_PERFORMANCE_PLAN.md](./PERFORMANCE_PLAN.md) · [AI_SECURITY_PLAN.md](./SECURITY_PLAN.md)

**Last updated:** 2026-05-28

---

## Reliability goals (SLO-style)

| Surface | Availability target | What "available" means |
|---|---|---|
| Backend health (`/api/v1/health`) | 99.9% | Returns 200, DB connected |
| Analytics endpoints (no LLM) | 99.9% | DB + cache reachable |
| `/nl-query` | 98% | Ollama reachable + MySQL reachable |
| `/analyze` | 95% | Same + RAG embed reachable |
| `/agent/run` | 95% | Same + tools available |
| Vision | 90% | llama3.2-vision loaded |

LLM-dependent surfaces accept lower SLOs because they depend on the Ollama Tailscale link, which is best-effort.

---

## Failure modes inventory

Every documented way an AI path can fail, the user-visible behavior, and the mitigation.

### F1 · Ollama unreachable (network or process down)

**Trigger:** Tailscale link down · Ollama process crashed · wrong `OLLAMA_HOST` · GPU OOM and Ollama restarted

**Detection:** `httpx.RequestError` / `httpx.ConnectError` raised in any path through `app.llm.ollama`.

**Current behavior:**
- `/nl-query`: caught, returns **422** with `"LLM error: All connection attempts failed"`
- `/analyze`: caught, emits SSE `error` frame with `OllamaUnavailableError.detail`
- `/agent/run`: same as /analyze
- `/api/v1/health`: returns `ollama.connected=false` but overall status still `ok`

**Status:** 🟢 Mitigated — graceful refusal with actionable message.

**Improvement:** Add a **circuit breaker** — if 3 consecutive Ollama calls fail within 30s, mark the LLM path "degraded" for 60s and return a friendly "AI temporarily unavailable" response without attempting Ollama. Avoids piling up timeouts.

### F2 · Ollama returns 500 (model OOM, model not found, model crash mid-stream)

**Trigger:** Concurrent requests exceed GPU memory · model file corrupted · model not pulled

**Detection:** `r.status_code >= 400` check in `nl_to_sql.py:_ollama_generate_sql` (recently added). Similar checks needed in `ollama.py:chat` and `ollama.py:stream_chat_text`.

**Current behavior:**
- `/nl-query`: caught, returns 422 with `"Ollama 500: <body>"`
- `/analyze` and `/agent/run`: `r.raise_for_status()` raises `HTTPStatusError`, wrapped as `OllamaUnavailableError`, emits SSE error frame
- Body details are surfaced ✅

**Status:** 🟢 Mitigated.

**Improvement:** Distinguish 500 (server-side, retryable) from 404 (model not pulled, NOT retryable) — return different user messages and don't trip the circuit breaker on 404.

### F3 · Ollama returns non-JSON

**Trigger:** Proxy in the middle returning HTML 502 · partial response · misconfigured endpoint

**Detection:** `r.json()` raises `ValueError`.

**Current behavior:**
- `/nl-query`: caught, returns 422 with `"Ollama returned non-JSON response: <body[:200]>"`
- `/analyze` and `/agent/run`: caught by outer `try` blocks, surfaced as SSE error

**Status:** 🟢 Mitigated.

### F4 · Ollama timeout mid-stream

**Trigger:** Large response · slow GPU · model swap during stream

**Detection:** `httpx.TimeoutException` raised from `aiter_lines()`.

**Current behavior:** Caught in `stream_chat_text` and surfaced as SSE error. User sees partial text + error.

**Status:** 🟡 Partial — partial response shown but no explicit "interrupted" marker in UI.

**Improvement:** Emit an SSE `interrupted` frame distinct from `error`. Frontend renders a "Response cut off — retry?" inline button.

### F5 · MySQL telemetry unavailable

**Trigger:** Container restart · network partition · auth failure after credential rotation

**Detection:** `sqlalchemy.exc.OperationalError` / connection refused.

**Current behavior:**
- Analyzer: caught, emits SSE error with `TelemetryUnavailableError`
- NL-Query: caught, returns 422 with `"Database error executing query: …"`
- Health endpoint: returns `db.connected=false`

**Status:** 🟢 Mitigated.

**Improvement:** Surface DB-down in the System Health page header (already partially done via `useLiveStatus`).

### F6 · Postgres `thermynx_app` unavailable

**Trigger:** Container restart · disk full · vacuum stuck

**Detection:** Same connection error types.

**Current behavior:**
- Analyzer audit row write fails — caught with try/except, request still completes
- Thread fetch fails — caught, returns empty list

**Status:** 🟡 Partial — audit data lost silently when Postgres is down. Loud warning needed.

**Improvement:** Buffer audit rows to a local NDJSON file when Postgres is unreachable; replay on recovery. Same pattern as Promtail file tailing.

### F7 · Redis unavailable

**Trigger:** Container restart

**Detection:** `redis.exceptions.ConnectionError`

**Current behavior:**
- Cache miss path used (degraded but functional)
- arq worker (job queue) is in-process so not affected for POC

**Status:** 🟢 Mitigated — fail-open cache.

### F8 · Tool timeout (>30s)

**Trigger:** MySQL slow query · long-running analytics computation

**Detection:** `asyncio.TimeoutError` in `services/agent.py:execute_tool` (wrapped with `asyncio.wait_for(timeout=30.0)`).

**Current behavior:** Returns `{"error": "Tool 'X' timed out after 30 s — skipping."}` to the agent, which is instructed to acknowledge and continue.

**Status:** 🟢 Mitigated.

### F9 · Tool error (DB error, KeyError, etc.)

**Trigger:** Malformed tool args from model · downstream data issue

**Detection:** `try/except Exception` in `execute_tool`.

**Current behavior:** Returns `{"error": str(e)}` to the agent. Agent receives a structured `tool_error` + instruction to acknowledge.

**Status:** 🟢 Mitigated.

### F10 · RAG embedding service down

**Trigger:** nomic-embed-text not loaded · Ollama unreachable

**Detection:** `httpx.HTTPError` in `services/rag.py:embed_query`.

**Current behavior:** Caught, returns `None`. Retrieval falls back to no context. Analyzer proceeds without RAG.

**Status:** 🟢 Mitigated — graceful degradation.

### F11 · pgvector extension missing or schema mismatch

**Trigger:** Fresh Postgres without migrations run · column type mismatch

**Detection:** `sqlalchemy.exc.ProgrammingError` in retrieve query.

**Current behavior:** Caught in outer try/except, returns empty list. Analyzer proceeds without RAG.

**Status:** 🟢 Mitigated.

### F12 · Vision model returns malformed JSON

**Trigger:** Vision model (llama3.2-vision) ignores JSON format hint

**Detection:** `_parse_vision_json` returns `None`.

**Current behavior:** Falls back to defaults — `description="(no description)"`, `findings=[]`, `severity="info"`. Raw text preserved in `VisionResult.raw`.

**Status:** 🟢 Mitigated.

### F13 · NL-Query validator rejects every LLM output

**Trigger:** LLM regression — model starts generating CTEs / window functions outside validator scope

**Detection:** Repeated `NLQueryError` from `_validate`.

**Current behavior:** 422 returned each time. No retry. Operator sees repeated refusals.

**Status:** 🟡 Partial — no automatic fallback to a different model.

**Improvement:** If validator rejects 3 times in a row for a single question, surface "SQL generation failed — try rephrasing or selecting equipment in the dropdown" with template suggestions.

### F14 · Agent stuck in tool loop

**Trigger:** Model keeps calling the same tool with the same args; doesn't produce final text

**Detection:** Loop counter hits `settings.AGENT_MAX_STEPS` (default 8).

**Current behavior:** Loop exits, emits SSE error `"Agent reached max steps ({N}) without a final answer."`

**Status:** 🟢 Mitigated — bounded.

**Improvement:** Detect repeated identical tool calls and break early with a more helpful message.

### F15 · Frontend SSE connection drops mid-stream

**Trigger:** Network blip · backend restart · proxy timeout

**Detection:** `fetch` body reader throws or stream ends without `done` event.

**Current behavior:** `useAgentStream` shows error; partial output preserved. No automatic retry.

**Status:** 🟡 Partial.

**Improvement:** Add a "Retry from where it stopped" button using thread history + last seen token offset.

---

## Resilience patterns to add

### R1 · Ollama circuit breaker
**Status:** ⏳ Planned · **Covers:** F1, F2 · **Effort:** 3 hours

Wrap `app.llm.ollama` calls with a circuit breaker (3 failures in 30s → open for 60s). When open, return `OllamaUnavailableError` immediately without attempting the call. Reduces tail latency during outages.

Library: `circuitbreaker` (Python) or hand-roll a class. Expose `circuit_state{name="ollama"}` Prometheus gauge.

### R2 · Audit row buffering
**Status:** ⏳ Planned · **Covers:** F6 · **Effort:** 4 hours

If Postgres is unreachable when writing an `analysis_audit` row, write to `logs/audit-buffer.ndjson` instead. A background task drains the buffer back to Postgres when connection restores.

### R3 · Smart retry on transient errors
**Status:** 🌱 Later · **Effort:** 2 hours

For Ollama 500 with body "model is loading" — wait 5s and retry once. For Ollama 503 — wait 2s and retry once. Cap total retries at 1 to not pile up.

Already partially exists in httpx defaults; needs explicit policy for LLM-specific retries.

### R4 · Health-degraded mode
**Status:** ⏳ Planned · **Effort:** 2 hours

When `/api/v1/health` reports `ollama.connected=false`, the frontend should show a banner "AI features unavailable — analytics still working" and disable the AI buttons. Avoids confusing users who click and wait.

### R5 · Front-end SSE resume
**Status:** 🌱 Later · **Covers:** F15 · **Effort:** 4 hours

Track last received token sequence number. On reconnect, send `?resume_from=N` to the backend, which replays from the audit row.

### R6 · Graceful degradation per feature
**Status:** 🟢 Done · **Covers:** F10, F11

When RAG fails, analyzer proceeds without citations. When Ollama is slow, analytics endpoints still work. When Postgres is down, MySQL-only paths still serve.

This is already the design — documented here for clarity.

---

## Disaster recovery runbook

### DR1 · Full Ollama outage

**Symptoms:** All LLM-dependent endpoints return errors. Health endpoint shows `ollama.connected=false`.

**Triage:**
1. Check Tailscale: `curl http://100.125.103.28:11434/api/tags`. If timeout → network issue.
2. SSH to Ollama host: check `systemctl status ollama` or `docker ps`.
3. Restart Ollama if needed.

**User communication:** Frontend banner (after R4 lands).

**Acceptable downtime:** Up to 30 min for POC; users use analytics-only pages.

### DR2 · Backend crash

**Symptoms:** `/api/v1/health` returns nothing or connection refused.

**Triage:**
1. Check uvicorn process: `Get-NetTCPConnection -LocalPort 8000`
2. Tail logs: `tail -50 logs/backend-uvicorn.log`
3. Restart: `cd backend && uvicorn main:app --reload --port 8000`

**Recovery:** ~30s from restart command.

### DR3 · MySQL telemetry corrupt or missing

**Symptoms:** All analytics endpoints return 500/422. Health shows `db.connected=false`.

**Triage:**
1. `docker compose ps` — is the MySQL container up?
2. `docker logs hvacaioperationsintelligenceplatform-postgres-1` (if applicable)
3. Verify data freshness: `SELECT MAX(slot_time) FROM chiller_1_normalized;`

**Recovery:** Re-ingest from raw dump if data is corrupt. ~hours.

### DR4 · Postgres `thermynx_app` lost (audit + threads + embeddings)

**Symptoms:** Threads list empty, no audit rows written, RAG returns nothing.

**Triage:**
1. Container status + disk space
2. If schema corrupt, restore from backup; if no backup, run `alembic upgrade head` to rebuild empty
3. Re-ingest knowledge base for RAG

**Recovery:** Threads/audit history lost without backup. Schedule regular `pg_dump`.

### DR5 · GPU OOM under load

**Symptoms:** Ollama returns 500 sporadically during peak usage; latency spikes.

**Triage:**
1. `nvidia-smi` on Ollama host — check memory
2. Check concurrent requests in Ollama queue
3. Restart Ollama to clear loaded models

**Mitigation:** Lower `OLLAMA_NUM_PARALLEL` (default 4) → 2. Use smaller models per task (see [AI_PERFORMANCE_PLAN.md A1](./PERFORMANCE_PLAN.md#a1--right-size-the-model-per-task)).

---

## Testing reliability

### Chaos tests (recommended)

| Scenario | How to inject | Expected |
|---|---|---|
| Ollama down | `OLLAMA_HOST=http://127.0.0.1:1` | All LLM paths return graceful errors; analytics still work |
| Slow Ollama | Inject 20s delay via mock | Endpoints time out cleanly at configured limits |
| Postgres down | `docker stop` postgres | Analyzer still streams; audit silently buffers (after R2) |
| MySQL down | `docker stop` mysql | NL-Query + analyzer error gracefully; vision still works |
| RAG embedding fail | Block nomic-embed-text in Ollama | Analyzer proceeds without citations |
| Network partition mid-stream | Cut frontend network during /analyze | Partial response shown; clear error state |

Codify these as chaos tests under `backend/tests/chaos/` — runnable manually before each release.

---

## Roadmap

| Tier | Item | Effort | Status |
|---|---|---|---|
| 🔥 | R1 — Ollama circuit breaker | 3 hrs | ⏳ Planned |
| 🔥 | R4 — Health-degraded mode UI | 2 hrs | ⏳ Planned |
| ⚡ | R2 — Audit row buffering | 4 hrs | ⏳ Planned |
| ⚡ | Chaos test harness | 4 hrs | ⏳ Planned |
| 🌱 | R3 — Smart Ollama retry | 2 hrs | 🌱 Later |
| 🌱 | R5 — SSE resume | 4 hrs | 🌱 Later |
