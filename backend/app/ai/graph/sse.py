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
import time
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


def _unwrap_tool_content(content: Any) -> Any:
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


async def astream_sse(graph: Any, inputs: dict, config: dict, done_extra: dict | None = None) -> AsyncIterator[str]:
    """Run `graph` and yield SSE frames matching the existing contract.

    `done_extra` is merged into the final `done` frame (e.g. audit_id/model/run_id)
    so a flipped live endpoint keeps the exact `done` payload the UI expects.
    """
    # Attach Langfuse callbacks for per-node/per-LLM spans (no-op when unconfigured).
    from app.ai.graph.tracing import graph_callbacks
    cbs = graph_callbacks()
    if cbs:
        config = {**config, "callbacks": [*(config.get("callbacks") or []), *cbs]}

    # thread_id labels an awaiting-approval pause so the client can resume it (F4.9).
    thread_id = (config.get("configurable") or {}).get("thread_id")
    interrupted = False
    _t_last = time.monotonic()   # per-node timing anchor (F: in-app model traces)
    try:
        async for update in graph.astream(inputs, config, stream_mode="updates"):
            if not update:
                continue

            # F4.9 — HITL pause: a node called interrupt() and the graph is now
            # waiting for a /agent/resume decision. Surface the plan + thread_id and
            # suppress the `done` frame (the run isn't finished, just paused).
            if "__interrupt__" in update:
                interrupted = True
                intr = update["__interrupt__"]
                item = intr[0] if isinstance(intr, (list, tuple)) and intr else intr
                val = getattr(item, "value", item)
                plan = val.get("plan", {}) if isinstance(val, dict) else {}
                yield _sse({"type": "awaiting_approval", "thread_id": thread_id, "plan": plan})
                continue

            for _node, delta in update.items():
                # Per-node timing → lightweight in-app model trace (no Langfuse/infra).
                # On the orchestrator these map 1:1 to models: planner=gemma4,
                # specialists=devstral, synthesis=phi4, critique=phi4.
                _now = time.monotonic()
                yield _sse({"type": "node_timing", "node": _node, "ms": int((_now - _t_last) * 1000)})
                _t_last = _now
                if not isinstance(delta, dict):
                    continue

                # plan (multi-agent planner) → render it + (optionally) gate it (F4.9)
                if delta.get("plan"):
                    p = delta["plan"]
                    yield _sse({"type": "plan", "rationale": p.get("rationale", ""),
                                "subtasks": p.get("subtasks", [])})

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

    if not interrupted:
        yield _sse({"type": "done", **(done_extra or {})})
