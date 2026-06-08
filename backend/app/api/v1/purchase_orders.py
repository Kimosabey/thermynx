"""Purchase orders — create, list, transition (state machine), reorder suggestions."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_pg
from app.db.models import Part, PartStock, PurchaseOrder, PurchaseOrderLine
from app.services import procurement as proc

router = APIRouter()


class POLineIn(BaseModel):
    part_id:   str
    qty:       float = Field(..., gt=0)
    unit_cost: float | None = Field(default=None, ge=0)


class POIn(BaseModel):
    vendor_id:   str | None = None
    lines:       list[POLineIn]
    created_by:  str | None = None
    expected_at: datetime | None = None
    notes:       str | None = None


class POTransition(BaseModel):
    to_state: str
    actor:    str | None = None
    notes:    str | None = None


@router.get("/purchase-orders")
async def list_pos(state: str | None = None, pg: AsyncSession = Depends(get_pg)):
    q = select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())
    if state:
        q = q.where(PurchaseOrder.state == state)
    rows = (await pg.execute(q)).scalars().all()
    return {"purchase_orders": [proc.serialise(p) for p in rows], "total": len(rows)}


@router.post("/purchase-orders")
async def create_po(body: POIn, pg: AsyncSession = Depends(get_pg)):
    try:
        po = await proc.create_po(
            pg, vendor_id=body.vendor_id,
            lines=[l.model_dump() for l in body.lines],
            created_by=body.created_by, expected_at=body.expected_at, notes=body.notes,
        )
    except proc.ProcurementError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    lines = (await pg.execute(select(PurchaseOrderLine).where(PurchaseOrderLine.po_id == po.id))).scalars().all()
    return proc.serialise(po, lines)


@router.get("/purchase-orders/reorder-suggestions")
async def reorder_suggestions(pg: AsyncSession = Depends(get_pg)):
    """Parts at/below reorder point -> suggested PO lines (qty = reorder_qty)."""
    parts = (await pg.execute(select(Part).where(Part.active == 1))).scalars().all()
    suggestions = []
    for p in parts:
        rows = (await pg.execute(select(PartStock).where(PartStock.part_id == p.id))).scalars().all()
        on_hand = sum(s.qty_on_hand or 0 for s in rows)
        if on_hand <= (p.reorder_point or 0) and (p.reorder_qty or 0) > 0:
            suggestions.append({"part_id": p.id, "code": p.code, "name": p.name, "vendor_id": p.vendor_id,
                                "on_hand": on_hand, "reorder_point": p.reorder_point,
                                "suggested_qty": p.reorder_qty, "unit_cost": p.unit_cost})
    return {"suggestions": suggestions, "total": len(suggestions)}


@router.get("/purchase-orders/{po_id}")
async def get_po(po_id: str, pg: AsyncSession = Depends(get_pg)):
    po = await pg.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    lines = (await pg.execute(select(PurchaseOrderLine).where(PurchaseOrderLine.po_id == po_id))).scalars().all()
    return proc.serialise(po, lines)


@router.post("/purchase-orders/{po_id}/transition")
async def transition_po(po_id: str, body: POTransition, pg: AsyncSession = Depends(get_pg)):
    try:
        po = await proc.transition(pg, po_id, body.to_state, actor=body.actor, notes=body.notes)
    except proc.ProcurementError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return proc.serialise(po)
