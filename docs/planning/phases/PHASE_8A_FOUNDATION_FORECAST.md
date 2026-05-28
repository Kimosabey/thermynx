# Phase 8A — Replace heuristic forecast with a real model

**Status:** queued · **ETA:** 1 week (model eval) + ~3d (integration)

## The honest current state

The Forecast page (`/forecast`, [features/forecast/index.jsx](../../frontend/src/features/forecast/index.jsx))
currently uses a hour-of-day statistical profile:

> "For each hour of the next H hours, average the value seen at that
> hour-of-day over the past N=7 days. The shaded band is ±1 σ of those
> samples."

This is **not a real forecasting model.** It cannot:
- React to today's load trajectory (Monday at 14:00 always predicts last-week's 14:00 mean)
- Handle weather shifts, holidays, or operational regime changes
- Quantify uncertainty beyond the empirical band

The UI now shows a "POC · heuristic" badge in the page header so
operators don't mistake it for ML.

## Goal

Swap the heuristic out for a real univariate (and ideally multivariate)
forecaster behind the same `/api/v1/forecast/{equipment_id}` contract —
no frontend changes required.

## Candidate models (all on-prem compatible)

| Model | License | Strength | Local cost |
|---|---|---|---|
| [Chronos](https://github.com/amazon-science/chronos-forecasting) | Apache-2.0 | Best zero-shot accuracy on M-competition benchmarks | ~150 MB tiny, ~700 MB base |
| [Moirai](https://github.com/SalesforceAIResearch/uni2ts) | Apache-2.0 | Multivariate; handles exogenous variables (wet-bulb, tariff) | ~250 MB small |
| [TimesFM](https://github.com/google-research/timesfm) | Apache-2.0 | Best long-horizon performance | ~500 MB |
| Statistical baselines (Prophet / sktime AutoETS) | various OSS | Cheap, no GPU | Negligible |

Default pick: **Chronos-tiny** for the v0 swap-in (zero-shot, no fine-tune
needed, small enough to load on the CPU side of the Ollama server). We
can A/B against Moirai later.

## Architecture

```
existing endpoint               new service                model server
/forecast/{equipment_id}  ->    forecast_v2.py     ->    ollama:11434/api/forecast (if added)
                                                   OR    in-process torch inference
```

Option A — **In-process** (simpler): load the Chronos model in the
FastAPI process once at startup, run inference per request. ~250 ms per
forecast on CPU, fine for our request rate.

Option B — **Ollama-side** (cleaner separation): wait for Ollama to
add foundation-model-forecasting endpoints (not yet available as of
this writing). Ship Option A now, migrate later if it lands.

## Scope (this phase)

| In | Out |
|---|---|
| Load Chronos-tiny at startup, cache the pipeline | Multivariate / exogenous inputs (Phase 8B) |
| New `services/forecast_v2.py` exposing the same return shape | Auto-retraining loop |
| Feature flag `FORECAST_BACKEND=heuristic|chronos` in `.env` | Multi-step / probabilistic UI changes |
| Heuristic stays as fallback if Chronos fails to load | RUL / failure prediction (separate Phase 8B) |

## API contract (unchanged)

`GET /api/v1/forecast/{equipment_id}?metric=&horizon=&history_days=`

Returns
```json
{
  "name":           "Chiller 1",
  "horizon_hours":  24,
  "points": [
    {"hour_label": "2026-05-22T15:00", "predicted": 0.74, "lower": 0.68, "upper": 0.81, "confidence": "high"}
  ],
  "note":           "Chronos-tiny · history=336h · backend=chronos"
}
```

## Tasks

- [ ] Add `chronos-forecasting` to `requirements.txt`
- [ ] `services/forecast_v2.py` — pipeline cache + `predict(metric_series, horizon)`
- [ ] `app/main.py` — load model once at startup, log success/failure
- [ ] `api/v1/forecast.py` — route through `forecast_v2` when feature flag is set
- [ ] Backfill `services/forecast.py` so the heuristic remains as a fallback
- [ ] Update `note` field on response to reflect which backend served the request
- [ ] Smoke-test against chiller_1 / pump / tower
- [ ] Remove the "POC · heuristic" badge ONLY after Chronos is the default

## Risks

- **Model download:** Chronos pulls ~150 MB on first load. Bake into the
  container build or document offline-install path.
- **CPU cost:** A 7-day history × 24-hour forecast is fine on CPU. Bulk
  back-fills (multi-equipment overnight) may need throttling.
- **Schema drift:** if telemetry adds a column we want to forecast, the
  v2 service must handle missing-column gracefully.

## Acceptance

1. With `FORECAST_BACKEND=chronos` set, the response `note` reads
   `"Chronos-tiny · …"`.
2. MAPE on a 24h holdout against historical Unicharm data improves by
   ≥20% over the heuristic baseline.
3. P95 endpoint latency stays under 600 ms.
4. The frontend page is unchanged except the badge is removed.
