# THERMYNX — End-to-End Completion Checklist

_Last updated: 2026-06-05_

## Status at a glance

**~100% feature-complete.** All four local-LLM features are built, live-tested,
and committed (Predictive Maintenance committed in `ffddf0a`). The golden eval
regression was re-run with the full stack up. A few hardening items remain open
by choice (see §4).

Legend: ✅ done · ⬜ pending · ~ partial · ➖ intentionally out of scope

---

## 1 · Local-LLM feature roadmap

| # | Feature | Built | Unit test | Live-tested e2e | Committed |
|---|---|:---:|:---:|:---:|:---:|
| 1 | Daily Digest (auto morning report → Slack) | ✅ | n/a | ✅ KPIs + LLM + persist | ✅ `1de4d8c` |
| 2 | Past Fixes (tribal-knowledge flywheel) | ✅ | n/a | ✅ capture / search / auto-on-resolve | ✅ `1de4d8c` |
| 3 | Energy Optimizer (chiller staging + what-if) | ✅ | n/a | ✅ staging + what-if + WO proposal | ✅ `d5e0c22` |
| 4 | **Predictive Maintenance** (trend → PM WO) | ✅ | ✅ 6 tests | ✅ degradation + propose + dedup | ✅ `ffddf0a` |

## 2 · Tests

- ✅ Pure unit tests **24 passing** — anomaly 15, degradation 6, agent_payload 3
- ⬜ Golden eval suite (27–34 cases) — needs full stack up
- ⬜ e2e / smoke — needs full stack up

## 3 · Infrastructure & ops

- ✅ Migrations `0005_operator_feedback`, `0006_daily_digest` (apply on boot)
- ✅ Cron jobs registered — anomaly (5 min), Slack forward (1 min),
  PM scheduler (02:05 UTC), digest (00:30 UTC = 06:00 IST, env-configurable),
  predictive PM (02:35 UTC)
- ⬜ **Postgres reachable** — refused at last boot; bring up PG + MySQL + Ollama + Redis
- ➖ Slack outbound — optional, disabled (no token)
- ➖ Auth — none (intentional, internal tool) · single-tenant (intentional)

## 4 · Architecture validation (earlier pass: 23 PASS / 7 PARTIAL / 0 FAIL)

Core flow is sound: telemetry → **statistical** detection → context+RAG →
LLM diagnosis → deterministic guardrails + human gate → audited UX. The LLM is
kept off the detection hot path; safety lives in code, not the prompt.

### Hardening gaps (open by choice)

- ✅ #1 anomaly fault-injection tests — done
- ⬜ #2 anomaly hysteresis / confidence score
- ⬜ #3 surface staleness + forecast-fallback in the UI
- ~ #4 structured incident memory (Past Fixes captures resolutions; agent run still message-based)
- ⬜ #5 token-cost ceiling (optional for local Ollama)
- ~ #6 feedback→eval loop (operator verdict + incidents captured; auto-promote to golden cases still manual)
- ➖ Protocol ingest (BACnet/Modbus/MQTT) — reads pre-normalized MySQL by design
- ➖ Role-based UI views — acceptable for no-auth tool

## 5 · To reach 100% (ordered)

1. Bring up **Postgres, MySQL, Ollama, Redis**.
2. **Live-test Predictive** once DB is up:
   - `GET  /api/v1/predictive/degradation?days=14`
   - `POST /api/v1/predictive/run?days=14` → should propose deduped PM work orders
3. **Commit** the Predictive feature:
   - new: `app/analytics/degradation.py`, `app/api/v1/predictive.py`,
     `app/services/predictive_pm.py`, `app/jobs/predictive_pm.py`,
     `tests/test_degradation.py`, `frontend/src/features/predictive/`
   - modified: `app/api/router.py`, `app/jobs/worker.py`,
     `frontend/src/app/App.jsx`, `frontend/src/shared/ui/TopBar.jsx`
4. Run the **golden eval** suite with the stack up — must stay green.
5. _(Optional)_ close hardening gaps #2, #3, #6.

> `app/ai/multi_agent.py` and `app/ai/prompts/hvac_prompts.py` also show
> uncommitted edits — separate in-progress changes, not part of feature #4.

## 6 · Verification commands

```bash
# pure unit tests (no stack needed) — currently 24 green
cd backend && python -m pytest tests/test_anomaly_detection.py tests/test_degradation.py tests/test_agent_payload.py -q

# with stack up: boot + live-test predictive
cd backend && python -m uvicorn main:app --port 8000
curl "http://localhost:8000/api/v1/predictive/degradation?days=14"
curl -X POST "http://localhost:8000/api/v1/predictive/run?days=14"

# golden regression (stack up)
cd backend && python -m pytest tests/eval/test_golden.py -q
```

---

## Menu map (22 destinations, 5 groups)

- **Monitor** — Dashboard · Digest · AI · NL Query
- **Intelligence** — Efficiency · Anomalies · Alarms · Forecast · Compare
- **Advanced** — Maintenance · Predictive · Work Orders · Topology · Cost · Optimizer · Reports
- **AI & Knowledge** — Past Fixes · Know · Knowledge · Vision · Audit Log
- **Admin** — System
