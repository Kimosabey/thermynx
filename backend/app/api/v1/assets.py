"""Asset registry / EAM endpoints.

Read-only over the unicharm IBMS registry (app/db/registry.py), enriched with
the Postgres `asset_meta` overlay (lifecycle fields operators can edit — these
never touch the customer's IBMS DB).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.db.session import get_db, get_pg
from app.db import registry
from app.db.models import AssetMeta
from app.log import get_logger

router = APIRouter()
log = get_logger("api.assets")


class AssetMetaIn(BaseModel):
    acquisition_date: datetime | None = None
    warranty_end:     datetime | None = None
    cost_center:      str | None = Field(default=None, max_length=64)
    criticality:      str | None = Field(default=None, max_length=16)  # low|medium|high|critical
    notes:            str | None = None


def _meta_dict(m: AssetMeta | None) -> dict:
    if not m:
        return {}
    return {
        "acquisition_date": m.acquisition_date.isoformat() if m.acquisition_date else None,
        "warranty_end":     m.warranty_end.isoformat() if m.warranty_end else None,
        "cost_center":      m.cost_center,
        "criticality":      m.criticality,
        "notes":            m.notes,
    }


@router.get("/assets")
async def list_assets(
    type: str | None = None,
    status: str | None = None,
    zone: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    assets = await registry.list_assets(db, asset_type=type, status=status, zone_id=zone)
    return {"assets": assets, "total": len(assets)}


@router.get("/assets/types")
async def asset_types(db: AsyncSession = Depends(get_db)):
    return {"types": await registry.asset_type_counts(db)}


@router.get("/locations")
async def locations(db: AsyncSession = Depends(get_db)):
    return {"locations": await registry.list_locations(db)}


@router.get("/assets/{asset_id}")
async def get_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    pg: AsyncSession = Depends(get_pg),
):
    asset = await registry.get_asset(db, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    meta = (await pg.execute(select(AssetMeta).where(AssetMeta.gl_subsystem_id == asset_id))).scalar_one_or_none()
    asset["meta"] = _meta_dict(meta)
    return asset


@router.put("/assets/{asset_id}/meta")
async def upsert_asset_meta(
    asset_id: str,
    body: AssetMetaIn,
    db: AsyncSession = Depends(get_db),
    pg: AsyncSession = Depends(get_pg),
):
    # Validate the asset exists in the IBMS registry before storing overlay data.
    if not await registry.get_asset(db, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")
    meta = (await pg.execute(select(AssetMeta).where(AssetMeta.gl_subsystem_id == asset_id))).scalar_one_or_none()
    if not meta:
        meta = AssetMeta(gl_subsystem_id=asset_id)
        pg.add(meta)
    meta.acquisition_date = body.acquisition_date
    meta.warranty_end     = body.warranty_end
    meta.cost_center      = body.cost_center
    meta.criticality      = body.criticality
    meta.notes            = body.notes
    meta.updated_at       = datetime.utcnow()
    await pg.commit()
    return {"gl_subsystem_id": asset_id, "meta": _meta_dict(meta)}
