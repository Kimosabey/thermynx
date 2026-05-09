# THERMYNX Runbook (POC)

Common operational tasks. POC scope = single laptop + Ollama box + MySQL `unicharm` over Tailscale.

> For first-time setup see [`GETTING_STARTED.md`](./GETTING_STARTED.md).

## Stack lifecycle

```bash
# start everything
make dev                              # or: docker compose up -d && (cd frontend && npm run dev)

# stop everything
docker compose down

# stop AND wipe Postgres data (fresh start)
docker compose down -v

# rebuild after a Dockerfile change
docker compose up -d --build api

# rebuild after a frontend dep change
cd frontend && npm install && npm run dev
```

## Inspect logs

```bash
docker compose logs -f api            # backend, structured JSON
docker compose logs -f postgres       # DB
docker compose logs -f redis          # cache
```

Frontend logs are in the browser DevTools console + the `npm run dev` terminal.

## Reset databases

```bash
# Postgres (thermynx_app) — wipes everything we own
docker compose down -v && docker compose up -d postgres
docker compose exec api alembic upgrade head

# MySQL (unicharm) — DON'T. It is read-only and customer-owned.
```

## Re-pull / change LLM model

On the Ollama box:

```bash
ollama list                           # what's installed
ollama pull qwen2.5:14b               # add or refresh
ollama rm <model>                     # remove an unused one
```

On your laptop:

```bash
# .env
OLLAMA_DEFAULT_MODEL=qwen2.5:14b
```

```bash
docker compose restart api
```

## Inspect what was asked of the LLM

Every `/analyze` call writes to `analysis_audit`; every `/agent/investigate` writes to `agent_runs`.

```bash
docker compose exec postgres psql -U thermynx -d thermynx_app
```

```sql
-- Recent analyses
SELECT id, equipment_id, status, model, total_ms, created_at
FROM analysis_audit
ORDER BY created_at DESC
LIMIT 20;

-- Recent agent runs and their step counts
SELECT id, goal, status, steps_taken, total_ms, created_at
FROM agent_runs
ORDER BY created_at DESC
LIMIT 20;

-- Failures only
SELECT * FROM analysis_audit WHERE status != 'ok' ORDER BY created_at DESC;
```

## Common failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `/healthz` fails for Ollama | Tailscale down or Ollama box off | `tailscale status`; remote into the Ollama box and check the Ollama service |
| `/healthz` fails for MySQL | Wrong creds or firewall | re-check `UNICHARM_DB_URL` in `.env`; test with `mysql -h ... -u ro_user -p` |
| `/analyze` hangs at first token | Ollama still loading the model into VRAM | wait ~30 s after the first call; subsequent are fast |
| 502 on `/timeseries` | MySQL timeout (5 s default) | narrow the range, or raise `MYSQL_TIMEOUT_S` |
| Postgres migration fails | Schema drift between branches | `docker compose down -v` then `alembic upgrade head` |
| Frontend shows CORS error | Vite proxy mis-configured | check `frontend/vite.config.ts` proxy block |
| OOM on Ollama | tried to load `gpt-oss:120b` (65 GB > 20 GB VRAM + 32 GB RAM) | switch to `qwen2.5:14b` — the 120b model is unusable on this hardware |

## Tag a POC demo cut

```bash
# After Phase 1 demo works:
git tag -a v0.1.0-poc -m "POC Phase 1: Live AI Analyzer"
git push origin v0.1.0-poc

# Phases 2 / 3 / 4 follow the same pattern → v0.2 / v0.3 / v0.4
# Final POC tag: v1.0.0-poc once all four phases pass their demo gates
```

## Phase 4 — pull embedding model

Before starting Phase 4 (RAG), on the Ollama box:

```bash
ollama pull nomic-embed-text          # ~770 MB
```

Then run the manuals ingest script (TBD in Phase 4 build) to populate `embeddings` table.

## Render diagrams to HD images

See [`diagrams/README.md`](./diagrams/README.md). One-liner from `docs/diagrams/`:

```bash
for f in *.mmd; do
  ./node_modules/.bin/mmdc -i "$f" -o "${f%.mmd}.png" -w 3840 -H 2160 -b "#0f172a"
done
```

(`mermaid-cli` was already installed locally; the binary is at `docs/diagrams/node_modules/.bin/mmdc`.)

## When something is on fire

1. Check `docker compose ps` — anything unhealthy?
2. Check `docker compose logs -f api | tail -100` — most issues surface here
3. Check `tailscale status` — Ollama + MySQL reachable?
4. Last resort: `docker compose down -v && make dev` (wipes Postgres state — POC only)
