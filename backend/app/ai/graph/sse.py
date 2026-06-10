"""SSE adapter (F3.11) — stream a compiled graph as the existing frame contract.

Maps LangGraph node updates onto the exact SSE frames the current UI consumes
(see app/api/v1/analyzer.py + agent.py), so the graph drops behind the existing
endpoints at cutover (F7) with no frontend change:

    {"type":"token","content":...}        ← answer / refusal text (word-chunked)
    {"type":"tool_call","tool":...,"args":...}
    {"type":"tool_result","tool":...,"result":...}
    {"type":"audit","audit":...}          ← postcheck
    {"type":"verification","verdict":...} ← critique
    {"type":"done", ...}

Uses stream_mode="updates" (per-node deltas). Key-driven (not node-name-driven)
so it serves both the grounded graph and the ReAct graph.
"""
from __future__ import annotations

import decimal
import json
from datetime import date, datetime
from typing import Any, AsyncIterator

from langchain_core.messages import AIMessage, ToolMessage


def _default(o: Any) -> Any:
    if isinstance(o, decimal.Decimal):
        return float(o)
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    return str(o)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, default=_default)}\n\n"


def _word_tokens(text: str):
    words = text.split(" ")
    for i, w in enumerate(words):
        yield (w + " ") if i < len(words) - 1 else w


def _unwrap_tool_content(content: str) -> Any:
    """Pull the JSON payload out of a '<<< TOOL RESULT START … >>> {json} <<< END >>>' wrapper."""
    if not isinstance(content, str):
        return content
    start, end = content.find("{"), content.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(content[start:end + 1])
        except json.JSONDecodeError:
            pass
    return content


async def astream_sse(graph: Any, inputs: dict, config: dict) -> AsyncIterator[str]:
    """Run `graph` and yield SSE frames matching the existing contract."""
    try:
        async for update in graph.astream(inputs, config, stream_mode="updates"):
            for _node, delta in (update or {}).items():
                if not isinstance(delta, dict):
                    continue

                # tool_call / tool_result from messages emitted by this node
                for m in (delta.get("messages") or []):
                    if isinstance(m, AIMessage) and getattr(m, "tool_calls", None):
                        for tc in m.tool_calls:
                            yield _sse({"type": "tool_call", "tool": tc.get("name"), "args": tc.get("args", {})})
                    elif isinstance(m, ToolMessage):
                        yield _sse({"type": "tool_result", "tool": getattr(m, "name", ""),
                                    "result": _unwrap_tool_content(m.content)})

                # refusal (preflight) → emit as a token
                if delta.get("refusal"):
                    yield _sse({"type": "token", "content": delta["refusal"]})
                # final answer → word-chunked tokens (only when non-empty & not a refusal echo)
                elif delta.get("answer"):
                    for tok in _word_tokens(delta["answer"]):
                        yield _sse({"type": "token", "content": tok})

                if "audit" in delta:
                    yield _sse({"type": "audit", "audit": delta["audit"]})
                if "verdict" in delta:
                    yield _sse({"type": "verification", "verdict": delta["verdict"]})
    except Exception as exc:  # surface as an error frame, never crash the stream
        yield _sse({"type": "error", "detail": f"graph stream failed: {exc}"})
        return

    yield _sse({"type": "done"})
