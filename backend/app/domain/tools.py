"""
Agent tool registry — schemas (for Ollama) + async executors.
All executors return JSON-serializable dicts, kept small for LLM context.
"""
import decimal
from dataclasses import asdict, dataclass
from datetime import datetime, date
from typing import Any

from app.domain.equipment import EQUIPMENT_CATALOG, get_by_id
from app.log import get_logger


@dataclass(frozen=True)
class ToolContext:
    """Injectable context for agent tools (reserved for shared sessions and tenant data)."""


def _equipment_error(equipment_id: str | None = None, msg: str | None = None) -> dict[str, Any]:
    if msg:
        return {"error": msg}
    return {"error": f"Unknown or invalid equipment: {equipment_id}"}


def _sanitize(obj: Any) -> Any:
    """Recursively convert non-JSON-serializable types returned by MySQL/Postgres."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(i) for i in obj]
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return obj

log = get_logger("domain.tools")

# ── Tool schemas (Ollama function-calling format) ─────────────────────────────

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_equipment_list",
            "description": "List all HVAC equipment (chillers, cooling towers, pumps) in the plant.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compute_efficiency",
            "description": (
                "Compute kW/TR efficiency analysis for a chiller. Returns band "
                "(excellent/good/fair/poor/critical), average kW/TR, delta vs design "
                "benchmark, and identified loss drivers."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "equipment_id": {"type": "string", "description": "Equipment ID (e.g. chiller_1)"},
                    "hours":        {"type": "integer", "description": "Look-back window in hours (1-168)", "default": 24},
                },
                "required": ["equipment_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detect_anomalies",
            "description": (
                "Detect statistical anomalies (z-score > 3) for an equipment in the "
                "last N hours compared to a 72-hour baseline."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "equipment_id": {"type": "string"},
                    "hours":        {"type": "integer", "default": 1},
                },
                "required": ["equipment_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_timeseries_summary",
            "description": (
                "Get aggregated statistics (min, max, avg, p95) for key metrics of "
                "an equipment over the last N hours. Lightweight — use before asking "
                "detailed questions about specific metric values."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "equipment_id": {"type": "string"},
                    "hours":        {"type": "integer", "default": 24},
                },
                "required": ["equipment_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_equipment",
            "description": (
                "Side-by-side comparison of two equipment for the same time window. "
                "Returns deltas and which equipment is performing better."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "equipment_id_a": {"type": "string"},
                    "equipment_id_b": {"type": "string"},
                    "hours":          {"type": "integer", "default": 24},
                },
                "required": ["equipment_id_a", "equipment_id_b"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_anomaly_history",
            "description": "Retrieve recently persisted anomaly events from the database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "equipment_id": {"type": "string", "description": "Optional filter by equipment"},
                    "limit":        {"type": "integer", "default": 10},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": (
                "Semantic search across ingested manuals, ASHRAE guides, and incident notes (RAG). "
                "Use when the question involves maintenance intervals, fault codes, design limits, or specs."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query":        {"type": "string", "description": "Natural language search query"},
                    "equipment_id": {"type": "string", "description": "Optional: filter doc chunks tied to equipment"},
                    "top_k":        {"type": "integer", "default": 4},
                },
                "required": ["query"],
            },
        },
    },
]


# ── Executor functions ────────────────────────────────────────────────────────

async def _exec_get_equipment_list(**_) -> dict:
    return {
        "equipment": [
            {"id": e["id"], "name": e["name"], "type": e["type"]}
            for e in EQUIPMENT_CATALOG
        ]
    }


async def _exec_compute_efficiency(equipment_id: str, hours: int = 24) -> dict:
    from app.db.session import MySQLSession
    from app.db.telemetry import fetch_chiller_data
    from app.analytics.efficiency import analyze_chiller_efficiency

    eq = get_by_id(equipment_id)
    if not eq or eq["type"] != "chiller":
        return _equipment_error(equipment_id, f"{equipment_id} is not a chiller")

    async with MySQLSession() as db:
        rows = await fetch_chiller_data(db, eq["table"], hours=hours)

    result = analyze_chiller_efficiency(equipment_id, eq["name"], rows)
    d = asdict(result)
    # Keep small — drop full row lists
    return {k: v for k, v in d.items() if k not in ("record_count",)}


async def _exec_detect_anomalies(equipment_id: str, hours: int = 1) -> dict:
    from app.db.session import MySQLSession
    from app.db.telemetry import (
        fetch_chiller_data, fetch_equipment_data,
        COOLING_TOWER_COLS, PUMP_COLS
    )
    from app.analytics.anomaly import detect_anomalies, CHILLER_METRICS, TOWER_PUMP_METRICS
    from dataclasses import asdict

    eq = get_by_id(equipment_id)
    if not eq:
        return _equipment_error(equipment_id)

    async with MySQLSession() as db:
        if eq["type"] == "chiller":
            rows     = await fetch_chiller_data(db, eq["table"], hours=hours)
            baseline = await fetch_chiller_data(db, eq["table"], hours=72)
            metrics  = CHILLER_METRICS
        else:
            cols     = COOLING_TOWER_COLS if eq["type"] == "cooling_tower" else PUMP_COLS
            rows     = await fetch_equipment_data(db, eq["table"], cols, hours=hours)
            baseline = await fetch_equipment_data(db, eq["table"], cols, hours=72)
            metrics  = TOWER_PUMP_METRICS

    events = detect_anomalies(equipment_id, rows, metrics, baseline_rows=baseline)
    return {
        "total": len(events),
        "anomalies": [asdict(e) for e in events[:5]],  # top 5 only
    }


async def _exec_get_timeseries_summary(equipment_id: str, hours: int = 24) -> dict:
    from app.db.session import MySQLSession
    from app.db.telemetry import (
        fetch_chiller_data, fetch_equipment_data,
        COOLING_TOWER_COLS, PUMP_COLS, compute_summary
    )

    eq = get_by_id(equipment_id)
    if not eq:
        return _equipment_error(equipment_id)

    async with MySQLSession() as db:
        if eq["type"] == "chiller":
            rows = await fetch_chiller_data(db, eq["table"], hours=hours)
        else:
            cols = COOLING_TOWER_COLS if eq["type"] == "cooling_tower" else PUMP_COLS
            rows = await fetch_equipment_data(db, eq["table"], cols, hours=hours)

    summary = await compute_summary({equipment_id: rows})
    return {"equipment_id": equipment_id, "hours": hours, "summary": summary.get(equipment_id, {})}


async def _exec_compare_equipment(
    equipment_id_a: str, equipment_id_b: str, hours: int = 24
) -> dict:
    a = await _exec_get_timeseries_summary(equipment_id_a, hours)
    b = await _exec_get_timeseries_summary(equipment_id_b, hours)

    sa = a.get("summary", {})
    sb = b.get("summary", {})

    eff_a = sa.get("avg_kw_per_tr")
    eff_b = sb.get("avg_kw_per_tr")
    better = None
    if eff_a is not None and eff_b is not None:
        better = equipment_id_a if eff_a < eff_b else equipment_id_b

    return {
        equipment_id_a: sa,
        equipment_id_b: sb,
        "delta_kw_per_tr": round(eff_a - eff_b, 4) if (eff_a and eff_b) else None,
        "better_efficiency": better,
    }


async def _exec_get_anomaly_history(
    equipment_id: str | None = None, limit: int = 10
) -> dict:
    from app.db.session import PGSession
    from sqlalchemy import text

    async with PGSession() as pg:
        where = "WHERE equipment_id = :eq" if equipment_id else ""
        params = {"limit": limit}
        if equipment_id:
            params["eq"] = equipment_id
        rows = await pg.execute(
            text(f"SELECT equipment_id, metric, started_at, z_score, severity, description FROM anomalies {where} ORDER BY created_at DESC LIMIT :limit"),
            params,
        )
        results = [dict(r._mapping) for r in rows]

    return {"total": len(results), "anomalies": results}


async def _exec_search_knowledge_base(
    query: str,
    equipment_id: str | None = None,
    top_k: int = 4,
) -> dict:
    from app.db.session import PGSession
    from app.services.rag import retrieve
    async with PGSession() as pg:
        chunks = await retrieve(pg, query, top_k=top_k, equipment_id=equipment_id)
    if not chunks:
        return {"total": 0, "chunks": [], "note": "No relevant documentation found. Embeddings table may be empty — run scripts/ingest_docs.py first."}
    return {
        "total": len(chunks),
        "chunks": [
            {
                "source": c.source_id,
                "chunk_idx": c.chunk_idx,
                "score": c.score,
                "content": c.content[:600],  # truncate for LLM context
            }
            for c in chunks
        ],
    }


# ── Registry ─────────────────────────────────────────────────────────────────

TOOL_EXECUTORS = {
    "get_equipment_list":      _exec_get_equipment_list,
    "compute_efficiency":      _exec_compute_efficiency,
    "detect_anomalies":        _exec_detect_anomalies,
    "get_timeseries_summary":  _exec_get_timeseries_summary,
    "compare_equipment":       _exec_compare_equipment,
    "get_anomaly_history":     _exec_get_anomaly_history,
    "search_knowledge_base":   _exec_search_knowledge_base,
    "retrieve_manual":         _exec_search_knowledge_base,  # backward compat — old model/tool name
}


async def execute_tool(
    name: str,
    args: dict,
    *,
    ctx: ToolContext | None = None,
) -> dict:
    _ = ctx  # reserved for pooled sessions / multi-tenant
    fn = TOOL_EXECUTORS.get(name)
    if not fn:
        log.warning("unknown_tool name=%s", name)
        return {"error": f"Unknown tool: {name}"}
    try:
        import inspect as ip

        sig = ip.signature(fn)
        raw = dict(args or {})

        accepts_var_kw = any(
            p.kind == ip.Parameter.VAR_KEYWORD for p in sig.parameters.values()
        )
        if accepts_var_kw:
            out = await fn(**raw)
        else:
            allowed = {
                pname
                for pname, param in sig.parameters.items()
                if param.kind in (ip.Parameter.POSITIONAL_OR_KEYWORD, ip.Parameter.KEYWORD_ONLY)
            }
            filtered = {k: v for k, v in raw.items() if k in allowed}
            out = await fn(**filtered)

        log.debug("tool_ok name=%s", name)
        # Sanitize before returning — MySQL returns Decimal for AVG/MAX, which
        # json.dumps in _sse() cannot handle.
        return _sanitize(out)
    except TypeError as e:
        log.warning("tool_bad_args name=%s err=%s args=%s", name, e, args)
        return {"error": f"Invalid arguments for '{name}'. Expected valid parameters — got keys {list((args or {}).keys())}. {e}"}
    except Exception as e:
        log.exception("tool_failed name=%s", name)
        return {"error": str(e)}
