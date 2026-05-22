"""Work-order lifecycle service.

Holds the state machine, transition validator, event-log writer, and the
small helpers used by the API + the agent tool. Kept thin — Pydantic
schemas live in the API layer.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Technician, WorkOrder, WorkOrderEvent
from app.log import get_logger

log = get_logger("services.work_orders")


VALID_STATES = ("open", "assigned", "in_progress", "resolved", "closed", "cancelled")
TERMINAL_STATES = ("closed", "cancelled")

# Allowed transitions. Cancelled is reachable from any non-terminal.
TRANSITIONS: dict[str, set[str]] = {
    "open":        {"assigned", "in_progress", "cancelled"},
    "assigned":    {"in_progress", "open", "cancelled"},
    "in_progress": {"resolved", "assigned", "cancelled"},
    "resolved":    {"closed", "in_progress"},
    "closed":      set(),
    "cancelled":   set(),
}

VALID_PRIORITIES = ("low", "normal", "high", "critical")
VALID_SOURCES    = ("manual", "agent", "anomaly", "pm")


class WorkOrderError(Exception):
    pass


def _new_id() -> str:
    return str(uuid.uuid4())


async def _log_event(
    pg: AsyncSession,
    wo_id: str,
    *,
    kind: str,
    from_state: str | None = None,
    to_state:   str | None = None,
    actor:      str | None = None,
    notes:      str | None = None,
) -> WorkOrderEvent:
    ev = WorkOrderEvent(
        id=_new_id(),
        wo_id=wo_id,
        kind=kind,
        from_state=from_state,
        to_state=to_state,
        actor=actor,
        notes=notes,
    )
    pg.add(ev)
    return ev


async def create_work_order(
    pg: AsyncSession,
    *,
    title: str,
    description: str | None = None,
    equipment_id: str | None = None,
    priority: str = "normal",
    source: str = "manual",
    source_ref: str | None = None,
    diagnosis: str | None = None,
    recommended_actions: str | None = None,
    created_by: str | None = None,
    assigned_to: str | None = None,
    due_at: datetime | None = None,
) -> WorkOrder:
    if priority not in VALID_PRIORITIES:
        raise WorkOrderError(f"Invalid priority '{priority}'")
    if source not in VALID_SOURCES:
        raise WorkOrderError(f"Invalid source '{source}'")
    initial_state = "assigned" if assigned_to else "open"

    wo = WorkOrder(
        id=_new_id(),
        equipment_id=equipment_id,
        title=title.strip()[:256],
        description=(description or "").strip() or None,
        priority=priority,
        state=initial_state,
        source=source,
        source_ref=source_ref,
        created_by=created_by,
        assigned_to=assigned_to,
        diagnosis=diagnosis,
        recommended_actions=recommended_actions,
        due_at=due_at,
    )
    pg.add(wo)
    await _log_event(pg, wo.id, kind="system", to_state=initial_state, actor=created_by, notes="created")
    if assigned_to:
        await _log_event(pg, wo.id, kind="assignment", to_state=initial_state, actor=created_by, notes=f"assigned_to={assigned_to}")
        # Bump open_assignments count
        tech = await pg.get(Technician, assigned_to)
        if tech:
            tech.open_assignments = (tech.open_assignments or 0) + 1
    await pg.commit()
    await pg.refresh(wo)
    log.info("wo_created id=%s source=%s state=%s priority=%s", wo.id, source, initial_state, priority)
    return wo


async def transition_state(
    pg: AsyncSession,
    wo_id: str,
    *,
    to_state: str,
    actor: str | None = None,
    notes: str | None = None,
) -> WorkOrder:
    wo = await pg.get(WorkOrder, wo_id)
    if not wo:
        raise WorkOrderError(f"Work order {wo_id} not found")
    if to_state not in VALID_STATES:
        raise WorkOrderError(f"Unknown target state '{to_state}'")
    if to_state == wo.state:
        return wo
    allowed = TRANSITIONS.get(wo.state, set())
    if to_state not in allowed:
        raise WorkOrderError(f"Cannot transition {wo.state} → {to_state}")

    prev = wo.state
    wo.state = to_state
    now = datetime.utcnow()
    if to_state == "resolved":
        wo.resolved_at = now
    if to_state == "closed":
        wo.closed_at = wo.closed_at or now
    await _log_event(pg, wo_id, kind="transition", from_state=prev, to_state=to_state, actor=actor, notes=notes)

    # Decrement open_assignments when leaving the active set
    if prev not in TERMINAL_STATES and to_state in TERMINAL_STATES and wo.assigned_to:
        tech = await pg.get(Technician, wo.assigned_to)
        if tech and (tech.open_assignments or 0) > 0:
            tech.open_assignments -= 1

    await pg.commit()
    await pg.refresh(wo)
    log.info("wo_transition id=%s %s -> %s actor=%s", wo_id, prev, to_state, actor)
    return wo


async def assign_technician(
    pg: AsyncSession,
    wo_id: str,
    *,
    technician_id: str | None,
    actor: str | None = None,
) -> WorkOrder:
    wo = await pg.get(WorkOrder, wo_id)
    if not wo:
        raise WorkOrderError(f"Work order {wo_id} not found")
    if wo.state in TERMINAL_STATES:
        raise WorkOrderError(f"Cannot reassign a {wo.state} work order")

    if technician_id:
        tech = await pg.get(Technician, technician_id)
        if not tech:
            raise WorkOrderError(f"Technician {technician_id} not found")

    prev_assignee = wo.assigned_to
    wo.assigned_to = technician_id
    if technician_id and wo.state == "open":
        wo.state = "assigned"
        await _log_event(pg, wo_id, kind="transition", from_state="open", to_state="assigned", actor=actor)
    await _log_event(pg, wo_id, kind="assignment", to_state=wo.state, actor=actor, notes=f"assigned_to={technician_id or 'unassigned'}")

    # Update technician load counters
    if prev_assignee and prev_assignee != technician_id:
        prev = await pg.get(Technician, prev_assignee)
        if prev and (prev.open_assignments or 0) > 0:
            prev.open_assignments -= 1
    if technician_id and prev_assignee != technician_id:
        new_t = await pg.get(Technician, technician_id)
        if new_t:
            new_t.open_assignments = (new_t.open_assignments or 0) + 1

    await pg.commit()
    await pg.refresh(wo)
    return wo


async def add_comment(
    pg: AsyncSession,
    wo_id: str,
    *,
    actor: str | None,
    notes: str,
) -> WorkOrderEvent:
    if not notes or not notes.strip():
        raise WorkOrderError("Comment is empty")
    wo = await pg.get(WorkOrder, wo_id)
    if not wo:
        raise WorkOrderError(f"Work order {wo_id} not found")
    ev = await _log_event(pg, wo_id, kind="comment", actor=actor, notes=notes.strip())
    await pg.commit()
    return ev


async def list_work_orders(
    pg: AsyncSession,
    *,
    state: str | None = None,
    priority: str | None = None,
    equipment_id: str | None = None,
    assigned_to: str | None = None,
    source: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[WorkOrder]:
    stmt = select(WorkOrder).order_by(desc(WorkOrder.created_at))
    if state:        stmt = stmt.where(WorkOrder.state == state)
    if priority:     stmt = stmt.where(WorkOrder.priority == priority)
    if equipment_id: stmt = stmt.where(WorkOrder.equipment_id == equipment_id)
    if assigned_to:  stmt = stmt.where(WorkOrder.assigned_to == assigned_to)
    if source:       stmt = stmt.where(WorkOrder.source == source)
    stmt = stmt.limit(limit).offset(offset)
    res = await pg.execute(stmt)
    return list(res.scalars())


async def get_work_order(pg: AsyncSession, wo_id: str) -> tuple[WorkOrder | None, list[WorkOrderEvent]]:
    wo = await pg.get(WorkOrder, wo_id)
    if not wo:
        return None, []
    ev_res = await pg.execute(
        select(WorkOrderEvent).where(WorkOrderEvent.wo_id == wo_id).order_by(WorkOrderEvent.created_at.asc())
    )
    return wo, list(ev_res.scalars())


async def stats(pg: AsyncSession, *, days: int = 30) -> dict[str, Any]:
    """Counts, MTTR, repeat-issue rate. Used by the Analytics tab."""
    # Counts by state
    res = await pg.execute(
        select(WorkOrder.state, func.count()).group_by(WorkOrder.state)
    )
    by_state = {row[0]: int(row[1]) for row in res}

    # Counts by priority
    res = await pg.execute(
        select(WorkOrder.priority, func.count()).group_by(WorkOrder.priority)
    )
    by_priority = {row[0]: int(row[1]) for row in res}

    # Counts by source
    res = await pg.execute(
        select(WorkOrder.source, func.count()).group_by(WorkOrder.source)
    )
    by_source = {row[0]: int(row[1]) for row in res}

    # MTTR (mean time to resolved, seconds) for last N days of resolved WOs
    res = await pg.execute(
        select(
            func.avg(
                (func.extract("epoch", WorkOrder.resolved_at) -
                 func.extract("epoch", WorkOrder.created_at))
            )
        ).where(WorkOrder.resolved_at.is_not(None))
    )
    mttr_s = res.scalar()
    mttr_hours = round(float(mttr_s) / 3600, 2) if mttr_s else None

    # Repeat-issue rate (same equipment_id appears > 1 in window)
    repeat_res = await pg.execute(
        select(WorkOrder.equipment_id, func.count())
            .where(WorkOrder.equipment_id.is_not(None))
            .group_by(WorkOrder.equipment_id)
    )
    counts = [row[1] for row in repeat_res]
    repeats = sum(c for c in counts if c > 1)
    total_with_eq = sum(counts) or 1
    repeat_rate = round(repeats / total_with_eq, 3)

    total = sum(by_state.values())
    resolved_or_closed = (by_state.get("resolved", 0) + by_state.get("closed", 0))
    return {
        "total":               total,
        "open_count":          by_state.get("open", 0) + by_state.get("assigned", 0) + by_state.get("in_progress", 0),
        "resolved_or_closed":  resolved_or_closed,
        "by_state":            by_state,
        "by_priority":         by_priority,
        "by_source":           by_source,
        "mttr_hours":          mttr_hours,
        "repeat_issue_rate":   repeat_rate,
    }


def serialise(wo: WorkOrder) -> dict[str, Any]:
    return {
        "id":                  wo.id,
        "equipment_id":        wo.equipment_id,
        "title":               wo.title,
        "description":         wo.description,
        "priority":            wo.priority,
        "state":               wo.state,
        "source":              wo.source,
        "source_ref":          wo.source_ref,
        "created_by":          wo.created_by,
        "assigned_to":         wo.assigned_to,
        "diagnosis":           wo.diagnosis,
        "recommended_actions": wo.recommended_actions,
        "due_at":              wo.due_at.isoformat() if wo.due_at else None,
        "resolved_at":         wo.resolved_at.isoformat() if wo.resolved_at else None,
        "closed_at":           wo.closed_at.isoformat() if wo.closed_at else None,
        "created_at":          wo.created_at.isoformat() if wo.created_at else None,
        "updated_at":          wo.updated_at.isoformat() if wo.updated_at else None,
    }


def serialise_event(ev: WorkOrderEvent) -> dict[str, Any]:
    return {
        "id":         ev.id,
        "kind":       ev.kind,
        "from_state": ev.from_state,
        "to_state":   ev.to_state,
        "actor":      ev.actor,
        "notes":      ev.notes,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }
