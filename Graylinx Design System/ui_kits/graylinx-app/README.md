# Graylinx App — UI Kit

A pixel-faithful recreation of the in-app product surface: dark sidebar shell + four core operator screens (Dashboard, AI Analyzer, Anomalies, AI Agents), with click-through navigation and mocked telemetry.

## Files

- `index.html` — Entry point. Loads React, Babel, the tokens stylesheet, and all JSX components.
- `App.jsx` — Top-level state: which route is active, mocked equipment data, mocked threads.
- `tokens.css` — Re-exports `../../colors_and_type.css` plus a few app-shell extras.
- `Sidebar.jsx` — Dark navy sidebar with 4 nav groups (Monitor / Intelligence / Advanced / AI & Knowledge), collapsible, animated active state.
- `PageShell.jsx`, `PageHeader.jsx` — Shared layout primitives. `1400px` max-width, brand-gradient icon tile, title + subtitle + actions cluster.
- `GlassCard.jsx`, `KpiCard.jsx`, `StatusPulse.jsx`, `Pill.jsx`, `Btn.jsx`, `Field.jsx`, `Chip.jsx`, `Icon.jsx` — Reusable atoms.
- `screens/Dashboard.jsx` — Operations dashboard (KPI strip + equipment grid).
- `screens/Analyzer.jsx` — AI Analyzer (equipment + window + thread selectors, quick-prompt chips, streaming-style response card).
- `screens/Anomalies.jsx` — Anomaly Detector (summary chips + critical/warning anomaly cards with z-score pills).
- `screens/Agents.jsx` — AI Agents hub (5 color-keyed mode cards + active mode config + reasoning trace).

## What's mocked vs real

- **Mocked:** all telemetry (six equipment items with realistic kW/TR, load, anomaly z-scores), the agent reasoning trace, the analyzer response, the thread list.
- **Real:** every visual decision — colors, type, spacing, motion, hover and active states, focus rings — comes from `frontend/src/app/theme/index.js` (Brand v2).

## Click-through behaviour

- Click any sidebar item to swap routes (with the page-transition fade).
- On the Analyzer, click a quick-prompt chip → it populates the textarea. Click **Analyze** → the response card fades in with a fake "Analysis complete" payload.
- On the Anomalies screen, click **Scan now** → adds a new mocked anomaly.
- On Agents, click a mode card to switch — the preset chips, placeholder, and accent color all update.
