from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.db.telemetry import CHILLER_COLS, COOLING_TOWER_COLS, PUMP_COLS
from app.domain.equipment import get_by_id

router = APIRouter()

_COLS_BY_TYPE = {
    "chiller":       CHILLER_COLS,
    "cooling_tower": COOLING_TOWER_COLS,
    "pump":          PUMP_COLS,
}

_RESOLUTION_MINUTES = {"1m": 1, "5m": 5, "15m": 15, "1h": 60}


@router.get("/equipment/{equipment_id}/timeseries")
async def get_timeseries(
    equipment_id: str,
    hours: int = Query(default=24, ge=1, le=168),
    resolution: str = Query(default="15m", pattern="^(1m|5m|15m|1h)$"),
    db: AsyncSession = Depends(get_db),
):
    eq = get_by_id(equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail=f"Unknown equipment: {equipment_id}")

    table = eq["table"]
    since = datetime.utcnow() - timedelta(hours=hours)
    res_min = _RESOLUTION_MINUTES[resolution]
    limit = min((hours * 60) // res_min + 1, 2000)

    if res_min == 1:
        result = await db.execute(
            text(f"SELECT {_COLS_BY_TYPE[eq['type']]} FROM {table} WHERE slot_time >= :since ORDER BY slot_time ASC LIMIT :limit"),
            {"since": since, "limit": limit},
        )
    else:
        bucket_secs = res_min * 60
        extra = (
            "AVG(tr) AS tr, AVG(kw_per_tr) AS kw_per_tr, AVG(chw_delta_t) AS chw_delta_t, "
            "AVG(chiller_load) AS chiller_load, AVG(evap_leaving_temp) AS evap_leaving_temp, "
            "AVG(cond_leaving_temp) AS cond_leaving_temp, AVG(ambient_temp) AS ambient_temp"
            if eq["type"] == "chiller"
            else "AVG(kwh) AS kwh, AVG(run_hours) AS run_hours"
        )
        result = await db.execute(
            text(
                f"SELECT FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(slot_time)/{bucket_secs})*{bucket_secs}) AS slot_time,"
                f" AVG(kw) AS kw, {extra}, MAX(is_running) AS is_running"
                f" FROM {table} WHERE slot_time >= :since"
                f" GROUP BY FLOOR(UNIX_TIMESTAMP(slot_time)/{bucket_secs})"
                f" ORDER BY slot_time ASC LIMIT :limit"
            ),
            {"since": since, "limit": limit},
        )

    points = []
    for r in result.mappings().all():
        row = dict(r)
        if isinstance(row.get("slot_time"), datetime):
            row["slot_time"] = row["slot_time"].isoformat()
        row = {k: float(v) if hasattr(v, "__float__") else v for k, v in row.items()}
        points.append(row)

    return {
        "equipment_id": equipment_id,
        "name": eq["name"],
        "type": eq["type"],
        "from": since.isoformat(),
        "to": datetime.utcnow().isoformat(),
        "hours": hours,
        "resolution": resolution,
        "count": len(points),
        "points": points,
    }
