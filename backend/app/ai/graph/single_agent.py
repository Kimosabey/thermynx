"""Single-agent StateGraph (F3) — skeleton + preflight gate.

This is the LangGraph port of the analyzer/agent flow. Built incrementally:

  [done]  START → preflight → (refused → END | continue → respond) → END
          + MemorySaver checkpointer (F1.10), conditional edge (F3.10)
  [next]  flesh out the `continue` path into the full node chain
          context → rag → prompt → llm → tools(ReAct) → postcheck → critique
          (F3.3–F3.9) + SSE adapter (F3.11) + loop robustness (F3.12).

The preflight node is pure-regex (no DB/Ollama), so this skeleton runs and is
validated offline. The remaining nodes wrap existing functions and are exercised
on the box (DB + Ollama). langgraph is imported lazily inside the builder.
"""
from __future__ import annotations

from typing import Any, Literal

from app.ai.graph.state import AgentState
from app.ai.preflight import check_action_request, check_equipment_mentions, topic_gate


# ── Nodes ────────────────────────────────────────────────────────────────────
def preflight_node(state: AgentState) -> dict[str, Any]:
    """Deterministic gate — same checks/order as analyzer.py (F3.2)."""
    q = state.get("question", "") or ""
    refusal = (
        check_action_request(q)
        or check_equipment_mentions(q)
        or topic_gate(q, equipment_id=state.get("equipment_id"))
    )
    # On refusal the refusal text IS the answer (read-only, deterministic).
    return {"refusal": refusal, "answer": refusal or ""}


def respond_node(state: AgentState) -> dict[str, Any]:
    """Placeholder for the grounded answer path.

    TODO F3.3–F3.9: replace with context → rag → prompt → llm(+tools) →
    postcheck → critique. Kept minimal so the graph compiles and the preflight
    path is end-to-end testable today.
    """
    return {"answer": state.get("answer", "")}


# ── Edges ────────────────────────────────────────────────────────────────────
def route_after_preflight(state: AgentState) -> Literal["refused", "continue"]:
    return "refused" if state.get("refusal") else "continue"


# ── Builder ──────────────────────────────────────────────────────────────────
def build_single_agent_graph(checkpointer: Any | None = None) -> Any:
    """Compile the single-agent graph. Pass a checkpointer (Postgres/Redis in
    production, F1.10); defaults to in-memory for tests/dev."""
    from langgraph.graph import StateGraph, START, END

    g = StateGraph(AgentState)
    g.add_node("preflight", preflight_node)
    g.add_node("respond", respond_node)

    g.add_edge(START, "preflight")
    g.add_conditional_edges(
        "preflight",
        route_after_preflight,
        {"refused": END, "continue": "respond"},
    )
    g.add_edge("respond", END)

    if checkpointer is None:
        from langgraph.checkpoint.memory import MemorySaver
        checkpointer = MemorySaver()
    return g.compile(checkpointer=checkpointer)
