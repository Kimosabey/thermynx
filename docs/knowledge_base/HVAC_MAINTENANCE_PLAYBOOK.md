# HVAC maintenance — interval playbook

This is the standard preventive-maintenance interval guide used by the
maintenance planner agent. Specific Unicharm SOP frequencies override
anything here when they differ.

## Daily checks (operator round)

- Visual on each chiller: oil sight glass level normal, no leaks,
  no abnormal sound.
- Chilled water and condenser water gauges within normal range.
- Cooling tower basin level visible, no scum or biofilm growth at
  surface, drift eliminator dry on the leeward side.
- Pump motor temperature warm but not hot (< 70 °C casing).
- Control panel: no active alarms, no flashing fault codes.

## Weekly checks

- Tower fill packs visual inspection — note any fouling or breakage.
- Sample condenser water for chemistry: pH, conductivity, free
  chlorine, hardness. Adjust dosing if outside range.
- Pump strainer differential pressure — clean if ΔP > 2 psi.
- Walk the piping for new leaks, especially around valve packings.

## Monthly tasks

- Check refrigerant charge against the chiller's full-load sight
  glass clearing condition.
- Lubricate motor bearings per OEM (typically 4–6 strokes of grease).
- Test BMS communication — confirm all sensors are reading and
  alarming.
- Review previous month's kW/TR trend per chiller — flag any band
  drift to maintenance lead.

## Quarterly tasks

- Vibration survey on every motor (pumps, fans, chiller compressors).
  Record overall mm/s velocity and the dominant frequency. Trend
  against last quarter — rising velocity is the early warning of
  bearing failure.
- Megger test motor windings — note insulation resistance trend.
- Inspect contactors and motor protection devices.
- Test tower fan VFD shutdown / bypass.

## Annual tasks

- Eddy-current test the chiller evaporator and condenser tubes.
  Replace tubes flagged at > 60% wall loss.
- Acid-clean the condenser tubes if scaling is found during the
  tube-pull inspection.
- Replace chiller oil, oil filter, and oil sight glass desiccant.
- Pull cooling tower fill packs for cleaning if approach has been
  trending up.
- Calibrate all flow meters, temperature sensors, and pressure
  transmitters against a reference.
- Replace cooling tower drift eliminator if degraded.

## Run-hours based maintenance

In addition to calendar intervals, certain tasks are triggered by
accumulated run hours:

| Task | Run-hours threshold |
|---|---|
| Chiller bearing inspection | 8,000 |
| Chiller compressor overhaul | 20,000 (centrifugal) / 30,000 (screw) |
| Condenser pump bearing replacement | 25,000 |
| Cooling tower fan gearbox oil change | 5,000 |
| Cooling tower fan motor bearings | 30,000 |

The maintenance agent reads `run_hours` from each equipment table and
flags tasks approaching their threshold within the next 30 days.

## Alarms that always escalate

- Any chiller surge or hot-gas bypass event.
- Loss of differential pressure across a strainer (sudden drop) —
  could indicate strainer failure.
- Sustained communication loss to a critical sensor (> 5 min).
- Refrigerant low-level alarm.
- High motor temperature on any drive (> 90 °C casing).
