"""Slack utilities — signature verification + message posting.

The bot is configured by three env vars (see app.config):
  SLACK_BOT_TOKEN       — for outbound chat.postMessage
  SLACK_SIGNING_SECRET  — to verify inbound slash-command / event POSTs
  SLACK_ALARM_CHANNEL   — channel for outbound critical alarms (optional)

Empty values disable each path. The signing-secret check uses HMAC-SHA-256
on the raw request body per Slack's spec — no external lib needed.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import time

import httpx

from app.config import settings
from app.log import get_logger

log = get_logger("services.slack")


_POST_TIMEOUT_S        = 8.0
_SIGNATURE_TOLERANCE_S = 60 * 5    # Slack's recommended replay window


def slack_configured() -> bool:
    return bool(settings.SLACK_BOT_TOKEN)


def verify_signature(timestamp: str, body: bytes, signature: str) -> bool:
    """Verify an inbound Slack request per their HMAC-SHA-256 spec."""
    secret = settings.SLACK_SIGNING_SECRET
    if not secret:
        return False
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    if abs(time.time() - ts) > _SIGNATURE_TOLERANCE_S:
        return False
    basestring = f"v0:{timestamp}:".encode() + body
    expected = "v0=" + hmac.new(secret.encode(), basestring, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


async def post_message(
    text: str,
    *,
    channel: str | None = None,
    blocks: list[dict] | None = None,
) -> dict | None:
    """One-shot `chat.postMessage`. Returns None when Slack is disabled
    or the request fails — never raises."""
    if not settings.SLACK_BOT_TOKEN:
        log.debug("slack_post_skipped reason=no_token")
        return None
    target = channel or settings.SLACK_ALARM_CHANNEL
    if not target:
        log.debug("slack_post_skipped reason=no_channel")
        return None

    payload: dict = {"channel": target, "text": text}
    if blocks:
        payload["blocks"] = blocks

    try:
        async with httpx.AsyncClient(timeout=_POST_TIMEOUT_S) as client:
            r = await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={
                    "Authorization": f"Bearer {settings.SLACK_BOT_TOKEN}",
                    "Content-Type":  "application/json; charset=utf-8",
                },
                json=payload,
            )
            data = r.json()
            if not data.get("ok"):
                log.warning("slack_post_failed err=%s", data.get("error"))
                return None
            return data
    except httpx.HTTPError as exc:
        log.warning("slack_post_http_error err=%s", exc)
        return None


async def post_response_url(response_url: str, text: str, *, in_channel: bool = False) -> None:
    """Reply to a slash command via its `response_url` (works even after the
    initial 3-second window has closed)."""
    try:
        async with httpx.AsyncClient(timeout=_POST_TIMEOUT_S) as client:
            await client.post(
                response_url,
                json={"response_type": "in_channel" if in_channel else "ephemeral", "text": text},
            )
    except httpx.HTTPError as exc:
        log.warning("slack_response_url_failed err=%s", exc)


_SEVERITY_RANK = {"info": 0, "warning": 1, "critical": 2}


def should_forward(alarm: dict) -> bool:
    """Check severity gate against SLACK_ALARM_MIN_SEVERITY."""
    sev_rank   = _SEVERITY_RANK.get(alarm.get("severity", "info"), 0)
    min_rank   = _SEVERITY_RANK.get(settings.SLACK_ALARM_MIN_SEVERITY, 2)
    return sev_rank >= min_rank


def format_alarm_blocks(alarm: dict) -> tuple[str, list[dict]]:
    """Build a Slack Block-Kit message body for an alarm row."""
    severity = alarm.get("severity", "info").upper()
    emoji    = {"CRITICAL": ":rotating_light:", "WARNING": ":warning:", "INFO": ":information_source:"}.get(severity, ":bell:")
    eq       = alarm.get("equipment_name") or alarm.get("equipment_id") or "(unknown)"
    metric   = alarm.get("metric") or ""
    msg      = alarm.get("message") or ""
    fallback = f"{emoji} {severity} — {eq}: {msg}"
    blocks: list[dict] = [
        {"type": "header", "text": {"type": "plain_text", "text": f"{emoji} {severity} alarm — {eq}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*{metric}* — {msg}"}},
    ]
    fields: list[dict] = []
    if alarm.get("value") is not None:
        fields.append({"type": "mrkdwn", "text": f"*Value*: `{alarm['value']}`"})
    if alarm.get("z_score") is not None:
        fields.append({"type": "mrkdwn", "text": f"*z-score*: `{round(alarm['z_score'], 2)}`"})
    if alarm.get("timestamp"):
        fields.append({"type": "mrkdwn", "text": f"*When*: `{alarm['timestamp']}`"})
    if fields:
        blocks.append({"type": "section", "fields": fields})
    blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": "Graylinx · HVAC AI Operations"}]})
    return fallback, blocks
