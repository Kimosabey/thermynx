# Graylinx — Flaws, Gaps & Improvement Plan

> Generated: 2026-05-09 | Branch: master | Author: harshan.aiyappa@graylinx.ai

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Severity Classification](#2-severity-classification)
3. [Critical Flaws (P0)](#3-critical-flaws-p0)
4. [High-Priority Gaps (P1)](#4-high-priority-gaps-p1)
5. [Medium-Priority Issues (P2)](#5-medium-priority-issues-p2)
6. [Low-Priority / Nice-to-Have (P3)](#6-low-priority--nice-to-have-p3)
7. [Improvement Plan — Phased Execution](#7-improvement-plan--phased-execution)
8. [Quick Wins (< 1 day each)](#8-quick-wins--1-day-each)

---

## 1. Executive Summary

Graylinx is a **fully-functional POC** covering Phases 1–4 of the BUILD_PLAN. The architecture is sound: clean 5-layer FastAPI backend, async MySQL/Postgres dual-DB design, Ollama-based ReAct agent loop, and a polished Chakra UI frontend. All 11 feature pages, 16 API endpoints, and 5 agent modes are wired end-to-end.

**What works well:**
- End-to-end streaming (analyzer, agents) via SSE
- Real analytics: efficiency bands, z-score anomaly detection, cost, forecast, maintenance
- ReAct tool-calling loop with 6 domain tools
- Read/write DB isolation (MySQL read-only, Postgres for app writes)
- Clean architecture layering — pure domain functions, no I/O in analytics/

**What still does not work for production (remaining gaps — see reconciliation below):**
- **Operational depth** — distributed tracing still limited despite baseline Prometheus `/metrics`; alerting/Grafana+Loki stacks are optional / not turnkey for every deployment
- **Brittle degradation paths** — Ollama/MySQL failures may still surface as opaque 500s where `AppError` is not wired
- **Auth / tenancy** — still intentionally omitted for POC; no RBAC if exposed beyond the LAN
- **Analytics & UX backlog** — pagination on some lists, centralized frontend API client with retry, benchmark/config externalization remain open items in later sections of this doc

---

## 1A. Status reconciliation (2026-05-14)

The following backlog items **were remediated in code since the original 2026-05-09 snapshot.** Treat earlier sections as history; rely on these rows for done vs open.

| ID | Previous concern | Current status |
|----|------------------|----------------|
| P0-1 | CORS locked to literals | **`resolve`:** `backend/main.py` reads `settings.CORS_ORIGINS` comma-separated origins; **`backend/app/config.py`** documents production override. |
| P0-3 | Stack traces in JSON | **`resolve`:** unhandled exceptions return `{ "detail": "Internal server error", "request_id": ... }`; full trace server-side only. |
| P0-4 | No max length on LLM inputs | **`resolve`:** `AnalyzeRequest.question` and `AgentRequest.goal` use `max_length=2000` (and `min_length=3`). |
| P1-1 | Redis unused | **`resolve`:** `app/services/cache.py` + TTL caching on `/equipment/summary`, efficiency, anomalies live, cost, etc. |
| P1-2 | APScheduler in-process jobs | **`resolve`:** `arq` worker in `backend/app/jobs/worker.py` + `Makefile` **`make worker`**; in-process cron also starts from `lifespan`. APScheduler dependency **removed**. |
| P1-3 | No Alembic | **`mostly resolve`:** `backend/alembic/` revisions `0001`–`0002` (+ index migration); **`make migrate`** / **`make migrate-create`**. **`startup`:** `alembic upgrade head` invoked from **`main.py`** so dev/prod parity. |
| P1-4 | RAG no HTTP ingest | **`resolve`:** `POST /api/v1/rag/ingest` in `backend/app/api/v1/rag.py` (+ CLI still available). |
| P1-5 | No rate limiting | **`partial`:** `slowapi` + **10/minute** on `/analyze` and `/agent/run`; **60/minute** on hot telemetry JSON routes (equipment summary/list, efficiency, anomalies live/history, cost). |
| P1-6 | No tool timeouts | **`resolve`:** `asyncio.wait_for(..., timeout=30.0)` around `execute_tool` in **`backend/app/services/agent.py`**. |
| P1-7 / P1-8 | Generic errors / no FE hook pattern | **`partial`:** **`app/errors.py`** + `AppError` handler; **`useApi`** + **`ErrorAlert`** on Dashboard — not every page uniformly migrated. |
| P2-7 observability baseline | **`partial`:** Prometheus **Instrumentator** on app + **`/metrics`**; full Grafana+Loki compose profile still elective. |

**Still intentionally open:** P2 pagination breadth, P2 seasonal forecast, TypeScript migration, PDF reports, multi-tenancy — see Sections 5–8.

---

## 2. Severity Classification

| Priority | Label | Definition |
|----------|-------|------------|
| **P0** | Critical | Security vulnerability or data loss risk; blocks production use |
| **P1** | High | Major feature gap that makes the product unreliable or incomplete |
| **P2** | Medium | Significant quality/UX issue; workaround exists but degrades experience |
| **P3** | Low | Polish, optimization, or future-proofing; not urgent |

---

## 3. Critical Flaws (P0)

> Note: Authentication is intentionally omitted — this is an internal facility tool.

### P0-1 — CORS Allows Any Localhost Origin (Implicit Wildcard Risk)

**What's missing:** `allow_origins=["http://localhost:5173", "http://localhost:3000"]` is correct for dev, but there is no mechanism to lock this down for staging/production. If deployed on a VPS with nginx proxy, this allows any origin on the local machine.

**Risk:** Any tab open in the same browser as an authenticated user could make cross-origin requests.

**Fix:** Drive CORS origins from env var `CORS_ORIGINS` (comma-separated); default to localhost only in dev. Production `.env` sets the actual deployed domain.

**File:** `backend/main.py` lines 25–30, `backend/app/config.py`

**Estimated effort:** 1 hour

---

### P0-3 — Stack Traces Leak to API Clients

**What's missing:** The global exception handler in `main.py` returns `{"detail": str(e)}` for unhandled exceptions, which often includes Python tracebacks, internal DB hostnames, file paths, and column names.

**Risk:** Information disclosure — an attacker can map the internal architecture from error messages.

**Fix:** Replace `str(e)` with a generic message. Log the full exception server-side (already structured JSON). Return a correlation `request_id` so ops can trace it in logs.

**File:** `backend/main.py` exception handler

**Estimated effort:** 30 minutes

---

### P0-4 — No Input Size Limits on LLM Endpoints

**What's missing:** `/analyze` accepts arbitrary `question` strings and `/agent/run` accepts arbitrary `goal` strings. No `max_length` validation.

**Risk:** A user can send a 100KB prompt, blowing out Ollama context window (causing OOM on the GPU host) or intentionally hanging the server with huge requests.

**Fix:** Add `max_length=2000` to Pydantic `AnalyzeRequest.question` and `AgentRunRequest.goal`. Return `422` immediately if exceeded.

**Files:** `backend/app/api/v1/analyzer.py`, `backend/app/api/v1/agent.py`

**Estimated effort:** 30 minutes

---

## 4. High-Priority Gaps (P1)

### P1-1 — Redis Configured but Never Used for Caching

**What's missing:** `redis.asyncio` is in `requirements.txt` and `REDIS_URL` is in config, but zero calls to Redis exist anywhere in the codebase.

**Impact:** Every dashboard load, every KPI card refresh queries MySQL directly. Under concurrent usage (e.g., 5 users on the dashboard), this generates 5× redundant queries for the same data.

**Fix:** Add a `CacheService` wrapper with `get_or_set(key, ttl, fetch_fn)`. Apply it to:
- `/equipment/summary` — TTL 60s (changes at most every minute)
- `/efficiency` (all equipment) — TTL 120s
- `/anomalies/live` — TTL 30s
- `/cost` — TTL 300s

**New file:** `backend/app/services/cache.py`
**Files to update:** `backend/app/api/v1/equipment.py`, `efficiency.py`, `anomalies.py`, `cost.py`

**Estimated effort:** 1 day

---

### P1-2 — APScheduler Anomaly Job is In-Process (Not Persistent)

**What's missing:** `APScheduler` runs inside the FastAPI process. If the process restarts (deploy, crash, OOM kill), all pending/running jobs are lost and the anomaly scan gap is silently skipped.

**Impact:** A 3-minute downtime during a thermal spike would miss the anomaly event entirely.

**Fix:** Replace with `arq` (Redis-backed async job queue). The anomaly scan becomes an arq worker job enqueued by a FastAPI startup cron. Worker process runs separately (`arq backend.app.jobs.worker.WorkerSettings`).

**Files:**
- New: `backend/app/jobs/worker.py` — arq WorkerSettings
- Update: `backend/app/jobs/anomaly_scan.py` — remove APScheduler, keep scan logic
- Update: `backend/main.py` — remove scheduler startup

**Estimated effort:** 1–2 days

---

### P1-3 — No Database Migration Tooling (Alembic Missing)

**What's missing:** Schema changes are done by ALTER TABLE statements in the FastAPI lifespan function. If a column already exists, the ALTER fails silently (or noisily). There is no version history of schema changes.

**Impact:** If the Postgres container is replaced or a new dev sets up the project, the lifespan may apply partial migrations, leaving the schema in an inconsistent state.

**Fix:** Add Alembic. Generate an initial migration from current `models.py`. Replace lifespan ALTER TABLE blocks with `alembic upgrade head` in the deploy script.

**New files:** `backend/alembic/`, `backend/alembic.ini`
**Update:** `backend/main.py` lifespan — remove ALTER TABLE blocks
**Update:** `Makefile` — add `make migrate` and `make migrate-create MSG="..."` targets

**Estimated effort:** 1 day

---

### P1-4 — RAG Has No Ingestion UI or API Endpoint

**What's missing:** `backend/scripts/ingest_docs.py` is a CLI script requiring direct server access. There is no `POST /rag/ingest` endpoint and no file upload widget in the frontend `/rag` page.

**Impact:** The RAG feature is non-operational from the user's perspective unless a developer manually SSHs to the server and runs a script. This makes the entire Phase 4 feature invisible.

**Fix:**
1. Add `POST /rag/ingest` endpoint — accepts multipart PDF upload, runs embedding pipeline, stores chunks in `embeddings` table
2. Add file upload widget to frontend `/rag` page (Chakra `<Input type="file">` + progress indicator)
3. Add `GET /rag/documents` to list ingested files

**Files:**
- New: backend endpoint in `backend/app/api/v1/rag.py`
- Update: `frontend/src/features/rag/`

**Estimated effort:** 2 days

---

### P1-5 — No Rate Limiting on Any Endpoint

**What's missing:** No throttling on LLM endpoints (`/analyze`, `/agent/run`) or data endpoints (`/equipment/summary`, `/efficiency`).

**Impact:**
- A single client can hammer `/analyze` in a loop, queuing hundreds of Ollama requests and grinding the GPU to a halt
- Dashboard polling without debounce can generate thundering-herd MySQL queries

**Fix:** Use `slowapi` (FastAPI-native `limits` decorator). Apply:
- `/analyze`, `/agent/run`: 10 requests/minute per IP
- Data endpoints: 60 requests/minute per IP
- `/auth/login`: 5 requests/minute per IP (brute-force protection)

**Files:** `backend/main.py` — add SlowAPI middleware, `backend/app/api/v1/analyzer.py`, `agent.py`

**Estimated effort:** 4 hours

---

### P1-6 — No Timeout on Individual Agent Tool Calls

**What's missing:** In `agent.py`, tool calls (`execute_tool`) are awaited without a timeout. If MySQL hangs (e.g., slow query, network partition), the entire agent run hangs indefinitely.

**Impact:** Requests pile up, worker threads starve, server becomes unresponsive.

**Fix:** Wrap each `execute_tool` call with `asyncio.wait_for(execute_tool(...), timeout=30.0)`. Return a tool error result on timeout instead of propagating the exception.

**File:** `backend/app/services/agent.py`

**Estimated effort:** 1 hour

---

### P1-7 — Error Responses Are Generic 500s Without Context

**What's missing:** Most endpoints return `{"detail": "Internal server error"}` on failure. Frontend shows no actionable message. Common failure modes (Ollama unavailable, MySQL connection pool exhausted) are not distinguished.

**Impact:** Users see a blank page or spinner. Ops cannot triage without log diving.

**Fix:**
- Define a typed `AppError` exception hierarchy (`OllamaUnavailableError`, `TelemetryUnavailableError`, `NotFoundError`)
- Map each to an HTTP status and user-facing message
- Frontend: parse error shape and render a `<Alert>` with the specific message

**Files:** New `backend/app/errors.py`, update all API routers, update frontend API calls

**Estimated effort:** 1 day

---

### P1-8 — Frontend Has No Error Boundary or Loading State on API Failures

**What's missing:** If any fetch call fails (network error, 500, timeout), React components silently fail — the chart stays empty, the KPI card shows `--`, and there is no user-facing message explaining why.

**Impact:** Users assume the product is broken without knowing whether the issue is Ollama, MySQL, or network.

**Fix:**
- Add a shared `useApi` hook that wraps fetch calls, tracks loading/error state, and returns structured `{ data, isLoading, error }`
- Replace raw `fetch` calls in all 11 pages
- Add a `<ErrorAlert>` component that renders conditionally when `error` is set

**New file:** `frontend/src/shared/hooks/useApi.js`
**Update:** All feature pages that call fetch

**Estimated effort:** 1.5 days

---

## 5. Medium-Priority Issues (P2)

### P2-1 — Benchmark Thresholds Are Hardcoded

**Affected files:** `backend/app/analytics/efficiency.py` (kW/TR bands), `backend/app/analytics/anomaly.py` (Z_THRESHOLD=3.0, MIN_SAMPLES=10)

**Issue:** Chiller efficiency benchmarks vary by equipment age, refrigerant type, and load profile. Unicharm's chillers may have different design points. A "poor" rating hardcoded at 0.85 kW/TR may be inaccurate for their specific equipment.

**Fix:** Move thresholds to a `ThresholdConfig` Pydantic model in `config.py`, loaded from env vars. Long-term: admin UI to tune per-equipment.

**Estimated effort:** 4 hours

---

### P2-2 — Forecast Is Linear Extrapolation Only

**Affected file:** `backend/app/analytics/forecast.py`

**Issue:** Current forecast computes a simple slope over a rolling window and extrapolates linearly. This does not capture seasonal load patterns (time of day, day of week, ambient temperature correlation), so 30-day projections can be significantly wrong.

**Fix (short-term):** Add a seasonal decomposition baseline using `statsmodels.tsa.seasonal.seasonal_decompose`. Produces a trend + residual, making projections more robust.

**Fix (long-term):** Facebook Prophet or LSTM — better accuracy but heavier dependency.

**Estimated effort:** 2–3 days (statsmodels) or 1 week (Prophet)

---

### P2-3 — Thread Messages Not Auto-Persisted During Streaming

**Affected files:** `backend/app/api/v1/analyzer.py`, `frontend/src/features/analyzer/`

**Issue:** Analyzer messages are only saved to the `messages` table if the user manually clicks "Save Thread". If the user closes the tab mid-conversation, the chat history is lost.

**Fix:** Persist the user message immediately on request receipt (before streaming begins). Persist the assistant message by accumulating tokens on the server and writing to DB when the stream completes.

**Estimated effort:** 4 hours

---

### P2-4 — No Pagination on List Endpoints

**Affected endpoints:** `GET /anomalies/history`, `GET /threads`, `GET /equipment`

**Issue:** All list endpoints return entire result sets. As the `anomalies` table grows (5-min scan × 10 equipment = 120 rows/hour), `/anomalies/history` will eventually return thousands of rows.

**Fix:** Add `limit` + `cursor` (or `page` + `page_size`) query params. Return `{ items: [...], next_cursor: "..." }` envelope.

**Estimated effort:** 4 hours

---

### P2-5 — Agent Tool Results Can Exceed LLM Context Window

**Affected file:** `backend/app/services/agent.py`

**Issue:** Tool results (e.g., `get_timeseries_summary`) are JSON-serialized and injected verbatim into the LLM context. For a 72-hour timeseries with 15-minute resolution, this is ~288 data points × multiple metrics = large token count. qwen2.5:14b has a 32K context; tools can easily fill it.

**Fix:** Add a `MAX_TOOL_RESULT_TOKENS = 2000` guard. Truncate or summarize tool results that exceed this before injecting into context. For timeseries: aggregate to hourly avg instead of raw.

**Estimated effort:** 1 day

---

### P2-6 — No Telemetry Freshness Validation in wall_clock Mode

**Affected file:** `backend/app/db/telemetry.py`

**Issue:** When `TELEMETRY_TIME_ANCHOR=wall_clock`, queries use `NOW()` as the reference point. If the MySQL database has not received new rows for 2+ hours (e.g., the data feed is down), all "live" endpoints silently return stale data with no warning.

**Fix:** After fetching the latest row timestamp, compare it to `NOW()`. If delta > 30 minutes, include `data_freshness_warning: "Last update was N minutes ago"` in the response envelope.

**Estimated effort:** 3 hours

---

### P2-7 — No Observability (Metrics, Tracing, Alerting)

**What's missing:** No Prometheus `/metrics` endpoint, no distributed trace IDs propagated to Ollama, no alerting when anomaly count spikes.

**Impact:** When the system misbehaves in production, the only signal is server logs. No SLA, no alerting, no dashboards.

**Fix (staged):**
1. Add `prometheus-fastapi-instrumentator` for request latency, error rate, active requests (30 min)
2. Add `opentelemetry-sdk` for trace propagation to Ollama calls (1 day)
3. Add Grafana + Loki to `docker-compose.yml` for log aggregation (1 day)
4. Define alert rules: `anomaly_rate > 5/hour`, `p99_latency > 5s`, `ollama_errors > 3/min`

**Estimated effort:** 2–3 days

---

### P2-8 — Frontend Uses Raw fetch() Everywhere (No Retry, No Timeout)

**Issue:** All 11 pages use raw `fetch()` with no timeout, no retry on transient failure, and no deduplication of concurrent calls to the same endpoint.

**Impact:** A 30-second Ollama cold-start causes the UI to appear frozen. A flapping MySQL connection causes random blank sections.

**Fix:** Centralize API calls in `frontend/src/shared/api/client.js`. Add:
- 30-second request timeout via `AbortController`
- 1 exponential-backoff retry for 5xx responses (not for 4xx)
- Request deduplication for concurrent calls to the same URL

**Estimated effort:** 1 day

---

### P2-9 — Cost Module Uses a Single Blended Tariff

**Affected file:** `backend/app/analytics/cost.py`

**Issue:** Indian commercial electricity tariffs are time-of-use (ToU): peak hours (typically 18:00–22:00) cost 2–3× off-peak. A flat 8.5 INR/kWh blended rate underestimates peak costs and overestimates off-peak costs, making cost optimization recommendations inaccurate.

**Fix:** Add ToU tariff schedule support in `config.py` (peak_hours, peak_tariff, off_peak_tariff). The `cost.py` module should bucket energy consumption by hour and apply the correct rate.

**Estimated effort:** 1 day

---

## 6. Low-Priority / Nice-to-Have (P3)

### P3-1 — No TypeScript in Frontend

The React codebase uses plain JavaScript. Type errors surface only at runtime. Given the complex API response shapes (EfficiencyResult, AnomalyEvent, AgentStep), TypeScript would catch shape mismatches at build time.

**Fix:** Migrate to `.tsx` files. Add Zod schema validation for API responses. Generate types from OpenAPI spec (`openapi-typescript`).

**Estimated effort:** 3–5 days

---

### P3-2 — No Unit Tests for Domain Logic

`app/analytics/` contains pure functions (no I/O, deterministic) that are trivially unit-testable but have zero test coverage. A bad refactor to `efficiency.py` thresholds could silently return wrong band labels.

**Fix:** Add `pytest` + `pytest-asyncio`. Write unit tests for `efficiency.py`, `anomaly.py`, `cost.py`, `forecast.py`, `maintenance.py` — at least 1 happy path + 1 edge case per function.

**Estimated effort:** 2 days

---

### P3-3 — No Multi-Tenancy (Single Facility Hardcoded)

All MySQL table names (`chiller_1_normalized`, etc.) are hardcoded to Unicharm's schema. Serving a second HVAC facility requires code changes, not configuration.

**Fix (Phase 6):** Abstract table names to a facility config (`FacilitySchema` mapping equipment IDs → table names). Tenant isolation via Postgres row-level security.

**Estimated effort:** 1–2 weeks

---

### P3-4 — Reports Are Markdown Only (No PDF Export)

`POST /reports/daily` returns a markdown string. Frontend renders it with `react-markdown`. There is no PDF generation capability for sharing with facility management.

**Fix:** Add `weasyprint` or `reportlab` backend. Add a `GET /reports/daily/pdf` endpoint. Frontend: "Download PDF" button.

**Estimated effort:** 1 day

---

### P3-5 — Dashboard Auto-Refresh Has No Debounce

The dashboard does not currently auto-refresh (requires manual page reload). When auto-refresh is added (planned), polling every 30s from 5 concurrent users generates 10 MySQL queries/minute for the same data.

**Fix:** Server-Sent Events for dashboard push (push-on-change instead of poll), or at minimum apply Redis cache (P1-1) before adding auto-refresh.

**Estimated effort:** 2–4 hours (cache) or 2 days (SSE push)

---

## 7. Improvement Plan — Phased Execution

### Sprint 1 — Security & Stability Foundation (1 week)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| P0-3: Fix stack trace leaking in error handler | P0 | 30 min | Harshan |
| P0-2: Drive CORS origins from env var | P0 | 1 hour | Harshan |
| P0-4: Add max_length validation on LLM inputs | P0 | 30 min | Harshan |
| P1-6: Add asyncio.wait_for timeout on agent tool calls | P1 | 1 hour | Harshan |
| P1-3: Add Alembic for database migrations | P1 | 1 day | Harshan |

**Goal:** Unblock deployment to a non-public staging server.

---

### Sprint 2 — Reliability & Core UX (1 week)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| P1-1: Implement Redis caching for hot endpoints | P1 | 1 day | Harshan |
| P1-5: Add rate limiting via slowapi | P1 | 4 hours | Harshan |
| P1-7: Define typed AppError hierarchy + frontend error alerts | P1 | 1 day | Harshan |
| P1-8: Add useApi hook + ErrorAlert in frontend | P1 | 1.5 days | Harshan |
| P2-3: Auto-persist analyzer messages on stream completion | P2 | 4 hours | Harshan |
| P2-6: Add data freshness warning in telemetry queries | P2 | 3 hours | Harshan |

**Goal:** First version that behaves reliably under normal use.

---

### Sprint 3 — Observability & RAG Completion (1 week)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| P2-7a: Add Prometheus metrics endpoint | P2 | 30 min | Harshan |
| P2-7b: Add Grafana + Loki to docker-compose | P2 | 1 day | Harshan |
| P1-2: Replace APScheduler with arq job queue | P1 | 1–2 days | Harshan |
| P1-4: Add POST /rag/ingest endpoint + frontend upload widget | P1 | 2 days | Harshan |
| P2-4: Add pagination to list endpoints | P2 | 4 hours | Harshan |

**Goal:** RAG is fully operational from the UI; anomaly jobs survive restarts; ops can monitor the system.

---

### Sprint 4 — Analytics Accuracy (1 week)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| P2-1: Move thresholds to config (efficiency bands, Z threshold) | P2 | 4 hours | Harshan |
| P2-5: Add tool result truncation in agent loop | P2 | 1 day | Harshan |
| P2-9: Add ToU tariff support in cost module | P2 | 1 day | Harshan |
| P2-2: Improve forecast with seasonal decomposition | P2 | 2–3 days | Harshan |
| P3-4: Add PDF export for daily reports | P3 | 1 day | Harshan |

**Goal:** Analytics outputs are accurate and trustworthy for operational decisions.

---

### Sprint 5 — Test Coverage & Code Quality (ongoing)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| P3-2: Add pytest unit tests for all analytics modules | P3 | 2 days | Harshan |
| P2-8: Centralize frontend API client with retry + timeout | P2 | 1 day | Harshan |
| P3-1: Migrate frontend to TypeScript | P3 | 3–5 days | Harshan |
| P3-3: Multi-tenancy design (Phase 6 scoping) | P3 | 1–2 weeks | Harshan |

---

## 8. Quick Wins (< 1 day each)

These are high-signal fixes that can be shipped in a single focused session:

1. **Fix error handler to not leak stack traces** — `backend/main.py` → 30 min
2. **Add `max_length` on `/analyze` and `/agent/run` inputs** — 30 min
3. **Add `asyncio.wait_for` on agent tool calls** — 1 hour
4. **CORS origins from env var** — 1 hour
5. **Add `prometheus-fastapi-instrumentator`** — 30 min (just adding the package + one line)
6. **Add `data_freshness_warning` to telemetry** — 3 hours
7. **Fix auto-persist of analyzer messages** — 4 hours
8. **Add `limit`/`cursor` params to `/anomalies/history`** — 3 hours

---

*Document last updated: 2026-05-14. Update this file after each sprint to reflect resolved items.*
