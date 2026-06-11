"""Unit tests for the fallback prose-JSON parser (F1.14).

`parse_first_json_object` is the legacy/fallback extractor retained for the
inline pipeline + the critique auditor (the graph path uses Pydantic structured
output instead). These tests lock its behaviour — including the documented
quirk that the brace-scan stops at the FIRST balanced span.
"""
from app.ai.json_utils import parse_first_json_object


# ── happy paths ─────────────────────────────────────────────────────────────

def test_plain_json_object():
    assert parse_first_json_object('{"a": 1, "b": "x"}') == {"a": 1, "b": "x"}


def test_json_fence_with_lang():
    raw = '```json\n{"subtasks": [{"specialist": "investigator"}]}\n```'
    assert parse_first_json_object(raw) == {"subtasks": [{"specialist": "investigator"}]}


def test_bare_fence_no_lang():
    assert parse_first_json_object('```\n{"ok": true}\n```') == {"ok": True}


def test_json_embedded_in_prose():
    raw = 'Sure, here is the plan: {"rationale": "go", "subtasks": []} — done.'
    assert parse_first_json_object(raw) == {"rationale": "go", "subtasks": []}


def test_nested_braces_balanced_span():
    raw = 'noise {"outer": {"inner": [1, 2]}, "k": "v"} trailing'
    assert parse_first_json_object(raw) == {"outer": {"inner": [1, 2]}, "k": "v"}


def test_leading_and_trailing_whitespace():
    assert parse_first_json_object('   \n  {"x": 1}\n ') == {"x": 1}


# ── None / fallthrough cases ─────────────────────────────────────────────────

def test_empty_string_returns_none():
    assert parse_first_json_object("") is None


def test_none_input_returns_none():
    assert parse_first_json_object(None) is None  # type: ignore[arg-type]


def test_no_brace_text_returns_none():
    assert parse_first_json_object("no json here at all") is None


def test_top_level_array_is_not_an_object():
    # A JSON array parses but isn't a dict; no `{` follows → None.
    assert parse_first_json_object("[1, 2, 3]") is None


def test_invalid_braces_return_none():
    # Unquoted keys are invalid JSON; the first balanced span fails to parse.
    assert parse_first_json_object("{not: valid}") is None


def test_brace_scan_stops_at_first_span_quirk():
    # Documented limitation: it does NOT skip a bad first span to find a later
    # valid one — the first balanced {...} that fails to parse yields None.
    assert parse_first_json_object('{bad} {"good": 1}') is None
