from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.telemetry import fetch_all_hvac_context, compute_summary
from app.domain.equipment import EQUIPMENT_CATALOG

router = APIRouter()


@router.get("/equipment")
async def list_equipment():
    return EQUIPMENT_CATALOG


@router.get("/equipment/summary")
async def equipment_summary(
    hours: int = Query(default=24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated stats for all equipment — used by Dashboard."""
    context = await fetch_all_hvac_context(db, hours=hours)
    summary = await compute_summary(context)
    return {"summary": summary, "hours": hours}
