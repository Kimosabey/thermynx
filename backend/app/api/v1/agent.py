import json
import uuid
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_pg
from app.db.models import AgentRun, Message
from app.ai.agent import run_agent
from app.ai.multi_agent import run_multi_agent
from app.limiter import limiter
from app.config import settings
from app.log import get_logger
from app.errors import AppError

router = APIRouter()
log = get_logger("api.agent")

VALID_MODES = {"investigator", "optimizer", "brief", "root_cause", "maintenance"}


class AgentRequest(BaseModel):
    mode:        str = Field(default="investigator")
    goal:        str = Field(..., min_length=3, max_length=2000)
    context:     dict | None = None    # {equipment_id, hours, anomaly_id, ...}
    model:       str | None = None
    thread_id:   str | None = Field(default=None, max_length=36)  # load prior conversation history


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
    goal:    str = Field(..., min_length=3, max_length=2000)
    context: dict | None = None
    model:   str | None = None


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
