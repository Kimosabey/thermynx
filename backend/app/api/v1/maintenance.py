from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.maintenance import analyze_asset_maintenance
from app.db.session import get_db
from app.db.telemetry import fetch_bucket_series
from app.domain.equipment import EQUIPMENT_CATALOG, get_by_id

router = APIRouter()

_BUCKET_SECS = 900


@router.get("/maintenance/{equipment_id}")
async def get_maintenance_asset(
    equipment_id: str,
    hours: int = Query(default=24, ge=1, le=8760),
    db: AsyncSession = Depends(get_db),
):
    eq = get_by_id(equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail=f"Unknown equipment: {equipment_id}")

    points = await fetch_bucket_series(db, eq["table"], eq["type"], hours=hours, bucket_secs=_BUCKET_SECS)
    result = analyze_asset_maintenance(eq["id"], eq["name"], eq["type"], points, bucket_secs=_BUCKET_SECS)
    return {**asdict(result), "hours": hours, "bucket_secs": _BUCKET_SECS}


@router.get("/maintenance")
async def get_maintenance_all(
    hours: int = Query(default=24, ge=1, le=8760),
    db: AsyncSession = Depends(get_db),
):
    assets = []
    for eq in EQUIPMENT_CATALOG:
        points = await fetch_bucket_series(db, eq["table"], eq["type"], hours=hours, bucket_secs=_BUCKET_SECS)
        assets.append(asdict(analyze_asset_maintenance(eq["id"], eq["name"], eq["type"], points, bucket_secs=_BUCKET_SECS)))
    return {"assets": assets, "hours": hours, "bucket_secs": _BUCKET_SECS}
