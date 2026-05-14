"""
MySQL read-only queries against unicharm normalized tables.
All functions accept an AsyncSession from MySQLSession.

For historical dumps, ``latest_in_db`` uses each table's ``MAX(slot_time)`` as the window
end (see ``resolve_telemetry_until``); plant-wide max is only used for UI hints.
"""
from datetime import datetime, timedelta
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.config import settings


def check_data_freshness(latest: datetime | None) -> str | None:
    """
    Returns a warning string if the most recent row is stale.
    Only fires in wall_clock mode — in latest_in_db mode staleness is expected.
    """
    if settings.TELEMETRY_TIME_ANCHOR != "wall_clock":
        return None
    if latest is None:
        return "No telemetry data found in the database."
    delta_min = int((datetime.utcnow() - latest).total_seconds() / 60)
    if delta_min > 30:
        return f"Last telemetry update was {delta_min} min ago — readings may be stale."
    return None


NORMALIZED_TABLES = {
    "chiller_1":        "chiller_1_normalized",
    "chiller_2":        "chiller_2_normalized",
    "cooling_tower_1":  "cooling_tower_1_normalized",
    "cooling_tower_2":  "cooling_tower_2_normalized",
    "condenser_pump_1": "condenser_pump_0102_normalized",
    "condenser_pump_3": "condenser_pump_03_normalized",
}

_PLANT_NORMALIZED_TABLES: tuple[str, ...] = tuple(sorted(set(NORMALIZED_TABLES.values())))

CHILLER_COLS = (
    "slot_time, is_running, kw, tr, kw_per_tr, evap_entering_temp, evap_leaving_temp, "
    "chw_delta_t, cond_entering_temp, cond_leaving_temp, ambient_temp, chiller_load, kwh, trh"
)

# Core columns present on all normalized tower tables. Optional analytics columns
# (`wet_bulb_c`, `cell_count`) are documented in DATA_DICTIONARY but not assumed —
# add them upstream before extending queries here.
COOLING_TOWER_COLS = "slot_time, is_running, kw, kwh, cumulative_kwh, run_hours"

PUMP_COLS = "slot_time, is_running, kw, kwh, cumulative_kwh, run_hours"


async def fetch_table_latest_slot_time(db: AsyncSession, table: str) -> datetime | None:
    """Latest ``slot_time`` in one normalized table."""
    result = await db.execute(text(f"SELECT MAX(slot_time) AS mx FROM {table}"))
    row = result.mappings().first()
    if not row or row["mx"] is None:
        return None
    return row["mx"]


async def fetch_plant_latest_slot_time(db: AsyncSession) -> datetime | None:
    """Latest ``slot_time`` anywhere in the plant (all normalized tables; one round-trip)."""
    union_parts = " UNION ALL ".join(
        f"SELECT MAX(slot_time) AS mx FROM {tbl}" for tbl in _PLANT_NORMALIZED_TABLES
    )
    q = f"SELECT MAX(mx) AS latest FROM ({union_parts}) AS bounds"
    result = await db.execute(text(q))
    row = result.mappings().first()
    if not row or row["latest"] is None:
        return None
    return row["latest"]


async def resolve_telemetry_until(db: AsyncSession, *, table: str | None = None) -> datetime:
    """
    End of the telemetry query window for one table (or plant-wide if ``table`` is None).

    - ``latest_in_db`` + ``table``: ``MAX(slot_time)`` **in that table** — correct for older
      dumps where tables may stop at different times (POC default).
    - ``latest_in_db`` + ``table`` omitted: newest row **anywhere** (UI hints / report headers).
    - ``wall_clock``: ``datetime.utcnow()`` (live feeds).
    """
    if settings.TELEMETRY_TIME_ANCHOR == "latest_in_db":
        if table:
            latest = await fetch_table_latest_slot_time(db, table)
        else:
            latest = await fetch_plant_latest_slot_time(db)
        if latest is not None:
            return latest
    return datetime.utcnow()


async def fetch_chiller_data(
    db: AsyncSession,
    table: str,
    hours: int = 24,
    *,
    until: datetime | None = None,
) -> list[dict]:
    if until is None:
        until = await resolve_telemetry_until(db, table=table)
    since = until - timedelta(hours=hours)
    result = await db.execute(
        text(f"SELECT {CHILLER_COLS} FROM {table} WHERE slot_time >= :since ORDER BY slot_time DESC LIMIT 96"),
        {"since": since},
    )
    return [dict(r) for r in result.mappings().all()]


async def fetch_equipment_data(
    db: AsyncSession,
    table: str,
    cols: str,
    hours: int = 24,
    *,
    until: datetime | None = None,
) -> list[dict]:
    if until is None:
        until = await resolve_telemetry_until(db, table=table)
    since = until - timedelta(hours=hours)
    result = await db.execute(
        text(f"SELECT {cols} FROM {table} WHERE slot_time >= :since ORDER BY slot_time DESC LIMIT 96"),
        {"since": since},
    )
    return [dict(r) for r in result.mappings().all()]


async def fetch_all_hvac_context(
    db: AsyncSession,
    hours: int = 24,
    *,
    until: datetime | None = None,
) -> dict[str, Any]:
    """
    When ``until`` is omitted, each asset uses its own table's latest ``slot_time`` under
    ``latest_in_db`` — required when normalized tables end at different timestamps.
    """
    return {
        "chiller_1":        await fetch_chiller_data(db, "chiller_1_normalized", hours, until=until),
        "chiller_2":        await fetch_chiller_data(db, "chiller_2_normalized", hours, until=until),
        "cooling_tower_1":  await fetch_equipment_data(db, "cooling_tower_1_normalized", COOLING_TOWER_COLS, hours, until=until),
        "cooling_tower_2":  await fetch_equipment_data(db, "cooling_tower_2_normalized", COOLING_TOWER_COLS, hours, until=until),
        "condenser_pump_1": await fetch_equipment_data(db, "condenser_pump_0102_normalized", PUMP_COLS, hours, until=until),
        "condenser_pump_3": await fetch_equipment_data(db, "condenser_pump_03_normalized", PUMP_COLS, hours, until=until),
        "fetched_at":       datetime.utcnow().isoformat(),
        "hours_window":     hours,
    }


async def compute_summary(data: dict[str, Any]) -> dict[str, Any]:
    def _avg(rows, key):
        vals = [float(r[key]) for r in rows if r.get(key) is not None]
        return round(sum(vals) / len(vals), 3) if vals else None

    def _latest(rows, key):
        for r in rows:
            if r.get(key) is not None:
                return r[key]
        return None

    def _running_pct(rows):
        if not rows:
            return None
        return round(sum(1 for r in rows if r.get("is_running")) / len(rows) * 100, 1)

    summary: dict[str, Any] = {}
    for name in ["chiller_1", "chiller_2"]:
        rows = data.get(name, [])
        summary[name] = {
            "record_count":         len(rows),
            "running_pct":          _running_pct(rows),
            "avg_kw":               _avg(rows, "kw"),
            "avg_tr":               _avg(rows, "tr"),
            "avg_kw_per_tr":        _avg(rows, "kw_per_tr"),
            "avg_chw_delta_t":      _avg(rows, "chw_delta_t"),
            "avg_chiller_load":     _avg(rows, "chiller_load"),
            "latest_ambient_temp":  _latest(rows, "ambient_temp"),
            "latest_evap_leaving":  _latest(rows, "evap_leaving_temp"),
        }
    for name in ["cooling_tower_1", "cooling_tower_2", "condenser_pump_1", "condenser_pump_3"]:
        rows = data.get(name, [])
        summary[name] = {
            "record_count": len(rows),
            "running_pct":  _running_pct(rows),
            "avg_kw":       _avg(rows, "kw"),
        }
    return summary


_COLS_FOR_AGG = {
    "chiller": CHILLER_COLS,
    "cooling_tower": COOLING_TOWER_COLS,
    "pump": PUMP_COLS,
}


async def fetch_bucket_series(
    db: AsyncSession,
    table: str,
    eq_type: str,
    hours: int = 24,
    bucket_secs: int = 900,
    *,
    until: datetime | None = None,
) -> list[dict]:
    """
    Chronological aggregated points (same bucketing as /timeseries 15m default).
    """
    if until is None:
        until = await resolve_telemetry_until(db, table=table)
    since = until - timedelta(hours=hours)
    limit = min((hours * 3600) // bucket_secs + 2, 2000)
    cols = _COLS_FOR_AGG.get(eq_type, PUMP_COLS)

    if eq_type == "chiller":
        extra = (
            "AVG(tr) AS tr, AVG(kw_per_tr) AS kw_per_tr, AVG(chw_delta_t) AS chw_delta_t, "
            "AVG(chiller_load) AS chiller_load"
        )
    elif eq_type == "cooling_tower":
        extra = "AVG(kwh) AS kwh, AVG(run_hours) AS run_hours"
    else:
        extra = "AVG(kwh) AS kwh, AVG(run_hours) AS run_hours"

    bucket_expr = (
        f"FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(slot_time)/{bucket_secs})*{bucket_secs})"
    )
    result = await db.execute(
        text(
            f"SELECT {bucket_expr} AS slot_time,"
            f" AVG(kw) AS kw, {extra}, MAX(is_running) AS is_running"
            f" FROM {table} WHERE slot_time >= :since"
            f" GROUP BY {bucket_expr}"
            f" ORDER BY slot_time ASC LIMIT :limit"
        ),
        {"since": since, "limit": limit},
    )
    points: list[dict] = []
    for r in result.mappings().all():
        row = dict(r)
        for k, v in list(row.items()):
            if hasattr(v, "__float__") and not isinstance(v, bool):
                try:
                    row[k] = float(v)
                except (TypeError, ValueError):
                    pass
        points.append(row)
    return points
