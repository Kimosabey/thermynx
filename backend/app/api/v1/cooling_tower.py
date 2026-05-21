from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.tower_optimizer import tower_hint
from app.db.session import get_db
from app.db.telemetry import fetch_bucket_series
from app.domain.equipment import get_by_id

router = APIRouter()

_BUCKET_SECS = 900


@router.get("/cooling-tower/{equipment_id}/optimize")
async def cooling_tower_optimize(
    equipment_id: str,
    hours: int = Query(default=24, ge=1, le=8760),
    db: AsyncSession = Depends(get_db),
):
    eq = get_by_id(equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail=f"Unknown equipment: {equipment_id}")
    if eq["type"] != "cooling_tower":
        raise HTTPException(status_code=400, detail="Optimization hints apply to cooling towers only")

    points = await fetch_bucket_series(db, eq["table"], eq["type"], hours=hours, bucket_secs=_BUCKET_SECS)
    hint = tower_hint(eq["id"], eq["name"], points, bucket_secs=_BUCKET_SECS)
    payload = asdict(hint)
    payload["data_status"] = {
        "wet_bulb_available": payload["wet_bulb_avg_c"] is not None,
        "cell_count_available": payload["cell_count_latest"] is not None,
        "note": (
            "Unicharm normalized tower schema has fan_kw + run_hours only; "
            "wet-bulb and per-cell metadata are not collected by current sensors."
        ),
    }
    return {**payload, "hours": hours, "bucket_secs": _BUCKET_SECS}
