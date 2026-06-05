"""Custom Prometheus metrics for Graylinx.

These are registered on import — they live next to the auto-instrumented HTTP
metrics from ``prometheus-fastapi-instrumentator`` (which exposes
``http_requests_total``, ``http_request_duration_seconds``, etc.).

Conventions:
  - Prefix everything with ``graylinx_`` to avoid colliding with the auto-metrics.
  - Use seconds for durations, bytes for sizes, unit-less counts for counters.
"""

from __future__ import annotations

from prometheus_client import Gauge, Counter

# ── Data quality ──────────────────────────────────────────────────────────────

telemetry_data_age_seconds = Gauge(
    "graylinx_telemetry_data_age_seconds",
    "Age of the newest row in the Unicharm MySQL telemetry tables, in seconds. "
    "Only meaningful when TELEMETRY_TIME_ANCHOR=wall_clock. Stays at 0 in "
    "latest_in_db mode (historical dumps).",
)

telemetry_freshness_check_total = Counter(
    "graylinx_telemetry_freshness_check_total",
    "Number of times the data-freshness check has run, partitioned by status.",
    ["status"],   # ok | stale | no_data | skipped
)

# ── Agent / Analyzer counters ─────────────────────────────────────────────────

agent_runs_total = Counter(
    "graylinx_agent_runs_total",
    "Number of agent runs initiated, partitioned by mode and outcome.",
    ["mode", "status"],   # mode = investigator|optimizer|brief|root_cause|maintenance
                          # status = ok|error|aborted
)

analyzer_requests_total = Counter(
    "graylinx_analyzer_requests_total",
    "Number of /analyze calls, partitioned by outcome.",
    ["status"],   # ok|error|aborted
)

# ── Anomaly scan ──────────────────────────────────────────────────────────────

anomalies_detected_total = Counter(
    "graylinx_anomalies_detected_total",
    "Number of statistical anomalies detected, partitioned by equipment.",
    ["equipment_id", "severity"],
)

# ── Agent tool metrics ───────────────────────────────────────────────────────

agent_tool_calls_total = Counter(
    "graylinx_agent_tool_calls_total",
    "Number of agent tool calls, partitioned by tool name and outcome.",
    ["tool", "status"],   # status = ok | error | timeout
)

agent_tool_duration_seconds = __import__("prometheus_client").Histogram(
    "graylinx_agent_tool_duration_seconds",
    "Agent tool execution latency in seconds.",
    ["tool"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
)

# ── Hallucination audits (Tier 3 — post-generation) ──────────────────────────

hallucination_flags_total = Counter(
    "graylinx_hallucination_flags_total",
    "Number of hallucination flags raised by post-generation audit checks.",
    ["type"],   # type = number | equipment | citation
)

operator_feedback_total = Counter(
    "graylinx_operator_feedback_total",
    "Number of operator 👍/👎 ratings on analyzer answers.",
    ["verdict"],   # verdict = positive | negative
)

hallucination_audit_runs_total = Counter(
    "graylinx_hallucination_audit_runs_total",
    "Number of post-generation audit passes that ran, partitioned by clean/dirty.",
    ["result"], # clean = no flags · dirty = ≥1 flag · skipped = empty answer
)
