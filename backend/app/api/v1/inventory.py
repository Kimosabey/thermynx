"""Spare-parts inventory — parts, stock levels, low-stock, WO consumption."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_pg
from app.db.models import Part, PartStock, WoPart, WorkOrder

router = APIRouter()


class PartIn(BaseModel):
    code:          str = Field(..., min_length=1, max_length=64)
    name:          str = Field(..., min_length=1, max_length=256)
    vendor_id:     str | None = None
    unit_cost:     float | None = Field(default=None, ge=0)
    uom:           str = "ea"
    reorder_point: int = Field(default=0, ge=0)
    reorder_qty:   int = Field(default=0, ge=0)


class StockAdjust(BaseModel):
    delta:    float                       # +receive / -consume
    location: str = "main"
    note:     str | None = None


class ConsumeIn(BaseModel):
    wo_id:   str
    part_id: str
    qty:     float = Field(..., gt=0)
    location: str = "main"


async def _stock_for(pg, part_id) -> dict:
    rows = (await pg.execute(select(PartStock).where(PartStock.part_id == part_id))).scalars().all()
    return {"on_hand": sum(s.qty_on_hand or 0 for s in rows), "reserved": sum(s.qty_reserved or 0 for s in rows)}


def _ser_part(p: Part, stock: dict) -> dict:
    return {"id": p.id, "code": p.code, "name": p.name, "vendor_id": p.vendor_id,
            "unit_cost": p.unit_cost, "uom": p.uom, "reorder_point": p.reorder_point,
            "reorder_qty": p.reorder_qty, "active": p.active,
            "qty_on_hand": stock["on_hand"], "qty_reserved": stock["reserved"],
            "low_stock": stock["on_hand"] <= (p.reorder_point or 0)}


@router.get("/parts")
async def list_parts(pg: AsyncSession = Depends(get_pg)):
    parts = (await pg.execute(select(Part).order_by(Part.name))).scalars().all()
    out = [_ser_part(p, await _stock_for(pg, p.id)) for p in parts]
    return {"parts": out, "total": len(out)}


@router.post("/parts")
async def create_part(body: PartIn, pg: AsyncSession = Depends(get_pg)):
    p = Part(id=str(uuid.uuid4()), code=body.code, name=body.name, vendor_id=body.vendor_id,
             unit_cost=body.unit_cost, uom=body.uom, reorder_point=body.reorder_point, reorder_qty=body.reorder_qty)
    pg.add(p)
    pg.add(PartStock(id=str(uuid.uuid4()), part_id=p.id, location="main", qty_on_hand=0, qty_reserved=0))
    await pg.commit()
    return _ser_part(p, {"on_hand": 0, "reserved": 0})


@router.get("/parts/{part_id}")
async def get_part(part_id: str, pg: AsyncSession = Depends(get_pg)):
    p = await pg.get(Part, part_id)
    if not p:
        raise HTTPException(status_code=404, detail="Part not found")
    return _ser_part(p, await _stock_for(pg, part_id))


@router.post("/parts/{part_id}/stock")
async def adjust_stock(part_id: str, body: StockAdjust, pg: AsyncSession = Depends(get_pg)):
    if not await pg.get(Part, part_id):
        raise HTTPException(status_code=404, detail="Part not found")
    stock = (await pg.execute(
        select(PartStock).where(PartStock.part_id == part_id).where(PartStock.location == body.location)
    )).scalar_one_or_none()
    if not stock:
        stock = PartStock(id=str(uuid.uuid4()), part_id=part_id, location=body.location, qty_on_hand=0, qty_reserved=0)
        pg.add(stock)
    new_qty = (stock.qty_on_hand or 0) + body.delta
    if new_qty < 0:
        raise HTTPException(status_code=422, detail="Stock cannot go negative")
    stock.qty_on_hand = new_qty
    stock.updated_at = datetime.utcnow()
    await pg.commit()
    return {"part_id": part_id, "location": body.location, "qty_on_hand": stock.qty_on_hand}


@router.get("/inventory/low-stock")
async def low_stock(pg: AsyncSession = Depends(get_pg)):
    parts = (await pg.execute(select(Part).where(Part.active == 1))).scalars().all()
    out = []
    for p in parts:
        st = await _stock_for(pg, p.id)
        if st["on_hand"] <= (p.reorder_point or 0):
            out.append(_ser_part(p, st))
    return {"low_stock": out, "total": len(out)}


@router.post("/inventory/consume")
async def consume(body: ConsumeIn, pg: AsyncSession = Depends(get_pg)):
    """Record parts used on a work order and decrement stock."""
    if not await pg.get(WorkOrder, body.wo_id):
        raise HTTPException(status_code=404, detail="Work order not found")
    if not await pg.get(Part, body.part_id):
        raise HTTPException(status_code=404, detail="Part not found")
    stock = (await pg.execute(
        select(PartStock).where(PartStock.part_id == body.part_id).where(PartStock.location == body.location)
    )).scalar_one_or_none()
    if not stock or (stock.qty_on_hand or 0) < body.qty:
        raise HTTPException(status_code=422, detail="Insufficient stock")
    stock.qty_on_hand -= body.qty
    stock.updated_at = datetime.utcnow()
    pg.add(WoPart(id=str(uuid.uuid4()), wo_id=body.wo_id, part_id=body.part_id, qty_used=body.qty))
    await pg.commit()
    return {"wo_id": body.wo_id, "part_id": body.part_id, "qty_used": body.qty, "qty_on_hand": stock.qty_on_hand}
