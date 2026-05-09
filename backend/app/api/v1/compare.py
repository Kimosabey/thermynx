from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.telemetry import fetch_chiller_data, fetch_equipment_data, COOLING_TOWER_COLS, PUMP_COLS, compute_summary
from app.domain.equipment import get_by_id
from app.analytics.efficiency import analyze_chiller_efficiency

router = APIRouter()


@router.get("/compare")
async def compare_equipment(
    a: str = Query(..., description="First equipment ID"),
    b: str = Query(..., description="Second equipment ID"),
    hours: int = Query(default=24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    eq_a = get_by_id(a)
    eq_b = get_by_id(b)
    if not eq_a:
        raise HTTPException(status_code=404, detail=f"Unknown equipment: {a}")
    if not eq_b:
        raise HTTPException(status_code=404, detail=f"Unknown equipment: {b}")

    async def fetch(eq):
        if eq["type"] == "chiller":
            return await fetch_chiller_data(db, eq["table"], hours=hours)
        cols = COOLING_TOWER_COLS if eq["type"] == "cooling_tower" else PUMP_COLS
        return await fetch_equipment_data(db, eq["table"], cols, hours=hours)

    rows_a = await fetch(eq_a)
    rows_b = await fetch(eq_b)

    # Summary stats for both
    ctx = {a: rows_a, b: rows_b}
    summary = await compute_summary(ctx)

    # Efficiency analysis if both are chillers
    eff_a = eff_b = None
    if eq_a["type"] == "chiller":
        from dataclasses import asdict
        eff_a = asdict(analyze_chiller_efficiency(a, eq_a["name"], rows_a))
    if eq_b["type"] == "chiller":
        from dataclasses import asdict
        eff_b = asdict(analyze_chiller_efficiency(b, eq_b["name"], rows_b))

    # Build timeseries for overlay chart (thinned to 200 points each)
    def thin(rows, max_pts=200):
        step = max(1, len(rows) // max_pts)
        return [
            {k: (v.isoformat() if hasattr(v, "isoformat") else (float(v) if hasattr(v, "__float__") else v))
             for k, v in row.items()}
            for i, row in enumerate(reversed(rows)) if i % step == 0
        ]

    return {
        "a": {
            "id": a,
            "name": eq_a["name"],
            "type": eq_a["type"],
            "summary": summary.get(a, {}),
            "efficiency": eff_a,
            "timeseries": thin(rows_a),
        },
        "b": {
            "id": b,
            "name": eq_b["name"],
            "type": eq_b["type"],
            "summary": summary.get(b, {}),
            "efficiency": eff_b,
            "timeseries": thin(rows_b),
        },
        "hours": hours,
    }
