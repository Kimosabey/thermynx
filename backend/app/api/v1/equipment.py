from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.db.session import get_db
from app.db.telemetry import fetch_all_hvac_context, compute_summary, fetch_plant_latest_slot_time
from app.domain.equipment import EQUIPMENT_CATALOG
from app.log import get_logger

router = APIRouter()
log = get_logger("api.equipment")


@router.get("/equipment")
async def list_equipment():
    return EQUIPMENT_CATALOG


@router.get("/equipment/summary")
async def equipment_summary(
    hours: int = Query(default=24, ge=1, le=8760),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated stats for all equipment — used by Dashboard."""
    plant_latest = await fetch_plant_latest_slot_time(db)
    until_hint = plant_latest if plant_latest is not None else datetime.utcnow()
    since_hint = until_hint - timedelta(hours=hours)
    context = await fetch_all_hvac_context(db, hours=hours)
    summary = await compute_summary(context)

    row_counts = {k: len(v) for k, v in context.items() if isinstance(v, list)}
    zero_tables = [k for k, n in row_counts.items() if n == 0]
    log.info(
        "equipment_summary anchor=%s hours=%s plant_newest_utc=%s approx_since_utc=%s row_counts=%s",
        settings.TELEMETRY_TIME_ANCHOR,
        hours,
        until_hint.isoformat(timespec="seconds"),
        since_hint.isoformat(timespec="seconds"),
        row_counts,
    )
    if zero_tables and len(zero_tables) == len(row_counts):
        log.warning(
            "equipment_summary_empty_window anchor=%s hours=%s plant_newest_utc=%s approx_since_utc=%s — "
            "no rows in window; widen hours or check normalized tables.",
            settings.TELEMETRY_TIME_ANCHOR,
            hours,
            until_hint.isoformat(timespec="seconds"),
            since_hint.isoformat(timespec="seconds"),
        )

    return {
        "summary": summary,
        "hours": hours,
        "telemetry_window": {
            "anchor": settings.TELEMETRY_TIME_ANCHOR,
            "until_utc": until_hint.isoformat(timespec="seconds"),
            "since_utc": since_hint.isoformat(timespec="seconds"),
            "note": (
                "Each table uses its own latest slot_time as window end when anchor is latest_in_db; "
                "until_utc is the newest timestamp anywhere in the plant (hint only)."
            ),
        },
    }
