"""Tool-call argument validation + one-shot repair (F1.8).

Validates LLM-produced tool-call arguments against the Pydantic schemas in
``schemas.TOOL_ARG_SCHEMAS``. On failure it returns a concise, model-readable
correction the graph feeds back so the model can repair *that single step*
(one retry) — instead of the current ``agent.py`` behaviour of silently
dropping bad args to ``{}`` (which makes the tool fail downstream) or letting a
malformed call abort the run.

Dependency-free (Pydantic only) — exercised inside the LangGraph tools node (F3).
Mirrors the current arg coercion in ``app/ai/agent.py`` (dict or JSON string).
"""
from __future__ import annotations

import json
from typing import Any

from pydantic import ValidationError

from app.ai.graph.schemas import TOOL_ARG_SCHEMAS


def parse_args(raw: Any) -> dict:
    """Coerce tool-call arguments (dict or JSON string) to a dict — like agent.py."""
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _example_for(schema: type) -> str:
    """Minimal example arg object from required fields (for the repair hint)."""
    example = {fname: f"<{fname}>" for fname, f in schema.model_fields.items() if f.is_required()}
    return json.dumps(example) if example else "{}"


def validate_tool_args(name: str, raw: Any) -> tuple[bool, dict | None, str | None]:
    """Validate args for tool ``name``.

    Returns ``(ok, cleaned_args, correction)``:
      - success → ``(True, cleaned_args, None)`` (defaults applied, None-only fields dropped)
      - failure → ``(False, None, correction)`` — a short message to feed back for a
        one-shot repair (F1.8).
    """
    schema = TOOL_ARG_SCHEMAS.get(name)
    if schema is None:
        return False, None, (
            f"Unknown tool '{name}'. Valid tools: {', '.join(sorted(TOOL_ARG_SCHEMAS))}."
        )

    args = parse_args(raw)
    try:
        model = schema(**args)
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()
        )
        return False, None, (
            f"Tool '{name}' arguments were invalid ({problems}). "
            f"Call it again with valid JSON arguments, e.g. {_example_for(schema)}."
        )
    return True, model.model_dump(exclude_none=True), None
