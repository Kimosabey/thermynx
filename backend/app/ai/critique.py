"""
Self-critique loop for the AI Analyzer.

After the main answer is fully streamed, we run a *separate* LLM call that
acts as an auditor. It receives:

  1. The summary telemetry we just gave the synthesiser (ground truth)
  2. The text the synthesiser produced

…and returns a structured verdict on each numeric / factual claim it
detects, classifying them as `verified`, `suspicious`, or `unverified`.

The result is emitted as a single SSE frame the frontend renders as a
collapsible "fact-check" panel under the answer. The synthesised text is
NEVER mutated — operators always see the original answer, plus the
auditor's notes alongside.

Design notes
------------
* One LLM call, hard 8 s deadline. If it times out / errors, we emit a
  `verification` frame with `status: "skipped"` — the UI just hides the
  panel. The analyzer flow is never blocked.
* The auditor runs at a low temperature (0.0) with `format=json` so the
  output is deterministic and parseable.
* We re-use the existing Ollama client and the configured default
  model — `OLLAMA_AUDITOR_MODEL` env var can override.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from app.config import settings
from app.log import get_logger
from app.errors import OllamaUnavailableError
from app.llm.ollama import generate_json

log = get_logger("services.critique")


_AUDIT_TIMEOUT_S = 25.0
_AUDITOR_TEMPERATURE = 0.0


# Auditor system prompt lives in app/ai/prompts/agent_prompts.py.
from app.ai.prompts.agent_prompts import AUDITOR_SYSTEM as _AUDITOR_SYSTEM  # noqa: E402


def _extract_numeric_claims(text: str) -> list[str]:
    """Cheap heuristic — pull lines that contain a numeric token.

    Used as a *fallback* hint when the LLM returns nothing useful; the
    auditor LLM does the real semantic matching.
    """
    if not text:
        return []
    out: list[str] = []
    for raw in text.splitlines():
        s = raw.strip()
        if not s:
            continue
        if re.search(r"\b\d+(?:\.\d+)?\s*(?:%|kW(?:/TR)?|kWh|°C|TR|hr|hours|INR|Rs)", s, re.IGNORECASE):
            out.append(s[:240])
    return out[:20]


# Auditor JSON parsing uses the shared util (was a near-dup of the planner's parser).
from app.ai.json_utils import parse_first_json_object as _parse_auditor_json  # noqa: E402


async def verify_answer(
    answer_text: str,
    summary: dict[str, Any],
    *,
    model: str | None = None,
) -> dict[str, Any]:
    """Return a verdict dict suitable for emitting as an SSE `verification` frame.

    Always returns a dict — never raises. On any failure the dict has
    `status="skipped"` and a `reason` field for debugging.
    """
    if not answer_text or not answer_text.strip():
        return {"status": "skipped", "reason": "empty answer"}

    auditor_model = (
        model
        or getattr(settings, "OLLAMA_AUDITOR_MODEL", None)
        or settings.OLLAMA_DEFAULT_MODEL
    )

    # Compact the summary so the auditor's context window stays small
    try:
        summary_json = json.dumps(summary, default=str)[:6000]
    except Exception:
        summary_json = "{}"

    prompt = (
        _AUDITOR_SYSTEM
        + "\n\nSUMMARY:\n"
        + summary_json
        + "\n\nANSWER:\n"
        + answer_text[:6000]
        + "\n\nReturn the JSON verdict now."
    )

    try:
        raw = await asyncio.wait_for(
            generate_json(prompt, model=auditor_model, temperature=_AUDITOR_TEMPERATURE, timeout=_AUDIT_TIMEOUT_S),
            timeout=_AUDIT_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        log.warning("critique_timeout model=%s", auditor_model)
        return {"status": "skipped", "reason": "auditor timeout", "model": auditor_model}
    except OllamaUnavailableError as e:
        log.warning("critique_ollama_unavailable err=%s", e)
        return {"status": "skipped", "reason": f"auditor unavailable: {e}", "model": auditor_model}
    except Exception as e:  # pragma: no cover
        log.exception("critique_unexpected err=%s", e)
        return {"status": "skipped", "reason": "auditor crashed", "model": auditor_model}

    parsed = _parse_auditor_json(raw)
    if not parsed:
        return {
            "status": "skipped",
            "reason": "auditor returned unparseable JSON",
            "model": auditor_model,
            "raw_excerpt": raw[:240],
        }

    parsed.setdefault("verified", [])
    parsed.setdefault("suspicious", [])
    parsed.setdefault("unverified", [])
    parsed.setdefault("overall", "review")
    parsed.setdefault("summary", "")
    parsed["status"] = "ok"
    parsed["model"] = auditor_model
    parsed["heuristic_claim_count"] = len(_extract_numeric_claims(answer_text))
    return parsed
