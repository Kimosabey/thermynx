"""Pre-flight validation for AI requests.

Cheap, deterministic checks that run **before** any LLM call. They:
  1. Catch obviously bad input (unknown equipment mentions, off-topic prompts)
  2. Return a deterministic refusal so we never pay a 30-60s LLM round-trip
     just to discover the question can't be answered.

This is layer 1 of the hallucination defense stack — see
docs/planning/ai/HALLUCINATION_DEFENSES.md §1.
"""
from __future__ import annotations

import difflib
import re

from app.domain.equipment import EQUIPMENT_CATALOG

# Matches "chiller 3", "chiller_3", "Chiller3", "tower 5", "pump 7",
# "condenser pump 4", etc. Case-insensitive.
_EQUIPMENT_MENTION_RE = re.compile(
    r"\b(condenser[\s_]*pump|chiller|cooling[\s_]*tower|tower|pump)[\s_]*([0-9]+)\b",
    re.IGNORECASE,
)

# Map raw word → canonical type so "tower 1" can be normalized to "cooling_tower_1".
_TYPE_NORMALIZE = {
    "chiller":        "chiller",
    "tower":          "cooling_tower",
    "cooling tower":  "cooling_tower",
    "cooling_tower":  "cooling_tower",
    "pump":           "condenser_pump",   # plant has only condenser pumps
    "condenser pump": "condenser_pump",
    "condenser_pump": "condenser_pump",
}


def _canonical_id(raw_type: str, num: str) -> str:
    """Build the canonical equipment_id given a raw type word + number."""
    norm_type = _TYPE_NORMALIZE.get(re.sub(r"[\s_]+", " ", raw_type.lower().strip()), raw_type.lower())
    return f"{norm_type}_{num}"


def _all_known_ids() -> set[str]:
    return {e["id"] for e in EQUIPMENT_CATALOG}


def _available_label() -> str:
    return ", ".join(e["name"] for e in EQUIPMENT_CATALOG)


def check_equipment_mentions(question: str) -> str | None:
    """Scan the question for equipment references.

    Returns:
        None if all mentions are valid (or no equipment mentioned).
        A user-facing refusal string if any mention is not in EQUIPMENT_CATALOG.

    Examples:
        check_equipment_mentions("Tell me about chiller 1")  -> None
        check_equipment_mentions("Tell me about chiller 3")  -> "Chiller 3 does not exist…"
        check_equipment_mentions("efficiency of tower 5")    -> "Cooling Tower 5 does not exist…"
        check_equipment_mentions("general overview")         -> None  (no equipment mentioned)
    """
    if not question:
        return None

    known = _all_known_ids()
    bad: list[str] = []
    for m in _EQUIPMENT_MENTION_RE.finditer(question):
        raw_type, num = m.group(1), m.group(2)
        canonical = _canonical_id(raw_type, num)
        if canonical not in known:
            # Pretty form for the refusal message: "Chiller 3", "Cooling Tower 5"
            pretty_type = re.sub(r"[\s_]+", " ", raw_type.strip()).title()
            if pretty_type.lower() == "tower":
                pretty_type = "Cooling Tower"
            bad.append(f"{pretty_type} {num}")

    if bad:
        unique_bad = list(dict.fromkeys(bad))  # de-dupe, preserve order
        return (
            f"{', '.join(unique_bad)} does not exist in this plant. "
            f"Available equipment: {_available_label()}."
        )
    return None


# ── Fuzzy match for typo'd equipment names ───────────────────────────────────

_TYPO_TARGETS = ["chiller", "tower", "cooling tower", "pump", "condenser pump"]


def suggest_equipment_fix(question: str) -> str | None:
    """If the question contains a likely typo of an equipment word, suggest a fix.

    Conservative — only fires on close matches (cutoff 0.82) to avoid noisy
    suggestions. Returns None if nothing looks like a typo.
    """
    # Find sequences of letters that look like they could be equipment words
    # but aren't already recognized by the strict regex.
    words = re.findall(r"\b[a-z]{4,15}\b", question.lower())
    for w in words:
        if w in {"chiller", "tower", "pump", "the", "and", "for", "what", "show", "give"}:
            continue
        close = difflib.get_close_matches(w, _TYPO_TARGETS, n=1, cutoff=0.82)
        if close:
            return f'Did you mean "{close[0]}"? (you wrote "{w}")'
    return None


# ── Topic gate — basic off-topic refusal ─────────────────────────────────────

_HVAC_KEYWORDS = re.compile(
    r"\b(chiller|tower|pump|kw|tr|cop|efficiency|cooling|condenser|evap(orator)?|"
    r"refrigerant|hvac|setpoint|temperature|temp|load|kwh|energy|maintenance|"
    r"anomaly|fault|alarm|delta[\s_-]*t|approach|wet[\s_-]*bulb|fouling|"
    r"plant|equipment|sensor|run[\s_]*hours?)\b",
    re.IGNORECASE,
)


def is_on_topic(question: str) -> bool:
    """Heuristic — does the question look like it's about HVAC operations?"""
    if not question or len(question.strip()) < 3:
        return False
    return bool(_HVAC_KEYWORDS.search(question))


def topic_gate(question: str, *, equipment_id: str | None = None) -> str | None:
    """Return a refusal string if the question is clearly off-topic, else None.

    Lenient — if equipment is selected via the dropdown, we trust the user
    is talking about HVAC even if no keyword is present.
    """
    if equipment_id:
        return None
    if is_on_topic(question):
        return None
    return (
        "I'm an HVAC operations assistant — I can only answer questions about "
        "the plant's chillers, towers, pumps, energy, anomalies, and maintenance. "
        "Try selecting a piece of equipment or asking about kW/TR, efficiency, "
        "anomalies, or run hours."
    )
