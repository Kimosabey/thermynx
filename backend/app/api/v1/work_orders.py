"""Work-order REST endpoints — lifecycle CRUD + comments + analytics."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_pg
from app.limiter import limiter
from app.services import work_orders as svc

router = APIRouter()


class WOCreate(BaseModel):
    title:        str = Field(min_length=3, max_length=256)
    description:  str | None = None
    equipment_id: str | None = None
    priority:     Literal["low", "normal", "high", "critical"] = "normal"
    source:       Literal["manual", "agent", "anomaly", "pm"] = "manual"
    source_ref:   str | None = None
    diagnosis:    str | None = None
    recommended_actions: str | None = None
    created_by:   str | None = None
    assigned_to:  str | None = None
    due_at:       datetime | None = None


class WOTransition(BaseModel):
    to_state: Literal["open", "assigned", "in_progress", "resolved", "closed", "cancelled"]
    actor:    str | None = None
    notes:    str | None = None


class WOAssign(BaseModel):
    technician_id: str | None
    actor:         str | None = None


class WOComment(BaseModel):
    notes: str = Field(min_length=1, max_length=4000)
    actor: str | None = None


@router.post("/work-orders")
@limiter.limit("60/minute")
async def create_work_order(
    request: Request,
    body: WOCreate,
    pg: AsyncSession = Depends(get_pg),
):
    try:
        wo = await svc.create_work_order(
            pg,
            title=body.title,
            description=body.description,
            equipment_id=body.equipment_id,
            priority=body.priority,
            source=body.source,
            source_ref=body.source_ref,
            diagnosis=body.diagnosis,
            recommended_actions=body.recommended_actions,
            created_by=body.created_by,
            assigned_to=body.assigned_to,
            due_at=body.due_at,
        )
    except svc.WorkOrderError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return svc.serialise(wo)


@router.get("/work-orders")
@limiter.limit("60/minute")
async def list_work_orders(
    request: Request,
    state:        str | None = Query(default=None),
    priority:     str | None = Query(default=None),
    equipment_id: str | None = Query(default=None),
    assigned_to:  str | None = Query(default=None),
    source:       str | None = Query(default=None),
    limit:        int = Query(default=100, ge=1, le=500),
    offset:       int = Query(default=0, ge=0),
    pg: AsyncSession = Depends(get_pg),
):
    rows = await svc.list_work_orders(
        pg, state=state, priority=priority, equipment_id=equipment_id,
        assigned_to=assigned_to, source=source, limit=limit, offset=offset,
    )
    return {"rows": [svc.serialise(w) for w in rows], "total": len(rows)}


@router.get("/work-orders/stats")
@limiter.limit("60/minute")
async def work_order_stats(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    pg: AsyncSession = Depends(get_pg),
):
    return await svc.stats(pg, days=days)


@router.get("/work-orders/{wo_id}")
@limiter.limit("120/minute")
async def get_work_order(
    request: Request,
    wo_id: str,
    pg: AsyncSession = Depends(get_pg),
):
    wo, events = await svc.get_work_order(pg, wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    return {
        "work_order": svc.serialise(wo),
        "events":     [svc.serialise_event(e) for e in events],
    }


@router.post("/work-orders/{wo_id}/transition")
@limiter.limit("60/minute")
async def transition(
    request: Request,
    wo_id: str,
    body: WOTransition,
    pg: AsyncSession = Depends(get_pg),
):
    try:
        wo = await svc.transition_state(pg, wo_id, to_state=body.to_state, actor=body.actor, notes=body.notes)
    except svc.WorkOrderError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    # Tribal-knowledge flywheel: when a WO is resolved, capture the fix as a
    # searchable `incident` embedding. Best-effort — never fail the transition.
    if body.to_state == "resolved":
        try:
            from app.ai import knowledge
            await knowledge.capture_resolution(pg, wo, resolution_note=body.notes)
        except Exception as e:  # pragma: no cover
            from app.log import get_logger
            get_logger("api.work_orders").warning("resolution_capture_failed wo=%s err=%s", wo_id, e)

    return svc.serialise(wo)


@router.post("/work-orders/{wo_id}/assign")
@limiter.limit("60/minute")
async def assign(
    request: Request,
    wo_id: str,
    body: WOAssign,
    pg: AsyncSession = Depends(get_pg),
):
    try:
        wo = await svc.assign_technician(pg, wo_id, technician_id=body.technician_id, actor=body.actor)
    except svc.WorkOrderError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return svc.serialise(wo)


@router.post("/work-orders/{wo_id}/comments")
@limiter.limit("120/minute")
async def comment(
    request: Request,
    wo_id: str,
    body: WOComment,
    pg: AsyncSession = Depends(get_pg),
):
    try:
        ev = await svc.add_comment(pg, wo_id, actor=body.actor, notes=body.notes)
    except svc.WorkOrderError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return svc.serialise_event(ev)
