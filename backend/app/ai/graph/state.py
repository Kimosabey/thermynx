"""Shared state for the agentic StateGraph (F3.1).

A single typed state object threaded through every node. Fields mirror the data
the current analyzer/agent surfaces pass between stages (see app/api/v1/analyzer.py
and app/ai/agent.py) so the graph is a faithful port.

``messages`` uses an additive reducer for the ReAct tool loop (append, don't replace).
``total=False`` — nodes return partial updates; LangGraph merges them.
"""
from __future__ import annotations

from operator import add
from typing import Annotated, Any, Optional, TypedDict


class AgentState(TypedDict, total=False):
    # ── inputs ────────────────────────────────────────────────────────────────
    question: str
    equipment_id: Optional[str]
    hours: int
    mode: str                       # "analyzer" or an agent mode (investigator, …)
    model: Optional[str]            # explicit override; else per-task routing

    # ── grounding (filled by context/rag nodes) ───────────────────────────────
    context: dict[str, Any]
    summary: dict[str, Any]
    rag_chunks: list[Any]           # RetrievedChunk objects (from app.ai.rag)
    rag_context: str
    prompt: str

    # ── conversation / ReAct loop ─────────────────────────────────────────────
    messages: Annotated[list[dict[str, Any]], add]
    step: int

    # ── control ───────────────────────────────────────────────────────────────
    refusal: Optional[str]          # set by preflight → short-circuit to END
    cache_hit: bool

    # ── outputs ───────────────────────────────────────────────────────────────
    answer: str
    audit: dict[str, Any]           # postcheck result
    verdict: dict[str, Any]         # critique result
