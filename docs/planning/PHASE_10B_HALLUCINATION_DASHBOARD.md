# Phase 10B — Hallucination scorer dashboard

**Status:** queued · **ETA:** ~half-day after 10A

## Goal

The self-critique loop on `/analyze` already writes a verdict
(`ok` / `review` / `fail`) per answer. Surface that history as a
dedicated dashboard so operators can spot regressions quickly.

## Scope

| In | Out |
|---|---|
| `/api/v1/audit/critique-summary` — counts by verdict, rolling 24h/7d/30d trend | Auto-retraining hooks |
| Frontend tab inside the existing Audit Log page | Slack alerting on a fail spike |
| Per-row link from an audit entry to the original answer | Per-model breakdown (later) |

## Tasks
- [ ] Backend: aggregate query over `analysis_audit.status` grouped by hour/day
- [ ] Backend: new tab section in `/audit/stats` payload OR fresh endpoint
- [ ] Frontend: add "Quality" tab to AuditPage with a line chart (ECharts) +
      verdict-tile KPIs (verified / suspicious / unverified counts)
- [ ] Smoke-test against existing audit rows
