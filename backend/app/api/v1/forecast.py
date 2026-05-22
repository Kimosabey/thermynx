from dataclasses import asdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.telemetry import fetch_chiller_data, fetch_equipment_data, COOLING_TOWER_COLS, PUMP_COLS
from app.domain.equipment import get_by_id
from app.analytics.forecast    import forecast_metric    as _forecast_heuristic, FORECAST_METRICS
from app.analytics.forecast_ml import forecast_metric_ml, ML_FORECAST_METRICS
from app.config import settings

router = APIRouter()


@router.get("/forecast/{equipment_id}")
async def get_forecast(
    equipment_id: str,
    metric: str     = Query(default="kw_per_tr"),
    horizon: int    = Query(default=24, ge=1, le=168),
    history_days: int = Query(default=7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    eq = get_by_id(equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail=f"Unknown equipment: {equipment_id}")

    use_ml = settings.FORECAST_BACKEND == "ml"
    allowed = (ML_FORECAST_METRICS if use_ml else FORECAST_METRICS).get(eq["type"], [])
    if metric not in allowed:
        raise HTTPException(status_code=400, detail=f"Metric '{metric}' not available for {eq['type']}. Use: {allowed}")

    hours = history_days * 24
    # Forecast needs enough history for Holt-Winters to fit — ask for
    # several thousand rows instead of the 96-row dashboard default.
    if eq["type"] == "chiller":
        rows = await fetch_chiller_data(db, eq["table"], hours=hours, limit=5000)
    else:
        cols = COOLING_TOWER_COLS if eq["type"] == "cooling_tower" else PUMP_COLS
        rows = await fetch_equipment_data(db, eq["table"], cols, hours=hours, limit=5000)

    runner = forecast_metric_ml if use_ml else _forecast_heuristic
    result = runner(rows, metric, horizon_hours=horizon, equipment_id=equipment_id)
    return {**asdict(result), "name": eq["name"], "type": eq["type"]}
