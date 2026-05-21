# Session Status — 2026-05-21

Snapshot taken at end of session. Resume here tomorrow.

## TL;DR

- ✅ Recharts → ECharts (3 files migrated, recharts removed)
- ✅ 5 new sidebar menu items + routes + pages (NL Query, Alarms, Topology, Vision, Audit Log)
- ✅ 7 new backend endpoint groups (`/capabilities`, `/alarms*`, `/audit/*`, `/nl-query`, `/vision/{describe,compare}`, `/causal/explain`, `/topology`)
- ✅ Backend restarted with venv Python (`.venv\Scripts\python.exe`) — all routes return 200
- ✅ Light/dark theme parity audit + Aurora scroll-break fix
- ✅ Causal "Explain why" toggle on every anomaly card

Phases 6–10 contain ~16 items not yet built — see roadmap below.

## What is live right now

### Backend (port 8000, PID launched in background)

Launched with: `D:\Harshan\HVAC AI Operations Intelligence Platform\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000` from `backend/` cwd. No `--reload` flag — Python edits need a manual restart.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/capabilities` | GET | Self-describing product catalogue (A4) |
| `/api/v1/alarms` | GET | Unified anomaly + maintenance feed with severity tiers |
| `/api/v1/alarms/stats` | GET | Counts grouped by severity/kind/equipment |
| `/api/v1/audit/analyses` | GET | Read view over `analysis_audit` rows |
| `/api/v1/audit/agents` | GET | Read view over `agent_runs` rows |
| `/api/v1/audit/stats` | GET | Audit counts by model/status/mode |
| `/api/v1/nl-query` | POST | NL → safe SELECT → JSON rows (10s query timeout, max 1000 rows) |
| `/api/v1/vision/describe` | POST | llama3.2-vision scene description (severity-tagged) |
| `/api/v1/vision/compare` | POST | Two-image diff for plant inspections |
| `/api/v1/causal/explain` | POST | Ranked likely-causes for an anomaly + recommended checks |
| `/api/v1/topology` | GET | Plant graph (nodes + edges + live state) |

### Frontend (5 new pages)

| Route | File | Status |
|---|---|---|
| `/nl-query` | `features/nl_query/index.jsx` | Live — examples, generated-SQL viewer, auto-ECharts viz, results table |
| `/alarms` | `features/alarms/index.jsx` | Live — severity KPIs + sortable table |
| `/topology` | `features/topology/index.jsx` | Live — ECharts force-directed graph, drag/zoom/hover |
| `/vision` | `features/vision/index.jsx` | Live — drag-drop dual-image uploader, describe & compare modes |
| `/audit` | `features/audit/index.jsx` | Live — tabs for analyses + agent runs, status chips |
| `/anomalies` | (existing, enhanced) | "Explain why" toggle now calls `/causal/explain` per card |

## Charts migration

- Removed `recharts` 3.8.1
- Added `echarts` 6.1, `echarts-for-react` 3.0
- Migrated: `TimeseriesChart.jsx`, `forecast/index.jsx`, `compare/index.jsx`
- All ECharts in the app now use `useColorMode` for tooltip background / border / text / gridline colors

## Theme / UX fixes

- **Aurora scroll-break (fixed)** — was `position:absolute` inside the scroll container, so on long pages the blob layout anchored to total content height. Fixed by wrapping in a `position:sticky top:0 h:100vh mb:-100vh` container ([Layout.jsx](../../frontend/src/app/Layout.jsx)).
- **New semantic tokens** in [theme/index.js](../../frontend/src/app/theme/index.js): `bg.chip`, `bg.chipHover`, `bg.glass`, `bg.glassHigh` — flip cleanly light↔dark.
- **AuroraBackground** uses `useColorMode` for base wash + dot-grid color.
- **ServiceStatusBar** pills use `bg.glass` + `border.subtle` (was hardcoded white-rgba — invisible on dark).
- **Badge chip backgrounds** replaced across alarms / audit / TimeseriesChart / dashboard / anomalies.
- Sidebar stays dark in both modes (intentional brand spec).

## Files added this session

### Backend
- `backend/app/api/v1/capabilities.py`
- `backend/app/api/v1/alarms.py`
- `backend/app/api/v1/audit.py`
- `backend/app/api/v1/nl_query.py`
- `backend/app/api/v1/vision.py`
- `backend/app/api/v1/causal.py`
- `backend/app/api/v1/topology.py`
- `backend/app/services/critique.py` (earlier in session)
- `backend/app/services/nl_to_sql.py`
- `backend/app/services/vision.py`
- `backend/app/services/causal.py`

### Frontend
- `frontend/src/features/nl_query/index.jsx`
- `frontend/src/features/alarms/index.jsx`
- `frontend/src/features/topology/index.jsx`
- `frontend/src/features/vision/index.jsx`
- `frontend/src/features/audit/index.jsx`
- `frontend/src/shared/ui/ComingSoon.jsx`

### Modified
- `backend/app/api/router.py` (registered 7 new routers)
- `frontend/src/app/App.jsx` (5 new routes)
- `frontend/src/shared/ui/Sidebar.jsx` (5 new nav items)
- `frontend/src/app/theme/index.js` (chip/glass tokens)
- `frontend/src/shared/ui/AuroraBackground.jsx` (theme-aware + sticky-fix prep)
- `frontend/src/shared/ui/ServiceStatusBar.jsx` (bg.glass)
- `frontend/src/app/Layout.jsx` (Aurora sticky wrapper)
- `frontend/src/features/analyzer/TimeseriesChart.jsx`, `forecast/index.jsx`, `compare/index.jsx` (Recharts → ECharts)
- `frontend/src/features/anomalies/index.jsx` (Explain-why toggle)
- `frontend/src/features/dashboard/index.jsx`, `frontend/src/features/anomalies/index.jsx` (chip bg fixes)
- `frontend/package.json` (recharts removed; echarts added)

## Polish / debt

- Bundle is 2.0 MB (ECharts is ~700 KB). Vite warns above 500 KB. Code-splitting is a separate task.
- Backend has no `--reload` — Python edits need manual restart.
- A handful of ECharts axisLabel colors (`#334155`) are still hardcoded in forecast/compare — minor.
- Vision page accepts up to 6 MiB images with no client-side resize; could add canvas downscale before upload.

## Open questions for tomorrow

1. Which phase item to tackle next? Best candidates:
   - **Multi-agent orchestration** (Phase 6) — biggest "wow"
   - **Slack/Teams bot** (Phase 9) — fastest visible win
   - **Citation linking** (Phase 10) — trust/compliance angle
   - **Foundation forecasting** (Phase 8) — replaces heuristic with proper model
2. Restart backend with `--reload` for active dev?
3. Code-split the bundle, or defer until pages slow down?
