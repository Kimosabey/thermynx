from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.cost import build_plant_cost
from app.config import settings
from app.db.session import get_db, get_pg
from app.db.telemetry import compute_summary, fetch_all_hvac_context, fetch_bucket_series, resolve_telemetry_until
from app.domain.equipment import EQUIPMENT_CATALOG
from app.llm.ollama import chat
from app.prompts.hvac_prompts import REPORT_SUMMARY_SYSTEM, build_report_summary_user_message
from app.log import get_logger

router = APIRouter()
log = get_logger("api.reports")

_BUCKET_SECS = 900


def _markdown_table(rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(rows[0]) + " |", "| " + " | ".join("---" for _ in rows[0]) + " |"]
    for r in rows[1:]:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out) + "\n"


@router.post("/reports/daily")
async def build_daily_report(
    hours: int = Query(default=24, ge=1, le=8760),
    mysql: AsyncSession = Depends(get_db),
    pg: AsyncSession = Depends(get_pg),
):
    period_end = await resolve_telemetry_until(mysql, table=None)
    period_start = period_end - timedelta(hours=hours)

    context = await fetch_all_hvac_context(mysql, hours=hours)
    summary = await compute_summary(context)

    datasets = []
    for eq in EQUIPMENT_CATALOG:
        pts = await fetch_bucket_series(mysql, eq["table"], eq["type"], hours=hours, bucket_secs=_BUCKET_SECS)
        datasets.append((eq["id"], eq["name"], eq["type"], pts))

    cost = build_plant_cost(
        datasets,
        hours_window=hours,
        tariff_inr_per_kwh=settings.TARIFF_INR_PER_KWH,
        bucket_secs=_BUCKET_SECS,
    )

    kpi_lines = [["Equipment", "Type", "kWh", "INR", "Run hours", "INR/TR-h"]]
    for r in cost.equipment:
        kpi_lines.append(
            [
                r.name,
                r.type,
                f"{r.kwh:.3f}",
                f"{r.cost_inr:.2f}",
                f"{r.run_hours:.2f}" if r.run_hours is not None else "—",
                f"{r.inr_per_tr_hr:.4f}" if r.inr_per_tr_hr is not None else "—",
            ]
        )
    kpi_md = _markdown_table(kpi_lines)

    ar = await pg.execute(
        text(
            """
            SELECT equipment_id, metric,
                   COALESCE(NULLIF(narrative, ''), NULLIF(description, ''), '—') AS note,
                   z_score, created_at
            FROM anomalies
            ORDER BY created_at DESC
            LIMIT 12
            """
        )
    )
    rows_ar = ar.fetchall()
    if rows_ar:
        anomaly_lines = [["Equipment", "Metric", "Note", "|z|", "When (UTC)"]]
        for row in rows_ar:
            zs = row.z_score
            zs_s = f"{abs(zs):.2f}" if zs is not None else "—"
            ts = row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at)
            anomaly_lines.append([row.equipment_id, row.metric, str(row.note)[:120], zs_s, ts[:19]])
        top_anomalies = _markdown_table(anomaly_lines)
    else:
        top_anomalies = "_No persisted anomalies yet — background scanner may not have fired._\n"

    tele_lines = []
    for cid in ["chiller_1", "chiller_2"]:
        s = summary.get(cid) or {}
        kp = s.get("avg_kw_per_tr")
        runp = s.get("running_pct")
        if kp is not None or runp is not None:
            tele_lines.append(
                f"- **{cid.replace('_', ' ').title()}** — avg kW/TR: `{kp}` · running sample %: `{runp}`"
            )
    tele_md = "\n".join(tele_lines) if tele_lines else "_Limited chiller summary in this fetch._\n"

    user_msg = build_report_summary_user_message(
        period_from=period_start.isoformat() + "Z",
        period_to=period_end.isoformat() + "Z",
        kpi_table=kpi_md,
        top_anomalies=top_anomalies,
        total_kwh=f"{cost.total_kwh:.2f}",
    )

    exec_summary = ""
    try:
        resp = await chat(
            [
                {"role": "system", "content": REPORT_SUMMARY_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            model=settings.OLLAMA_DEFAULT_MODEL,
        )
        exec_summary = (resp.get("message") or {}).get("content") or ""
    except Exception as e:
        log.warning(
            "report_exec_summary_llm_failed hours=%s model=%s err=%s",
            hours,
            settings.OLLAMA_DEFAULT_MODEL,
            e,
        )
        exec_summary = f"_Executive summary unavailable ({e!s}) — KPI tables below remain valid._\n"

    log.info(
        "report_daily_built hours=%s total_kwh=%s exec_chars=%s",
        hours,
        cost.total_kwh,
        len(exec_summary),
    )

    parts = [
        "# THERMYNX Daily Operations Report\n\n",
        f"_Generated **{period_end.isoformat()}Z** · rolling window **{hours}** h_\n\n",
        "## KPI and energy cost (flat tariff)\n\n",
        f"Blended tariff assumption: **₹{settings.TARIFF_INR_PER_KWH}/kWh** (override via app settings).\n\n",
        kpi_md,
        "\n## Telemetry highlights\n\n",
        tele_md,
        "\n## Recent anomalies (Postgres)\n\n",
        top_anomalies,
        "\n---\n\n## Executive summary\n\n",
        exec_summary,
        "\n",
    ]
    markdown = "".join(parts)

    return {
        "period_from": period_start.isoformat() + "Z",
        "period_to": period_end.isoformat() + "Z",
        "hours": hours,
        "total_kwh": cost.total_kwh,
        "total_cost_inr": cost.total_cost_inr,
        "markdown": markdown,
    }
