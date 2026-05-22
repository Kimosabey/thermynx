# Condenser water pumps — curves, VFD strategy, NPSH

## What the pump moves

The condenser pump circulates condenser water between the chiller
condenser bundle and the cooling tower. Heat rejected by the
refrigerant in the bundle is carried to the tower and dumped to
atmosphere via evaporation. Pump flow drives both the chiller's heat
rejection capacity and the tower's range.

## Healthy operating envelope (Unicharm units)

| Metric | Healthy range | Notes |
|---|---|---|
| Flow per ton (gpm/TR) | 2.5–3.0 | Above 3.5 wastes pump kW; below 2.0 risks fouling and low ΔT in the bundle |
| Pump kW / total chiller kW | 4–7% | Above 8% suggests the system is fighting throttled valves |
| Run hours per week | ≥ 100h when chiller running | Sub-100 indicates short-cycling; investigate sequencing |
| NPSHa margin | ≥ 5 ft above NPSHr | Always — cavitation kills bearings |

## VFD strategies

The two common control strategies for condenser pumps:

### Constant-speed (older plants)
Pump runs at full speed whenever the chiller runs. Simple, but wastes
energy at part-load and tends to over-flow the bundle. Most original
Unicharm pumps were like this.

### Variable-speed (recommended)
Pump VFD modulates to maintain a target condenser water flow or a
target ΔT across the bundle. Two control set-point philosophies:

1. **Constant ΔT control** — drive the VFD to hold a fixed temperature
   difference across the condenser (typical target: 10 °F). Saves the
   most pump energy but the chiller has to handle wider flow swings.
2. **Constant flow control** — hold a fixed gpm and let ΔT float.
   Easier on the chiller; pump VFD only adjusts when staging changes.

A well-tuned VFD pump typically uses 30–50% less energy than a constant-speed
equivalent over a year.

## Affinity laws — why pump VFD savings are dramatic

For a centrifugal pump:
- Flow is proportional to speed.
- Pressure (head) is proportional to speed squared.
- Power is proportional to speed cubed.

Cutting speed by 20% (from 100% to 80%) cuts power by roughly 50%.
This is why even small VFD reductions show up in the cost analytics.

## Common faults

### Pump kW rising over weeks while flow stays flat
Worn impeller or bearing drag. Trend `kw` against historical baseline
— a 5%+ creep in kW at the same flow point means efficiency is
falling. Schedule a vibration survey within the month.

### Suction pressure dropping toward NPSHr
Cooling tower basin level dropping, strainer clogging, or a closed
isolation valve upstream. Investigate immediately — cavitation
destroys impellers and bearings in hours.

### Flow oscillating + chiller condenser pressure unstable
Usually the VFD control loop is hunting (poorly tuned PID). Switch to
constant-speed temporarily and re-tune the PID gains.

## When to escalate

- Suction pressure within 3 ft of NPSHr: page immediately.
- Vibration over 0.4 in/sec RMS (typical alarm threshold): same shift.
- Motor amps at trip set-point: stop the pump from the BMS and call
  electrical maintenance.
