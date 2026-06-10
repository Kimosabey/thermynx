"""Runtime model configuration — apply per-role model changes live (no restart).

Mutates the in-memory `settings` singleton, so every service that reads
`settings.OLLAMA_MODEL_*` at call time picks the change up on its next request.

Session-scoped on purpose: a restart reverts to the committed `.env`/config
defaults (snapshotted here at import). The committed config stays the source of
truth; the UI knob is for demos / quick swaps (e.g. flip everything to qwen).
"""
from __future__ import annotations

import httpx

from app.ai.model_roster import MODEL_INFO, _FLAG
from app.config import settings
from app.log import get_logger

log = get_logger("ai.model_config")

# UI-editable role → settings attribute. (embed is fixed — changing the embedder
# would invalidate the existing 768-dim vectors, so it is intentionally excluded.)
EDITABLE: dict[str, str] = {
    "text":    "OLLAMA_MODEL_TEXT",
    "tool":    "OLLAMA_MODEL_TOOL",
    "sql":     "OLLAMA_MODEL_SQL",
    "planner": "OLLAMA_MODEL_PLANNER",
    "auditor": "OLLAMA_AUDITOR_MODEL",
    "rag":     "OLLAMA_MODEL_RAG",
    "vision":  "OLLAMA_VISION_MODEL",
}

# Snapshot the startup (committed/.env) values so reset() can restore them.
_DEFAULTS: dict[str, str] = {attr: getattr(settings, attr) for attr in EDITABLE.values()}
_DEFAULTS["OLLAMA_DEFAULT_MODEL"] = settings.OLLAMA_DEFAULT_MODEL


async def available_models() -> list[dict]:
    """Models actually pulled on the Ollama server, enriched with maker/flag."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(f"{settings.OLLAMA_HOST}/api/tags")
            r.raise_for_status()
            names = sorted(m["name"] for m in r.json().get("models", []))
    except Exception as e:
        log.warning("available_models_failed err=%s", e)
        return []
    out = []
    for n in names:
        info = MODEL_INFO.get(n) or MODEL_INFO.get(n.split(":")[0]) or {}
        out.append({
            "name":    n,
            "maker":   info.get("maker", "—"),
            "country": info.get("country", "—"),
            "flag":    _FLAG.get(info.get("country", ""), ""),
            "params":  info.get("params", "—"),
            "kind":    info.get("kind", "—"),
        })
    return out


def apply_overrides(overrides: dict[str, str]) -> list[str]:
    """Set role→model live on `settings`. Returns the roles applied; unknown
    roles / empty models are skipped. Caller validates the models exist."""
    applied: list[str] = []
    for role, model in overrides.items():
        attr = EDITABLE.get(role)
        if not attr or not model:
            continue
        setattr(settings, attr, model)
        applied.append(role)
    if applied:
        log.info("model_overrides_applied %s", {r: overrides[r] for r in applied})
    return applied


def reset() -> None:
    """Restore the committed/.env defaults captured at import."""
    for attr, val in _DEFAULTS.items():
        setattr(settings, attr, val)
    log.info("model_overrides_reset")
