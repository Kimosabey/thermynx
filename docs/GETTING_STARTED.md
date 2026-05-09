# Getting Started with THERMYNX (POC)

**Goal:** clone, run, demo locally — under 10 minutes on a fresh laptop.

## Prerequisites

| Need | Version | How to check |
|------|---------|--------------|
| Docker Desktop | latest stable | `docker --version` |
| Node.js | 20+ | `node --version` |
| Python | 3.11+ | `python --version` (only needed if you hack the backend outside Docker) |
| Tailscale | logged in | `tailscale status` — must show the Ollama node + MySQL host reachable |
| Git | any recent | `git --version` |

## Clone & configure

```bash
git clone https://github.com/Kimosabey/thermynx.git
cd thermynx
cp .env.example .env
```

Edit `.env` and fill in:

```bash
UNICHARM_DB_URL=mysql+aiomysql://ro_user:<password>@<tailscale-ip>:3307/unicharm
OLLAMA_BASE_URL=http://100.125.103.28:11434
OLLAMA_DEFAULT_MODEL=qwen2.5:14b
POSTGRES_PASSWORD=<anything for local>
```

> Real credentials live with the project owner — never commit them.

## Start the stack

```bash
make dev
# OR if no Makefile yet:
docker compose up -d                # api + postgres + redis
cd frontend && npm install && npm run dev
```

Open <http://localhost:5173> — you should see the Analyzer page.

## Smoke test (Phase 1 demo)

1. Pick `chiller_1` from the equipment dropdown
2. Time range: last 24h (preset)
3. Question: **"Explain the efficiency"**
4. Click **Analyze**
5. Markdown should start streaming within ~3 s and finish within ~8 s

If you see content streaming → the POC is working end-to-end.

## What runs where

| Component | Where | Port |
|-----------|-------|------|
| FastAPI backend | docker compose on your laptop | `:8000` |
| PostgreSQL `thermynx_app` | docker compose on your laptop | `:5432` |
| Redis | docker compose on your laptop | `:6379` |
| Frontend (Vite dev server) | your laptop (host) | `:5173` |
| MySQL `unicharm` | external, Tailscale-reachable | `:3307` |
| Ollama | external server (Dell Pro Max Tower), Tailscale | `:11434` |

See [`ARCHITECTURE.md` §7](./ARCHITECTURE.md#7-poc-deployment-topology) for the topology diagram.

## Common gotchas

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Cannot connect to Ollama` | Tailscale offline / Ollama box off | `tailscale status`; remote into the Ollama box |
| Empty equipment list | RO user lacks `SELECT` on `information_schema` | re-check `UNICHARM_DB_URL` user privileges |
| No data in chart | Equipment has no rows in chosen window | try a different range or different equipment |
| Slow first token | Ollama warming the model | first call after idle is ~30 s; subsequent are fast |
| `502` on `/timeseries` | MySQL query timeout (5s default) | narrow the range, or raise `MYSQL_TIMEOUT_S` |
| CORS error in browser | Vite proxy mis-configured | check `frontend/vite.config.ts` `server.proxy` |

For deeper troubleshooting see [`RUNBOOK.md`](./RUNBOOK.md).

## Next steps

- Review [`../BUILD_PLAN.md` §1A](../BUILD_PLAN.md) for current scope
- Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the system mental model
- Pick a Phase 1 deliverable from [`../BUILD_PLAN.md` §6](../BUILD_PLAN.md) and ship it
