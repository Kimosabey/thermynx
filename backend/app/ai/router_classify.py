"""Nyx intent router — classify a chat message into ONE engine + extract context.

Pure logic (no FastAPI). Layers, each degrades and NEVER raises:
  0. forced override (skip the LLM)
  1. preflight guard (reuse preflight.py — action/equipment/topic refusals)
  2. deterministic extraction (equipment via preflight regex + catalog; hours regex)
  3. keyword heuristics (high-precision short-circuits)
  4. fast LLM arbiter (auditor model, format=json, short timeout) when ambiguous
  5. reconcile + validate (deterministic facts win; LLM equipment validated)

`build_dispatch()` is the single source of truth mapping engine → the existing
endpoint + body the UI should call. The router itself is READ-ONLY (writes nothing).
"""
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field

from app.ai import preflight
from app.ai.json_utils import parse_first_json_object
from app.config import settings
from app.domain.equipment import EQUIPMENT_CATALOG
from app.llm.ollama import generate_json
from app.log import get_logger

log = get_logger("ai.router")

# Engine vocabulary (also the UI mode-chip ids).
ENGINES = ("quick", "investigate", "optimize", "root_cause", "maintenance", "brief", "data_sql", "orchestrate")

# Engine → backend /agent/run mode (only for the five agent engines).
_AGENT_MODE = {
    "investigate": "investigator",
    "optimize":    "optimizer",
    "root_cause":  "root_cause",
    "maintenance": "maintenance",
    "brief":       "brief",
}

_KNOWN_IDS = {e["id"] for e in EQUIPMENT_CATALOG}
_MIN_HOURS, _MAX_HOURS = 1, 8760


@dataclass
class RouteDecision:
    engine: str
    mode: str                      # UI label == engine
    equipment_id: str | None = None
    hours: int | None = None
    rationale: str = ""
    source: str = "default"        # override | preflight | heuristic | llm | default
    preflight_refusal: str | None = None
    dispatch: dict = field(default_factory=dict)


# ── Layer 2: deterministic extraction ────────────────────────────────────────

def extract_equipment(message: str, history: list[dict] | None = None) -> str | None:
    """First valid equipment_id mentioned; else carry over the most recent valid
    one from conversation history."""
    for m in preflight._EQUIPMENT_MENTION_RE.finditer(message or ""):
        cid = preflight._canonical_id(m.group(1), m.group(2))
        if cid in _KNOWN_IDS:
            return cid
    for turn in reversed(history or []):
        for m in preflight._EQUIPMENT_MENTION_RE.finditer(turn.get("content", "")):
            cid = preflight._canonical_id(m.group(1), m.group(2))
            if cid in _KNOWN_IDS:
                return cid
    return None


_HOURS_RE = re.compile(
    r"\b(?:last|past|previous)\s+(\d+)\s*(hour|hr|day|week|month)s?\b"
    r"|\b(\d+)\s*(h|hr|hrs|hours|d|day|days)\b",
    re.IGNORECASE,
)


def extract_hours(message: str) -> int | None:
    msg = (message or "").lower()
    if re.search(r"\b(today|last 24|past 24|24\s*h)\b", msg):
        return 24
    if re.search(r"\b(this week|last 7 days|past week|last week|7\s*days)\b", msg):
        return 168
    if re.search(r"\b(this month|last 30 days|past month|30\s*days)\b", msg):
        return 720
    m = _HOURS_RE.search(msg)
    if m:
        n = int(m.group(1) or m.group(3))
        unit = (m.group(2) or m.group(4) or "h").lower()
        mult = 1 if unit.startswith(("h", "hr")) else 24 if unit.startswith("d") else 168 if unit.startswith("w") else 720
        return max(_MIN_HOURS, min(_MAX_HOURS, n * mult))
    return None


# ── Layer 3: keyword heuristics (ordered; first match wins) ───────────────────

_RX = {
    "data_sql":    re.compile(r"\b(how many|count|list all|list the|rows?|table|average|avg|mean|sum|total of|max(imum)?|min(imum)?|group by|top \d+|sort(ed)? by|between .+ and )\b", re.I),
    "orchestrate": re.compile(r"\b(whole plant|entire plant|full plant|all equipment|across (the )?plant|everything|end[- ]to[- ]end|comprehensive)\b", re.I),
    "brief":       re.compile(r"\b(brief(ing)?|morning report|shift (handover|start|status)|plant status|status report|daily summary|give me an overview)\b", re.I),
    "optimize":    re.compile(r"\b(optimi[sz]e|reduce (energy|power|kwh|consumption)|save (power|energy|kwh)|lower (power|consumption|energy)|setpoint recommend|improve efficiency|staging)\b", re.I),
    "root_cause":  re.compile(r"\b(root cause|what caused|why did|diagnose|reason for the|caused the (fault|anomaly|spike|drop))\b", re.I),
    "maintenance": re.compile(r"\b(maintenance|predictive|when will .* (fail|need)|remaining (useful )?life|\brul\b|service interval|degrad(e|ing|ation)|fouling trend)\b", re.I),
    "investigate": re.compile(r"\b(why is|why are|investigate|anomal|underperform|burning power|running hot|too (high|low)|problem with|what's wrong|whats wrong|is .* normal)\b", re.I),
}


def keyword_engine(message: str, n_equipment: int) -> str | None:
    if n_equipment >= 2:
        return "orchestrate"
    for engine in ("data_sql", "orchestrate", "brief", "optimize", "root_cause", "maintenance", "investigate"):
        if _RX[engine].search(message or ""):
            return engine
    return None


# ── Layer 4: LLM arbiter ──────────────────────────────────────────────────────

def _routing_prompt(message: str, equipment_id: str | None, hours: int | None, history: list[dict]) -> str:
    tail = "\n".join(f"{t.get('role')}: {t.get('content','')[:200]}" for t in (history or [])[-4:])
    return (
        "You are an intent router for an HVAC operations assistant. Pick ONE engine. JSON only.\n\n"
        "ENGINES:\n"
        "- quick: a single factual/status question; fastest, one Q&A turn.\n"
        "- investigate: diagnostic 'why/what's happening' needing multi-step tools on ONE unit.\n"
        "- optimize: energy-saving / setpoint / efficiency recommendations.\n"
        "- root_cause: determine the cause of a fault/anomaly that already happened.\n"
        "- maintenance: predictive maintenance, remaining life, service scheduling.\n"
        "- brief: short status summary / morning report across the plant.\n"
        "- data_sql: raw numbers/rows/aggregations from the DB (counts, lists, averages, group-by).\n"
        "- orchestrate: broad question spanning MULTIPLE equipment or several analyses at once.\n\n"
        f"Known equipment ids: {', '.join(sorted(_KNOWN_IDS))}\n"
        f"Detected equipment: {equipment_id or 'none'} | detected hours: {hours if hours is not None else 'none'}\n"
        f"Recent turns:\n{tail or '(none)'}\n\n"
        f"USER MESSAGE: {message}\n\n"
        'Return JSON exactly: {"engine":"<one of the 8>","equipment_id":"<id or null>","hours":<int or null>,"rationale":"<one sentence>"}'
    )


async def _llm_arbiter(message, equipment_id, hours, history):
    model = settings.OLLAMA_AUDITOR_MODEL or settings.OLLAMA_DEFAULT_MODEL
    timeout = getattr(settings, "ASSISTANT_ROUTE_TIMEOUT_S", 3.0)
    try:
        raw = await asyncio.wait_for(
            generate_json(_routing_prompt(message, equipment_id, hours, history), model=model, temperature=0.0, timeout=timeout),
            timeout=timeout + 1.0,
        )
        return parse_first_json_object(raw)
    except Exception as exc:
        log.warning("router_llm_failed err=%s", exc)
        return None


# ── Orchestration ─────────────────────────────────────────────────────────────

async def classify(
    message: str,
    *,
    history: list[dict] | None = None,
    hours_default: int = 24,
    force_engine: str | None = None,
) -> RouteDecision:
    history = history or []
    equipment_id = extract_equipment(message, history)
    hours = extract_hours(message) or hours_default

    # Layer 0 — forced override
    if force_engine in ENGINES:
        return _finalize(force_engine, message, equipment_id, hours, "forced by user", "override")

    # Layer 1 — preflight guard (deterministic refusals, before any LLM)
    refusal = preflight.check_action_request(message) or preflight.check_equipment_mentions(message)
    if refusal:
        d = _finalize("quick", message, equipment_id, hours, "preflight refusal", "preflight")
        d.preflight_refusal = refusal
        return d

    # Layer 3 — keyword heuristics
    n_eq = len({preflight._canonical_id(m.group(1), m.group(2)) for m in preflight._EQUIPMENT_MENTION_RE.finditer(message or "")
                if preflight._canonical_id(m.group(1), m.group(2)) in _KNOWN_IDS})
    kw = keyword_engine(message, n_eq)
    skip_llm = getattr(settings, "ASSISTANT_ROUTE_SKIP_LLM_ON_KEYWORD", True)
    if kw and skip_llm and len(message or "") < 120:
        return _finalize(kw, message, equipment_id, hours, f"keyword:{kw}", "heuristic")

    # Layer 4 — LLM arbiter
    parsed = await _llm_arbiter(message, equipment_id, hours, history)
    if parsed and parsed.get("engine") in ENGINES:
        engine = parsed["engine"]
        # Layer 5 — reconcile: LLM equipment only if valid; else keep extracted.
        llm_eq = parsed.get("equipment_id")
        if llm_eq in _KNOWN_IDS:
            equipment_id = llm_eq
        llm_hours = parsed.get("hours")
        if isinstance(llm_hours, int) and _MIN_HOURS <= llm_hours <= _MAX_HOURS:
            hours = llm_hours
        return _finalize(engine, message, equipment_id, hours, (parsed.get("rationale") or "")[:200], "llm")

    # Fallbacks: keyword (if any) → quick
    if kw:
        return _finalize(kw, message, equipment_id, hours, f"keyword:{kw}", "heuristic")
    return _finalize("quick", message, equipment_id, hours, "default", "default")


def _finalize(engine, message, equipment_id, hours, rationale, source) -> RouteDecision:
    d = RouteDecision(engine=engine, mode=engine, equipment_id=equipment_id, hours=hours,
                      rationale=rationale, source=source)
    d.dispatch = build_dispatch(engine, message, equipment_id, hours)
    return d


def build_dispatch(engine: str, message: str, equipment_id: str | None, hours: int, thread_id: str | None = None) -> dict:
    """Engine → the existing endpoint + body the UI should call. Single source of truth."""
    ctx = {"equipment_id": equipment_id, "hours": hours}
    if engine == "quick":
        return {"method": "POST", "path": "/api/v1/analyze", "stream": True,
                "body": {"question": message, "equipment_id": equipment_id, "hours": hours, "thread_id": thread_id, "verify": True}}
    if engine in _AGENT_MODE:
        return {"method": "POST", "path": "/api/v1/agent/run", "stream": True,
                "body": {"mode": _AGENT_MODE[engine], "goal": message, "context": ctx, "thread_id": thread_id}}
    if engine == "data_sql":
        return {"method": "POST", "path": "/api/v1/nl-query", "stream": False,
                "body": {"question": message}}
    if engine == "orchestrate":
        return {"method": "POST", "path": "/api/v1/agent/orchestrate", "stream": True,
                "body": {"goal": message, "context": ctx, "thread_id": thread_id}}
    return {"method": "POST", "path": "/api/v1/analyze", "stream": True,
            "body": {"question": message, "equipment_id": equipment_id, "hours": hours, "thread_id": thread_id, "verify": True}}
