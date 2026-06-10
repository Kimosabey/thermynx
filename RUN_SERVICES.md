# THERMYNX — Run All Services

Exact commands to bring the full stack up locally (Windows / PowerShell).
Ports: **backend 8000**, **frontend 5173**, Postgres **5442**, Redis **6380**.

---

## 0. Prerequisites (must already be running / reachable)
- **Docker Desktop** running (provides Postgres + Redis + monitoring).
- **Python venv** at repo root: `.venv\` (deps installed).
- **Node modules** installed in `frontend\` (`npm install` once).
- **MySQL telemetry** (unicharm) reachable at `127.0.0.1:3307` — the read-only
  telemetry source (not started by compose; separate service).
- **Ollama** reachable at the host in `backend\.env` (`OLLAMA_HOST`, Tailscale).

> Config lives in `backend\.env` (DB creds, Ollama host, model routing). The
> backend MUST be started from the `backend\` folder so it loads that `.env`.

---

## 1. Docker services — Postgres (+pgvector), Redis, monitoring
From the repo root:
```powershell
docker compose up -d
# verify both healthy:
docker ps --format "{{.Names}}`t{{.Status}}" | Select-String "postgres|redis-1"
```

## 2. Backend (FastAPI, port 8000)
```powershell
cd backend
& "..\.venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
First boot runs Alembic migrations + starts the in-process job worker
(anomaly scan / digest / predictive crons). Leave this terminal open.

## 3. Frontend (Vite dev, port 5173)
In a second terminal, from the repo root:
```powershell
cd frontend
npm run dev
```

## 4. Open the app
**http://localhost:5173**  ·  API docs: **http://localhost:8000/docs**

---

## One-shot (start backend + frontend detached, no terminals to keep open)
From the repo root, in PowerShell:
```powershell
$root = $PWD
# backend (logs -> backend\.run_backend.log/.err)
Start-Process -FilePath "$root\.venv\Scripts\python.exe" `
  -ArgumentList "-m","uvicorn","main:app","--host","127.0.0.1","--port","8000","--log-level","info" `
  -WorkingDirectory "$root\backend" `
  -RedirectStandardOutput "$root\backend\.run_backend.log" `
  -RedirectStandardError  "$root\backend\.run_backend.err" -WindowStyle Hidden
# frontend (log -> frontend\.run_vite.log)
Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev > .run_vite.log 2>&1" `
  -WorkingDirectory "$root\frontend" -WindowStyle Hidden
```

---

## Verify everything is up
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health        # db + ollama status
Invoke-RestMethod http://127.0.0.1:8000/api/v1/models        # live model routing
Invoke-WebRequest http://localhost:5173/ -UseBasicParsing | Select StatusCode
```

## Stop
```powershell
# if started in terminals: Ctrl+C in each
# if detached:
Get-NetTCPConnection -LocalPort 8000 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 5173 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }
docker compose stop          # (or `docker compose down` to remove containers)
```

---

## Service / port reference
| Service | URL / port | Source |
|---|---|---|
| Frontend (UI) | http://localhost:5173 | `frontend` (Vite) |
| Backend API | http://localhost:8000 (`/docs`, `/healthz`) | `backend` (uvicorn) |
| Postgres + pgvector | localhost:**5442** | docker compose |
| Redis | localhost:**6380** (commander: 8181) | docker compose |
| Grafana / Prometheus / Loki | 3030 / 9292 / 3100 | docker compose |
| MySQL telemetry (unicharm) | 127.0.0.1:**3307** | external |
| Ollama LLMs | `OLLAMA_HOST` in `.env` | external (Tailscale) |

---

## Troubleshooting
- **All `/api/*` return 500 in the browser** → backend isn't up (or died). The
  Vite proxy targets `127.0.0.1:8000` (IPv4, on purpose). Restart step 2.
- **Backend exits immediately with `WinError 1225`** → Postgres wasn't ready.
  Wait for `docker ps` to show postgres **healthy**, then start the backend.
- **"Ollama returned an error during generate"** → the routed model is failing
  on the Ollama host. Check `GET /api/v1/models`; swap a model via `.env`
  (`OLLAMA_MODEL_*`) and restart. (phi4's runner is currently 500ing → text/RAG/
  auditor run on gemma3:27b via `.env`.)
- **Swap models for a demo** → edit the `OLLAMA_MODEL_*` lines in `backend\.env`,
  restart the backend. Toasts + `/models` + `/capabilities` update automatically.
- **Frontend 404 on a renamed module** → bounce Vite (step 3) to clear its cache.
