import hashlib
import json
import time
import uuid
from datetime import datetime
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_pg, MySQLSession
from app.db.models import AnalysisAudit, Message, Thread
from app.db.telemetry import fetch_all_hvac_context, compute_summary, fetch_chiller_data
from app.domain.equipment import get_by_id
from app.llm.ollama import stream_generate
from app.prompts.hvac_prompts import build_analyze_prompt
from app.services.rag import retrieve, format_rag_context
from app.config import settings
from app.log import get_logger

router = APIRouter()
log = get_logger("api.analyzer")


class AnalyzeRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    equipment_id: str | None = None
    hours: int = Field(default=24, ge=1, le=8760)
    model: str | None = None
    thread_id: str | None = Field(default=None, max_length=36)


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


async def _sse_stream(
    request: Request,
    req: AnalyzeRequest,
    pg: AsyncSession,
) -> AsyncIterator[str]:
    audit_id = str(uuid.uuid4())
    model = req.model or settings.OLLAMA_DEFAULT_MODEL
    start_ms = int(time.time() * 1000)

    audit = AnalysisAudit(
        id=audit_id,
        equipment_id=req.equipment_id,
        time_range_hours=req.hours,
        question=req.question,
        model=model,
        status="streaming",
        request_id=getattr(request.state, "request_id", None),
    )
    pg.add(audit)
    await pg.commit()

    rid = getattr(request.state, "request_id", None)
    log.info(
        "analyze_stream_start audit_id=%s equipment=%s hours=%s thread_id=%s model=%s request_id=%s",
        audit_id,
        req.equipment_id,
        req.hours,
        req.thread_id,
        model,
        rid,
    )

    conversation_history: list[dict[str, str]] | None = None
    if req.thread_id:
        res = await pg.execute(
            select(Message)
            .where(Message.thread_id == req.thread_id)
            .order_by(Message.created_at.desc())
            .limit(24)
        )
        msgs = list(res.scalars())
        conversation_history = [{"role": m.role, "content": m.content} for m in reversed(msgs)]

    async with MySQLSession() as db:
        if req.equipment_id:
            eq = get_by_id(req.equipment_id)
            if eq and eq["type"] == "chiller":
                rows = await fetch_chiller_data(db, eq["table"], hours=req.hours)
                context = {req.equipment_id: rows}
            else:
                context = await fetch_all_hvac_context(db, hours=req.hours)
        else:
            context = await fetch_all_hvac_context(db, hours=req.hours)
        summary = await compute_summary(context)

    # RAG retrieval — inject relevant doc chunks before the prompt (graceful degradation)
    rag_chunks = await retrieve(pg, req.question, top_k=5, equipment_id=req.equipment_id)
    rag_context = format_rag_context(rag_chunks) if rag_chunks else ""

    prompt = build_analyze_prompt(
        req.question, context, summary,
        conversation_history=conversation_history,
        rag_context=rag_context,
    )
    prompt_hash = _hash(prompt)

    full_response: list[str] = []
    status = "error"
    try:
        async for chunk in stream_generate(prompt, model=model):
            if await request.is_disconnected():
                status = "cancelled"
                break
            full_response.append(chunk)
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
        else:
            status = "ok"
    except Exception as e:
        log.exception(
            "analyze_stream_error audit_id=%s request_id=%s",
            audit_id,
            getattr(request.state, "request_id", None),
        )
        yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"
        status = "error"

    total_ms = int(time.time() * 1000) - start_ms
    response_text = "".join(full_response)
    yield f"data: {json.dumps({'type': 'done', 'audit_id': audit_id, 'model': model, 'total_ms': total_ms})}\n\n"

    audit.prompt_hash = prompt_hash
    audit.response_hash = _hash(response_text) if response_text else None
    audit.tokens_estimated = len(response_text.split())
    audit.total_ms = total_ms
    audit.status = status
    await pg.merge(audit)
    await pg.commit()

    log.info(
        "analyze_stream_done audit_id=%s status=%s total_ms=%s request_id=%s",
        audit_id,
        status,
        total_ms,
        getattr(request.state, "request_id", None),
    )

    if req.thread_id and status == "ok" and response_text.strip():
        pg.add(Message(id=str(uuid.uuid4()), thread_id=req.thread_id, role="user", content=req.question))
        pg.add(
            Message(
                id=str(uuid.uuid4()),
                thread_id=req.thread_id,
                role="assistant",
                content=response_text,
            )
        )
        thr = await pg.get(Thread, req.thread_id)
        if thr:
            thr.updated_at = datetime.utcnow()
            if thr.title in (None, "", "Conversation"):
                thr.title = req.question[:200]
        await pg.commit()


@router.post("/analyze")
async def analyze(
    req: AnalyzeRequest,
    request: Request,
    pg: AsyncSession = Depends(get_pg),
):
    if req.thread_id:
        thr = await pg.get(Thread, req.thread_id)
        if not thr:
            raise HTTPException(status_code=404, detail="Thread not found")

    return StreamingResponse(
        _sse_stream(request, req, pg),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
