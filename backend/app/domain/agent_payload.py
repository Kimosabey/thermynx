"""Bound agent tool payloads before injecting into LLM message history."""

from __future__ import annotations

import json
from typing import Any

# Approximate ceiling for serialized tool result text (plan P2-5).
DEFAULT_MAX_TOOL_PAYLOAD_CHARS = 18_000


def compact_agent_tool_payload(
    tool_name: str,
    result: Any,
    *,
    max_chars: int = DEFAULT_MAX_TOOL_PAYLOAD_CHARS,
) -> Any:
    """
    If serialized result exceeds max_chars, replace with a structured truncation
    wrapper so downstream json.dumps stays bounded.
    """
    try:
        raw = json.dumps(result, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        raw = str(result)
    if len(raw) <= max_chars:
        return result
    overhead = 200
    keep = max(512, max_chars - overhead - len(tool_name))
    preview = raw[:keep]
    return {
        "_truncated": True,
        "_tool": tool_name,
        "_original_chars": len(raw),
        "_preview": preview + ("..." if len(raw) > keep else ""),
        "_warning": (
            "Tool output exceeded context budget and was truncated. "
            "Use narrower time ranges or fewer equipment calls if you need full detail."
        ),
    }

