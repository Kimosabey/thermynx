"""Agentic (LangGraph) endpoints — F7 parallel cutover surface.

NEW routes that serve the rewritten graphs via the existing SSE frame contract,
WITHOUT touching the live `/analyze`, `/agent/run`, `/agent/orchestrate` endpoints.
Lets the new graphs be exercised in the app side-by-side with the current
pipeline (shadow/preview). Full cutover (flip the existing endpoints) comes after
parity holds.

  POST /agentic/analyze      → grounded single-agent graph (analyzer port)
  POST /agentic/agent        → ReAct tool-loop graph (agent port)
  POST /agentic/orchestrate  → multi-agent supervisor graph

All stream `text/event-stream` with the same frames the UI already consumes
(token / tool_call / tool_result / audit / verification / done).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.limiter import limiter
from app.log import get_logger
from app.ai.graph.sse import astream_sse
from app.ai.graph.single_agent import build_single_agent_graph
from app.ai.graph.react_agent import build_react_agent_graph
from app.ai.graph.multi_agent_graph import build_multi_agent_graph

router = APIRouter()
log = get_logger("api.agentic")

# Compiled once; thread_id per request isolates state in the checkpointer.
_GROUNDED = build_single_agent_graph()
_REACT = build_react_agent_graph()
_MULTI = build_multi_agent_graph()

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


class GAnalyzeRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    equipment_id: str | None = None
    hours: int = Field(default=24, ge=1, le=8760)


class GAgentRequest(BaseModel):
    goal: str = Field(..., min_length=3, max_length=2000)
    mode: str = Field(default="investigator")
    context: dict | None = None


class GOrchestrateRequest(BaseModel):
    goal: str = Field(..., min_length=3, max_length=2000)
    context: dict | None = None


@router.post("/agentic/analyze")
@limiter.limit("20/minute")
async def agentic_analyze(request: Request, req: GAnalyzeRequest):
    inputs = {"question": req.question, "equipment_id": req.equipment_id, "hours": req.hours}
    cfg = {"configurable": {"thread_id": str(uuid.uuid4())}}
    log.info("agentic_analyze equipment=%s hours=%s", req.equipment_id, req.hours)
    return StreamingResponse(astream_sse(_GROUNDED, inputs, cfg),
                             media_type="text/event-stream", headers=_SSE_HEADERS)


@router.post("/agentic/agent")
@limiter.limit("20/minute")
async def agentic_agent(request: Request, req: GAgentRequest):
    inputs = {"question": req.goal, "mode": req.mode, "context": req.context}
    cfg = {"configurable": {"thread_id": str(uuid.uuid4())}, "recursion_limit": 30}
    log.info("agentic_agent mode=%s", req.mode)
    return StreamingResponse(astream_sse(_REACT, inputs, cfg),
                             media_type="text/event-stream", headers=_SSE_HEADERS)


@router.post("/agentic/orchestrate")
@limiter.limit("6/minute")
async def agentic_orchestrate(request: Request, req: GOrchestrateRequest):
    inputs = {"question": req.goal, "context": req.context}
    cfg = {"configurable": {"thread_id": str(uuid.uuid4())}, "recursion_limit": 50}
    log.info("agentic_orchestrate goal_len=%s", len(req.goal or ""))
    return StreamingResponse(astream_sse(_MULTI, inputs, cfg),
                             media_type="text/event-stream", headers=_SSE_HEADERS)
