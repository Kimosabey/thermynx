"""Daily digest cron — builds the morning plant-health digest and pushes it
to Slack. Registered in jobs/worker.py to run once each morning.

Mirrors the session-management style of pm_scheduler: opens its own MySQL +
Postgres sessions (the cron has no request scope)."""
from __future__ import annotations

from app.db.session import MySQLSession, PGSession
from app.log import get_logger
from app.services.digest import build_digest, post_digest_to_slack

log = get_logger("jobs.digest")

_DIGEST_HOURS = 24


async def run_digest_job(*_args, **_kwargs) -> dict:
    """arq cron entrypoint. Returns a summary that arq stores in Redis."""
    try:
        async with MySQLSession() as mysql, PGSession() as pg:
            digest = await build_digest(mysql, pg, hours=_DIGEST_HOURS)
    except Exception as exc:  # pragma: no cover — never let the cron crash the worker
        log.exception("digest_job_failed err=%s", exc)
        return {"ok": False, "error": str(exc)}

    posted = False
    try:
        posted = await post_digest_to_slack(digest)
    except Exception as exc:
        log.warning("digest_slack_post_failed err=%s", exc)

    log.info(
        "digest_job_done id=%s anomalies=%s critical=%s slack_posted=%s status=%s",
        digest["id"], digest["anomaly_count"], digest["critical_count"], posted, digest["status"],
    )
    return {
        "ok": True,
        "id": digest["id"],
        "anomaly_count": digest["anomaly_count"],
        "critical_count": digest["critical_count"],
        "slack_posted": posted,
        "status": digest["status"],
    }
