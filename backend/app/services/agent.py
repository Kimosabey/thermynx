"""
ReAct agent engine — tool-calling loop with SSE streaming.

Flow:
  1. Send messages + tool schemas to Ollama /api/chat (non-streaming)
  2. If model returns tool_calls → execute tool → append result → repeat
  3. When model returns plain text → stream it back via /api/chat (streaming)
  4. Each step emits SSE frames: thought | tool_call | tool_result | token | done | error
"""
import asyncio
import decimal
import json
import time
import uuid
from datetime import datetime, date
from typing import AsyncIterator, Any

from app.llm.ollama import chat, stream_chat_text
from app.errors import AppError, OllamaUnavailableError
from app.domain.agent_payload import compact_agent_tool_payload
from app.domain.tools import TOOL_SCHEMAS, ToolContext, execute_tool
from app.config import settings
from app.log import get_logger

MAX_STEPS = 8

log = get_logger("services.agent")


# ── Agent mode system prompts ─────────────────────────────────────────────────

SYSTEM_PROMPTS = {
    "investigator": """You are THERMYNX Investigator — a senior HVAC engineering AI.
Your job: autonomously investigate HVAC plant performance issues using the tools available.
Always call at least 2 tools before giving a final answer. Start with the most relevant tool.
Structure your final answer in markdown with: ## Findings / ## Root Causes / ## Recommendations.
Be specific — cite kW/TR values, z-scores, timestamps from tool results.""",

    "optimizer": """You are THERMYNX Optimizer — an energy efficiency specialist.
Your job: identify concrete actions to reduce energy consumption at the HVAC plant.
Use tools to gather current efficiency, anomalies, and equipment comparisons.
Structure your final answer with: ## Current State / ## Optimization Opportunities / ## Expected Savings.
Quantify savings where possible (e.g. "reducing kW/TR from 0.82 to 0.70 = ~15% energy reduction").""",

    "brief": """You are THERMYNX Briefing Agent — a plant operations reporter.
Your job: generate a concise shift-start briefing covering all HVAC equipment.
Check efficiency for all chillers, check for anomalies, note any equipment in standby.
Structure: ## Plant Status / ## Equipment Summary / ## Action Items (top 3, prioritized).
Be concise — operators read this at the start of their shift.""",

    "root_cause": """You are THERMYNX Root Cause Analyst — a fault diagnosis specialist.
Your job: determine the root cause of a reported issue or anomaly.
Use tools to gather evidence: timeseries data, efficiency analysis, anomaly history, comparison.
Structure your final answer: ## Diagnosed Fault / ## Evidence / ## Likely Cause / ## Recommended Fix.""",

    "maintenance": """You are THERMYNX Maintenance Planner — a predictive maintenance specialist.
Your job: create a prioritized maintenance plan based on equipment performance data.
Check anomaly history, efficiency trends, and equipment run statistics.
Structure: ## Maintenance Plan / ## Priority 1 (this week) / ## Priority 2 (this month) / ## Routine Items.""",
}


def _json_default(obj: Any) -> Any:
    """Handle types that standard json.dumps can't serialize."""
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, default=_json_default)}\n\n"


async def run_agent(
    mode: str,
    goal: str,
    context: dict | None = None,
    model: str | None = None,
) -> AsyncIterator[str]:
    """
    Main agent entry point. Yields SSE-formatted strings.
    context: optional {equipment_id, hours, anomaly_id, ...}
    """
    run_id = str(uuid.uuid4())
    model  = model or settings.OLLAMA_DEFAULT_MODEL
    start  = time.time()

    log.info("agent_loop_begin run_id=%s mode=%s model=%s", run_id, mode, model)

    system_prompt = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["investigator"])

    # Build initial user message with optional context
    user_msg = goal
    if context:
        ctx_lines = [f"- {k}: {v}" for k, v in context.items() if v]
        if ctx_lines:
            user_msg += "\n\nContext:\n" + "\n".join(ctx_lines)

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_msg},
    ]

    agent_ctx = ToolContext()

    # ── ReAct loop ────────────────────────────────────────────────────────────
    step = 0
    for _ in range(MAX_STEPS):
        step += 1
        try:
            response = await chat(messages, tools=TOOL_SCHEMAS, model=model)
        except OllamaUnavailableError as e:
            log.warning("agent_ollama_unavailable run_id=%s step=%s", run_id, step)
            yield _sse({"type": "error", "detail": e.detail})
            return
        except AppError as e:
            log.warning("agent_app_error run_id=%s step=%s status=%s", run_id, step, e.status_code)
            yield _sse({"type": "error", "detail": e.detail})
            return
        except Exception:
            log.exception("agent_chat_failed run_id=%s mode=%s step=%s", run_id, mode, step)
            yield _sse({"type": "error", "detail": "LLM request failed. Check server logs for details."})
            return

        msg = response.get("message", {})

        # ── Case 1: model wants to call tool(s) ───────────────────────────────
        tool_calls = msg.get("tool_calls") or []
        if tool_calls:
            tool_results_for_history: list[tuple[str, dict]] = []

            for ti, tc in enumerate(tool_calls):
                fn   = tc.get("function", {})
                name = fn.get("name", "")
                args = fn.get("arguments", {})

                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        args = {}

                yield _sse({
                    "type": "tool_call",
                    "tool": name,
                    "args": args,
                    "step": step,
                    "tool_index": ti,
                })

                try:
                    raw_result = await asyncio.wait_for(
                        execute_tool(name, args, ctx=agent_ctx),
                        timeout=30.0,
                    )
                except asyncio.TimeoutError:
                    log.warning("agent_tool_timeout tool=%s run_id=%s step=%s", name, run_id, step)
                    raw_result = {"error": f"Tool '{name}' timed out after 30 s — skipping."}

                compact = compact_agent_tool_payload(name, raw_result)
                log.debug("agent_tool_result tool=%s step=%s keys=%s", name, step, list(raw_result.keys())[:8])
                yield _sse({
                    "type": "tool_result",
                    "tool": name,
                    "result": compact,
                    "step": step,
                    "tool_index": ti,
                })
                tool_results_for_history.append((name, compact))

            messages.append({
                "role": "assistant",
                "content": msg.get("content", ""),
                "tool_calls": tool_calls,
            })
            for name_i, compact_i in tool_results_for_history:
                messages.append({
                    "role": "tool",
                    "content": json.dumps(compact_i, default=str),
                    "name": name_i,
                })
            continue  # next iteration

        # ── Case 2: model returns text — stream it as the final answer ────────
        content = msg.get("content", "").strip()
        if content:
            # Re-send messages with the assistant content to stream the final answer
            messages.append({"role": "assistant", "content": content})
            # Stream the already-received content token by token (word chunks)
            words = content.split(" ")
            for i, word in enumerate(words):
                token = (word + " ") if i < len(words) - 1 else word
                yield _sse({"type": "token", "content": token})
        else:
            # Edge case: empty content, ask model to summarize
            messages.append({"role": "user", "content": "Summarize your findings in the required format."})
            try:
                async for chunk in stream_chat_text(messages, model=model):
                    yield _sse({"type": "token", "content": chunk})
            except OllamaUnavailableError as e:
                yield _sse({"type": "error", "detail": e.detail})
                return
            except AppError as e:
                yield _sse({"type": "error", "detail": e.detail})
                return

        total_ms = int((time.time() - start) * 1000)
        log.info(
            "agent_loop_complete run_id=%s mode=%s steps=%s total_ms=%s model=%s",
            run_id,
            mode,
            step,
            total_ms,
            model,
        )
        yield _sse({"type": "done", "run_id": run_id, "steps": step, "total_ms": total_ms, "model": model})
        return

    # Hit max steps without a final answer
    log.warning("agent_max_steps run_id=%s mode=%s steps=%s", run_id, mode, MAX_STEPS)
    yield _sse({"type": "error", "detail": f"Agent reached max steps ({MAX_STEPS}) without a final answer."})
