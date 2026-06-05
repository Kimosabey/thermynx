"""Predictive-PM cron — runs daily, proposes PM work orders for chillers whose
efficiency / condenser-approach trends are degrading. Deduped; human approves.

Mirrors pm_scheduler's session style (opens its own MySQL + Postgres sessions)."""
from __future__ import annotations

from app.db.session import MySQLSession, PGSession
from app.log import get_logger
from app.services.predictive_pm import scan_and_propose

log = get_logger("jobs.predictive_pm")

_DAYS = 14


async def run_predictive_pm_job(*_args, **_kwargs) -> dict:
    """arq cron entrypoint. Returns a summary that arq stores in Redis."""
    try:
        async with MySQLSession() as mysql, PGSession() as pg:
            result = await scan_and_propose(mysql, pg, days=_DAYS)
    except Exception as exc:  # pragma: no cover — never crash the worker
        log.exception("predictive_pm_job_failed err=%s", exc)
        return {"ok": False, "error": str(exc)}
    log.info("predictive_pm_job_done created=%s", result["created_count"])
    return {"ok": True, **result}
