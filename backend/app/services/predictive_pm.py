"""Predictive-PM proposer — shared by the POST /predictive/run endpoint and the
daily cron (jobs/predictive_pm.py).

For each chiller, run trend detection (analytics/degradation.py); for every
degrading signal, propose a deduped PM work order grounded in the trend numbers
and a manual snippet (RAG). Proposes only — a human approves/works it.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.rag import retrieve
from app.analytics.degradation import analyze_chiller_degradation
from app.db.models import WorkOrder
from app.db.telemetry import fetch_bucket_series
from app.domain.equipment import EQUIPMENT_CATALOG
from app.log import get_logger
from app.services import work_orders as wo_svc

log = get_logger("services.predictive_pm")

_BUCKET_SECS = 900

_ACTIONS = {
    "kw_per_tr": (
        "Inspect condenser tubes/strainer for fouling, verify refrigerant charge, "
        "and check CHW ΔT / flow before efficiency degrades further."
    ),
    "condenser_approach": (
        "Rising condenser approach indicates fouling/scaling — schedule chemical "
        "cleaning of the condenser tubes."
    ),
}


async def fetch_points(db: AsyncSession, table: str, days: int) -> list[dict]:
    return await fetch_bucket_series(db, table, "chiller", hours=days * 24, bucket_secs=_BUCKET_SECS)


async def _has_open(pg: AsyncSession, equipment_id: str, source_ref: str) -> bool:
    stmt = (
        select(WorkOrder)
        .where(WorkOrder.source == "pm")
        .where(WorkOrder.source_ref == source_ref)
        .where(WorkOrder.equipment_id == equipment_id)
        .where(WorkOrder.state.in_(["open", "assigned", "in_progress"]))
        .limit(1)
    )
    return (await pg.execute(stmt)).scalar() is not None


async def _manual_hint(pg: AsyncSession, equipment_id: str, query: str) -> str | None:
    try:
        chunks = await retrieve(pg, query, top_k=1, equipment_id=equipment_id)
    except Exception:
        return None
    if not chunks:
        return None
    c = chunks[0]
    return f"Ref [{c.source_id} §{c.chunk_idx}]: {c.content.strip()[:240]}"


async def scan_and_propose(db: AsyncSession, pg: AsyncSession, *, days: int = 14) -> dict:
    created, skipped = [], []
    chillers = [e for e in EQUIPMENT_CATALOG if e["type"] == "chiller"]
    for eq in chillers:
        points = await fetch_points(db, eq["table"], days)
        signals = analyze_chiller_degradation(eq["id"], eq["name"], points, bucket_secs=_BUCKET_SECS)
        for s in (sig for sig in signals if sig.degrading):
            ref = f"predictive:{s.metric}"
            if await _has_open(pg, eq["id"], ref):
                skipped.append({"equipment_id": eq["id"], "metric": s.metric, "reason": "open PM exists"})
                continue
            hint = await _manual_hint(pg, eq["id"], f"{eq['name']} {s.metric} degradation maintenance")
            actions = _ACTIONS.get(s.metric, "Inspect the asset.")
            if hint:
                actions = f"{actions}\n{hint}"
            wo = await wo_svc.create_work_order(
                pg,
                title=f"Predictive PM — {eq['name']} {s.metric} drift",
                description=s.summary,
                equipment_id=eq["id"],
                priority="high" if s.severity == "critical" else "normal",
                source="pm",
                source_ref=ref,
                diagnosis=s.summary,          # numeric-grounded by construction
                recommended_actions=actions,
                created_by="predictive",
            )
            created.append({"equipment_id": eq["id"], "metric": s.metric, "severity": s.severity, "wo_id": wo.id})
    log.info("predictive_scan created=%s skipped=%s days=%s", len(created), len(skipped), days)
    return {"created": created, "skipped": skipped, "created_count": len(created)}
