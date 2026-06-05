"""Audit log endpoints — read + operator feedback.

Exposes `analysis_audit` + `agent_runs` rows so operators (and compliance
reviewers) can see every AI request — what was asked, which model
answered, how long it took, the self-critique verdict status, and a
hash of the prompt/response for tamper-evident review.

Write endpoint: POST /audit/{id}/verdict  — records operator thumbs-up/down.
This is the only mutation allowed on audit rows.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AgentRun, AnalysisAudit
from app.db.session import get_pg
from app.limiter import limiter
from app.observability.metrics import operator_feedback_total

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


@router.get("/audit/quality")
@limiter.limit("60/minute")
async def audit_quality(
    request: Request,
    hours: int = Query(default=168, ge=1, le=24 * 30),
    bucket_hours: int = Query(default=1, ge=1, le=24),
    pg: AsyncSession = Depends(get_pg),
):
    """Hallucination-scorer dashboard data.

    Returns:
      - tile counts by status (ok / error / cancelled / streaming)
      - bucketed timeseries of counts (for the trend chart)
      - average latency by status

    The self-critique loop writes `status` per analysis. `ok` means the
    critique didn't flag anything as suspicious. `error` covers both
    crashes and critique-detected fail verdicts.
    """
    since = _window(hours)
    base  = select(AnalysisAudit).where(AnalysisAudit.created_at >= since) if since is not None else select(AnalysisAudit)

    # Tile counts by status
    by_status_stmt = select(AnalysisAudit.status, func.count()).group_by(AnalysisAudit.status)
    if since is not None:
        by_status_stmt = by_status_stmt.where(AnalysisAudit.created_at >= since)
    by_status_rows = (await pg.execute(by_status_stmt)).all()
    by_status = {(k or "(none)"): int(v) for k, v in by_status_rows}

    # Average latency by status (ms)
    lat_stmt = select(AnalysisAudit.status, func.avg(AnalysisAudit.total_ms)).group_by(AnalysisAudit.status)
    if since is not None:
        lat_stmt = lat_stmt.where(AnalysisAudit.created_at >= since)
    lat_rows = (await pg.execute(lat_stmt)).all()
    latency_by_status = {(k or "(none)"): int(v) if v is not None else None for k, v in lat_rows}

    # Bucketed trend — pull the rows and group in Python to stay portable
    rows_stmt = (
        base.order_by(AnalysisAudit.created_at.asc())
            .limit(5000)  # safety cap
    )
    rows = (await pg.execute(rows_stmt)).scalars().all()

    bucket_ms = bucket_hours * 3600 * 1000
    buckets: dict[int, dict[str, int]] = {}
    for r in rows:
        if not r.created_at:
            continue
        ts = int(r.created_at.timestamp() * 1000)
        b  = (ts // bucket_ms) * bucket_ms
        slot = buckets.setdefault(b, {"ok": 0, "error": 0, "streaming": 0, "cancelled": 0})
        slot[r.status if r.status in slot else "error"] += 1

    series = [
        {
            "ts":         b,
            "ok":         v["ok"],
            "error":      v["error"],
            "streaming":  v["streaming"],
            "cancelled":  v["cancelled"],
            "total":      sum(v.values()),
        }
        for b, v in sorted(buckets.items())
    ]

    total = sum(by_status.values()) or 1
    return {
        "hours":             hours,
        "bucket_hours":      bucket_hours,
        "by_status":         by_status,
        "latency_by_status": latency_by_status,
        "success_rate":      round(by_status.get("ok", 0) / total, 4),
        "series":            series,
    }


# ── Operator feedback endpoint ────────────────────────────────────────────────

class VerdictRequest(BaseModel):
    verdict: Literal["positive", "negative"]
    note: str | None = None


@router.post("/audit/{audit_id}/verdict")
@limiter.limit("60/minute")
async def submit_verdict(
    request: Request,
    audit_id: str,
    body: VerdictRequest,
    pg: AsyncSession = Depends(get_pg),
):
    """Record operator 👍/👎 feedback on an analyzer answer.

    The audit_id is emitted in the SSE `done` frame as `audit_id`.
    Frontend sends this after the operator clicks a thumbs button.
    """
    row = await pg.get(AnalysisAudit, audit_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Audit row {audit_id} not found.")
    row.operator_verdict = body.verdict
    if body.note:
        row.operator_note = body.note[:1000]
    await pg.commit()
    operator_feedback_total.labels(verdict=body.verdict).inc()
    return {"audit_id": audit_id, "verdict": body.verdict, "recorded": True}
