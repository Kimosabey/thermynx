"""POST /api/v1/causal/explain — produce ranked likely-causes for an anomaly."""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.telemetry import (
    COOLING_TOWER_COLS,
    PUMP_COLS,
    fetch_chiller_data,
    fetch_equipment_data,
)
from app.domain.equipment import get_by_id
from app.limiter import limiter
from app.services.causal import explain_anomaly

router = APIRouter()


class CausalRequest(BaseModel):
    equipment_id: str
    metric:       str
    value:        float | None = None
    z_score:      float | None = None
    timestamp:    str | None   = None
    hours_context: int = Field(default=6, ge=1, le=72)
    model:        str | None = None


@router.post("/causal/explain")
@limiter.limit("20/minute")
async def causal_explain(
    request: Request,
    body: CausalRequest,
    db: AsyncSession = Depends(get_db),
):
    eq = get_by_id(body.equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail=f"Unknown equipment: {body.equipment_id}")

    if eq["type"] == "chiller":
        rows = await fetch_chiller_data(db, eq["table"], hours=body.hours_context)
    else:
        cols = COOLING_TOWER_COLS if eq["type"] == "cooling_tower" else PUMP_COLS
        rows = await fetch_equipment_data(db, eq["table"], cols, hours=body.hours_context)

    sample = rows[-60:] if len(rows) > 60 else rows  # last hour-ish at 1-min cadence
    context: dict[str, Any] = {
        "equipment":      {"id": eq["id"], "name": eq["name"], "type": eq["type"]},
        "hours_context":  body.hours_context,
        "row_count":      len(rows),
        "recent_sample":  sample,
    }
    anomaly = {
        "equipment_id": body.equipment_id,
        "metric":       body.metric,
        "value":        body.value,
        "z_score":      body.z_score,
        "timestamp":    body.timestamp,
    }
    result = await explain_anomaly(anomaly, context, model=body.model)
    return asdict(result)
