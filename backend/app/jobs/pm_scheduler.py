"""Preventive-maintenance scheduler — runs daily.

For each active PM template, for each matching equipment, if `interval_days`
has elapsed since the template's `last_run_at` *and* there isn't already an
open WO of the same template-source for that equipment, create one.

Lightweight RUL-aware skip rule: if maintenance health score > 90 and the
template name contains "Daily" / "Weekly", defer that one cycle. This is
the cheap proxy for "twin says RUL is far". When a real RUL model lands
this skip rule moves to the model output.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select

from app.db.models import PMTemplate, WorkOrder
from app.db.session import PGSession, MySQLSession
from app.db.telemetry import fetch_bucket_series
from app.domain.equipment import EQUIPMENT_CATALOG
from app.analytics.maintenance import analyze_asset_maintenance
from app.log import get_logger
from app.services import work_orders as svc

log = get_logger("jobs.pm_scheduler")

_HEALTH_SKIP_THRESHOLD = 90
_HEALTH_SKIP_KEYWORDS  = ("daily", "weekly")
_MAINT_BUCKET_SECS     = 900


async def _equipment_health(eq: dict) -> int | None:
    """Return the latest maintenance health score for an asset, or None."""
    try:
        async with MySQLSession() as mysql:
            points = await fetch_bucket_series(mysql, eq["table"], eq["type"],
                                               hours=24, bucket_secs=_MAINT_BUCKET_SECS)
        m = analyze_asset_maintenance(eq["id"], eq["name"], eq["type"], points,
                                      bucket_secs=_MAINT_BUCKET_SECS)
        return int(m.health_score) if m.health_score is not None else None
    except Exception as exc:
        log.warning("pm_health_check_failed eq=%s err=%s", eq["id"], exc)
        return None


async def _has_open_pm_wo(pg, template_id: str, equipment_id: str) -> bool:
    """Suppress duplicate PM WOs — same template + equipment, still open."""
    stmt = (
        select(WorkOrder)
        .where(WorkOrder.source == "pm")
        .where(WorkOrder.source_ref == template_id)
        .where(WorkOrder.equipment_id == equipment_id)
        .where(WorkOrder.state.in_(["open", "assigned", "in_progress"]))
        .limit(1)
    )
    return (await pg.execute(stmt)).scalar() is not None


async def run_pm_scheduler_job(*_args, **_kwargs) -> dict:
    """arq cron entrypoint. Returns a summary that arq stores in Redis."""
    created  = 0
    skipped_health = 0
    skipped_open   = 0
    scanned  = 0

    async with PGSession() as pg:
        templates = (await pg.execute(
            select(PMTemplate).where(PMTemplate.active == 1)
        )).scalars().all()

        for tpl in templates:
            now = datetime.utcnow()
            if tpl.last_run_at and (now - tpl.last_run_at) < timedelta(days=tpl.interval_days):
                continue

            # Which equipment matches this template?
            if tpl.equipment_type == "all":
                targets = EQUIPMENT_CATALOG
            else:
                targets = [e for e in EQUIPMENT_CATALOG if e["type"] == tpl.equipment_type]
            if not targets:
                continue

            tpl_due = True
            for eq in targets:
                scanned += 1
                if await _has_open_pm_wo(pg, tpl.id, eq["id"]):
                    skipped_open += 1
                    continue

                # Health-aware skip for low-priority repetitive PMs
                if any(kw in tpl.name.lower() for kw in _HEALTH_SKIP_KEYWORDS):
                    score = await _equipment_health(eq)
                    if score is not None and score > _HEALTH_SKIP_THRESHOLD:
                        skipped_health += 1
                        continue

                try:
                    await svc.create_work_order(
                        pg,
                        title=f"{tpl.name} — {eq['name']}",
                        description=tpl.description,
                        equipment_id=eq["id"],
                        priority=tpl.priority,
                        source="pm",
                        source_ref=tpl.id,
                        created_by="system",
                    )
                    created += 1
                except Exception as exc:  # pragma: no cover
                    log.exception("pm_create_failed tpl=%s eq=%s err=%s", tpl.id, eq["id"], exc)
                    tpl_due = False

            # Stamp the template as "we ran the schedule for this period"
            if tpl_due:
                tpl.last_run_at = datetime.utcnow()
        await pg.commit()

    log.info("pm_scheduler_done created=%s scanned=%s skipped_health=%s skipped_open=%s",
             created, scanned, skipped_health, skipped_open)
    return {
        "created":        created,
        "scanned":        scanned,
        "skipped_health": skipped_health,
        "skipped_open":   skipped_open,
    }
