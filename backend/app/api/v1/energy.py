"""Energy Management endpoints — usage, cost, meter inventory.

Read-only over unicharm energy_*_analytics (app/db/energy.py); cost uses the
effective tariff (Postgres tariff_schedule overlay or flat config).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, get_pg
from app.db import energy, registry

router = APIRouter()

_PERIODS = ("hourly", "daily", "weekly")


@router.get("/energy/usage")
async def energy_usage(
    period: str = Query("daily"),
    days: int = Query(7, ge=1, le=180),
    type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    p = period if period in _PERIODS else "daily"
    return await energy.usage(db, period=p, days=days, device_type=type)


@router.get("/energy/cost")
async def energy_cost(
    period: str = Query("daily"),
    days: int = Query(7, ge=1, le=180),
    type: str | None = None,
    db: AsyncSession = Depends(get_db),
    pg: AsyncSession = Depends(get_pg),
):
    p = period if period in _PERIODS else "daily"
    usage = await energy.usage(db, period=p, days=days, device_type=type)
    rate, source = await energy.effective_rate(pg)
    return energy.apply_cost(usage, rate, source)


@router.get("/energy/meters")
async def energy_meters(db: AsyncSession = Depends(get_db)):
    """The IBMS energy-meter assets (ss_type NONGL_SS_EMS)."""
    meters = await registry.list_assets(db, asset_type="NONGL_SS_EMS")
    return {"meters": meters, "total": len(meters)}
