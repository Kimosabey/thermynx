# Remaining Roadmap — post 2026-05-21

What's still on the plan after the 2026-05-21 push. See [SESSION_STATUS_2026-05-21.md](SESSION_STATUS_2026-05-21.md) for what landed.

## Phase 6 — Agentic maturity

| Item | Effort | Notes |
|---|---|---|
| Self-critique loop | ✅ shipped | `services/critique.py` — fact-check verdict on `/analyze` |
| NL→SQL agent tool | ✅ shipped | `services/nl_to_sql.py` + `/api/v1/nl-query` |
| Multi-agent orchestration | ~1w | Specialist agents (investigator / optimizer / maintenance) hand off via shared context. Biggest "wow" left. |
| Semantic memory | ~3d | pgvector store keyed by (user, thread, equipment) — agent can recall prior conclusions across sessions |
| HITL set-point suggestions | ~4d | Agent proposes set-point change → operator one-click approve before any BMS write |

## Phase 7 — Multimodal & voice

| Item | Effort | Notes |
|---|---|---|
| Vision compare | ✅ shipped | `services/vision.py` + `/api/v1/vision/{describe,compare}` |
| Voice console | ~3d | Push-to-talk in the UI, on-prem Whisper for STT, agent answer played via TTS |
| Mobile brief | ~4d | PWA shell + condensed dashboard tuned for phone (a couple of operators round) |
| Conversational dashboards | ~1w | Chat configures the chart — "show me chiller 2 efficiency last week" rewrites the page |

## Phase 8 — Advanced ML

| Item | Effort | Notes |
|---|---|---|
| Causal anomaly explanations | ✅ shipped | `services/causal.py` + Explain-why toggle on every anomaly |
| Foundation forecasting | ~1w | Replace hour-of-day heuristic with Chronos or Moirai. Pure swap-in behind `/forecast` |
| RUL failure prediction | ~2w | Weibull + survival models per asset class. Needs historical failure events (currently none) |
| Digital twin | ~1w+ | Live simulation surface — counterfactual "what if we run chiller 2 at 60%?" |

## Phase 9 — Integration

| Item | Effort | Notes |
|---|---|---|
| Slack / Teams bot | ~2d | `slack-bolt` or `botbuilder` worker; forwards `/analyze` and `/alarms` events. Fastest visible win. |
| CMMS sync | ~1w | Maximo / SAP PM read-back. Pull open work orders into Maintenance page. |
| Email-to-agent inbox | ~3d | IMAP worker — operators forward incidents to a mailbox, agent triages and replies |
| BACnet / Modbus connector | ~1w+ | Live read-only ingest path so on-prem deploy doesn't need MySQL ETL |
| Carbon / tariff intelligence | ~1w | Grid-aware scheduling — defer non-critical loads when tariff/CO₂ peaks |

## Phase 10 — Trust & governance

| Item | Effort | Notes |
|---|---|---|
| Audit log read endpoint | ✅ shipped | `/api/v1/audit/*` + frontend page with tabs |
| Citation linking | ~2d | Inline RAG sources clickable from synthesized answers (we already store the chunk IDs) |
| Hallucination scorer dashboard | ~3d | History view over self-critique verdicts (already on disk in analysis_audit) — surface as page |
| Prompt versioning | ~3d | Track which template generated which answer so regressions are diagnosable |
| PII redaction filter | ~2d | Pre-send scrubber in the analyzer pipeline (names, IDs, emails) |

## Tech debt

- **Bundle code-split** — vite warning above 500 KB. ECharts is ~700 KB; lazy-load per route.
- **Backend `--reload`** — currently launched without it; Python edits need manual restart.
- **ECharts axisLabel colors** — `#334155` still hardcoded in a few places; minor.
- **Vision client-side resize** — accept-up-to-6 MiB but no canvas downscale before upload.
- **A few residual hardcoded white-rgba colors** — outside sidebar/Aurora these should all be `bg.chip` / `border.subtle`.

## Suggested next session

Recommended order of attack tomorrow:
1. **Multi-agent orchestration** (Phase 6) — single most impactful unblock for the agent flow
2. **Citation linking** (Phase 10) — trust win, the data is already there
3. **Slack/Teams bot** (Phase 9) — first integration, makes the platform reachable from where ops actually work
4. **Bundle code-split** — once we have 4+ heavy pages, the cost of one 2 MB bundle starts hurting
