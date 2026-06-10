"""Langfuse callbacks for the agentic graph (F6.1) — per-node / per-LLM spans.

Returns a LangChain ``CallbackHandler`` when Langfuse is configured (self-hosted:
``LANGFUSE_HOST`` + keys), else ``[]``. Fully no-op + exception-safe: an
unconfigured or unreachable Langfuse never affects graph execution. When the obs
stack is up, every graph node and LLM call shows up as a span in the Langfuse UI.

Wired once in ``sse.astream_sse`` so all surfaces (agentic endpoints + flipped
live endpoints) are traced automatically.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.log import get_logger

log = get_logger("ai.graph.tracing")


@lru_cache(maxsize=1)
def _handler() -> Any:
    try:
        from app.config import settings
        if not (settings.LANGFUSE_HOST and settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY):
            return None
        # Configure the singleton client from settings, then build the handler.
        from langfuse import Langfuse
        Langfuse(
            host=settings.LANGFUSE_HOST,
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
        )
        from langfuse.langchain import CallbackHandler
        return CallbackHandler()
    except Exception as e:  # never let tracing break the graph
        log.warning("langfuse_handler_unavailable err=%s", e)
        return None


def graph_callbacks() -> list:
    """LangChain callbacks to attach to a graph run (empty when Langfuse is off)."""
    h = _handler()
    return [h] if h is not None else []
