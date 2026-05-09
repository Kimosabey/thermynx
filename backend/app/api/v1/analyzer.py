import hashlib
import json
import time
import uuid
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_pg, MySQLSession
from app.db.models import AnalysisAudit
from app.db.telemetry import fetch_all_hvac_context, compute_summary, fetch_chiller_data
from app.domain.equipment import get_by_id
from app.llm.ollama import stream_generate
from app.prompts.hvac_prompts import build_analyze_prompt
from app.config import settings

router = APIRouter()


class AnalyzeRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    equipment_id: str | None = None
    hours: int = Field(default=24, ge=1, le=168)
    model: str | None = None


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

    prompt = build_analyze_prompt(req.question, context, summary)
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


@router.post("/analyze")
async def analyze(
    req: AnalyzeRequest,
    request: Request,
    pg: AsyncSession = Depends(get_pg),
):
    return StreamingResponse(
        _sse_stream(request, req, pg),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
