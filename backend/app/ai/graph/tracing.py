"""Langfuse callbacks for the agentic graph (F6.1) — per-node / per-LLM spans.

DISABLED / FUTURE-ONLY — not used by the product today. Tracing is intentionally
off: the Langfuse server is commented out in ``docker-compose.yml`` and the SDK is
commented out in ``requirements.txt``. ``graph_callbacks()`` returns ``[]`` while
``LANGFUSE_HOST`` is empty (the default), so Langfuse is never imported and never
touches graph execution. This thin shim is kept ON PURPOSE so re-enabling later is
CONFIG-ONLY, not a re-implementation.

Re-enable ONLY IF tracing is wanted (e.g. on the 48 GB box): uncomment + install the
SDK, stand up the v3 server (web+worker+clickhouse+redis+minio), then set
``LANGFUSE_HOST`` + keys. After that, every graph node / LLM call becomes a span.

Returns a LangChain ``CallbackHandler`` when configured, else ``[]``. Exception-safe:
an unconfigured / unreachable / uninstalled Langfuse is always a clean no-op.
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
