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


# ── Edges ────────────────────────────────────────────────────────────────────
def route_after_preflight(state: AgentState) -> Literal["refused", "continue"]:
    return "refused" if state.get("refusal") else "continue"


# ── Builder ──────────────────────────────────────────────────────────────────
def build_single_agent_graph(checkpointer: Any | None = None) -> Any:
    """Compile the single-agent grounded graph (analyzer surface port).

    START → preflight → (refused → END | continue → context → rag → prompt →
    llm → postcheck → critique → END). Pass a checkpointer (Postgres/Redis in
    production, F1.10); defaults to in-memory for tests/dev.

    Next (F3.7): bind tools to the llm node + a conditional ReAct loop for the
    agent surface.
    """
    from langgraph.graph import StateGraph, START, END

    from app.ai.graph.nodes import (
        context_node, rag_node, prompt_node, llm_node, postcheck_node, critique_node,
    )

    g = StateGraph(AgentState)  # type: ignore[arg-type]  # pyright<->langgraph TypedDict generic bound; runtime-validated
    g.add_node("preflight", preflight_node)
    g.add_node("context", context_node)
    g.add_node("rag", rag_node)
    g.add_node("prompt", prompt_node)
    g.add_node("llm", llm_node)
    g.add_node("postcheck", postcheck_node)
    g.add_node("critique", critique_node)

    g.add_edge(START, "preflight")
    g.add_conditional_edges(
        "preflight",
        route_after_preflight,
        {"refused": END, "continue": "context"},
    )
    g.add_edge("context", "rag")
    g.add_edge("rag", "prompt")
    g.add_edge("prompt", "llm")
    g.add_edge("llm", "postcheck")
    g.add_edge("postcheck", "critique")
    g.add_edge("critique", END)

    if checkpointer is None:
        from langgraph.checkpoint.memory import MemorySaver
        checkpointer = MemorySaver()
    return g.compile(checkpointer=checkpointer)
