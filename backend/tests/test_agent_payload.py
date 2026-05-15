import json

from app.domain.agent_payload import compact_agent_tool_payload, DEFAULT_MAX_TOOL_PAYLOAD_CHARS


def test_compact_passes_through_small_payload():
    d = {"a": 1, "b": "ok"}
    assert compact_agent_tool_payload("get_timeseries_summary", d) == d


def test_compact_truncates_large_payload():
    huge = {"x": "z" * (DEFAULT_MAX_TOOL_PAYLOAD_CHARS + 5000)}
    out = compact_agent_tool_payload("compare_equipment", huge)
    assert out["_truncated"] is True
    assert out["_tool"] == "compare_equipment"
    assert "_preview" in out
    assert len(out["_preview"]) < len(json.dumps(huge, default=str))


def test_tool_schemas_contains_search_knowledge_base():
    from app.domain.tools import TOOL_SCHEMAS

    names = [s["function"]["name"] for s in TOOL_SCHEMAS]
    assert "search_knowledge_base" in names
