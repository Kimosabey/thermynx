# Data Grounding 03 — Topology edges from data, not constants

**Status:** queued · **ETA:** ~half day

## The honest current state

`backend/app/api/v1/topology.py` defines `_PLANT_EDGES` as a constant
tuple-list:

```python
_PLANT_EDGES = [
    ("condenser_pump_1",  "cooling_tower_1", "condenser_water"),
    ("condenser_pump_3",  "cooling_tower_2", "condenser_water"),
    ("cooling_tower_1",   "chiller_1",       "condenser_water"),
    ("cooling_tower_2",   "chiller_2",       "condenser_water"),
    ("condenser_pump_1",  "chiller_1",       "condenser_water"),
    ("condenser_pump_3",  "chiller_2",       "condenser_water"),
]
```

This is the canonical chiller-plant topology drawn from HVAC
engineering knowledge — not learned from a database. The 6 *nodes* are
real (they come from `EQUIPMENT_CATALOG`), but the edges are author
opinion. That's fine if the Unicharm plant actually follows this
layout; it would be wrong if it doesn't.

## Goal

Move the edges out of source code and into a queryable, plant-specific
representation that a deployment can edit without a code change.

## Two options

### Option A — App-state Postgres table (cheap, controlled)
Create `equipment_relations(source_id, target_id, kind, notes)` in the
`thermynx_app` Postgres database. Seed it from a YAML file at startup
if empty. Each deployment can edit the YAML (or the table directly)
to match its plant.

**Effort:** ~3 hours.
**Tradeoff:** Still hand-authored, just out of the code.

### Option B — Derive from Unicharm reference tables
Unicharm's MySQL schema *might* have a relations table (sometimes
called `gl_subsystem`, `equipment_relations`, `asset_hierarchy`). If
so, the topology endpoint can JOIN those at query time and the graph
becomes a true reflection of the customer's CMMS.

**Effort:** ~1 day (assuming the table exists; otherwise back to A).
**Tradeoff:** Real and operator-editable via their own CMMS UI.

### Option C — Pattern-mine from naming + correlation
Discover relationships statistically: if `condenser_pump_1.kw` and
`cooling_tower_1.kw` start/stop together over a 7-day window, infer
an edge. Then validate against expert review.

**Effort:** ~2 days. Risky — false positives possible.
**Tradeoff:** Works even when no relations table exists, but needs
operator approval before going to UI.

## Recommendation

Ship **Option A first** — a YAML + Postgres table — within this
codebase so the edges are at least configurable per deployment.
Investigate **Option B** when a real Unicharm SQL dump is available
(it was earlier mentioned that `gl_subsystem` might exist; verify).

## Tasks (Option A)

- [ ] Alembic migration: `equipment_relations` table
- [ ] `config/equipment_relations.yaml` with the existing 6 edges
- [ ] App-state loader: on startup, if the table is empty, seed from the YAML
- [ ] `topology.py`: read edges from the table instead of the constant
- [ ] Add a small admin write endpoint or doc note for editing the YAML

## Acceptance

- Editing the YAML and restarting moves the edges in the UI.
- Removing the YAML doesn't crash — the loader falls back to the
  current `_PLANT_EDGES` constant for safety.
