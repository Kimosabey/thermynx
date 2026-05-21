"""Causal explanation service for anomaly events.

Given a detected anomaly (equipment + metric + value + z_score), gather
nearby telemetry context (adjacent metrics in the same equipment +
upstream/downstream assets when known) and ask the LLM to produce a
short ranked list of plausible causes. Returns structured JSON so the
UI can render a "why" panel next to each anomaly.

This is *causal hint*, not causal inference — the LLM proposes
hypotheses ranked by likelihood, and operators decide. Designed to
shorten triage time, not replace investigation.
"""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import settings
from app.log import get_logger

log = get_logger("services.causal")

_TIMEOUT_S       = 20.0
_TEMPERATURE     = 0.0


_SYSTEM = """You are an HVAC operations analyst. Given an anomaly event and recent
telemetry context, propose plausible causes ranked by likelihood.

Return ONLY a JSON object of this shape:
{
  "likely_causes": [
    {"cause": "short cause statement", "confidence": "high" | "medium" | "low", "evidence": "one-line supporting observation"}
  ],
  "recommended_checks": ["each operator-actionable check, one per array entry"],
  "summary": "one-sentence triage hint"
}

Rules:
  * 1 to 4 likely_causes — best three are usually enough.
  * Evidence MUST cite a number from the context provided (no inventions).
  * recommended_checks must be specific and actionable (e.g. "verify CHW return valve position", not "check the system").
  * No prose outside the JSON.
"""


@dataclass
class CausalExplanation:
    likely_causes:        list[dict[str, Any]] = field(default_factory=list)
    recommended_checks:   list[str]            = field(default_factory=list)
    summary:              str                  = ""
    status:               str                  = "ok"
    reason:               str | None           = None
    model:                str                  = ""
    elapsed_ms:           int                  = 0


def _parse_json(raw: str) -> dict | None:
    if not raw: return None
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\n?", "", s, flags=re.IGNORECASE)
        s = re.sub(r"```\s*$", "", s)
    start = s.find("{")
    if start < 0: return None
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "{": depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                try:    return json.loads(s[start:i + 1])
                except json.JSONDecodeError: return None
    return None


async def _ollama_call(model: str, prompt: str) -> str:
    url  = f"{settings.OLLAMA_HOST.rstrip('/')}/api/generate"
    body = {
        "model":   model,
        "prompt":  prompt,
        "stream":  False,
        "format":  "json",
        "options": {"temperature": _TEMPERATURE},
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
        r = await client.post(url, json=body)
        r.raise_for_status()
        return r.json().get("response", "")


async def explain_anomaly(
    anomaly: dict[str, Any],
    context: dict[str, Any],
    *,
    model: str | None = None,
) -> CausalExplanation:
    """Always returns a CausalExplanation. On failure, status='skipped' with reason."""
    used = model or settings.OLLAMA_DEFAULT_MODEL
    try:
        ctx_json = json.dumps({"anomaly": anomaly, "context": context}, default=str)[:6000]
    except Exception:
        ctx_json = "{}"

    prompt = _SYSTEM + "\n\nDATA:\n" + ctx_json + "\n\nReturn the JSON now."
    started = asyncio.get_event_loop().time()

    try:
        raw = await asyncio.wait_for(_ollama_call(used, prompt), timeout=_TIMEOUT_S)
    except asyncio.TimeoutError:
        return CausalExplanation(status="skipped", reason="LLM timeout", model=used)
    except httpx.HTTPError as exc:
        return CausalExplanation(status="skipped", reason=f"LLM error: {exc}", model=used)

    elapsed = int((asyncio.get_event_loop().time() - started) * 1000)
    parsed  = _parse_json(raw) or {}
    return CausalExplanation(
        likely_causes      = list(parsed.get("likely_causes") or []),
        recommended_checks = list(parsed.get("recommended_checks") or []),
        summary            = parsed.get("summary", "") or "",
        model              = used,
        elapsed_ms         = elapsed,
    )
