"""Morning digest service.

Builds a compact, glanceable plant-health summary for the day shift:
  - deterministic KPIs (energy, cost, anomalies, worst chiller) computed from
    the same analytics primitives the Reports page uses, and
  - a short LLM narrative (headline + one recommendation) grounded ONLY in those
    numbers — the model never invents figures.

Used by the daily arq cron (jobs/digest_job.py) and the POST /digest/run
endpoint. Persists a DailyDigest row and (best-effort) posts to Slack.

Design note: this is intentionally *compact* and distinct from /reports/daily,
which produces a full on-demand operations report. The digest is the
auto-scheduled, persisted, push-to-Slack glance card.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.cost import build_plant_cost
from app.config import settings
from app.db.models import DailyDigest
from app.db.telemetry import (
    fetch_all_hvac_context,
    fetch_bucket_series,
    gated_avg_kw_per_tr,
    resolve_telemetry_until,
)
from app.domain.equipment import EQUIPMENT_CATALOG
from app.llm.ollama import chat
from app.log import get_logger
from app.services import slack as slack_svc

log = get_logger("services.digest")

_BUCKET_SECS = 900

DIGEST_SYSTEM = (
    "You are THERMYNX, an HVAC operations assistant for a chiller plant. "
    "Write the operator-facing MORNING DIGEST for the day shift. "
    "OUTPUT ENGLISH ONLY. You are given pre-computed plant numbers — do NOT "
    "invent, estimate, or alter any number; refer only to figures you are given. "
    "Reply as compact JSON with exactly two keys: "
    '"headline" — one sentence (<=22 words) stating the single most important '
    "thing about the last period; and "
    '"recommendation" — one concrete next action for the day shift (<=26 words). '
    "No markdown, no preamble, JSON only."
)


def _build_user_message(kpis: dict) -> str:
    return (
        f"Period: {kpis['period_from']} → {kpis['period_to']} ({kpis['hours']}h)\n"
        f"Plant energy: {kpis['total_kwh']} kWh\n"
        f"Plant cost: ₹{kpis['total_cost_inr']}\n"
        f"Anomalies fired: {kpis['anomaly_count']} ({kpis['critical_count']} critical)\n"
        f"Least-efficient chiller: {kpis['worst_equipment'] or 'n/a'} "
        f"at {kpis['worst_kw_per_tr'] if kpis['worst_kw_per_tr'] is not None else 'n/a'} kW/TR\n"
        f"Top event: {kpis['top_event'] or 'none'}\n"
    )


def _deterministic_narrative(kpis: dict) -> tuple[str, str]:
    """Fallback headline + recommendation when the LLM is unavailable — always
    truthful because it is derived straight from the computed KPIs."""
    crit = kpis["critical_count"]
    anom = kpis["anomaly_count"]
    worst = kpis["worst_equipment"]
    if crit > 0:
        headline = (
            f"{crit} critical anomal{'y' if crit == 1 else 'ies'} in the last "
            f"{kpis['hours']}h — review {worst or 'the plant'} first."
        )
        rec = f"Investigate the critical event on {worst or 'the affected asset'} this morning."
    elif anom > 0:
        headline = (
            f"{anom} anomal{'y' if anom == 1 else 'ies'} flagged; plant used "
            f"{kpis['total_kwh']} kWh (₹{kpis['total_cost_inr']})."
        )
        rec = f"Check {worst or 'the least-efficient chiller'} for efficiency drift."
    else:
        headline = (
            f"No anomalies in the last {kpis['hours']}h; plant used "
            f"{kpis['total_kwh']} kWh (₹{kpis['total_cost_inr']})."
        )
        rec = "Routine shift — confirm setpoints and continue monitoring."
    return headline, rec


def _parse_llm_narrative(content: str) -> tuple[str, str] | None:
    """Best-effort extraction of {"headline", "recommendation"} from model output."""
    if not content:
        return None
    raw = content.strip()
    # Tolerate code fences / surrounding prose by grabbing the first {...} block.
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start : end + 1]
    try:
        obj = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None
    head = (obj.get("headline") or "").strip()
    rec = (obj.get("recommendation") or "").strip()
    if not head:
        return None
    return head, (rec or "Continue monitoring.")


def _serialize(row: DailyDigest) -> dict:
    return {
        "id": row.id,
        "period_from": row.period_from,
        "period_to": row.period_to,
        "hours": row.hours,
        "total_kwh": row.total_kwh,
        "total_cost_inr": row.total_cost_inr,
        "anomaly_count": row.anomaly_count,
        "critical_count": row.critical_count,
        "worst_equipment": row.worst_equipment,
        "worst_kw_per_tr": row.worst_kw_per_tr,
        "headline": row.headline,
        "recommendation": row.recommendation,
        "markdown": row.markdown,
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


async def _compute_kpis(mysql: AsyncSession, pg: AsyncSession, hours: int) -> dict:
    """Deterministic KPI block — no LLM. Reuses the Reports analytics primitives."""
    period_end = await resolve_telemetry_until(mysql, table=None)
    period_start = period_end - timedelta(hours=hours)

    context = await fetch_all_hvac_context(mysql, hours=hours)

    datasets = []
    for eq in EQUIPMENT_CATALOG:
        pts = await fetch_bucket_series(
            mysql, eq["table"], eq["type"], hours=hours, bucket_secs=_BUCKET_SECS
        )
        datasets.append((eq["id"], eq["name"], eq["type"], pts))

    cost = build_plant_cost(
        datasets,
        hours_window=hours,
        tariff_inr_per_kwh=settings.TARIFF_INR_PER_KWH,
        bucket_secs=_BUCKET_SECS,
    )

    # Worst (least-efficient) chiller by LOAD-GATED avg kW/TR — ungated averages
    # are dominated by near-zero-load samples and read as absurd (e.g. 4.5 kW/TR).
    worst_equipment, worst_kw_per_tr = None, None
    for cid in ("chiller_1", "chiller_2"):
        kp = gated_avg_kw_per_tr(context.get(cid, []))
        if kp is None:
            continue
        if worst_kw_per_tr is None or kp > worst_kw_per_tr:
            worst_kw_per_tr, worst_equipment = kp, cid

    # Anomalies — wall-clock window (the scanner persists with server time, which
    # is independent of the telemetry time-anchor used for the energy figures).
    since = datetime.utcnow() - timedelta(hours=hours)
    counts = await pg.execute(
        text(
            "SELECT severity, COUNT(*) AS c FROM anomalies "
            "WHERE created_at >= :since GROUP BY severity"
        ),
        {"since": since},
    )
    by_sev = {row.severity: row.c for row in counts}
    anomaly_count = sum(by_sev.values())
    critical_count = by_sev.get("critical", 0)

    top = await pg.execute(
        text(
            "SELECT equipment_id, metric, z_score, "
            "COALESCE(NULLIF(narrative, ''), NULLIF(description, ''), '') AS note "
            "FROM anomalies WHERE created_at >= :since "
            "ORDER BY ABS(z_score) DESC NULLS LAST LIMIT 1"
        ),
        {"since": since},
    )
    top_row = top.fetchone()
    top_event = None
    if top_row:
        note = (top_row.note or f"{top_row.metric} on {top_row.equipment_id}")[:160]
        top_event = note

    return {
        "period_from": period_start.isoformat() + "Z",
        "period_to": period_end.isoformat() + "Z",
        "hours": hours,
        "total_kwh": round(cost.total_kwh, 2) if cost.total_kwh is not None else None,
        "total_cost_inr": round(cost.total_cost_inr, 2) if cost.total_cost_inr is not None else None,
        "anomaly_count": anomaly_count,
        "critical_count": critical_count,
        "worst_equipment": worst_equipment,
        "worst_kw_per_tr": worst_kw_per_tr,
        "top_event": top_event,
    }


def _build_markdown(kpis: dict, headline: str, recommendation: str) -> str:
    worst = kpis["worst_equipment"]
    worst_line = (
        f"- Watch: **{worst.replace('_', ' ').title()}** at "
        f"`{kpis['worst_kw_per_tr']}` kW/TR\n"
        if worst else ""
    )
    return (
        "# ☀️ THERMYNX Morning Digest\n"
        f"_{kpis['period_to']} · last {kpis['hours']}h_\n\n"
        f"**{headline}**\n\n"
        f"- Plant energy: **{kpis['total_kwh']} kWh** (₹{kpis['total_cost_inr']})\n"
        f"- Anomalies: **{kpis['anomaly_count']}** ({kpis['critical_count']} critical)\n"
        f"{worst_line}"
        + (f"- Top event: {kpis['top_event']}\n" if kpis['top_event'] else "")
        + f"\n**Recommended action:** {recommendation}\n"
    )


async def build_digest(mysql: AsyncSession, pg: AsyncSession, hours: int = 24) -> dict:
    """Compute KPIs, narrate them, persist a DailyDigest row, return it serialized."""
    kpis = await _compute_kpis(mysql, pg, hours)

    status = "ok"
    narrative = None
    try:
        resp = await chat(
            [
                {"role": "system", "content": DIGEST_SYSTEM},
                {"role": "user", "content": _build_user_message(kpis)},
            ],
            model=settings.OLLAMA_MODEL_TEXT or settings.OLLAMA_DEFAULT_MODEL,
            num_predict=settings.OLLAMA_MAX_TOKENS_REPORT,
        )
        narrative = _parse_llm_narrative((resp.get("message") or {}).get("content") or "")
    except Exception as exc:  # graceful degradation — KPIs stay valid
        log.warning("digest_llm_failed hours=%s err=%s", hours, exc)

    if narrative is None:
        status = "degraded"
        headline, recommendation = _deterministic_narrative(kpis)
    else:
        headline, recommendation = narrative

    markdown = _build_markdown(kpis, headline, recommendation)

    row = DailyDigest(
        id=str(uuid.uuid4()),
        period_from=kpis["period_from"],
        period_to=kpis["period_to"],
        hours=hours,
        total_kwh=kpis["total_kwh"],
        total_cost_inr=kpis["total_cost_inr"],
        anomaly_count=kpis["anomaly_count"],
        critical_count=kpis["critical_count"],
        worst_equipment=kpis["worst_equipment"],
        worst_kw_per_tr=kpis["worst_kw_per_tr"],
        headline=headline,
        recommendation=recommendation,
        markdown=markdown,
        status=status,
    )
    pg.add(row)
    await pg.commit()
    await pg.refresh(row)

    log.info(
        "digest_built hours=%s kwh=%s anomalies=%s critical=%s status=%s",
        hours, kpis["total_kwh"], kpis["anomaly_count"], kpis["critical_count"], status,
    )
    return _serialize(row)


async def post_digest_to_slack(digest: dict) -> bool:
    """Best-effort push to the configured Slack channel. No-op when Slack is off."""
    if not slack_svc.slack_configured():
        return False
    result = await slack_svc.post_message(digest.get("markdown") or digest.get("headline") or "Morning digest")
    return result is not None


async def latest_digest(pg: AsyncSession) -> DailyDigest | None:
    res = await pg.execute(
        select(DailyDigest).order_by(DailyDigest.created_at.desc()).limit(1)
    )
    return res.scalars().first()


async def list_digests(pg: AsyncSession, limit: int = 14) -> list[DailyDigest]:
    res = await pg.execute(
        select(DailyDigest).order_by(DailyDigest.created_at.desc()).limit(limit)
    )
    return list(res.scalars().all())


def serialize(row: DailyDigest) -> dict:
    return _serialize(row)
