"""AI request pipeline — re-exports in execution order.

Read this file top-to-bottom to understand what happens for every AI request.
Each stage points at the canonical implementation file. No new code lives
here — this is a facade for navigation.

The flow for every AI-facing endpoint (/analyze, /agent/run, /nl-query,
/vision, /reports/daily, /slack/commands) walks these stages in order:

  STAGE 1  — Pre-flight        (regex-only, no LLM call, <100ms)
  STAGE 2  — Context fetch     (DB queries + analytics)
  STAGE 2b — RAG retrieval     (optional, embed + vector search)
  STAGE 3  — Prompt build      (system + RAG + focus + DATA window)
  STAGE 4  — LLM call          (streaming or non-streaming, circuit-breaker-guarded)
  STAGE 4b — Tool execution    (agent only — ReAct loop)
  STAGE 5  — Post-gen audit    (numeric / equipment / citation / language)
  STAGE 6  — LLM critique      (analyzer only — semantic groundedness check)

See `docs/planning/ai/AI_PIPELINE_REORG.md` for the full pipeline diagram.
"""

# ─── STAGE 1 — Pre-flight ──────────────────────────────────────────────────
# Cheap regex-based gates that short-circuit obviously-bad input BEFORE the LLM
# sees the question. Runs in <100ms — saves the 30-60s tax of refusing late.
from app.ai.preflight import (    # noqa: F401
    check_action_request,
    check_equipment_mentions,
    topic_gate,
    suggest_equipment_fix,
)


# ─── STAGE 2 — Context fetch ───────────────────────────────────────────────
# Pulls the LIVE plant data the LLM will reason over. Uses analytics for
# pre-computed bands / averages so the LLM doesn't have to do math.
from app.db.telemetry import (           # noqa: F401
    fetch_all_hvac_context,
    fetch_chiller_data,
    fetch_equipment_data,
)
from app.db.telemetry import compute_summary       # noqa: F401
from app.domain.equipment import (        # noqa: F401
    EQUIPMENT_CATALOG,
    get_by_id as get_equipment_by_id,
)


# ─── STAGE 2b — RAG retrieval (optional) ───────────────────────────────────
# Embeds the user's question with nomic-embed-text, vector-searches the
# HVAC knowledge base, returns top-k chunks above similarity threshold 0.55.
# Chunks are wrapped in DATA_START/DATA_END markers in format_rag_context
# so the LLM treats them as DATA, not instructions (LLM01/LLM04).
from app.ai.rag import (            # noqa: F401
    embed_query,
    retrieve,
    format_rag_context,
)


# ─── STAGE 3 — Prompt build ────────────────────────────────────────────────
# Composes the final prompt: SYSTEM_CONTEXT (English-only, read-only,
# refuse-unknown-equipment, premise-verify, fixed-benchmark rules)
# + LIVE PLANT DATA + SUMMARY + RAG context + CURRENT FOCUS pin.
from app.ai.prompts.hvac_prompts import (   # noqa: F401
    SYSTEM_CONTEXT,
    build_analyze_prompt,
    REPORT_SUMMARY_SYSTEM,
    build_report_summary_user_message,
)


# ─── STAGE 4 — LLM call ────────────────────────────────────────────────────
# All LLM I/O goes through this layer. Circuit-breaker-guarded
# (3 failures in 30s → open for 60s, returns OllamaUnavailableError immediately).
# Model is selected per task — see config.py OLLAMA_MODEL_* defaults
# (decision recorded in docs/planning/ai/MODEL_SIZING_DECISION.md).
from app.llm.ollama import (              # noqa: F401
    chat,
    stream_chat_text,
    stream_generate,
    list_models,
    check_ollama_health,
    circuit_state,
)


# ─── STAGE 4b — Tool execution (agent only) ────────────────────────────────
# The agent ReAct loop calls these tools. Each tool validates its args
# (e.g. equipment_id allow-list), executes against the DB/analytics, and
# returns a JSON-serializable result that gets payload-capped (12k chars).
from app.ai.tools import (             # noqa: F401
    TOOL_SCHEMAS,
    execute_tool,
    ToolContext,
)
from app.domain.agent_payload import compact_agent_tool_payload   # noqa: F401


# ─── STAGE 5 — Post-gen audit ──────────────────────────────────────────────
# Regex-only checks against the streamed answer. Flags any number/equipment/
# citation not grounded in the source data, plus non-Latin output that violates
# the English-only rule. Emits Prometheus counters per flag type.
from app.ai.postcheck import (      # noqa: F401
    run_postcheck,
    audit_numeric_claims,
    audit_equipment_mentions,
    audit_citations,
    audit_language,
)


# ─── STAGE 6 — LLM critique (analyzer only) ────────────────────────────────
# Tiny second LLM call (llama3.2:latest, 3B) acts as a fact-checking auditor.
# Reads the SUMMARY block + the streamed answer, returns
# verified/suspicious/unverified verdict. Hard 25s timeout — never blocks.
from app.ai.critique import verify_answer    # noqa: F401


# ─── Per-surface orchestrators ─────────────────────────────────────────────
# Each AI surface (/analyze, /agent/run, etc.) has a top-level orchestrator
# that walks the stages above. These are exposed for testing / introspection;
# the route handlers in api/v1/ are the real entry points.
from app.ai.agent import run_agent, SYSTEM_PROMPTS    # noqa: F401
from app.ai.multi_agent import run_multi_agent        # noqa: F401
from app.ai.nl_to_sql import run_nl_query, NLQueryError  # noqa: F401
from app.services.vision import describe_scene, compare_images  # noqa: F401


__all__ = [
    # Stage 1
    "check_action_request",
    "check_equipment_mentions",
    "topic_gate",
    "suggest_equipment_fix",
    # Stage 2
    "fetch_all_hvac_context",
    "fetch_chiller_data",
    "fetch_equipment_data",
    "compute_summary",
    "EQUIPMENT_CATALOG",
    "get_equipment_by_id",
    # Stage 2b
    "embed_query",
    "retrieve",
    "format_rag_context",
    # Stage 3
    "SYSTEM_CONTEXT",
    "build_analyze_prompt",
    "REPORT_SUMMARY_SYSTEM",
    "build_report_summary_user_message",
    # Stage 4
    "chat",
    "stream_chat_text",
    "stream_generate",
    "list_models",
    "check_ollama_health",
    "circuit_state",
    # Stage 4b
    "TOOL_SCHEMAS",
    "execute_tool",
    "ToolContext",
    "compact_agent_tool_payload",
    # Stage 5
    "run_postcheck",
    "audit_numeric_claims",
    "audit_equipment_mentions",
    "audit_citations",
    "audit_language",
    # Stage 6
    "verify_answer",
    # Surfaces
    "run_agent",
    "SYSTEM_PROMPTS",
    "run_multi_agent",
    "run_nl_query",
    "NLQueryError",
    "describe_scene",
    "compare_images",
]
