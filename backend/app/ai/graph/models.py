"""Per-task model router for the agentic graph (F1.1 / F1.2).

Mirrors the eval-backed routing in ``app/config.py`` (the ``OLLAMA_MODEL_*``
settings). Each task role maps to one Ollama model; an empty setting falls back
to ``OLLAMA_DEFAULT_MODEL`` (and ``rag`` falls back to the ``text`` model, matching
``OLLAMA_MODEL_RAG = ""`` today).

``langchain_ollama`` is imported lazily inside the factory so this module is
importable before the rewrite deps are installed (they live in
``requirements-agentic.txt``, resolved on the box at F0.4).

Model selection itself is unchanged — this is a like-for-like port of the current
routing onto ``ChatOllama``. See ADR-0002.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any, Literal

from app.config import settings

Role = Literal["text", "tool", "sql", "planner", "auditor", "rag", "vision"]


def model_name_for(role: Role) -> str:
    """Resolve the Ollama model tag for a task role.

    Empty setting → ``OLLAMA_DEFAULT_MODEL``; ``rag`` → ``text`` model when unset
    (exactly the current behaviour in ``config.py`` / the surfaces).
    """
    mapping: dict[str, str] = {
        "text":    settings.OLLAMA_MODEL_TEXT,
        "tool":    settings.OLLAMA_MODEL_TOOL,
        "sql":     settings.OLLAMA_MODEL_SQL,
        "planner": settings.OLLAMA_MODEL_PLANNER,
        "auditor": settings.OLLAMA_AUDITOR_MODEL,
        "rag":     settings.OLLAMA_MODEL_RAG,
        "vision":  settings.OLLAMA_VISION_MODEL,
    }
    name = (mapping.get(role) or "").strip()
    if role == "rag" and not name:
        name = (settings.OLLAMA_MODEL_TEXT or "").strip()
    return name or settings.OLLAMA_DEFAULT_MODEL


@lru_cache(maxsize=None)
def chat_model(role: Role, *, temperature: float = 0.0, num_predict: int | None = None) -> Any:
    """Return a cached ``ChatOllama`` for a task role.

    ``num_predict`` (response token cap) is passed by callers per surface
    (the existing ``OLLAMA_MAX_TOKENS_*`` budgets) — performance must-hold A2.
    Exact ``ChatOllama`` kwargs are verified on the box once deps are installed.
    """
    from langchain_ollama import ChatOllama  # lazy — dep lands at F0.4
    from app.llm.ollama import _num_ctx_for  # reuse the canonical per-tier sizing

    name = model_name_for(role)
    return ChatOllama(
        model=name,
        base_url=settings.OLLAMA_HOST,
        temperature=temperature,
        num_predict=num_predict,
        # Keep the model resident between calls so single-model paths (analyze/agent)
        # don't cold-load each request — cuts the "empty answer on cold-load" case.
        # (Doesn't beat the VRAM ceiling: orchestrate's cross-model swaps still reload
        # on the 20 GB box; 48 GB fixes that.)
        keep_alive=settings.OLLAMA_KEEP_ALIVE,
        # CRITICAL: langchain defaults num_ctx=2048 → a ~3.5k-token analyzer prompt
        # gets truncated → empty/garbage output. Mirror ollama.py's per-tier sizing.
        num_ctx=_num_ctx_for(name),
    )


def structured_model(role: Role, schema: type, *, temperature: float = 0.0) -> Any:
    """A ``ChatOllama`` bound to a Pydantic schema via ``with_structured_output``.

    Used for the planner, critique, and tool-arg paths (F1.6/F1.7) — replaces the
    fragile prose-JSON parsing in ``json_utils`` (kept only as a fallback).
    """
    return chat_model(role, temperature=temperature).with_structured_output(schema)


def with_retries(model: Any, *, attempts: int = 3) -> Any:
    """Wrap a model/runnable with retry+backoff for transient Ollama errors (F1.9).

    NOTE: fail-fast on permanent errors (404 model-missing) is added at the call
    site — LangChain's ``with_retry`` does exponential backoff; the 404 vs 5xx
    distinction is applied where the call is made, alongside the existing circuit
    breaker in ``app/llm/ollama.py``.
    """
    return model.with_retry(stop_after_attempt=attempts)
