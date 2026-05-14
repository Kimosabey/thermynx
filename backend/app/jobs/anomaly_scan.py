"""
Background anomaly scan job — runs every 5 minutes via arq cron.
For each equipment, fetches last 60 minutes, runs z-score detection,
and persists results to the anomalies table in Postgres.
"""
from sqlalchemy import text

from app.log import get_logger
from app.db.session import MySQLSession, PGSession
from app.db.telemetry import fetch_chiller_data, fetch_equipment_data, COOLING_TOWER_COLS, PUMP_COLS
from app.domain.equipment import EQUIPMENT_CATALOG
from app.analytics.anomaly import (
    detect_anomalies, CHILLER_METRICS, TOWER_PUMP_METRICS
)

log = get_logger("jobs.anomaly_scan")

WINDOW_HOURS  = 1    # fetch last N hours for anomaly detection
BASELINE_HOURS = 72  # larger window to compute stable baseline


async def _scan_once():
    """Single scan pass over all equipment."""
    found = 0
    async with MySQLSession() as mysql:
        for eq in EQUIPMENT_CATALOG:
            try:
                if eq["type"] == "chiller":
                    rows     = await fetch_chiller_data(mysql, eq["table"], hours=WINDOW_HOURS)
                    baseline = await fetch_chiller_data(mysql, eq["table"], hours=BASELINE_HOURS)
                    metrics  = CHILLER_METRICS
                else:
                    cols     = COOLING_TOWER_COLS if eq["type"] == "cooling_tower" else PUMP_COLS
                    rows     = await fetch_equipment_data(mysql, eq["table"], cols, hours=WINDOW_HOURS)
                    baseline = await fetch_equipment_data(mysql, eq["table"], cols, hours=BASELINE_HOURS)
                    metrics  = TOWER_PUMP_METRICS

                events = detect_anomalies(eq["id"], rows, metrics, baseline_rows=baseline)

                if events:
                    async with PGSession() as pg:
                        for ev in events:
                            await pg.execute(
                                text("""
                                    INSERT INTO anomalies
                                        (id, equipment_id, metric, started_at, value,
                                         baseline_mean, baseline_std, z_score, severity, description, created_at)
                                    VALUES
                                        (gen_random_uuid()::text, :equipment_id, :metric, :started_at, :value,
                                         :baseline_mean, :baseline_std, :z_score, :severity, :description, NOW())
                                    ON CONFLICT DO NOTHING
                                """),
                                {
                                    "equipment_id": ev.equipment_id,
                                    "metric":       ev.metric,
                                    "started_at":   ev.timestamp,
                                    "value":        ev.value,
                                    "baseline_mean": ev.baseline_mean,
                                    "baseline_std":  ev.baseline_std,
                                    "z_score":       ev.z_score,
                                    "severity":      ev.severity,
                                    "description":   ev.description,
                                }
                            )
                        await pg.commit()
                    found += len(events)

            except Exception as e:
                log.warning(f"Anomaly scan failed for {eq['id']}: {e}")

    if found:
        log.info(f"Anomaly scan complete — {found} new event(s) persisted")


async def run_scan_job(_ctx: dict) -> str:
    """arq cron job entry point — _ctx injected by arq, not used directly."""
    await _scan_once()
    return "ok"


async def run_scan_async():
    """Manual / in-process trigger — use run_scan_job for arq."""
    await _scan_once()
