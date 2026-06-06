"""IBMS alarm management — the real gl_alarm log + operator actions.

Distinct from /api/v1/alarms (z-score anomaly alarms). Read-only over unicharm
gl_alarm (app/db/registry.py), with a Postgres `alarm_action` overlay for
operator ack + the work order raised from an alarm.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, get_pg
from app.db import registry
from app.db.models import AlarmAction
from app.services import work_orders as wo_svc
from app.log import get_logger

router = APIRouter()
log = get_logger("api.ibms_alarms")


class AckIn(BaseModel):
    acknowledged_by: str | None = Field(default=None, max_length=64)
    note:            str | None = None


class RaiseWOIn(BaseModel):
    created_by: str | None = Field(default=None, max_length=64)
    priority:   str = Field(default="high")


def _overlay(a: AlarmAction | None) -> dict:
    if not a:
        return {"operator_acked": False, "acked_by": None, "wo_id": None, "note": None}
    return {
        "operator_acked": a.acked_at is not None,
        "acked_by":       a.acknowledged_by,
        "acked_at":       a.acked_at.isoformat() if a.acked_at else None,
        "wo_id":          a.wo_id,
        "note":           a.note,
    }


@router.get("/alarms/ibms")
async def list_ibms_alarms(
    active_only: bool = False,
    acknowledged: bool | None = None,
    asset: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    pg: AsyncSession = Depends(get_pg),
):
    alarms = await registry.list_ibms_alarms(
        db, active_only=active_only, acknowledged=acknowledged, ss_id=asset, limit=limit
    )
    ids = [a["id"] for a in alarms]
    overlays: dict[int, AlarmAction] = {}
    if ids:
        rows = (await pg.execute(select(AlarmAction).where(AlarmAction.alarm_id.in_(ids)))).scalars().all()
        overlays = {r.alarm_id: r for r in rows}
    for a in alarms:
        a["action"] = _overlay(overlays.get(a["id"]))
    return {"alarms": alarms, "total": len(alarms)}


@router.get("/alarms/ibms/{alarm_id}")
async def get_ibms_alarm(alarm_id: int, db: AsyncSession = Depends(get_db), pg: AsyncSession = Depends(get_pg)):
    alarm = await registry.get_ibms_alarm(db, alarm_id)
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    a = (await pg.execute(select(AlarmAction).where(AlarmAction.alarm_id == alarm_id))).scalar_one_or_none()
    alarm["action"] = _overlay(a)
    return alarm


async def _get_or_create_action(pg: AsyncSession, alarm_id: int) -> AlarmAction:
    a = (await pg.execute(select(AlarmAction).where(AlarmAction.alarm_id == alarm_id))).scalar_one_or_none()
    if not a:
        a = AlarmAction(alarm_id=alarm_id)
        pg.add(a)
    return a


@router.post("/alarms/ibms/{alarm_id}/ack")
async def ack_alarm(alarm_id: int, body: AckIn, db: AsyncSession = Depends(get_db), pg: AsyncSession = Depends(get_pg)):
    if not await registry.get_ibms_alarm(db, alarm_id):
        raise HTTPException(status_code=404, detail="Alarm not found")
    a = await _get_or_create_action(pg, alarm_id)
    a.acknowledged_by = body.acknowledged_by
    a.acked_at = datetime.utcnow()
    if body.note:
        a.note = body.note
    a.updated_at = datetime.utcnow()
    await pg.commit()
    return {"alarm_id": alarm_id, "action": _overlay(a)}


@router.post("/alarms/ibms/{alarm_id}/raise-wo")
async def raise_work_order(alarm_id: int, body: RaiseWOIn, db: AsyncSession = Depends(get_db), pg: AsyncSession = Depends(get_pg)):
    alarm = await registry.get_ibms_alarm(db, alarm_id)
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    try:
        wo = await wo_svc.create_work_order(
            pg,
            title=f"Alarm: {alarm['message'] or alarm['alarm_code']}"[:256],
            description=alarm["message"],
            equipment_id=alarm["asset_name"] or alarm["asset_id"],
            priority=body.priority,
            source="alarm",
            source_ref=str(alarm_id),
            diagnosis=alarm["possible_causes"],
            created_by=body.created_by,
        )
    except wo_svc.WorkOrderError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    # Link the WO back to the alarm via the overlay.
    a = await _get_or_create_action(pg, alarm_id)
    a.wo_id = wo.id
    a.updated_at = datetime.utcnow()
    await pg.commit()
    return {"alarm_id": alarm_id, "work_order_id": wo.id, "state": wo.state}
