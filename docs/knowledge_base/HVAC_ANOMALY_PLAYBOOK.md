# HVAC anomaly playbook — common patterns and root causes

The anomaly detector flags any metric with a z-score above 3.0 against
its 72-hour baseline. When the agent says "anomaly on chiller_1
kw_per_tr at 14:30", the human question is always "what does that
*mean*?". This playbook is the reference.

## Pattern 1 — Sudden kW/TR spike with stable load

**Symptoms:** `kw_per_tr` jumps from 0.6 to 0.9 within an hour while
`tr` and `chiller_load` are roughly unchanged.

**Likely causes (in order):**
1. Condenser approach climbed — check `cond_entering_temp` against
   wet-bulb. Tower issue (fouled fill, low basin, fan VFD limited).
2. Refrigerant charge low — discharge pressure rises while suction
   pressure drops. Visible if you have those columns.
3. Sudden fouling event in the condenser bundle (rare to happen in
   an hour; check chemistry dosing history).

## Pattern 2 — Slow kW/TR drift over weeks

**Symptoms:** baseline kW/TR creeps up 5–10% per month.

**Likely causes:**
1. Tube fouling (evaporator or condenser). Schedule eddy-current test
   and clean.
2. Refrigerant slowly leaking. Trend the differential between
   evaporator approach and superheat over time.
3. Bearing wear in the compressor — usually accompanied by rising
   vibration on the quarterly survey.

## Pattern 3 — Low chilled-water ΔT

**Symptoms:** `chw_delta_t` drops to 3–4 °F while load looks normal.

**Likely causes:**
1. 3-way bypass valve stuck open at an AHU — water bypasses the coil.
2. Failed return-air sensor causing the AHU to demand full flow at
   low cooling — coil sees high flow at low ΔT.
3. Secondary pump over-speeding (VFD set wrong) — pushes more flow
   than the coils need.
4. Stalled AHU fan — coil air-side starves, water-side over-flows.

## Pattern 4 — Cooling tower approach jump

**Symptoms:** `cond_leaving_temp - wet_bulb_c` jumps to > 8 °F.

**Likely causes:**
1. Fan VFD output capped (control limit, freeze protection, or
   electrical fault).
2. Fill packs fouled or partially blocked.
3. Spray nozzles clogged — uneven water distribution across the fill.
4. Make-up water lower than blowdown — basin level low, spray
   coverage uneven.

## Pattern 5 — Pump kW high with normal flow

**Symptoms:** pump `kw` 10% above baseline while flow / suction
pressure look the same.

**Likely causes:**
1. Impeller wear ring clearance opening up — pump moves the same
   flow but consumes more electrical input.
2. Throttled discharge valve adding artificial head.
3. Air entrainment in the suction line — pump moves a froth, not
   solid water; appears as kW noise.

## Pattern 6 — High-frequency oscillation in any kW reading

**Symptoms:** kW value swings ±10% on a 1-minute period without a
matching load change.

**Likely causes:**
1. Poorly tuned VFD PID — hunting around set point.
2. Cavitation onset (pumps).
3. Surge condition (chiller centrifugal compressor) — escalate
   immediately if confirmed.

## Pattern 7 — Run-hours stalling while equipment shows running

**Symptoms:** `run_hours` counter not incrementing but `is_running`
shows True.

**Likely causes:**
1. Sensor or BMS point staleness — verify the `slot_time` is fresh.
2. Counter wrapped or reset by a maintenance action.
3. Integer overflow in the data path (rare).

## Always-page conditions

Regardless of pattern, page maintenance immediately on:
- Z-score > 5 on any safety-related metric (suction pressure,
  discharge pressure, motor amps).
- Sustained anomaly > 30 minutes on the same metric without auto-recovery.
- Multiple metrics anomalous simultaneously on the same equipment
  (suggests a control-system fault, not a single sensor glitch).
