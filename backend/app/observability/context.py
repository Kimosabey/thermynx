"""Request-scoped correlation context.

The middleware in ``main.py`` generates a per-request UUID and stores it in
``request.state.request_id``. That works for handler code that has the
``Request`` object in scope, but breaks for deeper code (LLM clients, DB
helpers) that doesn't.

This module exposes a ``ContextVar`` that any code path can read to discover
the current request ID — no plumbing required. The middleware sets it; tasks
spawned in the request inherit it automatically (ContextVar is per-asyncio-task).

Use:
    from app.observability.context import current_request_id
    rid = current_request_id.get()        # returns "" if not in a request
"""

from __future__ import annotations

from contextvars import ContextVar

# Empty string default — never raises; callers can `or "-"` to render in logs.
current_request_id: ContextVar[str] = ContextVar("current_request_id", default="")
