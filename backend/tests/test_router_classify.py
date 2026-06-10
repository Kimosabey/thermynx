"""Unit tests for the Nyx intent router — deterministic layers only (no LLM).

Covers extraction, keyword heuristics, preflight guards, forced override, and
dispatch mapping. Cases are chosen to short-circuit BEFORE the LLM arbiter
(forced / preflight / short+keyword) so the suite runs offline.
"""
import asyncio

from app.ai.router_classify import (
    build_dispatch, classify, extract_equipment, extract_hours, keyword_engine,
)


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ── extraction ────────────────────────────────────────────────────────────────

def test_extract_equipment_from_message():
    assert extract_equipment("why is chiller 2 hot?") == "chiller_2"
    assert extract_equipment("tower 1 status") == "cooling_tower_1"
    assert extract_equipment("plant overview") is None


def test_extract_equipment_carryover_from_history():
    hist = [{"role": "user", "content": "look at chiller 1"}, {"role": "assistant", "content": "ok"}]
    assert extract_equipment("and now?", hist) == "chiller_1"


def test_extract_equipment_ignores_unknown():
    # chiller_9 isn't in the catalog → not extracted
    assert extract_equipment("chiller 9 please") is None


def test_extract_hours():
    assert extract_hours("last 48 hours") == 48
    assert extract_hours("past 7 days") == 168
    assert extract_hours("today") == 24
    assert extract_hours("this week") == 168
    assert extract_hours("no window here") is None


# ── keyword routing ─────────────────────────────────────────────────────────

def test_keyword_engine():
    assert keyword_engine("how many anomalies today?", 0) == "data_sql"
    assert keyword_engine("why is chiller 2 hot?", 1) == "investigate"
    assert keyword_engine("optimize plant energy", 0) == "optimize"
    assert keyword_engine("give me a morning briefing", 0) == "brief"
    assert keyword_engine("compare across the whole plant", 0) == "orchestrate"
    assert keyword_engine("two units mentioned", 2) == "orchestrate"   # multi-equipment
    assert keyword_engine("what is the design kw/tr?", 0) is None       # → would fall to LLM/quick


# ── classify short-circuits (no LLM) ─────────────────────────────────────────

def test_forced_override_skips_llm():
    d = run(classify("anything at all here", force_engine="data_sql"))
    assert d.engine == "data_sql" and d.source == "override"


def test_preflight_action_refusal():
    d = run(classify("shut down chiller 1"))
    assert d.preflight_refusal is not None
    assert d.engine == "quick" and d.source == "preflight"


def test_preflight_unknown_equipment_refusal():
    d = run(classify("efficiency of chiller 9"))
    assert d.preflight_refusal is not None and "does not exist" in d.preflight_refusal


def test_keyword_route_investigate():
    d = run(classify("why is chiller 2 running hot?"))   # short + keyword → heuristic, no LLM
    assert d.engine == "investigate" and d.source == "heuristic"
    assert d.equipment_id == "chiller_2"


def test_keyword_route_data_sql_with_hours():
    d = run(classify("how many anomalies today?"))
    assert d.engine == "data_sql" and d.source == "heuristic" and d.hours == 24


# ── dispatch mapping ─────────────────────────────────────────────────────────

def test_dispatch_quick():
    dp = build_dispatch("quick", "what is kw/tr?", "chiller_1", 24, "t1")
    assert dp["path"] == "/api/v1/analyze" and dp["stream"] is True
    assert dp["body"]["equipment_id"] == "chiller_1" and dp["body"]["thread_id"] == "t1"


def test_dispatch_agent_mode_translation():
    dp = build_dispatch("investigate", "why hot", "chiller_2", 24)
    assert dp["path"] == "/api/v1/agent/run" and dp["body"]["mode"] == "investigator"
    assert dp["body"]["context"]["equipment_id"] == "chiller_2"


def test_dispatch_sql_not_streamed():
    dp = build_dispatch("data_sql", "avg kw", None, 24)
    assert dp["path"] == "/api/v1/nl-query" and dp["stream"] is False


def test_dispatch_orchestrate():
    dp = build_dispatch("orchestrate", "full plant review", None, 72)
    assert dp["path"] == "/api/v1/agent/orchestrate" and dp["stream"] is True
