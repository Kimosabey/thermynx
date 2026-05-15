from dataclasses import asdict

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.cost import build_plant_cost
from app.limiter import limiter
from app.config import settings
from app.db.session import get_db
from app.db.telemetry import fetch_bucket_series
from app.domain.equipment import EQUIPMENT_CATALOG
from app.services import cache as cache_svc

router = APIRouter()

_BUCKET_SECS = 900
_TTL         = 300   # 5 minutes — cost figures change slowly


@router.get("/cost")
@limiter.limit("60/minute")
async def get_plant_cost(
    request: Request,
    hours: int = Query(default=24, ge=1, le=8760),
    tariff_inr_per_kwh: float | None = Query(default=None, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Plant energy cost breakdown. Cached 5 min (tariff changes rarely)."""
    tariff    = tariff_inr_per_kwh if tariff_inr_per_kwh is not None else settings.TARIFF_INR_PER_KWH
    cache_key = f"cost:h={hours}:tariff={tariff}"

    async def _fetch():
        datasets = []
        for eq in EQUIPMENT_CATALOG:
            pts = await fetch_bucket_series(
                db, eq["table"], eq["type"], hours=hours, bucket_secs=_BUCKET_SECS
            )
            datasets.append((eq["id"], eq["name"], eq["type"], pts))

        summary = build_plant_cost(
            datasets,
            hours_window=hours,
            tariff_inr_per_kwh=tariff,
            bucket_secs=_BUCKET_SECS,
        )
        return {
            "hours":              summary.hours_window,
            "tariff_inr_per_kwh": summary.tariff_inr_per_kwh,
            "total_kwh":          summary.total_kwh,
            "total_cost_inr":     summary.total_cost_inr,
            "equipment":          [asdict(r) for r in summary.equipment],
            "bucket_secs":        _BUCKET_SECS,
        }

    return await cache_svc.get_or_set(cache_key, _TTL, _fetch)
