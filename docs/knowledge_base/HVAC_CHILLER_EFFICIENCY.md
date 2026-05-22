# Chiller efficiency — kW/TR bands, drivers, and operator playbook

## What kW/TR is

`kW/TR` is the ratio of electrical input power to cooling output, where one
ton of refrigeration (TR) equals 3.517 kW of cooling. Lower is better.
A modern water-cooled centrifugal chiller at design conditions should
deliver below 0.55 kW/TR. Air-cooled chillers and small absorption
machines run higher.

## Efficiency bands used in this platform

| Band | kW/TR range | Operator action |
|---|---|---|
| Excellent | ≤ 0.55 | None — log and continue |
| Good | 0.55 to 0.65 | Routine; trend over 7d |
| Acceptable | 0.65 to 0.75 | Watch — note in shift log |
| Poor | 0.75 to 0.85 | Investigate within 24h |
| Critical | > 0.85 | Investigate immediately |

The dashboard band cut-offs (BAND_GOOD=0.65, BAND_POOR=0.85) match the
"poor" and "critical" thresholds above. A chiller operating in the
critical band for more than two hours should trigger a maintenance
ticket.

## Design benchmark

Each chiller has a published design kW/TR at full-load AHRI conditions
(44 °F LCHWT, 85 °F ECWT). For the Unicharm centrifugal units the
design benchmark is 0.55 kW/TR. The `delta_pct` you see on the
efficiency screen is the percentage gap between the rolling 24h
average and this design number — sustained values above 30% indicate
real degradation.

## The five loss drivers

When a chiller is running poor, the loss is almost always one of
these. Diagnose in this order:

1. **Low chilled-water ΔT (low-delta-T syndrome).**
   Healthy CHW ΔT for the Unicharm chillers is 8–10 °F. When ΔT drops
   below 5 °F the chiller runs more flow at less useful work, and
   kW/TR rises. Causes: 3-way valves stuck open, coil bypass,
   over-pumped secondary loops, low return temperature from a stalled
   AHU.

2. **High condenser water entering temperature.**
   Every 1 °F rise in ECWT above 85 °F adds roughly 1.5% to kW/TR.
   Common cause: cooling-tower approach > 7 °F (see tower playbook).

3. **Refrigerant charge and tube fouling.**
   Low refrigerant or fouled evaporator / condenser tubes both
   reduce effective heat transfer. Symptom: discharge pressure rises,
   suction pressure drops, delta-T across the bundle shrinks.

4. **Partial-load operation at low IPLV efficiency point.**
   Centrifugal chillers have a U-shaped efficiency curve. Below
   ~35% load they often run worse than at full load. Sequencing two
   chillers at low total demand can be worse than running one fully.

5. **Surge or hot-gas bypass.**
   Loud rumble, oscillating motor amps, surge trips. Always page
   the maintenance lead immediately.

## Quick triage commands

If kW/TR has degraded over the last 24h, the operator playbook is:

1. Check current `chw_delta_t`. If < 5 °F, investigate the loop first.
2. Check `cond_entering_temp`. If > 88 °F, look at the cooling tower.
3. Compare against the sister chiller — if both have drifted, suspect
   common-mode (ambient, tower water quality, control loop tuning).
   If only one has drifted, suspect that chiller's refrigerant /
   tubes / motor.
4. Pull the last 7 days of `kw_per_tr` and check whether the
   degradation is sudden (fault) or gradual (fouling / wear).

## When to escalate

- kW/TR > 1.0 for two consecutive hours: page maintenance.
- Sudden 20%+ rise in kW/TR within a single hour: page maintenance.
- Suction pressure inside 2 psi of trip set-point: page immediately.
