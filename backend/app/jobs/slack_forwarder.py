"""Outbound alarm forwarder — runs every 60s via arq cron.

Pulls the current alarms feed and posts any unseen critical events to
the configured Slack channel. Deduplication is Redis-backed so restarts
don't re-fire historical alarms.

Disabled (no-op) when:
  - Slack is not configured (no SLACK_BOT_TOKEN), or
  - SLACK_ALARM_CHANNEL is empty.

Severity gating respects SLACK_ALARM_MIN_SEVERITY (default: critical).
"""
from __future__ import annotations

import asyncio

import redis.asyncio as aioredis

from app.config import settings
from app.db.session import MySQLSession
from app.log import get_logger
from app.services.slack import (
    format_alarm_blocks, post_message, should_forward, slack_configured,
)

log = get_logger("jobs.slack_forwarder")

_DEDUP_KEY_PREFIX = "slack:alarm:seen:"
_DEDUP_TTL_SEC    = 60 * 60 * 6   # remember alarms for 6h so they don't re-fire


async def _redis() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def _collect_current_alarms() -> list[dict]:
    """Fetch alarms via the existing service layer."""
    from app.api.v1.alarms import _collect_alarms
    async with MySQLSession() as db:
        return await _collect_alarms(db, hours=1)


async def run_slack_forward_job(*_args, **_kwargs) -> dict:
    """arq cron entrypoint. Returns a summary for inspection in Redis."""
    if not slack_configured() or not settings.SLACK_ALARM_CHANNEL:
        return {"skipped": True, "reason": "slack_disabled"}

    try:
        alarms = await _collect_current_alarms()
    except Exception as exc:
        log.exception("slack_forwarder_collect_failed err=%s", exc)
        return {"skipped": True, "reason": f"collect_failed: {exc}"}

    if not alarms:
        return {"sent": 0, "scanned": 0}

    client = await _redis()
    sent   = 0
    skipped_dedup = 0
    skipped_sev   = 0

    try:
        for alarm in alarms:
            if not should_forward(alarm):
                skipped_sev += 1
                continue
            key = _DEDUP_KEY_PREFIX + alarm.get("id", "")
            if await client.exists(key):
                skipped_dedup += 1
                continue
            text, blocks = format_alarm_blocks(alarm)
            res = await post_message(text, blocks=blocks)
            if res:
                await client.set(key, "1", ex=_DEDUP_TTL_SEC)
                sent += 1
            # Be gentle with Slack rate limits — 1 msg per ~150 ms
            await asyncio.sleep(0.2)
    finally:
        await client.aclose()

    log.info("slack_forwarder_done sent=%s dedup=%s severity_filtered=%s", sent, skipped_dedup, skipped_sev)
    return {
        "scanned":              len(alarms),
        "sent":                 sent,
        "skipped_dedup":        skipped_dedup,
        "skipped_severity":     skipped_sev,
    }
