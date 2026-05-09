from dataclasses import asdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.telemetry import fetch_chiller_data, fetch_equipment_data, COOLING_TOWER_COLS, PUMP_COLS
from app.domain.equipment import get_by_id
from app.analytics.forecast import forecast_metric, FORECAST_METRICS

router = APIRouter()


@router.get("/forecast/{equipment_id}")
async def get_forecast(
    equipment_id: str,
    metric: str     = Query(default="kw_per_tr"),
    horizon: int    = Query(default=24, ge=1, le=72),
    history_days: int = Query(default=7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    eq = get_by_id(equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail=f"Unknown equipment: {equipment_id}")

    allowed = FORECAST_METRICS.get(eq["type"], [])
    if metric not in allowed:
        raise HTTPException(status_code=400, detail=f"Metric '{metric}' not available for {eq['type']}. Use: {allowed}")

    hours = history_days * 24
    if eq["type"] == "chiller":
        rows = await fetch_chiller_data(db, eq["table"], hours=hours)
    else:
        cols = COOLING_TOWER_COLS if eq["type"] == "cooling_tower" else PUMP_COLS
        rows = await fetch_equipment_data(db, eq["table"], cols, hours=hours)

    result = forecast_metric(rows, metric, horizon_hours=horizon, equipment_id=equipment_id)
    return {**asdict(result), "name": eq["name"], "type": eq["type"]}
