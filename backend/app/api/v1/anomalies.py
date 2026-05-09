from dataclasses import asdict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db, get_pg
from app.db.telemetry import (
    fetch_chiller_data,
    fetch_equipment_data,
    COOLING_TOWER_COLS,
    PUMP_COLS,
)
from app.domain.equipment import EQUIPMENT_CATALOG
from app.analytics.anomaly import detect_anomalies, CHILLER_METRICS, TOWER_PUMP_METRICS

router = APIRouter()


@router.get("/anomalies/live")
async def live_anomalies(
    hours: int = Query(default=1, ge=1, le=8760),
    db: AsyncSession = Depends(get_db),
):
    """Run anomaly detection on-demand against the last N hours."""
    all_events = []
    for eq in EQUIPMENT_CATALOG:
        if eq["type"] == "chiller":
            rows     = await fetch_chiller_data(db, eq["table"], hours=hours)
            baseline = await fetch_chiller_data(db, eq["table"], hours=72)
            metrics  = CHILLER_METRICS
        else:
            cols     = COOLING_TOWER_COLS if eq["type"] == "cooling_tower" else PUMP_COLS
            rows     = await fetch_equipment_data(db, eq["table"], cols, hours=hours)
            baseline = await fetch_equipment_data(db, eq["table"], cols, hours=72)
            metrics  = TOWER_PUMP_METRICS

        events = detect_anomalies(eq["id"], rows, metrics, baseline_rows=baseline)
        all_events.extend([{**asdict(e), "equipment_name": eq["name"]} for e in events])

    all_events.sort(key=lambda e: abs(e["z_score"]), reverse=True)
    return {"anomalies": all_events, "total": len(all_events), "hours": hours}


@router.get("/anomalies/history")
async def anomaly_history(
    limit: int = Query(default=50, ge=1, le=200),
    equipment_id: str | None = None,
    pg: AsyncSession = Depends(get_pg),
):
    """Return persisted anomalies from Postgres (written by the background job)."""
    where = "WHERE equipment_id = :eq_id" if equipment_id else ""
    rows = await pg.execute(
        text(f"""
            SELECT id, equipment_id, metric, started_at, value,
                   z_score, severity, description, narrative, created_at
            FROM anomalies
            {where}
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        {"limit": limit, "eq_id": equipment_id} if equipment_id else {"limit": limit},
    )
    results = [dict(r._mapping) for r in rows]
    for r in results:
        if hasattr(r.get("created_at"), "isoformat"):
            r["created_at"] = r["created_at"].isoformat()
    return {"anomalies": results, "total": len(results)}
