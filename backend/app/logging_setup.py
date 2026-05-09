"""Central logging configuration for uvicorn + thermynx.* hierarchy.

Namespaces in use:
  thermynx.app          — lifespan / startup
  thermynx.access       — HTTP access (method path status ms request_id)
  thermynx.api.*        — route modules (analyzer, agent, health, reports, threads, …)
  thermynx.llm.ollama   — Ollama HTTP client
  thermynx.services.agent — ReAct agent loop
  thermynx.domain.tools — agent tool execution
  thermynx.jobs.anomaly_scan — scheduled anomaly job

Add ``from app.log import get_logger`` and ``log = get_logger("api.mymodule")`` in new code.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.config import settings


class JsonFormatter(logging.Formatter):
    """One JSON object per line (structured logs for collectors)."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def _resolve_level(name: str) -> int:
    return getattr(logging, name.upper(), logging.INFO)


def configure_logging() -> None:
    """
    Attach a single handler to ``thermynx`` (non-propagating).
    Child loggers ``thermynx.api``, ``thermynx.llm``, etc. propagate into it.
    Aligns uvicorn log levels with ``LOG_LEVEL``.
    """
    level = _resolve_level(settings.LOG_LEVEL)

    if settings.LOG_JSON:
        formatter: logging.Formatter = JsonFormatter()
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    handler.setFormatter(formatter)

    tnx = logging.getLogger("thermynx")
    tnx.handlers.clear()
    tnx.addHandler(handler)
    tnx.setLevel(level)
    tnx.propagate = False

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        logging.getLogger(name).setLevel(level)

    if settings.LOG_LEVEL.upper() == "DEBUG":
        logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
