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
@limiter.limit("10/minute")
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


@router.get("/agent/history")
async def agent_history(
    limit: int = 20,
    mode: str | None = None,
    pg: AsyncSession = Depends(get_pg),
):
    where = "WHERE mode = :mode" if mode else ""
    params = {"limit": limit}
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
