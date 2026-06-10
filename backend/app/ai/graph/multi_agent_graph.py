"""Multi-agent supervisor StateGraph (F4).

Port of app/ai/multi_agent.py onto LangGraph, reusing the F3 ReAct graph as the
specialist runtime:

  preflight → planner → specialists → synthesis → postcheck → critique → END

- **planner** (F4.1/F4.2): `gemma4` via structured output → `Plan` (schema validates;
  no prose-parse). Fallback to a single investigator subtask if empty.
- **specialists** (F4.3/F4.4): each subtask runs the F3 ReAct graph; run in parallel
  via asyncio.gather — safe on the 20 GB box because specialists **share the tool
  model (devstral)** (the VRAM thrash is only across *different* models). Per-specialist
  audit + failed-specialist "do not infer" marker (F4.6/F4.7).
- **synthesis** (F4.8): `phi4` merges findings.
- **postcheck + critique**: groundedness parity for multi-agent (A1) — the gap the
  current `multi_agent.py` had (synthesis was unaudited).

Cross-role model swaps (gemma4 → devstral → phi4) cold-load on the 20 GB box;
co-resident on the 48 GB prod box. SSE per-specialist re-tagging (F4.10) is deferred.
"""
from __future__ import annotations

import asyncio
from typing import Any, Literal, Optional, TypedDict

from app.config import settings
from app.log import get_logger
from app.ai.graph.models import chat_model, structured_model
from app.ai.graph.schemas import Plan
from app.ai.graph.react_agent import build_react_agent_graph
from app.ai.preflight import check_action_request, check_equipment_mentions
from app.ai.prompts.agent_prompts import PLANNER_PROMPT, SYNTHESIS_PROMPT

log = get_logger("ai.graph.multi_agent")

_MAX_SUBTASKS = 4


class MultiAgentState(TypedDict, total=False):
    question: str
    context: Optional[dict[str, Any]]
    plan: dict[str, Any]
    findings: list[dict[str, Any]]
    answer: str
    audit: dict[str, Any]
    verdict: dict[str, Any]
    refusal: Optional[str]


def ma_preflight_node(state: MultiAgentState) -> dict[str, Any]:
    q = state.get("question", "") or ""
    refusal = check_action_request(q) or check_equipment_mentions(q)
    return {"refusal": refusal, "answer": refusal or ""}


def route_after_preflight(state: MultiAgentState) -> Literal["refused", "continue"]:
    return "refused" if state.get("refusal") else "continue"


async def planner_node(state: MultiAgentState) -> dict[str, Any]:
    """Decompose the goal into specialist subtasks via structured output (gemma4)."""
    goal = state.get("question", "")
    ctx = state.get("context") or {}
    ctx_block = ""
    if ctx:
        lines = [f"- {k}: {v}" for k, v in ctx.items() if v is not None]
        if lines:
            ctx_block = "\n\nContext provided by operator:\n" + "\n".join(lines)
    prompt = (
        PLANNER_PROMPT.format(max_subtasks=_MAX_SUBTASKS)
        + f"\n\nOperator question:\n{goal}{ctx_block}\n\nReturn the JSON plan now."
    )
    rationale, subs = "", []
    try:
        plan: Plan = await structured_model("planner", Plan, temperature=0.0).ainvoke(prompt)
        rationale = plan.rationale
        # dedupe specialists, cap (mirror multi_agent.py)
        seen: set[str] = set()
        for s in plan.subtasks:
            if s.specialist in seen or not s.goal.strip():
                continue
            subs.append({"specialist": s.specialist, "goal": s.goal})
            seen.add(s.specialist)
            if len(subs) >= _MAX_SUBTASKS:
                break
    except Exception as exc:
        log.warning("planner_structured_failed err=%s", exc)
    if not subs:
        subs = [{"specialist": "investigator", "goal": goal}]  # fallback
        rationale = rationale or "Planner returned no valid subtasks; routing to investigator."
    return {"plan": {"rationale": rationale, "subtasks": subs}}


async def specialists_node(state: MultiAgentState) -> dict[str, Any]:
    """Run each subtask through the F3 ReAct graph, in parallel (shared devstral)."""
    subs = (state.get("plan") or {}).get("subtasks", [])
    ctx = state.get("context")
    react = build_react_agent_graph()

    async def _run(i: int, st: dict[str, Any]) -> dict[str, Any]:
        spec, sgoal = st["specialist"], st["goal"]
        had_error = False
        try:
            r = await react.ainvoke(
                {"question": sgoal, "mode": spec, "context": ctx},
                {"configurable": {"thread_id": f"spec-{i}-{spec}"}, "recursion_limit": 30},
            )
            summary = (r.get("answer") or "").strip()
            audit = r.get("audit", {})
        except Exception as exc:
            log.exception("specialist_failed idx=%s spec=%s", i, spec)
            summary, audit, had_error = "", {}, True
        if had_error or not summary:
            had_error = True
            summary = (f"[Sub-task '{spec}' produced no output. "
                       "Do NOT infer or fabricate findings for this specialist — acknowledge the gap.]")
        return {"specialist": spec, "goal": sgoal, "summary": summary, "audit": audit, "had_error": had_error}

    findings = await asyncio.gather(*[_run(i, st) for i, st in enumerate(subs)])
    return {"findings": list(findings)}


async def synthesis_node(state: MultiAgentState) -> dict[str, Any]:
    """Merge specialist findings into one answer (phi4 / TEXT model)."""
    goal = state.get("question", "")
    findings = state.get("findings", [])
    block = "\n\n".join(
        f"### Specialist: {f['specialist']}\nGoal: {f['goal']}\n\n{f['summary'] or '(no answer)'}"
        for f in findings
    )
    prompt = (
        SYNTHESIS_PROMPT
        + f"\n\nORIGINAL QUESTION:\n{goal}\n\nFINDINGS:\n{block}\n\nProduce the synthesised answer now."
    )
    model = chat_model("text", temperature=0.2, num_predict=settings.OLLAMA_MAX_TOKENS_SYNTH)
    resp = await model.ainvoke(prompt)
    return {"answer": resp.content if hasattr(resp, "content") else str(resp)}


def postcheck_node(state: MultiAgentState) -> dict[str, Any]:
    """Groundedness audit on the synthesis (A1 parity — multi_agent.py lacked this)."""
    from app.ai.postcheck import run_postcheck
    from app.domain.equipment import EQUIPMENT_CATALOG

    ans = state.get("answer", "") or ""
    if not ans.strip():
        return {"audit": {"status": "skipped", "reason": "empty answer", "flag_count": 0}}
    return {"audit": run_postcheck(ans, equipment_catalog=EQUIPMENT_CATALOG)}


async def critique_node(state: MultiAgentState) -> dict[str, Any]:
    from app.ai.critique import verify_answer

    ans = state.get("answer", "") or ""
    if not ans.strip():
        return {"verdict": {"status": "skipped", "reason": "empty answer"}}
    return {"verdict": await verify_answer(ans, {}, model=None)}


def build_multi_agent_graph(checkpointer: Any | None = None) -> Any:
    from langgraph.graph import StateGraph, START, END

    g = StateGraph(MultiAgentState)  # type: ignore[arg-type]
    g.add_node("preflight", ma_preflight_node)
    g.add_node("planner", planner_node)
    g.add_node("specialists", specialists_node)
    g.add_node("synthesis", synthesis_node)
    g.add_node("postcheck", postcheck_node)
    g.add_node("critique", critique_node)

    g.add_edge(START, "preflight")
    g.add_conditional_edges("preflight", route_after_preflight, {"refused": END, "continue": "planner"})
    g.add_edge("planner", "specialists")
    g.add_edge("specialists", "synthesis")
    g.add_edge("synthesis", "postcheck")
    g.add_edge("postcheck", "critique")
    g.add_edge("critique", END)

    if checkpointer is None:
        from langgraph.checkpoint.memory import MemorySaver
        checkpointer = MemorySaver()
    return g.compile(checkpointer=checkpointer)
