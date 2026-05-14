"""
Versioned HVAC prompt templates.
All prompt building is pure — no I/O imports.
"""
from typing import Any

SYSTEM_CONTEXT = """You are the Graylinx HVAC intelligence assistant — a senior HVAC energy engineer specializing in chiller plant optimization.
You have deep expertise in:
- Chiller performance analysis (kW/TR efficiency benchmarks: good <0.65, acceptable 0.65–0.85, poor >0.85)
- Cooling tower approach temperature and wet-bulb relationships
- Condenser water delta-T and flow balance
- Chilled water delta-T and AHU load distribution
- Energy optimization, fouling detection, and predictive maintenance signals

When analyzing data:
1. Always cite specific values and timestamps from the data
2. Compare against benchmarks (kW/TR, delta-T norms)
3. Identify root causes, not just symptoms
4. Give actionable recommendations with expected impact
5. Structure your response with: **Findings** / **Likely Causes** / **Recommendations**
6. Use markdown formatting (bold headers, bullet points, tables where helpful)"""


def _fmt_chiller_rows(rows: list[dict], max_rows: int = 15) -> str:
    if not rows:
        return "  No data available\n"
    sample = rows[:max_rows]
    lines = ["  | Time | kW | TR | kW/TR | Load% | CHW ΔT | Evap Out |"]
    lines.append("  |------|----|----|-------|-------|--------|----------|")
    for r in sample:
        t = str(r.get("slot_time", ""))[:16]
        kw = f"{float(r['kw']):.1f}" if r.get("kw") is not None else "—"
        tr = f"{float(r['tr']):.1f}" if r.get("tr") is not None else "—"
        eff = f"{float(r['kw_per_tr']):.3f}" if r.get("kw_per_tr") is not None else "—"
        load = f"{float(r['chiller_load']):.1f}" if r.get("chiller_load") is not None else "—"
        dt = f"{float(r['chw_delta_t']):.2f}" if r.get("chw_delta_t") is not None else "—"
        evap = f"{float(r['evap_leaving_temp']):.2f}" if r.get("evap_leaving_temp") is not None else "—"
        lines.append(f"  | {t} | {kw} | {tr} | {eff} | {load} | {dt} | {evap} |")
    if len(rows) > max_rows:
        lines.append(f"  ... (+{len(rows) - max_rows} more rows)")
    return "\n".join(lines) + "\n"


def _fmt_equipment_rows(rows: list[dict], max_rows: int = 8) -> str:
    if not rows:
        return "  No data available\n"
    sample = rows[:max_rows]
    lines = ["  | Time | Running | kW |"]
    lines.append("  |------|---------|-----|")
    for r in sample:
        t = str(r.get("slot_time", ""))[:16]
        running = "Yes" if r.get("is_running") else "No"
        kw = f"{float(r['kw']):.2f}" if r.get("kw") is not None else "—"
        lines.append(f"  | {t} | {running} | {kw} |")
    return "\n".join(lines) + "\n"


def _fmt_summary(name: str, s: dict) -> str:
    if not s:
        return ""
    parts = [f"  {name}:"]
    for k, v in s.items():
        if v is not None:
            parts.append(f"    {k}: {v}")
    return "\n".join(parts)


def build_analyze_prompt(
    question: str,
    context: dict[str, Any],
    summary: dict[str, Any],
    conversation_history: list[dict[str, str]] | None = None,
    rag_context: str = "",
) -> str:
    sections = []
    if conversation_history:
        sections.append("## PRIOR CONVERSATION IN THIS THREAD\n")
        for m in conversation_history:
            role = m.get("role", "?").upper()
            content = (m.get("content") or "").strip()
            if not content:
                continue
            if len(content) > 4000:
                content = content[:4000] + "\n… (truncated)"
            sections.append(f"### {role}\n{content}\n")
        sections.append("---\n")

    sections.extend([SYSTEM_CONTEXT, "\n---\n## LIVE PLANT DATA\n"])

    for key in ["chiller_1", "chiller_2"]:
        rows = context.get(key, [])
        if rows:
            sections.append(f"### {key.replace('_', ' ').title()} ({len(rows)} records)\n")
            sections.append(_fmt_chiller_rows(rows))
            if key in summary:
                sections.append(_fmt_summary(f"{key} summary", summary[key]) + "\n")

    for key in ["cooling_tower_1", "cooling_tower_2", "condenser_pump_1", "condenser_pump_3"]:
        rows = context.get(key, [])
        if rows:
            sections.append(f"### {key.replace('_', ' ').title()} ({len(rows)} records)\n")
            sections.append(_fmt_equipment_rows(rows))

    if rag_context:
        sections.append(f"\n---\n{rag_context}")

    sections.append(f"\n---\n## QUESTION\n{question}\n")
    cite_note = (
        " Where relevant, cite documentation sources using [source: filename §chunk_idx]."
        if rag_context else ""
    )
    sections.append(
        "\nRespond with a structured markdown analysis. "
        f"Be specific — cite kW/TR values, timestamps, and delta-T readings from the data above.{cite_note}"
    )

    return "\n".join(sections)


REPORT_SUMMARY_SYSTEM = """You are the Graylinx HVAC intelligence assistant — a senior HVAC operations engineer writing executive summaries for plant managers.

Rules:
- Output markdown only — exactly three short paragraphs as headings:
  **What happened** · **What it cost** · **What to act on**
- Use ONLY facts reflected in the KPI/anomaly blocks provided; do not invent numbers.
- Maximum ~180 words total — concise and actionable.
- Tone: professional, calm, operator-focused."""


def build_report_summary_user_message(
    period_from: str,
    period_to: str,
    kpi_table: str,
    top_anomalies: str,
    total_kwh: str,
) -> str:
    return (
        f"Reporting window (UTC): **{period_from}** → **{period_to}**\n\n"
        "## KPI snapshot\n"
        f"{kpi_table}\n\n"
        "## Recent anomalies / alerts\n"
        f"{top_anomalies}\n\n"
        "## Energy total\n"
        f"Approximate plant electrical cooling/auxiliary energy over selected chillers & auxiliaries: **{total_kwh} kWh** "
        "(see KPI breakdown).\n\n"
        "Write the executive markdown summary now."
    )

