# Cooling tower operations — approach, range, staging

## Definitions

- **Approach** — condenser water leaving temperature *minus* the
  outdoor wet-bulb temperature. Smaller is better. A well-tuned tower
  approaches 4–7 °F under design conditions.
- **Range** — condenser water entering temperature *minus* leaving
  temperature. This is the heat rejected per pass; it tracks load.
- **Wet-bulb** — the theoretical lowest temperature evaporative cooling
  can reach. The hard physical floor for tower performance.
- **Cells** — independent evaporative sections of a multi-cell tower.
  Each cell has its own fan; staging means turning cells on or off to
  match load.

## Healthy operating envelope

| Metric | Healthy range | Notes |
|---|---|---|
| Approach | 4–7 °F | Above 8 °F sustained → fouled fill, clogged spray nozzles, scale on fill, or fan VFD limited |
| Range | 8–12 °F | Tracks chiller load — low range means low load |
| Fan kW per ton rejected | < 0.04 | Above 0.05 → check fan staging |
| Make-up vs blowdown ratio | 3:1 to 5:1 | Higher → check water chemistry / cycles of concentration |

## Cell-staging logic (when wet-bulb data is available)

If we have outdoor wet-bulb readings, the platform's cooling-tower
optimizer can recommend cell counts. The general rule:

1. At load ≤ 33% of design TR: one cell at moderate fan VFD often
   beats two cells at low fan speed — fan affinity laws favour fewer
   running cells.
2. At load 33–66%: two cells, modulate fans together.
3. At load > 66% or wet-bulb close to design: all cells, fans at
   highest practical VFD.

When wet-bulb is unavailable, the optimizer falls back to a
kW-only heuristic that staging cells to keep total fan kW under a
threshold. The UI shows `data_status` flags so operators can see
which mode is active.

## Common faults

### Approach trending up over weeks
Almost always scale/fill fouling. Schedule a manual inspection of the
fill packs and the spray bar nozzles. Acid-clean if the water chemistry
log shows high hardness.

### Approach spike within an hour
Usually a closed valve or stopped fan. Check fan VFD output, then
inspect the basin water level — a low basin will spike approach
suddenly.

### Make-up water consumption climbing
Tower drift (over-spraying) or a leak. Check the drift eliminator
condition and any external piping for visible drips.

### Both cells running but range is < 4 °F
Either the chiller has unloaded (verify against chiller load %) or
the condenser pump is moving water faster than the tower can cool
it. Check pump VFD set point.

## When to escalate

- Approach > 12 °F for one hour: maintenance ticket within 24h.
- Make-up water draw > 200% of baseline daily average: chemistry team
  same shift.
- Any fan VFD vibration alarm: page maintenance immediately.
