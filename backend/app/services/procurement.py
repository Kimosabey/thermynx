"""Purchase-order lifecycle service — mirrors the work-order pattern.

State machine: draft -> submitted -> approved -> received -> closed | cancelled.
On `received`, each PO line increments part_stock.qty_on_hand.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PartStock, PurchaseOrder, PurchaseOrderEvent, PurchaseOrderLine
from app.log import get_logger

log = get_logger("services.procurement")

VALID_STATES = ("draft", "submitted", "approved", "received", "closed", "cancelled")
TERMINAL_STATES = ("closed", "cancelled")
TRANSITIONS: dict[str, set[str]] = {
    "draft":     {"submitted", "cancelled"},
    "submitted": {"approved", "draft", "cancelled"},
    "approved":  {"received", "cancelled"},
    "received":  {"closed"},
    "closed":    set(),
    "cancelled": set(),
}


class ProcurementError(Exception):
    pass


def _nid() -> str:
    return str(uuid.uuid4())


async def _event(pg, po_id, *, kind, from_state=None, to_state=None, actor=None, notes=None):
    pg.add(PurchaseOrderEvent(id=_nid(), po_id=po_id, kind=kind, from_state=from_state,
                              to_state=to_state, actor=actor, notes=notes))


async def create_po(pg: AsyncSession, *, vendor_id: str | None, lines: list[dict[str, Any]],
                    created_by: str | None = None, expected_at: datetime | None = None,
                    notes: str | None = None) -> PurchaseOrder:
    if not lines:
        raise ProcurementError("A purchase order needs at least one line.")
    po_id = _nid()
    total = 0.0
    for ln in lines:
        if not ln.get("part_id") or not ln.get("qty"):
            raise ProcurementError("Each line needs part_id and qty.")
        total += float(ln["qty"]) * float(ln.get("unit_cost") or 0)
    po = PurchaseOrder(id=po_id, vendor_id=vendor_id, state="draft", total_cost=round(total, 2),
                       created_by=created_by, expected_at=expected_at, notes=notes)
    pg.add(po)
    for ln in lines:
        pg.add(PurchaseOrderLine(id=_nid(), po_id=po_id, part_id=ln["part_id"],
                                 qty=float(ln["qty"]), unit_cost=ln.get("unit_cost")))
    await _event(pg, po_id, kind="system", to_state="draft", actor=created_by, notes="created")
    await pg.commit()
    return po


async def transition(pg: AsyncSession, po_id: str, to_state: str, *, actor: str | None = None,
                     notes: str | None = None) -> PurchaseOrder:
    po = await pg.get(PurchaseOrder, po_id)
    if not po:
        raise ProcurementError("Purchase order not found.")
    if to_state not in VALID_STATES:
        raise ProcurementError(f"Invalid state '{to_state}'.")
    if to_state not in TRANSITIONS.get(po.state, set()):
        raise ProcurementError(f"Cannot transition {po.state} -> {to_state}.")

    prev = po.state
    po.state = to_state
    po.updated_at = datetime.utcnow()

    if to_state == "received":
        po.received_at = datetime.utcnow()
        # Increment stock for every line.
        lines = (await pg.execute(select(PurchaseOrderLine).where(PurchaseOrderLine.po_id == po_id))).scalars().all()
        for ln in lines:
            stock = (await pg.execute(
                select(PartStock).where(PartStock.part_id == ln.part_id).where(PartStock.location == "main")
            )).scalar_one_or_none()
            if not stock:
                stock = PartStock(id=_nid(), part_id=ln.part_id, location="main", qty_on_hand=0, qty_reserved=0)
                pg.add(stock)
            stock.qty_on_hand = (stock.qty_on_hand or 0) + ln.qty
            stock.updated_at = datetime.utcnow()

    await _event(pg, po_id, kind="transition", from_state=prev, to_state=to_state, actor=actor, notes=notes)
    await pg.commit()
    return po


def serialise(po: PurchaseOrder, lines: list[PurchaseOrderLine] | None = None) -> dict[str, Any]:
    out = {
        "id": po.id, "vendor_id": po.vendor_id, "state": po.state, "total_cost": po.total_cost,
        "created_by": po.created_by,
        "expected_at": po.expected_at.isoformat() if po.expected_at else None,
        "received_at": po.received_at.isoformat() if po.received_at else None,
        "notes": po.notes,
        "created_at": po.created_at.isoformat() if po.created_at else None,
    }
    if lines is not None:
        out["lines"] = [{"id": l.id, "part_id": l.part_id, "qty": l.qty, "unit_cost": l.unit_cost} for l in lines]
    return out
