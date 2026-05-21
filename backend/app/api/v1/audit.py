"""Read-only audit log endpoints.

Exposes `analysis_audit` + `agent_runs` rows so operators (and compliance
reviewers) can see every AI request — what was asked, which model
answered, how long it took, the self-critique verdict status, and a
hash of the prompt/response for tamper-evident review.

Strictly read-only — there are no write or delete handlers. Anything
needing mutation should go through the originating analyzer / agent
flow that owns those rows.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AgentRun, AnalysisAudit
from app.db.session import get_pg
from app.limiter import limiter
from fastapi import Request

router = APIRouter()


def _window(hours: int | None) -> datetime | None:
    if not hours:
        return None
    return datetime.utcnow() - timedelta(hours=hours)


@router.get("/audit/analyses")
@limiter.limit("60/minute")
async def list_analyses(
    request: Request,
    hours: int = Query(default=24, ge=1, le=24 * 30),
    status: str | None = Query(default=None, description="streaming | ok | error"),
    model: str | None = Query(default=None),
    equipment_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    pg: AsyncSession = Depends(get_pg),
):
    since = _window(hours)
    stmt = select(AnalysisAudit).order_by(desc(AnalysisAudit.created_at))
    if since is not None:
        stmt = stmt.where(AnalysisAudit.created_at >= since)
    if status:
        stmt = stmt.where(AnalysisAudit.status == status)
    if model:
        stmt = stmt.where(AnalysisAudit.model == model)
    if equipment_id:
        stmt = stmt.where(AnalysisAudit.equipment_id == equipment_id)
    stmt = stmt.limit(limit).offset(offset)

    rows = (await pg.execute(stmt)).scalars().all()
    return {
        "rows": [
            {
                "id":               r.id,
                "equipment_id":     r.equipment_id,
                "time_range_hours": r.time_range_hours,
                "question":         r.question,
                "prompt_hash":      r.prompt_hash,
                "response_hash":    r.response_hash,
                "model":            r.model,
                "tokens_estimated": r.tokens_estimated,
                "total_ms":         r.total_ms,
                "status":           r.status,
                "request_id":       r.request_id,
                "created_at":       r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "hours":  hours,
        "limit":  limit,
        "offset": offset,
    }


@router.get("/audit/agents")
@limiter.limit("60/minute")
async def list_agent_runs(
    request: Request,
    hours: int = Query(default=24, ge=1, le=24 * 30),
    status: str | None = Query(default=None, description="running | ok | error"),
    mode: str | None = Query(default=None, description="investigator | optimizer | brief | root_cause | maintenance"),
    model: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    pg: AsyncSession = Depends(get_pg),
):
    since = _window(hours)
    stmt = select(AgentRun).order_by(desc(AgentRun.created_at))
    if since is not None:
        stmt = stmt.where(AgentRun.created_at >= since)
    if status:
        stmt = stmt.where(AgentRun.status == status)
    if mode:
        stmt = stmt.where(AgentRun.mode == mode)
    if model:
        stmt = stmt.where(AgentRun.model == model)
    stmt = stmt.limit(limit).offset(offset)

    rows = (await pg.execute(stmt)).scalars().all()
    return {
        "rows": [
            {
                "id":            r.id,
                "mode":          r.mode,
                "goal":          r.goal,
                "steps_taken":   r.steps_taken,
                "model":         r.model,
                "status":        r.status,
                "total_ms":      r.total_ms,
                "final_output":  (r.final_output[:480] + "…") if r.final_output and len(r.final_output) > 480 else r.final_output,
                "request_id":    r.request_id,
                "created_at":    r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "hours":  hours,
        "limit":  limit,
        "offset": offset,
    }


@router.get("/audit/stats")
@limiter.limit("60/minute")
async def audit_stats(
    request: Request,
    hours: int = Query(default=24, ge=1, le=24 * 30),
    pg: AsyncSession = Depends(get_pg),
):
    since = _window(hours)

    async def _count_by(table, column):
        stmt = select(column, func.count()).group_by(column)
        if since is not None:
            stmt = stmt.where(table.created_at >= since)
        rows = (await pg.execute(stmt)).all()
        return {(k or "(none)"): int(v) for k, v in rows}

    async def _total(table):
        stmt = select(func.count()).select_from(table)
        if since is not None:
            stmt = stmt.where(table.created_at >= since)
        return int((await pg.execute(stmt)).scalar() or 0)

    return {
        "hours":              hours,
        "analyses_total":     await _total(AnalysisAudit),
        "agents_total":       await _total(AgentRun),
        "analyses_by_model":  await _count_by(AnalysisAudit, AnalysisAudit.model),
        "analyses_by_status": await _count_by(AnalysisAudit, AnalysisAudit.status),
        "agents_by_mode":     await _count_by(AgentRun, AgentRun.mode),
        "agents_by_status":   await _count_by(AgentRun, AgentRun.status),
    }
