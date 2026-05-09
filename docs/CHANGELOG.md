# THERMYNX — Changelog

All notable changes to this project. Format: `[version] — date — description`.

Versions follow `v0.X.0-poc` during POC phase, then `v1.0.0` at production readiness.

---

## [Unreleased]

### Planned (Sprint 1 — Stability)
- Fix: stack traces no longer leak in 500 error responses
- Fix: CORS origins driven from `CORS_ORIGINS` env var
- Fix: `max_length` validation on `/analyze` and `/agent/run` inputs
- Fix: `asyncio.wait_for` timeout on agent tool calls
- Add: Alembic database migrations (replace lifespan ALTER TABLE)

---

## [v0.4.0-poc] — 2026-05-09

### Added
- `GET /threads/{id}` endpoint for fetching a thread with all messages
- Graylinx brand redesign: light-capable theme, WCAG 2.2 contrast, GSAP animations, Lucide icons
- AI Architecture Reference document (`docs/AI_ARCHITECTURE_REFERENCE.md`)
- Comprehensive test suite (`backend/tests/test_all_apis.py`) — 49+ checks covering all endpoints
- Flaws & improvement plan document (`docs/FLAWS_AND_IMPROVEMENT_PLAN.md`)
- API Reference (`docs/API_REFERENCE.md`)
- Environment Variables Reference (`docs/ENV_REFERENCE.md`)
- Agent & Tools Reference (`docs/AGENT_REFERENCE.md`)
- Analytics Reference (`docs/ANALYTICS_REFERENCE.md`)
- Frontend Guide (`docs/FRONTEND_GUIDE.md`)

### Fixed
- `reports` field is markdown (not `executive_summary`)
- `/reports/daily` returns JSON not SSE (regression fixed)
- Latency tolerance in test suite
- `GET /threads/{id}` added (was missing)
- Field name alignment between backend and test assertions
- `urllib.parse` import moved to correct location in tests

### Changed
- Database schema: UUID columns widened to 36 chars via lifespan migration
- `TELEMETRY_TIME_ANCHOR=latest_in_db` default for historical data compatibility

---

## [v0.3.0-poc] — 2026-05 (Phase 3)

### Added
- **AI Agents** (`POST /agent/run`) — 5 modes: investigator, optimizer, brief, root_cause, maintenance
- ReAct loop with 6 tools: get_equipment_list, compute_efficiency, detect_anomalies, get_timeseries_summary, compare_equipment, get_anomaly_history
- SSE streaming of agent reasoning trace (thought / tool_call / tool_result / token / done frames)
- Agent run history persisted to `agent_runs` Postgres table
- **Reports** (`POST /reports/daily`) — AI-generated executive summary with KPI table and anomaly highlights
- **Cost analytics** (`GET /cost`) — kWh + INR breakdown by equipment, configurable tariff
- **Maintenance analysis** (`GET /maintenance`) — run hours, cycle count, wear estimate, health score A–D
- **Cooling tower optimizer** (`GET /cooling-tower/{id}/optimize`) — approach temp, fouling detection, setpoint hint
- **Conversation threads** (`POST/GET/DELETE /threads`) — persistent chat history for Analyzer
- Frontend: AI Agents page, Reports page, Cost page, Maintenance page
- Versioned prompt catalogue (`docs/PROMPTS.md`)

---

## [v0.2.0-poc] — 2026-05 (Phase 2)

### Added
- **Efficiency analysis** (`GET /efficiency`, `GET /efficiency/{id}`) — kW/TR band, loss drivers, delta vs design
- **Anomaly detection** (`GET /anomalies/live`, `GET /anomalies/history`) — z-score detection, severity labeling
- **Background anomaly scan** — APScheduler job every 5 minutes, persists to `anomalies` Postgres table
- **Forecast** (`GET /forecast/{id}`) — trend analysis, 7/30-day linear projection with CI band
- **Equipment comparison** (`GET /compare`) — side-by-side KPI + efficiency
- `analysis_audit` table for tracking all `/analyze` calls
- `anomalies` table for persisted anomaly events
- Frontend: Efficiency page, Anomalies page, Forecast page, Compare page

---

## [v0.1.0-poc] — 2026-05 (Phase 1)

### Added
- FastAPI backend — 5-layer clean architecture (transport, service, domain, analytics, infrastructure)
- MySQL read-only connection to Unicharm `unicharm` database via Tailscale
- PostgreSQL app database via docker-compose (pgvector/pgvector:pg16)
- Redis via docker-compose
- `GET /health` — deep health check (MySQL + Ollama connectivity)
- `GET /equipment` + `GET /equipment/summary` — equipment catalog and live KPI summary
- `GET /equipment/{id}/timeseries` — bucketed timeseries (5m / 15m / 1h / 6h / 1d resolution)
- `POST /analyze` — SSE-streaming AI analysis using Ollama (qwen2.5:14b)
- Ollama LLM client (`backend/app/llm/ollama.py`) — streaming generation + embeddings
- RAG scaffolding (`GET /rag/status`, `GET /rag/search`) — pgvector-backed semantic search
- Frontend: Dashboard, AI Analyzer, Knowledge Base (RAG) pages
- Chakra UI 2 + Framer Motion animations
- `docker-compose.yml` for Postgres + Redis
- `docs/` — Architecture, Getting Started, Runbook, Data Dictionary, Database Schema Reference

---

## Version Format

```
v{major}.{minor}.{patch}-{stage}
```

- `major` = 0 during POC; 1 at production readiness
- `minor` = phase number (1–4 for POC phases)
- `patch` = hotfix number within a phase
- `stage` = `poc` (pre-production) or omitted (production)

Tag format: `git tag -a v0.4.0-poc -m "POC Phase 4 complete"`
