"""Read-only energy aggregation over the unicharm energy_*_analytics tables.

energy_{hourly,daily,weekly}_analytics carry per-device energy_kwh. We roll it
up by device and by device_type over a window, and apply the effective tariff
(Postgres tariff_schedule overlay, falling back to the flat config rate) for
cost. unicharm stays READ-ONLY.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

# period -> (table, time column)
_PERIOD = {
    "hourly": ("energy_hourly_analytics", "hour_start"),
    "daily":  ("energy_daily_analytics",  "day_date"),
    "weekly": ("energy_weekly_analytics", "week_start"),
}


async def usage(db: AsyncSession, *, period: str = "daily", days: int = 7,
                device_type: str | None = None) -> dict[str, Any]:
    """kWh rolled up by device and by device_type over the last `days`."""
    table, tcol = _PERIOD.get(period, _PERIOD["daily"])
    max_t = (await db.execute(text(f"SELECT MAX({tcol}) FROM {table}"))).scalar()
    if max_t is None:
        return {"period": period, "days": days, "window_from": None,
                "by_device": [], "by_type": [], "total_kwh": 0.0}
    since = max_t - timedelta(days=days)

    params: dict[str, Any] = {"since": since}
    type_clause = ""
    if device_type:
        type_clause = " AND device_type = :dt"
        params["dt"] = device_type

    by_device = (await db.execute(text(f"""
        SELECT device_id, MAX(device_name) AS name, device_type, SUM(energy_kwh) AS kwh
        FROM {table} WHERE {tcol} >= :since {type_clause}
        GROUP BY device_id, device_type ORDER BY kwh DESC
    """), params)).mappings().all()

    by_type = (await db.execute(text(f"""
        SELECT device_type, SUM(energy_kwh) AS kwh
        FROM {table} WHERE {tcol} >= :since {type_clause}
        GROUP BY device_type ORDER BY kwh DESC
    """), params)).mappings().all()

    total = round(sum(float(r["kwh"] or 0) for r in by_type), 2)
    return {
        "period":      period,
        "days":        days,
        "window_from": since.isoformat(),
        "by_device":   [{"device_id": r["device_id"], "name": r["name"],
                         "device_type": r["device_type"], "kwh": round(float(r["kwh"] or 0), 2)} for r in by_device],
        "by_type":     [{"device_type": r["device_type"], "kwh": round(float(r["kwh"] or 0), 2)} for r in by_type],
        "total_kwh":   total,
    }


async def effective_rate(pg: AsyncSession) -> tuple[float, str]:
    """Current ₹/kWh: latest active tariff_schedule row covering now, else flat config.
    Returns (rate, source). Imported here lazily to avoid a hard model dep at import."""
    try:
        from app.db.models import TariffSchedule
        now = datetime.utcnow()
        row = (await pg.execute(
            select(TariffSchedule)
            .where(TariffSchedule.active == 1)
            .where((TariffSchedule.effective_from.is_(None)) | (TariffSchedule.effective_from <= now))
            .where((TariffSchedule.effective_to.is_(None)) | (TariffSchedule.effective_to >= now))
            .order_by(TariffSchedule.effective_from.desc())
        )).scalars().first()
        if row and row.rate_inr_per_kwh:
            return float(row.rate_inr_per_kwh), f"schedule:{row.label or row.id}"
    except Exception:
        pass
    return float(settings.TARIFF_INR_PER_KWH), "flat_config"


def apply_cost(usage_payload: dict[str, Any], rate: float, source: str) -> dict[str, Any]:
    """Attach ₹ cost to a usage() payload."""
    out = dict(usage_payload)
    out["tariff_inr_per_kwh"] = rate
    out["tariff_source"] = source
    out["by_device"] = [{**d, "cost_inr": round(d["kwh"] * rate, 2)} for d in usage_payload["by_device"]]
    out["by_type"] = [{**t, "cost_inr": round(t["kwh"] * rate, 2)} for t in usage_payload["by_type"]]
    out["total_cost_inr"] = round(usage_payload["total_kwh"] * rate, 2)
    return out
