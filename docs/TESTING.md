# THERMYNX — End-to-End Testing Checklist

Manual test protocol for all POC features. Run top-to-bottom before tagging a release.
Each section has a **pass criteria** — mark ✅ pass / ❌ fail / ⚠️ partial.

> **Prerequisites:** `docker compose up -d` (Postgres + Redis) · `uvicorn` backend ·
> `npm run dev` frontend · Tailscale active (MySQL + Ollama reachable).

---

## 0. Stack Health

### 0.1 Backend liveness
```
GET http://localhost:8000/healthz
```
Expected: `{"status": "ok"}`  
Result: ___

### 0.2 Full health check
```
GET http://localhost:8000/api/v1/health
```
Expected fields:
- `status`: `"ok"` (not `"degraded"`)
- `db.connected`: `true`
- `ollama.connected`: `true`
- `ollama.default_model`: `"qwen2.5:14b"`

Result: ___

### 0.3 Frontend loads
Open `http://localhost:5173`  
Expected: Dashboard loads, no console errors, DB + Ollama status dots are green  
Result: ___

### 0.4 Postgres tables created
```sql
-- docker compose exec postgres psql -U thermynx -d thermynx_app -c "\dt"
```
Expected tables: `analysis_audit`, `anomalies`, `baselines`, `agent_runs`,
`threads`, `messages`, `embeddings`  
Result: ___

---

## 1. Dashboard (`/dashboard`)

### 1.1 KPI cards load
Expected: 6 animated KPI cards — CH1 kW/TR, CH2 kW/TR, CH1 Load%, CH2 Load%, Ambient °C, CHW Supply °C  
Result: ___

### 1.2 Equipment cards load
Expected: 6 equipment panels — Chiller 1, Chiller 2, Cooling Tower 1, Cooling Tower 2, Condenser Pump 1-2, Condenser Pump 3  
Result: ___

### 1.3 Running status
Expected: `RUNNING` badge (green pulsing dot) on active equipment, `STANDBY` on offline  
Result: ___

### 1.4 Refresh works
Click Refresh button → cards reload without page refresh  
Result: ___

### 1.5 kW/TR colour coding
Expected: green if < 0.65, yellow if 0.65–0.85, red if > 0.85  
Result: ___

---

## 2. AI Analyzer (`/analyzer`)

### 2.1 Equipment selector populates
Expected: dropdown shows all 6 equipment grouped by type (Chillers / Cooling Towers / Pumps)  
Result: ___

### 2.2 Timeseries chart renders
1. Select **Chiller 1**
2. Time window: **Last 24 hours**

Expected: Recharts chart appears with kW/TR area (gradient fill) + kW bars + efficiency reference lines at 0.65 and 0.85  
Result: ___

### 2.3 SSE streaming — basic
1. Type: _"What is the current kW/TR efficiency of Chiller 1?"_
2. Click **Analyze**

Expected:
- ThinkingDots appear immediately
- First tokens appear within **≤ 3 seconds**
- Markdown streams token-by-token
- `done` frame received within **≤ 8 seconds**
- Model badge + response time shown in header

Result: ___ | First token: ___s | Total: ___s

### 2.4 Quick prompt works
Click any quick-prompt chip → text fills the textarea  
Result: ___

### 2.5 Stop button works
1. Start an analysis
2. Click **Stop** while streaming

Expected: stream stops, no further tokens, backend audit row shows `status=cancelled`  
Result: ___

### 2.6 Audit row created
After any analysis:
```sql
SELECT id, equipment_id, status, model, total_ms FROM analysis_audit ORDER BY created_at DESC LIMIT 1;
```
Expected: row exists with `status=ok`  
Result: ___

### 2.7 Ctrl+Enter shortcut
Focus textarea → press Ctrl+Enter → analysis starts  
Result: ___

---

## 3. Efficiency Benchmarker (`/efficiency`)

### 3.1 Page loads with both chillers
Expected: 2 efficiency cards — Chiller 1 and Chiller 2  
Result: ___

### 3.2 Band classification correct
Expected: each card shows one of: Excellent / Good / Fair / Poor / Critical  
Verify colour matches: green/cyan/yellow/orange/red  
Result: ___

### 3.3 Animated band bar
Expected: white marker animates to the correct position on the colour bar (0.55→1.10 scale)  
Result: ___

### 3.4 Stats grid populated
Expected (per card): Best kW/TR, Worst kW/TR, Avg Load %, CHW ΔT, Run %, Samples  
Result: ___

### 3.5 Loss drivers shown (if inefficient)
If band is Fair/Poor/Critical, expected: red "Loss Drivers" box with specific reasons  
(e.g. "Low CHW ΔT (4.1°C < 5.0°C)")  
Result: ___

### 3.6 Time window selector works
Change to **Last 7 days** → cards reload with new data  
Result: ___

### 3.7 API directly
```
GET http://localhost:8000/api/v1/efficiency/chiller_1?hours=24
```
Expected: JSON with `band`, `kw_per_tr_avg`, `delta_pct`, `loss_drivers[]`  
Result: ___

---

## 4. Anomaly Detector (`/anomalies`)

### 4.1 Summary chips appear
Expected: Critical count + Warning count + Total count chips at top  
Result: ___

### 4.2 Scan now works
Click **Scan now** → results refresh, "last scanned" timestamp updates  
Result: ___

### 4.3 Anomaly cards (if any)
If anomalies found, expected per card:
- Equipment name + metric
- z-score pill (e.g. `+3.7σ`)
- CRITICAL / WARNING badge
- Value, Baseline, Std Dev shown
- Description text

Result: ___

### 4.4 Empty state
If no anomalies: green check mark + "No anomalies detected" message  
Result: ___

### 4.5 Live scan API
```
GET http://localhost:8000/api/v1/anomalies/live?hours=1
```
Expected: `{"anomalies": [...], "total": N, "hours": 1}`  
Result: ___

### 4.6 APScheduler job runs
Check backend logs after 5 minutes:
```
Anomaly scan complete — N new event(s) persisted
```
Result: ___

---

## 5. Energy Forecaster (`/forecast`)

### 5.1 Forecast chart renders
1. Select **Chiller 1**
2. Metric: **kw_per_tr**
3. Horizon: **Next 24h**

Expected: purple line (predicted) + shaded CI band (±1σ) + green/red reference lines  
Result: ___

### 5.2 Summary KPIs populated
Expected: Avg Predicted, Min Predicted, Max Predicted, High Confidence hours  
Result: ___

### 5.3 Metric selector
Switch to **kw** → chart updates with kW forecast (no reference lines)  
Result: ___

### 5.4 Equipment selector
Switch to **Cooling Tower 1** → only `kw` metric available (not kw_per_tr)  
Result: ___

### 5.5 API response
```
GET http://localhost:8000/api/v1/forecast/chiller_1?metric=kw_per_tr&horizon=24&history_days=7
```
Expected: `{points: [{hour_label, predicted, lower, upper, confidence}], note: "..."}`  
Result: ___

---

## 6. Comparison View (`/compare`)

### 6.1 Default loads Chiller 1 vs Chiller 2
Expected: overlay chart with two lines (cyan = CH1, purple = CH2)  
Result: ___

### 6.2 Winner banner
Expected: "🏆 Chiller X is performing better (kW/TR: X.XXX vs Y.YYY — delta Z.ZZZ kW/TR)"  
Result: ___

### 6.3 Overlay chart
Expected: both kW/TR lines on same chart with synced x-axis + green/red reference lines  
Result: ___

### 6.4 Side-by-side stat table
Expected rows: kW/TR avg, kW avg, TR avg, Load %, CHW ΔT, Run %, Eff band, Δ vs design  
Better value per row highlighted in green  
Result: ___

### 6.5 Equipment selector changes
Change equipment B → chart and table update  
Result: ___

### 6.6 API
```
GET http://localhost:8000/api/v1/compare?a=chiller_1&b=chiller_2&hours=24
```
Expected: `{a: {summary, efficiency, timeseries}, b: {summary, efficiency, timeseries}}`  
Result: ___

---

## 7. Predictive Maintenance (`/maintenance`)

### 7.1 Page loads with all equipment
Expected: health score cards for all 6 equipment, sorted by urgency (lowest score first)  
Result: ___

### 7.2 Health score gauges
Expected: SVG radial arc per equipment, colour-coded (green >75, yellow 50–75, red <50)  
Result: ___

### 7.3 Grade badge
Expected: Excellent / Good / Fair / Poor / Critical per equipment  
Result: ___

### 7.4 Priority flags
Expected (if degraded): flags like `high_anomalies`, `degradation_trend`, `low_running`  
Result: ___

### 7.5 API
```
GET http://localhost:8000/api/v1/maintenance?hours=168
```
Expected: `{assets: [{id, name, score, grade, flags, recommendations}]}`  
Result: ___

---

## 8. Cost Analytics (`/cost`)

### 8.1 Plant total KPI
Expected: animated counter showing total kWh + total ₹ for selected window  
Result: ___

### 8.2 Equipment breakdown bar chart
Expected: horizontal bar chart with each equipment's kWh + ₹ + % of plant  
Result: ___

### 8.3 Tariff display
Expected: "₹8.5/kWh" (or configured TARIFF_INR_PER_KWH) shown  
Result: ___

### 8.4 Time window
Change to **Last 7 days** → totals update  
Result: ___

### 8.5 API
```
GET http://localhost:8000/api/v1/cost?hours=24
```
Expected: `{total_kwh, total_inr, rs_per_tr_hr, equipment: [...]}`  
Result: ___

---

## 9. Report Builder (`/reports`)

### 9.1 KPI table populates
Expected: table with equipment-level kW/TR + cost data for selected period  
Result: ___

### 9.2 LLM exec summary streams
Click **Generate Report** → ThinkingDots → markdown streams in:  
Expected 3 sections: **What happened** / **What it cost** / **What to act on**  
Result: ___ | Latency: ___s

### 9.3 Download button
Click **Download** → browser saves a `.md` file with full report content  
Result: ___

### 9.4 API
```
POST http://localhost:8000/api/v1/reports/daily
Body: {"hours": 24}
```
Expected: SSE stream with KPI block + LLM summary  
Result: ___

---

## 10. Conversational Memory (via AI Analyzer)

### 10.1 New thread creation
In AI Analyzer: click **New Thread** → toast "New conversation started"  
Result: ___

### 10.2 Thread appears in list
Expected: sidebar/dropdown shows the new thread with auto-generated title  
Result: ___

### 10.3 Message persists
1. Ask "What is Chiller 1 efficiency?" → wait for response
2. Ask follow-up: "Why is it at that level?"

Expected: LLM references the previous Q&A in its answer (conversation aware)  
Result: ___

### 10.4 Thread messages API
```
GET http://localhost:8000/api/v1/threads
GET http://localhost:8000/api/v1/threads/{id}/messages
```
Expected: threads list + messages with role + content  
Result: ___

### 10.5 Thread title auto-set
Expected: thread title = first question (truncated to 200 chars)  
Result: ___

---

## 11. Cooling Tower Optimizer

### 11.1 API
```
GET http://localhost:8000/api/v1/cooling-tower/cooling_tower_1/optimize?hours=24
```
Expected: `{staging_hint, current_duty_pct, recommended_cells, estimated_saving_kwh}`  
Result: ___

---

## 12. AI Agents (`/agent`)

### 12.1 Hub loads with 5 mode cards
Expected: Investigator, Optimizer, Daily Brief, Root Cause, Maintenance — each with colour, tagline, presets  
Result: ___

### 12.2 Mode card selection animates
Click a mode → top accent bar animates in, panel below transitions  
Result: ___

### 12.3 Preset chips fill textarea
Click any preset → textarea fills  
Result: ___

### 12.4 Investigator — full run
1. Select **Investigator**
2. Equipment: **Chiller 1**, Window: **24h**
3. Click preset: "Investigate Chiller 1 efficiency — why is it underperforming?"
4. Click **Run Investigator**

Expected:
- Left pane: live trace — `tool_call` cards appear (⚡ Efficiency Calc, 🔍 Anomaly Scan, etc.)
- Each tool card expandable (shows args/result as JSON)
- Right pane: markdown streams in when agent finishes tool loop
- Header shows: model + step count + total time

Result: ___ | Steps: ___ | Time: ___s

### 12.5 Tool calls are logged
```sql
SELECT id, mode, steps_taken, status, total_ms FROM agent_runs ORDER BY created_at DESC LIMIT 1;
```
Expected: row with `status=ok`, steps ≥ 2  
Result: ___

### 12.6 Optimizer mode
1. Select **Optimizer**
2. Preset: "How can I reduce total kWh consumption this shift?"
3. Run

Expected: structured markdown with Current State / Optimization Opportunities / Expected Savings  
Result: ___

### 12.7 Daily Brief mode
1. Select **Daily Brief**
2. No equipment needed — just click preset "Generate a complete plant status briefing"
3. Run

Expected: covers all equipment, top 3 action items  
Result: ___

### 12.8 Stop mid-run
Start any agent → click **Stop** → trace freezes, `cancelled` logged  
Result: ___

### 12.9 Agent history API
```
GET http://localhost:8000/api/v1/agent/history?limit=5
```
Expected: last 5 runs with mode, steps, status, total_ms  
Result: ___

---

## 13. Knowledge Base / RAG (`/rag`)

### 13.1 Page loads with corpus status
Expected:
- If no docs ingested: yellow "No documents ingested" banner + ingestion instructions
- If docs ingested: source cards with chunk counts + last-ingested timestamp

Result: ___

### 13.2 Ingestion (requires manual doc placement)
```bash
# Place any PDF/TXT/MD in docs/manuals/ then:
cd backend
python scripts/ingest_docs.py --dir ../docs/manuals
```
Expected output:
```
Processing: <filename>
  chunks: N × ~400 words
  embedding via nomic-embed-text... done (N vectors stored)
Ingestion complete — N chunks across 1 file(s)
```
Result: ___

### 13.3 Corpus status after ingestion
```
GET http://localhost:8000/api/v1/rag/status
```
Expected: `{ready: true, total_chunks: N, sources: [...]}`  
Result: ___

### 13.4 Semantic search
1. Type: "maintenance interval condenser"
2. Click **Search**

Expected: ranked results with % match scores, source filenames, expandable content  
Result: ___

### 13.5 RAG in Analyzer (after ingestion)
1. Go to AI Analyzer
2. Ask: "What does the manual say about condenser tube cleaning intervals?"

Expected: answer includes `[source: filename §N]` citations  
Result: ___

### 13.6 RAG in Agent (retrieve_manual tool)
In Investigator mode, goal: "Check manual for chiller maintenance specs"  
Expected: agent calls `📜 retrieve_manual` tool in trace  
Result: ___

---

## 14. Sidebar Navigation

### 14.1 All routes accessible
Click each sidebar item and confirm page loads:
- [ ] Dashboard `/dashboard`
- [ ] AI Analyzer `/analyzer`
- [ ] Efficiency `/efficiency`
- [ ] Anomalies `/anomalies`
- [ ] Forecast `/forecast`
- [ ] Compare `/compare`
- [ ] Maintenance `/maintenance`
- [ ] Cost `/cost`
- [ ] Reports `/reports`
- [ ] AI Agents `/agent`
- [ ] Knowledge `/rag`

Result: ___

### 14.2 Desktop collapse
Click chevron → sidebar collapses to 64px icon-only with spring animation  
Click again → expands back  
Result: ___

### 14.3 Mobile drawer
Resize browser to < 1536px → sidebar disappears, hamburger appears in top bar  
Click hamburger → drawer slides in with overlay  
Click overlay → drawer closes  
Result: ___

### 14.4 Active route highlight
Navigate to any page → that sidebar item has cyan left accent + subtle background  
Result: ___

---

## 15. Automated Smoke Test

```bash
cd backend
python tests/smoke_test.py
```

Expected output summary:
```
Results: 10 passed, 0 failed / 10 total
All checks passed.
```

Copy actual result here:
```
Results: ___ passed, ___ failed / ___ total
```

---

## 16. Performance Spot Checks

| Endpoint | Target p95 | Measured |
|----------|-----------|---------|
| `GET /api/v1/equipment` | < 150 ms | ___ ms |
| `GET /api/v1/equipment/summary` | < 600 ms | ___ ms |
| `GET /api/v1/equipment/chiller_1/timeseries?hours=24` | < 600 ms | ___ ms |
| `POST /api/v1/analyze` — first token | < 3 s | ___ s |
| `POST /api/v1/analyze` — full (24h) | < 8 s | ___ s |
| `POST /api/v1/agent/run` — first tool result | < 5 s | ___ s |
| Frontend initial load (FCP) | < 1.5 s | ___ s |

---

## 17. Known Limitations (POC)

These are expected — not bugs:

| Limitation | Notes |
|------------|-------|
| No auth | All endpoints are open. Phase 5 hardening adds JWT. |
| pgvector requires restart if not enabled at boot | Run `docker compose down -v && docker compose up -d` after switching to `pgvector/pgvector:pg16` image |
| `gpt-oss:120b` not runnable | 65 GB > 20 GB VRAM + 32 GB RAM. Ignore. |
| Anomaly baseline needs 72h+ of data | If data < 72h, baseline quality is reduced |
| Forecast needs 7-day history | Returns fewer points for equipment with limited historical data |
| RAG requires manual ingestion | Drop files in `docs/manuals/` and run `scripts/ingest_docs.py` |
| PDF extraction requires `pip install pypdf` | TXT/MD works out of the box |
| Reports use flat tariff | TOU tariff support is post-POC |

---

## Sign-off

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 0 | Foundation | ☐ |
| Phase 1 | AI Analyzer + streaming | ☐ |
| Phase 2 | Efficiency + Anomalies + Forecast + Compare | ☐ |
| Phase 3 | Maintenance + Cost + Reports + Memory + Agents (5 modes) | ☐ |
| Phase 4 | RAG + Knowledge Base | ☐ |

**Tester:** ___________________  
**Date:** ___________________  
**Backend version:** `git rev-parse --short HEAD` → ___________________  
**Overall result:** ☐ PASS → safe to tag `v1.0.0-poc` &nbsp;&nbsp; ☐ FAIL → see issues above
