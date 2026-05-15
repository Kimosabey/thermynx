from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.db.telemetry import fetch_plant_latest_slot_time, check_data_freshness
from app.config import settings
from app.llm.ollama import check_ollama_health
from app.log import get_logger
from app.observability.metrics import telemetry_data_age_seconds, telemetry_freshness_check_total

router = APIRouter()
log = get_logger("api.health")


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    db_ok = False
    latest: datetime | None = None
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
        # Best-effort: also fetch the newest plant row for freshness reporting.
        try:
            latest = await fetch_plant_latest_slot_time(db)
        except Exception as e:
            log.warning("freshness_probe_failed err=%s", e)
    except Exception as e:
        log.warning("mysql_ping_failed host=%s port=%s err=%s", settings.DB_HOST, settings.DB_PORT, e)

    ollama_ok, models = await check_ollama_health()

    # Data-freshness signal — populates the Prometheus gauge for alerting +
    # surfaces a human-readable warning in the response when wall_clock mode is
    # in use. Stays None / 0 in historical-dump (latest_in_db) mode.
    freshness_warning = check_data_freshness(latest)
    age_seconds: float | None = None
    if latest is not None and settings.TELEMETRY_TIME_ANCHOR == "wall_clock":
        age_seconds = max(0.0, (datetime.utcnow() - latest).total_seconds())
        telemetry_data_age_seconds.set(age_seconds)
        telemetry_freshness_check_total.labels(
            status="stale" if freshness_warning else "ok"
        ).inc()
    elif latest is None:
        telemetry_freshness_check_total.labels(status="no_data").inc()
    else:
        telemetry_freshness_check_total.labels(status="skipped").inc()

    return {
        "status": "ok" if (db_ok and ollama_ok) else "degraded",
        "db": {"connected": db_ok, "host": settings.DB_HOST, "port": settings.DB_PORT},
        "ollama": {
            "connected": ollama_ok,
            "host": settings.OLLAMA_HOST,
            "default_model": settings.OLLAMA_DEFAULT_MODEL,
            "available_models": models,
        },
        "telemetry": {
            "anchor": settings.TELEMETRY_TIME_ANCHOR,
            "latest_slot_time": latest.isoformat() if latest else None,
            "age_seconds": age_seconds,
            "freshness_warning": freshness_warning,
        },
    }
