import json
import uuid
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_pg
from app.db.models import AgentRun
from app.services.agent import run_agent
from app.services.multi_agent import run_multi_agent
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


async def _stream(request: Request, req: AgentRequest, pg: AsyncSession):
    if req.mode not in VALID_MODES:
        log.warning("agent_unknown_mode mode=%s request_id=%s", req.mode, getattr(request.state, "request_id", None))
        yield f"data: {json.dumps({'type':'error','detail':f'Unknown mode: {req.mode}'})}\n\n"
        return

    # Layer 1 — pre-flight: catch unknown equipment + action requests before
    # paying for the ReAct loop (saves 15-30s per refused goal).
    from app.services.preflight import check_action_request, check_equipment_mentions
    refusal = check_action_request(req.goal) or check_equipment_mentions(req.goal)
    if refusal:
        log.info("agent_preflight_refused mode=%s reason=%s", req.mode, refusal[:120])
        yield f"data: {json.dumps({'type':'token','content': refusal})}\n\n"
        yield f"data: {json.dumps({'type':'done','steps':0,'preflight_refused':True})}\n\n"
        return

    run_id = str(uuid.uuid4())
    model  = req.model or settings.OLLAMA_DEFAULT_MODEL

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
        async for frame in run_agent(req.mode, req.goal, req.context, model=model):
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
    from app.services.preflight import check_action_request, check_equipment_mentions
    refusal = check_action_request(req.goal) or check_equipment_mentions(req.goal)
    if refusal:
        log.info("orchestrate_preflight_refused reason=%s", refusal[:120])
        yield f"data: {json.dumps({'type':'token','content': refusal})}\n\n"
        yield f"data: {json.dumps({'type':'done','subtasks':0,'preflight_refused':True})}\n\n"
        return

    run_id = str(uuid.uuid4())
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
        async for frame in run_multi_agent(req.goal, req.context, model=model):
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
