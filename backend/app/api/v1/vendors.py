"""Vendor / supplier master — CRUD."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_pg
from app.db.models import Vendor

router = APIRouter()


class VendorIn(BaseModel):
    name:           str = Field(..., min_length=1, max_length=128)
    contact:        str | None = Field(default=None, max_length=128)
    email:          str | None = Field(default=None, max_length=128)
    lead_time_days: int | None = Field(default=None, ge=0, le=365)
    rating:         float | None = Field(default=None, ge=0, le=5)
    active:         int = 1
    notes:          str | None = None


def _ser(v: Vendor) -> dict:
    return {"id": v.id, "name": v.name, "contact": v.contact, "email": v.email,
            "lead_time_days": v.lead_time_days, "rating": v.rating, "active": v.active,
            "notes": v.notes, "created_at": v.created_at.isoformat() if v.created_at else None}


@router.get("/vendors")
async def list_vendors(pg: AsyncSession = Depends(get_pg)):
    rows = (await pg.execute(select(Vendor).order_by(Vendor.name))).scalars().all()
    return {"vendors": [_ser(v) for v in rows], "total": len(rows)}


@router.post("/vendors")
async def create_vendor(body: VendorIn, pg: AsyncSession = Depends(get_pg)):
    v = Vendor(id=str(uuid.uuid4()), name=body.name, contact=body.contact, email=body.email,
               lead_time_days=body.lead_time_days, rating=body.rating, active=body.active, notes=body.notes)
    pg.add(v)
    await pg.commit()
    return _ser(v)


@router.get("/vendors/{vendor_id}")
async def get_vendor(vendor_id: str, pg: AsyncSession = Depends(get_pg)):
    v = await pg.get(Vendor, vendor_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return _ser(v)


@router.put("/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, body: VendorIn, pg: AsyncSession = Depends(get_pg)):
    v = await pg.get(Vendor, vendor_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for f in ("name", "contact", "email", "lead_time_days", "rating", "active", "notes"):
        setattr(v, f, getattr(body, f))
    await pg.commit()
    return _ser(v)
