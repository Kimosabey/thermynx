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
from app.config import settings as app_settings


class WorkerSettings:
    functions  = [run_scan_job]
    cron_jobs  = [
        # Every 5 minutes — matches previous APScheduler schedule
        arq_cron(
            run_scan_job,
            minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55},
            run_at_startup=True,   # run once immediately on worker start
        ),
    ]
    redis_settings = RedisSettings.from_dsn(app_settings.REDIS_URL)
    max_jobs       = 1     # only one scan at a time
    job_timeout    = 120   # 2 min max per scan (fail-safe)
    keep_result    = 300   # keep result in Redis for 5 min for inspection
