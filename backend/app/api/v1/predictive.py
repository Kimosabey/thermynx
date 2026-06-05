"""Predictive maintenance API — trend-based degradation + auto-proposed PM.

  GET  /predictive/degradation?days=  — per-chiller drift signals (read-only,
       with a short grounded narrative for the page)
  POST /predictive/run?days=          — propose deduped PM work orders for
       degrading assets (delegates to services.predictive_pm). Human approves.

Trend math is deterministic (analytics/degradation.py); the LLM only narrates.
"""
from dataclasses import asdict

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.degradation import analyze_chiller_degradation
from app.config import settings
from app.db.session import get_db, get_pg
from app.domain.equipment import EQUIPMENT_CATALOG
from app.limiter import limiter
from app.llm.ollama import chat
from app.log import get_logger
from app.services.predictive_pm import fetch_points, scan_and_propose

router = APIRouter()
log = get_logger("api.predictive")

_BUCKET_SECS = 900

PREDICTIVE_SYSTEM = (
    "You are THERMYNX, an HVAC operations assistant. In 1-2 sentences, explain a "
    "predictive-maintenance trend to an operator. OUTPUT ENGLISH ONLY. Use ONLY "
    "the numbers provided — never invent figures. Plain text, no markdown."
)


def _sev_rank(s) -> int:
    return {"none": 0, "watch": 1, "warning": 2, "critical": 3}.get(s.severity, 0)


async def _narrate(signal) -> str | None:
    try:
        resp = await chat(
            [
                {"role": "system", "content": PREDICTIVE_SYSTEM},
                {"role": "user", "content": f"{signal.name}: {signal.summary} (severity {signal.severity})."},
            ],
            model=settings.OLLAMA_MODEL_TEXT or settings.OLLAMA_DEFAULT_MODEL,
            num_predict=settings.OLLAMA_MAX_TOKENS_REPORT,
        )
        return ((resp.get("message") or {}).get("content") or "").strip() or None
    except Exception as exc:
        log.warning("predictive_narrate_failed err=%s", exc)
        return None


@router.get("/predictive/degradation")
@limiter.limit("30/minute")
async def degradation(
    request: Request,
    days: int = Query(default=14, ge=2, le=120),
    narrate: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
):
    chillers = [e for e in EQUIPMENT_CATALOG if e["type"] == "chiller"]
    assets = []
    for eq in chillers:
        points = await fetch_points(db, eq["table"], days)
        signals = analyze_chiller_degradation(eq["id"], eq["name"], points, bucket_secs=_BUCKET_SECS)
        worst = next((s for s in sorted(signals, key=_sev_rank, reverse=True) if s.degrading), None)
        narrative = await _narrate(worst) if (narrate and worst) else None
        assets.append({
            "equipment_id": eq["id"],
            "name": eq["name"],
            "signals": [asdict(s) for s in signals],
            "degrading": bool(worst),
            "narrative": narrative,
        })
    return {"days": days, "assets": assets, "degrading_count": sum(1 for a in assets if a["degrading"])}


@router.post("/predictive/run")
@limiter.limit("6/minute")
async def run_predictive(
    request: Request,
    days: int = Query(default=14, ge=2, le=120),
    db: AsyncSession = Depends(get_db),
    pg: AsyncSession = Depends(get_pg),
):
    return await scan_and_propose(db, pg, days=days)
