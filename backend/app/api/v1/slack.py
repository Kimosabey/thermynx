"""Slack inbound webhook routes — slash commands.

Slack POSTs to `/api/v1/slack/commands` with a form-encoded body. We
verify the signature, parse the command, dispatch to the analyzer or
brief-agent in a background task (since Slack wants a response in
<3 s) and reply via the `response_url` when the work is done.

Slash commands supported:
  /thermynx <question>          → analyzer answer (ephemeral)
  /thermynx brief                → daily brief (in_channel)
  /thermynx alarms               → current alarm summary (in_channel)
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import MySQLSession, PGSession
from app.db.telemetry import fetch_all_hvac_context, compute_summary
from app.limiter import limiter
from app.llm.ollama import stream_generate
from app.log import get_logger
from app.prompts.hvac_prompts import build_analyze_prompt
from app.services.rag import retrieve, format_rag_context
from app.services.slack import (
    post_response_url, slack_configured, verify_signature,
)

router = APIRouter()
log = get_logger("api.slack")


def _parse_form(raw: bytes) -> dict[str, str]:
    """Slack sends application/x-www-form-urlencoded. Parse without a dep."""
    from urllib.parse import parse_qs
    parsed = parse_qs(raw.decode("utf-8", errors="ignore"))
    return {k: (v[0] if v else "") for k, v in parsed.items()}


async def _run_analyze(question: str, response_url: str) -> None:
    """Collect a full analyzer answer and post to Slack via response_url."""
    try:
        async with MySQLSession() as db:
            context = await fetch_all_hvac_context(db, hours=24)
            summary = await compute_summary(context)

        async with PGSession() as pg:
            chunks = await retrieve(pg, question, top_k=5)

        rag_ctx = format_rag_context(chunks) if chunks else ""
        prompt  = build_analyze_prompt(question, context, summary, rag_context=rag_ctx)

        chunks_out: list[str] = []
        async for tok in stream_generate(prompt, model=settings.OLLAMA_DEFAULT_MODEL):
            chunks_out.append(tok)
        text = "".join(chunks_out).strip() or "(no answer)"
        # Slack message limit is ~40000 chars; safe to be conservative
        if len(text) > 3500:
            text = text[:3500] + "\n\n_… answer truncated for Slack_"
        await post_response_url(response_url, text, in_channel=False)
    except Exception as exc:  # pragma: no cover
        log.exception("slack_analyze_failed err=%s", exc)
        await post_response_url(response_url, f":x: analyzer failed: {exc}", in_channel=False)


async def _run_brief(response_url: str) -> None:
    """Pull current alarms and post a one-paragraph brief to the channel."""
    try:
        from app.api.v1.alarms import _collect_alarms
        async with MySQLSession() as db:
            alarms = await _collect_alarms(db, hours=24)
        if not alarms:
            await post_response_url(response_url, ":white_check_mark: No alarms in the last 24h.", in_channel=True)
            return
        by_sev: dict[str, int] = {"critical": 0, "warning": 0, "info": 0}
        for a in alarms:
            by_sev[a["severity"]] = by_sev.get(a["severity"], 0) + 1
        lines = [
            "*HVAC plant brief — last 24h*",
            f":rotating_light: {by_sev['critical']} critical · :warning: {by_sev['warning']} warning · :information_source: {by_sev['info']} info",
            "",
            "*Top alarms:*",
        ]
        for a in alarms[:5]:
            lines.append(f"• `{a['severity']}` {a['equipment_name']} — {a['message']}")
        await post_response_url(response_url, "\n".join(lines), in_channel=True)
    except Exception as exc:  # pragma: no cover
        log.exception("slack_brief_failed err=%s", exc)
        await post_response_url(response_url, f":x: brief failed: {exc}", in_channel=False)


async def _run_alarms_summary(response_url: str) -> None:
    """Current open alarms summary."""
    try:
        from app.api.v1.alarms import _collect_alarms
        async with MySQLSession() as db:
            alarms = await _collect_alarms(db, hours=1)
        if not alarms:
            await post_response_url(response_url, ":white_check_mark: No active alarms.", in_channel=True)
            return
        lines = [f"*{len(alarms)} active alarm{'s' if len(alarms) != 1 else ''}*", ""]
        for a in alarms[:10]:
            lines.append(f"• `{a['severity']}` {a['equipment_name']} — {a['message']}")
        if len(alarms) > 10:
            lines.append(f"_… and {len(alarms) - 10} more_")
        await post_response_url(response_url, "\n".join(lines), in_channel=True)
    except Exception as exc:  # pragma: no cover
        log.exception("slack_alarms_failed err=%s", exc)
        await post_response_url(response_url, f":x: alarms summary failed: {exc}", in_channel=False)


@router.post("/slack/commands")
@limiter.limit("60/minute")
async def slack_commands(request: Request, background: BackgroundTasks):
    if not slack_configured():
        raise HTTPException(status_code=503, detail="Slack integration is not configured on this deployment.")

    raw = await request.body()
    ts  = request.headers.get("X-Slack-Request-Timestamp", "")
    sig = request.headers.get("X-Slack-Signature", "")
    if not verify_signature(ts, raw, sig):
        log.warning("slack_signature_invalid")
        raise HTTPException(status_code=401, detail="invalid signature")

    form         = _parse_form(raw)
    text         = (form.get("text") or "").strip()
    response_url = form.get("response_url", "")
    user_name    = form.get("user_name", "?")
    log.info("slack_command user=%s text_len=%s", user_name, len(text))

    if not response_url:
        return {"response_type": "ephemeral", "text": ":x: missing response_url"}

    lowered = text.lower()
    if lowered.startswith("brief"):
        background.add_task(_run_brief, response_url)
        return {"response_type": "ephemeral", "text": ":hourglass_flowing_sand: Compiling brief…"}
    if lowered.startswith("alarms") or lowered.startswith("alarm"):
        background.add_task(_run_alarms_summary, response_url)
        return {"response_type": "ephemeral", "text": ":hourglass_flowing_sand: Pulling alarms…"}
    if not text or text in {"help", "?", "/help"}:
        return {
            "response_type": "ephemeral",
            "text": "*Graylinx Slack bot*\n"
                    "• `/thermynx <question>` — ask the analyzer\n"
                    "• `/thermynx brief` — last-24h plant brief\n"
                    "• `/thermynx alarms` — current active alarms\n",
        }

    background.add_task(_run_analyze, text, response_url)
    return {"response_type": "ephemeral", "text": f":hourglass_flowing_sand: Thinking about: _{text[:120]}_"}


@router.get("/slack/health")
async def slack_health():
    return {
        "configured":      slack_configured(),
        "alarm_channel":   settings.SLACK_ALARM_CHANNEL or None,
        "min_severity":    settings.SLACK_ALARM_MIN_SEVERITY,
        "signing_secret":  bool(settings.SLACK_SIGNING_SECRET),
    }
