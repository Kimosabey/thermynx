"""Langfuse span tracing — optional, self-hosted, MIT license.

Every LLM call, tool call, postcheck and critique gets a span so operators
can drill into "why did this answer say 0.72 kW/TR?" in the Langfuse UI.

Configuration (via environment variables / config.py):
  LANGFUSE_HOST        http://localhost:3200
  LANGFUSE_PUBLIC_KEY  pk-lf-thermynx-dev
  LANGFUSE_SECRET_KEY  sk-lf-thermynx-dev

When LANGFUSE_HOST is empty (the default) all calls are no-ops.
This makes tracing additive — the backend works identically without it.

Usage:
  async with new_trace("analyze", input={"question": q}) as trace:
      async with trace.span("llm_call", input={"model": m}) as span:
          result = await chat(...)
          span.end(output=result)

The Langfuse SDK is imported lazily so the backend starts even if the
`langfuse` package isn't installed — it's an optional dependency.
"""
from __future__ import annotations

import contextlib
import logging
from typing import Any

log = logging.getLogger("llm.tracing")


def _client():
    """Return a Langfuse client or None if not configured / not installed."""
    try:
        from app.config import settings
        if not settings.LANGFUSE_HOST or not settings.LANGFUSE_PUBLIC_KEY:
            return None
        from langfuse import Langfuse
        return Langfuse(
            host=settings.LANGFUSE_HOST,
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
        )
    except Exception:
        return None


class _NoopSpan:
    """Returned when Langfuse is not configured — all methods are no-ops."""
    def __init__(self, name: str = ""):
        self.name = name

    def span(self, name: str, **_):
        return contextlib.nullcontext(self)

    def end(self, **_):
        pass

    def update(self, **_):
        pass

    def generation(self, **_):
        return contextlib.nullcontext(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        pass


@contextlib.asynccontextmanager
async def new_trace(name: str, *, input: dict[str, Any] | None = None, user_id: str | None = None):
    """Top-level trace context.  Usage: async with new_trace("analyze") as t: ..."""
    lf = _client()
    if lf is None:
        yield _NoopSpan(name)
        return

    trace = lf.trace(name=name, input=input, user_id=user_id)
    try:
        yield trace
    finally:
        try:
            lf.flush()
        except Exception as e:
            log.debug("langfuse_flush_failed err=%s", e)


@contextlib.asynccontextmanager
async def span(trace_or_span, name: str, *, input: dict[str, Any] | None = None):
    """Child span.  Usage: async with span(trace, "llm_call") as s: ..."""
    if isinstance(trace_or_span, _NoopSpan):
        yield _NoopSpan(name)
        return

    try:
        s = trace_or_span.span(name=name, input=input)
        yield s
        s.end()
    except Exception as e:
        log.debug("langfuse_span_failed name=%s err=%s", name, e)
        yield _NoopSpan(name)
