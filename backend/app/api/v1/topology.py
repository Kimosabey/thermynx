"""GET /api/v1/topology — asset topology graph.

Synthesises a plant topology graph from EQUIPMENT_CATALOG + live status:
chillers feed the CHW loop, cooling towers + condenser pumps form the
condenser loop. Each node is enriched with the current efficiency band
(if available) and run state so the frontend can colour-code the graph
without a second round-trip.

This is a pragmatic POC topology — it encodes the canonical HVAC chiller
plant architecture, not a generic database join. When the plant adds
heat exchangers / make-up tanks etc., extend the EDGES table below.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.telemetry import (
    COOLING_TOWER_COLS,
    PUMP_COLS,
    fetch_chiller_data,
    fetch_equipment_data,
)
from app.domain.equipment import EQUIPMENT_CATALOG, BAND_GOOD, BAND_POOR
from app.limiter import limiter
from fastapi import Request

router = APIRouter()


# Canonical chiller-plant edges. Direction = flow / dependency.
# (from_id, to_id, kind)
_PLANT_EDGES: list[tuple[str, str, str]] = [
    # Condenser loop: pumps → towers
    ("condenser_pump_1",  "cooling_tower_1", "condenser_water"),
    ("condenser_pump_3",  "cooling_tower_2", "condenser_water"),
    # Towers → chillers (heat rejection)
    ("cooling_tower_1",   "chiller_1",       "condenser_water"),
    ("cooling_tower_2",   "chiller_2",       "condenser_water"),
    # Pumps → chillers (direct condenser line)
    ("condenser_pump_1",  "chiller_1",       "condenser_water"),
    ("condenser_pump_3",  "chiller_2",       "condenser_water"),
]


def _band(kw_per_tr: float | None) -> str:
    if kw_per_tr is None: return "unknown"
    if kw_per_tr < BAND_GOOD: return "good"
    if kw_per_tr < BAND_POOR: return "acceptable"
    return "poor"


@router.get("/topology")
@limiter.limit("30/minute")
async def get_topology(
    request: Request,
    hours: int = Query(default=1, ge=1, le=72),
    db: AsyncSession = Depends(get_db),
):
    nodes = []
    for eq in EQUIPMENT_CATALOG:
        if eq["type"] == "chiller":
            rows = await fetch_chiller_data(db, eq["table"], hours=hours)
            kw_tr = next((r["kw_per_tr"] for r in reversed(rows) if r.get("kw_per_tr") is not None), None)
            running = next((bool(r["is_running"]) for r in reversed(rows) if r.get("is_running") is not None), False)
            kw      = next((r["kw"]         for r in reversed(rows) if r.get("kw") is not None), None)
            band    = _band(kw_tr)
        else:
            cols = COOLING_TOWER_COLS if eq["type"] == "cooling_tower" else PUMP_COLS
            rows = await fetch_equipment_data(db, eq["table"], cols, hours=hours)
            kw_tr   = None
            running = next((bool(r["is_running"]) for r in reversed(rows) if r.get("is_running") is not None), False)
            kw      = next((r["kw"]         for r in reversed(rows) if r.get("kw") is not None), None)
            band    = "unknown"

        nodes.append({
            "id":         eq["id"],
            "name":       eq["name"],
            "type":       eq["type"],
            "running":    running,
            "kw":         kw,
            "kw_per_tr":  kw_tr,
            "band":       band,
            "data_points": len(rows),
        })

    edges = [
        {"source": s, "target": t, "kind": k}
        for s, t, k in _PLANT_EDGES
    ]
    return {
        "nodes": nodes,
        "edges": edges,
        "hours": hours,
    }
