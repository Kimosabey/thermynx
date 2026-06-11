"""F4.9 — HITL approval gate on the multi-agent graph (offline).

Stubs the LLM-calling nodes (planner/specialists/synthesis/postcheck/critique) so
the test exercises the REAL interrupt/resume wiring + routing without Ollama:

  require_approval=True  → graph pauses after the plan (interrupt)
  resume approve         → specialists + synthesis run
  resume reject          → refusal, specialists never run

Also covers the pure routing functions.
"""
import asyncio

from langgraph.types import Command

import app.ai.graph.multi_agent_graph as mag


# ── pure routing ─────────────────────────────────────────────────────────────

def test_route_after_planner():
    assert mag.route_after_planner({"require_approval": True}) == "await_approval"
    assert mag.route_after_planner({"require_approval": False}) == "run"
    assert mag.route_after_planner({}) == "run"


def test_route_after_approval():
    assert mag.route_after_approval({"refusal": "rejected by operator"}) == "rejected"
    assert mag.route_after_approval({}) == "approved"


# ── interrupt / resume mechanism ─────────────────────────────────────────────

def _stub_llm_nodes(monkeypatch):
    async def fake_planner(state):
        return {"plan": {"rationale": "test plan", "subtasks": [{"specialist": "investigator", "goal": "look"}]}}

    async def fake_specialists(state):
        return {"findings": [{"specialist": "investigator", "goal": "look",
                              "summary": "found X", "audit": {}, "had_error": False}]}

    async def fake_synthesis(state):
        return {"answer": "synthesized final answer"}

    def fake_postcheck(state):
        return {"audit": {"status": "ok", "flag_count": 0}}

    async def fake_critique(state):
        return {"verdict": {"status": "ok"}}

    monkeypatch.setattr(mag, "planner_node", fake_planner)
    monkeypatch.setattr(mag, "specialists_node", fake_specialists)
    monkeypatch.setattr(mag, "synthesis_node", fake_synthesis)
    monkeypatch.setattr(mag, "postcheck_node", fake_postcheck)
    monkeypatch.setattr(mag, "critique_node", fake_critique)


def _updates(graph, inputs, cfg):
    async def _go():
        out = []
        async for u in graph.astream(inputs, cfg, stream_mode="updates"):
            out.append(u)
        return out
    return asyncio.get_event_loop().run_until_complete(_go())


def test_approval_pauses_then_resumes(monkeypatch):
    _stub_llm_nodes(monkeypatch)
    graph = mag.build_multi_agent_graph()
    cfg = {"configurable": {"thread_id": "hitl-approve"}, "recursion_limit": 50}

    # Phase 1 — require_approval → graph interrupts after the plan; specialists do NOT run.
    first = _updates(graph, {"question": "why is efficiency low?", "require_approval": True}, cfg)
    assert any("__interrupt__" in u for u in first), f"expected interrupt, got {first}"
    assert not any("findings" in d for u in first for d in u.values() if isinstance(d, dict)), \
        "specialists must not run before approval"

    # Phase 2 — approve → specialists + synthesis run to completion.
    second = _updates(graph, Command(resume={"action": "approve"}), cfg)
    answers = [d.get("answer") for u in second for d in u.values() if isinstance(d, dict) and d.get("answer")]
    assert any("synthesized" in (a or "") for a in answers), f"expected synthesis after approve, got {second}"


def test_reject_short_circuits(monkeypatch):
    _stub_llm_nodes(monkeypatch)
    graph = mag.build_multi_agent_graph()
    cfg = {"configurable": {"thread_id": "hitl-reject"}, "recursion_limit": 50}

    _updates(graph, {"question": "why is efficiency low?", "require_approval": True}, cfg)
    out = _updates(graph, Command(resume={"action": "reject"}), cfg)
    refusals = [d.get("refusal") for u in out for d in u.values() if isinstance(d, dict) and d.get("refusal")]
    assert any("rejected" in (r or "").lower() for r in refusals), f"expected refusal on reject, got {out}"
    assert not any("findings" in d for u in out for d in u.values() if isinstance(d, dict)), \
        "specialists must not run after reject"


def test_no_approval_runs_straight_through(monkeypatch):
    _stub_llm_nodes(monkeypatch)
    graph = mag.build_multi_agent_graph()
    cfg = {"configurable": {"thread_id": "hitl-noapprove"}, "recursion_limit": 50}

    out = _updates(graph, {"question": "why is efficiency low?", "require_approval": False}, cfg)
    assert not any("__interrupt__" in u for u in out), "must not pause when approval not required"
    answers = [d.get("answer") for u in out for d in u.values() if isinstance(d, dict) and d.get("answer")]
    assert any("synthesized" in (a or "") for a in answers), f"expected synthesis without approval, got {out}"
