"""Self-describing capability catalogue.

GET /api/v1/capabilities — returns a static JSON document that lists
every operator-facing capability the platform exposes and the backends
that power each one. Useful for integrators, ops handoff, and as a
single source of truth for "what does this product do?".

The payload is intentionally static (no DB hits, no LLM call) — it's
authored from the codebase, not derived at runtime. When you add a new
capability, update this file in the same commit.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.config import settings

router = APIRouter()

# Embedding model used by the RAG service (app/ai/rag.py:EMBED_MODEL).
_EMBED_MODEL = "nomic-embed-text"


@router.get("/models")
async def models() -> dict:
    """Live model routing — which Ollama model powers each task right now.

    Resolves each task the same way the services do (specific setting, falling
    back to OLLAMA_DEFAULT_MODEL). Powers the UI 'model in use' toasts so
    operators can see, dynamically, which model is doing what."""
    d = settings.OLLAMA_DEFAULT_MODEL

    def pick(v: str) -> str:
        return v or d

    # task key → (model, human label). Keys are what the frontend toasts use.
    tasks = {
        "text":     (pick(settings.OLLAMA_MODEL_TEXT),    "Narration / Analyzer answer"),
        "tool":     (pick(settings.OLLAMA_MODEL_TOOL),    "Agent tool calls (ReAct)"),
        "sql":      (pick(settings.OLLAMA_MODEL_SQL),     "Natural-language → SQL"),
        "planner":  (pick(settings.OLLAMA_MODEL_PLANNER), "Multi-agent planner"),
        "auditor":  (pick(settings.OLLAMA_AUDITOR_MODEL), "Self-critique / fact-check"),
        "rag":      (pick(settings.OLLAMA_MODEL_RAG),     "RAG-grounded answer"),
        "vision":   (settings.OLLAMA_VISION_MODEL,        "Vision (image analysis)"),
        "embed":    (_EMBED_MODEL,                        "Embeddings (RAG index)"),
    }
    return {
        "host": settings.OLLAMA_HOST,
        "default": d,
        "tasks": {k: {"model": m, "label": lbl} for k, (m, lbl) in tasks.items()},
    }


@router.get("/capabilities")
async def capabilities() -> dict:
    return {
        "product": "Graylinx — HVAC AI Operations Intelligence",
        "version": "0.1.0",
        "deployment": "on-premise",
        "backends": {
            "telemetry":  {"kind": "mysql",      "db": "unicharm",         "role": "read-only"},
            "app_state":  {"kind": "postgres",   "db": "thermynx_app",     "role": "read-write"},
            "vectors":    {"kind": "pgvector",   "db": "thermynx_app",     "role": "embeddings + retrieval"},
            "cache":      {"kind": "redis",      "role": "response cache + arq queue"},
            "llm":        {"kind": "ollama",     "host": settings.OLLAMA_HOST, "default_model": settings.OLLAMA_DEFAULT_MODEL, "routing": "per-task — see GET /api/v1/models"},
        },
        "capabilities": [
            {
                "name": "analyzer",
                "path": "/api/v1/analyze",
                "method": "POST (SSE)",
                "backed_by": ["mysql:unicharm", "ollama"],
                "description": "Equipment-scoped Q&A with streamed answers + post-hoc self-critique fact-check.",
            },
            {
                "name": "agent",
                "path": "/api/v1/agent/run",
                "method": "POST (SSE)",
                "backed_by": ["mysql:unicharm", "ollama", "postgres:thermynx_app"],
                "description": "ReAct agent (5 modes: investigator, optimizer, brief, root-cause, maintenance) with tool calling.",
                "modes": ["investigator", "optimizer", "brief", "root_cause", "maintenance"],
            },
            {
                "name": "equipment",
                "path": "/api/v1/equipment/*",
                "backed_by": ["mysql:unicharm"],
                "description": "Asset catalog + per-equipment timeseries + plant-wide summary.",
            },
            {
                "name": "efficiency",
                "path": "/api/v1/efficiency/*",
                "backed_by": ["mysql:unicharm"],
                "description": "kW/TR band analysis vs. design benchmark with loss-driver decomposition.",
            },
            {
                "name": "anomalies",
                "path": "/api/v1/anomalies/*",
                "backed_by": ["mysql:unicharm", "postgres:thermynx_app"],
                "description": "Z-score anomaly detection across equipment; live + history.",
            },
            {
                "name": "forecast",
                "path": "/api/v1/forecast/{equipment_id}",
                "backed_by": ["mysql:unicharm"],
                "description": "kW/TR forecast — Holt-Winters triple-exponential (trend + 24h seasonality) with hour-of-day heuristic fallback; returns the backend used + confidence tier.",
            },
            {
                "name": "compare",
                "path": "/api/v1/compare",
                "backed_by": ["mysql:unicharm"],
                "description": "Side-by-side comparison of two assets over a time window.",
            },
            {
                "name": "cost",
                "path": "/api/v1/cost",
                "backed_by": ["mysql:unicharm"],
                "description": "Energy cost roll-up at a configurable tariff with per-asset breakdown.",
            },
            {
                "name": "maintenance",
                "path": "/api/v1/maintenance/*",
                "backed_by": ["mysql:unicharm"],
                "description": "Composite health score (0-100) with degradation reasons; chiller / tower / pump aware.",
            },
            {
                "name": "cooling_tower_optimizer",
                "path": "/api/v1/cooling-tower/{equipment_id}/optimize",
                "backed_by": ["mysql:unicharm"],
                "description": "Wet-bulb-aware (when available) or kW-only staging hints with data_status flags.",
            },
            {
                "name": "rag",
                "path": "/api/v1/rag/*",
                "backed_by": ["postgres:thermynx_app", "pgvector", "ollama"],
                "description": "Document ingest → embed (nomic-embed-text 768d) → ivfflat cosine retrieval → admission gate → synthesis.",
            },
            {
                "name": "reports",
                "path": "/api/v1/reports/daily",
                "method": "POST",
                "backed_by": ["mysql:unicharm"],
                "description": "Markdown daily operations report (rolling 24h window).",
            },
            {
                "name": "threads",
                "path": "/api/v1/threads/*",
                "backed_by": ["postgres:thermynx_app"],
                "description": "Conversational thread persistence for analyzer Q&A.",
            },
            {
                "name": "nl_query",
                "path": "/api/v1/nl-query",
                "method": "POST",
                "backed_by": ["mysql:unicharm", "ollama"],
                "description": "Natural-language → guarded read-only SQL over telemetry (deny-list + LIMIT cap), executed and charted.",
            },
            {
                "name": "alarms",
                "path": "/api/v1/alarms",
                "backed_by": ["mysql:unicharm", "postgres:thermynx_app"],
                "description": "Unified anomaly + maintenance alerts with severity tiers; Slack forwarding (when configured).",
            },
            {
                "name": "predictive_maintenance",
                "path": "/api/v1/predictive/*",
                "method": "GET + POST",
                "backed_by": ["mysql:unicharm", "postgres:thermynx_app", "ollama"],
                "description": "Trend-based degradation (kW/TR + condenser-approach drift, time-to-threshold projection); auto-proposes deduped PM work orders. Daily 02:35 UTC cron.",
            },
            {
                "name": "energy_optimizer",
                "path": "/api/v1/optimizer/staging",
                "backed_by": ["mysql:unicharm", "ollama"],
                "description": "Lowest-energy chiller staging for a target (or observed) cooling demand + what-if; deterministic math, LLM narrates, human-approved work-order proposal.",
            },
            {
                "name": "daily_digest",
                "path": "/api/v1/digest/*",
                "method": "GET + POST",
                "backed_by": ["mysql:unicharm", "postgres:thermynx_app", "ollama"],
                "description": "Auto-generated morning plant-health digest (KPIs + grounded narrative), persisted + pushed to Slack. Daily cron (default 00:30 UTC = 06:00 IST).",
            },
            {
                "name": "past_fixes",
                "path": "/api/v1/knowledge/*",
                "method": "GET + POST",
                "backed_by": ["postgres:thermynx_app", "pgvector", "ollama"],
                "description": "Tribal-knowledge flywheel — resolved work orders + captured fixes embedded as 'incident' chunks, semantically searchable and reused by the agent.",
            },
            {
                "name": "work_orders",
                "path": "/api/v1/work-orders/*",
                "method": "GET + POST",
                "backed_by": ["postgres:thermynx_app"],
                "description": "Operator-actionable work items with a code-enforced lifecycle + append-only event audit trail; sources: manual / agent / anomaly / pm.",
            },
            {
                "name": "technicians",
                "path": "/api/v1/technicians/*",
                "backed_by": ["postgres:thermynx_app"],
                "description": "Technician registry (skills, location, load) for work-order assignment.",
            },
            {
                "name": "assets",
                "path": "/api/v1/assets/*",
                "backed_by": ["mysql:unicharm", "postgres:thermynx_app"],
                "description": "IBMS asset registry (read-only from unicharm) with an operator-editable Postgres lifecycle overlay (acquisition, warranty, criticality).",
            },
            {
                "name": "causal_explanation",
                "path": "/api/v1/causal/explain",
                "method": "POST",
                "backed_by": ["mysql:unicharm", "ollama"],
                "description": "On-demand likely-cause + recommended-checks explanation for a specific anomaly, grounded in the surrounding telemetry window.",
            },
            {
                "name": "topology",
                "path": "/api/v1/topology",
                "backed_by": ["mysql:unicharm"],
                "description": "Plant graph (chillers ↔ towers ↔ pumps) with live per-node running state.",
            },
            {
                "name": "vision",
                "path": "/api/v1/vision",
                "method": "POST",
                "backed_by": ["ollama"],
                "description": "Image analysis via a local vision model (gauge/nameplate/thermal reads).",
            },
            {
                "name": "audit_log",
                "path": "/api/v1/audit/*",
                "backed_by": ["postgres:thermynx_app"],
                "description": "Every AI request — model, duration, status, prompt/response hashes — plus operator 👍/👎 verdicts for reproducibility.",
            },
            {
                "name": "models",
                "path": "/api/v1/models",
                "backed_by": ["ollama"],
                "description": "Live model routing per task (text/tool/sql/planner/auditor/rag/vision/embed) — powers the 'model in use' UI toasts.",
            },
        ],
        "ai_methods": {
            "agent_loop": "ReAct (thought → tool_call → tool_result), MAX_STEPS=8, SSE frames",
            "anomaly_detection": "Z-score over 72h baseline per metric; load-gated; per-event confidence score (0.5-1.0)",
            "degradation_trend": "Least-squares drift on kW/TR + condenser-approach with time-to-threshold projection (predictive PM)",
            "staging_optimizer": "Deterministic chiller-staging search (min total kW) over empirical efficiency-at-load profiles; LLM narrates only",
            "forecasting": "Holt-Winters triple-exponential (statsmodels) with hour-of-day heuristic fallback + confidence tiers",
            "rag_retrieval": "pgvector ivfflat cosine, top-K with admission threshold; manuals + incident (past-fix) corpus",
            "self_critique": "Auditor LLM (format=json, temp=0) verifies numeric claims vs telemetry; deterministic numeric/equipment/citation grounding audit runs alongside",
            "model_routing": "Per-task Ollama model selection (text/tool/sql/planner/auditor/rag/vision/embed) — see GET /api/v1/models",
            "streaming": "SSE token stream for analyzer + agent; mid-stream React-Markdown re-render",
        },
        "compliance": {
            "air_gap_compatible": True,
            "no_cloud_dependencies": True,
            "no_external_telemetry": True,
            "request_audit_trail": "analysis_audit + agent_runs tables (prompt + response hashes, durations, model, operator 👍/👎 verdicts)",
        },
    }
