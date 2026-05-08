from typing import Any
import json


SYSTEM_CONTEXT = """You are THERMYNX, an expert AI Operations Intelligence system for HVAC facility management at a Unicharm manufacturing plant. You analyze real-time and historical data from chillers, cooling towers, condenser pumps, and other HVAC equipment.

Your knowledge includes:
- Chiller performance: COP, kW/TR efficiency benchmarks (good: <0.65 kW/TR, acceptable: 0.65-0.85, poor: >0.85)
- Cooling load analysis using Tons of Refrigeration (TR) and chilled water delta-T
- Cooling tower approach temperature, fan efficiency
- Condenser water system dynamics
- Predictive maintenance indicators: high kW/TR, low delta-T, abnormal temperatures
- Energy optimization strategies for HVAC plants

Always provide:
1. Clear observations from the data
2. Efficiency assessment with benchmarks
3. Actionable recommendations with priority
4. Any anomalies or alerts

Format responses with clear sections using markdown headers. Be concise and practical for operations staff."""


def format_chiller_rows(rows: list[dict], limit: int = 10) -> str:
    if not rows:
        return "No data available."
    sample = rows[:limit]
    lines = []
    for r in sample:
        ts = str(r.get("slot_time", ""))[:16]
        running = "ON" if r.get("is_running") else "OFF"
        kw = r.get("kw") or "N/A"
        tr = r.get("tr") or "N/A"
        kw_tr = r.get("kw_per_tr") or "N/A"
        load = r.get("chiller_load") or "N/A"
        elt = r.get("evap_leaving_temp") or "N/A"
        dT = r.get("chw_delta_t") or "N/A"
        lines.append(
            f"  {ts} | {running} | kW:{kw} | TR:{tr} | kW/TR:{kw_tr} | Load:{load}% | CHLT:{elt}°C | ΔT:{dT}°C"
        )
    return "\n".join(lines)


def format_equipment_rows(rows: list[dict], limit: int = 6) -> str:
    if not rows:
        return "No data available."
    sample = rows[:limit]
    lines = []
    for r in sample:
        ts = str(r.get("slot_time", ""))[:16]
        running = "ON" if r.get("is_running") else "OFF"
        kw = r.get("kw") or "N/A"
        lines.append(f"  {ts} | {running} | kW:{kw}")
    return "\n".join(lines)


def build_analyze_prompt(question: str, context: dict[str, Any], summary: dict[str, Any]) -> str:
    ch1_rows = format_chiller_rows(context.get("chiller_1", []))
    ch2_rows = format_chiller_rows(context.get("chiller_2", []))
    ct1_rows = format_equipment_rows(context.get("cooling_tower_1", []))
    ct2_rows = format_equipment_rows(context.get("cooling_tower_2", []))
    cp1_rows = format_equipment_rows(context.get("condenser_pump_1", []))
    cp3_rows = format_equipment_rows(context.get("condenser_pump_3", []))

    s_ch1 = summary.get("chiller_1", {})
    s_ch2 = summary.get("chiller_2", {})

    prompt = f"""{SYSTEM_CONTEXT}

---

## LIVE DATA SNAPSHOT — Last {context.get('hours_window', 24)} Hours
Fetched at: {context.get('fetched_at', 'N/A')} UTC

### CHILLER 1 SUMMARY
- Records: {s_ch1.get('record_count', 0)} | Running: {s_ch1.get('running_pct', 'N/A')}% of time
- Avg kW: {s_ch1.get('avg_kw', 'N/A')} | Avg TR: {s_ch1.get('avg_tr', 'N/A')} | Avg kW/TR: {s_ch1.get('avg_kw_per_tr', 'N/A')}
- Avg CHW ΔT: {s_ch1.get('avg_chw_delta_t', 'N/A')}°C | Avg Load: {s_ch1.get('avg_chiller_load', 'N/A')}%
- Latest Ambient Temp: {s_ch1.get('latest_ambient_temp', 'N/A')}°C | Latest Leaving Temp: {s_ch1.get('latest_evap_leaving_temp', 'N/A')}°C

Recent readings (newest first):
{ch1_rows}

### CHILLER 2 SUMMARY
- Records: {s_ch2.get('record_count', 0)} | Running: {s_ch2.get('running_pct', 'N/A')}% of time
- Avg kW: {s_ch2.get('avg_kw', 'N/A')} | Avg TR: {s_ch2.get('avg_tr', 'N/A')} | Avg kW/TR: {s_ch2.get('avg_kw_per_tr', 'N/A')}
- Avg CHW ΔT: {s_ch2.get('avg_chw_delta_t', 'N/A')}°C | Avg Load: {s_ch2.get('avg_chiller_load', 'N/A')}%
- Latest Ambient Temp: {s_ch2.get('latest_ambient_temp', 'N/A')}°C | Latest Leaving Temp: {s_ch2.get('latest_evap_leaving_temp', 'N/A')}°C

Recent readings (newest first):
{ch2_rows}

### COOLING TOWER 1 SUMMARY
- Records: {summary.get('cooling_tower_1', {}).get('record_count', 0)} | Running: {summary.get('cooling_tower_1', {}).get('running_pct', 'N/A')}% | Avg kW: {summary.get('cooling_tower_1', {}).get('avg_kw', 'N/A')}
{ct1_rows}

### COOLING TOWER 2 SUMMARY
- Records: {summary.get('cooling_tower_2', {}).get('record_count', 0)} | Running: {summary.get('cooling_tower_2', {}).get('running_pct', 'N/A')}% | Avg kW: {summary.get('cooling_tower_2', {}).get('avg_kw', 'N/A')}
{ct2_rows}

### CONDENSER PUMP 1&2 SUMMARY
- Records: {summary.get('condenser_pump_1', {}).get('record_count', 0)} | Running: {summary.get('condenser_pump_1', {}).get('running_pct', 'N/A')}% | Avg kW: {summary.get('condenser_pump_1', {}).get('avg_kw', 'N/A')}
{cp1_rows}

### CONDENSER PUMP 3 SUMMARY
- Records: {summary.get('condenser_pump_3', {}).get('record_count', 0)} | Running: {summary.get('condenser_pump_3', {}).get('running_pct', 'N/A')}% | Avg kW: {summary.get('condenser_pump_3', {}).get('avg_kw', 'N/A')}
{cp3_rows}

---

## OPERATOR QUESTION
{question}

## YOUR ANALYSIS
"""
    return prompt
