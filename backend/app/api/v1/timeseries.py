"""
Timeseries endpoint.

Time-window anchor strategy:
  For databases with historical (non-live) data, queries anchored at
  datetime.utcnow() return nothing because "now" is past all the data.
  Instead we use MAX(slot_time) from the table as the window end, then
  subtract `hours` from that. Controlled by TELEMETRY_TIME_ANCHOR env var
  (default: latest_in_db).
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.config import settings
from app.db.session import get_db
from app.db.telemetry import CHILLER_COLS, COOLING_TOWER_COLS, PUMP_COLS
from app.domain.equipment import get_by_id
from app.log import get_logger

router = APIRouter()
log = get_logger("api.timeseries")

_COLS_BY_TYPE = {
    "chiller":       CHILLER_COLS,
    "cooling_tower": COOLING_TOWER_COLS,
    "pump":          PUMP_COLS,
}

_RESOLUTION_MINUTES = {"1m": 1, "5m": 5, "15m": 15, "1h": 60}


async def _window_end(db: AsyncSession, table: str) -> datetime:
    """
    Return the end of the query window.

    latest_in_db: use MAX(slot_time) from the table — correct for historical dumps
                  where the latest row may be months in the past.
    wall_clock:   use datetime.utcnow() — correct for live feeds.
    """
    if settings.TELEMETRY_TIME_ANCHOR == "latest_in_db":
        try:
            result = await db.execute(text(f"SELECT MAX(slot_time) AS mx FROM {table}"))
            row = result.mappings().first()
            if row and row["mx"] is not None:
                return row["mx"]
        except Exception as e:
            log.warning("window_end_fallback table=%s err=%s", table, e)
    return datetime.utcnow()


def _serialize_row(row: dict) -> dict:
    out = {}
    for k, v in row.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, bool):
            out[k] = v
        elif v is not None and hasattr(v, "__float__") and not isinstance(v, (bytes, str)):
            try:
                out[k] = float(v)
            except (TypeError, ValueError):
                out[k] = v
        else:
            out[k] = v
    return out


@router.get("/equipment/{equipment_id}/timeseries")
async def get_timeseries(
    equipment_id: str,
    hours: int       = Query(default=24, ge=1, le=8760),
    resolution: str  = Query(default="15m", pattern="^(1m|5m|15m|1h)$"),
    db: AsyncSession = Depends(get_db),
):
    eq = get_by_id(equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail=f"Unknown equipment: {equipment_id}")

    table   = eq["table"]
    until   = await _window_end(db, table)
    since   = until - timedelta(hours=hours)
    res_min = _RESOLUTION_MINUTES[resolution]
    limit   = min((hours * 60) // res_min + 1, 2000)

    log.debug(
        "timeseries_query eq=%s since=%s until=%s resolution=%s limit=%s",
        equipment_id, since, until, resolution, limit,
    )

    try:
        if res_min == 1:
            result = await db.execute(
                text(
                    f"SELECT {_COLS_BY_TYPE[eq['type']]} FROM {table}"
                    f" WHERE slot_time >= :since ORDER BY slot_time ASC LIMIT :limit"
                ),
                {"since": since, "limit": limit},
            )
        else:
            bucket_secs = res_min * 60
            bucket_expr = (
                f"FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(slot_time)/{bucket_secs})*{bucket_secs})"
            )
            extra = (
                "AVG(tr) AS tr, AVG(kw_per_tr) AS kw_per_tr,"
                " AVG(chw_delta_t) AS chw_delta_t, AVG(chiller_load) AS chiller_load,"
                " AVG(evap_leaving_temp) AS evap_leaving_temp,"
                " AVG(cond_leaving_temp) AS cond_leaving_temp, AVG(ambient_temp) AS ambient_temp"
                if eq["type"] == "chiller"
                else "AVG(kwh) AS kwh, AVG(run_hours) AS run_hours"
            )
            result = await db.execute(
                text(
                    f"SELECT {bucket_expr} AS slot_time,"
                    f" AVG(kw) AS kw, {extra}, MAX(is_running) AS is_running"
                    f" FROM {table} WHERE slot_time >= :since"
                    f" GROUP BY {bucket_expr}"
                    f" ORDER BY {bucket_expr} ASC"   # explicit expr — avoids alias/column name clash
                    f" LIMIT :limit"
                ),
                {"since": since, "limit": limit},
            )

        points = [_serialize_row(dict(r)) for r in result.mappings().all()]

    except Exception as e:
        log.exception("timeseries_query_failed eq=%s", equipment_id)
        raise HTTPException(status_code=503, detail=f"Query failed: {e}")

    return {
        "equipment_id": equipment_id,
        "name":         eq["name"],
        "type":         eq["type"],
        "from":         since.isoformat(),
        "to":           until.isoformat(),
        "hours":        hours,
        "resolution":   resolution,
        "count":        len(points),
        "points":       points,
    }
