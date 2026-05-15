# Graylinx — Operations Runbook

> First time? → [`GETTING_STARTED.md`](./GETTING_STARTED.md)
> API reference? → [`API_REFERENCE.md`](../reference/API_REFERENCE.md)

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [Start the Stack](#2-start-the-stack)
3. [Stop the Stack](#3-stop-the-stack)
4. [Check Everything is Healthy](#4-check-everything-is-healthy)
5. [View Logs](#5-view-logs)
6. [Database — Migrations](#6-database--migrations)
7. [Database — Reset](#7-database--reset)
8. [Database — Inspect Data](#8-database--inspect-data)
9. [Backend — Install / Update Dependencies](#9-backend--install--update-dependencies)
10. [Frontend — Install / Update Dependencies](#10-frontend--install--update-dependencies)
11. [Ollama — Manage Models](#11-ollama--manage-models)
12. [RAG — Ingest & Manage Documents](#12-rag--ingest--manage-documents)
13. [Environment Variables](#13-environment-variables)
14. [Git — Tagging Releases](#14-git--tagging-releases)
15. [Render Architecture Diagrams](#15-render-architecture-diagrams)
16. [Troubleshooting](#16-troubleshooting)
17. [Something is on Fire](#17-something-is-on-fire)
18. [Network & Port Reference](#18-network--port-reference)

---

## 1. Quick Reference

Commands you run every single day — memorise these.

```bash
# ── Start ─────────────────────────────────────────────────────────────────────
docker compose up -d                                   # start Postgres + Redis in background
cd backend && ../.venv/Scripts/uvicorn main:app --reload --port 8000   # Terminal 1: backend
cd frontend && npm run dev                             # Terminal 2: frontend

# ── Stop ──────────────────────────────────────────────────────────────────────
Ctrl+C                                  # stop backend or frontend (in their terminal)
docker compose down                     # stop Postgres + Redis

# ── Health check ──────────────────────────────────────────────────────────────
# Clickable: http://localhost:8000/healthz
curl http://localhost:8000/healthz
# Clickable: http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/health

# ── Logs ──────────────────────────────────────────────────────────────────────
docker compose logs -f                  # all containers
docker compose logs -f api              # backend only (if running in docker)
```

---

## 2. Start the Stack

Run these **in order**. Use separate terminal windows for steps 2 and 3.

### Step 1 — Start Docker services (Postgres + Redis)

```bash
docker compose up -d
```

Wait ~5 seconds, then verify both are healthy:

```bash
docker compose ps
```

Expected output:
```
NAME                    IMAGE                        STATUS
Graylinx-postgres-1     pgvector/pgvector:pg16       Up (healthy)
Graylinx-redis-1        redis:7-alpine               Up (healthy)
```

If either shows `starting` wait another 5 seconds and run `docker compose ps` again.

---

### Step 2 — Start the backend (Terminal 1)

> **Important:** always use the venv's uvicorn, not the system Python.
> All packages (python-multipart, pypdf, alembic, etc.) are installed in `.venv`, not globally.

```bash
cd backend
../.venv/Scripts/uvicorn main:app --reload --port 8000
```

If you prefer to activate the venv first (then you can just type `uvicorn`):
```powershell
../.venv/Scripts/Activate.ps1
uvicorn main:app --reload --port 8000
```

Expected output (last few lines):
```
INFO  pgvector_extension_ready
INFO  postgres_metadata_ready
INFO  Anomaly scan scheduler started (every 5 min)
INFO  Application startup complete.
INFO  Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

> **Clickable API:** [http://localhost:8000](http://localhost:8000)

> If you see `pgvector_extension_unavailable` — your Postgres image is wrong.
> Fix: `docker compose down -v && docker compose up -d` (uses pgvector image).

---

### Step 3 — Start the frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in 400 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser. The Dashboard should load within 2 seconds.

---

## 3. Stop the Stack

### Normal stop (preserves all data)

```bash
# In Terminal 1 — stop backend
Ctrl+C

# In Terminal 2 — stop frontend
Ctrl+C

# Stop Docker services
docker compose down
```

### Full stop + wipe all Postgres data (fresh start)

> ⚠️ This deletes everything in the Postgres database (threads, audit, anomalies). MySQL (Unicharm) is never touched.

```bash
docker compose down -v
```

---

## 4. Check Everything is Healthy

### Backend liveness

```bash
curl http://localhost:8000/healthz
```

Expected: `{"status":"ok"}`

---

### Deep health (MySQL + Ollama connectivity)

```bash
curl http://localhost:8000/api/v1/health
```

Expected:
```json
{
  "status": "ok",
  "db": { "connected": true, "latency_ms": 12 },
  "ollama": { "connected": true, "default_model": "qwen2.5:14b", "latency_ms": 45 }
}
```

If `status` is `"degraded"` — check which component failed and go to [§16 Troubleshooting](#16-troubleshooting).

---

### Tailscale (external services)

```bash
tailscale status
```

Look for two IPs to be listed and reachable:
- MySQL Unicharm host (port 3307)
- Ollama box: `100.125.103.28` (port 11434)

---

### Docker containers

```bash
docker compose ps
```

All containers must show `Up (healthy)`. If any shows `Up (unhealthy)` or `Exit`:

```bash
docker compose logs postgres    # or redis
```

---

## 5. View Logs

### Backend (live tail)

```bash
docker compose logs -f api
```

Or if running backend locally with `uvicorn --reload`, logs print directly in Terminal 1.

---

### Postgres

```bash
docker compose logs -f postgres
```

---

### Redis

```bash
docker compose logs -f redis
```

---

### All containers at once

```bash
docker compose logs -f
```

---

### Filter backend logs for errors only

```bash
docker compose logs api | grep '"level":"error"'
```

---

### Last 100 lines of backend log

```bash
docker compose logs --tail=100 api
```

---

## 6. Database — Migrations

Alembic manages all schema changes to the Postgres `thermynx_app` database.

> MySQL (`unicharm`) is read-only and customer-owned — **never** run migrations against it.

On **API startup**, `uvicorn main:app` runs `alembic upgrade head` in a subprocess (see `backend/main.py`) so schema revisions apply before `create_all`. You should still run **`make migrate`** in CI/CD before serving traffic, and use the commands below when authoring new revisions.

---

### Apply all pending migrations (normal deploy step)

```bash
cd backend
alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade  -> 0001, initial schema
```

If already up to date:
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
```

---

### Check current migration version

```bash
cd backend
alembic current
```

---

### See migration history

```bash
cd backend
alembic history --verbose
```

---

### Create a new migration (after changing models.py)

```bash
cd backend
alembic revision --autogenerate -m "add my new column"
```

This generates a file in `alembic/versions/`. **Always review it before applying.**

Then apply it:
```bash
alembic upgrade head
```

---

### Stamp an existing database (one-time, for DBs created before Alembic was added)

If your Postgres already has tables (created by `create_all` before Alembic was set up):

```bash
cd backend
alembic stamp head
```

This marks the DB as current without running any migrations. Run this once, then use `alembic upgrade head` for all future changes.

---

### Roll back one migration

```bash
cd backend
alembic downgrade -1
```

---

### Makefile shortcuts

```bash
make migrate                            # = alembic upgrade head
make migrate-create MSG="add foo"       # = alembic revision --autogenerate
make migrate-stamp                      # = alembic stamp head
```

---

## 7. Database — Reset

### Wipe Postgres and start clean

> ⚠️ Destroys all threads, audit logs, anomalies, agent runs, and embeddings.

```bash
# Step 1 — stop and wipe the volume
docker compose down -v

# Step 2 — restart Postgres
docker compose up -d postgres

# Step 3 — wait for it to be healthy
docker compose ps   # wait until postgres shows "Up (healthy)"

# Step 4 — run migrations on the fresh DB
cd backend
alembic upgrade head

# Step 5 — restart the backend
uvicorn main:app --reload --port 8000
```

---

### Wipe only the embeddings (RAG corpus)

This does not touch any other data:

```bash
docker compose exec postgres psql -U thermynx -d thermynx_app \
  -c "DELETE FROM embeddings;"
```

---

## 8. Database — Inspect Data

### Open a Postgres shell

```bash
docker compose exec postgres psql -U thermynx -d thermynx_app
```

To exit: type `\q` and press Enter.

---

### Useful queries

**Recent AI analyses:**
```sql
SELECT id, equipment_id, status, model, total_ms, created_at
FROM analysis_audit
ORDER BY created_at DESC
LIMIT 20;
```

**Failed analyses only:**
```sql
SELECT id, equipment_id, question, status, total_ms, created_at
FROM analysis_audit
WHERE status != 'ok'
ORDER BY created_at DESC;
```

**Recent agent runs:**
```sql
SELECT id, mode, goal, steps_taken, status, total_ms, created_at
FROM agent_runs
ORDER BY created_at DESC
LIMIT 20;
```

**Recent anomalies:**
```sql
SELECT equipment_id, metric, z_score, severity, created_at
FROM anomalies
ORDER BY created_at DESC
LIMIT 20;
```

**Conversation threads:**
```sql
SELECT t.id, t.title, COUNT(m.id) AS messages, t.created_at
FROM threads t
LEFT JOIN messages m ON m.thread_id = t.id
GROUP BY t.id, t.title, t.created_at
ORDER BY t.created_at DESC;
```

**RAG corpus summary:**
```sql
SELECT source_id, COUNT(*) AS chunks, MAX(created_at) AS last_ingested
FROM embeddings
GROUP BY source_id
ORDER BY last_ingested DESC;
```

**Check pgvector index exists:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'embeddings';
```

---

## 9. Backend — Install / Update Dependencies

### Install all dependencies (fresh setup or after pulling changes)

```bash
cd backend
pip install -r requirements.txt
```

---

### Install a new package and update requirements

```bash
cd backend
pip install some-package==1.2.3
pip freeze | grep some-package >> requirements.txt
```

Or manually add it to `requirements.txt`, then:

```bash
pip install -r requirements.txt
```

---

### Check what's installed

```bash
cd backend
pip list
```

---

### Key packages and what they do

| Package | Purpose |
|---------|---------|
| `fastapi` | Web framework + OpenAPI |
| `uvicorn` | ASGI server |
| `sqlalchemy[asyncio]` | ORM + async DB access |
| `aiomysql` | Async MySQL driver (Unicharm read-only) |
| `asyncpg` | Async Postgres driver (thermynx_app) |
| `alembic` | Database migrations |
| `pgvector` | Vector similarity search (RAG) |
| `pypdf` | PDF text extraction (RAG ingest) |
| `python-multipart` | File upload support |
| `httpx` | Async HTTP client (Ollama calls) |
| `redis` | Redis client (cache + queue) |
| `apscheduler` | Background anomaly scan job |

---

## 10. Frontend — Install / Update Dependencies

### Install all dependencies (fresh setup or after pulling changes)

```bash
cd frontend
npm install
```

---

### Add a new package

```bash
cd frontend
npm install package-name
```

---

### Start dev server

```bash
cd frontend
npm run dev
```

Open: **http://localhost:5173**

---

### Build for production

```bash
cd frontend
npm run build
```

Output goes to `frontend/dist/`. Serve with nginx or `npm run preview`.

---

## 11. Ollama — Manage Models

All commands run **on the Ollama box** (remote into it via Tailscale, or SSH).

### List installed models

```bash
ollama list
```

Expected output:
```
NAME                     ID              SIZE    MODIFIED
qwen2.5:14b              abc123...       9.0 GB  2 days ago
nomic-embed-text:latest  def456...       274 MB  5 days ago
```

---

### Pull (install or refresh) a model

```bash
ollama pull qwen2.5:14b          # main chat/tool-calling model (~9 GB)
ollama pull nomic-embed-text     # embedding model for RAG (~274 MB)
```

---

### Remove a model

```bash
ollama rm phi:latest
```

---

### Change the default model

1. Edit `backend/.env`:
   ```
   OLLAMA_DEFAULT_MODEL=qwen2.5:14b
   ```

2. Restart the backend:
   ```bash
   # In Terminal 1 — press Ctrl+C, then:
   uvicorn main:app --reload --port 8000
   ```

3. Verify:
   ```bash
   curl http://localhost:8000/api/v1/health
   # Look for: "default_model": "qwen2.5:14b"
   ```

---

### Check VRAM usage on the Ollama box

```bash
nvidia-smi
```

`qwen2.5:14b` uses ~9 GB of the 20 GB available. Do not load `gpt-oss:120b` — it is 65 GB and will crash the machine.

---

## 12. RAG — Ingest & Manage Documents

### Prerequisites

```bash
# 1. Pull embedding model on the Ollama box (one-time)
ollama pull nomic-embed-text     # ~274 MB

# 2. Install backend deps (if not done yet)
cd backend
pip install -r requirements.txt
```

---

### Option A — Upload via UI (recommended)

1. Open **http://localhost:5173/rag**
2. Drag PDF / TXT / MD files onto the upload zone, or click **Browse**
3. Click **Ingest**
4. Progress shows per file: *"Embedding file 1 of 3…"*
5. Status card refreshes automatically when done

---

### Option B — Ingest via terminal (bulk)

```bash
# Place files in docs/manuals/ first, then:
cd backend
python scripts/ingest_docs.py --dir ../docs/manuals
```

Re-ingest (replaces existing chunks for same filenames):
```bash
python scripts/ingest_docs.py --dir ../docs/manuals --clear
```

---

### Verify RAG corpus is ready

```bash
curl http://localhost:8000/api/v1/rag/status
```

Expected:
```json
{ "ready": true, "total_chunks": 142, "sources": [...] }
```

---

### Search the corpus

```bash
curl "http://localhost:8000/api/v1/rag/search?q=condenser+tube+cleaning&top_k=3"
```

---

### Remove a source document

```bash
curl -X DELETE "http://localhost:8000/api/v1/rag/sources/chiller_manual.pdf"
```

Expected: `{ "status": "ok", "chunks_removed": 42 }`

---

## 13. Environment Variables

Config file: `backend/.env` (copy from `.env.example` if missing).

### View current config

```bash
cd backend
cat .env
```

---

### Key variables to know

| Variable | Default | When to change |
|----------|---------|----------------|
| `DB_HOST` | — | Your Unicharm MySQL Tailscale IP |
| `DB_PASSWORD` | — | MySQL read-only user password |
| `POSTGRES_URL` | `postgresql+asyncpg://thermynx:dev@localhost:5432/thermynx_app` | Change password for prod |
| `OLLAMA_HOST` | `http://100.125.103.28:11434` | If Ollama box IP changes |
| `OLLAMA_DEFAULT_MODEL` | `qwen2.5:14b` | To switch models |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Set to deployed host for production |
| `TELEMETRY_TIME_ANCHOR` | `latest_in_db` | Set to `wall_clock` for live data feeds |
| `TARIFF_INR_PER_KWH` | `8.5` | Update to actual Unicharm electricity rate |
| `LOG_JSON` | `false` | Set `true` in production for structured logs |

---

### Update a variable

Edit `backend/.env`, then restart the backend:

```bash
# Ctrl+C in Terminal 1, then:
cd backend
uvicorn main:app --reload --port 8000
```

---

## 14. Git — Tagging Releases

### Tag a POC demo cut

```bash
# After all Phase 4 tests pass:
git tag -a v1.0.0-poc -m "POC complete — all 4 phases working end-to-end"
git push origin master --tags
```

### List all tags

```bash
git tag -l
```

### Check what commit a tag points to

```bash
git show v0.4.0-poc --stat
```

---

## 15. Render Architecture Diagrams

From the `docs/diagrams/` directory:

```bash
cd docs/diagrams

# Render all .mmd files to HD PNG (4K, dark background)
for f in *.mmd; do
  ./node_modules/.bin/mmdc -i "$f" -o "${f%.mmd}.png" -w 3840 -H 2160 -b "#000F64"
done
```

Output files: `*.png` next to each `.mmd` source.

---

## 16. Troubleshooting

### Backend won't start

**Symptom:** `uvicorn main:app` exits immediately or shows an error.

```bash
# Step 1 — check the error message in terminal
# Step 2 — verify .env exists
ls backend/.env

# Step 3 — verify Postgres is running
docker compose ps

# Step 4 — verify Postgres is reachable
docker compose exec postgres pg_isready -U thermynx -d thermynx_app

# Step 5 — run migrations
cd backend && alembic upgrade head
```

---

### Ollama not reachable

**Symptom:** `/api/v1/health` shows `"ollama": { "connected": false }`.

```bash
# Step 1 — check Tailscale
tailscale status
# Look for: 100.125.103.28 — it should show "active"

# Step 2 — ping the Ollama box
ping 100.125.103.28

# Step 3 — test Ollama directly
curl http://100.125.103.28:11434/api/tags

# Step 4 — if Ollama box is reachable but service is down,
# remote into it and check:
#   Windows: open Task Manager or Services
#   Linux:   sudo systemctl status ollama
```

---

### MySQL (Unicharm) not reachable

**Symptom:** `/api/v1/health` shows `"db": { "connected": false }`.

```bash
# Step 1 — check Tailscale (same as above)
tailscale status

# Step 2 — test MySQL connection directly
mysql -h <DB_HOST> -P 3307 -u <DB_USER> -p <DB_NAME>
# Enter password when prompted. If this works, .env has wrong values.

# Step 3 — check .env values
grep DB_ backend/.env
```

---

### `/analyze` hangs, no tokens streaming

**Symptom:** Spinner keeps spinning, no text appears.

```bash
# Step 1 — check if Ollama is loading the model (first call after idle is slow)
# Wait 30 seconds — model cold-start is normal.

# Step 2 — check Ollama logs on the Ollama box

# Step 3 — test Ollama directly
curl -X POST http://100.125.103.28:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5:14b","prompt":"Say hello","stream":false}'
# Expected: JSON with "response" field
```

---

### Frontend shows CORS error

**Symptom:** Browser console shows `Access-Control-Allow-Origin` error.

```bash
# Step 1 — check CORS_ORIGINS in .env
grep CORS_ORIGINS backend/.env

# Step 2 — make sure the frontend URL is in the list
# Example: CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Step 3 — restart backend after changing .env
```

---

### Anomaly scan not running

**Symptom:** Anomalies table stays empty after 10+ minutes.

```bash
# Step 1 — check backend logs for scheduler messages
docker compose logs api | grep -i "anomaly"
# Expected: "Anomaly scan scheduler started (every 5 min)"
# And every 5 min: "Anomaly scan complete — N new event(s)"

# Step 2 — check anomalies table directly
docker compose exec postgres psql -U thermynx -d thermynx_app \
  -c "SELECT COUNT(*) FROM anomalies;"
```

Note: if telemetry data has no statistical outliers (z-score < 3.0), zero anomalies is correct behavior.

---

### Postgres migration fails

**Symptom:** `alembic upgrade head` errors out.

```bash
# Step 1 — check current state
cd backend && alembic current

# Step 2 — for schema drift, wipe and re-migrate
docker compose down -v
docker compose up -d postgres
# Wait for healthy, then:
alembic upgrade head
```

---

### Out of disk space on Ollama box

```bash
# Check disk usage
df -h

# List model sizes
ollama list

# Remove unused models
ollama rm phi:latest
```

---

## 17. Something is on Fire

Run these in order. Stop when you find the problem.

```bash
# 1. What containers are running?
docker compose ps

# 2. Any recent errors in backend?
docker compose logs --tail=50 api

# 3. Is Tailscale up?
tailscale status

# 4. Is the backend responding at all?
curl http://localhost:8000/healthz

# 5. Full deep health check
curl http://localhost:8000/api/v1/health

# 6. Is Postgres OK?
docker compose exec postgres pg_isready -U thermynx -d thermynx_app

# 7. Is Redis OK?
docker compose exec redis redis-cli ping
# Expected: PONG

# 8. Last resort — full restart (wipes Postgres state, POC only)
docker compose down -v
docker compose up -d
cd backend && alembic upgrade head
uvicorn main:app --reload --port 8000
```

> If none of the above resolves it, check `docs/FLAWS_AND_IMPROVEMENT_PLAN.md` for known issues, or open a new issue in the repo with the output of steps 2 and 5.

---

## 18. Network & Port Reference

The platform relies on several services communicating over specific ports.

### ── Application Services ──────────────────────────────────────────────────

| Service | Port | Protocol | Scope | URL / Link | Description |
|---------|------|----------|-------|------------|-------------|
| **Frontend** | `5173` | HTTP | Local | [http://localhost:5173](http://localhost:5173) | Vite / React application |
| **Backend (API)** | `8000` | HTTP | Local | [http://localhost:8000](http://localhost:8000) | FastAPI / Uvicorn server |
| **Ollama API** | `11434` | HTTP | Remote | [http://100.125.103.28:11434](http://100.125.103.28:11434) | LLM Inference (Tailscale) |

### ── Core Infrastructure (Docker) ─────────────────────────────────────────────

| Service | Port | Protocol | Host Mapping | URL / Link | Description |
|---------|------|----------|--------------|------------|-------------|
| **PostgreSQL** | `5432` | TCP | `5432:5432` | `localhost:5432` | Application DB (PGVector) |
| **Redis** | `6379` | TCP | `6379:6379` | `localhost:6379` | Cache & Message Broker |
| **Redis Commander** | `8081` | HTTP | `8081:8081` | [http://localhost:8081](http://localhost:8081) | Redis GUI |
| **MySQL** | `3307` | TCP | Remote | `localhost:3307` | Unicharm source database |

### ── Observability Stack (Optional) ───────────────────────────────────────────

*Started via: `docker compose --profile obs up -d`*

| Service | Port | Protocol | Host Mapping | URL / Link | Description |
|---------|------|----------|--------------|------------|-------------|
| **Grafana** | `3000` | HTTP | `3000:3000` | [http://localhost:3000](http://localhost:3000) | Dashboards |
| **Prometheus** | `9090` | HTTP | `9090:9090` | [http://localhost:9090](http://localhost:9090) | Metrics Scraper |
| **Loki** | `3100` | HTTP | `3100:3100` | [http://localhost:3100](http://localhost:3100) | Log Aggregator |
| **Promtail** | `9080` | HTTP | Internal | [http://localhost:9080](http://localhost:9080) | Log Shipper |
| **Loki gRPC** | `9096` | gRPC | Internal | — | Loki internal comms |

> [!TIP]
> If a port is already in use, you can change it in `backend/.env` for the API, or in `docker-compose.yml` for infrastructure services. Remember to update the frontend's `proxy` settings in `vite.config.js` if the backend port changes.
