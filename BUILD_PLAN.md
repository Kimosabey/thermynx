# THERMYNX — End-to-End Build Plan

**Product:** THERMYNX AI Operations Intelligence Platform
**Owner:** Harshan Aiyappa (Graylinx AI)
**Customer:** Unicharm Facility (HVAC plant rooms)
**Repo:** https://github.com/Kimosabey/thermynx
**Status:** Phase 0 (Foundation) complete — 10 commits pushed to `master`

---

## 1. Executive Summary

THERMYNX is an enterprise AI platform that turns raw HVAC telemetry from the Unicharm chiller plant into operational intelligence: real-time KPIs, efficiency benchmarking, anomaly detection, energy forecasting, and conversational AI explanations powered by a privately hosted Ollama LLM.

The product converts the existing `unicharm` MySQL database (port 3307) — already populated with normalized chiller, cooling tower, condenser pump, and AHU data — into a decision-support tool for plant operators, energy engineers, and facility managers.

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

## 4. Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────┐
│                         THERMYNX PLATFORM                          │
│                                                                    │
│  ┌─────────────┐    HTTPS/WS   ┌──────────────┐    asyncio        │
│  │  React SPA  │ ◄───────────► │   FastAPI    │ ─────────────┐    │
│  │  (Vite +    │               │   Backend    │              │    │
│  │  Chakra UI) │               │              │              │    │
│  └─────────────┘               └──────┬───────┘              │    │
│                                       │                      │    │
│                          ┌────────────┼────────────┐         │    │
│                          ▼            ▼            ▼         │    │
│                   ┌──────────┐ ┌────────────┐ ┌──────────┐  │    │
│                   │ Schema   │ │ Prompt     │ │ Cache    │  │    │
│                   │ Service  │ │ Builder    │ │ (Redis)  │  │    │
│                   └─────┬────┘ └─────┬──────┘ └──────────┘  │    │
│                         │            │                       │    │
└─────────────────────────┼────────────┼───────────────────────┼────┘
                          │            │                       │
                          ▼            ▼                       ▼
                  ┌────────────────┐  ┌────────────────────────────┐
                  │  MySQL         │  │  Ollama (Tailscale)        │
                  │  unicharm:3307 │  │  100.125.103.28:11434      │
                  │  - normalized  │  │  - llama3.1 / qwen2.5      │
                  │  - raw metric  │  │  - HVAC system prompts     │
                  └────────────────┘  └────────────────────────────┘
```

### Component Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Frontend** | UI, charts, markdown rendering, state, routing |
| **API Gateway** | Auth, rate-limit, request validation, OpenAPI docs |
| **Schema Service** | Introspect tables, build context windows for LLM |
| **Prompt Builder** | Compose HVAC-specific prompts with live data + benchmarks |
| **LLM Client** | Async Ollama calls with streaming, retry, timeout |
| **Cache Layer** | Redis for hot queries, prompt-response caching |
| **DB Layer** | Async SQLAlchemy + aiomysql, read-only against `unicharm` |

---

## 5. Tech Stack Rationale

| Choice | Why |
|--------|-----|
| **FastAPI** | Async-native, auto OpenAPI docs, Pydantic validation — best fit for AI + DB I/O |
| **React + Vite** | Fast HMR, modern DX; Vite proxy keeps dev simple |
| **Chakra UI** | Enterprise-grade tokens, accessible, theme-able for white-label later |
| **Ollama (self-hosted)** | Data privacy (no cloud calls with HVAC data), cost predictability |
| **MySQL `unicharm`** | Already exists, populated, indexed — reuse, don't rebuild |
| **aiomysql + SQLAlchemy** | Async ORM with raw-SQL escape hatches for time-series queries |
| **react-markdown** | Render LLM output with tables, code, lists natively |
| **Tailscale** | Zero-trust access to Ollama box without exposing public ports |

---

## 6. Phased Build Roadmap

> Each phase ends with a **demoable cut** and merges to `main`. No phase begins until the previous is verified.

### Phase 0 — Foundation ✅ DONE (2026-05-08)
- Repo initialized, scaffolded, pushed
- Backend: db/session, llm/ollama_client, prompts, services, /analyze, /health
- Frontend: theme, Sidebar, Layout, AIAnalyzer, Dashboard
- 10 feature-wise commits on `master`

### Phase 1 — MVP: Live AI Analyzer (Week 1)
**Goal:** Operator can pick equipment → time range → ask question → get AI answer with chart.

**Deliverables:**
- [ ] `GET /api/equipment` — list normalized equipment (chiller_1, chiller_2, cooling_tower_1, …)
- [ ] `GET /api/equipment/{id}/timeseries?from=…&to=…` — last N hours of data
- [ ] `POST /api/analyze` — accept `{equipment_id, time_range, user_question}`, return streamed markdown
- [ ] Frontend: equipment selector + date range picker + chart (Recharts) + AI panel
- [ ] SSE streaming from Ollama → frontend
- [ ] `.env.example` with all required keys
- [ ] README with quick-start (`make dev`)

**Verification:**
- Health check passes for DB + Ollama
- End-to-end: user query → response in < 8s for 24h window
- Markdown rendering handles tables, bold, lists

### Phase 2 — Intelligence Modules (Week 2–3)
**Goal:** Move beyond reactive Q&A to proactive intelligence.

**Modules:**
1. **Efficiency Benchmarker**
   - Compare actual kW/TR vs design + industry benchmarks
   - Color-coded performance bands (green/amber/red)
   - "Loss attribution" — fouling, low ΔT, oversizing, etc.

2. **Anomaly Detector**
   - Statistical baselines per equipment per hour-of-day
   - Z-score + rolling-window deviation
   - LLM-narrated alert: "Chiller 2 evap ΔT collapsed at 14:32, likely flow issue"

3. **Energy Forecaster**
   - Next-24h kWh prediction per equipment
   - Driver decomposition: ambient, occupancy, load
   - Backend: simple Prophet/SARIMA → upgrade path to ML later

4. **Comparison View**
   - Multi-equipment overlay charts
   - Side-by-side AI commentary

**Deliverables:**
- [ ] `app/analytics/efficiency.py` — kW/TR analyzer with benchmarks
- [ ] `app/analytics/anomaly.py` — z-score detector
- [ ] `app/analytics/forecast.py` — time-series forecaster
- [ ] Frontend pages: `/efficiency`, `/anomalies`, `/forecast`, `/compare`
- [ ] Background worker (APScheduler or arq) for periodic anomaly scans

### Phase 3 — Production Hardening (Week 4)
**Goal:** Make it deployable, secure, observable.

**Deliverables:**
- [ ] **Auth:** OAuth2 password flow + JWT (single-tenant) → SSO upgrade path
- [ ] **Secrets:** `.env` → Docker secrets / Vault
- [ ] **Logging:** structlog → JSON → log aggregator
- [ ] **Metrics:** Prometheus `/metrics` (request count, latency, LLM tokens)
- [ ] **Tracing:** OpenTelemetry to Jaeger/Tempo
- [ ] **CI/CD:** GitHub Actions — lint, test, build, push to registry
- [ ] **Containerization:** multi-stage Dockerfiles (backend + frontend), `docker-compose.prod.yml`
- [ ] **Health/readiness:** `/healthz`, `/readyz` with dep checks
- [ ] **Rate limiting:** slowapi
- [ ] **CORS:** lock to deployed domain

### Phase 4 — Advanced Features (Week 5–7)
**Goal:** Differentiate from generic dashboards.

**Modules:**
1. **Predictive Maintenance**
   - Run-hour tracking → PM scheduling
   - Degradation detection (rising kW for same TR)
   - Asset health score 0–100

2. **Cooling Tower Fan Optimizer**
   - Wet-bulb-aware fan staging recommendations
   - kWh saved estimator

3. **Cost Analytics**
   - kWh × tariff (TOU support) → ₹/TR-hr
   - Plant-level cost-per-cooling rolled up to facility

4. **Report Builder**
   - Auto-generated daily/weekly/monthly PDF
   - LLM-written executive summary
   - Email delivery (SMTP / SES)

5. **Conversational Memory**
   - Per-user thread history (SQLite or pgvector)
   - "Continue from yesterday's analysis"

### Phase 5 — Scale & Multi-Tenant (Future)
- Multi-facility support (Unicharm campus expansion)
- Tenant isolation at DB schema level
- Custom branding per tenant
- White-label deployment for other Graylinx customers

---

## 7. Module Specifications (Phase 1 Detail)

### 7.1 Equipment Catalog API
```
GET /api/equipment
→ [{ id, name, type, ss_id, normalized_table, status }]
```

### 7.2 Timeseries API
```
GET /api/equipment/{id}/timeseries
  ?metrics=kw,kw_per_tr,evap_leaving_temp
  &from=2026-05-07T00:00:00Z
  &to=2026-05-08T00:00:00Z
  &resolution=1m|5m|1h
→ { equipment_id, points: [{ slot_time, kw, kw_per_tr, ... }] }
```

### 7.3 Analyze API
```
POST /api/analyze
{
  equipment_id: "chiller_1",
  time_range: { from, to },
  question: "Why is efficiency dropping?",
  context_metrics: ["kw_per_tr", "chw_delta_t", "chiller_load"]
}
→ SSE stream of markdown chunks
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

### 7.4 Frontend State Model
```js
{
  selectedEquipment: { id, name, type },
  timeRange: { from, to, preset: "24h" },
  metrics: ["kw", "kw_per_tr"],
  chart: { data, loading, error },
  analysis: { streaming, content, sources },
  threadHistory: []
}
```

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
Pre-compute hourly/daily rollups in a separate `thermynx_analytics` schema:
- `hourly_kpi_chiller_1`, `daily_kpi_chiller_1`
- Refresh via scheduled job — keeps dashboards snappy.

---

## 9. AI / LLM Strategy

### 9.1 Model Selection
| Model | Use Case | Why |
|-------|----------|-----|
| `llama3.1:8b` | Default analyzer | Fast, accurate enough for HVAC reasoning |
| `qwen2.5:14b` | Deep analysis | Better at numerical reasoning |
| `nomic-embed-text` | RAG (Phase 4) | Embed historical reports for retrieval |

### 9.2 Prompt Engineering Discipline
- **System prompts** versioned in `app/prompts/` — never inline strings in handlers
- **Few-shot examples** for each analysis type (efficiency, anomaly, fault)
- **Output contracts** — request markdown with explicit sections (Findings / Causes / Recommendations)
- **Token budget guard** — truncate context if > 6k tokens, summarize older data

### 9.3 Retrieval-Augmented Generation (Phase 4)
- Embed equipment manuals, ASHRAE guides, past incident reports
- Vector store: Chroma → upgrade to pgvector for prod
- Cite sources in responses

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

## 11. Deployment Strategy

### 11.1 Environments
| Env | Purpose | Host |
|-----|---------|------|
| `dev` | Local | Developer laptop |
| `staging` | Integration | VM with Tailscale to Unicharm DB |
| `prod` | Customer | On-prem at Unicharm OR Graylinx VPS |

### 11.2 Containerization
```
backend/Dockerfile       — multi-stage, slim python base
frontend/Dockerfile      — multi-stage, nginx serves dist/
docker-compose.yml       — local dev with hot reload
docker-compose.prod.yml  — production with nginx + redis
```

### 11.3 CI/CD (GitHub Actions)
```
.github/workflows/
├── ci.yml         — lint + test on every PR
├── build.yml      — build + push images on merge to main
└── deploy.yml     — manual trigger → deploy to staging/prod
```

### 11.4 Release Cadence
- Daily commits, weekly tagged releases (`v0.1.0`, `v0.2.0`, …)
- Conventional commits enforced via commitlint hook

---

## 12. Security & Compliance

| Concern | Mitigation |
|---------|------------|
| **Secrets in repo** | `.env` gitignored, secrets via env or Vault |
| **DB exposure** | Read-only DB user, IP-allowlisted |
| **LLM data leak** | Self-hosted Ollama, no cloud LLM calls |
| **Auth bypass** | JWT with short expiry, refresh tokens |
| **CORS** | Locked to deployed domain in prod |
| **SQL injection** | SQLAlchemy parameterized queries only — never f-strings |
| **Rate abuse** | slowapi limits per IP and per user |
| **Audit** | Every `/analyze` request logged with user + prompt + response hash |

---

## 13. Observability

| Signal | Tool | What |
|--------|------|------|
| **Logs** | structlog → loki | JSON, request-scoped, redacted |
| **Metrics** | Prometheus | RED method (Rate, Errors, Duration) |
| **Traces** | OpenTelemetry → Tempo | Cross-service span: API → DB → LLM |
| **Dashboards** | Grafana | One per service, plus business KPIs |
| **Alerts** | Alertmanager | Pager on: 5xx > 1%, LLM p95 > 15s, DB down |

---

## 14. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Ollama host goes offline | M | H | Health check + fallback to cached responses + retry |
| MySQL replica lag | M | M | Read directly from primary; add replica lag alert |
| LLM hallucinates wrong recommendation | H | H | Cite source data in response, "AI-assisted, verify before action" disclaimer |
| Schema changes break analytics | L | H | Schema introspection + integration tests on prod-like DB |
| Token cost explosion (if cloud LLM later) | L | M | Self-hosted Ollama; per-user token quota |
| Single point of failure (one backend) | M | H | Docker swarm / k8s with 2+ replicas in prod |
| User pastes PII in question | M | M | PII scrubber middleware before logging |

---

## 15. Success Metrics

### 15.1 Technical
- Backend p95 latency: < 500ms (non-LLM), < 8s (LLM)
- Frontend FCP: < 1.5s on cable
- Test coverage: > 80% backend, > 60% frontend
- Uptime: 99.5% (Phase 3+)

### 15.2 Product
- Daily active operators: > 5 within 30 days of launch
- AI Analyzer queries/day: > 50 within 30 days
- Recommendations actioned: > 20% (tracked via feedback button)
- kWh saved attributable to THERMYNX recommendations: > 5% within 6 months

---

## 16. Immediate Next Steps (This Week)

In order, no parallel work:

1. **Consolidate code** — Decide whether `thermynx/` or root `backend/`+`frontend/` is canonical. Delete the other to remove ambiguity.
2. **Wire Phase 1 backend** — `/api/equipment`, `/api/equipment/{id}/timeseries` endpoints
3. **Wire Phase 1 frontend** — Equipment selector + chart on AI Analyzer page
4. **End-to-end test** — Pick chiller_1, last 24h, ask "explain efficiency"
5. **README** — Quick-start for any dev to run locally in < 5 minutes
6. **Tag `v0.1.0-mvp`** — First demoable cut

---

## 17. Open Decisions

These need owner input before proceeding:

- [ ] **Canonical path:** `thermynx/` or root `backend/`+`frontend/`?
- [ ] **Auth scope (Phase 3):** SSO via Microsoft (Unicharm AD) or local accounts?
- [ ] **Hosting:** On-prem at Unicharm or Graylinx-managed VPS?
- [ ] **Ollama redundancy:** Single host enough or need HA?
- [ ] **Branding:** THERMYNX standalone or co-branded with Graylinx + Unicharm?
- [ ] **Data retention:** How long to keep analysis history per user?

---

## Appendix A — File Structure (Target State)

```text
thermynx/
├── .github/workflows/      # CI/CD
├── backend/
│   ├── app/
│   │   ├── api/            # Routes
│   │   ├── analytics/      # Efficiency, anomaly, forecast
│   │   ├── auth/           # JWT, OAuth
│   │   ├── db/             # Session, models
│   │   ├── llm/            # Ollama client
│   │   ├── prompts/        # Versioned templates
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # CORS, rate-limit, logging
│   │   ├── utils/          # Logger, helpers
│   │   └── config.py
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── eval/           # LLM regression
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # Sidebar, Cards, Charts
│   │   ├── pages/          # Dashboard, Analyzer, etc.
│   │   ├── hooks/          # useEquipment, useAnalyze
│   │   ├── api/            # Typed API client
│   │   ├── theme/
│   │   ├── utils/
│   │   └── App.jsx
│   ├── tests/              # Vitest + Playwright
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

**Last updated:** 2026-05-08
**Next review:** End of Phase 1 (target: 2026-05-15)
