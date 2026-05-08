from datetime import datetime, timedelta
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


NORMALIZED_TABLES = {
    "chiller_1": "chiller_1_normalized",
    "chiller_2": "chiller_2_normalized",
    "cooling_tower_1": "cooling_tower_1_normalized",
    "cooling_tower_2": "cooling_tower_2_normalized",
    "condenser_pump_1": "condenser_pump_0102_normalized",
    "condenser_pump_3": "condenser_pump_03_normalized",
}

CHILLER_COLS = (
    "slot_time, is_running, kw, tr, kw_per_tr, evap_entering_temp, evap_leaving_temp, "
    "chw_delta_t, cond_entering_temp, cond_leaving_temp, ambient_temp, chiller_load, kwh, trh"
)

COOLING_TOWER_COLS = (
    "slot_time, is_running, kw, kwh, cumulative_kwh, run_hours"
)

PUMP_COLS = (
    "slot_time, is_running, kw, kwh, cumulative_kwh, run_hours"
)


async def fetch_chiller_data(db: AsyncSession, table: str, hours: int = 24) -> list[dict]:
    since = datetime.utcnow() - timedelta(hours=hours)
    query = text(
        f"SELECT {CHILLER_COLS} FROM {table} "
        f"WHERE slot_time >= :since ORDER BY slot_time DESC LIMIT 96"
    )
    result = await db.execute(query, {"since": since})
    rows = result.mappings().all()
    return [dict(r) for r in rows]


async def fetch_equipment_data(db: AsyncSession, table: str, cols: str, hours: int = 24) -> list[dict]:
    since = datetime.utcnow() - timedelta(hours=hours)
    query = text(
        f"SELECT {cols} FROM {table} "
        f"WHERE slot_time >= :since ORDER BY slot_time DESC LIMIT 96"
    )
    result = await db.execute(query, {"since": since})
    rows = result.mappings().all()
    return [dict(r) for r in rows]


async def fetch_all_hvac_context(db: AsyncSession, hours: int = 24) -> dict[str, Any]:
    chiller1 = await fetch_chiller_data(db, "chiller_1_normalized", hours)
    chiller2 = await fetch_chiller_data(db, "chiller_2_normalized", hours)
    ct1 = await fetch_equipment_data(db, "cooling_tower_1_normalized", COOLING_TOWER_COLS, hours)
    ct2 = await fetch_equipment_data(db, "cooling_tower_2_normalized", COOLING_TOWER_COLS, hours)
    cp1 = await fetch_equipment_data(db, "condenser_pump_0102_normalized", PUMP_COLS, hours)
    cp3 = await fetch_equipment_data(db, "condenser_pump_03_normalized", PUMP_COLS, hours)

    return {
        "chiller_1": chiller1,
        "chiller_2": chiller2,
        "cooling_tower_1": ct1,
        "cooling_tower_2": ct2,
        "condenser_pump_1": cp1,
        "condenser_pump_3": cp3,
        "fetched_at": datetime.utcnow().isoformat(),
        "hours_window": hours,
    }


async def compute_summary(data: dict[str, Any]) -> dict[str, Any]:
    def _avg(rows: list[dict], key: str) -> float | None:
        vals = [float(r[key]) for r in rows if r.get(key) is not None]
        return round(sum(vals) / len(vals), 3) if vals else None

    def _latest(rows: list[dict], key: str) -> Any:
        for r in rows:
            if r.get(key) is not None:
                return r[key]
        return None

    def _running_pct(rows: list[dict]) -> float | None:
        if not rows:
            return None
        running = sum(1 for r in rows if r.get("is_running"))
        return round(running / len(rows) * 100, 1)

    summary: dict[str, Any] = {}

    for name in ["chiller_1", "chiller_2"]:
        rows = data.get(name, [])
        summary[name] = {
            "record_count": len(rows),
            "running_pct": _running_pct(rows),
            "avg_kw": _avg(rows, "kw"),
            "avg_tr": _avg(rows, "tr"),
            "avg_kw_per_tr": _avg(rows, "kw_per_tr"),
            "avg_chw_delta_t": _avg(rows, "chw_delta_t"),
            "avg_chiller_load": _avg(rows, "chiller_load"),
            "latest_ambient_temp": _latest(rows, "ambient_temp"),
            "latest_evap_leaving_temp": _latest(rows, "evap_leaving_temp"),
        }

    for name in ["cooling_tower_1", "cooling_tower_2"]:
        rows = data.get(name, [])
        summary[name] = {
            "record_count": len(rows),
            "running_pct": _running_pct(rows),
            "avg_kw": _avg(rows, "kw"),
        }

    for name in ["condenser_pump_1", "condenser_pump_3"]:
        rows = data.get(name, [])
        summary[name] = {
            "record_count": len(rows),
            "running_pct": _running_pct(rows),
            "avg_kw": _avg(rows, "kw"),
        }

    return summary


async def check_db_health(db: AsyncSession) -> bool:
    try:
        await db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
