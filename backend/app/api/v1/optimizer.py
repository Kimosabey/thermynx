"""Energy optimizer API — chiller staging recommendation + what-if.

  GET /optimizer/staging?hours=&target_tr=
      Build empirical efficiency profiles from history, recommend the
      lowest-energy chiller staging for the target cooling demand (defaults to
      observed current demand; pass target_tr to run a what-if), and narrate it.

The optimization math is deterministic (app/analytics/staging.py). The LLM only
narrates. Any actual staging change is surfaced as a human-approved work-order
proposal — this endpoint never changes the plant.
"""
from dataclasses import asdict

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.staging import build_profile, optimize_staging
from app.config import settings
from app.db.session import get_db
from app.db.telemetry import fetch_chiller_data
from app.domain.equipment import EQUIPMENT_CATALOG
from app.limiter import limiter
from app.llm.ollama import chat
from app.log import get_logger

router = APIRouter()
log = get_logger("api.optimizer")

_PROFILE_LIMIT = 5000  # rows per chiller for building the load profile

OPTIMIZER_SYSTEM = (
    "You are THERMYNX, an HVAC operations assistant. In 2-3 sentences, explain a "
    "chiller staging recommendation to a plant operator. OUTPUT ENGLISH ONLY. "
    "Use ONLY the numbers given — never invent figures. Be concrete about the "
    "energy/cost difference and the action to take. Plain text, no markdown."
)


def _proposed_work_order(result: dict) -> dict | None:
    """Build a human-approvable WO proposal when a staging change saves energy."""
    rec = result.get("recommended")
    if not rec or not result.get("savings_kw") or result["savings_kw"] <= 0:
        return None
    if set(rec["chillers"]) == set(result.get("current_chillers", [])):
        return None
    eq = rec["chillers"][0] if rec["chillers"] else None
    return {
        "title": f"Restage chillers → {rec['label']}",
        "equipment_id": eq,
        "priority": "normal",
        "source": "agent",
        "diagnosis": (
            f"At ~{result['target_tr']} TR demand, staging '{rec['label']}' is predicted to draw "
            f"{rec['est_kw']} kW vs {result['current_est_kw']} kW currently — "
            f"~{result['savings_kw']} kW (₹{result['savings_inr_per_hr']}/h) lower."
        ),
        "recommended_actions": f"Operator to confirm and switch staging to: {rec['label']}.",
    }


async def _narrate(result: dict) -> str | None:
    rec = result.get("recommended")
    if not rec:
        return None
    msg = (
        f"Target cooling demand: {result['target_tr']} TR ({result['target_source']}).\n"
        f"Currently running: {', '.join(result['current_chillers']) or 'none'} "
        f"(est {result['current_est_kw']} kW).\n"
        f"Recommended: {rec['label']} (est {rec['est_kw']} kW).\n"
        f"Savings: {result['savings_kw']} kW, {result['savings_pct']}%, "
        f"₹{result['savings_inr_per_hr']}/h.\n"
    )
    try:
        resp = await chat(
            [
                {"role": "system", "content": OPTIMIZER_SYSTEM},
                {"role": "user", "content": msg},
            ],
            model=settings.OLLAMA_MODEL_TEXT or settings.OLLAMA_DEFAULT_MODEL,
            num_predict=settings.OLLAMA_MAX_TOKENS_REPORT,
        )
        return ((resp.get("message") or {}).get("content") or "").strip() or None
    except Exception as exc:
        log.warning("optimizer_narrate_failed err=%s", exc)
        return None


@router.get("/optimizer/staging")
@limiter.limit("30/minute")
async def staging(
    request: Request,
    hours: int = Query(default=72, ge=6, le=8760),
    target_tr: float | None = Query(default=None, ge=0, le=100000),
    db: AsyncSession = Depends(get_db),
):
    chillers = [e for e in EQUIPMENT_CATALOG if e["type"] == "chiller"]
    profiles = []
    for eq in chillers:
        rows = await fetch_chiller_data(db, eq["table"], hours=hours, limit=_PROFILE_LIMIT)
        profiles.append(build_profile(eq["id"], eq["name"], rows))

    result = optimize_staging(
        profiles, target_tr=target_tr, tariff_inr_per_kwh=settings.TARIFF_INR_PER_KWH
    )
    payload = asdict(result)
    payload["hours"] = hours
    payload["narrative"] = await _narrate(payload)
    payload["proposed_work_order"] = _proposed_work_order(payload)
    log.info(
        "staging_optimized target_tr=%s rec=%s savings_kw=%s",
        payload["target_tr"],
        payload["recommended"]["label"] if payload["recommended"] else None,
        payload["savings_kw"],
    )
    return payload
