# THERMYNX -- End-to-End Testing & Verification Guide

Complete checklist for verifying THERMYNX works correctly.
Run top-to-bottom before tagging any release. Mark each item: OK / FAIL / SKIP.

---

## PART 1 -- Infrastructure Setup

### 1.1 Docker containers
```powershell
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```
Expected containers and images:

| Container | Image | Must be |
|-----------|-------|---------|
| `*-postgres-1` | `pgvector/pgvector:pg16` | healthy |
| `*-redis-1` | `redis:7-alpine` | healthy |

If Postgres is still `postgres:16-alpine`, run:
```powershell
docker compose down -v   # wipes volume -- OK for POC
docker compose up -d
```
Result: ___

### 1.2 pgvector extension enabled
```sql
-- docker compose exec postgres psql -U thermynx -d thermynx_app -c "SELECT extname, extversion FROM pg_extension;"
```
Expected: row with `extname=vector`
Result: ___

### 1.3 Postgres tables created
```sql
-- docker compose exec postgres psql -U thermynx -d thermynx_app -c "\dt"
```
Expected tables:
- [ ] `analysis_audit`
- [ ] `anomalies`
- [ ] `baselines`
- [ ] `agent_runs`
- [ ] `threads`
- [ ] `messages`
- [ ] `embeddings`

Result: ___

### 1.4 Column widths correct (UUID = 36 chars)
```sql
-- docker compose exec postgres psql -U thermynx -d thermynx_app \
--   -c "SELECT column_name, character_maximum_length FROM information_schema.columns WHERE table_name='analysis_audit' AND column_name='id';"
```
Expected: `character_maximum_length = 36`
Result: ___

### 1.5 Redis is reachable
```powershell
docker compose exec redis redis-cli ping
```
Expected: `PONG`
Result: ___

### 1.6 Backend starts cleanly
```powershell
cd backend
../.venv/Scripts/uvicorn main:app --reload --port 8000
```
Watch startup log for ALL of these lines:
- [ ] `pgvector_extension_ready` (or warning if still on alpine image)
- [ ] `postgres_metadata_ready`
- [ ] `Anomaly scan scheduler started (every 5 min)`
- [ ] `Application startup complete`

Result: ___

### 1.7 Frontend starts
```powershell
cd frontend && npm run dev
```
Open `http://localhost:5173` -- no blank screen, no console errors.
Result: ___

### 1.8 Tailscale / external services
```powershell
tailscale status
```
- [ ] MySQL `unicharm` host is listed and reachable
- [ ] Ollama server (`100.125.103.28`) is listed and reachable

Result: ___

---

## PART 2 -- Automated Test Suite

### 2.1 Full API test suite
```powershell
cd backend
python tests/test_all_apis.py --base http://localhost:8000
```
Expected: `49+ passed, 0-1 skipped (RAG skip if no docs), 0 failed`

Actual result: ___ passed / ___ failed / ___ skipped

### 2.2 Original smoke test
```powershell
python tests/smoke_test.py --base http://localhost:8000
```
Expected: `10 passed, 0 failed`

Actual result: ___ passed / ___ failed

---

## PART 3 -- Database Verification

### 3.1 MySQL (unicharm) -- source data check
```sql
-- Connect: mysql -h <tailscale-ip> -P 3307 -u ro_user -p unicharm

-- Check normalized tables exist and have data
SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'unicharm'
  AND TABLE_NAME LIKE '%_normalized'
ORDER BY TABLE_NAME;
```
Expected: at least 6 normalized tables with row counts > 0

Result: ___

```sql
-- Check latest data in each chiller table
SELECT 'chiller_1' AS eq, MAX(slot_time) AS latest FROM chiller_1_normalized
UNION ALL
SELECT 'chiller_2', MAX(slot_time) FROM chiller_2_normalized
UNION ALL
SELECT 'cooling_tower_1', MAX(slot_time) FROM cooling_tower_1_normalized;
```
Expected: `latest` dates are consistent (all roughly the same date).
Note the date -- this is your `TELEMETRY_TIME_ANCHOR` window end.

Actual latest date: ___

```sql
-- Verify read-only access (this should FAIL with permission error)
INSERT INTO chiller_1_normalized (slot_time) VALUES (NOW());
```
Expected: `ERROR 1142: INSERT command denied` (confirms read-only user)
Result: ___

### 3.2 MySQL -- data quality checks
```sql
-- Check for null kW/TR values (equipment running but no efficiency reading)
SELECT COUNT(*) AS total,
       SUM(CASE WHEN is_running=1 AND kw_per_tr IS NULL THEN 1 ELSE 0 END) AS running_no_kwtr
FROM chiller_1_normalized
WHERE slot_time >= DATE_SUB(MAX(slot_time) OVER(), INTERVAL 24 HOUR);
```
Note: some nulls are expected during off-peak or standby periods.
Result: ___

```sql
-- kW/TR distribution -- sanity check
SELECT
  MIN(kw_per_tr) AS min_kwtr,
  AVG(kw_per_tr) AS avg_kwtr,
  MAX(kw_per_tr) AS max_kwtr,
  COUNT(*) AS rows
FROM chiller_1_normalized
WHERE is_running = 1
  AND slot_time >= (SELECT DATE_SUB(MAX(slot_time), INTERVAL 7 DAY) FROM chiller_1_normalized);
```
Expected: avg_kwtr between 0.4 and 2.0 (realistic HVAC range)
Result: ___

### 3.3 Postgres (thermynx_app) -- schema verification
```sql
-- docker compose exec postgres psql -U thermynx -d thermynx_app

-- Check all column types are correct
SELECT table_name, column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'id'
ORDER BY table_name;
```
Expected: all `id` columns have `character_maximum_length = 36` or `data_type = uuid`
Result: ___

```sql
-- Check analysis_audit rows after running some analyses
SELECT id, equipment_id, status, model, total_ms, created_at
FROM analysis_audit
ORDER BY created_at DESC
LIMIT 5;
```
Expected: rows with `status = 'ok'` after successful analyses
Result: ___

```sql
-- Check agent_runs after running agents
SELECT id, mode, steps_taken, status, total_ms
FROM agent_runs
ORDER BY created_at DESC
LIMIT 5;
```
Result: ___

```sql
-- Check anomalies table (populated by background job every 5 min)
SELECT equipment_id, metric, severity, z_score, created_at
FROM anomalies
ORDER BY created_at DESC
LIMIT 10;
```
Note: table may be empty if no anomalies detected in the data window.
Result: ___

```sql
-- Check embeddings table
SELECT source_id, COUNT(*) AS chunks, MAX(created_at) AS last_ingested
FROM embeddings
GROUP BY source_id;
```
Expected: empty if no docs ingested; populated after running ingest_docs.py
Result: ___

```sql
-- Check pgvector index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'embeddings'
  AND indexname = 'idx_embeddings_vec';
```
Expected: one row with `ivfflat` in the index definition
Result: ___

### 3.4 Redis -- cache state
```powershell
docker compose exec redis redis-cli INFO keyspace
```
Expected: shows `db0` with some keys after frontend has made requests
Result: ___

```powershell
# Check key count
docker compose exec redis redis-cli DBSIZE
```
Result: ___

---

## PART 4 -- API Endpoint Verification

For each endpoint below, test with curl or browser (GET) / Postman (POST).

### 4.1 Core
| Endpoint | Method | Expected | Result |
|----------|--------|----------|--------|
| `/healthz` | GET | `{"status":"ok"}` | ___ |
| `/api/v1/health` | GET | `status=ok`, `db.connected=true`, `ollama.connected=true` | ___ |
| `/api/v1/equipment` | GET | Array of 6 equipment | ___ |
| `/api/v1/equipment/summary?hours=24` | GET | Summary with kW/TR per chiller | ___ |

### 4.2 Timeseries (all resolutions)
| Endpoint | Expected | Result |
|----------|----------|--------|
| `/api/v1/equipment/chiller_1/timeseries?hours=24&resolution=15m` | 97 pts, window from DB latest | ___ |
| `/api/v1/equipment/chiller_1/timeseries?hours=24&resolution=5m` | ~289 pts | ___ |
| `/api/v1/equipment/chiller_1/timeseries?hours=24&resolution=1h` | ~25 pts | ___ |
| `/api/v1/equipment/chiller_2/timeseries?hours=24&resolution=15m` | 97 pts | ___ |
| `/api/v1/equipment/cooling_tower_1/timeseries?hours=24&resolution=15m` | data returned | ___ |
| `/api/v1/equipment/condenser_pump_1/timeseries?hours=24&resolution=15m` | data returned | ___ |

### 4.3 Intelligence modules
| Endpoint | Expected | Result |
|----------|----------|--------|
| `/api/v1/efficiency?hours=24` | 2 chillers, band + drivers | ___ |
| `/api/v1/efficiency/chiller_1?hours=24` | band, kw_per_tr_avg, delta_pct | ___ |
| `/api/v1/anomalies/live?hours=1` | anomalies array (may be empty) | ___ |
| `/api/v1/anomalies/history?limit=10` | persisted anomalies | ___ |
| `/api/v1/forecast/chiller_1?metric=kw_per_tr&horizon=24` | 24 forecast points with CI | ___ |
| `/api/v1/compare?a=chiller_1&b=chiller_2&hours=24` | both summaries, efficiency, timeseries | ___ |

### 4.4 Advanced features (POST with body)
```bash
# Analyze (SSE -- use curl -N)
curl -N -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"question":"What is kW/TR?","equipment_id":"chiller_1","hours":24}'
```
Expected: `data: {"type":"token",...}` lines stream in, ends with `data: {"type":"done",...}`
Result: ___

```bash
# Report
curl -N -X POST http://localhost:8000/api/v1/reports/daily \
  -H "Content-Type: application/json" \
  -d '{"hours":24}'
```
Result: ___

```bash
# Agent run
curl -N -X POST http://localhost:8000/api/v1/agent/run \
  -H "Content-Type: application/json" \
  -d '{"mode":"brief","goal":"One sentence plant status."}'
```
Result: ___

### 4.5 Phase 3 features
| Endpoint | Expected | Result |
|----------|----------|--------|
| `/api/v1/maintenance?hours=168` | 6 assets with score + grade | ___ |
| `/api/v1/cost?hours=24` | total_kwh, total_inr, equipment breakdown | ___ |
| `/api/v1/cooling-tower/cooling_tower_1/optimize?hours=24` | staging_hint present | ___ |
| `POST /api/v1/threads` | `{"id":"...","title":null}` | ___ |
| `GET /api/v1/threads` | threads array | ___ |
| `GET /api/v1/agent/history` | runs array | ___ |

### 4.6 RAG endpoints
| Endpoint | Expected | Result |
|----------|----------|--------|
| `/api/v1/rag/status` | `{"ready":false,"total_chunks":0}` (empty) or ready if ingested | ___ |
| `/api/v1/rag/search?q=maintenance` | results if corpus populated | ___ |

---

## PART 5 -- Frontend Page Checks

Open each page in browser. Mark OK if page loads without errors.

| Page | URL | Check | Result |
|------|-----|-------|--------|
| Dashboard | `/dashboard` | KPI cards animate in, equipment cards show RUNNING/STANDBY, DB+Ollama status green | ___ |
| AI Analyzer | `/analyzer` | Equipment dropdown populated, chart renders on selection, streaming works | ___ |
| Efficiency | `/efficiency` | 2 chiller cards with band bars + colour coding | ___ |
| Anomalies | `/anomalies` | Scan-now button works, counter chips show counts | ___ |
| Forecast | `/forecast` | Purple gradient CI band chart renders | ___ |
| Compare | `/compare` | Two-line overlay chart + stat table | ___ |
| Maintenance | `/maintenance` | Health score gauges per equipment | ___ |
| Cost | `/cost` | Total kWh + bar chart breakdown | ___ |
| Reports | `/reports` | Generate button streams LLM summary, Download saves .md | ___ |
| AI Agents | `/agent` | 5 mode cards, run produces trace + streaming report | ___ |
| Knowledge | `/rag` | Status card shows corpus state | ___ |

### Frontend console checks
Open DevTools Console (F12). After loading each page:
- [ ] No `motion()` deprecation warnings
- [ ] No `fontVariantNumeric` DOM prop warnings
- [ ] No 500 errors in Network tab
- [ ] No CORS errors

Result: ___

---

## PART 6 -- Ollama / LLM Verification

### 6.1 Model list
```powershell
# On Ollama server (via SSH/RDP) or via API:
curl http://100.125.103.28:11434/api/tags | python -m json.tool
```
Expected models: `qwen2.5:14b`, `nomic-embed-text:latest`, `phi:latest`
Result: ___

### 6.2 Default model set correctly
```bash
curl http://localhost:8000/api/v1/health | python -m json.tool
```
Expected: `"default_model": "qwen2.5:14b"`
Result: ___

### 6.3 qwen2.5:14b fits in VRAM
On the Ollama server, check VRAM usage while a model is running:
```
nvidia-smi
```
Expected: qwen2.5:14b uses ~9 GB of the 20 GB available.
Result: ___

### 6.4 nomic-embed-text for RAG
```bash
curl -X POST http://100.125.103.28:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text","prompt":"test"}'
```
Expected: JSON with `"embedding": [...]` array of 768 floats
Result: ___

---

## PART 7 -- RAG Setup (if using)

### 7.1 Ingest documents
```powershell
# Place PDF/TXT/MD files in docs/manuals/ first
cd backend
python scripts/ingest_docs.py --dir ../docs/manuals
```
Expected output:
```
Processing: <filename>
  chunks: N x ~400 words
  embedding via nomic-embed-text... done (N vectors stored)
Ingestion complete -- N chunks across 1 file(s)
```
Result: ___

### 7.2 Verify embeddings in Postgres
```sql
SELECT source_id, COUNT(*) AS chunks
FROM embeddings
GROUP BY source_id;
```
Expected: rows with chunk counts matching ingested files
Result: ___

### 7.3 Test semantic search
```bash
curl "http://localhost:8000/api/v1/rag/search?q=maintenance+interval&top_k=3"
```
Expected: `{"total":N,"results":[...]}` with relevance scores
Result: ___

### 7.4 RAG in AI Analyzer
1. Go to `/analyzer`
2. Select Chiller 1, 24h window
3. Ask: "What does the manual say about condenser cleaning intervals?"
4. Check: response includes `[source: filename §N]` citations

Result: ___

---

## PART 8 -- Performance Spot Checks

Measure with browser DevTools Network tab or curl with timing.

| Endpoint | Target p95 | Measured | Pass? |
|----------|-----------|---------|-------|
| `GET /api/v1/equipment` | < 200 ms | ___ ms | ___ |
| `GET /api/v1/equipment/summary?hours=24` | < 1 s | ___ ms | ___ |
| `GET /timeseries?hours=24&resolution=15m` | < 800 ms | ___ ms | ___ |
| `POST /analyze` -- first token | < 3 s | ___ s | ___ |
| `POST /analyze` -- full response | < 8 s | ___ s | ___ |
| `POST /agent/run` -- first tool result | < 5 s | ___ s | ___ |
| Frontend Dashboard FCP | < 2 s | ___ s | ___ |

---

## PART 9 -- Background Job Verification

### 9.1 Anomaly scan runs automatically
Wait 5-10 minutes after starting the backend, then:
```sql
-- Check if anomaly scan has run
SELECT COUNT(*) FROM anomalies;

-- Check APScheduler logged the job
-- Look in uvicorn terminal for: "Anomaly scan complete -- N new event(s)"
```
Result: ___

### 9.2 Verify anomaly scan covers all equipment
```bash
curl "http://localhost:8000/api/v1/anomalies/history?limit=20"
```
Check that `equipment_id` values cover multiple pieces of equipment (not just one).
Result: ___

---

## PART 10 -- Error Handling Verification

These should return proper error responses (not 500):

| Test | Expected response |
|------|------------------|
| `GET /api/v1/equipment/unknown_eq/timeseries` | `404 {"detail":"Unknown equipment: unknown_eq"}` |
| `GET /api/v1/efficiency/cooling_tower_1` | `400 {"detail":"...not a chiller..."}` |
| `GET /api/v1/compare?a=chiller_1&b=chiller_99` | `404 {"detail":"Unknown equipment: chiller_99"}` |
| `POST /api/v1/agent/run` with `mode=invalid` | `200 SSE {"type":"error","detail":"Unknown mode..."}` |
| `GET /api/v1/analyze` (GET not POST) | `405 {"detail":"Method Not Allowed"}` |

Result: ___

---

## PART 11 -- Data Integrity Checks

### 11.1 Analysis audit trail
After running 2-3 analyses:
```sql
SELECT id, equipment_id, status, model, total_ms, created_at
FROM analysis_audit
ORDER BY created_at DESC
LIMIT 5;
```
- [ ] `status = 'ok'` for completed analyses
- [ ] `total_ms` is populated (not null)
- [ ] `model = 'qwen2.5:14b'`
- [ ] `id` is 36 chars (UUID format)

Result: ___

### 11.2 Thread/message persistence
1. Go to `/analyzer`, create a new thread
2. Send a question, wait for response
3. Send a follow-up question that references the first

```sql
SELECT t.id, t.title, COUNT(m.id) AS msg_count
FROM threads t
LEFT JOIN messages m ON m.thread_id = t.id
GROUP BY t.id, t.title
ORDER BY t.created_at DESC
LIMIT 5;
```
Expected: thread with 2 messages (user Q + assistant A)
Result: ___

### 11.3 No writes to unicharm MySQL
```sql
-- Verify THERMYNX never wrote to the source DB
-- On unicharm MySQL:
SHOW BINARY LOGS;
-- Check for any THERMYNX-sourced writes (should be none)
```
Expected: no writes from the THERMYNX user (we use read-only credentials)
Result: ___

---

## PART 12 -- Known Limitations (POC)

These are expected behaviours -- not bugs:

| Item | Status | Notes |
|------|--------|-------|
| No authentication | Expected | JWT added in Phase 5 |
| pgvector needs `pgvector/pgvector:pg16` image | Expected | `docker compose down -v && docker compose up -d` |
| `gpt-oss:120b` unusable | Expected | 65 GB > VRAM+RAM. Use `qwen2.5:14b`. |
| 0 anomalies if all readings are normal | Expected | z-score > 3 threshold means truly anomalous data |
| Forecast shows 14 points not 24 | Expected | Based on actual data coverage in 7d history; gap periods produce no points |
| "Last 24h" uses DB latest, not wall clock | Expected | `TELEMETRY_TIME_ANCHOR=latest_in_db` in `.env` |
| Reports stream empty if Postgres has issues | Expected | Fix: check `analysis_audit.id` VARCHAR(36) |
| RAG skipped if no docs ingested | Expected | Run `scripts/ingest_docs.py` |
| `gpt-oss:120b` shows in model list | Expected | Just don't set it as default model |

---

## PART 13 -- Sign-off

### Quick checklist summary

**Infrastructure:**
- [ ] Postgres running `pgvector/pgvector:pg16`
- [ ] pgvector extension enabled
- [ ] All 7 tables created with correct column widths
- [ ] Redis healthy
- [ ] Backend starts without errors
- [ ] Frontend loads without console errors

**Data:**
- [ ] MySQL normalized tables have data
- [ ] `TELEMETRY_TIME_ANCHOR=latest_in_db` in `.env`
- [ ] Timeseries returns data (not 0 rows)

**APIs -- Phase 1:**
- [ ] Health, Equipment, Summary, Timeseries all 200
- [ ] POST /analyze streams SSE tokens + done frame

**APIs -- Phase 2:**
- [ ] Efficiency bands correct
- [ ] Anomaly scan works
- [ ] Forecast returns points
- [ ] Compare returns both equipment

**APIs -- Phase 3:**
- [ ] Maintenance scores returned
- [ ] Cost analytics returned
- [ ] POST /analyze writes `status=ok` to `analysis_audit`
- [ ] Agent runs complete with steps > 1

**RAG (if docs ingested):**
- [ ] Embeddings table populated
- [ ] /rag/search returns ranked results
- [ ] /analyze responses include `[source: ...]` citations

**Run full test suite and record result:**
```
python tests/test_all_apis.py --base http://localhost:8000
```
Result: ___ passed / ___ failed / ___ skipped

**Tester:** ___________________________
**Date:** ___________________________
**Git commit:** `git rev-parse --short HEAD` => ___________________________
**Overall:** [ ] PASS -- ready for `v1.0.0-poc` tag  [ ] FAIL -- see issues above
