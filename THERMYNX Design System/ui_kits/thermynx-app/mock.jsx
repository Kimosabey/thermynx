/* Mocked telemetry & data — derived from typical Unicharm plant summaries */

const MOCK_EQUIPMENT = [
  { id: 'chiller_1',        name: 'Chiller 1',           type: 'chiller' },
  { id: 'chiller_2',        name: 'Chiller 2',           type: 'chiller' },
  { id: 'cooling_tower_1',  name: 'Cooling Tower 1',     type: 'cooling_tower' },
  { id: 'cooling_tower_2',  name: 'Cooling Tower 2',     type: 'cooling_tower' },
  { id: 'condenser_pump_1', name: 'Condenser Pump 1-2',  type: 'pump' },
  { id: 'condenser_pump_3', name: 'Condenser Pump 3',    type: 'pump' },
];

const MOCK_SUMMARY = {
  summary: {
    chiller_1: {
      avg_kw: 487.2, running_pct: 94, avg_kw_per_tr: 0.612,
      avg_chiller_load: 62.4, latest_ambient_temp: 28.5, latest_evap_leaving: 7.4,
    },
    chiller_2: {
      avg_kw: 412.8, running_pct: 78, avg_kw_per_tr: 0.738,
      avg_chiller_load: 54.1, latest_ambient_temp: 28.5, latest_evap_leaving: 7.6,
    },
    cooling_tower_1: { avg_kw: 38.4, running_pct: 100 },
    cooling_tower_2: { avg_kw: 36.1, running_pct: 100 },
    condenser_pump_1: { avg_kw: 22.5, running_pct: 100 },
    condenser_pump_3: { avg_kw: 0,    running_pct: 0   },
  },
};

const MOCK_ANOMALIES = [
  {
    equipment_id: 'chiller_1', equipment_name: 'Chiller 1',
    metric: 'kw_per_tr', severity: 'warning',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    z_score: 3.2, value: 0.741, baseline_mean: 0.612, baseline_std: 0.040,
    description: 'kW/TR drifted above the 24-hour baseline for the last 35 minutes — verify condenser approach and CT-1 fan speed.',
  },
  {
    equipment_id: 'cooling_tower_2', equipment_name: 'Cooling Tower 2',
    metric: 'fan_kw', severity: 'critical',
    timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    z_score: -5.6, value: 12.1, baseline_mean: 35.4, baseline_std: 4.2,
    description: 'Fan power dropped to 34% of baseline — possible VFD fault or fan trip. Check inverter status and contactor.',
  },
];

const MOCK_THREADS = [
  { id: 't1', title: 'Why CH1 underperforming yesterday' },
  { id: 't2', title: 'Daily brief — 2026-05-13' },
  { id: 't3', title: 'CH2 short-cycling investigation' },
];

window.MOCK_EQUIPMENT = MOCK_EQUIPMENT;
window.MOCK_SUMMARY   = MOCK_SUMMARY;
window.MOCK_ANOMALIES = MOCK_ANOMALIES;
window.MOCK_THREADS   = MOCK_THREADS;
