"""Shared JSON extraction for LLM outputs.

Both the multi-agent planner and the self-critique auditor need to pull a JSON
object out of a model response that may be wrapped in ``` fences or padded with
prose. They each carried a near-identical parser; this is the single copy.
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
