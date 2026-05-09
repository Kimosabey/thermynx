# THERMYNX — End-to-End Build Plan

**Product:** THERMYNX AI Operations Intelligence Platform
**Owner:** Harshan Aiyappa (Graylinx AI)
**Customer:** Unicharm Facility (HVAC plant rooms)
**Repo:** https://github.com/Kimosabey/thermynx
**Status:** **POC in progress** — Phase 0 foundation complete (10 commits on `master`). Full architecture preserved as north star; current scope is in §1A.
**Visual reference:** all architecture diagrams + system flows render inline at [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (sources in [`docs/diagrams/`](docs/diagrams/)).

---

## 1. Executive Summary

THERMYNX is an enterprise AI platform that turns raw HVAC telemetry from the Unicharm chiller plant into operational intelligence: real-time KPIs, efficiency benchmarking, anomaly detection, energy forecasting, and conversational AI explanations powered by a privately hosted Ollama LLM.

The product converts the existing `unicharm` MySQL database (port 3307) — already populated with normalized chiller, cooling tower, condenser pump, and AHU data — into a decision-support tool for plant operators, energy engineers, and facility managers.

---

## 1A. Current Scope: Proof of Concept

**This document describes the full target state.** Implementation is staged — POC first, hardening later. The full target stays here as a north star so we don't rebuild it from scratch when we're ready to harden.

### POC strategy — end-to-end across all features, at POC quality
We build **all feature phases** (analyzer → intelligence → advanced → RAG) in POC mode — rough but working — so we prove the full product story works *before* spending time on production hardening (auth, monitoring, security, scale, deploy automation).

Each feature phase has its own **demo gate**. POC is complete when all feature phases (1–4) have working demos.

### In-scope (POC quality, all feature phases)
- All API endpoints from feature Phases 1–4: `/equipment`, `/timeseries`, `/analyze`, `/efficiency`, `/anomalies`, `/forecast`, `/compare`, `/maintenance`, `/cost`, `/reports`, `/threads`, `/agent/investigate`, RAG retrieval
- React + TypeScript SPA (Chakra UI, TanStack Query) with all corresponding pages — including the **Agentic Investigator** copilot page
- Docker compose dev stack: api + postgres + redis (MySQL `unicharm` + Ollama via Tailscale)
- Pydantic Settings, structured stdout logs, basic error responses
- POC-grade schemas for `analysis_audit`, `threads`, `messages`, `anomalies`, `feedback`, `baselines`, `embeddings`, `agent_runs`
- README + `make dev` so anyone can run it locally in < 10 min

### Explicitly deferred to Post-POC Hardening (Phase 5+)
| Area | Deferred item |
|------|---------------|
| **Auth** | JWT, refresh tokens, RBAC, SSO — POC has no auth (or one shared password) |
| **Hardening** | Rate limiting, CORS lockdown, CSP, security headers, PII scrubber |
| **Observability** | Prometheus, Loki, Tempo, Grafana, Sentry, Alertmanager — POC = stdout JSON logs |
| **Resilience** | Circuit breakers, bulkheads, stale-while-revalidate — POC = basic timeouts |
| **Supply chain** | Trivy, Dependabot, SBOM, cosign — Phase 5 |
| **Edge** | nginx, TLS termination, image registry, runbook, RTO/RPO — Phase 5 |
| **Scaling** | Multi-replica, load tests, perf-budget CI gates — Phase 5 |
| **Workers** | arq with persistent queue — POC uses APScheduler in-process |
| **Multi-tenant** | Tenant isolation, white-label, per-tenant config — Phase 6 |

### Definition of "POC complete"
1. Every feature phase (1–4) has a working demo on `master` with its phase tag (`v0.1`, `v0.2`, `v0.3`, `v0.4`)
2. All hero stories work end-to-end: analyzer streams · anomalies fire · forecast renders · RAG cites sources · threads persist
3. Stack starts via `make dev` on a clean laptop in < 10 min
4. `v1.0.0-poc` tag on `master` once all phases land
5. Walkthrough video covering each phase

After POC sign-off → **Phase 5 Hardening** before any customer-facing deploy.

---

## 2. Product Vision

> **"Make every kWh of cooling at Unicharm explainable, optimizable, and predictable."**

### Pillars
1. **Visibility** — Live KPIs (kW/TR, ΔT, run hours, load) with historical context
2. **Intelligence** — LLM-powered narrative analysis ("why is chiller 1 inefficient?")
3. **Proactivity** — Anomaly detection and forecasting before issues escalate
4. **Auditability** — Every recommendation traceable to source data + prompt + model

---

## 3. Target Users & Core Use Cases

| Persona | Goals | Key Modules |
|---------|-------|-------------|
| **Plant Operator** | Monitor equipment health in real time, react to alerts | Dashboard, Live Anomalies |
| **Energy Engineer** | Benchmark efficiency, identify waste, justify retrofits | AI Analyzer, Reports, Forecasting |
| **Facility Manager** | Track ops KPIs, prepare board reports | Executive Dashboard, Cost Analytics |
| **Maintenance Lead** | Plan PMs based on run hours and degradation | Predictive Maintenance |

### Hero Use Cases (MVP scope)
- **UC1:** "Show me chiller 1 performance over the last 24h with an AI explanation."
- **UC2:** "Why was kW/TR poor on May 6 between 14:00–16:00?"
- **UC3:** "Compare chiller 1 vs chiller 2 efficiency this week."

---

## 4. Architecture

THERMYNX is a layered, async-first system with hard read/write isolation between the customer's telemetry source (MySQL) and the platform's own application data (PostgreSQL). Every cross-process call has an explicit timeout, a performance budget, and a defined failure mode.

### 4.1 Architectural Principles

1. **Async by default.** Every I/O path is asyncio + pooled. No blocking calls in the request hot path.
2. **Layered with explicit boundaries.** Transport → Service → Domain → Infrastructure. Domain has zero I/O imports — trivially unit-testable.
3. **Read/write isolation.** `unicharm` MySQL credential is read-only at the DB level. App writes land only in `thermynx_app` Postgres.
4. **Stateless API replicas.** Session state lives in Redis or Postgres, never in process memory — horizontal scaling is free.
5. **Typed contracts everywhere.** Pydantic v2 on the backend; OpenAPI-generated TypeScript on the frontend. No hand-written API types.
6. **Fail fast at boundaries, degrade gracefully in transit.** Reject bad input early; serve stale cache when Ollama is open-circuit.
7. **Observable by construction.** A `request_id` is generated at the edge and propagated through every log line, span, DB query comment, and downstream call.
8. **12-factor config.** Pydantic Settings; secrets injected; nothing hardcoded; missing required env crashes at boot, not at first request.
9. **Reversible decisions over clever ones.** No premature abstractions, no microservices, no message bus until the monolith proves it can't keep up.

### 4.2 System Context (C4 — Level 1)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                            THERMYNX PLATFORM                             │
│                                                                          │
│   ┌─────────────┐    HTTPS/SSE    ┌──────────────┐                      │
│   │  React SPA  │ ◄─────────────► │   FastAPI    │                      │
│   │  (Vite +    │                 │   Backend    │                      │
│   │  Chakra UI) │                 │  (asyncio)   │                      │
│   └─────────────┘                 └──────┬───────┘                      │
│                                          │                              │
│            ┌──────────────┬──────────────┼──────────────┬──────────┐    │
│            ▼              ▼              ▼              ▼          ▼    │
│     ┌───────────┐  ┌─────────────┐ ┌───────────┐ ┌──────────┐ ┌──────┐ │
│     │ Schema /  │  │  Analytics  │ │  Prompt   │ │  Auth /  │ │ arq  │ │
│     │ Telemetry │  │  (eff/anom/ │ │  Builder  │ │  Audit   │ │ Jobs │ │
│     │  Service  │  │   forecast) │ │           │ │          │ │      │ │
│     └─────┬─────┘  └──────┬──────┘ └─────┬─────┘ └────┬─────┘ └──┬───┘ │
└───────────┼───────────────┼──────────────┼────────────┼──────────┼─────┘
            │               │              │            │          │
            ▼               ▼              ▼            ▼          ▼
   ┌────────────────┐  ┌───────────────────────┐  ┌──────────────────────┐
   │  MySQL         │  │  PostgreSQL           │  │  Redis               │
   │  unicharm:3307 │  │  thermynx_app         │  │  - response cache    │
   │  READ-ONLY     │  │  - users / JWT        │  │  - prompt cache      │
   │  - normalized  │  │  - threads / history  │  │  - arq queue         │
   │  - raw metric  │  │  - rollups (h/d KPI)  │  │  - rate-limit state  │
   │  (source data) │  │  - audit log          │  └──────────────────────┘
   └────────────────┘  │  - pgvector (RAG P4)  │
                       └───────────────────────┘
                                  │
                                  ▼
                       ┌────────────────────────────┐
                       │  Ollama (Tailscale)        │
                       │  100.125.103.28:11434      │
                       │  - llama3.1 / qwen2.5      │
                       │  - nomic-embed-text (P4)   │
                       └────────────────────────────┘
```

### 4.3 Component Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Frontend** | UI, charts, markdown rendering, server/client state, routing |
| **API Gateway** | Auth, rate-limit, request validation, OpenAPI docs, problem-details errors |
| **Schema Service** | Introspect telemetry tables, build context windows for LLM |
| **Prompt Builder** | Compose HVAC-specific prompts with live data + benchmarks (versioned) |
| **LLM Client** | Async Ollama calls — streaming, retry, timeout, circuit breaker |
| **Cache Layer** | Redis — hot query cache, prompt-response cache, rate-limit counters |
| **Job Queue** | arq (Redis-backed) — periodic anomaly scans, rollup refresh, report generation |
| **Telemetry DB (RO)** | Async SQLAlchemy + aiomysql against `unicharm` MySQL — source HVAC data only |
| **App DB (RW)** | Async SQLAlchemy + asyncpg against `thermynx_app` PostgreSQL — users, threads, rollups, audit, embeddings |

### 4.4 Backend Layered Architecture (C4 — Level 2)

```text
┌─ Transport (FastAPI) ─────────────────────────────────────┐
│   /api/v1/* routers · Pydantic v2 request/response models │
│   OpenAPI auto-spec · SSE for /analyze · problem+json     │
├─ Middleware Chain ────────────────────────────────────────┤
│   request_id → CORS → security headers → auth (JWT)       │
│   → rate-limit (slowapi) → structlog binder → OTel span   │
├─ Service Layer ───────────────────────────────────────────┤
│   EquipmentService · TimeseriesService · AnalysisService  │
│   AnomalyService · ForecastService · AuditService         │
│   Orchestrate repos + domain + LLM. No SQL strings here.  │
├─ Domain Layer (pure, no I/O) ─────────────────────────────┤
│   kW/TR calculator · efficiency bands · z-score detector  │
│   PromptBuilder · ResponseParser · TimeRange invariants   │
├─ Infrastructure (Repos + Clients) ────────────────────────┤
│   TelemetryRepo (aiomysql)   AppRepo (asyncpg)            │
│   LLMClient (httpx → Ollama) CacheClient (redis-py)       │
│   JobQueue (arq)             EmbeddingClient (P4)         │
└───────────────────────────────────────────────────────────┘
```

**Dependency rule:** dependencies point **inward**. Domain knows nothing about FastAPI or SQLAlchemy. Services depend on repository **interfaces** (Protocol classes), not concrete drivers — swap aiomysql for a read replica without touching service code.

### 4.5 Request Lifecycle

For every request to `/api/v1/*`:

1. **`request_id`** middleware — generate ULID, attach to `request.state`, echo as `X-Request-Id` response header
2. **CORS** — locked to deployed origin in prod; permissive in dev only
3. **Security headers** — `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy` (strict)
4. **Auth** — JWT verify, attach `request.state.user_id` (or 401)
5. **Rate limit** — slowapi keyed on `(user_id, route)` for authed, IP for public
6. **Logging context** — structlog binds `request_id`, `user_id`, `route` for the rest of the call
7. **Tracing** — OTel server-kind span; child spans inside repos and LLM client carry the same trace id
8. **Handler** — Pydantic validates input → service is invoked → response model serialized
9. **Error handler** — typed exceptions → RFC 7807 problem-json; unexpected → 500 with `request_id` only (no stack trace to client)

### 4.6 Streaming Pipeline (`POST /api/v1/analyze`)

```text
React (useStreamingAnalysis hook)
        │ fetch + ReadableStream  (SSE)
        ▼
FastAPI handler  ──►  StreamingResponse(AsyncIterator[bytes])
        │
        ▼
AnalysisService.stream(request)
   ├─ build prompt (domain, pure)
   ├─ open Ollama stream (httpx, line-delimited JSON)
   ├─ for each chunk: yield SSE frame "data: <json>\n\n"
   ├─ on disconnect (request.is_disconnected): cancel httpx → Ollama task
   ├─ heartbeat ":keepalive\n\n" every 15 s
   └─ on finalize: write audit row (prompt hash, response hash, tokens, latency)
```

**Why each detail matters:**
- **Disconnect cancellation** stops wasted Ollama compute when the user navigates away.
- **Keepalive frames** stop nginx / corporate proxies from killing idle SSE connections.
- **Audit on finalize** keeps partial-failure analysis accurate (failed streams are recorded as failed, not silently dropped).

### 4.7 Concurrency, Timeouts, Resilience

Every cross-process call has a configured budget. **No naked `await`** — `asyncio.timeout()` everywhere.

| Call | Connect | Total | Retry | Circuit breaker |
|------|---------|-------|-------|-----------------|
| MySQL query | 1 s | 5 s | none — fail fast | n/a |
| Postgres query | 1 s | 3 s | none | n/a |
| Redis | 100 ms | 200 ms | 1 retry | open after 10 fails / 30 s |
| Ollama generate | 2 s | 60 s (8 s to first token) | 1 retry on conn error | open after 5 fails / 60 s |
| Ollama embed | 2 s | 10 s | 2 retries | shared with generate |

**Pools:** SQLAlchemy `pool_size=10, max_overflow=10` per DB per worker. One reusable `httpx.AsyncClient` per upstream (Ollama) for HTTP/2 multiplexing.

**Bulkhead:** Ollama failure must not exhaust DB pools. A semaphore caps concurrent LLM calls per worker so a stalled Ollama can't hold all request slots.

**Graceful degradation:** when the Ollama circuit is open, `/analyze` returns the last cached response (if any) with header `X-Cache: stale; reason=upstream-down`, otherwise 503 with retry-after.

### 4.8 Caching Strategy (multi-level)

| Layer | Tool | Use | TTL |
|-------|------|-----|-----|
| L1 — HTTP | `Cache-Control` headers | `/equipment` and other static metadata | 5 min |
| L2 — In-process LRU | `cachetools.TTLCache` | Schema introspection, equipment catalog | 5 min |
| L3 — Redis (response) | redis-py | `/timeseries` keyed by `(eq_id, range, resolution)` | 60 s |
| L4 — Redis (prompt) | redis-py | LLM responses keyed by `hash(model + prompt)` | 1 h, non-personalized only |

**Invalidation:** TTL-only for MVP. Event-driven invalidation (e.g., on rollup refresh) added in Phase 2. Cache keys include a `cache_version` constant so a deploy can invalidate everything by bumping it.

### 4.9 Frontend Architecture

- **Language:** TypeScript 5, `strict: true`, `noUncheckedIndexedAccess: true`
- **Build:** Vite + SWC; route-level code splitting via `React.lazy`
- **Routing:** React Router v6
- **State — separated by concern:**
  - **Server state** → TanStack Query v5 (cache, refetch, invalidation, optimistic updates, retry)
  - **Client UI state** → Zustand (selected equipment, time range, theme) — small, no provider boilerplate
  - **Form state** → react-hook-form + Zod validators (shared with backend Pydantic via OpenAPI)
- **API client:** generated from backend OpenAPI via `openapi-typescript` — regenerated in CI on every backend change. Zero hand-written fetch calls.
- **Streaming:** custom `useStreamingAnalysis` hook over `fetch` + `ReadableStream` (SSE-shaped, AbortController on unmount)
- **Error tracking:** Sentry (frontend SDK), with `request_id` from response headers attached to every captured error
- **Folder layout — feature-sliced:**

```text
src/
├── app/             # providers, router, theme, queryClient, sentry init
├── features/
│   ├── analyzer/    # AI Analyzer page + hooks + components + types + tests
│   ├── equipment/   # equipment selector, catalog hooks
│   ├── anomalies/
│   └── forecast/
├── shared/
│   ├── ui/          # Chakra-wrapped primitives (Card, Stat, Chart)
│   ├── api/         # generated OpenAPI client + queryClient
│   └── lib/         # date, format, ulid
└── main.tsx
```

A feature folder is **self-contained**. Cross-feature imports go through `shared/`. No feature imports another feature directly.

### 4.10 Configuration & Secrets

- **Pydantic Settings v2** — single typed `Settings` class, frozen, `Depends(get_settings)` everywhere
- **Source order:** class defaults → `.env` (dev only, gitignored) → process env (prod) — first match wins
- **Validation at boot:** missing required env crashes the process before serving traffic
- **Secrets:** never in repo, never in `.env.example`. Injected via Docker secrets / K8s secrets / Vault. `.env.example` lists keys with placeholder values only.
- **Per-environment overrides:** no separate config files — env vars only, set by the runtime

### 4.11 Error Model

**Backend exception hierarchy:**
```
AppError
├── NotFoundError          → 404
├── ValidationError        → 400
├── AuthError              → 401 / 403
├── RateLimitError         → 429
├── UpstreamError          → 502
│   ├── DBError
│   └── LLMError
│       └── LLMTimeoutError → 504
└── InternalError          → 500
```

Global handler maps every `AppError` to **RFC 7807 Problem Details**:

```json
{
  "type": "/errors/llm-timeout",
  "title": "LLM upstream timeout",
  "status": 504,
  "detail": "Ollama did not return a token within 8s",
  "request_id": "01HZ8K3..."
}
```

Stack traces never reach the client; they're logged with the `request_id`. The frontend renders `detail` plus a "report this" button that includes `request_id` for support.

### 4.12 Performance Budgets

Explicit, enforced via load tests in CI before each release. Regressions are bugs, not "we'll fix it later":

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| `GET /api/v1/equipment` | 50 ms | 150 ms | 300 ms |
| `GET /api/v1/equipment/{id}/timeseries?range=24h&res=5m` | 200 ms | 600 ms | 1 s |
| `POST /api/v1/analyze` — first token | 1 s | 3 s | 5 s |
| `POST /api/v1/analyze` — full response (24h window) | 4 s | 8 s | 12 s |
| Frontend FCP (cable) | 1 s | 1.5 s | 2 s |
| Frontend route transition | 100 ms | 300 ms | 500 ms |

### 4.13 Deployment Topology (on-premise, single host)

THERMYNX deploys to **one Linux server inside the Unicharm plant network**. No cloud, no Kubernetes, no image registry. Everything runs as a docker compose stack on that single host.

```text
                       Unicharm plant network
                                  │
                                  ▼
            ┌──────────────────────────────────────────┐
            │   THERMYNX on-prem host (single Linux)   │
            │            docker compose stack          │
            │                                          │
            │   ┌──────────────┐                       │
            │   │    nginx     │  TLS, gzip,           │
            │   │              │  static dist,         │
            │   │              │  /api proxy,          │
            │   │              │  security headers     │
            │   └──────┬───────┘                       │
            │          │                               │
            │          ▼                               │
            │   ┌──────────────┐   ┌──────────────┐    │
            │   │     api      │   │    worker    │    │
            │   │  (uvicorn,   │   │    (arq —    │    │
            │   │  N workers)  │   │  rollups +   │    │
            │   │              │   │   anomaly)   │    │
            │   └──────┬───────┘   └──────┬───────┘    │
            │          │                  │            │
            │          ├──────────────────┤            │
            │          ▼                  ▼            │
            │   ┌────────────┐     ┌────────────┐      │
            │   │ Postgres   │     │ Redis      │      │
            │   │ thermynx   │     │ cache +    │      │
            │   │   _app     │     │ arq queue  │      │
            │   │  (volume + │     │            │      │
            │   │  pg_dump)  │     │            │      │
            │   └────────────┘     └────────────┘      │
            └──────────────────────────────────────────┘
                       │                  │
              Tailscale│                  │Tailscale
                       ▼                  ▼
            ┌──────────────────┐  ┌────────────────────┐
            │  MySQL `unicharm`│  │  Ollama box        │
            │  port 3307       │  │  100.125.103.28    │
            │  (Unicharm side, │  │  :11434            │
            │  RO user)        │  │  llama3.1 / qwen2.5│
            └──────────────────┘  └────────────────────┘
```

**Properties:**
- One host runs five containers: **nginx · api · worker · postgres · redis**
- API and worker are separate processes — long jobs don't starve requests, but they share the host's CPU/RAM
- nginx terminates TLS, serves built `dist/` directly, proxies `/api/*` to the api container
- Postgres lives in a docker named volume; `pg_dump` cron writes to `/backup/` (mounted to NAS or external disk)
- Redis: AOF off for cache, RDB snapshots every 15 min for arq queue durability
- MySQL `unicharm` and Ollama are reached over Tailscale — not part of this stack, not our deployment concern
- **Scaling story:** vertical first (bigger host). Horizontal scaling deferred until a second customer site exists.
- **DR:** rebuild stack on a spare host from `git pull` + image tarball + latest `pg_dump`. Target RTO < 4 h.

### 4.14 System Flows (Sequence Diagrams)

End-to-end traces for the five critical paths. Format: `[participant] action`.

#### 4.14.1 UC1 — "Show chiller_1, last 24h, with AI explanation"

```text
 1. [User]      clicks chiller_1, range=24h, asks "explain efficiency"
 2. [SPA]       GET /api/v1/equipment
 3. [API]       request_id → CORS → JWT → rate-limit → L2 in-process LRU lookup
 4. [API]       MISS → SELECT FROM information_schema → cache SET (5m) → 200
 5. [SPA]       GET /api/v1/equipment/chiller_1/timeseries?range=24h&res=5m
 6. [API]       middleware → Redis L3 cache lookup
 7. [API]       MISS → SELECT FROM chiller_1_normalized WHERE slot_time BETWEEN ...
 8. [MySQL]     return ~288 rows
 9. [API]       Redis SET (60s TTL) → 200 [points]
10. [SPA]       render Recharts chart, open AI panel
11. [SPA]       POST /api/v1/analyze {equipment_id, range, question}
12. [API]       middleware → INSERT analysis_audit (status=streaming)
13. [API]       PromptBuilder.build(equipment, stats, question) → prompt
14. [API]       L4 prompt cache check (hash of prompt+model)
15. [API]       MISS → open StreamingResponse to SPA + httpx.stream → Ollama
16. [Ollama]    yield chunk 1, chunk 2, ... chunk N (line-delimited JSON)
17. [API]       transform each chunk → SSE frame "data: <json>\n\n" → SPA
18. [SPA]       on each frame: append to markdown state, re-render
19. [API]       on done=true: write final response to L4 cache (1h TTL)
20. [API]       UPDATE analysis_audit SET status=ok, response_hash, tokens, total_ms
21. [SPA]       on {type:done}: stop streaming, render final markdown
```

**Failure branches:**
- Step 8: MySQL timeout (5s) → `DBError` → 502 problem+json, frontend toast
- Step 15: Ollama circuit open → return last L4 stale hit with `X-Cache: stale`, else 503
- Step 18: client disconnects → `request.is_disconnected()` → cancel httpx → audit `status=cancelled`

#### 4.14.2 UC2 — "Why was kW/TR poor on 2026-05-06 14:00–16:00?"

```text
 1. [User]      sets explicit time window, asks "why poor kW/TR?"
 2. [SPA]       POST /api/v1/analyze {equipment_id, time_range, question}
 3. [API]       middleware → audit INSERT
 4. [API]       TimeseriesService.fetch_window(eq, from, to, res=1m) → MySQL
 5. [API]       AnalyticsDomain.compute_stats(points) → {min,max,avg,p95 of each metric}
 6. [API]       AnomalyDomain.detect(points, baseline_from_PG) → flagged windows
 7. [API]       PromptBuilder.build(stats, anomalies, question) → prompt
 8. [API]       stream from Ollama (UC1 steps 15–19)
 9. [SPA]       render markdown; cited timestamps are clickable → chart scrolls there
```

#### 4.14.3 UC3 — Compare chiller_1 vs chiller_2 this week

```text
 1. [User]      selects two equipment + range=7d
 2. [SPA]       parallel: GET /timeseries?eq=chiller_1 + GET /timeseries?eq=chiller_2
                (TanStack Query fans out, independent cache keys)
 3. [API]       both calls hit Redis L3 independently
 4. [SPA]       render overlay chart with synchronized cursor
 5. [SPA]       POST /api/v1/analyze {mode:"compare", eq_a, eq_b, range, question}
 6. [API]       asyncio.gather(fetch_a, fetch_b) → compute deltas
 7. [API]       PromptBuilder.compare(eq_a_stats, eq_b_stats, deltas) → prompt
 8. [API]       stream from Ollama (same SSE path)
 9. [SPA]       render side-by-side commentary panels
```

#### 4.14.4 Auth flow (Phase 3)

```text
 1. [User]      submits username + password
 2. [SPA]       POST /api/v1/auth/login {username, password}
 3. [API]       AuthService.verify → SELECT FROM users WHERE username=$1
 4. [API]       bcrypt.verify(password, user.password_hash)
 5. [API]       issue access_token (JWT, 15m) + refresh_token (random, 7d)
 6. [API]       INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
 7. [API]       200 {access_token}; refresh_token in httpOnly Secure cookie
 8. [SPA]       store access_token in memory (Zustand), attach via OpenAPI client
 9. (later)     access expires → SPA POST /api/v1/auth/refresh (cookie sent)
10. [API]       AuthService.refresh → verify hash, rotate refresh_token, issue new access
11. [API]       UPDATE refresh_tokens SET revoked_at=now() for old token
```

#### 4.14.5 Anomaly scan (background job)

```text
 1. [arq scheduler]  cron fires anomaly_scan job every 5 min
 2. [arq worker]     SELECT equipment_id FROM equipment_catalog (cached)
 3. [arq worker]     for each equipment_id:
 4. [arq worker]       fetch last 60 min from MySQL (read-only)
 5. [arq worker]       baseline = SELECT FROM baselines WHERE eq=? AND hour_of_day=?
 6. [arq worker]       AnomalyDomain.detect(points, baseline)
 7. [arq worker]       if z_score > 3:
 8. [arq worker]         INSERT INTO anomalies (eq, metric, started_at, z_score, ...)
 9. [arq worker]         enqueue narrate_anomaly job → Ollama summary
10. [arq worker]         publish Redis pub/sub "anomalies.new" → SPAs via WebSocket (P2+)
11. [arq scheduler]  cron fires baseline_refresh job hourly → recompute hour-of-day means
12. [arq worker]     UPSERT into baselines table per (equipment_id, metric, hour_of_day)
```

---

## 5. Tech Stack Rationale

| Choice | Why |
|--------|-----|
| **FastAPI** | Async-native, auto OpenAPI docs, Pydantic validation — best fit for AI + DB I/O |
| **React + Vite** | Fast HMR, modern DX; Vite proxy keeps dev simple |
| **Chakra UI** | Enterprise-grade tokens, accessible, theme-able for white-label later |
| **Ollama (self-hosted)** | Data privacy (no cloud calls with HVAC data), cost predictability |
| **MySQL `unicharm`** (telemetry, read-only) | Already exists, populated, indexed — reuse as source-of-truth, never write back |
| **PostgreSQL `thermynx_app`** (app DB) | Owns everything THERMYNX *creates*: users, threads, rollups, audit, embeddings. Keeps source data clean and lets us use pgvector for RAG without a 4th service |
| **pgvector** (extension) | RAG embeddings live next to relational app data — one connection pool, one backup, no separate vector DB ops |
| **Redis** | Response/prompt cache, rate-limit counters, and arq job queue — single service, three jobs |
| **arq** (Redis queue) | Async job runner for periodic anomaly scans + rollup refresh; native asyncio, no Celery weight |
| **aiomysql + SQLAlchemy** | Async ORM with raw-SQL escape hatch for time-series queries on `unicharm` |
| **asyncpg + SQLAlchemy** | Async driver for `thermynx_app` Postgres |
| **Alembic** | Schema migrations for `thermynx_app` only (MySQL `unicharm` is read-only — no migrations from us) |
| **react-markdown** | Render LLM output with tables, code, lists natively |
| **Tailscale** | Zero-trust access to Ollama box without exposing public ports |

### 5.1 Data Store Strategy — Decided

We run **two databases on purpose**, not by accident:

| Store | Role | Access | Owns |
|-------|------|--------|------|
| **MySQL `unicharm:3307`** | Source telemetry | Read-only, dedicated user | Chiller / cooling tower / pump / AHU normalized + raw tables |
| **PostgreSQL `thermynx_app`** | Application state | Read/write | Users, JWT refresh, conversation threads, audit log, hourly/daily KPI rollups, vector embeddings, feedback, prompt versions |
| **Redis** | Ephemeral state | Read/write | Cache, rate-limit, arq queue |
| **Ollama** (Tailscale) | LLM inference | Network call | No persistent state on our side |

**Why not just MySQL for everything?**
- We do **not** want THERMYNX writes (chat history, audit, rollups, embeddings) to land in the customer's plant data DB. Hard separation = safer ops, simpler permissions, easier read-replica path later.
- pgvector on Postgres is mature and removes the need for Chroma/Qdrant entirely.

**Why not TimescaleDB / dedicated TSDB?**
- The telemetry already lives in MySQL with `slot_time`-indexed normalized tables — fine for MVP query patterns (24h–7d windows). Revisit only if rollup queries cross 1s p95.

**Why not a separate vector DB (Chroma/Qdrant/Weaviate)?**
- One more service to deploy, monitor, back up. pgvector handles ≤ low-millions of embeddings comfortably, which is well past Phase 4 RAG scope (manuals + incident reports).

**Object storage (MinIO / S3):** *deferred to Phase 4* when the report builder ships and we need to persist generated PDFs. Not needed before that.

---

## 6. Phased Build Roadmap

> Feature phases 1–4 are built at **POC quality** — rough but working — so we verify the full product story end-to-end. **Hardening (Phase 5) is deferred** until POC is signed off. Each phase ends with a demoable cut and a phase tag.

### Phase 0 — Foundation ✅ DONE (2026-05-08)
- Repo initialized, scaffolded, pushed
- Backend: db/session, llm/ollama, prompts, services, /analyze, /health
- Frontend: dark theme, Sidebar, Layout, AIAnalyzer, Dashboard
- 10 feature-wise commits on `master`

### Phase 1 — POC: Live AI Analyzer ✅ DONE (2026-05-09) → tag `v0.1.0-poc`
**Goal:** Operator can pick equipment → time range → ask question → get AI answer with chart.

**Deliverables:**
- [x] `GET /api/v1/equipment` — list normalized equipment
- [x] `GET /api/v1/equipment/{id}/timeseries` — last N hours of data (1m/5m/15m/1h resolution)
- [x] `GET /api/v1/equipment/summary` — aggregated stats for all equipment (Dashboard)
- [x] `POST /api/v1/analyze` — SSE streaming markdown response
- [x] Frontend: equipment selector + date-range picker + gradient Recharts chart + AI chat panel
- [x] `analysis_audit` Postgres table — every analyze call logged
- [x] `docker-compose.yml` (Postgres + Redis), `.env.example`, `Makefile`
- [x] README with `make dev` quick-start
- [x] `tests/smoke_test.py` — 6 end-to-end checks
- [x] Modern dark UI — glassmorphism cards, Framer Motion, responsive sidebar
- [x] Tables auto-created on startup via `Base.metadata.create_all`

**Demo gate:** ✅ chiller_1, last 24h, "explain efficiency" → markdown streams in < 8 s.

### Phase 2 — POC: Intelligence Modules ✅ DONE (2026-05-09) → tag `v0.2.0-poc`
**Goal:** Move beyond reactive Q&A to proactive intelligence.

**POC deliverables:**
- [x] **Efficiency Benchmarker** — `analytics/efficiency.py`; `/api/v1/efficiency/{id}` + `/api/v1/efficiency`; UI `/efficiency` page with animated band bar, loss driver cards, delta vs benchmark
- [x] **Anomaly Detector** — `analytics/anomaly.py` (z-score, 72h baseline); APScheduler every 5 min; `anomalies` table; `/anomalies` UI with z-score pills, scan-now button
- [x] **Energy Forecaster** — `analytics/forecast.py` (hour-of-day stats, no extra packages); `/api/v1/forecast/{id}`; `/forecast` page with CI band chart + summary KPIs
- [x] **Comparison View** — `/api/v1/compare?a=&b=`; `/compare` page with overlay LineChart, winner badge, side-by-side stat table

**Demo gate:** ✅ all four modules working with live data.

### Phase 3 — POC: Advanced Features 🔄 PARTIAL → tag `v0.3.0-poc`
**Goal:** Differentiate from generic dashboards.

**POC deliverables:**
- [x] **Agentic AI Hub** — `/agent` page with 5 specialist agents; sidebar nav item "AI Agents"
  - [x] **Investigator** — autonomous ReAct loop (up to 8 steps, 6 tools, qwen2.5:14b tool-calling); live reasoning trace + streaming final report
  - [x] **Optimizer** — energy reduction advisor; same ReAct engine, optimizer system prompt
  - [x] **Daily Brief** — shift-start plant status briefing
  - [x] **Root Cause Analyst** — fault diagnosis specialist
  - [x] **Maintenance Planner** — prioritized PM plan
  - [x] `agent_runs` Postgres table; `GET /api/v1/agent/history`
  - [x] 6 tools: `get_equipment_list`, `compute_efficiency`, `detect_anomalies`, `get_timeseries_summary`, `compare_equipment`, `get_anomaly_history`
- [ ] **Predictive Maintenance (light)** — run-hour counter + degradation flag; asset health 0–100; UI card
- [ ] **Cooling Tower Fan Optimizer (rule-based)** — wet-bulb-aware staging hint; kWh-saved estimate
- [ ] **Cost Analytics (flat tariff)** — kWh × ₹/kWh; ₹/TR-hr KPI card; plant-level rollup
- [ ] **Report Builder (markdown export)** — daily KPI roll-up + LLM exec summary; download button
- [ ] **Conversational Memory** — `threads` + `messages` tables; "continue thread" UI

**Demo gate (partial ✅):** Agent demo passing — ask "investigate chiller_1" → agent calls 3+ tools → synthesized report streams.

### Phase 4 — POC: RAG (Week 6) → tag `v0.4.0-poc`
**Goal:** Ground LLM answers in source documents.

### Phase 4 — POC: RAG (Week 6) → tag `v0.4.0-poc`
**Goal:** Ground LLM answers in source documents.

**POC deliverables:**
- [ ] pgvector enabled on `thermynx_app`
- [ ] `embeddings` table + ingestion script for 5 sample equipment manuals (PDF → chunks → `nomic-embed-text` via Ollama)
- [ ] Retrieval step inserted before prompt build in `AnalysisService`
- [ ] Citations rendered in markdown output (file name + chunk reference)

**Demo gate:** "what's the maintenance interval for chiller_1 condenser?" → answer cites the manual chunk.

### POC complete → tag `v1.0.0-poc`
End-to-end walkthrough video; sign-off from Graylinx + Unicharm before moving to Phase 5.

### Phase 5 — Post-POC Hardening (after POC sign-off)
**Goal:** Make it deployable, secure, observable for a real customer.

**Deliverables:**
- [ ] **Auth:** OAuth2 password flow + JWT → SSO upgrade path
- [ ] **Secrets:** `.env` → Docker secrets / Vault
- [ ] **Logging:** structlog → Loki
- [ ] **Metrics:** Prometheus `/metrics`
- [ ] **Tracing:** OpenTelemetry → Tempo
- [ ] **Errors:** Sentry frontend + backend
- [ ] **CI/CD:** lint + test + build → versioned image tarballs as release artifacts; manual on-prem deploy via runbook
- [ ] **Containerization:** multi-stage Dockerfiles, `docker-compose.prod.yml`, nginx + TLS
- [ ] **Health/readiness:** `/healthz`, `/readyz` with per-dep checks
- [ ] **Rate limiting:** slowapi
- [ ] **CORS + security headers + CSP**
- [ ] **Supply chain:** Trivy + Dependabot + SBOM
- [ ] **arq workers** replacing in-process APScheduler
- [ ] **Backups:** nightly `pg_dump` automation + weekly restore drills
- [ ] **Runbook:** spare-host DR procedure, < 4 h RTO

### Phase 6 — Post-POC: Scale & Multi-Tenant (Future)
- Multi-facility support (Unicharm campus expansion)
- Tenant isolation at DB schema level
- Custom branding per tenant
- White-label deployment for other Graylinx customers

---

## 7. Module Specifications (Phase 1 Detail)

### 7.1 Equipment Catalog API
```
GET /api/v1/equipment
→ 200 [{ id, name, type, ss_id, normalized_table, status }]
   401 problem+json (missing/invalid JWT)
   429 problem+json (rate limit)
```

### 7.2 Timeseries API
```
GET /api/v1/equipment/{id}/timeseries
  ?metrics=kw,kw_per_tr,evap_leaving_temp
  &from=2026-05-07T00:00:00Z
  &to=2026-05-08T00:00:00Z
  &resolution=1m|5m|1h
→ 200 { equipment_id, points: [{ slot_time, kw, kw_per_tr, ... }] }
   400 problem+json (invalid range / unknown metric)
   404 problem+json (unknown equipment_id)
   502 problem+json (DB unreachable)
   504 problem+json (DB timeout)
```

### 7.3 Analyze API
```
POST /api/v1/analyze
Content-Type: application/json
{
  equipment_id: "chiller_1",
  time_range: { from, to },
  question: "Why is efficiency dropping?",
  context_metrics: ["kw_per_tr", "chw_delta_t", "chiller_load"],
  thread_id: "01HZ..."   // optional, for conversation continuity
}
→ 200 text/event-stream
   data: {"type":"token","content":"..."}
   data: {"type":"token","content":"..."}
   data: {"type":"done","audit_id":"01HZ...","tokens":1234}
   503 problem+json (Ollama circuit open, no stale cache)
   504 problem+json (LLM first-token timeout)
```

**Prompt structure:**
```
SYSTEM: You are a senior HVAC engineer analyzing chiller plant data...
CONTEXT:
  - Equipment: chiller_1 (water-cooled centrifugal, 500 TR design)
  - Period: <from> to <to>
  - Benchmark kW/TR: 0.55 (good), 0.65 (fair), >0.75 (poor)
  - Live data summary: <statistical summary>
  - Last 50 data points: <table>
USER: <question>
```

### 7.5 Agentic Investigator API (Phase 3)
```
POST /api/v1/agent/investigate
Content-Type: application/json
{
  goal: "investigate chiller_1's recent performance",
  equipment_id: "chiller_1",          // optional context
  time_range: { from, to },           // optional context
  max_steps: 8,                       // safety cap on tool-call iterations
  thread_id: "01HZ..."                // optional, for memory continuity
}
→ 200 text/event-stream
   data: {"type":"thought","content":"I'll start by checking efficiency..."}
   data: {"type":"tool_call","tool":"compute_efficiency","args":{...},"step":1}
   data: {"type":"tool_result","tool":"compute_efficiency","result":{...},"step":1}
   data: {"type":"thought","content":"Efficiency is 0.82 kW/TR (poor band). Now anomalies..."}
   data: {"type":"tool_call","tool":"detect_anomalies","args":{...},"step":2}
   data: {"type":"tool_result", ...}
   ...
   data: {"type":"final","content":"# Investigation: chiller_1\n\n**Findings:**...","run_id":"01HZ..."}
   503 problem+json (Ollama down, no fallback)
   504 problem+json (agent exceeded max_steps without converging)
```

**Tool inventory (POC):**
| Tool | Reads | Returns |
|------|-------|---------|
| `get_equipment_list()` | catalog | array of equipment |
| `get_timeseries(eq, range, metrics)` | MySQL | points |
| `compute_efficiency(eq, range)` | MySQL + benchmarks | band, kW/TR, drivers |
| `detect_anomalies(eq, range)` | MySQL + baselines | anomaly list |
| `forecast(eq, horizon)` | MySQL | hourly predictions + PI |
| `compare_equipment(eq_a, eq_b, range)` | MySQL | side-by-side stats |
| `retrieve_manual(eq, query)` *(Phase 4)* | pgvector | manual chunk + cite |

**Architecture note:** agent is a simple ReAct-style loop in `services/agent.py` — no LangChain/LangGraph weight for POC. Loop: call LLM with tool schemas → parse tool call → execute Python function → append result → repeat until `final` or `max_steps`. Each run persists to `agent_runs` table for replay/debug.

### 7.4 Frontend State Model
```ts
// Zustand store (client UI state only — server state lives in TanStack Query)
{
  selectedEquipment: { id: string; name: string; type: string } | null,
  timeRange: { from: ISODate; to: ISODate; preset: "1h" | "24h" | "7d" | "custom" },
  metrics: Array<"kw" | "kw_per_tr" | "chw_delta_t" | "chiller_load">,
  theme: "light" | "dark"
}
```

---

## 7A. Functional Requirements & Acceptance Criteria

Each FR has a stable ID for traceability across PRs, tests, and audit logs.

### Phase 1 — MVP

**FR-1 — Equipment Catalog**
- The system MUST list all normalized equipment with id, name, type, status.
- *Acceptance:* `GET /api/v1/equipment` returns ≥ 6 entries (chiller_1, chiller_2, cooling_tower_1, cooling_tower_2, condenser_pump_0102, condenser_pump_03) within p95 ≤ 150 ms.

**FR-2 — Timeseries Retrieval**
- The system MUST return time-bucketed metric data for any equipment within a configurable range and resolution.
- *Acceptance:* `GET /api/v1/equipment/{id}/timeseries?range=24h&res=5m` returns ≥ 280 points covering at least kw, kw_per_tr, evap_leaving_temp; p95 ≤ 600 ms.

**FR-3 — AI Analysis (streaming)**
- The system MUST stream a markdown analysis answer to user questions about equipment within a time window.
- *Acceptance:* `POST /api/v1/analyze` first SSE token within p95 ≤ 3 s; full response within p95 ≤ 8 s; markdown renders tables, lists, bold cleanly.

**FR-4 — Audit Trail**
- The system MUST persist every `/analyze` call with prompt hash, response hash, model, tokens, latency, status.
- *Acceptance:* Each request creates exactly one `analysis_audit` row; row updated on stream complete or cancel; PII scrubbed before logging.

**FR-5 — Health Probes**
- The system MUST expose `/healthz` (liveness) and `/readyz` (readiness).
- *Acceptance:* `/readyz` returns 200 only when MySQL, Postgres, Redis, and Ollama all respond within probe timeout; otherwise 503 with per-dependency status JSON.

**FR-6 — Frontend Equipment Selector**
- The user MUST select equipment, time range, and metrics via UI controls (no typed IDs).
- *Acceptance:* Selector populated from `/api/v1/equipment`; range presets (1h/24h/7d/custom); multi-metric select; selection persists across navigation via Zustand.

**FR-7 — Streaming UI**
- The frontend MUST render LLM output progressively as tokens arrive and support cancellation.
- *Acceptance:* First character within 3 s of POST; cancel button → backend audit row marked `cancelled`; navigation aborts the stream cleanly via AbortController.

### Phase 2 — Intelligence

**FR-8 — Efficiency Benchmarking**
- The system MUST classify each equipment's current efficiency into bands (good/fair/poor).
- *Acceptance:* `/api/v1/efficiency/{id}` returns `{band, kw_per_tr_actual, benchmark, delta_pct, top_loss_drivers}`.

**FR-9 — Anomaly Detection**
- The system MUST detect statistical anomalies per metric per equipment and persist them.
- *Acceptance:* arq job runs every 5 min; z-score > 3 vs hour-of-day baseline → `anomalies` row + LLM-narrated summary.

**FR-10 — Energy Forecasting**
- The system MUST produce next-24h kWh forecast per equipment with driver decomposition.
- *Acceptance:* `/api/v1/forecast/{id}?horizon=24h` returns hourly point estimates + 80% PI; backtest MAPE < 15% on 30-day holdout.

**FR-11 — Comparison View**
- The user MUST overlay 2–4 equipment on a synchronized chart with side-by-side AI commentary.
- *Acceptance:* `/api/v1/analyze` accepts `mode=compare` with up to 4 equipment_ids; UI renders synced cursor.

**FR-11A — Agentic Investigator** *(Phase 3 POC, sidebar menu item)*
- The system MUST expose an autonomous agent that decomposes a high-level goal into tool calls and synthesizes a report.
- *Acceptance:* `POST /api/v1/agent/investigate` accepts a natural-language goal; SSE stream emits `thought` / `tool_call` / `tool_result` / `final` events; agent calls **at least 2 distinct tools** before producing `final`; entire run persists to `agent_runs` table; `max_steps=8` prevents runaway loops.
- *Demo:* "investigate chiller_1's recent performance" → agent autonomously calls `compute_efficiency` → `detect_anomalies` → `compare_equipment` (vs chiller_2) → `forecast` → returns a markdown investigation with findings + suggested next checks.

### Phase 3 — Hardening

**FR-12 — Authentication**
- The system MUST require JWT auth for all `/api/v1/*` except `/healthz`, `/readyz`.
- *Acceptance:* missing/invalid token → 401 problem+json; refresh flow rotates refresh tokens.

**FR-13 — Rate Limiting**
- The system MUST limit per-user request rate per endpoint.
- *Acceptance:* slowapi enforces 60 r/min default, 10 r/min on `/analyze`; exceedance → 429 with `Retry-After`.

**FR-14 — Observability**
- Every request MUST emit a structured log line, an OTel span, and Prometheus metrics tagged with route, status, user_id.
- *Acceptance:* logs in Loki, traces in Tempo, RED metrics in Grafana; alert fires when 5xx > 1% over 5 min.

### Non-Functional Requirements (NFRs)

| ID | NFR | Target |
|----|-----|--------|
| NFR-1 | Availability | 99% on single on-prem host (~7 h/month downtime budget); planned maintenance excluded. HA cluster deferred — added only if a customer requires it. |
| NFR-2 | API latency p95 (non-LLM) | < 500 ms |
| NFR-3 | API latency p95 (LLM full) | < 8 s |
| NFR-4 | RTO (recovery time objective) | < 30 min from clean Postgres backup |
| NFR-5 | RPO (recovery point objective) | ≤ 24 h (nightly Postgres backups; `unicharm` is upstream-managed) |
| NFR-6 | Backend test coverage | > 80% (lines), 100% on domain layer |
| NFR-7 | Frontend test coverage | > 60% (components + hooks) |
| NFR-8 | Accessibility | WCAG 2.1 AA on primary flows (analyzer, dashboard, login) |
| NFR-9 | Browser support | Chrome / Edge / Firefox latest 2 versions; Safari 16+ |
| NFR-10 | Concurrent users (MVP) | 25 simultaneous; 100 by end of Phase 3 |
| NFR-11 | Data retention (audit) | 365 days online, infinite cold-storage |
| NFR-12 | Data retention (threads) | User-controlled; default 90 days |

---

## 8. Data Strategy

### 8.1 Source of Truth
Use **only** the `*_normalized` tables for analytics:
- `chiller_1_normalized`, `chiller_2_normalized`
- `cooling_tower_1_normalized`, `cooling_tower_2_normalized`
- `condenser_pump_0102_normalized`, `condenser_pump_03_normalized`
- (Plus AHU/secondary pump normalized tables as available)

The raw `*_metric` and `*_om_p` tables are upstream — do not query directly.

### 8.2 Indexing Recommendations
Add (or verify) indexes:
```sql
CREATE INDEX idx_chiller_1_slot_time ON chiller_1_normalized(slot_time);
CREATE INDEX idx_chiller_1_running ON chiller_1_normalized(is_running, slot_time);
```
(Repeat per normalized table.)

### 8.3 Read Replica Path (Phase 3+)
If query load grows, point THERMYNX at a read replica of `unicharm` to isolate from ingestion.

### 8.4 Derived Aggregates (Phase 2+)
Pre-compute hourly/daily rollups in **`thermynx_app` (PostgreSQL)**, not in `unicharm`:
- Tables: `hourly_kpi`, `daily_kpi` (equipment_id-keyed, partitioned by month)
- Refresh: arq job pulls from MySQL → upserts into Postgres on a 5-min / hourly cadence
- Keeps the customer's MySQL untouched and dashboards snappy

### 8.5 App-Owned Data (PostgreSQL `thermynx_app`)
Lives entirely in Postgres, managed via Alembic migrations:
- `users`, `refresh_tokens` — auth
- `threads`, `messages` — conversation history per user
- `analysis_audit` — every `/analyze` call: user, prompt hash, model, latency, response hash
- `feedback` — thumbs up/down + recommendation-actioned tracking
- `prompt_versions` — versioned system prompts (referenced by hash from audit)
- `hourly_kpi`, `daily_kpi` — derived aggregates (§8.4)
- `anomalies`, `baselines` — anomaly detector outputs and rolling baselines
- `embeddings` (Phase 4, pgvector) — manuals, ASHRAE chunks, past incident reports

### 8.6 Database ERD — `thermynx_app` (PostgreSQL)

```text
┌──────────────────┐         ┌──────────────────────┐
│  users           │         │  refresh_tokens      │
├──────────────────┤  1:N    ├──────────────────────┤
│ id PK (ulid)     │◄────────│ user_id FK→users     │
│ username UQ      │         │ token_hash UQ        │
│ email UQ         │         │ expires_at           │
│ password_hash    │         │ created_at           │
│ role             │         │ revoked_at NULL      │
│ created_at       │         └──────────────────────┘
└────────┬─────────┘
         │ 1:N
         ▼
┌──────────────────┐  1:N    ┌──────────────────────┐
│  threads         │◄────────│  messages            │
├──────────────────┤         ├──────────────────────┤
│ id PK (ulid)     │         │ id PK (ulid)         │
│ user_id FK       │         │ thread_id FK→threads │
│ title            │         │ role (user|asst|sys) │
│ created_at       │         │ content              │
│ archived_at NULL │         │ tokens_in/out        │
└──────────────────┘         │ created_at           │
                             └──────────────────────┘

┌──────────────────────────────┐  N:1    ┌──────────────────────┐
│  analysis_audit              │────────►│  prompt_versions     │
├──────────────────────────────┤         ├──────────────────────┤
│ id PK (ulid)                 │         │ id PK                │
│ user_id FK→users             │         │ name (eg "analyzer") │
│ thread_id FK→threads NULL    │         │ version              │
│ equipment_id (string)        │         │ template             │
│ time_range_from / _to        │         │ created_at           │
│ prompt_version_id FK         │         │ created_by           │
│ prompt_hash                  │         │ active BOOL          │
│ response_hash NULL           │         └──────────────────────┘
│ model                        │
│ tokens_in / tokens_out NULL  │              ┌──────────────────────┐
│ first_token_ms NULL          │  1:N         │  feedback            │
│ total_ms NULL                │◄─────────────├──────────────────────┤
│ status (streaming|ok|error|  │              │ id PK (ulid)         │
│         cancelled|timeout)   │              │ audit_id FK→audit    │
│ error_code NULL              │              │ user_id FK→users     │
│ request_id (X-Request-Id)    │              │ rating (-1|0|+1)     │
│ created_at                   │              │ comment NULL         │
└──────────────────────────────┘              │ actioned BOOL        │
                                              │ created_at           │
                                              └──────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│  hourly_kpi          │         │  daily_kpi           │
├──────────────────────┤         ├──────────────────────┤
│ equipment_id PK      │         │ equipment_id PK      │
│ hour_bucket PK       │         │ day_bucket PK        │
│ kw_avg / kw_max      │         │ kw_avg / kw_max      │
│ kw_per_tr_avg        │         │ kw_per_tr_avg        │
│ run_minutes          │         │ run_hours            │
│ load_avg             │         │ load_avg             │
│ refreshed_at         │         │ refreshed_at         │
└──────────────────────┘         └──────────────────────┘
(partitioned by month)            (partitioned by year)

┌──────────────────────┐         ┌──────────────────────┐
│  anomalies           │         │  baselines           │
├──────────────────────┤         ├──────────────────────┤
│ id PK (ulid)         │         │ equipment_id PK      │
│ equipment_id         │         │ metric PK            │
│ metric               │         │ hour_of_day PK       │
│ started_at           │         │ mean                 │
│ ended_at NULL        │         │ stddev               │
│ severity             │         │ sample_count         │
│ value / baseline     │         │ refreshed_at         │
│ z_score              │         └──────────────────────┘
│ narrative NULL       │
│ created_at           │
└──────────────────────┘

┌──────────────────────────────┐
│  embeddings (Phase 4)        │
├──────────────────────────────┤
│ id PK (ulid)                 │
│ source_type                  │
│  (manual|ashrae|incident)    │
│ source_id                    │
│ chunk_idx                    │
│ content                      │
│ embedding VECTOR(768)        │  ← pgvector
│ created_at                   │
└──────────────────────────────┘
```

**Key indexes:**
- `analysis_audit`: `(user_id, created_at DESC)`, `(request_id)`, `(status, created_at)`
- `hourly_kpi`: PK `(equipment_id, hour_bucket)`; BRIN on `hour_bucket`
- `anomalies`: `(equipment_id, started_at DESC)`, `(severity, started_at DESC)`
- `embeddings`: `ivfflat (embedding vector_cosine_ops) WITH (lists=100)`
- `refresh_tokens`: `(token_hash) UNIQUE`, `(expires_at)` for cleanup job

**Constraints:**
- All ULIDs use a `ULID` lib (lexicographic time-sort, single column index)
- `audit.status` enum enforced via `CHECK`
- `feedback.rating CHECK (rating IN (-1, 0, 1))`
- Soft-delete via `archived_at NULL` where applicable; **no hard deletes from `analysis_audit`** (compliance trail)

---

## 9. AI / LLM Strategy

### 9.1 Model Selection (POC — based on actual installed models)

Ollama server: RTX 4000 Ada · **20 GB VRAM** · 32 GB system RAM · Tailscale `100.125.103.28:11434`.

`ollama list` verified 2026-05-08:

| Model | Size | Fits VRAM? | POC role |
|-------|------|------------|----------|
| `qwen2.5:14b` | 9.0 GB | ✅ Yes, with headroom | **Default analyzer + agent reasoner** (only viable capable model) |
| `phi:latest` | 1.6 GB | ✅ Trivially | Quick narration (anomaly one-liners, short summaries) |
| `nemotron-cascade-2:latest` | 24 GB | ⚠️ 4 GB over — partial CPU spill | Testable; expect slower throughput. Not the default. |
| `gpt-oss:120b` | 65 GB | ❌ Cannot run | Exceeds VRAM + system RAM combined. **Practically unusable on this hardware** — installed but don't route traffic to it. |
| `nomic-embed-text` | *(not installed)* | ✅ Trivial once pulled | Phase 4 RAG — `ollama pull nomic-embed-text` (~770 MB) before that phase |

**POC default:** `OLLAMA_DEFAULT_MODEL=qwen2.5:14b` — the only model that is both capable enough for HVAC reasoning **and** fits cleanly in VRAM. Tool-calling supported (needed for the Agentic Investigator in Phase 3).

**Optional upgrade (post-POC):** if Qwen 14b feels light on deep reasoning, `ollama pull qwen2.5:32b` (~20 GB at Q4 — just fits, single-user). Don't chase `gpt-oss:120b` — the hardware can't run it.

**Hardware sufficiency:** Qwen2.5:14b on RTX 4000 Ada streams at ~30–50 tokens/s — comfortably within the < 8 s full-response budget for typical 24h-window prompts. All POC phases (1–4 + Agentic Investigator) fit on this single box.

### 9.2 Prompt Engineering Discipline
- **System prompts** versioned in `app/prompts/` — never inline strings in handlers
- **Few-shot examples** for each analysis type (efficiency, anomaly, fault)
- **Output contracts** — request markdown with explicit sections (Findings / Causes / Recommendations)
- **Token budget guard** — truncate context if > 6k tokens, summarize older data

### 9.3 Retrieval-Augmented Generation (Phase 4)
- Embed equipment manuals, ASHRAE guides, past incident reports
- Vector store: **pgvector inside `thermynx_app` Postgres** (no separate vector DB)
- Embedding model: `nomic-embed-text` via Ollama
- Cite sources in responses (file name + chunk id from `embeddings` table)

### 9.4 Evaluation
- Build a `tests/eval/` set of 30 canonical questions with ideal answers
- Run before each prompt change (regression suite)

---

## 10. Verification Strategy

### 10.1 Test Pyramid
```
         ┌──────────────┐
         │   E2E (5%)   │  Playwright — UC1, UC2, UC3
         ├──────────────┤
         │ Integration  │  pytest — DB+API, LLM mocked
         │    (25%)     │
         ├──────────────┤
         │  Unit (70%)  │  pytest — pure logic, prompt builders
         └──────────────┘
```

### 10.2 Specific Tests
| Layer | Tests |
|-------|-------|
| Backend unit | Prompt builder output, kW/TR calc, anomaly z-score |
| Backend integration | `/analyze` against real DB, mocked LLM |
| Frontend unit | Component snapshots, hooks |
| Frontend E2E | Full flow: select equipment → ask → see answer |
| LLM eval | 30-question regression set, scored by GPT-judge |

### 10.3 Manual Verification Checklist (per release)
- [ ] Health endpoint green for DB and Ollama
- [ ] Pick chiller_1, last 24h → chart renders
- [ ] Ask "explain efficiency" → markdown streams in
- [ ] Switch to chiller_2 → state resets cleanly
- [ ] Mobile breakpoint (375px) — sidebar collapses
- [ ] Dark mode toggle (Phase 2) — no contrast issues

---

## 11. Deployment Strategy (POC)

POC runs on **one machine** — a developer laptop or a small on-prem box. The only deploy command is `make dev` (which is `docker compose up`). No nginx, no TLS, no image registry, no runbook drama. MySQL `unicharm` and Ollama are reached over Tailscale and are not part of this stack.

### 11.1 POC Topology

```text
┌────────────────────────────────────────┐
│  POC host (laptop or single VM)        │
│  docker compose up                     │
│                                        │
│   api (uvicorn, --reload) ─┬─ postgres │
│                            │  thermynx │
│                            │   _app    │
│                            └─ redis    │
│                                (cache) │
│                                        │
│   frontend: vite dev server (HMR),     │
│   either in compose or on host         │
└────────────────────────────────────────┘
                │             │
       Tailscale│             │Tailscale
                ▼             ▼
        ┌──────────────┐  ┌────────────┐
        │ MySQL        │  │ Ollama     │
        │ unicharm:3307│  │ 100.125... │
        │  (RO user)   │  │ :11434     │
        └──────────────┘  └────────────┘
```

### 11.2 POC Containerization
```
backend/Dockerfile     — slim python base (multi-stage not required for POC)
frontend/              — vite dev server, no production build for POC
docker-compose.yml     — api + postgres + redis (mysql + ollama external)
.env.example           — DB URLs, OLLAMA_URL, no real secrets
```

### 11.3 POC "Deploy"
```bash
git clone <repo> && cd thermynx
cp .env.example .env       # fill in tailscale-reachable URLs
make dev                   # docker compose up + frontend dev
open http://localhost:5173
```

That's the whole deploy. If something breaks, `docker compose down -v && make dev`.

### 11.4 POC CI
GitHub Actions: **lint + type-check + test on PR.** That's it.
- No security scan, no SBOM, no image build, no deploy automation
- Those land in **Phase 3 Hardening**, not POC

### 11.5 POC Tagging
- `v0.1.0-poc` once the demo works end-to-end
- No release tarballs, no signed images, no published artifacts — re-clone + `make dev` is the install path

### 11.6 Post-POC (Phase 3+, preserved as north star)
The full on-prem topology — single Linux host with nginx + TLS + restart policies + nightly `pg_dump` + spare-host runbook + image tarball releases + Trivy/SBOM/cosign — kicks in **only** when we move from POC to a customer-facing deploy at Unicharm. Spec lives in §4.13 (target topology); this section gets rewritten then.

---

## 12. Security & Compliance (POC)

POC security floor — just enough to not embarrass us if reviewed.

| Concern | POC mitigation |
|---------|----------------|
| **Secrets in repo** | `.env` gitignored; `.env.example` has placeholders only, no real values |
| **DB credentials** | Read-only MySQL user for `unicharm`; Postgres password lives in `.env` |
| **LLM data leak** | Self-hosted Ollama on Tailscale — **no cloud LLM calls. Ever.** |
| **SQL injection** | SQLAlchemy parameterized queries only — no string formatting in SQL |
| **CORS (dev)** | Permissive in dev; production lockdown is a Phase 3 concern |

### Deferred to Phase 3 Hardening (preserved as target)
JWT auth + refresh tokens, rate limiting (slowapi), CSP + security headers, RFC 7807 problem+json with redaction, PII scrubber, Trivy + Dependabot + SBOM, signed images (cosign), nightly `pg_dump` automation with restore drills, audit retention policy.

---

## 13. Observability (POC)

| Signal | POC tool | What |
|--------|----------|------|
| **Logs** | structlog → stdout (JSON) | `request_id`, route, status; viewed via `docker compose logs -f api` |
| **Errors** | stdout + manual review | No Sentry yet; check the `analysis_audit` table for failed `/analyze` calls |
| **Health** | `/healthz` returning 200 if app boots | Manual `curl` check; no probe automation |

### Deferred to Phase 3 Hardening (preserved as target)
Prometheus `/metrics`, OpenTelemetry → Tempo, Loki log aggregation, Grafana dashboards, Sentry (frontend + backend), Alertmanager paging, full `/readyz` with per-dependency checks, RED metrics, LLM funnel dashboard.

---

## 14. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Ollama host goes offline | M | H | Health check + fallback to cached responses + retry |
| MySQL replica lag | M | M | Read directly from primary; add replica lag alert |
| LLM hallucinates wrong recommendation | H | H | Cite source data in response, "AI-assisted, verify before action" disclaimer |
| Schema changes break analytics | L | H | Schema introspection + integration tests on prod-like DB |
| Token cost explosion (if cloud LLM later) | L | M | Self-hosted Ollama; per-user token quota |
| Single on-prem host hardware failure | M | H | Spare host pre-provisioned at Unicharm; image tarballs + nightly `pg_dump` on NAS; runbook restores stack in < 4 h. HA cluster deferred until customer demands it. |
| User pastes PII in question | M | M | PII scrubber middleware before logging |

---

## 15. Success Metrics

### 15.1 POC Success (current target — Phase 1 demo)
- End-to-end demo runs: pick `chiller_1`, last 24h, ask "explain efficiency" → markdown streams in < 8 s
- Stack starts via `make dev` on a clean laptop in < 10 min
- Stakeholders see qualitative value in the AI analysis (subjective; collect via short feedback session)
- `v0.1.0-poc` tag on `master`; walkthrough video recorded

### 15.2 Technical (Post-POC, Phase 2+)
- Backend p95 latency: < 500 ms (non-LLM), < 8 s (LLM)
- Frontend FCP: < 1.5 s on cable
- Test coverage: > 80% backend domain layer, > 60% frontend
- Uptime: 99% on single on-prem host (Phase 3+)

### 15.3 Product (after on-prem launch)
- Daily active operators: > 5 within 30 days of launch
- AI Analyzer queries/day: > 50 within 30 days
- Recommendations actioned: > 20% (tracked via feedback button)
- kWh saved attributable to THERMYNX recommendations: > 5% within 6 months

---

## 16. Build Status & Next Steps

### ✅ Completed (as of 2026-05-09)

| Done | What |
|------|------|
| ✅ | `thermynx/` duplicate removed — root `backend/` + `frontend/` is canonical |
| ✅ | Phase 1: all endpoints, SSE streaming, Recharts chart, analysis_audit |
| ✅ | Phase 1: modern dark UI (glassmorphism, Framer Motion, responsive) |
| ✅ | Phase 1: README, smoke test, docker-compose, Makefile |
| ✅ | Phase 1: LLM locked → `qwen2.5:14b` (only model that fits 20 GB VRAM) |
| ✅ | Phase 2: Efficiency Benchmarker (full analytics + `/efficiency` page) |
| ✅ | Phase 2: Anomaly Detector (z-score, APScheduler, `/anomalies` page) |
| ✅ | Phase 3: AI Agents Hub — 5 modes (Investigator, Optimizer, Brief, Root Cause, Maintenance) |
| ✅ | Phase 3: ReAct tool-calling loop, 6 tools, `agent_runs` table, live trace UI |

### ✅ Phase 2 complete (2026-05-09) → tag `v0.2.0-poc`
All four intelligence modules shipped: Efficiency + Anomalies + Forecaster + Compare.

### 🔄 Phase 3 remaining (after Phase 2)

3. **Predictive Maintenance** — run-hour counter, degradation score, health 0–100
4. **Cost Analytics** — kWh × ₹/kWh, ₹/TR-hr KPI
5. **Report Builder** — LLM-written daily summary, markdown download
6. **Conversational Memory** — thread persistence UI

### 🔜 Phase 4 (after Phase 3)

7. `ollama pull nomic-embed-text` on Ollama box + pgvector extension
8. PDF manual ingestion + embeddings
9. Retrieval step in AnalysisService + citations in output

---

## 17. Open Decisions

These need owner input before proceeding:

- [x] **Canonical path:** Root `backend/` + `frontend/` — `thermynx/` deleted. *(decided 2026-05-09)*
- [ ] **Auth scope (Phase 3):** SSO via Microsoft (Unicharm AD) or local accounts?
- [x] **Hosting:** **On-prem at Unicharm** — single Linux host, docker compose stack, no cloud / k8s / managed services. *(decided 2026-05-08)*
- [ ] **Ollama redundancy:** Single host enough or need HA?
- [ ] **Branding:** THERMYNX standalone or co-branded with Graylinx + Unicharm?
- [ ] **Data retention:** How long to keep analysis history per user?
- [x] **Application DB:** PostgreSQL (`thermynx_app`) — separate from `unicharm` MySQL telemetry source. *(decided 2026-05-08)*
- [x] **Vector store:** pgvector inside `thermynx_app` — no separate vector DB. *(decided 2026-05-08)*
- [x] **Job queue:** arq on Redis — no Celery, no APScheduler. *(decided 2026-05-08)*
- [x] **Time-series DB:** Not adopted — MySQL normalized tables + Postgres rollups are sufficient through Phase 3. *(decided 2026-05-08)*

---

## Appendix A — File Structure (Target State)

```text
thermynx/
├── .github/workflows/      # CI/CD
├── backend/
│   ├── app/
│   │   ├── api/v1/         # FastAPI routers (versioned)
│   │   ├── services/       # Orchestration: EquipmentSvc, AnalysisSvc, etc.
│   │   ├── domain/         # Pure logic: kW/TR, z-score, PromptBuilder (no I/O)
│   │   ├── analytics/      # Efficiency, anomaly, forecast (uses domain + repos)
│   │   ├── auth/           # JWT, OAuth, refresh tokens
│   │   ├── db/
│   │   │   ├── unicharm/   # aiomysql session + repos — READ-ONLY telemetry
│   │   │   └── app/        # asyncpg session + ORM models — thermynx_app
│   │   ├── jobs/           # arq workers (rollups, anomaly scans)
│   │   ├── llm/            # Ollama client (chat stream + embeddings) + circuit breaker
│   │   ├── prompts/        # Versioned templates (hashed for audit)
│   │   ├── middleware/     # request_id, CORS, security headers, auth, rate-limit, logging, OTel
│   │   ├── cache/          # Redis client + decorators (L3 + L4)
│   │   ├── errors/         # AppError hierarchy + RFC 7807 handler
│   │   ├── utils/          # Logger, ULID, time helpers
│   │   └── config.py       # Pydantic Settings v2
│   ├── alembic/            # thermynx_app migrations only
│   ├── tests/
│   │   ├── unit/           # Pure domain logic (no I/O, fastest)
│   │   ├── integration/    # Real DB, mocked LLM
│   │   ├── e2e/            # Full /analyze flow
│   │   └── eval/           # LLM regression set (30 questions)
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/            # providers, router, theme, queryClient, sentry init
│   │   ├── features/
│   │   │   ├── analyzer/   # AI Analyzer page + hooks + components + types + tests
│   │   │   ├── equipment/  # Selector, catalog hooks
│   │   │   ├── anomalies/
│   │   │   ├── forecast/
│   │   │   └── auth/
│   │   ├── shared/
│   │   │   ├── ui/         # Chakra-wrapped primitives (Card, Stat, Chart)
│   │   │   ├── api/        # Generated OpenAPI client + queryClient
│   │   │   └── lib/        # date, format, ulid
│   │   └── main.tsx
│   ├── tests/              # Vitest (unit) + Playwright (E2E)
│   ├── tsconfig.json       # strict: true, noUncheckedIndexedAccess: true
│   ├── Dockerfile
│   └── package.json
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx/
├── docs/
│   ├── architecture.md
│   ├── prompts.md
│   └── runbook.md
├── BUILD_PLAN.md           # ← this file
├── README.md
└── .gitignore
```

---

## Appendix B — Glossary, Assumptions, Stakeholders

### B.1 HVAC Glossary

| Term | Meaning |
|------|---------|
| **TR** (Ton of Refrigeration) | Cooling capacity unit; 1 TR = 3.517 kW thermal = 12,000 BTU/hr |
| **kW/TR** | Electrical input per ton of cooling delivered. Lower = more efficient. Industry good ≈ 0.55, poor > 0.75. |
| **COP** | Coefficient of Performance = thermal kW out / electrical kW in. Inverse-ish of kW/TR. |
| **ΔT (Delta-T)** | Temperature difference across a heat exchanger (evap or condenser). Low ΔT often signals flow imbalance or fouling. |
| **CHW** | Chilled Water (typically 6–12 °C, supplied to AHUs) |
| **CW** | Condenser Water (warmer loop, rejects heat at the cooling tower) |
| **Evaporator** | Chiller heat exchanger that *removes* heat from CHW |
| **Condenser** | Chiller heat exchanger that *rejects* heat to CW |
| **Approach** | Difference between leaving water temp and refrigerant saturation temp; rising approach = fouling |
| **Fouling** | Scale, biofilm, or debris reducing heat-exchange efficiency |
| **Wet-bulb** | Lowest temp achievable by evaporative cooling at given humidity; sets cooling-tower performance ceiling |
| **AHU** | Air Handling Unit; takes CHW and delivers cooled air to spaces |
| **TOU** | Time-of-Use electricity tariff |
| **PM** | Preventive Maintenance |
| **BMS** | Building Management System (Siemens / Honeywell etc.) — source of telemetry upstream of `unicharm` |
| **Slot time** | Aligned timestamp bucket (typically 1-minute) used by normalized tables |

### B.2 Assumptions

1. The `unicharm` MySQL DB at port 3307 is reachable from THERMYNX hosts via Tailscale.
2. Normalized tables refresh on at least 5-minute cadence and contain `slot_time` as a UTC timestamp.
3. The Ollama box (`100.125.103.28:11434` over Tailscale) has GPU sufficient for `llama3.1:8b` at acceptable latency.
4. Single-tenant deployment for Unicharm in MVP; multi-tenant deferred to Phase 5.
5. All users have moderate technical literacy (operators / engineers / facility managers — not consumers).
6. English is the only supported UI language at MVP.
7. Network between THERMYNX cluster and `unicharm` MySQL has p95 RTT < 50 ms.
8. BMS / PLC integration is one-way *read* only — THERMYNX never issues control commands.

### B.3 Dependencies (External)

| Dependency | Owner | Risk if unavailable |
|------------|-------|---------------------|
| `unicharm` MySQL | Unicharm IT / Graylinx ingestion | **Critical** — no analytics possible |
| Ollama host | Graylinx | **High** — LLM features down; static dashboards still work |
| Tailscale | Graylinx | **High** — DB + LLM unreachable |
| GitHub | external | Low — only blocks deploys, not runtime |
| Customer firewall changes | Unicharm IT | Medium — blocks new deploys |

### B.4 Out-of-Scope (explicit)

- **Real-time control / write-back** — THERMYNX is read-only and advisory; never sends setpoints to BMS or PLCs.
- **Native mobile apps** — responsive web only.
- **Voice / chatbot embedding** in third-party apps (Teams, Slack, WhatsApp).
- **Custom alert routing** to PagerDuty / Opsgenie — Phase 5+ if requested.
- **Multi-language UI** — English only at launch.
- **Offline mode** — system requires network to MySQL + Ollama.
- **Customer-uploaded documents** for RAG in MVP — Phase 4 only.
- **Cloud LLM fallback** — explicitly *not* an option (data privacy).
- **Mobile push notifications** — email only at MVP.

### B.5 Stakeholders & RACI

R = Responsible · A = Accountable · C = Consulted · I = Informed

| Activity | Harshan (Graylinx) | Unicharm Plant Mgr | Unicharm IT | Graylinx Founder |
|----------|--------------------|--------------------|-------------|------------------|
| Product direction | R | C | I | A |
| Architecture decisions | R / A | I | C | I |
| Schema changes (`unicharm`) | C | I | R / A | I |
| Deploy to staging | R / A | I | I | I |
| Deploy to prod | R | A | C | I |
| Operator UAT | C | R / A | I | I |
| Incident response | R / A | C | C | I |
| Phase sign-off | R | A | I | I |
| Security review | R | I | C | A |
| Customer training | R | A | I | C |

---

**Last updated:** 2026-05-08
**Next review:** End of Phase 1 (target: 2026-05-15)
