"""Shared JSON extraction for LLM outputs — FALLBACK / LEGACY parsing (F1.14).

Prose-JSON extraction for model responses wrapped in ``` fences or padded with
prose. The LangGraph rewrite replaced this with Pydantic structured output
(``with_structured_output`` + the schemas in ``app/ai/graph/schemas.py``), so the
graph's planner / tool-args no longer parse prose. This module is RETAINED ONLY
as the fallback for the paths the rewrite doesn't cover:

  - ``app/ai/router_classify.py`` — the lightweight Nyx intent arbiter (not a graph).
  - ``app/ai/multi_agent.py``     — the OLD inline orchestrator (instant-revert
    fallback when ``USE_GRAPH_AGENT=False``).
  - ``app/ai/critique.py``        — the self-critique auditor (still prose-parsed;
    reached by both the inline fallback and the graph's critique node via
    ``verify_answer``).

Do NOT add new callers — use Pydantic structured output instead.
"""
from __future__ import annotations

import json
import re
from typing import Any


def parse_first_json_object(raw: str) -> dict[str, Any] | None:
    """Return the first JSON object in ``raw`` as a dict, or None.

    Strategy: strip ``` code fences, try ``json.loads`` on the whole string
    (fast path for well-formed responses), then fall back to a brace-depth
    scan for the first balanced ``{...}`` span when the model added prose.
    """
    if not raw:
        return None
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\n?", "", s, flags=re.IGNORECASE)
        s = re.sub(r"```\s*$", "", s)
    s = s.strip()

    # Fast path: the whole string is valid JSON
    try:
        parsed = json.loads(s)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Fallback: first balanced {…} span
    start = s.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    obj = json.loads(s[start:i + 1])
                    return obj if isinstance(obj, dict) else None
                except json.JSONDecodeError:
                    return None
    return None
