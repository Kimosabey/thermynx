# Tech Stack & Methods — HVAC AI Operations Intelligence Platform

This document inventories every framework, library, runtime, and AI method actually in use in the codebase (verified against `requirements.txt`, `package.json`, and source files — not aspirational).

---

## 1. Languages & Runtimes

| Layer | Choice | Why |
|---|---|---|
| Backend | **Python 3.11+** | Async I/O for streaming LLM + telemetry concurrently; mature ML/numerics ecosystem |
| Frontend | **JavaScript (React 18, ESM)** | Mature charting + state ecosystem; aligns with operator dashboard expectations |
| Build | **Vite 5** | Fast HMR; tree-shaken production bundle |
| Containers | **Docker Compose** | Reproducible Postgres + Redis stack for local POC |

---

## 2. Backend Framework Stack

### Web layer
- **FastAPI 0.115** — async ASGI framework, OpenAPI auto-generated at `/docs`
- **uvicorn[standard] 0.30** — production ASGI server, websockets ready
- **SlowAPI 0.1.9** — per-route rate limiting (`SlowAPIMiddleware`)
- **CORSMiddleware** — locked to the dev frontend + LAN regex
- **python-multipart** — multipart upload for RAG ingest endpoints

### Data layer
- **SQLAlchemy 2.0 (asyncio)** — modern declarative ORM; async engine + sessions
- **asyncpg 0.29** — high-performance Postgres async driver (used for `thermynx_app`)
- **aiomysql 0.2.0** — async MySQL driver (used for `unicharm` telemetry source)
- **alembic 1.14** — schema migration tool; HVAC has 3 revisions (`0001_initial_schema`, `0002_embeddings_vector_type`, `0003_embeddings_ivfflat_index`)
- **pgvector 0.4.2** — Postgres vector extension Python binding for RAG
- **redis 5.0.8 (async client)** — response caching layer (anomaly scans, daily reports)

### Validation & config
- **pydantic-settings 2.5** — typed env-driven config (`app/config.py`)
- **python-dotenv 1.0** — `.env` loader

### Background jobs
- **arq 0.25** — Redis-backed async task queue (used for periodic anomaly scans via `app/jobs/worker.py`)

### LLM HTTP client
- **httpx 0.27** — streaming HTTP/2 client for Ollama (`app/llm/ollama.py`)

### Document processing
- **pypdf 5.1** — PDF text extraction for RAG ingest

### Numerics
- **numpy 2.4** — array ops for anomaly z-score, forecast features

---

## 3. Frontend Framework Stack

### Core
- **React 18.3 + React-DOM** — concurrent rendering, Suspense ready
- **react-router-dom 6.28** — declarative routing for all feature pages

### UI / design system
- **Chakra UI 2.10** + `@chakra-ui/icons` — accessible component primitives
- **Emotion 11** (`@emotion/react`, `@emotion/styled`) — CSS-in-JS, Chakra's runtime
- **Framer Motion 11.12** — animated KPI counters, transitions, agent timeline
- **lucide-react** — icon set (used in Agent mode cards: ScanSearch, Zap, Wrench, etc.)

### Data visualisation
- **Recharts 3.8** — chiller timeseries, kW/TR bands, forecast lines

### Markdown / streaming
- **react-markdown 9** + **remark-gfm 4** — renders streamed LLM responses (tables, code blocks, GFM)

### Testing
- **Vitest 3 + jsdom 25** — unit tests for shared UI
- **@testing-library/react 16** — component testing

---

## 4. Data Stores

| Store | Image | Port | Role |
|---|---|---|---|
| **MySQL 8.0** (`unicharm`) | `mysql:8.0` (or native) | **3307** | Read-only telemetry source — 131 tables, ~18.9M rows: `chiller_*_normalized`, `cooling_tower_*_normalized`, `pv_*_om_p`, `gl_alarm`, `gl_subsystem`, etc. |
| **Postgres 16 + pgvector** (`thermynx_app`) | `pgvector/pgvector:pg16` | 5442 | App state — `threads`, `messages`, `agent_runs`, `analysis_audit`, `anomalies`, `embeddings` (vector(768)) |
| **Redis 7** | `redis:7-alpine` | 6380 | Response cache (anomaly scans, daily reports), arq job queue |

---

## 5. Observability & Operations

- **Prometheus 2.47** — scrapes `/metrics` (FastAPI Instrumentator), custom gauges in `app/observability/metrics.py` (e.g. `telemetry_data_age_seconds`, `telemetry_freshness_check_total`)
- **Alertmanager 0.27** — routes anomaly + freshness alerts
- **Loki 2.9 + Promtail 2.9** — log aggregation (uvicorn JSON logs → `logs/` → Loki)
- **Grafana 10** — dashboards (anonymous Admin in dev)
- **`prometheus-fastapi-instrumentator 7.1`** — drop-in metrics middleware
- **structured request IDs** — `app/observability/context.py` (`current_request_id` contextvar)

---

## 6. AI / LLM Stack

### Runtime
- **Ollama** (Tailscale-reachable at `100.125.103.28:11434`)

### Models in active use
| Model | Role | Why this one |
|---|---|---|
| **`qwen2.5:14b`** | Default analyzer + agent synthesizer | Strong tool-calling, fast on commodity GPU |
| **`llama3.3`, `llama3.2`** | Alternative chat backends | Available for A/B |
| **`llama3.2-vision`** | Vision compare (future plant-photo analysis) | Multimodal |
| **`nomic-embed-text`** | RAG embeddings (768-d) | Local, no API cost |
| **`phi`** | Lightweight auditor (planned) | Fast per-chunk admission scoring |
| **`mistral-small`, `gpt-oss:120b`, `nemotron-cascade-2`** | Experimental backends | Available via Ollama for benchmarking |

### LLM client design
- Single thin client in `app/llm/ollama.py` (`chat()`, `embed()`, `generate()`, `check_ollama_health()`)
- **Streaming SSE** end-to-end: Ollama tokens → backend `StreamingResponse` → frontend `react-markdown` re-renders mid-stream
- **Tool calling** via Ollama's `tools=[...]` parameter

---

## 7. AI Methods & Patterns (advanced level)

### 7.1 Streaming Analyzer (`/api/v1/analyze`)
- **Prompt template versioning** — `app/prompts/hvac_prompts.py` with hashed prompt + response stored in `analysis_audit` table for reproducibility
- **Context window construction** — equipment metadata + bucketed timeseries (15-min) + recent anomalies → system prompt
- **SSE token streaming** — `data: {type: "token", content: "..."}` frames
- **Audit trail** — every prompt/response hash + duration + token estimate persisted

### 7.2 ReAct Agent loop (`app/services/agent.py`)
Verified flow:
```
loop (MAX_STEPS=8):
  response = ollama.chat(messages, tools=TOOL_SCHEMAS)
  if response.tool_calls:
    for each tool_call:
      emit("tool_call", {tool, args, step})
      result = await execute_tool(...)        # with timeout
      emit("tool_result", {tool, result, step})
      messages.append(result)
  else:
    stream tokens → emit("token", ...)
    emit("done")
    break
```

- **5 agent modes** (`Investigator`, `Optimizer`, `Daily Brief`, `Root Cause`, `Maintenance`) — different system prompts, same loop
- **Tool schemas** — JSON-Schema function signatures for: `get_equipment_list`, `compute_efficiency`, `detect_anomalies`, `compare_equipment`, `get_timeseries`, `get_maintenance_health`, etc.
- **Run persistence** — `agent_runs` table stores goal, steps, mode, total_ms

### 7.3 Anomaly detection (`app/analytics/anomaly.py`)
- **Z-score over rolling baseline** — short window (current) vs. 72h baseline; multi-metric per equipment
- **Severity bucketing** — `|z| < 2` ok, `2-3` watch, `≥3` critical
- **Persistence** — anomalies snapshotted to Postgres `anomalies` table for trend analysis
- **Async batch scan** — arq worker runs scans periodically

### 7.4 Efficiency banding (`app/analytics/efficiency.py`)
- **Design-benchmark comparison** — kW/TR vs. `BENCHMARK_DESIGN`, `BENCHMARK_POOR`
- **Band classification** — excellent / good / fair / poor / critical
- **Loss drivers** — decomposes excess kW into low-ΔT, high-cond-temp, partial-load components

### 7.5 Predictive maintenance (`app/analytics/maintenance.py`)
- **Composite health score 0-100** with deductions per signal
- **Run-hour accounting** — rectangular integration of `is_running × bucket_h`
- **Degradation reasons** — human-readable strings for the LLM and UI
- **Type-aware metrics** — chillers get kW/TR + ΔT; towers get wet-bulb + cell count when sensors exist

### 7.6 Forecasting (`app/analytics/forecast.py`)
- Currently heuristic + recent-trend extrapolation
- Future swap-in points clearly defined for foundation models (Chronos, NHITS, TimeGPT)

### 7.7 RAG (`app/services/rag.py`, `app/api/v1/rag.py`)
- **Chunking** — recursive char-based splitter, configurable size/overlap
- **Embeddings** — `nomic-embed-text` 768-d via Ollama
- **Vector index** — pgvector `ivfflat` with cosine ops (lists=100)
- **Retrieval** — top-K cosine, admission threshold gate
- **Citation-aware synthesis** — LLM only synthesizes from admitted chunks

### 7.8 Cooling tower optimizer (`app/analytics/tower_optimizer.py`)
- **Wet-bulb-aware path** when sensors exist (low-WB: shed stage; high-WB: prioritise capacity)
- **kW-only fallback** when wet-bulb absent (typical Unicharm schema) — uses duty fraction + avg kW
- **`data_status` block** on the API surfaces which sensors are unavailable so the UI can render unambiguously

---

## 8. Architecture Patterns

| Pattern | Where | Why |
|---|---|---|
| **Layered separation** | `api/` (transport) → `services/` (orchestration) → `analytics/` (pure logic) → `db/` (I/O) | Pure-logic modules are unit-testable without DB |
| **Domain catalog** | `app/domain/equipment.py` | Single source of truth mapping `equipment_id → table → type` |
| **Streaming-by-default** | All LLM endpoints (`analyze`, `agent/run`) | Operators see tokens immediately, not a blank screen for 30s |
| **Cache-aside** | `app/services/cache.py` | `get_or_set(key, ttl, fetch)` over Redis for expensive endpoints |
| **Async-first** | All I/O paths are `async def` | One uvicorn worker can handle many concurrent streams |
| **Versioned API** | `/api/v1/...` prefix | Forward compatibility |
| **Versioned prompts** | Hash in `analysis_audit` | Reproducible LLM behavior across prompt edits |
| **Type-safe config** | `pydantic-settings` | Misconfig caught at startup |
| **Idempotent migrations** | `alembic` revisions guarded by `inspector.get_table_names()` | Safe re-runs on shared dev DBs |

---

## 9. Security & Resilience

- **Rate limiting** — SlowAPI on user-facing routes (analyzer, agent)
- **Read-only DB user** — `DB_USER` should be `ro_user` for `unicharm` in production
- **No secrets in repo** — `.env` gitignored; `.env.example` checked in
- **Health checks** — `/api/v1/health` reports DB connection, Ollama reachability, telemetry freshness
- **Graceful degradation** — agent / analyzer return clear errors when Ollama or DB are unreachable
- **Tool timeouts** — every agent tool call has a hard deadline (no infinite loops)
- **Step caps** — agent loop bounded by `MAX_STEPS = 8`
- **Request IDs** — every request tagged in logs for cross-stack tracing

---

## 10. Infrastructure & Network

- **Tailscale** — secure overlay between dev hosts, Ollama server, and MySQL `unicharm`
- **docker-compose profiles** — `obs` profile gates the monitoring stack (Prometheus/Loki/Grafana) so dev doesn't pay the cost
- **Host port offsets** — `5442` (Postgres), `6380` (Redis), `8181` (Redis Commander) chosen to coexist with other local stacks

---

## 11. Developer Experience

- **Hot reload** — uvicorn `--reload` on backend, Vite HMR on frontend
- **OpenAPI Swagger** — `/docs` auto-generated, interactive
- **Smoke tests** — `backend/tests/smoke_test.py` covers 6 critical endpoints before tagging
- **Make targets** — `make deps`, `make stop`, `make reset`, `make logs`
- **Structured logging** — `app/log.py` JSON formatter, ready for Loki

---

## 12. What's NOT in the stack (intentionally, for now)

| Not used | Reason | When to add |
|---|---|---|
| LangChain / LangGraph | Custom agent loop is ~250 lines and gives full streaming control | When we need multi-agent orchestration (Phase 6 item #1) |
| OpenAI / Anthropic SDK | All inference is local via Ollama (Tailscale) | If we add cloud failover or vision-pro features |
| Celery | arq is leaner and async-native | If we need cross-process distributed scheduling |
| Kafka / NATS | Single-plant POC doesn't need event bus | At multi-site rollout |
| Auth (Auth0, Keycloak) | POC runs on trusted LAN | Before production exposure |
| TLS termination in-app | Reverse proxy will handle (Caddy/Traefik) | Production |
| Sentry / OTel traces | Prometheus + Loki cover current needs | When request volumes grow |
| Vector store besides pgvector | One Postgres is enough for plant-scale corpus | Above ~10M chunks |
| GraphQL | OpenAPI + REST is more debuggable | Only if frontend ergonomics demand it |

---

## 13. Stack at a glance (one-liner per layer)

```
Browser  → React 18 + Vite + Chakra + Recharts + Framer Motion + react-markdown (streamed)
   ↓ HTTP / SSE
FastAPI → SlowAPI (rate-limit) → SQLAlchemy(async) + asyncpg + aiomysql + Redis(async)
   ↓
Local LLM (Ollama) — qwen2.5:14b synth · nomic-embed-text embed · llama3.2-vision · phi
   ↓
Telemetry MySQL (unicharm) · App Postgres+pgvector (thermynx_app) · Redis (cache+arq)
   ↓
Prometheus + Alertmanager + Loki + Promtail + Grafana  (profile: obs)
```

---

_Last verified against codebase: 2026-05-21._
