"""
arq worker settings — Sprint 3 P1-2.

Replaces APScheduler (in-process, volatile) with a Redis-backed job queue.
Jobs survive process restarts because they are persisted in Redis.

Run modes:
  In-process (POC default) — started as an asyncio background task in main.py lifespan.
  Separate process (production) — `make worker` runs:
      python -m arq app.jobs.worker.WorkerSettings
"""
from arq.connections import RedisSettings
from arq.cron import cron as arq_cron

from app.jobs.anomaly_scan import run_scan_job
from app.jobs.slack_forwarder import run_slack_forward_job
from app.jobs.pm_scheduler import run_pm_scheduler_job
from app.config import settings as app_settings


class WorkerSettings:
    functions  = [run_scan_job, run_slack_forward_job, run_pm_scheduler_job]
    cron_jobs  = [
        # Every 5 minutes — anomaly persistence scan
        arq_cron(
            run_scan_job,
            minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55},
            run_at_startup=True,
        ),
        # Every minute — Slack alarm forwarder (no-op when Slack disabled)
        arq_cron(
            run_slack_forward_job,
            minute=set(range(60)),
            run_at_startup=False,
        ),
        # Daily 02:05 UTC — PM scheduler creates due maintenance WOs
        arq_cron(
            run_pm_scheduler_job,
            hour={2}, minute={5},
            run_at_startup=True,    # so a fresh install gets its first PM batch immediately
        ),
    ]
    redis_settings = RedisSettings.from_dsn(app_settings.REDIS_URL)
    max_jobs       = 3
    job_timeout    = 180
    keep_result    = 300
