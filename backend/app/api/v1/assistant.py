"""Nyx assistant API — the intent router.

POST /api/v1/assistant/route : classify a chat message → {engine, mode,
equipment_id, hours, rationale, dispatch}. The UI then calls dispatch.path with
dispatch.body (the existing /analyze, /agent/run, /agent/orchestrate, /nl-query
endpoints — unchanged). Read-only: this endpoint writes nothing.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.router_classify import build_dispatch, classify
from app.config import settings
from app.db.models import Message
from app.db.session import get_pg
from app.limiter import limiter

router = APIRouter()


class RouteRequest(BaseModel):
    message:       str = Field(min_length=1, max_length=2000)
    thread_id:     str | None = None
    hours_default: int = Field(default=24, ge=1, le=8760)
    force_engine:  str | None = None   # quick|investigate|optimize|root_cause|maintenance|brief|data_sql|orchestrate


async def _history_tail(pg: AsyncSession, thread_id: str | None) -> list[dict]:
    if not thread_id:
        return []
    n = getattr(settings, "ASSISTANT_ROUTE_HISTORY_TAIL", 6)
    res = await pg.execute(
        select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.desc()).limit(n)
    )
    rows = list(reversed(res.scalars().all()))
    return [{"role": m.role, "content": m.content} for m in rows]


@router.post("/assistant/route")
@limiter.limit("30/minute")
async def route(request: Request, body: RouteRequest, pg: AsyncSession = Depends(get_pg)) -> dict:
    history = await _history_tail(pg, body.thread_id)
    decision = await classify(
        body.message,
        history=history,
        hours_default=body.hours_default,
        force_engine=body.force_engine,
    )
    # Inject thread_id into the dispatch body so the chosen engine continues the thread.
    dispatch = build_dispatch(decision.engine, body.message, decision.equipment_id, decision.hours, body.thread_id)
    return {
        "engine":            decision.engine,
        "mode":              decision.mode,
        "equipment_id":      decision.equipment_id,
        "hours":             decision.hours,
        "rationale":         decision.rationale,
        "source":            decision.source,
        "preflight_refusal": decision.preflight_refusal,
        "dispatch":          dispatch,
    }
