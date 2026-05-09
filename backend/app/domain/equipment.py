"""
Pure equipment domain — no I/O, no imports from infrastructure layers.
"""

EQUIPMENT_CATALOG = [
    {"id": "chiller_1",        "name": "Chiller 1",          "type": "chiller",       "table": "chiller_1_normalized"},
    {"id": "chiller_2",        "name": "Chiller 2",          "type": "chiller",       "table": "chiller_2_normalized"},
    {"id": "cooling_tower_1",  "name": "Cooling Tower 1",    "type": "cooling_tower", "table": "cooling_tower_1_normalized"},
    {"id": "cooling_tower_2",  "name": "Cooling Tower 2",    "type": "cooling_tower", "table": "cooling_tower_2_normalized"},
    {"id": "condenser_pump_1", "name": "Condenser Pump 1-2", "type": "pump",          "table": "condenser_pump_0102_normalized"},
    {"id": "condenser_pump_3", "name": "Condenser Pump 3",   "type": "pump",          "table": "condenser_pump_03_normalized"},
]

_by_id = {e["id"]: e for e in EQUIPMENT_CATALOG}


def get_by_id(equipment_id: str) -> dict | None:
    return _by_id.get(equipment_id)


# kW/TR efficiency bands
BAND_GOOD = 0.65
BAND_POOR = 0.85


def efficiency_band(kw_per_tr: float | None) -> str:
    if kw_per_tr is None:
        return "unknown"
    if kw_per_tr < BAND_GOOD:
        return "good"
    if kw_per_tr < BAND_POOR:
        return "acceptable"
    return "poor"
