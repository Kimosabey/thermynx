# THERMYNX — AI Operations Intelligence Platform

AI-powered HVAC analytics for Unicharm facility. Turns raw chiller telemetry into explainable, actionable intelligence via a locally-hosted LLM.

> **Status:** POC active — Phase 1 ✅ · Phase 2 ✅ · Phase 3 agents ✅ (maintenance/cost/reports pending)

---

## Quick-start (under 10 minutes)

### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Docker Desktop | latest | `docker --version` |
| Node.js | 20+ | `node --version` |
| Python | 3.11+ | `python --version` |
| Tailscale | connected | `tailscale status` |

The **Ollama server** (`100.125.103.28:11434`) and **MySQL `unicharm:3307`** must be reachable over Tailscale before you start.

---

### 1. Clone & configure

```bash
git clone https://github.com/Kimosabey/thermynx.git
cd thermynx
cp .env.example backend/.env
```

Edit `backend/.env` — fill in real values:

```env
DB_HOST=<tailscale-ip-to-mysql>
DB_PASSWORD=<mysql-ro-password>
OLLAMA_DEFAULT_MODEL=qwen2.5:14b
POSTGRES_URL=postgresql+asyncpg://thermynx:dev@localhost:5432/thermynx_app
```

### 2. Start stateful services (Postgres + Redis)

```bash
make deps        # docker compose up -d + waits for Postgres
```

### 3. Install backend dependencies

```bash
cd backend
python -m venv ../.venv          # first time only
../.venv/Scripts/activate        # Windows
# source ../.venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
```

### 4. Start backend + frontend (two terminals)

**Terminal 1 — backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm install          # first time only
npm run dev
```

### 5. Open the app

```
http://localhost:5173
```

---

## What's working — page by page

| Page | Route | What you can do |
|------|-------|-----------------|
| **Dashboard** | `/dashboard` | Live KPI cards (kW/TR, load, temps) for all equipment; animated counters; DB + Ollama status |
| **AI Analyzer** | `/analyzer` | Pick equipment + time range → chart → ask anything → markdown streams in |
| **Efficiency** | `/efficiency` | kW/TR band analysis vs design benchmark; animated band bar; loss driver cards for all chillers |
| **Anomalies** | `/anomalies` | Real-time z-score scan across all equipment; z-score pills; scan-now button |
| **AI Agents** | `/agent` | 5 autonomous agents using tool-calling LLM; live reasoning trace + streaming report |

### AI Agents demo

1. Go to `/agent`
2. Click **Investigator** card
3. Select **Chiller 1** + **24 hours**
4. Click preset: _"Investigate Chiller 1 efficiency — why is it underperforming?"_
5. Click **Run Investigator**
6. Watch: agent calls `compute_efficiency` → `detect_anomalies` → `compare_equipment` → streams final report

## Smoke test

```bash
cd backend
python tests/smoke_test.py
```

All 6 checks must pass before tagging a release.

---

## Project structure

```
thermynx/
├── backend/
│   ├── app/
│   │   ├── api/v1/         # versioned route handlers
│   │   ├── analytics/      # efficiency, anomaly, forecast (Phase 2+)
│   │   ├── domain/         # pure logic — no I/O (equipment catalog, bands)
│   │   ├── db/             # session.py · models.py · telemetry.py
│   │   ├── llm/            # ollama.py — streaming client
│   │   └── prompts/        # versioned HVAC prompt templates
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/            # App.jsx · Layout.jsx · theme/
│       ├── features/       # dashboard/ · analyzer/ · efficiency/ · anomalies/ · agent/
│       └── shared/ui/      # GlassCard · KpiCard · StatusPulse · Sidebar · etc.
├── docs/
│   ├── ARCHITECTURE.md     # all diagrams render inline
│   ├── GETTING_STARTED.md
│   ├── RUNBOOK.md
│   ├── PROMPTS.md
│   └── DATA_DICTIONARY.md
├── docker-compose.yml      # Postgres + Redis only
├── Makefile
└── BUILD_PLAN.md           # full product roadmap
```

---

## Make commands

```bash
make deps       # start Postgres + Redis (docker compose up -d)
make stop       # docker compose down
make reset      # docker compose down -v  (wipes Postgres — POC only)
make logs       # docker compose logs -f
```

---

## Smoke test

```bash
cd backend
python tests/smoke_test.py
```

All checks must pass before tagging a release.

---

## Roadmap

| Phase | What | Status |
|-------|------|--------|
| Phase 0 — Foundation | Scaffolding, DB, LLM, basic endpoints | ✅ Done |
| Phase 1 — Live AI Analyzer | Equipment selector, chart, SSE streaming, audit | ✅ Done |
| Phase 2 — Intelligence | Efficiency ✅ · Anomalies ✅ · Forecaster ✅ · Compare ✅ | ✅ Done |
| Phase 3 — Advanced Features | AI Agents (5 modes) ✅ · Maintenance ⬜ · Cost ⬜ · Reports ⬜ · Memory ⬜ | 🔄 Partial |
| Phase 4 — RAG | pgvector, PDF ingestion, citations | ⬜ Not started |
| Phase 5 — Hardening | Auth, monitoring, TLS, backups | ⏸ Post-POC |

See [`BUILD_PLAN.md`](BUILD_PLAN.md) for full detail.

---

## Key docs

- [Architecture diagrams](docs/ARCHITECTURE.md) — renders in GitHub
- [Runbook](docs/RUNBOOK.md) — debugging, resets, tagging
- [Prompt catalogue](docs/PROMPTS.md) — LLM prompt versions
- [Data dictionary](docs/DATA_DICTIONARY.md) — unicharm MySQL tables
