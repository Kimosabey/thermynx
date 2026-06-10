"""Graph nodes for the single-agent grounded-answer path (F3.3-F3.9).

Each node is a faithful wrapper of the function the current analyzer already
calls (see app/api/v1/analyzer.py), so the graph is a like-for-like port:

  context  → fetch telemetry + summary        (app.db.telemetry)
  rag      → embed + pgvector retrieve          (app.ai.rag)
  prompt   → build the grounded prompt          (app.ai.prompts.hvac_prompts)
  llm      → per-task ChatOllama answer          (app.ai.graph.models router)
  postcheck→ regex groundedness audit           (app.ai.postcheck)
  critique → self-critique verdict (async)      (app.ai.critique)

Nodes are async where they touch the DB/Ollama. They open their own short-lived
sessions (like the analyzer) and return partial state updates.
"""
from __future__ import annotations

from typing import Any

from app.config import settings
from app.log import get_logger
from app.ai.graph.state import AgentState
from app.ai.graph.models import chat_model

log = get_logger("ai.graph.nodes")


async def context_node(state: AgentState) -> dict[str, Any]:
    """Fetch live telemetry + precomputed summary (mirrors analyzer context stage)."""
    from app.db.session import MySQLSession
    from app.db.telemetry import fetch_all_hvac_context, fetch_chiller_data, compute_summary
    from app.domain.equipment import get_by_id

    eid = state.get("equipment_id")
    hours = state.get("hours", 24)
    context: dict[str, Any] = {}
    async with MySQLSession() as db:
        if eid:
            eq = get_by_id(eid)
            if eq and eq["type"] == "chiller":
                context = {eid: await fetch_chiller_data(db, eq["table"], hours=hours)}
            else:
                context = await fetch_all_hvac_context(db, hours=hours)
        else:
            context = await fetch_all_hvac_context(db, hours=hours)
        summary = await compute_summary(context)
    return {"context": context, "summary": summary}


async def rag_node(state: AgentState) -> dict[str, Any]:
    """Embed the question + pgvector retrieve (wide) → FlashRank rerank → top-k. Graceful no-RAG."""
    from app.db.session import PGSession
    from app.ai.rag import retrieve, format_rag_context
    from app.ai.graph.rerank import rerank

    q = state.get("question", "")
    async with PGSession() as pg:
        chunks = await retrieve(pg, q, top_k=15, equipment_id=state.get("equipment_id"))
    chunks = rerank(q, chunks, top_k=5)  # cross-encoder refine (F2)
    return {"rag_chunks": chunks, "rag_context": format_rag_context(chunks) if chunks else ""}


def prompt_node(state: AgentState) -> dict[str, Any]:
    """Compose the grounded prompt (pure — same builder the analyzer uses)."""
    from app.ai.prompts.hvac_prompts import build_analyze_prompt
    from app.domain.equipment import EQUIPMENT_CATALOG

    prompt = build_analyze_prompt(
        state.get("question", ""),
        state.get("context", {}),
        state.get("summary", {}),
        conversation_history=None,
        rag_context=state.get("rag_context", ""),
        available_equipment=[
            {"id": e["id"], "name": e["name"], "type": e["type"]} for e in EQUIPMENT_CATALOG
        ],
        focus_equipment_id=state.get("equipment_id"),
        focus_hours=state.get("hours", 24),
    )
    return {"prompt": prompt}


async def llm_node(state: AgentState) -> dict[str, Any]:
    """Generate the answer via the per-task router (RAG model when chunks exist).

    Token cap = OLLAMA_MAX_TOKENS_ANALYZE (performance must-hold A2).
    """
    role = "rag" if state.get("rag_chunks") else "text"
    model = chat_model(role, temperature=0.0, num_predict=settings.OLLAMA_MAX_TOKENS_ANALYZE)
    resp = await model.ainvoke(state.get("prompt", ""))
    answer = resp.content if hasattr(resp, "content") else str(resp)
    return {"answer": answer}


def postcheck_node(state: AgentState) -> dict[str, Any]:
    """Regex groundedness audit (numeric / equipment / citation / language)."""
    from app.ai.postcheck import run_postcheck
    from app.domain.equipment import EQUIPMENT_CATALOG

    answer = state.get("answer", "") or ""
    if not answer.strip():
        return {"audit": {"status": "skipped", "reason": "empty answer", "flag_count": 0}}
    chunks = state.get("rag_chunks") or []
    audit = run_postcheck(
        answer,
        context=state.get("context", {}),
        summary=state.get("summary", {}),
        equipment_catalog=EQUIPMENT_CATALOG,
        retrieved_chunks=[{"source_id": c.source_id, "chunk_idx": c.chunk_idx} for c in chunks],
    )
    return {"audit": audit}


async def critique_node(state: AgentState) -> dict[str, Any]:
    """Self-critique verdict — non-blocking second opinion (never mutates answer)."""
    from app.ai.critique import verify_answer

    answer = state.get("answer", "") or ""
    if not answer.strip():
        return {"verdict": {"status": "skipped", "reason": "empty answer"}}
    verdict = await verify_answer(answer, state.get("summary", {}), model=None)
    return {"verdict": verdict}
