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
            "llm":        {"kind": "ollama",     "host": settings.OLLAMA_HOST, "default_model": settings.OLLAMA_DEFAULT_MODEL},
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
                "description": "Short-horizon kW/TR forecast (heuristic POC, foundation-model swap-in planned).",
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
        ],
        "ai_methods": {
            "agent_loop": "ReAct (thought → tool_call → tool_result), MAX_STEPS=8, SSE frames",
            "anomaly_detection": "Z-score over 72h baseline per metric per equipment",
            "rag_retrieval": "pgvector ivfflat cosine, top-K with admission threshold",
            "self_critique": "Auditor LLM with format=json + temp=0 verifies numeric claims vs telemetry summary",
            "streaming": "SSE token stream for analyzer + agent; mid-stream React-Markdown re-render",
        },
        "compliance": {
            "air_gap_compatible": True,
            "no_cloud_dependencies": True,
            "no_external_telemetry": True,
            "request_audit_trail": "analysis_audit + agent_runs tables (prompt + response hashes, durations, model)",
        },
    }
