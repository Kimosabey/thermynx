import json
import re
import time
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_pg
from app.db.models import AgentRun, Message, Thread
from app.ai.agent import run_agent
from app.ai.multi_agent import run_multi_agent
from app.limiter import limiter
from app.config import settings
from app.log import get_logger
from app.errors import AppError

router = APIRouter()
log = get_logger("api.agent")

VALID_MODES = {"investigator", "optimizer", "brief", "root_cause", "maintenance"}


async def _persist_turn(pg: AsyncSession, thread_id: str | None, prompt: str, answer: str, status: str):
    """Write a user+assistant message pair into a thread after a clean run.
    Skips empty/cancelled turns so history stays clean. Mirrors analyzer.py:343-361."""
    if not (thread_id and answer.strip() and status != "cancelled"):
        return
    try:
        pg.add(Message(id=str(uuid.uuid4()), thread_id=thread_id, role="user", content=prompt))
        pg.add(Message(id=str(uuid.uuid4()), thread_id=thread_id, role="assistant", content=answer))
        thr = await pg.get(Thread, thread_id)
        if thr:
            thr.updated_at = datetime.utcnow()
            if thr.title in (None, "", "Conversation"):
                thr.title = re.sub(r"\s+", " ", prompt.strip())[:200]
        await pg.commit()
    except Exception:
        log.warning("agent_turn_persist_failed thread_id=%s", thread_id)


class AgentRequest(BaseModel):
    mode:        str = Field(default="investigator")
    goal:        str = Field(..., min_length=3, max_length=2000)
    context:     dict | None = None    # {equipment_id, hours, anomaly_id, ...}
    model:       str | None = None
    thread_id:   str | None = Field(default=None, max_length=36)  # load prior conversation history


# ── F7 cutover: serve the agent / orchestrator from the LangGraph rewrite ─────
_react_graph = None
_multi_graph = None


def _get_react_graph():
    global _react_graph
    if _react_graph is None:
        from app.ai.graph.react_agent import build_react_agent_graph
        _react_graph = build_react_agent_graph()
    return _react_graph


def _get_multi_graph():
    global _multi_graph
    if _multi_graph is None:
        from app.ai.graph.multi_agent_graph import build_multi_agent_graph
        _multi_graph = build_multi_agent_graph()
    return _multi_graph


async def _graph_agent_stream(request: Request, req, pg: AsyncSession):
    """USE_GRAPH_AGENT path — ReAct graph; preserves the AgentRun row + thread persistence."""
    from app.ai.graph.sse import astream_sse
    run_id = str(uuid.uuid4())
    # Stamp the NARRATION model (OLLAMA_MODEL_TEXT = phi4) for the done-frame label —
    # that's the model that writes the final answer. devstral runs the tool loop; the
    # DEFAULT model never runs here, so showing it (mistral-small3.2) was misleading.
    model = req.model or settings.OLLAMA_MODEL_TEXT or settings.OLLAMA_DEFAULT_MODEL
    run = AgentRun(id=run_id, mode=req.mode, goal=req.goal,
                   context_json=json.dumps(req.context) if req.context else None,
                   model=model, status="running",
                   request_id=getattr(request.state, "request_id", None))
    pg.add(run)
    await pg.commit()
    inputs = {"question": req.goal, "mode": req.mode, "context": req.context}
    cfg = {"configurable": {"thread_id": req.thread_id or run_id}, "recursion_limit": 30}
    tokens: list[str] = []
    tool_calls = 0
    status = "error"
    t0 = time.monotonic()
    try:
        async for frame in astream_sse(_get_react_graph(), inputs, cfg, done_extra={"run_id": run_id}):
            if await request.is_disconnected():
                status = "cancelled"
                break
            # Parse first so we can enrich the terminal `done` frame. The graph SSE
            # adapter emits a bare {type:done, run_id}; the UI header needs steps +
            # total_ms + model (else it shows a blank step count / 0.0s).
            try:
                d = json.loads(frame[6:])
                t = d.get("type")
            except Exception:
                d, t = None, None
            if t == "token":
                tokens.append((d or {}).get("content", ""))
            elif t == "tool_call":
                tool_calls += 1
            elif t == "error":
                status = "error"
            elif t == "done":
                status = "ok"
                total_ms = int((time.monotonic() - t0) * 1000)
                yield (
                    "data: "
                    + json.dumps({"type": "done", "run_id": run_id, "steps": tool_calls,
                                  "total_ms": total_ms, "model": model})
                    + "\n\n"
                )
                continue
            yield frame
    except Exception:
        log.exception("agent_graph_failed run_id=%s", run_id)
        yield f"data: {json.dumps({'type':'error','detail':'Agent graph failed.'})}\n\n"
        status = "error"
    answer = "".join(tokens)
    run.final_output = answer or None
    run.steps_taken = tool_calls
    run.status = status
    await pg.merge(run)
    await pg.commit()
    await _persist_turn(pg, req.thread_id, req.goal, answer, status)


async def _graph_orchestrate_stream(request: Request, req, pg: AsyncSession):
    """USE_GRAPH_ORCHESTRATE path — multi-agent graph; preserves the AgentRun row."""
    from app.ai.graph.sse import astream_sse
    run_id = str(uuid.uuid4())
    model = req.model or settings.OLLAMA_DEFAULT_MODEL
    run = AgentRun(id=run_id, mode="orchestrator", goal=req.goal,
                   context_json=json.dumps(req.context) if req.context else None,
                   model=model, status="running",
                   request_id=getattr(request.state, "request_id", None))
    pg.add(run)
    await pg.commit()
    inputs = {"question": req.goal, "context": req.context,
              "require_approval": bool(getattr(req, "require_approval", False))}
    cfg = {"configurable": {"thread_id": run_id}, "recursion_limit": 50}
    tokens: list[str] = []
    status = "error"
    try:
        async for frame in astream_sse(_get_multi_graph(), inputs, cfg, done_extra={"run_id": run_id}):
            if await request.is_disconnected():
                status = "cancelled"
                break
            yield frame
            try:
                d = json.loads(frame[6:])
                t = d.get("type")
                if t == "token":
                    tokens.append(d.get("content", ""))
                elif t == "done":
                    status = "ok"
                elif t == "awaiting_approval":
                    # F4.9 — paused for operator sign-off; run is NOT finished. The
                    # /agent/resume call (same thread_id=run_id) finalizes the row.
                    status = "awaiting_approval"
                elif t == "error":
                    status = "error"
            except Exception:
                pass
    except Exception:
        log.exception("orchestrate_graph_failed run_id=%s", run_id)
        yield f"data: {json.dumps({'type':'error','detail':'Orchestrator graph failed.'})}\n\n"
        status = "error"
    run.final_output = "".join(tokens) or None
    run.status = status
    await pg.merge(run)
    await pg.commit()


async def _stream(request: Request, req: AgentRequest, pg: AsyncSession):
    if req.mode not in VALID_MODES:
        log.warning("agent_unknown_mode mode=%s request_id=%s", req.mode, getattr(request.state, "request_id", None))
        yield f"data: {json.dumps({'type':'error','detail':f'Unknown mode: {req.mode}'})}\n\n"
        return

    # Layer 1 — pre-flight: catch unknown equipment + action requests before
    # paying for the ReAct loop (saves 15-30s per refused goal).
    from app.ai.preflight import check_action_request, check_equipment_mentions
    refusal = check_action_request(req.goal) or check_equipment_mentions(req.goal)
    if refusal:
        log.info("agent_preflight_refused mode=%s reason=%s", req.mode, refusal[:120])
        yield f"data: {json.dumps({'type':'token','content': refusal})}\n\n"
        yield f"data: {json.dumps({'type':'done','steps':0,'preflight_refused':True})}\n\n"
        return

    # F7 cutover — serve from the ReAct LangGraph when enabled (default OFF = path below).
    if settings.USE_GRAPH_AGENT:
        async for frame in _graph_agent_stream(request, req, pg):
            yield frame
        return

    # Load conversation history from thread so agents have multi-turn context
    # (mirrors what the analyzer does — see api/v1/analyzer.py:98-107).
    conversation_summary: str = ""
    if req.thread_id:
        try:
            res = await pg.execute(
                select(Message)
                .where(Message.thread_id == req.thread_id)
                .order_by(Message.created_at.desc())
                .limit(12)
            )
            msgs = list(reversed(res.scalars().all()))
            if msgs:
                history_lines = []
                for m in msgs:
                    content = (m.content or "").strip()
                    if not content or len(content) > 4000:
                        continue
                    history_lines.append(f"{m.role.upper()}: {content[:500]}")
                if history_lines:
                    conversation_summary = "Prior conversation:\n" + "\n".join(history_lines)
        except Exception:
            log.warning("agent_history_load_failed thread_id=%s", req.thread_id)

    run_id = str(uuid.uuid4())
    # `model` is recorded on the run row / logged. Pass req.model (may be None)
    # into run_agent so it resolves the PER-ROLE models (tool→OLLAMA_MODEL_TOOL,
    # narration→OLLAMA_MODEL_TEXT). Do NOT collapse to OLLAMA_DEFAULT_MODEL here:
    # that would force one model for tool-calling too, and a narration model like
    # phi4 cannot do function-calling → "does not support tools" at step 1.
    model  = req.model or settings.OLLAMA_DEFAULT_MODEL

    # Inject history into context so run_agent appends it to the user message
    agent_context = dict(req.context or {})
    if conversation_summary:
        agent_context["conversation_history"] = conversation_summary

    # Persist run row
    run = AgentRun(
        id=run_id,
        mode=req.mode,
        goal=req.goal,
        context_json=json.dumps(req.context) if req.context else None,
        model=model,
        status="running",
        request_id=getattr(request.state, "request_id", None),
    )
    pg.add(run)
    await pg.commit()

    log.info(
        "agent_run_start run_id=%s mode=%s model=%s request_id=%s",
        run_id,
        req.mode,
        model,
        getattr(request.state, "request_id", None),
    )

    final_tokens: list[str] = []
    steps = 0
    status = "error"

    try:
        async for frame in run_agent(req.mode, req.goal, agent_context or None, model=req.model):
            if await request.is_disconnected():
                status = "cancelled"
                break
            yield frame
            # Track final output + step count from done frame
            try:
                data = json.loads(frame[6:])  # strip "data: "
                if data["type"] == "token":
                    final_tokens.append(data["content"])
                if data["type"] == "done":
                    steps = data.get("steps", 0)
                    status = "ok"
            except Exception:
                pass
    except AppError as e:
        rid = getattr(request.state, "request_id", None)
        log.warning(
            "agent_run_app_error run_id=%s detail=%s request_id=%s",
            run_id,
            e.detail,
            rid,
        )
        yield f"data: {json.dumps({'type':'error','detail':e.detail,'request_id':rid})}\n\n"
        status = "error"
    except Exception:
        log.exception(
            "agent_run_stream_error run_id=%s request_id=%s",
            run_id,
            getattr(request.state, "request_id", None),
        )
        rid = getattr(request.state, "request_id", None)
        yield f"data: {json.dumps({'type':'error','detail':'Agent run failed.','request_id':rid})}\n\n"
        status = "error"

    # Post-gen audit — same postcheck the analyzer runs, gives agents parity.
    # Runs after stream ends; never blocks the response.
    if status == "ok" and final_tokens:
        try:
            from app.ai.postcheck import run_postcheck
            from app.domain.equipment import EQUIPMENT_CATALOG
            audit_result = run_postcheck(
                "".join(final_tokens),
                equipment_catalog=EQUIPMENT_CATALOG,
            )
            yield f"data: {json.dumps({'type': 'audit', 'audit': audit_result})}\n\n"
        except Exception:
            log.exception("agent_postcheck_failed run_id=%s", run_id)

    # Update run row
    run.final_output = "".join(final_tokens) or None
    run.steps_taken  = steps
    run.status       = status
    await pg.merge(run)
    await pg.commit()

    # Persist the turn into the thread so agent answers show in conversation
    # history + inform Nyx's routing carry-over (mirrors analyzer.py:343-361).
    await _persist_turn(pg, req.thread_id, req.goal, "".join(final_tokens), status)

    log.info(
        "agent_run_done run_id=%s mode=%s status=%s steps=%s request_id=%s",
        run_id,
        req.mode,
        status,
        steps,
        getattr(request.state, "request_id", None),
    )


@router.post("/agent/run")
@limiter.limit("20/minute")  # aligned with analyzer (was 10 — arbitrary 3x gap vs analyzer's 30/min)
async def agent_run(
    request: Request,
    req: AgentRequest,
    pg: AsyncSession = Depends(get_pg),
):
    return StreamingResponse(
        _stream(request, req, pg),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class OrchestrateRequest(BaseModel):
    goal:      str = Field(..., min_length=3, max_length=2000)
    context:   dict | None = None
    model:     str | None = None
    thread_id: str | None = Field(default=None, max_length=36)  # persist turn into conversation
    require_approval: bool = False   # F4.9 — pause after the plan for operator sign-off (forces the graph path)


class ResumeRequest(BaseModel):
    """Resume a HITL-paused orchestration (F4.9). thread_id == the run_id returned
    in the awaiting_approval frame."""
    thread_id: str = Field(..., min_length=8, max_length=64)
    action:    str = Field(default="approve")   # "approve" | "reject"
    plan:      dict | None = None               # optional operator-edited plan (on approve)


class PlanRequest(BaseModel):
    """Planner inspector — run ONLY the planner on a goal (no specialists)."""
    goal:    str = Field(..., min_length=3, max_length=2000)
    context: dict | None = None


async def _orchestrate_stream(request: Request, req: OrchestrateRequest, pg: AsyncSession):
    """Multi-agent stream — same persistence model as `_stream`, mode='orchestrator'."""
    # Layer 1 — pre-flight: catch action requests + unknown equipment before
    # planner + N sub-agents fire (saves 60-90s per refused orchestration).
    from app.ai.preflight import check_action_request, check_equipment_mentions
    refusal = check_action_request(req.goal) or check_equipment_mentions(req.goal)
    if refusal:
        log.info("orchestrate_preflight_refused reason=%s", refusal[:120])
        yield f"data: {json.dumps({'type':'token','content': refusal})}\n\n"
        yield f"data: {json.dumps({'type':'done','subtasks':0,'preflight_refused':True})}\n\n"
        return

    # F7 cutover — serve from the multi-agent LangGraph when enabled (default OFF = path below).
    # F4.9 — HITL approval needs the graph (interrupt/resume), so an explicit
    # require_approval forces the graph path even when the flag is off.
    if settings.USE_GRAPH_ORCHESTRATE or req.require_approval:
        async for frame in _graph_orchestrate_stream(request, req, pg):
            yield frame
        return

    run_id = str(uuid.uuid4())
    # See _stream: record default for the row, but pass req.model (may be None)
    # so run_multi_agent resolves per-role models (planner→OLLAMA_MODEL_PLANNER,
    # sub-agent tools→OLLAMA_MODEL_TOOL, synthesis→OLLAMA_MODEL_TEXT).
    model  = req.model or settings.OLLAMA_DEFAULT_MODEL

    run = AgentRun(
        id=run_id,
        mode="orchestrator",
        goal=req.goal,
        context_json=json.dumps(req.context) if req.context else None,
        model=model,
        status="running",
        request_id=getattr(request.state, "request_id", None),
    )
    pg.add(run)
    await pg.commit()

    log.info(
        "orchestrator_run_start run_id=%s model=%s request_id=%s",
        run_id, model, getattr(request.state, "request_id", None),
    )

    synth_tokens: list[str] = []
    subtasks     = 0
    status       = "error"

    try:
        async for frame in run_multi_agent(req.goal, req.context, model=req.model):
            if await request.is_disconnected():
                status = "cancelled"
                break
            yield frame
            try:
                data = json.loads(frame[6:])
                if data["type"] == "synthesis_token":
                    synth_tokens.append(data["content"])
                elif data["type"] == "done":
                    subtasks = data.get("subtasks", 0)
                    status   = "ok"
                elif data["type"] == "error":
                    status = "error"
            except Exception:
                pass
    except AppError as e:
        rid = getattr(request.state, "request_id", None)
        log.warning("orchestrator_app_error run_id=%s detail=%s request_id=%s", run_id, e.detail, rid)
        yield f"data: {json.dumps({'type':'error','detail':e.detail,'request_id':rid})}\n\n"
        status = "error"
    except Exception:
        log.exception("orchestrator_run_error run_id=%s", run_id)
        rid = getattr(request.state, "request_id", None)
        yield f"data: {json.dumps({'type':'error','detail':'Orchestrator failed.','request_id':rid})}\n\n"
        status = "error"

    run.final_output = "".join(synth_tokens) or None
    run.steps_taken  = subtasks
    run.status       = status
    await pg.merge(run)
    await pg.commit()

    # Persist the synthesised answer into the thread (mirrors _stream).
    await _persist_turn(pg, req.thread_id, req.goal, "".join(synth_tokens), status)

    log.info(
        "orchestrator_run_done run_id=%s status=%s subtasks=%s request_id=%s",
        run_id, status, subtasks, getattr(request.state, "request_id", None),
    )


@router.post("/agent/orchestrate")
@limiter.limit("6/minute")
async def agent_orchestrate(
    request: Request,
    req: OrchestrateRequest,
    pg: AsyncSession = Depends(get_pg),
):
    """Multi-agent orchestration — decomposes one complex goal into specialist
    sub-tasks, then synthesises one final answer. Returns SSE stream."""
    return StreamingResponse(
        _orchestrate_stream(request, req, pg),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _resume_stream(request: Request, req: ResumeRequest, pg: AsyncSession):
    """Resume a HITL-paused multi-agent graph (F4.9) with the operator's decision.

    Reuses the SAME cached graph instance (_get_multi_graph) so its in-process
    checkpointer holds the paused state for `thread_id`. Streams the continuation
    (specialists → synthesis → audit → done) and finalizes the AgentRun row."""
    from app.ai.graph.sse import astream_sse
    from langgraph.types import Command

    action = req.action if req.action in ("approve", "reject") else "approve"
    resume_payload: dict = {"action": action}
    if action == "approve" and isinstance(req.plan, dict) and req.plan.get("subtasks"):
        resume_payload["plan"] = req.plan
    cfg = {"configurable": {"thread_id": req.thread_id}, "recursion_limit": 50}
    tokens: list[str] = []
    status = "error"
    try:
        async for frame in astream_sse(_get_multi_graph(), Command(resume=resume_payload), cfg,
                                       done_extra={"run_id": req.thread_id}):
            if await request.is_disconnected():
                status = "cancelled"
                break
            yield frame
            try:
                d = json.loads(frame[6:])
                t = d.get("type")
                if t == "token":
                    tokens.append(d.get("content", ""))
                elif t == "done":
                    status = "ok"
                elif t == "error":
                    status = "error"
            except Exception:
                pass
    except Exception:
        log.exception("orchestrate_resume_failed thread_id=%s", req.thread_id)
        yield f"data: {json.dumps({'type':'error','detail':'Resume failed.'})}\n\n"
        status = "error"

    # Finalize the run row created by the initial orchestrate (id == thread_id).
    try:
        run = await pg.get(AgentRun, req.thread_id)
        if run:
            run.final_output = "".join(tokens) or run.final_output
            run.status = status
            await pg.merge(run)
            await pg.commit()
    except Exception:
        log.warning("resume_run_finalize_failed thread_id=%s", req.thread_id)


@router.post("/agent/resume")
@limiter.limit("12/minute")
async def agent_resume(
    request: Request,
    req: ResumeRequest,
    pg: AsyncSession = Depends(get_pg),
):
    """Resume a HITL-paused orchestration (F4.9) — approve (optionally with an
    edited plan) or reject. Returns the continuation as an SSE stream."""
    return StreamingResponse(
        _resume_stream(request, req, pg),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/agent/plan")
@limiter.limit("12/minute")
async def agent_plan(request: Request, req: PlanRequest):
    """Planner inspector: run JUST the multi-agent planner (gemma4) and return the
    structured plan it would dispatch — rationale + ordered specialist subtasks. No
    specialists execute; lets an operator see how the planner decomposes a goal."""
    from app.ai.preflight import check_action_request, check_equipment_mentions
    refusal = check_action_request(req.goal) or check_equipment_mentions(req.goal)
    if refusal:
        return {"refusal": refusal, "plan": None, "model": settings.OLLAMA_MODEL_PLANNER}
    try:
        from app.ai.graph.multi_agent_graph import planner_node
        out = await planner_node({"question": req.goal, "context": req.context})
        return {"plan": out.get("plan"), "model": settings.OLLAMA_MODEL_PLANNER}
    except Exception:
        log.exception("planner_inspect_failed request_id=%s", getattr(request.state, "request_id", None))
        return {"error": "Planner failed to produce a plan.", "plan": None,
                "model": settings.OLLAMA_MODEL_PLANNER}


@router.get("/agent/history")
async def agent_history(
    limit: int = 20,
    mode: str | None = None,
    pg: AsyncSession = Depends(get_pg),
):
    where = "WHERE mode = :mode" if mode else ""
    params: dict[str, object] = {"limit": limit}
    if mode:
        params["mode"] = mode
    rows = await pg.execute(
        text(f"SELECT id, mode, goal, steps_taken, status, total_ms, created_at FROM agent_runs {where} ORDER BY created_at DESC LIMIT :limit"),
        params,
    )
    results = [dict(r._mapping) for r in rows]
    for r in results:
        if hasattr(r.get("created_at"), "isoformat"):
            r["created_at"] = r["created_at"].isoformat()
    return {"runs": results, "total": len(results)}
