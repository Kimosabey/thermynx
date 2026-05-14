from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.telemetry import fetch_chiller_data
from app.domain.equipment import get_by_id, EQUIPMENT_CATALOG
from app.analytics.efficiency import analyze_chiller_efficiency
from app.services import cache as cache_svc

router = APIRouter()

_TTL = 120   # 2 minutes — efficiency bands change slowly


@router.get("/efficiency/{equipment_id}")
async def get_efficiency(
    equipment_id: str,
    hours: int = Query(default=24, ge=1, le=8760),
    db: AsyncSession = Depends(get_db),
):
    eq = get_by_id(equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail=f"Unknown equipment: {equipment_id}")
    if eq["type"] != "chiller":
        raise HTTPException(status_code=400, detail=f"{equipment_id} is not a chiller — efficiency analysis only applies to chillers")

    async def _fetch():
        rows = await fetch_chiller_data(db, eq["table"], hours=hours)
        return asdict(analyze_chiller_efficiency(equipment_id, eq["name"], rows))

    return await cache_svc.get_or_set(f"efficiency:{equipment_id}:h={hours}", _TTL, _fetch)


@router.get("/efficiency")
async def get_all_efficiency(
    hours: int = Query(default=24, ge=1, le=8760),
    db: AsyncSession = Depends(get_db),
):
    """Efficiency summary for all chillers. Cached 120 s."""
    async def _fetch():
        chillers = [e for e in EQUIPMENT_CATALOG if e["type"] == "chiller"]
        results  = []
        for eq in chillers:
            rows   = await fetch_chiller_data(db, eq["table"], hours=hours)
            result = analyze_chiller_efficiency(eq["id"], eq["name"], rows)
            results.append(asdict(result))
        return {"results": results, "hours": hours}

    return await cache_svc.get_or_set(f"efficiency:all:h={hours}", _TTL, _fetch)
