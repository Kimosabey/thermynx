"""Unified alarms feed.

Reads anomaly events and maintenance degradation reasons from existing
analyzers and merges them into a single operator-facing stream with a
3-tier severity (`info` / `warning` / `critical`). Pure synthesis — no
new tables, no writes — so it remains a thin read-only layer over the
authoritative analytics.

Endpoints
---------
GET /api/v1/alarms        — list (filterable by severity, equipment, hours)
GET /api/v1/alarms/stats  — counts grouped by severity + by equipment
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.anomaly import (
    CHILLER_METRICS,
    TOWER_PUMP_METRICS,
    detect_anomalies,
)
from app.analytics.maintenance import analyze_asset_maintenance
from app.db.session import get_db
from app.db.telemetry import (
    COOLING_TOWER_COLS,
    PUMP_COLS,
    fetch_bucket_series,
    fetch_chiller_data,
    fetch_equipment_data,
)
from app.domain.equipment import EQUIPMENT_CATALOG
from app.limiter import limiter
from app.services import cache as cache_svc

router = APIRouter()

_ALARMS_TTL = 30
_MAINT_BUCKET_SECS = 900

Severity = Literal["info", "warning", "critical"]


def _anomaly_severity(z: float) -> Severity:
    a = abs(z)
    if a >= 4.0:
        return "critical"
    if a >= 3.0:
        return "warning"
    return "info"


def _health_severity(health_score: int) -> Severity:
    if health_score < 50:
        return "critical"
    if health_score < 75:
        return "warning"
    return "info"


async def _collect_alarms(db: AsyncSession, hours: int) -> list[dict]:
    out: list[dict] = []

    # ---- Anomaly-based alarms (z-score) ----
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
        for e in events:
            d = asdict(e)
            out.append({
                "id":             f"anom:{eq['id']}:{d.get('metric')}:{d.get('timestamp','')}",
                "kind":           "anomaly",
                "equipment_id":   eq["id"],
                "equipment_name": eq["name"],
                "metric":         d.get("metric"),
                "severity":       _anomaly_severity(d.get("z_score", 0.0)),
                "value":          d.get("value"),
                "z_score":        d.get("z_score"),
                "timestamp":      d.get("timestamp"),
                "message":        f"{eq['name']} {d.get('metric')} = {d.get('value')} (z={d.get('z_score',0):.2f})",
            })

    # ---- Maintenance degradation alarms ----
    for eq in EQUIPMENT_CATALOG:
        points = await fetch_bucket_series(db, eq["table"], eq["type"], hours=hours, bucket_secs=_MAINT_BUCKET_SECS)
        m = analyze_asset_maintenance(eq["id"], eq["name"], eq["type"], points, bucket_secs=_MAINT_BUCKET_SECS)
        if not m.degradation_flag and m.health_score >= 75:
            continue
        for reason in (m.degradation_reasons or []):
            out.append({
                "id":             f"maint:{eq['id']}:{hash(reason) & 0xFFFFFF:06x}",
                "kind":           "maintenance",
                "equipment_id":   eq["id"],
                "equipment_name": eq["name"],
                "metric":         "health_score",
                "severity":       _health_severity(m.health_score),
                "value":          m.health_score,
                "z_score":        None,
                "timestamp":      None,
                "message":        f"{eq['name']}: {reason} (health {m.health_score}/100)",
            })

    # Sort: critical first, then warning, then info; within tier, anomaly first
    SEV_RANK = {"critical": 0, "warning": 1, "info": 2}
    out.sort(key=lambda a: (SEV_RANK.get(a["severity"], 9), 0 if a["kind"] == "anomaly" else 1))
    return out


@router.get("/alarms")
@limiter.limit("60/minute")
async def list_alarms(
    request: Request,
    hours: int = Query(default=1, ge=1, le=168),
    severity: Severity | None = Query(default=None),
    equipment_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    async def _fetch():
        return await _collect_alarms(db, hours)

    alarms = await cache_svc.get_or_set(f"alarms:h={hours}", _ALARMS_TTL, _fetch)
    filtered = alarms
    if severity:
        filtered = [a for a in filtered if a["severity"] == severity]
    if equipment_id:
        filtered = [a for a in filtered if a["equipment_id"] == equipment_id]
    return {
        "alarms": filtered[:limit],
        "total":  len(filtered),
        "hours":  hours,
    }


@router.get("/alarms/stats")
@limiter.limit("60/minute")
async def alarms_stats(
    request: Request,
    hours: int = Query(default=1, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    async def _fetch():
        return await _collect_alarms(db, hours)

    alarms = await cache_svc.get_or_set(f"alarms:h={hours}", _ALARMS_TTL, _fetch)
    by_sev: dict[str, int]  = {"critical": 0, "warning": 0, "info": 0}
    by_eq:  dict[str, int]  = {}
    by_kind: dict[str, int] = {"anomaly": 0, "maintenance": 0}
    for a in alarms:
        by_sev[a["severity"]]  = by_sev.get(a["severity"], 0) + 1
        by_eq[a["equipment_id"]] = by_eq.get(a["equipment_id"], 0) + 1
        by_kind[a["kind"]] = by_kind.get(a["kind"], 0) + 1
    return {
        "total":      len(alarms),
        "by_severity": by_sev,
        "by_kind":     by_kind,
        "by_equipment": by_eq,
        "hours":       hours,
    }