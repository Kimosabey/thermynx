"""Read-only asset registry over the unicharm IBMS tables.

Surfaces the Graylinx IBMS subsystem registry that the app otherwise ignores
(it hard-codes 6 equipment in domain/equipment.py). NEVER writes to unicharm —
operator-added lifecycle fields live in the Postgres `asset_meta` overlay.

Real assets are the gl_subsystem rows WHERE ss_type IS NOT NULL (~39): chillers,
towers, pumps, energy meters, headers, controllers. The ~480 ss_type-NULL rows
are measured points (children via ss_parent) and are exposed per-asset, not as
top-level assets.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Friendly labels for the IBMS ss_type codes.
_TYPE_LABELS = {
    "NONGL_SS_CHILLER":                "Chiller",
    "NONGL_SS_COOLING_TOWER":          "Cooling Tower",
    "NONGL_SS_CONDENSER_PUMPS":        "Condenser Pump",
    "NONGL_SS_PRIMARY_VARIABLE_PUMPS": "Primary Variable Pump",
    "NONGL_SS_EMS":                    "Energy Meter",
    "NONGL_SS_MWP":                    "Make-up Water Pump",
    "NONGL_SS_BTU_METER":              "BTU Meter",
    "NONGL_SS_COMMON_HEADER":          "Common Header",
    "NONGL_SS_CPM":                    "Condenser Pump Module",
    "NONGL_SS_PRIMARY_SEQ_PANEL":      "Primary Sequence Panel",
    "NONGL_SS_WATER_COOLED_HEADER":    "Water-Cooled Header",
    "GL_SS_ADDRESS_BACNET_DDC":        "BACnet DDC Controller",
    "GL_SS_SERVER":                    "Server",
}

# ss_types that have deep normalized telemetry in the app today.
_MONITORED_TYPES = {
    "NONGL_SS_CHILLER", "NONGL_SS_COOLING_TOWER",
    "NONGL_SS_CONDENSER_PUMPS", "NONGL_SS_PRIMARY_VARIABLE_PUMPS",
}


def friendly_type(ss_type: str | None) -> str:
    if not ss_type:
        return "Unknown"
    if ss_type in _TYPE_LABELS:
        return _TYPE_LABELS[ss_type]
    return ss_type.replace("NONGL_SS_", "").replace("GL_SS_", "").replace("_", " ").title()


def _status(raw: str | None) -> str:
    # GL_SS_STATUS_ACTIVE -> active
    return (raw or "").replace("GL_SS_STATUS_", "").replace("GL_LOCATION_STATUS_", "").lower() or "unknown"


async def list_assets(
    db: AsyncSession,
    *,
    asset_type: str | None = None,
    status: str | None = None,
    zone_id: str | None = None,
) -> list[dict[str, Any]]:
    """All real subsystems (ss_type IS NOT NULL), joined to their zone."""
    sql = """
        SELECT s.id, s.name, s.ss_tag, s.ss_type, s.ss_status,
               s.ss_address_type, s.ss_address_value, s.ss_parent,
               m.zone_id, z.name AS zone_name, z.zone_type
        FROM gl_subsystem s
        LEFT JOIN gl_location_subsystem_map m ON m.ss_id = s.id
        LEFT JOIN gl_location z ON z.id = m.zone_id
        WHERE s.ss_type IS NOT NULL
    """
    params: dict[str, Any] = {}
    if asset_type:
        sql += " AND s.ss_type = :atype"; params["atype"] = asset_type
    if status:
        sql += " AND s.ss_status = :status"; params["status"] = status
    if zone_id:
        sql += " AND m.zone_id = :zone"; params["zone"] = zone_id
    sql += " ORDER BY s.ss_type, s.name"

    rows = (await db.execute(text(sql), params)).mappings().all()
    return [
        {
            "id":            r["id"],
            "name":          r["name"],
            "tag":           r["ss_tag"],
            "ss_type":       r["ss_type"],
            "type_label":    friendly_type(r["ss_type"]),
            "status":        _status(r["ss_status"]),
            "address_type":  r["ss_address_type"],
            "address":       r["ss_address_value"],
            "parent_id":     r["ss_parent"],
            "zone_id":       r["zone_id"],
            "zone_name":     r["zone_name"],
            "monitored":     r["ss_type"] in _MONITORED_TYPES,
        }
        for r in rows
    ]


async def asset_type_counts(db: AsyncSession) -> list[dict[str, Any]]:
    """Count of real assets grouped by ss_type — for registry summary chips."""
    sql = """
        SELECT ss_type, COUNT(*) AS n
        FROM gl_subsystem
        WHERE ss_type IS NOT NULL
        GROUP BY ss_type ORDER BY n DESC
    """
    rows = (await db.execute(text(sql))).mappings().all()
    return [{"ss_type": r["ss_type"], "type_label": friendly_type(r["ss_type"]), "count": int(r["n"])} for r in rows]


async def get_asset(db: AsyncSession, asset_id: str) -> dict[str, Any] | None:
    """One asset + its child measured points + latest event timestamp."""
    head = (await db.execute(text("""
        SELECT s.id, s.name, s.ss_tag, s.description, s.ss_type, s.ss_status,
               s.ss_address_type, s.ss_address_value, s.ss_parent,
               m.zone_id, z.name AS zone_name, z.zone_type, s.created_at, s.modified_at
        FROM gl_subsystem s
        LEFT JOIN gl_location_subsystem_map m ON m.ss_id = s.id
        LEFT JOIN gl_location z ON z.id = m.zone_id
        WHERE s.id = :id
    """), {"id": asset_id})).mappings().first()
    if not head:
        return None

    points = (await db.execute(text("""
        SELECT id, name, ss_tag, description
        FROM gl_subsystem WHERE ss_parent = :id ORDER BY name
    """), {"id": asset_id})).mappings().all()

    latest = (await db.execute(text("""
        SELECT MAX(measured_time) AS t FROM gl_subsystem_latest_event WHERE ss_id = :id
    """), {"id": asset_id})).scalar()

    return {
        "id":           head["id"],
        "name":         head["name"],
        "tag":          head["ss_tag"],
        "description":  head["description"],
        "ss_type":      head["ss_type"],
        "type_label":   friendly_type(head["ss_type"]),
        "status":       _status(head["ss_status"]),
        "address_type": head["ss_address_type"],
        "address":      head["ss_address_value"],
        "parent_id":    head["ss_parent"],
        "zone_id":      head["zone_id"],
        "zone_name":    head["zone_name"],
        "monitored":    head["ss_type"] in _MONITORED_TYPES,
        "created_at":   head["created_at"].isoformat() if head["created_at"] else None,
        "modified_at":  head["modified_at"].isoformat() if head["modified_at"] else None,
        "point_count":  len(points),
        "points":       [{"id": p["id"], "name": p["name"], "tag": p["ss_tag"]} for p in points],
        "latest_event": latest.isoformat() if latest else None,
    }


async def list_ibms_alarms(
    db: AsyncSession,
    *,
    active_only: bool = False,
    acknowledged: bool | None = None,
    ss_id: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """The real IBMS alarm log (gl_alarm), joined to the asset (ss_id)."""
    sql = """
        SELECT a.id, a.alarm_code, a.measured_time, a.message, a.param_value,
               a.acknowledged, a.acknowledged_time, a.restore, a.restored_time,
               a.possible_causes, a.technician_feedback, a.ss_id,
               s.name AS asset_name, s.ss_type
        FROM gl_alarm a
        LEFT JOIN gl_subsystem s ON s.id = a.ss_id
        WHERE a.delete_alarm = 0
    """
    params: dict[str, Any] = {"lim": limit}
    if active_only:
        sql += " AND a.restore = 0"
    if acknowledged is not None:
        sql += " AND a.acknowledged = :ack"; params["ack"] = 1 if acknowledged else 0
    if ss_id:
        sql += " AND a.ss_id = :ssid"; params["ssid"] = ss_id
    sql += " ORDER BY a.measured_time DESC LIMIT :lim"

    rows = (await db.execute(text(sql), params)).mappings().all()
    return [_alarm_dict(r) for r in rows]


async def get_ibms_alarm(db: AsyncSession, alarm_id: int) -> dict[str, Any] | None:
    row = (await db.execute(text("""
        SELECT a.id, a.alarm_code, a.measured_time, a.message, a.param_value,
               a.acknowledged, a.acknowledged_time, a.restore, a.restored_time,
               a.possible_causes, a.technician_feedback, a.ss_id,
               s.name AS asset_name, s.ss_type
        FROM gl_alarm a LEFT JOIN gl_subsystem s ON s.id = a.ss_id
        WHERE a.id = :id AND a.delete_alarm = 0
    """), {"id": alarm_id})).mappings().first()
    return _alarm_dict(row) if row else None


def _alarm_dict(r) -> dict[str, Any]:
    return {
        "id":               int(r["id"]),
        "alarm_code":       r["alarm_code"],
        "measured_time":    r["measured_time"].isoformat() if r["measured_time"] else None,
        "message":          r["message"],
        "param_value":      r["param_value"],
        "acknowledged":     bool(r["acknowledged"]),
        "acknowledged_time": r["acknowledged_time"].isoformat() if r["acknowledged_time"] else None,
        "restored":         bool(r["restore"]),
        "restored_time":    r["restored_time"].isoformat() if r["restored_time"] else None,
        "active":           not bool(r["restore"]),
        "possible_causes":  r["possible_causes"],
        "technician_feedback": r["technician_feedback"],
        "asset_id":         r["ss_id"],
        "asset_name":       r["asset_name"],
        "asset_type":       friendly_type(r["ss_type"]),
    }


async def list_locations(db: AsyncSession) -> list[dict[str, Any]]:
    """The org->campus->building->floor->zone hierarchy (gl_location)."""
    rows = (await db.execute(text("""
        SELECT id, name, zone_tag, zone_type, zone_status, zone_parent
        FROM gl_location ORDER BY zone_type, name
    """))).mappings().all()
    return [
        {
            "id":        r["id"],
            "name":      r["name"],
            "tag":       r["zone_tag"],
            "zone_type": r["zone_type"],
            "status":    _status(r["zone_status"]),
            "parent_id": r["zone_parent"],
        }
        for r in rows
    ]
