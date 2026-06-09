"""Model roster — human-readable map of WHO makes each model and WHAT each role
is for.

Separation of concerns:
  • WHICH model does each job → app/config.py (OLLAMA_MODEL_*), .env-overridable.
  • WHO / WHAT (maker, country, size, purpose) → this file, for display + the
    non-Chinese policy.

Selections trace to model-eval/reports/MODEL_EVAL_FINAL_REPORT.md (Claude-judged,
real Unicharm data, non-Chinese, app-confirmed). Powers GET /api/v1/models and
the "model in use" UI toasts.
"""
from __future__ import annotations

# ── Provenance + specs per model (as pulled on the Ollama server) ─────────────
MODEL_INFO: dict[str, dict] = {
    "gemma4:12b":              {"maker": "Google",     "country": "US", "params": "12B",  "kind": "thinking"},
    "gemma3:27b":              {"maker": "Google",     "country": "US", "params": "27B",  "kind": "text"},
    "devstral:latest":         {"maker": "Mistral AI", "country": "FR", "params": "24B",  "kind": "tool / agent"},
    "codestral:latest":        {"maker": "Mistral AI", "country": "FR", "params": "22B",  "kind": "code / SQL"},
    "mistral-small3.2:latest": {"maker": "Mistral AI", "country": "FR", "params": "24B",  "kind": "general"},
    "phi4":                    {"maker": "Microsoft",  "country": "US", "params": "14B",  "kind": "text"},
    "llama3.2-vision":         {"maker": "Meta",       "country": "US", "params": "11B",  "kind": "vision"},
    "nomic-embed-text":        {"maker": "Nomic AI",   "country": "US", "params": "0.1B", "kind": "embeddings"},
    "mxbai-embed-large":       {"maker": "Mixedbread", "country": "DE", "params": "0.3B", "kind": "embeddings"},
    # Other models on the server (e.g. for a quick demo swap). qwen/qwq are
    # Chinese-origin — excluded from prod by policy, fine for an ad-hoc demo.
    "gpt-oss:20b":             {"maker": "OpenAI",     "country": "US", "params": "20B",  "kind": "thinking"},
    "llama3.1:8b":             {"maker": "Meta",       "country": "US", "params": "8B",   "kind": "general"},
    "llama3.3:latest":         {"maker": "Meta",       "country": "US", "params": "70B",  "kind": "general"},
    "mistral-small:latest":    {"maker": "Mistral AI", "country": "FR", "params": "22B",  "kind": "general"},
    "qwen2.5:14b":             {"maker": "Alibaba",    "country": "CN", "params": "14B",  "kind": "general"},
    "qwen2.5:32b":             {"maker": "Alibaba",    "country": "CN", "params": "32B",  "kind": "general"},
    "qwen2.5-coder:32b":       {"maker": "Alibaba",    "country": "CN", "params": "32B",  "kind": "code / SQL"},
    "qwq:32b":                 {"maker": "Alibaba",    "country": "CN", "params": "32B",  "kind": "thinking"},
}

# ── Roles: what each job is for + which settings knob holds its model ──────────
# Order = rough request flow. `setting` resolves against app.config.settings
# (so .env overrides apply); None = fixed model not configurable via settings.
ROLES: dict[str, dict] = {
    "text":    {"purpose": "Narration & Analyzer answer streaming",          "setting": "OLLAMA_MODEL_TEXT"},
    "tool":    {"purpose": "Agent ReAct executor — tool calling",            "setting": "OLLAMA_MODEL_TOOL"},
    "sql":     {"purpose": "Natural-language → SQL over telemetry",          "setting": "OLLAMA_MODEL_SQL"},
    "planner": {"purpose": "Multi-agent planner (JSON plan)",                "setting": "OLLAMA_MODEL_PLANNER"},
    "auditor": {"purpose": "Self-critique / fact-check validator",           "setting": "OLLAMA_AUDITOR_MODEL"},
    "rag":     {"purpose": "RAG-grounded answer from manuals",               "setting": "OLLAMA_MODEL_RAG"},
    "vision":  {"purpose": "Image analysis (gauges / nameplates / thermal)", "setting": "OLLAMA_VISION_MODEL"},
    "embed":   {"purpose": "Embeddings — RAG index + search",                "setting": None, "fixed": "nomic-embed-text"},
}

_FLAG = {"US": "🇺🇸", "FR": "🇫🇷", "DE": "🇩🇪", "CA": "🇨🇦", "CN": "🇨🇳"}


def resolve_roster(settings) -> dict[str, dict]:
    """Live role → model + provenance, honoring .env overrides + DEFAULT fallback."""
    default = settings.OLLAMA_DEFAULT_MODEL
    roster: dict[str, dict] = {}
    for role, meta in ROLES.items():
        if meta.get("fixed"):
            model = meta["fixed"]
        else:
            model = getattr(settings, meta["setting"], "") or default
        info = MODEL_INFO.get(model, {"maker": "—", "country": "—", "params": "—", "kind": "—"})
        roster[role] = {
            "model":   model,
            "purpose": meta["purpose"],
            "maker":   info["maker"],
            "country": info["country"],
            "flag":    _FLAG.get(info["country"], ""),
            "params":  info["params"],
            "kind":    info["kind"],
        }
    return roster
